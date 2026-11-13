// Madi's head: a mesh shaped from the reference photo's silhouette with the
// photo projected onto the front, glossy eyeballs, a jaw that drops, and his
// round glasses (they are not his).
import * as THREE from 'three';
import { table, smoothstep, clamp, rand } from './util.js';

export const S = 0.62 / 765; // metres per photo pixel
const CX = 384;              // photo x of the face centre
const Y_BOTTOM = 690;        // photo y at the bottom of the jaw (local y = 0)
const MOUTH = 572;           // jaw split line
const TEX_X0 = 84, TEX_Y0 = -150, TEX_W = 600, TEX_H = 900;

// half-width of the head (photo px) without the ears
const PROFILE = [[-75, 0], [-71, 34], [-64, 62], [-52, 90], [-36, 115], [-18, 133], [0, 146], [20, 163], [40, 181], [60, 195], [80, 204],
  [100, 208], [130, 206], [160, 204], [190, 204], [220, 206], [250, 210], [280, 214], [310, 217], [340, 220], [360, 220], [380, 215],
  [400, 205], [420, 192], [440, 183], [460, 176], [480, 171], [500, 167], [520, 165], [540, 163], [572, 162], [600, 165], [640, 169], [690, 172]];
const DEPTH = [[-75, 0.95], [150, 0.97], [300, 0.9], [450, 0.82], [700, 0.8]];
const NOSE_AMP = [[200, 0], [240, 7], [300, 14], [360, 21], [420, 29], [480, 39], [515, 43], [540, 35], [558, 14], [572, 0]];
const NOSE_SIG = [[200, 18], [300, 24], [400, 36], [480, 55], [540, 70], [572, 70]];
const EYES = [[293, 160], [462, 155]];

function relief(x, y) {
  let z = 0;
  const a = table(NOSE_AMP, y);
  if (a > 0) { const s = table(NOSE_SIG, y); z += a * Math.exp(-Math.pow((x - 381) / s, 2)); }
  for (const [ex, ey] of EYES) z -= 16 * Math.exp(-((x - ex) ** 2 + (y - ey) ** 2) / (2 * 36 * 36));
  z += 7 * Math.exp(-Math.pow((y - 98) / 22, 2)) * Math.exp(-Math.pow((x - CX) / 150, 4));
  for (const sgn of [-1, 1]) z += 10 * Math.exp(-Math.pow((x - CX - sgn * 140) / 50, 2) - Math.pow((y - 330) / 70, 2));
  z += 8 * Math.exp(-Math.pow((y - 553) / 13, 2) - Math.pow((x - CX) / 110, 2));
  z += 7 * Math.exp(-Math.pow((y - 590) / 12, 2) - Math.pow((x - CX) / 100, 2));
  return z;
}

const NF = 2.5; // front superellipse exponent (flatter face)
function surfaceZpx(xRel, y) {
  const w = table(PROFILE, y), d = w * table(DEPTH, y);
  const sx = clamp(Math.abs(xRel) / w, 0, 1);
  const sinT = Math.pow(sx, NF / 2);
  const cosT = Math.sqrt(Math.max(0, 1 - sinT * sinT));
  return d * Math.pow(cosT, 2 / NF) + relief(xRel + CX, y) * smoothstep(0.15, 0.6, cosT);
}

const uvOf = (xRel, y) => [(xRel + CX - TEX_X0) / TEX_W, 1 - (y - TEX_Y0) / TEX_H];

