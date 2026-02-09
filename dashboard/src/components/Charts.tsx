'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

const CHART_COLORS = {
  accent: '#08DEDE',
  primary: '#106A6A',
  muted: '#9EB6B6',
  green: '#22C55E',
  yellow: '#EAB308',
  red: '#EF4444',
  white: '#F5F7F6',
  grid: '#184E4E',
  bg: '#0D3B3B',
};

interface ChartData {
  label: string;
  [key: string]: string | number | null;
}

// ─── Weight Chart ──────────────────────────────────────────────

interface WeightChartProps {
  data: ChartData[];
}

export function WeightChart({ data }: WeightChartProps) {
  return (
    <div className="bg-brand-dark rounded-xl p-4">
      <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-3 font-medium">Weight Trend</h3>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} width={35} />
          <Tooltip
            contentStyle={{ backgroundColor: CHART_COLORS.bg, border: `1px solid ${CHART_COLORS.primary}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: CHART_COLORS.white }}
          />
          <Line type="monotone" dataKey="weight" stroke={CHART_COLORS.accent} strokeWidth={2} dot={{ r: 3 }} name="Weight" />
          <Line type="monotone" dataKey="trend" stroke={CHART_COLORS.muted} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Trend" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Score Line Chart ──────────────────────────────────────────

interface ScoreChartProps {
  data: ChartData[];
  dataKey: string;
  title: string;
  color?: string;
}

export function ScoreChart({ data, dataKey, title, color = CHART_COLORS.accent }: ScoreChartProps) {
  return (
    <div className="bg-brand-dark rounded-xl p-4">
      <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-3 font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} width={30} />
          <Tooltip
            contentStyle={{ backgroundColor: CHART_COLORS.bg, border: `1px solid ${CHART_COLORS.primary}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: CHART_COLORS.white }}
          />
          <ReferenceLine y={80} stroke={CHART_COLORS.green} strokeDasharray="3 3" strokeOpacity={0.5} />
          <ReferenceLine y={60} stroke={CHART_COLORS.yellow} strokeDasharray="3 3" strokeOpacity={0.5} />
          <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={{ r: 3 }} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Steps / Calories Bar Chart ────────────────────────────────

interface BarChartProps {
  data: ChartData[];
  dataKey: string;
  title: string;
  color?: string;
  target?: number;
}

export function MetricBarChart({ data, dataKey, title, color = CHART_COLORS.accent, target }: BarChartProps) {
  return (
    <div className="bg-brand-dark rounded-xl p-4">
      <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-3 font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} />
          <YAxis tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: CHART_COLORS.bg, border: `1px solid ${CHART_COLORS.primary}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: CHART_COLORS.white }}
          />
          {target && <ReferenceLine y={target} stroke={CHART_COLORS.yellow} strokeDasharray="5 5" label={{ value: 'Target', fill: CHART_COLORS.muted, fontSize: 10 }} />}
          <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Multi-line Trends Chart ───────────────────────────────────

interface TrendsChartProps {
  data: ChartData[];
  lines: { key: string; color: string; name: string }[];
  title: string;
  yDomain?: [number | 'auto', number | 'auto'];
}

export function TrendsChart({ data, lines, title, yDomain = ['auto', 'auto'] }: TrendsChartProps) {
  return (
    <div className="bg-brand-dark rounded-xl p-4">
      <h3 className="text-xs text-brand-muted uppercase tracking-wider mb-3 font-medium">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} />
          <YAxis domain={yDomain} tick={{ fill: CHART_COLORS.muted, fontSize: 10 }} width={40} />
          <Tooltip
            contentStyle={{ backgroundColor: CHART_COLORS.bg, border: `1px solid ${CHART_COLORS.primary}`, borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: CHART_COLORS.white }}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 2 }}
              name={line.name}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
