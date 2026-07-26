/**
 * Landing / hero screen. Brand-styled; Sasha is rendered centre-screen by the
 * persistent SashaStage (hero mode), so the text sits in two flanking columns
 * on desktop and stacks above her on mobile.
 */
import { useEffect } from 'react';
import { useVoice } from '../context/VoiceContext';

interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { setMood, speak, muted } = useVoice();

  // A friendly wave + spoken greeting when the landing mounts.
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
    <div className="lws-container relative flex min-h-screen flex-col items-center justify-center py-16">
      {/* Sasha floats centre-stage behind this content (z-index 2); the text
          columns sit on either side of her on desktop. */}
      <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-8 lg:grid-cols-[1fr_auto_1fr]">
        <div className="lws-fade-in-up text-center lg:text-right">
          <span className="lws-label-tag lg:justify-end">AI Math Tutor</span>
          <h1 className="lws-h1" style={{ fontSize: 'clamp(40px, 7vw, 68px)' }}>
            Learn
            <br />
            With Sasha
          </h1>
        </div>

        {/* Centre column reserves space for the 3D character (she renders here). */}
        <div
          className="hidden lg:block"
          style={{ width: 'clamp(220px, 26vw, 340px)', height: 'clamp(320px, 50vh, 560px)' }}
          aria-hidden
        />

        <div className="lws-fade-in-up text-center lg:text-left" style={{ animationDelay: '0.15s' }}>
          <p className="lws-body" style={{ fontSize: 'clamp(16px, 1.8vw, 20px)' }}>
            Your personal AI tutor for math. Explore concepts through your favourite
            topics, solve problems step by step, and hear Sasha explain — voice and all.
          </p>
          <div className="mt-8 flex flex-wrap gap-3 lg:justify-start justify-center">
            <button onClick={onGetStarted} className="lws-btn lws-btn-fill" style={{ fontSize: '16px', padding: '16px 32px' }}>
              Get Started
            </button>
          </div>
          <p className="lws-small mt-4">Lessons tailored to you · saved automatically</p>
        </div>
      </div>

      {/* Mobile: Sasha is full-screen behind, so push the CTA to the bottom. */}
      <div className="mt-12 lg:hidden">
        <button onClick={onGetStarted} className="lws-btn lws-btn-fill" style={{ fontSize: '16px', padding: '16px 32px' }}>
          Get Started
        </button>
      </div>
    </div>
  );
}
