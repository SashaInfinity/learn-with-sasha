/**
 * Shown when WebGL is unavailable or the model cannot load. The app stays
 * fully usable — previously the stage silently rendered nothing.
 */
interface SashaFallbackProps {
  visible: boolean;
}

export default function SashaFallback({ visible }: SashaFallbackProps) {
  if (!visible) return null;
  return (
    <div className="lws-sasha-fallback" aria-hidden>
      <img src="/logo.png" alt="" width={160} height={160} />
    </div>
  );
}
