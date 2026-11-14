// Pranks you aim (mixed into Game). Hold G (PRANK on a touch screen) to aim a paper ball or a
// paper plane, let go to throw. A dotted arc shows where it goes and what it will hit.
//  - his back: he spins around to find who did it (three hits and he knows it was you)
//  - his head: his glasses fly off and he can't see until he finds them
//  - the board while he writes: the chalk screeches and he turns around
//  - a kid: "OW!", and they may throw one back at you; Sam and Nora laugh (or throw back)
// The class laughs at good pranks (the LAUGHS meter): it multiplies your mischief, but laughing
// is noise, and he hears it around whoever it is about.
// If he looks right at you while your arm is up (aiming, or just after a throw), you are caught.
// The host (or solo game) simulates every paper; friends online see them through snapshots.
import * as THREE from 'three';
import { BOARD_Z, ROWS, COLS, ROOM } from './world.js';
import { clamp, damp, rand, pick, chance } from './util.js';
import { PRANK, PRANK_NAMES } from './data.js';

const STEP = 1 / 90;        // physics step: the same for the aim arc and the real throw
const GRAV = 9.8;
const R = 0.045;            // a paper ball's radius
const MAX_FLY = 4;          // seconds before anything still in the air just drops
const REST_LIFE = 30;       // how long a paper stays on the floor
const MAX_PAPERS = 16;
const ARC_N = 70;
const BOARD_HALF_W = 2.62, BOARD_Y0 = 0.88, BOARD_Y1 = 2.42;
const TEACHER_DESK = { x: -3.15, z: -5.35, hx: 0.8, hz: 0.4, top: 0.785 };
const COLORS = { teacher: 0xff6a3d, head: 0xffd23c, person: 0xf0c27a, board: 0x9fd4ff, none: 0xe8e4da };
let PAPER_ID = 1;

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _right = new THREE.Vector3(), _fwd = new THREE.Vector3();

// ---------------------------------------------------------------- the paper itself
let GEO = null, MAT = null;
function paperParts() {
  if (GEO) return;
  // a crumpled ball: an icosphere pushed in and out (the same push for the same direction, so no cracks)
  const ball = new THREE.IcosahedronGeometry(R, 1);
  const p = ball.attributes.position;
  for (let i = 0; i < p.count; i++) {
    _a.fromBufferAttribute(p, i).normalize();
    const k = 1 + 0.2 * Math.sin(7 * _a.x + 1) * Math.sin(9 * _a.y + 2) * Math.sin(8 * _a.z + 3) + 0.08 * Math.sin(17 * _a.x * _a.z);
    _a.multiplyScalar(R * k);
    p.setXYZ(i, _a.x, _a.y, _a.z);
  }
  ball.computeVertexNormals();
  // a paper plane, nose along +z: two wings and a keel
  const nose = [0, 0, 0.13], lt = [-0.1, 0.012, -0.11], rt = [0.1, 0.012, -0.11], tail = [0, 0, -0.11], keel = [0, -0.035, -0.09];
  const plane = new THREE.BufferGeometry();
  plane.setAttribute('position', new THREE.Float32BufferAttribute([...nose, ...tail, ...lt, ...nose, ...rt, ...tail, ...nose, ...keel, ...tail], 3));
  plane.computeVertexNormals();
  GEO = { ball, plane };
  MAT = new THREE.MeshStandardMaterial({ color: 0xece6d6, roughness: 0.95, flatShading: true, side: THREE.DoubleSide });
}
/** a paper ball or plane mesh (shared geometry) */
export function makePaperMesh(kind) {
  paperParts();
  const m = new THREE.Mesh(kind === 'plane' ? GEO.plane : GEO.ball, MAT);
  m.castShadow = false;
  return m;
}

// ---------------------------------------------------------------- flight
/** one physics step for a paper in the air (used by the aim arc and the real throw alike) */
export function stepFlight(s, dt) {
  const v = s.vel;
  if (s.kind === 'plane' && !s.dead) {
    const sp = Math.hypot(v.x, v.y, v.z);
    // lift (it grows with speed squared) holds it up while it is fast; slow down and it noses over
    const lift = clamp((sp * sp) / 27, 0, 1) * 0.93;
    v.y -= GRAV * (1 - lift) * dt;
    // every plane is folded a little crooked: it curves to one side
    const h = Math.hypot(v.x, v.z) || 1, sx = -v.z / h, sz = v.x / h;
    const k = s.curve * 1.2 * clamp(sp / 6, 0, 1) * dt;
    v.x += sx * k; v.z += sz * k;
    const f = Math.exp(-0.3 * dt);
    v.x *= f; v.y *= f; v.z *= f;
  } else {
    v.y -= GRAV * dt;
    const f = Math.exp(-0.08 * dt);
    v.x *= f; v.y *= f; v.z *= f;
  }
  s.pos.x += v.x * dt; s.pos.y += v.y * dt; s.pos.z += v.z * dt;
  s.t += dt;
}

/** where a throw starts and how fast it goes: from the right hand, along the view */
export function throwStart(eye, yaw, pitch, power, kind, outPos, outVel) {
  const cp = Math.cos(pitch);
  _fwd.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
  _right.set(Math.cos(yaw), 0, -Math.sin(yaw));
  outPos.copy(eye).addScaledVector(_right, 0.16).addScaledVector(_fwd, 0.22);
  outPos.y -= 0.1;
  const sp = PRANK.speed[kind] || PRANK.speed.ball;
  outVel.copy(_fwd);
  outVel.y += kind === 'plane' ? 0.03 : 0.1;
  outVel.normalize().multiplyScalar(sp[0] + (sp[1] - sp[0]) * clamp(power, 0, 1));
}

function segDist(p, a, b) {
  _c.subVectors(b, a);
  const t = clamp(_d.subVectors(p, a).dot(_c) / (_c.lengthSq() || 1), 0, 1);
  return p.distanceTo(_c.multiplyScalar(t).add(a));
}

