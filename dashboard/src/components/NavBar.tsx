'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, LineChart, TrendingUp, Sparkles, Send } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Today', icon: BarChart3 },
  { href: '/weekly', label: 'Weekly', icon: LineChart },
  { href: '/trends', label: 'Trends', icon: TrendingUp },
  { href: '/insights', label: 'AI', icon: Sparkles },
  { href: 'https://t.me/alex_health_tracker_bot', label: 'Telegram', icon: Send, external: true },
];

export function NavBar() {
  const pathname = usePathname();

  if (pathname === '/login') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-dark/95 backdrop-blur-sm border-t border-brand-border">
      <div className="max-w-lg mx-auto flex items-stretch justify-around h-16">
        {NAV_ITEMS.map(({ href, label, icon: Icon, external }) => {
          const isActive = !external && pathname === href;

          if (external) {
            return (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex flex-col items-center justify-center gap-0.5 px-3 text-brand-muted hover:text-brand-text transition-colors relative"
              >
                <Icon size={20} />
                <span className="text-[10px] font-medium uppercase tracking-wider">
                  {label}
                </span>
              </a>
            );
          }

          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 transition-colors relative ${
                isActive
                  ? 'text-brand-accent'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              {isActive && (
                <div className="absolute top-0 left-2 right-2 h-0.5 bg-brand-accent rounded-b" />
              )}
              <Icon size={20} />
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
