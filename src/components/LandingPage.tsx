/**
 * Landing / hero screen. The centre column is registered as Sasha's anchor, so
 * the 3D character is placed by layout rather than by hardcoded constants.
 */
import { useEffect, useRef } from 'react';
import { useVoice } from '../context/VoiceContext';
import { useSashaAnchor } from '../hooks/useSashaAnchor';

interface LandingPageProps {
  onGetStarted: () => void;
}

const HEADLINE_WORDS = ['Learn', 'With', 'Sasha'];

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { setMood, speak, muted } = useVoice();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  useSashaAnchor(anchorRef, 'landing', { fillY: 0.95, max: 1.9 });

  useEffect(() => {
    setMood('wave');
    const t = setTimeout(() => {
      if (!muted) speak("Hi! I'm Sasha. Let's learn together.");
    }, 1400); // after the rocket burst, not during it
    const t2 = setTimeout(() => setMood('idle'), 4600);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [setMood, speak, muted]);

  return (
    <div className="lws-landing">
      <div className="lws-landing-grid">
        <div className="lws-landing-card lg:!bg-transparent lg:!border-none lg:!shadow-none lg:!p-0">
          <div className="text-center lg:text-right">
            <span
              className="lws-rise inline-block text-xs font-bold text-amber-600 uppercase tracking-widest mb-3"
              style={{ animationDelay: '1.2s' }}
            >
              AI Math Tutor
            </span>
            <h1 className="lws-landing-title">
              {HEADLINE_WORDS.map((word, i) => (
                <span
                  key={word}
                  className="lws-rise inline-block"
                  style={{ animationDelay: `${1.3 + i * 0.09}s` }}
                >
                  {word === 'Learn' ? (
                    word
                  ) : (
                    <span className="text-amber-600">{word}</span>
                  )}
                  {i < HEADLINE_WORDS.length - 1 && ' '}
                </span>
              ))}
            </h1>
          </div>
        </div>

        {/* Sasha's anchor. The stage measures this box every frame. */}
        <div ref={anchorRef} className="lws-landing-anchor" aria-hidden />

        <div className="text-center lg:text-left">
          <p
            className="lws-rise text-slate-600 max-w-md mx-auto lg:mx-0"
            style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', animationDelay: '1.6s' }}
          >
            Your personal AI tutor for math. Explore concepts through your favourite
            topics, solve problems step by step, and hear Sasha explain — voice and all.
          </p>
          <div
            className="lws-rise mt-8 flex flex-wrap gap-3 lg:justify-start justify-center"
            style={{ animationDelay: '1.75s' }}
          >
            <button onClick={onGetStarted} className="lws-cta lws-lift">
              Get Started
            </button>
          </div>
          <p
            className="lws-rise text-xs text-slate-400 mt-4"
            style={{ animationDelay: '1.9s' }}
          >
            Lessons tailored to you · saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
