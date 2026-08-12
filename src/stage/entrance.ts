/**
 * Landing entrance phase machine.
 *
 * The Sasha GLB lands like a rocket: it descends from above with a thruster
 * glow, touches down in a dust burst, then settles into its idle pose. The
 * timeline is a pure function of elapsed time plus a single gate: it holds at
 * the end of `burst` (touch-down) until the model is decoded, then resumes from
 * that boundary. It is never shortened, so a warm cache cannot make it flash.
 */
import type { EntranceInput, EntranceState } from './types';

/** sessionStorage key controlling once-per-session replay. */
export const ENTRANCE_SEEN_KEY = 'lws:entranceSeen';

export const LAUNCH_END = 0.8;
export const BURST_END = 1.1;
export const REVEAL_END = 1.9;
export const SETTLE_END = 3.2;

/** Fade duration used instead of the landing when reduced motion is on. */
const REDUCED_FADE = 0.25;

/** World height the model starts at before descending. */
const DESCENT_START = 8;
/** Nose-down pitch (radians) held while descending. */
const DESCENT_TILT = 0.15;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Ease-in cubic — the descent accelerates as it falls. */
const easeInCubic = (p: number) => p * p * p;
/** Ease-out cubic — used for the settle-out of the descent. */
const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3);

/** Slight overshoot so the reveal lands with a spring rather than a stop. */
function easeOutBack(p: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
}

/** Touch-down dust: peaks at the burst boundary, then decays across reveal. */
function dustFor(t: number): number {
  if (t < LAUNCH_END) return 0;
  if (t < BURST_END) return clamp01((t - LAUNCH_END) / (BURST_END - LAUNCH_END));
  if (t < REVEAL_END) return 1 - clamp01((t - BURST_END) / (REVEAL_END - BURST_END));
  return 0;
}

const DONE: EntranceState = {
  phase: 'done',
  t: SETTLE_END,
  rocketProgress: 0,
  flare: 0,
  modelScale: 1,
  modelOpacity: 1,
  complete: true,
  descentY: 0,
  tilt: 0,
  dust: 0,
  engineGlow: 0,
};

export function entranceState(input: EntranceInput): EntranceState {
  if (input.skip) return DONE;

  const ready = input.gateReleasedAt !== null;

  if (input.reducedMotion) {
    // No landing. Hold at zero opacity until the model is ready, then fade.
    if (!ready) {
      return {
        phase: 'burst',
        t: 0,
        rocketProgress: 0,
        flare: 0,
        modelScale: 1,
        modelOpacity: 0,
        complete: false,
        descentY: 0,
        tilt: 0,
        dust: 0,
        engineGlow: 0,
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
      descentY: 0,
      tilt: 0,
      dust: 0,
      engineGlow: 0,
    };
  }

  // Timeline time = wall time minus however long we sat at the burst gate.
  const holdDuration = !ready
    ? Math.max(0, input.elapsed - BURST_END)
    : Math.max(0, (input.gateReleasedAt as number) - BURST_END);
  const t = input.elapsed - holdDuration;

  // 0..1 descent progress (kept as rocketProgress for compatibility/tests).
  const rocketProgress = easeInCubic(clamp01(t / LAUNCH_END));

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

  // --- landing-driven transforms ---------------------------------------
  // The model drops from DESCENT_START to 0 across launch, eased so it
  // accelerates as it falls, then snaps to the ground at the burst boundary.
  const descentFrac = clamp01(t / LAUNCH_END);
  const descentY = (1 - easeInCubic(descentFrac)) * DESCENT_START;
  // Nose-down tilt held during descent, easing out to upright at touch-down.
  const tilt = DESCENT_TILT * (1 - easeOutCubic(descentFrac));
  // Thruster glow ramps up during descent and cuts at touch-down.
  const engineGlow =
    t < LAUNCH_END ? clamp01(descentFrac * 1.2) : Math.max(0, 1 - (t - LAUNCH_END) * 6);
  const dust = dustFor(t);
  // Fade the model in as it enters the frame (last ~30% of the descent).
  const descentOpacity = clamp01((descentFrac - 0.4) / 0.6);

  // While the gate is still closed the timeline is pinned to the burst
  // boundary: the model sits on the ground showing its dust burst, so the
  // load hold reads as a touch-down settling rather than a frozen rocket.
  if (!ready) {
    return {
      phase: t >= LAUNCH_END ? 'burst' : phase,
      t,
      rocketProgress,
      flare,
      modelScale: 0.35,
      modelOpacity: descentOpacity,
      complete: false,
      descentY: t >= LAUNCH_END ? 0 : descentY,
      tilt: t >= LAUNCH_END ? 0 : tilt,
      dust: t >= LAUNCH_END ? 1 : dust,
      engineGlow: t >= LAUNCH_END ? 0 : engineGlow,
    };
  }

  return {
    phase,
    t,
    rocketProgress,
    flare,
    modelScale,
    modelOpacity: Math.max(modelOpacity, descentOpacity),
    complete: phase === 'done',
    descentY,
    tilt,
    dust,
    engineGlow,
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
