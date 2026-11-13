// Seated classmates built from rigged GLB models: the two friends next to you
// and the rest of the class. They blink, breathe, look around and whisper.
import * as THREE from 'three';
import { damp, dampAngle, clamp, rand } from './util.js';

const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();
export const SEAT_Y = 0.4675;

export class Classmate {
  /** kind: 'sam' | 'nora' | 'kid'; model from instantiate() */
  constructor(kind, name, model, seat) {
    this.kind = kind;
    this.name = name;
    this.model = model;
    const root = (this.root = new THREE.Group());
    root.position.set(seat.x, SEAT_Y, seat.z + 0.03);
    root.rotation.y = Math.PI; // face the board (-z)
    root.add(model.scene);
    this.seat = seat;
    this.b = model.bones;
    this.eyesMat = model.meshes.eyes.material;
    this.bodyMat = model.meshes.body.material;
    this.slump = model.extras.pose === 'slump';
    model.scene.updateMatrixWorld(true);
    this.headLocal = this.b.head.getWorldPosition(new THREE.Vector3());
    this.headLocal.y += 0.07;

    this.lookTarget = null;      // world point, or null to idle
    this.attend = null;          // world point the class is watching (the teacher); used while idle
    this.yaw = 0; this.pitch = 0; this.roll = 0;
    this.speed = 4;
    this.leanRoll = 0; this.leanRollTarget = 0;
    this.leanFwd = 0; this.leanFwdTarget = 0;
    this.tremble = 0;
    this.talking = 0;
    this.forcePitch = null;
    this.t = rand(0, 10);
    this.idleTimer = rand(1, 6);
    this.idleYaw = 0; this.idlePitch = 0; this.idleAttend = Math.random() < 0.6;
    this.blinkT = rand(1, 5); this.blink = 0;
    this.hollow = false;
    this.gone = false;
    this.jaw = 0;
  }

  setGone(g) { this.gone = g; this.root.visible = !g; }

  /** black, unblinking eyes: he has taken this one */
  setHollow(h) {
    this.hollow = h;
    this.eyesMat.color.setScalar(h ? 0.0 : 1.0);
    this.eyesMat.emissiveIntensity = 0;
  }

  headWorld(out = new THREE.Vector3()) { return this.root.localToWorld(out.copy(this.headLocal)); }

  shoulderPoints(outL, outR) {
    this.root.updateMatrixWorld(true);
    this.root.localToWorld(outL.copy(this.headLocal).add(_v.set(0.17, -0.2, -0.04)));
    this.root.localToWorld(outR.copy(this.headLocal).add(_v.set(-0.17, -0.2, -0.04)));
  }

  update(dt) {
    if (this.gone) return;
    this.t += dt;
    const b = this.b;
    // ---- where to look
    let yaw = this.idleYaw, pitch = this.idlePitch;
    let target = this.lookTarget;
    if (!target) {
      this.idleTimer -= dt;
      if (this.idleTimer <= 0) {
        this.idleTimer = rand(2.5, 8);
        this.idleAttend = Math.random() < (this.slump ? 0.35 : 0.7);
        this.idleYaw = rand(-0.35, 0.35); this.idlePitch = this.slump ? rand(0, 0.15) : rand(-0.05, 0.25);
      }
      if (this.idleAttend && this.attend && !this.hollow) target = this.attend;
    }
    if (target) {
      _v.copy(target);
      this.root.worldToLocal(_v);
      _v.sub(this.headLocal);
      yaw = Math.atan2(_v.x, _v.z);
      pitch = Math.atan2(-_v.y, Math.hypot(_v.x, _v.z)) - (this.slump ? 0.35 : 0);
    }
    if (this.forcePitch !== null) { pitch = this.forcePitch; yaw *= 0.2; }
    const sp = this.lookTarget ? this.speed : Math.min(this.speed, 2.2);
    this.yaw = dampAngle(this.yaw, clamp(yaw, -2.0, 2.0), sp, dt);
    this.pitch = damp(this.pitch, clamp(pitch, -0.7, 0.8), sp, dt);
    const tr = this.tremble > 0 ? (Math.random() - 0.5) * 0.035 * this.tremble : 0;
    const bob = this.talking > 0 ? Math.sin(this.t * 7) * 0.025 : 0;
    // spread the turn over spine, neck and head like a real neck does
    const big = Math.max(0, Math.abs(this.yaw) - 0.9) * Math.sign(this.yaw);
    this.leanRoll = damp(this.leanRoll, this.leanRollTarget, 3, dt);
    this.leanFwd = damp(this.leanFwd, this.leanFwdTarget, 3, dt);
    const breathe = this.hollow ? 0 : Math.sin(this.t * 1.6) * 0.006;
    b.spine.rotation.set(this.leanFwd + breathe, big * 0.45, this.leanRoll + tr * 0.3);
    b.neck.rotation.set(this.pitch * 0.4 + tr, (this.yaw - big * 0.45) * 0.42, this.roll * 0.5);
    b.head.rotation.set(this.pitch * 0.6 + bob, (this.yaw - big * 0.45) * 0.58 + tr, this.roll * 0.5);
    // ---- face
    if (this.talking > 0) {
      this.talking -= dt;
      this.jaw = damp(this.jaw, 0.035 + 0.075 * Math.abs(Math.sin(this.t * 10.5) * Math.sin(this.t * 3.1 + 1)), 30, dt);
    } else this.jaw = damp(this.jaw, 0, 14, dt);
    b.jaw.rotation.x = this.jaw;
    if (!this.hollow) {
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blinkT = rand(1.8, 6); this.blink = 0.16; }
    }
    let lid = this.tremble > 0 ? -0.08 : 0; // scared: eyes wide
    if (this.blink > 0) { this.blink -= dt; lid = Math.sin(Math.PI * clamp(this.blink / 0.16, 0, 1)) * 0.62; }
    if (this.slump && !this.lookTarget && !this.hollow) lid = Math.max(lid, 0.2);
    b.lidL.rotation.x = b.lidR.rotation.x = lid;
    // eyes lead the head a little
    const ey = clamp((yaw - this.yaw) * 0.6, -0.4, 0.4), ep = clamp((pitch - this.pitch) * 0.6, -0.25, 0.25);
    b.eyeL.rotation.set(ep, ey, 0); b.eyeR.rotation.set(ep, ey, 0);
  }
}
