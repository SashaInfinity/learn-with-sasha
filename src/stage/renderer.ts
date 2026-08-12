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
  /**
   * Thruster glow under the model during descent. `intensity` is 0..1; the
   * y position lets the render loop keep it pinned beneath the landing model.
   */
  setEngineGlow(intensity: number, y: number): void;
  /**
   * Touch-down dust ring. `intensity` is 0..1; the ring expands and fades as
   * the burst plays out, anchored at the model's feet.
   */
  setDust(intensity: number, y: number): void;
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

  // --- landing effects: thruster glow + touch-down dust ring -------------
  // A soft amber glow billowing beneath the model while it descends, and an
  // expanding ring of dust that plays out from the touch-down point.
  const glowTex = makeRadialTexture('#fff7e0', '#f59e0b');
  const glowMat = new THREE.MeshBasicMaterial({
    map: glowTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -1.45;
  glow.visible = false;
  scene.add(glow);
  disposables.push(glow.geometry, glowMat, glowTex);

  const dustTex = makeRadialTexture('#fde68a', 'rgba(245,158,11,0)');
  const dustMat = new THREE.MeshBasicMaterial({
    map: dustTex,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dust = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.6, 48), dustMat);
  dust.rotation.x = -Math.PI / 2;
  dust.position.y = -1.48;
  dust.visible = false;
  scene.add(dust);
  disposables.push(dust.geometry, dustMat, dustTex);

  return {
    scene,
    camera,
    renderer,
    setGroundOpacity(v: number) {
      if (groundMat) groundMat.opacity = v;
    },
    setEngineGlow(intensity: number, y: number) {
      const i = Math.min(1, Math.max(0, intensity));
      glow.visible = i > 0.001;
      glow.material.opacity = i * 0.9;
      // Pulse and stretch as the thruster fires.
      const s = 0.8 + i * 0.6 + Math.sin(performance.now() * 0.03) * 0.05 * i;
      glow.scale.set(s, s, s);
      glow.position.y = y - 0.05;
    },
    setDust(intensity: number, y: number) {
      const i = Math.min(1, Math.max(0, intensity));
      dust.visible = i > 0.001;
      // The ring expands outward and fades as the burst decays.
      const radius = 0.4 + (1 - i) * 2.2;
      dust.scale.set(radius, radius, radius);
      dust.material.opacity = i * 0.7;
      dust.position.y = y - 0.02;
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

/**
 * Builds a soft radial-gradient texture (canvas → DataTexture) for the glow
 * and dust sprites. Keeps the effect additive/feathered without an asset file.
 */
function makeRadialTexture(inner: string, outer: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
