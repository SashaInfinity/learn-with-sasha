# Learn With Sasha — 3D Entrance, Stage Refactor & UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the tangled single-`useEffect` 3D stage with a tested, anchor-driven stage that plays a rocket entrance, sits correctly on every screen at every breakpoint, and loads a Draco-compressed model — then restyle landing, login and dashboard on top of it.

**Architecture:** All screen-to-world math, pose composition, camera shots, quality tiers and entrance timing move into pure functions under `src/stage/` that never import React or THREE-with-WebGL. `SashaStage.tsx` becomes a thin wrapper that runs a rAF loop, calls those pure functions, and eases the result onto the model. Screens declare where Sasha belongs by rendering a `<div>` and registering it as the active anchor — replacing today's hardcoded NDC constants and the duplicated dock-fitting math.

**Tech Stack:** React 19, TypeScript 5.8 (strict), three.js 0.183, Tailwind 3.4, Vite 6, Vitest (new), `@gltf-transform/cli` (new dev dependency).

## Global Constraints

- **The GLB has no skeleton and no animation clips.** All character motion MUST be whole-model transform. Never traverse to the `Head` sub-mesh and never mutate a child node's transform — that regression was fixed in commit `15e26e4` and must not return.
- **Palette and typeface are locked:** slate/amber (`--lws-amber: #f59e0b`, `--lws-amber-dark: #d97706`, `--lws-amber-light: #fef3c7`, `--lws-orange: #f97316`), Plus Jakarta Sans. Do not introduce new hues or fonts.
- **No new runtime dependencies.** `@gltf-transform/cli`, `vitest` and `jsdom` are devDependencies only. Do not add `@react-three/fiber` or `drei`.
- **TypeScript is strict** with `noUnusedLocals` and `noUnusedParameters`. Prefix intentionally unused params with `_`.
- **ESLint bans `console.log`** (`no-console` allows only `warn` and `error`).
- **Every task ends green:** `npm run check` (typecheck + eslint + prettier) and `npm test` must both pass before committing.
- **Modules under `src/stage/` must not import React.** `renderer.ts` and `loadModel.ts` are the only files there permitted to touch WebGL.
- **Performance budgets:** compressed GLB ≤ 500 KB transferred; first model paint ≤ 1.5s on cable; 60fps desktop / 30fps mid-tier mobile.
- **Reduced motion is honoured in JavaScript**, not only CSS. The existing global CSS override at `src/index.css:356` does not stop rAF-driven motion.

---

## File Structure

**Created:**

| Path                               | Responsibility                                                |
| ---------------------------------- | ------------------------------------------------------------- |
| `vitest.config.ts`                 | Test runner config (jsdom environment)                        |
| `src/stage/types.ts`               | Shared types for the whole stage subsystem                    |
| `src/stage/anchors.ts`             | Rect → NDC → world math, fit scale, visibility                |
| `src/stage/quality.ts`             | Device tier detection and per-tier render settings            |
| `src/stage/poseDirector.ts`        | Pure pose composition (base + idle + mood + voice + entrance) |
| `src/stage/cameraDirector.ts`      | Named camera shots and idle drift                             |
| `src/stage/entrance.ts`            | Rocket entrance phase machine, load gating, replay flag       |
| `src/stage/anchorRegistry.ts`      | Module-level store of the active anchor element               |
| `src/stage/renderer.ts`            | WebGL context, lights, ground, resize, dispose                |
| `src/stage/loadModel.ts`           | GLTFLoader + DRACOLoader, progress, bbox normalisation        |
| `src/hooks/useSashaAnchor.ts`      | React hook registering a DOM element as the anchor            |
| `src/components/RocketLaunch.tsx`  | CSS/SVG rocket overlay driven by `EntranceState`              |
| `src/components/SashaFallback.tsx` | Static image shown when WebGL or the GLB is unavailable       |
| `scripts/build-model.mjs`          | gltf-transform pipeline: weld → simplify → draco              |
| `src/stage/__tests__/*.test.ts`    | Unit tests for the pure modules                               |

**Modified:**

| Path                             | Change                                           |
| -------------------------------- | ------------------------------------------------ |
| `src/components/SashaStage.tsx`  | Rewritten as a thin wrapper (370 → ~180 lines)   |
| `src/components/LandingPage.tsx` | Anchor + redesign                                |
| `src/components/AuthScreen.tsx`  | Anchor + redesign (fixes the overlap)            |
| `src/components/ChatHome.tsx`    | Anchor + redesign + mobile presence              |
| `src/components/AppShell.tsx`    | Wire entrance state and fallback                 |
| `src/index.css`                  | Design tokens, rocket keyframes, redesign styles |
| `index.html`                     | Preload hint for the compressed GLB              |
| `package.json`                   | `test`, `models:build` scripts; devDependencies  |
| `.gitignore`                     | Ensure `public/draco/` is NOT ignored            |

---

### Task 1: Test harness and shared types

**Files:**

- Create: `vitest.config.ts`
- Create: `src/stage/types.ts`
- Create: `src/stage/__tests__/types.test.ts`
- Modify: `package.json`

**Interfaces:**

- Consumes: nothing.
- Produces: every type below. Later tasks import from `src/stage/types.ts`.

- [ ] **Step 1: Install the test dependencies**

```bash
npm install --save-dev vitest@^2.1.0 jsdom@^25.0.0
```

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    globals: false,
  },
});
```

- [ ] **Step 3: Add the test scripts to `package.json`**

Add to `"scripts"` (keep the existing entries):

```json
"test": "vitest run",
"test:watch": "vitest",
"check": "npm run typecheck && npm run lint && npm run format:check && npm test"
```

Note `check` gains `&& npm test` — replace the existing `check` line.

- [ ] **Step 4: Create `src/stage/types.ts`**

```ts
/**
 * Shared types for the Sasha stage subsystem.
 *
 * Nothing in src/stage/ imports React. Only renderer.ts and loadModel.ts are
 * permitted to touch WebGL; every other module here is pure and unit-tested.
 */

/** Which pose family the stage is currently targeting. */
export type StageMode = 'hero' | 'lesson' | 'hidden';

/** Interaction beat driving the mood overlay. Mirrors SashaMood in VoiceContext. */
export type SashaMoodName =
  'idle' | 'wave' | 'thinking' | 'talking' | 'celebrate' | 'shake' | 'attentive';

/** Render quality bucket chosen from device hints. */
export type QualityTier = 'high' | 'low';

/** Phases of the rocket entrance, in order. */
export type EntrancePhase = 'launch' | 'burst' | 'reveal' | 'settle' | 'done';

/** Named camera framings the camera director eases between. */
export type CameraShotName = 'wide' | 'three-quarter' | 'close';

/** A plain 3-component vector. Avoids importing THREE into pure modules. */
export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Viewport-relative CSS-pixel rect, as returned by getBoundingClientRect(). */
export interface AnchorRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Viewport dimensions in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** The world-space placement derived from an anchor rect. */
export interface AnchorFit {
  /** World position of the rect's centre, on the z=0 plane. */
  center: Vec3;
  /** Scale that fits the model into the rect. */
  scale: number;
  /** False when the rect has scrolled off screen. */
  visible: boolean;
}

/** Unscaled bounding-box metrics of the loaded GLB. */
export interface ModelMetrics {
  center: Vec3;
  size: Vec3;
  /** Scale that normalises the model's largest dimension to a known height. */
  baseScale: number;
}

/** Everything the pose director needs for one frame. */
export interface PoseInput {
  mode: StageMode;
  mood: SashaMoodName;
  /** Seconds since the stage started. */
  elapsed: number;
  /** Smoothed pointer position in NDC (-1..1 on both axes). */
  pointer: { x: number; y: number };
  /** Null when no anchor is registered — the director falls back to centre. */
  anchor: AnchorFit | null;
  /** Live TTS amplitude, 0..1. */
  amplitude: number;
  reducedMotion: boolean;
  /** Multiplier from the entrance timeline, 0..1+. */
  entranceScale: number;
  /** Opacity from the entrance timeline, 0..1. */
  entranceOpacity: number;
}

/** The pose the render loop eases toward this frame. */
export interface TargetPose {
  position: Vec3;
  scale: number;
  rotation: Vec3;
  opacity: number;
}

/** A camera framing: where the camera sits and what it looks at. */
export interface CameraShot {
  position: Vec3;
  target: Vec3;
}

/** Per-tier render settings consumed by renderer.ts. */
export interface TierSettings {
  maxPixelRatio: number;
  /** 'full' = 4 lights, 'reduced' = key + ambient only. */
  lights: 'full' | 'reduced';
  ground: boolean;
  /** Frame cap applied while the pose is effectively static. */
  idleFps: number;
}

/** Device signals used to pick a quality tier. Injected so it stays testable. */
export interface DeviceHints {
  viewportWidth: number;
  deviceMemory?: number;
  hardwareConcurrency?: number;
}

/** One frame of the entrance timeline. */
export interface EntranceState {
  phase: EntrancePhase;
  /** Timeline seconds, already adjusted for any load-gate hold. */
  t: number;
  /** Rocket travel 0..1 across the launch phase. */
  rocketProgress: number;
  /** Radial flare intensity 0..1 during burst/reveal. */
  flare: number;
  /** Model scale multiplier for the reveal ramp. */
  modelScale: number;
  /** Model opacity 0..1. */
  modelOpacity: number;
  /** True once the overlay can unmount. */
  complete: boolean;
}

