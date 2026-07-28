import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  rectCenterToNdc,
  rectVisible,
  fitScale,
  anchorToWorld,
  worldPerPixel,
} from '../anchors';

const viewport = { width: 1000, height: 500 };

describe('rectCenterToNdc', () => {
  it('maps a centred rect to the NDC origin', () => {
    const ndc = rectCenterToNdc(
      { left: 400, top: 200, width: 200, height: 100 },
      viewport,
    );
    expect(ndc.x).toBeCloseTo(0);
    expect(ndc.y).toBeCloseTo(0);
  });

  it('maps a top-left rect to (-1, +1)', () => {
    const ndc = rectCenterToNdc({ left: 0, top: 0, width: 0, height: 0 }, viewport);
    expect(ndc.x).toBeCloseTo(-1);
    expect(ndc.y).toBeCloseTo(1);
  });

  it('inverts the y axis relative to CSS coordinates', () => {
    const top = rectCenterToNdc({ left: 400, top: 0, width: 200, height: 100 }, viewport);
    const bottom = rectCenterToNdc(
      { left: 400, top: 400, width: 200, height: 100 },
      viewport,
    );
    expect(top.y).toBeGreaterThan(bottom.y);
  });
});

describe('rectVisible', () => {
  it('is true for an on-screen rect', () => {
    expect(rectVisible({ left: 10, top: 10, width: 100, height: 100 }, viewport)).toBe(
      true,
    );
  });

  it('is false for a rect scrolled far above the viewport', () => {
    expect(rectVisible({ left: 10, top: -400, width: 100, height: 100 }, viewport)).toBe(
      false,
    );
  });

  it('is false for a zero-area rect', () => {
    expect(rectVisible({ left: 10, top: 10, width: 0, height: 0 }, viewport)).toBe(false);
  });

  it('respects the margin so a just-off-screen rect still counts', () => {
    const rect = { left: 10, top: 510, width: 100, height: 100 };
    expect(rectVisible(rect, viewport, 0)).toBe(false);
    expect(rectVisible(rect, viewport, 60)).toBe(true);
  });
});

describe('fitScale', () => {
  // 1 world unit per 100 px; model is 2 world units tall and 1 wide.
  const wpp = 0.01;

  it('fits by height when the rect is tall and narrow relative to the model', () => {
    // 200px tall * 0.94 fill * 0.01 wpp = 1.88 world units / 2 = 0.94
    const s = fitScale({ left: 0, top: 0, width: 400, height: 200 }, 2, 1, wpp);
    expect(s).toBeCloseTo(0.94, 2);
  });

  it('fits by width when the rect is short and wide relative to the model', () => {
    // 100px wide * 0.98 fill * 0.01 = 0.98 world units / 1 = 0.98
    // height path: 900 * 0.94 * 0.01 = 8.46 / 2 = 4.23 -> width wins
    const s = fitScale({ left: 0, top: 0, width: 100, height: 900 }, 2, 1, wpp);
    expect(s).toBeCloseTo(0.98, 2);
  });

  it('clamps to the min bound', () => {
    const s = fitScale({ left: 0, top: 0, width: 1, height: 1 }, 2, 1, wpp, { min: 0.3 });
    expect(s).toBe(0.3);
  });

  it('clamps to the max bound', () => {
    const s = fitScale({ left: 0, top: 0, width: 9999, height: 9999 }, 2, 1, wpp, {
      max: 1.7,
    });
    expect(s).toBe(1.7);
  });

  it('returns the min bound for a degenerate zero-size model instead of Infinity', () => {
    const s = fitScale({ left: 0, top: 0, width: 200, height: 200 }, 0, 0, wpp, {
      min: 0.3,
    });
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBe(0.3);
  });

  it('honours custom fill fractions', () => {
    const full = fitScale({ left: 0, top: 0, width: 400, height: 200 }, 2, 1, wpp, {
      fillY: 1,
    });
    const half = fitScale({ left: 0, top: 0, width: 400, height: 200 }, 2, 1, wpp, {
      fillY: 0.5,
    });
    expect(half).toBeCloseTo(full / 2, 4);
  });
});

describe('anchorToWorld / worldPerPixel', () => {
  const camera = new THREE.PerspectiveCamera(35, 2, 0.1, 100);
  camera.position.set(0, 0, 6);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  it('projects the NDC origin to the world origin on the z=0 plane', () => {
    const p = anchorToWorld(camera, 0, 0);
    expect(p.x).toBeCloseTo(0, 4);
    expect(p.y).toBeCloseTo(0, 4);
    expect(p.z).toBeCloseTo(0, 4);
  });

  it('projects +x NDC to positive world x', () => {
    expect(anchorToWorld(camera, 1, 0).x).toBeGreaterThan(0);
  });

  it('projects +y NDC to positive world y', () => {
    expect(anchorToWorld(camera, 0, 1).y).toBeGreaterThan(0);
  });

  it('reports a positive world-units-per-pixel ratio', () => {
    expect(worldPerPixel(camera, 500)).toBeGreaterThan(0);
  });

  it('halves the per-pixel ratio when the viewport height doubles', () => {
    const a = worldPerPixel(camera, 500);
    const b = worldPerPixel(camera, 1000);
    expect(b).toBeCloseTo(a / 2, 6);
  });
});
