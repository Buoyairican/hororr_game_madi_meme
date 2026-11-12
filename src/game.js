// Gameplay: the teacher's brain (coroutines), anger, friends, phone,
// the scare director, punishments and endings.
import * as THREE from 'three';
import { clamp, lerp, damp, rand, pick, chance, wrapAngle, Bag, Timers, smoothstep } from './util.js';
import { PLAYER_EYE, BOARD_Z } from './world.js';

export const LESSON = 330;               // seconds of class (2:15 -> 3:00)
const PHASE_AT = [0, 70, 165, 255];
const PET_LIMIT = 120;                   // leave with less mischief and he keeps you

const BOARD_TEXT = [
  ['2 + 2 = 5', 'the mitochondria is the', '1066 = nothing happened', 'water boils at ___ ?', 'page 47', 'x + ? = ?', 'photosynthesis = ???', 'the heart has 4 rooms'],
  ['2 + 2 = 5', 'the mitochondria is the', 'water boils at ___ ?', 'page 47', 'photosynthesis = ???', 'x + ? = ?'],
  ['WHO IS TALKING', 'eyes on the board', 'I can hear you', 'sit still', 'quiet quiet quiet quiet', '1 2 3 4 5 6 7 8 9 10 11 12 13', 'I KNOW'],
  ['I SEE YOU', 'NO ONE LEAVES', 'STAY STAY STAY STAY', 'you you you you you you', 'after class'],
];
const LECTURE = [
  ['t_today', 't_page', 't_answer', 't_math', 't_mito', 't_water', 't_history', 't_writedown', 't_question', 't_continue', 't_forgot'],
  ['t_page', 't_answer', 't_math', 't_mito', 't_water', 't_history', 't_writedown', 't_question', 't_continue', 't_forgot', 't_silence'],
  ['t_attention', 't_eyes', 't_answer', 't_forgot', 't_laugh', 't_silence', 't_question', 't_hear', 't_still'],
  ['t_nobody', 't_laugh', 't_see', 't_still', 't_silence', 't_hear', 't_attention'],
];
const WARN = ['t_quiet', 't_who', 't_hear', 't_eyes', 't_still'];
const FRIEND_LINES = {
  sam: ['s_face', 's_arms', 's_board', 's_math', 's_blink', 's_real', 's_game', 's_after', 's_scared'],
  nora: ['n_look', 'n_writing', 'n_phone', 'n_quiet', 'n_chalk', 'n_head', 'n_clock', 'n_notes', 'n_hands'],
};
const PLAYER_LINES = ["shh... he'll hear us", 'I know, right?', 'dude, look at his neck', 'stop making me laugh', 'what is he even teaching?',
  "I'm gonna fail this class", "his eyes... don't look at them", 'worst class ever', 'wait, what?', 'no way', "we're so dead", 'lol'];
