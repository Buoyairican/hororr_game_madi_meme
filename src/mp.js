// Multiplayer: friends join your class.
// The host's browser runs the whole game (teacher brain, story, scares). It streams what
// happens to the friends: Madi's pose, the students, the board, the lights, every sound
// and subtitle. Friends sit at their own desks, look around with their own camera, and
// send back what they do (whisper, phone, repeat him, ask). He hears them too.
import * as THREE from 'three';
import { Net } from './net.js';
import { Classmate } from './students.js';
import { instantiate } from './models.js';
import { SEATS } from './game.js';
import { PLAYER_EYE } from './world.js';
import { clockLabel } from './data.js';
import { clamp, dampAngle, lerp } from './util.js';

const AVATAR_MODELS = ['kid_a', 'kid_c', 'kid_f', 'kid_a'];
const SNAP_DT = 1 / 15;      // snapshots per second
const TIMEOUT = 20;          // seconds of silence before a connection counts as gone
const INPUT_DT = 1 / 20;     // friend input per second
const BONES = ['root', 'spine', 'chest', 'neck', 'uarmL', 'farmL', 'handL', 'uarmR', 'farmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const UI_EVENTS = new Set(['subtitle', 'hint', 'toast', 'card', 'showNote', 'clearTransient', 'setObjectives']);
const BOARD_EVENTS = new Set(['write', 'writeInstant', 'scrawl', 'erase', 'clear', 'stopJob']);
const PROJ_EVENTS = new Set(['setOn', 'search', 'history', 'news', 'glitch', 'noSignal', 'reset']);

const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const r4 = (x) => Math.round(x * 10000) / 10000;
const va = (v) => [r3(v.x), r3(v.y), r3(v.z)];
const V = (a, out = new THREE.Vector3()) => out.set(a[0], a[1], a[2]);
const _v = new THREE.Vector3(), _v2 = new THREE.Vector3(), _q = new THREE.Quaternion();
export const cleanName = (s) => (s || '').replace(/[<>&"]/g, '').trim().slice(0, 12);

let CURRENT = null;          // the live session (proxies are installed once per page)
let proxied = false;

/** a friend sitting at their desk: a student body that looks where they look, with a name tag */
class Avatar {
  constructor(scene, world, model, seat, name) {
    const s = SEATS[seat];
    this.scene = scene;
    this.c = new Classmate('player', name, model, world.seats.find((x) => x.row === s.row && x.col === s.col));
    this.c.speed = 9;
    scene.add(this.c.root);
    this.look = new THREE.Vector3();
    // name tag
    const cv = document.createElement('canvas');
    cv.width = 320; cv.height = 80;
    const x = cv.getContext('2d');
    x.fillStyle = 'rgba(8,10,9,0.66)';
    x.beginPath(); x.roundRect ? x.roundRect(4, 6, 312, 68, 18) : x.rect(4, 6, 312, 68); x.fill();
    x.fillStyle = '#f3ecd6'; x.font = '600 44px "Special Elite", monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(name, 160, 42);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    this.tag = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }));
    this.tag.scale.set(0.56, 0.14, 1);
    this.tag.renderOrder = 5;
    scene.add(this.tag);
    // a raised hand (asking a question)
    const skin = new THREE.MeshLambertMaterial({ color: 0xb98b68 });
    this.arm = new THREE.Group();
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.036, 0.42, 6), skin);
    fore.position.y = 0.21;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
    hand.scale.set(0.8, 1.3, 0.5); hand.position.y = 0.46;
    this.arm.add(fore, hand);
    this.arm.visible = false;
    scene.add(this.arm);
    // a glowing phone in their hands
    this.phone = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.13), new THREE.MeshBasicMaterial({ color: 0x9cc8f0, fog: false }));
    this.phone.rotation.x = -1.1;
    this.phone.visible = false;
    scene.add(this.phone);
  }
  headWorld(out = new THREE.Vector3()) { return this.c.headWorld(out); }
  update(dt, st) {
    const c = this.c;
    const head = c.headWorld(_v);
    this.look.set(-Math.sin(st.yaw) * Math.cos(st.pitch), Math.sin(st.pitch), -Math.cos(st.yaw) * Math.cos(st.pitch)).multiplyScalar(3).add(head);
    c.lookTarget = this.look;
    c.forcePitch = st.phone ? 0.55 : null;
    if (st.talk) c.talking = Math.max(c.talking, 0.25);
    c.update(dt);
    this.tag.position.set(head.x, head.y + 0.34, head.z);
    this.arm.visible = !!st.hand;
    if (st.hand) this.arm.position.set(head.x + 0.19, head.y - 0.22, head.z + 0.03);
    this.phone.visible = !!st.phone;
    if (st.phone) this.phone.position.set(head.x, head.y - 0.36, head.z - 0.26);
  }
  dispose() { for (const o of [this.c.root, this.tag, this.arm, this.phone]) this.scene.remove(o); }
}

