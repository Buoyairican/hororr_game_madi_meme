// Phase 3 (mixed into Game): "Who did it?", the KICK ME note on his back, the laser pointer.
//  - "Who did it?": after a second hit on his back, the note he finds on his back, or a laser in his
//    eyes, he comes to your desk and asks. Point at a kid (it works unless he is sure it was you, and
//    the kid remembers), say nothing (he watches you), or confess (he forgives you once).
//  - KICK ME: pick the note (X), hold G while he walks past your desk with his back to you, let go to
//    stick it on. Every time he turns his back on the class, they laugh. In the end a kid tells him.
//  - The laser pointer: pick it (X), hold G: a red dot where you look. When he sees the dot in front of
//    him he chases it like a cat and paws at it. Too long, or the dot in his eyes, and he follows the
//    beam back to you: if it is still on when he looks at you, you are caught (like an arm up).
// The host (or solo game) runs all of it; friends online see the dots and the note in the snapshots.
import * as THREE from 'three';
import { ROOM, BOARD_Z, ROWS, COLS } from './world.js';
import { clamp, rand, pick, chance } from './util.js';
import { BLAME, NOTE, LASER, PRANK } from './data.js';

const V = THREE.Vector3;
const _a = new V(), _b = new V(), _c = new V(), _d = new V();
const _head = new V(), _fwd = new V(); // (updateBlame: laserRay uses the scratch vectors above)
const BOARD_HALF_W = 2.62, BOARD_Y0 = 0.88, BOARD_Y1 = 2.42;            // (as in src/pranks.js)
const DESK_TOP = 0.7375, TEACHER_DESK = { x: -3.15, z: -5.35, hx: 0.8, hz: 0.4, top: 0.785 };
const FRONT_Z = -3.0;                                                    // the walkway in front of the rows (src/game.js)
const TOOLS = ['ball', 'plane', 'laser', 'note'];
const MAX_DOTS = 4;
/** what a player holds up, as a number for the network (and back) */
export const toolCode = (k) => Math.max(0, TOOLS.indexOf(k));
export const toolName = (c) => TOOLS[c | 0] || 'ball';

// ---------------------------------------------------------------- what the beam hits
/** distance along a ray (d: unit length) to a sphere, or -1 (a ray starting inside it: -1) */
function raySphere(o, d, c, r) {
  const ox = o.x - c.x, oy = o.y - c.y, oz = o.z - c.z;
  const b = ox * d.x + oy * d.y + oz * d.z, cc = ox * ox + oy * oy + oz * oz - r * r;
  if (cc < 0) return -1;
  const h = b * b - cc;
  if (h < 0) return -1;
  const t = -b - Math.sqrt(h);
  return t > 0 ? t : -1;
}
function hitObj() { return { t: 1e9, pt: new V(), n: new V(), type: '', who: null, part: null }; }

// ---------------------------------------------------------------- the things themselves
function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 31);
  g.addColorStop(0, 'rgba(255,225,220,1)'); g.addColorStop(0.18, 'rgba(255,60,50,1)'); g.addColorStop(0.38, 'rgba(255,20,20,0.9)');
  g.addColorStop(0.68, 'rgba(255,0,0,0.38)'); g.addColorStop(1, 'rgba(255,0,0,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
let NOTE_TEX = null;
function noteTexture() {
  if (NOTE_TEX) return NOTE_TEX;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 180;
  const x = c.getContext('2d');
  x.fillStyle = '#f4efe2'; x.fillRect(0, 0, 256, 180);
  x.strokeStyle = 'rgba(80,120,190,.35)'; x.lineWidth = 2;
  for (let y = 40; y < 180; y += 26) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
  x.fillStyle = 'rgba(235,225,170,.85)'; x.fillRect(18, -6, 56, 26); x.fillRect(182, -6, 56, 26); // tape
  x.fillStyle = '#16171a'; x.font = 'bold 74px "Caveat", "Comic Sans MS", cursive'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.save(); x.translate(128, 96); x.rotate(-0.06); x.fillText('KICK ME', 0, 0); x.restore();
  x.strokeStyle = '#b3261e'; x.lineWidth = 5; x.beginPath(); x.moveTo(60, 150); x.quadraticCurveTo(128, 168, 200, 146); x.stroke();
  NOTE_TEX = new THREE.CanvasTexture(c);
  NOTE_TEX.colorSpace = THREE.SRGBColorSpace;
  return NOTE_TEX;
}
/** the note (k: size) */
export function makeNoteMesh(k = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(0.21 * k, 0.148 * k), new THREE.MeshStandardMaterial({ map: noteTexture(), roughness: 0.95, side: THREE.DoubleSide }));
  return m;
}
/** a laser pointer in your hand: a dark pen with a red tip (pointing along -z) */
function makePointer() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.0075, 0.0085, 0.12, 12), new THREE.MeshStandardMaterial({ color: 0x3a3f47, roughness: 0.3, metalness: 0.7 }));
  body.rotation.x = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.0065, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3030, fog: false }));
  tip.position.z = -0.061;
  const btn = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.004, 0.016), new THREE.MeshStandardMaterial({ color: 0xc02020, roughness: 0.5 }));
  btn.position.set(0, 0.009, -0.015);
  g.add(body, tip, btn);
  g.userData.tip = tip;
  return g;
}

