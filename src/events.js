// A different teacher every class (mixed into Game), part 1: the setup and the event deck.
// Every class starts from ONE seeded setup (classSetup): it draws 3-4 events from the deck and his
// 2 quirks (src/quirks.js). The same seed always gives the same class (the daily challenge uses it).
// The events:
//  - ringtone: his embarrassing ringtone. He takes the call with his back to the class.
//  - fly: a fly he hunts: he follows it with his eyes and slaps the desk it lands on (maybe yours).
//    Hit it with a paper ball and he thanks you.
//  - pizza: a pizza delivery at the door (for Mr. Hale). He eats a slice, staring at you.
//  - firedrill: a false fire alarm: so loud he can't hear anything, but he still sees.
//  - leave: he leaves the room for 30 seconds. Chaos. His face in the door window. Footsteps.
// In story periods an event only starts in one of the period's quiet windows (eventSlot), never in
// a scripted moment; in Free Class (and online) the director starts them at the setup's times.
// The host (or solo game) runs them for everybody; friends see the props through the snapshots.
import * as THREE from 'three';
import { clamp, damp, rand, pick, chance, seededRng, hashStr, Bag } from './util.js';
import { CLASS_SETUP, EVENTS, QUIRKS, SLANG_USE, FREE_LENGTH, MEMES } from './data.js';

const V = THREE.Vector3;
const _a = new V(), _b = new V(), _c = new V();
const r2 = (x) => Math.round(x * 100) / 100;
const PIZZA_DESK = { x: -2.55, y: 0.785, z: -5.3, ry: 0.15 };
const WINDOW_OUT = new V(-5.6, 1.9, -0.9);   // where the fly leaves through the window
const PIZZA_STATES = ['none', 'held', 'desk'];
const ALARM_AT = new V(3.4, 2.7, -6.7);      // the fire bell, over the door
const CHATTER_AT = new V(0, 1.2, 0.6);       // the class, talking all at once
// sounds every screen plays by itself from the class's state (so a friend who joins late hears them too)
const LOOPS = ['flySnd', 'humSnd', 'ringSnd', 'alarmSnd', 'danceSnd', 'chatterSnd'];
const HINT_READ = 3.2;   // seconds a hint stays up before the next one may replace it

/**
 * The class setup: which events and quirks this class has, from one seed.
 * force: { events, quirks } replaces the draw (tests, and later a hand-made challenge).
 * Returns { seed, mode, chapter, where, events, quirks, deafSide, plan (Free Class times), slots (story windows) }.
 */
export function classSetup(seed, mode = 'free', chapter = 0, force = {}) {
  seed = (Number(seed) >>> 0) || 1;
  const where = mode === 'story' ? 'p' + (clamp(chapter | 0, 0, 3) + 1) : 'free';
  const r = seededRng(seed ^ hashStr(where));
  const draw = (table, n) => {
    const pool = Object.keys(table).filter((k) => table[k].in.includes(where));
    const out = [];
    while (out.length < n && pool.length) {
      let tot = 0;
      for (const k of pool) tot += table[k].weight || 1;
      let x = r() * tot, i = 0;
      for (; i < pool.length - 1; i++) { x -= table[pool[i]].weight || 1; if (x <= 0) break; }
      out.push(pool.splice(i, 1)[0]);
    }
    return out;
  };
  const n = r() < CLASS_SETUP.four ? CLASS_SETUP.events[1] : CLASS_SETUP.events[0];
  let events = draw(EVENTS, n);
  let quirks = draw(QUIRKS, CLASS_SETUP.quirks);
  const deafSide = r() < 0.5 ? 'left' : 'right';
  const free = r(), story = r(); // (always drawn, so a forced list never changes the other numbers)
  if (Array.isArray(force.events)) events = force.events.filter((k) => EVENTS[k]);
  if (Array.isArray(force.quirks)) quirks = force.quirks.filter((k) => QUIRKS[k]).slice(0, 4);
  if (force.deafSide === 'left' || force.deafSide === 'right') return finish(force.deafSide);
  return finish(deafSide);

  function finish(side) {
    const plan = [], slots = new Array(CLASS_SETUP.storySlots).fill(null);
    const rp = seededRng(Math.floor(free * 4294967296));
    if (mode !== 'story') {
      const wins = CLASS_SETUP.freeWindows[events.length] || spread(events.length);
      events.forEach((id, i) => { const w = wins[i]; plan.push({ id, at: Math.round(w[0] + rp() * (w[1] - w[0])) }); });
    } else {
      const rs = seededRng(Math.floor(story * 4294967296));
      const idx = slots.map((_, i) => i);
      while (idx.length > events.length) idx.splice(Math.floor(rs() * idx.length), 1);
      idx.forEach((s, i) => { slots[s] = events[i]; });
    }
    return { seed, mode, chapter, where, events: events.slice(), quirks: quirks.slice(), deafSide: side, plan, slots };
  }
}
/** windows for an unusual number of events (a forced list): spread over the morning */
function spread(n) {
  const a = 34, b = 242, w = (b - a) / Math.max(1, n);
  return Array.from({ length: n }, (_, i) => [a + i * w, a + i * w + Math.min(24, w * 0.6)]);
}

