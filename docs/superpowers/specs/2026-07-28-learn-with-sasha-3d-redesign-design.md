# Learn With Sasha — 3D Entrance, Stage Refactor & UI Redesign

**Date:** 2026-07-28
**Status:** Approved design, pending implementation plan

## Problem

The Learn With Sasha experience needs a polished 3D presentation and a modern UI.
Concretely, in the current code:

1. **No entrance.** The model pops into view whenever `GLTFLoader` finishes. There
   is no landing animation, no loading feedback, and a 4.2 MB uncompressed GLB
   means a visible dead gap on first load.
2. **Login misalignment.** `SashaStage` anchors hero mode at screen-center NDC
   (`SashaStage.tsx:235`), while `AuthScreen` reserves a _left_ grid column
   (`AuthScreen.tsx:48`). The model floats over the form rather than sitting in
   the space reserved for it.
3. **Untestable, tangled stage.** All lighting, loading, anchoring, pose math and
   five mood branches live in one 300-line `useEffect`. Screen-to-world fitting is
   implemented twice with different rules (`SashaStage.tsx:216-231` vs `:235-239`);
   that divergence is the direct cause of issue 2.
4. **Flat UI hierarchy.** Card styling is ad hoc per component (`rounded-2xl` +
   `shadow-sm` + hand-picked padding), with no shared spacing, elevation or type
   scale.
5. **No performance story.** No quality tiers, no reduced-motion handling for
   JS-driven motion, no background-tab throttling, 193k triangles rendered every
   frame on every device.

## Asset facts (verified by inspecting the GLB header)

| Property                   | Value                       |
| -------------------------- | --------------------------- |
| File size                  | 4.2 MB                      |
| Triangles                  | ~193,236                    |
| Meshes / nodes / materials | 3 / 3 / 3                   |
| Textures                   | **none** (`images: []`)     |
| Skins                      | **none**                    |
| Animation clips            | **none** (`animations: []`) |
| Extensions                 | `KHR_materials_clearcoat`   |

Two consequences drive the whole design:

- The 4.2 MB is **pure geometry**. Texture compression (KTX2) is irrelevant;
  geometry simplification plus Draco is the entire win.
- With no skeleton and no clips, **all character motion must remain whole-model
  transform**. This matches the existing code's hard-won constraint (commit
  `15e26e4`, "Sasha's head was being pulled out of place by the talk animation").

## Decisions

| Question         | Decision                                                       |
| ---------------- | -------------------------------------------------------------- |
| Rocket entrance  | 2D CSS/SVG rocket overlay that hands off to the 3D model       |
| Redesign scope   | Full: landing + login + dashboard                              |
| Geometry budget  | Draco + simplify to ~60k triangles                             |
| Entrance replay  | Once per browser session (`sessionStorage`)                    |
| Login placement  | Sasha anchored to a reserved DOM column                        |
| Visual direction | Keep slate/amber + Plus Jakarta Sans; refine layout and motion |
| Architecture     | Refactor in place on raw three.js (no react-three-fiber)       |

## Architecture

```
src/stage/
  types.ts          StagePose, StageMode, QualityTier, AnchorRect, PoseInput
  renderer.ts       createStage(canvas, tier) -> { scene, camera, renderer, lights, dispose }
  quality.ts        detectTier() -> 'high' | 'low'
  anchors.ts        anchorToWorld(camera, ndc); fitToRect(rect, localSize, baseScale)
  poseDirector.ts   pose(input: PoseInput) -> TargetPose        [pure]
  cameraDirector.ts shot(name, t) -> { position, target }       [pure]
  loadModel.ts      GLTFLoader + DRACOLoader, onProgress, bbox normalisation
  entrance.ts       EntranceTimeline: phase machine fed by load progress
src/components/
  SashaStage.tsx    thin React wrapper: refs, rAF loop, easing, opacity
  RocketLaunch.tsx  CSS/SVG overlay; unmounts after handoff
src/hooks/
  useSashaAnchor.ts registers a DOM element as the current stage anchor
```

**Dependency direction:** `components → hooks → stage/*`. Nothing under `stage/`
imports React or touches the DOM except `anchors.ts`, which reads rects.

### Contracts

