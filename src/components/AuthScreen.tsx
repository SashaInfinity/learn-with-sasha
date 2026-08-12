/**
 * Auth screen: email + password login against the shared sasha_lms account.
 *
 * The left column is registered as Sasha's anchor, so she sits inside the space
 * reserved for her instead of floating over the form (the previous behaviour:
 * the stage anchored at screen centre while this file reserved a left column).
 * On mobile the anchor becomes a compact strip above the card.
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { useSashaAnchor } from '../hooks/useSashaAnchor';

export default function AuthScreen() {
  const { login, error, clearError, loading } = useAuth();
  const { setMood, speak, muted } = useVoice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  useSashaAnchor(anchorRef, 'auth', { fillY: 0.92, max: 1.6 });

  useEffect(() => {
    setMood('idle');
    return () => setMood('idle');
  }, [setMood]);

  useEffect(() => {
    if (error) {
      setMood('shake');
      const t = setTimeout(() => setMood('idle'), 700);
      return () => clearTimeout(t);
    }
  }, [error, setMood]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMood('thinking');
    try {
      await login(email.trim(), password);
      if (!muted) speak('Welcome back!');
    } catch {
      /* error surfaced via context */
    } finally {
      setSubmitting(false);
      setMood('idle');
    }
  };

  const busy = submitting || loading;

  return (
    <div className="lws-auth">
      <div className="lws-auth-grid">
        {/* Sasha's column: greeting bubble above her anchor box. */}
        <div className="lws-auth-aside">
          <div className="lws-bubble lws-auth-bubble">
            <span className="text-sm font-semibold text-slate-800">
              Sign in and let&apos;s begin.
            </span>
          </div>
          <div ref={anchorRef} className="lws-auth-anchor" aria-hidden />
        </div>

        <div className="lws-surface-raised lws-auth-card">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-2xl border border-amber-500/20 mx-auto mb-3">
              ∞
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Use your Sasha account</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="lws-field">
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                placeholder=" "
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) clearError();
                }}
              />
              <label htmlFor="login-email">Email</label>
            </div>

            <div className="lws-field">
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder=" "
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
              />
              <label htmlFor="login-password">Password</label>
            </div>

            {error && (
              <p role="alert" className="lws-auth-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="lws-cta lws-lift w-full disabled:opacity-60"
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
