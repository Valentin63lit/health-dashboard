/** TypeScript interfaces for all health dashboard data */

export interface DailyLog {
  Date: string;
  Weight_kg: number | null;
  Trend_Weight_kg: number | null;
  Fat_Percent: number | null;
  Protein_g: number | null;
  Carbs_g: number | null;
  Fats_g: number | null;
  Calories: number | null;
  Expenditure: number | null;
  Steps: number | null;
  Total_Sleep_Hours: number | null;
  Sleep_Score: number | null;
  Deep_Sleep_Minutes: number | null;
  REM_Sleep_Minutes: number | null;
  Sleep_Efficiency: number | null;
  Readiness_Score: number | null;
  Temperature_Deviation: number | null;
  HRV_Balance: number | null;
  Resting_Heart_Rate: number | null;
  Activity_Score: number | null;
  Nutrition_Logged: string;
  Data_Complete: string;
  Nap_Minutes: number | null;
}

export interface WeeklySummary {
  Week_Start: string;
  Week_End: string;
  Week_Number: number;
  Avg_Weight_kg: number | null;
  Avg_Trend_Weight_kg: number | null;
  Avg_Protein_g: number | null;
  Avg_Carbs_g: number | null;
  Avg_Fats_g: number | null;
  Avg_Calories: number | null;
  Avg_Steps: number | null;
  Avg_Sleep_Hours: number | null;
  Avg_Sleep_Score: number | null;
  Avg_Deep_Sleep_Min: number | null;
  Avg_REM_Sleep_Min: number | null;
  Avg_Readiness_Score: number | null;
  Avg_HRV_Balance: number | null;
  Avg_Resting_HR: number | null;
  Avg_Activity_Score: number | null;
  Avg_Nap_Minutes: number | null;
  Days_Logged_Nutrition: number;
  Days_Logged_Total: number;
  Weight_Change_kg: number | null;
  Compliance_Pct: number;
}

export interface Goal {
  Weekday: string;
  Target_Calories: number | null;
  Target_Protein_g: number | null;
  Target_Carbs_g: number | null;
  Target_Fats_g: number | null;
  Target_Weight_kg: number | null;
  Last_Updated: string;
}

export interface AISummary {
  Date: string;
  Summary_Text: string;
  Week_Number: number;
}

/** Utility: parse a possibly-empty value to number or null */
export function toNum(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

/** Format number with commas: 8432 → "8,432" */
export function fmtNum(val: number | null, decimals: number = 0): string {
  if (val === null) return '—';
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format percentage with one decimal */
export function fmtPct(val: number | null): string {
  if (val === null) return '—';
  return `${val.toFixed(1)}%`;
}

/** Score color hex by value */
export function scoreHex(score: number | null): string {
  if (score === null) return '#8A9A9A';
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

/** Score color tailwind class */
export function scoreColorClass(score: number | null): string {
  if (score === null) return 'text-brand-muted';
  if (score >= 80) return 'text-score-green';
  if (score >= 60) return 'text-score-yellow';
  return 'text-score-red';
}

/** Average of non-null values in an array */
export function avg(logs: DailyLog[], field: keyof DailyLog, decimals: number = 0): number | null {
  const vals = logs
    .map((d) => d[field] as number | null)
    .filter((v): v is number => v !== null && v !== 0);
  if (vals.length === 0) return null;
  const result = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Number(result.toFixed(decimals));
}