- **`poseDirector.pose(input)`** is pure. Input:
  `{ mode, mood, elapsed, pointer, anchor, amplitude, reducedMotion }`.
  Output: `{ position, scale, rotation }`. No THREE mutation, no DOM reads.
  This is the primary unit-tested surface.
- **`anchors.fitToRect(rect, localSize, baseScale)`** owns _all_ screen-to-world
  math. One implementation, used by every screen. Replaces the two divergent
  inline versions.
- **`useSashaAnchor(ref, opts)`** — a screen declares where Sasha belongs by
  rendering an element and calling the hook. Landing, login and dashboard all use
  this one mechanism; `hero` stops being a special case with hardcoded constants.
- **`RocketLaunch`** knows nothing about three.js. Props: `progress` (0–1),
  `phase`, `onHandoff()`. `entrance.ts` owns the timeline; the component renders it.

Constants deleted by this refactor: `HERO_SCALE_FACTOR`, `HERO_Y_OFFSET`, the
mobile `-0.8` position fudge (`SashaStage.tsx:139`), and the hardcoded
`camera.lookAt` pair (`SashaStage.tsx:331-334`).

## Entrance sequence

Phase machine in `entrance.ts`:

| Phase    | Time       | Behaviour                                                                                 |
| -------- | ---------- | ----------------------------------------------------------------------------------------- |
| `launch` | 0.00–0.80s | Rocket SVG travels bottom → centre, ease-out cubic, CSS exhaust trail and spark particles |
| `burst`  | 0.80–1.10s | Rocket scales out; radial amber flare expands                                             |
| `reveal` | 1.10–1.90s | Sasha opacity 0→1, scale 0.35→1 with slight spring overshoot; flare fades                 |
| `settle` | 1.90–3.20s | Mood set to `wave`; idle sway ramps in                                                    |
| `done`   | —          | Normal pose director; overlay unmounted                                                   |

**Gating.** The timeline holds at the end of `burst` until the model is decoded
_and_ one frame has rendered. If the model is ready earlier (warm cache) the
sequence proceeds on schedule — it is never shortened, so it cannot flash. If the
load runs long, the rocket hovers with an amber progress ring driven by
`onProgress` instead of showing a dead screen.

**Preload.** `<link rel="preload" as="fetch" crossorigin>` for the compressed GLB
in `index.html`. Draco decoder self-hosted at `public/draco/` (copied from
`three/examples/jsm/libs/draco/`), not a CDN.

**Replay.** `sessionStorage['lws:entranceSeen']`, set when `done` is reached.
Absent → full sequence. Present → timeline starts at `done` and the model fades in
over 400 ms. In-app navigation never replays.

**Reduced motion.** With `prefers-reduced-motion: reduce`: skip the rocket
entirely, fade the model in over 250 ms, and `poseDirector` returns a static pose
(no sway, no breathe, no pointer tracking). Mood beats degrade to opacity/scale
changes only. This is explicit in JS — the existing global CSS override
(`index.css:356`) does not affect rAF-driven motion.

## Error handling

| Failure                     | Behaviour                                                                                                                                                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| WebGL unavailable           | Rocket still plays; hands off to a static `logo.png` hero image. App fully usable. (Today `SashaStage` returns early and the screen is silently empty, `SashaStage.tsx:71-74`.) |
| GLB 404 or decode error     | Same static fallback, one toast via `ToastContext`, timeline forced to `done` — no infinite rocket.                                                                             |
| Draco decoder fails to load | Retry once with the uncompressed `Sasha-Character.glb`, which stays in the repo.                                                                                                |
| Anchor element missing      | Fall back to a viewport-centre anchor rect so the model is never off-screen.                                                                                                    |

## Pose and camera

Pose is composed in layers, not branches:

```
base       anchor fit (position + scale from the active anchor rect)
+ idle     breathe (sin 1.2), sway (sin 0.5), pointer tracking
+ mood     wave | thinking | attentive | celebrate | shake   (additive offsets)
+ voice    amplitude-driven yaw / roll / bob
+ entrance scale and opacity ramp from entrance.ts
```

All layers are whole-model transforms. The Head sub-mesh is never touched.

