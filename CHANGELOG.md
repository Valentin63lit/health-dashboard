# CHANGELOG

All notable changes to this project will be documented in this file.

## [0.5.0] — 2026-02-09
### Added — Phase 5: Deploy to Railway

- **Git repository** — Initialized git, committed all project files
  - `.gitignore` configured to exclude `.env`, `service-account.json`, `__pycache__/`, `node_modules/`, `*.log`, setup artifacts
  - `.env.example` created with all required env var templates

- **Dashboard auth for Railway** — `dashboard/src/lib/sheets.ts`
  - Now accepts `GOOGLE_SERVICE_ACCOUNT_JSON` (full JSON) — parses `client_email` and `private_key` from it
  - Falls back to individual `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_KEY` for local dev
  - Removed API key auth path (service account only, more secure)

- **Dockerfile improvements**
  - `backend/Dockerfile` — Removed unnecessary `.env.example` copy
  - `dashboard/Dockerfile` — Removed build-time env var args (not needed with `force-dynamic` routes)
  - Both Dockerfiles production-ready for Railway

- **`railway.toml`** — Updated with complete deployment instructions and env var documentation

### Files Added
- `.env.example` — Environment variable template (safe to commit)

### Files Modified
- `.gitignore` — Added `.env.local`, `.alerts_cache.json`, `.cursor/`, setup artifacts, root-level image duplicates
- `dashboard/src/lib/sheets.ts` — `GOOGLE_SERVICE_ACCOUNT_JSON` support for Railway
- `backend/Dockerfile` — Simplified for production
- `dashboard/Dockerfile` — Simplified, no build args needed
- `railway.toml` — Complete setup instructions
- `PROJECT_SCOPE.md` — Marked Phase 5 complete
- `CHANGELOG.md`

---

## [0.4.0] — 2026-02-09
### Added — Phase 4: Dashboard + Deployment

- **Next.js dashboard** — `dashboard/` directory
  - App Router, TypeScript, Tailwind CSS with Cold Labs brand design tokens
  - Dark theme (`#061A19` background), mobile-first, Inter font
  - Bottom navigation bar: Today / Weekly / Trends / AI tabs
  - Google Sheets API client (REST, no heavy SDK, 60s revalidation)
  - **Today view** (`/`): Score cards (sleep, readiness, activity with green/yellow/red), sleep detail section, body metrics, macro progress bars vs targets, calorie balance, status badge
  - **Weekly view** (`/weekly`): Week selector with prev/next navigation, average score cards, compliance badge, Recharts line/bar charts (weight trend, sleep scores, steps, calories), week averages table
  - **Trends view** (`/trends`): Date range filter (1 week, 4 weeks, 3 months, all time), multi-line charts for weight, health scores, HRV/RHR, calories vs TDEE, week-over-week comparison table
  - **AI Insights view** (`/insights`): Expandable accordion of Claude AI summaries, markdown-like formatting with bold highlights, sorted by date descending
  - **API routes**: `/api/data` (daily logs + weekly summaries), `/api/insights` (AI summaries)

- **Docker & Railway deployment files**
  - `backend/Dockerfile` — Python 3.11-slim, installs deps, runs `python -m backend.main run`
  - `dashboard/Dockerfile` — Node 20-alpine, multi-stage build, standalone output, serves on $PORT
  - `railway.toml` — Deployment config with environment variable documentation

- **Reusable components**: NavBar, ScoreCard, StatusBadge, MacroBar, StatRow, ComplianceBadge, WeekSelector, Charts (WeightChart, ScoreChart, MetricBarChart, TrendsChart)

### Files Added
- `dashboard/` — Complete Next.js application (package.json, tsconfig.json, tailwind.config.ts, etc.)
- `dashboard/src/app/page.tsx` — Today view
- `dashboard/src/app/weekly/page.tsx` — Weekly view
- `dashboard/src/app/trends/page.tsx` — Trends view
- `dashboard/src/app/insights/page.tsx` — AI Insights view
- `dashboard/src/app/api/data/route.ts` — Data API
- `dashboard/src/app/api/insights/route.ts` — AI summaries API
- `dashboard/src/components/` — 8 reusable components
- `dashboard/src/lib/types.ts` — TypeScript interfaces
- `dashboard/src/lib/sheets.ts` — Google Sheets API client
- `backend/Dockerfile`
- `dashboard/Dockerfile`
- `railway.toml`

### Files Modified
- `PROJECT_SCOPE.md` — Marked Phase 4 complete, updated Phase 5 status
- `CHANGELOG.md`

---

