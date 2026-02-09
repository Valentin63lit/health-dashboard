'use client';

interface WeekSelectorProps {
  currentRange: string;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
}

export function WeekSelector({ currentRange, onPrev, onNext, canGoNext }: WeekSelectorProps) {
  return (
    <div className="flex items-center justify-between bg-brand-dark rounded-xl px-4 py-3">
      <button
        onClick={onPrev}
        className="text-brand-accent hover:text-brand-white transition-colors p-1"
        aria-label="Previous week"
      >
        ◀
      </button>
      <span className="text-sm font-medium text-brand-text">{currentRange}</span>
      <button
        onClick={onNext}
        disabled={!canGoNext}
        className={`p-1 transition-colors ${
          canGoNext ? 'text-brand-accent hover:text-brand-white' : 'text-brand-muted/30 cursor-not-allowed'
        }`}
        aria-label="Next week"
      >
        ▶
      </button>
    </div>
  );
}
