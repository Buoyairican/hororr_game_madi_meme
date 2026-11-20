// The new jump scares: your pencil under the desk, the wrong seat, the sprint from the door, the hanging,
// the window, the fake bell, the face flash.
//
// Each scare is a "local" scene: it plays on the screen of the player who watches it. Solo that is you.
// Online the host picks one victim: the host runs it for itself, or tells that friend to run it on their
// own screen (mp.js: 'gscare') while the others watch him bent over the friend's chair (scWatch). Only
// SCARES.everyone (the flash, the fake bell) still plays on every screen at the same moment. Everything a scene
// does is local to the screen it runs on (sounds with `local`, subtitles and hints with `.local`).
// F4 added the shoulder, under the desk, the note and the stare. The stare is the exception online: the host walks
// him to a friend's desk itself (everybody sees him come) and only the final lunge ('lunge') goes to that friend.
//
// He never catches anybody during a scare (scareBusy): a scare is never a strike.
// Numbers and texts: SCARES in src/data.js. The director (game.js scareList) and the story pick them.
import * as THREE from 'three';
import { SCARES } from './data.js';
import { ROOM } from './world.js';
import { lerp, pick } from './util.js';

const V = THREE.Vector3;
const _a = new V(), _b = new V(), _c = new V();
const WINDOWS = [-4.3, -0.9, 2.5]; // the windows on the left wall (world.js)
const BELL = new V(3.5, 2.8, -6.8);

