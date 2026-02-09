'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function PageHeader({ title, subtitle, right }: PageHeaderProps) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);

  async function handleLogout() {
    if (!confirming) {
      setConfirming(true);
      setTimeout(() => setConfirming(false), 3000);
      return;
    }
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <div className="flex items-center justify-between mb-1">
      <div>
        <h1 className="text-2xl font-bold text-brand-text">{title}</h1>
        {subtitle && (
          <p className="text-xs text-brand-muted mt-0.5">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        {right}
        <button
          onClick={handleLogout}
          className={`p-2 rounded-lg transition-colors ${
            confirming
              ? 'bg-score-red/20 text-score-red'
              : 'text-brand-muted hover:text-brand-text'
          }`}
          title={confirming ? 'Tap again to log out' : 'Log out'}
        >
          <LogOut size={18} />
        </button>
      </div>
    </div>
  );
}
