interface StatRowProps {
  icon: string;
  label: string;
  value: string | number | null;
  unit?: string;
  accent?: boolean;
  subtitle?: string;
}

export function StatRow({ icon, label, value, unit, accent, subtitle }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex items-center gap-2">
        <span className="text-lg">{icon}</span>
        <div>
          <span className="text-sm text-brand-muted">{label}</span>
          {subtitle && (
            <span className="block text-[10px] text-brand-muted/60">{subtitle}</span>
          )}
        </div>
      </div>
      <span className={`text-lg font-semibold ${accent ? 'text-brand-accent' : 'text-brand-text'}`}>
        {value !== null && value !== undefined ? value : '—'}
        {unit && value !== null && <span className="text-xs text-brand-muted ml-0.5">{unit}</span>}
      </span>
    </div>
  );
}