const STATIC_HIT = { type: '', nx: 0, ny: 0, nz: 0 };
/** the room: walls, floor, ceiling, the board, desk tops. Returns a shared object (use it right away). */
function touchRoom(s, prev) {
  const p = s.pos, H = STATIC_HIT;
  const set = (type, nx, ny, nz) => { H.type = type; H.nx = nx; H.ny = ny; H.nz = nz; return H; };
  if (p.y < R) return set('floor', 0, 1, 0);
  if (p.y > ROOM.h - R) return set('ceil', 0, -1, 0);
  if (p.x < ROOM.x0 + R) return set('wall', 1, 0, 0);
  if (p.x > ROOM.x1 - R) return set('wall', -1, 0, 0);
  if (p.z > ROOM.z1 - R) return set('wall', 0, 0, -1);
  if (p.z < BOARD_Z + 0.03 + R) return set(Math.abs(p.x) < BOARD_HALF_W && p.y > BOARD_Y0 && p.y < BOARD_Y1 ? 'board' : 'wall', 0, 0, 1);
  // desk tops (only from above)
  if (p.y < 0.79 && prev.y >= 0.7) {
    for (const z of ROWS) {
      if (Math.abs(p.z - z) > 0.24) continue;
      for (const x of COLS) if (Math.abs(p.x - x) < 0.33 && p.y - R < 0.7375 && prev.y - R >= 0.73) return set('desk', 0, 1, 0);
    }
    const t = TEACHER_DESK;
    if (Math.abs(p.x - t.x) < t.hx && Math.abs(p.z - t.z) < t.hz && p.y - R < t.top && prev.y - R >= t.top - 0.01) return set('desk', 0, 1, 0);
  }
  return null;
}

/** a person in the way: { type, who, part } (from the target list), or null */
function touchPeople(s, targets, owner) {
  for (const o of targets) {
    if (o.who === owner) continue;
    const d = o.b ? segDist(s.pos, o.c, o.b) : s.pos.distanceTo(o.c);
    if (d < o.r + R) return o;
  }
  return null;
}

/** bounce off a surface (or settle on it) */
function bounce(s, h) {
  const v = s.vel, vn = v.x * h.nx + v.y * h.ny + v.z * h.nz;
  s.pos.copy(s.prev);
  if (vn < 0) {
    // the part along the surface slows down, the part into it comes back (much weaker: it's paper)
    const tx = v.x - vn * h.nx, ty = v.y - vn * h.ny, tz = v.z - vn * h.nz;
    const e = s.kind === 'plane' ? 0.1 : 0.32, fr = s.kind === 'plane' ? 0.3 : 0.6;
    v.set(tx * fr - vn * e * h.nx, ty * fr - vn * e * h.ny, tz * fr - vn * e * h.nz);
  }
  s.dead = true; // a plane that hit something stops flying
  if (h.ny > 0.5 && Math.hypot(v.x, v.y, v.z) < 0.8) {
    s.state = 'rest';
    v.set(0, 0, 0);
    if (h.type === 'floor') s.pos.y = s.kind === 'plane' ? 0.012 : R * 0.8;
  }
}

