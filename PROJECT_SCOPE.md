# Health Dashboard — Project Scope & Cursor Instructions

> **Owner:** Alexander (Cold Labs)
> **Last Updated:** 2026-02-09
> **Status:** Phase 5 Complete — Deployed to Railway

---

## 1. Project Overview

A personal health tracking system that automatically consolidates data from **Oura Ring** and **MacroFactor** into a single Google Sheet (backend), with a **Telegram bot** for zero-friction data input, a **web dashboard** for visualization, and **AI-powered weekly summaries** via Claude API.

### Core Principle
**Minimum manual effort.** Alexander's #1 requirement is that this takes almost zero daily time. The system should run autonomously, and the only manual action should be occasionally exporting a file from MacroFactor and dropping it into Telegram.

### Architecture
```
┌─────────────────────────────────────────────────────────┐
│                      RAILWAY (Hosted)                    │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Cron Jobs │  │ Telegram Bot │  │  Web Dashboard    │  │
│  │ (3x/day) │  │ (always-on)  │  │  (Next.js/React)  │  │
│  └────┬─────┘  └──────┬───────┘  └───────────────────┘  │
│       │               │                                  │
│  ┌────▼───────────────▼──────────────────────────────┐  │
│  │              Core Python Engine                     │  │
│  │  ┌─────────┐ ┌──────────┐ ┌─────────────────────┐ │  │
│  │  │  Oura   │ │MacroFactor│ │  Google Sheets API  │ │  │
│  │  │ Client  │ │ Parser    │ │  (Read/Write)       │ │  │
│  │  └─────────┘ └──────────┘ └─────────────────────┘ │  │
│  │  ┌──────────────┐ ┌──────────────────────────────┐ │  │
│  │  │ Claude API   │ │  Alert Engine                │ │  │
│  │  │ (Summaries)  │ │  (Telegram Notifications)    │ │  │
│  │  └──────────────┘ └──────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  ┌──────────────┐            ┌──────────────────┐
  │  Oura API    │            │  Google Sheets    │
  │  (Read-only) │            │  (Backend/Store)  │
  └──────────────┘            └──────────────────┘
```

---

## 2. Data Sources & Schema

### 2.1 Oura Ring API (Automatic — pulled by cron)

