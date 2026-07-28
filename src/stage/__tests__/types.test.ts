import { describe, it, expect } from 'vitest';
import type { PoseInput, TargetPose } from '../types';

describe('stage types', () => {
  it('composes a valid PoseInput and TargetPose', () => {
    const input: PoseInput = {
      mode: 'hero',
      mood: 'idle',
      elapsed: 0,
      pointer: { x: 0, y: 0 },
      anchor: null,
      amplitude: 0,
      reducedMotion: false,
      entranceScale: 1,
      entranceOpacity: 1,
    };
    const pose: TargetPose = {
      position: { x: 0, y: 0, z: 0 },
      scale: 1,
      rotation: { x: 0, y: 0, z: 0 },
      opacity: 1,
    };
    expect(input.mode).toBe('hero');
    expect(pose.scale).toBe(1);
  });
});
