/**
 * Auth screen: email + password login against the shared sasha_lms account.
 * Brand-styled; Sasha (hero mode, persistent stage) floats beside the form on
 * desktop and above it on mobile.
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

  // Sasha waits patiently while the user is on the auth screen.
  useEffect(() => {
    setMood('thinking');
    return () => setMood('idle');
  }, [setMood]);

  // Shake + sympathetic line on login error.
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
    <div className="lws-container flex min-h-screen items-center justify-center py-16">
      <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_420px]">
        {/* Left: Sasha floats here (hero mode, centre-left). On desktop we reserve
            the space; on mobile she's full-screen behind, so we hide this column. */}
        <div
          className="hidden lg:flex lg:flex-col lg:items-center"
          aria-hidden
          style={{ minHeight: 'clamp(360px, 60vh, 600px)' }}
        >
          <div
            className="lws-bubble"
            style={{ maxWidth: 280, textAlign: 'center', marginBottom: 12 }}
          >
            <span className="lws-bubble-text">Sign in and let&apos;s begin.</span>
          </div>
        </div>

        {/* Right: the form card. */}
        <div className="lws-panel w-full p-8 lws-fade-in-up">
          <div className="mb-8 text-center">
            <span className="lws-label-tag justify-center">Welcome back</span>
            <h1 className="lws-h1">Sign In</h1>
            <p className="lws-small mt-2">Use your Sasha account</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="lws-field-label">Email</label>
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
                className="lws-field"
              />
            </div>

            <div>
              <label htmlFor="login-password" className="lws-field-label">Password</label>
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
                className="lws-field"
              />
            </div>

            {error && (
              <p
                role="alert"
                className="lws-small rounded-md border px-3 py-2"
                style={{
                  color: 'var(--lws-danger)',
                  background: 'rgba(var(--lws-danger-rgb), 0.08)',
                  borderColor: 'rgba(var(--lws-danger-rgb), 0.3)',
                }}
              >
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="lws-btn lws-btn-fill w-full">
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

          <p className="mt-6 text-center lws-small">
            Don&apos;t have an account?{' '}
            <a
              href="https://sashainfinity.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--lws-primary)' }}
            >
              Create one on sashainfinity.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
