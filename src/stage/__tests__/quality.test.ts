import { describe, it, expect } from 'vitest';
import { tierFromHints, tierSettings } from '../quality';

describe('tierFromHints', () => {
  it('returns low for narrow viewports', () => {
    expect(tierFromHints({ viewportWidth: 375 })).toBe('low');
  });

  it('returns low for low-memory devices even on a wide viewport', () => {
    expect(tierFromHints({ viewportWidth: 1440, deviceMemory: 2 })).toBe('low');
  });

  it('returns low for low core counts', () => {
    expect(tierFromHints({ viewportWidth: 1440, hardwareConcurrency: 2 })).toBe('low');
  });

  it('returns high for a capable desktop', () => {
    expect(
      tierFromHints({ viewportWidth: 1440, deviceMemory: 8, hardwareConcurrency: 8 }),
    ).toBe('high');
  });

  it('returns high when optional hints are absent on a wide viewport', () => {
    expect(tierFromHints({ viewportWidth: 1440 })).toBe('high');
  });

  it('treats exactly 768px as low', () => {
    expect(tierFromHints({ viewportWidth: 768, deviceMemory: 8 })).toBe('low');
  });
});

describe('tierSettings', () => {
  it('caps pixel ratio lower on the low tier', () => {
    expect(tierSettings('low').maxPixelRatio).toBeLessThan(
      tierSettings('high').maxPixelRatio,
    );
  });

  it('drops the extra lights and ground disc on the low tier', () => {
    expect(tierSettings('low').lights).toBe('reduced');
    expect(tierSettings('low').ground).toBe(false);
    expect(tierSettings('high').lights).toBe('full');
    expect(tierSettings('high').ground).toBe(true);
  });

  it('throttles idle frames harder on the low tier', () => {
    expect(tierSettings('low').idleFps).toBeLessThan(tierSettings('high').idleFps);
  });
});
