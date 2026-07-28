/**
 * Device quality tiering. Keeps the render cost proportional to the hardware:
 * phones and low-core machines get fewer lights, a lower pixel ratio and a
 * harder idle frame cap.
 */
import type { DeviceHints, QualityTier, TierSettings } from './types';

/** Viewports at or below this width are treated as mobile. */
const MOBILE_MAX_WIDTH = 768;
/** GB of RAM below which we downgrade regardless of viewport. */
const MIN_DEVICE_MEMORY = 4;
/** Logical cores below which we downgrade regardless of viewport. */
const MIN_CORES = 4;

/** Pure tier selection — injected hints keep this testable. */
export function tierFromHints(hints: DeviceHints): QualityTier {
  if (hints.viewportWidth <= MOBILE_MAX_WIDTH) return 'low';
  if (hints.deviceMemory !== undefined && hints.deviceMemory < MIN_DEVICE_MEMORY) {
    return 'low';
  }
  if (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency < MIN_CORES) {
    return 'low';
  }
  return 'high';
}

/** Reads the live browser hints and picks a tier. */
export function detectTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return tierFromHints({
    viewportWidth: window.innerWidth,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  });
}

/** Render settings for a tier. */
export function tierSettings(tier: QualityTier): TierSettings {
  if (tier === 'low') {
    return { maxPixelRatio: 1.5, lights: 'reduced', ground: false, idleFps: 30 };
  }
  return { maxPixelRatio: 2, lights: 'full', ground: true, idleFps: 60 };
}

/**
 * JS-side reduced-motion check. The global CSS override in index.css only
 * affects CSS animations — rAF-driven motion has to opt out explicitly.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
