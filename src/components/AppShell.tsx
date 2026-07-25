/**
 * AppShell: top-level layout with auth gating, navigation, and view routing.
 *
 *  Landing -> (not authed) AuthScreen -> (authed) main app with nav:
 *    Learn (LessonView) | Solve (MathSolver) | Sign out
 *
 * Navigation is simple state (no router lib) since the app has only a few views.
 */
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import LandingPage from './LandingPage';
import AuthScreen from './AuthScreen';
import LessonView from './LessonView';
import MathSolver from './MathSolver';
import AnimatedBackground from './AnimatedBackground';

type View = 'learn' | 'solve';

const NAV: Array<{ key: View; label: string }> = [
  { key: 'learn', label: 'Learn' },
  { key: 'solve', label: 'Solve' },
];

export default function AppShell() {
  const { user, loading, logout } = useAuth();
  const [showLanding, setShowLanding] = useState(true);
  const [view, setView] = useState<View>('learn');

  // While the initial session check is in flight, show the background only.
  if (loading) {
    return (
      <main>
        <AnimatedBackground />
      </main>
    );
  }

  // Landing is shown first to everyone; "Get Started" reveals the auth gate.
  if (showLanding) {
    return (
      <main>
        <AnimatedBackground />
        <LandingPage onGetStarted={() => setShowLanding(false)} />
      </main>
    );
  }

  // Past landing but not signed in -> show login.
  if (!user) {
    return (
      <main>
        <AnimatedBackground />
        <AuthScreen />
      </main>
    );
  }

  // Authenticated main app.
  return (
    <main>
      <AnimatedBackground />
      {/* Top nav */}
      <nav
        className="sticky top-0 z-20 backdrop-blur-md border-b"
        style={{
          backgroundColor: 'rgba(17, 24, 39, 0.7)',
          borderColor: 'var(--color-border-surface)',
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span
              className="font-bold text-xl themed-title cursor-pointer"
              onClick={() => setShowLanding(true)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setShowLanding(true);
              }}
            >
              Learn With Sasha
            </span>
            <div className="flex gap-1">
              {NAV.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setView(item.key)}
                  className="px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{
                    backgroundColor:
                      view === item.key ? 'var(--color-primary)' : 'transparent',
                    color: view === item.key ? 'white' : 'var(--color-text-accent)',
                  }}
                  aria-current={view === item.key ? 'page' : undefined}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400 hidden sm:inline">
              {user.display_name}
            </span>
            <button
              onClick={() => void logout()}
              className="text-sm text-gray-300 hover:text-white px-3 py-2 rounded-lg transition-colors hover:bg-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      {view === 'learn' && <LessonView />}
      {view === 'solve' && <MathSolver />}
    </main>
  );
}
