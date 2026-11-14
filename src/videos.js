// Meme videos in class (mixed into Game):
//  - your own phone: the PAPER PLANE game (crash = a LOUD phone) and the meme feed
//  - videos a friend sends you ("watch all of it")
//  - a classmate (or a friend online) holding their phone out: "LOOK! look at this!"
// If he sees you watching a video, he comes for your phone.
import * as THREE from 'three';
import { HeldPhone, ClipBag, clipByKey, CLIPS } from './memes.js';
import { rand, pick, clamp } from './util.js';

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
let SHOW_ID = 1;

/** where a phone held out to `eye` is: from the shoulder nearest to you, stretched toward your face */
export function showPose(shoulderL, shoulderR, eye, outShoulder, outHold) {
  const s = shoulderL.distanceToSquared(eye) < shoulderR.distanceToSquared(eye) ? shoulderL : shoulderR;
  outShoulder.copy(s);
  _d.subVectors(eye, s);
  const dist = _d.length();
  const reach = Math.min(0.62, dist * 0.55);
  outHold.copy(s).addScaledVector(_d, reach / Math.max(0.01, dist));
  outHold.y = s.y + 0.05 + (eye.y - 0.06 - s.y - 0.05) * 0.75;
  return outHold;
}

/** shoulders of a friend's avatar (online): under the head, toward you */
export function avatarShoulders(head, eye, outL, outR) {
  _c.subVectors(eye, head); _c.y = 0;
  if (_c.lengthSq() < 1e-4) _c.set(0, 0, 1);
  _c.normalize();
  const side = _b.set(_c.z, 0, -_c.x);
  outL.copy(head).add(_a.set(0, -0.26, 0)).addScaledVector(_c, 0.08).addScaledVector(side, 0.16);
  outR.copy(head).add(_a.set(0, -0.26, 0)).addScaledVector(_c, 0.08).addScaledVector(side, -0.16);
}

/** how straight the camera looks at a point (1 = dead centre) */
export function lookDot(camPos, camFwd, point) {
  _a.subVectors(point, camPos).normalize();
  return camFwd.dot(_a);
}