export class MP {
  /** hooks: { lobby(), lost(msg), started(), ended(), toLobby() } — set by main.js */
  constructor(game, hooks = {}) {
    this.g = game;
    this.hooks = hooks;
    this.net = new Net();
    this.role = null;
    this.code = null;
    this.name = 'Player';
    this.lobby = [];             // [{ id, name, seat }]
    this.myId = null;
    this.q = [];                 // host: events waiting to go out this frame
    this.snapT = 0; this.inT = 0;
    this.handles = new Map();    // guest: host sound id -> local sound handle
    this.avatars = new Map();    // player id -> Avatar
    this.snap = null;            // guest: latest snapshot
    this.choice = null;          // guest: open question picker
    this.ec = -1;                // guest: seconds left to repeat his last line (-1 = can't)
    this.jump = null; this.localTeacher = false; this.pendingEnd = null;
    this.projOn = false; this.projLast = null;
  }

  live() { return CURRENT === this && this.role === 'host' && this.g.state !== 'title' && this.net.conns.size > 0; }
  hook(name, ...a) { const f = this.hooks[name]; if (f) f(...a); }

  // =============================================================== HOST
  async host(name) {
    this.name = cleanName(name) || 'Host';
    this.code = await this.net.host();
    this.role = 'host'; this.myId = 'host';
    CURRENT = this;
    const g = this.g;
    g.mp = this; g.role = 'host';
    g.me.id = 'host'; g.me.name = this.name;
    this.lobby = [{ id: 'host', name: this.name, seat: 0 }];
    installProxies(g);
    this.net.on.msg = (id, m) => this.onHostMsg(id, m);
    this.net.on.leave = (id) => this.dropGuest(id);
    this.pinger = setInterval(() => this.net.broadcast({ t: 'ping' }), 2000); // "still here" even while the menu is open
    this.hook('lobby');
    return this.code;
  }

  onHostMsg(id, m) {
    const g = this.g;
    if (!m || typeof m !== 'object') return;
    if (m.t === 'hello') {
      if (this.lobby.some((x) => x.id === id)) return;
      if (this.lobby.length >= SEATS.length) { this.net.send(id, { t: 'full' }); setTimeout(() => this.net.kick(id), 400); return; }
      const used = new Set(this.lobby.map((x) => x.seat));
      let seat = 1;
      while (used.has(seat)) seat++;
      let name = cleanName(m.name) || 'Friend';
      if (this.lobby.some((x) => x.name === name)) name = (name + ' ' + seat).slice(0, 12);
      this.lobby.push({ id, name, seat });
      const p = g.addPlayer(id, name, seat, false);
      p.heard = performance.now();
      this.makeAvatar(p);
      this.net.send(id, { t: 'welcome', id, seat, name, code: this.code });
      this.sendLobby();
      if (g.state === 'playing') {
        this.sendStart(id, true); // joined in the middle of class
        g.ui.toast(`${name} joined the class`, 2.5);
      }
      this.hook('lobby');
      return;
    }
    const p = g.players.find((x) => x.id === id);
    if (!p) return;
    p.heard = performance.now();
    if (m.t === 'bye') { this.net.kick(id); this.dropGuest(id); return; }
    if (m.t === 'in') {
      p.yaw = clamp(Number(m.y) || 0, -3, 3); p.pitch = clamp(Number(m.p) || 0, -1.2, 1.2);
      p.in.talk = !!m.talk; p.in.phone = !!m.ph;
    } else if (m.t === 'press') { if (m.k === 'echo' || m.k === 'ask') p.in[m.k] = true; }
    else if (m.t === 'pick') g.pickChoice(Number(m.i), p);
  }

  dropGuest(id) {
    const g = this.g;
    const who = this.lobby.find((x) => x.id === id);
    if (!who) return;
    this.lobby = this.lobby.filter((x) => x.id !== id);
    const av = this.avatars.get(id);
    if (av) { av.dispose(); this.avatars.delete(id); }
    g.removePlayer(id);
    if (who && g.state === 'playing') g.ui.toast(`${who.name} left the class`, 2.5);
    this.sendLobby();
    this.hook('lobby');
  }

  sendLobby() { this.net.broadcast({ t: 'lobby', players: this.lobby, code: this.code }); }

  async makeAvatar(p) {
    const model = await instantiate(AVATAR_MODELS[p.seat] || 'kid_a');
    if (!this.g.players.includes(p) && p.id !== 'host') return; // left while loading
    const av = new Avatar(this.g.scene, this.g.world, model, p.seat, p.name);
    const old = this.avatars.get(p.id);
    if (old) old.dispose();
    this.avatars.set(p.id, av);
    p.avatar = av;
  }

