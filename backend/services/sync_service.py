"""
Sync service — orchestrates Oura data fetch and upsert to Google Sheets.
Implements the core sync logic: fetch last N days, merge into Daily Log.
"""

from backend.clients.oura_client import OuraClient
from backend.clients.sheets_client import SheetsClient
from backend.config import SYNC_LOOKBACK_DAYS
from backend.utils.logger import get_logger
from backend.utils.date_utils import lookback_dates

log = get_logger("SYNC")


class SyncService:
    """Orchestrates data sync between Oura and Google Sheets."""

    def __init__(self, sheets_client: SheetsClient, oura_client: OuraClient = None):
        self.sheets = sheets_client
        self.oura = oura_client or OuraClient()

    def sync_oura(self, lookback_days: int = None) -> dict:
        """
        Fetch Oura data for the last N days and upsert into Google Sheets.

        Args:
            lookback_days: Number of days to look back (default from config: 7)

        Returns:
            Dict with sync results: {"days_fetched": int, "days_updated": int, "errors": list}
        """
        days = lookback_days or SYNC_LOOKBACK_DAYS
        start_date, end_date = lookback_dates(days)

        log.info("sync_oura", f"START — Syncing Oura data for {start_date} to {end_date} ({days} days)")

        result = {"days_fetched": 0, "days_updated": 0, "errors": [], "start_date": start_date, "end_date": end_date}

        # Step 1: Fetch all Oura data
        try:
            oura_data = self.oura.fetch_all_data(start_date, end_date)
            result["days_fetched"] = len(oura_data)
        except Exception as e:
            error_msg = f"Failed to fetch Oura data: {type(e).__name__}: {e}"
            log.error("sync_oura", error_msg)
            result["errors"].append(error_msg)
            return result

        if not oura_data:
            log.warning("sync_oura", "No Oura data returned for the date range")
            return result

        # Step 2: Upsert each day into Google Sheets
        rows_to_upsert = [(date_str, data) for date_str, data in sorted(oura_data.items())]
        success_count = self.sheets.upsert_daily_rows_batch(rows_to_upsert, source="oura")
        result["days_updated"] = success_count

        log.info(
            "sync_oura",
            f"SUCCESS — Fetched {result['days_fetched']} days, updated {result['days_updated']} rows "
            f"({start_date} to {end_date})"
        )

        return result