export const VideoMixin = {
  setupVideos() {
    const ph = this.phone, A = this.audio;
    this.vidBag = new ClipBag();
    this.shows = []; this.heldTrash = [];
    ph.onCrash = (s) => this.phoneFail(this.me, s);
    ph.onPoint = () => { this.mischief += 4; A.play('phone_point', { vol: 0.3, local: true, reverb: 0 }); };
    ph.onFlap = () => A.play('phone_flap', { vol: 0.22, local: true, reverb: 0 });
    ph.onFeedDone = () => {
      if (this.role === 'guest' || this.state !== 'playing') return;
      this.note(this.me, 'videos'); this.track.event(this.t, this.me, 'video', { how: 'feed' });
      this.completeObjective('video');
    };
    ph.game.hint = this.input.touch ? 'tap: TAP button' : 'tap: [E] / [SPACE] / click';
  },

  resetVideos() {
    for (const sh of this.shows || []) if (sh.held) sh.held.dispose();
    for (const h of this.heldTrash || []) h.held.dispose();
    this.shows = []; this.heldTrash = [];
    this.vidJob = null;
    this.vidZoom = false;
    this.nextShow = rand(80, 140);
    this.phone.reset();
    for (const p of this.players) { p.vid = false; p.showWatch = null; p.failT = 0; p.shoutT = 0; p.vidSeenT = 0; }
    for (const f of this.friends) f.showing = null;
  },

  /** a built-in clip for a mission or a classmate (never one of your own files) */
  pickClip() {
    for (let i = 0; i < 50; i++) { const k = this.vidBag.next(); if (typeof k === 'number' && !CLIPS[k].scary) return k; }
    return 0;
  },

  // ---------------------------------------------------------------- your own phone
  /** what you press while the phone is up: E / click = tap, T = switch app, R = show a friend */
  phoneButtons(p, a) {
    if (p.local && !this.phoneHinted && this.phone.raise > 0.6 && this.phone.mode === 'game') {
      this.phoneHinted = true;
      this.ui.hint(this.input.touch ? 'Your phone: <b>TAP</b> to fly, <b>APP</b> for memes. If you crash, it gets <b>LOUD</b>.' : 'Your phone: <b>E</b> / click to fly, <b>T</b> for the meme app. If you crash, it gets <b>LOUD</b>.', 5);
    }
    if (p.local) {
      if (a.tap) this.phone.tap();
      if (a.ask) { this.phone.switchApp(); this.idleT = 0; }
    }
    if (a.echo) this.tryShow(p);
  },

  /** your phone game crashed: the phone is LOUD and he heard it */
  phoneFail(p) {
    if (this.role === 'guest') { if (this.mp) this.mp.send({ t: 'press', k: 'fail' }); return; }
    if (this.state !== 'playing' || !p) return;
    const pos = this.headOf(p, new THREE.Vector3()).add(_d.set(0, -0.3, 0));
    this.audio.play('phone_fail', { pos, vol: 1.3, ref: 1.8, reverb: 0.25 });
    p.failT = 2.4;
    this.note(p, 'fails'); this.track.event(this.t, p, 'fail');
    this.uiTo(p, 'hint', 'GAME OVER... and your phone is <b>LOUD</b>. Put it away!', 3);
    this.giggle && this.timers.after(1.2, () => this.state === 'playing' && this.giggle());
    if (!this.present || this.cutscene || this.ending) return;
    if (this.cantHear()) return; // (the fire alarm, his own phonk: for once nobody hears it)
    this.anger = Math.min(92, this.anger + 18);
    p.heat += 20; this.focus = p;
    if (this.dozing) return; // he wakes up with a jolt (src/quirks.js: actDoze)
    if (this.classEvent) this.fx.push(this.glareWarn(this.headOf(p, new THREE.Vector3()), 't_nophones')); // (an event goes on: he only turns his head)
    else if (!this.eventLock && !this.lockBully && !this.memeBusy && !this.choice && !this.echoBusy && !this.searching) this.interrupt(this.reactPhoneFail(p));
  },

  *reactPhoneFail(p) {
    const T = this.teacher;
    T.clap = null; T.setPose('rest');
    yield* this.wait(0.4);
    // he turns right to the sound. Is the phone still out?
    T.lookAt(this.headOf(p, new THREE.Vector3()), 6); T.facePoint(p.camPos, 3);
    yield* this.wait(1.7);
    yield* this.say('t_nophones', 0.4);
    yield* this.wait(0.5);
    T.lookAt(null, 3);
  },

  // ---------------------------------------------------------------- showing a video
  /** you (holding the meme app) shout at the friend you look at and show them your video */
  tryShow(p) {
    const ph = this.phone;
    let key, seed;
    if (p.local) {
      if (ph.mode !== 'memes' || !ph.feed.clip) {
        this.uiTo(p, 'hint', this.input.touch ? 'Open the meme app first: tap <b>APP</b> while you hold your phone.' : 'Open the meme app first: press <b>T</b> while you hold your phone.', 3);
        return;
      }
      key = ph.feed.key; seed = ph.feed.seed;
    } else { key = p.in.ck; seed = p.in.cs; }
    if (typeof key !== 'number' || !CLIPS[key]) key = this.pickClip();
    seed = Number.isFinite(seed) ? seed | 0 : 1;
    const aim = this.aimFriend(p);
    if (!aim) { this.uiTo(p, 'hint', 'Look at a friend first, then show them.', 2.5); return; }
    if (this.t < (p.showCool || 0)) return;
    p.showCool = this.t + 3;
    // "BRO! LOOK AT THIS!" (loud)
    this.playerSay('p_look', p);
    p.shoutT = 1.4;
    if (aim.kind) {
      // Sam or Nora: they laugh at it
      aim.lookTarget = p.camPos;
      this.timers.after(1.6, () => {
        if (this.state !== 'playing' || aim.gone) return;
        this.audio.play('giggle', { pos: aim.headWorld(new THREE.Vector3()), vol: 0.8, ref: 1 });
        aim.talking = 1.2;
        this.mischief += 12;
        this.timers.after(2, () => { if (!aim.call && !aim.showing && !this.anyTalkWith(aim)) aim.lookTarget = null; });
      });
      return;
    }
    if (this.shows.some((s) => !s.over && s.to === aim)) { this.uiTo(p, 'hint', `${aim.name} is already watching something.`, 2.5); return; }
    this.startShow({ fromP: p, to: aim, key, seed });
    this.uiTo(p, 'toast', `Showing ${aim.name} your video…`, 2.2);
  },

  startShow({ npc = null, fromP = null, to, key, seed, mission = false }) {
    const clip = clipByKey(key);
    const sh = {
      id: SHOW_ID++, npc, fromP, to, key, seed: seed ?? ((Math.random() * 1e9) | 0), t: 0, dur: clip.dur || 8,
      state: 'call', look: false, missT: 0, waitT: 0, nag: 0, mission, over: false, result: null, held: null, lookLocal: false,
    };
    this.shows.push(sh);
    if (npc) { npc.lookTarget = to.camPos; npc.showing = sh; npc.leanRollTarget = npc.root.position.x < to.eye.x ? -0.12 : 0.12; }
    const who = npc ? npc.name : fromP.name;
    this.uiTo(to, 'hint', `${who} wants to show you a video. <b>Look at the phone</b> to watch it.`, 4);
    return sh;
  },

  endShow(sh, why) {
    if (sh.over) return;
    sh.over = true; sh.result = why;
    const p = sh.to;
    if (p.showWatch === sh) p.showWatch = null;
    if (sh.held) {
      sh.held.player.stopSound();
      if (why === 'done') this.heldTrash.push({ held: sh.held, t: 0.9 });
      else sh.held.dispose();
      sh.held = null;
    }
    if (p.local) { this.vidZoom = false; this.ui.call('left', false); this.ui.call('right', false); }
    const f = sh.npc;
    if (f) {
      f.showing = null; f.leanRollTarget = 0;
      this.timers.after(1.2, () => { if (!f.call && !f.showing && !this.anyTalkWith(f)) f.lookTarget = null; });
    }
    if (why === 'done') {
      this.mischief += 30;
      this.note(p, 'videos');
      if (sh.fromP) this.note(sh.fromP, 'shown');
      this.track.event(this.t, p, 'video', { how: f ? 'shown by ' + f.name : 'shown by ' + sh.fromP.name });
      if (f) { this.audio.play('giggle', { pos: f.headWorld(new THREE.Vector3()), vol: 0.7, ref: 1 }); f.talking = 1.5; }
      if (sh.fromP) { this.uiTo(sh.fromP, 'toast', `${p.name} watched your video 😂`, 2.5); this.uiTo(p, 'toast', '😂😂😂', 1.6); }
      if (!sh.mission) this.completeObjective('video');
    }
  },

  /** the phone a classmate or a friend holds out to the local player: place it, and are you looking? */
  localShow(sh, dt) {
    const eye = this.camPos, f = sh.npc;
    if (f) f.shoulderPoints(_a, _b);
    else avatarShoulders(this.headOf(sh.fromP, _c), eye, _a, _b);
    const shoulder = new THREE.Vector3(), hold = new THREE.Vector3();
    showPose(_a, _b, eye, shoulder, hold);
    if (!sh.held) {
      sh.held = new HeldPhone(this.scene, this.audio, this.portraitTex && this.portraitTex.image);
      sh.held.player.load(sh.key, sh.seed, sh.t);
    }
    const h = sh.held;
    h.visible = true;
    h.pose(shoulder, hold, eye);
    const dot = lookDot(eye, this.camFwd, hold);
    const look = !this.cutscene && !this.choice && (sh.lookLocal ? dot > 0.93 : dot > 0.962);
    sh.lookLocal = look;
    if (look) {
      if (Math.abs(h.player.t - sh.t) > 0.35) h.player.seek(sh.t);
      h.player.advance(dt, { on: true, pos: hold, vol: 1 });
    } else h.player.pause();
    h.render(dt, { paused: !look, header: (f ? f.name : sh.fromP.name) + '\'s phone', clock: this.clockText ? this.clockText() : '' });
    // off screen: show which side is calling
    if (!look) {
      _a.copy(hold).project(this.camera);
      const behind = _a.z > 1, sx = behind ? -_a.x : _a.x;
      const off = Math.abs(sx) > 0.6 || behind;
      this.ui.call('left', off && sx < 0); this.ui.call('right', off && sx >= 0);
    } else { this.ui.call('left', false); this.ui.call('right', false); }
    return look;
  },

  updateShows(dt) {
    for (const p of this.players) p.showWatch = null;
    let zoom = false;
    for (const sh of this.shows) {
      if (sh.over) continue;
      const p = sh.to;
      const gone = !this.players.includes(p) || (sh.npc && sh.npc.gone) || (sh.fromP && (!this.players.includes(sh.fromP) || !sh.fromP.phoneUp)) || this.ending;
      if (gone) { this.endShow(sh, 'cancel'); continue; }
      let look = p.local ? this.localShow(sh, dt) : p.in.lk === sh.id;
      if (this.cutscene || p.choice || (p.local && this.choice)) look = false;
      sh.look = look;
      if (look) {
        sh.state = 'play'; sh.t = Math.min(sh.dur, sh.t + dt); sh.missT = 0;
        p.showWatch = sh;
        if (p.local) zoom = true;
        if (sh.npc && Math.random() < dt * 0.6) sh.npc.talking = 0.4; // trying not to laugh
      } else if (!(p.watching && this.present)) { sh.missT += dt; sh.waitT += dt; } // while he watches you, they wait
      // "No, LOOK!"
      if (sh.npc && !look && !this.cutscene && sh.missT > (sh.state === 'call' ? 7 : 5) && this.t >= (sh.npc.speakUntil || 0)) {
        sh.nag++; sh.missT = 0;
        this.friendSay(sh.npc, sh.npc.kind === 'sam' ? 's_lookagain' : 'n_lookagain', 0.3);
      }
      if (sh.t >= sh.dur - 0.02) this.endShow(sh, 'done');
      else if (sh.waitT > (sh.mission ? 70 : 32) || sh.nag > (sh.mission ? 6 : 3)) this.endShow(sh, 'gone');
    }
    this.shows = this.shows.filter((s) => !s.over);
    this.vidZoom = zoom;
    for (const h of this.heldTrash) { h.t -= dt; h.held.render(dt, {}); if (h.t <= 0) h.held.dispose(); }
    this.heldTrash = this.heldTrash.filter((h) => h.t > 0);
    // a video someone sent you
    const job = this.vidJob, m = this.phone.mission;
    if (job && m && m.player.done && !job.done) job.done = true;
  },

  /** you got caught: whatever you were watching is over */
  cancelVideos(p, why = 'caught') {
    for (const sh of this.shows) if (!sh.over && (sh.to === p || sh.fromP === p)) this.endShow(sh, why);
    if (p.local && this.vidJob && !this.vidJob.done) this.vidJob.caught = true;
  },

  /** he grabs the phone... and his face is on it */
  videoScare(p) {
    if (!p.local) { if (this.mp) this.mp.toPlayer(p, { t: 'vscare' }); return; }
    this.localVideoScare();
  },
  localVideoScare() {
    const ph = this.phone, A = this.audio;
    ph.mode = 'face'; ph.forceT = 1.9;
    A.play('scream', { vol: 0.95, local: true, reverb: 0.1 });
    A.play('stinger_1', { vol: 0.8, local: true });
    this.redFlash = 1; this.shake = Math.max(this.shake, 0.7); this.glitch = 0.7; this.scareFear = 1;
  },

  // ---------------------------------------------------------------- story missions
  /** a friend sends you a video: watch all of it while he isn't looking */
  *videoSent(f, key, from) {
    const touch = this.input.touch;
    if (f && f.gone) return;
    yield* this.until(() => this.ready() && !this.ui.noteOpen && !this.talk, 25);
    if (f) yield* this.whisper(f, 's_sent', 0.2);
    const name = from || (f ? f.name : 'Unknown');
    const k = key ?? this.pickClip();
    const job = (this.vidJob = { key: k, done: false, caught: false });
    this.phone.setMission(k, (Math.random() * 1e9) | 0, name);
    this.audio.play('phone_buzz', { pos: this.camPos.clone().add(_d.set(0.15, -0.5, -0.1)), vol: 0.7, ref: 0.6, reverb: 0.02 });
    this.ui.phoneAlert(true);
    this.timers.after(3, () => this.ui.phoneAlert(false));
    const id = 'sent' + (this.vidMissions = (this.vidMissions || 0) + 1);
    this.addObjective({ id, text: touch ? `Watch the video ${name} sent you, all of it (hold PHONE)` : `Watch the video ${name} sent you, all of it  [hold Q]` });
    this.ui.hint('Watch it while he isn\'t looking. <b>If he sees you watching a video, he takes your phone.</b>', 6);
    yield* this.until(() => job.done || job.caught || this.vidJob !== job, 150);
    if (this.vidJob === job) this.vidJob = null;
    if (job.done) {
      this.completeObjective(id);
      this.mischief += 30;
      this.note(this.me, 'videos'); this.track.event(this.t, this.me, 'video', { how: 'sent by ' + name });
      if (k === 'found') this.localVideoScare(); // the video ends... and his face is on your phone
      yield* this.wait(1.2);
      this.phone.clearMission();
      return 'done';
    }
    this.phone.clearMission();
    this.dropObjective(id);
    if (job.caught) {
      yield* this.until(() => !this.cutscene && this.brainIdle, 40);
      if (f && !f.gone) yield* this.whisper(f, 's_sorry', 0.5);
      return 'caught';
    }
    if (f && !f.gone) yield* this.whisper(f, 's_meme2', 0.4);
    return 'missed';
  },

  /** a classmate next to you holds their phone out: "LOOK! look at this!" */
  *videoShow(f, key) {
    if (!f || f.gone) return;
    yield* this.until(() => this.ready() && !this.ui.noteOpen && !this.talk && !f.call, 25);
    const sh = this.startShow({ npc: f, to: this.me, key: key ?? this.pickClip(), mission: true });
    this.friendSay(f, f.kind === 'sam' ? 's_look' : 'n_look', 0.3);
    const id = 'show' + (this.vidMissions = (this.vidMissions || 0) + 1);
    this.addObjective({ id, text: `${f.name} is showing you a video: look at the phone and watch all of it` });
    yield* this.until(() => sh.over, 120);
    if (!sh.over) this.endShow(sh, 'gone');
    if (sh.result === 'done') {
      this.completeObjective(id);
      yield* this.wait(0.8);
      yield* this.whisper(f, f.kind === 'sam' ? 's_told' : 'n_told', 0.4);
      return 'done';
    }
    this.dropObjective(id);
    if (sh.result === 'caught') {
      yield* this.until(() => !this.cutscene && this.brainIdle, 40);
      return 'caught';
    }
    return 'missed';
  },

  /** free class: now and then a classmate wants to show somebody a video */
  updateFreeShows(dt) {
    if (this.mode !== 'free' || !this.scaresOn) return;
    this.nextShow -= dt;
    if (this.nextShow > 0) return;
    if (this.cutscene || this.choice || this.eventLock || this.memeBusy || this.shows.some((s) => !s.over)) { this.nextShow = 8; return; }
    this.nextShow = rand(110, 190);
    const opts = [];
    for (const f of this.friends) {
      if (f.gone || f.call || f.showing || this.anyTalkWith(f)) continue;
      for (const p of this.players) {
        if (p.talk || p.choice || p.phoneUp) continue;
        const d = f.headWorld(_a).distanceTo(p.camPos);
        if (d < 2.7) opts.push([f, p]);
      }
    }
    if (!opts.length) return;
    const [f, p] = pick(opts);
    this.startShow({ npc: f, to: p, key: this.pickClip() });
    this.friendSay(f, f.kind === 'sam' ? 's_look' : 'n_look', 0.3);
  },
};
