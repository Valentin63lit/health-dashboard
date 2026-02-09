'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Moon, Zap, Footprints, Flame, Activity, Heart, Timer, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { DailyLog, WeeklySummary, fmtNum, avg, scoreHex } from '@/lib/types';
import { ScoreRing } from '@/components/ScoreRing';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonPage } from '@/components/SkeletonCard';
import { InfoTooltip } from '@/components/InfoTooltip';
import { WeightChart, StepsChart } from '@/components/Charts';

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

  // Computed averages
  const avgSleepHrs = weekSummary?.Avg_Sleep_Hours ?? avg(weekLogs, 'Total_Sleep_Hours', 1);
  const avgReadiness = weekSummary?.Avg_Readiness_Score ?? avg(weekLogs, 'Readiness_Score');
  const avgSteps = weekSummary?.Avg_Steps ?? avg(weekLogs, 'Steps');
  const avgCalories = weekSummary?.Avg_Calories ?? avg(weekLogs, 'Calories');
  const avgProtein = weekSummary?.Avg_Protein_g ?? avg(weekLogs, 'Protein_g');
  const avgCarbs = weekSummary?.Avg_Carbs_g ?? avg(weekLogs, 'Carbs_g');
  const avgFats = weekSummary?.Avg_Fats_g ?? avg(weekLogs, 'Fats_g');
  const avgHRV = weekSummary?.Avg_HRV_Balance ?? avg(weekLogs, 'HRV_Balance');
  const avgRHR = weekSummary?.Avg_Resting_HR ?? avg(weekLogs, 'Resting_Heart_Rate');
  const avgNap = weekSummary?.Avg_Nap_Minutes ?? avg(weekLogs, 'Nap_Minutes');

  // Nap stats
  const napDays = weekLogs.filter((d) => d.Nap_Minutes !== null && d.Nap_Minutes > 0).length;

  // Chart data
  const dayLabel = (d: DailyLog) =>
    new Date(d.Date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });

  const weightData = weekLogs.map((d) => ({
    label: dayLabel(d),
    weight: d.Weight_kg,
    trend: d.Trend_Weight_kg,
  }));

  const sleepData = weekLogs.map((d) => {
    const deep = d.Deep_Sleep_Minutes !== null ? d.Deep_Sleep_Minutes / 60 : 0;
    const rem = d.REM_Sleep_Minutes !== null ? d.REM_Sleep_Minutes / 60 : 0;
    const totalH = d.Total_Sleep_Hours ?? 0;
    const light = Math.max(0, totalH - deep - rem);
    return { label: dayLabel(d), deep: +deep.toFixed(1), rem: +rem.toFixed(1), light: +light.toFixed(1) };
  });

  const macroData = weekLogs.map((d) => ({
    label: dayLabel(d),
    calories: d.Calories,
    protein: d.Protein_g,
    carbs: d.Carbs_g,
    fats: d.Fats_g,
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
          {/* Summary Cards Grid */}
          <div className="grid grid-cols-3 gap-2">
            <MiniCard icon={Moon} label="Avg Sleep" value={avgSleepHrs !== null ? `${avgSleepHrs}h` : '—'} />
            <MiniCardRing label="Readiness" score={avgReadiness} />
            <MiniCard icon={Footprints} label="Avg Steps" value={avgSteps !== null ? fmtNum(Math.round(avgSteps)) : '—'} />
            <MiniCard icon={Flame} label="Avg Cal" value={avgCalories !== null ? fmtNum(Math.round(avgCalories)) : '—'}>
              {avgProtein !== null && (
                <p className="text-[10px] text-brand-muted tnum mt-0.5">
                  {Math.round(avgProtein)}P · {Math.round(avgCarbs ?? 0)}C · {Math.round(avgFats ?? 0)}F
                </p>
              )}
            </MiniCard>
            <MiniCard icon={Activity} label="Avg HRV" value={avgHRV !== null ? String(Math.round(avgHRV)) : '—'} tooltip="Higher = better recovery" />
            <MiniCard icon={Heart} label="Avg RHR" value={avgRHR !== null ? `${Math.round(avgRHR)}` : '—'} tooltip="Lower = better fitness" />
          </div>

          {/* Nap Stats */}
          {napDays > 0 && (
            <div className="bg-brand-dark border border-brand-border rounded-xl px-4 py-3 flex items-center gap-3">
              <Timer size={18} className="text-brand-muted" />
              <div className="flex-1">
                <span className="text-sm text-brand-text">{napDays} of 7 days with naps</span>
                {avgNap !== null && avgNap > 0 && (
                  <span className="text-sm text-brand-muted ml-2 tnum">{Math.round(avgNap)}min avg</span>
                )}
              </div>
            </div>
          )}

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
          <WeightChart data={weightData} info="Focus on the trend over weeks, not daily fluctuations. 0.5-1kg/week loss or gain is sustainable." />
          <SleepBreakdownChart data={sleepData} />
          <MacroChart data={macroData} />
          <StepsChart data={stepsData} />

          {/* AI Insights link */}
          <Link
            href="/insights"
            className="flex items-center justify-center gap-2 py-3 bg-brand-dark border border-brand-border rounded-xl text-sm font-medium text-brand-accent hover:bg-brand-border/30 transition-colors"
          >
            <Sparkles size={16} />
            View AI Summary
          </Link>
        </div>
      )}
    </div>
  );
}

