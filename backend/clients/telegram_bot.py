"""
Telegram bot — commands, file upload handling, manual input, and alerts.
Security: only responds to the configured TELEGRAM_USER_ID.
"""

import os
import tempfile
from datetime import datetime

from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

from backend.config import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_USER_ID,
    TIMEZONE,
)
from backend.clients.sheets_client import SheetsClient
from backend.services.nutrition_service import NutritionService
from backend.utils.logger import get_logger
from backend.utils.date_utils import (
    today_sofia,
    now_sofia,
    get_week_bounds,
    date_range,
)

log = get_logger("TELEGRAM")

# ─── Shared State ────────────────────────────────────────────────
# These are initialized in start_bot() so the bot can share the sheets client
_sheets_client: SheetsClient = None
_nutrition_service: NutritionService = None


def _get_sheets() -> SheetsClient:
    """Get or create the shared SheetsClient."""
    global _sheets_client
    if _sheets_client is None:
        _sheets_client = SheetsClient()
        _sheets_client.connect()
    return _sheets_client


def _get_nutrition() -> NutritionService:
    """Get or create the shared NutritionService."""
    global _nutrition_service
    if _nutrition_service is None:
        _nutrition_service = NutritionService(_get_sheets())
    return _nutrition_service


# ─── Security ────────────────────────────────────────────────────

def _is_authorized(user_id: int) -> bool:
    """Check if the user is authorized."""
    return user_id == TELEGRAM_USER_ID


async def _check_auth(update: Update) -> bool:
    """Check authorization and reply with denial if unauthorized. Returns True if authorized."""
    user_id = update.effective_user.id
    if not _is_authorized(user_id):
        log.warning("auth", f"Unauthorized access attempt by user {user_id}")
        await update.message.reply_text("⛔ Unauthorized. This is a private bot.")
        return False
    return True


# ─── Command Handlers ────────────────────────────────────────────

async def cmd_start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start — welcome message with quick instructions."""
    if not await _check_auth(update):
        return

    log.info("command", "/start")
    await update.message.reply_text(
        "👋 *Health Dashboard Bot*\n\n"
        "I track your health data from Oura Ring and MacroFactor.\n\n"
        "📤 *Send a MacroFactor .xlsx export* to import nutrition data\n"
        "📝 *Send a manual entry:*\n"
        "`YYYY-MM-DD weight protein carbs fats calories`\n"
        "Use `-` to skip a field\n\n"
        "📋 *Commands:*\n"
        "/status — Today's data completeness\n"
        "/today — Full stats for today\n"
        "/week — This week's summary\n"
        "/goals — Current macro targets\n"
        "/summary — AI health summary\n"
        "/help — All commands",
        parse_mode="Markdown",
    )


async def cmd_help(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /help — show all available commands."""
    if not await _check_auth(update):
        return

    log.info("command", "/help")
    await update.message.reply_text(
        "📋 *Available Commands*\n\n"
        "/start — Welcome & quick instructions\n"
        "/status — Today's data completeness\n"
        "/today — Full stats for today\n"
        "/week — This week's summary so far\n"
        "/goals — Current macro/calorie targets\n"
        "/summary — AI-powered health summary\n"
        "/help — This help message\n\n"
        "📤 *File Upload:* Send a MacroFactor `.xlsx` export\n"
        "📝 *Manual Entry:*\n"
        "`YYYY-MM-DD weight protein carbs fats calories`\n"
        "Example: `2026-02-09 73 180 200 70 2100`\n"
        "Use `-` to skip: `2026-02-09 73 - - - -` (weight only)",
        parse_mode="Markdown",
    )


