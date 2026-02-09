/**
 * Google Sheets API client — read-only for dashboard.
 * Fetches data from the Health Tracking spreadsheet.
 * Runs on the server (Next.js Server Components / Route Handlers).
 *
 * Supports two auth methods:
 * 1. GOOGLE_SERVICE_ACCOUNT_JSON — Full JSON content of service-account.json (Railway)
 * 2. GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_SERVICE_ACCOUNT_KEY — Individual fields (legacy)
 */

import { DailyLog, WeeklySummary, Goal, AISummary, toNum } from './types';

const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

/** Tab names matching backend config */
const TABS = {
  dailyLog: 'Daily Log',
  weeklySummary: 'Weekly Summary',
  goals: 'Goals',
  aiSummaries: 'AI Summaries',
} as const;

// ─── Auth helpers ──────────────────────────────────────────────

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
}

function getServiceAccountCreds(): ServiceAccountCreds {
  // Method 1: Full JSON in a single env var (Railway deployment)
  const fullJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (fullJson) {
    try {
      const parsed = JSON.parse(fullJson);
      return {
        client_email: parsed.client_email,
        private_key: parsed.private_key,
      };
    } catch (e) {
      throw new Error('Failed to parse GOOGLE_SERVICE_ACCOUNT_JSON: ' + (e as Error).message);
    }
  }

  // Method 2: Individual env vars (legacy/local dev)
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (email && key) {
    return { client_email: email, private_key: key };
  }

  throw new Error(
    'Missing Google credentials. Set GOOGLE_SERVICE_ACCOUNT_JSON or both GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY'
  );
}

// ─── Simple Sheets API fetch (no heavy SDK, just REST) ──────────

async function getAccessToken(): Promise<string> {
  const creds = getServiceAccountCreds();

  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    credentials: {
      client_email: creds.client_email,
      private_key: creds.private_key.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const client = await auth.getClient();
  const token = await client.getAccessToken();
  return token.token || '';
}

async function fetchSheetData(tabName: string): Promise<string[][]> {
  const encodedTab = encodeURIComponent(tabName);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${encodedTab}`;

  const token = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };

  const res = await fetch(url, {
    headers,
    next: { revalidate: 60 }, // Cache for 60 seconds
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.values || [];
}

function rowsToObjects<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] || '';
    });
    return obj as unknown as T;
  });
}

// ─── Public API ─────────────────────────────────────────────────

export async function getDailyLogs(): Promise<DailyLog[]> {
  const rows = await fetchSheetData(TABS.dailyLog);
  const raw = rowsToObjects<Record<string, string>>(rows);

  return raw.map((r) => ({
    Date: r.Date || '',
    Weight_kg: toNum(r.Weight_kg),
    Trend_Weight_kg: toNum(r.Trend_Weight_kg),
    Fat_Percent: toNum(r.Fat_Percent),
    Protein_g: toNum(r.Protein_g),
    Carbs_g: toNum(r.Carbs_g),
    Fats_g: toNum(r.Fats_g),
    Calories: toNum(r.Calories),
    Expenditure: toNum(r.Expenditure),
    Steps: toNum(r.Steps),
    Total_Sleep_Hours: toNum(r.Total_Sleep_Hours),
    Sleep_Score: toNum(r.Sleep_Score),
    Deep_Sleep_Minutes: toNum(r.Deep_Sleep_Minutes),
    REM_Sleep_Minutes: toNum(r.REM_Sleep_Minutes),
    Sleep_Efficiency: toNum(r.Sleep_Efficiency),
    Readiness_Score: toNum(r.Readiness_Score),
    Temperature_Deviation: toNum(r.Temperature_Deviation),
    HRV_Balance: toNum(r.HRV_Balance),
    Resting_Heart_Rate: toNum(r.Resting_Heart_Rate),
    Activity_Score: toNum(r.Activity_Score),
    Nutrition_Logged: r.Nutrition_Logged || 'FALSE',
    Data_Complete: r.Data_Complete || 'FALSE',
    Nap_Minutes: toNum(r.Nap_Minutes),
  }));
}

export async function getWeeklySummaries(): Promise<WeeklySummary[]> {
  const rows = await fetchSheetData(TABS.weeklySummary);
  const raw = rowsToObjects<Record<string, string>>(rows);

  return raw.map((r) => ({
    Week_Start: r.Week_Start || '',
    Week_End: r.Week_End || '',
    Week_Number: Number(r.Week_Number) || 0,
    Avg_Weight_kg: toNum(r.Avg_Weight_kg),
    Avg_Trend_Weight_kg: toNum(r.Avg_Trend_Weight_kg),
    Avg_Protein_g: toNum(r.Avg_Protein_g),
    Avg_Carbs_g: toNum(r.Avg_Carbs_g),
    Avg_Fats_g: toNum(r.Avg_Fats_g),
    Avg_Calories: toNum(r.Avg_Calories),
    Avg_Steps: toNum(r.Avg_Steps),
    Avg_Sleep_Hours: toNum(r.Avg_Sleep_Hours),
    Avg_Sleep_Score: toNum(r.Avg_Sleep_Score),
    Avg_Deep_Sleep_Min: toNum(r.Avg_Deep_Sleep_Min),
    Avg_REM_Sleep_Min: toNum(r.Avg_REM_Sleep_Min),
    Avg_Readiness_Score: toNum(r.Avg_Readiness_Score),
    Avg_HRV_Balance: toNum(r.Avg_HRV_Balance),
    Avg_Resting_HR: toNum(r.Avg_Resting_HR),
    Avg_Activity_Score: toNum(r.Avg_Activity_Score),
    Avg_Nap_Minutes: toNum(r.Avg_Nap_Minutes),
    Days_Logged_Nutrition: Number(r.Days_Logged_Nutrition) || 0,
    Days_Logged_Total: Number(r.Days_Logged_Total) || 0,
    Weight_Change_kg: toNum(r.Weight_Change_kg),
    Compliance_Pct: Number(r.Compliance_Pct) || 0,
  }));
}

export async function getGoals(): Promise<Goal[]> {
  const rows = await fetchSheetData(TABS.goals);
  const raw = rowsToObjects<Record<string, string>>(rows);

  return raw.map((r) => ({
    Weekday: r.Weekday || '',
    Target_Calories: toNum(r.Target_Calories),
    Target_Protein_g: toNum(r.Target_Protein_g),
    Target_Carbs_g: toNum(r.Target_Carbs_g),
    Target_Fats_g: toNum(r.Target_Fats_g),
    Target_Weight_kg: toNum(r.Target_Weight_kg),
    Last_Updated: r.Last_Updated || '',
  }));
}

export async function getAISummaries(): Promise<AISummary[]> {
  const rows = await fetchSheetData(TABS.aiSummaries);
  const raw = rowsToObjects<Record<string, string>>(rows);

  return raw.map((r) => ({
    Date: r.Date || '',
    Summary_Text: r.Summary_Text || '',
    Week_Number: Number(r.Week_Number) || 0,
  }));
}

/** Get today's date in YYYY-MM-DD (server TZ, or approximate) */
export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

/** Get this week's Monday as YYYY-MM-DD */
export function getThisMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
}