## [0.3.0] — 2026-02-09
### Added — Phase 3: Automation & Intelligence

- **Scheduler** — `backend/scheduler.py`
  - APScheduler `AsyncIOScheduler` running in the same async event loop as the Telegram bot
  - All times in Europe/Sofia timezone
  - Jobs: Morning Sync (10:00), Evening Sync (18:00), Midnight Sync (00:00), Weekly AI Summary (Sun 10:00)
  - 5-second delay between sequential jobs to avoid Google Sheets rate limiting
  - Each job wrapped in try/except with Telegram notification on failure
  - Lazy-loaded shared SheetsClient for all jobs

- **Alert service** — `backend/services/alert_service.py`
  - 4 alert rules: HRV Drop (🔴 <85% of 7-day avg), Sleep Score Drop (🔴 <60), Weight Spike (🟡 >1.5kg vs yesterday), Missing Nutrition (🟡 2+ consecutive days)
  - File-based deduplication (`.alerts_cache.json`) — same alert not sent twice in one day
  - Cache auto-prunes to last 7 days

- **Weekly summary calculator** — `backend/services/summary_service.py`
  - `calculate_weekly_summary()` — calculates all averages matching Weekly Summary headers
  - `update_all_weekly_summaries()` — recalculates current + previous week, upserts to Weekly Summary tab
  - Includes: weight change vs previous week, compliance percentage, avg nap minutes
  - `generate_ai_summary()` — gathers 7-day + 30-day data, goals, previous 4 week summaries, calls Claude

- **Claude AI client** — `backend/clients/claude_client.py`
  - Uses Anthropic Python SDK with the prompt template from PROJECT_SCOPE.md Section 6
  - Retries once on failure before raising
  - Returns summary text for storage and Telegram delivery

- **Telegram bot `/summary` command now works** — `backend/clients/telegram_bot.py`
  - Shows "⏳ Generating AI summary..." loading message
  - Calls `SummaryService.generate_ai_summary()` and sends result
  - Handles long messages (splits at 4096 char Telegram limit)

- **Google Sheets new methods** — `backend/clients/sheets_client.py`
  - `upsert_weekly_summary()` — upserts by Week_Start, keeps rows sorted
  - `get_recent_weekly_summaries(count)` — returns latest N weekly summaries
  - `upsert_ai_summary()` — stores AI summary by date
  - `get_ai_summaries(count)` — returns latest N AI summaries

- **CLI commands** — `backend/main.py`
  - `run` — Production entry point: starts bot + scheduler in same async event loop
  - `alerts` — Run alert checks manually
  - `weekly` — Recalculate weekly summaries manually
  - `ai-summary` — Generate AI summary on demand

### Files Added
- `backend/scheduler.py`
- `backend/services/alert_service.py`
- `backend/services/summary_service.py`
- `backend/clients/claude_client.py`

### Files Modified
- `backend/main.py` — Added `run`, `alerts`, `weekly`, `ai-summary` commands
- `backend/clients/sheets_client.py` — Added weekly summary and AI summary methods
- `backend/clients/telegram_bot.py` — `/summary` command now generates real AI summary
- `PROJECT_SCOPE.md` — Marked Phase 3 complete
- `CHANGELOG.md`

---

## [0.2.0] — 2026-02-09
### Added — Phase 2: Telegram Bot + Nap Tracking

- **Nap tracking** — New `Nap_Minutes` column (W, index 22) in Daily Log
  - `backend/config.py` — Added to `DAILY_LOG_COLUMNS`, `DAILY_LOG_HEADERS`, `OURA_COLUMNS`
  - `backend/config.py` — Added `Avg_Nap_Minutes` to `WEEKLY_SUMMARY_HEADERS`
  - `backend/clients/oura_client.py` — After picking longest sleep session as primary, sums `total_sleep_duration` of all other sessions → `Nap_Minutes` (converted seconds→minutes). 0 if no naps.
  - Google Sheet headers updated for Daily Log and Weekly Summary tabs
  - Verified: Jan 6 = 8min nap, Jan 7 = 12min nap

- **Telegram bot** — Full bot at `backend/clients/telegram_bot.py`
  - **Security:** Only responds to `TELEGRAM_USER_ID`. All others get "⛔ Unauthorized."
  - **Commands:**
    - `/start` — Welcome message with instructions
    - `/help` — All available commands
    - `/status` — Today's data completeness (✅/❌ for Oura, Nutrition, Weight)
    - `/today` — Full stats for today with color-coded scores (🟢≥80, 🟡60-79, 🔴<60), sleep details, body metrics, nutrition, nap minutes
    - `/week` — This week's summary (averages, compliance %, weight change)
    - `/goals` — Current macro targets from Goals tab
    - `/summary` — AI summary stub ("coming in Phase 3")
  - **File upload:** Receives `.xlsx`, downloads to temp, parses via `NutritionService`, replies with result, cleans up temp file
  - **Manual text input:** Detects `YYYY-MM-DD ...` format, parses, upserts, confirms with warnings
  - **Error handling:** All exceptions caught, user gets human-readable message, full error logged

