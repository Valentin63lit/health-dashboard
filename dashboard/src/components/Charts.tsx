'use client';

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Legend,
} from 'recharts';
import { InfoTooltip } from './InfoTooltip';

const C = {
  accent: '#08DEDE',
  accentDim: 'rgba(8, 222, 222, 0.1)',
  green: '#10B981',
  greenDim: 'rgba(16, 185, 129, 0.1)',
  yellow: '#F59E0B',
  yellowDim: 'rgba(245, 158, 11, 0.1)',
  red: '#EF4444',
  muted: '#8A9A9A',
  text: '#F5F7F6',
  border: '#1A3A3A',
  card: '#0D2626',
  bg: '#061A19',
};

const tooltipStyle = {
  backgroundColor: C.card,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  fontSize: 12,
  color: C.text,
};

interface ChartData {
  label: string;
  [key: string]: string | number | null;
}

// ─── Chart Card Wrapper ─────────────────────────────────────────

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

// ─── Weight Line Chart ──────────────────────────────────────────

export function WeightChart({ data, info }: { data: ChartData[]; info?: string }) {
  return (
    <ChartCard title="Weight Trend" info={info}>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="weightFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.15} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: C.muted, fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            domain={['auto', 'auto']}
            tick={{ fill: C.muted, fontSize: 10 }}
            width={35}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <Area
            type="monotone"
            dataKey="weight"
            stroke={C.accent}
            strokeWidth={2}
            fill="url(#weightFill)"
            dot={{ r: 3, fill: C.accent }}
            name="Weight"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="trend"
            stroke={C.muted}
            strokeWidth={1.5}
            strokeDasharray="5 5"
            dot={false}
            name="Trend"
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Sleep Stacked Bar ──────────────────────────────────────────

export function SleepStackedChart({ data }: { data: ChartData[] }) {
  return (
    <ChartCard title="Sleep Breakdown" info="Deep sleep repairs your body. REM consolidates memory. Light sleep transitions between stages.">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 10 }} width={30} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <Bar dataKey="deep" stackId="sleep" fill="#0CB4B4" radius={[0, 0, 0, 0]} name="Deep" />
          <Bar dataKey="rem" stackId="sleep" fill={C.accent} name="REM" />
          <Bar dataKey="light" stackId="sleep" fill="#5A9A9A" radius={[4, 4, 0, 0]} name="Light" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Calories vs TDEE Grouped Bar ───────────────────────────────

export function CaloriesChart({ data }: { data: ChartData[] }) {
  return (
    <ChartCard title="Calories vs TDEE" info="Compare your intake against your total daily energy expenditure.">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 10 }} width={40} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <Bar dataKey="calories" fill={C.accent} radius={[4, 4, 0, 0]} name="Calories" />
          <Bar dataKey="expenditure" fill="#2A4A4A" radius={[4, 4, 0, 0]} name="TDEE" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Steps Bar Chart ────────────────────────────────────────────

export function StepsChart({ data }: { data: ChartData[] }) {
  return (
    <ChartCard title="Daily Steps" info="8,000-10,000 steps daily is a good target for overall health.">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data}>
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 10 }} width={40} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <ReferenceLine y={10000} stroke={C.muted} strokeDasharray="5 5" strokeOpacity={0.5} />
          <Bar dataKey="steps" fill={C.accent} radius={[4, 4, 0, 0]} name="Steps" />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Multi-line Trends Chart ───────────────────────────────────

interface TrendLine {
  key: string;
  color: string;
  name: string;
}

export function TrendsChart({
  data,
  lines,
  title,
  info,
  yDomain = ['auto', 'auto'],
}: {
  data: ChartData[];
  lines: TrendLine[];
  title: string;
  info?: string;
  yDomain?: [number | 'auto', number | 'auto'];
}) {
  return (
    <ChartCard title={title} info={info}>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data}>
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={yDomain} tick={{ fill: C.muted, fontSize: 10 }} width={35} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: C.muted }}
            iconType="circle"
            iconSize={8}
          />
          {lines.map((line) => (
            <Line
              key={line.key}
              type="monotone"
              dataKey={line.key}
              stroke={line.color}
              strokeWidth={2}
              dot={{ r: 2, fill: line.color }}
              name={line.name}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Area Overlay Chart (Calories vs TDEE trends) ──────────────

export function AreaOverlayChart({
  data,
  title,
  info,
}: {
  data: ChartData[];
  title: string;
  info?: string;
}) {
  return (
    <ChartCard title={title} info={info}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="calFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.2} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="tdeeFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.muted} stopOpacity={0.1} />
              <stop offset="100%" stopColor={C.muted} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: C.muted, fontSize: 10 }} width={40} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <Legend wrapperStyle={{ fontSize: 11, color: C.muted }} iconType="circle" iconSize={8} />
          <Area type="monotone" dataKey="calories" stroke={C.accent} fill="url(#calFill)" strokeWidth={2} name="Calories" connectNulls />
          <Area type="monotone" dataKey="expenditure" stroke={C.muted} fill="url(#tdeeFill)" strokeWidth={1.5} name="TDEE" connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

// ─── Weight Trend Area Chart (for Trends page) ─────────────────

export function WeightTrendArea({ data, info }: { data: ChartData[]; info?: string }) {
  return (
    <ChartCard title="Weight Trend" info={info}>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="wtFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.accent} stopOpacity={0.15} />
              <stop offset="100%" stopColor={C.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" tick={{ fill: C.muted, fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis domain={['auto', 'auto']} tick={{ fill: C.muted, fontSize: 10 }} width={35} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: C.text }} />
          <Area type="monotone" dataKey="weight" stroke={C.accent} fill="url(#wtFill)" strokeWidth={2} name="Weight" connectNulls dot={{ r: 2, fill: C.accent }} />
          <Line type="monotone" dataKey="trend" stroke={C.muted} strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Trend" connectNulls />
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
