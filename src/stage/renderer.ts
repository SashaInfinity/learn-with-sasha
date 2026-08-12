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
    // An elliptical halo (wider than tall) reads as a grounded shadow beneath
    // the figure, so the stacked-disc character feels anchored rather than
    // floating. Squashing on X/Z gives the ellipse its perspective shape.
    const geometry = new THREE.CircleGeometry(2.6, 48);
    const ground = new THREE.Mesh(geometry, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.scale.set(1.15, 1, 0.62);
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