  /** the host started (or restarted) a period */
  onStart() {
    if (this.role !== 'host') return;
    for (const p of this.g.players) if (!p.local) p.heard = performance.now();
    this.q = [];
    this.snapT = 0;
    for (const id of this.net.conns.keys()) this.sendStart(id, false);
  }
  sendStart(id, late) {
    const g = this.g;
    const msg = { t: 'start', mode: g.mode, ch: g.chapter, players: this.lobby, late };
    if (late) {
      const B = g.world.board;
      try {
        const cv = document.createElement('canvas');
        cv.width = 640; cv.height = Math.round(640 * B.H / B.W);
        cv.getContext('2d').drawImage(B.canvas, 0, 0, cv.width, cv.height);
        msg.board = cv.toDataURL('image/jpeg', 0.7);
      } catch (e) { /* no picture then */ }
      msg.projOn = this.projOn; msg.proj = this.projLast;
      msg.objs = g.objectives.map((o) => ({ text: o.text, done: o.done }));
    }
    this.flush();
    this.net.send(id, msg);
  }

  /** every frame on the host, after the game has updated */
  /** friends whose browser went quiet (closed tab, lost wifi) leave the class */
  checkSilent() {
    const now = performance.now();
    for (const p of [...this.g.players]) {
      if (p.local || !p.heard) continue;
      if (now - p.heard > TIMEOUT * 1000) { this.net.kick(p.id); this.dropGuest(p.id); }
    }
  }

  hostTick(dt) {
    const g = this.g;
    this.checkSilent();
    for (const p of g.players) if (p.avatar) p.avatar.update(dt, { yaw: p.yaw, pitch: p.pitch, talk: !!p.talk, phone: p.phoneUp, hand: p.handT > 0 });
    if (!this.live()) { this.q = []; return; }
    this.snapT -= dt;
    if (this.snapT <= 0) { this.snapT = SNAP_DT; this.q.push(this.makeSnap()); }
    this.flush();
  }
  flush() {
    if (this.q.length && this.net.conns.size) this.net.broadcast({ t: 'b', e: this.q });
    this.q = [];
  }
  broadcastNow(msg) { if (this.role !== 'host') return; this.flush(); this.net.broadcast(msg); }

  makeSnap() {
    const g = this.g, T = g.teacher, W = g.world, hp = T.headPivot, gl = T.glasses;
    const b = [];
    for (const n of BONES) { const q = T.bones[n].quaternion; b.push(r4(q.x), r4(q.y), r4(q.z), r4(q.w)); }
    const gp = gl.parent === T.head ? 'h' : gl.parent === T.bones.handR ? 'r' : 's';
    const tt = [r3(T.pos.x), r3(T.root.position.y), r3(T.pos.z), r4(T.root.rotation.y), T.root.visible ? 1 : 0, r3(T.bones.root.position.y),
      r4(hp.rotation.x), r4(hp.rotation.y), r4(hp.rotation.z), r3(hp.position.y), r3(T.jaw), r2(T.eyeGlow), r2(T.faceGlow), r2(T.lensGlow),
      gp, ...va(gl.position), r4(gl.quaternion.x), r4(gl.quaternion.y), r4(gl.quaternion.z), r4(gl.quaternion.w)];
    const K = g.allKids().map((c) => [c.lookTarget ? va(c.lookTarget) : 0, c.forcePitch == null ? null : r2(c.forcePitch), r2(c.tremble), r2(Math.max(0, c.talking)),
      c.hollow ? 1 : 0, c.gone ? 1 : 0, r2(c.leanRollTarget), r2(c.speed)]);
    const bk = W.fallingBook;
    const w = [r2(W.master), r2(W.gloomTarget), r2(W.gloom), W.showSilhouette ? 1 : 0, W.laptop.openTarget, W.laptop.glowTarget, W.door.openTarget, g.doorFace.visible ? 1 : 0,
      W.lights.banks.map((x) => [r2(Math.max(0, x.flicker)), x.dead ? 1 : 0]), [...va(bk.position), r3(bk.rotation.x), r3(bk.rotation.y), r3(bk.rotation.z)]];
    const fx = [r2(g.blackoutTarget), r2(g.blackout), r2(g.shake), r2(g.glitch), r2(g.scareFear), r2(g.redFlash)];
    const P = g.players.map((p) => [p.id, r3(p.yaw), r3(p.pitch), p.talk ? 1 : 0, p.phoneUp ? 1 : 0, p.handT > 0 ? 1 : 0]);
    return {
      t: 's', T: tt, b, K, w, fx, P,
      ck: r2(g.clockMin), ph: g.phase, a: Math.round(g.anger), s: g.strikes, ms: g.maxStrikes, m: Math.floor(g.mischief),
      pr: g.present ? 1 : 0, bl: g.blind ? 1 : 0, ty: g.typing ? 1 : 0, cu: g.cutscene ? 1 : 0, em: g.emergency,
      ec: g.canEcho() ? r2(g.echoable.until - g.t) : -1,
    };
  }