// ---------------------------------------------------------------- the props
function makeFly() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 6), new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.45, metalness: 0.2 }));
  body.scale.set(0.8, 0.7, 1.35);
  const wingGeo = new THREE.PlaneGeometry(0.03, 0.014);
  wingGeo.translate(0.015, 0, 0);
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xd2dde6, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false });
  const wl = new THREE.Mesh(wingGeo, wingMat), wr = new THREE.Mesh(wingGeo, wingMat);
  wl.position.set(0.004, 0.008, -0.002); wr.position.set(-0.004, 0.008, -0.002); wr.rotation.y = Math.PI;
  g.add(body, wl, wr);
  g.scale.setScalar(1.4); // (a little big for a fly, so you can see it across the room)
  g.userData.wings = [wl, wr];
  g.visible = false;
  return g;
}
function makeMadiPhone() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.135, 0.011), new THREE.MeshStandardMaterial({ color: 0x1a1c1e, roughness: 0.4, metalness: 0.4 }));
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.058, 0.115), new THREE.MeshBasicMaterial({ color: 0x9cc8f0, fog: false }));
  scr.position.z = 0.0062;
  const back = scr.clone(); back.material = scr.material; back.position.z = -0.0062; back.rotation.y = Math.PI;
  g.add(body, scr, back);
  g.userData.screen = scr.material;
  return g;
}
function makeSlice() {
  const sh = new THREE.Shape();
  sh.moveTo(0, 0); sh.lineTo(-0.05, 0.13); sh.quadraticCurveTo(0, 0.148, 0.05, 0.13); sh.lineTo(0, 0);
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.008, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0xe9b64e, roughness: 0.8 }));
  m.position.set(0, -0.02, 0);
  g.add(m);
  const pep = new THREE.MeshStandardMaterial({ color: 0x8c1d12, roughness: 0.7 });
  for (const [x, y] of [[0, 0.05], [-0.02, 0.1], [0.022, 0.095]]) {
    const d = new THREE.Mesh(new THREE.CircleGeometry(0.011, 10), pep);
    d.position.set(x, y - 0.02, 0.0085);
    g.add(d);
  }
  return g;
}
function boxTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#efe6d2'; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#b3261e'; x.lineWidth = 10; x.strokeRect(12, 12, 232, 232);
  x.fillStyle = '#b3261e'; x.font = 'bold 64px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('PIZZA', 128, 104);
  x.font = 'bold 18px sans-serif'; x.fillText('HOT · FRESH · FAST', 128, 148);
  x.fillStyle = '#1c1d20'; x.font = '28px "Caveat", cursive'; x.fillText('Mr. Hale - Rm 13', 128, 200);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function pizzaTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = '#c98a3c'; x.beginPath(); x.arc(64, 64, 63, 0, 7); x.fill();
  x.fillStyle = '#efc458'; x.beginPath(); x.arc(64, 64, 54, 0, 7); x.fill();
  x.fillStyle = '#8c1d12';
  for (const [a, rr] of [[0.3, 30], [1.4, 38], [2.5, 26], [3.6, 36], [4.6, 22], [5.5, 34], [0, 0]]) { x.beginPath(); x.arc(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, 8, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(120,70,20,.5)'; x.lineWidth = 2;
  for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(64, 64); x.lineTo(64 + Math.cos(i * Math.PI / 4) * 63, 64 + Math.sin(i * Math.PI / 4) * 63); x.moveTo(64, 64); x.lineTo(64 - Math.cos(i * Math.PI / 4) * 63, 64 - Math.sin(i * Math.PI / 4) * 63); x.stroke(); }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function makePizzaBox() {
  const g = new THREE.Group();
  const card = new THREE.MeshStandardMaterial({ color: 0xd9c7a2, roughness: 0.95 });
  const top = new THREE.MeshStandardMaterial({ map: boxTexture(), roughness: 0.9 });
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.034, 0.4), card);
  bottom.position.y = 0.017;
  const pie = new THREE.Mesh(new THREE.CircleGeometry(0.175, 24), new THREE.MeshStandardMaterial({ map: pizzaTexture(), roughness: 0.85 }));
  pie.rotation.x = -Math.PI / 2; pie.position.y = 0.0355;
  // the lid hinges on the side toward the class: open, its top (with "Mr. Hale - Rm 13") faces you
  const lid = new THREE.Group();
  lid.position.set(0, 0.035, 0.2);
  const lidMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.008, 0.4), [card, card, top, card, card, card]);
  lidMesh.position.set(0, 0.004, -0.2);
  lid.add(lidMesh);
  g.add(bottom, pie, lid);
  g.userData.lid = lid;
  g.userData.open = 0;
  g.visible = false;
  return g;
}

