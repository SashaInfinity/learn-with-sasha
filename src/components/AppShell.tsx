/**
 * AppShell: top-level layout with auth gating.
 *
 *   Landing -> (not authed) AuthScreen -> (authed) ChatHome
 *
 * Navigation is simple state (no router lib). The 3D Sasha stage is mounted
 * once here (Part D) so it never tears down across views.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LandingPage from './LandingPage';
import AuthScreen from './AuthScreen';
import ChatHome from './ChatHome';
import SashaStage from './SashaStage';

type StageMode = 'lesson' | 'hidden';

export default function AppShell() {
  const { user, loading, logout } = useAuth();
  const [showLanding, setShowLanding] = useState(true);

  // The character is shown only once the student is in the app proper.
  const stageMode: StageMode = !showLanding && user ? 'lesson' : 'hidden';

  // Initial session check in flight — show the background only.
  if (loading) {
    return (
      <div className="lws-root">
        <SashaStage mode="hidden" />
      </div>
    );
  }

  // The single persistent 3D canvas. Mounted once for the whole app.
  const stage = <SashaStage mode={stageMode} />;

  // Landing is shown first; "Get Started" reveals the auth gate.
  if (showLanding) {
    return (
      <div className="lws-root">
        {stage}
        <LandingPage onGetStarted={() => setShowLanding(false)} />
      </div>
    );
  }

  // Past landing but not signed in -> login.
  if (!user) {
    return (
      <div className="lws-root">
        {stage}
        <AuthScreen />
      </div>
    );
  }

  // Authenticated: the chat-first home. A small top bar carries brand + sign-out.
  return (
    <div className="lws-root">
      {stage}
      <header
        className="sticky top-0 z-30 backdrop-blur-md border-b"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.75)',
          borderColor: 'var(--lws-glass-border)',
        }}
      >
        <div className="lws-container flex items-center justify-between py-3">
          <span
            className="lws-h3 cursor-pointer select-none"
            style={{ color: 'var(--lws-primary)' }}
            onClick={() => setShowLanding(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setShowLanding(true);
            }}
          >
            Learn With Sasha
          </span>
          <div className="flex items-center gap-4">
            <span className="lws-small hidden sm:inline">{user.display_name}</span>
            <button
              onClick={() => void logout()}
              className="lws-btn lws-btn-ghost lws-btn-sm"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <ChatHome />
    </div>
  );
}
