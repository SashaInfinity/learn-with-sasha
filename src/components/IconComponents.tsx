import React from 'react';

/**
 * Shared SVG icon set. All icons spread `...props` so callers can pass
 * `className`, `style`, `aria-hidden`, etc. They are decorative by default;
 * pair them with text labels or `aria-label`s on the parent control.
 */

const base = (className?: string, props?: React.SVGProps<SVGSVGElement>) => ({
  ...props,
  className,
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const UploadIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
  </svg>
);

export const MicIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M12 18.75a6 6 0 0 0 6-6v-1.5a6 6 0 0 0-12 0v1.5a6 6 0 0 0 6 6Z" />
    <path d="M19.5 14.25v.75a7.5 7.5 0 0 1-7.5 7.5h-.008a7.5 7.5 0 0 1-7.492-7.5v-.75" />
    <path d="M12 12.75a.75.75 0 0 0 .75-.75v-4.5a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 .75.75Z" />
  </svg>
);

export const StopIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    <path d="M9 9.563C9 9.254 9.254 9 9.563 9h4.874c.309 0 .563.254.563.563v4.874c0 .309-.254.563-.563.563H9.563C9.254 15 9 14.746 9 14.437V9.563Z" />
  </svg>
);

/** Paper-plane send glyph. */
export const SendIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />
  </svg>
);

/** Sparkles — Sasha's avatar glyph. */
export const SparklesIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
    <path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
  </svg>
);

export const BookOpenIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6-2.292m0 0v14.25" />
  </svg>
);

/** Wand2 (lucide) — the "Simplify this" glyph. Diagonal wand with sparkles. */
export const MagicWandIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8 19 13M17.8 6.2 19 5M3 21l9-9M12.2 6.2 11 5" />
    <path d="m15 4 1.4 1.4L15 6.8 13.6 5.4 15 4Z" />
  </svg>
);

export const PlusIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const TrashIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M10 11v6M14 11v6" />
  </svg>
);

export const CalculatorIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <rect width="16" height="20" x="4" y="2" rx="2" />
    <line x1="8" x2="16" y1="6" y2="6" />
    <line x1="16" x2="16" y1="14" y2="18" />
    <path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" />
  </svg>
);

/** Speaker icon (lucide volume-2 style). */
export const SpeakerIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M11 4.5 6 9H3v6h3l5 4.5z" />
    <path d="M15.5 8.5a5 5 0 0 1 0 7" />
    <path d="M18.5 5.5a9 9 0 0 1 0 13" />
  </svg>
);

/** Muted speaker icon (lucide volume-x style). */
export const SpeakerMutedIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M11 4.5 6 9H3v6h3l5 4.5z" />
    <line x1="22" x2="16" y1="9" y2="15" />
    <line x1="16" x2="22" y1="9" y2="15" />
  </svg>
);

/** Play (triangle). */
export const PlayIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <polygon points="6 3 20 12 6 21 6 3" />
  </svg>
);

/** Pause (two bars). */
export const PauseIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

/** Square stop. */
export const StopSquareIcon = ({
  className,
  ...props
}: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

/** Hamburger menu. */
export const MenuIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <line x1="3" y1="6" x2="21" y2="6" />
    <line x1="3" y1="12" x2="21" y2="12" />
    <line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);

/** X / close. */
export const XIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/** Eye (lucide) — "show password" affordance. */
export const EyeIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/** Eye-off (lucide) — "hide password" affordance. */
export const EyeOffIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg {...base(className, props)}>
    <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-1.444 2.492" />
    <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
    <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.075 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.503-5.307" />
    <path d="m2 2 20 20" />
  </svg>
);
