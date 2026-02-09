'use client';

import { useEffect, useState } from 'react';
import { DailyLog, WeeklySummary, scoreColorClass } from '@/lib/types';
import { WeekSelector } from '@/components/WeekSelector';
import { ScoreCard } from '@/components/ScoreCard';
import { ComplianceBadge } from '@/components/ComplianceBadge';
import { WeightChart, ScoreChart, MetricBarChart } from '@/components/Charts';

interface WeekData {
  dailyLogs: DailyLog[];
  weeklySummaries: WeeklySummary[];
}

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export default function WeeklyPage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const thisMonday = getMonday(today);
  const currentMonday = addDays(thisMonday, weekOffset * 7);
  const currentSunday = addDays(currentMonday, 6);
  const canGoNext = weekOffset < 0;

  const mondayStr = formatDate(currentMonday);
  const sundayStr = formatDate(currentSunday);
  const rangeLabel = `${currentMonday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${currentSunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/data?start=${mondayStr}&end=${sundayStr}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [mondayStr, sundayStr]);

  const weekLogs = data?.dailyLogs?.filter(
    (d) => d.Date >= mondayStr && d.Date <= sundayStr
  ) || [];

  const weekSummary = data?.weeklySummaries?.find(
    (s) => s.Week_Start === mondayStr
  );

  // Chart data
  const chartData = weekLogs.map((d) => ({
    label: new Date(d.Date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' }),
    weight: d.Weight_kg,
    trend: d.Trend_Weight_kg,
    sleepScore: d.Sleep_Score,
    readinessScore: d.Readiness_Score,
    steps: d.Steps,
    calories: d.Calories,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-brand-white">Weekly</h1>

      <WeekSelector
        currentRange={rangeLabel}
        onPrev={() => setWeekOffset((o) => o - 1)}
        onNext={() => setWeekOffset((o) => o + 1)}
        canGoNext={canGoNext}
      />

      {loading ? (
        <div className="bg-brand-dark rounded-xl p-8 text-center">
          <p className="text-brand-muted text-sm animate-pulse">Loading...</p>
        </div>
      ) : weekLogs.length === 0 ? (
        <div className="bg-brand-dark rounded-xl p-8 text-center">
          <p className="text-brand-muted text-sm">No data for this week</p>
        </div>
      ) : (
        <>
          {/* Average Scores */}
          <div className="grid grid-cols-3 gap-3">
            <ScoreCard label="Sleep" value={weekSummary?.Avg_Sleep_Score ?? avg(weekLogs, 'Sleep_Score')} icon="😴" />
            <ScoreCard label="Readiness" value={weekSummary?.Avg_Readiness_Score ?? avg(weekLogs, 'Readiness_Score')} icon="⚡" />
            <ScoreCard label="Activity" value={weekSummary?.Avg_Activity_Score ?? avg(weekLogs, 'Activity_Score')} icon="🏃" />
          </div>

          {/* Compliance */}
          <ComplianceBadge
            nutritionDays={weekSummary?.Days_Logged_Nutrition ?? weekLogs.filter((d) => d.Nutrition_Logged === 'TRUE').length}
            totalDays={7}
          />

          {/* Weight Change */}
          {weekSummary?.Weight_Change_kg !== null && weekSummary?.Weight_Change_kg !== undefined && (
            <div className="bg-brand-dark rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm text-brand-muted">Week weight change</span>
              <span className={`text-lg font-bold ${Number(weekSummary.Weight_Change_kg) > 0 ? 'text-score-red' : 'text-score-green'}`}>
                {Number(weekSummary.Weight_Change_kg) > 0 ? '+' : ''}{weekSummary.Weight_Change_kg}kg
              </span>
            </div>
          )}

          {/* Charts */}
          <WeightChart data={chartData} />
          <ScoreChart data={chartData} dataKey="sleepScore" title="Sleep Score" color="#08DEDE" />
          <ScoreChart data={chartData} dataKey="readinessScore" title="Readiness Score" color="#22C55E" />
          <MetricBarChart data={chartData} dataKey="steps" title="Daily Steps" color="#106A6A" />
          <MetricBarChart data={chartData} dataKey="calories" title="Calories" color="#08DEDE" />

          {/* Key Stats */}
          <div className="bg-brand-dark rounded-xl p-4">
            <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-2 font-medium">Week Averages</h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
              <StatItem label="Avg Sleep" value={weekSummary?.Avg_Sleep_Hours ?? avg(weekLogs, 'Total_Sleep_Hours', 1)} unit="h" />
              <StatItem label="Avg Steps" value={weekSummary?.Avg_Steps ?? avg(weekLogs, 'Steps')} unit="" />
              <StatItem label="Avg Calories" value={weekSummary?.Avg_Calories ?? avg(weekLogs, 'Calories')} unit="" />
              <StatItem label="Avg Protein" value={weekSummary?.Avg_Protein_g ?? avg(weekLogs, 'Protein_g')} unit="g" />
              <StatItem label="Avg RHR" value={weekSummary?.Avg_Resting_HR ?? avg(weekLogs, 'Resting_Heart_Rate')} unit="bpm" />
              <StatItem label="Avg Nap" value={weekSummary?.Avg_Nap_Minutes ?? avg(weekLogs, 'Nap_Minutes')} unit="min" />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatItem({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-brand-muted">{label}</span>
      <span className="text-brand-text font-medium">
        {value !== null ? `${typeof value === 'number' ? value.toLocaleString() : value}${unit ? ' ' + unit : ''}` : '—'}
      </span>
    </div>
  );
}

function avg(logs: DailyLog[], field: keyof DailyLog, decimals: number = 0): number | null {
  const vals = logs
    .map((d) => d[field] as number | null)
    .filter((v): v is number => v !== null && v !== 0);
  if (vals.length === 0) return null;
  const result = vals.reduce((a, b) => a + b, 0) / vals.length;
  return Number(result.toFixed(decimals));
}