  // ---- player-specific messages (called by game.js)
  uiTo(p, fn, args) { this.net.send(p.id, { t: 'ui', f: fn, a: args }); }
  subFor(p, text, cls, dur) {
    const ui = this.g.ui;
    (ui.subtitle.local || ui.subtitle).call(ui, p.local ? 'you' : p.name, text, cls, dur);
    for (const q of this.g.players) if (!q.local) this.net.send(q.id, { t: 'ui', f: 'subtitle', a: [q === p ? 'you' : p.name, text, cls, dur] });
  }
  strikeToast(p, n, max) {
    const ui = this.g.ui;
    (ui.toast.local || ui.toast).call(ui, `${p.local ? 'YOU GOT' : p.name.toUpperCase() + ' GOT'} CAUGHT<br>STRIKE ${n} / ${max}`, 2.8);
    for (const q of this.g.players) if (!q.local) this.net.send(q.id, { t: 'ui', f: 'toast', a: [`${q === p ? 'YOU GOT' : p.name.toUpperCase() + ' GOT'} CAUGHT<br>STRIKE ${n} / ${max}`, 2.8] });
  }
  openChoice(p, title, labels, timeout) { this.net.send(p.id, { t: 'choice', title, labels, timeout }); }
  closeChoice(p) { this.net.send(p.id, { t: 'choiceClose' }); }
  jumpscare(kind) { this.broadcastNow({ t: 'jump', kind }); }
  onEnd(title, text, stats) {
    if (this.role !== 'host') return;
    this.broadcastNow({ t: 'end', title, text, stats, prog: this.g.mode === 'story' ? this.g.lastSaved || 0 : 0 });
  }
  /** host goes back to the lobby (the class stays open) */
  backToLobby() { if (this.role === 'host') this.broadcastNow({ t: 'toLobby' }); }

  // =============================================================== GUEST
  async join(code, name) {
    this.name = cleanName(name) || 'Friend';
    await this.net.join(code);
    this.role = 'guest'; this.code = code;
    CURRENT = this;
    const g = this.g;
    g.mp = this; g.role = 'guest';
    this.net.on.msg = (id, m) => this.onGuestMsg(m);
    this.net.on.lost = () => { if (CURRENT === this) this.hook('lost', 'The host closed the class.'); };
    this.net.send('host', { t: 'hello', name: this.name });
    this.heard = performance.now();
    this.pinger = setInterval(() => this.send({ t: 'ping' }), 2000);
  }

  send(m) { this.net.send('host', m); }

  onGuestMsg(m) {
    if (!m || typeof m !== 'object') return;
    const g = this.g;
    this.heard = performance.now();
    switch (m.t) {
      case 'welcome':
        this.myId = m.id;
        g.me.id = m.id; g.me.name = m.name || this.name; this.name = g.me.name;
        g.seatPlayer(g.me, m.seat);
        break;
      case 'full': if (CURRENT === this) this.hook('lost', 'That class is full (4 players max).'); break;
      case 'lobby': this.lobby = m.players || []; this.syncPlayers(); this.hook('lobby'); break;
      case 'start': this.startGuest(m); break;
      case 'b': for (const e of m.e) this.apply(e); break;
      case 'bye': if (CURRENT === this) this.hook('lost', 'The host closed the class.'); break;
      case 'ping': break;
      case 'toLobby':
        g.state = 'title'; g.input.enable(false); g.audio.stopAll(); g.ui.show('hud', false); g.ui.closeChoices();
        this.choice = null;
        this.hook('toLobby');
        break;
      default: this.apply(m);
    }
  }

  /** keep one avatar per other player, at their seat */
  syncPlayers() {
    const g = this.g;
    for (const x of this.lobby) {
      if (x.id === this.myId) continue;
      let p = g.players.find((q) => q.id === x.id);
      if (!p) { p = g.addPlayer(x.id, x.name, x.seat, false); this.makeAvatar(p); }
    }
    for (const p of [...g.players]) {
      if (p.local || this.lobby.some((x) => x.id === p.id)) continue;
      const av = this.avatars.get(p.id);
      if (av) { av.dispose(); this.avatars.delete(p.id); }
      g.removePlayer(p.id);
    }
  }

  startGuest(m) {
    const g = this.g, A = g.audio, W = g.world;
    this.lobby = m.players || this.lobby;
    this.syncPlayers();
    for (const h of this.handles.values()) h.stop(0.05);
    this.handles.clear();
    g.reset(m.mode, m.ch);
    g.state = 'playing';
    g.input.enable(true);
    g.ui.screen(null);
    g.ui.show('hud', true);
    g.ui.closeChoices();
    A.stopAll(); A.stopAmbience();
    A.startAmbience(new THREE.Vector3(0, 3, -2), new THREE.Vector3(-5.5, 1.8, -1));
    A.fadeBus('amb', 1, 0.5); A.fadeBus('music', 1, 0.1);
    this.snap = null; this.choice = null; this.jump = null; this.localTeacher = false; this.pendingEnd = null; this.ec = -1;
    if (m.board) {
      const img = new Image();
      img.onload = () => { const B = W.board; B.ctx.drawImage(img, 0, 0, B.W, B.H); B.dirty = true; };
      img.src = m.board;
    }
    if (m.projOn) W.projector.setOn(true);
    if (m.proj && PROJ_EVENTS.has(m.proj[0])) W.projector[m.proj[0]](...m.proj[1]);
    if (m.objs) g.ui.setObjectives(m.objs);
    this.hook('started');
  }

