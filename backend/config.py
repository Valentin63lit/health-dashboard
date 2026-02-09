"""
Configuration module — loads all settings from environment variables.
Never hardcode secrets. Everything comes from .env or Railway env vars.
"""

import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Load .env from project root (one level up from backend/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT / ".env")

# ─── Oura Ring API ──────────────────────────────────────────────
OURA_API_TOKEN = os.getenv("OURA_API_TOKEN")
OURA_BASE_URL = os.getenv("OURA_BASE_URL", "https://api.ouraring.com/v2/usercollection")

# ─── Claude API (Anthropic) ─────────────────────────────────────
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
CLAUDE_MODEL = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-5-20250929")

# ─── Telegram Bot ────────────────────────────────────────────────
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
TELEGRAM_BOT_USERNAME = os.getenv("TELEGRAM_BOT_USERNAME", "alex_health_tracker_bot")
TELEGRAM_USER_ID = int(os.getenv("TELEGRAM_USER_ID", "0"))

# ─── Google Sheets ───────────────────────────────────────────────
GOOGLE_SHEET_ID = os.getenv("GOOGLE_SHEET_ID")
GOOGLE_SERVICE_ACCOUNT_KEY_FILE = os.getenv(
    "GOOGLE_SERVICE_ACCOUNT_KEY_FILE",
    str(PROJECT_ROOT / "service-account.json")
)
# For Railway deployment: entire JSON content as env var
GOOGLE_SERVICE_ACCOUNT_JSON = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON")

# ─── Application Config ─────────────────────────────────────────
TIMEZONE = os.getenv("TIMEZONE", "Europe/Sofia")
SYNC_LOOKBACK_DAYS = int(os.getenv("SYNC_LOOKBACK_DAYS", "7"))
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO")
DASHBOARD_URL = os.getenv("DASHBOARD_URL", "")

# ─── Google Sheet Tab Names ─────────────────────────────────────
DAILY_LOG_TAB = "Daily Log"
WEEKLY_SUMMARY_TAB = "Weekly Summary"
GOALS_TAB = "Goals"
AI_SUMMARIES_TAB = "AI Summaries"

# ─── Daily Log Column Mapping ───────────────────────────────────
# Column letters → 0-indexed positions for gspread
DAILY_LOG_COLUMNS = {
    "Date": 0,               # A
    "Weight_kg": 1,           # B
    "Trend_Weight_kg": 2,     # C
    "Fat_Percent": 3,         # D
    "Protein_g": 4,           # E
    "Carbs_g": 5,             # F
    "Fats_g": 6,              # G
    "Calories": 7,            # H
    "Expenditure": 8,         # I
    "Steps": 9,               # J
    "Total_Sleep_Hours": 10,  # K
    "Sleep_Score": 11,        # L
    "Deep_Sleep_Minutes": 12, # M
    "REM_Sleep_Minutes": 13,  # N
    "Sleep_Efficiency": 14,   # O
    "Readiness_Score": 15,    # P
    "Temperature_Deviation": 16, # Q
    "HRV_Balance": 17,        # R
    "Resting_Heart_Rate": 18, # S
    "Activity_Score": 19,     # T
    "Nutrition_Logged": 20,   # U
    "Data_Complete": 21,      # V
    "Nap_Minutes": 22,        # W
}

# Headers for the Daily Log tab (in order)
DAILY_LOG_HEADERS = list(DAILY_LOG_COLUMNS.keys())

# Oura columns (J-T + W, indices 9-19 + 22) — only Oura sync writes here
OURA_COLUMNS = [
    "Steps", "Total_Sleep_Hours", "Sleep_Score", "Deep_Sleep_Minutes",
    "REM_Sleep_Minutes", "Sleep_Efficiency", "Readiness_Score",
    "Temperature_Deviation", "HRV_Balance", "Resting_Heart_Rate", "Activity_Score",
    "Nap_Minutes"
]

# Nutrition columns (B-I, indices 1-8) — only nutrition import writes here
NUTRITION_COLUMNS = [
    "Weight_kg", "Trend_Weight_kg", "Fat_Percent", "Protein_g",
    "Carbs_g", "Fats_g", "Calories", "Expenditure"
]

# Weekly Summary headers
WEEKLY_SUMMARY_HEADERS = [
    "Week_Start", "Week_End", "Week_Number",
    "Avg_Weight_kg", "Avg_Trend_Weight_kg",
    "Avg_Protein_g", "Avg_Carbs_g", "Avg_Fats_g", "Avg_Calories",
    "Avg_Steps", "Avg_Sleep_Hours", "Avg_Sleep_Score",
    "Avg_Deep_Sleep_Min", "Avg_REM_Sleep_Min",
    "Avg_Readiness_Score", "Avg_HRV_Balance", "Avg_Resting_HR",
    "Avg_Activity_Score", "Avg_Nap_Minutes",
    "Days_Logged_Nutrition", "Days_Logged_Total",
    "Weight_Change_kg", "Compliance_Pct"
]

# Goals headers
GOALS_HEADERS = [
    "Weekday", "Target_Calories", "Target_Protein_g",
    "Target_Carbs_g", "Target_Fats_g", "Target_Weight_kg", "Last_Updated"
]

# AI Summaries headers
AI_SUMMARIES_HEADERS = ["Date", "Summary_Text", "Week_Number"]


def validate_config():
    """Validate that all required environment variables are set."""
    required = {
        "OURA_API_TOKEN": OURA_API_TOKEN,
        "GOOGLE_SHEET_ID": GOOGLE_SHEET_ID,
    }
    missing = [k for k, v in required.items() if not v]
    if missing:
        print(f"❌ Missing required environment variables: {', '.join(missing)}")
        print("   Check your .env file or Railway environment variables.")
        sys.exit(1)

    # Check Google auth — need either key file or JSON content
    if not GOOGLE_SERVICE_ACCOUNT_JSON:
        key_path = Path(GOOGLE_SERVICE_ACCOUNT_KEY_FILE)
        if not key_path.exists():
            print(f"❌ Google service account key not found at: {key_path}")
            print("   Set GOOGLE_SERVICE_ACCOUNT_KEY_FILE or GOOGLE_SERVICE_ACCOUNT_JSON")
            sys.exit(1)
