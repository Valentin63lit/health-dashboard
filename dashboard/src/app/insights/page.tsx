'use client';

import { useEffect, useState } from 'react';
import { Sparkles, ChevronDown, Send } from 'lucide-react';
import { AISummary } from '@/lib/types';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonCard } from '@/components/SkeletonCard';

export default function InsightsPage() {
  const [summaries, setSummaries] = useState<AISummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number>(0);

  useEffect(() => {
    fetch('/api/insights')
      .then((r) => r.json())
      .then((data) => setSummaries(data.summaries || []))
      .catch(() => setSummaries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <PageHeader title="AI Insights" subtitle="Claude-generated health analyses" />

      {loading ? (
        <div className="space-y-3">
          <SkeletonCard height="h-20" />
          <SkeletonCard height="h-20" />
          <SkeletonCard height="h-20" />
        </div>
      ) : summaries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <Sparkles size={48} className="text-brand-muted" />
          <p className="text-base text-brand-text">No AI insights yet</p>
          <p className="text-sm text-brand-muted text-center">
            Summaries generate every Sunday at 10am, or send /summary in Telegram
          </p>
          <a
            href="https://t.me/alex_health_tracker_bot"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 flex items-center gap-2 px-4 py-2.5 bg-brand-accent text-brand-darkest rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Send size={16} />
            Open Telegram
          </a>
        </div>
      ) : (
        <div className="space-y-3 animate-fade-in">
          {summaries.map((s, idx) => {
            const isExpanded = expandedIdx === idx;
            const weekStart = new Date(s.Date + 'T12:00:00');
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            const weekLabel = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}–${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

            // Get first meaningful line for preview
            const preview = s.Summary_Text.split('\n').find((l) => l.trim().length > 10)?.trim().slice(0, 100) || '';

            return (
              <div
                key={s.Date}
                className="bg-brand-dark border border-brand-border rounded-xl overflow-hidden card-hover"
              >
                <button
                  onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-brand-text">{weekLabel}</span>
                    {!isExpanded && preview && (
                      <p className="text-xs text-brand-muted mt-0.5 truncate">{preview}...</p>
                    )}
                  </div>
                  <ChevronDown
                    size={18}
                    className={`text-brand-accent flex-shrink-0 ml-2 transition-transform duration-200 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-brand-border">
                    <div className="pt-3 text-sm text-brand-text/90 leading-relaxed">
                      {formatSummaryText(s.Summary_Text)}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function formatSummaryText(text: string): React.ReactNode {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    // Bold: **text**
    const parts = line.split(/(\*\*[^*]+\*\*)/g);
    const formatted = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <span key={j} className="font-semibold text-brand-accent">
            {part.slice(2, -2)}
          </span>
        );
      }
      return part;
    });

    // Section headers (lines starting with numbers, bullets, or all-caps-ish)
    if (/^\d+\./.test(line) || /^[A-Z][A-Z\s&]+:/.test(line) || /^#+\s/.test(line)) {
      const cleanLine = line.replace(/^#+\s/, '');
      const cleanParts = cleanLine.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <span key={j} className="font-semibold text-brand-accent">
              {part.slice(2, -2)}
            </span>
          );
        }
        return part;
      });
      return (
        <p key={i} className="font-semibold text-brand-accent text-sm mt-3 mb-1">
          {cleanParts}
        </p>
      );
    }

    if (line.trim() === '') {
      return <div key={i} className="h-2" />;
    }

    return <p key={i}>{formatted}</p>;
  });
}
