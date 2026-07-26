/**
 * Landing / hero screen. Brand-styled to match sasha_lms's home: light theme,
 * Inter + Lexend Deca, brand-orange accents, the signature ease.
 */
interface LandingPageProps {
  onGetStarted: () => void;
}

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  return (
    <div className="lws-container flex min-h-screen flex-col items-center justify-center text-center py-16">
      <div className="lws-fade-in-up max-w-3xl">
        <span className="lws-label-tag justify-center">AI Math Tutor</span>
        <h1 className="lws-h1" style={{ fontSize: 'clamp(40px, 8vw, 76px)' }}>
          Learn With Sasha
        </h1>
        <p
          className="lws-body mt-6"
          style={{ fontSize: 'clamp(18px, 2.4vw, 24px)', color: 'var(--lws-dark)' }}
        >
          Your personal AI tutor for math.
        </p>
        <p
          className="lws-body mx-auto mt-4 max-w-xl"
          style={{ animation: 'lwsFadeInUp 0.6s var(--lws-ease) 0.15s both' }}
        >
          Explore math through your favourite topics, solve problems step by step,
          and chat with Sasha — lessons tailored just for you, saved automatically.
        </p>
        <div style={{ animation: 'lwsFadeInUp 0.6s var(--lws-ease) 0.3s both' }}>
          <button onClick={onGetStarted} className="lws-btn lws-btn-fill mt-10" style={{ fontSize: '16px', padding: '16px 32px' }}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}
