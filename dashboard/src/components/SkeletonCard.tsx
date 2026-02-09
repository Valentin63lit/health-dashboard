'use client';

interface SkeletonCardProps {
  height?: string;
  className?: string;
}

export function SkeletonCard({ height = 'h-28', className = '' }: SkeletonCardProps) {
  return (
    <div
      className={`rounded-xl animate-skeleton ${height} ${className}`}
      style={{ backgroundColor: '#0D2626' }}
    />
  );
}

export function SkeletonScoreRow() {
  return (
    <div className="flex justify-center gap-6">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col items-center gap-1.5">
          <div className="w-16 h-16 rounded-full animate-skeleton" />
          <div className="w-12 h-3 rounded animate-skeleton" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="space-y-4 animate-fade-in">
      <SkeletonScoreRow />
      <SkeletonCard height="h-32" />
      <SkeletonCard height="h-24" />
      <SkeletonCard height="h-24" />
      <SkeletonCard height="h-20" />
    </div>
  );
}
