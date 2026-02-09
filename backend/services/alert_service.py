"""
Alert service — evaluates health alert rules and sends notifications via Telegram.

Alert Rules:
    🔴 HRV Drop     — Today's HRV < 85% of 7-day average
    🔴 Sleep Drop    — Sleep score < 60
    🟡 No Nutrition  — 2+ consecutive days without nutrition data
    🟡 Weight Spike  — Weight change > 1.5kg vs yesterday

Deduplication: tracks sent alerts per day to avoid repeats.
"""

import json
from pathlib import Path

from backend.clients.sheets_client import SheetsClient
from backend.utils.logger import get_logger
from backend.utils.date_utils import today_sofia, lookback_dates, date_range

log = get_logger("ALERTS")

# Simple file-based cache to track which alerts were sent today
ALERTS_CACHE_FILE = Path(__file__).resolve().parent.parent.parent / ".alerts_cache.json"


class AlertService:
    """Evaluates health alert rules against recent Daily Log data."""

    def __init__(self, sheets_client: SheetsClient):
        self.sheets = sheets_client

    def check_alerts(self, check_nutrition: bool = False) -> list[dict]:
        """
        Evaluate all alert rules against the last 7 days of data.

        Args:
            check_nutrition: Whether to include the missing-nutrition check
                             (intended for the 18:00 evening run).

        Returns:
            List of triggered alert dicts with keys: id, severity, title, message.
        """
        log.info("check", "START — Evaluating alert rules")

        start_date, end_date = lookback_dates(7)
        data = self.sheets.get_daily_data_for_range(start_date, end_date)

        if not data:
            log.info("check", "No data in last 7 days — skipping alerts")
            return []

        today = today_sofia()
        triggered: list[dict] = []

        # ── HRV Drop ────────────────────────────────────────────────
        alert = self._check_hrv_drop(data, today)
        if alert:
            triggered.append(alert)

        # ── Sleep Score Drop ─────────────────────────────────────────
        alert = self._check_sleep_drop(data, today)
        if alert:
            triggered.append(alert)

        # ── Weight Spike ─────────────────────────────────────────────
        alert = self._check_weight_spike(data)
        if alert:
            triggered.append(alert)

        # ── Missing Nutrition (evening only) ─────────────────────────
        if check_nutrition:
            alert = self._check_missing_nutrition(data)
            if alert:
                triggered.append(alert)

        # Deduplicate — filter out alerts already sent today
        triggered = self._filter_already_sent(triggered, today)

        # Mark these alerts as sent
        self._mark_sent(triggered, today)

        log.info("check", f"SUCCESS — {len(triggered)} alert(s) triggered")
        return triggered

    # ─── Individual Alert Rules ──────────────────────────────────────

    def _check_hrv_drop(self, data: list[dict], today: str) -> dict | None:
        """HRV Drop: Today's HRV < 85% of 7-day average."""
        hrv_values = []
        today_hrv = None

        for row in data:
            hrv = _safe_float(row.get("HRV_Balance"))
            if hrv is not None:
                hrv_values.append(hrv)
                if row.get("Date") == today:
                    today_hrv = hrv

        # Need today's value and at least 3 days of history
        if today_hrv is None or len(hrv_values) < 3:
            return None

        avg_hrv = sum(hrv_values) / len(hrv_values)
        threshold = avg_hrv * 0.85

        if today_hrv < threshold:
            pct_drop = round((1 - today_hrv / avg_hrv) * 100)
            return {
                "id": "hrv_drop",
                "severity": "🔴",
                "title": "HRV Drop",
                "message": (
                    f"🔴 *HRV Drop Alert*\n\n"
                    f"Today's HRV: *{today_hrv}* (7-day avg: {avg_hrv:.1f})\n"
                    f"Down *{pct_drop}%* from average."
                ),
            }
        return None

    def _check_sleep_drop(self, data: list[dict], today: str) -> dict | None:
        """Sleep Score Drop: Sleep score < 60."""
        for row in data:
            if row.get("Date") == today:
                score = _safe_int(row.get("Sleep_Score"))
                if score is not None and score < 60:
                    return {
                        "id": "sleep_drop",
                        "severity": "🔴",
                        "title": "Low Sleep Score",
                        "message": (
                            f"🔴 *Low Sleep Score*\n\n"
                            f"Today's sleep score: *{score}* (below 60 threshold)."
                        ),
                    }
        return None

    def _check_weight_spike(self, data: list[dict]) -> dict | None:
        """Weight Spike: Weight change > 1.5kg vs previous day."""
        # Collect all days with weight, sorted by date
        weight_entries = []
        for row in sorted(data, key=lambda r: r.get("Date", "")):
            w = _safe_float(row.get("Weight_kg"))
            if w is not None:
                weight_entries.append({"date": row.get("Date"), "weight": w})

        if len(weight_entries) < 2:
            return None

        latest = weight_entries[-1]
        previous = weight_entries[-2]
        change = abs(latest["weight"] - previous["weight"])

        if change > 1.5:
            direction = "⬆️" if latest["weight"] > previous["weight"] else "⬇️"
            sign = "+" if latest["weight"] > previous["weight"] else "-"
            return {
                "id": "weight_spike",
                "severity": "🟡",
                "title": "Weight Spike",
                "message": (
                    f"🟡 *Weight Spike Alert*\n\n"
                    f"{direction} {latest['date']}: *{latest['weight']}kg* "
                    f"({sign}{change:.1f}kg from {previous['date']}: {previous['weight']}kg)"
                ),
            }
        return None

    def _check_missing_nutrition(self, data: list[dict]) -> dict | None:
        """No Nutrition Logged: 2+ consecutive days without nutrition data."""
        sorted_data = sorted(data, key=lambda r: r.get("Date", ""), reverse=True)

        consecutive_missing = 0
        for row in sorted_data:
            logged = row.get("Nutrition_Logged", "FALSE")
            if logged in ("TRUE", "true", True):
                break
            consecutive_missing += 1

        if consecutive_missing >= 2:
            return {
                "id": "missing_nutrition",
                "severity": "🟡",
                "title": "Missing Nutrition",
                "message": (
                    f"🟡 *Missing Nutrition Data*\n\n"
                    f"No nutrition logged for *{consecutive_missing} consecutive days*.\n"
                    f"Send a MacroFactor export or manual entry to catch up."
                ),
            }
        return None

    # ─── Alert Deduplication ─────────────────────────────────────────

    def _filter_already_sent(self, alerts: list[dict], today: str) -> list[dict]:
        """Remove alerts that were already sent today."""
        cache = _load_cache()
        sent_today = cache.get(today, [])
        return [a for a in alerts if a["id"] not in sent_today]

    def _mark_sent(self, alerts: list[dict], today: str):
        """Record that these alerts were sent today."""
        if not alerts:
            return

        cache = _load_cache()
        if today not in cache:
            cache[today] = []

        for a in alerts:
            if a["id"] not in cache[today]:
                cache[today].append(a["id"])

        # Prune old entries — keep only last 7 days
        start_date, _ = lookback_dates(7)
        valid_dates = set(date_range(start_date, today))
        cache = {k: v for k, v in cache.items() if k in valid_dates}

        _save_cache(cache)


# ─── Helpers ─────────────────────────────────────────────────────────

def _safe_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


def _safe_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def _load_cache() -> dict:
    """Load the alerts-sent cache from disk."""
    try:
        if ALERTS_CACHE_FILE.exists():
            return json.loads(ALERTS_CACHE_FILE.read_text())
    except Exception:
        pass
    return {}


def _save_cache(cache: dict):
    """Save the alerts-sent cache to disk."""
    try:
        ALERTS_CACHE_FILE.write_text(json.dumps(cache, indent=2))
    except Exception as e:
        log.warning("cache", f"Could not save alerts cache: {e}")
