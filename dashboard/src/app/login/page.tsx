'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Wrong password');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 -mt-4 -mb-24"
         style={{ backgroundColor: '#061A19' }}>
      <div className="w-full max-w-sm">
        {/* Icon + Title */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <Lock size={48} className="text-brand-accent" />
          </div>
          <h1 className="text-2xl font-bold text-brand-text">Health Dashboard</h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="password" className="sr-only">Password</label>
            <input
              ref={inputRef}
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-xl border text-base outline-none transition-all bg-brand-dark border-brand-border text-brand-text placeholder:text-brand-muted focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/20"
            />
          </div>

          {error && (
            <p className={`text-sm text-center text-score-red ${error ? 'animate-shake' : ''}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-xl font-semibold text-base transition-all disabled:opacity-50 bg-brand-accent text-brand-darkest hover:brightness-110"
          >
            {loading ? 'Checking...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
