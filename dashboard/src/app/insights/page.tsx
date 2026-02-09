'use client';

import { useEffect, useState } from 'react';
import { AISummary } from '@/lib/types';

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
      <h1 className="text-xl font-bold text-brand-white">AI Insights</h1>
      <p className="text-xs text-brand-muted">
        Claude-generated health analyses, updated weekly on Sundays.
      </p>

      {loading ? (
        <div className="bg-brand-dark rounded-xl p-8 text-center">
          <p className="text-brand-muted text-sm animate-pulse">Loading insights...</p>
        </div>
      ) : summaries.length === 0 ? (
        <div className="bg-brand-dark rounded-xl p-6 text-center">
          <p className="text-3xl mb-3">🤖</p>
          <p className="text-brand-muted text-sm">No AI summaries yet.</p>
          <p className="text-brand-muted/60 text-xs mt-2">
            Summaries are auto-generated every Sunday at 10am,
            or trigger one with /summary in Telegram.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {summaries.map((s, idx) => {
            const isExpanded = expandedIdx === idx;
            const dateFormatted = new Date(s.Date + 'T12:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            });

            return (
              <div key={s.Date} className="bg-brand-dark rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedIdx(isExpanded ? -1 : idx)}
                  className="w-full px-4 py-3 flex items-center justify-between text-left"
                >
                  <div>
                    <span className="text-sm font-medium text-brand-text">
                      Week {s.Week_Number}
                    </span>
                    <span className="block text-xs text-brand-muted">{dateFormatted}</span>
                  </div>
                  <span className={`text-brand-accent transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-brand-primary/20">
                    <div className="pt-3 text-sm text-brand-text/90 leading-relaxed whitespace-pre-wrap">
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
  // Simple markdown-like formatting for bold and headers
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

    // Headers (lines starting with numbers or bullets)
    if (/^\d+\./.test(line)) {
      return (
        <p key={i} className="font-medium text-brand-white mt-3 mb-1">
          {formatted}
        </p>
      );
    }

    return (
      <p key={i} className={line.trim() === '' ? 'h-2' : ''}>
        {formatted}
      </p>
    );
  });
}