export const EventMixin = {
  setupEvents() {
    const T = this.teacher;
    this.flyMesh = makeFly();
    this.scene.add(this.flyMesh);
    this.madiPhone = T.holdInHand(makeMadiPhone());
    this.slice = T.holdInHand(makeSlice());
    this.pizzaBox = makePizzaBox();
    this.scene.add(this.pizzaBox);
    this.pizzaHands = { L: new V(), R: new V() };
    this.netFly = null;
  },

  resetEvents() {
    this.classEvent = null; this.eventsDone = []; this.eventIdx = 0; this.eventsOn = false; this.lastEventEnd = -99; this.lessonDebt = 0;
    this.hinted = new Set();
    this.fly = null; this.netFly = null; this.netEvent = null; this.flyKilledBy = null;
    this.pizza = 'none'; this.pizzaOpen = false;
    this.alarm = 0; this.alarmOn = false; this.away = false; this.onPhone = false; this.madiRinging = false; this.wild = false;
    this.awaySaw = null; this.awayNoisy = false;
    this.msgQueue = []; this.hintQueue = []; this.hintAge = 99; this.hintSeqSeen = this.ui ? this.ui.hintSeq : 0; this.hintMine = null;
    this.extraMemes = []; this.askedAbout = [];
    for (const k of this.students || []) k.leanRollTarget = 0;
    this.hideEventProps();
  },

  /** the props out of sight and their own sounds off (a new class, back to the menu, leaving online) */
  hideEventProps() {
    if (this.flyMesh) this.flyMesh.visible = false;
    if (this.madiPhone) this.madiPhone.visible = false;
    if (this.slice) this.slice.visible = false;
    if (this.pizzaBox) { this.pizzaBox.visible = false; this.pizzaBox.userData.open = 0; this.pizzaBox.userData.lid.rotation.x = 0; }
    if (this.teacher && this.teacher.chalk) this.teacher.chalk.visible = true;
    if (this.ui && this.ui.setEventNow) this.ui.setEventNow('');
    this.stopEventLoops();
  },
  stopEventLoops() {
    for (const k of LOOPS) if (this[k]) { this[k].stop(0.1); this[k] = null; }
  },
  /** a friend's screen: nothing of the host's class is left (the class ended, back in the lobby, you left) */
  dropEventState() {
    this.netFly = null; this.netEvent = null; this.pizza = 'none'; this.pizzaOpen = false; this.alarm = 0;
    this.dozing = this.humming = this.dancing = this.away = this.onPhone = this.madiRinging = this.wild = false;
    this.hideEventProps();
  },

  /** this class's setup: random, or what start() was asked for ({ seed, events, quirks, deafSide }) */
  makeSetup(mode, chapter) {
    const o = this.nextSetup || {};
    this.nextSetup = null;
    const seed = Number.isFinite(Number(o.seed)) && o.seed !== null && o.seed !== '' ? Number(o.seed) : (Math.random() * 4294967296) >>> 0;
    return classSetup(seed, mode, chapter, o);
  },
  /** a plain copy for the network and the tests */
  setupInfo() {
    const s = this.setup || {};
    return { seed: s.seed, mode: s.mode, chapter: s.chapter, events: (s.events || []).slice(), quirks: (s.quirks || []).slice(), deafSide: s.deafSide, plan: (s.plan || []).map((x) => ({ ...x })), slots: (s.slots || []).slice() };
  },

  /** the first time something shows in this class: a hint for everybody */
  firstHint(key, html, dur = 6) {
    if (this.hinted.has(key)) return false;
    this.hinted.add(key);
    this.showHint(html, dur);
    return true;
  },
  /** a hint for everybody. The one on screen now gets a few seconds to be read first (a new hint would hide it). */
  showHint(html, dur = 6) {
    if (this.ui.hintTimer > 1.2 && this.hintAge < HINT_READ || this.hintQueue.length) { this.hintQueue.push([html, dur, 0]); return; }
    this.putHint(html, dur, 0);
  },
  putHint(html, dur, again) {
    this.ui.hint(html, dur);
    this.hintAge = 0; this.hintSeqSeen = this.ui.hintSeq;
    this.hintMine = [html, dur, again];
  },
  /** every frame: how long the hint on screen has been up; the next one in the queue when it has been read */
  pumpHints(dt) {
    const ht = this.ui.hintTimer, seq = this.ui.hintSeq || 0;
    // another hint went up over ours (a control tip, a story task), or a picker cleared it
    const over = seq !== this.hintSeqSeen, cleared = !over && this.hintMine && ht <= 0 && this.hintAge < this.hintMine[1] - 0.5;
    if (over || cleared) {
      const m = this.hintMine;
      this.hintMine = null; this.hintSeqSeen = seq;
      // one of ours had no time to be read: it comes back once, after the new one
      if (m && !m[2] && this.hintAge < HINT_READ - 0.7) this.hintQueue.unshift([m[0], m[1], 1]);
      this.hintAge = 0;
    } else this.hintAge += dt;
    if (!this.hintQueue.length || this.choice || this.cutscene) return;
    if (ht > 0.2 && this.hintAge < HINT_READ) return;
    const [h, d, again] = this.hintQueue.shift();
    this.putHint(h, d, again);
  },
  /** Sam or Nora says something about it (only while he can't catch them at it) */
  friendQuip(kind, id, delay = 0) {
    this.timers.after(delay, () => {
      const f = this.friend(kind);
      if (!f || f.gone || f.call || f.showing || this.state !== 'playing' || this.cutscene || this.anyTalkWith(f)) return;
      if (this.watching && !this.offGuard() || this.t < (f.speakUntil || 0)) return;
      this.friendSay(f, id, 0);
    });
  },
  /** the voice of somebody in the dark hallway behind the door */
  hallSay(id) {
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: _a.set(this.world.door.pos.x + 0.7, 1.55, this.world.door.pos.z).clone(), ref: 2, vol: 1.3, reverb: 0.45 });
    this.ui.subtitle('in the hallway', meta.text, '', (h ? h.duration : 2) + 0.6);
    return h;
  },

  // ---------------------------------------------------------------- when (the director)
  /** he is free for an event: no story moment, nobody being caught, he is not about to come over.
   *  soft: it may also cut into one of his reactions or habits (the phone rings while he searches the rows) */
  eventReady(soft = false) {
    if (!(this.state === 'playing' && this.present && !this.ending && !this.lockBully && !this.eventLock && !this.cutscene && !this.memeBusy && !this.classEvent
      && this.anger < 50 && this.blackout < 0.3 && this.world.master > 0.5 && !this.choice && !this.players.some((p) => p.choice)
      && this.t - this.lastEventEnd > CLASS_SETUP.freeQuiet)) return false;
    if (this.players.some((p) => p.qBusy && this.t - p.qLast < 4)) return false; // (a hand just went up: he answers that first)
    return soft || (this.ready() && !this.dozing);
  },

  /** every frame on the host / solo: Free Class starts the events at their times; the props move */
  updateEvents(dt) {
    this.updateFly(dt);
    this.eventVisuals(dt);
    this.pumpHints(dt);
    if (this.mode !== 'free' || !this.eventsOn || !this.setup) return;
    const next = this.setup.plan[this.eventIdx];
    if (!next || this.t < next.at) return;
    if (this.t + EVENTS[next.id].len > FREE_LENGTH - CLASS_SETUP.freeEnd) { this.eventIdx++; return; } // too late for this one today
    if (!this.eventReady(this.t - next.at > CLASS_SETUP.readyWait)) return; // (after a while it cuts into whatever he is doing)
    this.eventIdx++;
    this.startClassEvent(next.id);
  },

  /** story: one of the period's quiet windows. If the setup put an event here, it plays during this stretch of lesson. */
  *eventSlot(i, sec) {
    const id = this.mode === 'story' && this.setup ? this.setup.slots[i] : null;
    if (!id || this.eventsDone.includes(id)) { yield* this.lesson(sec); return; }
    // the lesson goes on while it waits for a moment when he is free; after a while, one when he is only
    // busy with you (a reaction, a habit: never a story moment). The period gets longer only by what is left of the event.
    let t = 0, w = 0, started = false;
    while (t < sec || (!started && w < CLASS_SETUP.readyWait + CLASS_SETUP.softWait)) {
      if (!this.cutscene && !this.eventLock) t += this.dt;
      w += this.dt;
      if (!started && this.eventReady(w > CLASS_SETUP.readyWait)) started = this.startClassEvent(id);
      yield;
    }
    while (this.classEvent && w < 120) { w += this.dt; yield; }
    // the event took the place of some lesson: the next quiet stretches are that much shorter (the period keeps its length)
    this.lessonDebt += Math.max(0, w - sec);
  },

  startClassEvent(id) {
    if (!EVENTS[id] || this.classEvent || this.state !== 'playing') return false;
    this.classEvent = { id, t0: this.t };
    this.eventsDone.push(id);
    this.track.global.events.push(id);
    this.track.event(this.t, null, 'classEvent', { id });
    this.idleT = 0;
    const self = this, run = this['ev_' + id]();
    this.interrupt((function* () { try { yield* run; } finally { self.endClassEvent(id); } })());
    return true;
  },
  endClassEvent(id) {
    if (!this.classEvent || this.classEvent.id !== id) return;
    this.classEvent = null;
    this.lastEventEnd = this.t;
    const m = EVENTS[id].msgs;
    if (m && m.length) this.msgQueue.push(pick(m)); // the next text on your phone is about it
  },

  // ---------------------------------------------------------------- 1. his ringtone
  *ev_ringtone() {
    const T = this.teacher, A = this.audio, E = EVENTS.ringtone;
    try {
      T.clap = null; T.setPose('rest'); T.moveTarget = null;
      this.madiRinging = true; // (the ring itself: eventVisuals, on every screen)
      this.ui.subtitle('', '♪ <i>his phone is ringing</i> ♪', 'shout', 3);
      T.lookAt(null, 3);
      yield* this.wait(0.9);
      this.addLaugh(E.laugh, T.headWorld(new V()), null); // the whole class laughs at that tune
      this.firstHint('ev:ringtone', E.hint);
      // he pats his pockets... it keeps ringing
      T.rollTarget = 0.25;
      T.lookAt(T.local(0, 0.85, 0.35, new V()), 4);
      T.setPose('hold', { L: T.local(0.22, 0.98, 0.1, new V()), R: T.local(-0.22, 0.98, 0.1, new V()) });
      this.friendQuip('sam', 's_ring', 0.6);
      yield* this.wait(1.8);
      // out comes the phone (the ringing stops), and he turns his back to take the call
      this.madiRinging = false;
      this.showMadiPhone(true);
      T.setPose('phone');
      T.rollTarget = 0.12;
      T.lookAt(null, 3);
      T.faceTo(Math.PI + (T.pos.x > 0 ? 0.5 : -0.5), 2.6);
      this.onPhone = true;
      yield* this.wait(1.0);
      this.friendQuip('nora', 'n_ring', 1.2);
      const call = this.phase >= 2 && chance(0.6) ? E.calls[2] : pick(E.calls.slice(0, 2));
      for (const step of call) {
        if (step === 'phone' || step === 'static') {
          const h = A.play(step === 'phone' ? 'phone_voice' : 'phone_static', { pos: T.handPos('R'), ref: 0.7, vol: 1.0, reverb: 0.05 });
          this.ui.subtitle('his phone', step === 'phone' ? '<i>*a tiny voice*</i>' : '<i>*static… and something breathing*</i>', 'phone', (h ? h.duration : 2) + 0.3);
          yield* this.wait((h ? h.duration : 2) + 0.25);
        } else yield* this.say(step, 0.55);
      }
      this.onPhone = false;
      // he hangs up, and it never happened
      this.showMadiPhone(false);
      T.setPose('rest'); T.rollTarget = 0;
      yield* this.turnToClass();
      yield* this.actStare(1.6);
      yield* this.say('t_ph_never', 0.6);
      this.giggle();
      // the class will not forget that tune: a class clown can play it from their phone now
      this.addMemeOnce(E.meme);
    } finally {
      this.madiRinging = false; this.onPhone = false;
      this.showMadiPhone(false);
      T.rollTarget = 0;
    }
  },

  showMadiPhone(on) {
    this.madiPhone.visible = on;
    if (!this.slice.visible) this.teacher.chalk.visible = !on;
  },

  /** a new class-clown noise for the rest of this class (his ringtone) */
  addMemeOnce(m) {
    if (!m || this.extraMemes.some((x) => x.id === m.id)) return;
    this.extraMemes.push(m);
    this.memeBag = new Bag([...MEMES, ...this.extraMemes, ...this.extraMemes]);
  },

  // ---------------------------------------------------------------- 2. the fly
  spawnFly() {
    this.fly = { pos: new V(-4.7, 1.9, rand(-3, 1)), vel: new V(1.2, 0, 0), mode: 'wander', target: new V(), wp: new V(), wpT: 0, t: 0, deadT: 0 };
    this.flyKilledBy = null;
  },
  /** host: the fly flies (wanders, lands where it was sent, escapes, leaves through the window, falls dead) */
  updateFly(dt) {
    const f = this.fly;
    if (!f) return;
    f.t += dt;
    if (f.mode === 'sit') { f.vel.set(0, 0, 0); return; }
    if (f.mode === 'dead') {
      f.vel.y -= 9.8 * dt;
      f.pos.addScaledVector(f.vel, dt);
      if (f.pos.y < 0.01) { f.pos.y = 0.01; f.vel.set(0, 0, 0); }
      if ((f.deadT += dt) > 4) this.fly = null;
      return;
    }
    let goal;
    if (f.mode === 'go') goal = f.target;
    else if (f.mode === 'leave') {
      goal = WINDOW_OUT;
      if (f.pos.x < -5.05) { this.fly = null; return; }
    } else {
      f.wpT -= dt;
      if (f.wpT <= 0 || f.pos.distanceToSquared(f.wp) < 0.1) { f.wp.set(rand(-3.9, 3.9), rand(1.1, 2.4), rand(-5.8, 3.4)); f.wpT = rand(0.7, 1.7); }
      goal = f.wp;
    }
    _a.subVectors(goal, f.pos);
    const d = _a.length();
    const sp = f.mode === 'go' ? Math.min(2.4, d * 3 + 0.25) : f.mode === 'leave' ? 3 : 2.1;
    _a.multiplyScalar(sp / (d || 1));
    if (f.mode !== 'go' || d > 0.25) _a.add(_b.set(rand(-1, 1), rand(-0.7, 0.7), rand(-1, 1)).multiplyScalar(1.6)); // flies never fly straight
    f.vel.lerp(_a, 1 - Math.exp(-5 * dt));
    f.pos.addScaledVector(f.vel, dt);
    f.pos.x = clamp(f.pos.x, -5.3, 4.85); f.pos.y = clamp(f.pos.y, 0.74, 3.0); f.pos.z = clamp(f.pos.z, -6.85, 5.8);
    if (f.mode === 'go' && f.pos.distanceTo(f.target) < 0.04) { f.mode = 'sit'; f.pos.copy(f.target); }
  },
  /** where the fly lands next: a kid's desk, a player's desk (he comes and slaps yours) or his own */
  flySpot(i) {
    const E = EVENTS.fly;
    const players = this.players.filter((p) => p.desk && !this.flyDesks.has(p.id)); // (each player's desk once a hunt)
    if (players.length && (chance(E.playerDesk) || i === 1 && !this.flyDesks.size)) {
      const p = pick(players);
      this.flyDesks.add(p.id);
      const at = new V(p.desk.x + rand(-0.14, 0.14), p.desk.top + 0.012, p.desk.z + rand(-0.08, 0.06));
      return { player: p, at };
    }
    const kids = this.allKids().filter((k) => !k.gone && k.kind === 'kid');
    if (kids.length && chance(0.8)) {
      const kid = pick(kids);
      return { kid, at: new V(kid.seat.x + rand(-0.14, 0.14), 0.75, kid.seat.z - 0.5 + rand(-0.08, 0.06)) };
    }
    return { mine: true, at: new V(-2.75 + rand(-0.3, 0.2), 0.8, -5.3 + rand(-0.1, 0.1)) };
  },
  /** he sneaks over to where it sits */
  *goToFly(spot) {
    const T = this.teacher;
    T.lookAt(this.fly ? this.fly.pos : spot.at, 5);
    if (spot.player && this.players.includes(spot.player)) {
      const s = this.deskSpot(spot.player);
      yield* this.walk(s.approach.x, s.approach.z, 0.8);
      yield* this.walk(s.stand.x, s.stand.z, 0.7);
      T.faceTo(s.face, 4);
    } else if (spot.kid) {
      const sx = spot.kid.seat.x;
      const cands = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75].filter((a) => Math.abs(Math.abs(a - sx) - 0.75) < 0.01);
      const ax = cands.reduce((b, a) => (Math.abs(a - T.pos.x) < Math.abs(b - T.pos.x) ? a : b), cands[0]);
      yield* this.walk(ax, spot.kid.seat.z - 0.45, 0.75);
      T.facePoint(spot.at, 4);
    } else {
      yield* this.walk(spot.at.x, -6.05, 0.8);
      T.faceTo(0, 4);
    }
    if (this.fly) T.lookAt(this.fly.pos, 6);
    T.leanTarget = 0.45; T.crouchTarget = 0.1;
    yield* this.wait(0.4);
  },
  /** SLAP: whoever sits there jumps */
  slapDesk(spot) {
    const A = this.audio;
    A.play('desk_slap', { pos: spot.at.clone(), vol: 1.5, ref: 2.6, reverb: 0.3 });
    this.world.chalkBurst(spot.at.clone().add(_a.set(0, 0.02, 0)), 10, 0.3);
    if (spot.kid && !spot.kid.gone) {
      const k = spot.kid;
      k.tremble = 1; k.speed = 8; k.lookTarget = this.teacher.headWorld(new V());
      if (!k.hollow) A.play('gasp', { pos: k.headWorld(new V()), vol: 0.6, ref: 1.2 });
      this.timers.after(2.4, () => { k.tremble = 0; if (!k.call) { k.lookTarget = null; k.speed = 4; } });
    } else if (spot.player && this.players.includes(spot.player)) {
      const p = spot.player;
      this.track.event(this.t, p, 'deskSlap');
      if (p.local) this.localSlap();
      else if (this.mp) this.mp.toPlayer(p, { t: 'slap' });
    }
  },
  /** he slapped YOUR desk: your view jumps */
  localSlap() {
    this.bonkShake = Math.max(this.bonkShake || 0, 0.42);
    this.scareFear = Math.max(this.scareFear, 0.5);
    (this.ui.hint.local || this.ui.hint).call(this.ui, 'He slapped <b>your</b> desk! He is right next to you: <b>not a sound</b>.', 3);
  },
  flyEscape() {
    const f = this.fly;
    if (!f) return;
    f.mode = 'wander';
    f.vel.set(rand(-1, 1), 2.6, rand(-1, 1));
    f.wp.set(rand(-3.5, 3.5), rand(1.6, 2.5), rand(-5.5, 3)); f.wpT = rand(0.8, 1.4);
  },
  killFly(by) {
    const f = this.fly;
    if (!f || f.mode === 'dead') return;
    f.mode = 'dead'; f.deadT = 0; f.vel.set(rand(-0.3, 0.3), 0.6, rand(-0.3, 0.3));
    this.audio.play('fly_splat', { pos: f.pos.clone(), vol: 0.9, ref: 1.2 });
    if (by) this.flyKilledBy = by;
  },
  /** your paper hit the fly (src/pranks.js) */
  hitFly(p, at) {
    const E = EVENTS.fly;
    this.killFly(p);
    this.note(p, 'hits'); this.note(p, 'flies');
    this.track.event(this.t, p, 'hit', { target: 'fly' });
    this.mischief += E.hitMischief;
    this.addLaugh(E.hitLaugh, at, p);
    this.completeObjective('fly');
    if (p.local) this.friendQuip('sam', 's_flyhit', 0.8);
    else this.uiTo(p, 'hint', 'You got the fly! <b>Legend.</b>', 2.5);
  },
  /** a paper can hit the fly while it is in the room */
  flyTarget() {
    if (this.role === 'guest') { const n = this.netFly; return n && n.mode !== 2 ? { type: 'fly', who: n, c: n.pos.clone(), r: 0.085 } : null; }
    const f = this.fly;
    return f && (f.mode === 'wander' || f.mode === 'go' || f.mode === 'sit') ? { type: 'fly', who: f, c: f.pos.clone(), r: 0.085 } : null;
  },

  *ev_fly() {
    const T = this.teacher, E = EVENTS.fly, touch = this.input.touch;
    this.spawnFly();
    this.flyDesks = new Set();
    try {
      T.clap = null; T.setPose('rest');
      yield* this.wait(1.4);
      if (!this.fly) return;
      // his head follows it
      T.lookAt(this.fly.pos, 5);
      yield* this.wait(1.5);
      yield* this.say('t_fly', 0.3);
      const canHit = this.prankOpen();
      this.firstHint('ev:fly', canHit ? E.hintPrank : E.hint);
      if (canHit) this.addObjective({ id: 'fly', text: touch && this.role === 'solo' ? E.taskTouch : E.task }); // (online every player has their own controls)
      this.friendQuip(chance(0.5) ? 'sam' : 'nora', chance(0.5) ? 's_fly' : 'n_fly', 1.0);
      for (let i = 0; i < E.tries; i++) {
        if (!this.fly || this.fly.mode === 'dead') break;
        if (i > 0 && this.classEvent && this.t - this.classEvent.t0 > E.maxLen) break; // (a hunt never drags on: then it gets away)
        // it lands somewhere... and stays there
        const spot = this.flySpot(i);
        this.fly.mode = 'go'; this.fly.target.copy(spot.at);
        yield* this.until(() => !this.fly || this.fly.mode !== 'go', 6);
        if (!this.fly || this.fly.mode === 'dead') break;
        if (this.fly.mode === 'go') { this.fly.mode = 'sit'; this.fly.pos.copy(spot.at); }
        yield* this.goToFly(spot);
        if (!this.fly || this.fly.mode === 'dead') break;
        // the hand goes up...
        const sw = { at: spot.at.clone(), down: false };
        T.setPose('swat', sw);
        T.lookAt(this.fly.pos, 8);
        yield* this.wait(0.95);
        if (!this.fly || this.fly.mode === 'dead') break;
        sw.down = true;
        yield* this.wait(0.13);
        this.slapDesk(spot);
        const got = i === E.tries - 1 ? chance(0.6) : chance(0.12);
        if (got) {
          this.killFly(null);
          yield* this.wait(0.7);
          T.setPose('rest'); T.leanTarget = 0; T.crouchTarget = 0;
          yield* this.say('t_fly_got', 0.5);
          break;
        }
        this.flyEscape();
        this.addLaugh(E.laugh, spot.at, null);
        yield* this.wait(0.45);
        T.setPose('rest'); T.leanTarget = 0; T.crouchTarget = 0;
        if (this.fly) T.lookAt(this.fly.pos, 5);
        yield* this.say(i === 0 ? 't_fly_still' : 't_fly_hate', 0.3);
      }
      T.setPose('rest'); T.leanTarget = 0; T.crouchTarget = 0;
      const by = this.flyKilledBy;
      if (by && this.players.includes(by)) {
        // somebody got it with a paper ball: "Thank... you."
        yield* this.wait(0.5);
        T.lookAt(by.camPos, 4); T.facePoint(by.camPos, 3);
        yield* this.wait(0.6);
        yield* this.say('t_thanks', 0.6);
      } else if (this.fly && this.fly.mode !== 'dead') {
        this.fly.mode = 'leave'; // it gets away through the window
        T.lookAt(WINDOW_OUT, 3);
        yield* this.wait(1.6);
      }
      T.lookAt(null, 3);
      yield* this.walk(rand(-1.2, 1.2), -5.4);
    } finally {
      T.setPose('rest'); T.leanTarget = 0; T.crouchTarget = 0;
      if (this.fly && T.lookTarget === this.fly.pos) T.lookAt(null, 3);
      if (this.fly && this.fly.mode !== 'dead') this.fly.mode = 'leave';
      if (!this.objDone('fly')) this.dropObjective('fly');
    }
  },

  // ---------------------------------------------------------------- 3. pizza at the door
  *ev_pizza() {
    const T = this.teacher, W = this.world, A = this.audio, E = EVENTS.pizza, door = W.door;
    let doorOpen = false;
    try {
      A.play('door_knock', { pos: door.pos.clone(), vol: 1.15, ref: 2.6, reverb: 0.3 });
      T.clap = null; T.setPose('rest');
      this.lookAllAt(door.pos);
      T.lookAt(door.pos, 2.5);
      yield* this.wait(1.6);
      this.firstHint('ev:pizza', E.hint);
      yield* this.walk(3.9, -5.0, 0.95);
      T.faceTo(Math.PI / 2, 4);
      this.lookAllBack();
      yield* this.wait(0.4);
      A.play('door_open', { pos: door.pos.clone(), vol: 1.0, ref: 2.4 });
      door.openTarget = 0.8; doorOpen = true;
      yield* this.wait(1.1);
      yield* this.waitVoice(this.hallSay('dl_pizza'), 0.4);
      yield* this.say('t_pz_order', 0.4);
      yield* this.waitVoice(this.hallSay('dl_hale'), 0.5);
      // the box is in his hands
      this.pizza = 'held';
      this.holdPizza();
      T.setPose('hold', this.pizzaHands);
      A.play('pizza_box', { pos: T.headWorld(new V()).add(_a.set(0, -0.6, 0)), vol: 0.5, ref: 1.5 });
      yield* this.wait(0.6);
      yield* this.say('t_pz_mine', 0.4);
      door.openTarget = 0; doorOpen = false;
      this.timers.after(1.0, () => A.play('door_slam', { pos: door.pos.clone(), vol: 0.4, ref: 2 }));
      this.friendQuip('nora', 'n_pizza', 0.5);
      // to his desk
      yield* this.walk(PIZZA_DESK.x - 0.05, -6.05, 0.9);
      T.faceTo(0, 4);
      yield* this.wait(0.6);
      this.pizza = 'desk';
      T.setPose('rest');
      A.play('pizza_box', { pos: new V(PIZZA_DESK.x, 0.82, PIZZA_DESK.z), vol: 0.45, ref: 1.4 });
      yield* this.wait(0.5);
      this.pizzaOpen = true;
      A.play('pizza_box', { pos: new V(PIZZA_DESK.x, 0.82, PIZZA_DESK.z), vol: 0.55, ref: 1.4, rate: 1.15 });
      for (const k of this.allKids()) if (!k.gone && !k.call && !this.anyTalkWith(k) && chance(0.6)) { k.lookTarget = this.pizzaBox.position; k.speed = 2.5; }
      this.friendQuip('sam', 's_pizza', 0.8);
      yield* this.wait(1.0);
      // a slice. Slowly. Staring at you.
      this.slice.visible = true; T.chalk.visible = false;
      T.setPose('eat');
      T.lookAt(this.cp, 3);
      for (let i = 0; i < 2; i++) {
        yield* this.wait(1.0);
        A.play('munch', { pos: T.headWorld(new V()), vol: 0.95, ref: 1.6, reverb: 0.15 });
        yield* this.wait(1.8);
      }
      this.slice.visible = false; T.chalk.visible = true;
      T.setPose('rest');
      this.lookAllBack();
      yield* this.say('t_pz_noeat', 0.4);
      this.addLaugh(E.laugh, T.headWorld(new V()), null);
      this.pizzaOpen = false;
      A.play('pizza_box', { pos: new V(PIZZA_DESK.x, 0.82, PIZZA_DESK.z), vol: 0.4, ref: 1.4 });
      yield* this.actStare(1.5);
    } finally {
      this.slice.visible = false;
      T.chalk.visible = !this.madiPhone.visible;
      if (this.pizza === 'held') this.pizza = 'desk'; // (interrupted: it lands on his desk anyway)
      this.pizzaOpen = false;
      if (doorOpen) door.openTarget = 0;
      T.setPose('rest');
    }
  },
  /** where his hands are while he carries the box */
  holdPizza() {
    const T = this.teacher;
    T.local(0.2, T.chestY - 0.27, 0.43, this.pizzaHands.L);
    T.local(-0.2, T.chestY - 0.27, 0.43, this.pizzaHands.R);
  },

  // ---------------------------------------------------------------- 4. the fire alarm
  *ev_firedrill() {
    const T = this.teacher, E = EVENTS.firedrill;
    this.fx.push(this.fxAlarm(E.alarm));
    try {
      T.clap = null; T.setPose('rest');
      yield* this.wait(0.3);
      T.lookAt(new V(T.pos.x * 0.5, 3.1, -3.5), 3); // up at the ceiling
      const look = [this.world.door.pos, new V(0, 3.1, -1), new V(-5, 1.8, -1)];
      for (const k of this.allKids()) if (!k.gone && !k.hollow && !k.call && !this.anyTalkWith(k)) { k.tremble = 0.5; k.talking = 2.5; k.lookTarget = pick(look); k.speed = 4; }
      this.firstHint('ev:firedrill', E.hint);
      yield* this.wait(1.6);
      this.friendQuip('nora', 'n_alarm', 0);
      this.friendQuip('sam', 's_alarm', 2.6);
      yield* this.turnToClass();
      yield* this.say('t_fd_seats', 0.6);
      // he walks along the front, staring: he can't hear a thing, but he sees everything
      yield* this.walk(clamp(this.cp.x * 0.5, -1.4, 1.4), -4.0, 0.8);
      T.facePoint(this.cp, 3);
      for (const k of this.allKids()) if (!k.call && !this.anyTalkWith(k)) { k.lookTarget = null; k.talking = 0; }
      yield* this.actStare(2);
      yield* this.until(() => !this.alarmOn, 14);
      // silence. Too much silence.
      yield* this.wait(1.3);
      yield* this.say('t_fd_notreal', 0.6);
      yield* this.actStare(1.2);
      yield* this.walk(rand(-1.2, 1.2), -5.4);
    } finally {
      for (const k of this.allKids()) { k.tremble = 0; if (!k.call && !this.anyTalkWith(k)) { k.lookTarget = null; k.speed = 4; } }
    }
  },
  /** the alarm itself (it rings on even if he is interrupted) */
  *fxAlarm(dur) {
    const A = this.audio;
    this.alarmOn = true; this.alarm = 1; // (the bell itself: eventVisuals, on every screen)
    try {
      A.fadeBus('amb', 0.35, 0.4);
      for (const b of this.world.lights.banks) if (!b.dead) b.flicker = 0.5;
      let t = 0;
      while (t < dur && this.state === 'playing') { t += this.dt; yield; }
    } finally {
      this.alarmOn = false; this.alarm = 0;
      A.fadeBus('amb', 1, 1.5);
    }
  },

  // ---------------------------------------------------------------- 5. he leaves the room
  *ev_leave() {
    const T = this.teacher, W = this.world, A = this.audio, E = EVENTS.leave, door = W.door;
    let out = false;
    this.awaySaw = null; this.awayNoisy = false;
    try {
      T.clap = null; T.setPose('rest');
      yield* this.turnToClass();
      yield* this.wait(0.5);
      yield* this.say('t_lv_dontmove', 0.5);
      yield* this.actStare(1.2);
      T.lookAt(null, 3);
      yield* this.walk(3.9, -5.0, 0.95);
      T.faceTo(Math.PI / 2, 4);
      A.play('door_open', { pos: door.pos.clone(), vol: 1.0, ref: 2.4 });
      door.openTarget = 1;
      yield* this.wait(0.8);
      yield* this.walkLine(5.6, -5.0, 0.9);
      // gone. The door closes behind him.
      out = true;
      T.root.visible = false; this.present = false; this.away = true;
      door.openTarget = 0;
      this.timers.after(1.1, () => A.play('door_slam', { pos: door.pos.clone(), vol: 0.45, ref: 2 }));
      this.fx.push(this.hallFootsteps(false));
      this.firstHint('ev:leave', E.hint);
      this.addObjective({ id: 'chaos', text: E.task });
      this.friendQuip('sam', 's_gone', 1.3);
      // the class goes wild (the chatter: eventVisuals, on every screen)
      this.classWild(true);
      const peekAt = rand(E.peek[0], E.peek[1]);
      let t = 0, peeked = false, back = false, nextPaper = rand(2.5, 4.5);
      while (t < E.away) {
        t += this.dt;
        if (this.wild && t >= nextPaper) { nextPaper = t + rand(E.paper[0], E.paper[1]); this.wildThrow(); }
        if (!peeked && t >= peekAt) { peeked = true; this.fx.push(this.fxPeek(E.peekFor)); }
        if (!back && t >= E.away - E.back) {
          // footsteps coming back
          back = true;
          this.fx.push(this.hallFootsteps(true));
          this.friendQuip('nora', 'n_back', 2.2);
          this.timers.after(2.5, () => { if (this.away) this.classWild(false); });
        }
        for (const p of this.players) if ((p.selfNoise || 0) >= 0.6 || p.aiming) this.awayNoisy = true;
        yield;
      }
      this.classWild(false);
      // back. The door opens. Is anybody still at it?
      A.play('door_open', { pos: door.pos.clone(), vol: 1.0, ref: 2.4 });
      door.openTarget = 1;
      T.place(5.5, -5.0, -Math.PI / 2); T.setPose('rest');
      T.root.visible = true; out = false;
      yield* this.walkLine(4.05, -5.0, 1.0);
      this.present = true; this.away = false;
      T.facePoint(this.cp, 5); T.lookAt(this.cp, 5);
      door.openTarget = 0;
      this.timers.after(0.9, () => A.play('door_slam', { pos: door.pos.clone(), vol: 0.35, ref: 2 }));
      yield* this.wait(0.7);
      const red = this.players.filter((p) => (p.selfNoise || 0) >= 0.6 || p.aiming || p.vid);
      const saw = this.awaySaw && this.players.includes(this.awaySaw) ? this.awaySaw : null;
      const who = red[0] || saw;
      if (who) {
        this.focus = who;
        T.lookAt(who.camPos, 6); T.facePoint(who.camPos, 3);
        T.setPose('point', { at: who.camPos.clone() });
        this.track.event(this.t, who, red.includes(who) ? 'redHanded' : 'seenFromDoor');
        who.heat += 20;
        this.angerUp(red.includes(who) ? E.caughtAnger : E.sawAnger, 85);
        yield* this.say(red.includes(who) ? 't_see' : 't_isaw', 0.4);
        T.setPose('rest');
        yield* this.actStare(1.2);
      } else {
        yield* this.say('t_lv_back', 0.5);
        yield* this.actStare(1.0);
        if (this.awayNoisy) yield* this.say('t_lv_whomoved', 0.5);
      }
      yield* this.walk(rand(-1, 1), -5.4);
    } finally {
      this.classWild(false);
      if (out || !T.root.visible) { T.place(4.0, -5.0, -Math.PI / 2); T.root.visible = true; }
      this.present = true; this.away = false;
      this.doorFace.visible = false;
      door.openTarget = 0;
      if (!this.objDone('chaos')) this.dropObjective('chaos');
    }
  },
  /** while he is out the kids turn around and talk; when he is coming back they snap to the front */
  classWild(on) {
    this.wild = !!on;
    const kids = this.allKids().filter((k) => !k.gone && !k.hollow);
    for (const k of kids) {
      if (k.call || this.anyTalkWith(k) || k.showing) continue;
      if (on) {
        const other = pick(kids.filter((x) => x !== k));
        k.lookTarget = other ? other.headWorld(new V()) : null; k.speed = 3; k.talking = 30;
        k.leanRollTarget = rand(-0.12, 0.12);
      } else if (k.talking > 1 || k.leanRollTarget) {
        k.lookTarget = null; k.talking = 0; k.speed = 6; k.leanRollTarget = 0;
        if (!k.taken) { k.forcePitch = 0.3; this.timers.after(3, () => { if (k.forcePitch === 0.3) k.forcePitch = null; }); }
      }
    }
  },
  /** while he is out: a kid throws a paper ball across the class at another kid (once paper is a thing in this class) */
  wildThrow() {
    if (!this.allowPrank || this.cutscene) return;
    const kids = this.students.filter((k) => !k.gone && !k.hollow);
    if (kids.length < 2) return;
    const from = pick(kids), to = pick(kids.filter((k) => k !== from));
    const start = from.headWorld(new V()); start.y -= 0.05;
    const aim = to.headWorld(new V()).add(_a.set(rand(-0.25, 0.25), rand(0.1, 0.35), rand(-0.25, 0.25)));
    start.addScaledVector(_b.subVectors(aim, start).normalize(), 0.24);
    const T = clamp(aim.distanceTo(start) / 6, 0.45, 1.1);
    const vel = new V().subVectors(aim, start).divideScalar(T);
    vel.y += 0.5 * 9.8 * T;
    from.lookTarget = aim.clone(); from.speed = 8; from.talking = Math.max(from.talking, 1);
    this.spawnPaper(null, from, 'ball', start, vel, 0);
    this.audio.play('prank_swish', { pos: start, vol: 0.45, ref: 1, reverb: 0.05 });
  },
  /** his footsteps in the hallway: going away (quieter), or coming back (louder) */
  *hallFootsteps(coming) {
    const n = 7;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const d = coming ? 1 - k : k;
      const p = new V(5.6, 0.05, -5.0 - d * 7);
      this.audio.play(pick(['step_1', 'step_2', 'step_3', 'step_4']), { pos: p, vol: 0.85 - d * 0.6, ref: 1.6, reverb: 0.5, rate: rand(0.86, 0.94) });
      yield* this.wait(1.0);
    }
  },
  /** his face in the door window: whoever is at it right now, he saw */
  *fxPeek(dur) {
    const E = EVENTS.leave;
    const wp = this.doorFace.getWorldPosition(new V());
    this.doorFace.visible = true;
    this.audio.play('stinger_1', { vol: 0.4, pos: wp, ref: 3 });
    this.showHint(E.hintPeek, 3.5);
    this.friendQuip('nora', 'n_window', 0.8);
    let t = 0;
    try {
      while (t < dur && this.away) {
        t += this.dt;
        this.doorFace.visible = true; // (a door scare ending right now must not hide it)
        if (!this.awaySaw) for (const p of this.players) if ((p.selfNoise || 0) >= 0.6 || p.aiming || p.exposeT > 0) { this.awaySaw = p; break; }
        yield;
      }
    } finally { this.doorFace.visible = false; }
  },

  // ---------------------------------------------------------------- the props on screen (host and friends)
  /** host: the compact state of the props for the snapshot */
  eventSnap() {
    const f = this.fly;
    return [f ? [r2(f.pos.x), r2(f.pos.y), r2(f.pos.z), f.mode === 'sit' ? 1 : f.mode === 'dead' ? 2 : 0] : 0,
      this.madiPhone.visible ? 1 : 0, PIZZA_STATES.indexOf(this.pizza), this.pizzaOpen ? 1 : 0, this.slice.visible ? 1 : 0,
      this.alarm ? 1 : 0, this.dozing ? 1 : 0, this.humming ? 1 : 0, this.dancing ? 1 : 0, this.away ? 1 : 0, this.onPhone ? 1 : 0,
      this.madiRinging ? 1 : 0, this.wild ? 1 : 0, this.classEvent ? this.classEvent.id : 0];
  },
  /** friend online: the props from the host's snapshot */
  applyEventSnap(ev) {
    if (!Array.isArray(ev)) return;
    const f = ev[0];
    if (Array.isArray(f) && f.length >= 4 && f.slice(0, 3).every(Number.isFinite)) {
      if (!this.netFly) this.netFly = { pos: new V(f[0], f[1], f[2]), target: new V(), mode: 0 };
      this.netFly.target.set(f[0], f[1], f[2]); this.netFly.mode = f[3];
    } else this.netFly = null;
    this.madiPhone.visible = !!ev[1];
    this.slice.visible = !!ev[4];
    this.teacher.chalk.visible = !ev[1] && !ev[4];
    this.pizza = PIZZA_STATES[ev[2]] || 'none';
    this.pizzaOpen = !!ev[3];
    this.alarm = ev[5] ? 1 : 0;
    this.dozing = !!ev[6]; this.humming = !!ev[7]; this.dancing = !!ev[8]; this.away = !!ev[9]; this.onPhone = !!ev[10];
    this.madiRinging = !!ev[11]; this.wild = !!ev[12];
    this.netEvent = typeof ev[13] === 'string' && EVENTS[ev[13]] ? ev[13] : null;
  },
  /** the line under his eye while an event goes on (host and friends: from the same state) */
  eventNowText() {
    const id = this.role === 'guest' ? this.netEvent : this.classEvent && this.classEvent.id;
    if (!id || this.state !== 'playing') return '';
    const E = EVENTS[id];
    if (id === 'leave') return this.away ? E.now : '';
    if (id === 'firedrill') return this.alarm > 0 ? E.now : E.nowAfter;
    return E.now;
  },
  /** a friend who joins in the middle of something: what it means for them (the hint everybody got) */
  lateHint() {
    if (this.classEvent) return this.classEvent.id === 'fly' && this.prankOpen() ? EVENTS.fly.hintPrank : EVENTS[this.classEvent.id].hint;
    if (this.dozing) return QUIRKS.doze.hint;
    if (this.dancing) return SLANG_USE.danceHint;
    return null;
  },
  /** a looping sound on this screen while `on`: started, moved along, faded out */
  loopWhile(key, on, name, pos, o, fadeOut = 0.1) {
    let h = this[key];
    if (on && pos && this.state === 'playing') {
      if (!h || h.ended) {
        h = this[key] = this.audio.play(name, { ...o, loop: true, pos: pos.clone(), local: true, vol: o.fadeIn ? 0.02 : o.vol });
        if (h && o.fadeIn) h.setVol(o.vol, o.fadeIn / 3);
      } else h.setPos(pos);
    } else if (h) { h.stop(fadeOut); this[key] = null; }
  },
  /** every frame (host and friends): the fly, the pizza box, his phone's screen, and the sounds of what is going on */
  eventVisuals(dt) {
    const T = this.teacher, A = this.audio;
    this.ui.setEventNow(this.eventNowText());
    // the fly: the host's own, or the one in the snapshot
    let fp = null, fmode = 0;
    if (this.role === 'guest') {
      const n = this.netFly;
      if (n) { n.pos.x = damp(n.pos.x, n.target.x, 14, dt); n.pos.y = damp(n.pos.y, n.target.y, 14, dt); n.pos.z = damp(n.pos.z, n.target.z, 14, dt); fp = n.pos; fmode = n.mode; }
    } else if (this.fly) { fp = this.fly.pos; fmode = this.fly.mode === 'sit' ? 1 : this.fly.mode === 'dead' ? 2 : 0; }
    const fm = this.flyMesh;
    fm.visible = !!fp;
    if (fp) {
      fm.position.copy(fp);
      const [wl, wr] = fm.userData.wings;
      const flap = fmode === 0 ? Math.sin(this.t * 140) * 0.7 : fmode === 1 ? 0.25 : 0;
      wl.rotation.z = flap; wr.rotation.z = flap;
      if (fmode === 0) { const v = this.fly ? this.fly.vel : null; if (v && v.lengthSq() > 0.01) fm.rotation.y = Math.atan2(v.x, v.z); }
      if (fmode === 2) fm.rotation.z = Math.PI;
      else fm.rotation.z = 0;
    }
    // the sounds that go with a state: every screen plays its own (a friend who joins in the middle hears them too)
    const here = this.present && T.root.visible;
    this.loopWhile('flySnd', fp && fmode === 0, 'fly_buzz', fp, { ref: 0.55, vol: 0.9, reverb: 0.05, offset: rand(0, 1) }, 0.08); // silent while it sits
    this.loopWhile('humSnd', this.humming && here, 'madi_hum', here ? T.headWorld(_c) : null, { ref: 1.8, vol: 0.85, reverb: 0.3, offset: rand(0, 4) }, 0.25);
    this.loopWhile('ringSnd', this.madiRinging && here, 'madi_ring', here ? T.local(-0.2, 0.95, 0.06, _c) : null, { ref: 2.4, vol: 1.05, reverb: 0.15 }, 0.05);
    this.loopWhile('danceSnd', this.dancing && here, 'v_phonk', here ? T.handPos('R', _c) : null, { ref: 2.2, vol: 0.95, reverb: 0.25 }, 0.04);
    this.loopWhile('alarmSnd', this.alarm > 0, 'fire_alarm', ALARM_AT, { ref: 6, vol: 1.3, reverb: 0.3 }, 0.03);
    this.loopWhile('chatterSnd', this.wild, 'class_chatter', CHATTER_AT, { ref: 3, vol: 0.6, reverb: 0.25, fadeIn: 1.2 }, 1.2);
    // the pizza box: in his hands, or on his desk with the lid up
    const box = this.pizzaBox;
    box.visible = this.pizza !== 'none';
    if (this.pizza === 'held') {
      if (this.role !== 'guest') this.holdPizza();
      T.local(0, T.chestY - 0.29, 0.43, box.position);
      box.rotation.set(0, T.root.rotation.y, 0);
    } else if (this.pizza === 'desk') {
      box.position.set(PIZZA_DESK.x, PIZZA_DESK.y, PIZZA_DESK.z);
      box.rotation.set(0, PIZZA_DESK.ry, 0);
    }
    box.userData.open = damp(box.userData.open, this.pizzaOpen ? 1 : 0, 6, dt);
    box.userData.lid.rotation.x = box.userData.open * 1.85;
    // his phone's screen flashes while it rings (its glow follows the screen otherwise)
    if (this.madiPhone.visible) this.madiPhone.userData.screen.color.setHex(this.dancing ? (Math.sin(this.t * 12) > 0 ? 0xff5ad2 : 0x5ad2ff) : 0x9cc8f0);
  },
};