  /** one event from the host */
  apply(e) {
    const g = this.g, A = g.audio, W = g.world;
    switch (e.t) {
      case 's': this.snap = e; this.applySnapOnce(e); break;
      case 'snd': {
        const o = { ...e.o };
        if (o.pos) o.pos = V(o.pos);
        if (o.ear) o.pos = _v2.set(o.ear[0], o.ear[1], o.ear[2]).applyQuaternion(g.camera.quaternion).add(g.camPos).clone();
        delete o.ear;
        const h = A.play(e.n, o);
        if (h) { this.handles.set(e.i, h); h.src.addEventListener('ended', () => this.handles.delete(e.i)); }
        break;
      }
      case 'sstop': { const h = this.handles.get(e.i); if (h) { h.stop(e.f); this.handles.delete(e.i); } break; }
      case 'spos': { const h = this.handles.get(e.i); if (h) h.setPos(V(e.p)); break; }
      case 'svol': { const h = this.handles.get(e.i); if (h) h.setVol(e.v, e.tm); break; }
      case 'bus': A.fadeBus(e.b, e.v, e.tm); break;
      case 'stopAll': A.stopAll(); this.handles.clear(); break;
      case 'ui': if (UI_EVENTS.has(e.f)) g.ui[e.f](...(e.a || [])); break;
      case 'board': if (BOARD_EVENTS.has(e.f)) W.board[e.f](...(e.a || [])); break;
      case 'proj': if (PROJ_EVENTS.has(e.f)) W.projector[e.f](...(e.a || [])); break;
      case 'flash': W.flash(e.s); break;
      case 'chalk': W.chalkBurst(V(e.p), e.n, e.sp); break;
      case 'choice':
        this.choice = { n: e.labels.length, until: g.t + e.timeout, timeout: e.timeout, ask: e.title.startsWith('Raise') };
        g.input.takeChoice();
        g.ui.openChoices(e.title, e.labels, g.input.touch, (i) => this.pick(i));
        break;
      case 'choiceClose': if (this.choice) { this.choice = null; g.ui.closeChoices(); } break;
      case 'jump': this.jump = this.guestJump(); break;
      case 'camRun': {
        const door = new THREE.Vector3(4.3, PLAYER_EYE.y, -4.7);
        g.camOverride = { from: g.camPos.clone(), to: door, t: 0, dur: 3.4, yaw: Math.atan2(-(door.x - g.camPos.x), -(door.z - g.camPos.z)) };
        break;
      }
      case 'end': if (this.jump) this.pendingEnd = e; else this.showEnd(e); break;
      default: break;
    }
  }

  pick(i) {
    if (!this.choice) return;
    if (i >= 0 && this.choice.ask) this.g.handT = 2.8;
    this.choice = null;
    this.g.ui.closeChoices();
    this.send({ t: 'pick', i });
  }

  showEnd(e) {
    const g = this.g;
    g.state = 'end';
    g.input.enable(false);
    g.audio.fadeBus('amb', 0, 0.5);
    g.audio.stopAll();
    g.ui.show('hud', false);
    g.ui.clearTransient();
    g.ui.closeChoices();
    this.choice = null;
    g.ui.end(e.title, e.text + '<br><br><i>Waiting for the host…</i>', e.stats, null);
    if (e.prog) g.saveProgress(e.prog);
    this.hook('ended');
  }

