/**
 * SashaStage — the one and only Sasha.
 *
 * A thin wrapper: it owns the canvas, the rAF loop and the eased interpolation
 * between frames. All decisions (where she sits, how she moves, which camera
 * shot, when the entrance advances) come from the pure modules in src/stage/.
 *
 * Mounted once in AppShell and never unmounts, so navigating between
 * Landing / Auth / Chat glides the same model between anchors. Screens declare
 * where Sasha belongs by rendering an element and registering it via
 * useSashaAnchor; the loop reads the active anchor's rect every frame, so
 * layout — not hardcoded NDC constants — drives the 3D placement.
 *
 * Modes:
 *   'hero'   — placed inside the active anchor (landing/auth).
 *   'lesson' — placed inside the chat dock anchor.
 *   'hidden' — faded out; the render loop idles.
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
    const created = createStage(canvas, tier);
    if (!created) {
      setFailed(true);
      return;
    }
    // Re-bind to a fresh const so TypeScript carries the non-null type into the
    // nested frame() closure (the guard above narrows `created`, not `stage`).
    const stage = created;

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
      .catch((err: unknown) => {
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

      // Ground halo: a warm, anchored shadow beneath Sasha. The base opacity is
      // higher than the old 0.05 so the stacked-disc figure reads as one body
      // sitting on a surface rather than floating. Fades with the model.
      stage.setGroundOpacity(
        (reducedMotion ? 0.11 : 0.11 + Math.sin(elapsed * 1.5) * 0.025) * curOpacity,
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
