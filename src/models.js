// Loads the rigged character GLBs built by tools/build_characters.py.
// Every instance gets its own skeleton (the files are small, so we simply
// parse the buffer again per instance).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const buffers = new Map();

export const MODEL_NAMES = ['madi', 'sam', 'nora', 'kid_a', 'kid_b', 'kid_c', 'kid_d', 'kid_e', 'kid_f', 'hand'];

export async function preloadModels(base = 'assets/models/', onProgress) {
  let done = 0;
  await Promise.all(MODEL_NAMES.map(async (n) => {
    const r = await fetch(base + n + '.glb');
    if (!r.ok) throw new Error('model ' + n + ' ' + r.status);
    buffers.set(n, await r.arrayBuffer());
    onProgress && onProgress(++done / MODEL_NAMES.length);
  }));
}

/** returns { scene, bones: {name: Bone}, meshes: {materialName: SkinnedMesh}, extras } */
export async function instantiate(name, { shadows = false } = {}) {
  const gltf = await loader.parseAsync(buffers.get(name).slice(0), '');
  const bones = {}, meshes = {};
  gltf.scene.traverse((o) => {
    if (o.isBone) bones[o.name] = o;
    if (o.isMesh) {
      const key = o.material.name;
      // matte, vertex-coloured, cheap to shade
      o.material = new THREE.MeshLambertMaterial({ vertexColors: true });
      if (key === 'eyes') { o.material.emissive = new THREE.Color(0xffffff); o.material.emissiveIntensity = 0.0; }
      o.castShadow = shadows;
      o.receiveShadow = false;
      o.frustumCulled = false; // skinned bounds are unreliable; these are always near the view anyway
      meshes[key] = o;
    }
  });
  return { scene: gltf.scene, bones, meshes, extras: gltf.scene.userData || {} };
}
