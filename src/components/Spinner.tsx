/**
 * Spinner — small reusable loading indicator in the brand style.
 *
 * Three sizes: 'sm' (inline, ~16px), 'md' (default, ~24px), 'lg' (page-level,
 * ~48px). Use `label` to add an accessible, visible status message.
 */
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
  /** Inline (default) or centered block layout for page-level loading. */
  block?: boolean;
}

const SIZES = { sm: 16, md: 24, lg: 48 } as const;

export default function Spinner({ size = 'md', label, block = false }: SpinnerProps) {
  const px = SIZES[size];
  const dot = (
    <span
      className="lws-spinner"
      style={{ width: px, height: px }}
      role="status"
      aria-label={label ?? 'Loading'}
    />
  );
  if (!block) return dot;
  return (
    <div className="lws-spinner-block" role="status" aria-live="polite">
      {dot}
      {label && <p className="lws-small lws-spinner-label">{label}</p>}
    </div>
  );
}
