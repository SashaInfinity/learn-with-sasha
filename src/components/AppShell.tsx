/**
 * AppShell: top-level layout with auth gating + the persistent 3D Sasha stage.
 *
 *   Landing (hero) -> (not authed) AuthScreen (hero) -> (authed) dashboard
 *
 * The stage is mounted ONCE here and never unmounts, so the model glides
 * between the hero pose (landing/login) and the chat dock as the user moves
 * through the journey. Sasha's mood comes from the VoiceContext.
 */
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import LandingPage from './LandingPage';
import AuthScreen from './AuthScreen';
import ChatHome from './ChatHome';
import SashaStage, { type StageMode } from './SashaStage';
import Spinner from './Spinner';
import { PlusIcon } from './IconComponents';

/** Build initials (e.g. "Sharveshwar R" -> "SR") for the avatar circle. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppShell() {
  const { user, loading, logout } = useAuth();
  const { mood } = useVoice();
  const [showLanding, setShowLanding] = useState(true);
  const [wasAuthed, setWasAuthed] = useState(false);
  // The navbar "Generate Lesson" CTA opens the modal that lives in ChatHome;
  // a counter trigger lets us fire it from here without prop-drilling state.
  const [lessonTrigger, setLessonTrigger] = useState(0);

  const stageMode: StageMode = loading
    ? 'hidden'
    : showLanding
      ? 'hero'
      : !user
        ? 'hero'
        : 'lesson';

  useEffect(() => {
    setWasAuthed(!!user);
  }, [user, wasAuthed]);

  if (loading) {
    return (
      <div>
        <SashaStage mode="hidden" />
        <div className="lws-full-loader">
          <Spinner size="lg" />
          <p className="text-lg font-bold text-amber-600">Learn With Sasha</p>
        </div>
      </div>
    );
  }

  const stage = <SashaStage mode={stageMode} mood={mood} />;

  if (showLanding) {
    return (
      <div>
        {stage}
        <LandingPage onGetStarted={() => setShowLanding(false)} />
      </div>
    );
  }

  if (!user) {
    return (
      <div>
        {stage}
        <AuthScreen />
      </div>
    );
  }

  // Authenticated dashboard. Navbar matches the design: logo + wordmark +
  // "AI Tutor" chip on the left; gradient Generate-Lesson CTA + avatar +
  // name + sign-out on the right.
  return (
    <div className="min-h-screen">
      {stage}
      <header className="lws-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 lws-header-row">
          {/* Logo + wordmark + chip */}
          <button
            type="button"
            className="flex items-center gap-3"
            onClick={() => setShowLanding(true)}
            aria-label="Learn With Sasha — home"
          >
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xl border border-amber-500/20">
              ∞
            </div>
            <div className="flex items-center">
              <span className="font-bold text-lg text-slate-900 tracking-tight">
                Learn With <span className="text-amber-600">Sasha</span>
              </span>
              <span className="hidden sm:inline-block text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full ml-2">
                AI Tutor
              </span>
            </div>
          </button>

          {/* Right cluster */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLessonTrigger((n) => n + 1)}
              className="hidden md:flex items-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium px-4 py-2 rounded-xl shadow-sm hover:opacity-95 transition-all text-sm"
            >
              <PlusIcon width={16} height={16} />
              <span>Generate Lesson</span>
            </button>

            <div className="hidden md:block h-6 w-px bg-slate-200" />

            <div className="flex items-center gap-3 pl-1">
              <div className="w-9 h-9 rounded-full bg-slate-200 text-slate-600 font-semibold flex items-center justify-center text-sm border border-slate-300">
                {initials(user.display_name || user.username || user.email)}
              </div>
              <span className="hidden sm:inline text-sm font-semibold text-slate-700">
                {user.display_name}
              </span>
              <button
                onClick={() => void logout()}
                className="text-xs text-slate-500 hover:text-slate-800 font-medium bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <ChatHome lessonTrigger={lessonTrigger} />
    </div>
  );
}
