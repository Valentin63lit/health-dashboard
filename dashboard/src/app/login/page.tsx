'use client';

import { useState, useEffect, useRef, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

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
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ backgroundColor: '#061A19' }}>
      <div className="w-full max-w-sm">
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🩺</div>
          <h1 className="text-xl font-semibold" style={{ color: '#F5F7F6' }}>
            Health Dashboard
          </h1>
          <p className="text-sm mt-1" style={{ color: '#9EB6B6' }}>
            Enter password to continue
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              className="w-full px-4 py-3 rounded-lg border text-base outline-none transition-colors"
              style={{
                backgroundColor: '#0D3B3B',
                borderColor: error ? '#ef4444' : '#106A6A',
                color: '#F5F7F6',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#08DEDE';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = error ? '#ef4444' : '#106A6A';
              }}
            />
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 rounded-lg font-medium text-base transition-all disabled:opacity-50"
            style={{
              backgroundColor: '#08DEDE',
              color: '#061A19',
            }}
          >
            {loading ? 'Checking...' : 'Enter'}
          </button>
        </form>
      </div>
    </div>
  );
}
