// Seated classmates: the two friends next to the player and the silent,
// faceless students behind (who sometimes look up at you).
import * as THREE from 'three';
import { faceTexture, fabricTexture } from './textures.js';
import { damp, dampAngle, clamp, rand } from './util.js';

const _v = new THREE.Vector3();
const limb = new THREE.CylinderGeometry(1, 0.85, 1, 10);

function seg(parent, a, b, r, mat) {
  // cylinder from point a to b (parent-local)
  const m = new THREE.Mesh(limb, mat);
  const d = _v.subVectors(b, a);
  const len = d.length();
  m.scale.set(r, len, r);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize());
  m.castShadow = true;
  parent.add(m);
  return m;
}

export class Classmate {
  /** kind: 'sam' | 'nora' | 'blank' */
  constructor(kind, seat) {
    this.kind = kind;
    this.name = kind === 'sam' ? 'Sam' : kind === 'nora' ? 'Nora' : 'student';
    const root = (this.root = new THREE.Group());
    root.position.set(seat.x, 0, seat.z);
    root.rotation.y = Math.PI; // face the board (-z)
    const clothCol = { sam: '#5a1e1c', nora: '#1d3f42', blank: '#2a2c2e' }[kind];
    const cloth = new THREE.MeshStandardMaterial({ map: fabricTexture(clothCol), roughness: 0.95 });
    const skinCol = { sam: 0xb88a64, nora: 0xd2a07c, blank: 0xa9a69d }[kind];
    const skin = new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.7 });
    const pants = new THREE.MeshStandardMaterial({ color: 0x1b1d24, roughness: 0.9 });
    const hairMat = new THREE.MeshStandardMaterial({ color: kind === 'nora' ? 0x1a0f08 : 0x24170c, roughness: 0.8 });

    // body pivots at the hips so the torso can lean
    const body = (this.body = new THREE.Group());
    body.position.y = 0.48;
    root.add(body);
    const torsoGeo = new THREE.CylinderGeometry(0.17, 0.15, 0.48, 14);
    torsoGeo.scale(1, 1, 0.62);
    const torso = new THREE.Mesh(torsoGeo, cloth);
    torso.position.y = 0.24; torso.castShadow = true;
    body.add(torso);
    for (const sx of [-0.15, 0.15]) {
      const sh = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), cloth);
      sh.position.set(sx, 0.45, 0); body.add(sh);
    }
    if (kind === 'sam') { // hood
      const hood = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), cloth);
      hood.position.set(0, 0.44, -0.08); hood.rotation.x = -0.6; body.add(hood);
    }
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.1, 8), skin);
    neck.position.y = 0.52; body.add(neck);
    // head
    const headPivot = (this.headPivot = new THREE.Group());
    headPivot.position.y = 0.56;
    headPivot.rotation.order = 'YXZ';
    body.add(headPivot);
    const headMat = new THREE.MeshStandardMaterial({ map: faceTexture(kind), roughness: 0.65 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 22, 16), headMat);
    head.scale.set(0.92, 1.08, 1);
    head.position.y = 0.11; head.castShadow = true;
    headPivot.add(head);
    this.headMesh = head;
    if (kind !== 'blank') {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hairMat);
      cap.position.set(0, 0.13, -0.012); cap.rotation.x = -0.25; cap.scale.set(0.95, 1.05, 1.05);
      headPivot.add(cap);
      if (kind === 'nora') {
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.06), hairMat);
        back.position.set(0, 0.03, -0.085); headPivot.add(back);
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.015, 0.22, 8), hairMat);
        tail.position.set(0, 0.02, -0.13); tail.rotation.x = 0.4; headPivot.add(tail);
      }
    } else {
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
      cap.position.set(0, 0.125, -0.01); cap.rotation.x = -0.35; headPivot.add(cap);
    }
    // arms resting on the desk (fixed pose)
    const A = (x, y, z) => new THREE.Vector3(x, y, z);
    for (const s of [-1, 1]) {
      const shoulder = A(s * 0.17, 0.43, 0.02), elbow = A(s * 0.2, 0.28, 0.3), hand = A(s * 0.07, 0.3, 0.5);
      seg(body, shoulder, elbow, 0.045, cloth);
      seg(body, elbow, hand, 0.038, cloth);
      const h = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skin);
      h.position.copy(hand); h.scale.set(1, 0.6, 1.3); body.add(h);
    }
    // legs (mostly hidden under the desk)
    for (const s of [-1, 1]) {
      seg(root, A(s * 0.09, 0.47, 0), A(s * 0.1, 0.47, 0.42), 0.06, pants);
      seg(root, A(s * 0.1, 0.47, 0.42), A(s * 0.1, 0.05, 0.46), 0.05, pants);
    }

    // animation state
    this.lookTarget = null;
    this.yaw = 0; this.pitch = kind === 'blank' ? 0.55 : 0.1; this.roll = 0;
    this.basePitch = this.pitch;
    this.speed = 4;
    this.leanRoll = 0; this.leanRollTarget = 0;
    this.leanFwd = 0.08; this.leanFwdTarget = 0.08;
    this.tremble = 0;
    this.talking = 0;
    this.t = rand(0, 10);
    this.idleTimer = rand(2, 6);
    this.idleYaw = 0;
    this.gone = false;
    this.forcePitch = null;
  }

  update(dt) {
    this.t += dt;
    let yaw = this.idleYaw, pitch = this.basePitch;
    if (this.lookTarget) {
      _v.copy(this.lookTarget);
      this.root.worldToLocal(_v);
      _v.y -= 0.48 + 0.56 + 0.12;
      yaw = Math.atan2(_v.x, _v.z);
      pitch = Math.atan2(-_v.y, Math.hypot(_v.x, _v.z));
    } else if (this.kind !== 'blank') {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) { this.idleTimer = rand(2.5, 7); this.idleYaw = rand() < 0.6 ? 0 : rand(-0.5, 0.5); }
    }
    if (this.forcePitch !== null) pitch = this.forcePitch;
    this.yaw = dampAngle(this.yaw, clamp(yaw, -1.9, 1.9), this.speed, dt);
    this.pitch = damp(this.pitch, clamp(pitch, -0.6, 0.9), this.speed, dt);
    const bob = this.talking > 0 ? Math.sin(this.t * 9) * 0.03 : 0;
    const tr = this.tremble > 0 ? (Math.random() - 0.5) * 0.04 * this.tremble : 0;
    this.headPivot.rotation.set(this.pitch + bob + tr, this.yaw + tr, this.roll);
    this.leanRoll = damp(this.leanRoll, this.leanRollTarget, 3, dt);
    this.leanFwd = damp(this.leanFwd, this.leanFwdTarget, 3, dt);
    const breathe = this.kind === 'blank' ? 0 : Math.sin(this.t * 1.7) * 0.008;
    this.body.rotation.set(-this.leanFwd + breathe, 0, this.leanRoll + tr * 0.3);
  }

  /** world point between the shoulders (teacher grabs here) */
  shoulderPoints(outL, outR) {
    this.root.updateMatrixWorld(true);
    this.body.localToWorld(outL.set(0.17, 0.47, -0.02));
    this.body.localToWorld(outR.set(-0.17, 0.47, -0.02));
  }

  headWorld(out = new THREE.Vector3()) { return this.headPivot.localToWorld(out.set(0, 0.11, 0)); }

  setGone(g) { this.gone = g; this.root.visible = !g; }
}
