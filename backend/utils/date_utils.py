"""
Date and timezone utilities.
All dates in Europe/Sofia timezone. Stored as YYYY-MM-DD strings.
"""

from datetime import datetime, timedelta
from typing import Optional

import pytz

SOFIA_TZ = pytz.timezone("Europe/Sofia")


def now_sofia() -> datetime:
    """Get current datetime in Europe/Sofia timezone."""
    return datetime.now(tz=SOFIA_TZ)


def today_sofia() -> str:
    """Get today's date string in Europe/Sofia timezone (YYYY-MM-DD)."""
    return now_sofia().strftime("%Y-%m-%d")


def date_str(dt: datetime) -> str:
    """Convert a datetime to YYYY-MM-DD string."""
    return dt.strftime("%Y-%m-%d")


def parse_date(date_string: str) -> datetime:
    """Parse a YYYY-MM-DD string into a timezone-aware datetime."""
    naive = datetime.strptime(date_string, "%Y-%m-%d")
    return SOFIA_TZ.localize(naive)


def date_range(start_date: str, end_date: str) -> list[str]:
    """
    Generate a list of YYYY-MM-DD date strings from start to end (inclusive).
    """
    start = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date, "%Y-%m-%d")
    dates = []
    current = start
    while current <= end:
        dates.append(current.strftime("%Y-%m-%d"))
        current += timedelta(days=1)
    return dates


def lookback_dates(days: int = 7) -> tuple[str, str]:
    """
    Get start and end dates for a lookback window.
    Returns (start_date, end_date) as YYYY-MM-DD strings.
    End date is today (Sofia time), start date is `days` ago.
    """
    today = now_sofia()
    start = today - timedelta(days=days)
    return date_str(start), date_str(today)


def get_week_bounds(date_string: str) -> tuple[str, str]:
    """
    Get the Monday–Sunday bounds for the week containing the given date.
    Returns (monday_date, sunday_date) as YYYY-MM-DD strings.
    """
    dt = datetime.strptime(date_string, "%Y-%m-%d")
    monday = dt - timedelta(days=dt.weekday())  # weekday() returns 0 for Monday
    sunday = monday + timedelta(days=6)
    return date_str(monday), date_str(sunday)


def get_iso_week(date_string: str) -> int:
    """Get the ISO week number for a date string."""
    dt = datetime.strptime(date_string, "%Y-%m-%d")
    return dt.isocalendar()[1]


def normalize_date(value) -> Optional[str]:
    """
    Normalize various date formats to YYYY-MM-DD string.
    Handles: datetime objects, date objects, strings.
    Returns None if conversion fails.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d")
    if hasattr(value, "strftime"):  # date object
        return value.strftime("%Y-%m-%d")
    if isinstance(value, str):
        value = value.strip()
        # Try common formats
        for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%dT%H:%M:%S"):
            try:
                return datetime.strptime(value, fmt).strftime("%Y-%m-%d")
            except ValueError:
                continue
    return None
