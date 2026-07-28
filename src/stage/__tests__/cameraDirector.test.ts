import { describe, it, expect } from 'vitest';
import { SHOTS, shotFor, withDrift } from '../cameraDirector';

describe('shotFor', () => {
  it('uses the wide shot for hero mode on desktop', () => {
    expect(shotFor('hero', 1440)).toBe('wide');
  });

  it('uses the three-quarter shot for hero mode on mobile', () => {
    expect(shotFor('hero', 375)).toBe('three-quarter');
  });

  it('uses the close shot when docked in a lesson', () => {
    expect(shotFor('lesson', 1440)).toBe('close');
    expect(shotFor('lesson', 375)).toBe('close');
  });

  it('keeps the last framing when hidden rather than jumping', () => {
    expect(shotFor('hidden', 1440)).toBe('wide');
  });
});

describe('SHOTS', () => {
  it('defines all three named shots with a positive camera z', () => {
    for (const name of ['wide', 'three-quarter', 'close'] as const) {
      expect(SHOTS[name].position.z).toBeGreaterThan(0);
    }
  });

  it('places the close shot nearer than the wide shot', () => {
    expect(SHOTS.close.position.z).toBeLessThan(SHOTS.wide.position.z);
  });
});

describe('withDrift', () => {
  it('varies the camera position over time', () => {
    const a = withDrift(SHOTS.wide, 0, false);
    const b = withDrift(SHOTS.wide, 4.2, false);
    expect(a.position.x).not.toBeCloseTo(b.position.x, 4);
  });

  it('keeps the drift small', () => {
    const drifted = withDrift(SHOTS.wide, 3.1, false);
    expect(Math.abs(drifted.position.x - SHOTS.wide.position.x)).toBeLessThan(0.1);
    expect(Math.abs(drifted.position.y - SHOTS.wide.position.y)).toBeLessThan(0.1);
  });

  it('returns the shot unchanged under reduced motion', () => {
    expect(withDrift(SHOTS.wide, 9.9, true)).toEqual(SHOTS.wide);
  });

  it('does not mutate the source shot', () => {
    const before = SHOTS.wide.position.x;
    withDrift(SHOTS.wide, 2, false);
    expect(SHOTS.wide.position.x).toBe(before);
  });
});
