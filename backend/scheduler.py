"""
Scheduler — APScheduler with AsyncIOScheduler for automated health data sync.
Runs in the same process as the Telegram bot.

Schedule (Europe/Sofia):
    10:00 — sync_oura → check_alerts → update_weekly_summary
    18:00 — sync_oura → check_alerts (include missing nutrition check)
    00:00 — sync_oura → update_weekly_summary
    Sunday 10:00 — ai_weekly_summary
"""

import asyncio

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
import pytz

from backend.config import TIMEZONE, TELEGRAM_USER_ID
from backend.utils.logger import get_logger

log = get_logger("SCHEDULER")

SOFIA_TZ = pytz.timezone(TIMEZONE)

# Delay between sequential jobs (seconds) — avoids Google Sheets rate limiting
JOB_DELAY = 5


class HealthScheduler:
    """Manages all scheduled health-data jobs."""

    def __init__(self, bot=None):
        """
        Args:
            bot: telegram.Bot instance for sending notifications.
                 Set after the Telegram application is initialized.
        """
        self.scheduler = AsyncIOScheduler(timezone=SOFIA_TZ)
        self.bot = bot  # telegram.Bot instance
        self._sheets = None

    # ─── Shared Resources ────────────────────────────────────────────

    def _get_sheets(self):
        """Lazy-load a shared SheetsClient."""
        if self._sheets is None:
            from backend.clients.sheets_client import SheetsClient
            self._sheets = SheetsClient()
            self._sheets.connect()
        return self._sheets

    async def _send_notification(self, message: str, parse_mode: str = "Markdown"):
        """Send a Telegram notification to the user."""
        if self.bot and TELEGRAM_USER_ID:
            try:
                await self.bot.send_message(
                    chat_id=TELEGRAM_USER_ID,
                    text=message,
                    parse_mode=parse_mode,
                )
            except Exception as e:
                log.error("notification", f"Failed to send Telegram notification: {e}")

    # ─── Scheduled Jobs ──────────────────────────────────────────────

    async def job_morning_sync(self):
        """10:00 — sync_oura → check_alerts → update_weekly_summary"""
        log.info("job", "START — Morning sync (10:00)")
        try:
            await self._run_oura_sync()
            await asyncio.sleep(JOB_DELAY)

            await self._run_alerts(check_nutrition=False)
            await asyncio.sleep(JOB_DELAY)

            await self._run_weekly_summary()

            log.info("job", "SUCCESS — Morning sync complete")
        except Exception as e:
            log.error("job", f"FAILED — Morning sync: {e}")
            await self._send_notification(f"⚠️ Morning sync failed: {e}")

    async def job_evening_sync(self):
        """18:00 — sync_oura → check_alerts (include missing nutrition check)"""
        log.info("job", "START — Evening sync (18:00)")
        try:
            await self._run_oura_sync()
            await asyncio.sleep(JOB_DELAY)

            await self._run_alerts(check_nutrition=True)

            log.info("job", "SUCCESS — Evening sync complete")
        except Exception as e:
            log.error("job", f"FAILED — Evening sync: {e}")
            await self._send_notification(f"⚠️ Evening sync failed: {e}")

    async def job_midnight_sync(self):
        """00:00 — sync_oura → update_weekly_summary"""
        log.info("job", "START — Midnight sync (00:00)")
        try:
            await self._run_oura_sync()
            await asyncio.sleep(JOB_DELAY)

            await self._run_weekly_summary()

            log.info("job", "SUCCESS — Midnight sync complete")
        except Exception as e:
            log.error("job", f"FAILED — Midnight sync: {e}")
            await self._send_notification(f"⚠️ Midnight sync failed: {e}")

    async def job_weekly_ai_summary(self):
        """Sunday 10:00 — generate and send AI weekly summary"""
        log.info("job", "START — Weekly AI summary (Sunday)")
        try:
            from backend.services.summary_service import SummaryService
            sheets = self._get_sheets()
            summary_svc = SummaryService(sheets)

            result = await summary_svc.generate_ai_summary()

            if result.get("success"):
                await self._send_notification(
                    f"📊 *Weekly Health Summary*\n\n{result['summary_text']}"
                )
            else:
                error = result.get("error", "Unknown error")
                log.error("job", f"AI summary failed: {error}")
                await self._send_notification(f"⚠️ AI summary generation failed: {error}")

            log.info("job", "SUCCESS — Weekly AI summary complete")
        except Exception as e:
            log.error("job", f"FAILED — Weekly AI summary: {e}")
            await self._send_notification(f"⚠️ Weekly AI summary failed: {e}")

    # ─── Job Helpers ─────────────────────────────────────────────────

    async def _run_oura_sync(self):
        """Execute Oura → Google Sheets sync (7-day lookback)."""
        from backend.clients.oura_client import OuraClient
        from backend.services.sync_service import SyncService

        sheets = self._get_sheets()
        oura = OuraClient()
        sync = SyncService(sheets, oura)

        result = sync.sync_oura()  # Uses default 7-day lookback

        if result["errors"]:
            raise RuntimeError(f"Oura sync errors: {result['errors']}")

        log.info("oura_sync", f"Synced {result['days_updated']} days ({result['start_date']} → {result['end_date']})")

    async def _run_alerts(self, check_nutrition: bool = False):
        """Execute alert checks and send triggered alerts via Telegram."""
        from backend.services.alert_service import AlertService

        sheets = self._get_sheets()
        alert_svc = AlertService(sheets)
        alerts = alert_svc.check_alerts(check_nutrition=check_nutrition)

        for alert in alerts:
            await self._send_notification(alert["message"])
            await asyncio.sleep(1)  # Small delay between alert messages

    async def _run_weekly_summary(self):
        """Execute weekly summary recalculation."""
        from backend.services.summary_service import SummaryService

        sheets = self._get_sheets()
        summary_svc = SummaryService(sheets)
        summary_svc.update_all_weekly_summaries()

    # ─── Lifecycle ───────────────────────────────────────────────────

    def setup_jobs(self):
        """Register all scheduled jobs."""
        # 10:00 — Morning sync
        self.scheduler.add_job(
            self.job_morning_sync,
            CronTrigger(hour=10, minute=0, timezone=SOFIA_TZ),
            id="morning_sync",
            name="Morning Sync (10:00)",
            replace_existing=True,
        )

        # 18:00 — Evening sync
        self.scheduler.add_job(
            self.job_evening_sync,
            CronTrigger(hour=18, minute=0, timezone=SOFIA_TZ),
            id="evening_sync",
            name="Evening Sync (18:00)",
            replace_existing=True,
        )

        # 00:00 — Midnight sync
        self.scheduler.add_job(
            self.job_midnight_sync,
            CronTrigger(hour=0, minute=0, timezone=SOFIA_TZ),
            id="midnight_sync",
            name="Midnight Sync (00:00)",
            replace_existing=True,
        )

        # Sunday 10:00 — AI Weekly Summary
        self.scheduler.add_job(
            self.job_weekly_ai_summary,
            CronTrigger(day_of_week="sun", hour=10, minute=0, timezone=SOFIA_TZ),
            id="weekly_ai_summary",
            name="Weekly AI Summary (Sun 10:00)",
            replace_existing=True,
        )

        log.info("setup", "Scheduled 4 jobs:")
        for job in self.scheduler.get_jobs():
            next_run = getattr(job, 'next_run_time', None)
            log.info("setup", f"  • {job.name}" + (f" → next run: {next_run}" if next_run else ""))

    def start(self):
        """Start the scheduler."""
        self.setup_jobs()
        self.scheduler.start()
        log.info("start", "Scheduler started")

    def stop(self):
        """Stop the scheduler gracefully."""
        if self.scheduler.running:
            self.scheduler.shutdown(wait=False)
            log.info("stop", "Scheduler stopped")