`cameraDirector` eases camera position and look-at target between named shots —
`wide` (landing), `three-quarter` (login), `close` (dock) — with the existing idle
drift layered on top. Screen transitions become camera moves rather than model
teleports.

### Anchor rects per screen

| Screen    | Desktop ≥1024px                      | Tablet 640–1023px          | Mobile <640px                                          |
| --------- | ------------------------------------ | -------------------------- | ------------------------------------------------------ |
| Landing   | Centre column, 26vw × 50vh           | Centre, 40vw               | Full-width behind the text card, 55vh, reduced opacity |
| Login     | Left grid column (fixes the overlap) | Above the card, 240px tall | Above the card, 180px tall                             |
| Dashboard | `#sasha-dock` in the mascot card     | Same                       | Compact 96px inline presence                           |

Anchors are DOM rects, so layout drives the 3D. `resize` and `orientationchange`
re-read them, so alignment holds at every width instead of at two breakpoints.

## UI redesign

Palette (slate/amber) and typeface (Plus Jakarta Sans) are locked. Changes:

**Design tokens** — `index.css` gains spacing, radius, elevation and type scales
(`--lws-space-*`, `--lws-radius-*`, `--lws-shadow-1..3`, `--lws-text-*`).
Components consume tokens instead of per-component ad hoc values.

**Landing** — three-column grid with the middle column as the anchor. Staggered
word reveal on the headline. CTA gains a hover lift and an amber glow tied to
Sasha's mood. On mobile the model sits behind the translucent text card at reduced
opacity rather than competing with the copy.

**Login** — form card gains real elevation. Inputs get floating labels and a
clearer focus ring. The error state animates in alongside the model's `shake`
mood. The left column becomes the 3D anchor plus the greeting bubble, replacing
today's lone floating chip (`AuthScreen.tsx:53`).

**Dashboard** — the three-zone grid stays. Mascot card gains a mood-reactive glow.
Sessions list gains hover and active affordances plus skeleton parity with the
loaded state. Chat bubbles gain entrance transitions and a proper thinking
indicator. The mobile drawer gains swipe-to-close. `lws-hide-below-lg` on the
mascot section currently hides Sasha entirely from mobile users after login; that
is replaced with the compact inline presence from the anchor table.

**Micro-interactions** — one shared easing set, all transitions ≤250 ms, all gated
behind `prefers-reduced-motion`.

## Performance

**Asset pipeline.** New dev dependency `@gltf-transform/cli`, new npm script:

```
npm run models:build
  weld → simplify (target ~60k triangles, error 0.001) → draco
  in:  public/models/Sasha-Character.glb        (source, kept in repo)
  out: public/models/Sasha-Character.draco.glb  (committed artifact)
```

The compressed file is committed rather than generated during `npm run build`, so
build time and deployment are unchanged.

**Quality tiers.** `detectTier()` uses viewport size, `navigator.deviceMemory` and
`navigator.hardwareConcurrency`. Low tier: pixel ratio capped at 1.5, lights
reduced from four to two (drop rim and bottom), ground disc skipped, rAF throttled
to 30fps while the pose is static. All tiers pause rAF on `visibilitychange` —
today the loop runs indefinitely in background tabs.

**Budgets.**

- Compressed GLB ≤ 500 KB transferred
- First model paint ≤ 1.5s on cable, ≤ 4s on simulated 3G
- Sustained 60fps desktop, 30fps mid-tier mobile

## Verification

The repo has no test framework. Vitest is added for the two pure modules only:

- `poseDirector.pose()` — layer composition, mood offsets, reduced-motion path
- `anchors.fitToRect()` — clamping, aspect handling, degenerate/zero rects
- `entrance.ts` phase machine — gating on load progress, replay flag

Everything else is verified by:

- `npm run check` (typecheck + eslint + prettier)
- `npm run build`
- Manual pass at 375 / 768 / 1440px widths
- A `prefers-reduced-motion` run and a WebGL-disabled run
- Throttled-network run to confirm the rocket progress ring and the handoff gate

## Out of scope

- New palette or typeface
- Rigging or authoring animation clips for the GLB (no skeleton exists)
- Backend, auth, chat, or lesson-generation changes
- Migration to react-three-fiber
