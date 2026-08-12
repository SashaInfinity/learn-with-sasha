/**
 * Landing / hero screen. Sasha is rendered centre-screen by the persistent
 * SashaStage (hero mode); the text sits in two flanking columns on desktop
 * and stacks above her on mobile (with a translucent backdrop for legibility).
 */
import { useEffect } from 'react';
import { useVoice } from '../context/VoiceContext';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { setMood, speak, muted } = useVoice();

  useEffect(() => {
    setMood('wave');
    const t = setTimeout(() => {
      if (!muted) speak("Hi! I'm Sasha. Let's learn together.");
    }, 600);
    const t2 = setTimeout(() => setMood('idle'), 4000);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [setMood, speak, muted]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        {/* Mobile backdrop so text stays legible over Sasha. */}
        <div className="lws-landing-card lg:!bg-transparent lg:!border-none lg:!shadow-none lg:!p-0">
          <div className="text-center lg:text-right">
            <span className="inline-block text-xs font-bold text-amber-600 uppercase tracking-widest mb-3">
              AI Math Tutor
            </span>
            <div className="flex items-center justify-center lg:justify-end gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-2xl border border-amber-500/20">
                ∞
              </div>
            </div>
            <h1 className="font-bold text-slate-900 tracking-tight" style={{ fontSize: 'clamp(34px, 6vw, 60px)', lineHeight: 1.1 }}>
              Learn
              <br />
              <span className="text-amber-600">With Sasha</span>
            </h1>
          </div>
        </div>

        {/* Centre reserve for the 3D character (desktop). */}
        <div
          className="hidden lg:block"
          style={{ width: 'clamp(220px, 26vw, 340px)', height: 'clamp(320px, 50vh, 560px)' }}
          aria-hidden
        />

        <div className="text-center lg:text-left">
          <p className="text-slate-600 max-w-md mx-auto lg:mx-0" style={{ fontSize: 'clamp(15px, 1.6vw, 18px)' }}>
            Your personal AI tutor for math. Explore concepts through your favourite
            topics, solve problems step by step, and hear Sasha explain — voice and all.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 lg:justify-start justify-center">
            <button
              onClick={onGetStarted}
              className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold px-8 py-3.5 rounded-xl shadow-sm hover:opacity-95 transition-all"
              style={{ fontSize: '15px' }}
            >
              Get Started
            </button>
          </div>
          <p className="text-xs text-slate-400 mt-4">Lessons tailored to you · saved automatically</p>
        </div>
      </div>

      {/* Mobile CTA at the bottom. */}
      <div className="mt-12 lg:hidden">
        <button
          onClick={onGetStarted}
          className="bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold px-8 py-3.5 rounded-xl shadow-sm"
          style={{ fontSize: '15px' }}
        >
          Get Started
        </button>
      </div>
    </div>
  );
}
