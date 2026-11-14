// A different teacher every class (mixed into Game), part 2: his quirks. Each class has 2 (from the
// seeded setup in src/events.js). Each one changes a number he already uses, or adds one small habit:
//  - deaf: deaf in one ear (left or right). On that side of him he barely hears you; he cups his good
//    ear ("What?"), and an echo from that side gets only a "What?" (it does not count toward "it was you").
//  - laugh: hates laughing. Laughing is louder to him, and a big laugh makes him spin around: "Who laughed?"
//  - doze: dozes off on his desk now and then: he can't see, barely hears; a loud noise wakes him.
//  - clock: keeps checking the clock (his back to the class), and glances at it instead of at you.
//  - count: counts the class, pointing at every head (when he points at you, sit still).
//  - hum: hums while he writes (he hears you less); when the humming stops, he is listening.
// The first time a quirk shows, everybody gets a hint and it is listed in the HUD ("TODAY HE...").
// The host (or solo game) runs everything; friends get the hints, chips, his poses and sounds.
import * as THREE from 'three';
import { clamp, rand, pick, chance } from './util.js';
import { QUIRKS, EVENTS, SLANG_USE } from './data.js';

const V = THREE.Vector3;
const _a = new V(), _b = new V();

export const QuirkMixin = {
  resetQuirks() {
    this.quirks = new Set((this.setup && this.setup.quirks) || []);
    this.quirkSeen = [];
    this.quirkNext = {};
    for (const id of this.quirks) { const q = QUIRKS[id]; if (q.first) this.quirkNext[id] = rand(q.first[0], q.first[1]); }
    this.deafNext = 8; this.deafTell = QUIRKS.deaf.tell + rand(0, 15); this.laughGlareAt = -99;
    this.dozing = false; this.humming = false; this.humStopAt = -99; this.quirkBusy = false;
    this.humStopped = false; this.clockQuipped = false; this.countQuipped = false;
    for (const p of this.players) p.deafT = 0;
    if (this.ui && this.ui.setQuirks) this.ui.setQuirks([]);
  },
  quirkOn(id) { return !!(this.quirks && this.quirks.has(id)); },
  deafWord() { return (this.setup && this.setup.deafSide) || 'left'; },

  /** the first time a quirk shows: a hint for everybody, and it goes on the HUD list */
  noticeQuirk(id) {
    if (!this.quirkOn(id) || this.quirkSeen.includes(id) || this.t < 8) return false; // (not over the first controls hint)
    this.quirkSeen.push(id);
    const side = this.deafWord();
    this.showHint(QUIRKS[id].hint.replace('{SIDE}', side.toUpperCase()).replace('{side}', side), 6.5);
    this.ui.setQuirks(this.quirkChips());
    this.track.global.quirks.push(id);
    this.track.event(this.t, null, 'quirk', { id });
    return true;
  },
  quirkChips() { const side = this.deafWord(); return this.quirkSeen.map((id) => QUIRKS[id].chip.replace('{side}', side)); },

  /** he can't catch anybody right now (out of the room, asleep, on the phone, dancing, blind, typing) */
  offGuard() { return !!(this.blind || this.typing || this.dozing || this.away || this.onPhone || this.dancing); },

  /** he can't hear a thing right now (the fire alarm, phonk from his own phone): an echo or a loud phone goes unnoticed */
  cantHear() { return !!(this.alarmOn || this.dancing); },

  /** is this player on his deaf side? (his left is his local +x; right in front or behind he hears fine) */
  onDeafSide(p) {
    if (!this.quirkOn('deaf')) return false;
    const T = this.teacher, yaw = T.root.rotation.y;
    const lx = Math.cos(yaw) * (p.camPos.x - T.pos.x) - Math.sin(yaw) * (p.camPos.z - T.pos.z);
    if (Math.abs(lx) < QUIRKS.deaf.edge) return false;
    return (lx > 0 ? 'left' : 'right') === this.deafWord();
  },

  /** how well he hears this player right now (1 = normal): his quirks, the events, the alarm */
  hearMul(p) {
    let k = 1;
    if (this.dozing) k *= QUIRKS.doze.hear;
    if (this.alarmOn) k *= EVENTS.firedrill.hear;
    if (this.onPhone) k *= EVENTS.ringtone.hear;
    if (this.dancing) k *= SLANG_USE.danceHear;
    if (this.quirkOn('hum')) {
      const Q = QUIRKS.hum;
      if (this.humming) k *= Q.hear;
      else if (this.t - this.humStopAt < Q.stopFor) k *= Q.stop; // the humming stopped: he is listening
    }
    if (p && this.onDeafSide(p)) k *= QUIRKS.deaf.hear;
    return k;
  },

  /** his humming (while he writes): starts and stops the sound and the hearing change */
  humOn(on) {
    if (!this.quirkOn('hum')) return;
    if (on && !this.humming) {
      this.humming = true;
      this.noticeQuirk('hum');
    } else if (!on && this.humming) {
      this.humming = false;
      this.humStopAt = this.t;
      if (!this.humStopped) { this.humStopped = true; this.friendQuip('nora', 'n_hum', 1.2); }
    }
  },

  /** every frame on the host / solo */
  updateQuirks(dt) {
    if (!this.quirks || !this.quirks.size) return;
    // half deaf: somebody keeps making noise on his deaf side... "What?"
    if (this.quirkOn('deaf')) {
      let loud = null;
      for (const p of this.players) {
        p.deafT = this.present && (p.noise || 0) >= 0.6 && this.onDeafSide(p) ? (p.deafT || 0) + dt : Math.max(0, (p.deafT || 0) - dt);
        if (p.deafT > 1.6 && !loud) loud = p;
      }
      if (loud && this.t > this.deafNext && this.brainIdle && !this.quirkBusy && !this.cutscene && !this.lockBully && !this.eventLock && !this.memeBusy && !this.classEvent && !this.choice && this.anger < 60) {
        this.deafNext = this.t + rand(QUIRKS.deaf.react[0], QUIRKS.deaf.react[1]);
        loud.deafT = 0;
        this.interrupt(this.reactDeaf(loud));
      } else if (!this.quirkSeen.includes('deaf') && !this.cutscene && !this.eventLock && !this.away && this.memesOn
        && ((loud && loud.deafT > 3) || (this.present && (this.deafTell -= dt) <= 0))) {
        // nobody has seen him cup his ear yet: Nora works it out (he is busy, or nobody has been loud on that side)
        if (this.noticeQuirk('deaf')) this.friendQuip('nora', this.deafWord() === 'left' ? 'n_deafL' : 'n_deafR', 0.6);
      }
    }
  },

  /** the idle lesson asks: is one of his habits due? (a generator to run, or null) */
  quirkAct() {
    if (!this.present || this.anger >= 40 || this.blackout > 0.3 || this.mode === 'free' && this.t > 286) return null;
    const due = (id) => this.quirkOn(id) && this.t >= (this.quirkNext[id] ?? 1e9);
    const next = (id) => { const q = QUIRKS[id]; this.quirkNext[id] = this.t + rand(q.every[0], q.every[1]); };
    if (due('doze')) { next('doze'); return this.actDoze(); }
    if (due('count')) { next('count'); return this.actCount(); }
    if (due('clock')) { next('clock'); return this.actClock(); }
    // a hummer who has not hummed yet: time to write something
    if (due('hum') && !this.quirkSeen.includes('hum')) { this.quirkNext.hum = this.t + 12; return this.actWrite(); }
    return null;
  },

  // ---------------------------------------------------------------- half deaf
  /** he turns his GOOD ear toward the noise (not his eyes) and cups it: "What?" */
  *reactDeaf(p) {
    const T = this.teacher, deaf = this.deafWord();
    this.quirkBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      const head = T.headWorld(new V());
      _a.subVectors(p.camPos, head); _a.y = 0; _a.normalize();
      // look 90 degrees away from them, so the good ear points at them
      const s = deaf === 'left' ? 1 : -1;
      const look = head.clone().add(_b.set(-_a.z * s, -0.1, _a.x * s).multiplyScalar(2));
      T.lookAt(look, 4);
      T.facePoint(look, 2.5);
      yield* this.wait(0.6);
      T.setPose('cup', { side: deaf === 'left' ? 'R' : 'L' });
      T.rollTarget = 0.3 * s;
      this.noticeQuirk('deaf');
      yield* this.say(chance(0.5) ? 't_qd_what' : 't_qd_speak', 0.8);
      this.friendQuip('nora', deaf === 'left' ? 'n_deafL' : 'n_deafR', 0.4);
      T.setPose('rest'); T.rollTarget = 0;
      T.lookAt(null, 3);
      yield* this.wait(0.5);
    } finally { this.quirkBusy = false; T.setPose('rest'); T.rollTarget = 0; }
  },
  /** an echo from his deaf side: he heard SOMETHING. "What?" (it does not count as one more echo) */
  *reactDeafEcho(p) {
    const T = this.teacher;
    this.echoBusy = true;
    try {
      yield* this.wait(0.6);
      T.clap = null; T.setPose('cup', { side: this.deafWord() === 'left' ? 'R' : 'L' });
      T.lookAt(FRONT_OF(T), 3);
      this.noticeQuirk('deaf');
      yield* this.say('t_qd_what', 0.6);
      T.setPose('rest');
      yield* this.actStare(1.4);
    } finally { this.echoBusy = false; T.setPose('rest'); }
  },

  // ---------------------------------------------------------------- hates laughing
  /** the class laughed (src/pranks.js addLaugh, giggles): he hates that. byPlayers: the players made them laugh
   *  (a prank, an echo); laughing at his own ringtone or dance makes him glare but not angrier at you */
  laughQuirk(n, at, byPlayers = true) {
    if (!this.quirkOn('laugh') || !this.present || this.cutscene || this.ending || this.away) return;
    const Q = QUIRKS.laugh;
    if (byPlayers) this.angerUp(Q.anger * Math.min(2, n / 20), 85);
    if (n < Q.react || !this.brainIdle || this.quirkBusy || this.lockBully || this.eventLock || this.memeBusy || this.choice || this.classEvent) {
      // he is busy, or it was only a giggle: his head snaps around, "No... laughing.", and he goes on
      if (byPlayers && !this.dozing && this.t - this.laughGlareAt > Q.glareEvery) { this.laughGlareAt = this.t; this.fx.push(this.laughGlare(at ? at.clone() : null)); }
      return;
    }
    this.laughGlareAt = this.t;
    this.interrupt(this.reactLaugh(at ? at.clone() : null));
  },
  /** a glare for a giggle, once he has finished his sentence (it never cuts a line of his off) */
  *laughGlare(at) {
    let quiet = 0, t = 0;
    while (quiet < 0.5 && t < 5) { t += this.dt; quiet = this.t >= (this.voiceUntil || 0) ? quiet + this.dt : 0; yield; }
    if (quiet < 0.5 || !this.present || this.cutscene || this.eventLock || this.dozing || this.away) return;
    this.noticeQuirk('laugh');
    yield* this.glareWarn(at || new V(0, 1.2, 0.8), 't_ql_no');
  },
  *reactLaugh(at) {
    const T = this.teacher;
    this.quirkBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      const look = at || this.cp.clone();
      T.lookAt(look, 8); T.facePoint(look, 4);
      yield* this.wait(0.5);
      this.noticeQuirk('laugh');
      yield* this.say(chance(0.55) ? 't_ql_who' : 't_ql_no', 0.4);
      yield* this.actStare(1.6);
    } finally { this.quirkBusy = false; }
  },

  // ---------------------------------------------------------------- dozes off
  *actDoze() {
    const T = this.teacher, A = this.audio, Q = QUIRKS.doze, W = this.world;
    const a0 = this.anger;
    let woke = null, slept = false;
    this.quirkBusy = true; this.dozeWoke = false;
    try {
      T.lookAt(null, 3);
      yield* this.walk(W.teacherDesk.stand.x + 0.5, -6.1);
      T.faceTo(0, 3);
      yield* this.wait(0.5);
      // he leans on his desk, his head drops
      const x = T.pos.x;
      T.setPose('desk', { L: new V(x + 0.24, 0.8, -5.62), R: new V(x - 0.24, 0.8, -5.62) });
      T.leanTarget = 0.55; T.crouchTarget = 0.1;
      T.lookAt(new V(x, 0.2, -5.2), 1.0);
      T.rollTarget = 0.32;
      yield* this.wait(1.3);
      this.dozing = true; slept = true;
      T.eyeGlow = 0;
      this.noticeQuirk('doze');
      this.friendQuip(chance(0.5) ? 'sam' : 'nora', chance(0.5) ? 's_asleep' : 'n_asleep', 2.2);
      const dur = rand(Q.dur[0], Q.dur[1]);
      let t = 0, snore = 0.4;
      while (t < dur) {
        t += this.dt; snore -= this.dt;
        if (snore <= 0) {
          snore = 3.3;
          A.play('m_snore', { pos: T.headWorld(new V()), rate: 0.62, vol: 0.85, ref: 2, reverb: 0.25 });
          this.ui.subtitle('', '<i>*snoring*</i> 💤', 'teacher', 2.4);
        }
        woke = this.wakeCheck(a0);
        if (woke) break;
        yield;
      }
      // awake with a jolt
      this.wakeUp(woke);
      T.eyeGlow = 0.12; T.rollTarget = 0; T.leanTarget = 0; T.crouchTarget = 0;
      T.setPose('rest');
      T.lookAt(this.cp, 6);
      yield* this.turnToClass();
      yield* this.say('t_qz_awake', 0.5);
      if (woke) { this.angerUp(10, 80); yield* this.actStare(1.8); }
    } finally {
      if (this.dozing) this.wakeUp(this.wakeCheck(a0)); // (something else woke him: a paper ball, his name in a story moment)
      else if (!slept) this.quirkSoon('doze'); // (cut short on his way to the desk: he tries again soon)
      T.eyeGlow = 0.12; T.rollTarget = 0; T.leanTarget = 0; T.crouchTarget = 0;
      T.setPose('rest');
      this.quirkBusy = false;
    }
  },
  /** a habit that was cut short before anybody could see it: again in a few seconds, not in a minute */
  quirkSoon(id) { if (this.quirkNext[id] !== undefined) this.quirkNext[id] = Math.min(this.quirkNext[id], this.t + rand(6, 10)); },
  /** he wakes up (a snort); whoever woke him is counted, once */
  wakeUp(by) {
    if (!this.dozing) return;
    this.dozing = false;
    this.audio.play('snort', { pos: this.teacher.headWorld(new V()), vol: 1, ref: 2 });
    this.wokenBy(by);
  },
  wokenBy(p) {
    if (this.dozeWoke || !p || p === true || !this.players.includes(p)) return;
    this.dozeWoke = true;
    this.note(p, 'woke'); this.track.event(this.t, p, 'woke');
    this.focus = p;
  },
  /** something loud woke him: the player who did it (or true), else null */
  wakeCheck(a0) {
    const Q = QUIRKS.doze;
    for (const p of this.players) if (p.failT > 0 || p.shoutT > 0) return p;
    if (this.laugh > Q.wakeLaugh) return this.laughAbout && this.players.includes(this.laughAbout) ? this.laughAbout : true;
    if (this.anger > a0 + Q.wakeAnger) return this.focus || true;
    return null;
  },

  // ---------------------------------------------------------------- the clock
  *actClock() {
    const T = this.teacher, Q = QUIRKS.clock, clk = this.world.clock.pos;
    this.quirkBusy = true;
    try {
      T.clap = null;
      T.lookAt(clk, 3); T.facePoint(clk, 2.4);
      yield* this.wait(0.8);
      this.noticeQuirk('clock');
      T.setPose('wrist');
      const c = this.clock, late = c.fixed === null && c.dur > 0 && (this.t - c.t0) / c.dur > 0.8;
      yield* this.wait(rand(Q.look[0], Q.look[1]) * (late ? 1.5 : 1));
      T.setPose('rest');
      yield* this.say(chance(0.5) ? 't_qc_tick' : 't_qc_notyet', 0.4);
      if (!this.clockQuipped) { this.clockQuipped = true; this.friendQuip('sam', 's_clock', 0.3); }
      T.lookAt(null, 3);
    } finally { this.quirkBusy = false; T.setPose('rest'); }
  },
  /** writing on the board: he glances back at the class less often (at the clock instead) */
  glanceChance(base) { return this.quirkOn('clock') ? base * QUIRKS.clock.glance : base; },

  // ---------------------------------------------------------------- counts the class
  *actCount() {
    const T = this.teacher, Q = QUIRKS.count, W = this.world;
    this.quirkBusy = true;
    try {
      T.clap = null; T.lookAt(null, 3);
      yield* this.walk(rand(-0.6, 0.6), -4.5);
      T.faceTo(0, 3);
      yield* this.wait(0.5);
      this.noticeQuirk('count');
      // everyone, row by row from the front (and Kevin's empty chair: one too many)
      const heads = [];
      for (const k of this.allKids()) if (!k.gone) heads.push({ row: k.seat.row, x: k.seat.x, head: () => k.headWorld(new V()) });
      for (const p of this.players) heads.push({ row: p.desk.row, x: p.desk.x, player: p, head: () => this.headOf(p, new V()) });
      const kevin = this.kevin;
      const empty = !kevin || kevin.gone;
      if (empty && W.kevinSeat) heads.push({ row: 1, x: W.kevinSeat.x, empty: true, head: () => W.kevinSeat.clone() });
      heads.sort((a, b) => a.row - b.row || (a.row % 2 ? b.x - a.x : a.x - b.x));
      let n = 0;
      for (const h of heads) {
        n++;
        const at = h.head();
        T.lookAt(at, 8);
        T.setPose('point', { at });
        const v = this.teacherSay('t_n' + Math.min(15, n), 1.2);
        // his finger is on you: are you at something right now?
        const dur = Math.max(Q.per, (v ? v.duration : 0.8) * 0.88), p = h.player;
        let t = 0, moved = false;
        while (t < dur) {
          t += this.dt;
          if (p && t > 0.3 && this.players.includes(p) && ((p.selfNoise || 0) >= 0.6 || p.aiming || p.exposeT > 0)) moved = true;
          yield;
        }
        if (moved && this.players.includes(p)) {
          // "Sit... still." He does not like it.
          this.focus = p; p.heat += Q.movedHeat;
          this.angerUp(Q.movedAnger, 85);
          this.track.event(this.t, p, 'countMoved');
          T.lookAt(p.camPos, 8);
          yield* this.say('t_still', 0.4);
          yield* this.wait(0.6);
        }
      }
      T.setPose('rest');
      yield* this.wait(0.7);
      T.lookAt(this.cp, 3);
      yield* this.say(empty ? 't_qn_toomany' : 'q_again', 0.5);
      if (!this.countQuipped) { this.countQuipped = true; this.friendQuip('sam', 's_count', 0.4); }
      yield* this.actStare(1.2);
    } finally { this.quirkBusy = false; T.setPose('rest'); }
  },
};

/** a point in front of him at eye height (where he looks while he listens) */
function FRONT_OF(T) { return T.local(0, 1.9, 2, new V()); }