// ─── Mini Card Components ──────────────────────────────────────

function MiniCard({
  icon: Icon,
  label,
  value,
  tooltip,
  children,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;
  label: string;
  value: string;
  tooltip?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bg-brand-dark border border-brand-border rounded-xl p-3 card-hover">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon size={14} className="text-brand-muted" />
        <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} />}
      </div>
      <p className="text-lg font-bold text-brand-text tnum">{value}</p>
      {children}
    </div>
  );
}

function MiniCardRing({ label, score }: { label: string; score: number | null }) {
  return (
    <div className="bg-brand-dark border border-brand-border rounded-xl p-3 card-hover flex flex-col items-center">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-brand-muted mb-1.5">{label}</span>
      <ScoreRing score={score} label="" size={48} />
    </div>
  );
}

// ─── Inline Chart Components (sleep breakdown, macros) ────────

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
  Legend,
} from 'recharts';

const tooltipStyle = {
  backgroundColor: '#0D2626',
  border: '1px solid #1A3A3A',
  borderRadius: 8,
  fontSize: 12,
  color: '#F5F7F6',
};

function SleepBreakdownChart({ data }: { data: Array<{ label: string; deep: number; rem: number; light: number }> }) {
  return (
    <div className="bg-brand-dark border border-brand-border rounded-xl p-4 card-hover">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Sleep Breakdown</h3>
        <InfoTooltip text="Adults need 7-9h. Aim for 1.5-2h deep sleep and 1.5-2h REM. Higher efficiency (>85%) means less time awake in bed." />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fill: '#8A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#8A9A9A', fontSize: 10 }} width={25} axisLine={false} tickLine={false} unit="h" />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#F5F7F6' }} formatter={(v: number) => `${v}h`} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#8A9A9A' }} iconType="circle" iconSize={8} />
          <Bar dataKey="deep" stackId="sleep" fill="#0CB4B4" name="Deep" />
          <Bar dataKey="rem" stackId="sleep" fill="#08DEDE" name="REM" />
          <Bar dataKey="light" stackId="sleep" fill="#5A9A9A" radius={[4, 4, 0, 0]} name="Light" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function MacroChart({ data }: { data: Array<{ label: string; calories: number | null; protein: number | null; carbs: number | null; fats: number | null }> }) {
  return (
    <div className="bg-brand-dark border border-brand-border rounded-xl p-4 card-hover">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">Calories & Macros</h3>
        <InfoTooltip text="Compare against your MacroFactor targets. Consistency matters more than perfection." />
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fill: '#8A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: '#8A9A9A', fontSize: 10 }} width={40} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#F5F7F6' }} />
          <Legend wrapperStyle={{ fontSize: 11, color: '#8A9A9A' }} iconType="circle" iconSize={8} />
          <Bar dataKey="protein" stackId="macros" fill="#08DEDE" name="Protein" />
          <Bar dataKey="carbs" stackId="macros" fill="#10B981" name="Carbs" />
          <Bar dataKey="fats" stackId="macros" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Fats" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
