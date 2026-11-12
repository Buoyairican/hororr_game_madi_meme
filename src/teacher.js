// The substitute teacher: a tall suited figure whose head is built from the
// photo silhouette with the face projected onto it. Arms use two-bone IK so
// the hands can write on the board, clap, grip the player's desk, etc.
import * as THREE from 'three';
import { table, smoothstep, clamp, damp, dampAngle, rand, lerp } from './util.js';

const S = 0.62 / 765;      // metres per photo pixel
const CX = 384;            // photo x of the face centre
const Y_BOTTOM = 690;      // photo y at the bottom of the jaw (local y = 0)
const MOUTH = 572;         // jaw split line
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

function headGrid(y0, y1, step, seg = 56) {
  const ys = [];
  for (let y = y0; y < y1; y += step) ys.push(y);
  ys.push(y1);
  const pos = [], uv = [], col = [], idx = [];
  for (const y of ys) {
    const w = table(PROFILE, y), d = w * table(DEPTH, y);
    for (let i = 0; i <= seg; i++) {
      const th = -Math.PI + (2 * Math.PI * i) / seg;
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
      const k = (1 - back * hair * 0.93) * (1 - crown * 0.85);
      col.push(k, k, k);
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
  const g = new THREE.SphereGeometry(r, 20, 16);
  g.rotateX(Math.PI / 2); // pole forward so the front is smooth
  const p = g.attributes.position, uv = g.attributes.uv;
  const ox = (cx - CX) * S, oy = (Y_BOTTOM - cy) * S;
  for (let i = 0; i < p.count; i++) {
    const xRel = (ox + p.getX(i)) / S, y = Y_BOTTOM - (oy + p.getY(i)) / S;
    const [u, v] = uvOf(xRel, y);
    uv.setXY(i, u, v);
  }
  return g;
}

// ------------------------------------------------------------ IK helpers
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3(), _dir = new THREE.Vector3();
const _pole = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _w = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _qa = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
const _eul = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);

function basisQuat(X, Y, out) {
  _y.copy(Y).normalize();
  _z.crossVectors(X, _y).normalize();
  _x.crossVectors(_y, _z).normalize();
  _m4.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m4);
}
function setWorldQuat(obj, q) {
  obj.parent.getWorldQuaternion(_qp);
  obj.quaternion.copy(_qp.invert().multiply(q));
  obj.updateMatrixWorld(true);
}

function solveArm(arm, target, pole, aim) {
  const { shoulder, elbow, wrist, L1, L2 } = arm;
  shoulder.parent.updateWorldMatrix(true, false);
  _S.copy(shoulder.position).applyMatrix4(shoulder.parent.matrixWorld);
  _dir.subVectors(target, _S);
  let d = _dir.length();
  _dir.divideScalar(d || 1);
  d = clamp(d, 0.06, L1 + L2 - 0.003);
  const a = Math.acos(clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1));
  _pole.subVectors(pole, _S);
  _pole.addScaledVector(_dir, -_pole.dot(_dir));
  if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0);
  _pole.normalize();
  _E.copy(_S).addScaledVector(_dir, Math.cos(a) * L1).addScaledVector(_pole, Math.sin(a) * L1);
  _T.copy(_S).addScaledVector(_dir, d);
  _u.subVectors(_E, _S).normalize();
  _f.subVectors(_T, _E).normalize();
  _n.crossVectors(_u, _f);
  if (_n.lengthSq() < 1e-8) _n.crossVectors(_u, _pole);
  _n.normalize();
  setWorldQuat(shoulder, basisQuat(_n, _v.copy(_u).negate(), _qa));
  setWorldQuat(elbow, basisQuat(_n, _v.copy(_f).negate(), _qa));
  if (aim) {
    wrist.getWorldPosition(_w);
    _v2.subVectors(aim, _w).normalize();
    setWorldQuat(wrist, basisQuat(_n, _v.copy(_v2).negate(), _qa));
  } else {
    wrist.quaternion.setFromEuler(arm.restWrist);
  }
}

