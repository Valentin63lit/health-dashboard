'use client';

import { scoreHex } from '@/lib/types';

interface ScoreRingProps {
  score: number | null;
  label: string;
  size?: number;
}

export function ScoreRing({ score, label, size = 64 }: ScoreRingProps) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score !== null ? (score / 100) * circumference : 0;
  const color = scoreHex(score);

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          {/* Background circle */}
          {score !== null ? (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1A3A3A"
              strokeWidth={strokeWidth}
            />
          ) : (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#1A3A3A"
              strokeWidth={strokeWidth}
              strokeDasharray="4 4"
            />
          )}
          {/* Progress arc */}
          {score !== null && (
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray={`${progress} ${circumference}`}
              strokeLinecap="round"
              className="transition-all duration-700 ease-out"
            />
          )}
        </svg>
        {/* Score number centered */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="tnum font-bold"
            style={{
              fontSize: size * 0.34,
              color: score !== null ? '#F5F7F6' : '#8A9A9A',
            }}
          >
            {score !== null ? score : '—'}
          </span>
        </div>
      </div>
      <span className="text-xs text-brand-muted">{label}</span>
    </div>
  );
}
