/**
 * Auth screen: email + password login against the shared sasha_lms account.
 * Brand-styled. No separate sign-up here — students use their existing
 * sashainfinity.com account; a link points to the main site to register.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';

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
      /* error surfaced via context */
    } finally {
      setSubmitting(false);
    }
  };

  const busy = submitting || loading;

  return (
    <div className="lws-container flex min-h-screen items-center justify-center py-16">
      <div className="lws-panel w-full max-w-md p-8 lws-fade-in-up">
        <div className="mb-8 text-center">
          <span className="lws-label-tag justify-center">Welcome back</span>
          <h1 className="lws-h1">Learn With Sasha</h1>
          <p className="lws-small mt-2">Sign in with your Sasha account</p>
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
  );
}
