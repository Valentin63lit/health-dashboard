"""
Health Dashboard — CLI entry point.
Run jobs manually for testing and development.

Usage:
    python -m backend.main test-sheets     # Test Google Sheets connection
    python -m backend.main test-oura       # Test Oura API connection
    python -m backend.main setup-sheets    # Create tabs and headers
    python -m backend.main sync            # Run Oura sync (last 7 days)
    python -m backend.main sync-40         # Run Oura sync (last 40 days)
    python -m backend.main import <file>   # Import MacroFactor .xlsx file
    python -m backend.main bot             # Start Telegram bot (polling)
    python -m backend.main run             # Start bot + scheduler (production)
    python -m backend.main alerts          # Run alert checks manually
    python -m backend.main weekly          # Recalculate weekly summaries
    python -m backend.main ai-summary      # Generate AI summary on demand
"""

import sys
from pathlib import Path

# Add project root to path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from backend.config import validate_config, LOG_LEVEL
from backend.utils.logger import setup_logging, get_logger

# Initialize logging first
setup_logging(LOG_LEVEL)
log = get_logger("MAIN")


def cmd_test_sheets():
    """Test Google Sheets connection."""
    from backend.clients.sheets_client import SheetsClient
    client = SheetsClient()
    success = client.test_connection()
    if success:
        print("\n✅ Google Sheets connection successful!")
    else:
        print("\n❌ Google Sheets connection failed. Check your service-account.json and GOOGLE_SHEET_ID.")
    return success


def cmd_setup_sheets():
    """Set up Google Sheets tabs and headers."""
    from backend.clients.sheets_client import SheetsClient
    client = SheetsClient()
    client.connect()
    client.setup_tabs()
    print("\n✅ Google Sheets tabs set up successfully!")
    return True


def cmd_test_oura():
    """Test Oura API connection."""
    from backend.clients.oura_client import OuraClient
    client = OuraClient()
    success = client.test_connection()
    if success:
        print("\n✅ Oura API connection successful!")
    else:
        print("\n❌ Oura API connection failed. Check your OURA_API_TOKEN.")
    return success


def cmd_sync():
    """Run Oura sync for last 7 days."""
    from backend.clients.sheets_client import SheetsClient
    from backend.clients.oura_client import OuraClient
    from backend.services.sync_service import SyncService

    sheets = SheetsClient()
    sheets.connect()
    oura = OuraClient()
    sync = SyncService(sheets, oura)

    result = sync.sync_oura()
    print(f"\n📊 Sync complete:")
    print(f"   Days fetched from Oura: {result['days_fetched']}")
    print(f"   Days updated in Sheet:  {result['days_updated']}")
    print(f"   Date range: {result['start_date']} to {result['end_date']}")
    if result['errors']:
        print(f"   Errors: {result['errors']}")
    return not result['errors']


def cmd_import(file_path: str):
    """Import a MacroFactor .xlsx file."""
    from backend.clients.sheets_client import SheetsClient
    from backend.services.nutrition_service import NutritionService

    if not Path(file_path).exists():
        print(f"❌ File not found: {file_path}")
        return False

    sheets = SheetsClient()
    sheets.connect()
    nutrition = NutritionService(sheets)

    result = nutrition.import_macrofactor_file(file_path)
    print(f"\n{result['message']}")
    return result['success']


def cmd_sync_40():
    """Run Oura sync for last 40 days (to catch older data)."""
    from backend.clients.sheets_client import SheetsClient
    from backend.clients.oura_client import OuraClient
    from backend.services.sync_service import SyncService

    sheets = SheetsClient()
    sheets.connect()
    sheets.setup_tabs()  # Ensure headers are up to date
    oura = OuraClient()
    sync = SyncService(sheets, oura)

    result = sync.sync_oura(lookback_days=40)
    print(f"\n📊 Sync (40-day) complete:")
    print(f"   Days fetched from Oura: {result['days_fetched']}")
    print(f"   Days updated in Sheet:  {result['days_updated']}")
    print(f"   Date range: {result['start_date']} to {result['end_date']}")
    if result['errors']:
        print(f"   Errors: {result['errors']}")
    return not result['errors']


def cmd_bot():
    """Start the Telegram bot."""
    from backend.clients.telegram_bot import start_bot
    print("🤖 Starting Telegram bot...")
    print("   Press Ctrl+C to stop.\n")
    start_bot()
    return True


