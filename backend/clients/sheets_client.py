"""
Google Sheets client — handles all read/write operations to the health dashboard sheet.
Uses gspread with service account authentication.
Implements upsert logic: merge, don't overwrite blindly.
"""

import json
import time
from pathlib import Path
from typing import Optional

import gspread
from google.oauth2.service_account import Credentials

from backend.config import (
    GOOGLE_SHEET_ID,
    GOOGLE_SERVICE_ACCOUNT_KEY_FILE,
    GOOGLE_SERVICE_ACCOUNT_JSON,
    DAILY_LOG_TAB,
    WEEKLY_SUMMARY_TAB,
    GOALS_TAB,
    AI_SUMMARIES_TAB,
    DAILY_LOG_HEADERS,
    WEEKLY_SUMMARY_HEADERS,
    GOALS_HEADERS,
    AI_SUMMARIES_HEADERS,
    DAILY_LOG_COLUMNS,
)
from backend.utils.logger import get_logger

log = get_logger("SHEETS")

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
]

# Retry config for Google Sheets API
MAX_RETRIES = 3
RETRY_BASE_DELAY = 2  # seconds


class SheetsClient:
    """Google Sheets client with upsert logic and retry handling."""

    def __init__(self):
        self.gc: Optional[gspread.Client] = None
        self.spreadsheet: Optional[gspread.Spreadsheet] = None
        self._connected = False

    def connect(self):
        """Authenticate and open the spreadsheet."""
        log.info("connect", "Connecting to Google Sheets...")
        try:
            creds = self._get_credentials()
            self.gc = gspread.authorize(creds)
            self.spreadsheet = self.gc.open_by_key(GOOGLE_SHEET_ID)
            self._connected = True
            log.info("connect", f"SUCCESS — Connected to sheet: {self.spreadsheet.title}")
        except Exception as e:
            log.error("connect", f"FAILED — {type(e).__name__}: {e}")
            raise

    def _get_credentials(self) -> Credentials:
        """Get Google credentials from JSON file or env var."""
        if GOOGLE_SERVICE_ACCOUNT_JSON:
            # Railway deployment: JSON content in env var
            info = json.loads(GOOGLE_SERVICE_ACCOUNT_JSON)
            return Credentials.from_service_account_info(info, scopes=SCOPES)
        else:
            # Local development: key file
            key_path = Path(GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
            if not key_path.is_absolute():
                # Resolve relative to project root
                from backend.config import PROJECT_ROOT
                key_path = PROJECT_ROOT / key_path
            return Credentials.from_service_account_file(str(key_path), scopes=SCOPES)

    def _ensure_connected(self):
        """Ensure we have an active connection."""
        if not self._connected:
            self.connect()

    def _retry(self, func, *args, **kwargs):
        """Execute a function with retry logic and exponential backoff."""
        for attempt in range(1, MAX_RETRIES + 1):
            try:
                return func(*args, **kwargs)
            except gspread.exceptions.APIError as e:
                if e.response.status_code == 429:
                    delay = RETRY_BASE_DELAY ** attempt
                    log.warning("retry", f"Rate limited (429). Retry {attempt}/{MAX_RETRIES} in {delay}s")
                    time.sleep(delay)
                elif attempt == MAX_RETRIES:
                    log.error("retry", f"All {MAX_RETRIES} retries exhausted: {e}")
                    raise
                else:
                    delay = RETRY_BASE_DELAY ** attempt
                    log.warning("retry", f"API error (attempt {attempt}/{MAX_RETRIES}): {e}. Retrying in {delay}s")
                    time.sleep(delay)
            except Exception as e:
                if attempt == MAX_RETRIES:
                    log.error("retry", f"All {MAX_RETRIES} retries exhausted: {type(e).__name__}: {e}")
                    raise
                delay = RETRY_BASE_DELAY ** attempt
                log.warning("retry", f"Error (attempt {attempt}/{MAX_RETRIES}): {e}. Retrying in {delay}s")
                time.sleep(delay)

    # ─── Tab Setup ───────────────────────────────────────────────────

    def setup_tabs(self):
        """Create all required tabs with headers if they don't exist."""
        self._ensure_connected()
        log.info("setup_tabs", "Setting up Google Sheet tabs...")

        tabs_config = [
            (DAILY_LOG_TAB, DAILY_LOG_HEADERS),
            (WEEKLY_SUMMARY_TAB, WEEKLY_SUMMARY_HEADERS),
            (GOALS_TAB, GOALS_HEADERS),
            (AI_SUMMARIES_TAB, AI_SUMMARIES_HEADERS),
        ]

        existing_tabs = [ws.title for ws in self.spreadsheet.worksheets()]

        for tab_name, headers in tabs_config:
            if tab_name in existing_tabs:
                log.info("setup_tabs", f"Tab '{tab_name}' already exists — checking headers")
                ws = self.spreadsheet.worksheet(tab_name)
                existing_headers = ws.row_values(1)
                if existing_headers != headers:
                    log.info("setup_tabs", f"Updating headers for '{tab_name}'")
                    self._retry(ws.update, "A1", [headers])
            else:
                log.info("setup_tabs", f"Creating tab '{tab_name}'")
                ws = self._retry(self.spreadsheet.add_worksheet,
                                 title=tab_name, rows=1000, cols=len(headers))
                self._retry(ws.update, "A1", [headers])

        # Remove default "Sheet1" if it exists and other tabs are present
        if "Sheet1" in existing_tabs and len(existing_tabs) > 1:
            try:
                sheet1 = self.spreadsheet.worksheet("Sheet1")
                self.spreadsheet.del_worksheet(sheet1)
                log.info("setup_tabs", "Removed default 'Sheet1' tab")
            except Exception:
                pass  # Not critical

        log.info("setup_tabs", "SUCCESS — All tabs ready")

    # ─── Daily Log Operations ────────────────────────────────────────

    def get_daily_log_worksheet(self) -> gspread.Worksheet:
        """Get the Daily Log worksheet."""
        self._ensure_connected()
        return self.spreadsheet.worksheet(DAILY_LOG_TAB)

    def get_all_daily_log_data(self) -> list[dict]:
        """Read all rows from Daily Log as list of dicts."""
        self._ensure_connected()
        ws = self.get_daily_log_worksheet()
        records = self._retry(ws.get_all_records)
        return records

    def find_row_by_date(self, ws: gspread.Worksheet, date_str: str) -> Optional[int]:
        """
        Find the row number (1-indexed) for a given date in the Daily Log.
        Returns None if date not found.
        """
        try:
            cell = ws.find(date_str, in_column=1)
            return cell.row if cell else None
        except gspread.exceptions.CellNotFound:
            return None

    def upsert_daily_row(self, date_str: str, data: dict, source: str = "unknown"):
        """
        Upsert a row in the Daily Log.
        - Finds or creates the row for the given date.
        - Merges: only overwrites non-null incoming values.
        - Source isolation: validates columns based on source.

        Args:
            date_str: Date in YYYY-MM-DD format
            data: Dict of column_name → value (only non-null values)
            source: "oura" or "nutrition" (for column validation)
        """
        self._ensure_connected()
        ws = self.get_daily_log_worksheet()

        log.info("upsert", f"START — Upserting {date_str} from {source}")

        # Validate source writes to correct columns
        from backend.config import OURA_COLUMNS, NUTRITION_COLUMNS
        allowed_columns = OURA_COLUMNS if source == "oura" else NUTRITION_COLUMNS
        if source in ("oura", "nutrition"):
            invalid = [k for k in data.keys() if k not in allowed_columns and k != "Date"]
            if invalid:
                log.error("upsert", f"Source '{source}' tried to write to invalid columns: {invalid}")
                return

        # Find existing row
        row_num = self._retry(self.find_row_by_date, ws, date_str)

        if row_num:
            # Row exists — read current values and merge
            existing_row = self._retry(ws.row_values, row_num)
            # Pad to full width if needed
            while len(existing_row) < len(DAILY_LOG_HEADERS):
                existing_row.append("")

            # Build updated row with merge logic
            updated_row = list(existing_row)
            for col_name, value in data.items():
                if col_name == "Date":
                    continue
                col_idx = DAILY_LOG_COLUMNS.get(col_name)
                if col_idx is not None and value is not None and value != "":
                    updated_row[col_idx] = value

            # Compute derived fields
            updated_row = self._compute_derived_fields(updated_row)

            # Write back
            cell_range = f"A{row_num}"
            self._retry(ws.update, cell_range, [updated_row])
            log.info("upsert", f"SUCCESS — Updated existing row {row_num} for {date_str}")
        else:
            # New row — build from scratch
            new_row = [""] * len(DAILY_LOG_HEADERS)
            new_row[0] = date_str  # Date column

            for col_name, value in data.items():
                if col_name == "Date":
                    continue
                col_idx = DAILY_LOG_COLUMNS.get(col_name)
                if col_idx is not None and value is not None and value != "":
                    new_row[col_idx] = value

            # Compute derived fields
            new_row = self._compute_derived_fields(new_row)

            # Find the right position to insert (keep sorted by date)
            insert_row = self._find_insert_position(ws, date_str)
            self._retry(ws.insert_row, new_row, index=insert_row)
            log.info("upsert", f"SUCCESS — Created new row at position {insert_row} for {date_str}")

    def upsert_daily_rows_batch(self, rows_data: list[tuple[str, dict]], source: str = "unknown"):
        """
        Batch upsert multiple rows efficiently.
        Args:
            rows_data: List of (date_str, data_dict) tuples
            source: "oura" or "nutrition"
        """
        self._ensure_connected()
        log.info("upsert_batch", f"START — Batch upserting {len(rows_data)} rows from {source}")

        success_count = 0
        for date_str, data in rows_data:
            try:
                self.upsert_daily_row(date_str, data, source)
                success_count += 1
                # Small delay to avoid rate limiting
                time.sleep(0.5)
            except Exception as e:
                log.error("upsert_batch", f"Failed to upsert {date_str}: {e}")

        log.info("upsert_batch", f"SUCCESS — Upserted {success_count}/{len(rows_data)} rows")
        return success_count

    def _compute_derived_fields(self, row: list) -> list:
        """Compute Nutrition_Logged and Data_Complete fields."""
        calories_idx = DAILY_LOG_COLUMNS["Calories"]
        nutrition_logged_idx = DAILY_LOG_COLUMNS["Nutrition_Logged"]
        data_complete_idx = DAILY_LOG_COLUMNS["Data_Complete"]
        sleep_score_idx = DAILY_LOG_COLUMNS["Sleep_Score"]

        # Nutrition_Logged: TRUE if Calories is not null/empty
        has_nutrition = row[calories_idx] not in (None, "", 0, "0")
        row[nutrition_logged_idx] = "TRUE" if has_nutrition else "FALSE"

        # Data_Complete: TRUE if both Oura + nutrition present
        has_oura = row[sleep_score_idx] not in (None, "", 0, "0")
        row[data_complete_idx] = "TRUE" if (has_nutrition and has_oura) else "FALSE"

        return row

    def _find_insert_position(self, ws: gspread.Worksheet, date_str: str) -> int:
        """
        Find the correct position to insert a new row to keep dates sorted.
        Returns 1-indexed row number.
        """
        all_dates = ws.col_values(1)  # Column A (dates)
        if len(all_dates) <= 1:  # Only header or empty
            return 2  # First data row

        # Find position where new date should go (ascending order)
        for i, existing_date in enumerate(all_dates[1:], start=2):  # Skip header
            if existing_date and date_str < existing_date:
                return i

        # Append at the end
        return len(all_dates) + 1

    # ─── Read Operations ─────────────────────────────────────────────

    def get_daily_data_for_range(self, start_date: str, end_date: str) -> list[dict]:
        """Get daily log data for a date range."""
        self._ensure_connected()
        ws = self.get_daily_log_worksheet()
        all_records = self._retry(ws.get_all_records)
        return [r for r in all_records if start_date <= r.get("Date", "") <= end_date]

    def get_daily_data_for_date(self, date_str: str) -> Optional[dict]:
        """Get a single day's data."""
        self._ensure_connected()
        ws = self.get_daily_log_worksheet()
        row_num = self._retry(self.find_row_by_date, ws, date_str)
        if not row_num:
            return None
        values = self._retry(ws.row_values, row_num)
        if len(values) < len(DAILY_LOG_HEADERS):
            values.extend([""] * (len(DAILY_LOG_HEADERS) - len(values)))
        return dict(zip(DAILY_LOG_HEADERS, values))

    # ─── Goals Tab ───────────────────────────────────────────────────

    def get_goals(self) -> list[dict]:
        """Read all rows from Goals tab."""
        self._ensure_connected()
        ws = self.spreadsheet.worksheet(GOALS_TAB)
        return self._retry(ws.get_all_records)

    def update_goals(self, goals_data: list[dict]):
        """
        Update the Goals tab with new target data.
        Expects a list of dicts with keys matching GOALS_HEADERS.
        """
        self._ensure_connected()
        ws = self.spreadsheet.worksheet(GOALS_TAB)
        log.info("update_goals", "START — Updating goals tab")

        # Clear existing data (keep header)
        ws.clear()
        ws.update("A1", [GOALS_HEADERS])

        # Write all goal rows
        if goals_data:
            rows = []
            for g in goals_data:
                row = [g.get(h, "") for h in GOALS_HEADERS]
                rows.append(row)
            ws.update(f"A2", rows)

        log.info("update_goals", f"SUCCESS — Updated {len(goals_data)} goal rows")

    # ─── Weekly Summary Tab ──────────────────────────────────────────

    def get_weekly_summary_worksheet(self) -> gspread.Worksheet:
        """Get the Weekly Summary worksheet."""
        self._ensure_connected()
        return self.spreadsheet.worksheet(WEEKLY_SUMMARY_TAB)

    def upsert_weekly_summary(self, summary: dict):
        """
        Upsert a weekly summary row (match by Week_Start).
        """
        self._ensure_connected()
        ws = self.get_weekly_summary_worksheet()
        week_start = summary.get("Week_Start", "")

        log.info("upsert_weekly", f"START — Upserting weekly summary for {week_start}")

        from backend.config import WEEKLY_SUMMARY_HEADERS as WS_HEADERS

        # Find existing row by Week_Start (column A)
        row_num = None
        try:
            cell = ws.find(week_start, in_column=1)
            row_num = cell.row if cell else None
        except gspread.exceptions.CellNotFound:
            row_num = None

        # Build the row values in header order
        row_values = [summary.get(h, "") for h in WS_HEADERS]

        if row_num:
            self._retry(ws.update, f"A{row_num}", [row_values])
            log.info("upsert_weekly", f"SUCCESS — Updated existing row {row_num} for {week_start}")
        else:
            # Find insert position (sorted by Week_Start ascending)
            all_starts = ws.col_values(1)
            insert_at = len(all_starts) + 1  # Append by default
            for i, existing in enumerate(all_starts[1:], start=2):  # Skip header
                if existing and week_start < existing:
                    insert_at = i
                    break
            self._retry(ws.insert_row, row_values, index=insert_at)
            log.info("upsert_weekly", f"SUCCESS — Inserted new row at {insert_at} for {week_start}")

    def get_recent_weekly_summaries(self, count: int = 4) -> list[dict]:
        """
        Get the most recent N weekly summaries, sorted by Week_Start descending.
        """
        self._ensure_connected()
        ws = self.get_weekly_summary_worksheet()
        records = self._retry(ws.get_all_records)
        if not records:
            return []
        # Sort by Week_Start descending and take the latest N
        sorted_records = sorted(records, key=lambda r: r.get("Week_Start", ""), reverse=True)
        return sorted_records[:count]

    # ─── AI Summaries Tab ────────────────────────────────────────────

    def upsert_ai_summary(self, date_str: str, summary_text: str, week_number: int):
        """
        Store an AI summary in the AI Summaries tab.
        Overwrites if a row for the same date exists.
        """
        self._ensure_connected()
        ws = self.spreadsheet.worksheet(AI_SUMMARIES_TAB)

        log.info("upsert_ai", f"START — Storing AI summary for {date_str}")

        from backend.config import AI_SUMMARIES_HEADERS

        # Find existing row by Date (column A)
        row_num = None
        try:
            cell = ws.find(date_str, in_column=1)
            row_num = cell.row if cell else None
        except gspread.exceptions.CellNotFound:
            row_num = None

        row_values = [date_str, summary_text, week_number]

        if row_num:
            self._retry(ws.update, f"A{row_num}", [row_values])
            log.info("upsert_ai", f"SUCCESS — Updated existing AI summary for {date_str}")
        else:
            self._retry(ws.append_row, row_values)
            log.info("upsert_ai", f"SUCCESS — Appended new AI summary for {date_str}")

    def get_ai_summaries(self, count: int = 10) -> list[dict]:
        """Get the most recent N AI summaries."""
        self._ensure_connected()
        ws = self.spreadsheet.worksheet(AI_SUMMARIES_TAB)
        records = self._retry(ws.get_all_records)
        if not records:
            return []
        sorted_records = sorted(records, key=lambda r: r.get("Date", ""), reverse=True)
        return sorted_records[:count]

    # ─── Connection Test ─────────────────────────────────────────────

    def test_connection(self) -> bool:
        """Test the connection to Google Sheets."""
        try:
            self.connect()
            worksheets = self.spreadsheet.worksheets()
            log.info("test", f"Connection OK — Sheet '{self.spreadsheet.title}' has {len(worksheets)} tabs")
            for ws in worksheets:
                log.info("test", f"  Tab: '{ws.title}' ({ws.row_count} rows × {ws.col_count} cols)")
            return True
        except Exception as e:
            log.error("test", f"Connection FAILED — {type(e).__name__}: {e}")
            return False
