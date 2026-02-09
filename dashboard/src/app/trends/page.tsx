'use client';

import { useEffect, useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { DailyLog, WeeklySummary, fmtNum } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonPage } from '@/components/SkeletonCard';
import { InfoTooltip } from '@/components/InfoTooltip';
import { WeightTrendArea, TrendsChart } from '@/components/Charts';

type RangeOption = '1W' | '4W' | '3M' | 'All';

const RANGE_DAYS: Record<RangeOption, number> = {
  '1W': 7,
  '4W': 28,
  '3M': 90,
  'All': 9999,
};

function getStartDate(range: RangeOption): string {
  if (range === 'All') return '2020-01-01';
  const d = new Date();
  d.setDate(d.getDate() - RANGE_DAYS[range]);
  return d.toISOString().split('T')[0];
}

const tooltipStyle = {
  backgroundColor: '#0D2626',
  border: '1px solid #1A3A3A',
  borderRadius: 8,
  fontSize: 12,
  color: '#F5F7F6',
};

export default function TrendsPage() {
  const [range, setRange] = useState<RangeOption>('4W');
  const [data, setData] = useState<{ dailyLogs: DailyLog[]; weeklySummaries: WeeklySummary[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const startDate = getStartDate(range);
  const endDate = new Date().toISOString().split('T')[0];

  useEffect(() => {
    setLoading(true);
    fetch(`/api/data?start=${startDate}&end=${endDate}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [startDate, endDate]);

  const logs = data?.dailyLogs?.filter(
    (d) => d.Date >= startDate && d.Date <= endDate
  ) || [];

  const weeklySummaries = data?.weeklySummaries?.sort(
    (a, b) => a.Week_Start.localeCompare(b.Week_Start)
  ) || [];

  const formatLabel = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    if (range === '1W') return d.toLocaleDateString('en-US', { weekday: 'short' });
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const weightData = logs.map((d) => ({
    label: formatLabel(d.Date),
    weight: d.Weight_kg,
    trend: d.Trend_Weight_kg,
  }));

  const macroData = logs.map((d) => ({
    label: formatLabel(d.Date),
    protein: d.Protein_g,
    carbs: d.Carbs_g,
    fats: d.Fats_g,
    calories: d.Calories,
  }));

  const sleepData = logs.map((d) => {
    const deep = d.Deep_Sleep_Minutes !== null ? d.Deep_Sleep_Minutes / 60 : null;
    const rem = d.REM_Sleep_Minutes !== null ? d.REM_Sleep_Minutes / 60 : null;
    const totalH = d.Total_Sleep_Hours;
    const light = totalH !== null && deep !== null && rem !== null
      ? Math.max(0, totalH - deep - rem) : null;
    return {
      label: formatLabel(d.Date),
      total: totalH,
      deep: deep !== null ? +deep.toFixed(1) : null,
      rem: rem !== null ? +rem.toFixed(1) : null,
      light: light !== null ? +light.toFixed(1) : null,
    };
  });

  const scoreData = logs.map((d) => ({
    label: formatLabel(d.Date),
    sleep: d.Sleep_Score,
    readiness: d.Readiness_Score,
    activity: d.Activity_Score,
  }));

  const hrvData = logs.map((d) => ({
    label: formatLabel(d.Date),
    hrv: d.HRV_Balance,
  }));

  const rhrData = logs.map((d) => ({
    label: formatLabel(d.Date),
    rhr: d.Resting_Heart_Rate,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="Trends" />

      {/* Range Pills */}
      <div className="flex gap-1 bg-brand-dark border border-brand-border rounded-xl p-1">
        {(['1W', '4W', '3M', 'All'] as RangeOption[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
              range === r
                ? 'bg-brand-accent text-brand-darkest'
                : 'text-brand-muted hover:text-brand-text'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {loading ? (
        <SkeletonPage />
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-brand-muted text-sm">No data for this period</p>
        </div>
      ) : (
        <div className="space-y-4 animate-fade-in">
          {/* Weight */}
          <WeightTrendArea
            data={weightData}
            info="Focus on the trend over weeks, not daily fluctuations. 0.5-1kg/week loss or gain is sustainable."
          />

          {/* Calories & Macros */}
          <ChartCard title="Calories & Macros" info="Compare against your MacroFactor targets. Consistency matters more than perfection.">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={macroData}>
                <defs>
                  <linearGradient id="protFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#08DEDE" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#08DEDE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="carbFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10B981" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fatFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F59E0B" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#F59E0B" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#8A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A9A9A', fontSize: 10 }} width={35} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#F5F7F6' }} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8A9A9A' }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="protein" stroke="#08DEDE" fill="url(#protFill)" strokeWidth={2} name="Protein" connectNulls />
                <Area type="monotone" dataKey="carbs" stroke="#10B981" fill="url(#carbFill)" strokeWidth={2} name="Carbs" connectNulls />
                <Area type="monotone" dataKey="fats" stroke="#F59E0B" fill="url(#fatFill)" strokeWidth={2} name="Fats" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Sleep Trend */}
          <ChartCard title="Sleep Trend" info="Adults need 7-9h. Aim for 1.5-2h deep sleep and 1.5-2h REM. Higher efficiency (>85%) means less time awake in bed.">
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={sleepData}>
                <defs>
                  <linearGradient id="deepFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#064E4E" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#064E4E" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="remFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#08DEDE" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#08DEDE" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lightFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#1A3A3A" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#1A3A3A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fill: '#8A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A9A9A', fontSize: 10 }} width={25} axisLine={false} tickLine={false} unit="h" />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#F5F7F6' }} formatter={(v: number) => `${v}h`} />
                <Legend wrapperStyle={{ fontSize: 11, color: '#8A9A9A' }} iconType="circle" iconSize={8} />
                <Area type="monotone" dataKey="deep" stackId="sleep" stroke="#064E4E" fill="url(#deepFill)" strokeWidth={1.5} name="Deep" connectNulls />
                <Area type="monotone" dataKey="rem" stackId="sleep" stroke="#08DEDE" fill="url(#remFill)" strokeWidth={1.5} name="REM" connectNulls />
                <Area type="monotone" dataKey="light" stackId="sleep" stroke="#1A3A3A" fill="url(#lightFill)" strokeWidth={1.5} name="Light" connectNulls />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Health Scores */}
          <TrendsChart
            data={scoreData}
            lines={[
              { key: 'sleep', color: '#08DEDE', name: 'Sleep' },
              { key: 'readiness', color: '#10B981', name: 'Readiness' },
              { key: 'activity', color: '#F59E0B', name: 'Activity' },
            ]}
            title="Health Scores"
            info="Oura scores combine multiple factors. 85+ is optimal, 70-84 is good, below 70 needs attention."
            yDomain={[0, 100]}
          />

          {/* HRV & RHR — Two Stacked Mini Charts */}
          <ChartCard title="HRV Trend" info="Heart Rate Variability measures recovery. Higher values and upward trends indicate good recovery and low stress.">
            <p className="text-[10px] text-brand-muted mb-2">↑ Higher = better recovery</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={hrvData}>
                <XAxis dataKey="label" tick={{ fill: '#8A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A9A9A', fontSize: 10 }} width={30} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#F5F7F6' }} />
                <Line type="monotone" dataKey="hrv" stroke="#08DEDE" strokeWidth={2} dot={{ r: 2, fill: '#08DEDE' }} name="HRV" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Resting Heart Rate" info="Resting Heart Rate reflects cardiovascular fitness. Lower values (40-60 bpm for active people) indicate better fitness. Spikes may indicate illness or overtraining.">
            <p className="text-[10px] text-brand-muted mb-2">↓ Lower = better fitness</p>
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={rhrData}>
                <XAxis dataKey="label" tick={{ fill: '#8A9A9A', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#8A9A9A', fontSize: 10 }} width={30} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#F5F7F6' }} />
                <Line type="monotone" dataKey="rhr" stroke="#EF4444" strokeWidth={2} dot={{ r: 2, fill: '#EF4444' }} name="RHR" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          {/* Week-over-Week Table */}
          {weeklySummaries.length > 1 && (
            <div className="bg-brand-dark border border-brand-border rounded-xl p-4 overflow-x-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-3">
                Week-over-Week
              </h3>
              <table className="w-full text-xs tnum">
                <thead>
                  <tr className="text-brand-muted border-b border-brand-border">
                    <th className="text-left py-2 pr-2">Week</th>
                    <th className="text-right py-2 px-1">Weight</th>
                    <th className="text-right py-2 px-1">Sleep</th>
                    <th className="text-right py-2 px-1">Steps</th>
                    <th className="text-right py-2 px-1">Cal</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklySummaries.slice(-8).reverse().map((w) => (
                    <tr key={w.Week_Start} className="border-b border-brand-border/50">
                      <td className="py-2 pr-2 text-brand-muted">
                        {new Date(w.Week_Start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text">
                        {w.Avg_Weight_kg !== null ? w.Avg_Weight_kg.toFixed(1) : '—'}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text">
                        {w.Avg_Sleep_Score ?? '—'}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text">
                        {w.Avg_Steps !== null ? fmtNum(Math.round(w.Avg_Steps)) : '—'}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text">
                        {w.Avg_Calories !== null ? fmtNum(Math.round(w.Avg_Calories)) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Chart Card Wrapper ──────────────────────────────────────────

function ChartCard({ title, info, children }: { title: string; info?: string; children: React.ReactNode }) {
  return (
    <div className="bg-brand-dark border border-brand-border rounded-xl p-4 card-hover">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted">{title}</h3>
        {info && <InfoTooltip text={info} />}
      </div>
      {children}
    </div>
  );
}