export const PrankMixin = {
  setupPranks() {
    paperParts();
    this.papers = [];
    this.netPapers = new Map();      // online friends: papers the host told us about
    this.laugh = 0; this.laughHold = 0; this.laughAt = new THREE.Vector3(); this.laughAbout = null;
    this.misSeen = 0;
    // the paper in your hand
    this.heldPaper = new THREE.Group();
    this.heldMeshes = { ball: makePaperMesh('ball'), plane: makePaperMesh('plane') };
    this.heldMeshes.plane.rotation.set(0.25, 0, 0);
    for (const k in this.heldMeshes) this.heldPaper.add(this.heldMeshes[k]);
    this.heldPaper.visible = false;
    this.heldRaise = 0;
    this.camera.add(this.heldPaper);
    // the aim arc and where it ends
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ARC_N * 3), 3));
    // round dots (a soft disc drawn once)
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const cx = cv.getContext('2d');
    const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 15);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.9)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.arc(16, 16, 15, 0, Math.PI * 2); cx.fill();
    const dot = new THREE.CanvasTexture(cv);
    this.arcDots = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.022, map: dot, color: 0xffffff, transparent: true, opacity: 0.85, alphaTest: 0.05, depthWrite: false, fog: false }));
    this.arcDots.frustumCulled = false;
    this.arcDots.visible = false;
    this.arcDots.renderOrder = 9;
    this.scene.add(this.arcDots);
    this.arcMark = new THREE.Mesh(new THREE.RingGeometry(0.05, 0.078, 28), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false, side: THREE.DoubleSide, fog: false }));
    this.arcMark.renderOrder = 10;
    this.arcMark.visible = false;
    this.scene.add(this.arcMark);
    this.arcOut = { pts: Array.from({ length: ARC_N }, () => new THREE.Vector3()), n: 0, hit: null, at: new THREE.Vector3() };
    this.simState = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), prev: new THREE.Vector3(), kind: 'ball', curve: 0, t: 0, dead: false, state: 'fly' };
    this.aimLabel = '';
  },

  resetPranks() {
    this.clearPapers();
    this.laugh = 0; this.laughHold = 0; this.laughAbout = null;
    this.misSeen = 0; this.lastLaughSnd = -99;
    this.allowPrank = false; this.prankBusy = false; this.prankHinted = false;
    this.hidePrankVisuals();
  },

  /** every paper gone (new class, back to the menu, leaving an online class) */
  clearPapers() {
    for (const pr of this.papers || []) this.scene.remove(pr.mesh);
    this.papers = [];
    if (this.netPapers) { for (const n of this.netPapers.values()) this.scene.remove(n.mesh); this.netPapers.clear(); }
  },

  hidePrankVisuals() {
    if (this.heldPaper) { this.heldPaper.visible = false; this.heldRaise = 0; }
    if (this.arcDots) this.arcDots.visible = false;
    if (this.arcMark) this.arcMark.visible = false;
    if (this.ui && this.ui.aim) this.ui.aim(null);
    this.aimLabel = ''; this.aimShown = false;
  },

  /** can anybody throw right now? (story moments and cutscenes: no) */
  prankOpen() {
    if (this.role === 'guest') return !!(this.mp && this.mp.snap && this.mp.snap.ap) && !this.cutscene;
    return !!this.allowPrank && !this.cutscene && !this.eventLock && !this.lockBully && !this.ending;
  },

  // ---------------------------------------------------------------- your hands (any role)
  /**
   * Hold G / PRANK to aim, let go to throw. While aiming: X, the mouse wheel, R or T switch
   * ball / plane; E (or DROP on a touch screen) or pulling out the phone puts it away.
   * Returns the throw to make ({ yaw, pitch, power, kind, curve }) or null.
   */
  localPrank(dt, inp, pressed, blocked, open) {
    const me = this.me;
    if (me.foldT > 0) me.foldT -= dt;
    if (!inp.prank) me.prankLatch = false;
    const swap = pressed.swap || (me.aim && (pressed.echo || pressed.ask));
    if (swap && !inp.phone) this.swapPaper(me);
    if (me.aim && (pressed.drop || pressed.tap || inp.phone || blocked || !open)) {
      me.aim = null; me.prankLatch = inp.prank;
      return null;
    }
    if (!me.aim && inp.prank && !me.prankLatch && !blocked && open && !inp.phone) {
      me.aim = { kind: me.prankKind, curve: this.newCurve(), t: 0, power: 0.35 };
      if (!this.prankHinted) {
        this.prankHinted = true;
        this.uiTo(me, 'hint', 'Aim with the view, <b>let go to throw</b>. Hold longer to throw harder. If he sees your arm up, <b>you\'re caught</b>.', 5);
      }
    }
    const a = me.aim;
    if (!a) return null;
    if (inp.prank) {
      a.t += dt;
      if (me.foldT <= 0) a.power = clamp(a.power + dt * PRANK.charge, 0.35, 1);
      return null;
    }
    // let go: throw (if the next one is ready)
    me.aim = null;
    if (me.foldT > 0) { this.uiTo(me, 'hint', 'Still folding the next one…', 1.5); return null; }
    return { yaw: this.yaw, pitch: this.pitch, power: a.power, kind: a.kind, curve: a.curve };
  },

  newCurve() { return (chance(0.5) ? -1 : 1) * rand(0.35, 1); },

  swapPaper(p) {
    p.prankKind = p.prankKind === 'plane' ? 'ball' : 'plane';
    if (p.aim) { p.aim.kind = p.prankKind; p.aim.curve = this.newCurve(); }
    if (!p.local) return;
    this.audio.play('page', { vol: 0.35, local: true, reverb: 0 });
    if (!p.aim) this.uiTo(p, 'hint', `<b>${PRANK_NAMES[p.prankKind]}</b> ready`, 1.5);
  },

  /** the paper in your hand and the arc (drawn on your screen only) */
  updatePrankVisuals(dt) {
    const me = this.me, a = me.aim;
    const ui = this.ui;
    this.heldRaise = damp(this.heldRaise, a ? 1 : 0, a ? 12 : 18, dt);
    const hp = this.heldPaper;
    if (!a) {
      hp.visible = this.heldRaise > 0.05;
      this.arcDots.visible = this.arcMark.visible = false;
      if (this.aimShown) { this.aimShown = false; this.aimLabel = ''; ui.aim(null); }
      if (!hp.visible) return;
    }
    const kind = a ? a.kind : me.prankKind;
    const ready = me.foldT <= 0;
    this.heldMeshes.ball.visible = kind === 'ball';
    this.heldMeshes.plane.visible = kind === 'plane';
    hp.visible = true;
    const pw = a ? a.power : 0;
    hp.position.set(0.3, -0.42 + 0.2 * this.heldRaise + pw * 0.025, -0.62 + pw * 0.06);
    hp.rotation.set(kind === 'plane' ? -0.15 : this.t * 0.4, kind === 'plane' ? -0.2 : 0.3, kind === 'plane' ? -0.15 : 0);
    hp.scale.setScalar(0.75 * (ready ? 1 : clamp(1 - me.foldT / (PRANK.fold[kind] || 1), 0.15, 1)));
    if (!a) return;
    // the arc: the very same flight as the real throw
    const out = this.arcOut;
    throwStart(this.camPos, this.yaw, this.pitch, a.power, kind, _a, _b);
    this.simThrow(_a, _b, kind, kind === 'plane' ? a.curve : 0, me, this.prankTargets(), out);
    // (the first few dots, right in front of your eyes, would only be in the way)
    const arr = this.arcDots.geometry.attributes.position;
    let m = 0;
    for (let i = 0; i < out.n; i++) {
      const q = out.pts[i];
      if (m === 0 && q.distanceToSquared(this.camPos) < 0.9 * 0.9) continue;
      arr.setXYZ(m++, q.x, q.y, q.z);
    }
    arr.needsUpdate = true;
    this.arcDots.geometry.setDrawRange(0, m);
    this.arcDots.geometry.computeBoundingSphere();
    const h = out.hit;
    let col = COLORS.none, label = '';
    if (h) {
      if (h.type === 'teacher') { col = h.part === 'head' ? COLORS.head : COLORS.teacher; label = h.part === 'head' ? 'his HEAD' : h.part === 'back' ? 'his back' : 'him (he\'ll see it coming)'; }
      else if (h.type === 'kid' || h.type === 'friend' || h.type === 'player') { col = COLORS.person; label = h.who.name; }
      else if (h.type === 'board') { col = COLORS.board; label = this.boardWriting() ? 'the board (he\'s writing!)' : 'the board'; }
    }
    this.arcDots.material.color.setHex(col);
    this.arcMark.material.color.setHex(col);
    this.arcDots.visible = true;
    this.arcMark.visible = !!h;
    if (h) {
      this.arcMark.position.copy(out.at);
      if (h.nx !== undefined && h.type !== 'teacher') this.arcMark.lookAt(_c.set(out.at.x + h.nx, out.at.y + h.ny, out.at.z + h.nz));
      else this.arcMark.lookAt(this.camPos);
    }
    this.aimLabel = label ? '→ ' + label : '';
    this.aimShown = true;
    ui.aim(PRANK_NAMES[kind], a.power, ready);
  },

  boardWriting() { const B = this.world.board; return !!(B.job && B.job.type === 'write'); },

  /** what a paper can hit right now: him, the kids, the players (rebuilt every frame: people move) */
  prankTargets() {
    const list = [];
    const T = this.teacher;
    if (this.present && T.root.visible) {
      const head = T.headWorld(new THREE.Vector3());
      const base = new THREE.Vector3(T.pos.x, 0.35, T.pos.z);
      const top = head.clone().sub(base).setLength(Math.max(0.2, head.distanceTo(base) - 0.4)).add(base);
      list.push({ type: 'teacher', part: 'head', who: T, c: head, r: 0.17 });
      list.push({ type: 'teacher', part: 'body', who: T, c: base, b: top, r: 0.26 });
    }
    for (const k of this.allKids()) {
      if (k.gone) continue;
      const head = k.headWorld(new THREE.Vector3());
      const type = k.kind === 'sam' || k.kind === 'nora' ? 'friend' : 'kid';
      list.push({ type, who: k, c: head, r: 0.13 });
      list.push({ type, who: k, c: head.clone().add(_c.set(0, -0.34, 0)), r: 0.17 });
    }
    for (const p of this.players) {
      const head = this.headOf(p, new THREE.Vector3());
      list.push({ type: 'player', who: p, c: head, r: 0.15 });
      list.push({ type: 'player', who: p, c: head.clone().add(_c.set(0, -0.36, 0)), r: 0.17 });
    }
    return list;
  },

  /** fly a throw without making it real: the arc points and the first thing it hits */
  simThrow(start, vel, kind, curve, owner, targets, out) {
    const s = this.simState;
    s.pos.copy(start); s.vel.copy(vel); s.kind = kind; s.curve = curve; s.t = 0; s.dead = false; s.state = 'fly';
    out.n = 0; out.hit = null;
    let k = 0;
    while (s.t < 3) {
      s.prev.copy(s.pos);
      stepFlight(s, STEP);
      if (k++ % 2 === 0 && out.n < ARC_N) out.pts[out.n++].copy(s.pos);
      let h = touchPeople(s, targets, owner);
      if (h) h = this.hitInfo(h, s);
      else {
        const r = touchRoom(s, s.prev);
        if (r) h = { type: r.type, nx: r.nx, ny: r.ny, nz: r.nz };
      }
      if (h) { out.hit = h; out.at.copy(s.pos); if (out.n < ARC_N) out.pts[out.n++].copy(s.pos); return out; }
    }
    return out;
  },

  /** which part of him it hit: his head, his back (he didn't see it), or his front */
  hitInfo(o, s) {
    if (o.type !== 'teacher') return { type: o.type, who: o.who };
    if (o.part === 'head') return { type: 'teacher', who: o.who, part: 'head' };
    const yaw = this.teacher.root.rotation.y;
    const h = Math.hypot(s.vel.x, s.vel.z) || 1;
    const along = (Math.sin(yaw) * s.vel.x + Math.cos(yaw) * s.vel.z) / h;
    return { type: 'teacher', who: o.who, part: along > 0.2 ? 'back' : 'front' };
  },

  // ---------------------------------------------------------------- throwing (host / solo)
  /** a player throws (you, or a friend online: their message is checked here) */
  throwFrom(p, req) {
    if (!p || !req || this.state !== 'playing' || !this.prankOpen()) return false;
    if (p.local ? p.foldT > 0 : p.foldT > 0.35) return false; // still folding (a little slack for the network)
    const yaw = Number(req.yaw), pitch = Number(req.pitch), power = Number(req.power);
    if (![yaw, pitch, power].every(Number.isFinite)) return false;
    const kind = req.kind === 'plane' ? 'plane' : 'ball';
    const curve = kind === 'plane' ? clamp(Number(req.curve) || 0, -1, 1) : 0;
    const eye = p.local ? this.camPos : new THREE.Vector3(p.eye.x - Math.sin(yaw) * 0.07, p.eye.y, p.eye.z + (1 - Math.cos(yaw)) * 0.05);
    const pos = new THREE.Vector3(), vel = new THREE.Vector3();
    throwStart(eye, clamp(yaw, -3.2, 3.2), clamp(pitch, -1.2, 1.2), clamp(power, 0.2, 1), kind, pos, vel);
    this.spawnPaper(p, null, kind, pos, vel, curve);
    p.foldT = PRANK.fold[kind]; p.exposeT = PRANK.exposeAfter; p.lastThrow = this.t; p.crumpleT = 0.6;
    this.note(p, 'throws'); this.track.event(this.t, p, 'throw', { kind });
    this.mischief += PRANK.mischief.throw;
    this.idleT = 0;
    this.audio.play('prank_swish', { pos, vol: 0.55, ref: 1, reverb: 0.05 });
    // and you start making the next one (paper is not quiet)
    this.timers.after(0.25, () => {
      if (this.state === 'playing') this.audio.play(kind === 'plane' ? 'prank_fold' : 'prank_crumple', { pos: this.headOf(p, new THREE.Vector3()).add(_c.set(0, -0.35, -0.1)), vol: 0.45, ref: 0.8, reverb: 0.05 });
    });
    return true;
  },

  spawnPaper(owner, npc, kind, pos, vel, curve) {
    if (this.papers.length >= MAX_PAPERS) {
      const old = this.papers.find((x) => x.state === 'rest') || this.papers[0];
      this.removePaper(old);
    }
    const pr = { id: PAPER_ID++, kind, owner, npc, pos: pos.clone(), vel: vel.clone(), prev: pos.clone(), curve, t: 0, acc: 0,
      state: 'fly', dead: false, hitDone: false, restT: 0, mesh: makePaperMesh(kind),
      spin: new THREE.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)), board: false };
    pr.mesh.position.copy(pos);
    this.scene.add(pr.mesh);
    this.papers.push(pr);
    return pr;
  },
  removePaper(pr) {
    if (!pr) return;
    this.scene.remove(pr.mesh);
    this.papers = this.papers.filter((x) => x !== pr);
  },

  /** every frame on the host / solo: papers fly, hit things, the class laughs (and calms down) */
  updatePranks(dt) {
    for (const p of this.players) {
      if (!p.local && p.foldT > 0) p.foldT -= dt;
      if (p.exposeT > 0) p.exposeT -= dt;
      if (p.prankStreak > 0 && this.t - p.lastPrankHit > PRANK.streakReset) p.prankStreak = 0;
    }
    if (this.laughHold > 0) this.laughHold -= dt;
    else this.laugh = Math.max(0, this.laugh - PRANK.laughDecay * dt);
    if (!this.papers.length) return;
    const targets = this.prankTargets();
    for (const pr of [...this.papers]) {
      if (pr.state === 'fly') {
        pr.acc = Math.min(pr.acc + dt, 0.25);
        while (pr.acc >= STEP && pr.state === 'fly') {
          pr.acc -= STEP;
          pr.prev.copy(pr.pos);
          stepFlight(pr, STEP);
          if (!pr.hitDone) {
            // a kid's throw only looks for players; yours can hit anyone but you
            const who = touchPeople(pr, pr.npc ? targets.filter((o) => o.type === 'player') : targets, pr.owner || pr.npc);
            if (who) { this.paperHitsPerson(pr, this.hitInfo(who, pr)); continue; }
          }
          const r = touchRoom(pr, pr.prev);
          if (r) this.paperHitsRoom(pr, r);
          if (pr.t > MAX_FLY && pr.state === 'fly') { pr.state = 'rest'; pr.vel.set(0, 0, 0); }
        }
      } else if ((pr.restT += dt) > REST_LIFE) { this.removePaper(pr); continue; }
      this.posePaper(pr, pr.pos, pr.vel, pr.state === 'fly', dt);
    }
  },

  posePaper(pr, pos, vel, flying, dt) {
    const m = pr.mesh;
    m.position.copy(pos);
    if (pr.kind === 'plane') {
      if (flying && vel.lengthSq() > 0.05) {
        m.lookAt(_c.copy(pos).add(vel));
        m.rotateZ((pr.curve || 0) * 0.55);
        pr.yaw = Math.atan2(vel.x, vel.z);
      } else if (!flying) m.rotation.set(0, pr.yaw || 0, 0.2);
    } else if (flying) {
      m.rotation.x += pr.spin.x * dt; m.rotation.y += pr.spin.y * dt; m.rotation.z += pr.spin.z * dt;
    }
  },

  paperHitsRoom(pr, h) {
    const sp = pr.vel.length();
    const type = h.type;
    bounce(pr, h);
    if (type === 'board' && !pr.board && pr.owner) {
      pr.board = true;
      this.audio.play('prank_board', { pos: pr.pos.clone(), vol: clamp(sp / 8, 0.4, 1), ref: 2, reverb: 0.2 });
      this.hitBoard(pr.owner, pr.pos.clone());
    } else if (sp > 1.2) this.audio.play('prank_tick', { pos: pr.pos.clone(), vol: clamp(sp / 10, 0.15, 0.6), ref: 1.2, reverb: 0.1, rate: rand(0.9, 1.15) });
  },

  paperHitsPerson(pr, h) {
    pr.hitDone = true;
    pr.dead = true;
    pr.pos.copy(pr.prev);
    pr.vel.multiplyScalar(-0.15); pr.vel.y = Math.min(pr.vel.y, 0) - 0.6;
    const at = pr.pos.clone();
    this.audio.play('prank_hit', { pos: at, vol: 0.95, ref: 1.6, reverb: 0.1 });
    const by = pr.owner;
    if (pr.npc) { if (h.type === 'player') this.bonk(h.who, pr.npc.name, at, pr.npc); return; }
    if (!by) return;
    if (h.type === 'teacher') this.hitTeacher(by, h.part, at);
    else if (h.type === 'kid') this.hitKid(by, h.who, at);
    else if (h.type === 'friend') this.hitFriend(by, h.who, at);
    else if (h.type === 'player') {
      this.note(by, 'hits'); this.track.event(this.t, by, 'hit', { target: 'player', who: h.who.id });
      this.mischief += PRANK.mischief.player;
      this.bonk(h.who, by.name, at, null);
    }
  },

  // ---------------------------------------------------------------- what a hit does
  /** where he thinks it came from: roughly the thrower's corner of the room */
  guessOrigin(p) { return new THREE.Vector3(p.eye.x + rand(-1.3, 1.3), 1.1, p.eye.z + rand(-0.6, 0.6)); },

  /** he can be interrupted for this (not in a story moment, not already busy with something) */
  canReactPrank() {
    return this.present && !this.cutscene && !this.ending && !this.eventLock && !this.lockBully && !this.memeBusy && !this.choice && !this.echoBusy && !this.searching && !this.prankBusy;
  },

  hitTeacher(p, part, at) {
    this.note(p, 'hits'); this.note(p, 'hitHim');
    this.track.event(this.t, p, 'hit', { target: 'teacher', part });
    this.completeObjective('prank');
    this.mischief += PRANK.mischief[part];
    this.addLaugh(PRANK.laugh[part], at, p);
    if (p.local && part !== 'front') {
      const f = pick(this.friends.filter((x) => !x.gone && !x.call));
      if (f) this.timers.after(1.3, () => { if (this.state === 'playing' && !this.cutscene && !this.watching) this.friendSay(f, f.kind === 'sam' ? 's_hit' : 'n_hit', 0.2); });
    }
    this.teacherHit(p, part);
  },

  /** the teacher was hit (or the board right next to his chalk): he reacts, or he knows */
  teacherHit(p, part) {
    if (!this.present || this.cutscene || this.ending) return;
    if (this.t - p.lastPrankHit > PRANK.streakReset) p.prankStreak = 0;
    p.prankStreak++; p.lastPrankHit = this.t;
    p.heat += 12;
    const n = p.prankStreak;
    if (this.canReactPrank()) this.interrupt(this.reactPrank(p, part, this.guessOrigin(p), n));
    else if (n >= 3 && !this.eventLock && !this.lockBully && !this.choice) this.bust('prank', p);
    else this.anger = Math.min(92, this.anger + PRANK.anger.busy);
  },

  hitBoard(p, at) {
    const writing = this.boardWriting() && this.present;
    this.world.chalkBurst(at, writing ? 34 : 14, 0.45);
    this.note(p, 'hits'); this.track.event(this.t, p, 'hit', { target: 'board', writing });
    if (writing) {
      this.mischief += PRANK.mischief.boardWriting;
      this.addLaugh(PRANK.laugh.boardWriting, at, p);
      this.audio.play('chalk_screech', { pos: this.writePose.point.clone(), vol: 0.9, ref: 2, reverb: 0.3 });
      this.completeObjective('prank');
      this.teacherHit(p, 'board');
    } else {
      this.mischief += PRANK.mischief.board;
      this.addLaugh(PRANK.laugh.board, at, p);
      if (this.present) { this.anger = Math.min(92, this.anger + PRANK.anger.thud); if (this.brainIdle && this.canReactPrank()) this.interrupt(this.reactThud(at)); }
    }
  },

  hitKid(p, kid, at) {
    this.note(p, 'hits'); this.track.event(this.t, p, 'hit', { target: 'kid', who: kid.name });
    if (kid.hollow) {
      // he took this one: no sound, the head just turns. Slowly. To you.
      kid.lookTarget = p.camPos; kid.speed = 1.2;
      this.timers.after(5, () => { if (kid.lookTarget === p.camPos) { kid.lookTarget = null; kid.speed = 4; } });
      return;
    }
    this.mischief += PRANK.mischief.kid;
    this.addLaugh(PRANK.laugh.kid, at, p);
    kid.tremble = 0.6; kid.speed = 7;
    // they look where it came from... and maybe they work out it was you
    const guess = this.guessOrigin(p);
    kid.lookTarget = guess;
    this.sayAt(kid, this.kidVoice(kid, 'k_ow'), 0, 1.0);
    const figured = chance(0.65);
    this.timers.after(0.9, () => { if (kid.lookTarget === guess) kid.lookTarget = figured ? p.camPos : null; kid.tremble = 0; });
    this.timers.after(3.2, () => { if (kid.lookTarget === p.camPos || kid.lookTarget === guess) { kid.lookTarget = null; kid.speed = 4; } });
    if (this.present) {
      this.anger = Math.min(92, this.anger + PRANK.anger.ow);
      if (this.brainIdle && this.canReactPrank()) this.interrupt(this.reactThud(kid.headWorld(new THREE.Vector3())));
    }
    if (figured && chance(PRANK.throwBack.kid)) this.timers.after(rand(1.4, 2.6), () => this.npcThrow(kid, p));
  },

  hitFriend(p, f, at) {
    this.note(p, 'hits'); this.track.event(this.t, p, 'hit', { target: 'friend', who: f.name });
    this.mischief += PRANK.mischief.friend;
    this.addLaugh(PRANK.laugh.friend, at, p);
    if (!f.call) {
      f.lookTarget = p.camPos;
      this.timers.after(2.5, () => { if (f.lookTarget === p.camPos && !f.call && !this.anyTalkWith(f)) f.lookTarget = null; });
    }
    this.friendSay(f, f.kind === 'sam' ? 's_ow' : 'n_ow', 0.3);
    this.timers.after(1.6, () => { if (this.state === 'playing' && !this.cutscene) this.friendSay(f, f.kind === 'sam' ? 's_laugh' : 'n_laugh', 0.2); });
    if (chance(PRANK.throwBack.friend)) this.timers.after(rand(2.4, 3.4), () => this.npcThrow(f, p));
  },

  /** a paper hit a player (yours bounced off a friend online, or a kid threw one back) */
  bonk(target, from, at, npc) {
    if (!target || !this.players.includes(target)) return;
    target.bonkT = 0.6;
    this.addLaugh(npc ? PRANK.laugh.npc : PRANK.laugh.player, at, target);
    if (target.local) this.localBonk(from);
    else if (this.mp) this.mp.toPlayer(target, { t: 'bonk', from });
  },
  /** you got hit: your view jolts, "bop" */
  localBonk(from) {
    this.shake = Math.max(this.shake, 0.32);
    this.audio.play('bonk', { vol: 0.9, local: true, reverb: 0.05 });
    (this.ui.hint.local || this.ui.hint).call(this.ui, `<b>${from}</b> got you with a paper ball!`, 2.5);
  },

  /** a kid (or Sam / Nora) throws one back at a player */
  npcThrow(kid, target) {
    if (this.state !== 'playing' || this.cutscene || this.ending || kid.gone || kid.hollow || !this.players.includes(target)) return;
    const start = kid.headWorld(new THREE.Vector3()); start.y -= 0.1;
    const aim = this.headOf(target, new THREE.Vector3());
    if (chance(0.35)) aim.add(_c.set(rand(-0.6, 0.6), rand(-0.3, 0.15), rand(-0.2, 0.2))); // they miss sometimes
    start.addScaledVector(_c.subVectors(aim, start).normalize(), 0.22);
    const dist = aim.distanceTo(start);
    const T = clamp(dist / 7, 0.4, 1.0);
    const vel = new THREE.Vector3().subVectors(aim, start).divideScalar(T).multiplyScalar(1.03);
    vel.y += 0.5 * GRAV * T;
    kid.lookTarget = aim.clone(); kid.speed = 8;
    kid.leanFwdTarget = -0.12;
    this.timers.after(0.25, () => { kid.leanFwdTarget = 0.15; });
    this.timers.after(0.7, () => { kid.leanFwdTarget = 0; });
    this.timers.after(1.6, () => { if (kid.lookTarget && !kid.call) { kid.lookTarget = null; kid.speed = 4; } });
    this.timers.after(0.25, () => {
      if (this.state !== 'playing' || this.cutscene) return;
      this.spawnPaper(null, kid, 'ball', start, vel, 0);
      this.audio.play('prank_swish', { pos: start, vol: 0.5, ref: 1, reverb: 0.05 });
      if (kid.kind === 'kid') this.sayAt(kid, this.kidVoice(kid, 'k_takethat'), 0, 0.9);
      this.track.event(this.t, target, 'throwBack', { who: kid.name });
      // did he see that?
      const T2 = this.teacher;
      if (this.present && T2.root.visible && !this.blind && this.canReactPrank()) {
        const head = T2.headWorld(new THREE.Vector3());
        if (T2.forward(_d).dot(_a.subVectors(kid.headWorld(_b), head).normalize()) > 0.8) this.interrupt(this.reactSawKid(kid));
      }
    });
  },

  // ---------------------------------------------------------------- the laugh meter
  /** the class laughs (at a prank, at whoever got hit): louder for bigger pranks */
  addLaugh(n, at, about) {
    if (!n) return;
    this.laugh = Math.min(100, this.laugh + n);
    this.laughHold = PRANK.laughHold;
    if (at) this.laughAt.copy(at);
    this.laughAbout = about || null;
    if (this.laugh > (this.track.global.peakLaugh || 0)) this.track.global.peakLaugh = Math.round(this.laugh);
    const where = new THREE.Vector3(this.laughAt.x * 0.4, 1.1, clamp(this.laughAt.z, -2, 3));
    if (n >= 18 && this.t - this.lastLaughSnd > 2.2) {
      this.lastLaughSnd = this.t;
      this.audio.play('class_laugh', { pos: where, vol: 0.45 + 0.4 * this.laugh / 100, ref: 3, reverb: 0.25 });
    } else this.audio.play('giggle', { pos: where, vol: 0.6, ref: 3, reverb: 0.2 });
    const look = about ? this.headOf(about, new THREE.Vector3()) : this.laughAt.clone();
    for (const k of this.allKids()) {
      if (k.gone || k.hollow || k.call || this.anyTalkWith(k) || !chance(0.35 + n / 160)) continue;
      k.talking = rand(1, 2.2);
      if (k.lookTarget) continue;
      k.lookTarget = look;
      this.timers.after(rand(1.6, 3), () => { if (k.lookTarget === look) k.lookTarget = null; });
    }
  },

  /** laughing near you is noise he hears (and the class is laughing at you) */
  laughNoise(p) {
    if (this.laugh < 15) return 0;
    const k = clamp((this.laugh - 15) / 60, 0, 1) * PRANK.laughNoise;
    if (p === this.laughAbout) return k;
    const dx = p.eye.x - this.laughAt.x, dz = p.eye.z - this.laughAt.z;
    return dx * dx + dz * dz < PRANK.laughNear * PRANK.laughNear ? k : 0;
  },

  /** good pranks multiply the mischief everything else gives you (up to x2) */
  laughBonus() {
    const d = this.mischief - this.misSeen;
    if (d > 0 && this.laugh > 1) this.mischief += d * this.laugh / 100;
    this.misSeen = this.mischief;
  },

  // ---------------------------------------------------------------- his reactions
  /** hit: he freezes... spins around toward where it came from, and looks for whoever did it */
  *reactPrank(p, part, origin, n) {
    const T = this.teacher;
    const home = new THREE.Vector3(T.pos.x, 0, T.pos.z), homeFace = T.facing;
    let moved = false;
    this.prankBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      if (part === 'head') yield* this.glassesFlyOff();
      else yield* this.wait(part === 'board' ? 0.35 : 0.45);
      if (n >= 3) { yield* this.bustedSeq('prank', p); return; }
      T.lookAt(origin, 9);
      T.facePoint(origin, 7);
      yield* this.wait(0.7);
      yield* this.say('t_whothrew', 0.2);
      // a slow look over that corner of the class (an arm still up: caught)
      for (const dx of [-1.1, 1.1, 0]) { T.lookAt(origin.clone().add(_a.set(dx, 0, 0)), 3); yield* this.wait(0.65); }
      if (this.laugh > 45) yield* this.say('t_funny', 0.4);
      this.anger = Math.min(85, this.anger + (n >= 2 ? PRANK.anger.again : PRANK.anger.first) + (part === 'front' ? PRANK.anger.front : 0));
      if (n >= 2) { moved = true; this.searching = true; yield* this.searchRows(2, p); }
      T.lookAt(null, 3);
      T.leanTarget = 0; T.crouchTarget = 0;
      if (moved) { yield* this.walk(home.x, home.z); T.faceTo(homeFace, 3); }
      yield* this.wait(0.4);
    } finally {
      this.prankBusy = false; this.searching = false;
      T.leanTarget = 0; T.crouchTarget = 0;
      if (T.glasses.parent !== T.head && !T.glassesHeld && !this.ending) { T.wearGlasses(); this.blind = false; }
    }
  },

  /** a paper ball right on the head: his glasses fly off and he can't see until he finds them */
  *glassesFlyOff() {
    const T = this.teacher, g = T.glasses, A = this.audio;
    this.scene.attach(g);
    T.glassesHeld = false; T.glassesOn = false;
    this.blind = true;
    this.ui.hint('His glasses flew off. <b>He can\'t see!</b>', 3);
    const from = g.position.clone();
    const yaw = T.root.rotation.y;
    const land = new THREE.Vector3(clamp(T.pos.x + Math.sin(yaw) * 0.55 + rand(-0.2, 0.2), ROOM.x0 + 0.3, ROOM.x1 - 0.3), 0.02,
      clamp(T.pos.z + Math.cos(yaw) * 0.55 + rand(-0.2, 0.2), BOARD_Z + 0.3, ROOM.z1 - 0.3));
    let t = 0;
    while (t < 0.55) {
      t += this.dt;
      const k = Math.min(1, t / 0.55);
      g.position.lerpVectors(from, land, k);
      g.position.y += Math.sin(k * Math.PI) * 0.3;
      g.rotation.x += this.dt * 9; g.rotation.z += this.dt * 6;
      yield;
    }
    g.position.copy(land);
    g.rotation.set(-Math.PI / 2, rand(0, Math.PI * 2), 0);
    A.play('prank_tick', { pos: land, vol: 0.7, ref: 1.5 });
    yield* this.say('t_myglasses', 0.2);
    // he bends down and feels around the floor for them
    T.lookAt(land, 2);
    T.crouchTarget = 0.35; T.leanTarget = 0.9;
    T.setPose('desk', { L: land.clone().add(_a.set(0.18, 0.4, 0)), R: land.clone().add(_a.set(-0.12, 0.4, 0.05)) });
    yield* this.wait(1.7);
    T.wearGlasses();
    T.setPose('rest');
    T.crouchTarget = 0; T.leanTarget = 0;
    this.blind = false;
    yield* this.wait(0.5);
  },

  /** something thudded (a paper on the board, a kid saying ow): a look, nothing more */
  *reactThud(at) {
    const T = this.teacher;
    T.clap = null;
    T.lookAt(at.clone(), 5);
    yield* this.wait(0.9);
    T.lookAt(this.cp, 3);
    yield* this.wait(rand(0.9, 1.4));
    if (chance(0.35)) yield* this.say('t_hmm', 0.2);
    T.lookAt(null, 3);
  },

  /** he saw a kid throw one: that kid is in trouble, not you */
  *reactSawKid(kid) {
    const T = this.teacher;
    this.prankBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      T.lookAt(kid.headWorld(new THREE.Vector3()), 6);
      T.facePoint(kid.root.position, 3);
      yield* this.wait(0.6);
      T.setPose('point', { at: kid.headWorld(new THREE.Vector3()) });
      yield* this.say('t_isaw', 0.3);
      T.setPose('rest');
      kid.lookTarget = null; kid.forcePitch = 0.45; kid.tremble = 0.5;
      this.track.event(this.t, null, 'kidCaught', { who: kid.name });
      yield* this.wait(1.4);
      kid.tremble = 0;
      this.timers.after(8, () => { if (kid.forcePitch === 0.45) kid.forcePitch = null; });
      T.lookAt(null, 3);
    } finally { this.prankBusy = false; }
  },

  /** Sam's dare in period 2: a paper ball at his back */
  *prankDare(f) {
    const touch = this.input.touch;
    this.allowPrank = true;
    yield* this.whisper(f, 's_throw');
    this.addObjective({ id: 'prank', text: touch ? 'Hit his back with a paper ball (hold PRANK)' : 'Hit his back with a paper ball  [hold G]' });
    this.ui.hint(touch ? 'Hold <b>PRANK</b> to aim a paper ball, let go to throw. Wait until his back is turned.' : 'Hold <b>G</b> to aim a paper ball, let go to throw. Wait until his back is turned.', 7);
    yield* this.until(() => this.objDone('prank'), 60);
    if (this.objDone('prank')) { yield* this.until(() => this.ready(), 20); yield* this.whisper(f, 's_didit'); }
  },

  // ---------------------------------------------------------------- online
  /** host: the papers in the air (and on the floor) for the snapshot */
  paperSnap() {
    const r2 = (x) => Math.round(x * 100) / 100;
    return this.papers.map((pr) => [pr.id, pr.kind === 'plane' ? 1 : 0, r2(pr.pos.x), r2(pr.pos.y), r2(pr.pos.z),
      r2(pr.vel.x), r2(pr.vel.y), r2(pr.vel.z), pr.state === 'fly' ? 1 : 0, r2(pr.curve || 0)]);
  },

  /** friend online: papers from the host's snapshot */
  syncPapers(rows) {
    const seen = new Set();
    for (const row of rows || []) {
      if (!Array.isArray(row) || row.length < 10) continue;
      const [id, k, x, y, z, vx, vy, vz, fly, cv] = row;
      seen.add(id);
      let n = this.netPapers.get(id);
      if (!n) {
        const kind = k === 1 ? 'plane' : 'ball';
        n = { kind, mesh: makePaperMesh(kind), base: new THREE.Vector3(x, y, z), vel: new THREE.Vector3(), pos: new THREE.Vector3(x, y, z), age: 0, fly: true, curve: 0,
          spin: new THREE.Vector3(rand(-14, 14), rand(-14, 14), rand(-14, 14)) };
        n.mesh.position.set(x, y, z);
        this.scene.add(n.mesh);
        this.netPapers.set(id, n);
      }
      n.base.set(x, y, z); n.vel.set(vx, vy, vz); n.fly = !!fly; n.curve = cv; n.age = 0;
    }
    for (const [id, n] of this.netPapers) if (!seen.has(id)) { this.scene.remove(n.mesh); this.netPapers.delete(id); }
  },

  /** friend online: move the papers smoothly between snapshots */
  tickNetPapers(dt) {
    for (const n of this.netPapers.values()) {
      n.age = Math.min(n.age + dt, 0.15);
      _a.copy(n.base);
      if (n.fly) { _a.addScaledVector(n.vel, n.age); _a.y -= 0.5 * GRAV * n.age * n.age * (n.kind === 'plane' ? 0.3 : 1); }
      n.pos.x = damp(n.pos.x, _a.x, 22, dt); n.pos.y = damp(n.pos.y, _a.y, 22, dt); n.pos.z = damp(n.pos.z, _a.z, 22, dt);
      this.posePaper(n, n.pos, n.vel, n.fly, dt);
    }
  },
};
