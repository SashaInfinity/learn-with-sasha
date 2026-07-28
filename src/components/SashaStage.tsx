/**
 * SashaStage — the one and only Sasha.
 *
 * Ported from sasha_lms's frontend (raw three.js + GLTFLoader) and extended:
 *   - hero mode: visible from the landing/login page at a center-screen anchor
 *     (no dock element required).
 *   - mood beats: subtle overlays for wave/thinking/celebrate/shake/talking.
 *   - talk animation: a SAFE whole-model yaw/bob to the live TTS amplitude (we
 *     never manipulate the Head sub-mesh — its authored transform places the
 *     head correctly, and the GLB has no jaw bone anyway).
 *
 * Mounted once in AppShell and never unmounts, so navigating between
 * Landing / Auth / Chat glides the same model between poses.
 *
 * Modes:
 *   'hero'   — fixed center-stage anchor (landing/auth).
 *   'lesson' — fitted into the page's #sasha-dock element (chat).
 *   'hidden' — faded out; the render loop idles.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SASHA_DOCK_ID } from './learnWithSasha/constants';
import { getVoiceAmplitude } from '../context/VoiceContext';
import type { SashaMood } from '../context/VoiceContext';

export type StageMode = 'hero' | 'lesson' | 'hidden';

/** Fraction of the dock box the character should occupy (constrained on both axes). */
const DOCK_FILL_Y = 0.94;
const DOCK_FILL_X = 0.98;
/** Guard rails on the fitted scale, relative to her base size. */
const MIN_DOCK_SCALE = 0.3;
const MAX_DOCK_SCALE = 1.7;

/** Hero-mode target: centre-screen, slightly above middle, comfortably large. */
const HERO_SCALE_FACTOR = 1.05;
const HERO_Y_OFFSET = -0.15;

interface SashaStageProps {
  mode: StageMode;
  mood?: SashaMood;
}

