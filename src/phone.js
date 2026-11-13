// The player's phone: a 3D handset attached to the camera with a live canvas screen.
// Two apps: PAPER PLANE (a tap-to-fly game: crash and the phone makes a LOUD noise) and
// the meme feed (src/memes.js). It also shows messages, videos friends send you... and other things.
import * as THREE from 'three';
import { damp } from './util.js';
import { ClipPlayer, ClipBag, drawFace, wrapText } from './memes.js';

const W = 240, H = 480;
const GROUND = 440, PX = 70, GAP = 128;

/** PAPER PLANE: tap to fly between the pencils */
export class PlaneGame {
  constructor() { this.best = 0; this.reset(); }
  reset() {
    this.state = 'ready'; this.y = 230; this.vy = 0; this.pipes = []; this.score = 0;
    this.t = 0; this.deadT = 0; this.spawn = 0.4; this.scroll = 0;
  }
  /** returns true if the plane flapped */
  tap() {
    if (this.state === 'dead') { if (this.deadT > 0.9) this.reset(); return false; }
    if (this.state === 'ready' || this.state === 'paused') this.state = 'play';
    this.vy = -255;
    return true;
  }
  pause() { if (this.state === 'play') this.state = 'paused'; }
  step(dt, ev) {
    this.t += dt;
    if (this.state === 'ready') { this.y = 230 + Math.sin(this.t * 3) * 8; this.scroll += 60 * dt; return; }
    if (this.state === 'paused') return;
    if (this.state === 'dead') {
      this.deadT += dt;
      this.vy = Math.min(600, this.vy + 900 * dt);
      this.y = Math.min(GROUND - 8, this.y + this.vy * dt);
      return;
    }
    this.scroll += 105 * dt;
    this.vy = Math.min(520, this.vy + 830 * dt);
    this.y += this.vy * dt;
    this.spawn -= dt;
    if (this.spawn <= 0) { this.spawn = 1.45; this.pipes.push({ x: W + 20, gap: 130 + Math.random() * 220, passed: false }); }
    for (const p of this.pipes) {
      p.x -= 105 * dt;
      if (!p.passed && p.x + 44 < PX - 9) { p.passed = true; this.score++; ev.point(this.score); }
    }
    this.pipes = this.pipes.filter((p) => p.x > -60);
    const r = 8;
    if (this.y > GROUND - r || this.y < 34) { this.die(ev); return; }
    for (const p of this.pipes) {
      if (PX + r > p.x + 2 && PX - r < p.x + 42 && (this.y - r < p.gap - GAP / 2 || this.y + r > p.gap + GAP / 2)) { this.die(ev); return; }
    }
  }
  die(ev) {
    this.state = 'dead'; this.deadT = 0; this.vy = Math.min(this.vy, 0);
    this.best = Math.max(this.best, this.score);
    ev.crash(this.score);
  }

  draw(c) {
    const g = c.createLinearGradient(0, 30, 0, GROUND);
    g.addColorStop(0, '#5ec2f2'); g.addColorStop(1, '#c7ecff');
    c.fillStyle = g; c.fillRect(0, 26, W, GROUND - 26);
    // clouds
    c.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) {
      const x = ((i * 90 - this.scroll * 0.25) % 330 + 330) % 330 - 60, y = 70 + i * 55;
      c.beginPath(); c.ellipse(x, y, 26, 10, 0, 0, Math.PI * 2); c.ellipse(x + 18, y - 7, 18, 11, 0, 0, Math.PI * 2); c.fill();
    }
    // pencils
    for (const p of this.pipes) {
      const top = p.gap - GAP / 2, bot = p.gap + GAP / 2;
      pencil(c, p.x, 26, top, true);
      pencil(c, p.x, bot, GROUND, false);
    }
    // desk
    c.fillStyle = '#b07a43'; c.fillRect(0, GROUND, W, H - GROUND);
    c.fillStyle = '#8f5f2f';
    for (let i = 0; i < 9; i++) c.fillRect(((i * 34 - this.scroll) % 306 + 306) % 306 - 30, GROUND + 14, 20, 3);
    c.fillStyle = '#c98e52'; c.fillRect(0, GROUND, W, 5);
    // the plane
    c.save(); c.translate(PX, this.y);
    c.rotate(Math.max(-0.6, Math.min(1.2, this.vy / 420)));
    c.fillStyle = '#ffffff'; c.strokeStyle = '#2b3a55'; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(16, 0); c.lineTo(-14, -9); c.lineTo(-8, 0); c.lineTo(-14, 9); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#d7e3f4'; c.beginPath(); c.moveTo(16, 0); c.lineTo(-8, 0); c.lineTo(-12, 5); c.closePath(); c.fill();
    c.restore();
    // text
    c.textAlign = 'center';
    outline(c, String(this.score), W / 2, 92, 44);
    if (this.state === 'ready') {
      outline(c, 'PAPER PLANE', W / 2, 160, 28, '#ffe066');
      outline(c, 'TAP TO FLY', W / 2, 300, 22);
      c.fillStyle = '#1d3557'; c.font = 'bold 12px sans-serif';
      c.fillText(this.hint || 'tap: [E] / click', W / 2, 324);
      if (this.best) { c.font = 'bold 13px sans-serif'; c.fillText('BEST ' + this.best, W / 2, 346); }
    } else if (this.state === 'paused') {
      outline(c, 'TAP TO CONTINUE', W / 2, 300, 20);
    } else if (this.state === 'dead') {
      c.fillStyle = 'rgba(120,0,0,0.25)'; c.fillRect(0, 26, W, GROUND - 26);
      outline(c, 'GAME OVER', W / 2, 190, 34, '#ff4d4d');
      outline(c, 'BEST ' + this.best, W / 2, 230, 18);
      if (this.deadT > 0.9) outline(c, 'tap to retry', W / 2, 300, 18);
    }
  }
}

