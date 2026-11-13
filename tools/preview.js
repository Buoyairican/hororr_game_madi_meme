// Dev-only scene preview: tools/preview.html?cam=x,y,z&look=x,y,z&t=x,z,yaw&pose=clap&retro=0
import * as THREE from 'three';
import { buildWorld, PLAYER_EYE, BOARD_Z } from '../src/world.js';
import { Teacher } from '../src/teacher.js';
import { Classmate } from '../src/students.js';
import { preloadModels, instantiate } from '../src/models.js';
import { PostFX } from '../src/post.js';

const q = new URLSearchParams(location.search);
const vec = (s, d) => (s ? new THREE.Vector3(...s.split(',').map(Number)) : d);
const canvas = document.getElementById('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
await document.fonts.load('700 54px Caveat');
const W = buildWorld(scene, renderer);
const tl = new THREE.TextureLoader();
const face = await tl.loadAsync('../assets/textures/teacher_face.jpg');
face.colorSpace = THREE.SRGBColorSpace;
const eyes = await tl.loadAsync('../assets/textures/teacher_eyes.jpg');
await preloadModels('../assets/models/');
const T = new Teacher(await instantiate('madi'), face, eyes);
scene.add(T.root);
const tp = (q.get('t') || '0,-5.6,0').split(',').map(Number);
T.place(tp[0], tp[1], tp[2]);
const cam = new THREE.PerspectiveCamera(Number(q.get('fov') || 68), innerWidth / innerHeight, 0.03, 60);
cam.position.copy(vec(q.get('cam'), PLAYER_EYE));
cam.lookAt(vec(q.get('look'), new THREE.Vector3(0, 1.6, -6)));
T.lookAt(cam.position, 100);
const pose = q.get('pose');
const deskL = new THREE.Vector3(-0.26, 0.76, -2.2), deskR = new THREE.Vector3(0.26, 0.76, -2.2);
if (pose === 'clap') T.startClap(99, 0.8, () => {});
else if (pose === 'desk') { T.setPose('desk', { L: deskR, R: deskL }); T.leanTarget = Number(q.get('lean') || 1.1); T.crouchTarget = Number(q.get('crouch') || 0.4); T.stanceTarget = 0.3; }
else if (pose === 'walk') { T.moveTo(Number(q.get('wx') || 3), tp[1], Number(q.get('ws') || 1)); T.facePoint(new THREE.Vector3(Number(q.get('wx') || 3), 0, tp[1])); }
else if (pose === 'write') { T.setPose('write', { point: new THREE.Vector3(-0.6, 1.7, BOARD_Z + 0.02), normal: new THREE.Vector3(0, 0, 1) }); }
else if (pose) T.setPose(pose, { at: cam.position });
if (q.get('jaw')) T.jawTarget = Number(q.get('jaw'));
if (q.get('stretch')) T.stretchTarget = Number(q.get('stretch'));
if (q.get('look2')) T.lookAt(vec(q.get('look2')), 100);
const seats = W.seats;
const seat = (r, c) => seats.find((s) => s.row === r && s.col === c);
const friends = [new Classmate('sam', 'Sam', await instantiate('sam'), seat(0, 1)), new Classmate('nora', 'Nora', await instantiate('nora'), seat(0, 3))];
const kidSeats = [[1, 0, 'kid_a'], [1, 2, 'kid_d'], [1, 4, 'kid_b'], [2, 1, 'kid_c'], [2, 3, 'kid_e'], [3, 0, 'kid_f'], [3, 2, 'kid_a'], [3, 4, 'kid_c']];
const studs = [];
for (const [r, c, m] of kidSeats) studs.push(new Classmate('kid', m, await instantiate(m), seat(r, c)));
for (const c of [...friends, ...studs]) { scene.add(c.root); }
if (q.get('fl')) friends.forEach((f) => (f.lookTarget = cam.position));
if (q.get('board') !== '0') {
  W.board.writeInstant('LESSON 7:  ???', 0);
  W.board.writeInstant('2 + 2 = 5', 1);
  W.board.writeInstant('the mitochondria is the', 2);
  W.board.drawEye(860, 200, 70);
}
const post = new PostFX(renderer);
post.setSize(innerWidth, innerHeight, q.get('retro') !== '0');
if (q.get('master')) W.setMaster(Number(q.get('master')));
T.eyeGlow = Number(q.get('glow') || 0.3); T.faceGlow = Number(q.get('fglow') || 0.08);
let last = performance.now();
let frames = 0;
function loop() {
  const now = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  T.update(1 / 30, {});
  if (pose === 'walk' && frames === Number(q.get('wf') || 30)) window.__ready = true;
  for (const c of [...friends, ...studs]) c.update(1 / 30);
  W.board.update(1 / 30);
  W.update(1 / 30, {});
  post.uniforms.time.value = now / 1000;
  post.render(scene, cam);
  frames++;
  if (frames === 40 && pose !== 'walk') window.__ready = true;
  requestAnimationFrame(loop);
}
loop();
