/**
 * Anchor math — the single source of truth for screen-to-world placement.
 *
 * Screens declare where Sasha belongs by rendering a DOM element; this module
 * turns that element's rect into a world position and a fit scale. Previously
 * this math was inlined twice in SashaStage with different rules, which is why
 * the login page's reserved column and the model's actual position disagreed.
 */
import * as THREE from 'three';
import type { AnchorRect, Vec3, Viewport } from './types';

/** Tuning for how much of the anchor rect the model should occupy. */
export interface FitOptions {
  /** Fraction of the rect width to fill. Default 0.98. */
  fillX?: number;
  /** Fraction of the rect height to fill. Default 0.94. */
  fillY?: number;
  /** Lower clamp on the resulting scale. Default 0.3. */
  min?: number;
  /** Upper clamp on the resulting scale. Default 1.7. */
  max?: number;
}

/** Centre of `rect` in normalised device coordinates (-1..1, y up). */
export function rectCenterToNdc(rect: AnchorRect, viewport: Viewport): { x: number; y: number } {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  return {
    x: (cx / viewport.width) * 2 - 1,
    y: -((cy / viewport.height) * 2 - 1),
  };
}

/**
 * True when the rect has area and overlaps the viewport (vertically) within
 * `margin` pixels. Used to fade the model out when its dock scrolls away.
 */
export function rectVisible(rect: AnchorRect, viewport: Viewport, margin = 50): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return rect.top + rect.height > -margin && rect.top < viewport.height + margin;
}

/**
 * Scale multiplier that fits a model of `sizeY` x `sizeX` world units into
 * `rect`, constrained on both axes and clamped to the guard rails.
 */
export function fitScale(
  rect: AnchorRect,
  sizeY: number,
  sizeX: number,
  worldPerPixelRatio: number,
  opts: FitOptions = {},
): number {
  const { fillX = 0.98, fillY = 0.94, min = 0.3, max = 1.7 } = opts;
  // A zero-size model would divide to Infinity; fall back to the lower guard.
  if (sizeY <= 0 || sizeX <= 0) return min;
  const fitY = (rect.height * fillY * worldPerPixelRatio) / sizeY;
  const fitX = (rect.width * fillX * worldPerPixelRatio) / sizeX;
  return THREE.MathUtils.clamp(Math.min(fitY, fitX), min, max);
}

const scratch = new THREE.Vector3();

/** Projects an NDC point onto the z=0 plane the model sits on. */
export function anchorToWorld(camera: THREE.PerspectiveCamera, ndcX: number, ndcY: number): Vec3 {
  scratch.set(ndcX, ndcY, 0.5).unproject(camera);
  scratch.sub(camera.position).normalize();
  const t = (0 - camera.position.z) / scratch.z;
  return {
    x: camera.position.x + scratch.x * t,
    y: camera.position.y + scratch.y * t,
    z: camera.position.z + scratch.z * t,
  };
}

/** World units covered by one CSS pixel on the z=0 plane. */
export function worldPerPixel(camera: THREE.PerspectiveCamera, viewportHeight: number): number {
  const top = anchorToWorld(camera, 0, 1);
  const bottom = anchorToWorld(camera, 0, -1);
  return (top.y - bottom.y) / viewportHeight;
}