export const BlameMixin = {
  setupBlame() {
    // the red dots (yours and your friends'), drawn where they land
    const tex = dotTexture();
    this.laserDots = [];
    for (let i = 0; i < MAX_DOTS; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0xffffff, transparent: true, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending }));
      s.visible = false; s.renderOrder = 11;
      this.scene.add(s);
      this.laserDots.push(s);
    }
    // what you can hold up besides paper (src/pranks.js shows the one you picked)
    this.heldMeshes.laser = makePointer();
    this.heldMeshes.note = makeNoteMesh(0.55);
    this.heldPaper.add(this.heldMeshes.laser, this.heldMeshes.note);
    // the note on his back, and the one in his hand when he reads it
    this.backNote = makeNoteMesh(1.3);
    this.backNote.visible = false;
    this.scene.add(this.backNote);
    this.handNote = this.teacher.holdInHand(makeNoteMesh(0.8));
    this.netDots = [];
  },

  resetBlame() {
    this.allowLaser = false; this.allowNote = false; this.allowBlame = false;
    this.kickNote = null; this.cat = null; this.catCool = 0; this.blameBusy = false;
    this.lastOnHim = -99; this.toolHinted = {}; this.lzSeen = false;
    this.netKick = false; this.netHandNote = false; this.netDots = []; this.netCat = null;
    for (const k of this.allKids ? this.allKids() : []) k.grudge = null;
    this.hideBlameVisuals();
  },

  hideBlameVisuals() {
    for (const s of this.laserDots || []) s.visible = false;
    if (this.backNote) this.backNote.visible = false;
    if (this.handNote) this.handNote.visible = false;
  },

  /** what you can hold up: paper (ball, plane), and the laser pointer and the note once you have them */
  toolKinds(p = this.me) {
    const l = ['ball', 'plane'];
    if (this.role === 'guest') {
      const b = (this.mp && this.mp.snap && this.mp.snap.tl) | 0;
      if (b & 1) l.push('laser');
      if (b & 2 && (p.notesLeft | 0) > 0) l.push('note');
      return l;
    }
    if (this.allowLaser) l.push('laser');
    if (this.allowNote && p.notesLeft > 0) l.push('note');
    return l;
  },

  /** give the laser and the note (and with them, "Who did it?") */
  giveTools() {
    this.allowLaser = true; this.allowNote = true; this.allowBlame = true;
  },

  // ---------------------------------------------------------------- the beam (any role)
  /** where a beam from o along d (unit) lands: the room, a desk, the board, him, a kid, a friend */
  laserRay(o, d, owner, out = hitObj()) {
    out.t = LASER.range; out.type = ''; out.who = null; out.part = null;
    const room = (t, type, nx, ny, nz) => { if (t > 1e-4 && t < out.t) { out.t = t; out.type = type; out.n.set(nx, ny, nz); out.who = null; out.part = null; } };
    if (d.y < 0) room(-o.y / d.y, 'floor', 0, 1, 0);
    if (d.y > 0) room((ROOM.h - o.y) / d.y, 'ceiling', 0, -1, 0);
    if (d.x < 0) room((ROOM.x0 - o.x) / d.x, 'wall', 1, 0, 0);
    if (d.x > 0) room((ROOM.x1 - o.x) / d.x, 'wall', -1, 0, 0);
    if (d.z > 0) room((ROOM.z1 - o.z) / d.z, 'wall', 0, 0, -1);
    if (d.z < 0) {
      const t = (BOARD_Z + 0.03 - o.z) / d.z, x = o.x + d.x * t, y = o.y + d.y * t;
      room(t, Math.abs(x) < BOARD_HALF_W && y > BOARD_Y0 && y < BOARD_Y1 ? 'board' : 'wall', 0, 0, 1);
    }
    // desk tops, seen from above
    if (d.y < 0 && o.y > DESK_TOP) {
      const t = (DESK_TOP - o.y) / d.y;
      if (t < out.t) {
        const x = o.x + d.x * t, z = o.z + d.z * t;
        for (const rz of ROWS) if (Math.abs(z - rz) < 0.24) for (const cx of COLS) if (Math.abs(x - cx) < 0.33) room(t, 'desk', 0, 1, 0);
      }
      const T = TEACHER_DESK, t2 = (T.top - o.y) / d.y;
      if (t2 < out.t && Math.abs(o.x + d.x * t2 - T.x) < T.hx && Math.abs(o.z + d.z * t2 - T.z) < T.hz) room(t2, 'desk', 0, 1, 0);
    }
    // people: him (his face or the rest of him), the kids, Sam and Nora, the other players
    const person = (c, r, type, who, part) => {
      const t = raySphere(o, d, c, r);
      if (t > 0 && t < out.t) { out.t = t; out.type = type; out.who = who; out.part = part; out.n.copy(d).negate(); }
    };
    const T = this.teacher;
    if (this.present && T.root.visible && !this.away) {
      const head = T.headWorld(_a);
      const t = raySphere(o, d, head, 0.15);
      if (t > 0 && t < out.t) {
        // his face (he is looking back down the beam) or the back / side of his head
        const face = T.forward(_b).dot(_c.copy(d).negate()) > 0.35;
        out.t = t; out.type = 'teacher'; out.who = T; out.part = face ? 'face' : 'head'; out.n.copy(d).negate();
      }
      _b.set(T.pos.x, 0, T.pos.z);
      for (const y of [0.55, 0.95, 1.3]) person(_c.set(_b.x, y, _b.z), 0.24, 'teacher', T, 'body');
    }
    for (const k of this.allKids()) {
      if (k.gone) continue;
      const type = k.kind === 'sam' || k.kind === 'nora' ? 'friend' : 'kid';
      const h = k.headWorld(_c);
      person(h, 0.13, type, k, 'head');
      person(_c.add(_d.set(0, -0.34, 0)), 0.17, type, k, 'body');
    }
    for (const q of this.players) {
      if (q === owner) continue;
      const h = this.headOf(q, _c);
      person(h, 0.15, 'player', q, 'head');
      person(_c.add(_d.set(0, -0.36, 0)), 0.17, 'player', q, 'body');
    }
    out.pt.copy(d).multiplyScalar(out.t).add(o);
    if (!out.type) out.type = 'none';
    return out;
  },

  /** the nearest place he can stand next to (x, z) (src/game.js walkSpot), and how far that is from the dot */
  catSpot(h, out) { return this.walkSpot(h.pt.x, h.pt.z, out); },

  // ---------------------------------------------------------------- every frame on the host / solo
  updateBlame(dt) {
    const T = this.teacher;
    const canSee = this.present && T.root.visible && this.world.master > 0.3 && this.blackout < 0.5 && !this.blind && !this.typing && !this.dozing && !this.dancing;
    const head = T.headWorld(_head), fwd = T.forward(_fwd);
    for (const p of this.players) {
      // the laser: on while you hold G with the pointer picked
      const on = this.state === 'playing' && !this.cutscene && p.aiming && p.tool === 'laser';
      if (on !== !!p.laserOn) {
        p.laserOn = on;
        if (p.local) this.audio.play('bl_click', { vol: 0.55, local: true, reverb: 0 });
        if (on) { p.laserT = 0; p.eyesT = 0; }
      }
      if (!on) { p.laserHit = null; continue; }
      const h = p.laserHit = this.laserRay(p.camPos, p.camFwd, p, p.laserBuf || (p.laserBuf = hitObj()));
      if (!this.toolHinted.lzNear && (h.type === 'teacher' || h.pt.distanceTo(head) < 0.7)) {
        this.toolHinted.lzNear = true;
        this.friendQuip('nora', 'n_bl_eyes', 0.2); // "Not in his eyes! He'll find you."
      }
      // in his eyes: "My eyes." and he looks right down the beam
      if (h.type === 'teacher' && h.part === 'face' && canSee) {
        p.eyesT += dt;
        if (p.eyesT > LASER.eyes) { p.eyesT = 0; this.laserInEyes(p); }
        continue;
      }
      p.eyesT = 0;
      // on his back, his belly, the back of his head: the class giggles (he doesn't notice)
      if (h.type === 'teacher') {
        if (this.t - this.lastOnHim > LASER.onHim.gap && !this.cutscene) {
          this.lastOnHim = this.t;
          this.addLaugh(LASER.onHim.laugh, h.pt, null); // (they laugh at him: the noise is around him, not you)
          this.mischief += LASER.onHim.mischief;
          this.audio.play('giggle', { pos: new V(rand(-2, 2), 1.1, rand(-1, 2)), vol: 0.55, ref: 3, reverb: 0.2 });
        }
        continue;
      }
      // he sees the dot in front of him
      if (!this.cat && this.t > this.catCool && canSee && this.allowLaser && this.canReactPrank() && h.type !== 'none' && h.type !== 'ceiling') {
        _c.subVectors(h.pt, head);
        const dist = _c.length();
        if (dist < LASER.seeDist && fwd.dot(_c.divideScalar(dist || 1)) > LASER.cone) {
          p.laserT += dt;
          if (p.laserT > LASER.notice) { p.laserT = 0; this.interrupt(this.catChase(p)); }
        } else p.laserT = Math.max(0, p.laserT - dt);
      }
    }
    // chasing the dot: mischief while it lasts
    const cat = this.cat;
    if (cat && cat.phase === 'chase' && this.players.includes(cat.p)) {
      this.mischief += LASER.chaseMischief * dt;
      this.note(cat.p, 'chase', dt);
    }
    this.updateNote(dt);
    this.updateGrudges(dt);
    // "I am watching you": a sound from you and he looks right at you
    for (const p of this.players) {
      if (!(p.watchedT > 0)) continue;
      p.watchedT -= dt;
      if (((p.selfNoise || 0) >= 0.6 || p.aiming) && this.t - p.lastGlare > BLAME.watchGlareGap && this.present && !this.cutscene && !this.dozing && !this.blind && !this.choice) {
        p.lastGlare = this.t;
        this.fx.push(this.glareWarn(p.camPos));
      }
    }
  },

  /** the dot went into his eyes */
  laserInEyes(p) {
    if (this.cutscene || this.ending || this.eventLock || this.lockBully || this.choice) return;
    if (this.canReactPrank() || (this.cat && this.cat.phase === 'chase')) { this.interrupt(this.reactEyes(p)); return; }
    // busy (an event, one of his habits): he glares down the beam and goes on
    if (this.t - (p.lastEyes || -99) < 3) return;
    p.lastEyes = this.t;
    this.angerUp(LASER.anger.eyes / 2, 90);
    this.fx.push(this.glareWarn(p.camPos, 't_lz_eyes'));
  },

  // ---------------------------------------------------------------- the cat and the red dot
  *catChase(p) {
    const T = this.teacher;
    const home = new V(T.pos.x, 0, T.pos.z), homeFace = T.facing;
    const cat = this.cat = { p, t0: this.t, paws: 0, phase: 'chase' };
    const look = new V(), spot = new V();
    let moved = false, ended = false;
    try {
      T.clap = null; T.setPose('rest');
      if (p.laserHit) look.copy(p.laserHit.pt);
      T.lookAt(look, 10);
      yield* this.wait(0.35);
      yield* this.say(this.lzSeen ? 't_lz_dot' : 't_lz_what', 0.1); // "What is that?" / "The red dot."
      this.lzSeen = true;
      this.firstHint('laser', 'He saw the red dot... <b>and he chases it.</b> Keep it moving. Not in his eyes!', 5);
      this.friendQuip('sam', 's_bl_cat', 2.5); // "He's chasing it. Like a cat."
      let said = false, lost = 0;
      while (this.t - cat.t0 < LASER.chaseMax && cat.paws < LASER.pawsMax) {
        const h = p.laserOn && this.players.includes(p) ? p.laserHit : null;
        if (!h || h.type === 'teacher' || h.type === 'none' || h.type === 'ceiling') {
          lost += this.dt;
          T.moveTarget = null;
          if (lost > LASER.lostAfter) {
            if (yield* this.lostDot(p)) { lost = 0; continue; }
            ended = true;
            break;
          }
          yield;
          continue;
        }
        lost = 0;
        look.copy(h.pt);
        T.lookAt(look, 10);
        this.catSpot(h, spot);
        const flat = Math.hypot(h.pt.x - T.pos.x, h.pt.z - T.pos.z);
        const reach = LASER.paw + (h.type === 'desk' ? 0.4 : 0);
        const there = Math.hypot(spot.x - T.pos.x, spot.z - T.pos.z) <= 0.25; // (as close as the aisle lets him get)
        if (h.pt.y < 2.3 && (flat < reach || (there && flat < 1.3))) {
          yield* this.pawAt(look.clone(), p);
          cat.paws++;
        } else if (h.pt.y < 2.3 && !there) {
          moved = true;
          const goal = spot.clone(), t0 = this.t;
          // trot after it; look again when it moves away, or every second
          yield* this.walkUntil(goal.x, goal.z, 1.8, () => {
            const q = p.laserOn ? p.laserHit : null;
            if (!q || q.type === 'teacher' || q.type === 'none') return true;
            T.lookAt(look.copy(q.pt), 10);
            return this.t - t0 > 1.0 || q.pt.distanceTo(_c.set(goal.x, q.pt.y, goal.z)) > 1.2 || Math.hypot(q.pt.x - T.pos.x, q.pt.z - T.pos.z) < LASER.paw;
          });
        } else {
          T.facePoint(h.pt, 5);
          yield;
        }
        if (!said && this.t - cat.t0 > 3.5) { said = true; this.teacherSay('t_lz_come'); } // "Come here."
      }
      if (!ended) {
        // he gets it: it's a trick. He follows the beam back.
        cat.phase = 'trick';
        T.moveTarget = null; T.setPose('rest'); T.crouchTarget = 0; T.leanTarget = 0;
        this.teacherSay('t_lz_trick'); // "A trick."
        this.angerUp(LASER.anger.trick, 88);
        if (this.players.includes(p)) yield* this.followBeam(p, 'laser');
      }
    } finally {
      if (this.cat === cat) this.cat = null;
      this.catCool = this.t + LASER.cooldown;
      T.setPose('rest'); T.crouchTarget = 0; T.leanTarget = 0;
    }
    if (moved) { T.lookAt(null, 3); yield* this.walk(home.x, home.z); T.faceTo(homeFace, 3); }
  },

  /** walk somewhere, but stop as soon as stop() says so. Returns true when he got there. */
  *walkUntil(x, z, speed, stop) {
    const w = this.walk(x, z, speed);
    try {
      for (;;) {
        if (stop()) { this.teacher.moveTarget = null; return false; }
        if (w.next().done) return true;
        yield;
      }
    } finally { w.return(); }
  },

  /** he paws at the dot (an open hand down on it; crouching for the floor) */
  *pawAt(pt, p) {
    const T = this.teacher;
    T.moveTarget = null;
    T.facePoint(pt, 8); T.lookAt(pt, 12);
    const low = pt.y < 0.55;
    if (low) { T.crouchTarget = 0.35; T.leanTarget = 0.9; }
    T.setPose('swat', { at: pt.clone(), down: false });
    yield* this.wait(0.28);
    T.setPose('swat', { at: pt.clone(), down: true });
    yield* this.wait(0.1);
    this.audio.play('bl_paw', { pos: pt, vol: 0.9, ref: 1.6, reverb: 0.15 });
    if (this.players.includes(p)) {
      this.addLaugh(LASER.laugh, pt, null); // (the class laughs where the dot is)
      this.mischief += LASER.pawMischief;
      this.note(p, 'paws'); this.track.event(this.t, p, 'paw');
    }
    this.completeObjective('laser');
    yield* this.wait(0.35);
    T.setPose('rest');
    if (low) { T.crouchTarget = 0; T.leanTarget = 0; }
  },

  /** the dot is gone: he looks around for it. Returns true if it came back. */
  *lostDot(p) {
    const T = this.teacher;
    T.moveTarget = null; T.setPose('rest'); T.crouchTarget = 0; T.leanTarget = 0;
    this.teacherSay('t_lz_gone'); // "Where did it go?"
    for (const dx of [-1.6, 1.6, 0]) {
      T.lookAt(T.local(dx, 0.9, 1.6, new V()), 4);
      for (let t = 0; t < 0.9; t += this.dt) {
        const h = p.laserOn && this.players.includes(p) ? p.laserHit : null;
        if (h && h.type !== 'teacher' && h.type !== 'none' && h.type !== 'ceiling') return true;
        yield;
      }
    }
    T.lookAt(null, 3);
    return false;
  },

  /** the dot in his eyes */
  *reactEyes(p) {
    const T = this.teacher;
    this.blameBusy = true;
    try {
      T.clap = null; T.setPose('rest'); T.moveTarget = null;
      // he flinches away from it (his head down to one side)
      T.lookAt(T.local(0.5, 0.4, 1.2, new V()), 14);
      this.angerUp(LASER.anger.eyes, 90);
      yield* this.wait(0.6);
      this.teacherSay('t_lz_eyes'); // "My eyes."
      this.track.event(this.t, p, 'laserEyes');
      yield* this.followBeam(p, 'laser');
    } finally { this.blameBusy = false; }
  },

  /** he looks straight down the beam at whoever holds it. Still on when he sees you: caught (the arm-up rule). */
  *followBeam(p, about) {
    const T = this.teacher;
    T.lookAt(p.camPos, 12); T.facePoint(p.camPos, 7);
    yield* this.wait(LASER.findHold);
    // it was off in time: he knows roughly where it came from
    if (!this.players.includes(p)) return;
    if (this.allowBlame) yield* this.askWhoDidIt(p, about);
    else yield* this.say('t_ifind', 0.3);
  },

  // ---------------------------------------------------------------- KICK ME
  /** can this player reach his back right now? (he walks past your desk, his back to you) */
  noteReach(p, slack = 0) {
    const T = this.teacher;
    if (!this.present || !T.root.visible || this.away || this.cutscene) return false;
    if (this.role === 'guest' ? this.netKick : this.kickNote) return false;
    const dx = p.camPos.x - T.pos.x, dz = p.camPos.z - T.pos.z, d = Math.hypot(dx, dz);
    if (d > NOTE.reach + slack || d < 0.2) return false;
    const yaw = T.root.rotation.y; // where his body faces (his head may look elsewhere: the arm-up rule still holds)
    return (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / d < NOTE.behind + slack * 0.5;
  },

  /** stick the note on his back (you, or a friend online: their press is checked here) */
  stickNote(p) {
    if (!p || this.state !== 'playing' || !this.allowNote || !this.prankOpen()) return false;
    if (p.notesLeft <= 0) { this.uiTo(p, 'hint', 'No more notes.', 2); return false; }
    if (this.kickNote) { this.uiTo(p, 'hint', 'He already has one on his back.', 2.2); return false; }
    if (!this.noteReach(p, p.local ? 0 : 0.3)) {
      this.uiTo(p, 'hint', 'Too far. <b>Wait until he walks past your desk</b> with his back to you.', 3);
      return false;
    }
    const T = this.teacher;
    p.notesLeft--;
    p.exposeT = PRANK.exposeAfter; p.exposeKind = 'kickme'; // (your hand was out: he could still see it)
    this.kickNote = { owner: p, t: this.t, laughs: 0, back: false, lastLaugh: -99, foundAt: this.t + rand(NOTE.foundAfter[0], NOTE.foundAfter[1]), finding: false };
    this.audio.play('bl_stick', { pos: T.local(0, T.chestY, -0.2, new V()), vol: 0.45, ref: 0.7, reverb: 0.05 });
    this.mischief += NOTE.stickMischief;
    this.note(p, 'kickme'); this.track.event(this.t, p, 'kickme');
    this.completeObjective('kickme');
    this.idleT = 0;
    this.firstHint('kickme', '<b>KICK ME</b> is on his back. Every time he turns his back on the class, they laugh.', 5);
    const f = pick(this.friends.filter((x) => !x.gone));
    if (f) this.friendQuip(f.kind, f.kind === 'sam' ? 's_bl_note' : 'n_bl_note', 2);
    if (p.local && p.prankKind === 'note' && p.notesLeft <= 0) p.prankKind = 'ball';
    return true;
  },

  updateNote() {
    const k = this.kickNote;
    if (!k) return;
    const T = this.teacher;
    // his back to the class: he faces the board (or walks to the front)
    const back = this.present && T.root.visible && !this.away && Math.cos(T.root.rotation.y) < -0.5;
    if (back && !k.back && this.t - k.lastLaugh > NOTE.laughGap && !this.cutscene && this.state === 'playing') {
      k.lastLaugh = this.t; k.laughs++;
      this.audio.play('giggle', { pos: new V(rand(-1.5, 1.5), 1.1, rand(-1, 2)), vol: 0.9, ref: 3, reverb: 0.2 });
      if (this.players.includes(k.owner)) {
        this.addLaugh(NOTE.laugh, T.local(0, T.chestY, -0.3, new V()), null); // (at his back)
        this.mischief += NOTE.laughMischief;
        this.note(k.owner, 'noteLaughs');
      }
    }
    k.back = back;
    if (!k.finding && (this.t > k.foundAt || k.laughs >= NOTE.foundLaughs) && this.canReactPrank()) {
      k.finding = true;
      this.interrupt(this.noteFound(k));
    }
  },

  /** a kid tells him; he tears it off and reads it. Then: who did it? */
  *noteFound(k) {
    const T = this.teacher, A = this.audio;
    this.blameBusy = true;
    try {
      T.clap = null; T.setPose('rest'); T.moveTarget = null;
      const kid = pick(this.students.filter((s) => !s.gone && !s.hollow && !s.call));
      if (kid) {
        kid.lookTarget = T.headWorld(new V());
        yield* this.waitVoice(this.sayAt(kid, this.kidVoice(kid, 'k_bl_back'), 0, 1.15), 0.15); // "Sir! There is something on your back!"
        T.lookAt(kid.headWorld(new V()), 6);
        kid.lookTarget = null;
      }
      yield* this.say('t_bl_back', 0.2); // "What is on my back?"
      // he reaches back over his shoulder and tears it off
      T.lookAt(T.local(-0.35, 1.0, -0.4, new V()), 5);
      yield* this.wait(0.55);
      A.play('bl_rip', { pos: T.local(0, T.chestY, -0.2, new V()), vol: 0.9, ref: 1.6, reverb: 0.2 });
      this.kickNote = null;
      this.handNote.visible = true;
      T.lookAt(T.handPos('R', new V()), 8);
      yield* this.wait(0.7);
      yield* this.say('t_bl_kickme', 0.3); // "Kick... me."
      this.angerUp(NOTE.anger, 90);
      this.handNote.visible = false;
      A.play('prank_crumple', { pos: T.handPos('R', new V()), vol: 0.6, ref: 1 });
      const p = k.owner;
      if (this.allowBlame && this.players.includes(p)) yield* this.askWhoDidIt(p, 'note');
      else yield* this.say('t_ifind', 0.3);
    } finally {
      this.blameBusy = false;
      this.handNote.visible = false;
      if (this.kickNote === k) k.finding = false; // (still on his back: found later)
    }
  },

  // ---------------------------------------------------------------- "Who did it?"
  /** how sure he is that it was this player (0..1): their noise, a fresh echo, hits, earlier lies, the evidence */
  blameSure(p, about) {
    const S = BLAME.sure;
    let s = S.base + (p.heat || 0) * S.heat + Math.min(3, p.prankStreak || 0) * S.streak + (S.evidence[about] || 0) + (p.lies || 0) * S.lie;
    if (this.t - p.lastEcho < S.echoWithin) s += S.echo;
    return clamp(s, 0, 1);
  },

  /** who you can point at: usually the classmate sitting nearest to you, now and then Sam or Nora */
  scapegoat(p) {
    const near = (list) => {
      let best = null, bd = 1e9;
      for (const k of list) {
        if (k.gone || k.hollow || k.call) continue;
        const d = Math.hypot(k.seat.x - p.camPos.x, k.seat.z - p.camPos.z);
        if (d < bd) { bd = d; best = k; }
      }
      return best;
    };
    const kid = near(this.students), friend = near(this.friends);
    return (friend && (!kid || chance(BLAME.friendGoat))) ? friend : kid;
  },

  /** he comes to your desk: "You. Who did it?" Point at a kid, say nothing, or confess. */
  *askWhoDidIt(p, about) {
    const T = this.teacher;
    if (!this.players.includes(p) || this.ending) return;
    this.blameBusy = true;
    const looking = [];
    try {
      T.clap = null; T.setPose('rest');
      if (Math.hypot(T.pos.x - p.camPos.x, T.pos.z - p.camPos.z) > 1.5) {
        const spot = this.deskSpot(p);
        T.lookAt(p.camPos, 4);
        yield* this.walk(spot.approach.x, spot.approach.z, 1.4);
        yield* this.walk(spot.stand.x, spot.stand.z, 1.0);
        T.faceTo(spot.face, 5);
      } else T.facePoint(p.camPos, 5);
      T.lookAt(p.camPos, 6);
      T.leanTarget = 0.45; T.crouchTarget = 0.1;
      for (const k of this.students) if (!k.gone && !k.hollow && !k.call && chance(0.6)) { k.lookTarget = p.camPos; looking.push(k); }
      yield* this.say('t_bl_ask', 0.15); // "You. Who did it?"
      if (!this.players.includes(p)) return;
      const sure = this.blameSure(p, about);
      const goat = this.scapegoat(p);
      this.track.event(this.t, p, 'asked', { about, sure: Math.round(sure * 100) / 100 });
      const title = sure >= BLAME.lieLimit ? 'Who did it? (he looks sure it was you)' : 'Who did it? (he isn\'t sure)';
      const labels = [goat ? `Point at ${goat.name}` : 'Point at someone', 'Say nothing', 'Confess'];
      const i = yield* this.choose(title, labels, BLAME.answerTime, p);
      if (!this.players.includes(p)) return;
      if (i === 0 && goat) yield* this.blamePoint(p, goat, sure);
      else if (i === 2) yield* this.blameConfess(p);
      else yield* this.blameSilent(p);
    } finally {
      this.blameBusy = false;
      T.leanTarget = 0; T.crouchTarget = 0;
      for (const k of looking) if (k.lookTarget === p.camPos) k.lookTarget = null;
    }
  },

  /** caught from inside one of his scenes: the busted scene starts right after this frame */
  *bustSoon(reason, p) {
    this.timers.after(0, () => { if (this.state === 'playing' && !this.ending && this.players.includes(p)) this.bust(reason, p); });
    for (let t = 0; t < 2; t += this.dt) yield; // (bust() replaces this scene)
  },

  *blamePoint(p, goat, sure) {
    const T = this.teacher;
    this.playerSay('p_bl_them', p); // "It was them!"
    yield* this.wait(1.0);
    // a kid you blamed before tells on you
    const snitch = this.students.find((k) => k !== goat && k.grudge && k.grudge.p === p && !k.gone && !k.hollow);
    if (snitch) {
      snitch.lookTarget = p.camPos;
      yield* this.waitVoice(this.sayAt(snitch, this.kidVoice(snitch, 'k_bl_them'), 0, 1.15), 0.1); // "It was them!"
      snitch.grudge = null; snitch.lookTarget = null;
      p.lies = (p.lies || 0) + 1;
      this.note(p, 'lies'); this.track.event(this.t, p, 'blame', { result: 'snitched', by: snitch.name });
      yield* this.bustSoon('lie', p);
      return;
    }
    if (sure >= BLAME.lieLimit) {
      yield* this.say('t_bl_no', 0.2); // "No. I do not believe you."
      p.lies = (p.lies || 0) + 1;
      this.note(p, 'lies'); this.track.event(this.t, p, 'blame', { result: 'lie' });
      yield* this.bustSoon('lie', p);
      return;
    }
    // he believes you: everybody turns to the kid
    const head = goat.headWorld(new V());
    T.lookAt(head, 5); T.facePoint(head, 4);
    this.audio.play('bl_ooh', { pos: new V(0, 1.1, 0.6), vol: 0.9, ref: 3.5, reverb: 0.3 });
    goat.lookTarget = p.camPos; goat.tremble = 0.4;
    yield* this.wait(0.8);
    let line;
    if (goat.kind === 'sam') line = 's_bl_what';           // "Bro! Me? Seriously?"
    else if (goat.kind === 'nora') line = 'n_bl_what';     // "Me? Wow. Thanks a lot."
    else if (chance(BLAME.revenge.takeIt)) line = this.kidVoice(goat, 'k_bl_me'); // "Okay. It was me."
    else {
      line = this.kidVoice(goat, 'k_bl_what'); // "What? Me?" (and they will remember it)
      goat.grudge = { p, at: this.t + rand(BLAME.revenge.after[0], BLAME.revenge.after[1]), until: this.t + BLAME.revenge.lasts, told: false };
    }
    yield* this.waitVoice(this.sayAt(goat, line, 0, 1.1), 0.2);
    yield* this.say('t_bl_watch', 0.3); // "I am watching you." (the kid, this time)
    goat.tremble = 0;
    if (goat.lookTarget === p.camPos) goat.lookTarget = null;
    this.mischief += BLAME.blameMischief;
    this.addLaugh(BLAME.blameLaugh, head, null); // (at the kid)
    p.heat = 0; p.prankStreak = 0;
    this.note(p, 'blamed'); this.track.event(this.t, p, 'blame', { result: 'believed', who: goat.name });
  },

  *blameSilent(p) {
    yield* this.wait(0.7);
    yield* this.say('t_bl_watch', 0.3); // "I am watching you."
    this.angerUp(BLAME.silentAnger, 90);
    p.watchedT = BLAME.watchFor;
    this.track.event(this.t, p, 'blame', { result: 'silent' });
    this.uiTo(p, 'hint', 'He is <b>watching you</b> now. Keep quiet for a while.', 3.5);
  },

  *blameConfess(p) {
    this.playerSay('p_bl_me', p); // "It was me."
    yield* this.wait(1.1);
    this.note(p, 'confessed');
    if ((p.confessions || 0) >= 1) {
      p.confessions++;
      this.track.event(this.t, p, 'blame', { result: 'again' });
      yield* this.say('t_bl_again', 0.2); // "Again?"
      yield* this.bustSoon('confess', p);
      return;
    }
    p.confessions = 1;
    yield* this.say('t_bl_honest', 0.3); // "Honest. Do not do it again."
    this.anger *= BLAME.confessCalm;
    p.heat = 0; p.prankStreak = 0; p.echoStreak = 0;
    this.track.event(this.t, p, 'blame', { result: 'confessed' });
  },

  // ---------------------------------------------------------------- the kid you blamed
  updateGrudges() {
    for (const k of this.students) {
      const g = k.grudge;
      if (!g) continue;
      if (this.t > g.until || !this.players.includes(g.p) || k.gone || k.hollow) { k.grudge = null; continue; }
      if (g.told || this.t < g.at) continue;
      const p = g.p;
      if ((p.talk || p.phoneUp || p.aiming || p.vid) && this.canReactPrank()) {
        g.told = true;
        this.interrupt(this.tellOn(k, p));
      }
    }
  },

  /** "Sir! Sir! Look!": he turns right to you (if you are still at it, he sees it) */
  *tellOn(kid, p) {
    const T = this.teacher;
    this.blameBusy = true;
    try {
      kid.lookTarget = p.camPos;
      yield* this.waitVoice(this.sayAt(kid, this.kidVoice(kid, 'k_bl_tell'), 0, 1.15), 0.05); // "Sir! Sir! Look!"
      this.uiTo(p, 'hint', `<b>${kid.name}</b> told on you!`, 2.5);
      T.clap = null; T.setPose('rest'); T.moveTarget = null;
      T.lookAt(p.camPos, 12); T.facePoint(p.camPos, 6);
      this.angerUp(8, 85);
      this.track.event(this.t, p, 'toldOn', { by: kid.name });
      yield* this.wait(2.4);
      T.lookAt(null, 3);
    } finally {
      this.blameBusy = false;
      if (kid.lookTarget === p.camPos) kid.lookTarget = null;
    }
  },

  /** an idle act: he walks down the aisle next to someone's desk, stops just past it and looks over the back rows */
  *actAisle() {
    const T = this.teacher;
    const p = pick(this.players);
    if (!p) return;
    const ax = p.desk.x >= 0 ? Math.min(3.75, p.desk.x + 0.75) : Math.max(-3.75, p.desk.x - 0.75);
    T.lookAt(null, 3);
    yield* this.walk(ax, FRONT_Z, 0.85);
    yield* this.walk(ax, p.camPos.z + 0.95, 0.7);
    T.faceTo(0, 2);
    T.lookAt(new V(ax * 0.5, 1.1, 3.2), 2);
    yield* this.wait(rand(2.2, 3.2));
    if (chance(0.4)) yield* this.say('t_hmm', 0.2);
    T.lookAt(null, 3);
    yield* this.walk(rand(-1, 1), -5.3, 0.85);
  },

  // ---------------------------------------------------------------- what everybody sees (host and friends)
  /** host: the note, the note in his hand, everyone's red dot */
  blameSnap() {
    const dots = [];
    for (const p of this.players) if (p.laserOn && p.laserHit) dots.push([Math.round(p.laserHit.pt.x * 100) / 100, Math.round(p.laserHit.pt.y * 100) / 100, Math.round(p.laserHit.pt.z * 100) / 100, p.id]);
    const cat = this.cat && this.cat.phase === 'chase' && this.players.includes(this.cat.p) ? this.cat.p.id : 0;
    return [this.kickNote ? 1 : 0, this.handNote.visible ? 1 : 0, dots, cat];
  },
  /** friend online: the same from the host's snapshot */
  applyBlameSnap(b) {
    if (!Array.isArray(b)) return;
    this.netKick = !!b[0];
    this.netHandNote = !!b[1];
    this.netDots = Array.isArray(b[2]) ? b[2].filter((d) => Array.isArray(d) && d.length >= 4 && d.slice(0, 3).every(Number.isFinite)).slice(0, MAX_DOTS) : [];
    this.netCat = typeof b[3] === 'string' ? b[3] : null;
  },

  /** every frame (any role): the dots, the note on his back, the note in his hand */
  blameVisuals() {
    const T = this.teacher, me = this.me, guest = this.role === 'guest';
    // your own dot: worked out on your screen (a friend's own dot never waits for the host)
    if (guest) {
      me.laserHit = me.aim && me.aim.kind === 'laser' && this.state === 'playing' ? this.laserRay(this.camPos, this.camFwd, me, me.laserBuf || (me.laserBuf = hitObj())) : null;
      if (!!me.laserHit !== !!this.lzClick) { this.lzClick = !!me.laserHit; this.audio.play('bl_click', { vol: 0.55, local: true, reverb: 0 }); }
    }
    let n = 0;
    const show = (pt) => {
      if (n >= MAX_DOTS) return;
      const s = this.laserDots[n++];
      // a little toward the viewer, so a wall doesn't cut it in half; bigger far away (it is a laser)
      const d = pt.distanceTo(this.camPos);
      s.position.copy(pt).addScaledVector(_c.subVectors(this.camPos, pt).normalize(), 0.025);
      s.scale.setScalar(0.09 + d * 0.014);
      s.visible = true;
    };
    if (this.state === 'playing') {
      if (guest) {
        if (me.laserHit) show(me.laserHit.pt);
        for (const d of this.netDots) if (d[3] !== me.id) show(_d.set(d[0], d[1], d[2]));
      } else for (const p of this.players) if (p.laserOn && p.laserHit) show(p.laserHit.pt);
    }
    for (let i = n; i < MAX_DOTS; i++) this.laserDots[i].visible = false;
    // KICK ME on his upper back
    const on = this.state === 'playing' && (guest ? this.netKick : !!this.kickNote) && T.root.visible;
    this.backNote.visible = on;
    if (on) {
      T.bones.chest.getWorldPosition(_a);
      const yaw = T.root.rotation.y;
      this.backNote.position.set(_a.x - Math.sin(yaw) * 0.165, _a.y + 0.04, _a.z - Math.cos(yaw) * 0.165);
      this.backNote.rotation.set(-0.08, yaw + Math.PI, 0, 'YXZ');
    }
    if (guest) this.handNote.visible = this.netHandNote && this.state === 'playing';
  },

  /** the label and HUD while you hold the laser or the note (src/pranks.js calls this instead of the arc) */
  toolHud(a, kind) {
    const me = this.me;
    let label = '';
    if (kind === 'laser') {
      const h = me.laserHit;
      if (this.role === 'guest' ? this.netCat === me.id : this.cat && this.cat.p === me && this.cat.phase === 'chase') label = 'he\'s chasing it!';
      else if (!h) label = '';
      else if (h.type === 'teacher') label = h.part === 'face' ? 'his EYES (he\'ll find you!)' : 'him (the class giggles)';
      else if (h.type === 'kid' || h.type === 'friend' || h.type === 'player') label = h.who.name;
      else if (h.type !== 'none') label = 'the ' + h.type;
      this.aimLabel = label ? '→ ' + label : '';
      this.ui.aim('LASER POINTER', null, true);
    } else {
      const reach = this.noteReach(me);
      const has = this.role === 'guest' ? this.netKick : !!this.kickNote;
      this.aimLabel = reach ? '→ his back: let go to stick it' : has ? 'he already has one on his back' : 'wait until he walks past your desk';
      this.ui.aim('KICK ME NOTE', null, reach);
    }
    this.aimShown = true;
  },

  /** the first time you pick up the laser / the note: what to do with it */
  toolHint(kind) {
    if (this.toolHinted[kind]) return;
    this.toolHinted[kind] = true;
    if (kind === 'laser') this.ui.hint('A red dot where you look. <b>He chases it</b> when he sees it in front of him. Not in his eyes!', 5);
    else if (kind === 'note') this.ui.hint('Hold it while he walks <b>past your desk with his back to you</b>, then let go to stick it on.', 5);
  },
};