const MESSAGES = [
  [['Mom', 'pick up milk on the way home ❤️'], ['Sam', 'bro look at his HANDS 💀'], ['Nora', "don't let him see your phone"], ['Group: Room 13', 'who is the sub??'], ['Unknown', 'hello']],
  [['Sam', 'why is he clapping so much'], ['Unknown', 'hello'], ['Group: Room 13', 'has anyone seen Mr. Hale since Monday?'], ['Nora', 'stop looking at your phone lol']],
  [['Unknown', 'i can see you'], ['Unknown', 'put it away'], ['Mr. Hale', "don't trust the substitute"], ['Unknown', 'eyes on the board']],
  [['Unknown', 'LOOK UP'], ['Mr. Hale', 'he is not a teacher. when the bell rings, RUN'], ['Unknown', 'stay after class'], ['Unknown', 'no one leaves']],
];
const NOTES = [
  ['nora', 'The real teacher, Mr. Hale, disappeared on Monday.<br>This guy showed up on Tuesday.<br><b>Nobody called him.</b>'],
  ['sam', 'did u notice?? he NEVER blinks.<br>and his arms go way past his knees when he stands still. why are his arms so long'],
  ['nora', 'Rules (trust me):<br>1. When the chalk stops, stop talking.<br>2. When he claps, look at the board.<br>3. If he leans over your desk, <b>don\'t make a sound.</b>'],
  ['sam', 'Kevin talked in his class last week.<br>Kevin\'s desk is empty now.<br>dont tell anyone i wrote this'],
  ['nora', 'He keeps the quiet ones after class.<br>Don\'t be <b>too</b> quiet. Talk a little.<br>Just don\'t get caught.'],
];
const SCARE_GAP = [[34, 46], [26, 38], [20, 30], [15, 24]];
const CALL_GAP = [[24, 36], [22, 32], [18, 28], [16, 24]];
const BUZZ_GAP = [[38, 55], [34, 50], [30, 44], [26, 38]];

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
    this.shake = 0; this.glitch = 0; this.scareFear = 0; this.redFlash = 0;
    this.yaw = 0; this.pitch = 0.0;
    this.camPos = new THREE.Vector3();
    this.camFwd = new THREE.Vector3();
    this.boardCenter = new THREE.Vector3(0, 1.65, BOARD_Z);
    this.writePose = { point: new THREE.Vector3(), normal: new THREE.Vector3(0, 0, 1) };
    this.titleT = 0;
    // a face that sometimes appears in the door window
    const W = this.world;
    this.doorFace = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.42), new THREE.MeshBasicMaterial({ map: this.portraitTex, color: 0x6a6a6a }));
    this.doorFace.position.copy(W.doorGlass.position).add(new THREE.Vector3(-0.006, 0, 0));
    this.doorFace.rotation.y = -Math.PI / 2;
    this.doorFace.visible = false;
    this.scene.add(this.doorFace);
    this.reset();
  }

  // ------------------------------------------------------------------ setup
  reset() {
    const T = this.teacher, W = this.world;
    this.t = 0; this.phase = 0;
    this.anger = 0; this.mischief = 0;
    this.flags = { r35: false, r60: false, r85: false };
    this.brain = null; this.fx = [];
    this.cutscene = false; this.eventLock = false; this.ending = false;
    this.introDone = false;
    this.boardRow = 0;
    this.textBags = BOARD_TEXT.map((l) => new Bag(l));
    this.lectureBags = LECTURE.map((l) => new Bag(l));
    this.msgIndex = [0, 0, 0, 0];
    this.nextCall = 16; this.nextBuzz = 34; this.nextScare = 40;
    this.scareDone = {}; this.lastScare = {};
    this.fakeBellDone = false;
    this.notesGiven = 0;
    this.stats = { caught: 0, talk: 0, phone: 0, lost: [] };
    this.talk = null; this.buzz = null; this.phoneUpTime = 0; this.phoneScares = 0;
    this.notLooking = 0; this.eyesHintShown = false;
    this.noise = 0; this.watching = false;
    this.yaw = 0; this.pitch = 0.0;
    this.clockOffset = 0; this.lastTick = -1;
    this.teacherVoice = null; this.chalkSnd = null;
    this.timers.clear();
    this.blackout = this.blackoutTarget = 0;
    this.shake = this.glitch = this.scareFear = this.redFlash = this.underLight = 0;
    W.resetProps();
    W.board.clear();
    W.showSilhouette = false;
    this.doorFace.visible = false;
    T.place(-1.9, -6.38, Math.PI);
    T.root.position.y = 0;
    T.lookAt(null); T.setPose('rest');
    T.leanTarget = T.stretchTarget = T.rollTarget = T.jawTarget = 0; T.jitter = 0;
    T.eyeGlow = 0.12; T.faceGlow = 0.08; T.clap = null;
    for (const f of this.friends) {
      f.setGone(false); f.lookTarget = null; f.forcePitch = null; f.tremble = 0; f.leanRollTarget = 0;
      f.call = null; f.bag = new Bag(FRIEND_LINES[f.kind]); f.linesDone = 0; f.speaking = null; f.speakNoise = 0; f.talking = 0;
    }
    for (const s of this.students) { s.lookTarget = null; s.speed = 4; }
    this.phone.up = false; this.phone.mode = 'game'; this.phone.score = 0;
    this.ui.clearTransient();
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.input.enable(true);
    this.ui.screen(null);
    this.ui.show('hud', true);
    this.audio.stopAll();
    this.audio.stopAmbience();
    this.audio.startAmbience(new THREE.Vector3(0, 3, -2), new THREE.Vector3(-5.5, 1.8, -1));
    this.audio.fadeBus('amb', 1, 0.5);
    this.audio.fadeBus('music', 0, 0.5);
    const touch = this.input.touch;
    const h = (t, s, d = 6) => this.timers.after(t, () => this.state === 'playing' && !this.cutscene && this.ui.hint(s, d));
    h(1.0, touch ? 'Drag anywhere to look around.' : 'Move the mouse to look around. <kbd>Esc</kbd> pauses.');
    h(8, touch ? 'Sam (left) and Nora (right) sit next to you.<br>Look at one and <b>hold TALK</b> to whisper.' : 'Sam (left) and Nora (right) sit next to you.<br>Look at one and <b>hold E</b> (or left click) to whisper.', 7);
    h(17, touch ? '<b>Hold PHONE</b> to play on your phone.' : '<b>Hold Q</b> (or right click) to play on your phone.');
    h(26, 'When the chalk stops&hellip; <b>stop talking.</b>', 5);
    h(34, 'Survive until the bell at <b>3:00</b>.<br>Talking and playing earn mischief. Don\'t be <i>too</i> quiet.', 6);
  }

  // ------------------------------------------------------------- main tick
  tick(dt) {
    this.dt = dt;
    if (this.state === 'title') this.titleTick(dt);
    else if (this.state === 'playing') this.playTick(dt);
    else if (this.state === 'paused') { /* frozen */ }
    this.render(dt);
  }

  titleTick(dt) {
    this.titleT += dt;
    const T = this.teacher;
    this.yaw = Math.sin(this.titleT * 0.13) * 0.18;
    this.pitch = 0.1 + Math.sin(this.titleT * 0.21) * 0.03;
    this.applyCamera(dt);
    T.lookAt(this.camPos, 3);
    if (Math.abs(wrapAngle(T.facing)) > 0.1 && T.facingTarget !== 0) T.faceTo(0, 2);
    T.update(dt, { twitchy: true });
    for (const c of [...this.friends, ...this.students]) c.update(dt);
    this.world.board.update(dt);
    if (chance(dt * 0.15)) this.world.lights.banks[(Math.random() * 3) | 0].flicker = rand(0.2, 0.8);
  }

  playTick(dt) {
    const T = this.teacher;
    this.t += dt;
    this.updatePhase();
    this.updateLook(dt);
    this.timers.update(dt);
    // the teacher's brain runs as a coroutine; reactions replace it
    if (!this.brain) this.brain = this.lessonLoop();
    const r = this.brain.next();
    if (r.done) this.brain = null;
    this.fx = this.fx.filter((g) => !g.next().done);
    T.update(dt, { twitchy: this.phase >= 2 });
    const touched = this.world.board.update(dt);
    this.updateChalkSound(touched);
    for (const f of this.friends) { if (f.talking > 0) f.talking -= dt; f.update(dt); }
    for (const s of this.students) s.update(dt);
    for (const k in this.world.dynamicChairs) this.world.dynamicChairs[k].update(dt, this.t);
    this.updateWatching();
    if (!this.cutscene) this.updateActions(dt); else { this.phone.up = false; if (this.talk) this.endTalk(); this.noise = 0; }
    this.phone.update(dt);
    this.updateAnger(dt);
    if (!this.cutscene) {
      this.updateCalls(dt);
      this.updateBuzz(dt);
      this.updateDirector(dt);
    }
    if (!this.ending && this.t >= LESSON) this.beginEnding();
    this.updateHud();
  }

  updatePhase() {
    let p = 0;
    for (let i = 0; i < PHASE_AT.length; i++) if (this.t >= PHASE_AT[i]) p = i;
    if (p !== this.phase) {
      this.phase = p;
      if (p === 2) this.world.lights.banks[2].dead = true; // the back light dies
      if (p === 3) { this.world.lights.banks[1].flicker = 3; }
    }
  }

  // ------------------------------------------------------------- camera
  updateLook(dt) {
    const d = this.input.consume();
    if (!this.cutscene || this.state === 'playing') {
      this.yaw = clamp(this.yaw + d.yaw, -2.85, 2.85);
      this.pitch = clamp(this.pitch + d.pitch, -1.1, 1.05);
    }
    this.applyCamera(dt);
  }

  applyCamera(dt) {
    const cam = this.camera;
    const ex = PLAYER_EYE;
    cam.position.set(ex.x - Math.sin(this.yaw) * 0.07, ex.y + Math.sin(this.t * 1.6) * 0.004, ex.z + (1 - Math.cos(this.yaw)) * 0.05);
    this.shake = Math.max(0, this.shake - dt * 1.6);
    const s = this.shake * this.shake * 0.06;
    cam.rotation.set(this.pitch + rand(-s, s), this.yaw + rand(-s, s), rand(-s, s) * 0.5, 'YXZ');
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
    v4.subVectors(this.camPos, head).normalize();
    this.teacherDist = head.distanceTo(this.camPos);
    this.watching = fwd.dot(v4) > 0.55 && W.master > 0.3 && this.blackout < 0.5;
    this.lookingAtTeacher = this.lookingAt(head, 0.84);
    this.lookingAtBoard = this.lookingAt(this.boardCenter, 0.72);
  }

  // ------------------------------------------------------------- player actions
  aimFriend() {
    let best = null, bd = 0.94;
    for (const f of this.friends) {
      if (f.gone) continue;
      const d = this.camFwd.dot(v1.subVectors(f.headWorld(v2), this.camPos).normalize());
      if (d > bd) { bd = d; best = f; }
    }
    return best;
  }

  updateActions(dt) {
    const inp = this.input, ui = this.ui, ph = this.phone;
    let noise = 0;
    // a note is open: pressing talk/phone folds it away (needed with pointer lock)
    if (ui.noteOpen && (inp.talk || inp.phone)) { ui.closeNote(); this.noteLatch = true; }
    if (this.noteLatch && !inp.talk && !inp.phone) this.noteLatch = false;
    const blocked = ui.noteOpen || this.noteLatch;
    const aim = this.aimFriend();
    const wantPhone = inp.phone && !blocked;
    const wantTalk = inp.talk && !wantPhone && !blocked;
    ph.up = wantPhone;
    if (wantPhone) {
      noise = Math.max(noise, 0.65);
      this.phoneUpTime += dt;
      this.stats.phone += dt;
      if (this.buzz) {
        if (ph.mode !== 'message' || ph.message !== this.buzz.msg) {
          const m = this.buzz.msg;
          this.ui.subtitle('📱 ' + m.from, m.text, m.from === 'Unknown' || m.from === 'Mr. Hale' ? 'phone creepy' : 'phone', 3.5);
        }
        ph.mode = 'message'; ph.message = this.buzz.msg;
        this.buzz.read += dt;
        if (this.buzz.read > 1.4) this.resolveBuzz();
      } else if (ph.mode === 'message') {
        this.msgShow = (this.msgShow || 0) + dt;
        if (this.msgShow > 2.2) { ph.mode = 'game'; this.msgShow = 0; }
      } else if (ph.mode === 'game') {
        ph.score += dt * 11;
        this.mischief += dt * 7;
      }
      if (this.phase >= 2 && this.phoneUpTime > 3 && this.phoneScares < 2 && !this.eventLock && chance(dt * 0.25)) {
        this.phoneScares++;
        this.interrupt(this.phoneScare());
      }
    } else {
      this.phoneUpTime = 0;
      if (ph.mode === 'face') ph.mode = 'game';
    }
    if (wantTalk && aim) {
      if (!this.talk || this.talk.friend !== aim) this.startTalk(aim);
      this.talk.time += dt;
      this.stats.talk += dt;
      this.mischief += dt * 5;
      noise = Math.max(noise, 1);
      this.updateTalk(dt);
    } else if (this.talk) this.endTalk();
    for (const f of this.friends) if (f.speaking && !f.speaking.ended) noise = Math.max(noise, f.speakNoise);
    if (this.buzz) noise = Math.max(noise, 0.25);
    if (ui.noteOpen) noise = Math.max(noise, 0.2);
    this.noise = noise;
    // prompt
    let p = '';
    if (aim && !wantTalk) p = this.input.touch ? `hold TALK · whisper to ${aim.name}` : `hold [E] · whisper to ${aim.name}`;
    else if (!aim && !wantPhone) {
      for (const k of ['sam', 'nora']) {
        const f = this.friends.find((x) => x.kind === k);
        if (f.gone && this.lookingAt(v2.set(f.root.position.x, 1.1, f.root.position.z), 0.94)) p = `${f.name}'s seat is empty.`;
      }
    }
    ui.prompt(p);
  }

  startTalk(f) {
    if (this.talk) this.endTalk();
    this.talk = { friend: f, time: 0, stage: 'player', timer: 0 };
    f.lookTarget = this.camPos;
    f.leanRollTarget = f.root.position.x < 0 ? -0.12 : 0.12;
    v1.copy(f.headWorld(v2)).lerp(this.camPos, 0.7);
    this.playerWhisper = this.audio.play('whispers_loop', { loop: true, offset: rand(0, 12), vol: 0.22, pos: v1.clone(), ref: 0.5, reverb: 0.04 });
    if (f.call) {
      f.call = null;
      this.mischief += 20;
      this.ui.call('left', false); this.ui.call('right', false);
    }
  }

  updateTalk(dt) {
    const tk = this.talk, f = tk.friend;
    tk.timer += dt;
    if (tk.stage === 'player' && tk.timer > 0.9) {
      this.ui.subtitle('you', pick(PLAYER_LINES), 'you', 2.2);
      tk.stage = 'wait'; tk.timer = 0;
    } else if (tk.stage === 'wait' && tk.timer > 1.3) {
      const id = f.bag.next();
      this.friendSay(f, id, 0.35);
      tk.stage = 'friend'; tk.timer = 0; tk.line = f.speaking;
    } else if (tk.stage === 'friend' && (!tk.line || tk.line.ended || tk.timer > (tk.line.duration || 3) + 0.2)) {
      this.mischief += 25;
      f.linesDone++;
      if (f.linesDone % 3 === 0 && this.notesGiven < NOTES.length) this.timers.after(1.2, () => this.giveNote());
      tk.stage = 'player'; tk.timer = 0;
    }
  }

  endTalk() {
    const f = this.talk.friend;
    if (this.playerWhisper) { this.playerWhisper.stop(0.25); this.playerWhisper = null; }
    // friends hush too if he is looking this way
    if (this.watching && f.speaking && !f.speaking.ended) { f.speaking.stop(0.3); f.talking = 0; }
    f.leanRollTarget = 0;
    this.timers.after(1.2, () => { if (!f.call && (!this.talk || this.talk.friend !== f)) f.lookTarget = null; });
    this.talk = null;
  }

  friendSay(f, id, noise) {
    if (f.speaking && !f.speaking.ended) f.speaking.stop(0.1);
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: f.headWorld(new THREE.Vector3()), ref: 1.0, reverb: 0.08, vol: meta.shout ? 1.3 : 1.15 });
    f.speaking = h; f.speakNoise = noise;
    f.talking = h ? h.duration : 1.5;
    this.ui.subtitle(f.name, meta.text, meta.shout ? 'shout' : '', (h ? h.duration : 2) + 0.6);
    return h;
  }

  giveNote() {
    if (this.cutscene || this.notesGiven >= NOTES.length) return;
    const [who, text] = NOTES[this.notesGiven++];
    const f = this.friends.find((x) => x.kind === who && !x.gone) || this.friends.find((x) => !x.gone);
    if (!f) return;
    this.audio.play('paper', { pos: f.headWorld(new THREE.Vector3()), vol: 0.8 });
    this.ui.showNote(`<small>from ${f.name}:</small><br>${text}`);
    this.mischief += 15;
  }

  // ------------------------------------------------------------- friends calling you
  updateCalls(dt) {
    this.nextCall -= dt;
    if (this.nextCall <= 0 && !this.talk && !this.eventLock) {
      const c = this.friends.filter((f) => !f.gone && !f.call);
      if (c.length) {
        const f = pick(c);
        f.call = { stage: 1, timer: 7.5 };
        f.lookTarget = this.camPos;
        this.friendSay(f, f.kind === 'sam' ? 's_psst' : 'n_psst', 0.3);
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
          this.friendSay(f, f.kind === 'sam' ? 's_psst2' : 'n_psst2', 0.6);
          f.call.timer = 6.5;
        } else {
          this.friendSay(f, f.kind === 'sam' ? 's_hey' : 'n_hey', 1);
          f.call = null;
          this.anger = Math.min(99, this.anger + 30);
          this.interrupt(this.reactWarn(true));
          const ff = f;
          this.timers.after(3.2, () => {
            if (ff.gone || this.cutscene) return;
            this.friendSay(ff, ff.kind === 'sam' ? 's_sorry' : 'n_sorry', 0.3);
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
    if (this.nextBuzz <= 0 && !this.buzz && !this.eventLock) {
      this.buzz = { timer: 7, read: 0, tick: 0, msg: this.nextMessage() };
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
        this.anger = Math.min(99, this.anger + 32);
        this.buzz = null;
        this.ui.phoneAlert(false);
        const g = BUZZ_GAP[this.phase];
        this.nextBuzz = rand(g[0], g[1]);
        this.interrupt(this.reactPhone());
      }
    }
  }

  resolveBuzz() {
    this.buzz = null;
    this.msgShow = 0;
    this.mischief += 10;
    this.ui.phoneAlert(false);
    const g = BUZZ_GAP[this.phase];
    this.nextBuzz = rand(g[0], g[1]);
  }

  // ------------------------------------------------------------- anger
  updateAnger(dt) {
    // seen talking: ~2s to his first warning, ~5.5s to punishment
    const hearing = [0.18, 0.22, 0.28, 0.34][this.phase];
    if (this.noise > 0) {
      const rate = this.watching ? 18 : 18 * hearing;
      this.anger += this.noise * rate * dt;
    } else {
      this.anger -= (this.lookingAtTeacher || this.lookingAtBoard ? 4.5 : 2.6) * dt;
    }
    // he wants your eyes on the board while he is looking at you
    if (this.watching && !this.lookingAtTeacher && !this.lookingAtBoard && this.noise === 0 && !this.cutscene && this.teacherDist > 1.2) {
      this.notLooking += dt;
      if (this.notLooking > 3) {
        this.anger += 2.5 * dt;
        if (!this.eyesHintShown) { this.eyesHintShown = true; this.ui.hint('He wants your <b>eyes on the board</b>.', 4); }
      }
    } else this.notLooking = 0;
    const floor = this.phase >= 3 ? 8 : 0;
    this.anger = clamp(this.anger, floor, 100);
    if (this.cutscene) return;
    const a = this.anger, fl = this.flags;
    if (a >= 100) { this.punish(); return; }
    if (a >= 85 && !fl.r85) { fl.r85 = fl.r60 = fl.r35 = true; this.interrupt(this.reactInspect()); }
    else if (a >= 60 && !fl.r60) { fl.r60 = fl.r35 = true; this.interrupt(this.reactApproach()); }
    else if (a >= 30 && !fl.r35) { fl.r35 = true; this.interrupt(this.reactWarn(false)); }
    if (a < 18) fl.r35 = false;
    if (a < 42) fl.r60 = false;
    if (a < 62) fl.r85 = false;
  }

  punish() {
    this.stats.caught++;
    this.flags = { r35: true, r60: true, r85: true };
    const alive = this.friends.filter((f) => !f.gone);
    if (alive.length) {
      const f = this.talk && !this.talk.friend.gone ? this.talk.friend : pick(alive);
      this.interrupt(this.punishFriend(f));
    } else this.interrupt(this.jumpscare('caught'));
  }

  // ------------------------------------------------------------- coroutine helpers
  interrupt(gen) {
    if (this.brain) { try { this.brain.return(); } catch (e) { console.warn(e); } }
    this.cleanupTeacher();
    this.brain = gen;
  }

  cleanupTeacher() {
    const T = this.teacher;
    const B = this.world.board;
    if (B.job && B.job.type === 'write') B.job = null;
    if (B.job && B.job.type === 'erase') { B.job = null; this.boardRow = 4; }
    if (this.chalkSnd) { this.chalkSnd.stop(0.08); this.chalkSnd = null; }
    T.clap = null;
    T.setPose('rest');
    T.moveTarget = null;
    T.leanTarget = 0; T.stretchTarget = 0; T.rollTarget = 0; T.spreadTarget = 0;
    if (T.root.position.y !== 0 && !this.ending) T.root.position.y = 0;
  }

  *wait(s) { let t = 0; while (t < s) { t += this.dt; yield; } }
  *until(fn, timeout = 1e9) { let t = 0; while (!fn() && t < timeout) { t += this.dt; yield; } }
  *glide(x, z, speed = 2.5) { this.teacher.moveTo(x, z, speed); while (this.teacher.moving) yield; }

  teacherSay(id, vol = 1.35) {
    if (this.teacherVoice && !this.teacherVoice.ended) this.teacherVoice.stop(0.1);
    const meta = this.audio.voices[id];
    const h = this.audio.say(id, { pos: this.teacher.headWorld(new THREE.Vector3()), ref: 2.4, vol, reverb: 0.35 });
    this.teacherVoice = h;
    if (meta) this.ui.subtitle('', meta.text, 'teacher', (h ? h.duration : 2) + 0.8);
    return h;
  }
  *say(id, after = 0.4) {
    const h = this.teacherSay(id);
    yield* this.wait((h ? h.duration : 1.6) + after);
  }

  nextBoardText() { return this.textBags[this.phase].next(); }

  // ------------------------------------------------------------- the lesson
  *lessonLoop() {
    if (!this.introDone) {
      this.introDone = true;
      yield* this.actWrite('LESSON 7:  ???');
      yield* this.wait(0.6);
      this.teacher.lookAt(this.camPos, 3); // a slow look over the shoulder first
      yield* this.wait(1.4);
      this.teacher.facePoint(this.camPos, 3);
      yield* this.wait(0.6);
      yield* this.say('t_morning');
      yield* this.actStare(2.2);
    }
    for (;;) {
      const p = this.phase;
      const W = [
        [[4, 'write'], [3, 'lecture'], [2, 'stare'], [2, 'ponder'], [1.6, 'clap'], [1.4, 'pace']],
        [[4, 'write'], [3, 'lecture'], [2, 'stare'], [2, 'ponder'], [1.6, 'clap'], [1.4, 'pace']],
        [[3, 'write'], [2, 'lecture'], [3, 'stare'], [2, 'ponder'], [2, 'clap'], [2, 'pace']],
        [[2, 'write'], [2, 'lecture'], [4, 'stare'], [1, 'ponder'], [3, 'clap'], [3, 'pace']],
      ][p];
      const act = wpick(W);
      if (act === 'write') yield* this.actWrite();
      else if (act === 'lecture') yield* this.actLecture();
      else if (act === 'stare') yield* this.actStare(rand(2.5, 5) + p * 0.6);
      else if (act === 'ponder') yield* this.actPonder();
      else if (act === 'clap') yield* this.actClap((3 + Math.random() * 3) | 0, true);
      else yield* this.actPace();
    }
  }

  *actWrite(forced) {
    const T = this.teacher, B = this.world.board, W = this.world;
    if (this.boardRow > 3) yield* this.actErase();
    const text = forced || this.nextBoardText();
    const row = this.boardRow++;
    const startX = -2.6 + (65 / B.W) * 5.2;
    T.faceTo(Math.PI, 4);
    T.lookAt(null, 4);
    yield* this.glide(startX - 0.3, -6.38, 2.4);
    T.faceTo(Math.PI, 6);
    yield* this.wait(0.3);
    B.write(text, row, { speed: [7, 6.5, 5.5, 5][this.phase], indent: rand(40, 90) });
    T.setPose('write', this.writePose);
    while (B.busy) {
      B.toWorld(B.hand.x, B.hand.y, W.boardAnchor, this.writePose.point);
      T.lookAt(this.writePose.point, 6);
      const bx = this.writePose.point.x - 0.3;
      if (Math.abs(bx - T.pos.x) > 0.12) T.moveTo(bx, -6.38, 1.4);
      yield;
    }
    T.setPose('rest');
    this.audio.play('chalk_tap', { pos: this.writePose.point.clone(), vol: 0.7 });
    if (chance(0.35 + this.phase * 0.1)) {
      // glances back at you over his shoulder without turning his body
      yield* this.wait(0.3);
      T.lookAt(this.camPos, 4);
      yield* this.wait(rand(1.5, 2.6));
      T.lookAt(null, 4);
      yield* this.wait(0.5);
    }
    // dusty hands
    if (chance(0.4)) yield* this.actClap(2 + ((Math.random() * 2) | 0), false);
  }

  *actErase() {
    const T = this.teacher, B = this.world.board, W = this.world;
    T.faceTo(Math.PI, 4);
    T.lookAt(null, 4);
    yield* this.glide(-1.9, -6.4, 2.4);
    B.erase(3.2);
    T.setPose('erase', this.writePose);
    const snd = this.audio.play('erase', { loop: true, pos: T.headWorld(new THREE.Vector3()), vol: 0.7, ref: 2 });
    try {
      while (B.busy) {
        B.toWorld(B.hand.x, B.hand.y, W.boardAnchor, this.writePose.point);
        T.lookAt(this.writePose.point, 5);
        const bx = this.writePose.point.x - 0.3;
        if (Math.abs(bx - T.pos.x) > 0.15) T.moveTo(bx, -6.4, 2.2);
        if (snd) snd.setPos(this.writePose.point);
        yield;
      }
    } finally { if (snd) snd.stop(0.15); }
    this.boardRow = 0;
    T.setPose('rest');
    yield* this.actClap(3 + ((Math.random() * 2) | 0), false);
  }

  *actClap(n, faceClass) {
    const T = this.teacher;
    if (faceClass) T.facePoint(this.camPos, 4);
    T.lookAt(this.camPos, 10);
    for (const f of this.friends) if (!f.call && !(this.talk && this.talk.friend === f)) f.lookTarget = T.headWorld(new THREE.Vector3());
    yield* this.wait(0.5);
    const big = this.phase >= 2;
    T.startClap(n, big ? rand(0.75, 0.95) : rand(0.55, 0.7), (mid, left) => {
      const loud = big && left === 0;
      this.audio.play(loud ? 'clap_big' : pick(['clap_1', 'clap_2', 'clap_3']), { pos: mid, vol: loud ? 1.3 : 1.1, reverb: 0.6, ref: 2.6, rate: rand(0.92, 1.05) });
      this.world.chalkBurst(mid, loud ? 70 : 35);
      if (loud) this.shake = Math.max(this.shake, 0.35);
    });
    try { while (T.clap) yield; }
    finally { for (const f of this.friends) if (!f.call && !(this.talk && this.talk.friend === f)) f.lookTarget = null; }
    yield* this.wait(0.4);
  }

  *actStare(dur) {
    const T = this.teacher;
    T.facePoint(this.camPos, 3);
    T.lookAt(this.camPos, 14);
    if (this.phase >= 2 && chance(0.5)) T.rollTarget = pick([-0.35, 0.35]);
    let t = 0, creep = 0;
    while (t < dur) {
      t += this.dt;
      T.facePoint(this.camPos, 3);
      // weeping-angel creep: he only moves while you're not looking
      if (this.phase >= 2 && this.anger >= 40 && !this.lookingAtTeacher && T.pos.z < -3.6) {
        creep += this.dt;
        if (creep > 1.1) {
          creep = 0;
          v1.subVectors(this.camPos, T.pos); v1.y = 0; v1.normalize();
          const nz = Math.min(-3.4, T.pos.z + v1.z * 0.8);
          T.place(clamp(T.pos.x + v1.x * 0.8, -2.5, 2.5), nz, Math.atan2(v1.x, v1.z));
          T.lookAt(this.camPos, 50);
        }
      }
      yield;
    }
    T.rollTarget = 0;
  }

  *actLecture() {
    const T = this.teacher;
    T.facePoint(this.camPos, 4);
    T.lookAt(this.camPos, 6);
    yield* this.wait(0.5);
    T.setPose('gesture');
    const id = this.lectureBags[this.phase].next();
    yield* this.say(id, 0.6);
    T.setPose('rest');
    if (id === 't_answer' || id === 't_mito' || id === 't_forgot') yield* this.actStare(rand(2, 3.5)); // he doesn't know
  }

  *actPonder() {
    const T = this.teacher, B = this.world.board, W = this.world;
    T.faceTo(Math.PI, 4);
    T.lookAt(null, 3);
    yield* this.glide(rand(-1.6, 1.6), -6.1, 2.2);
    T.faceTo(Math.PI, 5);
    const row = Math.max(0, Math.min(3, this.boardRow - 1));
    B.toWorld(rand(150, 700), B.rows[row] - 20, W.boardAnchor, v1);
    T.lookAt(v1.clone(), 2.5);
    T.rollTarget = pick([-1, 1]) * rand(0.2, 0.45);
    if (chance(0.5)) { yield* this.wait(1); this.teacherSay('t_hmm', 1.1); }
    // sometimes his head turns all the way round to look at you
    if (this.phase >= 1 && chance(0.25 + this.phase * 0.1)) { yield* this.wait(rand(1, 2)); yield* this.headTurn(); }
    else yield* this.wait(rand(3, 6));
    T.rollTarget = 0;
  }

  *headTurn() {
    const T = this.teacher;
    T.lookAt(null, 3);
    yield* this.wait(0.5);
    this.audio.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 1.1, ref: 2.2 });
    T.lookAt(this.camPos, 1.5);
    yield* this.wait(2.2);
    T.rollTarget = 0.3;
    yield* this.wait(rand(2.4, 3.6));
    T.rollTarget = 0;
    T.lookAt(null, 2.2);
    yield* this.wait(1.2);
  }

  *actPace() {
    const T = this.teacher;
    const x = rand(-2.6, 2.6), z = rand(-5.7, -4.4);
    const fast = chance(0.45 + this.phase * 0.15);
    T.lookAt(this.camPos, 14);
    if (fast) this.audio.play('whoosh', { pos: T.headWorld(new THREE.Vector3()), vol: 0.6, ref: 2 });
    T.moveTo(x, z, fast ? 5.2 : 1.7);
    while (T.moving) { T.facePoint(this.camPos, 8); yield; }
    yield* this.wait(rand(0.8, 2.2));
  }

  // ------------------------------------------------------------- reactions
  *reactWarn(loud) {
    const T = this.teacher;
    T.lookAt(this.camPos, 18);
    if (loud) this.audio.play('sub_hit', { vol: 0.8 });
    yield* this.wait(0.3);
    T.facePoint(this.camPos, 5);
    yield* this.wait(0.5);
    yield* this.say(pick(WARN));
    yield* this.actStare(rand(1.5, 2.5));
  }

  *reactPhone() {
    const T = this.teacher;
    T.lookAt(this.camPos, 18);
    T.facePoint(this.camPos, 6);
    yield* this.wait(0.6);
    T.setPose('point', { at: this.camPos });
    yield* this.say('t_phone');
    T.setPose('rest');
    yield* this.actStare(2);
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
    const T = this.teacher;
    T.lookAt(this.camPos, 18);
    T.facePoint(this.camPos, 6);
    if (this.talk) {
      const f = this.talk.friend;
      this.friendSay(f, f.kind === 'sam' ? 's_warn' : 'n_warn', 0.4);
    }
    this.scareFriends(true);
    try {
      this.audio.play('whoosh', { pos: T.headWorld(new THREE.Vector3()), vol: 0.7 });
      yield* this.glide(clamp(this.camPos.x * 0.5, -1, 1), -3.9, 3.4);
      yield* this.say(pick(['t_eyes', 't_see', 't_still', 't_attention']));
      yield* this.actStare(2.6);
    } finally { this.scareFriends(false); }
    T.faceTo(Math.PI, 3);
    yield* this.glide(rand(-1.5, 1.5), -5.5, 2.2);
  }

  deskCorners() {
    const d = this.world.playerDesk;
    return { L: new THREE.Vector3(d.x + 0.27, d.top + 0.02, d.z - 0.16), R: new THREE.Vector3(d.x - 0.27, d.top + 0.02, d.z - 0.16) };
  }

  *reactInspect() {
    const T = this.teacher;
    T.lookAt(this.camPos, 12);
    T.facePoint(this.camPos, 6);
    this.scareFriends(true);
    let br = null;
    try {
      yield* this.glide(0, -3.6, 3.2);
      // spider stance: legs splay, torso folds flat, his face ends up level with yours
      const eye = PLAYER_EYE, spread = 0.75;
      const hipH = 1.02 * Math.cos(spread);
      const lean = Math.acos(clamp((eye.y + 0.08 - 0.43 - hipH) / 0.73, -1, 1));
      const z = eye.z - 0.72 - 0.73 * Math.sin(lean) - 0.12;
      yield* this.glide(0, z, 1.3);
      T.faceTo(0, 5);
      T.spreadTarget = spread;
      T.leanTarget = lean;
      T.setPose('desk', this.deskCorners());
      T.faceGlow = 0.22; T.eyeGlow = 0.9;
      br = this.audio.play('breath', { loop: true, pos: T.headWorld(new THREE.Vector3()), vol: 1.0, ref: 0.6, reverb: 0.05 });
      this.audio.fadeBus('amb', 0.25, 1);
      yield* this.wait(5.2);
      yield* this.say(this.friends.some((f) => !f.gone) ? 't_last' : 't_still', 0.8);
    } finally {
      if (br) br.stop(0.4);
      this.audio.fadeBus('amb', 1, 1);
      T.leanTarget = 0; T.spreadTarget = 0; T.setPose('rest'); T.faceGlow = 0.08; T.eyeGlow = 0.12;
      this.scareFriends(false);
    }
    T.faceTo(Math.PI, 3);
    yield* this.glide(rand(-1.2, 1.2), -5.5, 2.0);
  }

  // ------------------------------------------------------------- punishment
  *punishFriend(f) {
    const T = this.teacher, W = this.world, A = this.audio;
    this.cutscene = true;
    try {
      if (this.teacherVoice) this.teacherVoice.stop(0.05);
      A.fadeBus('amb', 0, 0.1);
      A.play('lights_off', { vol: 1.1 });
      W.setMaster(0); this.blackoutTarget = 0.96;
      yield* this.wait(1.1);
      A.say('tw_shh', { pos: this.camPos.clone().add(v1.set(f.root.position.x < 0 ? -0.4 : 0.4, 0.1, 0.2)), ref: 0.4, vol: 1.3 });
      yield* this.wait(1.2);
      // he is behind your friend, hands on their shoulders
      const fp = f.root.position;
      T.place(fp.x, fp.z + 0.5, Math.PI);
      T.leanTarget = 0.4;
      const L = new THREE.Vector3(), R = new THREE.Vector3();
      f.shoulderPoints(L, R);
      T.setPose('shoulders', { L, R });
      T.lookAt(this.camPos, 60);
      T.eyeGlow = 1.4; T.faceGlow = 0.25;
      f.forcePitch = 0.2; f.lookTarget = this.camPos; f.tremble = 1.5;
      yield* this.wait(0.15);
      A.play('stinger_1', { vol: 1.2 });
      W.flash(1.3); this.blackoutTarget = 0; this.blackout = 0;
      this.scareFear = 1; this.shake = 0.5;
      yield* this.wait(0.35);
      this.blackoutTarget = 0.97; this.blackout = 0.97;
      yield* this.wait(0.7);
      A.play('chair_scrape', { pos: fp.clone(), vol: 1.2 });
      A.play('scream', { pos: f.headWorld(new THREE.Vector3()), vol: 0.6, rate: 0.72, lowpass: 1500, reverb: 0.7 });
      f.setGone(true); f.tremble = 0; f.forcePitch = null; f.lookTarget = null;
      if (f.speaking) f.speaking.stop(0.05);
      W.dynamicChairs[f.kind].pushOut();
      this.stats.lost.push(f.name);
      if (this.talk && this.talk.friend === f) this.endTalk();
      yield* this.wait(1.7);
      T.place(0.2, -5.4, 0);
      T.leanTarget = 0; T.setPose('rest'); T.lookAt(this.camPos, 60);
      T.eyeGlow = 0.12; T.faceGlow = 0.08;
      W.setMaster(1); for (const b of W.lights.banks) b.flicker = 1.2;
      this.blackoutTarget = 0;
      A.play('zap', { vol: 0.8 });
      A.fadeBus('amb', 1, 2);
      yield* this.wait(0.9);
      this.ui.toast(`${f.name.toUpperCase()} IS GONE.`, 3.5);
      yield* this.say(pick(['t_where', 't_last']));
    } finally {
      this.cutscene = false;
      this.anger = 30;
      this.flags = { r35: true, r60: false, r85: false };
      this.blackoutTarget = 0;
      W.setMaster(1);
      A.fadeBus('amb', 1, 1);
      T.eyeGlow = 0.12; T.faceGlow = 0.08; T.leanTarget = 0;
    }
    yield* this.actStare(2);
  }

  *jumpscare(kind) {
    const T = this.teacher, W = this.world, A = this.audio;
    this.cutscene = true;
    this.ending = true;
    this.input.enable(false);
    if (this.teacherVoice) this.teacherVoice.stop(0.05);
    if (this.playerWhisper) { this.playerWhisper.stop(0.05); this.playerWhisper = null; }
    A.fadeBus('amb', 0, 0.05);
    A.play('lights_off', { vol: 1.1 });
    W.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
    this.scareFear = 0.8;
    yield* this.wait(rand(1.6, 2.6));
    // he is right in front of whatever you're looking at
    const dir = new THREE.Vector3(this.camFwd.x, 0, this.camFwd.z).normalize();
    const start = 1.3, end = 0.46;
    const yawTo = Math.atan2(-dir.x, -dir.z);
    T.place(this.camPos.x + dir.x * start, this.camPos.z + dir.z * start, yawTo);
    T.root.position.y = this.camPos.y - 2.08;
    T.lookAt(this.camPos, 80);
    T.jawTarget = 0.8; T.jitter = 0.55; T.eyeGlow = 3; T.faceGlow = 0.85;
    T.setPose('grab');
    W.setMaster(0.15);
    this.redFlash = 1;
    this.underLight = 1;
    this.blackoutTarget = 0; this.blackout = 0;
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
    return [
      { id: 'lightning', min: 0, w: 2, fx: () => this.fxLightning(p >= 2) },
      { id: 'flicker', min: 0, w: 2, fx: () => this.fxFlicker() },
      { id: 'book', min: 1, w: 1.5, once: true, fx: () => this.fxBookDrop() },
      { id: 'door', min: 1, w: 1.5, cool: 90, fx: () => this.fxDoorFace() },
      { id: 'headturn', min: 1, w: backTurned ? 3 : 0, brain: () => this.headTurn() },
      { id: 'students', min: 2, w: 2, cool: 60, fx: () => this.fxStudentsStare() },
      { id: 'boardmsg', min: 2, w: 2, cool: 50, fx: () => this.fxBoardMessage() },
      { id: 'behind', min: 2, w: 3, cool: 100, brain: () => this.scareBehind() },
      { id: 'flickapproach', min: 2, w: 2, cool: 60, brain: () => this.scareFlickerApproach() },
      { id: 'neck', min: 2, w: 1.5, cool: 70, brain: () => this.scareNeck() },
      { id: 'whisper', min: 2, w: 1.5, cool: 40, fx: () => this.fxWhisperEar() },
      { id: 'clapstorm', min: 3, w: 2, cool: 60, brain: () => this.scareClapStorm() },
      { id: 'reposition', min: 3, w: 2, cool: 50, brain: () => this.scareReposition() },
    ].filter((s) => s.w > 0 && p >= s.min && !(s.once && this.scareDone[s.id]) && !(s.cool && this.t - (this.lastScare[s.id] ?? -1e9) < s.cool));
  }

  updateDirector(dt) {
    // the fake bell is scripted near the end
    if (!this.fakeBellDone && this.t > LESSON - 48 && !this.eventLock && this.anger < 60) {
      this.fakeBellDone = true;
      this.interrupt(this.fakeBell());
      return;
    }
    this.nextScare -= dt;
    if (this.nextScare > 0 || this.eventLock || this.anger >= 30) return;
    const list = this.scareList();
    const g = SCARE_GAP[this.phase];
    this.nextScare = rand(g[0], g[1]);
    if (!list.length) return;
    const s = wpick(list.map((x) => [x.w, x]));
    this.scareDone[s.id] = true;
    this.lastScare[s.id] = this.t;
    if (s.fx) this.fx.push(s.fx());
    else this.interrupt(s.brain());
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
    let t = 0, seen = false;
    while (t < 14) {
      t += this.dt;
      if (this.lookingAt(this.doorFace.position, 0.93)) { seen = true; break; }
      yield;
    }
    if (seen) {
      this.audio.play('stinger_1', { vol: 0.55, pos: this.doorFace.position.clone(), ref: 3 });
      this.scareFear = Math.max(this.scareFear, 0.7);
      yield* this.wait(rand(0.8, 1.4));
    }
    this.doorFace.visible = false;
  }

  *fxStudentsStare() {
    yield* this.until(() => !this.lookingBack(), 30);
    for (const s of this.students) { s.lookTarget = this.camPos; s.speed = 40; }
    let t = 0, seen = false;
    while (t < 25) {
      t += this.dt;
      if (this.lookingBack()) {
        if (!seen) { seen = true; this.audio.play('stinger_2', { vol: 0.8 }); this.scareFear = Math.max(this.scareFear, 0.8); }
      } else if (seen) break;
      yield;
    }
    yield* this.until(() => !this.lookingBack(), 30);
    for (const s of this.students) { s.lookTarget = null; s.speed = 4; }
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
    this.audio.say('tw_shh', { pos: v1.clone(), ref: 0.3, vol: 1.4, reverb: 0.02 });
    this.scareFear = Math.max(this.scareFear, 0.6);
    yield* this.wait(2);
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
      T.place(rand(-1, 1), 4.5, Math.PI);
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
        this.teacherSayAt('tw_behind', v1.clone(), 1.5, 0.35);
        yield* this.wait(2.3);
        W.setMaster(0); this.blackoutTarget = 1; this.blackout = 1;
        yield* this.wait(0.25);
        T.place(this.camPos.x, -2.7, 0); T.lookAt(this.camPos, 60);
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

  teacherSayAt(id, pos, vol, ref) {
    const meta = this.audio.voices[id];
    const h = this.audio.say(id, { pos, ref, vol, reverb: 0.05 });
    if (meta) this.ui.subtitle('', `<i>${meta.text}</i>`, 'teacher', (h ? h.duration : 2) + 0.6);
    return h;
  }

  *scareFlickerApproach() {
    const T = this.teacher, W = this.world;
    this.eventLock = true;
    try {
      T.facePoint(this.camPos, 10); T.lookAt(this.camPos, 30);
      const start = T.pos.clone();
      const end = new THREE.Vector3(clamp(this.camPos.x * 0.4, -1, 1), 0, -3.0);
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        W.setMaster(0); this.audio.play('zap', { vol: 0.7 });
        yield* this.wait(rand(0.12, 0.25));
        v1.lerpVectors(start, end, i / steps);
        T.place(v1.x, v1.z, Math.atan2(this.camPos.x - v1.x, this.camPos.z - v1.z));
        T.lookAt(this.camPos, 60);
        W.setMaster(rand(0.45, 1));
        yield* this.wait(rand(0.25, 0.5));
      }
      W.setMaster(1);
      this.audio.play('sub_hit', { vol: 1 });
      this.scareFear = 0.9;
      yield* this.say('t_see');
      yield* this.actStare(1.5);
    } finally { W.setMaster(1); this.eventLock = false; }
    this.teacher.faceTo(Math.PI, 3);
    yield* this.glide(rand(-1.2, 1.2), -5.5, 2.2);
  }

  *scareNeck() {
    const T = this.teacher;
    T.facePoint(this.camPos, 5); T.lookAt(this.camPos, 10);
    yield* this.wait(0.8);
    try {
      T.stretchTarget = 0.6; T.rollTarget = 0.45;
      this.audio.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 1.1, rate: 0.7, ref: 2.2 });
      yield* this.wait(4.2);
      this.audio.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 1.2, rate: 1.25, ref: 2.2 });
    } finally { T.stretchTarget = 0; T.rollTarget = 0; }
    yield* this.wait(1.2);
  }

  *scareClapStorm() {
    const T = this.teacher;
    T.facePoint(this.camPos, 6); T.lookAt(this.camPos, 16);
    yield* this.wait(0.5);
    T.startClap(11, 0.75, (mid, left) => {
      const loud = left < 3;
      this.audio.play(loud ? 'clap_big' : pick(['clap_1', 'clap_2', 'clap_3']), { pos: mid, vol: loud ? 1.3 : 1.15, reverb: 0.7, ref: 2.6 });
      this.world.chalkBurst(mid, 45);
      if (T.clap) T.clap.interval = Math.max(0.28, T.clap.interval * 0.84);
      this.shake = Math.max(this.shake, loud ? 0.4 : 0.15);
    });
    while (T.clap) yield;
    this.audio.fadeBus('amb', 0, 0.1);
    yield* this.wait(2.2);
    this.audio.fadeBus('amb', 1, 2);
    yield* this.say('t_quiet');
  }

  *scareReposition() {
    const T = this.teacher, W = this.world, A = this.audio;
    this.eventLock = true;
    let br = null;
    try {
      A.play('lights_off', { vol: 1 });
      W.setMaster(0); this.blackoutTarget = 0.96;
      v1.set(pick([-0.5, 0.5]), 0.1, 0.3).applyQuaternion(this.camera.quaternion).add(this.camPos);
      br = A.play('breath', { pos: v1.clone(), vol: 0.9, ref: 0.5, reverb: 0.05 });
      yield* this.wait(rand(1.6, 2.4));
      const s = pick([[-4.3, -1.2], [4.3, -1.0], [-0.9, -3.0], [2.3, 0.45], [-2.3, 1.2], [0.8, 4.6]]);
      T.place(s[0], s[1], Math.atan2(this.camPos.x - s[0], this.camPos.z - s[1]));
      T.lookAt(this.camPos, 60);
      T.eyeGlow = 0.8;
      W.setMaster(0.65); this.blackoutTarget = 0;
      A.play('sub_hit', { vol: 0.9 });
      this.scareFear = 0.9;
      yield* this.wait(2.8);
      W.setMaster(0); this.blackoutTarget = 0.95;
      yield* this.wait(0.35);
      T.place(rand(-1, 1), -5.5, 0);
    } finally {
      if (br) br.stop(0.2);
      W.setMaster(1); this.blackoutTarget = 0; T.eyeGlow = 0.12; this.eventLock = false;
    }
    yield* this.actStare(1.2);
  }

  *phoneScare() {
    const T = this.teacher, W = this.world, ph = this.phone;
    this.eventLock = true;
    try {
      ph.mode = 'face';
      this.audio.play('glitch', { vol: 0.9 });
      this.glitch = 0.5;
      W.setMaster(0.12);
      T.place(this.camPos.x, -2.8, 0);
      T.lookAt(this.camPos, 60);
      T.leanTarget = 0.45; T.eyeGlow = 1.2; T.faceGlow = 0.2;
      yield* this.until(() => !ph.up || !this.lookingAt(T.headWorld(v2), -2), 6);
      yield* this.until(() => !ph.up, 5);
      W.setMaster(1);
      this.audio.play('stinger_1', { vol: 1.1 });
      this.shake = 0.5; this.scareFear = 1;
      this.anger = Math.min(80, this.anger + 10);
      yield* this.wait(1.8);
      W.setMaster(0); this.blackoutTarget = 0.95;
      yield* this.wait(0.35);
      T.place(rand(-1, 1), -5.5, 0);
    } finally {
      ph.mode = 'game'; W.setMaster(1); this.blackoutTarget = 0;
      T.leanTarget = 0; T.eyeGlow = 0.12; T.faceGlow = 0.08; this.eventLock = false;
    }
  }

  *fakeBell() {
    const T = this.teacher, W = this.world, A = this.audio;
    this.eventLock = true;
    try {
      A.play('bell', { pos: new THREE.Vector3(3.5, 2.8, -6.8), vol: 1.1, ref: 3, reverb: 0.4 });
      yield* this.wait(1.4);
      const sam = this.friends.find((f) => !f.gone);
      if (sam) this.ui.subtitle(sam.name, 'Finally&mdash; let\'s get out of h&mdash;', '', 2);
      yield* this.wait(1.4);
      A.play('lights_off', { vol: 1.1 });
      W.setMaster(0); this.blackoutTarget = 0.97;
      yield* this.wait(1.3);
      T.place(0, -4.2, 0);
      T.lookAt(this.camPos, 60);
      W.setMaster(0.8); this.blackoutTarget = 0;
      A.play('sub_hit', { vol: 1 });
      this.scareFear = 0.9;
      yield* this.say('t_notover');
      this.clockOffset -= 3;
      yield* this.actStare(2);
    } finally { W.setMaster(1); this.blackoutTarget = 0; this.eventLock = false; }
  }

  // ------------------------------------------------------------- ending
  beginEnding() {
    this.ending = true;
    this.interrupt(this.endingSeq());
  }

  *endingSeq() {
    const T = this.teacher, W = this.world, A = this.audio;
    this.cutscene = true;
    this.ui.clearTransient();
    A.fadeBus('amb', 0.15, 2);
    T.facePoint(this.camPos, 3); T.lookAt(this.camPos, 6);
    yield* this.glide(0, -5.0, 2);
    T.facePoint(this.camPos, 4);
    yield* this.wait(1.2);
    A.play('bell', { pos: new THREE.Vector3(3.5, 2.8, -6.8), vol: 1.2, ref: 3, reverb: 0.4 });
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
    T.faceTo(Math.PI, 2); T.lookAt(null, 2);
    yield* this.wait(1.2);
    W.board.clear();
    this.boardRow = 1;
    yield* this.actWrite('see you tomorrow');
    T.lookAt(this.camPos, 1.5);
    yield* this.wait(2.2);
    this.blackoutTarget = 1;
    A.fadeBus('amb', 0, 2);
    yield* this.wait(2.4);
    this.finish('survived');
  }

  rank() {
    const m = this.mischief;
    if (m < PET_LIMIT) return "Teacher's Pet";
    if (m < 400) return 'Quiet Troublemaker';
    if (m < 800) return 'Class Clown';
    return 'Legend of Room 13';
  }

  finish(kind) {
    this.state = 'end';
    this.input.enable(false);
    this.audio.fadeBus('amb', 0, 0.5);
    this.audio.stopAll();
    this.ui.show('hud', false);
    this.ui.clearTransient();
    const alive = this.friends.filter((f) => !f.gone).map((f) => f.name);
    const mins = Math.floor(this.t / 60), secs = Math.floor(this.t % 60);
    const stats = [
      `Mischief: <b>${Math.floor(this.mischief)}</b> &nbsp;·&nbsp; Rank: <b>${this.rank()}</b>`,
      `Friends who made it: <b>${alive.length}/2</b>${this.stats.lost.length ? ' (taken: ' + this.stats.lost.join(', ') + ')' : ''}`,
      `Times he caught you: <b>${this.stats.caught}</b> &nbsp;·&nbsp; Survived: <b>${mins}:${String(secs).padStart(2, '0')}</b>`,
    ].join('<br>');
    let title, text;
    if (kind === 'caught') { title = 'DETENTION'; text = 'He caught you talking one time too many.<br>Nobody leaves his class.'; }
    else if (kind === 'pet') { title = 'AFTER CLASS'; text = 'You were too quiet. He keeps the quiet ones.<br><i>Next time, don\'t be such a good student.</i>'; }
    else {
      title = 'CLASS DISMISSED';
      text = alive.length === 2 ? 'You and your friends made it out of Room 13.<br><i>See you tomorrow.</i>'
        : alive.length === 1 ? `You made it out. ${this.stats.lost[0]} didn't.<br><i>See you tomorrow.</i>`
          : 'You made it out&hellip; alone.<br><i>See you tomorrow.</i>';
    }
    this.ui.end(title, text, stats);
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
    ui.setWatching(this.watching);
    ui.setAnger(this.anger);
    const total = 15 + Math.min(45, (this.t / LESSON) * 45) + this.clockOffset;
    const mm = Math.floor(total), ss = Math.floor((total - mm) * 60);
    const h = 2 + Math.floor(mm / 60);
    ui.setClock(`${h}:${String(mm % 60).padStart(2, '0')} PM`);
    this.world.clock.set(h, mm % 60, ss);
    const sec = Math.floor(this.t);
    if (sec !== this.lastTick) { this.lastTick = sec; this.audio.tick(this.world.clock.pos); }
  }

  render(dt) {
    const P = this.post.uniforms, T = this.teacher, W = this.world;
    const playing = this.state === 'playing';
    let fear = 0;
    if (playing) {
      const prox = clamp((3.2 - (this.teacherDist ?? 9)) / 2.6, 0, 1);
      this.scareFear = Math.max(0, this.scareFear - dt * 0.35);
      fear = Math.max(this.anger / 100, prox * 0.9, this.scareFear);
    }
    this.blackout = damp(this.blackout, this.blackoutTarget, 25, dt);
    this.glitch = Math.max(0, this.glitch - dt * 0.8);
    this.redFlash = Math.max(0, this.redFlash - dt * 0.6);
    P.time.value += dt;
    P.vig.value = 0.7 + fear * 0.3;
    P.aberr.value = 0.35 + fear * 1.3 + this.glitch * 4;
    P.grain.value = 0.055 + fear * 0.05;
    P.warp.value = Math.max(0, fear - 0.55) * 1.6 + this.glitch;
    P.glitch.value = this.glitch;
    P.red.value = this.redFlash * 0.45 + (this.phase >= 3 && playing ? 0.06 : 0);
    P.blackout.value = this.blackout;
    P.exposure.value = this.phase >= 3 ? 0.9 : 1.0;
    this.scene.fog.density = 0.085 + this.phase * 0.008;
    if (this.state !== 'paused') W.update(dt, { emergency: playing && this.phase >= 3 ? 1 : 0 });
    if (this.underLight > 0) {
      // red light from below the face for the jumpscare
      W.lights.red.position.copy(this.camPos).addScaledVector(this.camFwd, 0.25).add(v1.set(0, -0.35, 0));
      W.lights.red.intensity = 3.5 * this.underLight;
    } else W.lights.red.position.set(4.6, 2.3, -5.0);
    if (playing || this.state === 'title') {
      this.audio.updateListener(this.camera);
      this.audio.update(dt, this.camPos, {
        tension: clamp(this.anger / 100 + this.phase * 0.1 + (this.teacherDist < 2 ? 0.3 : 0), 0, 1),
        fear: playing ? fear : 0,
        whispers: playing ? (this.phase >= 3 ? 0.55 : this.phase >= 2 ? 0.15 : 0) : 0,
        humLevel: W.lights.banks[0].level * W.master,
      });
    }
    this.ui.update(dt);
    this.post.render(this.scene, this.camera);
  }
}