def cmd_run():
    """Start both the Telegram bot AND the scheduler (production entry point)."""
    from telegram import Update
    from telegram.ext import (
        Application,
        CommandHandler,
        MessageHandler,
        filters,
    )
    from backend.config import TELEGRAM_BOT_TOKEN
    from backend.scheduler import HealthScheduler
    from backend.clients import telegram_bot as tg

    scheduler = HealthScheduler()

    async def post_init(application: Application):
        """Called after the bot is initialized — start the scheduler."""
        scheduler.bot = application.bot
        scheduler.start()
        log.info("run", "Scheduler started alongside bot")

    async def post_shutdown(application: Application):
        """Called when the bot is shutting down — stop the scheduler."""
        scheduler.stop()
        log.info("run", "Scheduler stopped")

    # Build the application with post_init/post_shutdown hooks
    app = (
        Application.builder()
        .token(TELEGRAM_BOT_TOKEN)
        .post_init(post_init)
        .post_shutdown(post_shutdown)
        .build()
    )

    # Register the same handlers as create_application()
    app.add_handler(CommandHandler("start", tg.cmd_start))
    app.add_handler(CommandHandler("help", tg.cmd_help))
    app.add_handler(CommandHandler("status", tg.cmd_status))
    app.add_handler(CommandHandler("today", tg.cmd_today))
    app.add_handler(CommandHandler("week", tg.cmd_week))
    app.add_handler(CommandHandler("goals", tg.cmd_goals))
    app.add_handler(CommandHandler("summary", tg.cmd_summary))
    app.add_handler(CommandHandler("sync", tg.cmd_sync))
    app.add_handler(MessageHandler(filters.Document.ALL, tg.handle_document))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, tg.handle_text))

    print("\n🚀 Starting Health Dashboard (bot + scheduler)...")
    print("   Telegram bot: polling for messages")
    print("   Scheduler: cron jobs active (10:00, 18:00, 00:00 Sofia)")
    print("   Press Ctrl+C to stop.\n")

    app.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True,
    )
    return True


def cmd_alerts():
    """Run alert checks manually."""
    from backend.clients.sheets_client import SheetsClient
    from backend.services.alert_service import AlertService

    sheets = SheetsClient()
    sheets.connect()
    alert_svc = AlertService(sheets)

    alerts = alert_svc.check_alerts(check_nutrition=True)

    if alerts:
        print(f"\n🚨 {len(alerts)} alert(s) triggered:")
        for a in alerts:
            print(f"   {a['severity']} {a['title']}")
            print(f"      {a['message'][:100]}...")
    else:
        print("\n✅ No alerts triggered.")
    return True


def cmd_weekly():
    """Recalculate weekly summaries."""
    from backend.clients.sheets_client import SheetsClient
    from backend.services.summary_service import SummaryService

    sheets = SheetsClient()
    sheets.connect()
    summary_svc = SummaryService(sheets)

    summary_svc.update_all_weekly_summaries()
    print("\n✅ Weekly summaries updated.")
    return True


def cmd_ai_summary():
    """Generate AI summary on demand."""
    import asyncio
    from backend.clients.sheets_client import SheetsClient
    from backend.services.summary_service import SummaryService

    sheets = SheetsClient()
    sheets.connect()
    summary_svc = SummaryService(sheets)

    print("\n⏳ Generating AI summary...")
    result = asyncio.run(summary_svc.generate_ai_summary())

    if result.get("success"):
        print(f"\n📊 AI Summary:\n{result['summary_text']}")
    else:
        print(f"\n❌ Failed: {result.get('error', 'Unknown error')}")
    return result.get("success", False)


def cmd_test_all():
    """Run all connection tests."""
    print("=" * 60)
    print("🧪 Testing all connections...")
    print("=" * 60)

    print("\n--- Google Sheets ---")
    sheets_ok = cmd_test_sheets()

    print("\n--- Oura API ---")
    oura_ok = cmd_test_oura()

    print("\n" + "=" * 60)
    if sheets_ok and oura_ok:
        print("✅ All connections working!")
    else:
        failures = []
        if not sheets_ok:
            failures.append("Google Sheets")
        if not oura_ok:
            failures.append("Oura API")
        print(f"❌ Failed: {', '.join(failures)}")
    print("=" * 60)
    return sheets_ok and oura_ok


def main():
    """Main CLI entry point."""
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    command = sys.argv[1].lower()

    # Validate config before running any command
    validate_config()

    commands = {
        "test-sheets": cmd_test_sheets,
        "test-oura": cmd_test_oura,
        "setup-sheets": cmd_setup_sheets,
        "sync": cmd_sync,
        "sync-40": cmd_sync_40,
        "bot": cmd_bot,
        "run": cmd_run,
        "alerts": cmd_alerts,
        "weekly": cmd_weekly,
        "ai-summary": cmd_ai_summary,
        "test-all": cmd_test_all,
    }

    if command == "import":
        if len(sys.argv) < 3:
            print("Usage: python -m backend.main import <file_path>")
            sys.exit(1)
        success = cmd_import(sys.argv[2])
    elif command in commands:
        success = commands[command]()
    else:
        print(f"Unknown command: {command}")
        print(__doc__)
        sys.exit(1)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
