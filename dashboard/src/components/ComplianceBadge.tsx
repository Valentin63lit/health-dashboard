interface ComplianceBadgeProps {
  nutritionDays: number;
  totalDays: number;
}

export function ComplianceBadge({ nutritionDays, totalDays }: ComplianceBadgeProps) {
  const pct = totalDays > 0 ? Math.round((nutritionDays / totalDays) * 100) : 0;
  const color = pct >= 80 ? 'text-score-green' : pct >= 50 ? 'text-score-yellow' : 'text-score-red';

  return (
    <div className="bg-brand-dark rounded-xl p-4 text-center">
      <div className={`text-3xl font-bold ${color}`}>{pct}%</div>
      <div className="text-xs text-brand-muted mt-1">
        Nutrition logged {nutritionDays}/{totalDays} days
      </div>
    </div>
  );
}