  /** things in a snapshot that only change now and then */
  applySnapOnce(s) {
    const g = this.g, W = g.world;
    g.clockMin = s.ck; g.phase = s.ph; g.anger = s.a; g.strikes = s.s; g.maxStrikes = s.ms; g.mischief = s.m;
    g.present = !!s.pr; g.blind = !!s.bl; g.typing = !!s.ty; g.cutscene = !!s.cu; g.emergency = s.em;
    this.ec = s.ec;
    // classmates
    const kids = g.allKids();
    s.K.forEach((row, i) => {
      const c = kids[i];
      if (!c) return;
      c.lookTarget = row[0] ? V(row[0], c.netLook || (c.netLook = new THREE.Vector3())) : null;
      c.forcePitch = row[1];
      c.tremble = row[2];
      if (row[3] > c.talking + 0.2) c.talking = row[3];
      if (!!row[4] !== c.hollow) c.setHollow(!!row[4]);
      if (!!row[5] !== c.gone) c.setGone(!!row[5]);
      c.leanRollTarget = row[6];
      c.speed = row[7];
    });
    // room
    const w = s.w;
    W.master = w[0]; W.gloomTarget = w[1];
    if (Math.abs(W.gloom - w[2]) > 0.15) W.gloom = w[2];
    W.showSilhouette = !!w[3];
    W.laptop.openTarget = w[4]; W.laptop.glowTarget = w[5]; W.door.openTarget = w[6];
    g.doorFace.visible = !!w[7];
    w[8].forEach(([fl, dead], i) => { const b = W.lights.banks[i]; if (!b) return; b.dead = !!dead; if (fl > b.flicker + 0.15) b.flicker = fl; });
    const bk = W.fallingBook, bb = w[9];
    bk.position.set(bb[0], bb[1], bb[2]); bk.rotation.set(bb[3], bb[4], bb[5]);
    // screen
    const fx = s.fx;
    g.blackoutTarget = fx[0];
    if (Math.abs(fx[1] - g.blackout) > 0.35) g.blackout = fx[1];
    g.shake = Math.max(g.shake, fx[2]); g.glitch = Math.max(g.glitch, fx[3]); g.scareFear = Math.max(g.scareFear, fx[4]); g.redFlash = Math.max(g.redFlash, fx[5]);
    // the other players
    for (const row of s.P) {
      if (row[0] === this.myId) continue;
      const p = g.players.find((q) => q.id === row[0]);
      if (!p) continue;
      p.yaw = row[1]; p.pitch = row[2]; p.netTalk = !!row[3]; p.phoneUp = !!row[4]; p.netHand = !!row[5];
    }
    // the teacher: snap when he teleports, otherwise glide there (see guestTick)
    const t = s.T, T = g.teacher;
    if (!this.localTeacher && Math.hypot(t[0] - T.pos.x, t[2] - T.pos.z) > 1.2) {
      T.pos.set(t[0], t[1], t[2]); T.root.rotation.y = T.facing = t[3];
      for (let i = 0; i < BONES.length; i++) T.bones[BONES[i]].quaternion.set(s.b[i * 4], s.b[i * 4 + 1], s.b[i * 4 + 2], s.b[i * 4 + 3]);
    }
  }

  /** every frame on a friend's screen */
  guestTick(dt) {
    const g = this.g, T = g.teacher;
    if (g.state === 'playing' && this.heard && performance.now() - this.heard > TIMEOUT * 1000) { this.hook('lost', 'Lost the connection to the host.'); return; }
    g.t += dt;
    g.updateLook(dt);
    g.timers.update(dt);
    if (g.state === 'playing') {
      if (this.snap && !this.localTeacher) this.glideTeacher(this.snap, dt);
      if (this.localTeacher) T.update(dt, {});
      const att = g.present ? T.headWorld(_v).clone() : null;
      for (const c of g.allKids()) { c.attend = att; c.update(dt); }
      g.world.board.update(dt);
      for (const p of g.players) if (p.avatar) p.avatar.update(dt, { yaw: p.yaw, pitch: p.pitch, talk: p.netTalk, phone: p.phoneUp, hand: p.netHand });
      g.updateWatching();
      this.guestActions(dt);
      g.updateHand(dt);
      g.phone.update(dt);
      this.guestHud();
      this.inT -= dt;
      if (this.inT <= 0) {
        this.inT = INPUT_DT;
        this.send({ t: 'in', y: r3(g.yaw), p: r3(g.pitch), talk: this.talk ? 1 : 0, ph: this.phoneUp ? 1 : 0 });
      }
    }
    if (this.jump && this.jump.next().done) {
      this.jump = null;
      if (this.pendingEnd) { this.showEnd(this.pendingEnd); this.pendingEnd = null; }
    }
  }

