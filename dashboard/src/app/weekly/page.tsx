'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DailyLog, WeeklySummary, fmtNum, avg } from '@/lib/types';
import { ScoreRing } from '@/components/ScoreRing';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonPage } from '@/components/SkeletonCard';
import { WeightChart, SleepStackedChart, CaloriesChart, StepsChart } from '@/components/Charts';

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

  // Compliance percentage
  const nutritionDays = weekSummary?.Days_Logged_Nutrition ?? weekLogs.filter((d) => d.Nutrition_Logged === 'TRUE').length;
  const compliancePct = Math.round((nutritionDays / 7) * 100);

  // Chart data
  const dayLabel = (d: DailyLog) =>
    new Date(d.Date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

  const weightData = weekLogs.map((d) => ({
    label: dayLabel(d),
    weight: d.Weight_kg,
    trend: d.Trend_Weight_kg,
  }));

  const sleepData = weekLogs.map((d) => {
    const totalMin = (d.Total_Sleep_Hours ?? 0) * 60;
    const deep = d.Deep_Sleep_Minutes ?? 0;
    const rem = d.REM_Sleep_Minutes ?? 0;
    const light = Math.max(0, totalMin - deep - rem);
    return { label: dayLabel(d), deep, rem, light };
  });

  const caloriesData = weekLogs.map((d) => ({
    label: dayLabel(d),
    calories: d.Calories,
    expenditure: d.Expenditure,
  }));

  const stepsData = weekLogs.map((d) => ({
    label: dayLabel(d),
    steps: d.Steps,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Weekly" />

      {/* Week Selector */}
      <div className="flex items-center justify-between bg-brand-dark border border-brand-border rounded-xl px-2 py-2">
        <button
          onClick={() => setWeekOffset((o) => o - 1)}
          className="p-2 text-brand-muted hover:text-brand-text transition-colors"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="text-sm font-medium text-brand-text">{rangeLabel}</span>
        <button
          onClick={() => canGoNext && setWeekOffset((o) => o + 1)}
          className={`p-2 transition-colors ${canGoNext ? 'text-brand-muted hover:text-brand-text' : 'text-brand-border'}`}
          disabled={!canGoNext}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      {loading ? (
        <SkeletonPage />
      ) : weekLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-brand-muted text-sm">No data for this week</p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {/* Summary Row */}
          <div className="flex justify-center gap-6 py-2">
            <ScoreRing
              score={weekSummary?.Avg_Sleep_Score ?? avg(weekLogs, 'Sleep_Score')}
              label="Avg Sleep"
            />
            <ScoreRing
              score={weekSummary?.Avg_Readiness_Score ?? avg(weekLogs, 'Readiness_Score')}
              label="Avg Readiness"
            />
            {/* Compliance ring */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="relative" style={{ width: 64, height: 64 }}>
                <svg width={64} height={64} viewBox="0 0 64 64" className="-rotate-90">
                  <circle cx={32} cy={32} r={29.5} fill="none" stroke="#1A3A3A" strokeWidth={5} />
                  <circle
                    cx={32} cy={32} r={29.5}
                    fill="none"
                    stroke={compliancePct >= 80 ? '#10B981' : compliancePct >= 50 ? '#F59E0B' : '#EF4444'}
                    strokeWidth={5}
                    strokeDasharray={`${(compliancePct / 100) * 2 * Math.PI * 29.5} ${2 * Math.PI * 29.5}`}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="tnum font-bold text-brand-text" style={{ fontSize: 16 }}>
                    {compliancePct}%
                  </span>
                </div>
              </div>
              <span className="text-xs text-brand-muted">Compliance</span>
            </div>
          </div>

          {/* Weight Change */}
          {weekSummary?.Weight_Change_kg !== null && weekSummary?.Weight_Change_kg !== undefined && (
            <div className="bg-brand-dark border border-brand-border rounded-xl p-4 flex items-center justify-between">
              <span className="text-sm text-brand-muted">Week weight change</span>
              <span
                className="text-lg font-bold tnum"
                style={{
                  color: Number(weekSummary.Weight_Change_kg) > 0 ? '#EF4444' : '#10B981',
                }}
              >
                {Number(weekSummary.Weight_Change_kg) > 0 ? '+' : ''}{Number(weekSummary.Weight_Change_kg).toFixed(1)}kg
              </span>
            </div>
          )}

          {/* Charts */}
          <WeightChart data={weightData} />
          <SleepStackedChart data={sleepData} />
          <CaloriesChart data={caloriesData} />
          <StepsChart data={stepsData} />

          {/* Week Averages */}
          <div className="bg-brand-dark border border-brand-border rounded-xl p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-3">
              Week Averages
            </h3>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <AvgItem label="Avg Sleep" value={weekSummary?.Avg_Sleep_Hours ?? avg(weekLogs, 'Total_Sleep_Hours', 1)} unit="h" />
              <AvgItem label="Avg Steps" value={weekSummary?.Avg_Steps ?? avg(weekLogs, 'Steps')} unit="" />
              <AvgItem label="Avg Calories" value={weekSummary?.Avg_Calories ?? avg(weekLogs, 'Calories')} unit="" />
              <AvgItem label="Avg Protein" value={weekSummary?.Avg_Protein_g ?? avg(weekLogs, 'Protein_g')} unit="g" />
              <AvgItem label="Avg RHR" value={weekSummary?.Avg_Resting_HR ?? avg(weekLogs, 'Resting_Heart_Rate')} unit="bpm" />
              <AvgItem label="Avg Nap" value={weekSummary?.Avg_Nap_Minutes ?? avg(weekLogs, 'Nap_Minutes')} unit="min" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AvgItem({ label, value, unit }: { label: string; value: number | null; unit: string }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-brand-muted">{label}</span>
      <span className="text-brand-text font-medium tnum">
        {value !== null ? `${fmtNum(value)}${unit ? ' ' + unit : ''}` : '—'}
      </span>
    </div>
  );
}
