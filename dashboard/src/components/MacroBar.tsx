interface MacroBarProps {
  label: string;
  value: number | null;
  target: number | null;
  unit: string;
  color: string; // Tailwind color class
}

export function MacroBar({ label, value, target, unit, color }: MacroBarProps) {
  const pct = value !== null && target !== null && target > 0
    ? Math.min((value / target) * 100, 100)
    : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-brand-muted font-medium">{label}</span>
        <span className="text-brand-text">
          <span className="font-semibold">{value !== null ? Math.round(value) : '—'}</span>
          {target !== null && (
            <span className="text-brand-muted"> / {Math.round(target)}{unit}</span>
          )}
        </span>
      </div>
      <div className="h-2 bg-brand-darkest rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
