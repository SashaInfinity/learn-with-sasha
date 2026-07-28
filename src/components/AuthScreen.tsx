/**
 * Auth screen: email + password login against the shared sasha_lms account.
 * Sasha (hero mode) floats beside the form on desktop and behind it on mobile.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';

export default function AuthScreen() {
  const { login, error, clearError, loading } = useAuth();
  const { setMood, speak, muted } = useVoice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMood('thinking');
    return () => setMood('idle');
  }, [setMood]);

  useEffect(() => {
    if (error) {
      setMood('shake');
      const t = setTimeout(() => setMood('idle'), 600);
      return () => clearTimeout(t);
    }
  }, [error, setMood]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await login(email.trim(), password);
      if (!muted) speak('Welcome back!');
    } catch {
      /* error surfaced via context */
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || loading;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* Sasha floats here (hero mode) — reserve space on desktop. */}
        <div
          className="hidden lg:flex lg:flex-col lg:items-center"
          aria-hidden
          style={{ minHeight: 'clamp(360px, 60vh, 600px)' }}
        >
          <div className="bg-amber-50 border border-amber-200/60 rounded-2xl px-4 py-3 shadow-sm text-center mb-3">
            <span className="text-sm font-semibold text-slate-800">
              Sign in and let&apos;s begin.
            </span>
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm w-full p-8">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-2xl border border-amber-500/20 mx-auto mb-3">
              ∞
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Use your Sasha account</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
              >
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-semibold text-slate-700 mb-1.5"
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
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold py-2.5 rounded-xl shadow-sm hover:opacity-95 transition-all disabled:opacity-60"
            >
              {busy && (
                <span
                  className="lws-voice-spinner"
                  aria-hidden
                  style={{ width: 16, height: 16 }}
                />
              )}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <a
              href="https://sashainfinity.com"
              target="_blank"
              rel="noreferrer"
              className="text-amber-600 font-semibold"
            >
              Create one on sashainfinity.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
