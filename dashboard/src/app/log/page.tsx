'use client';

import { useEffect, useState, useMemo } from 'react';
import { DailyLog, fmtNum, scoreHex } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonCard } from '@/components/SkeletonCard';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

type DatePreset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

const PAGE_SIZE = 50;

const COLUMNS: {
  key: keyof DailyLog;
  label: string;
  shortLabel: string;
  format?: 'score' | 'num1' | 'num0' | 'pct' | 'temp' | 'sleep_min';
}[] = [
  { key: 'Weight_kg', label: 'Weight', shortLabel: 'Wt', format: 'num1' },
  { key: 'Calories', label: 'Calories', shortLabel: 'Cal', format: 'num0' },
  { key: 'Protein_g', label: 'Protein', shortLabel: 'Prot', format: 'num0' },
  { key: 'Carbs_g', label: 'Carbs', shortLabel: 'Carbs', format: 'num0' },
  { key: 'Fats_g', label: 'Fats', shortLabel: 'Fats', format: 'num0' },
  { key: 'Steps', label: 'Steps', shortLabel: 'Steps', format: 'num0' },
  { key: 'Total_Sleep_Hours', label: 'Sleep', shortLabel: 'Sleep', format: 'num1' },
  { key: 'Deep_Sleep_Minutes', label: 'Deep', shortLabel: 'Deep', format: 'sleep_min' },
  { key: 'REM_Sleep_Minutes', label: 'REM', shortLabel: 'REM', format: 'sleep_min' },
  { key: 'Sleep_Efficiency', label: 'Eff%', shortLabel: 'Eff%', format: 'pct' },
  { key: 'Sleep_Score', label: 'Sleep', shortLabel: 'Slp', format: 'score' },
  { key: 'Readiness_Score', label: 'Ready', shortLabel: 'Rdy', format: 'score' },
  { key: 'Activity_Score', label: 'Active', shortLabel: 'Act', format: 'score' },
  { key: 'HRV_Balance', label: 'HRV', shortLabel: 'HRV', format: 'num0' },
  { key: 'Resting_Heart_Rate', label: 'RHR', shortLabel: 'RHR', format: 'num0' },
  { key: 'Temperature_Deviation', label: 'Temp', shortLabel: 'Tmp', format: 'temp' },
  { key: 'Nap_Minutes', label: 'Nap', shortLabel: 'Nap', format: 'sleep_min' },
];

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'this_week': {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day; // Monday
      const monday = new Date(today);
      monday.setDate(today.getDate() + diff);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      return { start: fmt(monday), end: fmt(sunday) };
    }
    case 'last_week': {
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() + diff);
      const lastMonday = new Date(thisMonday);
      lastMonday.setDate(thisMonday.getDate() - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setDate(lastMonday.getDate() + 6);
      return { start: fmt(lastMonday), end: fmt(lastSunday) };
    }
    case 'this_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: fmt(firstDay), end: fmt(lastDay) };
    }
    case 'last_month': {
      const firstDay = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const lastDay = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: fmt(firstDay), end: fmt(lastDay) };
    }
    default:
      return { start: '2020-01-01', end: '2099-12-31' };
  }
}

function fmt(d: Date): string {
  return d.toISOString().split('T')[0];
}