/** Inputs to the entrance phase machine. */
export interface EntranceInput {
  /** Seconds since the entrance started. */
  elapsed: number;
  /** GLB download progress 0..1, for the rocket's progress ring. */
  loadProgress: number;
  /**
   * Elapsed value at which the model became ready, or null if not yet ready.
   * The timeline holds at the end of `burst` until this is non-null.
   */
  gateReleasedAt: number | null;
  reducedMotion: boolean;
  /** True on replay (already seen this session) or on a hard failure. */
  skip: boolean;
}
```

- [ ] **Step 5: Write the type-contract test**

Create `src/stage/__tests__/types.test.ts`:

```ts
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
```

- [ ] **Step 6: Run the test to verify the harness works**

Run: `npm test`
Expected: PASS, 1 test.

- [ ] **Step 7: Verify the full check passes**

Run: `npm run check`
Expected: all four stages pass. If prettier complains, run `npm run format` and re-run.

- [ ] **Step 8: Commit**

```bash
git add vitest.config.ts package.json package-lock.json src/stage/types.ts src/stage/__tests__/types.test.ts
git commit -m "test: add vitest harness and shared stage types"
```

---

### Task 2: Anchor math

**Files:**

- Create: `src/stage/anchors.ts`
- Create: `src/stage/__tests__/anchors.test.ts`

**Interfaces:**

- Consumes: `AnchorRect`, `Viewport`, `Vec3`, `AnchorFit` from `src/stage/types.ts`.
- Produces:
  - `rectCenterToNdc(rect: AnchorRect, viewport: Viewport): { x: number; y: number }`
  - `rectVisible(rect: AnchorRect, viewport: Viewport, margin?: number): boolean`
  - `fitScale(rect: AnchorRect, sizeY: number, sizeX: number, worldPerPixel: number, opts?: FitOptions): number`
  - `anchorToWorld(camera: THREE.PerspectiveCamera, ndcX: number, ndcY: number): Vec3`
  - `worldPerPixel(camera: THREE.PerspectiveCamera, viewportHeight: number): number`
  - `interface FitOptions { fillX?: number; fillY?: number; min?: number; max?: number }`

This module replaces the two divergent inline implementations at `SashaStage.tsx:216-231` and `SashaStage.tsx:235-239`.

- [ ] **Step 1: Write the failing tests**

Create `src/stage/__tests__/anchors.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- anchors`
Expected: FAIL — `Failed to resolve import "../anchors"`.

- [ ] **Step 3: Implement `src/stage/anchors.ts`**

```ts
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
export function rectCenterToNdc(
  rect: AnchorRect,
  viewport: Viewport,
): { x: number; y: number } {
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
export function anchorToWorld(
  camera: THREE.PerspectiveCamera,
  ndcX: number,
  ndcY: number,
): Vec3 {
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
export function worldPerPixel(
  camera: THREE.PerspectiveCamera,
  viewportHeight: number,
): number {
  const top = anchorToWorld(camera, 0, 1);
  const bottom = anchorToWorld(camera, 0, -1);
  return (top.y - bottom.y) / viewportHeight;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- anchors`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stage/anchors.ts src/stage/__tests__/anchors.test.ts
git commit -m "feat(stage): add tested anchor math replacing duplicated fit logic"
```

---

### Task 3: Quality tiers

**Files:**

- Create: `src/stage/quality.ts`
- Create: `src/stage/__tests__/quality.test.ts`

**Interfaces:**

- Consumes: `DeviceHints`, `QualityTier`, `TierSettings` from `src/stage/types.ts`.
- Produces:
  - `tierFromHints(hints: DeviceHints): QualityTier`
  - `detectTier(): QualityTier`
  - `tierSettings(tier: QualityTier): TierSettings`
  - `prefersReducedMotion(): boolean`

- [ ] **Step 1: Write the failing tests**

Create `src/stage/__tests__/quality.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- quality`
Expected: FAIL — cannot resolve `../quality`.

- [ ] **Step 3: Implement `src/stage/quality.ts`**

```ts
/**
 * Device quality tiering. Keeps the render cost proportional to the hardware:
 * phones and low-core machines get fewer lights, a lower pixel ratio and a
 * harder idle frame cap.
 */
import type { DeviceHints, QualityTier, TierSettings } from './types';

/** Viewports at or below this width are treated as mobile. */
const MOBILE_MAX_WIDTH = 768;
/** GB of RAM below which we downgrade regardless of viewport. */
const MIN_DEVICE_MEMORY = 4;
/** Logical cores below which we downgrade regardless of viewport. */
const MIN_CORES = 4;

/** Pure tier selection — injected hints keep this testable. */
export function tierFromHints(hints: DeviceHints): QualityTier {
  if (hints.viewportWidth <= MOBILE_MAX_WIDTH) return 'low';
  if (hints.deviceMemory !== undefined && hints.deviceMemory < MIN_DEVICE_MEMORY) {
    return 'low';
  }
  if (hints.hardwareConcurrency !== undefined && hints.hardwareConcurrency < MIN_CORES) {
    return 'low';
  }
  return 'high';
}

/** Reads the live browser hints and picks a tier. */
export function detectTier(): QualityTier {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return tierFromHints({
    viewportWidth: window.innerWidth,
    deviceMemory: nav.deviceMemory,
    hardwareConcurrency: nav.hardwareConcurrency,
  });
}

/** Render settings for a tier. */
export function tierSettings(tier: QualityTier): TierSettings {
  if (tier === 'low') {
    return { maxPixelRatio: 1.5, lights: 'reduced', ground: false, idleFps: 30 };
  }
  return { maxPixelRatio: 2, lights: 'full', ground: true, idleFps: 60 };
}

/**
 * JS-side reduced-motion check. The global CSS override in index.css only
 * affects CSS animations — rAF-driven motion has to opt out explicitly.
 */
export function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- quality`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stage/quality.ts src/stage/__tests__/quality.test.ts
git commit -m "feat(stage): add device quality tiering and reduced-motion check"
```

---

### Task 4: Pose director

**Files:**

- Create: `src/stage/poseDirector.ts`
- Create: `src/stage/__tests__/poseDirector.test.ts`

**Interfaces:**

- Consumes: `PoseInput`, `TargetPose`, `AnchorFit`, `ModelMetrics` from `src/stage/types.ts`.
- Produces:
  - `pose(input: PoseInput, metrics: ModelMetrics): TargetPose`
  - `FALLBACK_ANCHOR: AnchorFit`

This replaces the mood if-chain at `SashaStage.tsx:245-290`. Layers are additive, never branching on mode for rotation.

- [ ] **Step 1: Write the failing tests**

Create `src/stage/__tests__/poseDirector.test.ts`:

```ts
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
    const expected = pose(
      input({ anchor: FALLBACK_ANCHOR, reducedMotion: true }),
      metrics,
    );
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
    const b = pose(
      input({ elapsed: 7.7, reducedMotion: true, pointer: { x: 1, y: 1 } }),
      metrics,
    );
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
    expect(
      pose(input({ mood: 'thinking', elapsed: 0 }), metrics).rotation.x,
    ).toBeGreaterThan(0.1);
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
    const a = pose(
      input({ mood: 'celebrate', elapsed: 0.2, reducedMotion: true }),
      metrics,
    );
    const b = pose(input({ mood: 'idle', elapsed: 0.2, reducedMotion: true }), metrics);
    expect(a.position.y).toBeCloseTo(b.position.y, 6);
    expect(a.rotation.z).toBeCloseTo(b.rotation.z, 6);
  });
});

