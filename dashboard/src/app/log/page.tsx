'use client';

import { useEffect, useState } from 'react';
import { DailyLog, fmtNum, scoreHex } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonCard } from '@/components/SkeletonCard';

const COLUMNS: { key: keyof DailyLog; label: string; format?: 'score' | 'num1' | 'num0' | 'pct' | 'temp'; }[] = [
  { key: 'Weight_kg', label: 'Weight', format: 'num1' },
  { key: 'Calories', label: 'Cal', format: 'num0' },
  { key: 'Protein_g', label: 'Prot', format: 'num0' },
  { key: 'Carbs_g', label: 'Carbs', format: 'num0' },
  { key: 'Fats_g', label: 'Fats', format: 'num0' },
  { key: 'Steps', label: 'Steps', format: 'num0' },
  { key: 'Total_Sleep_Hours', label: 'Sleep h', format: 'num1' },
  { key: 'Deep_Sleep_Minutes', label: 'Deep', format: 'num0' },
  { key: 'REM_Sleep_Minutes', label: 'REM', format: 'num0' },
  { key: 'Sleep_Efficiency', label: 'Eff%', format: 'pct' },
  { key: 'Sleep_Score', label: 'Sleep', format: 'score' },
  { key: 'Readiness_Score', label: 'Ready', format: 'score' },
  { key: 'Activity_Score', label: 'Active', format: 'score' },
  { key: 'HRV_Balance', label: 'HRV', format: 'num0' },
  { key: 'Resting_Heart_Rate', label: 'RHR', format: 'num0' },
  { key: 'Temperature_Deviation', label: 'Temp', format: 'temp' },
  { key: 'Nap_Minutes', label: 'Nap', format: 'num0' },
];

const PAGE_SIZE = 30;

export default function LogPage() {
  const [logs, setLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useEffect(() => {
    fetch('/api/data?start=2020-01-01&end=2099-12-31')
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.dailyLogs || []).sort((a: DailyLog, b: DailyLog) =>
          b.Date.localeCompare(a.Date)
        );
        setLogs(sorted);
      })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, []);

  const visible = logs.slice(0, visibleCount);
  const hasMore = visibleCount < logs.length;

  function formatCell(val: number | null, format?: string): { text: string; color?: string } {
    if (val === null || val === undefined) return { text: '—', color: '#555' };

    switch (format) {
      case 'score':
        return { text: String(Math.round(val)), color: scoreHex(val) };
      case 'num1':
        return { text: val.toFixed(1) };
      case 'num0':
        return { text: fmtNum(Math.round(val)) };
      case 'pct':
        return { text: `${val.toFixed(0)}%` };
      case 'temp':
        return { text: `${val > 0 ? '+' : ''}${val.toFixed(1)}°` };
      default:
        return { text: String(val) };
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Data Log" subtitle={`${logs.length} entries`} />

      {loading ? (
        <div className="space-y-2">
          <SkeletonCard height="h-8" />
          <SkeletonCard height="h-64" />
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-brand-muted text-sm">No data logged yet</p>
        </div>
      ) : (
        <>
          <div className="relative overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full text-[13px] tnum" style={{ minWidth: 900 }}>
              <thead>
                <tr className="bg-brand-dark">
                  <th className="sticky left-0 z-20 bg-brand-dark text-left px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-muted whitespace-nowrap border-r border-brand-border">
                    Date
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="text-right px-2.5 py-2.5 text-xs font-semibold uppercase tracking-wide text-brand-muted whitespace-nowrap"
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((row, idx) => {
                  const bgColor = idx % 2 === 0 ? '#0D2626' : '#0F2E2E';
                  const dateFormatted = new Date(row.Date + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  const weekday = new Date(row.Date + 'T12:00:00').toLocaleDateString('en-US', {
                    weekday: 'short',
                  });

                  return (
                    <tr key={row.Date} style={{ backgroundColor: bgColor }}>
                      <td className="sticky left-0 z-10 px-3 py-2 whitespace-nowrap border-r border-brand-border font-medium text-brand-text"
                          style={{ backgroundColor: bgColor }}>
                        <span className="text-brand-muted text-[11px] mr-1.5">{weekday}</span>
                        {dateFormatted}
                      </td>
                      {COLUMNS.map((col) => {
                        const { text, color } = formatCell(row[col.key] as number | null, col.format);
                        return (
                          <td
                            key={col.key}
                            className="text-right px-2.5 py-2 whitespace-nowrap"
                            style={{ color: color || '#F5F7F6' }}
                          >
                            {text}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <button
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full py-3 bg-brand-dark border border-brand-border rounded-xl text-sm font-medium text-brand-muted hover:text-brand-text transition-colors"
            >
              Load more ({logs.length - visibleCount} remaining)
            </button>
          )}
        </>
      )}
    </div>
  );
}
