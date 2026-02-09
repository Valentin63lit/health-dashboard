'use client';

import { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

interface InfoTooltipProps {
  text: string;
}

export function InfoTooltip({ text }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="text-brand-muted hover:text-brand-text transition-colors p-0.5"
        aria-label="Info"
      >
        <HelpCircle size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-50 w-64 bg-brand-dark border border-brand-border rounded-lg p-3 shadow-lg animate-fade-in">
          <div className="flex justify-between items-start gap-2">
            <p className="text-xs text-brand-text leading-relaxed">{text}</p>
            <button
              onClick={() => setOpen(false)}
              className="text-brand-muted hover:text-brand-text flex-shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
