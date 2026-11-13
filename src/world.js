// Builds the classroom: room shell, windows with rain, lights, furniture,
// chalkboard, clock, posters, dust. Static meshes are merged per material.
import * as THREE from 'three';
import * as T from './textures.js';
import { rand, randInt, pick, clamp, damp } from './util.js';
import { Chalkboard } from './board.js';
import { buildLaptop, Projector, buildDoor } from './props.js';

export const ROOM = { x0: -5, x1: 5, z0: -7, z1: 6, h: 3.2 };
export const BOARD_Z = -6.93;
export const ROWS = [-2.05, -0.35, 1.35, 3.05];
export const COLS = [-3.0, -1.5, 0, 1.5, 3.0];
export const PLAYER_EYE = new THREE.Vector3(0, 1.17, -1.5);

class Batcher {
  constructor() { this.map = new Map(); }
  add(geo, mat, matrix) {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.applyMatrix4(matrix);
    if (!this.map.has(mat)) this.map.set(mat, []);
    this.map.get(mat).push(g);
  }
  build(parent, { cast = true, receive = true } = {}) {
    const out = [];
    for (const [mat, list] of this.map) {
      let n = 0;
      for (const g of list) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), uv = new Float32Array(n * 2);
      let o = 0;
      for (const g of list) {
        const c = g.attributes.position.count;
        pos.set(g.attributes.position.array, o * 3);
        nor.set(g.attributes.normal.array, o * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
        o += c;
        g.dispose();
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.computeBoundingSphere();
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = cast; m.receiveShadow = receive;
      m.matrixAutoUpdate = false;
      parent.add(m);
      out.push(m);
    }
    this.map.clear();
    return out;
  }
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
function mtx(x, y, z, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
const cylGeo = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
const planeGeo = new THREE.PlaneGeometry(1, 1);

export function buildWorld(scene, renderer) {
  const W = { scene };
  const B = new Batcher();
  const std = (o) => new THREE.MeshStandardMaterial(o);

  // ---------------- materials ----------------
  const M = {
    floor: std({ map: T.floorTexture(), roughness: 0.8, metalness: 0 }),
    wall: std({ map: T.wallTexture(), roughness: 0.95 }),
    wains: std({ map: T.wainscotTexture(), roughness: 0.9 }),
    ceil: std({ map: T.ceilingTexture(), roughness: 1 }),
    wood: std({ map: T.woodTexture(true), roughness: 0.7 }),
    darkWood: std({ map: T.woodTexture(false), roughness: 0.75 }),
    metal: std({ color: 0x5c6164, roughness: 0.45, metalness: 0.7 }),
    darkMetal: std({ color: 0x24282a, roughness: 0.5, metalness: 0.6 }),
    plastic: std({ color: 0x3b4a52, roughness: 0.6 }),
    frame: std({ color: 0x1c1f1e, roughness: 0.6, metalness: 0.3 }),
    alu: std({ color: 0x8a8d8a, roughness: 0.35, metalness: 0.8 }),
    paper: std({ color: 0xd8d2bf, roughness: 0.95 }),
    chalk: std({ color: 0xf0eee4, roughness: 1 }),
    books: std({ map: T.bookSpines(), roughness: 0.85 }),
    radiator: std({ color: 0x6f6a5c, roughness: 0.5, metalness: 0.5 }),
    black: std({ color: 0x050505, roughness: 0.9 }),
  };
  W.materials = M;

  // ---------------- shell ----------------
  const { x0, x1, z0, z1, h } = ROOM;
  const RW = x1 - x0, RD = z1 - z0, zc = (z0 + z1) / 2;
  B.add(planeGeo, M.floor, mtx(0, 0, zc, -Math.PI / 2, 0, 0, RW, RD, 1));
  B.add(planeGeo, M.ceil, mtx(0, h, zc, Math.PI / 2, 0, 0, RW, RD, 1));
  // front / back walls (upper + wainscot)
  const wall = (x, z, ry, w, isLeft = false) => {
    B.add(planeGeo, M.wall, mtx(x, 1.0 + (h - 1.0) / 2, z, 0, ry, 0, w, h - 1.0, 1));
    B.add(planeGeo, M.wains, mtx(x, 0.5, z, 0, ry, 0, w, 1.0, 1));
  };
  wall(0, z0, 0, RW);
  wall(0, z1, Math.PI, RW);
  wall(x1, zc, -Math.PI / 2, RD);
  // left wall with three windows
  const WIN = [-4.3, -0.9, 2.5];
  const winW = 2.0, winY0 = 1.0, winY1 = 2.5;
  B.add(planeGeo, M.wains, mtx(x0, 0.5, zc, 0, Math.PI / 2, 0, RD, 1.0, 1));
  B.add(planeGeo, M.wall, mtx(x0, (winY1 + h) / 2, zc, 0, Math.PI / 2, 0, RD, h - winY1, 1));
  let zPrev = z0;
  for (const wz of [...WIN.map((c) => c - winW / 2), z1]) {
    const len = wz - zPrev;
    if (len > 0.01) B.add(planeGeo, M.wall, mtx(x0, (winY0 + winY1) / 2, zPrev + len / 2, 0, Math.PI / 2, 0, len, winY1 - winY0, 1));
    zPrev = wz + winW;
  }
  // baseboards
  B.add(boxGeo, M.frame, mtx(0, 0.05, z0 + 0.01, 0, 0, 0, RW, 0.1, 0.02));
  B.add(boxGeo, M.frame, mtx(0, 0.05, z1 - 0.01, 0, 0, 0, RW, 0.1, 0.02));
  B.add(boxGeo, M.frame, mtx(x0 + 0.01, 0.05, zc, 0, 0, 0, 0.02, 0.1, RD));
  B.add(boxGeo, M.frame, mtx(x1 - 0.01, 0.05, zc, 0, 0, 0, 0.02, 0.1, RD));
  // window frames, sills, radiators
  for (const wz of WIN) {
    const fz = (sx, sy, sz, y, z) => B.add(boxGeo, M.frame, mtx(x0 + 0.02, y, z, 0, 0, 0, sx, sy, sz));
    fz(0.08, 0.08, winW + 0.08, winY0, wz); fz(0.08, 0.08, winW + 0.08, winY1, wz);
    fz(0.08, winY1 - winY0, 0.08, (winY0 + winY1) / 2, wz - winW / 2); fz(0.08, winY1 - winY0, 0.08, (winY0 + winY1) / 2, wz + winW / 2);
    fz(0.05, winY1 - winY0, 0.05, (winY0 + winY1) / 2, wz); fz(0.05, 0.05, winW, (winY0 + winY1) / 2 + 0.1, wz);
    B.add(boxGeo, M.paper, mtx(x0 + 0.1, winY0 - 0.03, wz, 0, 0, 0, 0.22, 0.04, winW + 0.1));
    for (let i = 0; i < 12; i++) B.add(boxGeo, M.radiator, mtx(x0 + 0.12, 0.45, wz - 0.6 + i * 0.11, 0, 0, 0, 0.08, 0.55, 0.05));
  }
  // glass + outside + rain
  const outsideMat = new THREE.MeshBasicMaterial({ map: T.outsideTexture(), fog: false, color: 0x8899aa });
  const rainTex = T.rainTexture();
  rainTex.repeat.set(2, 1.5);
  const rainMat = new THREE.MeshBasicMaterial({ map: rainTex, transparent: true, opacity: 0.55, depthWrite: false, fog: false, blending: THREE.AdditiveBlending });
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0c1218, roughness: 0.08, metalness: 0.6, transparent: true, opacity: 0.35, depthWrite: false });
  const outside = new THREE.Mesh(planeGeo, outsideMat);
  outside.position.set(x0 - 0.9, 1.75, zc); outside.rotation.y = Math.PI / 2; outside.scale.set(RD, 3.5, 1);
  scene.add(outside);
  W.outsideMat = outsideMat;
  W.rainTex = rainTex;
  for (const wz of WIN) {
    const g = new THREE.Mesh(planeGeo, glassMat);
    g.position.set(x0 + 0.01, (winY0 + winY1) / 2, wz); g.rotation.y = Math.PI / 2; g.scale.set(winW, winY1 - winY0, 1);
    scene.add(g);
    const r = new THREE.Mesh(planeGeo, rainMat);
    r.position.set(x0 - 0.03, (winY0 + winY1) / 2, wz); r.rotation.y = Math.PI / 2; r.scale.set(winW, winY1 - winY0, 1);
    scene.add(r);
  }
  // silhouette outside the window, only visible in lightning flashes
  const silC = document.createElement('canvas'); silC.width = 128; silC.height = 256;
  const sx = silC.getContext('2d'); sx.fillStyle = '#000';
  sx.beginPath(); sx.ellipse(64, 50, 30, 42, 0, 0, Math.PI * 2); sx.fill();
  sx.fillRect(28, 88, 72, 110); sx.fillRect(14, 92, 16, 150); sx.fillRect(98, 92, 16, 150); sx.fillRect(38, 190, 22, 66); sx.fillRect(68, 190, 22, 66);
  const silTex = new THREE.CanvasTexture(silC);
  const sil = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: silTex, transparent: true, fog: false, depthWrite: false }));
  sil.position.set(x0 - 0.6, 1.25, WIN[1]); sil.rotation.y = Math.PI / 2; sil.scale.set(0.9, 1.8, 1);
  sil.visible = false;
  scene.add(sil);
  W.silhouette = sil;

  // ---------------- door + exit sign ----------------
  const doorZ = -5.0;
  W.door = buildDoor(scene, M, x1, doorZ);
  W.doorZ = doorZ;
  const exitMat = new THREE.MeshBasicMaterial({ color: 0xff2a1a });
  const exitSign = new THREE.Mesh(boxGeo, exitMat);
  exitSign.position.set(x1 - 0.06, 2.4, doorZ); exitSign.scale.set(0.06, 0.16, 0.4);
  scene.add(exitSign);
  W.exitMat = exitMat;

  // ---------------- chalkboard ----------------
  const board = new Chalkboard(5.2, 1.5);
  const boardMat = new THREE.MeshStandardMaterial({ map: board.texture, roughness: 0.92, emissive: 0xffffff, emissiveMap: board.texture, emissiveIntensity: 0.025 });
  const boardMesh = new THREE.Mesh(planeGeo, boardMat);
  boardMesh.position.set(0, 1.65, BOARD_Z);
  boardMesh.scale.set(5.2, 1.5, 1);
  boardMesh.receiveShadow = true;
  scene.add(boardMesh);
  // toWorld expects unscaled local units, so give it a helper object with the same transform but unit scale
  const boardAnchor = new THREE.Object3D();
  boardAnchor.position.copy(boardMesh.position);
  scene.add(boardAnchor);
  W.board = board; W.boardMesh = boardMesh; W.boardAnchor = boardAnchor;
  B.add(boxGeo, M.alu, mtx(0, 2.43, BOARD_Z, 0, 0, 0, 5.36, 0.06, 0.05));
  B.add(boxGeo, M.alu, mtx(0, 0.87, BOARD_Z + 0.02, 0, 0, 0, 5.36, 0.06, 0.05));
  B.add(boxGeo, M.alu, mtx(-2.65, 1.65, BOARD_Z, 0, 0, 0, 0.06, 1.62, 0.05));
  B.add(boxGeo, M.alu, mtx(2.65, 1.65, BOARD_Z, 0, 0, 0, 0.06, 1.62, 0.05));
  B.add(boxGeo, M.alu, mtx(0, 0.86, BOARD_Z + 0.07, 0, 0, 0, 5.3, 0.02, 0.12)); // tray
  for (let i = 0; i < 5; i++) B.add(cylGeo, M.chalk, mtx(rand(-2.2, 2.2), 0.885, BOARD_Z + 0.08, 0, 0, Math.PI / 2, 0.012, rand(0.04, 0.08), 0.012));
  B.add(boxGeo, M.darkWood, mtx(1.4, 0.895, BOARD_Z + 0.08, 0, 0.1, 0, 0.16, 0.04, 0.06));

  // ---------------- clock ----------------
  const clock = new THREE.Group();
  clock.position.set(1.95, 2.82, z0 + 0.04);
  const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.06, 32), M.frame);
  rim.rotation.x = Math.PI / 2;
  clock.add(rim);
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.215, 32), new THREE.MeshStandardMaterial({ map: T.clockTexture(), roughness: 0.6, emissive: 0xffffff, emissiveMap: T.clockTexture(), emissiveIntensity: 0.04 }));
  face.position.z = 0.031;
  clock.add(face);
  const hand = (len, wid, color) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(boxGeo, new THREE.MeshStandardMaterial({ color }));
    m.scale.set(wid, len, 0.006); m.position.y = len / 2 - 0.02;
    g.add(m); g.position.z = 0.04;
    clock.add(g);
    return g;
  };
  const hH = hand(0.11, 0.016, 0x111111), mH = hand(0.17, 0.011, 0x111111), sH = hand(0.18, 0.004, 0x8a1010);
  scene.add(clock);
  W.clock = {
    group: clock,
    set(hours, minutes, seconds) {
      hH.rotation.z = -((hours % 12) + minutes / 60) / 12 * Math.PI * 2;
      mH.rotation.z = -(minutes + seconds / 60) / 60 * Math.PI * 2;
      sH.rotation.z = -seconds / 60 * Math.PI * 2;
    },
    pos: new THREE.Vector3(1.95, 2.82, z0 + 0.1),
  };

  // ---------------- posters ----------------
  const poster = (kind, x, y, z, ry, s = 1) => {
    const p = new THREE.Mesh(planeGeo, new THREE.MeshStandardMaterial({ map: T.posterTexture(kind), roughness: 0.9 }));
    p.position.set(x, y, z); p.rotation.y = ry; p.rotation.z = rand(-0.03, 0.03); p.scale.set(0.62 * s, 0.87 * s, 1);
    scene.add(p);
    return p;
  };
  poster('rules', x1 - 0.01, 1.75, -2.4, -Math.PI / 2, 1.1);
  W.missingPoster = poster('missing', x1 - 0.01, 1.7, -3.7, -Math.PI / 2, 0.85);
  poster('silence', x1 - 0.01, 1.75, 0.8, -Math.PI / 2, 1.1);
  poster('atoms', x1 - 0.01, 1.75, 3.3, -Math.PI / 2, 1.0);
  poster('eyes', -1.8, 1.8, z1 - 0.01, Math.PI, 1.2);
  poster('silence', 3.75, 1.75, z0 + 0.01, 0, 0.9);
  poster('eyes', 2.2, 1.8, z1 - 0.01, Math.PI, 1.0);
  W.projector = new Projector(scene, -3.72, 2.42, 2.0, 1.12, z0, h);

  // ---------------- teacher desk ----------------
  const td = { x: -3.15, z: -5.35 };
  B.add(boxGeo, M.darkWood, mtx(td.x, 0.76, td.z, 0, 0, 0, 1.6, 0.05, 0.8));
  B.add(boxGeo, M.darkWood, mtx(td.x - 0.55, 0.37, td.z, 0, 0, 0, 0.45, 0.74, 0.74));
  B.add(boxGeo, M.darkWood, mtx(td.x + 0.75, 0.37, td.z, 0, 0, 0, 0.05, 0.74, 0.74));
  B.add(boxGeo, M.darkWood, mtx(td.x + 0.1, 0.45, td.z + 0.36, 0, 0, 0, 1.2, 0.55, 0.03));
  for (let i = 0; i < 3; i++) B.add(boxGeo, M.alu, mtx(td.x - 0.55, 0.62 - i * 0.22, td.z + 0.375, 0, 0, 0, 0.12, 0.02, 0.02));
  for (let i = 0; i < 6; i++) B.add(boxGeo, M.paper, mtx(td.x + rand(-0.5, 0.5), 0.79 + i * 0.004, td.z + rand(-0.2, 0.2), 0, rand(-0.6, 0.6), 0, 0.21, 0.003, 0.29));
  for (let i = 0; i < 4; i++) B.add(boxGeo, pick([M.plastic, M.darkWood, M.frame]), mtx(td.x + 0.55, 0.81 + i * 0.045, td.z - 0.15, 0, rand(-0.3, 0.3), 0, 0.22, 0.04, 0.3));
  const apple = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), std({ color: 0x4a1a10, roughness: 0.55 }));
  apple.position.set(td.x - 0.3, 0.825, td.z + 0.1); apple.scale.y = 0.85;
  scene.add(apple);
  // globe
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), std({ color: 0x26404a, roughness: 0.5 }));
  globe.position.set(td.x - 0.55, 1.05, td.z - 0.15);
  scene.add(globe);
  B.add(cylGeo, M.alu, mtx(td.x - 0.55, 0.85, td.z - 0.15, 0, 0, 0, 0.012, 0.16, 0.012));
  // book that falls during a scare
  const book = new THREE.Mesh(boxGeo, std({ color: 0x3a1010, roughness: 0.8 }));
  book.scale.set(0.2, 0.05, 0.27);
  book.position.set(td.x + 0.72, 0.81, td.z + 0.25);
  scene.add(book);
  W.fallingBook = book;
  // teacher chair
  chair(B, M, td.x - 1.05, td.z - 0.9, Math.PI + 0.7, 1.1);
  W.laptop = buildLaptop(scene, td.x + 0.12, 0.785, td.z - 0.12);
  W.teacherDesk = { x: td.x + 0.12, z: td.z, stand: new THREE.Vector3(td.x + 0.12, 0, td.z - 0.86) };

  // ---------------- student desks ----------------
  W.seats = [];
  W.dynamicChairs = {};
  for (let r = 0; r < ROWS.length; r++) {
    for (let c = 0; c < COLS.length; c++) {
      const x = COLS[c], z = ROWS[r];
      desk(B, M, x, z);
      const seat = { x, z: z + 0.5, row: r, col: c };
      W.seats.push(seat);
      // friends' chairs are separate meshes so they can be pushed out
      if (r === 0 && (c === 1 || c === 3)) W.dynamicChairs[c === 1 ? 'sam' : 'nora'] = dynamicChair(scene, M, x, z + 0.5);
      else chair(B, M, x, z + 0.5, 0, 1);
      if (r === 1 && c === 1) {
        const pack = std({ color: 0x5a1512, roughness: 0.9 });
        B.add(boxGeo, pack, mtx(x, 0.63, z + 0.56, 0.12, 0, 0, 0.3, 0.33, 0.15));
        B.add(boxGeo, pack, mtx(x, 0.58, z + 0.47, 0.12, 0, 0, 0.2, 0.16, 0.05));
        B.add(boxGeo, M.paper, mtx(x - 0.05, 0.742, z, 0, 0.3, 0, 0.21, 0.004, 0.29));
        W.kevinSeat = new THREE.Vector3(x, 1.0, z + 0.5);
      }
    }
  }
  W.playerDesk = { x: 0, z: ROWS[0], top: 0.74 };

  // ---------------- back shelf ----------------
  for (let i = 0; i < 3; i++) {
    B.add(boxGeo, M.darkWood, mtx(-1.5, 0.4 + i * 0.45, z1 - 0.2, 0, 0, 0, 4.2, 0.03, 0.35));
    const bk = new THREE.BoxGeometry(4.0, 0.36, 0.25);
    B.add(bk, M.books, mtx(-1.5, 0.6 + i * 0.45, z1 - 0.22));
  }
  B.add(boxGeo, M.darkWood, mtx(-3.6, 0.85, z1 - 0.2, 0, 0, 0, 0.04, 1.7, 0.38));
  B.add(boxGeo, M.darkWood, mtx(0.6, 0.85, z1 - 0.2, 0, 0, 0, 0.04, 1.7, 0.38));
  // trash can + scattered paper
  B.add(new THREE.CylinderGeometry(0.17, 0.14, 0.42, 14, 1, true), M.darkMetal, mtx(-4.4, 0.21, -6.2));
  for (let i = 0; i < 9; i++) B.add(new THREE.IcosahedronGeometry(0.04, 0), M.paper, mtx(rand(-4, 4), 0.03, rand(-5.5, 4.5), rand(0, 3), rand(0, 3), 0));

  // ---------------- lights ----------------
  scene.fog = new THREE.FogExp2(0x0b0f0e, 0.088);
  scene.background = new THREE.Color(0x0b0f0e);
  const hemi = new THREE.HemisphereLight(0x66756f, 0x0d0d0a, 0.6);
  scene.add(hemi);
  const moon = new THREE.DirectionalLight(0x93a6bc, 0.5); // grey daylight from the windows
  moon.position.set(-9, 5, 1); moon.target.position.set(0, 0, 0);
  scene.add(moon, moon.target);

  const panelMat = () => new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfffee, emissiveIntensity: 2.2, roughness: 0.4 });
  const coneTex = T.coneGradient();
  const banks = [];
  for (const [bz, base] of [[-4.2, 7], [-0.9, 5.5], [2.6, 4]]) {
    const light = new THREE.PointLight(0xd8f0e4, base, 0, 2);
    light.position.set(0, 2.75, bz);
    scene.add(light);
    const mats = [];
    for (const bx of [-2.2, 2.2]) {
      B.add(boxGeo, M.alu, mtx(bx, h - 0.04, bz, 0, 0, 0, 1.3, 0.07, 0.34));
      const pm = panelMat();
      const p = new THREE.Mesh(planeGeo, pm);
      p.position.set(bx, h - 0.081, bz); p.rotation.x = Math.PI / 2; p.scale.set(1.2, 0.26, 1);
      scene.add(p);
      mats.push(pm);
      const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 1.5, 2.9, 20, 1, true),
        new THREE.MeshBasicMaterial({ map: coneTex, color: 0xcfe8dc, transparent: true, opacity: 0.022, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
      cone.position.set(bx, h - 1.5, bz);
      scene.add(cone);
      mats.push(cone.material);
    }
    banks.push({ light, mats, base, level: 1, target: 1, flicker: 0, dead: false });
  }
  const spot = new THREE.SpotLight(0xe8f4ea, 22, 0, 0.78, 0.65, 2);
  spot.position.set(0.3, 3.05, -3.0);
  spot.target.position.set(0, 1.25, -6.7);
  spot.castShadow = true;
  spot.shadow.mapSize.set(1024, 1024);
  spot.shadow.bias = -0.0008;
  spot.shadow.normalBias = 0.02;
  spot.shadow.camera.near = 0.5; spot.shadow.camera.far = 9;
  scene.add(spot, spot.target);
  const red = new THREE.PointLight(0xff2010, 0, 0, 2);
  red.position.set(x1 - 0.4, 2.3, doorZ);
  scene.add(red);
  W.lights = { hemi, moon, banks, spot, red, spotBase: 22, hemiBase: 0.6, moonBase: 0.5 };
  W.gloom = 0.2; W.gloomTarget = 0.2; // 0 = grey morning, 1 = black as night
  W.master = 1; // global light multiplier (blackouts)

  // ---------------- dust ----------------
  const DUST = 420;
  const dustGeo = new THREE.BufferGeometry();
  const dp = new Float32Array(DUST * 3);
  W.dustVel = new Float32Array(DUST * 3);
  for (let i = 0; i < DUST; i++) {
    dp[i * 3] = rand(x0, x1); dp[i * 3 + 1] = rand(0.3, h - 0.2); dp[i * 3 + 2] = rand(z0, z1);
    W.dustVel[i * 3] = rand(-0.02, 0.02); W.dustVel[i * 3 + 1] = rand(-0.01, 0.01); W.dustVel[i * 3 + 2] = rand(-0.02, 0.02);
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dp, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.028, map: T.softDot(), color: 0xb9c7bd, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
  dust.frustumCulled = false;
  scene.add(dust);
  W.dust = dust;

  // chalk dust bursts (pooled)
  const CD = 260;
  const cdGeo = new THREE.BufferGeometry();
  W.cd = { n: CD, pos: new Float32Array(CD * 3), col: new Float32Array(CD * 3), vel: new Float32Array(CD * 3), life: new Float32Array(CD), next: 0 };
  W.cd.pos.fill(-100);
  cdGeo.setAttribute('position', new THREE.BufferAttribute(W.cd.pos, 3));
  cdGeo.setAttribute('color', new THREE.BufferAttribute(W.cd.col, 3));
  const cdPts = new THREE.Points(cdGeo, new THREE.PointsMaterial({ size: 0.05, map: T.softDot(), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  cdPts.frustumCulled = false;
  scene.add(cdPts);
  W.cdPts = cdPts;

  W.statics = B.build(scene);
  W.renderer = renderer;
  W.lightning = 0;
  W.time = 0;

  // ---------------- API ----------------
  W.chalkBurst = (pos, count = 40, spread = 0.6) => {
    const cd = W.cd;
    for (let k = 0; k < count; k++) {
      const i = cd.next; cd.next = (cd.next + 1) % cd.n;
      cd.pos[i * 3] = pos.x + rand(-0.04, 0.04); cd.pos[i * 3 + 1] = pos.y + rand(-0.04, 0.04); cd.pos[i * 3 + 2] = pos.z + rand(-0.04, 0.04);
      const a = rand(0, Math.PI * 2), s = rand(0.1, spread);
      cd.vel[i * 3] = Math.cos(a) * s; cd.vel[i * 3 + 1] = rand(-0.05, 0.35); cd.vel[i * 3 + 2] = Math.sin(a) * s;
      cd.life[i] = rand(1.2, 2.6);
    }
  };
  W.flash = (strength = 1) => { W.lightning = Math.max(W.lightning, strength); };
  /** level 0..1 for all banks (blackouts) */
  W.setMaster = (v) => { W.master = v; };

  W.update = (dt, { emergency = 0 } = {}) => {
    W.time += dt;
    rainTex.offset.y = (rainTex.offset.y + dt * 1.6) % 1;
    rainTex.offset.x = Math.sin(W.time * 0.3) * 0.05;
    // dust drift
    const arr = dust.geometry.attributes.position.array, v = W.dustVel;
    for (let i = 0; i < arr.length; i += 3) {
      arr[i] += v[i] * dt; arr[i + 1] += v[i + 1] * dt + Math.sin(W.time * 0.5 + i) * 0.0008; arr[i + 2] += v[i + 2] * dt;
      if (arr[i] < x0) arr[i] = x1; if (arr[i] > x1) arr[i] = x0;
      if (arr[i + 1] < 0.2) arr[i + 1] = h - 0.2; if (arr[i + 1] > h - 0.1) arr[i + 1] = 0.25;
      if (arr[i + 2] < z0) arr[i + 2] = z1; if (arr[i + 2] > z1) arr[i + 2] = z0;
    }
    dust.geometry.attributes.position.needsUpdate = true;
    // chalk dust
    const cd = W.cd;
    let any = false;
    for (let i = 0; i < cd.n; i++) {
      if (cd.life[i] <= 0) continue;
      any = true;
      cd.life[i] -= dt;
      const k = Math.max(0, cd.life[i]) / 2.6;
      cd.vel[i * 3] *= 1 - 1.8 * dt; cd.vel[i * 3 + 1] = cd.vel[i * 3 + 1] * (1 - 1.8 * dt) - 0.05 * dt; cd.vel[i * 3 + 2] *= 1 - 1.8 * dt;
      cd.pos[i * 3] += cd.vel[i * 3] * dt; cd.pos[i * 3 + 1] += cd.vel[i * 3 + 1] * dt; cd.pos[i * 3 + 2] += cd.vel[i * 3 + 2] * dt;
      cd.col[i * 3] = cd.col[i * 3 + 1] = cd.col[i * 3 + 2] = k * 0.8;
      if (cd.life[i] <= 0) cd.pos[i * 3 + 1] = -100;
    }
    if (any) { cdPts.geometry.attributes.position.needsUpdate = true; cdPts.geometry.attributes.color.needsUpdate = true; }

    // lights: flicker + master level + lightning
    W.lightning = Math.max(0, W.lightning - dt * 3.2);
    const flashK = W.lightning > 0 ? (Math.random() < 0.7 ? W.lightning : W.lightning * 0.3) : 0;
    for (const b of W.lights.banks) {
      let lv = b.dead ? 0 : b.target;
      if (b.flicker > 0) {
        b.flicker -= dt;
        lv *= Math.random() < 0.45 ? rand(0, 0.15) : rand(0.6, 1.1);
      }
      b.level = damp(b.level, lv, 30, dt);
      const L = b.level * W.master;
      b.light.intensity = b.base * L;
      for (const m of b.mats) {
        if (m.isMeshBasicMaterial) m.opacity = 0.022 * L;
        else m.emissiveIntensity = 2.2 * L;
      }
    }
    const fm = W.master;
    W.lights.spot.intensity = W.lights.spotBase * fm * W.lights.banks[0].level;
    W.gloom = damp(W.gloom, W.gloomTarget, 0.5, dt);
    const day = 1 - W.gloom;
    W.lights.hemi.intensity = W.lights.hemiBase * (0.45 + 0.55 * day) * (0.25 + 0.75 * fm) + flashK * 1.2;
    W.lights.moon.intensity = W.lights.moonBase * (0.08 + 0.92 * day) + flashK * 9;
    outsideMat.color.setScalar(0.1 + 0.95 * day + flashK * 2.5);
    W.silhouette.visible = W.showSilhouette && flashK > 0.3;
    W.laptop.update(dt, W.time);
    W.projector.update(dt, fm);
    W.door.update(dt);
    // one spare point light does three jobs: laptop glow, emergency light, (and the jumpscare)
    if (W.laptop.glow > 0.02) {
      W.lights.red.color.setHex(0x9fc4ff);
      W.lights.red.position.copy(W.laptop.lightPos);
      W.lights.red.intensity = W.laptop.glow * 1.3;
    } else {
      W.lights.red.color.setHex(0xff2010);
      W.lights.red.position.set(x1 - 0.4, 2.3, doorZ);
      W.lights.red.intensity = emergency * (2.5 + Math.sin(W.time * 3) * 0.8);
    }
    W.exitMat.color.setRGB(1, 0.16 + 0.1 * Math.sin(W.time * 5), 0.1);
  };

  // move the falling book back on restart
  W.resetProps = () => {
    book.position.set(td.x + 0.72, 0.81, td.z + 0.25); book.rotation.set(0, 0, 0);
    for (const k in W.dynamicChairs) W.dynamicChairs[k].reset();
    for (const b of W.lights.banks) { b.dead = false; b.target = 1; b.flicker = 0; }
    W.master = 1;
    W.laptop.reset(); W.projector.reset(); W.door.reset();
  };
  return W;
}

function desk(B, M, x, z) {
  B.add(boxGeo, M.wood, mtx(x, 0.72, z, 0, 0, 0, 0.66, 0.035, 0.48));
  B.add(boxGeo, M.darkMetal, mtx(x, 0.6, z - 0.04, 0, 0, 0, 0.6, 0.12, 0.36)); // book box
  for (const [dx, dz] of [[-0.29, -0.2], [0.29, -0.2], [-0.29, 0.2], [0.29, 0.2]]) B.add(boxGeo, M.metal, mtx(x + dx, 0.36, z + dz, 0, 0, 0, 0.025, 0.72, 0.025));
  B.add(boxGeo, M.metal, mtx(x, 0.1, z - 0.2, 0, 0, 0, 0.58, 0.02, 0.02));
  B.add(boxGeo, M.metal, mtx(x, 0.1, z + 0.2, 0, 0, 0, 0.58, 0.02, 0.02));
  if (Math.random() < 0.35) B.add(boxGeo, M.paper, mtx(x + rand(-0.15, 0.15), 0.74, z + rand(-0.1, 0.1), 0, rand(-0.5, 0.5), 0, 0.21, 0.003, 0.29));
}

function chairParts(add, M, x, z, ry, s) {
  const c = Math.cos(ry), sn = Math.sin(ry);
  const P = (dx, y, dz) => [x + (dx * c + dz * sn) * s, y * s, z + (-dx * sn + dz * c) * s];
  add(boxGeo, M.plastic, P(0, 0.45, 0), ry, [0.42, 0.035, 0.4].map((v) => v * s));
  add(boxGeo, M.plastic, P(0, 0.75, 0.2), ry, [0.42, 0.3, 0.03].map((v) => v * s), -0.1);
  for (const [dx, dz] of [[-0.18, -0.17], [0.18, -0.17], [-0.18, 0.17], [0.18, 0.17]]) add(boxGeo, M.metal, P(dx, 0.225, dz), ry, [0.02, 0.45, 0.02].map((v) => v * s));
  add(boxGeo, M.metal, P(-0.18, 0.6, 0.19), ry, [0.02, 0.3, 0.02].map((v) => v * s));
  add(boxGeo, M.metal, P(0.18, 0.6, 0.19), ry, [0.02, 0.3, 0.02].map((v) => v * s));
}

function chair(B, M, x, z, ry, s) {
  chairParts((g, m, p, r, sc, rx = 0) => B.add(g, m, mtx(p[0], p[1], p[2], rx, r, 0, sc[0], sc[1], sc[2])), M, x, z, ry, s);
}

function dynamicChair(scene, M, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  chairParts((geo, m, p, r, sc, rx = 0) => {
    const mesh = new THREE.Mesh(geo, m);
    mesh.position.set(p[0] - x, p[1], p[2] - z); mesh.rotation.set(rx, r, 0); mesh.scale.set(sc[0], sc[1], sc[2]);
    mesh.castShadow = true;
    g.add(mesh);
  }, M, x, z, 0, 1);
  scene.add(g);
  const home = new THREE.Vector3(x, 0, z);
  return {
    group: g,
    rock: 0,
    reset() { g.position.copy(home); g.rotation.set(0, 0, 0); this.rock = 0; },
    pushOut() { g.position.set(home.x + rand(-0.15, 0.15), 0, home.z + 0.35); g.rotation.y = rand(-0.5, 0.5); this.rock = 1; },
    update(dt, t) { if (this.rock > 0) { this.rock = Math.max(0, this.rock - dt * 0.12); g.rotation.x = Math.sin(t * 4.2) * 0.05 * this.rock; } },
  };
}
