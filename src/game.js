// Gameplay for Madi Class: the teacher's brain (coroutines), the story
// chapters, free class, bully mechanics (repeat him / dumb questions),
// friends, phone, scares, strikes and endings.
import * as THREE from 'three';
import { clamp, lerp, damp, rand, pick, chance, wrapAngle, Bag, Timers } from './util.js';
import { PLAYER_EYE, BOARD_Z, ROWS, COLS } from './world.js';
import { VideoMixin } from './videos.js';
import { clipByKey } from './memes.js';
import { RunStats } from './stats.js';
import {
  FREE_LENGTH, PHASE_AT, PET_LIMIT, BOARD_TEXT, LECTURE, WARN, FRIEND_LINES, PLAYER_LINES, MESSAGES, NOTES, PLAN_NOTE,
  QUESTIONS, HISTORY, CHAPTERS, ENDINGS, STORY_NOTES, FRIEND_EARLY, MEMES, MEME_IDLE, mock, clockLabel,
} from './data.js';

const CALM = 0.85;           // he walks slowly unless he is angry
const ANGRY = 2.5;
const MAX_STRIKES = 3;     // per class; every extra player in multiplayer adds one
// where players sit: the original seat (front row, middle) and three empty desks for friends,
// placed so nobody hides behind Sam or Nora
export const SEATS = [{ row: 0, col: 2 }, { row: 1, col: 0 }, { row: 1, col: 4 }, { row: 1, col: 3 }];
const SCARE_GAP = [[40, 55], [32, 46], [26, 38], [22, 32]];
const CALL_GAP = [[30, 42], [26, 38], [22, 34], [20, 30]];
const BUZZ_GAP = [[44, 60], [38, 54], [34, 48], [30, 44]];
const STEPS = ['step_1', 'step_2', 'step_3', 'step_4'];
const FRONT = new THREE.Vector3(0, 1.2, -1.0); // roughly where the class is, for "looking at the class"
// walking between the desks: aisles run front to back; the walkways are in front of and behind the rows
const AISLES = [-3.75, -2.25, -0.75, 0.75, 2.25, 3.75]; // between the desk columns, plus along both walls
const FRONT_Z = -3.0, BACK_Z = 4.3;
const region = (z) => (z <= -2.75 ? 0 : z >= 3.95 ? 2 : 1); // 0 front, 1 among the desks, 2 back
const nearestAisle = (x) => AISLES.reduce((b, a) => (Math.abs(a - x) < Math.abs(b - x) ? a : b), AISLES[0]);

const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), v4 = new THREE.Vector3();

function wpick(list) {
  let tot = 0;
  for (const [w] of list) tot += w;
  let r = Math.random() * tot;
  for (const [w, v] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][1];
}

