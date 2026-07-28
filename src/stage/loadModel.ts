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
