import { describe, it, expect } from 'vitest';
import { pose, FALLBACK_ANCHOR } from '../poseDirector';
import type { AnchorFit, ModelMetrics, PoseInput } from '../types';

const metrics: ModelMetrics = {
  center: { x: 0, y: 0.5, z: 0 },
  size: { x: 1, y: 2, z: 1 },
  baseScale: 1.4,
};

const anchor: AnchorFit = {
  center: { x: 1, y: 0.5, z: 0 },
  scale: 1,
  visible: true,
};

function input(over: Partial<PoseInput> = {}): PoseInput {
  return {
    mode: 'hero',
    mood: 'idle',
    elapsed: 0,
    pointer: { x: 0, y: 0 },
    anchor,
    amplitude: 0,
    reducedMotion: false,
    entranceScale: 1,
    entranceOpacity: 1,
    ...over,
  };
}

describe('pose — base placement', () => {
  it('offsets the position by the scaled model centre so the anchor centres the model', () => {
    const p = pose(input({ elapsed: 0 }), metrics);
    // x has no idle component at elapsed 0 with a centred pointer.
    expect(p.position.x).toBeCloseTo(anchor.center.x - metrics.center.x * p.scale, 5);
  });

  it('scales by baseScale * anchor scale', () => {
    const p = pose(input({ elapsed: 0, reducedMotion: true }), metrics);
    expect(p.scale).toBeCloseTo(metrics.baseScale * anchor.scale, 5);
  });

  it('falls back to the centre anchor when none is registered', () => {
    const p = pose(input({ anchor: null, reducedMotion: true }), metrics);
    const expected = pose(input({ anchor: FALLBACK_ANCHOR, reducedMotion: true }), metrics);
    expect(p.position.x).toBeCloseTo(expected.position.x, 6);
  });

  it('is fully transparent in hidden mode', () => {
    expect(pose(input({ mode: 'hidden' }), metrics).opacity).toBe(0);
  });

  it('is transparent when the anchor has scrolled off screen', () => {
    const offscreen: AnchorFit = { ...anchor, visible: false };
    expect(pose(input({ anchor: offscreen }), metrics).opacity).toBe(0);
  });
});

describe('pose — idle layer', () => {
  it('breathes: y position varies over time', () => {
    const a = pose(input({ elapsed: 0 }), metrics).position.y;
    const b = pose(input({ elapsed: 1.3 }), metrics).position.y;
    expect(a).not.toBeCloseTo(b, 4);
  });

  it('tracks the pointer in yaw', () => {
    const left = pose(input({ pointer: { x: -1, y: 0 } }), metrics).rotation.y;
    const right = pose(input({ pointer: { x: 1, y: 0 } }), metrics).rotation.y;
    expect(right).toBeGreaterThan(left);
  });

  it('produces no motion at all under reduced motion', () => {
    const a = pose(input({ elapsed: 0, reducedMotion: true }), metrics);
    const b = pose(input({ elapsed: 7.7, reducedMotion: true, pointer: { x: 1, y: 1 } }), metrics);
    expect(a.position.y).toBeCloseTo(b.position.y, 6);
    expect(a.rotation.y).toBeCloseTo(b.rotation.y, 6);
    expect(a.rotation.x).toBeCloseTo(b.rotation.x, 6);
    expect(a.rotation.z).toBeCloseTo(b.rotation.z, 6);
  });
});

describe('pose — mood layer', () => {
  it('wave rolls the model', () => {
    const idle = pose(input({ mood: 'idle', elapsed: 0.2 }), metrics).rotation.z;
    const wave = pose(input({ mood: 'wave', elapsed: 0.2 }), metrics).rotation.z;
    expect(Math.abs(wave)).toBeGreaterThan(Math.abs(idle));
  });

  it('thinking pitches the model downward', () => {
    expect(pose(input({ mood: 'thinking', elapsed: 0 }), metrics).rotation.x).toBeGreaterThan(0.1);
  });

  it('attentive leans forward less than thinking', () => {
    const attentive = pose(input({ mood: 'attentive', elapsed: 0 }), metrics).rotation.x;
    const thinking = pose(input({ mood: 'thinking', elapsed: 0 }), metrics).rotation.x;
    expect(attentive).toBeGreaterThan(0);
    expect(attentive).toBeLessThan(thinking);
  });

  it('celebrate hops upward', () => {
    const idle = pose(input({ mood: 'idle', elapsed: 0.2 }), metrics).position.y;
    const hop = pose(input({ mood: 'celebrate', elapsed: 0.2 }), metrics).position.y;
    expect(hop).toBeGreaterThan(idle);
  });

  it('shake oscillates yaw fast', () => {
    const a = pose(input({ mood: 'shake', elapsed: 0.0 }), metrics).rotation.y;
    const b = pose(input({ mood: 'shake', elapsed: 0.09 }), metrics).rotation.y;
    expect(Math.abs(a - b)).toBeGreaterThan(0.05);
  });

  it('suppresses mood motion under reduced motion', () => {
    const a = pose(input({ mood: 'celebrate', elapsed: 0.2, reducedMotion: true }), metrics);
    const b = pose(input({ mood: 'idle', elapsed: 0.2, reducedMotion: true }), metrics);
    expect(a.position.y).toBeCloseTo(b.position.y, 6);
    expect(a.rotation.z).toBeCloseTo(b.rotation.z, 6);
  });
});

describe('pose — voice layer', () => {
  it('adds yaw wobble proportional to amplitude', () => {
    const quiet = pose(input({ mood: 'talking', amplitude: 0, elapsed: 0.3 }), metrics).rotation.y;
    const loud = pose(input({ mood: 'talking', amplitude: 1, elapsed: 0.3 }), metrics).rotation.y;
    expect(loud).not.toBeCloseTo(quiet, 4);
  });

  it('ignores amplitude below the noise floor', () => {
    const a = pose(input({ mood: 'idle', amplitude: 0, elapsed: 0.3 }), metrics).rotation.z;
    const b = pose(input({ mood: 'idle', amplitude: 0.01, elapsed: 0.3 }), metrics).rotation.z;
    expect(a).toBeCloseTo(b, 6);
  });
});

describe('pose — entrance layer', () => {
  it('multiplies the scale by entranceScale', () => {
    const full = pose(input({ entranceScale: 1, reducedMotion: true }), metrics).scale;
    const half = pose(input({ entranceScale: 0.5, reducedMotion: true }), metrics).scale;
    expect(half).toBeCloseTo(full * 0.5, 5);
  });

  it('multiplies opacity by entranceOpacity', () => {
    expect(pose(input({ entranceOpacity: 0.25 }), metrics).opacity).toBeCloseTo(0.25, 5);
  });

  it('keeps the model centred on the anchor while scaling in', () => {
    const p = pose(input({ entranceScale: 0.35, elapsed: 0, reducedMotion: true }), metrics);
    expect(p.position.x).toBeCloseTo(anchor.center.x - metrics.center.x * p.scale, 5);
  });
});
