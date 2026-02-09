interface StatusBadgeProps {
  hasOura: boolean;
  hasNutrition: boolean;
  hasWeight: boolean;
}

export function StatusBadge({ hasOura, hasNutrition, hasWeight }: StatusBadgeProps) {
  const allComplete = hasOura && hasNutrition && hasWeight;

  if (allComplete) {
    return (
      <div className="bg-score-green/10 border border-score-green/30 rounded-lg px-3 py-2 text-center">
        <span className="text-score-green text-sm font-medium">✅ All data logged</span>
      </div>
    );
  }

  const missing: string[] = [];
  if (!hasOura) missing.push('Oura');
  if (!hasNutrition) missing.push('Nutrition');
  if (!hasWeight) missing.push('Weight');

  return (
    <div className="bg-score-yellow/10 border border-score-yellow/30 rounded-lg px-3 py-2 text-center">
      <span className="text-score-yellow text-sm font-medium">
        ⚠️ Missing: {missing.join(', ')}
      </span>
    </div>
  );
}