function headGrid(y0, y1, step, seg) {
  const ys = [];
  for (let y = y0; y < y1; y += step) ys.push(y);
  ys.push(y1);
  const pos = [], uv = [], col = [], idx = [];
  for (const y of ys) {
    const w = table(PROFILE, y), d = w * table(DEPTH, y);
    for (let i = 0; i <= seg; i++) {
      // more columns on the face than on the back of the head
      const k = i / seg;
      const th = -Math.PI + 2 * Math.PI * (k + 0.07 * Math.sin(2 * Math.PI * k));
      const sx = Math.sin(th), cz = Math.cos(th);
      const n = cz > 0 ? NF : 2.0;
      const side = i < seg / 2 ? -1 : 1;
      const xRel = w * Math.sign(sx) * Math.pow(Math.abs(sx), 2 / n);
      let zpx = d * Math.sign(cz) * Math.pow(Math.abs(cz), 2 / n);
      if (cz > 0) zpx += relief(xRel + CX, y) * smoothstep(0.15, 0.6, cz);
      pos.push(xRel * S, (Y_BOTTOM - y) * S, zpx * S);
      const ux = cz >= 0 ? xRel : side * (w + 8);
      uv.push(...uvOf(ux, y));
      const back = smoothstep(0.1, -0.5, cz);
      const hair = 1 - smoothstep(380, 470, y);
      const crown = 1 - smoothstep(-45, 10, y);
      const c = (1 - back * hair * 0.93) * (1 - crown * 0.85);
      col.push(c, c, c);
    }
  }
  const rowLen = seg + 1;
  for (let r = 0; r < ys.length - 1; r++) {
    for (let i = 0; i < seg; i++) {
      const a = r * rowLen + i, b = a + rowLen;
      idx.push(a, b, b + 1, a, b + 1, a + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function eyeballGeo(cx, cy, r) {
  const g = new THREE.SphereGeometry(r, 14, 10);
  g.rotateX(Math.PI / 2); // pole forward so the front is smooth
  const p = g.attributes.position, uv = g.attributes.uv;
  const ox = (cx - CX) * S, oy = (Y_BOTTOM - cy) * S;
  for (let i = 0; i < p.count; i++) {
    const [u, v] = uvOf((ox + p.getX(i)) / S, Y_BOTTOM - (oy + p.getY(i)) / S);
    uv.setXY(i, u, v);
  }
  return g;
}

function buildGlasses() {
  const g = new THREE.Group();
  const frame = new THREE.MeshStandardMaterial({ color: 0x2b2118, roughness: 0.35, metalness: 0.85 });
  const lens = new THREE.MeshStandardMaterial({ color: 0xb8ccd6, roughness: 0.05, metalness: 0.6, transparent: true, opacity: 0.14, emissive: 0xdfeeff, emissiveIntensity: 0, depthWrite: false });
  const ex0 = (EYES[0][0] - CX) * S, ex1 = (EYES[1][0] - CX) * S;
  const mid = (ex0 + ex1) / 2, half = (ex1 - ex0) / 2 + 0.002;
  const ey = (Y_BOTTOM - (EYES[0][1] + EYES[1][1]) / 2) * S;
  const z = surfaceZpx(EYES[0][0] - CX, EYES[0][1]) * S + 0.036;
  const R = 0.052;
  const rim = new THREE.TorusGeometry(R, 0.0036, 6, 22);
  const disc = new THREE.CircleGeometry(R - 0.002, 18);
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(rim, frame);
    m.position.set(s * half, 0, 0);
    g.add(m);
    const l = new THREE.Mesh(disc, lens);
    l.position.set(s * half, 0, -0.001);
    g.add(l);
    // temple arm: out to the hinge, back past the temple, down behind the ear
    const pts = [new THREE.Vector3(s * (half + R), 0.004, 0), new THREE.Vector3(s * (half + R + 0.012), 0.004, -0.012),
      new THREE.Vector3(s * 0.158 - mid, 0.002, -0.075), new THREE.Vector3(s * 0.172 - mid, -0.004, -0.19), new THREE.Vector3(s * 0.172 - mid, -0.03, -0.215)];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const len = a.distanceTo(b);
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.006, len), frame);
      bar.position.copy(a).add(b).multiplyScalar(0.5);
      bar.lookAt(b);
      g.add(bar);
    }
  }
  const bridge = new THREE.Mesh(new THREE.TorusGeometry(half - R + 0.004, 0.0034, 5, 10, Math.PI), frame);
  bridge.position.set(0, 0.004, 0);
  g.add(bridge);
  g.position.set(mid, ey, z);
  g.userData.home = g.position.clone();
  return { group: g, lens };
}

/** Builds the head. Local origin = bottom of the jaw, +z = face. */
export function buildHead(faceTex, eyesTex) {
  const head = new THREE.Group();
  // the face faintly self-illuminates so it always reads in the dark
  const faceMat = new THREE.MeshStandardMaterial({ map: faceTex, vertexColors: true, roughness: 0.52, metalness: 0, emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.08 });
  const eyeMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.12, metalness: 0.15, emissive: 0xffffff, emissiveMap: eyesTex, emissiveIntensity: 0.05 });
  const upper = new THREE.Mesh(headGrid(-75, MOUTH, 11, 40), faceMat);
  upper.castShadow = true;
  head.add(upper);
  const jawY = (Y_BOTTOM - MOUTH) * S;
  const jawPivot = new THREE.Group();
  jawPivot.position.set(0, jawY, -0.08);
  head.add(jawPivot);
  const jaw = new THREE.Mesh(headGrid(MOUTH, Y_BOTTOM, 11, 40), faceMat);
  jaw.position.set(0, -jawY, 0.08);
  jaw.castShadow = true;
  jawPivot.add(jaw);
  // mouth cavity + teeth (seen when the jaw drops)
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: 0x140303 }));
  cavity.scale.set(1.3, 0.95, 0.75);
  cavity.position.set(0, jawY - 0.01, 0.0);
  head.add(cavity);
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xcfc59c, roughness: 0.4, emissive: 0x2a2416 });
  const toothGeo = new THREE.BoxGeometry(0.013, 0.026, 0.01);
  for (let i = 0; i < 11; i++) {
    const xr = -0.068 + i * 0.0136;
    const zs = surfaceZpx(xr / S, MOUTH) * S - 0.016;
    const up = new THREE.Mesh(toothGeo, toothMat);
    up.position.set(xr, jawY + 0.002, zs); up.scale.y = rand(0.8, 1.5); up.rotation.z = rand(-0.2, 0.2);
    head.add(up);
    const lo = new THREE.Mesh(toothGeo, toothMat); // jawPivot space = head space shifted by (0, -jawY, +0.08)
    lo.position.set(xr + 0.006, -0.012, zs + 0.08 - 0.004); lo.scale.y = rand(0.7, 1.3); lo.rotation.z = rand(-0.25, 0.25);
    jawPivot.add(lo);
  }
  for (const [ex, ey] of EYES) {
    const r = 0.036;
    const e = new THREE.Mesh(eyeballGeo(ex, ey, r), eyeMat);
    e.position.set((ex - CX) * S, (Y_BOTTOM - ey) * S, surfaceZpx(ex - CX, ey) * S - r * 0.55);
    head.add(e);
  }
  const earMat = new THREE.MeshStandardMaterial({ color: 0x2e1b0f, roughness: 0.7 });
  for (const sgn of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), earMat);
    ear.scale.set(0.016, 0.046, 0.032);
    ear.position.set(sgn * (204 * S + 0.002), (Y_BOTTOM - 190) * S, -0.03);
    ear.rotation.y = sgn * 0.3;
    head.add(ear);
  }
  const glasses = buildGlasses();
  head.add(glasses.group);
  return { head, jawPivot, faceMat, eyeMat, glasses: glasses.group, lensMat: glasses.lens, eyeHeight: (Y_BOTTOM - 158) * S, height: 765 * S };
}
