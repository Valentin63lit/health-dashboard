"""
Oura Ring API client — fetches sleep, readiness, activity, and heart rate data.
Endpoints: /daily_sleep, /daily_readiness, /daily_activity, /sleep, /heartrate
All dates in Europe/Sofia timezone.
"""

import requests
from typing import Optional

from backend.config import OURA_API_TOKEN, OURA_BASE_URL, SYNC_LOOKBACK_DAYS
from backend.utils.logger import get_logger
from backend.utils.date_utils import lookback_dates, date_range

log = get_logger("OURA")

# Timeout for API requests (seconds)
REQUEST_TIMEOUT = 30


class OuraClient:
    """Oura Ring API v2 client."""

    def __init__(self):
        self.base_url = OURA_BASE_URL.rstrip("/")
        self.headers = {
            "Authorization": f"Bearer {OURA_API_TOKEN}",
            "Content-Type": "application/json",
        }

    def _get(self, endpoint: str, params: dict = None) -> Optional[dict]:
        """
        Make a GET request to the Oura API with error handling.
        Returns parsed JSON or None on failure.
        """
        url = f"{self.base_url}/{endpoint}"
        log.info("api_call", f"GET {endpoint} params={params}")
        try:
            response = requests.get(url, headers=self.headers, params=params, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
            items = data.get("data", [])
            log.info("api_call", f"SUCCESS — {endpoint} returned {len(items)} items")
            return data
        except requests.exceptions.HTTPError as e:
            log.error("api_call", f"HTTP Error {response.status_code} for {endpoint}: {e}")
            if response.status_code == 401:
                log.error("api_call", "Token may be expired — check OURA_API_TOKEN")
            elif response.status_code == 429:
                log.warning("api_call", "Rate limited by Oura API — slow down requests")
            return None
        except requests.exceptions.ConnectionError as e:
            log.error("api_call", f"Connection error for {endpoint}: {e}")
            return None
        except requests.exceptions.Timeout:
            log.error("api_call", f"Timeout after {REQUEST_TIMEOUT}s for {endpoint}")
            return None
        except Exception as e:
            log.error("api_call", f"Unexpected error for {endpoint}: {type(e).__name__}: {e}")
            return None

    # ─── API Endpoints ───────────────────────────────────────────────

    def fetch_daily_sleep(self, start_date: str, end_date: str) -> list[dict]:
        """Fetch daily sleep scores."""
        data = self._get("daily_sleep", {"start_date": start_date, "end_date": end_date})
        return data.get("data", []) if data else []

    def fetch_daily_readiness(self, start_date: str, end_date: str) -> list[dict]:
        """Fetch daily readiness scores."""
        data = self._get("daily_readiness", {"start_date": start_date, "end_date": end_date})
        return data.get("data", []) if data else []

    def fetch_daily_activity(self, start_date: str, end_date: str) -> list[dict]:
        """Fetch daily activity data."""
        data = self._get("daily_activity", {"start_date": start_date, "end_date": end_date})
        return data.get("data", []) if data else []

    def fetch_sleep_details(self, start_date: str, end_date: str) -> list[dict]:
        """Fetch detailed sleep data (stages, efficiency)."""
        data = self._get("sleep", {"start_date": start_date, "end_date": end_date})
        return data.get("data", []) if data else []

    def fetch_heart_rate(self, start_date: str, end_date: str) -> list[dict]:
        """Fetch heart rate data."""
        data = self._get("heartrate", {"start_date": start_date, "end_date": end_date})
        return data.get("data", []) if data else []

    # ─── Data Extraction ─────────────────────────────────────────────

    def fetch_all_data(self, start_date: str = None, end_date: str = None) -> dict[str, dict]:
        """
        Fetch all Oura data for a date range and consolidate into a per-day dict.

        Returns:
            Dict mapping date_str → {field: value} with all Oura fields.
            Example: {"2026-02-09": {"Steps": 8500, "Sleep_Score": 85, ...}}
        """
        if not start_date or not end_date:
            start_date, end_date = lookback_dates(SYNC_LOOKBACK_DAYS)

        log.info("fetch_all", f"START — Fetching Oura data for {start_date} to {end_date}")

        # Initialize empty data for all dates in range
        all_dates = date_range(start_date, end_date)
        daily_data: dict[str, dict] = {d: {} for d in all_dates}

        # Fetch all endpoints
        sleep_scores = self.fetch_daily_sleep(start_date, end_date)
        readiness = self.fetch_daily_readiness(start_date, end_date)
        activity = self.fetch_daily_activity(start_date, end_date)
        sleep_details = self.fetch_sleep_details(start_date, end_date)

        # Process daily sleep scores
        for item in sleep_scores:
            day = item.get("day")
            if day in daily_data:
                daily_data[day]["Sleep_Score"] = item.get("score")

        # Process readiness
        for item in readiness:
            day = item.get("day")
            if day in daily_data:
                daily_data[day]["Readiness_Score"] = item.get("score")
                daily_data[day]["Temperature_Deviation"] = item.get("temperature_deviation")

                # Extract HRV balance from contributors
                contributors = item.get("contributors", {})
                daily_data[day]["HRV_Balance"] = contributors.get("hrv_balance")

                # Resting heart rate from readiness
                daily_data[day]["Resting_Heart_Rate"] = item.get("resting_heart_rate")

        # Process activity
        for item in activity:
            day = item.get("day")
            if day in daily_data:
                daily_data[day]["Steps"] = item.get("steps")
                daily_data[day]["Activity_Score"] = item.get("score")

        # Process detailed sleep data
        # Multiple sleep sessions can exist per day — use the longest one as primary sleep.
        # All OTHER sessions are summed as nap minutes.
        # First pass: group all sessions by day
        sessions_by_day: dict[str, list[dict]] = {}
        for item in sleep_details:
            day = item.get("day")
            if not day:
                continue
            sessions_by_day.setdefault(day, []).append(item)

        # Second pass: pick longest session as primary, sum rest as naps
        sleep_by_day: dict[str, dict] = {}
        for day, sessions in sessions_by_day.items():
            # Sort sessions by duration descending to pick longest first
            sessions_sorted = sorted(
                sessions,
                key=lambda s: (s.get("total_sleep_duration", 0) or 0),
                reverse=True
            )
            primary = sessions_sorted[0]
            primary_duration = primary.get("total_sleep_duration", 0) or 0

            sleep_by_day[day] = {
                "_duration": primary_duration,
                "Total_Sleep_Hours": round(primary_duration / 3600, 1) if primary_duration else None,
                "Deep_Sleep_Minutes": self._seconds_to_minutes(primary.get("deep_sleep_duration")),
                "REM_Sleep_Minutes": self._seconds_to_minutes(primary.get("rem_sleep_duration")),
                "Sleep_Efficiency": primary.get("efficiency"),
            }
            if primary.get("lowest_heart_rate"):
                sleep_by_day[day]["_lowest_hr"] = primary.get("lowest_heart_rate")

            # Sum all non-primary sessions as nap minutes
            nap_seconds = sum(
                (s.get("total_sleep_duration", 0) or 0)
                for s in sessions_sorted[1:]
            )
            sleep_by_day[day]["Nap_Minutes"] = round(nap_seconds / 60) if nap_seconds > 0 else 0

        for day, sleep_data in sleep_by_day.items():
            if day in daily_data:
                for field in ("Total_Sleep_Hours", "Deep_Sleep_Minutes",
                              "REM_Sleep_Minutes", "Sleep_Efficiency", "Nap_Minutes"):
                    if sleep_data.get(field) is not None:
                        daily_data[day][field] = sleep_data[field]

                # Use lowest HR from sleep if readiness didn't provide resting HR
                if not daily_data[day].get("Resting_Heart_Rate") and sleep_data.get("_lowest_hr"):
                    daily_data[day]["Resting_Heart_Rate"] = sleep_data["_lowest_hr"]

        # Remove days with no data at all
        result = {day: data for day, data in daily_data.items() if data}

        log.info("fetch_all", f"SUCCESS — Got data for {len(result)} days out of {len(all_dates)} requested")
        return result

    @staticmethod
    def _seconds_to_minutes(seconds) -> Optional[int]:
        """Convert seconds to minutes, handling None."""
        if seconds is None:
            return None
        return round(seconds / 60)

    # ─── Connection Test ─────────────────────────────────────────────

    def test_connection(self) -> bool:
        """Test the Oura API connection by fetching today's data."""
        log.info("test", "Testing Oura API connection...")
        try:
            start_date, end_date = lookback_dates(1)
            data = self._get("daily_sleep", {"start_date": start_date, "end_date": end_date})
            if data is not None:
                items = data.get("data", [])
                log.info("test", f"Connection OK — Got {len(items)} sleep records for last day")
                return True
            else:
                log.error("test", "Connection failed — no data returned")
                return False
        except Exception as e:
            log.error("test", f"Connection FAILED — {type(e).__name__}: {e}")
            return False