export default function LogPage() {
  const [allLogs, setAllLogs] = useState<DailyLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    fetch('/api/data?start=2020-01-01&end=2099-12-31')
      .then((r) => r.json())
      .then((data) => {
        const sorted = (data.dailyLogs || []).sort((a: DailyLog, b: DailyLog) =>
          b.Date.localeCompare(a.Date)
        );
        setAllLogs(sorted);
      })
      .catch(() => setAllLogs([]))
      .finally(() => setLoading(false));
  }, []);

  // Filter logs by date range
  const filteredLogs = useMemo(() => {
    if (preset === 'custom') {
      if (!customStart && !customEnd) return allLogs;
      return allLogs.filter((d) => {
        if (customStart && d.Date < customStart) return false;
        if (customEnd && d.Date > customEnd) return false;
        return true;
      });
    }
    const { start, end } = getDateRange(preset);
    return allLogs.filter((d) => d.Date >= start && d.Date <= end);
  }, [allLogs, preset, customStart, customEnd]);

  // Reset page when filter changes
  useEffect(() => {
    setPage(1);
  }, [preset, customStart, customEnd]);

  const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);
  const visibleLogs = filteredLogs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function formatCell(val: number | null, format?: string): { text: string; color?: string } {
    if (val === null || val === undefined) return { text: '—', color: '#4A5A5A' };

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
      case 'sleep_min':
        if (val >= 60) return { text: `${(val / 60).toFixed(1)}h` };
        return { text: `${Math.round(val)}m` };
      default:
        return { text: String(val) };
    }
  }

  const dateRangeLabel = useMemo(() => {
    if (preset === 'custom') return null;
    const { start, end } = getDateRange(preset);
    const s = new Date(start + 'T12:00:00');
    const e = new Date(end + 'T12:00:00');
    return `${s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} — ${e.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  }, [preset]);

  const PRESETS: { key: DatePreset; label: string }[] = [
    { key: 'this_week', label: 'This Week' },
    { key: 'last_week', label: 'Last Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'last_month', label: 'Last Month' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Log"
        subtitle={`${filteredLogs.length} entries${dateRangeLabel ? ` · ${dateRangeLabel}` : ''}`}
      />

      {/* Date Filter Presets */}
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setPreset(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              preset === key
                ? 'bg-brand-accent text-brand-darkest'
                : 'bg-brand-dark border border-brand-border text-brand-muted hover:text-brand-text'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Custom Date Range */}
      {preset === 'custom' && (
        <div className="flex items-center gap-2 bg-brand-dark border border-brand-border rounded-xl p-3">
          <Calendar size={16} className="text-brand-muted flex-shrink-0" />
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="flex-1 bg-transparent border border-brand-border rounded-lg px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-accent"
            placeholder="Start date"
          />
          <span className="text-brand-muted text-xs">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="flex-1 bg-transparent border border-brand-border rounded-lg px-2 py-1.5 text-xs text-brand-text outline-none focus:border-brand-accent"
            placeholder="End date"
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          <SkeletonCard height="h-8" />
          <SkeletonCard height="h-64" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <Calendar size={40} className="text-brand-muted" />
          <p className="text-brand-muted text-sm">No data for this period</p>
        </div>
      ) : (
        <>
          {/* Table */}
          <div className="relative overflow-x-auto rounded-xl border border-brand-border">
            <table className="w-full text-[13px] tnum" style={{ minWidth: 900 }}>
              <thead>
                <tr className="bg-brand-dark">
                  <th className="sticky left-0 z-20 bg-brand-dark text-left px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-muted whitespace-nowrap border-r border-brand-border">
                    Date
                  </th>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      className="text-right px-2 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-brand-muted whitespace-nowrap"
                    >
                      {col.shortLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleLogs.map((row, idx) => {
                  const bgColor = idx % 2 === 0 ? '#0D2626' : '#0F2E2E';
                  const d = new Date(row.Date + 'T12:00:00');
                  const dateFormatted = d.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });
                  const weekday = d.toLocaleDateString('en-US', {
                    weekday: 'short',
                  });

                  return (
                    <tr key={row.Date} style={{ backgroundColor: bgColor }}>
                      <td
                        className="sticky left-0 z-10 px-3 py-2 whitespace-nowrap border-r border-brand-border font-medium text-brand-text"
                        style={{ backgroundColor: bgColor }}
                      >
                        <span className="text-brand-muted text-[11px] mr-1.5">{weekday}</span>
                        {dateFormatted}
                      </td>
                      {COLUMNS.map((col) => {
                        const { text, color } = formatCell(
                          row[col.key] as number | null,
                          col.format
                        );
                        return (
                          <td
                            key={col.key}
                            className="text-right px-2 py-2 whitespace-nowrap"
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between bg-brand-dark border border-brand-border rounded-xl px-4 py-2.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className={`p-1.5 rounded-lg transition-colors ${
                  page <= 1
                    ? 'text-brand-border cursor-default'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-border/30'
                }`}
              >
                <ChevronLeft size={18} />
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    // Show first, last, current, and neighbors
                    if (p === 1 || p === totalPages) return true;
                    if (Math.abs(p - page) <= 1) return true;
                    return false;
                  })
                  .reduce<(number | 'dots')[]>((acc, p, i, arr) => {
                    if (i > 0 && p - (arr[i - 1] as number) > 1) {
                      acc.push('dots');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, i) =>
                    item === 'dots' ? (
                      <span key={`dots-${i}`} className="px-1 text-brand-muted text-xs">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        onClick={() => setPage(item as number)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all ${
                          page === item
                            ? 'bg-brand-accent text-brand-darkest'
                            : 'text-brand-muted hover:text-brand-text hover:bg-brand-border/30'
                        }`}
                      >
                        {item}
                      </button>
                    )
                  )}
              </div>

              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className={`p-1.5 rounded-lg transition-colors ${
                  page >= totalPages
                    ? 'text-brand-border cursor-default'
                    : 'text-brand-muted hover:text-brand-text hover:bg-brand-border/30'
                }`}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