export class Game {
  constructor(sys) {
    Object.assign(this, sys);
    this.state = 'title';
    this.timers = new Timers();
    this.blackout = 0; this.blackoutTarget = 0;
    this.shake = 0; this.glitch = 0; this.scareFear = 0; this.redFlash = 0; this.underLight = 0;
    this.yaw = 0; this.pitch = 0.0;
    this.camPos = new THREE.Vector3();
    this.camFwd = new THREE.Vector3();
    this.boardCenter = new THREE.Vector3(0, 1.65, BOARD_Z);
    this.writePose = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) };
    this.titleT = 0;
    this.t = 0;
    this.dt = 0.016;
    this.mode = 'free'; this.chapter = 0;
    this.difficulty = 'easy';      // 'easy' (3 strikes) or 'hard' (one strike; if he sees you, he comes right away)
    // everyone in the class. Solo: just you. Multiplayer (src/mp.js): friends join over the network.
    this.mp = null;
    this.role = 'solo';
    this.players = [];
    this.me = this.addPlayer('me', 'You', 0, true);
    this.focus = this.me;          // the player he is paying attention to
    this.maxStrikes = MAX_STRIKES;
    // his face sometimes appears in the door window
    const door = this.world.door;
    this.doorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.42), new THREE.MeshBasicMaterial({ map: this.portraitTex, color: 0x7c7c7c, fog: false }));
    this.doorFace.position.copy(door.glass.position).add(new THREE.Vector3(-0.004, 0, 0));
    this.doorFace.rotation.y = -Math.PI / 2;
    this.doorFace.visible = false;
    door.group.add(this.doorFace);
    // the player's own raised hand (for asking questions)
    this.handUp = 0;
    if (this.hand) {
      this.handGroup = new THREE.Group();
      this.handGroup.add(this.hand.scene);
      this.camera.add(this.handGroup);
      this.handGroup.visible = false;
    }
    this.teacher.onStep = (pos, sp) => {
      if (!this.teacher.root.visible || this.state !== 'playing') return;
      this.audio.play(pick(STEPS), { pos: new THREE.Vector3(pos.x, 0.05, pos.z), vol: 0.32 + Math.min(0.6, sp * 0.28), ref: 1.6, reverb: 0.3, rate: rand(0.92, 1.08) });
    };
    this.track = new RunStats(); // what every player did this class
    this.setupVideos();
    this.reset('free', 0);
  }

  // ------------------------------------------------------------------ players
  addPlayer(id, name, seat, local = false) {
    const p = { id, name, local, in: { talk: false, phone: false, echo: false, ask: false }, avatar: null, yaw: 0, pitch: 0 };
    p.camPos = local ? this.camPos : new THREE.Vector3();
    p.camFwd = local ? this.camFwd : new THREE.Vector3(0, 0, -1);
    this.seatPlayer(p, seat);
    this.resetPlayer(p);
    this.players.push(p);
    return p;
  }
  seatPlayer(p, seat) {
    const s = SEATS[seat];
    p.seat = seat;
    p.desk = { x: COLS[s.col], z: ROWS[s.row], top: 0.74, row: s.row };
    p.eye = new THREE.Vector3(COLS[s.col], PLAYER_EYE.y, ROWS[s.row] + 0.55);
    if (!p.local) p.camPos.copy(p.eye);
  }
  resetPlayer(p) {
    if (p.whisperSnd) p.whisperSnd.stop(0.05);
    Object.assign(p, { talk: null, whisperSnd: null, noise: 0, heat: 0, watching: false, near: false, dist: 9, phoneUp: false,
      echoStreak: 0, lastEcho: -99, qCount: 0, qLast: -99, qBusy: false, choice: null, handT: 0 });
  }
  removePlayer(id) {
    const p = this.players.find((x) => x.id === id);
    if (!p || p.local) return;
    if (p.talk) this.endTalk(p);
    if (p.choice) this.pickChoice(-1, p);
    this.players = this.players.filter((x) => x !== p);
    if (this.focus === p) this.focus = this.me;
  }
  /** the camera of the player he is focused on (in solo: yours) */
  get cp() { return this.focus.camPos; }
  // the local player's state, under the names the rest of the code (and the tests) use
  get talk() { return this.me.talk; } set talk(v) { this.me.talk = v; }
  get echoStreak() { return this.me.echoStreak; } set echoStreak(v) { this.me.echoStreak = v; }
  get lastEcho() { return this.me.lastEcho; } set lastEcho(v) { this.me.lastEcho = v; }
  get qCount() { return this.me.qCount; } set qCount(v) { this.me.qCount = v; }
  get qLast() { return this.me.qLast; } set qLast(v) { this.me.qLast = v; }
  get qBusy() { return this.me.qBusy; } set qBusy(v) { this.me.qBusy = v; }
  get handT() { return this.me.handT; } set handT(v) { this.me.handT = v; }

  // ------------------------------------------------------------------ setup
  reset(mode, chapter) {
    const T = this.teacher, W = this.world;
    this.mode = mode; this.chapter = chapter;
    this.t = 0; this.phase = mode === 'story' ? chapter : 0;
    this.anger = 0; this.mischief = 0; this.strikes = 0;
    this.flags = { r40: false, r70: false };
    this.brain = null; this.brainIdle = false; this.script = null; this.fx = [];
    this.cutscene = false; this.eventLock = false; this.ending = false; this.lockBully = false;
    this.idleKind = 'lesson';
    this.present = true;
    this.allowEcho = false; this.allowAsk = false;
    this.callsOn = false; this.buzzOn = false; this.scaresOn = false;
    this.scarePool = null;
    this.projAuto = mode === 'free';
    this.boardRow = 0;
    this.textBags = BOARD_TEXT.map((l) => new Bag(l));
    this.lectureBags = LECTURE.map((l) => new Bag(l));
    this.qBag = new Bag(QUESTIONS);
    this.msgIndex = [0, 0, 0, 0];
    this.nextCall = 18; this.nextBuzz = 30; this.nextScare = 36; this.nextWipe = 50;
    this.scareDone = {}; this.lastScare = {};
    this.notesGiven = 0;
    this.stats = { caught: 0, talk: 0, phone: 0, echoes: 0, questions: 0, memes: 0, videos: 0, fails: 0 };
    this.track.reset(); this.closeArm = null;
    this.talk = null; this.buzz = null; this.phoneUpTime = 0; this.phoneScares = 0; this.noteLatch = false;
    this.noise = 0; this.watching = false; this.near = false; this.blind = false; this.typing = false;
    this.teacherDist = 9;
    this.echoable = null; this.echoStreak = 0; this.lastEcho = -99; this.echoBusy = false;
    this.qCount = 0; this.qLast = -99; this.qBusy = false;
    this.choice = null;
    this.idleT = 0; this.memeAt = rand(MEME_IDLE[0], MEME_IDLE[1]); this.memesOn = false; this.memeBusy = false;
    this.memeBag = new Bag(MEMES); this.lastMemeKid = null; this.snitches = [];
    this.buzzRead = null;
    this.objectives = [];
    this.quizScore = 0;
    this.emergency = 0;
    this.camOverride = null;
    this.endAction = null;
    this.yaw = 0; this.pitch = 0.0;
    this.clock = { from: 0, to: 240, t0: 0, dur: FREE_LENGTH, fixed: null };
    this.clockMin = 0; this.lastTick = -1;
    this.teacherVoice = null; this.chalkSnd = null;
    for (const p of this.players) this.resetPlayer(p);
    this.focus = this.me;
    this.hard = this.difficulty === 'hard';
    this.maxStrikes = this.hard ? 1 : MAX_STRIKES + Math.max(0, this.players.length - 1);
    this.noteJob = null;
    this.timers.clear();
    this.blackout = this.blackoutTarget = 0;
    this.shake = this.glitch = this.scareFear = this.redFlash = this.underLight = 0;
    W.resetProps();
    W.board.clear();
    W.showSilhouette = false;
    W.gloomTarget = 0.2;
    this.doorFace.visible = false;
    if (T.glassesHeld || T.glasses.parent !== T.head) T.wearGlasses(true);
    T.root.visible = true;
    T.root.position.y = 0;
    T.place(-1.9, -6.38, Math.PI);
    T.lookAt(null); T.setPose('rest');
    T.leanTarget = T.stretchTarget = T.rollTarget = T.jawTarget = T.crouchTarget = T.stanceTarget = 0;
    T.jitter = 0; T.talk = 0;
    T.eyeGlow = 0.12; T.faceGlow = 0.08; T.lensGlow = 0; T.clap = null;
    for (const f of this.friends) {
      f.setGone(false); f.setHollow(false); f.lookTarget = null; f.forcePitch = null; f.tremble = 0; f.leanRollTarget = 0;
      f.call = null; f.bag = new Bag(FRIEND_LINES[f.kind]); f.earlyBag = new Bag(FRIEND_EARLY[f.kind]); f.linesDone = 0; f.speaking = null; f.speakNoise = 0; f.talking = 0;
    }
    for (const s of this.students) { s.lookTarget = null; s.speed = 4; s.taken = false; s.setHollow(false); s.setGone(false); s.forcePitch = null; s.tremble = 0; s.talking = 0; }
    if (this.kevin) { this.kevin.setGone(true); this.kevin.setHollow(true); this.kevin.lookTarget = null; }
    this.resetVideos();
    this.searching = false;
    this.ui.clearTransient();
    this.ui.setObjectives([]);
    this.ui.closeChoices();
  }

  start(mode = 'free', chapter = 0) {
    this.reset(mode, chapter);
    this.state = 'playing';
    this.input.enable(true);
    this.ui.screen(null);
    this.ui.show('hud', true);
    this.audio.stopAll();
    this.audio.stopAmbience();
    this.audio.startAmbience(new THREE.Vector3(0, 3, -2), new THREE.Vector3(-5.5, 1.8, -1));
    this.audio.fadeBus('amb', 1, 0.5);
    this.audio.fadeBus('music', 1, 0.1);
    this.script = mode === 'story' ? [this.chapter1, this.chapter2, this.chapter3, this.chapter4][chapter].call(this) : this.freeScript();
    if (this.hard) this.timers.after(6, () => this.state === 'playing' && this.ui.hint('<b>HARD:</b> one strike. If he <b>sees</b> you whispering or on your phone, he comes right away.', 6));
    if (this.mp) this.mp.onStart(mode, chapter);
  }

  // ------------------------------------------------------------- main tick
  tick(dt) {
    this.dt = dt;
    if (this.role === 'guest' && this.mp && this.state !== 'title') this.mp.guestTick(dt);
    else if (this.state === 'title') this.titleTick(dt);
    else if (this.state === 'playing') this.playTick(dt);
    this.render(dt);
  }

  titleTick(dt) {
    this.titleT += dt;
    const T = this.teacher;
    this.yaw = Math.sin(this.titleT * 0.13) * 0.18;
    this.pitch = 0.08 + Math.sin(this.titleT * 0.21) * 0.03;
    this.applyCamera(dt);
    T.lookAt(this.camPos, 3);
    T.update(dt, { twitchy: true });
    const att = T.headWorld(v3).clone();
    for (const c of this.allKids()) { c.attend = att; c.update(dt); }
    for (const p of this.players) if (p.avatar) p.avatar.update(dt, { yaw: 0, pitch: 0.1 }); // friends waiting in the lobby
    this.world.board.update(dt);
    if (chance(dt * 0.15)) this.world.lights.banks[(Math.random() * 3) | 0].flicker = rand(0.2, 0.8);
  }

  allKids() { return this.kevin ? [...this.friends, ...this.students, this.kevin] : [...this.friends, ...this.students]; }

  playTick(dt) {
    const T = this.teacher;
    this.dt = dt;
    this.t += dt;
    this.updateClock();
    if (this.mode === 'free') {
      let p = 0;
      for (let i = 0; i < PHASE_AT.length; i++) if (this.t >= PHASE_AT[i]) p = i;
      if (p !== this.phase) this.enterPhase(p);
    }
    this.updateLook(dt);
    this.timers.update(dt);
    if (this.script && this.script.next().done) this.script = null;
    if (this.state !== 'playing') return; // the script may have ended the game
    // the teacher's brain runs as a coroutine; reactions and story beats replace it
    if (!this.brain) { this.brain = this.idleBrain(); this.brainIdle = true; }
    if (this.brain.next().done) { this.brain = null; this.brainIdle = false; }
    if (this.state !== 'playing') return;
    this.fx = this.fx.filter((g) => !g.next().done);
    T.talk = this.t < (this.voiceUntil || 0) ? 0.5 + 0.5 * Math.abs(Math.sin(this.t * 11) * Math.sin(this.t * 4.3 + 1)) : 0;
    T.update(dt, { twitchy: this.phase >= 2 });
    const touched = this.world.board.update(dt);
    this.updateChalkSound(touched);
    const att = this.present ? T.headWorld(v3).clone() : null;
    for (const c of this.allKids()) { c.attend = att; c.update(dt); }
    for (const k in this.world.dynamicChairs) this.world.dynamicChairs[k].update(dt, this.t);
    this.updateWatching();
    this.phone.clock = this.clockText();
    this.updateShows(dt);
    if (!this.cutscene) this.updateActions(dt);
    else {
      this.phone.up = false; this.noise = 0; this.input.takePressed();
      for (const p of this.players) { if (p.talk) this.endTalk(p); p.noise = 0; p.phoneUp = false; p.vid = false; p.in.echo = p.in.ask = false; }
    }
    this.updateChoice(dt);
    this.updateIdle(dt);
    this.updateHand(dt);
    this.phone.update(dt);
    this.updateAnger(dt);
    if (!this.cutscene && !this.memeBusy && !this.eventLock && !this.lockBully) { // nothing interrupts a story moment (or the class clown getting caught)
      if (this.callsOn) this.updateCalls(dt);
      if (this.buzzOn) this.updateBuzz(dt);
      if (this.scaresOn) this.updateDirector(dt);
      this.updateFreeShows(dt);
    }
    for (const p of this.players) {
      if (p.echoStreak > 0 && this.t - p.lastEcho > 30) p.echoStreak = 0;
      if (p.qCount > 0 && this.t - p.qLast > 45) { p.qCount--; p.qLast = this.t; }
      if (!p.local && p.handT > 0) p.handT -= dt;
    }
    this.updateHud();
    if (this.mp) this.mp.hostTick(dt);
  }

  enterPhase(p) {
    this.phase = p;
    const W = this.world;
    W.gloomTarget = [0.2, 0.35, 0.6, 0.9][p];
    if (p === 2) W.lights.banks[2].dead = true; // the back light dies
    if (p === 3) { W.lights.banks[1].flicker = 3; this.emergency = 1; }
  }

  // ------------------------------------------------------------- clock
  clockText() {
    const m = 8 * 60 + 30 + Math.floor(this.clockMin || 0), h = Math.floor(m / 60) % 12 || 12;
    return h + ':' + String(m % 60).padStart(2, '0');
  }
  setClockRun(from, to, seconds) { this.clock = { from, to, t0: this.t, dur: seconds, fixed: null }; }
  updateClock() {
    const c = this.clock;
    if (c.fixed !== null) this.clockMin = c.fixed;
    else this.clockMin = c.from + clamp((this.t - c.t0) / c.dur, 0, this.mode === 'free' ? 1 : 0.985) * (c.to - c.from);
  }

  // ------------------------------------------------------------- camera
  updateLook(dt) {
    const d = this.input.consume();
    if (!this.camOverride) {
      this.yaw = clamp(this.yaw + d.yaw, -2.85, 2.85);
      this.pitch = clamp(this.pitch + d.pitch, -1.1, 1.05);
    }
    this.applyCamera(dt);
  }

  applyCamera(dt) {
    const cam = this.camera;
    const ex = this.me.eye;
    const o = this.camOverride;
    if (o) {
      o.t += dt;
      const k = clamp(o.t / o.dur, 0, 1);
      const e = k * k * (3 - 2 * k);
      cam.position.lerpVectors(o.from, o.to, e);
      cam.position.y += Math.abs(Math.sin(o.t * 9)) * 0.05 * (k < 1 ? 1 : 0);
      this.yaw = lerp(this.yaw, o.yaw, 1 - Math.exp(-4 * dt));
      this.pitch = lerp(this.pitch, 0, 1 - Math.exp(-4 * dt));
    } else {
      cam.position.set(ex.x - Math.sin(this.yaw) * 0.07, ex.y + Math.sin(this.t * 1.6) * 0.004, ex.z + (1 - Math.cos(this.yaw)) * 0.05);
    }
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const s = this.shake * this.shake * 0.06;
    cam.rotation.set(this.pitch + rand(-s, s), this.yaw + rand(-s, s), rand(-s, s) * 0.5, 'YXZ');
    // watching a video on a phone someone holds out: the view zooms in on it
    if (!this.baseFov) this.baseFov = cam.fov;
    const wantFov = this.vidZoom && !o ? Math.min(this.baseFov, 30) : this.baseFov;
    if (Math.abs(cam.fov - wantFov) > 0.05) { cam.fov = damp(cam.fov, wantFov, 6, dt); cam.updateProjectionMatrix(); }
    cam.updateMatrixWorld(true);
    this.camPos.copy(cam.position);
    cam.getWorldDirection(this.camFwd);
  }

  lookingAt(p, cosMin) {
    v1.subVectors(p, this.camPos).normalize();
    return this.camFwd.dot(v1) > cosMin;
  }
  lookingBack() { return Math.abs(this.yaw) > 1.9; }

  updateWatching() {
    const T = this.teacher, W = this.world;
    const head = T.headWorld(v2);
    const fwd = T.forward(v3);
    const present = this.present && T.root.visible;
    const canSee = present && W.master > 0.3 && this.blackout < 0.5 && !this.blind && !this.typing;
    for (const p of this.players) {
      if (!p.local) {
        // a friend's camera: their seat and where they are looking
        p.camFwd.set(-Math.sin(p.yaw) * Math.cos(p.pitch), Math.sin(p.pitch), -Math.cos(p.yaw) * Math.cos(p.pitch));
        p.camPos.set(p.eye.x - Math.sin(p.yaw) * 0.07, p.eye.y, p.eye.z + (1 - Math.cos(p.yaw)) * 0.05);
      } else { p.yaw = this.yaw; p.pitch = this.pitch; }
      v4.subVectors(p.camPos, head).normalize();
      p.dist = head.distanceTo(p.camPos);
      p.lookDot = canSee ? fwd.dot(v4) : -1;
      p.watching = p.lookDot > 0.55;
      p.near = present && p.dist < 2.6 && !this.blind;
    }
    const me = this.me;
    this.teacherDist = me.dist; this.watching = me.watching; this.near = me.near;
    this.lookingAtTeacher = present && this.lookingAt(head, 0.84);
    this.lookingAtBoard = this.lookingAt(this.boardCenter, 0.72);
  }

  // ------------------------------------------------------------- player actions
  /** the friend or classmate player this player is looking straight at (for whispering) */
  aimFriend(p = this.me) {
    // whoever is closest among the people you are looking right at (Sam can hide the person behind him)
    let best = null, bestDist = 1e9;
    const consider = (who, head) => {
      v1.subVectors(head, p.camPos);
      const dist = v1.length();
      if (p.camFwd.dot(v1.normalize()) > 0.94 && dist < bestDist) { bestDist = dist; best = who; }
    };
    for (const f of this.friends) if (!f.gone) consider(f, f.headWorld(v2));
    for (const q of this.players) if (q !== p) consider(q, this.headOf(q, v2));
    return best;
  }
  /** where a player's head is (their avatar if they have one here, else their camera) */
  headOf(p, out = new THREE.Vector3()) { return p.avatar ? p.avatar.headWorld(out) : out.copy(p.camPos); }
  anyTalkWith(f) { return this.players.some((p) => p.talk && p.talk.friend === f); }

  updateActions(dt) {
    const inp = this.input, ui = this.ui, me = this.me;
    const pressed = inp.takePressed();
    let blocked = false;
    // a note is open: pressing a key folds it away (needed with pointer lock)
    if (ui.noteOpen && (inp.talk || inp.phone || pressed.echo || pressed.ask)) { ui.closeNote(); this.noteLatch = true; blocked = true; }
    if (this.noteLatch && !inp.talk && !inp.phone) this.noteLatch = false;
    blocked = blocked || ui.noteOpen || this.noteLatch || !!this.choice;
    if (!blocked && inp.phone) { /* with the phone up, R and T are phone buttons */ }
    else if (!blocked && pressed.echo && !this.canEcho(me) && this.allowEcho && !this.lockBully) ui.hint('Repeat him right after he says something.', 2.5);
    if (!blocked && !inp.phone && pressed.ask && !this.canAsk(me) && this.allowAsk && me.qBusy) ui.hint('Wait for him to answer first.', 2.5);
    this.playerActs(me, blocked ? { talk: false, phone: false, echo: false, ask: false, tap: false } : { talk: inp.talk, phone: inp.phone, echo: pressed.echo, ask: pressed.ask, tap: pressed.tap }, dt);
    // friends playing over the network
    for (const p of this.players) {
      if (p.local) continue;
      // with their phone up, R means "show this video" and T switches apps on their own screen
      const a = { talk: p.in.talk, phone: p.in.phone, echo: p.in.phone ? !!p.in.show : p.in.echo, ask: p.in.phone ? false : p.in.ask, tap: false };
      p.in.echo = p.in.ask = p.in.show = false;
      if (p.choice) a.talk = a.phone = a.echo = a.ask = false;
      this.playerActs(p, a, dt);
    }
    this.noise = me.noise;
    const aim = this.aimFriend(me);
    let pr = '';
    if (inp.phone && !blocked) {
      const ph = this.phone;
      if (ph.mode === 'memes' && aim && !aim.kind) pr = this.input.touch ? `tap SHOW · show ${aim.name} this video` : `[R] · show ${aim.name} this video`;
    } else if (aim && !me.talk) pr = this.input.touch ? `hold TALK · whisper to ${aim.name}` : `hold [E] · whisper to ${aim.name}`;
    ui.prompt(this.vidZoom ? '' : pr); // watching a phone held out to you: nothing in the way
    ui.phoneControls(inp.phone && !blocked ? this.phone.mode : null, this.input.touch);
  }

  /** one player's actions this frame: the local player, or a friend over the network */
  playerActs(p, a, dt) {
    const ph = this.phone, ui = this.ui;
    let noise = 0;
    const wantPhone = a.phone;
    if (wantPhone) this.phoneButtons(p, a); // with the phone up: tap, switch app, show a friend
    else {
      if (a.echo && this.canEcho(p)) this.doEcho(p);
      if (a.ask && this.canAsk(p)) this.openAsk(p);
    }
    const aim = this.aimFriend(p);
    const wantTalk = a.talk && !wantPhone;
    p.phoneUp = wantPhone;
    // a video playing (your own phone, or one held out to you) is louder than the game
    const ownVid = wantPhone && (p.local ? ph.playing : !!p.in.pv);
    const vidLoud = ownVid ? (p.local ? ph.loud : !!p.in.pl) : p.showWatch ? clipLoud(p.showWatch) : 0;
    p.vid = ownVid || !!p.showWatch;
    const vidNoise = p.vid ? (vidLoud ? 1 : 0.8) : 0;
    p.selfNoise = wantTalk && aim ? 1 : p.vid ? vidNoise : wantPhone ? 0.65 : 0; // what the player is doing (not their friends)
    if (p.local) ph.up = wantPhone;
    if (p.vid) { noise = Math.max(noise, vidNoise); this.mischief += dt * (this.blind || this.typing ? 10 : 5); }
    if (p.failT > 0) { p.failT -= dt; noise = Math.max(noise, 1); }
    if (p.shoutT > 0) { p.shoutT -= dt; noise = Math.max(noise, 1); }
    if (wantPhone) {
      noise = Math.max(noise, 0.65);
      this.note(p, 'phone', dt);
      if (!p.local) this.mischief += dt * (this.blind || this.typing ? 6 : 2);
      else {
        this.phoneUpTime += dt;
        if (this.buzz) {
          if (ph.mode !== 'message' || ph.message !== this.buzz.msg) {
            const m = this.buzz.msg;
            (ui.subtitle.local || ui.subtitle).call(ui, '📱 ' + m.from, m.text, m.from === 'Unknown' || m.from === 'Mr. Hale' ? 'phone creepy' : 'phone', 3.5);
          }
          ph.mode = 'message'; ph.message = this.buzz.msg;
          this.buzz.read += dt;
          if (this.buzz.read > 1.4) this.resolveBuzz();
        } else if (ph.mode === 'message') {
          this.msgShow = (this.msgShow || 0) + dt;
          if (this.msgShow > 2.2) { ph.home(); this.msgShow = 0; }
        } else if (ph.mode === 'game') {
          this.mischief += dt * (this.blind || this.typing ? 6 : 2);
        }
        if (this.phase >= 3 && this.phoneUpTime > 3 && this.phoneScares < 1 && !this.eventLock && this.brainIdle && chance(dt * 0.25)) {
          this.phoneScares++;
          this.interrupt(this.phoneScare());
        }
      }
    } else if (p.local) {
      this.phoneUpTime = 0;
      if (ph.mode === 'face' && !(ph.forceT > 0)) ph.home();
    }
    if (wantTalk && aim) {
      if (!p.talk || (p.talk.friend || p.talk.peer) !== aim) this.startTalk(p, aim);
      p.talk.time += dt;
      this.note(p, 'talk', dt);
      this.mischief += dt * (this.blind || this.typing ? 10 : 5);
      noise = Math.max(noise, 1);
      if (this.blind) this.completeObjective('glasses');
      if (this.typing) this.completeObjective('laptop');
      this.updateTalk(p, dt);
    } else if (p.talk) this.endTalk(p);
    for (const f of this.friends) if (this.t < (f.speakUntil || 0) && (f.partner || this.me) === p) noise = Math.max(noise, f.speakNoise || 0);
    if (p.local && this.buzz) noise = Math.max(noise, 0.25);
    p.noise = noise;
    this.updateNoteJob(p, dt);
  }

  /** whisper to Sam / Nora, or to a friend playing in the class */
  startTalk(p, aim) {
    if (p.talk) this.endTalk(p);
    const f = aim.kind ? aim : null;
    p.talk = { friend: f, peer: f ? null : aim, time: 0, stage: 'player', timer: 0 };
    if (f) {
      f.lookTarget = p.camPos;
      f.leanRollTarget = f.root.position.x < p.eye.x ? -0.1 : 0.1;
      f.partner = p;
    }
    v1.copy(f ? f.headWorld(v2) : this.headOf(aim, v2)).lerp(p.camPos, 0.7);
    p.whisperSnd = this.audio.play('whispers_loop', { loop: true, offset: rand(0, 12), vol: 0.22, pos: v1.clone(), ref: 0.5, reverb: 0.04 });
    if (f && f.call && p.local) {
      f.call = null;
      this.mischief += 20;
      this.ui.call('left', false); this.ui.call('right', false);
    }
  }

  updateTalk(p, dt) {
    const tk = p.talk, f = tk.friend;
    tk.timer += dt;
    if (tk.stage === 'player' && tk.timer > 0.9) {
      const line = pick(PLAYER_LINES);
      this.uiTo(p, 'subtitle', 'you', line, 'you', 2.2);
      if (tk.peer) this.uiTo(tk.peer, 'subtitle', p.name, line, 'you', 2.6); // only the friend you whisper to hears it
      tk.stage = f ? 'wait' : 'peer'; tk.timer = 0;
    } else if (tk.stage === 'wait' && tk.timer > 1.3) {
      this.friendSay(f, (this.present ? f.bag : f.earlyBag).next(), 0.35); // before he walks in, they talk about other things
      tk.stage = 'friend'; tk.timer = 0; tk.line = f.speaking;
    } else if (tk.stage === 'friend' && tk.timer > (tk.line ? tk.line.duration : 2) + 0.2) {
      this.mischief += 25;
      this.note(p, 'whispers');
      this.completeObjective('whisper');
      f.linesDone++;
      if (p.local && f.linesDone % 3 === 0 && this.notesGiven < NOTES.length) this.timers.after(1.2, () => this.giveNote());
      tk.stage = 'player'; tk.timer = 0;
    } else if (tk.stage === 'peer' && tk.timer > 2.2) {
      this.mischief += 20;
      this.note(p, 'whispers');
      this.completeObjective('whisper');
      tk.stage = 'player'; tk.timer = 0;
    }
  }

  endTalk(p = this.me) {
    const tk = p.talk;
    if (!tk) return;
    if (p.whisperSnd) { p.whisperSnd.stop(0.25); p.whisperSnd = null; }
    const f = tk.friend;
    p.talk = null;
    if (!f) return;
    if (p.watching && this.t < (f.speakUntil || 0)) { if (f.speaking) f.speaking.stop(0.3); f.talking = 0; f.speakUntil = 0; }
    f.leanRollTarget = 0;
    if (f.partner === p) f.partner = null;
    this.timers.after(1.2, () => { if (!f.call && !this.anyTalkWith(f)) f.lookTarget = null; });
  }

  /** run a UI call on one player's screen only */
  uiTo(p, fn, ...args) {
    if (p.local) (this.ui[fn].local || this.ui[fn]).apply(this.ui, args);
    else if (this.mp) this.mp.uiTo(p, fn, args);
  }
  /** a line said by a player: "YOU" on their own screen, their name on everyone else's */
  subFor(p, text, cls, dur) {
    if (this.mp) this.mp.subFor(p, text, cls, dur);
    else this.ui.subtitle('you', text, cls, dur);
  }

  sayAt(c, id, noise = 0, vol = 1.15) {
    if (c.speaking && this.t < (c.speakUntil || 0)) c.speaking.stop(0.1);
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: c.headWorld(new THREE.Vector3()), ref: 1.0, reverb: 0.08, vol: meta.shout ? 1.3 : vol });
    if (h) h.until = this.t + h.duration;
    c.speaking = h; c.speakNoise = noise; c.speakUntil = this.t + (h ? h.duration : 1.5);
    c.talking = h ? h.duration : 1.5;
    this.ui.subtitle(c.name, meta.text, meta.shout ? 'shout' : '', (h ? h.duration : 2) + 0.6);
    return h;
  }
  friendSay(f, id, noise) { if (!f || f.gone) return null; return this.sayAt(f, id, noise); }
  friend(kind) { return this.friends.find((f) => f.kind === kind); }

  playerSay(id, p = this.me) {
    const meta = this.audio.voices[id] || { text: '' };
    v1.copy(p.camFwd).multiplyScalar(0.25).add(p.camPos);
    const h = this.audio.say(id, { pos: v1.clone(), ref: 0.8, vol: 1.0, reverb: 0.12 });
    this.subFor(p, meta.text, 'you', (h ? h.duration : 2) + 0.5);
    return h;
  }

  giveNote(text, who) {
    if (this.cutscene) return false;
    if (!text) {
      if (this.notesGiven >= NOTES.length) return false;
      const [w, tx] = NOTES[this.notesGiven++];
      who = w; text = tx;
    }
    const f = this.friends.find((x) => x.kind === who && !x.gone) || this.friends.find((x) => !x.gone);
    if (!f) return false;
    this.audio.play('paper', { pos: f.headWorld(new THREE.Vector3()), vol: 0.8 });
    this.ui.showNote(`<small>from ${f.name}:</small><br>${text}`);
    this.mischief += 15;
    this.note(this.me, 'notes');
    return true;
  }

  // ------------------------------------------------------------- bully: repeat him
  canEcho(p = this.me) { // anyone can repeat his last line, once
    return this.allowEcho && !this.cutscene && !this.lockBully && !this.eventLock && !!this.echoable && this.t < this.echoable.until && !this.echoBusy && this.present;
  }

  doEcho(p = this.me) {
    const e = this.echoable;
    this.echoable = null;
    v1.copy(p.camFwd).multiplyScalar(0.25).add(p.camPos);
    // his own words, sped up and squeaky: a terrible impression
    this.audio.play(e.id, { rate: 1.42, vol: 0.85, pos: v1.clone(), ref: 0.7, reverb: 0.08, bus: 'voice' });
    this.subFor(p, mock(e.text), 'you mock', 2.6);
    p.echoStreak++; p.lastEcho = this.t;
    this.note(p, 'echoes'); this.track.event(this.t, p, 'echo', { streak: p.echoStreak });
    this.idleT = 0;
    this.mischief += 35;
    this.completeObjective('echo');
    this.timers.after(0.9, () => {
      this.audio.play('giggle', { pos: new THREE.Vector3(0, 1.1, 0.5), vol: 0.9, ref: 3, reverb: 0.2 });
      for (const k of this.allKids()) {
        if (k.gone || k.hollow || !chance(0.6)) continue;
        k.lookTarget = p.camPos; k.talking = 1.2;
        this.timers.after(rand(1.5, 3), () => { if (!k.call) k.lookTarget = null; });
      }
    });
    this.interrupt(this.reactEcho(p.echoStreak, p));
  }

  *reactEcho(n, p = this.me) {
    const T = this.teacher;
    this.echoBusy = true;
    try {
      yield* this.wait(0.8);
      if (n >= 3) { yield* this.bustedSeq('echo', p); return; }
      T.clap = null; T.setPose('rest');
      const home = new THREE.Vector3(T.pos.x, 0, T.pos.z), homeFace = T.facing;
      T.lookAt(FRONT, 2.5);
      T.facePoint(FRONT, 2.2);
      yield* this.wait(1.1);
      yield* this.say(n === 1 ? 't_whosaid' : 't_notfunny', 0.3);
      // he does not know who said it, so he goes and looks for them
      this.searching = true;
      yield* this.searchRows(n, p);
      this.anger = Math.min(85, this.anger + (n === 1 ? 6 : 14));
      T.lookAt(null, 3);
      T.leanTarget = 0; T.crouchTarget = 0;
      yield* this.walk(home.x, home.z);
      T.faceTo(homeFace, 3);
      yield* this.wait(0.5);
    } finally { this.echoBusy = false; this.searching = false; this.teacher.leanTarget = 0; this.teacher.crouchTarget = 0; }
  }

  /** down one aisle, stopping beside the desks to look at whoever sits there */
  *searchRows(n, p) {
    const T = this.teacher;
    const sus = [];
    for (const k of this.allKids()) if (!k.gone) sus.push({ kid: k, x: k.seat.x, z: k.seat.z, head: () => k.headWorld(new THREE.Vector3()) });
    for (const q of this.players) sus.push({ player: q, x: q.desk.x, z: q.eye.z, head: () => this.headOf(q, new THREE.Vector3()) });
    // the first time he picks a row at random; the second time he follows the sound
    const follow = chance(n >= 2 ? 0.75 : 0.35);
    const px = p.desk.x;
    let ax = follow ? (px >= 0 ? px + 0.75 : px - 0.75) : pick([-2.25, -0.75, 0.75, 2.25]);
    if (Math.abs(ax) > 3.8) ax = Math.sign(ax) * 3.75;
    const along = sus.filter((s) => Math.abs(Math.abs(s.x - ax) - 0.75) < 0.2).sort((a, b) => a.z - b.z);
    if (!along.length) return;
    const stops = along.slice(0, n >= 2 ? 3 : 2);
    T.lookAt(null, 3);
    yield* this.walk(ax, FRONT_Z, 1.0);
    for (const s of stops) {
      yield* this.walk(ax, s.z - 0.05, 1.05);
      T.facePoint(new THREE.Vector3(s.x, 0, s.z), 3.5);
      T.lookAt(s.head(), 4);
      T.leanTarget = 0.4; T.crouchTarget = 0.08;
      if (s.kid) { s.kid.lookTarget = T.headWorld(new THREE.Vector3()); s.kid.tremble = 0.6; s.kid.speed = 5; }
      yield* this.wait(rand(0.7, 1.0));
      if (s.player === p && n >= 2) {
        // the right desk. Does he know?
        yield* this.say('t_wasityou', 0.4);
        yield* this.wait(1.4);
      } else if (s.kid && s.kid.kind === 'kid' && chance(0.45)) {
        yield* this.waitVoice(this.sayAt(s.kid, this.kidVoice(s.kid, 'k_notme'), 0, 1.0), 0.2);
      } else if (chance(0.3)) yield* this.say('t_hmm', 0.2);
      else yield* this.wait(rand(0.4, 0.8));
      T.leanTarget = 0; T.crouchTarget = 0;
      if (s.kid) { s.kid.lookTarget = null; s.kid.tremble = 0; s.kid.speed = 4; }
    }
    // a last look over the whole class from the back of the aisle
    T.lookAt(FRONT, 2.5);
    yield* this.wait(0.8);
    if (n >= 2) yield* this.say('t_ifind', 0.4);
  }

  // ------------------------------------------------------------- bully: dumb questions
  canAsk(p = this.me) { return this.allowAsk && !this.cutscene && !this.lockBully && !this.eventLock && !p.qBusy && this.present && !(p.local ? this.choice : p.choice); }

  openAsk(p = this.me) {
    const qs = [];
    while (qs.length < 3) { const q = this.qBag.next(); if (!qs.includes(q)) qs.push(q); }
    this.openChoice('Raise your hand and ask…', qs.map((q) => (this.audio.voices[q.ask] || { text: q.id }).text.replace(/^Sir\? /, '')), 7, (i) => {
      if (i >= 0) this.askQuestion(qs[i], p);
    }, p);
  }

  askQuestion(q, p = this.me) {
    p.handT = 2.8;
    const h = this.playerSay(q.ask, p);
    p.qCount++; p.qLast = this.t;
    this.note(p, 'questions'); this.track.event(this.t, p, 'question', { q: q.id });
    this.idleT = 0;
    p.qBusy = true;
    this.mischief += 10;
    this.timers.after(h ? h.duration + 0.2 : 1.5, () => {
      if (this.state !== 'playing' || this.cutscene) { p.qBusy = false; return; }
      this.interrupt(this.reactQuestion(q, p.qCount, p));
    });
  }

  *reactQuestion(q, n, p = this.me) {
    const T = this.teacher;
    p.qBusy = true;
    try {
      T.lookAt(p.camPos, 5); T.facePoint(p.camPos, 2.5);
      yield* this.wait(0.7);
      if (n >= 4) { yield* this.bustedSeq('questions', p); return; }
      if (n === 3) {
        yield* this.say('t_noquestions', 0.3);
        yield* this.actStare(2);
        this.anger = Math.min(85, this.anger + 12);
        return;
      }
      // the dead stare: he does not know
      T.rollTarget = pick([-0.3, 0.3]);
      yield* this.wait(rand(2.4, 3.4));
      T.rollTarget = 0;
      if (q.type === 'instant') {
        yield* this.say(q.answer, 0.4);
        if (q.anger) this.anger = Math.min(85, this.anger + q.anger);
        this.giggle();
        this.completeObjective('ask');
        return;
      }
      yield* this.say('t_moment', 0.2);
      yield* this.laptopLookup(q.typed, q.result, q.note);
      yield* this.turnToClass();
      yield* this.say(q.answer, 0.4);
      this.giggle();
      this.mischief += 25;
      this.completeObjective('ask');
    } finally { p.qBusy = false; T.rollTarget = 0; }
    yield* this.walk(rand(-1.2, 1.2), -5.5);
  }

  giggle() {
    this.timers.after(0.3, () => this.audio.play('giggle', { pos: new THREE.Vector3(0, 1.1, 0.8), vol: 0.75, ref: 3, reverb: 0.2 }));
    const f = this.friends.filter((x) => !x.gone);
    if (f.length && chance(0.5)) { const ff = pick(f); this.timers.after(0.8, () => this.sayAt(ff, ff.kind === 'sam' ? 's_laugh' : 'n_laugh', 0.15, 0.8)); }
  }

  /** he walks to his desk, types, reads. The projector (if on) shows everything. */
  *laptopLookup(typed, result, note, { keepOpen = false } = {}) {
    const T = this.teacher, W = this.world, L = W.laptop, P = W.projector, A = this.audio;
    const st = W.teacherDesk.stand;
    let keys = null;
    try {
      T.lookAt(null, 3);
      yield* this.walk(st.x, -6.02);
      T.faceTo(0, 3);
      yield* this.wait(0.7);
      L.openTarget = 1; L.glowTarget = 1;
      A.play('key_enter', { pos: L.screenPos, vol: 0.5 });
      T.leanTarget = 0.5; T.crouchTarget = 0.1;
      T.setPose('type', { L: L.keyL, R: L.keyR, typing: false });
      T.lookAt(L.screenPos, 3);
      this.typing = true;
      yield* this.wait(0.9);
      if (!P.on && this.projAuto) {
        // he plugs it in... and has no idea the whole class can see it
        P.setOn(true);
        A.play('projector_on', { pos: P.devPos, vol: 0.8, ref: 3 });
        if (this.mode === 'story') this.timers.after(1.6, () => this.friendSay(this.friend('sam'), 's_projector', 0));
      }
      P.search('', null);
      T.poseData.typing = true;
      keys = A.play(pick(['keys_1', 'keys_2', 'keys_3']), { loop: true, pos: L.screenPos, vol: 0.7, ref: 1.5, reverb: 0.15 });
      for (let i = 1; i <= typed.length; i++) {
        P.search(typed.slice(0, i), null);
        yield* this.wait(rand(0.08, 0.2) + (typed[i - 1] === ' ' ? 0.15 : 0));
      }
      if (keys) { keys.stop(0.05); keys = null; }
      A.play('key_enter', { pos: L.screenPos, vol: 0.8 });
      T.poseData.typing = false;
      yield* this.wait(0.7);
      P.search(typed, result, note);
      T.rollTarget = 0.15;
      yield* this.wait(2.4); // he reads it, slowly
      T.rollTarget = 0;
    } finally {
      if (keys) keys.stop(0.05);
      this.typing = false;
      T.leanTarget = 0; T.crouchTarget = 0; T.setPose('rest');
      if (!keepOpen) { L.openTarget = 0; L.glowTarget = 0; }
    }
  }

  // ------------------------------------------------------------- choices (roll call, quiz, questions)
  openChoice(title, labels, timeout, onPick, p = this.me) {
    const c = { labels, until: this.t + timeout, timeout, onPick };
    if (p.local) {
      this.choice = c;
      this.input.takeChoice();
      this.ui.openChoices(title, labels, this.input.touch, (i) => this.pickChoice(i));
    } else {
      p.choice = c;
      if (this.mp) this.mp.openChoice(p, title, labels, timeout);
    }
  }
  pickChoice(i, p = this.me) {
    const c = p.local ? this.choice : p.choice;
    if (!c) return;
    if (!Number.isInteger(i) || i >= c.labels.length) i = -1; // nothing odd from the network gets through
    if (p.local) { this.choice = null; this.ui.closeChoices(); } else { p.choice = null; if (this.mp) this.mp.closeChoice(p); }
    c.onPick(i);
  }
  updateChoice() {
    const c = this.choice;
    if (c) {
      const k = this.input.takeChoice();
      if (k >= 0 && k < c.labels.length) this.pickChoice(k);
      else {
        this.ui.choiceTimer(clamp((c.until - this.t) / c.timeout, 0, 1));
        if (this.t >= c.until) this.pickChoice(-1);
      }
    }
    for (const p of this.players) if (!p.local && p.choice && this.t >= p.choice.until) this.pickChoice(-1, p);
  }
  *choose(title, labels, timeout, p = this.me) {
    let res = null;
    this.openChoice(title, labels, timeout, (i) => { res = i; }, p);
    while (res === null) yield;
    return res;
  }
  /** everyone gets the same question at once; the first answer counts. Returns [index, player]. */
  *chooseAny(title, labels, timeout) {
    let res = null, who = null, open = 0;
    for (const p of [...this.players]) {
      open++;
      this.openChoice(title, labels, timeout, (i) => {
        open--;
        if (i >= 0 && res === null) {
          res = i; who = p;
          for (const q of this.players) if (q !== p) this.pickChoice(-2, q);
        }
      }, p);
    }
    while (res === null && open > 0) yield;
    return [res === null ? -1 : res, who || this.me];
  }

  updateHand(dt) {
    if (!this.handGroup) return;
    if (this.handT > 0) this.handT -= dt;
    this.handUp = damp(this.handUp, this.handT > 0 ? 1 : 0, 9, dt);
    this.handGroup.visible = this.handUp > 0.02;
    this.handGroup.position.set(0.2, -0.78 + this.handUp * 0.52, -0.5);
    this.handGroup.rotation.set(-0.15, 0, -0.12 + Math.sin(this.t * 3) * 0.03 * this.handUp);
  }

  // ------------------------------------------------------------- objectives
  setObjectives(list) {
    this.objectives = list.map((o) => ({ ...o, done: false }));
    this.ui.setObjectives(this.objectives);
  }
  /** count something a player did (the old totals and the per-player tracker) */
  note(p, key, n = 1) {
    if (key in this.stats) this.stats[key] += n;
    this.track.add(p, key, n);
  }
  dropObjective(id) {
    if (!this.objectives.some((x) => x.id === id)) return;
    this.objectives = this.objectives.filter((x) => x.id !== id);
    this.ui.setObjectives(this.objectives);
  }
  objDone(id) { const o = this.objectives.find((x) => x.id === id); return !!(o && o.done); }
  completeObjective(id) {
    const o = this.objectives.find((x) => x.id === id);
    if (!o || o.done) return;
    o.done = true;
    this.track.global.objectives++;
    this.track.event(this.t, null, 'objective', { id });
    this.mischief += 20;
    this.audio.play('ding', { vol: 0.5, reverb: 0.1, bus: 'music' });
    this.ui.setObjectives(this.objectives);
  }

  // ------------------------------------------------------------- friends calling you
  updateCalls(dt) {
    this.nextCall -= dt;
    if (this.nextCall <= 0 && !this.talk && !this.eventLock && !this.choice) {
      const c = this.friends.filter((f) => !f.gone && !f.call);
      if (c.length) {
        const f = pick(c);
        f.call = { stage: 1, timer: 8 };
        f.lookTarget = this.camPos;
        this.friendSay(f, f.kind === 'sam' ? 's_psst' : 'n_psst', 0.25);
      }
      const g = CALL_GAP[this.phase];
      this.nextCall = rand(g[0], g[1]);
    }
    let left = false, right = false;
    for (const f of this.friends) {
      if (!f.call || f.gone) continue;
      v1.copy(f.headWorld(v2)).project(this.camera);
      const behind = v1.z > 1;
      const sx = behind ? -v1.x : v1.x;
      if (Math.abs(sx) > 0.55 || behind) { if (sx < 0) left = true; else right = true; }
      f.call.timer -= dt;
      if (f.call.timer <= 0) {
        f.call.stage++;
        if (f.call.stage === 2) {
          this.friendSay(f, f.kind === 'sam' ? 's_psst2' : 'n_psst2', 0.5);
          f.call.timer = 7;
        } else {
          this.friendSay(f, f.kind === 'sam' ? 's_hey' : 'n_hey', 1);
          f.call = null;
          this.anger = Math.min(70, this.anger + 22);
          if (this.brainIdle) this.interrupt(this.reactWarn(true));
          const ff = f;
          this.timers.after(3.2, () => {
            if (ff.gone || this.cutscene) return;
            this.friendSay(ff, ff.kind === 'sam' ? 's_sorry' : 'n_sorry', 0.2);
            ff.lookTarget = null; ff.forcePitch = 0.5;
            this.timers.after(6, () => { ff.forcePitch = null; });
          });
        }
      }
    }
    this.ui.call('left', left);
    this.ui.call('right', right);
  }

  // ------------------------------------------------------------- phone buzzing
  nextMessage() {
    const p = this.phase;
    const list = MESSAGES[p];
    const m = list[this.msgIndex[p] % list.length];
    this.msgIndex[p]++;
    return { from: m[0], text: m[1] };
  }

  updateBuzz(dt) {
    this.nextBuzz -= dt;
    if (this.nextBuzz <= 0 && !this.buzz && !this.eventLock && !this.choice) {
      this.buzz = { timer: 9, read: 0, tick: 0, msg: this.nextMessage() };
      this.ui.phoneAlert(true);
    }
    const b = this.buzz;
    if (!b) return;
    b.tick -= dt;
    if (b.tick <= 0) {
      this.audio.play('phone_buzz', { pos: v1.copy(this.camPos).add(v2.set(0.15, -0.5, -0.1)).clone(), vol: 0.75, ref: 0.6, reverb: 0.02 });
      b.tick = 1.15;
    }
    if (!this.phone.up) {
      b.timer -= dt;
      if (b.timer <= 0) {
        this.audio.play('ringtone', { vol: 1.15, pos: this.camPos.clone().add(v2.set(0, -0.4, 0)), ref: 1.5, reverb: 0.3 });
        this.ui.subtitle('', '♪ your phone is RINGING ♪', 'shout', 2.5);
        this.anger = Math.min(75, this.anger + 25);
        this.buzz = null;
        this.ui.phoneAlert(false);
        const g = BUZZ_GAP[this.phase];
        this.nextBuzz = rand(g[0], g[1]);
        if (this.brainIdle) this.interrupt(this.reactPhone());
      }
    }
  }

  resolveBuzz() {
    if (this.buzz) this.buzzRead = this.buzz.msg;
    this.buzz = null;
    this.msgShow = 0;
    this.mischief += 10;
    this.ui.phoneAlert(false);
    const g = BUZZ_GAP[this.phase];
    this.nextBuzz = rand(g[0], g[1]);
  }

  // ------------------------------------------------------------- anger (gentle: scary fun, not hardcore)
  updateAnger(dt) {
    let add = 0;
    for (const p of this.players) {
      p.heat *= Math.exp(-dt / 8);
      if (p.noise > 0 && this.present) { // nobody gets angry while he is not in the room
        const rate = p.watching ? 14 : p.near ? 8 : [2.5, 3, 3.4, 3.8][this.phase];
        const a = p.noise * rate * dt;
        add += a; p.heat += a;
      }
      // HARD: if he really SEES you (looking right at you) whispering or on your phone, he comes right away.
      // What he only hears works like Easy: his anger builds and he warns you first.
      p.seenT = this.hard && this.present && p.watching && p.lookDot > 0.8 && (p.selfNoise || 0) >= 0.6 ? (p.seenT || 0) + dt : 0;
      // both modes: if he sees you watching a video, he comes for the phone
      p.vidSeenT = p.vid && this.present && p.watching && p.lookDot > 0.8 ? (p.vidSeenT || 0) + dt : 0;
    }
    if (!this.cutscene && !this.ending && !this.eventLock && !this.lockBully && !this.choice) {
      const v = this.players.find((p) => p.vidSeenT > 0.45);
      if (v) { v.vidSeenT = 0; this.bust('video', v); return; }
    }
    if (this.hard && !this.cutscene && !this.ending && !this.eventLock && !this.lockBully && !this.choice) {
      const seen = this.players.find((p) => p.seenT > 0.3);
      if (seen) { seen.seenT = 0; this.bust('noise', seen); return; }
    }
    if (add > 0) this.anger += add;
    else this.anger -= (this.lookingAtTeacher || this.lookingAtBoard ? 7 : 5) * dt;
    // he goes after whoever has been making the most noise lately
    if (!this.cutscene) {
      let hot = this.players.includes(this.focus) ? this.focus : this.me;
      for (const p of this.players) if (p.heat > hot.heat + 2) hot = p;
      this.focus = hot;
    }
    this.anger = clamp(this.anger, 0, 100);
    if (this.cutscene || this.ending) return;
    const a = this.anger, fl = this.flags;
    // close calls: he was on his way over (70+) and calmed down again without catching anyone
    if (a > this.track.global.peakAnger) this.track.global.peakAnger = a;
    if (a >= 70 && !this.closeArm) this.closeArm = this.focus;
    else if (this.closeArm && a < 30) { this.note(this.closeArm, 'closeCalls'); this.track.event(this.t, this.closeArm, 'closeCall'); this.closeArm = null; }
    if (a >= 100) { this.bust('noise', this.focus); return; }
    if (!this.lockBully && !this.choice && !this.eventLock) { // he warns you first
      if (a >= 70 && !fl.r70) { fl.r70 = fl.r40 = true; this.interrupt(this.reactApproach()); }
      else if (a >= 40 && !fl.r40) { fl.r40 = true; this.interrupt(this.reactWarn(false)); }
    }
    if (a < 25) fl.r40 = false;
    if (a < 50) fl.r70 = false;
  }

  // ------------------------------------------------------------- coroutine helpers
  interrupt(gen) {
    if (this.brain) { try { this.brain.return(); } catch (e) { console.warn(e); } }
    this.cleanupTeacher();
    this.brain = gen;
    this.brainIdle = false;
  }

  /** run a story beat as the teacher's brain; retry if a reaction interrupts it */
  *cmd(make, tries = 6) {
    yield* this.until(() => !this.memeBusy, 45); // let him finish dealing with the class clown
    for (let i = 0; i < tries; i++) {
      let done = false;
      const g = make();
      const wrapped = (function* () { yield* g; done = true; })();
      this.interrupt(wrapped);
      while (this.brain === wrapped) yield;
      if (done) return true;
      yield* this.until(() => !this.brain || this.brainIdle, 40);
    }
    return false;
  }

  cleanupTeacher() {
    const T = this.teacher, B = this.world.board;
    if (B.job && B.job.type === 'write') B.stopJob();
    if (B.job && B.job.type === 'erase') { B.stopJob(); this.boardRow = 4; }
    if (this.chalkSnd) { this.chalkSnd.stop(0.08); this.chalkSnd = null; }
    T.clap = null;
    T.owl = false;
    T.setPose('rest');
    T.moveTarget = null;
    T.leanTarget = 0; T.stretchTarget = 0; T.rollTarget = 0; T.crouchTarget = 0; T.stanceTarget = 0;
    if (T.glassesHeld) T.wearGlasses();
    this.blind = false; this.typing = false;
    if (T.root.position.y !== 0 && !this.ending) T.root.position.y = 0;
  }

  *wait(s) { let t = 0; while (t < s) { t += this.dt; yield; } }
  *until(fn, timeout = 1e9) { let t = 0; while (!fn() && t < timeout) { t += this.dt; yield; } }
  *waitVoice(h, extra = 0.3) { yield* this.wait((h ? h.duration : 0) + extra); }

  /** walk somewhere, facing the way he walks. Between the desks he only uses the aisles. */
  *walk(x, z, speed = CALM) {
    const T = this.teacher;
    const from = region(T.pos.z), to = region(z);
    const needPath = from !== 1 && to !== 1 ? from !== to : Math.abs(x - T.pos.x) > 0.3;
    if (needPath) {
      const pts = [];
      let cz = T.pos.z, cx = T.pos.x;
      if (from === 1) {
        // leave by the end of this aisle that is closer to where he is going
        const end = to === 2 ? BACK_Z : to === 0 ? FRONT_Z : (Math.abs(cz - FRONT_Z) + Math.abs(z - FRONT_Z) <= Math.abs(cz - BACK_Z) + Math.abs(z - BACK_Z) ? FRONT_Z : BACK_Z);
        cx = nearestAisle(cx); pts.push([cx, end]); cz = end;
      }
      const side = region(cz);
      if (to === 1) pts.push([x, side === 2 ? BACK_Z : FRONT_Z]);
      else if (to !== side) {
        const a = nearestAisle(cx);
        pts.push([a, side === 2 ? BACK_Z : FRONT_Z], [a, to === 2 ? BACK_Z : FRONT_Z]);
      }
      for (const [px, pz] of pts) yield* this.walkLine(px, pz, speed);
    }
    yield* this.walkLine(x, z, speed);
  }

  *walkLine(x, z, speed = CALM) {
    const T = this.teacher;
    const goal = new THREE.Vector3(x, 0, z);
    if (goal.distanceTo(T.pos) > 0.15) T.facePoint(goal, 4);
    T.moveTo(x, z, speed);
    while (T.moving) {
      if (goal.distanceTo(T.pos) > 0.25) T.facePoint(goal, 4);
      yield;
    }
  }

  teacherSay(id, vol = 1.35) {
    if (this.teacherVoice && this.t < (this.voiceUntil || 0)) this.teacherVoice.stop(0.1);
    const meta = this.audio.voices[id];
    const h = this.audio.say(id, { pos: this.teacher.headWorld(new THREE.Vector3()), ref: 2.4, vol, reverb: 0.35 });
    this.teacherVoice = h;
    this.voiceUntil = this.t + (h ? h.duration : 1.5);
    if (meta) this.ui.subtitle('', meta.text, 'teacher', (h ? h.duration : 2) + 0.8);
    // anything he says out loud can be repeated back at him
    if (meta && !meta.whisper && !id.startsWith('f_')) this.echoable = { id, text: meta.text, until: this.t + (h ? h.duration : 2) + 3.5 };
    return h;
  }
  *say(id, after = 0.4) {
    const h = this.teacherSay(id);
    yield* this.wait((h ? h.duration : 1.6) + after);
  }

  /** turn around to face the class (no warning: the head goes first) */
  *turnToClass() {
    const T = this.teacher;
    const cp = this.cp;
    if (Math.abs(wrapAngle(T.facing - Math.atan2(cp.x - T.pos.x, cp.z - T.pos.z))) < 0.6) { T.lookAt(cp, 4); return; }
    T.lookAt(cp, 4);
    yield* this.wait(0.35);
    T.facePoint(cp, 3);
    yield* this.wait(0.9);
  }

  nextBoardText() { return this.textBags[this.phase].next(); }

  // ------------------------------------------------------------- the idle lesson
  *idleBrain() {
    const kind = this.idleKind;
    if (kind === 'none' || !this.present) { for (;;) { if (this.idleKind !== kind || (this.present && kind !== 'none')) return; yield; } }
    for (;;) {
      if (this.idleKind !== kind) return;
      if (kind === 'patrol') { yield* this.actPatrol(); continue; }
      const p = this.phase;
      const canWipe = this.mode === 'free' || this.chapter >= 2;
      const act = wpick([[5, 'write'], [2.5, 'ponder'], [2, 'lecture'], [0.8 + p * 0.4, 'stare'], [1.4, 'stroll'], [1.1, 'clap'],
        [this.projAuto || this.world.projector.on ? 0.8 : 0, 'laptop'], [canWipe && this.t > this.nextWipe ? 1.2 : 0, 'wipe']]);
      if (act === 'write') yield* this.actWrite();
      else if (act === 'lecture') yield* this.actLecture();
      else if (act === 'stare') yield* this.actStare(rand(2, 3.5));
      else if (act === 'ponder') yield* this.actPonder();
      else if (act === 'clap') yield* this.actClap(5 + ((Math.random() * 3) | 0));
      else if (act === 'laptop') {
        const i = (Math.random() * 4) | 0;
        yield* this.laptopLookup(['how to be a teacher', 'how long can a class last', 'how often do people blink', 'what is a student'][i],
          ['Stand at the front.', 'Until the bell.', '15 times a minute.', 'A small person who learns.'][i]);
      } else if (act === 'wipe') { this.nextWipe = this.t + rand(60, 90); yield* this.glassesWipe(); }
      else yield* this.actStroll();
    }
  }

  *actWrite(forced, opts = {}) {
    const T = this.teacher, B = this.world.board, W = this.world;
    if (this.boardRow > 3 && opts.row === undefined) yield* this.actErase();
    const text = forced || this.nextBoardText();
    const row = opts.row ?? this.boardRow++;
    const startX = -2.6 + (65 / B.W) * 5.2;
    T.lookAt(null, 4);
    yield* this.walk(startX - 0.3, -6.38);
    T.faceTo(Math.PI, 4);
    yield* this.wait(0.5);
    B.write(text, row, { speed: [6.5, 6, 5.5, 5][this.phase], indent: rand(40, 90), size: opts.size });
    T.setPose('write', this.writePose);
    while (B.busy) {
      B.toWorld(B.hand.x, B.hand.y, W.boardAnchor, this.writePose.point);
      T.lookAt(this.writePose.point, 6);
      const bx = this.writePose.point.x - 0.3;
      if (Math.abs(bx - T.pos.x) > 0.12) T.moveTo(bx, -6.38, 0.7);
      yield;
    }
    T.setPose('rest');
    this.audio.play('chalk_tap', { pos: this.writePose.point.clone(), vol: 0.7 });
    if (!forced && chance(0.2 + this.phase * 0.06)) {
      // a glance back over his shoulder (the chalk stops first)
      yield* this.wait(0.6);
      T.lookAt(this.cp, 3);
      yield* this.wait(rand(1.4, 2.2));
      T.lookAt(null, 3);
      yield* this.wait(0.5);
    }
    if (!forced && chance(0.3)) yield* this.actClap(4 + ((Math.random() * 3) | 0));
  }

  *actErase() {
    const T = this.teacher, B = this.world.board, W = this.world;
    T.lookAt(null, 4);
    yield* this.walk(-1.9, -6.4);
    T.faceTo(Math.PI, 4);
    yield* this.wait(0.4);
    B.erase(3.2);
    T.setPose('erase', this.writePose);
    const snd = this.audio.play('erase', { loop: true, pos: T.headWorld(new THREE.Vector3()), vol: 0.7, ref: 2 });
    try {
      while (B.busy) {
        B.toWorld(B.hand.x, B.hand.y, W.boardAnchor, this.writePose.point);
        T.lookAt(this.writePose.point, 5);
        const bx = this.writePose.point.x - 0.3;
        if (Math.abs(bx - T.pos.x) > 0.15) T.moveTo(bx, -6.4, 1.6);
        if (snd) snd.setPos(this.writePose.point);
        yield;
      }
    } finally { if (snd) snd.stop(0.15); }
    this.boardRow = 0;
    T.setPose('rest');
    yield* this.actClap(6);
  }

  /** claps the chalk dust off his hands: quick, like a person does. Later in the day, one last slow, loud clap. */
  *actClap(n) {
    const T = this.teacher;
    yield* this.turnToClass();
    for (const f of this.friends) if (!f.call && !this.anyTalkWith(f)) f.lookTarget = T.headWorld(new THREE.Vector3());
    yield* this.wait(0.3);
    try {
      T.startClap(n, rand(0.2, 0.26), (mid) => {
        this.audio.play(pick(['clap_1', 'clap_2', 'clap_3']), { pos: mid, vol: 0.9, reverb: 0.45, ref: 2.6, rate: rand(0.96, 1.12) });
        this.world.chalkBurst(mid, 18);
      });
      while (T.clap) yield;
      if (this.phase >= 2) {
        yield* this.wait(0.6);
        T.startClap(1, 0.8, (mid) => {
          this.audio.play('clap_big', { pos: mid, vol: 1.3, reverb: 0.6, ref: 2.6 });
          this.world.chalkBurst(mid, 70);
          this.shake = Math.max(this.shake, 0.3);
        });
        T.clap.delay = 0;
        while (T.clap) yield;
      }
    } finally { for (const f of this.friends) if (!f.call && !this.anyTalkWith(f)) f.lookTarget = null; }
    yield* this.wait(0.4);
  }

  *actStare(dur) {
    const T = this.teacher;
    yield* this.turnToClass();
    if (this.phase >= 2 && chance(0.5)) T.rollTarget = pick([-0.35, 0.35]);
    let t = 0;
    while (t < dur) { t += this.dt; T.facePoint(this.cp, 2); yield; }
    T.rollTarget = 0;
  }

  *actLecture() {
    const T = this.teacher;
    yield* this.turnToClass();
    T.setPose('gesture');
    const id = this.lectureBags[this.phase].next();
    yield* this.say(id, 0.8);
    T.setPose('rest');
    if (id === 't_answer' || id === 't_mito' || id === 't_forgot') yield* this.actStare(rand(1.5, 2.5)); // he doesn't know
  }

  *actPonder() {
    const T = this.teacher, B = this.world.board, W = this.world;
    T.lookAt(null, 3);
    yield* this.walk(rand(-1.6, 1.6), -6.1);
    T.faceTo(Math.PI, 3);
    const row = Math.max(0, Math.min(3, this.boardRow - 1));
    B.toWorld(rand(150, 700), B.rows[row] - 20, W.boardAnchor, v1);
    T.lookAt(v1.clone(), 2.5);
    T.rollTarget = pick([-1, 1]) * rand(0.2, 0.45);
    if (chance(0.5)) { yield* this.wait(1); this.teacherSay('t_hmm', 1.1); }
    yield* this.wait(rand(3.5, 6));
    T.rollTarget = 0;
  }

  *actStroll() {
    const T = this.teacher;
    T.lookAt(null, 3);
    yield* this.walk(rand(-2.4, 2.4), rand(-5.8, -4.8));
    const s = pick(this.students.filter((x) => !x.gone));
    if (s) { T.lookAt(s.headWorld(new THREE.Vector3()), 2.5); yield* this.wait(rand(1.2, 2.2)); }
    T.lookAt(null, 3);
  }

  /** walks the aisles behind the students (pop quiz) */
  *actPatrol() {
    const T = this.teacher;
    const path = pick([[[0.75, -3.0], [0.75, 4.3], [-0.75, 4.3], [-0.75, -3.0]], [[-2.25, -3.0], [-2.25, 4.3], [2.25, 4.3], [2.25, -3.0]]]);
    T.lookAt(null, 3);
    for (const [x, z] of path) {
      yield* this.walk(x, z, 0.75);
      const s = pick(this.students.filter((k) => !k.gone));
      if (s && chance(0.5)) { T.lookAt(s.headWorld(new THREE.Vector3()), 2.5); yield* this.wait(1.2); T.lookAt(null, 3); }
    }
    yield* this.walk(rand(-1, 1), -5.3);
    yield* this.actStare(2);
  }

  *glassesWipe(dur = 6) {
    const T = this.teacher, A = this.audio;
    try {
      T.lookAt(null, 3);
      T.facePoint(FRONT, 2);
      yield* this.wait(0.6);
      T.setPose('wipe', { stage: 'reach' });
      yield* this.wait(0.8);
      T.takeGlasses();
      T.setPose('wipe', { stage: 'hold' });
      this.blind = true;
      this.ui.hint('He took off his glasses. <b>He can\'t see you!</b>', 4);
      A.play('wipe', { pos: T.handPos('R'), vol: 0.8, ref: 2 });
      yield* this.wait(dur / 2);
      A.play('wipe', { pos: T.handPos('R'), vol: 0.8, ref: 2 });
      yield* this.wait(dur / 2);
      T.setPose('wipe', { stage: 'reach', target: T.glassesHome() });
      yield* this.wait(0.7);
    } finally {
      if (T.glassesHeld) T.wearGlasses();
      this.blind = false;
      T.setPose('rest');
    }
    yield* this.wait(0.4);
  }

  // ------------------------------------------------------------- the class clowns (background memes)
  /** you have been doing nothing for a while: somebody else will */
  updateIdle(dt) {
    if (this.choice || this.ui.noteOpen || this.players.some((p) => p.talk || p.phoneUp || p.choice)) { this.idleT = 0; return; }
    if (this.cutscene || this.eventLock || this.ending || this.memeBusy) return; // paused, not reset
    this.idleT += dt;
    if (!this.memesOn || this.idleT < this.memeAt) return;
    if (!this.brainIdle || this.lockBully || this.memeBusy || !this.present || !this.teacher.root.visible || this.anger >= 40 || this.blackout > 0.3) return;
    if (this.startMeme()) { this.idleT = 0; this.memeAt = rand(MEME_IDLE[0], MEME_IDLE[1]); }
  }

  startMeme(forceId) {
    const pool = this.students.filter((s) => !s.gone && !s.hollow);
    if (!pool.length) return false;
    const back = pool.filter((s) => s.seat.row >= 2 && s !== this.lastMemeKid);
    const kid = back.length && chance(0.7) ? pick(back) : pick(pool.filter((s) => s !== this.lastMemeKid).length ? pool.filter((s) => s !== this.lastMemeKid) : pool);
    const m = forceId ? MEMES.find((x) => x.id === forceId) : this.memeBag.next();
    this.lastMemeKid = kid;
    this.stats.memes++; this.track.global.memes++;
    this.track.event(this.t, null, 'meme', { kid: kid.name, meme: m.id });
    this.interrupt(this.reactMeme(kid, m));
    return true;
  }

  kidVoice(kid, base) {
    const gnd = (kid.model.extras && kid.model.extras.gender) || (['Ava', 'Maya', 'Zoe', 'Lily', 'Nora'].includes(kid.name) ? 'female' : 'male');
    return base + (gnd === 'female' ? '_g' : '_b');
  }

  /** the noise itself, from the kid's seat. Returns its length. */
  memeSound(kid, m, vol = 1) {
    const pos = kid.headWorld(new THREE.Vector3());
    const who = kid.seat.row === 0 ? 'someone in your row' : kid.seat.row === 1 ? 'someone behind you' : 'someone in the back';
    if (m.voice) {
      const id = this.kidVoice(kid, m.voice);
      const meta = this.audio.voices[id] || { text: '' };
      const h = this.audio.say(id, { pos, ref: 1.8, reverb: 0.25, vol: 1.3 * vol });
      const d = h ? h.duration : 1;
      kid.talking = d;
      this.ui.subtitle(who, meta.text, 'meme', d + 1.4);
      return d;
    }
    const h = this.audio.play(m.sfx, { pos, ref: 2.2, reverb: 0.3, vol: 1.15 * vol });
    const d = Math.min(h ? h.duration : 1.5, 4);
    this.ui.subtitle(who, m.cap, 'meme', d + 1);
    return d;
  }

  /** the class is terrible at hiding who did it */
  snitch(kid, n) {
    const head = kid.headWorld(new THREE.Vector3());
    const others = [...this.students, ...this.friends].filter((s) => s !== kid && !s.gone && !s.hollow && !s.call);
    this.snitches = others.sort(() => Math.random() - 0.5).slice(0, n);
    for (const s of this.snitches) { s.lookTarget = head; s.speed = 3; }
  }
  unsnitch() {
    for (const s of this.snitches) if (!s.call && !this.anyTalkWith(s)) { s.lookTarget = null; s.speed = 4; }
    this.snitches = [];
  }

  /** stand in the aisle right next to the kid, facing them */
  *goToKid(kid) {
    const T = this.teacher, sx = kid.seat.x;
    const cands = AISLES.filter((a) => Math.abs(Math.abs(a - sx) - 0.75) < 0.01);
    const ax = cands.reduce((b, a) => (Math.abs(a - T.pos.x) < Math.abs(b - T.pos.x) ? a : b), cands[0]);
    T.lookAt(null, 3);
    yield* this.walk(ax, kid.seat.z - 0.05, 1.0);
    T.facePoint(new THREE.Vector3(sx, 0, kid.seat.z), 3);
    T.lookAt(kid.headWorld(new THREE.Vector3()), 3);
    yield* this.wait(0.7);
  }

  /** he bends down over the kid; the kid looks up at him, shaking */
  loom(kid, on) {
    const T = this.teacher;
    T.leanTarget = on ? 0.6 : 0; T.crouchTarget = on ? 0.18 : 0;
    if (on) {
      T.lookAt(kid.headWorld(new THREE.Vector3()), 4);
      kid.forcePitch = null; kid.speed = 6; kid.tremble = 1;
      kid.lookTarget = T.headWorld(new THREE.Vector3());
    } else { kid.tremble = 0; kid.lookTarget = null; kid.speed = 4; }
  }

  kidDesk(kid) {
    const T = this.teacher, sx = kid.seat.x, dz = kid.seat.z - 0.5;
    const side = Math.sign(T.pos.x - sx) || 1;
    const c = new THREE.Vector3(sx + side * 0.2, 0.76, dz + 0.05);
    const face = Math.atan2(-side, 0);
    const left = new THREE.Vector3(Math.cos(face), 0, -Math.sin(face));
    return { L: c.clone().addScaledVector(left, 0.2), R: c.clone().addScaledVector(left, -0.2), c };
  }

  *reactMeme(kid, m) {
    const T = this.teacher, A = this.audio, W = this.world;
    const sam = this.friend('sam'), nora = this.friend('nora');
    const kidHead = () => kid.headWorld(new THREE.Vector3());
    const g = (base) => this.kidVoice(kid, base);
    let snore = null, wentOver = false;
    this.memeBusy = true;
    try {
      if (m.react === 'snore') { kid.forcePitch = 0.9; kid.lookTarget = null; kid.speed = 1.5; yield* this.wait(1.4); }
      const dur = this.memeSound(kid, m);
      // he stops dead in the middle of whatever he was doing
      T.clap = null; T.setPose('rest');
      yield* this.wait(Math.min(dur, 1.1) + 0.3);
      if (m.react !== 'snore') {
        this.timers.after(0.15, () => A.play('giggle', { pos: new THREE.Vector3(kid.seat.x * 0.5, 1.1, kid.seat.z), vol: 0.75, ref: 3, reverb: 0.2 }));
        for (const s of this.students) if (s !== kid && !s.gone && !s.hollow && chance(0.4)) s.talking = 1.2;
      }
      // his head turns first. Then the rest of him.
      T.lookAt(kidHead(), 2.2);
      yield* this.wait(0.9);
      T.facePoint(kid.root.position, 1.5);
      this.snitch(kid, m.react === 'snore' ? 2 : 4);
      yield* this.wait(Math.max(0.5, dur - 1.6));
      const f = [sam, nora].filter((x) => x && !x.gone && !x.call);
      if (f.length && m.react !== 'smell') {
        const ff = pick(f);
        this.timers.after(0.4, () => { if (this.memeBusy && !this.watching) this.friendSay(ff, ff.kind === 'sam' ? pick(['s_meme', 's_meme2', 's_laughing']) : pick(['n_meme', 'n_meme']), 0); });
      }

      if (m.react === 'lookup') {
        // he does not know what it means. He has to look it up.
        T.rollTarget = pick([-0.32, 0.32]);
        yield* this.wait(2.2);
        T.rollTarget = 0;
        yield* this.say('t_moment', 0.2);
        this.unsnitch();
        yield* this.laptopLookup(m.typed, m.result);
        yield* this.turnToClass();
        T.lookAt(kidHead(), 3); T.facePoint(kid.root.position, 2);
        yield* this.wait(1.0);
        yield* this.say(m.answer, 0.7);
        this.giggle();
        yield* this.wait(1.2);
      } else if (m.react === 'smell') {
        T.rollTarget = 0.25;
        yield* this.wait(1.4); // ...sniff
        T.rollTarget = 0;
        yield* this.say('t_smell', 0.5);
        yield* this.say('t_moment', 0.2);
        this.unsnitch();
        yield* this.laptopLookup('what is that smell', `It was ${kid.name}.`);
        // the laptop told him. His head turns. Slowly. Right at them.
        T.lookAt(kidHead(), 1.0); T.facePoint(kid.root.position, 1.2);
        this.snitch(kid, 7);
        yield* this.wait(2.4);
        yield* this.waitVoice(this.sayAt(kid, g('k_notme'), 0, 1.0), 0.8);
        yield* this.say('t_back', 0.4);
        this.giggle();
      } else if (m.react === 'stare') {
        // the longest, emptiest stare
        T.rollTarget = pick([-0.35, 0.35]);
        yield* this.wait(3.6);
        T.rollTarget = 0;
        yield* this.say(m.line || 't_veryfunny', 0.8);
        if (m.again) { this.memeSound(kid, m, 0.7); yield* this.wait(2.5); this.giggle(); }
      } else {
        // 'check' and 'snore': he goes over there
        if (m.react !== 'snore') {
          yield* this.say(m.voice ? 't_whosaid' : 't_whodid', 0.5);
          const others = this.students.filter((s) => s !== kid && !s.gone).sort(() => Math.random() - 0.5).slice(0, 2);
          for (const s of others) { T.lookAt(s.headWorld(new THREE.Vector3()), 3); yield* this.wait(0.9); }
          T.lookAt(kidHead(), 2.5);
          yield* this.wait(1.0);
        } else yield* this.wait(1.0);
        this.unsnitch();
        if (nora && !nora.gone && chance(0.6)) this.timers.after(2, () => { if (this.memeBusy && !this.watching) this.friendSay(nora, 'n_going', 0); });
        wentOver = true;
        yield* this.goToKid(kid);
        if (m.react === 'snore') {
          // still asleep... still snoring
          snore = A.play('m_snore', { pos: kidHead(), ref: 1.5, vol: 0.8, offset: 3.1 });
          T.leanTarget = 0.5; T.lookAt(kidHead(), 3);
          yield* this.wait(2.2);
          if (snore) { snore.stop(0.1); snore = null; }
          const d = this.kidDesk(kid);
          T.setPose('desk', { L: d.L, R: d.R });
          yield* this.wait(0.45);
          A.play('desk_slap', { pos: d.c, vol: 1.4, ref: 2.5, reverb: 0.3 });
          this.shake = Math.max(this.shake, 0.2);
          this.loom(kid, true);
          kid.talking = 0;
          yield* this.wait(0.3);
          T.setPose('rest');
          yield* this.waitVoice(this.sayAt(kid, g('k_awake'), 0, 1.0), 0.3);
          yield* this.say('t_wakeup', 0.6);
          this.giggle();
        } else {
          this.loom(kid, true);
          yield* this.wait(1.2);
          yield* this.say(m.line || 't_wasityou', 0.4);
          yield* this.waitVoice(this.sayAt(kid, g(pick(['k_notme', 'k_sorry'])), 0, 0.9), 0.6);
        }
        yield* this.wait(1.4); // he keeps staring at them
        if (this.phase >= 3) {
          // in detention, he takes them
          for (const b of W.lights.banks) if (!b.dead) b.flicker = 0.9;
          A.play('stinger_1', { vol: 0.6, pos: kidHead(), ref: 3 });
          T.eyeGlow = 0.8;
          yield* this.wait(0.8);
          kid.setHollow(true); kid.taken = true;
          T.eyeGlow = 0.12;
          yield* this.wait(1.2);
          if (nora && !nora.gone) this.timers.after(6, () => { if (!this.cutscene) this.friendSay(nora, 'n_eyes', 0); });
        } else yield* this.say(m.react === 'snore' ? 't_back' : pick(['t_back', 't_veryfunny']), 0.4);
        this.loom(kid, false);
        if (sam && !sam.gone && chance(0.5)) this.timers.after(3, () => { if (!this.watching && !this.cutscene) this.friendSay(sam, pick(['s_dead', 's_close']), 0); });
        T.lookAt(null, 3);
        yield* this.walk(rand(-1.2, 1.2), -5.4);
      }
    } finally {
      if (snore) snore.stop(0.1);
      this.unsnitch();
      this.loom(kid, false);
      T.rollTarget = 0;
      if (!kid.hollow) {
        kid.forcePitch = 0.45; // embarrassed, head down
        this.timers.after(9, () => { if (kid.forcePitch === 0.45) kid.forcePitch = null; });
      }
      this.memeBusy = false;
    }
    if (!wentOver) yield* this.wait(0.6);
  }

  // ------------------------------------------------------------- reactions
  *reactWarn(loud) {
    const T = this.teacher;
    T.lookAt(this.cp, 6);
    if (loud) this.audio.play('sub_hit', { vol: 0.8 });
    yield* this.wait(0.4);
    T.facePoint(this.cp, 3);
    yield* this.wait(0.6);
    yield* this.say(pick(WARN));
    yield* this.actStare(rand(1.5, 2.2));
  }

  *reactPhone() {
    const T = this.teacher;
    T.lookAt(this.camPos, 8);
    T.facePoint(this.camPos, 3);
    yield* this.wait(0.8);
    T.setPose('point', { at: this.camPos });
    yield* this.say('t_phone');
    T.setPose('rest');
    yield* this.actStare(1.6);
  }

  scareFriends(on) {
    for (const f of this.friends) {
      if (f.gone) continue;
      f.forcePitch = on ? 0.55 : null;
      f.tremble = on ? 1 : 0;
      if (on) { f.lookTarget = null; f.call = null; }
    }
    if (on) { this.ui.call('left', false); this.ui.call('right', false); }
  }

  *reactApproach() {
    const T = this.teacher, p = this.focus;
    T.lookAt(p.camPos, 8);
    T.facePoint(p.camPos, 3);
    if (p.talk && p.talk.friend) {
      const f = p.talk.friend;
      this.friendSay(f, f.kind === 'sam' ? 's_warn' : 'n_warn', 0.3);
    }
    this.scareFriends(true);
    try {
      yield* this.walk(clamp(p.camPos.x * 0.5, -1, 1), -3.9, 1.6);
      T.facePoint(p.camPos, 3);
      yield* this.say(pick(['t_eyes', 't_see', 't_still', 't_attention']));
      yield* this.actStare(2.2);
    } finally { this.scareFriends(false); }
    yield* this.walk(rand(-1.5, 1.5), -5.5);
  }

  deskCorners(p = this.me) { return this.deskSpot(p).corners; }
  /** where he stands to fold over a player's desk, and where his hands go */
  deskSpot(p = this.me) {
    const d = p.desk, y = d.top + 0.02;
    if (d.row === 0) {
      return { approach: new THREE.Vector3(d.x * 0.85, 0, -3.7), stand: new THREE.Vector3(d.x, 0, -3.02), face: 0,
        corners: { L: new THREE.Vector3(d.x + 0.26, y, d.z - 0.16), R: new THREE.Vector3(d.x - 0.26, y, d.z - 0.16) } };
    }
    // a desk further back: come down the aisle and lean over it from the side
    const ax = d.x >= 0 ? d.x + 0.75 : d.x - 0.75, side = Math.sign(ax - d.x);
    const face = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    const left = new THREE.Vector3(Math.cos(face), 0, -Math.sin(face));
    const c = new THREE.Vector3(d.x + side * 0.2, y, d.z);
    return { approach: new THREE.Vector3(ax, 0, -3.0), stand: new THREE.Vector3(ax, 0, d.z), face,
      corners: { L: c.clone().addScaledVector(left, 0.18), R: c.clone().addScaledVector(left, -0.18) } };
  }

  /** start a busted scene right now (nothing else can jump in before it begins) */
  bust(reason, p = this.focus) {
    this.focus = p;
    this.closeArm = null;
    this.cutscene = true;
    this.interrupt(this.bustedSeq(reason, p));
  }

  /** you got caught: he comes to your desk. Three strikes and it's over. */
  *bustedSeq(reason, p = this.focus) {
    const T = this.teacher, W = this.world, A = this.audio;
    this.cutscene = true;
    this.strikes++;
    this.note(p, 'caught'); this.closeArm = null;
    const cf = this.track.of(p).caughtFor; cf[reason] = (cf[reason] || 0) + 1;
    this.track.event(this.t, p, 'caught', { reason });
    this.cancelVideos(p);
    if (this.teacherVoice) { this.teacherVoice.stop(0.05); this.voiceUntil = 0; }
    if (this.choice) this.pickChoice(-1);
    this.scareFriends(true);
    let br = null;
    try {
      if (this.strikes >= this.maxStrikes) { yield* this.jumpscare('caught'); return; }
      A.play('sub_hit', { vol: 0.9 });
      for (const b of W.lights.banks) b.flicker = 0.8;
      T.lookAt(p.camPos, 10); T.facePoint(p.camPos, 4);
      yield* this.wait(0.5);
      const spot = this.deskSpot(p);
      yield* this.walk(spot.approach.x, spot.approach.z, ANGRY);
      T.faceTo(spot.face, 5);
      yield* this.walk(spot.stand.x, spot.stand.z, 1.1);
      T.faceTo(spot.face, 5);
      // folds over your desk like a spider, face level with yours
      T.crouchTarget = 0.4; T.stanceTarget = 0.3; T.leanTarget = 1.1;
      T.setPose('desk', spot.corners);
      T.lookAt(p.camPos, 6);
      T.faceGlow = 0.22; T.eyeGlow = 0.9;
      br = A.play('breath', { loop: true, pos: T.headWorld(new THREE.Vector3()), vol: 1.0, ref: 0.6, reverb: 0.05 });
      A.fadeBus('amb', 0.25, 1);
      yield* this.wait(1.5);
      A.play('stinger_2', { vol: 0.8 });
      this.scareFear = 1; this.shake = 0.3;
      if (reason === 'note') { A.play('paper', { pos: T.handPos('R'), vol: 1.1 }); yield* this.wait(0.6); }
      if (reason === 'video') {
        // he takes the phone... and his face is on it
        yield* this.say('t_givephone', 0.2);
        this.videoScare(p);
        yield* this.wait(1.6);
      }
      yield* this.say(reason === 'echo' ? 't_iknow' : reason === 'questions' ? 't_toomany' : reason === 'note' ? 't_readnote' : reason === 'video' ? 't_nophones' : pick(['t_hear', 't_see', 't_who']), 0.5);
      yield* this.say(this.strikes === this.maxStrikes - 1 ? 't_last' : 't_detention', 0.6);
      if (this.mp) this.mp.strikeToast(p, this.strikes, this.maxStrikes);
      else this.ui.toast(`STRIKE ${this.strikes} / ${this.maxStrikes}`, 2.8);
      yield* this.wait(1.0);
    } finally {
      if (br) br.stop(0.4);
      A.fadeBus('amb', 1, 1);
      T.leanTarget = 0; T.crouchTarget = 0; T.stanceTarget = 0; T.setPose('rest');
      T.faceGlow = 0.08; T.eyeGlow = 0.12;
      this.scareFriends(false);
      if (!this.ending) this.cutscene = false;
      this.anger = 20; this.flags = { r40: false, r70: false };
      p.echoStreak = 0; p.qCount = Math.min(p.qCount, 1);
    }
    T.faceTo(Math.PI, 2);
    yield* this.walk(rand(-1, 1), -5.4);
  }

  *jumpscare(kind) {
    const T = this.teacher, W = this.world, A = this.audio;
    this.cutscene = true;
    this.ending = true;
    this.input.enable(false);
    if (this.choice) this.pickChoice(-1);
    if (this.teacherVoice) { this.teacherVoice.stop(0.05); this.voiceUntil = 0; }
    for (const p of this.players) if (p.whisperSnd) { p.whisperSnd.stop(0.05); p.whisperSnd = null; }
    A.fadeBus('amb', 0, 0.05);
    A.play('lights_off', { vol: 1.1 });
    W.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
    this.scareFear = 0.8;
    yield* this.wait(rand(1.6, 2.4));
    // he is right in front of whatever you are looking at
    const dir = new THREE.Vector3(this.camFwd.x, 0, this.camFwd.z).normalize();
    const start = 1.3, end = 0.5;
    const yawTo = Math.atan2(-dir.x, -dir.z);
    T.root.visible = true;
    T.root.position.y = 0;
    T.place(this.camPos.x + dir.x * start, this.camPos.z + dir.z * start, yawTo);
    T.setPose('grab');
    T.lookAt(this.camPos, 80);
    T.update(0.016, {});
    const hy = T.headWorld(new THREE.Vector3()).y;
    T.root.position.y = this.camPos.y - hy + 0.04;
    T.jawTarget = 0.8; T.jitter = 0.55; T.eyeGlow = 3; T.faceGlow = 0.85;
    W.setMaster(0.15);
    this.redFlash = 1; this.underLight = 1;
    this.blackoutTarget = 0; this.blackout = 0;
    if (this.mp) this.mp.jumpscare(kind); // every friend gets one in their own face
    A.play('scream', { vol: 1.5, reverb: 0.15 });
    A.play('sub_hit', { vol: 1.3, reverb: 0 });
    A.play('glitch', { vol: 0.9, reverb: 0 });
    this.shake = 0.9; this.glitch = 0.85; this.scareFear = 1;
    let t = 0;
    while (t < 0.16) {
      t += this.dt;
      const d = lerp(start, end, Math.min(1, t / 0.16));
      T.pos.x = this.camPos.x + dir.x * d; T.pos.z = this.camPos.z + dir.z * d;
      yield;
    }
    yield* this.wait(1.15);
    this.blackout = this.blackoutTarget = 1;
    this.underLight = 0;
    A.stopAll();
    T.jitter = 0; T.jawTarget = 0;
    yield* this.wait(1.0);
    this.finish(kind);
  }

  // ------------------------------------------------------------- scares
  scareList() {
    const p = this.phase, T = this.teacher;
    const backTurned = Math.abs(wrapAngle(T.facing - Math.PI)) < 0.6;
    const all = [
      { id: 'lightning', min: 0, w: 2, fx: () => this.fxLightning(p >= 2) },
      { id: 'flicker', min: 0, w: 2, fx: () => this.fxFlicker() },
      { id: 'book', min: 1, w: 1.5, once: true, fx: () => this.fxBookDrop() },
      { id: 'door', min: 1, w: 1.5, cool: 90, fx: () => this.fxDoorFace() },
      { id: 'headturn', min: 1, w: backTurned ? 2.5 : 0, brain: () => this.headTurn() },
      { id: 'students', min: 2, w: 2, cool: 60, fx: () => this.fxStudentsStare() },
      { id: 'boardmsg', min: 2, w: 2, cool: 50, fx: () => this.fxBoardMessage() },
      { id: 'whisper', min: 2, w: 1.5, cool: 40, fx: () => this.fxWhisperEar() },
      { id: 'behind', min: 3, w: 3, cool: 100, brain: () => this.scareBehind() },
      { id: 'neck', min: 3, w: 1.5, cool: 70, brain: () => this.scareNeck() },
      { id: 'flickapproach', min: 3, w: 1.5, cool: 70, brain: () => this.scareFlickerApproach() },
    ];
    return all.filter((s) => s.w > 0 && p >= s.min && (!this.scarePool || this.scarePool.includes(s.id)) && !(s.once && this.scareDone[s.id]) && !(s.cool && this.t - (this.lastScare[s.id] ?? -1e9) < s.cool));
  }

  updateDirector(dt) {
    this.nextScare -= dt;
    if (this.nextScare > 0 || this.eventLock || this.anger >= 30 || this.choice || !this.present || this.memeBusy) return;
    const list = this.scareList().filter((s) => s.fx || this.brainIdle);
    if (!list.length) { this.nextScare = 4; return; }
    const g = SCARE_GAP[this.phase];
    this.nextScare = rand(g[0], g[1]);
    const s = wpick(list.map((x) => [x.w, x]));
    this.scareDone[s.id] = true;
    this.lastScare[s.id] = this.t;
    if (s.fx) this.fx.push(s.fx());
    else this.interrupt(s.brain());
  }

  *headTurn() {
    const T = this.teacher;
    if (Math.abs(wrapAngle(T.facing - Math.PI)) > 0.6) { T.faceTo(Math.PI, 3); yield* this.wait(1); }
    T.lookAt(null, 3);
    yield* this.wait(0.6);
    this.audio.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 1.1, ref: 2.2 });
    T.owl = true; // the one time his head turns all the way round
    T.lookAt(this.cp, 1.4);
    yield* this.wait(2.3);
    T.rollTarget = 0.3;
    yield* this.wait(rand(2, 3));
    T.rollTarget = 0;
    T.lookAt(null, 2.2);
    yield* this.wait(1.2);
    T.owl = false;
  }

  *fxLightning(sil) {
    const W = this.world;
    W.showSilhouette = sil;
    W.flash(1);
    yield* this.wait(0.12);
    W.flash(0.6);
    yield* this.wait(0.25);
    W.flash(0.9);
    yield* this.wait(0.3);
    W.showSilhouette = false;
    yield* this.wait(rand(0.4, 1.4));
    this.audio.play('thunder', { pos: new THREE.Vector3(-9, 3, -1), ref: 6, vol: 1.2, reverb: 0.25 });
  }

  *fxFlicker() {
    const W = this.world;
    const b = pick(W.lights.banks.filter((x) => !x.dead));
    if (!b) return;
    b.flicker = rand(1.2, 2.4);
    this.audio.play('zap', { pos: b.light.position, vol: 0.8 });
    yield* this.wait(0.6);
    this.audio.play('zap', { pos: b.light.position, vol: 0.6, rate: 0.9 });
  }

  *fxBookDrop() {
    const bk = this.world.fallingBook;
    const p0 = bk.position.clone();
    let t = 0;
    while (t < 0.42) {
      t += this.dt;
      const k = Math.min(1, t / 0.42);
      bk.position.set(p0.x + 0.25 * k, p0.y - (p0.y - 0.03) * k * k, p0.z + 0.15 * k);
      bk.rotation.set(0, 0.5 * k, -1.4 * k);
      yield;
    }
    bk.rotation.set(0, 0.6, 0); bk.position.y = 0.03;
    this.audio.play('book_drop', { pos: bk.position.clone(), vol: 1.3, ref: 2.5 });
    this.scareFear = Math.max(this.scareFear, 0.5);
  }

  *fxDoorFace() {
    this.doorFace.visible = true;
    const wp = this.doorFace.getWorldPosition(new THREE.Vector3());
    let t = 0, seen = false;
    try {
      while (t < 14) {
        t += this.dt;
        if (this.lookingAt(wp, 0.93)) { seen = true; break; }
        yield;
      }
      if (seen) {
        this.audio.play('stinger_1', { vol: 0.55, pos: wp, ref: 3 });
        this.scareFear = Math.max(this.scareFear, 0.7);
        yield* this.wait(rand(0.8, 1.4));
      }
    } finally { this.doorFace.visible = false; }
  }

  *fxStudentsStare() {
    yield* this.until(() => !this.lookingBack(), 30);
    const hollow = this.phase >= 3;
    for (const s of this.students) { s.lookTarget = this.camPos; s.speed = 40; if (hollow) s.setHollow(true); }
    let t = 0, seen = false;
    try {
      while (t < 25) {
        t += this.dt;
        if (this.lookingBack()) {
          if (!seen) { seen = true; this.audio.play('stinger_2', { vol: 0.8 }); this.scareFear = Math.max(this.scareFear, 0.8); }
        } else if (seen) break;
        yield;
      }
      yield* this.until(() => !this.lookingBack(), 30);
    } finally {
      for (const s of this.students) { s.lookTarget = null; s.speed = 4; if (hollow) s.setHollow(!!s.taken); }
    }
  }

  *fxBoardMessage() {
    const B = this.world.board;
    yield* this.until(() => !this.lookingAtBoard && !B.busy && !this.cutscene, 25);
    if (B.busy || this.cutscene) return;
    B.scrawl(pick(['I SEE YOU', 'STOP TALKING', 'EYES ON ME', "YOU'RE NEXT", 'STAY', 'I HEAR YOU']));
    this.boardRow = 4;
    yield* this.until(() => this.lookingAtBoard, 30);
    this.audio.play('sub_hit', { vol: 0.7 });
    this.scareFear = Math.max(this.scareFear, 0.6);
  }

  *fxWhisperEar() {
    const side = pick([-1, 1]);
    v1.set(side * 0.3, 0.05, 0.12).applyQuaternion(this.camera.quaternion).add(this.camPos);
    this.audio.say('tw_shh', { pos: v1.clone(), ear: [side * 0.3, 0.05, 0.12], ref: 0.3, vol: 1.4, reverb: 0.02 });
    this.scareFear = Math.max(this.scareFear, 0.6);
    yield* this.wait(2);
  }

  teacherSayAt(id, pos, vol, ref, ear) {
    const meta = this.audio.voices[id];
    const h = this.audio.say(id, { pos, ref, vol, reverb: 0.05, ear });
    if (meta) this.ui.subtitle('', `<i>${meta.text}</i>`, 'teacher', (h ? h.duration : 2) + 0.6);
    return h;
  }

  *scareBehind() {
    const T = this.teacher, W = this.world, A = this.audio, B = W.board;
    this.eventLock = true;
    try {
      for (const b of W.lights.banks) b.flicker = 0.7;
      yield* this.wait(0.7);
      A.play('lights_off', { vol: 1 });
      W.setMaster(0); this.blackoutTarget = 0.95;
      yield* this.wait(0.8);
      B.scrawl("DON'T TURN AROUND");
      this.boardRow = 4;
      T.place(rand(-1, 1), 4.6, Math.PI);
      T.lookAt(this.camPos, 60);
      T.eyeGlow = 0.7;
      W.setMaster(0.55); this.blackoutTarget = 0;
      yield* this.wait(1.3);
      this.teacherSayAt('tw_turn', T.headWorld(new THREE.Vector3()), 1.4, 1.6);
      let t = 0, seen = false;
      while (t < 9) { t += this.dt; if (this.lookingAtTeacher) { seen = true; break; } yield; }
      if (seen) {
        A.play('stinger_1', { vol: 1.1 });
        this.scareFear = 1; this.shake = 0.4; T.jawTarget = 0.3;
        yield* this.wait(1.4);
      } else {
        v1.set(0, 0.04, 0.35).applyQuaternion(this.camera.quaternion).add(this.camPos);
        this.teacherSayAt('tw_behind', v1.clone(), 1.5, 0.35, [0, 0.04, 0.35]);
        yield* this.wait(2.3);
        W.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
        yield* this.wait(0.25);
        T.place(this.camPos.x, -2.75, 0); T.lookAt(this.camPos, 60);
        W.setMaster(0.6); this.blackoutTarget = 0; this.blackout = 0;
        A.play('stinger_2', { vol: 1.1 });
        this.scareFear = 1; this.shake = 0.5;
        yield* this.wait(1.6);
      }
      T.jawTarget = 0;
      W.setMaster(0); this.blackoutTarget = 0.95;
      A.play('zap', { vol: 0.7 });
      yield* this.wait(0.45);
      B.clear(); this.boardRow = 0;
      T.place(0, -5.5, 0);
    } finally {
      W.setMaster(1); this.blackoutTarget = 0;
      T.eyeGlow = 0.12; T.jawTarget = 0;
      this.eventLock = false;
    }
    yield* this.actStare(1.5);
  }

  *scareFlickerApproach() {
    const T = this.teacher, W = this.world;
    this.eventLock = true;
    try {
      const cp = this.cp;
      T.facePoint(cp, 10); T.lookAt(cp, 30);
      const start = T.pos.clone();
      const end = new THREE.Vector3(clamp(cp.x * 0.4, -1, 1), 0, -3.1);
      const steps = 4;
      for (let i = 1; i <= steps; i++) {
        W.setMaster(0); this.audio.play('zap', { vol: 0.7 });
        yield* this.wait(rand(0.15, 0.25));
        const p = new THREE.Vector3().lerpVectors(start, end, i / steps);
        T.place(p.x, p.z, Math.atan2(cp.x - p.x, cp.z - p.z));
        T.lookAt(cp, 60);
        W.setMaster(rand(0.5, 1));
        yield* this.wait(rand(0.35, 0.6));
      }
      W.setMaster(1);
      this.audio.play('sub_hit', { vol: 1 });
      this.scareFear = 0.9;
      yield* this.say('t_see');
      yield* this.actStare(1.5);
    } finally { W.setMaster(1); this.eventLock = false; }
    yield* this.walk(rand(-1.2, 1.2), -5.5);
  }

  *scareNeck() {
    const T = this.teacher;
    yield* this.turnToClass();
    yield* this.wait(0.6);
    try {
      T.stretchTarget = 0.6; T.rollTarget = 0.45;
      this.audio.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 1.1, rate: 0.7, ref: 2.2 });
      yield* this.wait(4.2);
      this.audio.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 1.2, rate: 1.25, ref: 2.2 });
    } finally { T.stretchTarget = 0; T.rollTarget = 0; }
    yield* this.wait(1.2);
  }

  *phoneScare() {
    const T = this.teacher, W = this.world, ph = this.phone;
    this.eventLock = true;
    try {
      ph.mode = 'face';
      this.audio.play('glitch', { vol: 0.9 });
      this.glitch = 0.5;
      W.setMaster(0.12);
      T.place(this.camPos.x, -2.9, 0);
      T.lookAt(this.camPos, 60);
      T.leanTarget = 0.45; T.eyeGlow = 1.2; T.faceGlow = 0.2;
      yield* this.until(() => !ph.up, 6);
      W.setMaster(1);
      this.audio.play('stinger_1', { vol: 1.1 });
      this.shake = 0.5; this.scareFear = 1;
      yield* this.wait(1.8);
      W.setMaster(0); this.blackoutTarget = 0.95;
      yield* this.wait(0.35);
      T.place(rand(-1, 1), -5.5, 0);
    } finally {
      ph.home(); W.setMaster(1); this.blackoutTarget = 0;
      T.leanTarget = 0; T.eyeGlow = 0.12; T.faceGlow = 0.08; this.eventLock = false;
    }
  }

  /** blackout, and when the lights come back he is somewhere else */
  *blinkTo(x, z, facing, dark = 1.2) {
    const W = this.world, T = this.teacher;
    this.audio.play('lights_off', { vol: 1 });
    W.setMaster(0); this.blackoutTarget = 0.96;
    yield* this.wait(dark);
    T.place(x, z, facing);
    W.setMaster(1); this.blackoutTarget = 0;
  }

  // ------------------------------------------------------------- shared story beats
  *periodBell(line) {
    const A = this.audio;
    this.cutscene = true;
    this.clock.fixed = this.clock.to;
    if (this.choice) this.pickChoice(-1);
    A.play('bell', { pos: new THREE.Vector3(3.5, 2.8, -6.8), vol: 1.1, ref: 3, reverb: 0.4 });
    this.completeObjective('bell');
    yield* this.wait(2.6);
    yield* this.turnToClass();
    yield* this.wait(0.6);
    yield* this.say(line, 0.8);
    this.blackoutTarget = 1;
    A.fadeBus('amb', 0, 1.5);
    yield* this.wait(1.8);
  }

  hintControls() {
    const touch = this.input.touch;
    const h = (t, s, d = 6) => this.timers.after(t, () => this.state === 'playing' && !this.cutscene && this.ui.hint(s, d));
    h(1.0, touch ? 'Drag anywhere to look around.' : 'Move the mouse to look around. <kbd>Esc</kbd> pauses.');
    return h;
  }

  // ------------------------------------------------------------- story pacing helpers
  /** he is free to start a new story beat */
  ready() { return this.brainIdle && !this.cutscene && !this.memeBusy && !this.choice && !this.eventLock; }
  /** run a story beat once he is free */
  *beat(make, tries = 1) { yield* this.until(() => this.ready(), 40); return yield* this.cmd(make, tries); }
  /** let the lesson simply play for a while (time spent in cutscenes does not count) */
  *lesson(sec) { let t = 0; while (t < sec) { if (!this.cutscene && !this.eventLock) t += this.dt; yield; } }
  /** a scripted whisper from a friend, said while he is not looking */
  *whisper(f, id, after = 0.6) {
    if (!f || f.gone) return;
    yield* this.until(() => (!this.watching || this.blind || this.typing) && !this.cutscene && !this.talk && !this.choice && !this.ui.noteOpen && !f.call && this.t >= (f.speakUntil || 0), 14);
    if (f.call) {
      f.call = null; this.ui.call('left', false); this.ui.call('right', false);
      this.timers.after(3, () => { if (!f.call && !this.anyTalkWith(f)) f.lookTarget = null; });
    }
    yield* this.waitVoice(this.friendSay(f, id, 0), after);
  }
  /** add one task to the list (keeps the list short: the newest finished task + what is left) */
  addObjective(o) {
    const done = this.objectives.filter((x) => x.done && x.id !== 'bell');
    const keep = done.slice(-1);
    const list = this.objectives.filter((x) => !x.done || keep.includes(x) || x.id === 'bell');
    const item = { ...o, done: false };
    const bi = list.findIndex((x) => x.id === 'bell');
    if (bi >= 0) list.splice(bi, 0, item); else list.push(item);
    this.objectives = list;
    this.ui.setObjectives(list);
  }
  *storyNote(i) {
    yield* this.until(() => this.ready() && !this.ui.noteOpen && !this.talk, 25);
    const [who, text] = STORY_NOTES[i];
    if (!this.giveNote(text, who)) return;
    yield* this.until(() => !this.ui.noteOpen, 30);
    yield* this.wait(1.2);
  }

  // ------------------------------------------------------------- more story beats
  /** Kevin's empty chair slides back, as if somebody nobody can see just sat down */
  *kevinChair() {
    const W = this.world, ch = W.dynamicChairs.kevin, sam = this.friend('sam');
    if (!ch) return;
    yield* this.until(() => !this.cutscene && !this.eventLock, 20);
    this.audio.play('chair_scrape', { pos: W.kevinSeat, vol: 0.75, ref: 2, rate: 0.72 });
    ch.nudge(0.3, 0.32);
    for (const k of this.allKids()) if (!k.gone && !k.call && !this.anyTalkWith(k) && chance(0.6)) { k.lookTarget = W.kevinSeat; k.speed = 3; }
    yield* this.wait(1.8);
    yield* this.whisper(sam, 's_chair', 0.4);
    yield* this.wait(1.6);
    for (const k of this.allKids()) if (!k.call && !this.anyTalkWith(k)) { k.lookTarget = null; k.speed = 4; }
  }

  /** a line from the school's old ceiling speaker */
  paSay(id) {
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: this.world.speaker, ref: 3, vol: 1.25, reverb: 0.45 });
    this.ui.subtitle('📢 SCHOOL SPEAKER', meta.text, 'pa', (h ? h.duration : 5) + 0.6);
    return h;
  }
  lookAllAt(p) { for (const k of this.allKids()) if (!k.gone && !k.call && !this.anyTalkWith(k) && chance(0.75)) { k.lookTarget = p; k.speed = 2.5; } }
  lookAllBack() { for (const k of this.allKids()) if (!k.call && !this.anyTalkWith(k)) { k.lookTarget = null; k.speed = 4; } }

  /** the office calls for Mr. Hale over the speaker. He tears it out of the wall. */
  *paHale() {
    const T = this.teacher, A = this.audio, W = this.world, sp = W.speaker, nora = this.friend('nora');
    A.play('pa_chime', { pos: sp, vol: 1.0, ref: 3, reverb: 0.4 });
    T.lookAt(sp, 1.4);
    yield* this.wait(2.2);
    const h = this.paSay('pa_hale');
    this.lookAllAt(sp);
    yield* this.wait(2.6);
    if (nora && !nora.gone) this.friendSay(nora, 'n_pa', 0);
    yield* this.wait(Math.max(0.5, (h ? h.duration : 6.5) - 2.2));
    yield* this.walk(3.55, -6.15, 1.2);
    T.facePoint(sp, 4); T.lookAt(sp, 4);
    yield* this.wait(0.5);
    T.setPose('point', { at: sp });
    yield* this.wait(0.8);
    A.play('pa_rip', { pos: sp, vol: 1.2, ref: 2.5 });
    W.chalkBurst(sp.clone(), 25, 0.8);
    for (const b of W.lights.banks) if (!b.dead) b.flicker = 0.4;
    this.shake = Math.max(this.shake, 0.15);
    yield* this.wait(0.5);
    T.setPose('rest');
    yield* this.wait(0.8);
    this.lookAllBack();
    yield* this.turnToClass();
    yield* this.say('t_nohale', 0.8);
    yield* this.actStare(2);
    yield* this.actWrite('THERE IS NO MR. HALE');
  }

  /** Sam's note has to get to Nora without him seeing it */
  *noteMission() {
    const sam = this.friend('sam'), nora = this.friend('nora'), touch = this.input.touch;
    if (!sam || !nora || sam.gone || nora.gone) return;
    yield* this.until(() => this.ready() && !this.ui.noteOpen && !this.talk, 25);
    yield* this.whisper(sam, 's_note', 0.3);
    this.audio.play('paper', { pos: sam.headWorld(new THREE.Vector3()), vol: 0.8 });
    this.ui.showNote('<small>Sam\'s note (for Nora):</small><br><b>HE IS NOT A REAL TEACHER.</b><br><i>pass it on &rarr;</i>');
    this.addObjective({ id: 'pass', text: touch ? 'Pass the note to Nora: look at her and hold TALK while he isn\'t looking' : 'Pass the note to Nora: look at her and hold [E] while he isn\'t looking' });
    const job = (this.noteJob = { hold: 0, done: false, caught: false });
    yield* this.until(() => job.done || job.caught || this.noteJob !== job, 60);
    if (this.noteJob === job) this.noteJob = null;
    if (job.done) {
      this.completeObjective('pass');
      this.mischief += 40;
      this.audio.play('paper', { pos: nora.headWorld(new THREE.Vector3()), vol: 0.8 });
      yield* this.whisper(nora, 'n_gotnote', 0.5);
    } else if (job.caught) {
      yield* this.until(() => !this.cutscene && !this.memeBusy && this.brainIdle, 40);
      yield* this.whisper(sam, 's_noted', 0.5);
    }
  }
  /** called every frame while the note mission runs (for the local player) */
  updateNoteJob(p, dt) {
    const job = this.noteJob;
    if (!job || job.done || job.caught || !p.local) return;
    if (p.talk && p.talk.friend && p.talk.friend.kind === 'nora') {
      if (p.watching && !this.cutscene && !this.eventLock) { job.caught = true; this.bust('note', p); }
      else if ((job.hold += dt) > 1.3) job.done = true;
    } else job.hold = Math.max(0, job.hold - dt * 0.5);
  }

  /** the power goes out. Every flash of lightning shows him a little closer. Don't make a sound. */
  *powerCut() {
    const T = this.teacher, W = this.world, A = this.audio, sam = this.friend('sam'), nora = this.friend('nora'), me = this.me;
    const hadEmergency = this.emergency;
    let noisy = false;
    this.eventLock = true;
    try {
      A.play('lights_off', { vol: 1.1 });
      W.setMaster(0); this.emergency = 0;
      this.blackoutTarget = 0.72;
      A.fadeBus('amb', 0.4, 1);
      yield* this.wait(1.2);
      if (sam && !sam.gone) this.friendSay(sam, 's_dark', 0);
      this.addObjective({ id: 'dark', text: 'Power cut: don\'t make a sound until the lights come back' });
      yield* this.wait(1.8);
      if (nora && !nora.gone) this.friendSay(nora, 'n_dark', 0);
      T.root.visible = false;
      const spots = [[-2.2, -5.8], [-1.1, -4.6], [0.9, -3.6], [me.camPos.x * 0.9 + 0.2, -2.85]];
      for (let i = 0; i < spots.length; i++) {
        let t = 0;
        const d = rand(2.3, 3.4);
        while (t < d) { t += this.dt; if ((me.selfNoise || 0) >= 0.6) noisy = true; yield; }
        const [x, z] = spots[i];
        T.place(x, z, Math.atan2(me.camPos.x - x, me.camPos.z - z));
        T.setPose('rest'); T.lookAt(me.camPos, 60);
        T.root.visible = true;
        this.blackoutTarget = 0; this.blackout = 0.1;
        W.flash(i === spots.length - 1 ? 1 : 0.8);
        A.play('thunder', { pos: new THREE.Vector3(-9, 3, -1), ref: 6, vol: 0.9 + i * 0.1, reverb: 0.25, delay: 0.25 });
        if (i === spots.length - 1) { A.play('stinger_1', { vol: 0.9 }); this.scareFear = 1; this.shake = 0.3; }
        yield* this.wait(0.45);
        T.root.visible = false;
        this.blackoutTarget = 0.72;
      }
      yield* this.wait(1.6);
    } finally {
      T.root.visible = true;
      W.setMaster(1);
      this.blackoutTarget = 0;
      this.emergency = hadEmergency;
      A.fadeBus('amb', 1, 1);
      this.eventLock = false;
    }
    // the lights come back. He is at the board, as if nothing happened.
    A.play('power_up', { vol: 0.9 });
    T.place(-1.2, -6.38, Math.PI);
    T.lookAt(null, 3);
    yield* this.wait(1.4);
    if (noisy) { yield* this.bustedSeq('noise', me); return; }
    this.completeObjective('dark');
    yield* this.actWrite('DON\'T BE AFRAID OF THE DARK');
    yield* this.turnToClass();
    yield* this.say('t_dark', 0.6);
  }

  /** the wall clock (and yours) runs backwards for a while */
  *clockBackwards() {
    const orig = { ...this.clock }, nora = this.friend('nora');
    this.setClockRun(this.clockMin, this.clockMin - 18, 13);
    yield* this.wait(3.5);
    if (nora && !nora.gone) yield* this.whisper(nora, 'n_clock', 0.3);
    yield* this.wait(8);
    const left = Math.max(30, orig.dur - (this.t - orig.t0));
    this.setClockRun(this.clockMin, orig.to, left);
  }

  /** the speaker he tore out comes back to life */
  *paClosed() {
    const T = this.teacher, A = this.audio, sp = this.world.speaker, nora = this.friend('nora');
    A.play('pa_rip', { pos: sp, vol: 0.5, ref: 2.5, rate: 0.8 });
    yield* this.wait(0.9);
    A.play('pa_chime', { pos: sp, vol: 0.9, ref: 3, reverb: 0.5, rate: 0.85 });
    T.lookAt(sp, 1.2);
    yield* this.wait(2.2);
    const h = this.paSay('pa_closed');
    this.lookAllAt(sp);
    yield* this.wait((h ? h.duration : 5.6) + 1.0);
    this.lookAllBack();
    yield* this.turnToClass();
    T.rollTarget = 0.3;
    yield* this.say('t_laugh', 0.6);
    T.rollTarget = 0;
    if (nora && !nora.gone) yield* this.waitVoice(this.friendSay(nora, 'n_closed', 0), 0.6);
    yield* this.actStare(2.2);
  }

  // ------------------------------------------------------------- PERIOD 1: ROLL CALL (8:30)
  *chapter1() {
    const T = this.teacher, W = this.world, A = this.audio, sam = this.friend('sam'), nora = this.friend('nora');
    const touch = this.input.touch;
    this.setClockRun(0, 4, 45);
    W.gloomTarget = 0.15;
    this.present = false; this.idleKind = 'none';
    T.place(6.0, -5.0, -Math.PI / 2);
    this.ui.card(CHAPTERS[0]);
    this.setObjectives([{ id: 'wait', text: 'Wait for the teacher' }]);
    this.hintControls();
    // an empty class, rain on the windows
    yield* this.wait(6);
    yield* this.waitVoice(this.friendSay(sam, 's_late', 0), 2);
    yield* this.waitVoice(this.friendSay(nora, 'n_free', 0), 3);
    this.fx.push(this.fxLightning(false));
    yield* this.wait(5);
    // slow footsteps in the hallway
    yield* this.hallSteps();
    this.doorFace.visible = true;
    yield* this.wait(0.8);
    this.friendSay(nora, 'n_door', 0);
    // he stays at the window until you see him (or for a while)
    const wp = this.doorFace.getWorldPosition(new THREE.Vector3());
    let seenT = 0, seen = false;
    while (seenT < 7) { seenT += this.dt; if (this.lookingAt(wp, 0.95)) { seen = true; break; } yield; }
    if (seen) { A.play('stinger_1', { vol: 0.5, pos: wp, ref: 3 }); this.scareFear = Math.max(this.scareFear, 0.6); yield* this.wait(1.1); }
    else yield* this.wait(0.5);
    this.doorFace.visible = false;
    yield* this.wait(2.2);
    A.play('door_open', { pos: W.door.pos, vol: 1.2, ref: 2.5 });
    W.door.openTarget = 1;
    A.fadeBus('amb', 0.55, 2);
    yield* this.wait(1.6);
    this.present = true;
    yield* this.cmd(() => this.enterRoom());
    this.completeObjective('wait');
    yield* this.waitVoice(this.friendSay(sam, 's_sub', 0), 0.6);
    A.fadeBus('amb', 1, 2);
    this.lockBully = true;
    this.setClockRun(this.clockMin, 14, 80);
    yield* this.cmd(() => this.introduce());
    this.friendSay(sam, 's_name', 0);
    yield* this.cmd(() => this.rules());
    this.setObjectives([{ id: 'roll', text: 'Answer the roll call' }]);
    yield* this.cmd(() => this.rollCall());
    this.lockBully = false;

    // ---- the lesson begins
    this.setObjectives([{ id: 'bell', text: 'Survive until 9:30' }]);
    this.setClockRun(this.clockMin, 58, 300);
    yield* this.beat(() => this.actWrite('RULE 1:  SILENCE'));
    this.idleKind = 'lesson'; this.memesOn = true;
    yield* this.lesson(10);
    yield* this.whisper(nora, 'n_chalk');
    yield* this.lesson(5);
    this.addObjective({ id: 'whisper', text: touch ? 'Whisper to Sam or Nora (hold TALK)' : 'Whisper to Sam or Nora  [hold E]' });
    this.ui.hint(touch ? 'Look at Sam (left) or Nora (right) and hold <b>TALK</b> to whisper. Do it while his back is turned.' : 'Look at Sam (left) or Nora (right) and hold <b>E</b> to whisper. Do it while his back is turned.', 7);
    this.timers.after(9, () => this.state === 'playing' && !this.cutscene && !this.objDone('whisper') && this.ui.hint('<b>When the chalk stops… stop talking.</b>', 5));
    yield* this.until(() => this.objDone('whisper'), 60);
    yield* this.lesson(14);
    yield* this.storyNote(0);
    yield* this.lesson(12);
    yield* this.kevinChair();
    yield* this.lesson(12);
    // Sam sends you a video
    yield* this.videoSent(sam);
    yield* this.lesson(12);
    // the dare
    yield* this.whisper(sam, 's_dare');
    this.allowEcho = true;
    this.addObjective({ id: 'echo', text: touch ? 'Repeat what he says (ECHO)' : 'Repeat what he says  [R]' });
    this.ui.hint(touch ? 'When he says something, tap <b>ECHO</b> to repeat it back at him.' : 'When he says something, press <b>R</b> to repeat it back at him.', 7);
    yield* this.until(() => this.objDone('echo'), 60);
    if (this.objDone('echo')) { yield* this.until(() => this.ready(), 20); yield* this.whisper(sam, 's_didit'); }
    this.callsOn = true; this.nextCall = 25;
    yield* this.lesson(25);
    // the storm
    yield* this.beat(() => this.windowBeat());
    yield* this.whisper(nora, 'n_storm');
    yield* this.lesson(28);
    yield* this.beat(() => this.scareFlickerApproach());
    yield* this.lesson(6);
    yield* this.whisper(sam, 's_close');
    yield* this.lesson(22);
    this.memesOn = false; this.callsOn = false;
    yield* this.until(() => !this.cutscene && !this.memeBusy, 40);
    yield* this.cmd(() => this.periodBell('t_nobody'));
    this.completeChapter();
  }

  /** slow footsteps coming down the hallway, outside the door */
  *hallSteps() {
    const W = this.world, A = this.audio;
    const n = 7;
    for (let i = 0; i < n; i++) {
      const k = i / (n - 1);
      const p = new THREE.Vector3(5.4, 0.05, 3.5 - k * 8.0);
      A.play(pick(STEPS), { pos: p, vol: 0.35 + k * 0.6, ref: 1.6, reverb: 0.5, rate: rand(0.86, 0.94) });
      if (i === 3) for (const c of this.allKids()) if (!c.gone && chance(0.8)) { c.lookTarget = W.door.pos; c.speed = 2.5; }
      yield* this.wait(1.05);
    }
    yield* this.wait(1.2);
  }

  *enterRoom() {
    const T = this.teacher, W = this.world, A = this.audio;
    T.lookAt(null, 3);
    for (const k of this.allKids()) k.lookTarget = W.door.pos;
    yield* this.walk(3.9, -5.0, 0.8);
    W.door.openTarget = 0;
    this.timers.after(1.4, () => A.play('door_slam', { pos: W.door.pos, vol: 0.45, ref: 2 }));
    for (const k of this.allKids()) { k.lookTarget = null; k.speed = 4; }
    yield* this.walk(0.4, -5.5, 0.8);
    T.facePoint(this.camPos, 2); T.lookAt(this.camPos, 2.2);
    yield* this.wait(1.6);
  }

  *introduce() {
    yield* this.actStare(2.2);
    yield* this.say('t_iam', 0.6);
    yield* this.actWrite('MR. MADI', { row: 0, size: 72 });
    this.boardRow = 1;
    yield* this.turnToClass();
    yield* this.say('t_name', 0.6);
  }

  /** the chalk dust... and the only rule */
  *rules() {
    yield* this.actClap(6);
    yield* this.wait(0.6);
    yield* this.say('t_rule', 0.6);
    yield* this.actStare(2.2);
  }

  *rollCall() {
    const T = this.teacher, W = this.world, sam = this.friend('sam'), nora = this.friend('nora');
    T.setPose('gesture');
    this.audio.play('page', { pos: T.handPos('R'), vol: 0.8 });
    yield* this.say('t_roll', 0.5);
    T.lookAt(sam.headWorld(new THREE.Vector3()), 3);
    yield* this.say('t_r_sam', 0.2);
    yield* this.waitVoice(this.friendSay(sam, 's_here', 0), 0.5);
    T.lookAt(nora.headWorld(new THREE.Vector3()), 3);
    yield* this.say('t_r_nora', 0.2);
    yield* this.waitVoice(this.friendSay(nora, 'n_here', 0), 0.5);
    T.lookAt(this.camPos, 3);
    yield* this.say('t_r_kevin', 0.4);
    // everyone turns to look at the empty desk
    for (const k of this.allKids()) { k.lookTarget = W.kevinSeat; k.speed = 3; }
    T.lookAt(W.kevinSeat, 2);
    yield* this.wait(2.8);
    yield* this.say('t_r_kevin2', 0.4);
    yield* this.wait(1.8);
    yield* this.say('t_absent', 0.6);
    for (const k of this.allKids()) { k.lookTarget = null; k.speed = 4; }
    T.lookAt(this.camPos, 2.5); T.facePoint(this.camPos, 2);
    yield* this.wait(1.0);
    yield* this.say('t_andyou', 0.2);
    let answered = false;
    for (let tries = 0; tries < 3 && !answered; tries++) {
      const i = yield* this.choose('Roll call', ['Say “Here.”', 'Stay silent'], 8);
      if (i === 0) {
        this.handT = 1.6;
        yield* this.waitVoice(this.playerSay('p_here'), 0.4);
        yield* this.say('t_good1', 0.4);
        answered = true;
      } else {
        yield* this.say('t_answerme', 0.3);
        this.anger = Math.min(60, this.anger + 15);
        yield* this.walk(clamp(T.pos.x * 0.5, -1, 1), Math.min(-3.8, T.pos.z + 0.6), 0.6);
        T.facePoint(this.camPos, 3); T.lookAt(this.camPos, 3);
      }
    }
    T.setPose('rest');
    // friends in the class answer too
    for (const p of this.players) {
      if (p.local) continue;
      T.lookAt(p.camPos, 3); T.facePoint(p.camPos, 2);
      yield* this.wait(0.8);
      yield* this.say('t_andyou', 0.2);
      const i = yield* this.choose('Roll call', ['Say “Here.”', 'Stay silent'], 8, p);
      if (i === 0) { p.handT = 1.6; yield* this.waitVoice(this.playerSay('p_here', p), 0.4); yield* this.say('t_good1', 0.4); }
      else { yield* this.say('t_answerme', 0.3); this.anger = Math.min(60, this.anger + 10); yield* this.actStare(1.5); }
    }
    T.lookAt(this.camPos, 3);
    this.completeObjective('roll');
  }

  /** lightning: he turns to the window... and tells you not to look */
  *windowBeat() {
    const T = this.teacher;
    const win = new THREE.Vector3(-5.6, 1.8, -1.5);
    this.fx.push(this.fxLightning(false));
    yield* this.wait(0.4);
    T.lookAt(win, 1.6);
    for (const k of this.allKids()) if (!k.gone && !k.call && chance(0.7)) { k.lookTarget = win; k.speed = 3; }
    yield* this.wait(3.0);
    T.lookAt(this.camPos, 3); T.facePoint(this.camPos, 2);
    yield* this.wait(0.9);
    yield* this.say('t_window', 0.4);
    for (const k of this.allKids()) if (!k.call) { k.lookTarget = null; k.speed = 4; }
    yield* this.actStare(1.6);
  }

  // ------------------------------------------------------------- PERIOD 2: THE LESSON (9:30)
  *chapter2() {
    const W = this.world, sam = this.friend('sam'), nora = this.friend('nora');
    const touch = this.input.touch;
    this.setClockRun(60, 64, 40);
    W.gloomTarget = 0.35;
    this.ui.card(CHAPTERS[1]);
    this.idleKind = 'none';
    this.allowEcho = true;
    this.projAuto = true;
    this.hintControls();
    this.setObjectives([{ id: 'bell', text: 'Survive until 10:30' }]);
    yield* this.wait(2.5);
    yield* this.cmd(() => this.actWrite('LESSON 7:  ???'), 2);
    yield* this.cmd(() => this.openBooks(), 1);
    yield* this.whisper(sam, 's_books');
    this.idleKind = 'lesson'; this.memesOn = true;
    this.setClockRun(this.clockMin, 116, 380);
    yield* this.lesson(25);
    // Nora's idea: ask him things
    yield* this.whisper(nora, 'n_ask');
    this.allowAsk = true;
    this.addObjective({ id: 'ask', text: touch ? 'Ask him a dumb question (ASK)' : 'Ask him a dumb question  [T]' });
    this.ui.hint(touch ? 'Tap <b>ASK</b> to raise your hand and ask him something.' : 'Press <b>T</b> to raise your hand and ask him something.', 7);
    yield* this.until(() => this.objDone('ask'), 55);
    if (!this.objDone('ask')) yield* this.beat(() => this.laptopLookup('how to be a teacher', 'Stand at the front of the class.'), 2);
    yield* this.until(() => this.ready(), 30);
    yield* this.lesson(8);
    yield* this.whisper(nora, 'n_laptop');
    this.addObjective({ id: 'laptop', text: 'Whisper to a friend while he types' });
    this.ui.hint('While he is typing he isn\'t watching you. <b>Whisper!</b>', 6);
    yield* this.lesson(14);
    if (!this.objDone('laptop')) yield* this.beat(() => this.laptopLookup('how to teach lesson 7', 'Step 1: Know lesson 7.'), 2);
    yield* this.until(() => this.objDone('laptop'), 25);
    this.callsOn = true; this.nextCall = 20; this.buzzOn = true; this.nextBuzz = 30;
    yield* this.lesson(25);
    // his glasses
    yield* this.until(() => this.ready(), 30);
    this.addObjective({ id: 'glasses', text: 'Whisper while he wipes his glasses' });
    this.timers.after(2.2, () => this.friendSay(nora, 'n_blind', 0));
    yield* this.cmd(() => this.glassesWipe(9), 3);
    this.nextWipe = this.t + 55;
    yield* this.whisper(sam, 's_glasses');
    yield* this.lesson(16);
    yield* this.storyNote(1);
    yield* this.lesson(14);
    // the office calls for Mr. Hale
    this.lockBully = true;
    yield* this.beat(() => this.paHale(), 2);
    this.lockBully = false;
    yield* this.lesson(14);
    yield* this.noteMission();
    yield* this.lesson(14);
    // "psst! you have to see this!"
    yield* this.videoShow(nora);
    yield* this.lesson(12);
    // he stares at the board for a very long time
    yield* this.beat(() => this.longPonder());
    yield* this.whisper(sam, 's_board');
    yield* this.lesson(22);
    // the projector shows his search history
    this.lockBully = true;
    this.memesOn = false;
    yield* this.beat(() => this.reveal(), 6);
    this.lockBully = false;
    yield* this.lesson(2);
    yield* this.whisper(nora, 'n_room13');
    yield* this.beat(() => this.actWrite('EYES ON THE BOARD'));
    this.memesOn = true;
    yield* this.lesson(22);
    this.memesOn = false; this.callsOn = false; this.buzzOn = false;
    if (this.buzz) this.resolveBuzz();
    yield* this.until(() => !this.cutscene && !this.memeBusy, 40);
    yield* this.cmd(() => this.periodBell('t_sitdown'));
    this.completeChapter();
  }

  *openBooks() {
    const T = this.teacher;
    yield* this.turnToClass();
    T.setPose('gesture');
    yield* this.say('t_books', 0.5);
    T.setPose('rest');
    yield* this.actStare(1.8);
  }

  *longPonder() {
    const T = this.teacher, B = this.world.board, W = this.world;
    T.lookAt(null, 3);
    yield* this.walk(0, -6.1);
    T.faceTo(Math.PI, 3);
    B.toWorld(420, B.rows[0], W.boardAnchor, v1);
    T.lookAt(v1.clone(), 2);
    yield* this.wait(3);
    T.rollTarget = 0.4;
    this.teacherSay('t_hmm', 1.1);
    yield* this.wait(7);
    T.rollTarget = -0.2;
    yield* this.wait(4);
    T.rollTarget = 0;
  }

  /** the projector shows everyone what he has been searching for */
  *reveal() {
    const T = this.teacher, W = this.world, A = this.audio, P = W.projector, nora = this.friend('nora');
    if (!P.on) { P.setOn(true); A.play('projector_on', { pos: P.devPos, vol: 0.8, ref: 3 }); }
    yield* this.laptopLookup('how long can a class last', 'As long as the teacher wants.', null, { keepOpen: true });
    // he scrolls back through his history
    T.leanTarget = 0.5; T.crouchTarget = 0.1; this.typing = true;
    T.setPose('type', { L: W.laptop.keyL, R: W.laptop.keyR, typing: true });
    T.lookAt(W.laptop.screenPos, 3);
    W.laptop.openTarget = 1; W.laptop.glowTarget = 1;
    for (let i = 0; i < HISTORY.length; i++) { P.history(HISTORY, i); A.play('key_enter', { pos: W.laptop.screenPos, vol: 0.4 }); yield* this.wait(0.9); }
    T.poseData.typing = false;
    yield* this.wait(0.8);
    P.news();
    A.play('key_enter', { pos: W.laptop.screenPos, vol: 0.8 });
    yield* this.wait(0.8);
    A.play('gasp', { pos: new THREE.Vector3(0, 1.1, 0.5), vol: 0.9, ref: 3 });
    this.friendSay(nora, 'n_missing', 0);
    for (const k of this.allKids()) k.lookTarget = P.centre;
    yield* this.wait(3.2);
    // he notices
    this.typing = false;
    T.setPose('rest'); T.leanTarget = 0; T.crouchTarget = 0;
    T.lookAt(P.centre, 1.2);
    yield* this.wait(2.4);
    for (const k of this.allKids()) k.lookTarget = null;
    T.lookAt(this.camPos, 1.6);
    yield* this.wait(1.6);
    P.glitch('I SEE YOU'); A.play('glitch', { vol: 0.9 }); this.glitch = 0.5;
    yield* this.wait(0.9);
    A.play('lid_slam', { pos: W.laptop.screenPos, vol: 1.2, ref: 2.5 });
    W.laptop.openTarget = 0; W.laptop.glowTarget = 0; P.setOn(false); P.noSignal();
    yield* this.blinkTo(0, -3.02, 0, 1.4);
    T.crouchTarget = 0.4; T.stanceTarget = 0.3; T.leanTarget = 1.1;
    T.setPose('desk', this.deskCorners());
    T.lookAt(this.camPos, 60);
    A.play('stinger_1', { vol: 1.0 });
    this.scareFear = 1; this.shake = 0.4;
    yield* this.say('t_eyes', 0.8);
    T.crouchTarget = 0; T.stanceTarget = 0; T.leanTarget = 0; T.setPose('rest');
    yield* this.wait(0.8);
    yield* this.walk(0.3, -5.2);
  }

  // ------------------------------------------------------------- PERIOD 3: POP QUIZ (10:30)
  *chapter3() {
    const T = this.teacher, W = this.world, sam = this.friend('sam'), nora = this.friend('nora');
    this.setClockRun(120, 124, 30);
    W.gloomTarget = 0.6;
    W.lights.banks[2].dead = true;
    T.place(0.3, -5.4, 0);
    this.ui.card(CHAPTERS[2]);
    this.idleKind = 'none';
    this.allowEcho = true; this.allowAsk = true; this.projAuto = true;
    this.scaresOn = true; this.nextScare = 70; this.scarePool = ['lightning', 'flicker', 'door', 'whisper', 'book'];
    this.hintControls();
    this.setObjectives([{ id: 'bell', text: 'Survive until 11:30' }]);
    // he is already facing you. He has been for a while.
    T.lookAt(this.camPos, 60);
    yield* this.wait(5);
    yield* this.whisper(sam, 's_study');
    yield* this.wait(2.5);
    this.addObjective({ id: 'quiz', text: 'Pass his pop quiz' });
    // the quiz plays out once: no echoes, calls or phone while he is asking
    this.lockBully = true;
    yield* this.cmd(() => this.quizIntro(), 2);
    yield* this.cmd(() => this.quizKid(), 2);
    yield* this.cmd(() => this.quizYou(), 2);
    yield* this.cmd(() => this.countClass(), 2);
    yield* this.cmd(() => this.everyoneHere(), 2);
    this.lockBully = false;
    this.idleKind = 'lesson'; this.memesOn = true;
    this.setClockRun(Math.max(132, this.clockMin), 176, 290);
    yield* this.lesson(22);
    yield* this.storyNote(2);
    yield* this.lesson(12);
    // he starts walking between the desks
    this.ui.hint('He walks between the desks. <b>When he is close, he can hear you whisper.</b>', 6);
    this.callsOn = true; this.nextCall = 25; this.buzzOn = true; this.nextBuzz = 35;
    this.idleKind = 'patrol';
    yield* this.lesson(40);
    yield* this.beat(() => this.behindYou());
    yield* this.lesson(28);
    this.idleKind = 'lesson';
    yield* this.until(() => this.ready(), 30);
    this.lastScare.students = this.t;
    this.fx.push(this.fxStudentsStare());
    yield* this.lesson(14);
    yield* this.whisper(sam, 's_scared');
    yield* this.lesson(12);
    // Sam needs to laugh at something, anything
    yield* this.videoShow(sam);
    yield* this.lesson(10);
    // the power goes out
    yield* this.beat(() => this.powerCut(), 1);
    yield* this.lesson(14);
    yield* this.beat(() => this.pencilsDown());
    yield* this.lesson(14);
    this.memesOn = false; this.callsOn = false; this.buzzOn = false;
    if (this.buzz) this.resolveBuzz();
    yield* this.until(() => !this.cutscene && !this.memeBusy, 40);
    yield* this.cmd(() => this.periodBell('t_notover'));
    this.completeChapter();
  }

  *quizIntro() {
    yield* this.turnToClass();
    this.audio.play('page', { pos: this.teacher.handPos('R'), vol: 0.8 });
    yield* this.say('q_pop', 0.8);
  }

  *quizKid() {
    const T = this.teacher;
    const maya = this.students.find((s) => s.name === 'Maya') || this.students[0];
    const p = maya.root.position;
    yield* this.walk(-0.75, p.z - 0.3, 0.75);
    T.facePoint(new THREE.Vector3(p.x, 0, p.z), 2);
    T.lookAt(maya.headWorld(new THREE.Vector3()), 3);
    maya.lookTarget = T.headWorld(new THREE.Vector3());
    yield* this.wait(0.8);
    yield* this.say('q_two', 0.6);
    yield* this.waitVoice(this.sayAt(maya, 'k_seven', 0), 0.6);
    yield* this.say('q_correct', 0.4);
    maya.lookTarget = null;
    this.giggle();
  }

  *quizYou() {
    const T = this.teacher, A = this.audio, sam = this.friend('sam'), nora = this.friend('nora');
    // he comes up the aisle and stops right next to you
    yield* this.walk(-0.75, -0.6, 0.75);
    yield* this.walk(-0.66, -1.35, 0.6);
    T.facePoint(this.camPos, 2); T.lookAt(this.camPos, 3);
    this.friendSay(nora, 'n_behind', 0);
    {
      yield* this.wait(2.2);
      yield* this.say('q_you', 0.4);
      yield* this.say('q_name', 0.2);
      let i = yield* this.choose('What is my name?', ['Mister Madi.', 'Mister Hale.', 'I don\'t know.'], 10);
      if (i >= 0) yield* this.waitVoice(this.playerSay(['p_a_madi', 'p_a_hale', 'p_a_dunno'][i]), 0.4);
      if (i === 0) { yield* this.say('q_correct', 0.4); this.quizScore++; this.mischief += 20; }
      else if (i === 1) {
        yield* this.say('q_hale', 0.3);
        for (const b of this.world.lights.banks) b.flicker = 1.2;
        A.play('sub_hit', { vol: 0.9 }); this.scareFear = 1;
        this.anger = Math.min(90, this.anger + 25);
        yield* this.wait(1);
      } else { yield* this.say(i < 0 ? 't_answerme' : 'q_wrong', 0.4); this.anger = Math.min(90, this.anger + 12); }
      yield* this.waitVoice(this.friendSay(sam, 's_five', 0), 0.5);
      yield* this.say('q_two', 0.2);
      i = yield* this.choose('What is two plus two?', ['Four.', 'Five.', 'Fish.'], 10);
      if (i >= 0) yield* this.waitVoice(this.playerSay(['p_a_four', 'p_a_five', 'p_a_fish'][i]), 0.4);
      if (i === 0) { yield* this.say('q_wrong', 0.4); this.anger = Math.min(90, this.anger + 15); }
      else if (i === 1) { yield* this.say('q_correct', 0.4); this.quizScore++; this.mischief += 20; }
      else if (i === 2) { yield* this.wait(1.8); yield* this.say('q_correct', 0.4); this.quizScore++; this.mischief += 40; this.giggle(); }
      else { yield* this.say('t_answerme', 0.4); this.anger = Math.min(90, this.anger + 12); }
    }
    if (this.quizScore >= 1) this.completeObjective('quiz');
    else this.ui.hint('You failed his quiz. He will remember that.', 4);
    T.lookAt(null, 3);
    yield* this.walk(-0.75, -3.0, 0.8);
    yield* this.walk(0.3, -5.3, 0.8);
  }

  /** "How many students are in this class?" ... and Kevin is back */
  *countClass() {
    const A = this.audio, W = this.world, sam = this.friend('sam'), nora = this.friend('nora'), kevin = this.kevin;
    yield* this.turnToClass();
    yield* this.say('q_count', 0.5);
    this.friendSay(nora, 'n_count', 0);
    this.ui.hint('Count the chairs…', 4);
    yield* this.wait(5);
    yield* this.say('q_again', 0.6);
    A.play('lights_off', { vol: 1 });
    W.setMaster(0); this.blackoutTarget = 0.96;
    yield* this.wait(1.8);
    if (kevin) { kevin.setGone(false); kevin.setHollow(true); kevin.lookTarget = this.camPos; kevin.speed = 50; }
    W.setMaster(0.8); this.blackoutTarget = 0;
    A.play('chair_scrape', { pos: W.kevinSeat, vol: 0.8, ref: 2 });
    this.friendSay(sam, 's_lookdown', 0);
    let t = 0, seen = false;
    while (t < 9 && kevin) { t += this.dt; if (this.lookingAt(kevin.headWorld(v2), 0.95)) { seen = true; break; } yield; }
    if (seen) { A.play('stinger_1', { vol: 1 }); A.play('gasp', { pos: new THREE.Vector3(0, 1.1, 0.5), vol: 0.7 }); this.scareFear = 1; this.shake = 0.3; }
    yield* this.wait(2.2);
    A.play('lights_off', { vol: 0.8 });
    W.setMaster(0); this.blackoutTarget = 0.96;
    yield* this.wait(0.6);
    if (kevin) { kevin.setGone(true); kevin.lookTarget = null; }
    W.setMaster(1); this.blackoutTarget = 0;
    yield* this.waitVoice(this.friendSay(sam, 's_kevin', 0), 0.3);
  }

  *everyoneHere() {
    yield* this.turnToClass();
    yield* this.wait(1.2);
    yield* this.say('t_everyone', 0.6);
    yield* this.actStare(2.4);
  }

  /** on his walk he stops right behind your chair */
  *behindYou() {
    const T = this.teacher, A = this.audio;
    let br = null;
    try {
      T.lookAt(null, 3);
      yield* this.walk(0.75, -0.95, 0.7);
      T.facePoint(this.camPos, 2); T.lookAt(this.camPos, 3);
      T.leanTarget = 0.35;
      br = A.play('breath', { loop: true, pos: T.headWorld(new THREE.Vector3()), vol: 0.8, ref: 0.6, reverb: 0.05 });
      yield* this.wait(2.5);
      v1.set(0.25, 0.05, 0.25).applyQuaternion(this.camera.quaternion).add(this.camPos);
      this.teacherSayAt('tw_here', v1.clone(), 1.3, 0.35, [0.25, 0.05, 0.25]);
      let t = 0, seen = false;
      while (t < 7) { t += this.dt; if (this.lookingAtTeacher) { seen = true; break; } yield; }
      if (seen) { A.play('stinger_1', { vol: 0.9 }); this.scareFear = 1; this.shake = 0.3; yield* this.wait(2); }
      else { this.audio.say('tw_shh', { pos: v1.clone(), ear: [0.25, 0.05, 0.25], ref: 0.3, vol: 1.2, reverb: 0.02 }); yield* this.wait(2.4); }
    } finally {
      if (br) br.stop(0.5);
      T.leanTarget = 0;
    }
    yield* this.walk(0.75, 2.6, 0.75);
    yield* this.walk(rand(-1, 1), -5.3);
  }

  *pencilsDown() {
    yield* this.turnToClass();
    yield* this.say('t_pencils', 0.6);
    yield* this.actClap(4);
    yield* this.actStare(1.5);
  }

  // ------------------------------------------------------------- PERIOD 4: DETENTION (11:30)
  *chapter4() {
    const T = this.teacher, W = this.world, sam = this.friend('sam'), nora = this.friend('nora');
    const touch = this.input.touch;
    this.setClockRun(180, 183, 30);
    W.gloomTarget = 0.92; W.gloom = 0.8;
    W.lights.banks[2].dead = true;
    this.emergency = 1;
    T.place(0.3, -5.4, 0);
    this.ui.card(CHAPTERS[3]);
    this.idleKind = 'none';
    this.allowEcho = true; this.allowAsk = true; this.projAuto = true;
    this.hintControls();
    this.setObjectives([{ id: 'bell', text: 'Survive until 12:30' }]);
    yield* this.wait(2.5);
    yield* this.cmd(() => this.detentionIntro(), 1);
    this.idleKind = 'lesson'; this.memesOn = true;
    this.setClockRun(this.clockMin, 238, 360);
    yield* this.lesson(18);
    // Nora's plan
    this.addObjective({ id: 'note', text: 'Read Nora\'s note' });
    yield* this.until(() => this.ready() && !this.ui.noteOpen && !this.talk, 25);
    this.giveNote(PLAN_NOTE, 'nora');
    yield* this.until(() => !this.ui.noteOpen, 30);
    this.completeObjective('note');
    yield* this.wait(1.2);
    yield* this.whisper(sam, 's_plan', 1);
    this.addObjective({ id: 'final', text: 'At the bell, ask him something he can\'t look up' });
    this.scaresOn = true; this.nextScare = 30; this.scarePool = ['lightning', 'flicker', 'students', 'boardmsg', 'whisper', 'neck', 'headturn', 'door'];
    yield* this.lesson(25);
    yield* this.whisper(sam, 's_hungry');
    yield* this.lesson(10);
    yield* this.beat(() => this.saySomething('t_nolunch'));
    yield* this.lesson(12);
    this.fx.push(this.clockBackwards());
    yield* this.lesson(16);
    // a message from Mr. Hale
    yield* this.haleMessage(touch);
    yield* this.lesson(22);
    yield* this.beat(() => this.saySomething('t_quietfav'));
    yield* this.whisper(nora, 'n_quietone');
    this.callsOn = true; this.nextCall = 25; this.buzzOn = true; this.nextBuzz = 40;
    yield* this.lesson(25);
    yield* this.until(() => this.ready(), 30);
    this.lastScare.behind = this.t;
    yield* this.cmd(() => this.scareBehind(), 1);
    yield* this.lesson(12);
    // the speaker he tore out speaks again
    this.lockBully = true;
    yield* this.beat(() => this.paClosed(), 2);
    this.lockBully = false;
    yield* this.lesson(12);
    // somebody sends you a video of this classroom
    yield* this.videoSent(null, 'found', 'Unknown');
    yield* this.lesson(12);
    yield* this.whisper(nora, 'n_plan');
    yield* this.lesson(25);
    yield* this.whisper(sam, 's_ready');
    yield* this.lesson(12);
    yield* this.whisper(nora, 'n_almost');
    yield* this.lesson(10);
    this.memesOn = false;
    yield* this.until(() => !this.cutscene && !this.memeBusy, 40);
    this.scaresOn = false; this.callsOn = false; this.buzzOn = false;
    yield* this.cmd(() => this.finale(), 3);
  }

  *detentionIntro() {
    yield* this.turnToClass();
    yield* this.say('t_detention', 1);
    yield* this.actStare(1.5);
    yield* this.say('t_onehour', 0.8);
  }

  /** turn around, say one thing, stare */
  *saySomething(id) {
    yield* this.turnToClass();
    yield* this.wait(0.6);
    yield* this.say(id, 0.6);
    yield* this.actStare(2);
  }

  /** your phone buzzes: it is Mr. Hale */
  *haleMessage(touch) {
    const nora = this.friend('nora');
    yield* this.until(() => !this.buzz && this.ready(), 30);
    const msg = { from: 'Mr. Hale', text: 'its me. he took my glasses. at the bell ask him what he is' };
    this.addObjective({ id: 'phone', text: touch ? 'Check your phone (hold PHONE)' : 'Check your phone  [hold Q]' });
    this.buzzOn = true; this.nextBuzz = 60;
    this.buzz = { timer: 16, read: 0, tick: 0, msg };
    this.ui.phoneAlert(true);
    this.ui.hint(touch ? 'Your phone is buzzing. Hold <b>PHONE</b> to read it — while he isn\'t looking.' : 'Your phone is buzzing. Hold <b>Q</b> to read it — while he isn\'t looking.', 6);
    yield* this.until(() => this.buzz === null, 30);
    if (this.buzzRead === msg) {
      this.completeObjective('phone');
      yield* this.wait(1);
      yield* this.whisper(nora, 'n_hale_msg', 1.5);
      // ...he knows
      yield* this.beat(() => this.saySomething('t_hale'));
    }
  }

  *finale() {
    const T = this.teacher, A = this.audio, sam = this.friend('sam'), nora = this.friend('nora');
    this.lockBully = true;
    this.clock.fixed = 240;
    if (this.buzz) this.resolveBuzz();
    A.play('bell', { pos: new THREE.Vector3(3.5, 2.8, -6.8), vol: 1.2, ref: 3, reverb: 0.4 });
    this.completeObjective('bell');
    yield* this.wait(1.5);
    yield* this.walk(0, -4.4, 0.9);
    T.facePoint(this.camPos, 2); T.lookAt(this.camPos, 3);
    yield* this.wait(1);
    yield* this.say('t_nobody', 0.4);
    this.friendSay(nora, 'n_now', 0);
    yield* this.wait(1.4);
    this.friendSay(sam, 's_now', 0);
    this.ui.hint('<b>Ask him something he can\'t look up!</b>', 6);
    // everybody gets the question; whoever raises their hand first decides
    const [i, who] = yield* this.chooseAny('Raise your hand and ask…', ['Are you really a teacher?', 'Where is Mister Hale?', 'What is two plus two?'], 14);
    who.handT = 3;
    if (i >= 0) { this.focus = who; T.lookAt(who.camPos, 3); }
    if (i === 0) yield* this.trueEnding(who);
    else if (i === 1) yield* this.escapeEnding(who);
    else if (i === 2) {
      yield* this.waitVoice(this.playerSay('p_f_two', who), 0.3);
      yield* this.say('a_five', 0.6);
      yield* this.jumpscare('wrong');
    } else {
      yield* this.say('t_stay', 0.4);
      yield* this.jumpscare('silent');
    }
  }

  *trueEnding(who = this.me) {
    const T = this.teacher, W = this.world, A = this.audio, P = W.projector;
    this.cutscene = true;
    this.completeObjective('final');
    yield* this.waitVoice(this.playerSay('p_f_teacher', who), 0.4);
    T.rollTarget = 0.35;
    yield* this.wait(3.2);
    T.rollTarget = 0;
    yield* this.say('f_teacher1', 0.6);
    yield* this.say('t_moment', 0.3);
    if (!P.on) { P.setOn(true); A.play('projector_on', { pos: P.devPos, vol: 0.8, ref: 3 }); }
    yield* this.laptopLookup('am i a teacher', 'No results found.', null, { keepOpen: true });
    yield* this.say('f_teacher2', 0.5);
    yield* this.laptopLookup('what am i', 'No results found.', null, { keepOpen: true });
    P.glitch('WHAT AM I'); A.play('glitch', { vol: 0.9 }); this.glitch = 0.4;
    yield* this.say('f_teacher3', 0.8);
    // he takes off the glasses... and there is nobody there
    T.setPose('wipe', { stage: 'reach' });
    yield* this.wait(0.9);
    T.takeGlasses();
    T.setPose('wipe', { stage: 'hold' });
    T.lookAt(this.camPos, 1.5);
    for (const b of W.lights.banks) b.flicker = 2;
    A.play('sub_hit', { vol: 1 });
    yield* this.wait(2.2);
    A.play('lights_off', { vol: 1 });
    W.setMaster(0); this.blackoutTarget = 1;
    yield* this.wait(2.2);
    T.root.visible = false;
    this.present = false;
    const g = T.glasses;
    this.scene.attach(g);
    T.glassesHeld = false;
    g.position.set(W.laptop.group.position.x + 0.05, 0.8, W.laptop.group.position.z + 0.05);
    g.rotation.set(-Math.PI / 2 + 0.2, 0.4, 0);
    P.setOn(false); W.laptop.openTarget = 0; W.laptop.glowTarget = 0;
    this.emergency = 0; W.gloomTarget = 0.05; W.gloom = 0.35;
    W.setMaster(1); this.blackoutTarget = 0;
    A.fadeBus('amb', 0.5, 2);
    A.play('gasp', { pos: new THREE.Vector3(0, 1.1, 0.5), vol: 0.6 });
    for (const k of this.allKids()) k.lookTarget = W.laptop.screenPos;
    yield* this.wait(5);
    this.blackoutTarget = 1;
    yield* this.wait(2);
    this.finish('true');
  }

  *escapeEnding(who = this.me) {
    const T = this.teacher, W = this.world, A = this.audio, sam = this.friend('sam');
    this.cutscene = true;
    this.completeObjective('final');
    yield* this.waitVoice(this.playerSay('p_f_hale', who), 0.4);
    yield* this.wait(2);
    yield* this.say('f_hale', 0.6);
    yield* this.say('t_moment', 0.2);
    // he goes to look it up... while he types, you run
    const look = this.laptopLookup('where is mr hale', 'Room 13 - supply closet', null, { keepOpen: true });
    this.fx.push(look);
    yield* this.until(() => this.typing, 15);
    yield* this.wait(1.2);
    this.friendSay(sam, 's_now', 0);
    yield* this.wait(0.6);
    const door = new THREE.Vector3(4.3, PLAYER_EYE.y, -4.7);
    this.camOverride = { from: this.camPos.clone(), to: door, t: 0, dur: 3.4, yaw: Math.atan2(-(door.x - this.camPos.x), -(door.z - this.camPos.z)) };
    A.play('chair_scrape', { pos: this.camPos.clone(), vol: 0.9 });
    if (this.mp) this.mp.broadcastNow({ t: 'camRun' });
    W.door.openTarget = 1;
    A.play('door_open', { pos: W.door.pos, vol: 1, ref: 2 });
    yield* this.wait(1.8);
    T.lookAt(this.camPos, 3);
    yield* this.wait(1.6);
    this.blackoutTarget = 1;
    A.fadeBus('amb', 0, 1.5);
    yield* this.wait(2);
    this.finish('escape');
  }

  // ------------------------------------------------------------- FREE CLASS
  *freeScript() {
    this.setClockRun(0, 240, FREE_LENGTH);
    this.idleKind = 'none';
    this.allowEcho = true; this.allowAsk = true;
    const touch = this.input.touch;
    const h = this.hintControls();
    h(8, touch ? 'Look at Sam (left) or Nora (right) and hold <b>TALK</b> to whisper. Hold <b>PHONE</b> to play.' : 'Look at Sam or Nora and hold <b>E</b> to whisper. Hold <b>Q</b> to play on your phone.', 7);
    h(18, touch ? 'Tap <b>ECHO</b> right after he speaks to repeat him. Tap <b>ASK</b> to ask a dumb question.' : 'Press <b>R</b> right after he speaks to repeat him. Press <b>T</b> to ask a dumb question.', 7);
    h(30, 'Three strikes and you are done.', 5);
    h(44, touch ? 'Your phone has a game and memes: hold <b>PHONE</b>, tap <b>APP</b> to switch. Crash in the game and it gets <b>LOUD</b>.' : 'Your phone has a game and memes: hold <b>Q</b>, press <b>T</b> to switch apps. Crash in the game and it gets <b>LOUD</b>.', 8);
    this.setObjectives([{ id: 'echo', text: 'Repeat what he says' }, { id: 'ask', text: 'Ask him a dumb question' }, { id: 'video', text: 'Watch a whole meme video' }, { id: 'bell', text: 'Survive until 12:30' }]);
    yield* this.cmd(() => this.freeIntro(), 1);
    this.idleKind = 'lesson'; this.memesOn = true;
    this.callsOn = true; this.buzzOn = true; this.scaresOn = true;
    yield* this.until(() => this.t >= FREE_LENGTH && !this.cutscene);
    this.ending = true;
    this.interrupt(this.freeEnding());
  }

  *freeIntro() {
    yield* this.actWrite('LESSON 7:  ???');
    yield* this.wait(0.6);
    this.teacher.lookAt(this.camPos, 2.5);
    yield* this.wait(1.4);
    yield* this.turnToClass();
    yield* this.say('t_morning');
    yield* this.actStare(2);
  }

  *freeEnding() {
    const T = this.teacher, W = this.world, A = this.audio;
    this.cutscene = true;
    this.ui.clearTransient();
    A.fadeBus('amb', 0.15, 2);
    yield* this.walk(0, -5.0, 1);
    T.facePoint(this.camPos, 2); T.lookAt(this.camPos, 3);
    yield* this.wait(1);
    A.play('bell', { pos: new THREE.Vector3(3.5, 2.8, -6.8), vol: 1.2, ref: 3, reverb: 0.4 });
    this.completeObjective('bell');
    yield* this.wait(3);
    if (this.mischief < PET_LIMIT) {
      yield* this.say('t_good', 0.6);
      yield* this.say('t_stay', 0.4);
      yield* this.jumpscare('pet');
      return;
    }
    yield* this.say('t_dismissed', 0.6);
    for (const f of this.friends) if (!f.gone) f.lookTarget = this.camPos;
    yield* this.wait(1.2);
    W.board.clear();
    yield* this.actWrite('see you tomorrow', { row: 1 });
    T.lookAt(this.camPos, 1.5);
    yield* this.wait(2.2);
    this.blackoutTarget = 1;
    A.fadeBus('amb', 0, 2);
    yield* this.wait(2.4);
    this.finish('survived');
  }

  // ------------------------------------------------------------- results
  rank() {
    const m = this.mischief;
    if (m < PET_LIMIT) return "Teacher's Pet";
    if (m < 400) return 'Quiet Troublemaker';
    if (m < 800) return 'Class Clown';
    return 'Legend of Room 13';
  }

  statsHtml() {
    const mins = Math.floor(this.t / 60), secs = Math.floor(this.t % 60);
    return [
      `Mischief: <b>${Math.floor(this.mischief)}</b> &nbsp;·&nbsp; Rank: <b>${this.rank()}</b>`,
      `Times you repeated him: <b>${this.stats.echoes}</b> &nbsp;·&nbsp; Dumb questions: <b>${this.stats.questions}</b>`,
      `Strikes: <b>${this.strikes}/${this.maxStrikes}</b> &nbsp;·&nbsp; ${this.hard ? '<b>HARD</b>' : 'Easy'} &nbsp;·&nbsp; Time: <b>${mins}:${String(secs).padStart(2, '0')}</b>`,
    ].join('<br>');
  }

  completeChapter() {
    const n = this.chapter;
    this.saveProgress(n + 1);
    const titles = [
      ['PERIOD 1 COMPLETE', 'The bell rang. Nobody moved.<br><i>Kevin\'s desk is still empty.</i>'],
      ['PERIOD 2 COMPLETE', 'Mr. Hale has been missing since Friday.<br><i>The substitute is wearing his glasses.</i>'],
      ['PERIOD 3 COMPLETE', 'Kevin was back for a moment.<br><i>His eyes were black.</i>'],
    ];
    const [title, text] = titles[n] || ['PERIOD COMPLETE', ''];
    this.endAction = n < 3 ? { label: 'NEXT PERIOD', go: () => this.start('story', n + 1) } : null;
    this.showEnd(title, text);
  }

  finish(kind) {
    if (this.mode === 'story') {
      if (kind === 'true' || kind === 'escape') {
        this.saveProgress(4);
        this.endAction = kind === 'escape'
          ? { label: 'TRY FOR THE TRUE ENDING', go: () => this.start('story', 3) }
          : { label: 'PLAY FREE CLASS', go: () => this.start('free') };
      } else this.endAction = { label: 'RETRY PERIOD', go: () => this.start('story', this.chapter) };
      const [title, text] = ENDINGS[kind] || ENDINGS.caught;
      this.showEnd(title, (kind === 'caught' && this.hard ? 'On hard, once is enough.<br>Nobody leaves his class.' : text) + (kind === 'true' ? '<br><br><b>THE END.</b>' : ''));
      return;
    }
    this.endAction = { label: 'TRY AGAIN', go: () => this.start('free') };
    let [title, text] = ENDINGS[kind] || ENDINGS.caught;
    if (kind === 'caught' && this.hard) text = 'On hard, once is enough.<br>Nobody leaves his class.';
    if (kind === 'survived') text = 'You survived Madi\'s class.<br><i>See you tomorrow.</i>';
    this.showEnd(title, text);
  }

  showEnd(title, text) {
    this.state = 'end';
    this.script = null;
    this.input.enable(false);
    this.audio.fadeBus('amb', 0, 0.5);
    this.audio.stopAll();
    this.ui.show('hud', false);
    this.ui.clearTransient();
    this.ui.closeChoices();
    this.ui.end(title, text, this.statsHtml(), this.endAction ? this.endAction.label : null);
    if (this.mp) this.mp.onEnd(title, text, this.statsHtml());
  }

  endPrimary() { if (this.endAction && this.endAction.go) { this.endAction.go(); return true; } return false; }

  saveProgress(n) {
    this.lastSaved = n;
    try {
      const cur = Number(localStorage.getItem('madiclass.progress') || 0);
      if (n > cur) localStorage.setItem('madiclass.progress', String(n));
    } catch (e) { /* storage blocked */ }
  }

  // ------------------------------------------------------------- chalk sound
  updateChalkSound(touched) {
    const B = this.world.board;
    const writing = B.job && B.job.type === 'write';
    if (touched && writing) {
      if (!this.chalkSnd || this.chalkSnd.ended) {
        this.chalkSnd = this.audio.play(pick(['chalk_1', 'chalk_2', 'chalk_3', 'chalk_4']), { pos: this.writePose.point.clone(), vol: 0.75, ref: 2, reverb: 0.25, rate: rand(0.9, 1.1) });
      } else this.chalkSnd.setPos(this.writePose.point);
    } else if (!writing && this.chalkSnd) { this.chalkSnd.stop(0.08); this.chalkSnd = null; }
  }

  // ------------------------------------------------------------- HUD + visuals
  updateHud() {
    const ui = this.ui;
    ui.setScore(this.mischief);
    ui.setEye(!this.present ? 'away' : this.blind ? 'blind' : this.typing ? 'busy' : this.watching ? 'open' : 'closed');
    ui.setAnger(this.anger);
    ui.setStrikes(this.strikes, this.maxStrikes);
    ui.echoCue(this.canEcho() && !this.vidZoom && !this.input.phone ? clamp((this.echoable.until - this.t) / 4, 0, 1) : -1, this.input.touch);
    const c = clockLabel(this.clockMin);
    ui.setClock(c.text);
    this.world.clock.set(c.h, c.m, c.s);
    const sec = Math.floor(this.t);
    if (sec !== this.lastTick) { this.lastTick = sec; this.audio.tick(this.world.clock.pos); }
  }

  render(dt) {
    const P = this.post.uniforms, W = this.world;
    const playing = this.state === 'playing';
    let fear = 0;
    if (playing) {
      const prox = clamp((2.8 - (this.teacherDist ?? 9)) / 2.4, 0, 1) * (this.present ? 1 : 0);
      this.scareFear = Math.max(0, this.scareFear - dt * 0.35);
      fear = Math.max(this.anger / 100, prox * 0.8, this.scareFear);
    }
    this.blackout = damp(this.blackout, this.blackoutTarget, 25, dt);
    this.glitch = Math.max(0, this.glitch - dt * 0.8);
    this.redFlash = Math.max(0, this.redFlash - dt * 0.6);
    P.time.value += dt;
    P.vig.value = 0.7 + fear * 0.3;
    P.aberr.value = 0.35 + fear * 1.2 + this.glitch * 4;
    P.grain.value = 0.055 + fear * 0.05;
    P.warp.value = Math.max(0, fear - 0.6) * 1.4 + this.glitch;
    P.glitch.value = this.glitch;
    P.red.value = this.redFlash * 0.45 + (this.emergency && playing ? 0.05 : 0);
    P.blackout.value = this.blackout;
    P.exposure.value = 1.0;
    this.scene.fog.density = 0.075 + W.gloom * 0.03;
    if (this.state !== 'paused') W.update(dt, { emergency: playing ? this.emergency : 0 });
    if (this.underLight > 0) {
      // red light from below the face for the jumpscare
      W.lights.red.color.setHex(0xff2010);
      W.lights.red.position.copy(this.camPos).addScaledVector(this.camFwd, 0.25).add(v1.set(0, -0.35, 0));
      W.lights.red.intensity = 3.5 * this.underLight;
    }
    if (playing || this.state === 'title') {
      this.audio.updateListener(this.camera);
      this.audio.update(dt, this.camPos, {
        tension: clamp(this.anger / 100 + this.phase * 0.08 + (this.teacherDist < 2 ? 0.25 : 0), 0, 1),
        fear: playing ? fear : 0,
        whispers: playing ? (this.phase >= 3 ? 0.45 : this.phase >= 2 ? 0.12 : 0) : 0,
        humLevel: W.lights.banks[0].level * W.master,
      });
    }
    this.ui.update(dt);
    this.post.render(this.scene, this.camera);
  }
}

Object.assign(Game.prototype, VideoMixin);

/** is the clip on a phone held out to you at a loud moment? */
function clipLoud(sh) {
  const c = sh.clip || (sh.clip = clipByKey(sh.key));
  if (!c.loud) return 0;
  for (const [a, b] of c.loud) if (sh.t >= a && sh.t <= b) return 1;
  return 0;
}