// ------------------------------------------------------------ Teacher
export class Teacher {
  constructor(faceTex, eyesTex) {
    const root = (this.root = new THREE.Group());
    root.name = 'teacher';
    const suit = new THREE.MeshStandardMaterial({ color: 0x15171d, roughness: 0.82 });
    const shirt = new THREE.MeshStandardMaterial({ color: 0xc4ccd4, roughness: 0.75 });
    const tie = new THREE.MeshStandardMaterial({ color: 0x2a0b0b, roughness: 0.6 });
    const skin = (this.skinMat = new THREE.MeshStandardMaterial({ color: 0x7a5232, roughness: 0.55 }));
    const shoe = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.25, metalness: 0.2 });
    // the face faintly self-illuminates so it always reads in the dark
    this.faceMat = new THREE.MeshStandardMaterial({
      map: faceTex, vertexColors: true, roughness: 0.52, metalness: 0,
      emissive: 0xffffff, emissiveMap: faceTex, emissiveIntensity: 0.08,
    });
    const eyeMat = (this.eyeMat = new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.12, metalness: 0.15, emissive: 0xffffff, emissiveMap: eyesTex, emissiveIntensity: 0.05 }));
    const cast = (m) => { m.castShadow = true; return m; };

    // legs pivot at the hip joints so he can splay them like a spider
    this.legs = [];
    for (const sx of [-0.12, 0.12]) {
      const pivot = new THREE.Group();
      pivot.position.set(sx, 1.02, 0);
      root.add(pivot);
      const leg = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.066, 0.98, 12), suit));
      leg.position.set(0, -0.47, 0);
      pivot.add(leg);
      const sh = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.31), shoe));
      sh.position.set(0, -0.98, 0.05);
      pivot.add(sh);
      this.legs.push({ pivot, side: Math.sign(sx) });
    }
    // hips (pivot for leaning)
    const hips = (this.hips = new THREE.Group());
    hips.position.y = 1.02;
    root.add(hips);
    const pelvis = cast(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.25), suit));
    hips.add(pelvis);
    const torsoGeo = new THREE.CylinderGeometry(0.3, 0.21, 0.62, 22);
    torsoGeo.scale(1, 1, 0.52);
    const torso = cast(new THREE.Mesh(torsoGeo, suit));
    torso.position.y = 0.35;
    hips.add(torso);
    for (const sx of [-0.27, 0.27]) {
      const cap = cast(new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 10), suit));
      cap.scale.set(1.1, 0.8, 0.9);
      cap.position.set(sx, 0.6, 0);
      hips.add(cap);
    }
    // shirt V, tie, collar
    const vShape = new THREE.Shape();
    vShape.moveTo(-0.095, 0.66); vShape.lineTo(0.095, 0.66); vShape.lineTo(0, 0.34); vShape.closePath();
    const shirtV = new THREE.Mesh(new THREE.ShapeGeometry(vShape), shirt);
    shirtV.position.z = 0.152; shirtV.rotation.x = -0.08;
    hips.add(shirtV);
    const tieM = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.27, 0.006), tie);
    tieM.position.set(0, 0.5, 0.158); tieM.rotation.x = -0.08;
    hips.add(tieM);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.118, 0.14, 0.07, 16, 1, true), shirt);
    collar.material = shirt.clone(); collar.material.side = THREE.DoubleSide;
    collar.position.set(0, 0.665, -0.01); collar.scale.z = 0.9;
    hips.add(collar);
    // neck
    const neck = (this.neck = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.103, 0.11, 0.2, 14), skin)));
    neck.position.set(0, 0.72, -0.02); neck.scale.z = 0.85;
    hips.add(neck);

    // head
    const headPivot = (this.headPivot = new THREE.Group());
    headPivot.position.set(0, 0.73, 0);
    headPivot.rotation.order = 'YXZ';
    hips.add(headPivot);
    const head = (this.head = new THREE.Group());
    head.position.z = 0.0;
    headPivot.add(head);
    const upper = cast(new THREE.Mesh(headGrid(-75, MOUTH, 7), this.faceMat));
    head.add(upper);
    const jawY = (Y_BOTTOM - MOUTH) * S;
    const jawPivot = (this.jawPivot = new THREE.Group());
    jawPivot.position.set(0, jawY, -0.08);
    head.add(jawPivot);
    const jaw = cast(new THREE.Mesh(headGrid(MOUTH, Y_BOTTOM, 7), this.faceMat));
    jaw.position.set(0, -jawY, 0.08);
    jawPivot.add(jaw);
    // mouth cavity + teeth (only seen when the jaw drops)
    const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshBasicMaterial({ color: 0x140303 }));
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
      // jawPivot space = head space shifted by (0, -jawY, +0.08)
      const lo = new THREE.Mesh(toothGeo, toothMat);
      lo.position.set(xr + 0.006, -0.012, zs + 0.08 - 0.004); lo.scale.y = rand(0.7, 1.3); lo.rotation.z = rand(-0.25, 0.25);
      jawPivot.add(lo);
    }
    // eyeballs
    for (const [ex, ey] of EYES) {
      const r = 0.036;
      const g = eyeballGeo(ex, ey, r);
      const e = new THREE.Mesh(g, eyeMat);
      const zs = surfaceZpx(ex - CX, ey) * S;
      e.position.set((ex - CX) * S, (Y_BOTTOM - ey) * S, zs - r * 0.55);
      head.add(e);
    }
    // ears
    for (const sgn of [-1, 1]) {
      const ear = cast(new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), new THREE.MeshStandardMaterial({ color: 0x2e1b0f, roughness: 0.7 })));
      ear.scale.set(0.016, 0.046, 0.032);
      ear.position.set(sgn * (204 * S + 0.002), (Y_BOTTOM - 190) * S, -0.03);
      ear.rotation.y = sgn * 0.3;
      head.add(ear);
    }

    // arms
    const L1 = 0.36, L2 = 0.33;
    this.arms = {};
    for (const [key, sx] of [['L', 0.3], ['R', -0.3]]) {
      const shoulder = new THREE.Group();
      shoulder.position.set(sx, 0.58, 0);
      hips.add(shoulder);
      const up = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.052, L1, 12), suit));
      up.position.y = -L1 / 2;
      shoulder.add(up);
      const elbow = new THREE.Group();
      elbow.position.y = -L1;
      shoulder.add(elbow);
      const fore = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.045, L2, 12), suit));
      fore.position.y = -L2 / 2;
      elbow.add(fore);
      const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.03, 12), shirt);
      cuff.position.y = -L2 + 0.012;
      elbow.add(cuff);
      const wrist = new THREE.Group();
      wrist.position.y = -L2;
      elbow.add(wrist);
      const hand = this.makeHand(skin, key === 'R');
      wrist.add(hand);
      this.arms[key] = {
        shoulder, elbow, wrist, L1, L2, side: Math.sign(sx),
        target: new THREE.Vector3(), desired: new THREE.Vector3(), pole: new THREE.Vector3(), aim: null, k: 6,
        restWrist: new THREE.Euler(0.1, 0, 0), init: false,
      };
    }

    // ---------- animation state ----------
    this.pos = root.position;
    this.facing = 0;            // body yaw; 0 = facing +z (toward the class)
    this.facingTarget = 0;
    this.turnSpeed = 6;
    this.moveTarget = null;
    this.moveSpeed = 2.5;
    this.vel = new THREE.Vector3();
    this.lookTarget = null;     // world Vector3 or null
    this.lookSpeed = 6;
    this.headYaw = 0; this.headPitch = 0; this.headRoll = 0;
    this.rollTarget = 0;
    this.lean = 0; this.leanTarget = 0;
    this.spread = 0; this.spreadTarget = 0;
    this.stretch = 0; this.stretchTarget = 0;
    this.jaw = 0; this.jawTarget = 0;
    this.pose = 'rest';
    this.poseData = {};
    this.twitch = 0;
    this.jitter = 0;            // violent head shake (jumpscare)
    this.clap = null;
    this.eyeGlow = 0.05;
    this.faceGlow = 0.08;
    this.time = 0;
  }

  makeHand(skin, holdsChalk) {
    const hand = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.082, 0.1, 0.03), skin);
    palm.position.y = -0.05;
    palm.castShadow = true;
    hand.add(palm);
    const fg = new THREE.CylinderGeometry(0.0085, 0.007, 1, 6);
    for (let i = 0; i < 4; i++) {
      const len = [0.085, 0.1, 0.095, 0.075][i];
      const f = new THREE.Mesh(fg, skin);
      f.scale.y = len;
      const pivot = new THREE.Group();
      pivot.position.set(-0.03 + i * 0.02, -0.1, 0);
      pivot.rotation.x = 0.22 + i * 0.03;
      f.position.y = -len / 2;
      pivot.add(f);
      hand.add(pivot);
    }
    const th = new THREE.Mesh(fg, skin);
    th.scale.y = 0.065;
    const tp = new THREE.Group();
    tp.position.set(holdsChalk ? -0.045 : 0.045, -0.035, 0.01);
    tp.rotation.set(0.5, 0, holdsChalk ? -0.6 : 0.6);
    th.position.y = -0.0325;
    tp.add(th);
    hand.add(tp);
    if (holdsChalk) {
      const chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.07, 6), new THREE.MeshStandardMaterial({ color: 0xf2f0e6, emissive: 0x222222 }));
      chalk.position.set(-0.012, -0.15, 0.012);
      chalk.rotation.x = 0.3;
      hand.add(chalk);
      this.chalk = chalk;
    }
    return hand;
  }

  /** world position of a hand (wrist + a bit) */
  handPos(key, out = new THREE.Vector3()) {
    const w = this.arms[key].wrist;
    return w.localToWorld(out.set(0, -0.08, 0));
  }
  headWorld(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, 0.36, 0.12)); }
  forward(out = new THREE.Vector3()) {
    // direction the face is pointing (world)
    this.head.updateWorldMatrix(true, false);
    return out.set(0, 0, 1).transformDirection(this.head.matrixWorld);
  }

  place(x, z, facing) {
    this.pos.set(x, 0, z);
    this.facing = this.facingTarget = facing;
    this.root.rotation.y = facing;
    this.moveTarget = null;
    this.vel.set(0, 0, 0);
    for (const k in this.arms) this.arms[k].init = false;
  }

  moveTo(x, z, speed = 2.5) { this.moveTarget = new THREE.Vector3(x, 0, z); this.moveSpeed = speed; }
  get moving() { return !!this.moveTarget; }
  faceTo(yaw, speed = 6) { this.facingTarget = yaw; this.turnSpeed = speed; }
  facePoint(p, speed = 6) { this.faceTo(Math.atan2(p.x - this.pos.x, p.z - this.pos.z), speed); }
  lookAt(p, speed = 6) { this.lookTarget = p; this.lookSpeed = speed; }
  setPose(name, data = {}) { this.pose = name; this.poseData = data; }

  startClap(count, interval, onClap) {
    this.clap = { left: count, interval, phase: Math.PI, onClap, done: false };
    this.setPose('clap');
  }

  update(dt, ctx) {
    this.time += dt;
    const root = this.root;
    // ---- locomotion: pure translation, no walking (he glides) ----
    if (this.moveTarget) {
      _v.subVectors(this.moveTarget, this.pos); _v.y = 0;
      const dist = _v.length();
      if (dist < 0.02) { this.moveTarget = null; this.vel.set(0, 0, 0); }
      else {
        const sp = Math.min(this.moveSpeed, dist * 4.5);
        _v.multiplyScalar(sp / dist);
        this.vel.lerp(_v, 1 - Math.exp(-10 * dt));
        this.pos.addScaledVector(this.vel, dt);
      }
    } else this.vel.multiplyScalar(Math.exp(-12 * dt));
    this.facing = dampAngle(this.facing, this.facingTarget, this.turnSpeed, dt);
    root.rotation.y = this.facing;
    // lean slightly into motion, plus any pose lean
    const fwd = Math.sin(this.facing) * this.vel.x + Math.cos(this.facing) * this.vel.z;
    this.lean = damp(this.lean, this.leanTarget + clamp(fwd * 0.03, -0.1, 0.12), 5, dt);
    this.hips.rotation.x = this.lean;
    this.spread = damp(this.spread, this.spreadTarget, 4, dt);
    const hipH = 1.02 * Math.cos(this.spread);
    this.hips.position.y = hipH;
    for (const l of this.legs) { l.pivot.position.y = hipH; l.pivot.rotation.z = l.side * this.spread; }
    // ---- neck stretch + jaw ----
    this.stretch = damp(this.stretch, this.stretchTarget, 1.6, dt);
    this.headPivot.position.y = 0.73 + this.stretch;
    this.neck.scale.y = (0.2 + this.stretch) / 0.2;
    this.neck.position.y = 0.72 + this.stretch / 2;
    this.jaw = damp(this.jaw, this.jawTarget, this.jawTarget > this.jaw ? 18 : 6, dt);
    this.jawPivot.rotation.x = this.jaw;
    // ---- head look ----
    // aim the face at the target with a world-upright orientation, then express
    // it in the hips' frame (works even when he is folded over a desk)
    root.updateMatrixWorld(true);
    let yaw = 0, pitch = 0, rollL = 0;
    if (this.lookTarget) {
      this.headPivot.getWorldPosition(_v2);
      _v2.y += 0.43;
      if (_v2.distanceToSquared(this.lookTarget) > 1e-4) {
        _m4.lookAt(this.lookTarget, _v2, UP);
        _qa.setFromRotationMatrix(_m4);
        this.hips.getWorldQuaternion(_qp);
        _qp.invert().multiply(_qa);
        _eul.setFromQuaternion(_qp, 'YXZ');
        yaw = _eul.y; pitch = _eul.x; rollL = _eul.z;
      }
    }
    this.headYaw = dampAngle(this.headYaw, yaw, this.lookSpeed, dt);
    this.headPitch = damp(this.headPitch, clamp(pitch, -1.6, 1.2), this.lookSpeed, dt);
    this.headRoll = damp(this.headRoll, this.rollTarget + rollL, this.lookTarget ? Math.max(2.5, this.lookSpeed * 0.5) : 2.5, dt);
    // occasional twitch
    this.twitch -= dt;
    let tY = 0, tR = 0;
    if (ctx.twitchy && this.twitch < -rand(1.5, 5)) this.twitch = 0.12;
    if (this.twitch > 0) { tY = rand(-0.15, 0.15); tR = rand(-0.25, 0.25); }
    if (this.jitter > 0) { tY += rand(-1, 1) * this.jitter * 0.25; tR += rand(-1, 1) * this.jitter * 0.4; }
    this.headPivot.rotation.set(this.headPitch + (this.jitter > 0 ? rand(-0.15, 0.15) * this.jitter : 0), this.headYaw + tY, this.headRoll + tR);
    // ---- eyes glow (they catch light in the dark) ----
    this.faceMat.emissiveIntensity = this.faceGlow;
    this.eyeMat.emissiveIntensity = this.eyeGlow;
    // ---- arms ----
    root.updateMatrixWorld(true);
    this.updateArms(dt, ctx);
  }

  updateArms(dt, ctx) {
    const P = this.pose, d = this.poseData;
    const local = (x, y, z, out) => this.root.localToWorld(out.set(x, y, z));
    for (const key of ['L', 'R']) {
      const a = this.arms[key];
      const s = a.side; // +1 left (+x), -1 right
      a.aim = null;
      a.k = 7;
      // defaults: hanging arms, elbows slightly back
      local(s * 0.33, 0.76, 0.06, a.desired);
      local(s * 0.7, 1.1, -0.7, a.pole);
      if (P === 'write' && key === 'R' && d.point) {
        a.desired.copy(d.point).addScaledVector(d.normal, 0.17);
        a.aim = d.point;
        local(-0.8, 0.8, -0.3, a.pole);
        a.k = 14;
      } else if (P === 'erase' && key === 'R' && d.point) {
        a.desired.copy(d.point).addScaledVector(d.normal, 0.12);
        a.aim = d.point;
        local(-0.8, 0.9, -0.2, a.pole);
        a.k = 16;
      } else if (P === 'clap' && this.clap) {
        const sep = 0.022 + 0.13 * (1 - Math.cos(this.clap.phase)) / 2;
        local(s * sep, 1.3, 0.36, a.desired);
        local(s * 0.9, 0.9, -0.2, a.pole);
        local(-s * 0.4, 1.35, 0.5, _T);
        a.aim = _T.clone();
        a.k = 40;
      } else if (P === 'gesture' && key === 'R') {
        local(-0.22, 1.32 + Math.sin(this.time * 1.3) * 0.03, 0.42, a.desired);
        local(-0.8, 0.9, -0.2, a.pole);
      } else if (P === 'point' && key === 'R' && d.at) {
        this.arms.R.shoulder.getWorldPosition(_S);
        _dir.subVectors(d.at, _S).normalize();
        a.desired.copy(_S).addScaledVector(_dir, 0.8);
        local(-0.6, 0.6, -0.4, a.pole);
        a.aim = d.at;
      } else if (P === 'desk' && d.L && d.R) {
        a.desired.copy(key === 'L' ? d.L : d.R);
        local(s * 1.2, 2.2, -0.2, a.pole); // elbows up and out, like a spider
        local(s * 0.1, 0.0, 0.9, _T);
        a.aim = _T.clone();
        a.k = 5;
      } else if (P === 'grab') {
        local(s * 0.2, 1.62, 0.78, a.desired);
        local(s * 1.0, 1.4, -0.3, a.pole);
        local(s * 0.1, 1.7, 2.0, _T);
        a.aim = _T.clone();
        a.k = 18;
      } else if (P === 'shoulders' && d.L && d.R) {
        a.desired.copy(key === 'L' ? d.L : d.R);
        local(s * 1.0, 1.6, -0.2, a.pole);
        a.k = 6;
      }
      if (!a.init) { a.target.copy(a.desired); a.init = true; }
      a.target.lerp(a.desired, 1 - Math.exp(-a.k * dt));
      solveArm(a, a.target, a.pole, a.aim);
    }
    // clap timing
    const c = this.clap;
    if (c && P === 'clap') {
      const prev = c.phase;
      c.phase += dt * (Math.PI * 2) / c.interval;
      if (Math.floor(prev / (Math.PI * 2)) !== Math.floor(c.phase / (Math.PI * 2))) {
        c.left--;
        const mid = this.handPos('L', new THREE.Vector3()).add(this.handPos('R', new THREE.Vector3())).multiplyScalar(0.5);
        c.onClap && c.onClap(mid, c.left);
        if (c.left <= 0) { c.done = true; this.clap = null; this.setPose('rest'); }
      }
    }
  }
}
