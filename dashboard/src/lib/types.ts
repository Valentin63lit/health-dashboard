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

/** Score color: green ≥80, yellow 60-79, red <60 */
export function scoreColor(score: number | null): 'green' | 'yellow' | 'red' | 'muted' {
  if (score === null) return 'muted';
  if (score >= 80) return 'green';
  if (score >= 60) return 'yellow';
  return 'red';
}

export function scoreColorClass(score: number | null): string {
  const color = scoreColor(score);
  switch (color) {
    case 'green': return 'text-score-green';
    case 'yellow': return 'text-score-yellow';
    case 'red': return 'text-score-red';
    default: return 'text-brand-muted';
  }
}
