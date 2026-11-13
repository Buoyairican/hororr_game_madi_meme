// Mr. Madi: a tall suited body (rigged GLB) with the photo head on top.
// Arms and legs are driven by two-bone IK. He really walks: feet plant and
// step, but his hips never bob, so he seems to slide across the room.
import * as THREE from 'three';
import { clamp, damp, dampAngle, rand } from './util.js';
import { buildHead } from './madi_head.js';

const UP = new THREE.Vector3(0, 1, 0);
const XAXIS = new THREE.Vector3(1, 0, 0);
const _S = new THREE.Vector3(), _E = new THREE.Vector3(), _T = new THREE.Vector3(), _dir = new THREE.Vector3();
const _pole = new THREE.Vector3(), _u = new THREE.Vector3(), _f = new THREE.Vector3(), _n = new THREE.Vector3();
const _x = new THREE.Vector3(), _y = new THREE.Vector3(), _z = new THREE.Vector3(), _w = new THREE.Vector3();
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qp = new THREE.Quaternion();
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _v3 = new THREE.Vector3();
const _eul = new THREE.Euler();

/** rotation whose local +y is dir and local +x is n (made perpendicular to dir) */
function frameQuat(dir, n, out) {
  _y.copy(dir).normalize();
  _x.copy(n).addScaledVector(_y, -n.dot(_y));
  if (_x.lengthSq() < 1e-10) { _x.set(1, 0, 0).addScaledVector(_y, -_y.x); if (_x.lengthSq() < 1e-6) _x.set(0, 0, 1); }
  _x.normalize();
  _z.crossVectors(_x, _y);
  _m4.makeBasis(_x, _y, _z);
  return out.setFromRotationMatrix(_m4);
}
function setWorldQuat(obj, q) {
  obj.parent.getWorldQuaternion(_qp);
  obj.quaternion.copy(_qp.invert().multiply(q));
}

