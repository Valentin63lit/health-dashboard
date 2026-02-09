"""
Summary service — weekly summary calculation + AI summary generation.

Responsibilities:
    - Calculate weekly averages from Daily Log and upsert to Weekly Summary tab
    - Gather context data and call Claude for AI-powered weekly health summaries
    - Store AI summaries in the AI Summaries tab
"""

from datetime import datetime, timedelta

from backend.clients.sheets_client import SheetsClient
from backend.config import WEEKLY_SUMMARY_HEADERS
from backend.utils.logger import get_logger
from backend.utils.date_utils import (
    today_sofia,
    get_week_bounds,
    get_iso_week,
    lookback_dates,
)

log = get_logger("SUMMARY")


class SummaryService:
    """Calculates weekly summaries and generates AI health analyses."""

    def __init__(self, sheets_client: SheetsClient):
        self.sheets = sheets_client

    # ─── Weekly Summary Calculation ──────────────────────────────────

    def calculate_weekly_summary(self, week_start: str, week_end: str) -> dict:
        """
        Calculate all weekly averages for a given Monday–Sunday range.
        Returns a dict matching WEEKLY_SUMMARY_HEADERS columns.
        """
        log.info("calc_weekly", f"START — Calculating summary for {week_start} → {week_end}")

        data = self.sheets.get_daily_data_for_range(week_start, week_end)

        if not data:
            log.info("calc_weekly", f"No data for week {week_start}")
            return {}

        def avg(field, as_int=False):
            vals = [_safe_float(d.get(field)) for d in data if _safe_float(d.get(field)) is not None]
            if not vals:
                return ""
            result = sum(vals) / len(vals)
            return round(result) if as_int else round(result, 1)

        # Count logged days
        nutrition_days = sum(
            1 for d in data if d.get("Nutrition_Logged") in ("TRUE", "true", True)
        )
        complete_days = sum(
            1 for d in data if d.get("Data_Complete") in ("TRUE", "true", True)
        )

        # Weight change vs previous week
        prev_monday, prev_sunday = _previous_week(week_start)
        prev_data = self.sheets.get_daily_data_for_range(prev_monday, prev_sunday)

        weight_change = ""
        this_avg_weight = avg("Weight_kg")
        if this_avg_weight != "" and prev_data:
            prev_weights = [
                _safe_float(d.get("Weight_kg"))
                for d in prev_data
                if _safe_float(d.get("Weight_kg")) is not None
            ]
            if prev_weights:
                prev_avg = sum(prev_weights) / len(prev_weights)
                weight_change = round(this_avg_weight - prev_avg, 1)

        compliance = round(nutrition_days / 7 * 100)

        summary = {
            "Week_Start": week_start,
            "Week_End": week_end,
            "Week_Number": get_iso_week(week_start),
            "Avg_Weight_kg": this_avg_weight,
            "Avg_Trend_Weight_kg": avg("Trend_Weight_kg"),
            "Avg_Protein_g": avg("Protein_g"),
            "Avg_Carbs_g": avg("Carbs_g"),
            "Avg_Fats_g": avg("Fats_g"),
            "Avg_Calories": avg("Calories", as_int=True),
            "Avg_Steps": avg("Steps", as_int=True),
            "Avg_Sleep_Hours": avg("Total_Sleep_Hours"),
            "Avg_Sleep_Score": avg("Sleep_Score", as_int=True),
            "Avg_Deep_Sleep_Min": avg("Deep_Sleep_Minutes", as_int=True),
            "Avg_REM_Sleep_Min": avg("REM_Sleep_Minutes", as_int=True),
            "Avg_Readiness_Score": avg("Readiness_Score", as_int=True),
            "Avg_HRV_Balance": avg("HRV_Balance"),
            "Avg_Resting_HR": avg("Resting_Heart_Rate", as_int=True),
            "Avg_Activity_Score": avg("Activity_Score", as_int=True),
            "Avg_Nap_Minutes": avg("Nap_Minutes", as_int=True),
            "Days_Logged_Nutrition": nutrition_days,
            "Days_Logged_Total": complete_days,
            "Weight_Change_kg": weight_change,
            "Compliance_Pct": compliance,
        }

        log.info(
            "calc_weekly",
            f"SUCCESS — Week {week_start}: {nutrition_days} nutrition days, "
            f"{complete_days} complete days, compliance {compliance}%"
        )
        return summary

    def update_all_weekly_summaries(self):
        """Recalculate summaries for the current week and previous week, upsert to Weekly Summary tab."""
        log.info("update_summaries", "START — Updating weekly summaries")

        today = today_sofia()

        # Current week
        curr_monday, curr_sunday = get_week_bounds(today)
        curr_summary = self.calculate_weekly_summary(curr_monday, curr_sunday)
        if curr_summary:
            self.sheets.upsert_weekly_summary(curr_summary)

        # Previous week
        prev_monday, prev_sunday = _previous_week(curr_monday)
        prev_summary = self.calculate_weekly_summary(prev_monday, prev_sunday)
        if prev_summary:
            self.sheets.upsert_weekly_summary(prev_summary)

        log.info("update_summaries", "SUCCESS — Weekly summaries updated")

    # ─── AI Weekly Summary ───────────────────────────────────────────

    async def generate_ai_summary(self) -> dict:
        """
        Generate an AI weekly summary using Claude.
        Gathers last 7 + 30 days of data, goals, and previous summaries.

        Returns:
            {"success": bool, "summary_text": str, "error": str}
        """
        log.info("ai_summary", "START — Generating AI weekly summary")

        result = {"success": False, "summary_text": "", "error": ""}

        try:
            from backend.clients.claude_client import ClaudeClient

            # Gather context
            today = today_sofia()
            start_7, _ = lookback_dates(7)
            start_30, _ = lookback_dates(30)

            week_data = self.sheets.get_daily_data_for_range(start_7, today)
            month_data = self.sheets.get_daily_data_for_range(start_30, today)
            goals = self.sheets.get_goals()

            # Previous 4 weeks of weekly summaries
            prev_summaries = self.sheets.get_recent_weekly_summaries(4)

            # Call Claude
            claude = ClaudeClient()
            summary_text = claude.generate_weekly_summary(
                daily_data=week_data,
                goals=goals,
                prev_week_summaries=prev_summaries,
                month_data=month_data,
            )

            if summary_text:
                # Store in AI Summaries tab
                week_number = get_iso_week(today)
                self.sheets.upsert_ai_summary(today, summary_text, week_number)

                result["success"] = True
                result["summary_text"] = summary_text
                log.info("ai_summary", f"SUCCESS — Generated {len(summary_text)} chars")
            else:
                result["error"] = "Claude returned empty summary"
                log.error("ai_summary", result["error"])

        except Exception as e:
            result["error"] = str(e)
            log.error("ai_summary", f"FAILED — {e}")

        return result


# ─── Helpers ─────────────────────────────────────────────────────────

def _previous_week(monday_str: str) -> tuple[str, str]:
    """Get previous week's Monday and Sunday from a Monday date string."""
    monday = datetime.strptime(monday_str, "%Y-%m-%d")
    prev_monday = monday - timedelta(days=7)
    prev_sunday = prev_monday + timedelta(days=6)
    return prev_monday.strftime("%Y-%m-%d"), prev_sunday.strftime("%Y-%m-%d")


def _safe_float(value) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None
