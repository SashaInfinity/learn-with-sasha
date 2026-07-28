/**
 * Camera director — named framings the render loop eases between, so moving
 * from landing to login to the chat dock reads as a camera move rather than
 * the model teleporting.
 */
import type { CameraShot, CameraShotName, StageMode } from './types';

/** Below this width the wide shot crops badly, so hero uses three-quarter. */
const MOBILE_MAX_WIDTH = 768;

export const SHOTS: Record<CameraShotName, CameraShot> = {
  wide: { position: { x: 0, y: 1.0, z: 6.4 }, target: { x: 0, y: 0.6, z: 0 } },
  'three-quarter': { position: { x: 0, y: 0.6, z: 5.4 }, target: { x: 0, y: 0.3, z: 0 } },
  close: { position: { x: 0, y: 0.4, z: 4.6 }, target: { x: 0, y: 0.25, z: 0 } },
};

/** Picks the framing for the current mode and viewport. */
export function shotFor(mode: StageMode, viewportWidth: number): CameraShotName {
  if (mode === 'lesson') return 'close';
  if (mode === 'hero' && viewportWidth <= MOBILE_MAX_WIDTH) return 'three-quarter';
  // 'hidden' keeps the wide framing so returning to a screen doesn't jump.
  return 'wide';
}

/** Adds the slow idle drift on top of a shot. Never mutates the input. */
export function withDrift(shot: CameraShot, elapsed: number, reducedMotion: boolean): CameraShot {
  if (reducedMotion) return shot;
  return {
    position: {
      x: shot.position.x + Math.sin(elapsed * 0.12) * 0.06,
      y: shot.position.y + Math.cos(elapsed * 0.15) * 0.04,
      z: shot.position.z,
    },
    target: shot.target,
  };
}
