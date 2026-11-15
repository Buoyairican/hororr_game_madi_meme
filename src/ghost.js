// Phase 7: the ghost kid. Online, a player he catches (and who is not out yet) does not just sit there:
// they float into the back corner as a ghost for a minute (GHOST.time). From there they can haunt the
// class with 1 / 2 / 3 (or LIGHT / CHAIR / BOOK on a phone): flicker the lights, slide the spare chair,
// drop the book off his desk. Every haunt takes some of his anger away and, when he is free, pulls him
// over to look (to the back of the room for the chair): time for the friends still in their seats.
// He never sees or catches a ghost. Then the ghost floats back to their chair.
// Like off-your-chair (src/sneak.js), p.camPos stays at the seat; the camera (p.view) is in the corner.
import * as THREE from 'three';
import { GHOST } from './data.js';
import { dynamicChair } from './world.js';
import { clamp, lerp, smoothstep, damp, dampAngle } from './util.js';

const V = THREE.Vector3;
const _a = new V(), _b = new V();
const r2 = (x) => Math.round(x * 100) / 100;

export const GhostMixin = {
  setupGhost() {
    const C = GHOST.chair, W = this.world;
    this.spareChair = dynamicChair(this.scene, W.materials, C.x, C.z);
    this.spareChair.group.rotation.y = C.yaw;
    this.bookHome = { pos: W.fallingBook.position.clone(), rot: W.fallingBook.rotation.clone() };
    this.ghostMat = new THREE.MeshBasicMaterial({ color: 0xa9dcff, transparent: true, opacity: 0.3, depthWrite: false });
  },

  resetGhost() {
    const C = GHOST.chair, ch = this.spareChair;
    ch.group.position.set(C.x, 0, C.z); ch.group.rotation.set(0, C.yaw, 0);
    this.chairAt = { x: C.x, z: C.z, yaw: C.yaw, n: 0 };
    this.bookBack();
    this.hauntBusy = false;
    for (const p of this.players || []) this.resetGhostPlayer(p);
    if (this.ui.ghost) this.ui.ghost(null);
  },
  resetGhostPlayer(p) {
    p.ghost = null; p.ghostK = 0; p.ghostSeen = false;
    if (p.avatar) p.avatar.setGhost(false);
  },

  /** the book back on his desk (after a haunt, or a new class) */
  bookBack() {
    const bk = this.world.fallingBook, h = this.bookHome;
    if (!h) return;
    bk.position.copy(h.pos); bk.rotation.copy(h.rot);
    this.bookDownAt = 0;
  },

  /** where a ghost floats (their own spot in the corner, by seat) */
  ghostSpot(p, out = new V()) {
    const s = GHOST.spots[p.seat] || GHOST.spots[0];
    return out.set(s[0], GHOST.eye, s[1]);
  },
  /** the camera of a ghost: from the chair to the corner and back (k 0..1) */
  ghostEye(p, out = new V()) {
    const k = smoothstep(0, 1, p.ghostK);
    const s = this.ghostSpot(p, _a);
    return out.set(lerp(p.eye.x, s.x, k), lerp(p.eye.y, s.y, k) + Math.sin(this.t * 1.3 + p.seat) * 0.025 * k, lerp(p.eye.z, s.z, k));
  },

  /** what an avatar needs to float as a ghost (src/mp.js) */
  ghostLook(p) {
    if (!(p.ghostK > 0)) return { ghost: 0 };
    const s = GHOST.spots[p.seat] || GHOST.spots[0];
    return { ghost: p.ghostK, gx: s[0], gz: s[1], gmat: this.ghostMat, t: this.t };
  },

  /** host / solo, right after a strike (not the last one): online, that player becomes a ghost */
  ghostAfterBust(p) {
    if (this.role === 'guest' || !this.mp || this.mode !== 'free' || this.state !== 'playing' || this.ending || !this.extrasAuto) return;
    if (!this.players.includes(p) || p.ghost || this.strikes >= this.maxStrikes) return;
    if (this.players.filter((q) => q !== p && !q.ghost).length < GHOST.minPlayers - 1) return;
    p.ghost = { t0: this.t, until: this.t + GHOST.time, cd: GHOST.haunts.map(() => 0), out: false };
    p.aim = null; p.aiming = false;
    if (p.talk) this.endTalk(p);
    this.note(p, 'ghost'); this.track.event(this.t, p, 'ghost');
    this.audio.play('gh_float', { pos: this.ghostSpot(p, _b).clone(), vol: 0.7, ref: 3, reverb: 0.4 });
    if (p.local) this.ghostHint(p);
    for (const q of this.players) if (q !== p) this.uiTo(q, 'hint', GHOST.text.others.replace('{name}', p.name), 5);
  },
  /** your own screen: you are a ghost now */
  ghostHint() { this.ui.hint(this.input.touch ? GHOST.text.youTouch : GHOST.text.you, 7); },

  /** the ghost floats back to their chair (time is up, the bell, the last strike, a new class) */
  ghostEnd(p, now = false) {
    if (!p.ghost) return;
    if (now) { this.resetGhostPlayer(p); if (p.local) this.ui.ghost(null); return; }
    if (p.ghost.out) return;
    p.ghost.out = true;
    this.track.event(this.t, p, 'ghostBack');
    this.uiTo(p, 'hint', GHOST.text.back, 2.5);
  },
  allGhostsBack() { for (const p of this.players) if (p.ghost) this.ghostEnd(p, true); },

  /** host / solo, every frame */
  updateGhosts(dt) {
    for (const p of this.players) {
      const g = p.ghost;
      if (!g) { p.ghostK = 0; continue; }
      if (!g.out && this.t >= g.until) this.ghostEnd(p);
      if (g.out) {
        p.ghostK = Math.max(0, p.ghostK - dt / GHOST.floatOut);
        if (p.ghostK <= 0) { this.resetGhostPlayer(p); if (p.local) this.ui.ghost(null); continue; }
      } else p.ghostK = Math.min(1, p.ghostK + dt / GHOST.floatIn);
      // a ghost does nothing else (no talking, phone, pranks or questions: it is not in the class)
      if (p.talk) this.endTalk(p);
      p.phoneUp = false; p.vid = false; p.aim = null; p.aiming = false; p.noise = 0; p.selfNoise = 0; p.heat = 0;
    }
    // the book floats back onto his desk a while after it fell
    if (this.bookDownAt && this.t > this.bookDownAt + GHOST.bookBack) {
      this.audio.play('whoosh', { pos: this.bookHome.pos.clone(), vol: 0.25, ref: 1.5, rate: 0.7 });
      this.bookBack();
    }
    // the spare chair slides where the last haunt pushed it
    const ch = this.spareChair.group, c = this.chairAt;
    ch.position.x = damp(ch.position.x, c.x, 3.2, dt); ch.position.z = damp(ch.position.z, c.z, 3.2, dt);
    ch.rotation.y = dampAngle(ch.rotation.y, c.yaw, 2.6, dt);
  },

  /** whether this ghost may haunt now (and which haunts are ready): for the HUD too */
  hauntReady(p, i) {
    const g = p.ghost;
    return !!g && !g.out && p.ghostK >= 1 && this.t - g.t0 >= GHOST.firstWait + GHOST.floatIn && this.t >= g.cd[i] && this.state === 'playing' && !this.ending;
  },

  /** host / solo: a ghost haunts the class (i: 0 light, 1 chair, 2 book) */
  haunt(p, i) {
    const H = GHOST.haunts[i];
    if (!H || !this.players.includes(p)) return false;
    if (!this.hauntReady(p, i)) { if (p.ghost && !p.ghost.out) this.uiTo(p, 'hint', GHOST.text.wait, 1.2); return false; }
    p.ghost.cd[i] = this.t + H.cd;
    this.mischief += H.mischief;
    this.anger = Math.max(0, this.anger - H.calm);
    this.scareFear = Math.max(this.scareFear, GHOST.fear);
    this.note(p, 'ghost_haunt'); this.track.event(this.t, p, 'haunt', { id: H.id });
    const W = this.world, A = this.audio;
    let at;
    if (H.id === 'light') {
      for (const b of W.lights.banks) if (!b.dead) b.flicker = 0.9;
      at = W.lights.banks[0].light.position.clone();
      A.play('gh_haunt', { pos: at, vol: 0.6, ref: 4, reverb: 0.4 });
      A.play('zap', { pos: at, vol: 0.55 });
    } else if (H.id === 'chair') {
      const C = GHOST.chair, m = C.moves[this.chairAt.n % C.moves.length];
      this.chairAt = { x: C.x + m[0], z: C.z + m[1], yaw: C.yaw + m[2], n: this.chairAt.n + 1 };
      at = new V(this.chairAt.x, 0.5, this.chairAt.z);
      A.play('chair_scrape', { pos: at, vol: 1.0, ref: 2.5, reverb: 0.25, rate: 0.85 });
      A.play('gh_haunt', { pos: at, vol: 0.45, ref: 3, reverb: 0.4 });
    } else {
      this.bookBack();
      this.fx.push(this.fxBookDrop());
      this.bookDownAt = this.t;
      at = this.bookHome.pos.clone();
      A.play('gh_haunt', { pos: at, vol: 0.45, ref: 3, reverb: 0.4 });
    }
    // he goes to look (only when nothing else is on: the scene, an event, his habits go first)
    if (this.present && !this.hauntBusy && this.canReactPrank() && !this.quirkBusy && !this.sneakBusy && !this.sitting) this.interrupt(this.reactHaunt(H, at));
    return true;
  },

  /** the haunt pulls him over: he looks at the lights, walks to the back for the chair, to his desk for the book */
  *reactHaunt(H, at) {
    const T = this.teacher;
    this.hauntBusy = true;
    try {
      T.clap = null; T.setPose('rest'); T.moveTarget = null;
      if (H.id === 'light') {
        T.lookAt(_b.set(T.pos.x, 3.0, T.pos.z - 0.6).clone(), 4);
        yield* this.wait(0.8);
        yield* this.say(H.line, 0.4);
        yield* this.wait(0.6);
      } else if (H.id === 'chair') {
        T.lookAt(at, 6); T.facePoint(at, 3);
        yield* this.wait(0.6);
        yield* this.say(H.line, 0.2);
        // all the way to the back of the room to look
        yield* this.walk(clamp(at.x - 0.9, -3.75, 3.75), 4.6, 1.0);
        T.lookAt(at, 4); T.facePoint(at, 4);
        yield* this.wait(1.4);
        if (H.after) yield* this.say(H.after, 0.6);
        T.lookAt(null, 3);
        yield* this.walk(0.3, -5.4, 1.1);
      } else {
        const st = this.world.teacherDesk.stand;
        T.lookAt(at, 6);
        yield* this.walk(st.x + 0.5, st.z + 0.1, 1.1);
        T.lookAt(_b.set(at.x + 0.25, 0.05, at.z + 0.15).clone(), 4);
        T.crouchTarget = 0.25; T.leanTarget = 0.5;
        yield* this.wait(0.9);
        yield* this.say(H.line, 0.4);
        T.crouchTarget = 0; T.leanTarget = 0;
      }
    } finally {
      this.hauntBusy = false;
      T.crouchTarget = 0; T.leanTarget = 0;
    }
  },

  // ---------------------------------------------------------------- your own controls (host and friends alike)
  /** while you are a ghost: 1 / 2 / 3 (or LIGHT / CHAIR / BOOK) haunt; returns true while you are one */
  localGhost(inp, pressed) {
    const me = this.me;
    if (!me.ghost && !(me.ghostK > 0)) { if (this.ghostUiOn) { this.ghostUiOn = false; this.ui.ghost(null); } return false; }
    this.ghostUiOn = true;
    const k = inp.takeChoice();
    const i = k >= 0 && k < 3 ? k : pressed.echo ? 0 : pressed.ask ? 1 : pressed.tap ? 2 : -1;
    if (i >= 0) {
      if (this.role === 'guest') this.mp.send({ t: 'press', k: 'haunt', h: i });
      else this.haunt(me, i);
    }
    this.ui.prompt('');
    this.ui.phoneControls('ghost', inp.touch);
    this.ui.ghost(this.ghostHud(me));
    return true;
  },
  /** what the ghost HUD shows: seconds left, each haunt ready or its cooldown */
  ghostHud(p) {
    const g = p.ghost;
    if (!g) return { left: 0, back: true, h: GHOST.haunts.map((H) => ({ name: H.name, wait: 0 })) };
    const ready = p.ghostK >= 1 && this.t - g.t0 >= GHOST.firstWait + GHOST.floatIn;
    return { left: Math.max(0, Math.ceil(g.until - this.t)), back: g.out, h: GHOST.haunts.map((H, i) => ({ name: H.name, wait: ready ? Math.max(0, Math.ceil(g.cd[i] - this.t)) : -1 })) };
  },

  // ---------------------------------------------------------------- online
  /** host: every ghost (id, float, seconds left, cooldowns) and the spare chair */
  ghostSnap() {
    const gs = [];
    for (const p of this.players) if (p.ghost) gs.push([p.id, r2(p.ghostK), r2(p.ghost.until - this.t), p.ghost.cd.map((c) => r2(Math.max(0, c - this.t))), p.ghost.out ? 1 : 0, r2(this.t - p.ghost.t0)]);
    return [gs, [r2(this.chairAt.x), r2(this.chairAt.z), r2(this.chairAt.yaw)]];
  },
  /** friend: the ghosts as the host has them (your own one too) */
  applyGhostSnap(s) {
    if (!Array.isArray(s)) return;
    const [gs, ch] = s;
    const seen = new Set();
    for (const row of gs || []) {
      const id = row[0], me = id === this.mp.myId, p = me ? this.me : this.players.find((q) => q.id === id);
      if (!p) continue;
      seen.add(p);
      const was = !!p.ghost;
      p.ghost = { t0: this.t - (Number(row[5]) || 0), until: this.t + (Number(row[2]) || 0), cd: (row[3] || []).map((c) => this.t + (Number(c) || 0)), out: !!row[4] };
      p.ghostNet = Number(row[1]) || 0;
      if (me && !was) this.ghostHint(); // (the sound comes from the host)
    }
    for (const p of this.players) if (p.ghost && !seen.has(p)) { p.ghost = null; p.ghostNet = 0; }
    if (Array.isArray(ch)) this.chairAt = { x: Number(ch[0]) || GHOST.chair.x, z: Number(ch[1]) || GHOST.chair.z, yaw: Number(ch[2]) || GHOST.chair.yaw, n: 0 };
  },
  /** friend, every frame: float your own camera, the others' ghosts, the chair */
  guestGhosts(dt) {
    for (const p of this.players) {
      // (float at the host's pace even when a snapshot jumps ahead: never a jump cut)
      const want = p.ghost ? p.ghostNet || 0 : 0, k = p.ghostK || 0;
      const rate = (want > k ? 1 / GHOST.floatIn : 1 / GHOST.floatOut) * 1.25 * dt;
      p.ghostK = want > k ? Math.min(want, k + rate) : Math.max(want, k - rate);
    }
    const ch = this.spareChair.group, c = this.chairAt;
    ch.position.x = damp(ch.position.x, c.x, 3.2, dt); ch.position.z = damp(ch.position.z, c.z, 3.2, dt);
    ch.rotation.y = dampAngle(ch.rotation.y, c.yaw, 2.6, dt);
  },
};
