/**
 * SiteHeader — the marketing navigation shown above the landing and auth
 * screens. Logo + wordmark + "AI Tutor" chip on the left; section links
 * (How It Works · Topics · About) in the middle that anchor-scroll to the
 * landing's content sections.
 *
 * Distinct from the dashboard's authenticated `.lws-header` — this one uses
 * its own `.lws-site-header` class so the two never collide. On mobile the
 * section links collapse behind a menu button. The primary "Get Started"
 * CTAs live in the hero/about body, not in this bar.
 */
import { useState } from 'react';
import { SparklesIcon, MenuIcon, XIcon } from './IconComponents';

interface SiteHeaderProps {
  variant: 'landing' | 'auth';
}

const NAV_LINKS: { label: string; href: string }[] = [
  { label: 'How It Works', href: '#how' },
  { label: 'Topics', href: '#topics' },
  { label: 'About', href: '#about' },
];

export default function SiteHeader({ variant }: SiteHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="lws-site-header">
      <div className="lws-site-header-row">
        {/* Logo + wordmark + chip */}
        <a href="#top" className="lws-brand" aria-label="Learn With Sasha — home">
          <span className="lws-brand-mark" aria-hidden>
            <SparklesIcon width={20} height={20} />
          </span>
          <span className="lws-brand-text">
            <span className="font-bold text-lg text-slate-900 tracking-tight">
              Learn With <span className="text-amber-600">Sasha</span>
            </span>
            <span className="lws-chip">AI Tutor</span>
          </span>
        </a>

        {/* Center section links — landing only (auth has no body sections). */}
        {variant === 'landing' && (
          <nav className="lws-site-nav" aria-label="Section">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="lws-site-nav-link">
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* Mobile menu toggle (landing only — reveals section links). */}
        {variant === 'landing' && (
          <button
            type="button"
            className="lws-site-menubtn"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <XIcon width={22} height={22} />
            ) : (
              <MenuIcon width={22} height={22} />
            )}
          </button>
        )}
      </div>

      {/* Mobile dropdown of section links. */}
      {variant === 'landing' && menuOpen && (
        <nav className="lws-site-mobile-nav" aria-label="Section (mobile)">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="lws-site-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