function pencil(c, x, y0, y1, down) {
  const w = 44, tip = 30;
  if (y1 - y0 <= 0) return;
  const bodyA = down ? y0 : y0 + tip, bodyB = down ? y1 - tip : y1;
  c.fillStyle = '#f7c531'; c.fillRect(x, bodyA, w, Math.max(0, bodyB - bodyA));
  c.fillStyle = '#e8ab12'; c.fillRect(x + 15, bodyA, 7, Math.max(0, bodyB - bodyA));
  c.fillStyle = '#fbd75a'; c.fillRect(x + 4, bodyA, 5, Math.max(0, bodyB - bodyA));
  c.fillStyle = '#f2d2a2';
  c.beginPath();
  if (down) { c.moveTo(x, y1 - tip); c.lineTo(x + w, y1 - tip); c.lineTo(x + w / 2, y1); }
  else { c.moveTo(x, y0 + tip); c.lineTo(x + w, y0 + tip); c.lineTo(x + w / 2, y0); }
  c.closePath(); c.fill();
  c.fillStyle = '#333';
  c.beginPath();
  if (down) { c.moveTo(x + w / 2 - 7, y1 - 10); c.lineTo(x + w / 2 + 7, y1 - 10); c.lineTo(x + w / 2, y1); }
  else { c.moveTo(x + w / 2 - 7, y0 + 10); c.lineTo(x + w / 2 + 7, y0 + 10); c.lineTo(x + w / 2, y0); }
  c.closePath(); c.fill();
}

function outline(c, s, x, y, size, col = '#fff') {
  c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  c.lineJoin = 'round'; c.lineWidth = size / 5; c.strokeStyle = '#1d3557';
  c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y);
}

