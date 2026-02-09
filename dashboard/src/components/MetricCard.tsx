'use client';

import { InfoTooltip } from './InfoTooltip';
import type { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  icon: LucideIcon;
  title: string;
  info: string;
  children: React.ReactNode;
  className?: string;
}

export function MetricCard({ icon: Icon, title, info, children, className = '' }: MetricCardProps) {
  return (
    <div className={`bg-brand-dark border border-brand-border rounded-xl p-4 card-hover ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon size={20} className="text-brand-muted" />
          <span className="text-xs font-semibold uppercase tracking-wide text-brand-muted">
            {title}
          </span>
        </div>
        <InfoTooltip text={info} />
      </div>
      {children}
    </div>
  );
}
