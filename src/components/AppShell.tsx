/**
 * AppShell: top-level layout with auth gating + the persistent 3D Sasha stage.
 *
 *   Landing (hero) -> (not authed) AuthScreen (hero) -> (authed) ChatHome (lesson)
 *
 * The stage is mounted ONCE here and never unmounts, so the model glides
 * between the hero pose (landing/login) and the chat dock as the user moves
 * through the journey. Sasha's mood comes from the VoiceContext (wave/thinking/
 * talking/celebrate/shake).
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import LandingPage from './LandingPage';
import AuthScreen from './AuthScreen';
import ChatHome from './ChatHome';
import SashaStage, { type StageMode } from './SashaStage';
import Spinner from './Spinner';

export default function AppShell() {
  const { user, loading, logout } = useAuth();
  const { mood } = useVoice();
  const [showLanding, setShowLanding] = useState(true);
  const [wasAuthed, setWasAuthed] = useState(false);

  // Mode: Sasha is visible (hero) from landing through login, then docked
  // (lesson) once the user reaches the chat.
  const stageMode: StageMode = loading
    ? 'hidden'
    : showLanding
      ? 'hero'
      : !user
        ? 'hero'
        : 'lesson';

  // A wave goodbye on logout.
  useEffect(() => {
    if (wasAuthed && !user) {
      // mood is controlled by VoiceContext; logout just resets to idle hero.
    }
    setWasAuthed(!!user);
  }, [user, wasAuthed]);

  if (loading) {
    return (
      <div className="lws-root">
        <SashaStage mode="hidden" />
        <div className="lws-full-loader">
          <Spinner size="lg" />
          <p className="lws-h3" style={{ color: 'var(--lws-primary)' }}>
            Learn With Sasha
          </p>
        </div>
      </div>
    );
  }

  const stage = <SashaStage mode={stageMode} mood={mood} />;

  if (showLanding) {
    return (
      <div className="lws-root">
        {stage}
        <LandingPage onGetStarted={() => setShowLanding(false)} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="lws-root">
        {stage}
        <AuthScreen />
      </div>
    );
  }

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
            <button onClick={() => void logout()} className="lws-btn lws-btn-ghost lws-btn-sm">
              Sign out
            </button>
          </div>
        </div>
      </header>
      <ChatHome />
    </div>
  );
}