- **CLI updates** — `backend/main.py`
  - Added `bot` command: `python -m backend.main bot` to start Telegram bot locally
  - Added `sync-40` command: `python -m backend.main sync-40` for 40-day lookback sync

### Changed
- `backend/clients/oura_client.py` — Refactored sleep processing: groups sessions by day, sorts by duration, picks longest as primary, sums rest as naps
- `backend/clients/sheets_client.py` — `setup_tabs()` now updates headers on existing tabs when they differ (enables adding new columns)

### Files Added
- `backend/clients/telegram_bot.py`

### Files Modified
- `backend/config.py`
- `backend/clients/oura_client.py`
- `backend/main.py`
- `PROJECT_SCOPE.md` — Added Nap_Minutes to schema (Sections 2.1, 3), marked Phase 2 complete
- `CHANGELOG.md`

---

## [0.1.0] — 2026-02-09
### Added — Phase 1: Core Data Pipeline
- **Project structure** — Created full directory layout per PROJECT_SCOPE.md Section 10
  - `backend/config.py` — Environment variable loading, column mappings, all constants
  - `backend/utils/logger.py` — Structured logger with Europe/Sofia timezone, file + stdout output
  - `backend/utils/date_utils.py` — Timezone-aware date utilities, week bounds, date range helpers
  - `backend/clients/sheets_client.py` — Google Sheets client with upsert logic, retry, tab setup
  - `backend/clients/oura_client.py` — Oura Ring API v2 client (sleep, readiness, activity, heart rate)
  - `backend/parsers/macrofactor_parser.py` — MacroFactor .xlsx parser (all 3 formats: Quick Export, Detailed Export, Program Settings)
  - `backend/services/sync_service.py` — Oura → Google Sheets sync orchestrator
  - `backend/services/nutrition_service.py` — MacroFactor import + manual text input handler
  - `backend/main.py` — CLI entry point for manual testing
  - `backend/requirements.txt` — Pinned Python dependencies

- **Google Sheets setup** — Created 4 tabs with headers:
  - Daily Log (22 columns: Date through Data_Complete)
  - Weekly Summary (22 columns)
  - Goals (7 columns)
  - AI Summaries (3 columns)

- **Oura Ring integration** — Successfully tested:
  - API connection verified (token works)
  - Fetches data from 5 endpoints: daily_sleep, daily_readiness, daily_activity, sleep, heartrate
  - Extracts 11 fields per day: Steps, Sleep Score, Readiness Score, Activity Score, Total Sleep Hours, Deep/REM Sleep Minutes, Sleep Efficiency, Temperature Deviation, HRV Balance, Resting Heart Rate
  - Handles multiple sleep sessions per day (picks the longest one)
  - HRV Balance returns null for this ring — code handles gracefully

- **Upsert logic** — Bulletproof merge behavior:
  - Finds or creates rows by date
  - Merges non-null values only (never overwrites with empty)
  - Source isolation: Oura only writes columns J–T, nutrition only writes B–I
  - Keeps Daily Log sorted by date (ascending)
  - Idempotent: running sync twice produces identical results (verified)
  - Computes derived fields: Nutrition_Logged, Data_Complete

- **End-to-end sync verified** — Ran sync with 40-day lookback:
  - Found 4 days of Oura data (Jan 4–7, 2026)
  - All 4 days upserted to Google Sheet successfully
  - Second run updated existing rows (no duplicates)

### Environment
- Python 3.x with virtual environment
- All dependencies installed: gspread, google-auth, requests, openpyxl, pytz, python-dotenv, APScheduler, python-telegram-bot, anthropic
- Service account connected to Google Sheet "Health Tracking"

---

## [0.0.1] — 2026-02-09
### Added
- Initial project scope (`PROJECT_SCOPE.md`)
- Credentials template (`CREDENTIALS.md`)
- Cursor development rules (`CURSOR_RULES.md`)
- This changelog

### Notes
- Project scoped and ready for Phase 1 development
- MacroFactor export formats documented (3 variants)
- Oura API fields finalized (11 fields per day)
- Google Sheet schema defined (Daily Log + Weekly Summary + Goals)