  /** Madi moves smoothly toward the latest pose from the host */
  glideTeacher(s, dt) {
    const T = this.g.teacher, t = s.T, k = 1 - Math.exp(-16 * dt);
    T.pos.x += (t[0] - T.pos.x) * k; T.pos.z += (t[2] - T.pos.z) * k;
    T.root.position.y += (t[1] - T.root.position.y) * k;
    T.root.rotation.y = T.facing = dampAngle(T.root.rotation.y, t[3], 16, dt);
    T.root.visible = !!t[4];
    for (let i = 0; i < BONES.length; i++) {
      _q.set(s.b[i * 4], s.b[i * 4 + 1], s.b[i * 4 + 2], s.b[i * 4 + 3]);
      T.bones[BONES[i]].quaternion.slerp(_q, k);
    }
    T.bones.root.position.y += (t[5] - T.bones.root.position.y) * k;
    const hp = T.headPivot;
    hp.rotation.x += (t[6] - hp.rotation.x) * k;
    hp.rotation.y = dampAngle(hp.rotation.y, t[7], 16, dt);
    hp.rotation.z += (t[8] - hp.rotation.z) * k;
    hp.position.y += (t[9] - hp.position.y) * k;
    const stretch = hp.position.y - T.headBase.y;
    T.neck.scale.y = (T.neckLen + stretch) / T.neckLen;
    T.neck.position.y = T.neckBottom + (T.neckLen + stretch) / 2;
    T.jaw += (t[10] - T.jaw) * k;
    T.jawPivot.rotation.x = T.jaw;
    T.faceMat.emissiveIntensity = t[12]; T.eyeMat.emissiveIntensity = t[11]; T.lensMat.emissiveIntensity = t[13];
    const gl = T.glasses;
    const parent = t[14] === 'h' ? T.head : t[14] === 'r' ? T.bones.handR : this.g.scene;
    if (gl.parent !== parent) { parent.add(gl); gl.position.set(t[15], t[16], t[17]); gl.quaternion.set(t[18], t[19], t[20], t[21]); }
    else {
      gl.position.lerp(_v.set(t[15], t[16], t[17]), k);
      gl.quaternion.slerp(_q.set(t[18], t[19], t[20], t[21]), k);
    }
    T.root.updateMatrixWorld(true);
  }

  guestActions(dt) {
    const g = this.g, inp = g.input, ui = g.ui, me = g.me;
    const pressed = inp.takePressed();
    let blocked = false;
    if (ui.noteOpen && (inp.talk || inp.phone || pressed.echo || pressed.ask)) { ui.closeNote(); g.noteLatch = true; blocked = true; }
    if (g.noteLatch && !inp.talk && !inp.phone) g.noteLatch = false;
    blocked = blocked || ui.noteOpen || g.noteLatch || !!this.choice || g.cutscene;
    if (!blocked && pressed.echo) {
      if (this.ec >= 0) this.send({ t: 'press', k: 'echo' });
      else ui.hint('Repeat him right after he says something.', 2.5);
    }
    if (!blocked && pressed.ask) this.send({ t: 'press', k: 'ask' });
    this.phoneUp = !blocked && inp.phone;
    this.talk = !blocked && inp.talk && !this.phoneUp;
    g.phone.up = this.phoneUp;
    if (this.phoneUp && g.phone.mode === 'game') g.phone.score += dt * 11;
    const aim = g.aimFriend(me);
    ui.prompt(aim && !this.talk ? (inp.touch ? `hold TALK · whisper to ${aim.name}` : `hold [E] · whisper to ${aim.name}`) : '');
    if (this.choice) {
      const k = inp.takeChoice();
      if (k >= 0 && k < this.choice.n) this.pick(k);
      else ui.choiceTimer(clamp((this.choice.until - g.t) / this.choice.timeout, 0, 1));
    }
  }

  guestHud() {
    const g = this.g, ui = g.ui;
    ui.setScore(g.mischief);
    ui.setEye(!g.present ? 'away' : g.blind ? 'blind' : g.typing ? 'busy' : g.watching ? 'open' : 'closed');
    ui.setAnger(g.anger);
    ui.setStrikes(g.strikes, g.maxStrikes);
    ui.echoCue(this.ec >= 0 && !g.cutscene ? clamp(this.ec / 4, 0, 1) : -1, g.input.touch);
    const c = clockLabel(g.clockMin);
    ui.setClock(c.text);
    g.world.clock.set(c.h, c.m, c.s);
    const sec = Math.floor(g.t);
    if (sec !== g.lastTick) { g.lastTick = sec; g.audio.tick(g.world.clock.pos); }
  }

  /** the last strike: he is suddenly right in front of you (the host's sounds play with it) */
  *guestJump() {
    const g = this.g, T = g.teacher, W = g.world;
    this.localTeacher = true;
    g.input.enable(false);
    if (this.choice) { this.choice = null; g.ui.closeChoices(); }
    const dir = new THREE.Vector3(g.camFwd.x, 0, g.camFwd.z).normalize();
    const start = 1.3, end = 0.5;
    T.root.visible = true;
    T.root.position.y = 0;
    T.place(g.camPos.x + dir.x * start, g.camPos.z + dir.z * start, Math.atan2(-dir.x, -dir.z));
    T.setPose('grab');
    T.lookAt(g.camPos, 80);
    T.update(0.016, {});
    const hy = T.headWorld(new THREE.Vector3()).y;
    T.root.position.y = g.camPos.y - hy + 0.04;
    T.jawTarget = 0.8; T.jitter = 0.55; T.eyeGlow = 3; T.faceGlow = 0.85;
    W.setMaster(0.15);
    g.redFlash = 1; g.underLight = 1;
    g.blackoutTarget = 0; g.blackout = 0;
    g.shake = 0.9; g.glitch = 0.85; g.scareFear = 1;
    let t = 0;
    while (t < 0.16) {
      t += g.dt;
      const d = lerp(start, end, Math.min(1, t / 0.16));
      T.pos.x = g.camPos.x + dir.x * d; T.pos.z = g.camPos.z + dir.z * d;
      yield;
    }
    t = 0;
    while (t < 1.15) { t += g.dt; yield; }
    g.blackout = g.blackoutTarget = 1;
    g.underLight = 0;
    T.jitter = 0; T.jawTarget = 0;
    t = 0;
    while (t < 0.6) { t += g.dt; yield; }
  }

