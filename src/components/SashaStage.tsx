/**
 * SashaStage — the one and only Sasha.
 *
 * Ported near-verbatim from sasha_lms's frontend (raw three.js + GLTFLoader).
 * This owns the single GLB instance, scene, camera and WebGL renderer for the
 * whole app. It is mounted once in AppShell and never unmounts, so navigating
 * between Landing / Auth / Chat does not reload or re-instantiate the character.
 *
 * The original derived its mode from react-router's useLocation(); this port
 * takes `mode` as a prop instead (the host app uses simple state).
 *
 * Modes:
 *   'lesson' — fitted into the page's #sasha-dock element.
 *   'hidden' — faded out; the render loop idles.
 *
 * Docking is measured, not hardcoded. The chat home renders an empty
 * `#sasha-dock` box in its left column; this component reads that element's
 * bounding rect every frame and projects the character into it. So her size and
 * margins come from CSS and follow the responsive grid.
 */
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SASHA_DOCK_ID } from './learnWithSasha/constants';

export type StageMode = 'lesson' | 'hidden';

/** Fraction of the dock box the character should occupy (constrained on both axes). */
const DOCK_FILL_Y = 0.94;
const DOCK_FILL_X = 0.98;
/** Guard rails on the fitted scale, relative to her base size. */
const MIN_DOCK_SCALE = 0.3;
const MAX_DOCK_SCALE = 1.7;

/** Smootherstep — eases in/out with zero velocity and zero acceleration at both
 *  ends, so the character has no perceptible kick as she departs or arrives. */

interface SashaStageProps {
  mode: StageMode;
}

export default function SashaStage({ mode }: SashaStageProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // The render loop reads the mode through a ref so a mode change re-targets
  // the existing loop instead of tearing down/rebuilding the WebGL context.
  const modeRef = useRef<StageMode>(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const isMobileDevice = window.innerWidth <= 768;
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, isMobileDevice ? 0.5 : 1.0, 6);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    } catch (err) {
      // No WebGL — the app works without Sasha; nothing to fall back to here.
      console.warn('SashaStage: WebGL unavailable', err);
      return;
    }
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;

    // Lighting — this rig is what gives Sasha her warm, on-brand look.
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
    let mixer: THREE.AnimationMixer | null = null;
    let headBone: THREE.Bone | null = null;
    let spineBone: THREE.Bone | null = null;
    let baseScale = 1;
    // The GLB's bounding-box centre/size in unscaled local units. model.position
    // is the object's origin, not its visual centre — to park the centre on a
    // point we subtract this, rescaled to the current draw scale.
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

        model.traverse((child: THREE.Object3D) => {
          const n = (child.name || '').toLowerCase();
          if (!headBone && (child as THREE.Bone).isBone && n.includes('head')) headBone = child as THREE.Bone;
          if (!spineBone && (child as THREE.Bone).isBone && n.includes('spine')) spineBone = child as THREE.Bone;
        });

        if (gltf.animations && gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          gltf.animations.forEach((clip) => mixer!.clipAction(clip).play());
        }
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
    /** World units per CSS pixel on the z=0 plane. */
    const worldPerPixel = () => {
      anchorToWorld(0, 1, viewTop);
      anchorToWorld(0, -1, viewBottom);
      return (viewTop.y - viewBottom.y) / window.innerHeight;
    };

    // Cached so we don't call getElementById 60x/sec.
    let dockEl: HTMLElement | null = null;
    const refreshDock = () => {
      dockEl = document.getElementById(SASHA_DOCK_ID);
    };

    const clock = new THREE.Clock();
    const dockTarget = new THREE.Vector3();
    let dockScale = baseScale;
    let haveDockPose = false;
    let animId = 0;

    // Start settled: opening directly into the chat should not animate from a
    // hero position the user never saw.
    let opacity = modeRef.current === 'hidden' ? 0 : 1;
    let lastMode: StageMode = modeRef.current;

    function animate() {
      animId = requestAnimationFrame(animate);
      // Tab-switching can hand back a multi-second delta, which would teleport
      // the character instead of animating her.
      const delta = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.getElapsedTime();
      if (mixer) mixer.update(delta);

      const currentMode = modeRef.current;
      if (currentMode !== lastMode) {
        refreshDock();
        lastMode = currentMode;
      }

      mouseX += (tMouseX - mouseX) * 0.05;
      mouseY += (tMouseY - mouseY) * 0.05;

      // --- measure the dock every frame (it scrolls with the page) ---------
      if (currentMode === 'lesson') {
        if (!dockEl || !dockEl.isConnected) refreshDock();
        const rect = dockEl?.getBoundingClientRect();
        // A zero-size rect means the element exists but hasn't laid out yet;
        // hold the previous pose to avoid a one-frame flick to the top-left.
        if (rect && rect.width > 1 && rect.height > 1) {
          const wpp = worldPerPixel();
          const cx = rect.left + rect.width / 2;
          const cy = rect.top + rect.height / 2;
          anchorToWorld(
            (cx / window.innerWidth) * 2 - 1,
            -((cy / window.innerHeight) * 2 - 1),
            dockTarget,
          );

          // Fit on both axes and take the tighter one.
          const fitY = (rect.height * DOCK_FILL_Y * wpp) / (localSize.y * baseScale || 1);
          const fitX = (rect.width * DOCK_FILL_X * wpp) / (localSize.x * baseScale || 1);
          const fit = THREE.MathUtils.clamp(Math.min(fitY, fitX), MIN_DOCK_SCALE, MAX_DOCK_SCALE);
          dockScale = baseScale * fit;
          haveDockPose = true;
        }
      }

      if (model) {
        const breathe = Math.sin(elapsed * 1.2) * 0.04;
        const pulse = 1 + Math.sin(elapsed * 1.5) * 0.012;

        const lessonScale = (haveDockPose ? dockScale : baseScale) * pulse;
        const lessonRotY = mouseX * 0.25 + Math.sin(elapsed * 0.3) * 0.04;

        // Convert "put her centre here" into "put her origin there".
        const lessonX = dockTarget.x - localCenter.x * lessonScale;
        const lessonY = dockTarget.y - localCenter.y * lessonScale;
        const lessonZ = dockTarget.z - localCenter.z * lessonScale;

        if (currentMode === 'lesson' && haveDockPose) {
          model.position.x = lessonX;
          model.position.y = lessonY + breathe;
          model.position.z = lessonZ;
          model.rotation.y = lessonRotY;
          model.scale.setScalar(lessonScale);
        }

        if (headBone) {
          headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, mouseX * 0.5, 0.07);
          headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, -mouseY * 0.3, 0.07);
        }
        if (spineBone) {
          spineBone.rotation.y = THREE.MathUtils.lerp(spineBone.rotation.y, mouseX * 0.12, 0.05);
        }

        const isDockInView =
          currentMode === 'lesson' &&
          dockEl &&
          (() => {
            const r = dockEl.getBoundingClientRect();
            return r.bottom > -50 && r.top < window.innerHeight + 50;
          })();

        const targetOpacity = currentMode === 'hidden' ? 0 : isDockInView ? 1 : 0;
        opacity += (targetOpacity - opacity) * Math.min(delta * 5, 1);
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

      // Ground disc: faint warm halo under Sasha when she's visible, off when hidden.
      groundMat.opacity =
        (0.05 + Math.sin(elapsed * 1.5) * 0.02) * (currentMode === 'hidden' ? 0 : opacity);

      // Idle the GPU once she has fully faded out.
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
