import { describe, it, expect, beforeEach } from 'vitest';
import {
  entranceState,
  hasSeenEntrance,
  markEntranceSeen,
  ENTRANCE_SEEN_KEY,
  LAUNCH_END,
  BURST_END,
  SETTLE_END,
} from '../entrance';
import type { EntranceInput } from '../types';

function input(over: Partial<EntranceInput> = {}): EntranceInput {
  return {
    elapsed: 0,
    loadProgress: 0,
    gateReleasedAt: null,
    reducedMotion: false,
    skip: false,
    ...over,
  };
}

describe('entranceState — phases', () => {
  it('starts in launch', () => {
    expect(entranceState(input({ elapsed: 0 })).phase).toBe('launch');
  });

  it('enters burst after the launch window', () => {
    expect(entranceState(input({ elapsed: 0.9, gateReleasedAt: 0.1 })).phase).toBe(
      'burst',
    );
  });

  it('enters reveal once the gate has released', () => {
    expect(entranceState(input({ elapsed: 1.4, gateReleasedAt: 0.1 })).phase).toBe(
      'reveal',
    );
  });

  it('reaches done after the settle window', () => {
    const s = entranceState(input({ elapsed: SETTLE_END + 1, gateReleasedAt: 0.1 }));
    expect(s.phase).toBe('done');
    expect(s.complete).toBe(true);
  });

  it('reports rocket progress ramping 0..1 across launch', () => {
    expect(entranceState(input({ elapsed: 0 })).rocketProgress).toBeCloseTo(0, 3);
    expect(entranceState(input({ elapsed: 0.8 })).rocketProgress).toBeCloseTo(1, 3);
  });
});

describe('entranceState — load gating', () => {
  it('freezes at the end of burst while the model is not ready', () => {
    const a = entranceState(input({ elapsed: 5, gateReleasedAt: null }));
    const b = entranceState(input({ elapsed: 20, gateReleasedAt: null }));
    expect(a.phase).toBe('burst');
    expect(b.phase).toBe('burst');
    expect(a.t).toBeCloseTo(BURST_END, 5);
    expect(b.t).toBeCloseTo(BURST_END, 5);
  });

  it('resumes from the burst boundary after a long hold, not from wall time', () => {
    // Held until t=10s, then 0.4s of real time passes.
    const s = entranceState(input({ elapsed: 10.4, gateReleasedAt: 10 }));
    expect(s.t).toBeCloseTo(BURST_END + 0.4, 5);
    expect(s.phase).toBe('reveal');
  });

  it('does not shorten the timeline when the model is ready early', () => {
    // Warm cache: ready at 0.05s. At elapsed 0.4 we must still be in launch.
    const s = entranceState(input({ elapsed: 0.4, gateReleasedAt: 0.05 }));
    expect(s.phase).toBe('launch');
    expect(s.t).toBeCloseTo(0.4, 5);
  });

  it('never rewinds when the gate releases before burst', () => {
    const s = entranceState(input({ elapsed: 1.0, gateReleasedAt: 0.2 }));
    expect(s.t).toBeCloseTo(1.0, 5);
  });
});

describe('entranceState — reveal ramp', () => {
  it('keeps the model invisible at the very start of launch', () => {
    expect(entranceState(input({ elapsed: 0 })).modelOpacity).toBe(0);
  });

  it('ramps opacity to full by the end of reveal', () => {
    const s = entranceState(input({ elapsed: 1.9, gateReleasedAt: 0 }));
    expect(s.modelOpacity).toBeCloseTo(1, 2);
  });

  it('scales from small to full across reveal', () => {
    const early = entranceState(input({ elapsed: 1.15, gateReleasedAt: 0 })).modelScale;
    const late = entranceState(input({ elapsed: 1.85, gateReleasedAt: 0 })).modelScale;
    expect(early).toBeLessThan(0.6);
    expect(late).toBeGreaterThan(0.9);
  });

  it('flares during burst and fades by the end of reveal', () => {
    expect(
      entranceState(input({ elapsed: 0.95, gateReleasedAt: 0 })).flare,
    ).toBeGreaterThan(0.4);
    expect(entranceState(input({ elapsed: 1.9, gateReleasedAt: 0 })).flare).toBeCloseTo(
      0,
      1,
    );
  });
});

