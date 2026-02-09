'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Today', icon: '📊' },
  { href: '/weekly', label: 'Weekly', icon: '📈' },
  { href: '/trends', label: 'Trends', icon: '📉' },
  { href: '/insights', label: 'AI', icon: '🤖' },
];

export function NavBar() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show NavBar on login page
  if (pathname === '/login') return null;

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-brand-dark border-t border-brand-primary/30">
      <div className="max-w-lg mx-auto flex items-center justify-around h-16">
        {NAV_ITEMS.map(({ href, label, icon }) => {
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors ${
                isActive
                  ? 'text-brand-accent'
                  : 'text-brand-muted hover:text-brand-text'
              }`}
            >
              <span className="text-xl">{icon}</span>
              <span className="text-[10px] font-medium uppercase tracking-wider">
                {label}
              </span>
            </Link>
          );
        })}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors text-brand-muted hover:text-brand-text"
          title="Logout"
        >
          <span className="text-xl">🔒</span>
          <span className="text-[10px] font-medium uppercase tracking-wider">
            Lock
          </span>
        </button>
      </div>
    </nav>
  );
}