describe('pose — voice layer', () => {
  it('adds yaw wobble proportional to amplitude', () => {
    const quiet = pose(input({ mood: 'talking', amplitude: 0, elapsed: 0.3 }), metrics)
      .rotation.y;
    const loud = pose(input({ mood: 'talking', amplitude: 1, elapsed: 0.3 }), metrics)
      .rotation.y;
    expect(loud).not.toBeCloseTo(quiet, 4);
  });

  it('ignores amplitude below the noise floor', () => {
    const a = pose(input({ mood: 'idle', amplitude: 0, elapsed: 0.3 }), metrics).rotation
      .z;
    const b = pose(input({ mood: 'idle', amplitude: 0.01, elapsed: 0.3 }), metrics)
      .rotation.z;
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
    const p = pose(
      input({ entranceScale: 0.35, elapsed: 0, reducedMotion: true }),
      metrics,
    );
    expect(p.position.x).toBeCloseTo(anchor.center.x - metrics.center.x * p.scale, 5);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- poseDirector`
Expected: FAIL — cannot resolve `../poseDirector`.

- [ ] **Step 3: Implement `src/stage/poseDirector.ts`**

```ts
/**
 * Pose director — pure composition of Sasha's target pose for one frame.
 *
 * Layers are additive, applied in order:
 *   base      anchor fit (position + scale)
 *   + idle    breathe, sway, pointer tracking
 *   + mood    wave | thinking | attentive | celebrate | shake
 *   + voice   TTS-amplitude wobble
 *   + entrance scale/opacity ramp
 *
 * IMPORTANT: every layer is a whole-model transform. The GLB has no skeleton
 * and no clips; manipulating child nodes pulls the head out of place (see
 * commit 15e26e4). Do not add per-bone or per-mesh motion here.
 */
import type { AnchorFit, ModelMetrics, PoseInput, TargetPose } from './types';

/** Used when a screen has not registered an anchor yet. */
export const FALLBACK_ANCHOR: AnchorFit = {
  center: { x: 0, y: 0, z: 0 },
  scale: 1,
  visible: true,
};

/** Amplitude below this is treated as silence. */
const AMPLITUDE_FLOOR = 0.02;

export function pose(input: PoseInput, metrics: ModelMetrics): TargetPose {
  const anchor = input.anchor ?? FALLBACK_ANCHOR;
  const t = input.elapsed;
  const still = input.reducedMotion;

  // --- base ---------------------------------------------------------------
  // A gentle scale pulse reads as "alive" without moving the silhouette.
  const pulse = still ? 1 : 1 + Math.sin(t * 1.5) * 0.012;
  const scale = metrics.baseScale * anchor.scale * pulse * input.entranceScale;

  let x = anchor.center.x;
  let y = anchor.center.y;
  const z = anchor.center.z;
  let rotX = 0;
  let rotY = 0;
  let rotZ = 0;

  if (!still) {
    // --- idle -------------------------------------------------------------
    y += Math.sin(t * 1.2) * 0.04; // breathe
    rotY += Math.sin(t * 0.5) * 0.05; // sway
    rotY += input.pointer.x * 0.18; // pointer yaw
    rotX += input.pointer.y * 0.04; // whisper of pointer pitch

    // --- mood -------------------------------------------------------------
    switch (input.mood) {
      case 'wave':
        rotZ += Math.sin(t * 6) * 0.12;
        break;
      case 'thinking':
        rotZ += 0.12 + Math.sin(t * 1.1) * 0.05;
        rotX += 0.18 + Math.max(0, Math.sin(t * 2.5)) * 0.06;
        rotY += Math.sin(t * 0.8) * 0.08;
        y += Math.sin(t * 1.4) * 0.015;
        break;
      case 'attentive':
        rotX += 0.12;
        rotY += input.pointer.x * 0.12;
        y += Math.sin(t * 2.2) * 0.01;
        break;
      case 'celebrate':
        y += Math.abs(Math.sin(t * 8)) * 0.08;
        rotZ += Math.sin(t * 5) * 0.06;
        break;
      case 'shake':
        rotY += Math.sin(t * 18) * 0.08;
        break;
      case 'idle':
      case 'talking':
        break;
    }

    // --- voice ------------------------------------------------------------
    const amp = input.amplitude;
    if (amp > AMPLITUDE_FLOOR) {
      rotY += Math.sin(t * 9) * amp * 0.05;
      rotZ += Math.sin(t * 7.5) * amp * 0.02;
      y += amp * 0.02;
    }
  }

  // Re-centre: the anchor centres the model's bounding box, so subtract the
  // scaled local centre. Done last so it tracks the final scale.
  x -= metrics.center.x * scale;
  y -= metrics.center.y * scale;

  const visible = input.mode !== 'hidden' && anchor.visible;

  return {
    position: { x, y, z: z - metrics.center.z * scale },
    scale,
    rotation: { x: rotX, y: rotY, z: rotZ },
    opacity: visible ? input.entranceOpacity : 0,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- poseDirector`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stage/poseDirector.ts src/stage/__tests__/poseDirector.test.ts
git commit -m "feat(stage): extract pose composition into a pure tested director"
```

---

### Task 5: Camera director

**Files:**

- Create: `src/stage/cameraDirector.ts`
- Create: `src/stage/__tests__/cameraDirector.test.ts`

**Interfaces:**

- Consumes: `CameraShot`, `CameraShotName`, `StageMode` from `src/stage/types.ts`.
- Produces:
  - `SHOTS: Record<CameraShotName, CameraShot>`
  - `shotFor(mode: StageMode, viewportWidth: number): CameraShotName`
  - `withDrift(shot: CameraShot, elapsed: number, reducedMotion: boolean): CameraShot`

Replaces the hardcoded `camera.lookAt` pair at `SashaStage.tsx:331-334`.

- [ ] **Step 1: Write the failing tests**

Create `src/stage/__tests__/cameraDirector.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- cameraDirector`
Expected: FAIL — cannot resolve `../cameraDirector`.

- [ ] **Step 3: Implement `src/stage/cameraDirector.ts`**

```ts
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
export function withDrift(
  shot: CameraShot,
  elapsed: number,
  reducedMotion: boolean,
): CameraShot {
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- cameraDirector`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/stage/cameraDirector.ts src/stage/__tests__/cameraDirector.test.ts
git commit -m "feat(stage): add named camera shots with idle drift"
```

---

### Task 6: Entrance phase machine

**Files:**

- Create: `src/stage/entrance.ts`
- Create: `src/stage/__tests__/entrance.test.ts`

**Interfaces:**

- Consumes: `EntranceInput`, `EntranceState`, `EntrancePhase` from `src/stage/types.ts`.
- Produces:
  - `entranceState(input: EntranceInput): EntranceState`
  - `hasSeenEntrance(): boolean`
  - `markEntranceSeen(): void`
  - `ENTRANCE_SEEN_KEY: string`
  - Phase boundary constants: `LAUNCH_END`, `BURST_END`, `REVEAL_END`, `SETTLE_END`

- [ ] **Step 1: Write the failing tests**

Create `src/stage/__tests__/entrance.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  entranceState,
  hasSeenEntrance,
  markEntranceSeen,
  ENTRANCE_SEEN_KEY,
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
  it('keeps the model invisible through launch and burst', () => {
    expect(entranceState(input({ elapsed: 0.4 })).modelOpacity).toBe(0);
    expect(entranceState(input({ elapsed: 1.0, gateReleasedAt: 0 })).modelOpacity).toBe(
      0,
    );
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- entrance`
Expected: FAIL — cannot resolve `../entrance`.

- [ ] **Step 3: Implement `src/stage/entrance.ts`**

```ts
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
  const holdDuration =
    input.gateReleasedAt === null
      ? Math.max(0, input.elapsed - BURST_END)
      : Math.max(0, input.gateReleasedAt - BURST_END);
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- entrance`
Expected: PASS, 16 tests. If the burst-boundary assertions are off by a frame, adjust the implementation — not the expectations — since the gate semantics are the point.

- [ ] **Step 5: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/stage/entrance.ts src/stage/__tests__/entrance.test.ts
git commit -m "feat(stage): add load-gated rocket entrance phase machine"
```

---

### Task 7: Asset pipeline — Draco compression and simplification

**Files:**

- Create: `scripts/build-model.mjs`
- Create: `public/draco/` (copied decoder files)
- Modify: `package.json`
- Modify: `.gitignore`
- Modify: `index.html`

**Interfaces:**

- Consumes: nothing from earlier tasks.
- Produces: `public/models/Sasha-Character.draco.glb` (committed) and `public/draco/` decoder files, both consumed by Task 9's `loadModel.ts`.

Source model facts, verified: 4.2 MB, ~193,236 triangles, 3 meshes, 3 materials, **no textures**, **no skins**, **no animations**, uses `KHR_materials_clearcoat`.

- [ ] **Step 1: Install the pipeline tooling**

```bash
npm install --save-dev @gltf-transform/core@^4.1.0 @gltf-transform/extensions@^4.1.0 @gltf-transform/functions@^4.1.0 meshoptimizer@^0.22.0
```

- [ ] **Step 2: Write the pipeline script**

Create `scripts/build-model.mjs`:

```js
/**
 * Compresses the Sasha GLB for the web.
 *
 * The source is ~4.2 MB of pure geometry (no textures, no skins, no clips), so
 * simplification plus Draco is the entire win — texture compression is moot.
 *
 * Run: npm run models:build
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { weld, simplify, dedup, prune, draco } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';

const SRC = 'public/models/Sasha-Character.glb';
const OUT = 'public/models/Sasha-Character.draco.glb';
/** Keep ~31% of triangles: 193k -> ~60k. Invisible at mascot display size. */
const SIMPLIFY_RATIO = 0.31;
/** Maximum allowed geometric error, as a fraction of mesh extent. */
const SIMPLIFY_ERROR = 0.001;

function countTriangles(document) {
  let total = 0;
  for (const mesh of document.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      const count = indices ? indices.getCount() : position ? position.getCount() : 0;
      total += count / 3;
    }
  }
  return Math.round(total);
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

await MeshoptSimplifier.ready;

const document = await io.read(SRC);
const before = countTriangles(document);

await document.transform(
  dedup(),
  prune(),
  weld(),
  simplify({
    simplifier: MeshoptSimplifier,
    ratio: SIMPLIFY_RATIO,
    error: SIMPLIFY_ERROR,
  }),
  draco(),
);

const after = countTriangles(document);
await io.write(OUT, document);

const { statSync } = await import('node:fs');
const srcKb = Math.round(statSync(SRC).size / 1024);
const outKb = Math.round(statSync(OUT).size / 1024);

process.stdout.write(
  `${SRC}\n  triangles ${before} -> ${after}\n  size ${srcKb} KB -> ${outKb} KB\n  wrote ${OUT}\n`,
);

if (outKb > 500) {
  process.stderr.write(`\nWARNING: ${outKb} KB exceeds the 500 KB budget.\n`);
  process.exit(1);
}
```

- [ ] **Step 3: Install the Draco codec used by the script**

```bash
npm install --save-dev draco3dgltf@^1.5.7
```

- [ ] **Step 4: Add the npm script**

In `package.json` `"scripts"`, add:

```json
"models:build": "node scripts/build-model.mjs"
```

- [ ] **Step 5: Run the pipeline**

Run: `npm run models:build`
Expected output shape:

```
public/models/Sasha-Character.glb
  triangles 193236 -> ~60000
  size 4300 KB -> <500 KB
  wrote public/models/Sasha-Character.draco.glb
```

If the output exceeds 500 KB the script exits 1. Lower `SIMPLIFY_RATIO` to 0.2 and re-run, then eyeball the result in the app at Task 10 before accepting it.

- [ ] **Step 6: Copy the Draco decoder into `public/`**

```bash
mkdir -p public/draco
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.js public/draco/
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_decoder.wasm public/draco/
cp node_modules/three/examples/jsm/libs/draco/gltf/draco_wasm_wrapper.js public/draco/
```

Self-hosted, not a CDN — the app must work without third-party requests.

- [ ] **Step 7: Confirm the new files are not gitignored**

Run: `git check-ignore -v public/draco/draco_decoder.wasm public/models/Sasha-Character.draco.glb`
Expected: no output (nothing ignored). If either is ignored, add a negation to `.gitignore`:

```
!public/draco/
!public/models/*.glb
```

- [ ] **Step 8: Add the preload hint to `index.html`**

Insert immediately after the existing `<link rel="apple-touch-icon" ...>` line:

```html
<link
  rel="preload"
  as="fetch"
  type="model/gltf-binary"
  crossorigin
  href="/models/Sasha-Character.draco.glb"
/>
```

- [ ] **Step 9: Verify the build still works**

Run: `npm run build`
Expected: succeeds, and `dist/models/Sasha-Character.draco.glb` plus `dist/draco/` exist.

- [ ] **Step 10: Commit**

```bash
git add scripts/build-model.mjs package.json package-lock.json .gitignore index.html public/draco public/models/Sasha-Character.draco.glb
git commit -m "build: add Draco geometry pipeline and preload the compressed model"
```

---

### Task 8: Anchor registry and React hook

**Files:**

- Create: `src/stage/anchorRegistry.ts`
- Create: `src/hooks/useSashaAnchor.ts`
- Create: `src/stage/__tests__/anchorRegistry.test.ts`

**Interfaces:**

- Consumes: `AnchorRect` from `src/stage/types.ts`.
- Produces:
  - `pushAnchor(id: string, el: HTMLElement, opts?: AnchorOptions): void`
  - `popAnchor(id: string): void`
  - `activeAnchorRect(): AnchorRect | null`
  - `activeAnchorOptions(): AnchorOptions`
  - `interface AnchorOptions { fillX?: number; fillY?: number; min?: number; max?: number }`
  - `useSashaAnchor(ref: RefObject<HTMLElement | null>, id: string, opts?: AnchorOptions): void`

The registry is a stack so a screen mounting over another (e.g. a modal) can take over and restore cleanly on unmount.

- [ ] **Step 1: Write the failing tests**

Create `src/stage/__tests__/anchorRegistry.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import {
  pushAnchor,
  popAnchor,
  activeAnchorRect,
  activeAnchorOptions,
} from '../anchorRegistry';

function makeEl(rect: { left: number; top: number; width: number; height: number }) {
  const el = document.createElement('div');
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return el;
}

describe('anchorRegistry', () => {
  beforeEach(() => {
    popAnchor('a');
    popAnchor('b');
    document.body.innerHTML = '';
  });

  it('returns null when nothing is registered', () => {
    expect(activeAnchorRect()).toBeNull();
  });

  it('returns the registered element rect', () => {
    pushAnchor('a', makeEl({ left: 10, top: 20, width: 100, height: 200 }));
    expect(activeAnchorRect()).toEqual({ left: 10, top: 20, width: 100, height: 200 });
  });

  it('the most recently pushed anchor wins', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('b', makeEl({ left: 50, top: 50, width: 20, height: 20 }));
    expect(activeAnchorRect()?.left).toBe(50);
  });

  it('popping the top restores the previous anchor', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('b', makeEl({ left: 50, top: 50, width: 20, height: 20 }));
    popAnchor('b');
    expect(activeAnchorRect()?.left).toBe(0);
  });

  it('popping a buried anchor removes it without disturbing the top', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('b', makeEl({ left: 50, top: 50, width: 20, height: 20 }));
    popAnchor('a');
    expect(activeAnchorRect()?.left).toBe(50);
  });

  it('re-pushing the same id replaces rather than duplicates', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }));
    pushAnchor('a', makeEl({ left: 99, top: 0, width: 10, height: 10 }));
    expect(activeAnchorRect()?.left).toBe(99);
    popAnchor('a');
    expect(activeAnchorRect()).toBeNull();
  });

  it('returns null once the element is detached from the document', () => {
    const el = makeEl({ left: 0, top: 0, width: 10, height: 10 });
    pushAnchor('a', el);
    el.remove();
    expect(activeAnchorRect()).toBeNull();
  });

  it('exposes the options registered with the active anchor', () => {
    pushAnchor('a', makeEl({ left: 0, top: 0, width: 10, height: 10 }), { fillY: 0.5 });
    expect(activeAnchorOptions().fillY).toBe(0.5);
  });

  it('returns empty options when nothing is registered', () => {
    expect(activeAnchorOptions()).toEqual({});
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- anchorRegistry`
Expected: FAIL — cannot resolve `../anchorRegistry`.

- [ ] **Step 3: Implement `src/stage/anchorRegistry.ts`**

```ts
/**
 * Active-anchor registry.
 *
 * Screens declare where Sasha belongs by registering a DOM element. The render
 * loop reads the topmost registered element's rect every frame, so layout — not
 * hardcoded NDC constants — drives the 3D placement. A stack lets a screen
 * mounting over another take over and restore cleanly.
 */
import type { AnchorRect } from './types';

/** Per-anchor fitting overrides, forwarded to anchors.fitScale. */
export interface AnchorOptions {
  fillX?: number;
  fillY?: number;
  min?: number;
  max?: number;
}

interface Entry {
  id: string;
  el: HTMLElement;
  opts: AnchorOptions;
}

const stack: Entry[] = [];

/** Registers (or replaces) an anchor and makes it active. */
export function pushAnchor(id: string, el: HTMLElement, opts: AnchorOptions = {}): void {
  const existing = stack.findIndex((e) => e.id === id);
  if (existing !== -1) stack.splice(existing, 1);
  stack.push({ id, el, opts });
}

/** Removes an anchor wherever it sits in the stack. */
export function popAnchor(id: string): void {
  const index = stack.findIndex((e) => e.id === id);
  if (index !== -1) stack.splice(index, 1);
}

/** The topmost still-connected entry, dropping stale ones as it goes. */
function topEntry(): Entry | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].el.isConnected) return stack[i];
  }
  return null;
}

/** Rect of the active anchor, or null when there is none. */
export function activeAnchorRect(): AnchorRect | null {
  const entry = topEntry();
  if (!entry) return null;
  const r = entry.el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

/** Fitting overrides of the active anchor. */
export function activeAnchorOptions(): AnchorOptions {
  return topEntry()?.opts ?? {};
}
```

- [ ] **Step 4: Implement `src/hooks/useSashaAnchor.ts`**

```ts
/**
 * Registers a DOM element as the stage's active anchor for the lifetime of the
 * component. Any screen can place Sasha by rendering a box and calling this.
 */
import { useEffect } from 'react';
import type { RefObject } from 'react';
import { pushAnchor, popAnchor, type AnchorOptions } from '../stage/anchorRegistry';

export function useSashaAnchor(
  ref: RefObject<HTMLElement | null>,
  id: string,
  opts: AnchorOptions = {},
): void {
  // Serialised so a fresh object literal on every render doesn't re-register.
  const optsKey = JSON.stringify(opts);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    pushAnchor(id, el, JSON.parse(optsKey) as AnchorOptions);
    return () => popAnchor(id);
  }, [ref, id, optsKey]);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm test -- anchorRegistry`
Expected: PASS, 9 tests.

- [ ] **Step 6: Run the full check**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/stage/anchorRegistry.ts src/hooks/useSashaAnchor.ts src/stage/__tests__/anchorRegistry.test.ts
git commit -m "feat(stage): add anchor registry and useSashaAnchor hook"
```

---

### Task 9: Renderer and model loader

**Files:**

- Create: `src/stage/renderer.ts`
- Create: `src/stage/loadModel.ts`

**Interfaces:**

- Consumes: `QualityTier`, `TierSettings`, `ModelMetrics` from `src/stage/types.ts`; `tierSettings` from `src/stage/quality.ts`.
- Produces:
  - `createStage(canvas: HTMLCanvasElement, tier: QualityTier): Stage | null`
  - `interface Stage { scene, camera, renderer, setGroundOpacity(v: number): void; resize(w: number, h: number): void; dispose(): void }`
  - `loadSashaModel(opts: { onProgress?: (p: number) => void }): Promise<LoadedModel>`
  - `interface LoadedModel { object: THREE.Object3D; metrics: ModelMetrics }`
  - `setModelOpacity(object: THREE.Object3D, opacity: number): void`

No unit tests — these need a real WebGL context. Verified via `npm run build` and the manual pass in Task 15.

- [ ] **Step 1: Implement `src/stage/renderer.ts`**

```ts
/**
 * WebGL stage setup: renderer, camera, lighting rig and ground disc.
 * Everything here is tier-aware; the low tier drops to two lights, a lower
 * pixel-ratio cap and no ground disc.
 */
import * as THREE from 'three';
import type { QualityTier } from './types';
import { tierSettings } from './quality';

export interface Stage {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  /** Ground halo opacity; a no-op on tiers without a ground disc. */
  setGroundOpacity(v: number): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

/** Returns null when WebGL is unavailable — callers must show a fallback. */
export function createStage(canvas: HTMLCanvasElement, tier: QualityTier): Stage | null {
  const settings = tierSettings(tier);

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: tier === 'high',
      alpha: true,
    });
  } catch (err) {
    console.warn('SashaStage: WebGL unavailable', err);
    return null;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.1,
    100,
  );
  camera.position.set(0, 1, 6.4);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, settings.maxPixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.4;

  // Warm, on-brand lighting rig. Amber fill, cool rim.
  const disposables: Array<{ dispose(): void }> = [];
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(3, 8, 5);
  scene.add(keyLight);

  if (settings.lights === 'full') {
    const fillLight = new THREE.DirectionalLight(0xf4911a, 0.5);
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x88bbff, 0.8);
    rimLight.position.set(-1, 4, -8);
    scene.add(rimLight);
    const bottomLight = new THREE.PointLight(0xf4911a, 0.4, 10);
    bottomLight.position.set(0, -2, 2);
    scene.add(bottomLight);
  }

  let groundMat: THREE.MeshBasicMaterial | null = null;
  if (settings.ground) {
    groundMat = new THREE.MeshBasicMaterial({
      color: 0xf4911a,
      transparent: true,
      opacity: 0.05,
    });
    const geometry = new THREE.CircleGeometry(2.5, 48);
    const ground = new THREE.Mesh(geometry, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);
    disposables.push(geometry, groundMat);
  }

  return {
    scene,
    camera,
    renderer,
    setGroundOpacity(v: number) {
      if (groundMat) groundMat.opacity = v;
    },
    resize(width: number, height: number) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    },
    dispose() {
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
}
```

- [ ] **Step 2: Implement `src/stage/loadModel.ts`**

```ts
/**
 * Loads the Sasha GLB.
 *
 * Prefers the Draco-compressed build (~10x smaller); falls back to the
 * uncompressed source if the decoder or the compressed file fails, so a broken
 * asset pipeline degrades to "slow" rather than "no character".
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import type { ModelMetrics } from './types';

const COMPRESSED_URL = '/models/Sasha-Character.draco.glb';
const FALLBACK_URL = '/models/Sasha-Character.glb';
const DECODER_PATH = '/draco/';

/** Target world height for the model's largest dimension. */
const TARGET_SIZE = 2.8;

export interface LoadedModel {
  object: THREE.Object3D;
  metrics: ModelMetrics;
}

function measure(object: THREE.Object3D): ModelMetrics {
  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  return {
    center: { x: center.x, y: center.y, z: center.z },
    size: { x: size.x, y: size.y, z: size.z },
    baseScale: TARGET_SIZE / maxDim,
  };
}

function loadFrom(
  url: string,
  useDraco: boolean,
  onProgress?: (p: number) => void,
): Promise<LoadedModel> {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    let draco: DRACOLoader | null = null;
    if (useDraco) {
      draco = new DRACOLoader();
      draco.setDecoderPath(DECODER_PATH);
      loader.setDRACOLoader(draco);
    }
    loader.load(
      url,
      (gltf) => {
        draco?.dispose();
        const object = gltf.scene;
        const metrics = measure(object);
        // Normalise so the anchor system works in predictable units.
        object.scale.setScalar(metrics.baseScale);
        resolve({ object, metrics });
      },
      (event) => {
        if (onProgress && event.lengthComputable) {
          onProgress(event.loaded / event.total);
        }
      },
      (error) => {
        draco?.dispose();
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

/** Loads the model, retrying uncompressed if the Draco path fails. */
export async function loadSashaModel(
  opts: { onProgress?: (p: number) => void } = {},
): Promise<LoadedModel> {
  try {
    return await loadFrom(COMPRESSED_URL, true, opts.onProgress);
  } catch (err) {
    console.warn('SashaStage: Draco model failed, retrying uncompressed', err);
    return loadFrom(FALLBACK_URL, false, opts.onProgress);
  }
}

/**
 * Sets opacity across every material in the model.
 *
 * Whole-model only — never reach into named sub-meshes such as Head. The GLB
 * has no skeleton, and the authored child transforms are what place the head
 * correctly (see commit 15e26e4).
 */
export function setModelOpacity(object: THREE.Object3D, opacity: number): void {
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.material) return;
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      material.transparent = true;
      material.opacity = opacity;
    }
  });
}
```

- [ ] **Step 3: Verify it typechecks and builds**

Run: `npm run typecheck && npm run lint && npm run build`
Expected: all pass. `loadModel.ts` and `renderer.ts` have no tests by design.

- [ ] **Step 4: Commit**

```bash
git add src/stage/renderer.ts src/stage/loadModel.ts
git commit -m "feat(stage): add tier-aware renderer and Draco model loader with fallback"
```

---

### Task 10: Rewire SashaStage and add the rocket overlay

**Files:**

- Modify: `src/components/SashaStage.tsx` (full rewrite)
- Create: `src/components/RocketLaunch.tsx`
- Create: `src/components/SashaFallback.tsx`
- Modify: `src/index.css` (rocket keyframes)
- Modify: `src/components/AppShell.tsx`

**Interfaces:**

- Consumes: everything from Tasks 2–9.
- Produces:
  - `SashaStage` props: `{ mode: StageMode; mood?: SashaMood }` — unchanged, so `AppShell` keeps working.
  - `RocketLaunch` props: `{ state: EntranceState; loadProgress: number }`
  - `SashaFallback` props: `{ visible: boolean }`

- [ ] **Step 1: Create `src/components/RocketLaunch.tsx`**

```tsx
/**
 * The rocket entrance overlay. Pure presentation — it knows nothing about
 * three.js and simply renders whatever EntranceState it is handed.
 */
import type { EntranceState } from '../stage/types';

interface RocketLaunchProps {
  state: EntranceState;
  /** GLB download progress 0..1, shown as a ring while the timeline is gated. */
  loadProgress: number;
}

export default function RocketLaunch({ state, loadProgress }: RocketLaunchProps) {
  if (state.complete) return null;

  // Travel from just below the viewport to the burst point above centre.
  const travel = state.rocketProgress;
  const bottom = `${-12 + travel * 62}vh`;
  const rocketOpacity = state.phase === 'launch' ? 1 : Math.max(0, 1 - state.flare * 1.2);
  const rocketScale = state.phase === 'launch' ? 1 : 1 + (1 - state.flare) * 0.6;

  // While gated on the download, the ring reports real progress.
  const gated = state.phase === 'burst';
  const ringLength = 2 * Math.PI * 22;

  return (
    <div className="lws-rocket-layer" aria-hidden>
      <div
        className="lws-rocket-flare"
        style={{
          opacity: state.flare * 0.9,
          transform: `scale(${0.4 + state.flare * 2.4})`,
        }}
      />
      <div
        className="lws-rocket"
        style={{ bottom, opacity: rocketOpacity, transform: `scale(${rocketScale})` }}
      >
        <svg width="46" height="72" viewBox="0 0 46 72" fill="none">
          <path
            d="M23 2c8 8 12 18 12 30v16H11V32C11 20 15 10 23 2z"
            fill="#fef3c7"
            stroke="#d97706"
            strokeWidth="2"
          />
          <circle cx="23" cy="26" r="6" fill="#f59e0b" stroke="#d97706" strokeWidth="2" />
          <path d="M11 40 2 54h9V40z" fill="#f97316" />
          <path d="M35 40l9 14h-9V40z" fill="#f97316" />
        </svg>
        <span className="lws-rocket-flame" />
        {gated && (
          <svg className="lws-rocket-ring" width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="22" stroke="#fde68a" strokeWidth="3" fill="none" />
            <circle
              cx="26"
              cy="26"
              r="22"
              stroke="#f59e0b"
              strokeWidth="3"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={ringLength}
              strokeDashoffset={ringLength * (1 - loadProgress)}
              transform="rotate(-90 26 26)"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/SashaFallback.tsx`**

```tsx
/**
 * Shown when WebGL is unavailable or the model cannot load. The app stays
 * fully usable — previously the stage silently rendered nothing.
 */
interface SashaFallbackProps {
  visible: boolean;
}

export default function SashaFallback({ visible }: SashaFallbackProps) {
  if (!visible) return null;
  return (
    <div className="lws-sasha-fallback" aria-hidden>
      <img src="/logo.png" alt="" width={160} height={160} />
    </div>
  );
}
```

- [ ] **Step 3: Add the overlay styles to `src/index.css`**

Append before the `/* --- markdown ... */` block:

```css
/* --- rocket entrance overlay -------------------------------------------- */
.lws-rocket-layer {
  position: fixed;
  inset: 0;
  z-index: 3;
  pointer-events: none;
  overflow: hidden;
}
.lws-rocket {
  position: absolute;
  left: 50%;
  margin-left: -23px;
  display: flex;
  flex-direction: column;
  align-items: center;
  will-change: transform, opacity, bottom;
}
.lws-rocket-flame {
  display: block;
  width: 14px;
  height: 30px;
  margin-top: -4px;
  border-radius: 0 0 50% 50%;
  background: linear-gradient(180deg, var(--lws-orange), var(--lws-amber-light));
  filter: blur(2px);
  animation: lwsFlame 0.14s ease-in-out infinite alternate;
}
@keyframes lwsFlame {
  from {
    transform: scaleY(0.75);
    opacity: 0.85;
  }
  to {
    transform: scaleY(1.25);
    opacity: 1;
  }
}
.lws-rocket-ring {
  position: absolute;
  top: -3px;
  left: -3px;
}
.lws-rocket-flare {
  position: absolute;
  left: 50%;
  top: 38%;
  width: 220px;
  height: 220px;
  margin: -110px 0 0 -110px;
  border-radius: 9999px;
  background: radial-gradient(
    circle,
    #fff7e0 0%,
    var(--lws-amber-light) 45%,
    transparent 70%
  );
  will-change: transform, opacity;
}

/* --- static fallback when WebGL or the model is unavailable -------------- */
.lws-sasha-fallback {
  position: fixed;
  inset: 0;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0.9;
}

@media (prefers-reduced-motion: reduce) {
  .lws-rocket-layer {
    display: none;
  }
}
```

- [ ] **Step 4: Rewrite `src/components/SashaStage.tsx`**

Replace the entire file:

```tsx
/**
 * SashaStage — the one and only Sasha.
 *
 * A thin wrapper: it owns the canvas, the rAF loop and the eased interpolation
 * between frames. All decisions (where she sits, how she moves, which camera
 * shot, when the entrance advances) come from the pure modules in src/stage/.
 *
 * Mounted once in AppShell and never unmounted, so navigating between
 * Landing / Auth / Chat glides the same model between anchors.
 */
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { createStage } from '../stage/renderer';
import { loadSashaModel, setModelOpacity } from '../stage/loadModel';
import { detectTier, prefersReducedMotion } from '../stage/quality';
import { activeAnchorRect, activeAnchorOptions } from '../stage/anchorRegistry';
import {
  rectCenterToNdc,
  rectVisible,
  fitScale,
  anchorToWorld,
  worldPerPixel,
} from '../stage/anchors';
import { pose } from '../stage/poseDirector';
import { SHOTS, shotFor, withDrift } from '../stage/cameraDirector';
import { entranceState, hasSeenEntrance, markEntranceSeen } from '../stage/entrance';
import type { AnchorFit, EntranceState, ModelMetrics, StageMode } from '../stage/types';
import { getVoiceAmplitude } from '../context/VoiceContext';
import type { SashaMood } from '../context/VoiceContext';
import RocketLaunch from './RocketLaunch';
import SashaFallback from './SashaFallback';

export type { StageMode };

interface SashaStageProps {
  mode: StageMode;
  mood?: SashaMood;
}

/** Metrics used before the model resolves, so the first frames are sane. */
const PLACEHOLDER_METRICS: ModelMetrics = {
  center: { x: 0, y: 0, z: 0 },
  size: { x: 1, y: 1, z: 1 },
  baseScale: 1,
};

export default function SashaStage({ mode, mood = 'idle' }: SashaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The render loop reads mode/mood through refs so prop changes re-target the
  // running loop instead of rebuilding the WebGL context.
  const modeRef = useRef<StageMode>(mode);
  const moodRef = useRef<SashaMood>(mood);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  // Entrance state is mirrored into React only for the overlay, at a coarse
  // cadence — the loop itself reads the pure function every frame.
  const [entrance, setEntrance] = useState<EntranceState>(() =>
    entranceState({
      elapsed: 0,
      loadProgress: 0,
      gateReleasedAt: null,
      reducedMotion: prefersReducedMotion(),
      skip: hasSeenEntrance(),
    }),
  );
  const [loadProgress, setLoadProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const tier = detectTier();
    const reducedMotion = prefersReducedMotion();
    const stage = createStage(canvas, tier);
    if (!stage) {
      setFailed(true);
      return;
    }

    let model: THREE.Object3D | null = null;
    let metrics = PLACEHOLDER_METRICS;
    let gateReleasedAt: number | null = null;
    let firstFrameDrawn = false;
    const skip = hasSeenEntrance();

    const clock = new THREE.Clock();
    let animId = 0;
    let disposed = false;
    let progress = 0;

    void loadSashaModel({
      onProgress: (p) => {
        progress = p;
        setLoadProgress(p);
      },
    })
      .then((loaded) => {
        if (disposed) return;
        model = loaded.object;
        metrics = loaded.metrics;
        setModelOpacity(model, 0);
        stage.scene.add(model);
      })
      .catch((err) => {
        console.warn('SashaStage: model failed to load', err);
        if (!disposed) setFailed(true);
      });

    // Pointer tracking, smoothed in the loop.
    let pointerX = 0;
    let pointerY = 0;
    let targetPointerX = 0;
    let targetPointerY = 0;
    const onPointerMove = (e: MouseEvent) => {
      targetPointerX = (e.clientX / window.innerWidth) * 2 - 1;
      targetPointerY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onPointerMove);

    // Eased pose state carried across frames.
    const curPos = new THREE.Vector3();
    const curScale = new THREE.Vector3(1, 1, 1);
    let curRotX = 0;
    let curRotY = 0;
    let curRotZ = 0;
    let curOpacity = 0;
    let seeded = false;

    const camPos = new THREE.Vector3().copy(stage.camera.position);
    const camTarget = new THREE.Vector3(0, 0.6, 0);

    // Coarse mirror of entrance state into React (the overlay only needs ~30fps).
    let lastPublish = 0;

    function frame() {
      animId = requestAnimationFrame(frame);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      // Gate: the model must be added AND one frame drawn before the entrance
      // proceeds past burst.
      if (gateReleasedAt === null && model && firstFrameDrawn) {
        gateReleasedAt = elapsed;
      }

      const ent = entranceState({
        elapsed,
        loadProgress: progress,
        gateReleasedAt,
        reducedMotion,
        skip,
      });
      if (elapsed - lastPublish > 0.033) {
        lastPublish = elapsed;
        setEntrance(ent);
      }
      if (ent.complete) markEntranceSeen();

      pointerX += (targetPointerX - pointerX) * 0.05;
      pointerY += (targetPointerY - pointerY) * 0.05;

      // --- resolve the active anchor into world space ---------------------
      const currentMode = modeRef.current;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const rect = activeAnchorRect();
      let anchor: AnchorFit | null = null;
      if (rect) {
        const ndc = rectCenterToNdc(rect, viewport);
        const center = anchorToWorld(stage.camera, ndc.x, ndc.y);
        const wpp = worldPerPixel(stage.camera, viewport.height);
        const scale = fitScale(
          rect,
          metrics.size.y * metrics.baseScale,
          metrics.size.x * metrics.baseScale,
          wpp,
          activeAnchorOptions(),
        );
        anchor = { center, scale, visible: rectVisible(rect, viewport) };
      }

      const target = pose(
        {
          mode: currentMode,
          mood: moodRef.current,
          elapsed,
          pointer: { x: pointerX, y: pointerY },
          anchor,
          amplitude: getVoiceAmplitude(),
          reducedMotion,
          entranceScale: ent.modelScale,
          entranceOpacity: ent.modelOpacity,
        },
        metrics,
      );

      // Seed on the first pose so the model doesn't fly in from the origin.
      if (!seeded) {
        curPos.set(target.position.x, target.position.y, target.position.z);
        curScale.setScalar(target.scale);
        seeded = true;
      }

      const easeK = Math.min(delta * 5, 1);
      curPos.lerp(
        new THREE.Vector3(target.position.x, target.position.y, target.position.z),
        easeK,
      );
      curScale.lerp(new THREE.Vector3(target.scale, target.scale, target.scale), easeK);
      curRotX += (target.rotation.x - curRotX) * easeK;
      curRotY += (target.rotation.y - curRotY) * easeK;
      curRotZ += (target.rotation.z - curRotZ) * easeK;
      curOpacity += (target.opacity - curOpacity) * easeK;

      if (model) {
        model.position.copy(curPos);
        model.scale.copy(curScale);
        model.rotation.set(curRotX, curRotY, curRotZ);
        setModelOpacity(model, curOpacity);
      }

      stage.setGroundOpacity(
        (reducedMotion ? 0.05 : 0.05 + Math.sin(elapsed * 1.5) * 0.02) * curOpacity,
      );

      // --- camera ---------------------------------------------------------
      const shot = withDrift(
        SHOTS[shotFor(currentMode, viewport.width)],
        elapsed,
        reducedMotion,
      );
      camPos.lerp(
        new THREE.Vector3(shot.position.x, shot.position.y, shot.position.z),
        easeK * 0.6,
      );
      camTarget.lerp(
        new THREE.Vector3(shot.target.x, shot.target.y, shot.target.z),
        easeK * 0.6,
      );
      stage.camera.position.copy(camPos);
      stage.camera.lookAt(camTarget);

      stage.renderer.render(stage.scene, stage.camera);
      if (model) firstFrameDrawn = true;
    }

    // Pause the loop in background tabs — the old implementation ran forever.
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animId);
      } else {
        clock.getDelta(); // discard the gap so nothing jumps
        animId = requestAnimationFrame(frame);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    const onResize = () => stage.resize(window.innerWidth, window.innerHeight);
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);

    frame();

    return () => {
      disposed = true;
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onPointerMove);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      stage.dispose();
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />
      <RocketLaunch state={entrance} loadProgress={loadProgress} />
      <SashaFallback visible={failed} />
    </>
  );
}
```

- [ ] **Step 5: Update the `SASHA_DOCK_ID` import site**

`src/components/learnWithSasha/constants.ts` is no longer imported by `SashaStage`. Leave the file — `ChatHome` still uses the id in Task 13. Confirm nothing broke:

Run: `npm run typecheck`
Expected: PASS. If it reports `SASHA_DOCK_ID` unused anywhere, leave the constant; Task 13 wires it to the hook.

- [ ] **Step 6: Verify the whole suite and build**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 7: Manual smoke test**

Run: `npm run dev`, open `http://localhost:3000`.
Expected: rocket launches from the bottom, bursts near centre, Sasha scales in and waves. Hard-refresh replays it; navigating to login does not.

- [ ] **Step 8: Commit**

```bash
git add src/components/SashaStage.tsx src/components/RocketLaunch.tsx src/components/SashaFallback.tsx src/index.css
git commit -m "feat(stage): rewire SashaStage onto pure modules with a rocket entrance"
```

---

### Task 11: Design tokens

**Files:**

- Modify: `src/index.css`

**Interfaces:**

- Consumes: nothing.
- Produces: CSS custom properties consumed by Tasks 12–14:
  `--lws-space-1..6`, `--lws-radius-sm/md/lg/xl`, `--lws-shadow-1/2/3`, `--lws-ease`, `--lws-dur-fast/base`.

- [ ] **Step 1: Add the token block**

In `src/index.css`, inside the existing `:root` block (after `--lws-header-h`), add:

```css
/* Spacing rhythm — components use these instead of ad hoc padding. */
--lws-space-1: 4px;
--lws-space-2: 8px;
--lws-space-3: 12px;
--lws-space-4: 16px;
--lws-space-5: 24px;
--lws-space-6: 32px;

/* Corner radii. */
--lws-radius-sm: 8px;
--lws-radius-md: 12px;
--lws-radius-lg: 16px;
--lws-radius-xl: 24px;

/* Elevation scale — three steps, used consistently across cards. */
--lws-shadow-1: 0 1px 2px rgba(15, 23, 42, 0.06);
--lws-shadow-2: 0 4px 16px rgba(15, 23, 42, 0.08);
--lws-shadow-3: 0 12px 40px rgba(15, 23, 42, 0.12);

/* Motion — one easing curve and two durations for every transition. */
--lws-ease: cubic-bezier(0.22, 1, 0.36, 1);
--lws-dur-fast: 140ms;
--lws-dur-base: 240ms;
```

- [ ] **Step 2: Add the shared surface and interaction classes**

Append after the token block, before `.lws-header`:

```css
/* --- shared surfaces ----------------------------------------------------- */
.lws-surface {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: var(--lws-radius-lg);
  box-shadow: var(--lws-shadow-1);
}
.lws-surface-raised {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: var(--lws-radius-xl);
  box-shadow: var(--lws-shadow-2);
}

/* --- shared interactions ------------------------------------------------- */
.lws-lift {
  transition:
    transform var(--lws-dur-fast) var(--lws-ease),
    box-shadow var(--lws-dur-fast) var(--lws-ease),
    opacity var(--lws-dur-fast) var(--lws-ease);
}
.lws-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--lws-shadow-2);
}
.lws-lift:active {
  transform: translateY(0);
}

/* Staggered entrance for lists and headline words. */
.lws-rise {
  opacity: 0;
  transform: translateY(10px);
  animation: lwsRise var(--lws-dur-base) var(--lws-ease) forwards;
}
@keyframes lwsRise {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

- [ ] **Step 3: Verify formatting and build**

Run: `npm run format && npm run check && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "style: add spacing, radius, elevation and motion design tokens"
```

---

### Task 12: Landing page — anchor and redesign

**Files:**

- Modify: `src/components/LandingPage.tsx`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `useSashaAnchor` (Task 8), tokens (Task 11).
- Produces: an anchor registered under the id `'landing'`.

- [ ] **Step 1: Rewrite `src/components/LandingPage.tsx`**

```tsx
/**
 * Landing / hero screen. The centre column is registered as Sasha's anchor, so
 * the 3D character is placed by layout rather than by hardcoded constants.
 */
import { useEffect, useRef } from 'react';
import { useVoice } from '../context/VoiceContext';
import { useSashaAnchor } from '../hooks/useSashaAnchor';

interface LandingPageProps {
  onGetStarted: () => void;
}

const HEADLINE_WORDS = ['Learn', 'With', 'Sasha'];

export default function LandingPage({ onGetStarted }: LandingPageProps) {
  const { setMood, speak, muted } = useVoice();
  const anchorRef = useRef<HTMLDivElement | null>(null);
  useSashaAnchor(anchorRef, 'landing', { fillY: 0.95, max: 1.9 });

  useEffect(() => {
    setMood('wave');
    const t = setTimeout(() => {
      if (!muted) speak("Hi! I'm Sasha. Let's learn together.");
    }, 1400); // after the rocket burst, not during it
    const t2 = setTimeout(() => setMood('idle'), 4600);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [setMood, speak, muted]);

  return (
    <div className="lws-landing">
      <div className="lws-landing-grid">
        <div className="lws-landing-card lg:!bg-transparent lg:!border-none lg:!shadow-none lg:!p-0">
          <div className="text-center lg:text-right">
            <span
              className="lws-rise inline-block text-xs font-bold text-amber-600 uppercase tracking-widest mb-3"
              style={{ animationDelay: '1.2s' }}
            >
              AI Math Tutor
            </span>
            <h1 className="lws-landing-title">
              {HEADLINE_WORDS.map((word, i) => (
                <span
                  key={word}
                  className="lws-rise inline-block"
                  style={{ animationDelay: `${1.3 + i * 0.09}s` }}
                >
                  {word === 'Learn' ? (
                    word
                  ) : (
                    <span className="text-amber-600">{word}</span>
                  )}
                  {i < HEADLINE_WORDS.length - 1 && ' '}
                </span>
              ))}
            </h1>
          </div>
        </div>

        {/* Sasha's anchor. The stage measures this box every frame. */}
        <div ref={anchorRef} className="lws-landing-anchor" aria-hidden />

        <div className="text-center lg:text-left">
          <p
            className="lws-rise text-slate-600 max-w-md mx-auto lg:mx-0"
            style={{ fontSize: 'clamp(15px, 1.6vw, 18px)', animationDelay: '1.6s' }}
          >
            Your personal AI tutor for math. Explore concepts through your favourite
            topics, solve problems step by step, and hear Sasha explain — voice and all.
          </p>
          <div
            className="lws-rise mt-8 flex flex-wrap gap-3 lg:justify-start justify-center"
            style={{ animationDelay: '1.75s' }}
          >
            <button onClick={onGetStarted} className="lws-cta lws-lift">
              Get Started
            </button>
          </div>
          <p
            className="lws-rise text-xs text-slate-400 mt-4"
            style={{ animationDelay: '1.9s' }}
          >
            Lessons tailored to you · saved automatically
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the landing styles to `src/index.css`**

Replace the existing `/* --- landing mobile legibility --- */` block with:

```css
/* --- landing ------------------------------------------------------------- */
.lws-landing {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lws-space-6) var(--lws-space-4);
}
.lws-landing-grid {
  width: 100%;
  max-width: 1152px;
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: var(--lws-space-5);
}
.lws-landing-title {
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
  font-size: clamp(34px, 6vw, 60px);
  line-height: 1.1;
}
.lws-landing-anchor {
  width: 100%;
  height: 55vh;
  order: -1;
}

/* Shared amber CTA. */
.lws-cta {
  background: linear-gradient(90deg, var(--lws-amber), var(--lws-orange));
  color: #fff;
  font-weight: 600;
  font-size: 15px;
  padding: 14px var(--lws-space-6);
  border-radius: var(--lws-radius-md);
  box-shadow: var(--lws-shadow-1);
}
.lws-cta:focus-visible {
  outline: 2px solid var(--lws-amber-dark);
  outline-offset: 2px;
}

@media (min-width: 1024px) {
  .lws-landing-grid {
    grid-template-columns: 1fr auto 1fr;
    gap: var(--lws-space-6);
  }
  .lws-landing-anchor {
    order: 0;
    width: clamp(240px, 26vw, 360px);
    height: clamp(340px, 52vh, 580px);
  }
}
@media (min-width: 640px) and (max-width: 1023px) {
  .lws-landing-anchor {
    width: 40vw;
    height: 46vh;
    margin: 0 auto;
  }
}

/* Below lg, Sasha renders behind the landing text. Keep the copy legible. */
@media (max-width: 1023px) {
  .lws-landing-card {
    position: relative;
    z-index: 4;
    background: rgba(255, 255, 255, 0.92);
    border: 1px solid #e2e8f0;
    border-radius: var(--lws-radius-xl);
    box-shadow: var(--lws-shadow-2);
    padding: var(--lws-space-5) var(--lws-space-4);
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual check at three widths**

Run `npm run dev` and check 375px, 768px, 1440px. Sasha must sit inside the anchor box at every width, never overlapping the headline on desktop.

- [ ] **Step 5: Commit**

```bash
git add src/components/LandingPage.tsx src/index.css
git commit -m "feat(landing): anchor Sasha to layout and add staggered entrance"
```

---

### Task 13: Login page — anchor, alignment fix and redesign

**Files:**

- Modify: `src/components/AuthScreen.tsx`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `useSashaAnchor` (Task 8), tokens (Task 11).
- Produces: an anchor registered under the id `'auth'`.

This is the fix for the reported misalignment: today `AuthScreen.tsx:48` reserves a left column while the stage anchors at screen centre.

- [ ] **Step 1: Rewrite `src/components/AuthScreen.tsx`**

```tsx
/**
 * Auth screen: email + password login against the shared sasha_lms account.
 *
 * The left column is registered as Sasha's anchor, so she sits inside the space
 * reserved for her instead of floating over the form (the previous behaviour:
 * the stage anchored at screen centre while this file reserved a left column).
 */
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useVoice } from '../context/VoiceContext';
import { useSashaAnchor } from '../hooks/useSashaAnchor';

export default function AuthScreen() {
  const { login, error, clearError, loading } = useAuth();
  const { setMood, speak, muted } = useVoice();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  useSashaAnchor(anchorRef, 'auth', { fillY: 0.92, max: 1.6 });

  useEffect(() => {
    setMood('idle');
    return () => setMood('idle');
  }, [setMood]);

  useEffect(() => {
    if (error) {
      setMood('shake');
      const t = setTimeout(() => setMood('idle'), 700);
      return () => clearTimeout(t);
    }
  }, [error, setMood]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMood('thinking');
    try {
      await login(email.trim(), password);
      if (!muted) speak('Welcome back!');
    } catch {
      /* error surfaced via context */
    } finally {
      setSubmitting(false);
      setMood('idle');
    }
  };

  const busy = submitting || loading;

  return (
    <div className="lws-auth">
      <div className="lws-auth-grid">
        {/* Sasha's column: greeting bubble above her anchor box. */}
        <div className="lws-auth-aside">
          <div className="lws-bubble lws-auth-bubble">
            <span className="text-sm font-semibold text-slate-800">
              Sign in and let&apos;s begin.
            </span>
          </div>
          <div ref={anchorRef} className="lws-auth-anchor" aria-hidden />
        </div>

        <div className="lws-surface-raised lws-auth-card">
          <div className="mb-8 text-center">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-2xl border border-amber-500/20 mx-auto mb-3">
              ∞
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Welcome back</h1>
            <p className="text-sm text-slate-500 mt-1">Use your Sasha account</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="lws-field">
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                required
                autoFocus
                placeholder=" "
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) clearError();
                }}
              />
              <label htmlFor="login-email">Email</label>
            </div>

            <div className="lws-field">
              <input
                id="login-password"
                type="password"
                autoComplete="current-password"
                required
                placeholder=" "
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) clearError();
                }}
              />
              <label htmlFor="login-password">Password</label>
            </div>

            {error && (
              <p role="alert" className="lws-auth-error">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="lws-cta lws-lift w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy && (
                <span
                  className="lws-voice-spinner"
                  aria-hidden
                  style={{ width: 16, height: 16 }}
                />
              )}
              {busy ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Don&apos;t have an account?{' '}
            <a
              href="https://sashainfinity.com"
              target="_blank"
              rel="noreferrer"
              className="text-amber-600 font-semibold"
            >
              Create one on sashainfinity.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the auth styles to `src/index.css`**

Append after the landing block:

```css
/* --- auth ---------------------------------------------------------------- */
.lws-auth {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--lws-space-6) var(--lws-space-4);
}
.lws-auth-grid {
  width: 100%;
  max-width: 980px;
  display: grid;
  grid-template-columns: 1fr;
  align-items: center;
  gap: var(--lws-space-5);
}
.lws-auth-aside {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--lws-space-3);
}
.lws-auth-bubble {
  padding: var(--lws-space-3) var(--lws-space-4);
  text-align: center;
  box-shadow: var(--lws-shadow-1);
}
/* Mobile: a compact strip above the card. */
.lws-auth-anchor {
  width: 100%;
  height: 180px;
}
.lws-auth-card {
  padding: var(--lws-space-6);
  position: relative;
  z-index: 4;
}

.lws-auth-error {
  font-size: 12px;
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
  border-radius: var(--lws-radius-sm);
  padding: var(--lws-space-2) var(--lws-space-3);
  animation: lwsShakeIn 0.4s var(--lws-ease);
}
@keyframes lwsShakeIn {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  25% {
    transform: translateX(-5px);
    opacity: 1;
  }
  50% {
    transform: translateX(4px);
  }
  75% {
    transform: translateX(-2px);
  }
  100% {
    transform: translateX(0);
  }
}

/* Floating-label text field. */
.lws-field {
  position: relative;
}
.lws-field input {
  width: 100%;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: var(--lws-radius-md);
  padding: 20px var(--lws-space-4) 8px;
  font-size: 14px;
  color: #0f172a;
  transition:
    border-color var(--lws-dur-fast) var(--lws-ease),
    box-shadow var(--lws-dur-fast) var(--lws-ease);
}
.lws-field input:focus {
  outline: none;
  border-color: var(--lws-amber);
  box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.18);
}
.lws-field label {
  position: absolute;
  left: var(--lws-space-4);
  top: 14px;
  font-size: 14px;
  font-weight: 600;
  color: #94a3b8;
  pointer-events: none;
  transition: all var(--lws-dur-fast) var(--lws-ease);
}
.lws-field input:focus + label,
.lws-field input:not(:placeholder-shown) + label {
  top: 6px;
  font-size: 11px;
  color: var(--lws-amber-dark);
}

@media (min-width: 640px) {
  .lws-auth-anchor {
    height: 240px;
  }
}
@media (min-width: 1024px) {
  .lws-auth-grid {
    grid-template-columns: 1fr 420px;
    gap: var(--lws-space-6);
  }
  .lws-auth-anchor {
    height: clamp(360px, 58vh, 560px);
  }
}
```

- [ ] **Step 3: Verify**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual verification of the reported bug**

Run `npm run dev`, navigate to the login screen at 1440px.
Expected: Sasha sits inside the left column, fully clear of the form card. Resize continuously from 1440px down to 375px — she must stay inside her box the whole way, never crossing the card.

- [ ] **Step 5: Commit**

```bash
git add src/components/AuthScreen.tsx src/index.css
git commit -m "fix(auth): anchor Sasha to the reserved column and restyle the form"
```

---

### Task 14: Dashboard — anchor, mobile presence and redesign

**Files:**

- Modify: `src/components/ChatHome.tsx`
- Modify: `src/index.css`

**Interfaces:**

- Consumes: `useSashaAnchor` (Task 8), `SASHA_DOCK_ID` from `src/components/learnWithSasha/constants.ts`, tokens (Task 11).
- Produces: an anchor registered under the id `'dock'`.

Today `lws-hide-below-lg` on the mascot section (`ChatHome.tsx:275`) hides Sasha entirely from mobile users after login. This task gives mobile a compact inline presence instead.

- [ ] **Step 1: Register the dock as an anchor**

In `src/components/ChatHome.tsx`, add to the imports:

```tsx
import { useSashaAnchor } from '../hooks/useSashaAnchor';
import { SASHA_DOCK_ID } from './learnWithSasha/constants';
```

Inside the component, next to the other refs (after `activeIdRef`), add:

```tsx
// Sasha's dock. Registered as the stage anchor so the 3D character is placed
// by layout — on desktop the mascot card, on mobile the compact strip.
const dockRef = useRef<HTMLDivElement | null>(null);
useSashaAnchor(dockRef, 'dock', { fillY: 0.94, max: 1.4 });
```

- [ ] **Step 2: Attach the ref to the dock element**

Replace this line in the mascot card:

```tsx
<div id="sasha-dock" className="lws-dock" />
```

with:

```tsx
<div ref={dockRef} id={SASHA_DOCK_ID} className="lws-dock" />
```

- [ ] **Step 3: Make the mascot card visible on mobile in compact form**

Replace the opening tag of the mascot section:

```tsx
      <section className="lg:col-span-4 flex flex-col gap-4 lws-hide-below-lg">
```

with:

```tsx
      <section className="lg:col-span-4 flex flex-col gap-4 lws-mascot-section">
```

and replace the wrapper of the dock:

```tsx
          <div className="my-8 flex flex-col items-center">
```

with:

```tsx
          <div className="lws-dock-wrap flex flex-col items-center">
```

- [ ] **Step 4: Add the dashboard styles to `src/index.css`**

Replace the existing `.lws-dock` rule with:

```css
/* --- the 3D dock (the stage anchors Sasha to this element) --------------- */
.lws-dock {
  width: 100%;
  max-width: 208px;
  aspect-ratio: 1 / 1;
  margin: 0 auto;
}
.lws-dock-wrap {
  margin: var(--lws-space-6) 0;
}

/* Below lg the mascot card collapses to a compact horizontal strip so mobile
   users still see Sasha (previously the whole section was hidden). */
@media (max-width: 1023px) {
  .lws-mascot-section .lws-mascot-card {
    flex-direction: row;
    align-items: center;
    gap: var(--lws-space-3);
    padding: var(--lws-space-3);
  }
  .lws-dock {
    max-width: 96px;
  }
  .lws-dock-wrap {
    margin: 0;
  }
  .lws-mascot-section .lws-bubble {
    flex: 1;
  }
  .lws-mascot-section .lws-mascot-tail {
    display: none;
  }
}
```

- [ ] **Step 5: Add hover and entrance affordances**

In `src/index.css`, append:

```css
/* --- dashboard polish ---------------------------------------------------- */
.lws-session-item {
  border-radius: var(--lws-radius-md);
  transition:
    background-color var(--lws-dur-fast) var(--lws-ease),
    transform var(--lws-dur-fast) var(--lws-ease);
}
.lws-session-item:hover {
  background-color: #f8fafc;
  transform: translateX(2px);
}
.lws-session-item[data-active='true'] {
  background-color: #fffbeb;
  box-shadow: inset 3px 0 0 var(--lws-amber);
}
.lws-message-in {
  animation: lwsRise var(--lws-dur-base) var(--lws-ease) forwards;
}
```

- [ ] **Step 6: Apply the session classes in `src/components/Sidebar.tsx`**

Open `src/components/Sidebar.tsx`, find the element rendering each session row, add `lws-session-item` to its className and `data-active={session.id === activeId}` as an attribute. Keep every existing class — this only adds.

- [ ] **Step 7: Apply the message entrance in `src/components/ChatPanel.tsx`**

Open `src/components/ChatPanel.tsx`, find the element wrapping each rendered message, and add `lws-message-in` to its className. Keep every existing class.

- [ ] **Step 8: Verify**

Run: `npm run check && npm run build`
Expected: PASS.

- [ ] **Step 9: Manual check**

Run `npm run dev`, sign in, and check 375px and 1440px.
Expected: desktop unchanged in structure with the model in the mascot card; mobile shows the compact strip with a small Sasha beside the greeting bubble. Scrolling the dock off screen fades her out.

- [ ] **Step 10: Commit**

```bash
git add src/components/ChatHome.tsx src/components/Sidebar.tsx src/components/ChatPanel.tsx src/index.css
git commit -m "feat(dashboard): anchor the dock, restore Sasha on mobile, polish interactions"
```

---

### Task 15: Final verification pass

**Files:**

- Modify: any file needing a fix found during verification.

**Interfaces:**

- Consumes: the complete implementation.
- Produces: a verified, committed branch.

- [ ] **Step 1: Run the full check**

Run: `npm run check`
Expected: typecheck, eslint, prettier and all unit tests pass. Record the test count.

- [ ] **Step 2: Verify the production build**

Run: `npm run build`
Expected: succeeds. Confirm the three chunk names and that `dist/models/Sasha-Character.draco.glb` exists.

- [ ] **Step 3: Verify the asset budget**

Run: `ls -l dist/models/Sasha-Character.draco.glb`
Expected: ≤ 512,000 bytes. If larger, lower `SIMPLIFY_RATIO` in `scripts/build-model.mjs`, re-run `npm run models:build`, and re-check visually.

- [ ] **Step 4: Verify the entrance on a cold and warm load**

Run `npm run preview`. In a fresh tab:

- Cold: rocket launches, bursts, Sasha scales in, then waves.
- Reload: rocket replays (new session only if the tab was closed); within the same tab the model fades in without the rocket.
- Navigate landing → login → dashboard: no rocket replay, the model glides between anchors.

- [ ] **Step 5: Verify throttled loading**

In DevTools set network throttling to "Slow 3G" and hard-reload with an empty cache.
Expected: the rocket holds at the burst point with a visible progress ring, then completes. No blank screen, no flash.

- [ ] **Step 6: Verify reduced motion**

In DevTools, Rendering → "Emulate CSS prefers-reduced-motion: reduce", then reload.
Expected: no rocket, the model fades in, and it holds a static pose — no sway, no breathing, no pointer tracking.

- [ ] **Step 7: Verify the WebGL-unavailable fallback**

In DevTools, disable WebGL (`chrome://flags` or run in a browser with WebGL blocked), then reload.
Expected: the static logo fallback renders and the app is fully usable — no blank stage, no thrown error.

- [ ] **Step 8: Verify responsiveness at three widths**

Check 375px, 768px and 1440px on landing, login and dashboard.
Expected: Sasha stays inside her anchor box on every screen at every width, and no horizontal page scroll appears.

- [ ] **Step 9: Verify background-tab throttling**

Open the app, switch to another tab for 30 seconds, and watch the CPU in the task manager.
Expected: usage drops to near zero while hidden, and animation resumes without a jump on return.

- [ ] **Step 10: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in the verification pass"
```

If no fixes were needed, skip this step and note that verification passed clean.

---

## Self-Review

**Spec coverage:**

| Spec requirement                                           | Task          |
| ---------------------------------------------------------- | ------------- |
| Rocket entrance timeline (launch/burst/reveal/settle/done) | 6, 10         |
| Load gating, never shortened                               | 6             |
| Preload hint + self-hosted Draco decoder                   | 7             |
| Once-per-session replay                                    | 6, 10         |
| Reduced motion in JS                                       | 3, 4, 6, 10   |
| WebGL / GLB / Draco failure paths                          | 9, 10         |
| Missing-anchor fallback                                    | 4             |
| Layered pose composition                                   | 4             |
| Named camera shots + drift                                 | 5             |
| Anchor rects per screen                                    | 8, 12, 13, 14 |
| Design tokens                                              | 11            |
| Landing / login / dashboard redesign                       | 12, 13, 14    |
| Mobile presence after login                                | 14            |
| gltf-transform pipeline, ~60k triangles                    | 7             |
| Quality tiers, background-tab pause                        | 3, 9, 10      |
| Budgets (≤500 KB, load time, fps)                          | 7, 15         |
| Vitest for poseDirector / anchors / entrance               | 2, 4, 6       |
| Manual verification matrix                                 | 15            |

No gaps.

**Placeholder scan:** No TBDs, no "add appropriate error handling", no "similar to Task N". Every code step contains complete code.

**Type consistency:** `AnchorFit` uses `center`/`scale`/`visible` in `types.ts`, `poseDirector.ts` and `SashaStage.tsx`. `fitScale` takes `(rect, sizeY, sizeX, worldPerPixelRatio, opts)` in `anchors.ts`, its test and its call site. `entranceState` returns `modelScale`/`modelOpacity`/`complete` consistently in `entrance.ts`, `RocketLaunch.tsx` and `SashaStage.tsx`. `pushAnchor`/`popAnchor`/`activeAnchorRect`/`activeAnchorOptions` match between `anchorRegistry.ts`, `useSashaAnchor.ts` and `SashaStage.tsx`.
