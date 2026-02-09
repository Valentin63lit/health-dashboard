'use client';

import { useEffect, useState } from 'react';
import { DailyLog, WeeklySummary } from '@/lib/types';
import { TrendsChart, WeightChart } from '@/components/Charts';

type RangeOption = '1w' | '4w' | '3m' | 'all';

const RANGE_LABELS: Record<RangeOption, string> = {
  '1w': '1 Week',
  '4w': '4 Weeks',
  '3m': '3 Months',
  all: 'All Time',
};

function getStartDate(range: RangeOption): string {
  const d = new Date();
  switch (range) {
    case '1w': d.setDate(d.getDate() - 7); break;
    case '4w': d.setDate(d.getDate() - 28); break;
    case '3m': d.setMonth(d.getMonth() - 3); break;
    case 'all': return '2020-01-01';
  }
  return d.toISOString().split('T')[0];
}

export default function TrendsPage() {
  const [range, setRange] = useState<RangeOption>('4w');
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

  // Format label based on range
  const formatLabel = (date: string) => {
    const d = new Date(date + 'T12:00:00');
    if (range === '1w') return d.toLocaleDateString('en-US', { weekday: 'short' });
    if (range === '4w') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      <h1 className="text-xl font-bold text-brand-white">Trends</h1>

      {/* Range Selector */}
      <div className="flex gap-2">
        {(Object.keys(RANGE_LABELS) as RangeOption[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`flex-1 py-2 rounded-lg text-xs font-medium transition-colors ${
              range === r
                ? 'bg-brand-accent text-brand-darkest'
                : 'bg-brand-dark text-brand-muted hover:text-brand-text'
            }`}
          >
            {RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-brand-dark rounded-xl p-8 text-center">
          <p className="text-brand-muted text-sm animate-pulse">Loading trends...</p>
        </div>
      ) : logs.length === 0 ? (
        <div className="bg-brand-dark rounded-xl p-8 text-center">
          <p className="text-brand-muted text-sm">No data for this period</p>
        </div>
      ) : (
        <>
          {/* Weight + Trend */}
          <WeightChart data={weightData} />

          {/* Scores */}
          <TrendsChart
            data={scoreData}
            lines={[
              { key: 'sleep', color: '#08DEDE', name: 'Sleep' },
              { key: 'readiness', color: '#22C55E', name: 'Readiness' },
              { key: 'activity', color: '#EAB308', name: 'Activity' },
            ]}
            title="Health Scores"
            yDomain={[0, 100]}
          />

          {/* HRV + Resting HR */}
          <TrendsChart
            data={hrvData}
            lines={[
              { key: 'hrv', color: '#08DEDE', name: 'HRV Balance' },
              { key: 'rhr', color: '#EF4444', name: 'Resting HR' },
            ]}
            title="HRV & Resting Heart Rate"
          />

          {/* Calories vs Expenditure */}
          <TrendsChart
            data={caloriesData}
            lines={[
              { key: 'calories', color: '#08DEDE', name: 'Calories In' },
              { key: 'expenditure', color: '#9EB6B6', name: 'TDEE' },
            ]}
            title="Calories vs TDEE"
          />

          {/* Week-over-Week Comparison Table */}
          {weeklySummaries.length > 1 && (
            <div className="bg-brand-dark rounded-xl p-4 overflow-x-auto">
              <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-3 font-medium">Week-over-Week</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-brand-muted border-b border-brand-primary/20">
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
                    <tr key={w.Week_Start} className="border-b border-brand-primary/10">
                      <td className="py-1.5 pr-2 text-brand-muted">
                        {new Date(w.Week_Start + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </td>
                      <td className="text-right py-1.5 px-1 text-brand-text">
                        {w.Avg_Weight_kg ?? '—'}
                      </td>
                      <td className="text-right py-1.5 px-1 text-brand-text">
                        {w.Avg_Sleep_Score ?? '—'}
                      </td>
                      <td className="text-right py-1.5 px-1 text-brand-text">
                        {w.Avg_Steps !== null ? Math.round(w.Avg_Steps).toLocaleString() : '—'}
                      </td>
                      <td className="text-right py-1.5 px-1 text-brand-text">
                        {w.Avg_Calories ?? '—'}
                      </td>
                      <td className="text-right py-1.5 pl-1 text-brand-text">
                        {w.Compliance_Pct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