async def cmd_status(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /status — show today's data completeness."""
    if not await _check_auth(update):
        return

    log.info("command", "/status")
    try:
        sheets = _get_sheets()
        today = today_sofia()
        data = sheets.get_daily_data_for_date(today)

        if not data:
            await update.message.reply_text(
                f"📅 *{today}*\n\n"
                "❌ No data logged yet today.\n\n"
                "Oura data syncs automatically at 10am, 6pm, midnight.\n"
                "Send a MacroFactor export to add nutrition.",
                parse_mode="Markdown",
            )
            return

        # Check what's present
        has_oura = data.get("Sleep_Score") not in (None, "", 0, "0", "")
        has_nutrition = data.get("Calories") not in (None, "", 0, "0", "")
        has_weight = data.get("Weight_kg") not in (None, "", 0, "0", "")

        oura_icon = "✅" if has_oura else "❌"
        nutrition_icon = "✅" if has_nutrition else "❌"
        weight_icon = "✅" if has_weight else "❌"

        missing = []
        if not has_oura:
            missing.append("Oura (sleep/readiness/activity)")
        if not has_nutrition:
            missing.append("Nutrition (calories/macros)")
        if not has_weight:
            missing.append("Weight")

        status = "✅ All data logged!" if not missing else f"⚠️ Missing: {', '.join(missing)}"

        await update.message.reply_text(
            f"📅 *{today}*\n\n"
            f"{oura_icon} Oura Data (sleep, readiness, activity)\n"
            f"{nutrition_icon} Nutrition (calories & macros)\n"
            f"{weight_icon} Weight\n\n"
            f"{status}",
            parse_mode="Markdown",
        )
    except Exception as e:
        log.error("command", f"/status error: {e}")
        await update.message.reply_text("❌ Error fetching status. Try again later.")


async def cmd_today(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /today — show today's full stats."""
    if not await _check_auth(update):
        return

    log.info("command", "/today")
    try:
        sheets = _get_sheets()
        today = today_sofia()
        data = sheets.get_daily_data_for_date(today)

        if not data:
            await update.message.reply_text(
                f"📅 *{today}*\n\nNo data yet. Oura syncs at 10am/6pm/midnight.",
                parse_mode="Markdown",
            )
            return

        msg = _format_daily_stats(today, data)
        await update.message.reply_text(msg, parse_mode="Markdown")

    except Exception as e:
        log.error("command", f"/today error: {e}")
        await update.message.reply_text("❌ Error fetching today's data. Try again later.")


async def cmd_week(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /week — show this week's summary so far."""
    if not await _check_auth(update):
        return

    log.info("command", "/week")
    try:
        sheets = _get_sheets()
        today = today_sofia()
        monday, sunday = get_week_bounds(today)
        week_dates = date_range(monday, today)  # Only up to today

        data = sheets.get_daily_data_for_range(monday, sunday)

        if not data:
            await update.message.reply_text(
                f"📊 *Week of {monday}*\n\nNo data logged this week yet.",
                parse_mode="Markdown",
            )
            return

        msg = _format_weekly_summary(monday, sunday, data, len(week_dates))
        await update.message.reply_text(msg, parse_mode="Markdown")

    except Exception as e:
        log.error("command", f"/week error: {e}")
        await update.message.reply_text("❌ Error fetching weekly data. Try again later.")


async def cmd_goals(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /goals — show current macro/calorie targets."""
    if not await _check_auth(update):
        return

    log.info("command", "/goals")
    try:
        sheets = _get_sheets()
        goals = sheets.get_goals()

        if not goals:
            await update.message.reply_text(
                "🎯 *No goals set yet.*\n\n"
                "Upload a MacroFactor Program Settings export to set targets.",
                parse_mode="Markdown",
            )
            return

        lines = ["🎯 *Current Macro Targets*\n"]
        for g in goals:
            day = g.get("Weekday", "?")
            cal = g.get("Target_Calories", "—")
            pro = g.get("Target_Protein_g", "—")
            carb = g.get("Target_Carbs_g", "—")
            fat = g.get("Target_Fats_g", "—")
            lines.append(f"*{day[:3]}:* {cal}cal | {pro}P {carb}C {fat}F")

        last_updated = goals[0].get("Last_Updated", "")
        if last_updated:
            lines.append(f"\n_Last updated: {last_updated}_")

        await update.message.reply_text("\n".join(lines), parse_mode="Markdown")

    except Exception as e:
        log.error("command", f"/goals error: {e}")
        await update.message.reply_text("❌ Error fetching goals. Try again later.")


async def cmd_summary(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /summary — generate and send AI-powered health summary."""
    if not await _check_auth(update):
        return

    log.info("command", "/summary")

    try:
        await update.message.reply_text("⏳ Generating AI summary... this may take a moment.")

        from backend.services.summary_service import SummaryService
        sheets = _get_sheets()
        summary_svc = SummaryService(sheets)

        result = await summary_svc.generate_ai_summary()

        if result.get("success"):
            # Split long messages if needed (Telegram max is 4096 chars)
            text = f"📊 *Weekly Health Summary*\n\n{result['summary_text']}"
            if len(text) > 4096:
                # Send in chunks
                for i in range(0, len(text), 4096):
                    chunk = text[i:i + 4096]
                    await update.message.reply_text(chunk, parse_mode="Markdown")
            else:
                await update.message.reply_text(text, parse_mode="Markdown")
        else:
            error = result.get("error", "Unknown error")
            await update.message.reply_text(
                f"❌ Could not generate AI summary: {error}\n\n"
                "Make sure ANTHROPIC_API_KEY is set and there's enough data.",
            )

    except Exception as e:
        log.error("command", f"/summary error: {e}")
        await update.message.reply_text("❌ Error generating AI summary. Try again later.")


# ─── File Upload Handler ─────────────────────────────────────────

async def handle_document(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle file uploads — detect MacroFactor .xlsx and process."""
    if not await _check_auth(update):
        return

    document = update.message.document
    if not document:
        return

    file_name = document.file_name or ""
    log.info("file_upload", f"Received file: {file_name} ({document.file_size} bytes)")

    # Check file extension
    if not file_name.lower().endswith(".xlsx"):
        await update.message.reply_text(
            "⚠️ Please send a `.xlsx` file (MacroFactor export).\n"
            "Other file types are not supported.",
            parse_mode="Markdown",
        )
        return

    # Download to temp file
    tmp_path = None
    try:
        await update.message.reply_text("📥 Processing file...")

        # Download
        file = await context.bot.get_file(document.file_id)
        tmp_fd, tmp_path = tempfile.mkstemp(suffix=".xlsx")
        os.close(tmp_fd)
        await file.download_to_drive(tmp_path)

        log.info("file_upload", f"Downloaded to {tmp_path}")

        # Parse and upsert
        nutrition = _get_nutrition()
        result = nutrition.import_macrofactor_file(tmp_path)

        await update.message.reply_text(result["message"], parse_mode="Markdown")

    except Exception as e:
        error_msg = f"❌ Failed to process file: {type(e).__name__}"
        log.error("file_upload", f"Error processing {file_name}: {type(e).__name__}: {e}")
        await update.message.reply_text(error_msg)

    finally:
        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
                log.info("file_upload", f"Cleaned up temp file: {tmp_path}")
            except OSError:
                pass


# ─── Manual Text Input Handler ───────────────────────────────────

async def handle_text(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle text messages — detect manual nutrition entries."""
    if not await _check_auth(update):
        return

    text = update.message.text.strip()
    if not text:
        return

    # Check if it looks like a date-based manual entry (starts with YYYY-MM-DD)
    if len(text) >= 10 and text[4] == "-" and text[7] == "-":
        await _handle_manual_entry(update, text)
    else:
        # Unknown text
        await update.message.reply_text(
            "🤔 I don't understand that.\n\n"
            "To enter data manually:\n"
            "`YYYY-MM-DD weight protein carbs fats calories`\n"
            "Example: `2026-02-09 73 180 200 70 2100`\n\n"
            "Or send a MacroFactor `.xlsx` export.\n"
            "Type /help for all commands.",
            parse_mode="Markdown",
        )


async def _handle_manual_entry(update: Update, text: str):
    """Process a manual nutrition entry from text."""
    log.info("manual_input", f"Received manual entry: {text}")

    try:
        parsed = NutritionService.parse_manual_text(text)
    except ValueError as e:
        await update.message.reply_text(f"❌ {e}", parse_mode="Markdown")
        return

    nutrition = _get_nutrition()
    result = nutrition.import_manual_entry(
        date_str=parsed["date"],
        weight=parsed.get("weight"),
        protein=parsed.get("protein"),
        carbs=parsed.get("carbs"),
        fats=parsed.get("fats"),
        calories=parsed.get("calories"),
    )

    # Build response with warnings
    response = result["message"]
    if result.get("warnings"):
        response += "\n\n" + "\n".join(result["warnings"])

    await update.message.reply_text(response, parse_mode="Markdown")


# ─── Message Formatting ─────────────────────────────────────────

def _format_daily_stats(date_str: str, data: dict) -> str:
    """Format a day's stats into a readable Telegram message."""
    lines = [f"📅 *{date_str}*\n"]

    # Score badges with color coding
    sleep_score = _safe_int(data.get("Sleep_Score"))
    readiness = _safe_int(data.get("Readiness_Score"))
    activity = _safe_int(data.get("Activity_Score"))

    if sleep_score is not None:
        lines.append(f"{_score_emoji(sleep_score)} Sleep: *{sleep_score}*")
    if readiness is not None:
        lines.append(f"{_score_emoji(readiness)} Readiness: *{readiness}*")
    if activity is not None:
        lines.append(f"{_score_emoji(activity)} Activity: *{activity}*")

    # Sleep details
    sleep_hours = _safe_float(data.get("Total_Sleep_Hours"))
    deep = _safe_int(data.get("Deep_Sleep_Minutes"))
    rem = _safe_int(data.get("REM_Sleep_Minutes"))
    efficiency = _safe_float(data.get("Sleep_Efficiency"))
    nap = _safe_int(data.get("Nap_Minutes"))

    if sleep_hours is not None:
        lines.append(f"\n😴 *Sleep:* {sleep_hours}h")
        parts = []
        if deep is not None:
            parts.append(f"Deep {deep}min")
        if rem is not None:
            parts.append(f"REM {rem}min")
        if efficiency is not None:
            parts.append(f"Efficiency {efficiency}%")
        if parts:
            lines.append(f"   {' · '.join(parts)}")
        if nap is not None and nap > 0:
            lines.append(f"   💤 Nap: {nap}min")

    # Body metrics
    steps = _safe_int(data.get("Steps"))
    rhr = _safe_int(data.get("Resting_Heart_Rate"))
    hrv = _safe_float(data.get("HRV_Balance"))
    temp = _safe_float(data.get("Temperature_Deviation"))

    body_parts = []
    if steps is not None:
        body_parts.append(f"🚶 Steps: *{steps:,}*")
    if rhr is not None:
        body_parts.append(f"❤️ RHR: *{rhr}* bpm")
    if hrv is not None:
        body_parts.append(f"📈 HRV: *{hrv}*")
    if temp is not None:
        sign = "+" if temp > 0 else ""
        body_parts.append(f"🌡️ Temp: *{sign}{temp}°*")
    if body_parts:
        lines.append("")
        lines.extend(body_parts)

    # Nutrition
    weight = _safe_float(data.get("Weight_kg"))
    trend = _safe_float(data.get("Trend_Weight_kg"))
    calories = _safe_int(data.get("Calories"))
    protein = _safe_float(data.get("Protein_g"))
    carbs = _safe_float(data.get("Carbs_g"))
    fats = _safe_float(data.get("Fats_g"))
    expenditure = _safe_int(data.get("Expenditure"))

    if any(v is not None for v in [weight, calories, protein]):
        lines.append("")
        lines.append("🍽️ *Nutrition*")
        if weight is not None:
            weight_str = f"⚖️ Weight: *{weight}kg*"
            if trend is not None:
                weight_str += f" (trend: {trend}kg)"
            lines.append(weight_str)
        if calories is not None:
            cal_str = f"🔥 Calories: *{calories}*"
            if expenditure is not None:
                diff = calories - expenditure
                sign = "+" if diff > 0 else ""
                cal_str += f" (TDEE: {expenditure}, {sign}{diff})"
            lines.append(cal_str)
        macro_parts = []
        if protein is not None:
            macro_parts.append(f"*{protein:.0f}*P")
        if carbs is not None:
            macro_parts.append(f"*{carbs:.0f}*C")
        if fats is not None:
            macro_parts.append(f"*{fats:.0f}*F")
        if macro_parts:
            lines.append(f"📊 Macros: {' · '.join(macro_parts)}")

    return "\n".join(lines)


def _format_weekly_summary(monday: str, sunday: str, data: list[dict], days_elapsed: int) -> str:
    """Format weekly summary into a Telegram message."""
    lines = [f"📊 *Week of {monday} → {sunday}*\n"]

    # Calculate averages
    def avg(field, as_int=False):
        vals = [_safe_float(d.get(field)) for d in data if _safe_float(d.get(field)) is not None]
        if not vals:
            return None
        result = sum(vals) / len(vals)
        return round(result) if as_int else round(result, 1)

    # Scores
    sleep_avg = avg("Sleep_Score", as_int=True)
    readiness_avg = avg("Readiness_Score", as_int=True)
    activity_avg = avg("Activity_Score", as_int=True)

    if sleep_avg is not None:
        lines.append(f"{_score_emoji(sleep_avg)} Avg Sleep Score: *{sleep_avg}*")
    if readiness_avg is not None:
        lines.append(f"{_score_emoji(readiness_avg)} Avg Readiness: *{readiness_avg}*")
    if activity_avg is not None:
        lines.append(f"{_score_emoji(activity_avg)} Avg Activity: *{activity_avg}*")

    # Sleep
    sleep_avg_hrs = avg("Total_Sleep_Hours")
    nap_avg = avg("Nap_Minutes", as_int=True)
    if sleep_avg_hrs is not None:
        lines.append(f"\n😴 Avg Sleep: *{sleep_avg_hrs}h*")
    if nap_avg is not None and nap_avg > 0:
        lines.append(f"💤 Avg Nap: *{nap_avg}min*")

    # Steps
    steps_avg = avg("Steps", as_int=True)
    if steps_avg is not None:
        lines.append(f"🚶 Avg Steps: *{steps_avg:,}*")

    # Weight
    weight_vals = [_safe_float(d.get("Weight_kg")) for d in data if _safe_float(d.get("Weight_kg")) is not None]
    if weight_vals:
        lines.append(f"\n⚖️ Weight: *{weight_vals[-1]}kg*")
        if len(weight_vals) > 1:
            change = round(weight_vals[-1] - weight_vals[0], 1)
            sign = "+" if change > 0 else ""
            lines.append(f"   Week change: {sign}{change}kg")

    # Nutrition
    cal_avg = avg("Calories", as_int=True)
    protein_avg = avg("Protein_g", as_int=True)
    carbs_avg = avg("Carbs_g", as_int=True)
    fats_avg = avg("Fats_g", as_int=True)

    if cal_avg is not None:
        lines.append(f"\n🔥 Avg Calories: *{cal_avg}*")
    macro_parts = []
    if protein_avg is not None:
        macro_parts.append(f"*{protein_avg}*P")
    if carbs_avg is not None:
        macro_parts.append(f"*{carbs_avg}*C")
    if fats_avg is not None:
        macro_parts.append(f"*{fats_avg}*F")
    if macro_parts:
        lines.append(f"📊 Avg Macros: {' · '.join(macro_parts)}")

    # Compliance
    nutrition_days = sum(1 for d in data if d.get("Nutrition_Logged") in (True, "TRUE", "true"))
    compliance = round(nutrition_days / 7 * 100)
    lines.append(f"\n📋 Nutrition logged: *{nutrition_days}/7 days* ({compliance}%)")
    lines.append(f"📅 Days with data: *{len(data)}/{days_elapsed}*")

    return "\n".join(lines)


def _score_emoji(score: int) -> str:
    """Return color-coded emoji for health scores."""
    if score >= 80:
        return "🟢"
    elif score >= 60:
        return "🟡"
    else:
        return "🔴"


def _safe_int(value) -> int | None:
    """Safely convert a value to int, returning None for empty/invalid."""
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (ValueError, TypeError):
        return None


def _safe_float(value) -> float | None:
    """Safely convert a value to float, returning None for empty/invalid."""
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


# ─── Bot Runner ──────────────────────────────────────────────────

def create_application() -> Application:
    """Create and configure the Telegram bot application."""
    if not TELEGRAM_BOT_TOKEN:
        raise ValueError("TELEGRAM_BOT_TOKEN not set in environment")

    app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    # Register command handlers
    app.add_handler(CommandHandler("start", cmd_start))
    app.add_handler(CommandHandler("help", cmd_help))
    app.add_handler(CommandHandler("status", cmd_status))
    app.add_handler(CommandHandler("today", cmd_today))
    app.add_handler(CommandHandler("week", cmd_week))
    app.add_handler(CommandHandler("goals", cmd_goals))
    app.add_handler(CommandHandler("summary", cmd_summary))

    # File upload handler
    app.add_handler(MessageHandler(filters.Document.ALL, handle_document))

    # Text message handler (must be last — catches all remaining text)
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_text))

    return app


def start_bot():
    """Start the Telegram bot with polling. Blocks until stopped."""
    log.info("start", "Starting Telegram bot...")
    log.info("start", f"Bot username: @{TELEGRAM_USER_ID}")
    log.info("start", f"Authorized user ID: {TELEGRAM_USER_ID}")

    app = create_application()

    log.info("start", "Bot is running — polling for messages...")
    app.run_polling(
        allowed_updates=Update.ALL_TYPES,
        drop_pending_updates=True,  # Don't process old messages on restart
    )