export const ScaresMixin = {
  setupScares() {
    // a yellow pencil on your desk (the pencil scare)
    const g = new THREE.Group();
    const wood = new THREE.Mesh(new THREE.CylinderGeometry(0.0045, 0.0045, 0.16, 6), new THREE.MeshStandardMaterial({ color: 0xd8a21c, roughness: 0.6 }));
    wood.rotation.z = Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.0045, 0.022, 6), new THREE.MeshStandardMaterial({ color: 0xe8c9a0, roughness: 0.8 }));
    tip.rotation.z = -Math.PI / 2; tip.position.x = 0.091;
    g.add(wood, tip);
    g.visible = false;
    this.scene.add(g);
    this.scPencil = g;
    this.scFakeEl = document.getElementById('fake-end');
    this.scFlashEl = document.getElementById('face-flash');
    this.resetScares();
  },

  resetScares() {
    this.scareBusy = null; this.scLocalOn = false; this.localScare = false;
    this.scPencilHint = false; this.scShoulderHint = false;
    if (this.scPencil) this.scPencil.visible = false;
    this.scShowFake(null);
    if (this.scFlashEl) this.scFlashEl.classList.remove('on');
  },

  /** the director's entries for the new scares (game.js scareList) */
  newScares() {
    return Object.entries(SCARES.pool).map(([id, o]) => ({
      id, min: o.min, w: (o.solo && this.mp) || (o.free && this.mode !== 'free') || (id === 'note' && this.ui.noteOpen) ? 0 : o.w, cool: o.cool, once: o.once, strong: o.strong,
      ...(o.fx ? { fx: () => this.scareFx(id) } : { brain: () => this.scareScene(id) }),
    }));
  },

  /** can this screen's player watch a scare right now (in their chair, not a ghost)? */
  canScareMe() { return !this.me.out && !(this.me.slipK > 0) && !(this.me.ghostK > 0); },

  // ------------------------------------------------------------- running a scare
  /** as his brain (the story and the director): nobody gets caught meanwhile; online, one victim gets it
   *  and the others watch him bent over the victim's chair (SCARES.everyone: every screen gets it) */
  *scareScene(id) {
    const T = this.teacher;
    let v = null;
    if (this.mp && !SCARES.everyone.includes(id)) {
      v = this.scareVictim || pick(this.players.filter((p) => !p.out && !(p.slipK > 0) && !p.ghost)); // (scareVictim: tests)
      if (!v) return;
      if (id !== 'stare') for (const q of this.players) if (q !== v) this.uiTo(q, 'toast', SCARES.watchToast.replace('{name}', v.name.toUpperCase()), 3);
    }
    this.scareBusy = id;
    this.eventLock = true;
    try {
      if (v && !v.local && id === 'stare') yield* this.scStare(v); // (the host walks him: everybody sees him come; only the lunge is on the friend's screen: F4)
      else if (v && !v.local) {
        v.scareDone = -1; // (a report from an older scene, or from the last class, must not end this one)
        this.mp.toPlayer(v, { t: 'gscare', k: id });
        yield* this.scWatch(v, (SCARES.len[id] || 8) + (SCARES.wait[id] || 0) + 2); // (their scene can wait SCARES.wait for a look)
      } else {
        if (this.mp && !v) this.mp.scareAll(id);
        else if (v && id !== 'stare' && this.canScareMe()) this.mp.scareAll('watch'); // (the host is the victim: the friends watch him bent over the host's chair on their own screens)
        if (this.canScareMe()) yield* this.scLocal(id);
        else yield* this.wait(SCARES.len[id] || 8);
      }
    } finally {
      if (v && v.local && this.mp) this.mp.broadcastNow({ t: 'scareDone' }); // (the friends watching him at the host's chair: it is over)
      this.scEnd();
      T.place(0.2, -5.4, 0);
      this.eventLock = false; this.scareBusy = null;
    }
    // back at the front, as if nothing happened
    if (id === 'sprint') yield* this.say('t_norunning', 0.5);
    else if (id === 'fakebell') yield* this.say('t_notover2', 0.5);
    yield* this.actStare(1.2);
  },

  /** online, a friend is the victim: what the others see (he leaves the front and stands bent over the friend's chair) */
  *scWatch(v, seconds) {
    const T = this.teacher, t0 = this.t;
    yield* this.scVanish(0.4);
    const s = this.deskSpot(v);
    T.place(s.stand.x, s.stand.z, s.face); T.root.visible = true; T.setPose('desk', s.corners); T.leanTarget = 0.9; T.crouchTarget = 0.3; T.lookAt(v.camPos, 8);
    let t = 0;
    while (t < seconds && !(v.scareDone >= t0) && this.players.includes(v)) { t += this.dt; yield; } // (until the friend says the scene is over)
    yield* this.scBlackoutBack(0.5);
  },

  /** a quick one that needs nothing from him (the face flash) */
  scareFx(id) {
    if (this.mp) this.mp.scareAll(id);
    return this.canScareMe() ? this.scLocal(id) : (function* () {})();
  },

  /** a friend's screen (mp.js 'gscare'): the same scene, with their own teacher for the moment */
  *scareGuest(id) {
    const mp = this.mp;
    if (!(SCARES.len[id] || id === 'lunge' || id === 'watch') || !this.canScareMe() || this.state !== 'playing' || (id === 'note' && this.ui.noteOpen)) { if (mp) mp.send({ t: 'press', k: 'scareDone' }); return; } // (skipped: the host need not wait)
    if (mp) mp.localTeacher = true;
    this.localScare = true; // (the host's lights and blackout don't overwrite this screen meanwhile)
    let told = false;
    try {
      yield* this.scLocal(id);
      if (mp) { mp.send({ t: 'press', k: 'scareDone' }); told = true; } // (the host stops standing over your chair)
      // keep your own teacher and lights until he has left your chair on the host too (no second blackout, no face at your desk)
      this.localScare = true;
      const s = this.deskSpot().stand;
      for (let t = 0; t < 2 && mp && mp.snap && (Math.hypot(mp.snap.T[0] - s.x, mp.snap.T[2] - s.z) < 1.2 || mp.snap.fx[0] > 0); t += this.dt) yield;
    } finally {
      if (mp) mp.localTeacher = false;
      this.localScare = false;
      if (mp && !told) mp.send({ t: 'press', k: 'scareDone' });
    }
  },

  *scLocal(id) {
    this.scLocalOn = true;
    try {
      if (id === 'pencil') yield* this.scPencilScene();
      else if (id === 'wrongseat') yield* this.scWrongSeat();
      else if (id === 'sprint') yield* this.scSprint();
      else if (id === 'hanging') yield* this.scHanging();
      else if (id === 'window') yield* this.scWindow();
      else if (id === 'fakebell') yield* this.scFakeBell();
      else if (id === 'flash') yield* this.scFlash();
      else if (id === 'shoulder') yield* this.scShoulder();
      else if (id === 'underdesk') yield* this.scUnderDesk();
      else if (id === 'note') yield* this.scNote();
      else if (id === 'stare') yield* this.scStare();
      else if (id === 'lunge') yield* this.scLungeScene();
      else if (id === 'watch' && this.players.find((p) => p.id === 'host')) yield* this.scWatch(this.players.find((p) => p.id === 'host'), SCARES.len.pencil + SCARES.wait.pencil + 2); // (the host is the victim, until the host says it is over: mp.js 'scareDone')
    } finally {
      this.scLocalOn = false;
      if (id !== 'flash') this.scEnd();
    }
  },

  /** put everything back (also when a scene is cut short) */
  scEnd() {
    const T = this.teacher, W = this.world;
    T.root.rotation.x = 0; T.root.rotation.z = 0; T.root.position.y = 0; T.root.visible = true;
    T.jawTarget = 0; T.jitter = 0; T.eyeGlow = 0.12; T.faceGlow = 0.08; T.owl = false;
    T.leanTarget = T.crouchTarget = T.stanceTarget = T.rollTarget = T.stretchTarget = 0;
    T.lean = T.crouch = T.stance = 0;
    T.setPose('rest'); T.lookAt(null, 3);
    for (const f of this.friends) if (f.scHidden) { f.root.visible = true; f.scHidden = false; }
    if (this.scDoor) { W.door.openTarget = 0; this.scDoor = false; }
    this.scShowFake(null);
    // (the blackout itself is reset too, not only its target: the target is only followed while frames are drawn)
    W.setMaster(1); this.blackoutTarget = 0; this.blackout = 0; this.underLight = 0;
    this.audio.fadeBus('amb', 1, 1.5);
    for (const tx of Object.values(SCARES.texts)) this.ui.clearHint(tx); // (F4: a bait tip still up, "Look behind you", goes with the scene)
  },

  // ------------------------------------------------------------- small helpers
  scUi(fn, ...a) { const f = this.ui[fn]; return (f.local || f).apply(this.ui, a); },
  scPlay(name, o = {}) { return this.audio.play(name, { ...o, local: true }); },
  /** his voice, only on this screen */
  scTeacherSay(id, pos, { whisper = false, ear = null, vol } = {}) {
    const meta = this.audio.voices[id];
    const h = this.audio.say(id, { pos, ref: whisper ? 0.4 : 2, vol: vol ?? (whisper ? 1.45 : 1.35), reverb: 0.05, ear, local: true });
    if (meta) this.scUi('subtitle', '', `<i>${meta.text}</i>`, 'teacher', (h ? h.duration : 2) + 0.6);
    return h;
  },
  /** Sam or Nora whispers, only on this screen (the voice comes from their seat, even if it isn't them) */
  scFriendSay(f, id, vol = 1.15) {
    if (!f || f.gone) return null;
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: f.headWorld(_c), ref: 1.0, reverb: 0.08, vol, local: true });
    if (f.root.visible) f.talking = h ? h.duration : 1.5;
    this.scUi('subtitle', f.name, meta.text, '', (h ? h.duration : 2) + 0.6);
    return h;
  },
  scFriend(kind) { const f = this.friend(kind); return f && !f.gone ? f : null; },

  /** lights out for a moment: when they come back he is gone from the front */
  *scVanish(dark = 0.5) {
    const W = this.world, T = this.teacher;
    for (const b of W.lights.banks) if (!b.dead) b.flicker = 0.5;
    this.scPlay('zap', { vol: 0.7 });
    yield* this.wait(0.35);
    W.setMaster(0.06); this.scPlay('lights_off', { vol: 0.8 });
    yield* this.wait(dark);
    T.root.visible = false; T.setPose('rest');
    W.setMaster(SCARES.dim);
  },

  /** blackout, then he is back at the front and the lights are on */
  *scBlackoutBack(dark = 0.8) {
    const W = this.world, T = this.teacher;
    W.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
    this.scPlay('lights_off', { vol: 0.9 });
    yield* this.wait(dark * 0.5);
    T.root.rotation.z = 0; T.root.position.y = 0; T.jawTarget = 0; T.jitter = 0; T.eyeGlow = 0.12; T.faceGlow = 0.08;
    T.leanTarget = T.crouchTarget = T.stanceTarget = T.rollTarget = 0; T.lean = T.crouch = T.stance = 0;
    T.setPose('rest'); T.place(0.2, -5.4, 0); T.root.visible = true; T.lookAt(this.camPos, 3);
    this.underLight = 0;
    yield* this.wait(dark * 0.5);
    W.setMaster(1); this.blackoutTarget = 0; this.blackout = 0;
  },

  /** he stands right in front of whatever you are looking at, his face at the height of yours */
  scFaceFront(dist, { pose = 'grab', headY = null } = {}) {
    const T = this.teacher;
    const dir = new V(this.camFwd.x, 0, this.camFwd.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    T.root.visible = true; T.root.rotation.z = 0; T.root.position.y = 0;
    T.place(this.camPos.x + dir.x * dist, this.camPos.z + dir.z * dist, Math.atan2(-dir.x, -dir.z));
    T.setPose(pose); T.lookAt(this.camPos, 80);
    T.update(0.016, {});
    T.root.position.y = (headY ?? this.camPos.y) - T.headWorld(_b).y + 0.04;
    return dir;
  },

  /** the hit: a scream, a stab, the room shakes, his FACE lunges from `from` to `to` metres in front of you along `dir` */
  *scLunge(dir, { from = SCARES.lunge[0], to = SCARES.lunge[1], dur = SCARES.lunge[2], scream = true, drop = 0 } = {}) {
    const T = this.teacher;
    // (he leans in: his face is nearer than his feet; the distances are for his face)
    const h = T.headWorld(_b), off = Math.hypot(T.pos.x - this.camPos.x, T.pos.z - this.camPos.z) - Math.hypot(h.x - this.camPos.x, h.z - this.camPos.z);
    T.jawTarget = 0.8; T.jitter = 0.5; T.eyeGlow = 3; T.faceGlow = 0.85;
    this.world.setMaster(0.3); this.blackoutTarget = 0; this.blackout = 0;
    if (scream) this.scPlay('scream', { vol: 1.4, reverb: 0.15 });
    this.scPlay('stab', { vol: 1.25, reverb: 0 });
    this.scPlay('sub_hit', { vol: 1.1, reverb: 0 });
    this.redFlash = 1; this.underLight = 1; this.shake = 0.85; this.glitch = 0.32; this.scareFear = 1;
    const y0 = T.root.position.y;
    let t = 0;
    while (t < dur) {
      t += this.dt;
      const k = Math.min(1, t / dur), d = lerp(from, to, k);
      T.pos.x = this.camPos.x + dir.x * (d + off); T.pos.z = this.camPos.z + dir.z * (d + off);
      T.root.position.y = y0 - drop * k;
      yield;
    }
  },

  /** you never looked: you hear it coming, then he is in your face anyway */
  *scComesAnyway() {
    this.scPlay('rev_scream', { vol: 1.0 });
    yield* this.wait(1.75);
    const dir = this.scFaceFront(SCARES.lunge[0]);
    yield* this.scLunge(dir);
    yield* this.wait(0.9);
  },

  /** the hit when you find him: the stab, the shake, his eyes */
  scSting(k = 1) {
    this.scPlay('stab', { vol: 1.2 * k });
    this.scPlay('sub_hit', { vol: 0.9 * k });
    this.scareFear = 1; this.shake = Math.max(this.shake, 0.45 * k);
  },

  *scWaitLook(pos, cos, secs, every = null) {
    let t = 0, next = every ? every[0] : 1e9;
    while (t < secs) {
      if (this.lookingAt(pos, cos)) return true;
      t += this.dt;
      if (t > next) { next += every[0]; every[1](); }
      yield;
    }
    return false;
  },

  // ------------------------------------------------------------- 1. the pencil
  // Your pencil rolls off your desk. Look down to find it: his face is coming up out of the floor next to it.
  *scPencilScene() {
    const T = this.teacher, P = this.scPencil, eye = this.me.eye;
    const side = this.scFriend('nora') ? 1 : -1; // (falls on the side of a friend, so the friend sees it)
    const top = new V(eye.x + side * 0.1, 0.755, eye.z - 0.5);
    const edge = new V(eye.x + side * 0.34, 0.755, eye.z - 0.52);
    const floor = new V(eye.x + side * 0.5, 0.012, eye.z - 0.34);
    P.visible = true; P.position.copy(top); P.rotation.set(0, 0.3, 0);
    T.faceTo(Math.PI, 3); T.lookAt(null, 3); // (his back to the class)
    this.scPlay('pencil_roll', { pos: top, vol: 1.0, ref: 1.2 });
    // it rolls to the edge, falls, bounces on the floor
    let t = 0;
    while (t < 1.42) {
      t += this.dt;
      if (t < 0.12) { /* the drop on the desk */ } else if (t < 1.05) {
        const k = (t - 0.12) / 0.93;
        P.position.lerpVectors(top, edge, k * (2 - k));
        P.rotation.x += this.dt * 18 * (1 - k * 0.6);
      } else {
        const k = (t - 1.05) / 0.37;
        P.position.set(lerp(edge.x, floor.x, k), lerp(edge.y, floor.y, k * k), lerp(edge.z, floor.z, k));
        P.rotation.z += this.dt * 9;
      }
      yield;
    }
    P.position.copy(floor); P.rotation.set(0, 1.1, 0);
    this.audio.fadeBus('amb', 0.3, 4);
    yield* this.wait(0.5);
    const sam = this.scFriend('sam');
    if (sam) this.scFriendSay(sam, 's_pencil');
    if (!this.scPencilHint) { this.scPencilHint = true; this.scUi('hint', this.input.touch ? SCARES.hintTouch : SCARES.hint, 6); }
    const looked = yield* this.scWaitLook(floor, 0.9, SCARES.wait.pencil);
    if (looked) {
      // his head and shoulders, up out of the floor right next to it, looking up at you
      yield* this.scFloorFace(floor.x + side * 0.22, floor.z - 0.12);
      P.visible = false;
      yield* this.wait(1.7);
    } else {
      P.visible = false;
      yield* this.scComesAnyway();
    }
    // the lights: he is at the front, and your pencil is back on your desk
    P.visible = true; P.position.copy(top); P.rotation.set(0, -0.4, 0);
    yield* this.scBlackoutBack(0.4);
  },

  /** his head and shoulders, up out of the floor at x, z, looking up at you; then the dark and "Found... you." (the pencil, under the desk) */
  *scFloorFace(hx, hz, y = 0.46) {
    const T = this.teacher;
    T.root.visible = true; T.root.rotation.z = 0; T.root.position.y = 0;
    T.place(hx, hz, Math.atan2(this.camPos.x - hx, this.camPos.z - hz));
    T.setPose('grab'); T.lookAt(this.camPos, 80); T.rollTarget = 0.5;
    T.update(0.016, {});
    T.root.position.y = y - T.headWorld(_b).y;
    T.eyeGlow = 1.6; T.faceGlow = 0.35; T.jawTarget = 0.3; T.jitter = 0.25;
    this.scSting();
    yield* this.wait(0.4);
    T.jitter = 0; T.rollTarget = 0.9;
    yield* this.wait(0.7);
    this.world.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
    this.scPlay('lights_off', { vol: 0.9 });
    T.root.visible = false;
    this.scTeacherSay('tw_found', _a.set(0, 0.04, 0.35).applyQuaternion(this.camera.quaternion).add(this.camPos), { whisper: true, ear: [0, 0.04, 0.35] });
  },

  // ------------------------------------------------------------- 2. the wrong seat (solo)
  // He vanishes from the front. Then your friend whispers "Psst! Over here!" You turn... it is HIM in their seat.
  *scWrongSeat() {
    const T = this.teacher;
    const fr = this.friends.filter((f) => !f.gone && f.root.visible);
    if (!fr.length) { yield* this.scComesAnyway(); return; }
    // (the one you are not looking at: you must not see the swap)
    const hidden = fr.filter((f) => !this.lookingAt(f.headWorld(_a), 0.35));
    const f = hidden.length ? (hidden.find((x) => x.kind === 'nora') || hidden[0]) : fr[0];
    const other = fr.find((x) => x !== f);
    yield* this.scVanish(0.6);
    this.audio.fadeBus('amb', 0.2, 2);
    if (other && other.kind === 'sam') { this.scFriendSay(other, 's_where'); yield* this.wait(1.8); } else yield* this.wait(1.2);
    // swap: he sits in their chair, folded down to their height, turned to you
    f.root.visible = false; f.scHidden = true;
    const sx = f.seat.x, sz = f.seat.z + 0.03;
    T.root.visible = true; T.root.rotation.z = 0; T.root.position.y = 0;
    T.place(sx, sz, Math.atan2(this.camPos.x - sx, this.camPos.z - sz));
    T.setPose('rest');
    T.crouchTarget = T.crouch = 0.34; T.leanTarget = T.lean = 0.35;
    T.lookAt(this.camPos, 6); T.rollTarget = 0.35;
    T.update(0.016, {});
    T.root.position.y = 1.12 - T.headWorld(_b).y;
    T.eyeGlow = 0.9; T.faceGlow = 0.25;
    const head = T.headWorld(new V());
    const psst = f.kind === 'nora' ? 'n_psst' : 's_psst';
    this.scFriendSay(f, psst);
    const looked = yield* this.scWaitLook(head, 0.9, SCARES.wait.wrongseat, [6, () => this.scFriendSay(f, psst, 0.8)]);
    if (looked) {
      this.scSting();
      T.jawTarget = 0.25;
      yield* this.wait(0.8);
      this.scTeacherSay('t_wrongseat', head);
      yield* this.wait(1.5);
      for (const b of this.world.lights.banks) if (!b.dead) b.flicker = 0.6;
      yield* this.wait(0.5);
      this.world.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
      yield* this.wait(0.6);
      f.root.visible = true; f.scHidden = false;
      yield* this.scBlackoutBack(0.3);
      yield* this.wait(0.6);
      this.scFriendSay(f, f.kind === 'nora' ? 'n_stare' : 's_stare');
      yield* this.wait(2.2);
    } else {
      f.root.visible = true; f.scHidden = false;
      T.root.visible = false;
      yield* this.scComesAnyway();
      yield* this.scBlackoutBack(0.6);
    }
  },

  // ------------------------------------------------------------- 3. the sprint
  // He vanishes. The door creaks open on the black corridor. Two eyes. Then he RUNS at you.
  *scSprint() {
    const T = this.teacher, W = this.world;
    yield* this.scVanish(0.5);
    const sam = this.scFriend('sam');
    if (sam) this.scFriendSay(sam, 's_where');
    yield* this.wait(1.6);
    this.audio.fadeBus('amb', 0.15, 2.5);
    W.door.openTarget = 1; this.scDoor = true;
    this.scPlay('door_creak', { pos: W.door.pos, vol: 1.2, ref: 2.5 });
    yield* this.wait(1.3);
    const nora = this.scFriend('nora');
    if (nora) this.scFriendSay(nora, 'n_door');
    const doorway = new V(ROOM.x1 - 0.2, 1.4, W.doorZ);
    const looked = yield* this.scWaitLook(doorway, 0.93, SCARES.wait.sprint);
    if (looked) yield* this.wait(1.0); // (the black doorway. Nothing. Nothing.)
    // two eyes in the dark doorway
    const dx = ROOM.x1 - 0.4, dz = W.doorZ;
    T.root.visible = true; T.root.rotation.z = 0; T.root.position.y = 0;
    T.place(dx, dz, Math.atan2(this.camPos.x - dx, this.camPos.z - dz));
    T.setPose('rest'); T.lookAt(this.camPos, 30);
    T.eyeGlow = 2.6; T.faceGlow = 0.04;
    W.setMaster(0.32);
    yield* this.wait(looked ? 0.6 : 0.1);
    // he runs at you: across the front of the room, then down the aisle next to your desk (never through the desks)
    this.scPlay('run_steps', { vol: 1.3 });
    const eye = this.me.eye;
    const aisle = eye.x + (eye.x < 2.9 ? 0.75 : -0.75);
    const legs = eye.z < -1 ? [[eye.x, eye.z - 1.4]] : [[aisle, -2.95], [aisle, eye.z - 0.3]];
    T.leanTarget = 0.25;
    let t = 0;
    for (const [x, z] of legs) {
      T.moveTo(x, z, SCARES.runSpeed);
      while (t < 3 && T.moving && Math.hypot(T.pos.x - this.camPos.x, T.pos.z - this.camPos.z) > 1.35) {
        t += this.dt; T.lookAt(this.camPos, 30); yield;
      }
    }
    T.moveTarget = null;
    // in your face, wherever you look
    const dir = this.scFaceFront(SCARES.lunge[0]);
    yield* this.scLunge(dir);
    yield* this.wait(0.9);
    W.door.openTarget = 0; this.scDoor = false;
    yield* this.scBlackoutBack(0.7);
  },

  // ------------------------------------------------------------- 4. the hanging
  // Something drips on your desk. The lights die. When they come back he hangs upside down from the ceiling,
  // right in front of you, his face at yours. He sways. His mouth opens. Then he drops at you.
  *scHanging() {
    const T = this.teacher, W = this.world, eye = this.me.eye;
    const desk = new V(eye.x, 0.76, eye.z - 0.5);
    this.audio.fadeBus('amb', 0.2, 2);
    for (const at of [0.3, 1.3, 1.0]) { yield* this.wait(at); this.scPlay('drip', { pos: desk, vol: 1.0, ref: 1.2 }); }
    yield* this.wait(1.1);
    W.setMaster(0); this.blackoutTarget = 0.97;
    this.scPlay('lights_off', { vol: 1.0 });
    yield* this.wait(0.7);
    this.scPlay('rope_creak', { pos: _a.set(eye.x, 2.9, eye.z - 1.0), vol: 1.1, ref: 1.5 });
    yield* this.wait(1.0);
    // hanging upside down in front of you (his feet on the ceiling, his face at yours)
    const dir = new V(this.camFwd.x, 0, this.camFwd.z);
    if (dir.lengthSq() < 1e-4) dir.set(0, 0, -1);
    dir.normalize();
    const d0 = 0.95;
    T.root.visible = true; T.root.rotation.z = Math.PI; T.root.position.y = ROOM.h + 0.12;
    T.place(this.camPos.x + dir.x * d0, this.camPos.z + dir.z * d0, Math.atan2(-dir.x, -dir.z));
    T.setPose('rest'); T.lookAt(null, 3); T.rollTarget = 0;
    T.update(0.016, {});
    T.root.position.y += this.camPos.y + 0.02 - T.headWorld(_b).y;
    T.eyeGlow = 1.6; T.faceGlow = 0.3;
    W.setMaster(0.45); this.blackoutTarget = 0; this.blackout = 0;
    W.lights.banks.forEach((b) => { if (!b.dead) b.flicker = 1.4; });
    this.scPlay('sub_hit', { vol: 0.95 });
    this.scareFear = Math.max(this.scareFear, 0.85);
    // he sways; his mouth opens, slowly
    let t = 0;
    while (t < 1.9) {
      t += this.dt;
      T.root.rotation.z = Math.PI + Math.sin(t * 2.3) * 0.05;
      T.jawTarget = Math.min(0.75, t * 0.45);
      if (t > 0.9 && t - this.dt <= 0.9) this.scPlay('rope_creak', { pos: T.headWorld(_a), vol: 0.9, ref: 1.2 });
      yield;
    }
    // he drops at you
    T.setPose('grab');
    yield* this.scLunge(dir, { from: d0, to: 0.4, drop: 0.12 });
    yield* this.wait(0.8);
    yield* this.scBlackoutBack(0.8);
    this.scPlay('drip', { pos: desk, vol: 0.8, ref: 1.2 });
  },

  // ------------------------------------------------------------- 5. the window
  // The rain stops. Three knocks on the window. "Let... me... in." You look... nothing... then he slams into the glass.
  *scWindow() {
    const T = this.teacher, W = this.world;
    // the window in front of you on the left (the nearest one ahead of your seat)
    const wz = WINDOWS.reduce((b, z) => (Math.abs(z - (this.camPos.z - 0.6)) < Math.abs(b - (this.camPos.z - 0.6)) ? z : b), WINDOWS[0]);
    const win = new V(ROOM.x0 + 0.05, 1.75, wz);
    yield* this.scVanish(0.4);
    this.audio.fadeBus('amb', 0.1, 1.2); // the rain stops
    yield* this.wait(1.6);
    this.scPlay('knock_glass', { pos: win, vol: 1.3, ref: 2.5 });
    yield* this.wait(2.4);
    const nora = this.scFriend('nora');
    if (nora) { this.scFriendSay(nora, 'n_knock'); yield* this.wait(1.6); }
    this.scTeacherSay('tw_letmein', win, { whisper: true, vol: 1.1 });
    const looked = yield* this.scWaitLook(win, 0.92, SCARES.wait.window, [6, () => this.scPlay('knock_glass', { pos: win, vol: 1.6, ref: 2.5 })]);
    if (looked) yield* this.wait(1.1); // (the rain on the glass. Nothing.)
    // BANG: his face and hands against the glass, in a flash of lightning
    T.root.visible = true; T.root.rotation.z = 0; T.root.position.y = 0;
    T.place(ROOM.x0 - 0.16, wz, Math.PI / 2);
    T.setPose('grab'); T.lookAt(this.camPos, 30);
    T.leanTarget = T.lean = 0.2;
    T.update(0.016, {});
    T.root.position.y = 1.72 - T.headWorld(_b).y;
    T.eyeGlow = 3; T.faceGlow = 1.5; T.jawTarget = 0.5;
    W.flash(1);
    this.scPlay('glass_bang', { pos: win, vol: 1.6, ref: 3 });
    this.scPlay('stab', { vol: 1.1 });
    this.scareFear = 1; this.shake = 0.55;
    yield* this.wait(0.45);
    W.flash(0.8);
    yield* this.wait(0.55);
    W.setMaster(0.1); this.scPlay('zap', { vol: 0.8 });
    T.root.visible = false;
    yield* this.wait(0.6);
    yield* this.scBlackoutBack(0.3);
  },

  // ------------------------------------------------------------- 6. the fake bell
  // The bell rings and "PERIOD COMPLETE" comes up, like it always does... then it tears, and he is right there.
  *scFakeBell() {
    const W = this.world;
    this.audio.fadeBus('amb', 0.4, 1);
    this.scPlay('bell_bend', { pos: BELL, vol: 1.2, ref: 3, reverb: 0.4 });
    yield* this.wait(1.0);
    const F = SCARES.fake;
    const [title, text] = this.mode === 'free' ? F.free : F.story[this.chapter] || F.free;
    this.scShowFake({ title, text, next: this.mode === 'story' && this.chapter < 3 ? F.next[0] : F.next[1] });
    yield* this.wait(2.5);
    // it tears
    this.scShowFake({ title: F.tear, text: '', next: '', tear: true });
    this.scPlay('glitch', { vol: 0.9 });
    this.glitch = 0.6;
    yield* this.wait(0.8);
    this.scShowFake(null);
    const dir = this.scFaceFront(SCARES.lunge[0]);
    yield* this.scLunge(dir);
    yield* this.wait(0.9);
    yield* this.scBlackoutBack(0.8);
    W.setMaster(1);
  },

  // ------------------------------------------------------------- 8. the shoulder (F4)
  // He vanishes. A breath right behind you, a jolt. You turn around... he is right there: "I am... behind you."
  *scShoulder() {
    yield* this.scVanish();
    this.scPlay('dread_breath', { pos: new V(0, 0, 0.4).applyQuaternion(this.camera.quaternion).add(this.camPos) });
    this.bonkShake = 0.15;
    if (!this.scShoulderHint) { this.scShoulderHint = true; this.scUi('hint', SCARES.texts.shoulder, 6); }
    const back = () => Math.abs(this.yaw) > 2.2;
    yield* this.until(back, SCARES.wait.shoulder);
    if (back()) {
      const dir = this.scFaceFront(0.8);
      yield* this.scLunge(dir);
      yield* this.waitVoice(this.scTeacherSay('tw_behind', this.teacher.headWorld(new V()), { whisper: true }));
    } else yield* this.scComesAnyway();
    yield* this.scBlackoutBack(0.4);
  },

  // ------------------------------------------------------------- 9. under your desk (F4)
  // A chair scrapes at your feet (online, first a friend "whispers": look under your desk. They never did).
  // Look down: his face comes up out of the floor under your desk, like the pencil.
  *scUnderDesk() {
    const eye = this.me.eye, floor = new V(eye.x, 0.012, eye.z - 0.4); // (the floor under the front edge of your desk)
    const others = this.players.filter((p) => p !== this.me && !p.out && !(p.slipK > 0) && !p.ghost); // (only a friend still in their chair can "whisper"; nobody: the solo start)
    let wh = null;
    try {
      if (this.mp && others.length) {
        this.scUi('subtitle', pick(others).name, SCARES.texts.fake, 'you', 3);
        wh = this.scPlay('whispers_loop', { loop: true, vol: 0.8 });
        yield* this.wait(1.5);
        if (wh) wh.stop(0.3);
        wh = null;
      }
      this.scPlay('chair_scrape', { pos: floor, vol: 0.5 });
      this.bonkShake = 0.2;
      this.scUi('hint', SCARES.texts.underdesk, 6);
      const looked = yield* this.scWaitLook(floor, 0.9, SCARES.wait.underdesk);
      if (looked) { yield* this.scFloorFace(floor.x + 0.2, floor.z + 0.2, 0.15); yield* this.wait(1.7); } else yield* this.scComesAnyway(); // (his face low, between your chair and the desk: the desk top and its book box would hide it)
      yield* this.scBlackoutBack(0.4);
    } finally {
      if (wh) wh.stop(0.3);
    }
  },

  // ------------------------------------------------------------- 10. the note (F4)
  // A note: "DON'T LOOK LEFT". The lights go. Look left: he is crouched in the aisle, his face at yours.
  *scNote() {
    let open = false;
    try {
      this.scPlay('paper', { vol: 1.0 });
      this.scUi('showNote', SCARES.texts.note); open = true;
      yield* this.until(() => !this.ui.noteOpen, 6);
      if (this.ui.noteOpen) this.ui.closeNote();
      yield* this.scVanish();
      const left = () => this.yaw > 0.9;
      yield* this.until(left, SCARES.wait.note);
      if (left()) {
        const dir = this.scFaceFront(0.9);
        yield* this.scLunge(dir);
        yield* this.waitVoice(this.scTeacherSay('t_wrongseat', this.teacher.headWorld(new V())));
      } else {
        this.scUi('showNote', SCARES.texts.noteLate);
        yield* this.wait(1);
        this.ui.closeNote();
        yield* this.scComesAnyway();
      }
      yield* this.scBlackoutBack(0.4);
    } finally {
      if (open && this.ui.noteOpen) this.ui.closeNote();
    }
  },

  // ------------------------------------------------------------- 11. the stare (F4)
  // The slow one. He stares at you from the front, eyes glowing, no footsteps. While you look at him he stands still;
  // look away (or at your phone) and he walks to your desk. Hold his stare long enough and he gives up.
  // Online the host runs it for a friend too (everybody sees him come); only the lunge is on the friend's screen.
  *scStare(v = this.me) {
    const T = this.teacher, S = SCARES.stare, s = this.deskSpot(v), here = () => this.players.includes(v);
    try {
      T.moveTarget = null;
      if (Math.hypot(T.pos.x - 0.2, T.pos.z + 5.4) > 0.5) yield* this.blinkTo(0.2, -5.4, 0, 0.5); // (he stares from the front: his walk from there is clear of the desks)
      T.root.visible = true; T.setPose('rest');
      T.facePoint(v.camPos, 3); T.lookAt(v.camPos, 4);
      T.eyeGlow = 1.2; T.lensGlow = 4; this.dreadSilent = true; // (lensGlow: his glasses glow over his eyes, clear from the back of a dark class; the eyes' own glow is a thin rim)
      this.uiTo(v, 'hint', SCARES.texts.stare, 6);
      for (const q of this.players) if (q !== v) this.uiTo(q, 'hint', SCARES.texts.stareOthers.replace('{name}', v.name), 6);
      const legs = [s.approach, s.stand];
      let leg = 0, held = 0;
      while (leg < legs.length && held < S.giveUp) {
        if (!here()) { yield* this.scBlackoutBack(0.4); return; } // (the friend left: he goes back in the dark)
        const looking = !v.phoneUp && v.camFwd.dot(_a.subVectors(T.headWorld(_b), v.camPos).normalize()) > S.look;
        if (looking) { T.moveTarget = null; held += this.dt; } // (frozen)
        else if (!T.moving) {
          if (Math.hypot(T.pos.x - legs[leg].x, T.pos.z - legs[leg].z) < 0.05) leg++;
          if (leg < legs.length) T.moveTo(legs[leg].x, legs[leg].z, S.speed);
        }
        T.facePoint(v.camPos, 3);
        yield;
      }
      T.moveTarget = null; T.lensGlow = 0; // (the stare is over: no glowing glasses in his lunge)
      if (held >= S.giveUp) {
        // you won: he gives up and walks back
        this.mischief += 30; this.note(v, 'stare_held');
        T.eyeGlow = 0.12; this.dreadSilent = false;
        yield* this.say('tw_dr_looking', 0.3);
        yield* this.walk(0.2, -5.4);
      } else if (v.local) {
        const dir = this.scFaceFront(0.8);
        yield* this.scLunge(dir);
        yield* this.wait(0.9);
      } else {
        // a friend: bent over their chair for the others, the lunge on the friend's own screen (mp.js 'gscare')
        T.place(s.stand.x, s.stand.z, s.face); T.setPose('desk', s.corners); T.leanTarget = 0.9; T.lookAt(v.camPos, 8);
        v.scareDone = -1;
        const t0 = this.t;
        this.mp.toPlayer(v, { t: 'gscare', k: 'lunge' });
        yield* this.until(() => v.scareDone >= t0 || !here(), 2.5);
      }
      yield* this.scBlackoutBack(0.4);
    } finally {
      T.moveTarget = null; this.dreadSilent = false; T.eyeGlow = 0.12; T.lensGlow = 0;
    }
  },

  /** the tiny one: his face in yours, then the lights (the stare's end on a friend's screen; F5) */
  *scLungeScene() {
    const dir = this.scFaceFront(0.8);
    yield* this.scLunge(dir);
    yield* this.wait(0.9);
    yield* this.scBlackoutBack(0.4);
  },

  /** the fake end screen (null hides it) */
  scShowFake(o) {
    const el = this.scFakeEl;
    if (!el) return;
    if (!o) { el.classList.add('hidden'); el.classList.remove('tear'); document.body.classList.remove('fake-ending'); return; }
    el.querySelector('.fe-title').textContent = o.title;
    el.querySelector('.fe-text').innerHTML = o.text;
    const b = el.querySelector('.fe-next');
    b.textContent = o.next; b.classList.toggle('hidden', !o.next);
    el.classList.toggle('tear', !!o.tear);
    el.classList.remove('hidden');
    document.body.classList.add('fake-ending');
  },

  // ------------------------------------------------------------- 7. the face flash
  // His face fills the screen for a blink, with a tick of noise. Then nothing.
  *scFlash() {
    if (this.cutscene) return;
    const el = this.scFlashEl;
    if (el) el.classList.add('on');
    this.scPlay('flash_tick', { vol: 1.1 });
    this.scareFear = Math.max(this.scareFear, 0.6); this.glitch = Math.max(this.glitch, 0.4);
    yield* this.wait(SCARES.flashDur);
    if (el) el.classList.remove('on');
  },
};

/** every new scare's id (tests) */
export const scareIds = () => Object.keys(SCARES.pool);