export class Phone {
  constructor(camera, portraitImg, audio) {
    this.portrait = portraitImg;
    this.audio = audio;
    const g = (this.group = new THREE.Group());
    camera.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.145, 0.009), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.3, metalness: 0.5 }));
    g.add(body);
    this.canvas = document.createElement('canvas');
    this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.065, 0.13), new THREE.MeshBasicMaterial({ map: this.tex, fog: false, toneMapped: false }));
    screen.position.z = 0.0047;
    g.add(screen);
    this.light = new THREE.PointLight(0x9cc4ff, 0, 2.2, 2);
    this.light.position.set(0, 0, 0.08);
    g.add(this.light);
    this.raise = 0;
    this.up = false;
    this.app = 'game';      // what it shows when nothing else is going on: 'game' or 'memes'
    this.mode = 'game';     // on screen now: 'game' 'memes' 'video' (a video someone sent) 'message' 'face'
    this.message = null;
    this.t = 0;
    this.redraw = 0;
    this.game = new PlaneGame();
    this.feed = new ClipPlayer(audio, { portrait: portraitImg });
    this.bag = new ClipBag();
    this.feedGap = 0;
    this.mission = null;    // { player, from }
    this.onCrash = null; this.onPoint = null; this.onFlap = null; this.onFeedDone = null;
    this.forceT = 0;      // he holds it up in front of you (the scare)
    this.feedDoneFired = false;
    this.clock = '9:41';
    this.place(0);
  }

  reset() {
    this.up = false; this.forceT = 0; this.raise = 0;
    this.clearMission();
    this.feed.stopSound(); this.feed.clip = null; this.feed.key = null;
    this.app = 'game'; this.mode = 'game'; this.message = null;
    this.game.reset();
    this.redraw = 0;
  }

  get score() { return this.game.score; }
  set score(v) { if (v === 0) this.game.reset(); }

  /** a video is playing on the screen right now (its sound can be heard) */
  get playing() {
    if (this.raise < 0.6 || !this.up) return false;
    if (this.mode === 'video') return !!this.mission && !this.mission.player.done;
    if (this.mode === 'memes') return !!this.feed.clip && !this.feed.done;
    return false;
  }
  get loud() {
    if (!this.playing) return 0;
    return (this.mode === 'video' ? this.mission.player : this.feed).loudNow();
  }
  get clipPlayer() { return this.mode === 'video' && this.mission ? this.mission.player : this.mode === 'memes' ? this.feed : null; }
  get showMode() { return this.mode === 'video' || this.mode === 'memes'; }

  /** back to the app (after a message or a scare) */
  home() { this.mode = this.mission ? 'video' : this.app; }

  switchApp() {
    if (this.mode === 'message' || this.mode === 'face') return;
    this.feed.pause(); this.game.pause();
    this.app = this.app === 'game' ? 'memes' : 'game';
    this.mode = this.app;
    if (this.app === 'memes' && !this.feed.clip) this.nextClip();
    this.redraw = 0;
  }

  /** E / click / TAP while the phone is up */
  tap() {
    if (this.raise < 0.6) return;
    if (this.mode === 'game') { if (this.game.tap() && this.onFlap) this.onFlap(); }
    else if (this.mode === 'memes') this.nextClip();
  }

  nextClip(key, seed) {
    this.feed.load(key ?? this.bag.next(), seed ?? ((Math.random() * 1e9) | 0));
    this.feedGap = 0; this.feedDoneFired = false;
  }

  /** someone sent you a video: it plays the next time you hold the phone up */
  setMission(key, seed, from) {
    if (this.mission) this.mission.player.stopSound();
    const player = new ClipPlayer(this.audio, { portrait: this.portrait });
    player.load(key, seed);
    this.mission = { player, from };
    this.feed.pause();
    if (this.mode !== 'message' && this.mode !== 'face') this.mode = 'video';
  }
  clearMission() {
    if (this.mission) this.mission.player.stopSound();
    this.mission = null;
    if (this.mode === 'video') this.mode = this.app;
  }

  place(k) {
    // hidden below the view -> held in front of the chest (videos: higher and closer, to watch)
    const v = this.showMode ? 1 : 0;
    this.group.position.set((0.02 + 0.01 * v) * k, -0.45 + k * (0.37 + v * 0.05), -0.34 + k * (0.08 + v * 0.03));
    this.group.rotation.set(-0.5 + k * (0.32 + v * 0.1), 0, 0);
  }

  update(dt) {
    this.t += dt;
    if (this.forceT > 0) { this.forceT -= dt; if (this.forceT <= 0) this.home(); }
    this.raise = damp(this.raise, this.up || this.forceT > 0 ? 1 : 0, 10, dt);
    this.place(this.raise);
    this.group.visible = this.raise > 0.02;
    this.light.intensity = this.raise * (this.mode === 'face' ? 0.9 : 0.55);
    const live = this.up && this.raise > 0.6;
    // the game runs only while you hold the phone up
    if (this.mode === 'game' && live) {
      const ev = { point: (s) => this.onPoint && this.onPoint(s), crash: (s) => this.onCrash && this.onCrash(s) };
      let left = dt;
      while (left > 1e-6) { const h = Math.min(1 / 60, left); this.game.step(h, ev); left -= h; }
    } else if (this.game.state === 'play') this.game.pause();
    // videos play while you watch them
    const vol = 0.85;
    if (this.mode === 'video' && this.mission && live) this.mission.player.advance(dt, { on: true, vol });
    else if (this.mission) this.mission.player.pause();
    if (this.mode === 'memes' && live) {
      if (!this.feed.clip) this.nextClip();
      if (this.feed.done) {
        if (!this.feedDoneFired) { this.feedDoneFired = true; if (this.onFeedDone) this.onFeedDone(); }
        this.feed.pause(); this.feedGap += dt; if (this.feedGap > 1.2) this.nextClip();
      }
      else this.feed.advance(dt, { on: true, vol });
    } else this.feed.pause();
    if (!this.group.visible) return;
    this.redraw -= dt;
    if (this.redraw > 0) return;
    this.redraw = this.mode === 'game' && this.game.state === 'play' ? 1 / 30 : 1 / 24;
    const c = this.ctx;
    if (this.mode === 'face') drawFace(c, W, H, this.portrait);
    else if (this.mode === 'message' && this.message) {
      c.fillStyle = '#0d1117'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#9aa4b2'; c.font = '15px sans-serif'; c.textAlign = 'center';
      c.fillText(this.clock, W / 2, 28);
      c.fillStyle = '#1f2937';
      rr(c, 10, 62, W - 20, 280, 18); c.fill();
      c.textAlign = 'left';
      c.fillStyle = this.message.from === 'Unknown' ? '#ff6b6b' : '#7cc4ff';
      c.font = 'bold 28px sans-serif';
      c.fillText(this.message.from, 24, 108);
      c.fillStyle = '#e5e7eb'; c.font = '28px sans-serif';
      wrapText(c, this.message.text, 24, 152, W - 48, 34);
    } else if (this.mode === 'video' && this.mission) {
      const m = this.mission;
      this.mission.player.drawScreen(c, W, H, { clock: this.clock, header: m.player.done ? 'watched ✓' : '📹 ' + m.from + ' sent you a video', paused: !live, footer: m.player.done ? '' : 'watch all of it' });
    } else if (this.mode === 'memes') {
      this.feed.drawScreen(c, W, H, { clock: this.clock, paused: !live, footer: this.feedHint || 'tap: next video' });
    } else {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, 26);
      c.fillStyle = '#d7dbe2'; c.font = 'bold 12px sans-serif'; c.textAlign = 'left'; c.fillText(this.clock, 10, 17);
      this.game.draw(c);
    }
    this.tex.needsUpdate = true;
  }
}

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}
