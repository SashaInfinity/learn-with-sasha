/**
 * Rocket entrance phase machine.
 *
 * The timeline is a pure function of elapsed time plus a single gate: it holds
 * at the end of `burst` until the model is decoded, then resumes from that
 * boundary. It is never shortened, so a warm cache cannot make it flash.
 */
import type { EntranceInput, EntranceState } from './types';

/** sessionStorage key controlling once-per-session replay. */
export const ENTRANCE_SEEN_KEY = 'lws:entranceSeen';

export const LAUNCH_END = 0.8;
export const BURST_END = 1.1;
export const REVEAL_END = 1.9;
export const SETTLE_END = 3.2;

/** Fade duration used instead of the rocket when reduced motion is on. */
const REDUCED_FADE = 0.25;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Ease-out cubic — the rocket decelerates as it reaches the burst point. */
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/** Slight overshoot so the reveal lands with a spring rather than a stop. */
function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

const DONE: EntranceState = {
  phase: 'done',
  t: SETTLE_END,
  rocketProgress: 0,
  flare: 0,
  modelScale: 1,
  modelOpacity: 1,
  complete: true,
};

export function entranceState(input: EntranceInput): EntranceState {
  if (input.skip) return DONE;

  const ready = input.gateReleasedAt !== null;

  if (input.reducedMotion) {
    // No rocket. Hold at zero opacity until the model is ready, then fade.
    if (!ready) {
      return {
        phase: 'burst',
        t: 0,
        rocketProgress: 0,
        flare: 0,
        modelScale: 1,
        modelOpacity: 0,
        complete: false,
      };
    }
    const since = input.elapsed - (input.gateReleasedAt as number);
    const p = clamp01(since / REDUCED_FADE);
    return {
      phase: p >= 1 ? 'done' : 'reveal',
      t: since,
      rocketProgress: 0,
      flare: 0,
      modelScale: 1,
      modelOpacity: p,
      complete: p >= 1,
    };
  }

  // Timeline time = wall time minus however long we sat at the burst gate.
  const holdDuration = !ready
    ? Math.max(0, input.elapsed - BURST_END)
    : Math.max(0, (input.gateReleasedAt as number) - BURST_END);
  const t = input.elapsed - holdDuration;

  const rocketProgress = easeOutCubic(clamp01(t / LAUNCH_END));

  // Flare peaks at the burst boundary and decays across reveal.
  let flare = 0;
  if (t >= LAUNCH_END && t < REVEAL_END) {
    flare = 1 - clamp01((t - LAUNCH_END) / (REVEAL_END - LAUNCH_END));
  }

  let modelScale = 0.35;
  let modelOpacity = 0;
  if (t >= BURST_END) {
    const p = clamp01((t - BURST_END) / (REVEAL_END - BURST_END));
    modelScale = 0.35 + easeOutBack(p) * 0.65;
    modelOpacity = clamp01(p * 1.4);
  }

  let phase: EntranceState['phase'] = 'launch';
  if (t >= SETTLE_END) phase = 'done';
  else if (t >= REVEAL_END) phase = 'settle';
  else if (t >= BURST_END) phase = 'reveal';
  else if (t >= LAUNCH_END) phase = 'burst';

  // While the gate is still closed the timeline is pinned to the burst
  // boundary; report `burst` rather than letting the boundary tick into
  // `reveal`, so the rocket keeps hovering with its progress ring.
  if (!ready) {
    return {
      phase: t >= LAUNCH_END ? 'burst' : phase,
      t,
      rocketProgress,
      flare,
      modelScale: 0.35,
      modelOpacity: 0,
      complete: false,
    };
  }

  return {
    phase,
    t,
    rocketProgress,
    flare,
    modelScale,
    modelOpacity,
    complete: phase === 'done',
  };
}

/** True when the entrance already played in this browser session. */
export function hasSeenEntrance(): boolean {
  try {
    return sessionStorage.getItem(ENTRANCE_SEEN_KEY) === '1';
  } catch {
    // Private mode / storage disabled — replay every load rather than crash.
    return false;
  }
}

/** Records that the entrance completed, so navigation doesn't replay it. */
export function markEntranceSeen(): void {
  try {
    sessionStorage.setItem(ENTRANCE_SEEN_KEY, '1');
  } catch {
    /* storage disabled — non-fatal */
  }
}