export class Teacher {
  constructor(model, faceTex, eyesTex) {
    const root = (this.root = new THREE.Group());
    root.name = 'madi';
    root.add(model.scene);
    const B = (this.bones = model.bones);
    model.scene.updateMatrixWorld(true);
    const rest = (this.rest = {});
    for (const k in B) rest[k] = B[k].getWorldPosition(new THREE.Vector3());
    const ex = model.extras;
    const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    for (const m of Object.values(model.meshes)) m.castShadow = true;
    this.bodyMat = model.meshes.body.material;

    const limb = (a, b, c, tip, pole0, side) => {
      const d0a = rest[b].clone().sub(rest[a]).normalize();
      const d0b = rest[c].clone().sub(rest[b]).normalize();
      const n0 = new THREE.Vector3().crossVectors(d0a, d0b);
      if (n0.length() < 0.05) n0.crossVectors(pole0, d0a);
      n0.normalize();
      const d0c = tip.clone().sub(rest[c]).normalize();
      return {
        a: B[a], b: B[b], c: B[c], side, L1: rest[a].distanceTo(rest[b]), L2: rest[b].distanceTo(rest[c]),
        fa: frameQuat(d0a, n0, new THREE.Quaternion()).invert(), fb: frameQuat(d0b, n0, new THREE.Quaternion()).invert(),
        fc: frameQuat(d0c, n0, new THREE.Quaternion()).invert(),
        target: new THREE.Vector3(), desired: new THREE.Vector3(), pole: new THREE.Vector3(), aim: null, twist: 0, k: 7, init: false,
      };
    };
    this.arms = {
      L: limb('uarmL', 'farmL', 'handL', V3(ex.midL), new THREE.Vector3(0, 0, -1), 1),
      R: limb('uarmR', 'farmR', 'handR', V3(ex.midR), new THREE.Vector3(0, 0, -1), -1),
    };
    this.legs = {
      L: limb('thighL', 'shinL', 'footL', V3(ex.ankleL).add(new THREE.Vector3(0, 0, 0.2)), new THREE.Vector3(0, 0, 1), 1),
      R: limb('thighR', 'shinR', 'footR', V3(ex.ankleR).add(new THREE.Vector3(0, 0, 0.2)), new THREE.Vector3(0, 0, 1), -1),
    };
    this.palm = { L: V3(ex.midL).sub(rest.handL).multiplyScalar(0.75), R: V3(ex.midR).sub(rest.handR).multiplyScalar(0.75) };
    this.armLen = this.arms.L.L1 + this.arms.L.L2;
    this.handLen = V3(ex.tipL).distanceTo(rest.handL);
    this.hipW = Math.abs(rest.thighL.x);
    this.ankleH = rest.footL.y;
    this.shoulderY = rest.uarmL.y;
    this.chestY = rest.chest.y + 0.12;

    // ---- head, neck, chalk
    const H = (this.headParts = buildHead(faceTex, eyesTex));
    this.faceMat = H.faceMat; this.eyeMat = H.eyeMat; this.lensMat = H.lensMat; this.glasses = H.glasses;
    const headPivot = (this.headPivot = new THREE.Group());
    this.headBase = V3(ex.headBase).sub(rest.chest).add(new THREE.Vector3(0, 0.03, -0.02));
    headPivot.position.copy(this.headBase);
    headPivot.rotation.order = 'YXZ';
    B.chest.add(headPivot);
    this.head = H.head;
    headPivot.add(H.head);
    this.jawPivot = H.jawPivot;
    this.headCentre = H.eyeHeight;
    const skin = new THREE.MeshStandardMaterial({ color: 0x70492c, roughness: 0.6 });
    const neckBottom = rest.neck.y - rest.chest.y - 0.035;
    this.neckLen = this.headBase.y + 0.09 - neckBottom;
    const neck = (this.neck = new THREE.Mesh(new THREE.CylinderGeometry(0.112, 0.07, this.neckLen, 12, 1, true), skin));
    neck.scale.z = 0.9;
    neck.position.set(0, neckBottom + this.neckLen / 2, this.headBase.z + 0.005);
    this.neckBottom = neckBottom;
    neck.castShadow = true;
    B.chest.add(neck);
    const chalk = (this.chalk = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.075, 6), new THREE.MeshStandardMaterial({ color: 0xf2f0e6, emissive: 0x333333 })));
    chalk.position.copy(V3(ex.tipR)).sub(rest.handR).multiplyScalar(0.8);
    chalk.quaternion.setFromUnitVectors(UP, V3(ex.tipR).sub(rest.handR).normalize());
    B.handR.add(chalk);

    // ---- feet
    this.feet = [this.legs.L, this.legs.R].map((leg) => ({ leg, side: leg.side, pos: new THREE.Vector3(), from: new THREE.Vector3(), swing: -1, lift: 0 }));
    this.onStep = null;

    // ---- animation state
    this.pos = root.position;
    this.facing = 0;            // body yaw; 0 = facing +z (toward the class)
    this.facingTarget = 0;
    this.turnSpeed = 6;
    this.moveTarget = null;
    this.moveSpeed = 1;
    this.vel = new THREE.Vector3();
    this.lookTarget = null;
    this.lookSpeed = 6;
    this.headYaw = 0; this.headPitch = 0; this.headRoll = 0;
    this.rollTarget = 0;
    this.lean = 0; this.leanTarget = 0;
    this.crouch = 0; this.crouchTarget = 0;     // metres the hips sink
    this.stance = 0; this.stanceTarget = 0;     // extra foot spread
    this.stretch = 0; this.stretchTarget = 0;
    this.jaw = 0; this.jawTarget = 0;
    this.talk = 0;                              // 0..1 voice loudness, moves the jaw
    this.pose = 'rest'; this.poseData = {};
    this.twitch = 0; this.jitter = 0;
    this.clap = null;
    this.eyeGlow = 0.12; this.faceGlow = 0.08; this.lensGlow = 0;
    this.glassesOn = true;
    this.time = 0;
    this.place(0, 0, 0);
  }

  // ------------------------------------------------------------ queries
  /** world position of a palm */
  handPos(key, out = new THREE.Vector3()) { return this.arms[key].c.localToWorld(out.copy(this.palm[key])); }
  headWorld(out = new THREE.Vector3()) { return this.head.localToWorld(out.set(0, this.headCentre, 0.12)); }
  forward(out = new THREE.Vector3()) { this.head.updateWorldMatrix(true, false); return out.set(0, 0, 1).transformDirection(this.head.matrixWorld); }
  local(x, y, z, out) { return this.root.localToWorld(out.set(x, y, z)); }

  // ------------------------------------------------------------ commands
  place(x, z, facing) {
    this.pos.set(x, this.pos.y, z);
    this.facing = this.facingTarget = facing;
    this.root.rotation.y = facing;
    this.moveTarget = null;
    this.vel.set(0, 0, 0);
    for (const k in this.arms) this.arms[k].init = false;
    const c = Math.cos(facing), s = Math.sin(facing);
    for (const f of this.feet) {
      const w = f.side * (this.hipW + this.stance);
      f.pos.set(x + c * w, 0, z - s * w); f.swing = -1; f.lift = 0;
    }
  }
  moveTo(x, z, speed = 1) { this.moveTarget = new THREE.Vector3(x, 0, z); this.moveSpeed = speed; }
  get moving() { return !!this.moveTarget; }
  faceTo(yaw, speed = 6) { this.facingTarget = yaw; this.turnSpeed = speed; }
  facePoint(p, speed = 6) { this.faceTo(Math.atan2(p.x - this.pos.x, p.z - this.pos.z), speed); }
  lookAt(p, speed = 6) { this.lookTarget = p; this.lookSpeed = speed; }
  setPose(name, data = {}) { this.pose = name; this.poseData = data; }
  startClap(count, interval, onClap) { this.clap = { left: count, interval, phase: Math.PI, onClap }; this.setPose('clap'); }

  glassesHome(out = new THREE.Vector3()) { return this.head.localToWorld(out.copy(this.glasses.userData.home)); }
  takeGlasses() { this.glassesOn = false; this.bones.handR.attach(this.glasses); this.glassesHeld = true; }
  wearGlasses() { this.head.attach(this.glasses); this.glassesHeld = false; this.glassesOn = true; }

  // ------------------------------------------------------------ update
  update(dt, ctx = {}) {
    this.time += dt;
    const root = this.root, B = this.bones;
    // ---- locomotion
    if (this.moveTarget) {
      _v.subVectors(this.moveTarget, this.pos); _v.y = 0;
      const dist = _v.length();
      if (dist < 0.03) { this.moveTarget = null; }
      else {
        const sp = Math.min(this.moveSpeed, dist * 3.2 + 0.08);
        _v.multiplyScalar(sp / dist);
        this.vel.lerp(_v, 1 - Math.exp(-7 * dt));
        this.pos.addScaledVector(this.vel, dt);
      }
    }
    if (!this.moveTarget) this.vel.multiplyScalar(Math.exp(-10 * dt));
    this.facing = dampAngle(this.facing, this.facingTarget, this.turnSpeed, dt);
    root.rotation.y = this.facing;
    // ---- torso: lean, crouch (hips sink but never bob)
    const fwd = Math.sin(this.facing) * this.vel.x + Math.cos(this.facing) * this.vel.z;
    this.lean = damp(this.lean, this.leanTarget + clamp(fwd * 0.025, -0.06, 0.1), 5, dt);
    this.crouch = damp(this.crouch, this.crouchTarget, 4, dt);
    this.stance = damp(this.stance, this.stanceTarget, 4, dt);
    B.root.position.y = this.rest.root.y - 0.04 - this.crouch;
    B.spine.rotation.x = this.lean * 0.5;
    B.chest.rotation.x = this.lean * 0.5;
    // ---- neck + jaw
    this.stretch = damp(this.stretch, this.stretchTarget, 1.6, dt);
    this.headPivot.position.y = this.headBase.y + this.stretch;
    this.neck.scale.y = (this.neckLen + this.stretch) / this.neckLen;
    this.neck.position.y = this.neckBottom + (this.neckLen + this.stretch) / 2;
    const jt = Math.max(this.jawTarget, this.talk * 0.2);
    this.jaw = damp(this.jaw, jt, jt > this.jaw ? 22 : 10, dt);
    this.jawPivot.rotation.x = this.jaw;
    // ---- head look: aim the face at the target with a world-upright head
    root.updateMatrixWorld(true);
    let yaw = 0, pitch = 0, rollL = 0;
    if (this.lookTarget) {
      this.headPivot.getWorldPosition(_v2);
      _v2.y += this.headCentre;
      if (_v2.distanceToSquared(this.lookTarget) > 1e-4) {
        _m4.lookAt(this.lookTarget, _v2, UP);
        _q.setFromRotationMatrix(_m4);
        B.chest.getWorldQuaternion(_qp);
        _qp.invert().multiply(_q);
        _eul.setFromQuaternion(_qp, 'YXZ');
        yaw = _eul.y; pitch = _eul.x; rollL = _eul.z;
      }
    }
    this.headYaw = dampAngle(this.headYaw, yaw, this.lookSpeed, dt);
    this.headPitch = damp(this.headPitch, clamp(pitch, -1.6, 1.2), this.lookSpeed, dt);
    this.headRoll = damp(this.headRoll, this.rollTarget + rollL, this.lookTarget ? Math.max(2.5, this.lookSpeed * 0.5) : 2.5, dt);
    this.twitch -= dt;
    let tY = 0, tR = 0;
    if (ctx.twitchy && this.twitch < -rand(2, 6)) this.twitch = 0.12;
    if (this.twitch > 0) { tY = rand(-0.15, 0.15); tR = rand(-0.25, 0.25); }
    if (this.jitter > 0) { tY += rand(-1, 1) * this.jitter * 0.25; tR += rand(-1, 1) * this.jitter * 0.4; }
    this.headPivot.rotation.set(this.headPitch + (this.jitter > 0 ? rand(-0.15, 0.15) * this.jitter : 0), this.headYaw + tY, this.headRoll + tR);
    this.faceMat.emissiveIntensity = this.faceGlow;
    this.eyeMat.emissiveIntensity = this.eyeGlow;
    this.lensMat.emissiveIntensity = this.lensGlow;
    if (!this.glassesHeld) {
      this.glasses.position.lerp(this.glasses.userData.home, 1 - Math.exp(-12 * dt));
      this.glasses.quaternion.slerp(_q.identity(), 1 - Math.exp(-12 * dt));
    } else {
      this.glasses.position.lerp(_v.copy(this.chalk.position).multiplyScalar(0.7), 1 - Math.exp(-10 * dt));
    }
    root.updateMatrixWorld(true);
    this.updateFeet(dt);
    this.updateArms(dt);
  }

  // ------------------------------------------------------------ IK
  solve(l, target, pole, aim, twist) {
    l.a.parent.updateWorldMatrix(true, false);
    _S.copy(l.a.position).applyMatrix4(l.a.parent.matrixWorld);
    _dir.subVectors(target, _S);
    let d = _dir.length();
    _dir.divideScalar(d || 1);
    d = clamp(d, 0.08, l.L1 + l.L2 - 0.002);
    const a = Math.acos(clamp((l.L1 * l.L1 + d * d - l.L2 * l.L2) / (2 * l.L1 * d), -1, 1));
    _pole.subVectors(pole, _S);
    _pole.addScaledVector(_dir, -_pole.dot(_dir));
    if (_pole.lengthSq() < 1e-8) _pole.set(0, 0, -1).addScaledVector(_dir, _dir.z);
    _pole.normalize();
    _E.copy(_S).addScaledVector(_dir, Math.cos(a) * l.L1).addScaledVector(_pole, Math.sin(a) * l.L1);
    _T.copy(_S).addScaledVector(_dir, d);
    _u.subVectors(_E, _S).normalize();
    _f.subVectors(_T, _E).normalize();
    _n.crossVectors(_u, _f);
    if (_n.lengthSq() < 1e-6) _n.crossVectors(_pole, _dir);
    _n.normalize();
    const n = _v3.copy(_n);
    setWorldQuat(l.a, frameQuat(_u, n, _q).multiply(l.fa));
    setWorldQuat(l.b, frameQuat(_f, n, _q).multiply(l.fb));
    if (aim) {
      l.c.getWorldPosition(_w);
      _v2.subVectors(aim, _w).normalize();
      frameQuat(_v2, n, _q);
      if (twist) _q.premultiply(_q2.setFromAxisAngle(_v2, twist));
      setWorldQuat(l.c, _q.multiply(l.fc));
    } else l.c.quaternion.identity();
  }

  updateFeet(dt) {
    const yaw = this.facing, c = Math.cos(yaw), s = Math.sin(yaw);
    const ground = this.pos.y;
    const sp = Math.hypot(this.vel.x, this.vel.z);
    const stride = clamp(0.22 + sp * 0.2, 0.2, 0.62);
    const swingT = clamp(0.5 - sp * 0.1, 0.13, 0.5);
    let swinging = null, best = null, bestD = 0;
    for (const f of this.feet) {
      const w = f.side * (this.hipW + this.stance);
      f.hx = this.pos.x + c * w; f.hz = this.pos.z - s * w;
      if (f.swing >= 0) swinging = f;
    }
    const lead = sp > 0.05 ? stride * 0.5 / sp : 0;
    for (const f of this.feet) {
      if (f.swing >= 0) {
        f.swing += dt / swingT;
        const k = Math.min(1, f.swing);
        const e = k * k * (3 - 2 * k);
        const tx = f.hx + this.vel.x * lead, tz = f.hz + this.vel.z * lead;
        f.pos.x = f.from.x + (tx - f.from.x) * e; f.pos.z = f.from.z + (tz - f.from.z) * e;
        f.lift = Math.sin(Math.PI * k) * clamp(0.035 + sp * 0.03, 0.035, 0.12);
        if (f.swing >= 1) {
          f.swing = -1; f.lift = 0;
          if (this.onStep) this.onStep(f.pos, sp);
        }
      } else {
        const d = Math.hypot(f.pos.x - f.hx, f.pos.z - f.hz);
        if (d > bestD) { bestD = d; best = f; }
      }
    }
    const trig = sp > 0.05 ? stride * 0.5 : 0.09;
    if (best && bestD > trig && (!swinging || (sp > 1.8 && swinging.swing > 0.55))) { best.swing = 0; best.from.copy(best.pos); }
    // legs
    const spider = clamp(this.crouch / 0.35, 0, 1);
    _q2.setFromAxisAngle(UP, yaw);
    for (const f of this.feet) {
      _T.set(f.pos.x, ground + this.ankleH + f.lift, f.pos.z);
      // knees forward, splaying outward when he crouches over a desk
      this.local(f.side * (0.13 + spider * 1.4), 0.6, 1.2 - spider * 0.5, _pole);
      this.solve(f.leg, _v.copy(_T), _w.copy(_pole), null);
      // feet stay flat, toes forward, heel lifts while swinging
      _q.copy(_q2).multiply(_qp.setFromAxisAngle(XAXIS, f.lift * 3.5));
      setWorldQuat(f.leg.c, _q);
    }
  }

  updateArms(dt) {
    const P = this.pose, d = this.poseData;
    const hang = this.armLen * 0.985;
    for (const key of ['L', 'R']) {
      const a = this.arms[key];
      const s = a.side; // +1 = his left (+x)
      a.aim = null; a.twist = 0; a.k = 7;
      // default: arms hang straight down from the shoulders (even when he leans)
      a.a.parent.updateWorldMatrix(true, false);
      _S.copy(a.a.position).applyMatrix4(a.a.parent.matrixWorld);
      a.desired.copy(_S).add(_v.set(s * 0.05, -hang, 0.04).applyAxisAngle(UP, this.facing));
      this.local(s * 0.9, 1.2, -0.9, a.pole);
      if (P === 'write' && key === 'R' && d.point) {
        a.desired.copy(d.point).addScaledVector(d.normal, this.handLen * 0.86);
        a.aim = d.point; a.k = 14;
        this.local(-0.9, 0.9, -0.3, a.pole);
      } else if (P === 'erase' && key === 'R' && d.point) {
        a.desired.copy(d.point).addScaledVector(d.normal, this.handLen * 0.7);
        a.aim = d.point; a.k = 16;
        this.local(-0.9, 1.0, -0.2, a.pole);
      } else if (P === 'clap' && this.clap) {
        const sep = 0.05 + 0.16 * (1 - Math.cos(this.clap.phase)) / 2;
        this.local(s * sep, this.chestY - 0.05, 0.36, a.desired);
        this.local(s * 1.0, 0.9, -0.1, a.pole);
        a.aim = this.local(-s * 0.02, this.chestY + 0.35, 0.62, new THREE.Vector3());
        a.twist = s * 1.25;
        a.k = 40;
      } else if (P === 'gesture' && key === 'R') {
        this.local(-0.26, this.chestY - 0.02 + Math.sin(this.time * 1.3) * 0.03, 0.42, a.desired);
        this.local(-0.9, 0.9, -0.2, a.pole);
      } else if (P === 'point' && key === 'R' && d.at) {
        _dir.subVectors(d.at, _S).normalize();
        a.desired.copy(_S).addScaledVector(_dir, this.armLen * 0.97);
        a.aim = d.at;
        this.local(-0.7, 0.6, -0.4, a.pole);
      } else if (P === 'desk' && d.L && d.R) {
        a.desired.copy(key === 'L' ? d.L : d.R);
        this.local(s * 1.5, 2.2, -0.2, a.pole); // elbows up and out, like a spider
        a.aim = this.local(s * 0.1, 0.0, 1.1, new THREE.Vector3());
        a.k = 5;
      } else if (P === 'grab') {
        this.local(s * 0.24, this.shoulderY + 0.1, 0.62, a.desired);
        this.local(s * 1.0, 1.4, -0.3, a.pole);
        a.aim = this.local(s * 0.1, this.shoulderY + 0.2, 2.0, new THREE.Vector3());
        a.k = 18;
      } else if (P === 'shoulders' && d.L && d.R) {
        a.desired.copy(key === 'L' ? d.L : d.R);
        this.local(s * 1.0, 1.6, -0.2, a.pole);
        a.k = 6;
      } else if (P === 'type' && d.L && d.R) {
        a.desired.copy(key === 'L' ? d.L : d.R);
        if (d.typing) a.desired.y += Math.max(0, Math.sin(this.time * (17 + s * 3) + s)) * 0.02;
        this.local(s * 1.1, 1.3, -0.3, a.pole);
        a.aim = _v.copy(a.desired).add(_v2.set(0, -0.12, 0.2).applyAxisAngle(UP, this.facing)).clone();
        a.k = 9;
      } else if (P === 'wipe') {
        // right hand holds the glasses at his chest, left hand rubs them
        const rub = key === 'L' ? Math.sin(this.time * 9) * 0.03 : 0;
        if (d.stage === 'reach' && key === 'R') {
          if (d.target) a.desired.copy(d.target); else this.glasses.getWorldPosition(a.desired);
          a.desired.add(_v.set(-0.12, -0.1, -0.02).applyAxisAngle(UP, this.facing));
          a.k = 9;
        } else if (d.stage !== 'reach') {
          this.local(s * 0.07 + rub, this.chestY - 0.08, 0.34, a.desired);
          a.k = 9;
        }
        this.local(s * 1.0, 1.0, -0.2, a.pole);
      }
      if (!a.init) { a.target.copy(a.desired); a.init = true; }
      a.target.lerp(a.desired, 1 - Math.exp(-a.k * dt));
      this.solve(a, a.target, a.pole, a.aim, a.twist);
    }
    const c = this.clap;
    if (c && P === 'clap') {
      const prev = c.phase;
      c.phase += dt * (Math.PI * 2) / c.interval;
      if (Math.floor(prev / (Math.PI * 2)) !== Math.floor(c.phase / (Math.PI * 2))) {
        c.left--;
        const mid = this.handPos('L', new THREE.Vector3()).add(this.handPos('R', new THREE.Vector3())).multiplyScalar(0.5);
        c.onClap && c.onClap(mid, c.left);
        if (c.left <= 0) { this.clap = null; this.setPose('rest'); }
      }
    }
  }
}
