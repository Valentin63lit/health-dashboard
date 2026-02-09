import { scoreColorClass } from '@/lib/types';

interface ScoreCardProps {
  label: string;
  value: number | null;
  icon: string;
  subtitle?: string;
}

export function ScoreCard({ label, value, icon, subtitle }: ScoreCardProps) {
  const colorClass = scoreColorClass(value);

  return (
    <div className="bg-brand-dark rounded-xl p-4 flex flex-col items-center gap-1">
      <span className="text-2xl">{icon}</span>
      <span className={`text-3xl font-bold ${colorClass}`}>
        {value !== null ? value : '—'}
      </span>
      <span className="text-xs text-brand-muted font-medium uppercase tracking-wide">
        {label}
      </span>
      {subtitle && (
        <span className="text-[10px] text-brand-muted">{subtitle}</span>
      )}
    </div>
  );
}