**API Token:** See `CREDENTIALS.md`
**Base URL:** `https://api.ouraring.com/v2/usercollection/`
**Endpoints used:**
- `/daily_sleep` — sleep score, efficiency
- `/daily_readiness` — readiness score, HRV, temperature deviation
- `/daily_activity` — steps, activity score
- `/sleep` — detailed sleep stages (deep, REM, light minutes)
- `/heartrate` — resting heart rate (use daily minimum or Oura's resting HR)

**Fields to extract per day:**

| Field | Source Endpoint | Notes |
|-------|----------------|-------|
| `Steps` | daily_activity | Total daily steps |
| `Total_Sleep_Hours` | sleep | Total sleep duration, convert seconds → hours (1 decimal) |
| `Sleep_Score` | daily_sleep | 0-100 score |
| `Deep_Sleep_Minutes` | sleep | Deep sleep stage duration in minutes |
| `REM_Sleep_Minutes` | sleep | REM sleep stage duration in minutes |
| `Sleep_Efficiency` | sleep | Percentage (0-100) |
| `Readiness_Score` | daily_readiness | 0-100 score |
| `Temperature_Deviation` | daily_readiness | Degrees deviation from baseline |
| `HRV_Balance` | daily_readiness | HRV balance score from readiness contributors |
| `Resting_Heart_Rate` | daily_readiness or sleep | BPM |
| `Activity_Score` | daily_activity | 0-100 score |
| `Nap_Minutes` | sleep | Sum of all non-primary sleep sessions (minutes). 0 if no naps. |

### 2.2 MacroFactor Export (Manual — via Telegram bot)

Alexander exports an `.xlsx` file from MacroFactor on his phone and sends it to the Telegram bot.

**The system must handle THREE export formats:**

#### Format A: "Quick Export" (single sheet)
- Sheet name: `Quick Export`
- Columns: `Date | Expenditure | Trend Weight (kg) | Weight (kg) | Steps | Calories (kcal) | Protein (g) | Fat (g) | Carbs (g)`
- Date format: `datetime` object
- Can cover any date range (7 days, 14 days, all-time)

#### Format B: "Detailed Export" (two sheets)
- Sheet 1: `Calories & Macros` — Columns: `Date | Calories (kcal) | Protein (g) | Fat (g) | Carbs (g)`
- Sheet 2: `Scale Weight` — Columns: `Date | Weight (kg) | Fat Percent`

#### Format C: "Program Settings" (goals/targets)
- Sheet name: `Program Settings`
- Columns: `Program Update Date | Program Weekday | Calories (kcal) | Fat (g) | Protein (g) | Carbs (g) | Expenditure (kcal) | Daily Average (kcal) | Weight (kg) | Expenditure Calculation Mode`
- This contains **target values per day of week**, updated over time
- The system should use the **most recent program update** for each weekday as the current targets
- When this file is uploaded, it should update the stored goals/targets

**Fields to extract per day (from Format A or B):**

| Field | Source | Notes |
|-------|--------|-------|
| `Weight_kg` | Weight (kg) | Scale weight, nullable |
| `Trend_Weight_kg` | Trend Weight (kg) | MacroFactor's smoothed trend, nullable |
| `Protein_g` | Protein (g) | Nullable (not logged yet) |
| `Carbs_g` | Carbs (g) | Nullable |
| `Fats_g` | Fat (g) | Nullable |
| `Calories` | Calories (kcal) | Nullable |
| `Expenditure` | Expenditure | TDEE estimate from MacroFactor |
| `Fat_Percent` | Fat Percent | Only in Format B, nullable |

### 2.3 Telegram Bot Manual Input (Backup)

Format: `YYYY-MM-DD weight protein carbs fats calories`
Example: `2026-02-09 85.2 180 200 70 2100`

Bot confirms: "✅ Feb 9 — 85.2kg | 180P 200C 70F | 2100cal"

---

## 3. Google Sheet Structure

**Sheet URL:** `https://docs.google.com/spreadsheets/d/1Jv90FW__xZKyj0V75nITM79Qcx-ZofzlRcLNH1GonNk/edit`

### Tab 1: "Daily Log"

One row per day. This is the single source of truth.

| Column | Field | Source | Type |
|--------|-------|--------|------|
| A | `Date` | System | DATE (YYYY-MM-DD) |
| B | `Weight_kg` | MacroFactor | FLOAT, nullable |
| C | `Trend_Weight_kg` | MacroFactor | FLOAT, nullable |
| D | `Fat_Percent` | MacroFactor | FLOAT, nullable |
| E | `Protein_g` | MacroFactor | FLOAT, nullable |
| F | `Carbs_g` | MacroFactor | FLOAT, nullable |
| G | `Fats_g` | MacroFactor | FLOAT, nullable |
| H | `Calories` | MacroFactor | INT, nullable |
| I | `Expenditure` | MacroFactor | INT, nullable |
| J | `Steps` | Oura | INT |
| K | `Total_Sleep_Hours` | Oura | FLOAT (1 decimal) |
| L | `Sleep_Score` | Oura | INT (0-100) |
| M | `Deep_Sleep_Minutes` | Oura | INT |
| N | `REM_Sleep_Minutes` | Oura | INT |
| O | `Sleep_Efficiency` | Oura | FLOAT (%) |
| P | `Readiness_Score` | Oura | INT (0-100) |
| Q | `Temperature_Deviation` | Oura | FLOAT |
| R | `HRV_Balance` | Oura | FLOAT |
| S | `Resting_Heart_Rate` | Oura | INT (BPM) |
| T | `Activity_Score` | Oura | INT (0-100) |
| U | `Nutrition_Logged` | Computed | BOOLEAN — TRUE if Calories is not null |
| V | `Data_Complete` | Computed | BOOLEAN — TRUE if both Oura + nutrition present |
| W | `Nap_Minutes` | Oura | INT — sum of non-primary sleep sessions (minutes), 0 if none |

### Tab 2: "Weekly Summary"

One row per week (Monday–Sunday). Auto-calculated from Daily Log.

| Column | Field | Calculation |
|--------|-------|-------------|
| A | `Week_Start` | Monday date |
| B | `Week_End` | Sunday date |
| C | `Week_Number` | ISO week number |
| D | `Avg_Weight_kg` | Mean of non-null Weight_kg |
| E | `Avg_Trend_Weight_kg` | Mean of non-null Trend_Weight_kg |
| F | `Avg_Protein_g` | Mean of logged days only |
| G | `Avg_Carbs_g` | Mean of logged days only |
| H | `Avg_Fats_g` | Mean of logged days only |
| I | `Avg_Calories` | Mean of logged days only |
| J | `Avg_Steps` | Mean |
| K | `Avg_Sleep_Hours` | Mean |
| L | `Avg_Sleep_Score` | Mean |
| M | `Avg_Deep_Sleep_Min` | Mean |
| N | `Avg_REM_Sleep_Min` | Mean |
| O | `Avg_Readiness_Score` | Mean |
| P | `Avg_HRV_Balance` | Mean |
| Q | `Avg_Resting_HR` | Mean |
| R | `Avg_Activity_Score` | Mean |
| S | `Avg_Nap_Minutes` | Mean |
| T | `Days_Logged_Nutrition` | Count of days with Nutrition_Logged = TRUE |
| U | `Days_Logged_Total` | Count of days with Data_Complete = TRUE |
| V | `Weight_Change_kg` | This week avg - last week avg |
| W | `Compliance_Pct` | Days_Logged_Nutrition / 7 * 100 |

### Tab 3: "Goals"

Stores current macro/calorie targets per day of week. Updated when Program Settings file is uploaded.

| Column | Field |
|--------|-------|
| A | `Weekday` | Monday–Sunday |
| B | `Target_Calories` |
| C | `Target_Protein_g` |
| D | `Target_Carbs_g` |
| E | `Target_Fats_g` |
| F | `Target_Weight_kg` | (optional, manually set) |
| G | `Last_Updated` | Date of most recent program update |

---

## 4. Upsert Logic (Critical)

When data comes in (from any source — Oura cron, MacroFactor upload, or manual Telegram input):

1. **Match by date** — find or create the row for that date in Daily Log
2. **Merge, don't overwrite blindly:**
   - If the incoming value is `null`/`None`/empty → **keep existing value** (don't clear data)
   - If the incoming value is not null → **overwrite** (update with latest)
3. **Source isolation:** Oura data only touches Oura columns (J–T). MacroFactor/manual only touches nutrition columns (B–I).
4. **Backfill:** On every cron run, process the last 7 days to catch late-logged data.
5. **Idempotent:** Running the same import twice should produce the same result.

---

## 5. Telegram Bot

### 5.1 Bot Commands

| Command | Action |
|---------|--------|
| `/start` | Welcome message with instructions |
| `/status` | Show today's data completeness (what's logged, what's missing) |
| `/today` | Show today's full stats |
| `/week` | Show this week's summary so far |
| `/goals` | Show current macro/calorie targets |
| `/summary` | Trigger on-demand AI summary (7-day + 30-day) |
| `/help` | Show all commands |

### 5.2 File Upload Handling

When a `.xlsx` file is received:
1. Detect format (Quick Export, Detailed Export, or Program Settings) by checking sheet names
2. Parse all data
3. Upsert into Google Sheet using merge logic (Section 4)
4. Reply with summary: "✅ Imported 7 days of data (Feb 3–9). Updated: 5 nutrition entries, 3 weight entries."
5. If Program Settings detected: "🎯 Updated macro targets. New daily targets: 2590cal | 190P 300C 70F"

### 5.3 Manual Text Input

Format: `YYYY-MM-DD weight protein carbs fats calories`
- All fields after date are optional (use `-` to skip): `2026-02-09 85.2 - - - -` (weight only)
- Bot confirms with parsed values
- Bot warns if values seem unusual (e.g., weight < 50 or > 150, calories > 5000)

### 5.4 Alerts (Sent proactively via Telegram)

| Alert | Trigger | Timing |
|-------|---------|--------|
| 🔴 HRV Drop | HRV drops >15% vs 7-day average | Morning cron (10am) |
| 🔴 Sleep Score Drop | Sleep score < 60 | Morning cron (10am) |
| 🟡 No Nutrition Logged | No nutrition data for 2+ consecutive days | Evening cron (6pm) |
| 🟡 Weight Spike | Weight change > 1.5kg in 24h | Morning cron (10am) |
| 📊 Weekly Digest | AI-powered weekly summary | Sunday 10am |

---

## 6. AI Weekly Summary (Claude API)

### Trigger
Every Sunday at 10:00 AM Bulgarian time, automatically via cron. Also triggerable on-demand via `/summary` Telegram command.

### Input to Claude
Send Claude the following context:
- Last 7 days of Daily Log data (all columns)
- Last 30 days of Daily Log data (all columns)
- Current macro/calorie targets from Goals tab
- Previous week's Weekly Summary row (for comparison)
- Previous 4 weeks of Weekly Summary rows (for trends)

### Prompt Template
```
You are a concise health analyst. Analyze the following health data and provide:

1. **This Week (7-day):** Key highlights — what went well, what needs attention. Compare actuals vs targets.
2. **Monthly Trend (30-day):** Are things improving, declining, or stable? Focus on weight trend, sleep quality, and nutrition compliance.
3. **Correlations:** Any patterns you notice (e.g., sleep quality vs nutrition, HRV vs activity).
4. **Action Items:** 2-3 specific, actionable recommendations for next week.

Keep it under 300 words. Be direct, no fluff. Use bullet points sparingly — prefer short sentences.

Data:
{data}

Targets:
{targets}

Previous week summary:
{prev_week}
```

### Output
- Sent as a Telegram message
- Also stored in a new tab "AI Summaries" in the Google Sheet with columns: `Date | Summary_Text | Week_Number`

---

## 7. Web Dashboard

### Tech Stack
- **Framework:** Next.js (React) — deployed on Railway
- **Styling:** Tailwind CSS
- **Charts:** Recharts or Chart.js
- **Data Source:** Google Sheets API (read-only for dashboard)

### Views

#### 7.1 Today View (Default/Home)
- At-a-glance status card showing:
  - Sleep Score, Readiness Score, Activity Score (color-coded: green ≥80, yellow 60-79, red <60)
  - Weight (actual vs trend)
  - Macros logged (protein/carbs/fats bars vs targets)
  - Calories (actual vs target)
  - Steps count
- Status indicator: "✅ All data logged" or "⚠️ Missing: Nutrition"

#### 7.2 Weekly View
- Bar/line charts for the current week:
  - Weight trend line
  - Macro bars vs target lines
  - Sleep score trend
  - Readiness score trend
  - Steps daily bars
- Compliance percentage: "You logged nutrition 5/7 days this week"
- Comparison vs previous week (arrows up/down with percentages)

#### 7.3 Trends View (Filterable)
- Date range selector (this week, last 4 weeks, last 3 months, custom)
- Line charts:
  - Weight + Trend Weight (dual line)
  - Average weekly sleep score
  - Average weekly readiness
  - Average weekly calories vs target
  - HRV trend
- Week-over-week comparison table

#### 7.4 AI Insights
- Latest AI summary displayed
- Historical summaries browsable by week

### Mobile-First
The dashboard must be fully responsive and optimized for phone viewing. Cards should stack vertically on mobile.

---

## 8. Cron Schedule

**Timezone:** Europe/Sofia (EET/EEST, UTC+2/+3)

| Time | Job | Description |
|------|-----|-------------|
| 10:00 | `sync_oura` | Pull last 7 days of Oura data, upsert to Google Sheet |
| 10:05 | `check_alerts` | Run alert checks, send Telegram notifications if triggered |
| 10:10 | `update_weekly_summary` | Recalculate Weekly Summary tab |
| 18:00 | `sync_oura` | Pull last 7 days of Oura data (catch afternoon updates) |
| 18:05 | `check_alerts` | Check for missing nutrition (2+ days) |
| 00:00 | `sync_oura` | Pull last 7 days (final daily sync) |
| 00:05 | `update_weekly_summary` | Final weekly summary update |
| Sun 10:00 | `ai_weekly_summary` | Generate and send Claude AI weekly summary |

---

## 9. Logging & Error Handling

### Execution Log
Every cron run and every Telegram bot action must be logged to a file `execution.log` with:
```
[2026-02-09 10:00:01] [CRON] [sync_oura] START
[2026-02-09 10:00:03] [CRON] [sync_oura] SUCCESS — Updated 7 days (Feb 3-9), 7 Oura records written
[2026-02-09 10:00:03] [CRON] [check_alerts] START
[2026-02-09 10:00:04] [CRON] [check_alerts] ALERT SENT — HRV Drop: 15→12 (-20%)
[2026-02-09 18:05:00] [TELEGRAM] [file_upload] Received MacroFactor export from user
[2026-02-09 18:05:02] [TELEGRAM] [file_upload] SUCCESS — Parsed 7 days, upserted 5 nutrition + 3 weight
[2026-02-09 18:05:03] [TELEGRAM] [file_upload] ERROR — Failed to write to Google Sheets: 403 Forbidden
```

### Error Handling
- **Oura API down:** Log error, retry once after 60 seconds, skip if still failing. Alert via Telegram: "⚠️ Oura sync failed — API unreachable"
- **Google Sheets API error:** Log error, retry with exponential backoff (3 attempts). Alert via Telegram if all retries fail.
- **MacroFactor file parse error:** Reply to user in Telegram with specific error: "❌ Could not parse file. Expected 'Quick Export' or 'Calories & Macros' sheet, found: 'Sheet1'"
- **Claude API error:** Log error, reply in Telegram: "⚠️ AI summary generation failed. Will retry in 1 hour."

### Log Rotation
- Keep last 30 days of logs
- On Railway, logs are also available in Railway dashboard

---

## 10. Project Structure

```
health-dashboard/
├── PROJECT_SCOPE.md          ← This file (keep updated with ALL changes)
├── CHANGELOG.md              ← Log of all changes made during development
├── .cursorrules              ← Development rules for Cursor (copy from CURSOR_RULES.md)
├── .env                      ← Environment variables (NEVER commit)
├── .env.example              ← Template without real values (safe to commit)
├── .gitignore                ← Must include: .env, service-account.json
├── service-account.json      ← Google Cloud key (NEVER commit)
│
├── assets/
│   ├── logo.png              ← Brand logo (teal globe icon)
│   └── brand-colors.png      ← Brand color palette reference
│
├── backend/
│   ├── main.py                  ← Entry point, CLI for running jobs manually
│   ├── config.py                ← Load env vars, constants, timezone config
│   ├── scheduler.py             ← Cron job definitions and scheduler setup
│   │
│   ├── clients/
│   │   ├── oura_client.py       ← Oura Ring API integration
│   │   ├── sheets_client.py     ← Google Sheets read/write operations
│   │   ├── claude_client.py     ← Claude API for AI summaries
│   │   └── telegram_bot.py      ← Telegram bot (commands, file handling, alerts)
│   │
│   ├── parsers/
│   │   └── macrofactor_parser.py ← Parse all 3 MacroFactor export formats
│   │
│   ├── services/
│   │   ├── sync_service.py      ← Orchestrates Oura sync + upsert logic
│   │   ├── nutrition_service.py ← Handles MacroFactor import + manual input
│   │   ├── summary_service.py   ← Weekly summary calculation + AI summary generation
│   │   └── alert_service.py     ← Alert rule evaluation + notification sending
│   │
│   ├── utils/
│   │   ├── logger.py            ← Structured logging setup
│   │   └── date_utils.py        ← Timezone handling, week calculations
│   │
│   ├── requirements.txt
│   └── Dockerfile
│
├── dashboard/
│   ├── package.json
│   ├── next.config.js
│   ├── tailwind.config.js
│   ├── Dockerfile
│   │
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx         ← Today view (default)
│   │   │   ├── weekly/
│   │   │   │   └── page.tsx     ← Weekly view
│   │   │   ├── trends/
│   │   │   │   └── page.tsx     ← Trends view (filterable)
│   │   │   └── insights/
│   │   │       └── page.tsx     ← AI insights view
│   │   │
│   │   ├── components/
│   │   │   ├── StatusCard.tsx
│   │   │   ├── MacroBar.tsx
│   │   │   ├── ScoreGauge.tsx
│   │   │   ├── WeightChart.tsx
│   │   │   ├── SleepChart.tsx
│   │   │   ├── ComplianceBadge.tsx
│   │   │   └── WeekSelector.tsx
│   │   │
│   │   └── lib/
│   │       ├── sheets.ts        ← Google Sheets API client (read-only)
│   │       └── types.ts         ← TypeScript interfaces for all data
│   │
│   └── public/
│
├── railway.toml                 ← Railway deployment config (2 services)
├── docker-compose.yml           ← Local development
└── .env.example
```

---

## 11. Development Order (Recommended)

Build in this sequence so each step is independently testable:

### Phase 1: Core Data Pipeline ✅ COMPLETE (2026-02-09)
1. ✅ **Google Sheets setup** — 4 tabs created (Daily Log, Weekly Summary, Goals, AI Summaries) with all headers
2. ✅ **Oura client** — Fetches from 5 endpoints, extracts 11 fields/day, handles multiple sleep sessions
3. ✅ **Sync service** — Upserts Oura data with bulletproof merge logic, idempotent, source-isolated
4. ✅ **MacroFactor parser** — Handles all 3 formats (Quick Export, Detailed Export, Program Settings)
5. ✅ **Nutrition service** — Upserts MacroFactor data + manual text input to Google Sheet

### Phase 2: Telegram Bot ✅ COMPLETE (2026-02-09)
6. ✅ **Basic bot** — `/start`, `/help`, `/status`, `/today`, `/week`, `/goals`, `/summary` (stub)
7. ✅ **File upload handling** — Receive xlsx, detect format, parse, upsert, cleanup temp file
8. ✅ **Manual text input** — Parse `YYYY-MM-DD weight protein carbs fats calories`, confirm, upsert
9. ✅ **Goals management** — Parse Program Settings, update Goals tab via file upload
- ✅ **Nap tracking** — Added Nap_Minutes column (W), calculated from non-primary sleep sessions
- ✅ **Security** — Only TELEGRAM_USER_ID can interact; all others get "⛔ Unauthorized"

### Phase 3: Automation & Intelligence ✅ COMPLETE (2026-02-09)
10. ✅ **Scheduler** — APScheduler with AsyncIOScheduler in same process as bot. Jobs: 10:00, 18:00, 00:00 sync + Sun 10:00 AI summary. 5s delay between sequential jobs.
11. ✅ **Alert service** — HRV drop (<85% of 7-day avg), sleep drop (<60), missing nutrition (2+ days), weight spike (>1.5kg). File-based deduplication.
12. ✅ **Weekly summary calculation** — Calculates all averages, compliance %, weight change vs prev week. Upserts to Weekly Summary tab.
13. ✅ **AI summary** — Claude API integration via `claude_client.py`. `/summary` command works. Sunday auto-send scheduled. Stored in AI Summaries tab.

### Phase 4: Dashboard ✅ COMPLETE (2026-02-09)
14. ✅ **Next.js scaffold** — App Router, Tailwind with Cold Labs brand colors, Google Sheets API via REST, 60s revalidation
15. ✅ **Today view** — Score cards (sleep/readiness/activity with color coding), sleep detail, body metrics, macro progress bars vs targets, status badge
16. ✅ **Weekly view** — Week selector (prev/next), average scores, compliance badge, weight/sleep/steps/calories charts (Recharts), week averages table
17. ✅ **Trends view** — Date range selector (1w/4w/3m/all), weight trend, health scores, HRV/RHR, calories vs TDEE, week-over-week comparison table
18. ✅ **AI Insights view** — Expandable accordion of AI summaries, markdown-like formatting with bold highlights

### Phase 5: Polish & Deploy ✅ COMPLETE (2026-02-09)
19. ✅ **Dockerfiles** — Backend (Python 3.11-slim), Dashboard (Node 20-alpine standalone output)
20. ✅ **Railway config** — `railway.toml` with deployment notes, environment variable list
21. ✅ **Git & GitHub** — Initialized repo, pushed to private GitHub repo, .gitignore protects secrets
22. ✅ **Railway deployment** — Two services configured (backend + dashboard), env vars set
23. ✅ **Dashboard auth** — `sheets.ts` supports `GOOGLE_SERVICE_ACCOUNT_JSON` env var (full JSON) for Railway

---

## 12. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hosting | Railway | Already purchased, always-on for bot + cron, no laptop dependency |
| Backend language | Python | Best library support for Oura API, Google Sheets, Telegram bots |
| Dashboard framework | Next.js | Fast, mobile-friendly, easy Railway deploy |
| Data store | Google Sheets | Human-readable, already set up, easy to inspect/debug |
| Telegram bot library | python-telegram-bot | Most maintained, async support |
| Scheduler | APScheduler | In-process cron, simpler than system cron on Railway |
| Charts | Recharts | Native React, responsive, good mobile support |
| AI provider | Claude (Anthropic) | Alexander's preference, high-quality analysis |

## 12.1 Brand Design

### Color Palette
```
--color-bg-darkest: #061A19      (darkest background)
--color-bg-dark: #0D3B3B         (dark background, cards)
--color-primary: #106A6A         (primary teal)
--color-primary-dark: #184E4E    (darker teal, hover states)
--color-accent: #08DEDE          (bright cyan — accent, highlights, CTAs)
--color-muted: #9EB6B6           (muted text, secondary info)
--color-text: #F5F7F6            (primary text on dark backgrounds)
--color-white: #FFFFFF           (white for emphasis)
```

### Design Principles
- Dark theme (dark teal backgrounds, light text)
- Mobile-first — primary device is phone
- Clean, minimal — every element must serve a purpose
- Accent cyan (#08DEDE) used sparingly for important numbers
- Health score color coding: green (≥80), yellow (60-79), red (<60)
- Logo: `assets/logo.png` displayed in dashboard header

---

## 13. Non-Functional Requirements

- **Latency:** Telegram bot should respond to file uploads within 10 seconds
- **Reliability:** If Oura API is down, don't lose existing data. Retry logic for all external APIs.
- **Idempotency:** All sync operations are safe to run multiple times
- **Timezone:** All dates in Europe/Sofia (EET). Store as YYYY-MM-DD strings.
- **Security:** API keys in environment variables only, never committed to repo
- **Logging:** Every execution logged with timestamp, action, result, and error details if applicable

---

## IMPORTANT: Keep This File Updated

**Cursor must update this file whenever:**
- A feature is added, changed, or removed
- A technical decision changes
- The schema is modified
- A new dependency is added
- Any behavior deviates from what's documented here

This file is the single source of truth for what the project does and how it works.
