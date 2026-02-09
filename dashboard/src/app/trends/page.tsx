'use client';

import { useEffect, useState } from 'react';
import { DailyLog, WeeklySummary, fmtNum } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonPage } from '@/components/SkeletonCard';
import { WeightTrendArea, TrendsChart, AreaOverlayChart } from '@/components/Charts';

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

  const scoreData = logs.map((d) => ({
    label: formatLabel(d.Date),
    sleep: d.Sleep_Score,
    readiness: d.Readiness_Score,
    activity: d.Activity_Score,
  }));

  const hrvData = logs.map((d) => ({
    label: formatLabel(d.Date),
    hrv: d.HRV_Balance,
    rhr: d.Resting_Heart_Rate,
  }));

  const caloriesData = logs.map((d) => ({
    label: formatLabel(d.Date),
    calories: d.Calories,
    expenditure: d.Expenditure,
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
          <WeightTrendArea
            data={weightData}
            info="Trend weight smooths daily fluctuations. Focus on the overall direction."
          />

          <TrendsChart
            data={scoreData}
            lines={[
              { key: 'sleep', color: '#08DEDE', name: 'Sleep' },
              { key: 'readiness', color: '#10B981', name: 'Readiness' },
              { key: 'activity', color: '#F59E0B', name: 'Activity' },
            ]}
            title="Health Scores"
            info="Scores above 80 are excellent. Track consistency rather than individual days."
            yDomain={[0, 100]}
          />

          <TrendsChart
            data={hrvData}
            lines={[
              { key: 'hrv', color: '#08DEDE', name: 'HRV Balance' },
              { key: 'rhr', color: '#EF4444', name: 'Resting HR' },
            ]}
            title="HRV & Resting Heart Rate"
            info="HRV trending UP = improving recovery. RHR trending DOWN = improving fitness."
          />

          <AreaOverlayChart
            data={caloriesData}
            title="Calories vs TDEE"
            info="When calories > TDEE you're in surplus (gaining). When below, you're in deficit (losing)."
          />

          {/* Week-over-Week Table */}
          {weeklySummaries.length > 1 && (
            <div className="bg-brand-dark border border-brand-border rounded-xl p-4 overflow-x-auto">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-muted mb-3">
                Week-over-Week
              </h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-brand-muted border-b border-brand-border">
                    <th className="text-left py-2 pr-2">Week</th>
                    <th className="text-right py-2 px-1">Weight</th>
                    <th className="text-right py-2 px-1">Sleep</th>
                    <th className="text-right py-2 px-1">Steps</th>
                    <th className="text-right py-2 px-1">Cal</th>
                    <th className="text-right py-2 pl-1">Comp%</th>
                  </tr>
                </thead>
                <tbody>
                  {weeklySummaries.slice(-8).reverse().map((w) => (
                    <tr key={w.Week_Start} className="border-b border-brand-border/50">
                      <td className="py-2 pr-2 text-brand-muted">
                        {new Date(w.Week_Start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text tnum">
                        {w.Avg_Weight_kg !== null ? w.Avg_Weight_kg.toFixed(1) : '—'}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text tnum">
                        {w.Avg_Sleep_Score ?? '—'}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text tnum">
                        {w.Avg_Steps !== null ? fmtNum(Math.round(w.Avg_Steps)) : '—'}
                      </td>
                      <td className="text-right py-2 px-1 text-brand-text tnum">
                        {w.Avg_Calories !== null ? fmtNum(Math.round(w.Avg_Calories)) : '—'}
                      </td>
                      <td className="text-right py-2 pl-1 tnum font-medium" style={{
                        color: w.Compliance_Pct >= 80 ? '#10B981' : w.Compliance_Pct >= 50 ? '#F59E0B' : '#EF4444',
                      }}>
                        {w.Compliance_Pct}%
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