  // =============================================================== BOTH
  leave() {
    const g = this.g;
    clearInterval(this.pinger);
    if (this.role === 'host') { this.flush(); this.net.broadcast({ t: 'bye' }); }
    else if (this.role === 'guest') this.send({ t: 'bye' });
    const net = this.net;
    setTimeout(() => net.close(), 150);
    for (const av of this.avatars.values()) av.dispose();
    this.avatars.clear();
    for (const p of [...g.players]) if (!p.local) g.removePlayer(p.id);
    for (const h of this.handles.values()) h.stop(0.05);
    this.handles.clear();
    if (CURRENT === this) CURRENT = null;
    this.role = null;
    g.mp = null; g.role = 'solo';
    g.me.id = 'me'; g.me.name = 'You';
    g.seatPlayer(g.me, 0);
  }
}

/** wrap the host's sound, UI, board, projector and room so whatever happens also goes to the friends */
function installProxies(g) {
  if (proxied) return;
  proxied = true;
  const A = g.audio, ui = g.ui, W = g.world, B = W.board, P = W.projector;
  const cur = () => (CURRENT && CURRENT.live() ? CURRENT : null);
  const push = (e) => { const m = cur(); if (m) m.q.push(e); };
  // ---- sounds
  let nid = 1, quiet = false;
  const play0 = A.play.bind(A);
  A.play = (name, o = {}) => {
    const h = play0(name, o);
    if (o.local || !cur()) return h;
    const id = nid++;
    const po = {};
    for (const k of ['vol', 'rate', 'reverb', 'bus', 'loop', 'delay', 'lowpass', 'ref', 'offset', 'ear']) if (o[k] !== undefined) po[k] = o[k];
    if (o.pos) po.pos = va(o.pos);
    push({ t: 'snd', i: id, n: name, o: po });
    if (h) {
      const stop0 = h.stop, setPos0 = h.setPos, setVol0 = h.setVol;
      h.stop = (f = 0.05) => { if (!h.ended && !quiet) push({ t: 'sstop', i: id, f }); stop0(f); };
      h.setPos = (v) => { push({ t: 'spos', i: id, p: va(v) }); setPos0(v); };
      h.setVol = (v, tm = 0.05) => { push({ t: 'svol', i: id, v, tm }); setVol0(v, tm); };
    }
    return h;
  };
  const fade0 = A.fadeBus.bind(A);
  A.fadeBus = (b, v, tm = 0.3) => { push({ t: 'bus', b, v, tm }); fade0(b, v, tm); };
  const stopAll0 = A.stopAll.bind(A);
  A.stopAll = () => { push({ t: 'stopAll' }); quiet = true; stopAll0(); quiet = false; };
  // ---- what everybody sees on screen ("you" means the host here, so friends see the host's name)
  for (const fn of UI_EVENTS) {
    const f0 = ui[fn].bind(ui);
    ui[fn] = (...a) => {
      const r = f0(...a);
      const m = cur();
      if (m) {
        let args = a;
        if (fn === 'subtitle' && a[0] === 'you') args = [m.name, ...a.slice(1)];
        if (fn === 'setObjectives') args = [a[0].map((o) => ({ text: o.text, done: o.done }))];
        m.q.push({ t: 'ui', f: fn, a: args });
      }
      return r;
    };
    ui[fn].local = f0;
  }
  // ---- chalkboard, projector, room
  for (const fn of BOARD_EVENTS) { const f0 = B[fn].bind(B); B[fn] = (...a) => { push({ t: 'board', f: fn, a }); return f0(...a); }; }
  for (const fn of PROJ_EVENTS) {
    const f0 = P[fn].bind(P);
    P[fn] = (...a) => {
      push({ t: 'proj', f: fn, a });
      const m = CURRENT;
      if (m) { if (fn === 'setOn') m.projOn = !!a[0]; else if (fn === 'reset') { m.projOn = false; m.projLast = null; } else m.projLast = [fn, a]; }
      return f0(...a);
    };
  }
  const flash0 = W.flash;
  W.flash = (s = 1) => { push({ t: 'flash', s }); flash0(s); };
  const burst0 = W.chalkBurst;
  W.chalkBurst = (pos, n = 40, sp = 0.6) => { push({ t: 'chalk', p: va(pos), n, sp }); burst0(pos, n, sp); };
}