describe('entranceState — landing transforms', () => {
  it('starts high and descends to the ground across launch', () => {
    const start = entranceState(input({ elapsed: 0 }));
    const end = entranceState(input({ elapsed: LAUNCH_END }));
    expect(start.descentY).toBeGreaterThan(5);
    expect(end.descentY).toBeCloseTo(0, 5);
  });

  it('holds a nose-down tilt during descent that settles to upright', () => {
    const start = entranceState(input({ elapsed: 0 })).tilt;
    const end = entranceState(input({ elapsed: LAUNCH_END })).tilt;
    expect(start).toBeGreaterThan(0.05);
    expect(end).toBeCloseTo(0, 5);
  });

  it('fires the thruster glow during descent and cuts it after touch-down', () => {
    const mid = entranceState(input({ elapsed: 0.4 })).engineGlow;
    const landed = entranceState(input({ elapsed: 1.2, gateReleasedAt: 0 })).engineGlow;
    expect(mid).toBeGreaterThan(0.3);
    expect(landed).toBeCloseTo(0, 5);
  });

  it('produces a touch-down dust burst that peaks then fades', () => {
    const pre = entranceState(input({ elapsed: 0.5 })).dust;
    const peak = entranceState(input({ elapsed: BURST_END, gateReleasedAt: 0 })).dust;
    const after = entranceState(input({ elapsed: 1.9, gateReleasedAt: 0 })).dust;
    expect(pre).toBe(0);
    expect(peak).toBeGreaterThan(0.9);
    expect(after).toBeCloseTo(0, 1);
  });

  it('sits on the ground with full dust while gated at touch-down', () => {
    const s = entranceState(input({ elapsed: 5, gateReleasedAt: null }));
    expect(s.descentY).toBe(0);
    expect(s.tilt).toBe(0);
    expect(s.dust).toBe(1);
    expect(s.engineGlow).toBe(0);
  });
});

describe('entranceState — skip and reduced motion', () => {
  it('skip jumps straight to done at full opacity', () => {
    const s = entranceState(input({ elapsed: 0, skip: true }));
    expect(s.phase).toBe('done');
    expect(s.modelOpacity).toBe(1);
    expect(s.modelScale).toBe(1);
    expect(s.complete).toBe(true);
  });

  it('reduced motion skips the rocket and fades the model in quickly', () => {
    const mid = entranceState(
      input({ elapsed: 0.1, gateReleasedAt: 0, reducedMotion: true }),
    );
    expect(mid.rocketProgress).toBe(0);
    expect(mid.flare).toBe(0);
    expect(mid.modelScale).toBe(1);
    expect(mid.modelOpacity).toBeGreaterThan(0);
    expect(mid.modelOpacity).toBeLessThan(1);

    const done = entranceState(
      input({ elapsed: 0.3, gateReleasedAt: 0, reducedMotion: true }),
    );
    expect(done.modelOpacity).toBeCloseTo(1, 2);
    expect(done.complete).toBe(true);
  });

  it('reduced motion still waits for the model to be ready', () => {
    const s = entranceState(
      input({ elapsed: 5, gateReleasedAt: null, reducedMotion: true }),
    );
    expect(s.modelOpacity).toBe(0);
    expect(s.complete).toBe(false);
  });
});

describe('replay flag', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('is false before the entrance has played', () => {
    expect(hasSeenEntrance()).toBe(false);
  });

  it('is true after marking it seen', () => {
    markEntranceSeen();
    expect(hasSeenEntrance()).toBe(true);
    expect(sessionStorage.getItem(ENTRANCE_SEEN_KEY)).toBe('1');
  });
});
