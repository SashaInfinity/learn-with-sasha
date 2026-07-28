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
