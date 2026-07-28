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