export default function SashaStage({ mode, mood = 'idle' }: SashaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The render loop reads mode + mood through refs so changes re-target the
  // existing loop instead of tearing down/rebuilding the WebGL context.
  const modeRef = useRef<StageMode>(mode);
  const moodRef = useRef<SashaMood>(mood);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  useEffect(() => {
    moodRef.current = mood;
  }, [mood]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const isMobileDevice = window.innerWidth <= 768;
    const camera = new THREE.PerspectiveCamera(
      35,
      window.innerWidth / window.innerHeight,
      0.1,
      100,
    );
    camera.position.set(0, isMobileDevice ? 0.5 : 1.0, 6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
      console.warn('SashaStage: WebGL unavailable', err);
      return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // Lighting rig — gives Sasha her warm, on-brand look.
    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(3, 8, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xf4911a, 0.5); // brand-orange fill
    fillLight.position.set(-4, 2, -3);
    scene.add(fillLight);
    const rimLight = new THREE.DirectionalLight(0x88bbff, 0.8);
    rimLight.position.set(-1, 4, -8);
    scene.add(rimLight);
    const bottomLight = new THREE.PointLight(0xf4911a, 0.4, 10);
    bottomLight.position.set(0, -2, 2);
    scene.add(bottomLight);

    const groundMat = new THREE.MeshBasicMaterial({
      color: 0xf4911a,
      transparent: true,
      opacity: 0.05,
    });
    const ground = new THREE.Mesh(new THREE.CircleGeometry(2.5, 64), groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.5;
    scene.add(ground);

    let model: THREE.Object3D | null = null;
    let baseScale = 1;
    // The GLB's bounding-box centre/size in unscaled local units.
    const localCenter = new THREE.Vector3();
    const localSize = new THREE.Vector3(1, 1, 1);

    let mouseX = 0,
      mouseY = 0,
      tMouseX = 0,
      tMouseY = 0;

    const onMouseMove = (e: MouseEvent) => {
      tMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      tMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', onMouseMove);

    const loader = new GLTFLoader();
    loader.load(
      '/models/Sasha-Character.glb',
      (gltf: { scene: THREE.Object3D; animations?: THREE.AnimationClip[] }) => {
        model = gltf.scene;
        if (!model) return;
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const isMobile = window.innerWidth <= 768;
        baseScale = (isMobile ? 2.7 : 2.8) / maxDim;
        localCenter.copy(center);
        localSize.copy(size);
        model.scale.setScalar(baseScale);
        model.position.sub(center.multiplyScalar(baseScale));
        model.position.y -= isMobile ? 0.8 : 0.3;
        scene.add(model);
      },
      undefined,
      (error: unknown) => {
        console.warn('SashaStage: failed to load Sasha-Character.glb', error);
      },
    );

    // Projects a viewport-relative NDC point onto the z=0 plane the model sits on.
    const projected = new THREE.Vector3();
    const anchorToWorld = (ndcX: number, ndcY: number, out: THREE.Vector3) => {
      projected.set(ndcX, ndcY, 0.5).unproject(camera);
      projected.sub(camera.position).normalize();
      const t = (0 - camera.position.z) / projected.z;
      out.copy(camera.position).addScaledVector(projected, t);
    };

    const viewTop = new THREE.Vector3();
    const viewBottom = new THREE.Vector3();
    const worldPerPixel = () => {
      anchorToWorld(0, 1, viewTop);
      anchorToWorld(0, -1, viewBottom);
      return (viewTop.y - viewBottom.y) / window.innerHeight;
    };

    let dockEl: HTMLElement | null = null;
    const refreshDock = () => {
      dockEl = document.getElementById(SASHA_DOCK_ID);
    };

    const clock = new THREE.Clock();
    const dockTarget = new THREE.Vector3();
    let dockScale = baseScale;
    let haveDockPose = false;
    let animId = 0;

    let opacity = modeRef.current === 'hidden' ? 0 : 1;
    let lastMode: StageMode = modeRef.current;
    // Smoothed pose values so mode/mood changes glide instead of snapping.
    const curPos = new THREE.Vector3(0, 0, 0);
    const curScale = new THREE.Vector3(baseScale, baseScale, baseScale);
    let curRotX = 0; // pitch (lean forward/back, look down/up)
    let curRotY = 0; // yaw
    let curRotZ = 0; // roll (head tilt)

    function animate() {
      animId = requestAnimationFrame(animate);
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();

      const currentMode = modeRef.current;
      const currentMood = moodRef.current;
      if (currentMode !== lastMode) {
        refreshDock();
        lastMode = currentMode;
      }

      mouseX += (tMouseX - mouseX) * 0.05;
      mouseY += (tMouseY - mouseY) * 0.05;

      // --- target pose per mode -----------------------------------------
      let targetOpacity = 0;
      // The pose we ease toward this frame.
      const targetPos = new THREE.Vector3();
      let targetScaleNum = baseScale;
      let targetRotX = 0; // base pitch tracks cursor Y subtly
      let targetRotY = mouseX * 0.18;
      let targetRotZ = 0;

      if (currentMode === 'lesson') {
        if (!dockEl || !dockEl.isConnected) refreshDock();
        const rect = dockEl?.getBoundingClientRect();
        if (rect && rect.width > 1 && rect.height > 1) {
          const wpp = worldPerPixel();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          anchorToWorld(
            (cx / window.innerWidth) * 2 - 1,
            -((cy / window.innerHeight) * 2 - 1),
            dockTarget,
          );
          const fitY = (rect.height * DOCK_FILL_Y * wpp) / (localSize.y * baseScale || 1);
          const fitX = (rect.width * DOCK_FILL_X * wpp) / (localSize.x * baseScale || 1);
          dockScale =
            baseScale *
            THREE.MathUtils.clamp(Math.min(fitY, fitX), MIN_DOCK_SCALE, MAX_DOCK_SCALE);
          haveDockPose = true;
        }
        if (haveDockPose) {
          const pulse = 1 + Math.sin(elapsed * 1.5) * 0.012;
          targetScaleNum = dockScale * pulse;
          targetPos
            .copy(dockTarget)
            .sub(localCenter.clone().multiplyScalar(targetScaleNum));
          targetOpacity =
            rect && rect.bottom > -50 && rect.top < window.innerHeight + 50 ? 1 : 0;
        }
      } else if (currentMode === 'hero') {
        // Centre-screen anchor, slightly above middle, larger than dock size.
        anchorToWorld(0, isMobileDevice ? 0.15 : 0.35, targetPos);
        const pulse = 1 + Math.sin(elapsed * 1.5) * 0.012;
        targetScaleNum = baseScale * HERO_SCALE_FACTOR * pulse;
        targetPos.sub(localCenter.clone().multiplyScalar(targetScaleNum));
        targetPos.y += HERO_Y_OFFSET;
        targetOpacity = 1;
        // Gentle hero idle sway.
        targetRotY += Math.sin(elapsed * 0.5) * 0.05;
      }

      // --- mood overlays ------------------------------------------------
      // All motion here is SAFE whole-model transform only — we never touch the
      // Head sub-mesh (its authored transform places the head correctly).
      if (currentMode !== 'hidden') {
        const amp = getVoiceAmplitude(); // 0..1 while speaking, else 0

        // TALKING — gentle rhythmic sway + bob keyed to live audio amplitude.
        if (currentMood === 'talking' || amp > 0.02) {
          targetRotY += Math.sin(elapsed * 9) * amp * 0.05;
          targetRotZ += Math.sin(elapsed * 7.5) * amp * 0.02;
          targetPos.y += amp * 0.02;
        }

        // Per-mood motion. Each layered on top of the base cursor-tracking
        // pose above, so she still follows the mouse while expressing.
        if (currentMood === 'wave') {
          // Friendly wave: rhythmic roll.
          targetRotZ = Math.sin(elapsed * 6) * 0.12;
        } else if (currentMood === 'thinking') {
          // Deep-in-thought: head tilts, gazes down, paced contemplative sway,
          // occasional slow nod. "Excessive" enough to read clearly while a
          // lesson is generating (a long operation).
          targetRotZ = 0.12 + Math.sin(elapsed * 1.1) * 0.05; // tilted head
          targetRotX = 0.18; // look down toward her thoughts
          targetRotY += Math.sin(elapsed * 0.8) * 0.08; // slow contemplative scan
          // Slow nod every ~2.5s.
          targetRotX += Math.max(0, Math.sin(elapsed * 2.5)) * 0.06;
          // Subtle rise as if mulling.
          targetPos.y += Math.sin(elapsed * 1.4) * 0.015;
        } else if (currentMood === 'attentive') {
          // The user is typing a question. Sasha leans forward and gazes down
          // toward the typebar (positive pitch = look down), with sharper
          // cursor tracking so her gaze follows the question.
          targetRotX = 0.12; // lean/gaze toward the input
          targetRotY += mouseX * 0.12; // track the cursor more strongly
          // Tiny expectant bob.
          targetPos.y += Math.sin(elapsed * 2.2) * 0.01;
        } else if (currentMood === 'celebrate') {
          // Lesson ready: happy hop.
          targetPos.y += Math.abs(Math.sin(elapsed * 8)) * 0.08;
          targetRotZ = Math.sin(elapsed * 5) * 0.06;
        } else if (currentMood === 'shake') {
          // Gentle no-shake on an error.
          targetRotY += Math.sin(elapsed * 18) * 0.08;
        }
      }

      // --- ease toward the target pose ----------------------------------
      const easeK = Math.min(delta * 5, 1);
      curPos.lerp(targetPos, easeK);
      curScale.lerp(
        new THREE.Vector3(targetScaleNum, targetScaleNum, targetScaleNum),
        easeK,
      );
      curRotX += (targetRotX - curRotX) * easeK;
      curRotY += (targetRotY - curRotY) * easeK;
      curRotZ += (targetRotZ - curRotZ) * easeK;
      opacity += (targetOpacity - opacity) * Math.min(delta * 5, 1);

      if (model) {
        const breathe = Math.sin(elapsed * 1.2) * 0.04;
        model.position.copy(curPos);
        model.position.y += breathe;
        model.scale.copy(curScale);
        model.rotation.y = curRotY;
        // Pitch is the mood-driven lean/gaze (curRotX) plus a whisper of cursor
        // tracking so idle feels alive.
        model.rotation.x = curRotX + mouseY * 0.04;
        model.rotation.z = curRotZ;

        model.traverse((child: THREE.Object3D) => {
          const mesh = child as THREE.Mesh;
          if (mesh.isMesh && mesh.material) {
            const mat = mesh.material as THREE.Material & {
              transparent: boolean;
              opacity: number;
            };
            mat.transparent = true;
            mat.opacity = opacity;
          }
        });
      }

      // Ground disc: warm halo under Sasha, faded when hidden.
      groundMat.opacity =
        (0.05 + Math.sin(elapsed * 1.5) * 0.02) *
        (currentMode === 'hidden' ? 0 : opacity);

      if (currentMode === 'hidden' && opacity < 0.01) return;

      camera.position.x = Math.sin(elapsed * 0.12) * 0.06;
      const mobileAnim = window.innerWidth <= 768;
      camera.position.y = (mobileAnim ? 0.6 : 1.0) + Math.cos(elapsed * 0.15) * 0.04;
      camera.lookAt(0, mobileAnim ? 0.3 : 0.6, 0);
      renderer.render(scene, camera);
    }
    refreshDock();
    animate();

    const onResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
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
  );
}
