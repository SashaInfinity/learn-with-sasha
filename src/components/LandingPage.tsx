/**
 * Landing / hero screen. The centre column is registered as Sasha's anchor, so
 * the 3D character is placed by layout rather than by hardcoded constants.
 *
 * Three-column hero on desktop (headline | Sasha | supporting copy + CTA),
 * stacked on mobile with Sasha as a centred illustration between the headline
 * and the copy. Below the hero: a "How Sasha helps you learn" card section,
 * a topics strip, and a short about block — the targets of the header's
 * How It Works · Topics · About links.
 */
import { useEffect, useRef } from 'react';
import { useVoice } from '../context/VoiceContext';
import { useSashaAnchor } from '../hooks/useSashaAnchor';
import {
  BookOpenIcon,
  CalculatorIcon,
  SpeakerIcon,
  SparklesIcon,
} from './IconComponents';

interface LandingPageProps {
  onGetStarted: () => void;
}

const BENEFITS = [
  { icon: BookOpenIcon, label: 'Explore concepts your way' },
  { icon: CalculatorIcon, label: 'Solve problems step by step' },
  { icon: SpeakerIcon, label: "Learn with Sasha's voice" },
];

const HOW_CARDS = [
  {
    icon: BookOpenIcon,
    title: 'Explore',
    body: 'Choose a math topic that matters to you — from arithmetic to calculus.',
  },
  {
    icon: CalculatorIcon,
    title: 'Solve',
    body: 'Work through problems step by step with Sasha guiding every move.',
  },
  {
    icon: SpeakerIcon,
    title: 'Listen',
    body: 'Hear Sasha explain the solution out loud, in her own voice.',
  },
];

const TOPICS = [
  'Arithmetic',
  'Algebra',
  'Geometry',
  'Trigonometry',
  'Calculus',
  'Statistics',
  'Fractions',
  'Word Problems',
];

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { setMood, speak, muted } = useVoice();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  // fitY 0.92 keeps the whole figure (head included) inside the anchor box;
  // fillX 0.8 leaves horizontal breathing room so she never crowds the
  // headline; max 1.7 caps her scale on very tall viewports.
  useSashaAnchor(anchorRef, 'landing', { fillY: 0.92, fillX: 0.8, max: 1.7 });

  useEffect(() => {
    setMood('wave');
    const t = setTimeout(() => {
      if (!muted) speak("Hi! I'm Sasha. Let's learn together.");
    }, 1400); // after the entrance reveal settles
    const t2 = setTimeout(() => setMood('idle'), 4600);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [setMood, speak, muted]);

  return (
    <div className="lws-landing" id="top">
      <div className="lws-landing-hero">
        <div className="lws-landing-grid">
          {/* Left column — eyebrow, brand mark, headline. */}
          <div className="lws-landing-card lws-landing-left">
            <div className="lws-landing-eyebrow">
              <span className="lws-brand-mark lws-brand-mark-sm" aria-hidden>
                <SparklesIcon width={14} height={14} />
              </span>
              <span className="lws-rise" style={{ animationDelay: '1.2s' }}>
                AI Math Tutor
              </span>
            </div>
            <h1 className="lws-landing-title">
              <span className="lws-rise" style={{ animationDelay: '1.3s' }}>
                Learn
              </span>
              <br />
              <span
                className="lws-rise text-amber-600"
                style={{ animationDelay: '1.42s' }}
              >
                With Sasha
              </span>
            </h1>
            <p className="lws-landing-sub lws-rise" style={{ animationDelay: '1.54s' }}>
              Personalized math learning that feels like having a tutor beside you.
            </p>
          </div>

          {/* Centre column — Sasha's anchor. The stage measures this box. */}
          <div ref={anchorRef} className="lws-landing-anchor" aria-hidden />

          {/* Right column — value prop, benefits, CTA, reassurance. */}
          <div className="lws-landing-card lws-landing-right">
            <p className="lws-landing-value lws-rise" style={{ animationDelay: '1.6s' }}>
              Your personal AI math tutor, available whenever you need help.
            </p>
            <ul className="lws-landing-benefits">
              {BENEFITS.map(({ icon: Icon, label }, i) => (
                <li
                  key={label}
                  className="lws-rise lws-landing-benefit"
                  style={{ animationDelay: `${1.7 + i * 0.08}s` }}
                >
                  <span className="lws-landing-benefit-icon" aria-hidden>
                    <Icon width={18} height={18} />
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <div className="lws-rise" style={{ animationDelay: '1.98s' }}>
              <button onClick={onGetStarted} className="lws-cta lws-lift">
                Get Started <span aria-hidden>→</span>
              </button>
            </div>
            <p
              className="lws-rise lws-landing-reassure"
              style={{ animationDelay: '2.1s' }}
            >
              Personalized lessons · Progress saved automatically
            </p>
          </div>
        </div>
      </div>

      {/* Curved transition into the lower content. */}
      <div className="lws-wave-divider" aria-hidden>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none">
          <path d="M0 40 C 360 80, 1080 0, 1440 40 L 1440 80 L 0 80 Z" />
        </svg>
      </div>

      {/* Lower content — the header links anchor-scroll here. */}
      <main className="lws-landing-lower">
        <section id="how" className="lws-section">
          <h2 className="lws-section-title">How Sasha helps you learn</h2>
          <p className="lws-section-sub">
            Three steps, repeated every session — until the idea finally clicks.
          </p>
          <div className="lws-how-grid">
            {HOW_CARDS.map(({ icon: Icon, title, body }) => (
              <article key={title} className="lws-surface lws-lift lws-how-card">
                <span className="lws-how-icon" aria-hidden>
                  <Icon width={22} height={22} />
                </span>
                <h3 className="lws-how-title">
                  {title}{' '}
                  <span className="text-slate-300" aria-hidden>
                    →
                  </span>
                </h3>
                <p className="lws-how-body">{body}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="topics" className="lws-section">
          <h2 className="lws-section-title">Topics Sasha covers</h2>
          <p className="lws-section-sub">
            Pick one and she'll tailor every example to it.
          </p>
          <div className="lws-topics">
            {TOPICS.map((topic) => (
              <span key={topic} className="lws-topic-chip">
                {topic}
              </span>
            ))}
          </div>
        </section>

        <section id="about" className="lws-section lws-about">
          <div className="lws-about-copy">
            <h2 className="lws-section-title">A tutor that remembers you</h2>
            <p className="lws-section-sub">
              Sasha keeps your progress, your favourite topics and your pace — so every
              lesson picks up exactly where the last one left off.
            </p>
          </div>
          <button onClick={onGetStarted} className="lws-cta lws-lift">
            Get Started <span aria-hidden>→</span>
          </button>
        </section>
      </main>
    </div>
  );
}
