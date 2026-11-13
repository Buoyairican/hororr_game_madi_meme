// Loads the rigged character GLBs built by tools/build_characters.py.
// Every instance gets its own skeleton (the files are small, so we simply
// parse the buffer again per instance).
import * as THREE from 'three';
import { GLTFLoader } from '../vendor/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const buffers = new Map();

export const MODEL_NAMES = ['madi', 'sam', 'nora', 'kid_a', 'kid_b', 'kid_c', 'kid_d', 'kid_e', 'kid_f', 'hand'];

export async function preloadModels(base = 'assets/models/', onProgress) {
  // one JSON bundle (base64) holds every model: one request, and it works on hosts that don't serve .glb
  onProgress && onProgress(0.1);
  const r = await fetch(base + 'models.json');
  if (!r.ok) throw new Error('models.json ' + r.status);
  const bundle = await r.json();
  for (const n of MODEL_NAMES) {
    if (!bundle[n]) throw new Error('model missing: ' + n);
    const bin = atob(bundle[n]);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    buffers.set(n, u8.buffer);
  }
  onProgress && onProgress(1);
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
