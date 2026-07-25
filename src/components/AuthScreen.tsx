/**
 * Auth screen: email + password login against the shared sasha_lms account.
 *
 * There's no separate sign-up here on purpose — students use their existing
 * sashainfinity.com account. A link points to the main site to register.
 */
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AnimatedTitle from './AnimatedTitle';

const inputClass =
  'w-full bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-3 text-white text-lg transition-all duration-300 focus:scale-[1.01] focus:outline-none focus:border-[var(--color-accent)]';
const primaryBtn =
  'w-full text-white font-bold py-3 px-6 rounded-lg transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-100 disabled:opacity-60 disabled:cursor-not-allowed';

export default function AuthScreen() {
  const { login, error, clearError, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch {
      // error surfaced via context
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || loading;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-md bg-gray-900/50 backdrop-blur-sm rounded-2xl shadow-2xl p-8 border animate-pulseGlowThemed"
        style={{ borderColor: 'var(--color-border-themed)' }}
      >
        <div className="text-center mb-8">
          <AnimatedTitle text="Learn With Sasha" />
          <p className="mt-2 text-gray-400">Sign in with your Sasha account</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-sm font-medium text-gray-300 mb-2">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) clearError();
              }}
              placeholder="you@example.com"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor="login-password"
              className="block text-sm font-medium text-gray-300 mb-2"
            >
              Password
            </label>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) clearError();
              }}
              placeholder="••••••••"
              className={inputClass}
            />
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className={primaryBtn}
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <a
            href="https://sashainfinity.com"
            target="_blank"
            rel="noreferrer"
            className="underline"
            style={{ color: 'var(--color-accent)' }}
          >
            Create one on sashainfinity.com
          </a>
        </p>
      </div>
    </div>
  );
}
