// Meme videos for the phones. Every clip is an original little cartoon drawn live on a canvas
// (no video files, nothing copied): its own music, sound effects and narrator voice, made by
// tools/gen_sfx.py and tools/gen_voices.py. Players can also drop their own .mp4 files into
// assets/videos/ (see assets/videos/README.md) and the game mixes them into the feed.
import * as THREE from 'three';
import { CLIPS, SPECIAL } from './clips.js';

export { CLIPS, SPECIAL };
export const VW = 270, VH = 480; // every clip draws into a virtual 9:16 frame

/** a stable random number in [0,1) for (seed, i): the same on every player's screen */
export function srand(seed, i) {
  let h = (seed * 374761393 + i * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ your own videos (optional)
export const USER_VIDEOS = [];
export async function loadUserVideos(base = 'assets/videos/') {
  try {
    const r = await fetch(base + 'list.json', { cache: 'no-cache' });
    if (!r.ok) return;
    const list = await r.json();
    if (!Array.isArray(list)) return;
    for (const v of list.slice(0, 200)) {
      const file = typeof v === 'string' ? v : v && v.file;
      if (typeof file !== 'string' || !/^[\w .()\-]+\.(mp4|webm|mov)$/i.test(file)) continue;
      USER_VIDEOS.push({ user: true, id: 'u:' + file, file: base + encodeURIComponent(file), user_: (v && v.from) || '@' + file.replace(/\.\w+$/, ''), cap: (v && v.title) || '', dur: 0 });
    }
  } catch (e) { /* no list: only the built-in clips */ }
}

/** clip by key: a number (built-in), 'u:file' (user video) or a special name */
export function clipByKey(k) {
  if (typeof k === 'number') return CLIPS[k] || CLIPS[0];
  if (typeof k === 'string' && k.startsWith('u:')) return USER_VIDEOS.find((v) => v.id === k) || CLIPS[0];
  return SPECIAL[k] || CLIPS[0];
}
export const clipKey = (clip) => (clip.user ? clip.id : clip.special ? clip.special : CLIPS.indexOf(clip));

/** a shuffled bag: you see every clip once before any repeats */
export class ClipBag {
  constructor() { this.bag = []; this.last = null; }
  next() {
    if (!this.bag.length) {
      const all = [...CLIPS.map((c, i) => i), ...USER_VIDEOS.map((v) => v.id)];
      for (let i = all.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [all[i], all[j]] = [all[j], all[i]]; }
      if (all.length > 1 && all[all.length - 1] === this.last) [all[0], all[all.length - 1]] = [all[all.length - 1], all[0]];
      this.bag = all;
    }
    const k = this.bag.pop();
    this.last = k;
    return k;
  }
}

// ------------------------------------------------------------------ playback
/**
 * Plays one clip: keeps its time, fires its sounds and draws its frames.
 * The same clip key + seed + time draws the same picture on every screen.
 */
export class ClipPlayer {
  constructor(audio, extra = {}) {
    this.audio = audio;
    this.extra = extra;      // { portrait } for the scary ones
    this.clip = null; this.key = null; this.seed = 0; this.t = 0;
    this.music = null; this.snds = []; this.next = 0;
    this.video = null;
  }
  load(key, seed = 1, t = 0) {
    this.stopSound();
    this.key = key; this.clip = clipByKey(key); this.seed = seed; this.t = t;
    this.next = this.clip.snd ? this.clip.snd.findIndex((e) => e[0] >= t - 1e-6) : -1;
    if (this.next < 0) this.next = this.clip.snd ? this.clip.snd.length : 0;
    if (this.clip.user) this.attachVideo();
  }
  get dur() { return this.clip ? (this.clip.user ? this.clip.dur || 999 : this.clip.dur) : 0; }
  get done() { return !!this.clip && this.dur > 0 && this.t >= this.dur - 0.02 && (!this.clip.user || this.clip.dur > 0); }
  get progress() { return this.clip ? Math.min(1, this.t / (this.dur || 1)) : 0; }
  /** 1 while the clip is at a LOUD moment (anyone nearby hears it) */
  loudNow() {
    const L = this.clip && this.clip.loud;
    if (!L) return 0;
    for (const [a, b] of L) if (this.t >= a && this.t <= b) return 1;
    return 0;
  }

  /** move time forward. sound: { on, pos, vol, local } */
  advance(dt, sound = { on: true }) {
    const c = this.clip;
    if (!c || this.done) { this.stopSound(); return; }
    const t0 = this.t, t1 = Math.min(this.dur, t0 + dt);
    if (c.user) { this.syncVideo(sound); if (this.done) this.stopSound(); return; }
    if (sound.on && this.audio && this.audio.ctx) {
      const base = { vol: sound.vol ?? 1, pos: sound.pos, ref: 0.7, reverb: 0.05, local: true };
      if (c.music && !this.music) {
        const buf = this.audio.buffers[c.music[0]];
        const off = buf ? t0 % buf.duration : 0;
        this.music = this.audio.play(c.music[0], { ...base, vol: c.music[1] * base.vol, loop: c.music[2] !== false, offset: off });
      }
      if (this.music && sound.pos) this.music.setPos(sound.pos);
      while (c.snd && this.next < c.snd.length && c.snd[this.next][0] < t1) {
        const [, id, v] = c.snd[this.next++];
        const h = this.audio.play(id, { ...base, vol: (v ?? 1) * base.vol, bus: 'sfx' });
        if (h) this.snds.push(h);
      }
      if (this.snds.length > 8) this.snds = this.snds.filter((h) => !h.ended);
    } else {
      this.stopSound();
      while (c.snd && this.next < c.snd.length && c.snd[this.next][0] < t1) this.next++;
    }
    this.t = t1;
    if (this.done) this.stopSound();
  }
  /** jump to a time (to follow another player's screen) */
  seek(t) {
    if (Math.abs(t - this.t) < 0.35) return;
    const k = this.key; this.load(k, this.seed, t);
  }
  pause() { this.stopSound(); if (this.video) this.video.pause(); }
  stopSound() {
    if (this.music) { this.music.stop(0.08); this.music = null; }
    for (const h of this.snds) h.stop(0.05);
    this.snds = [];
    if (this.video && !this.video.paused) this.video.pause();
  }

  // ---- the player's own mp4 files
  attachVideo() {
    if (!this.video) {
      const v = (this.video = document.createElement('video'));
      v.playsInline = true; v.preload = 'auto'; v.crossOrigin = 'anonymous';
      v.setAttribute('playsinline', '');
    }
    const v = this.video, c = this.clip;
    this.playReq = false;
    if (v.dataset.src !== c.file) {
      v.dataset.src = c.file; v.src = c.file;
      v.onloadedmetadata = () => { if (isFinite(v.duration) && v.duration > 0) c.dur = Math.min(v.duration, 180); };
      v.onerror = () => { c.dur = 0.1; }; // a broken file just ends
    } else { try { v.currentTime = 0; } catch (e) { /* not loaded yet */ } }
  }
  /** a real video file keeps its own time: follow it */
  syncVideo(sound) {
    const v = this.video;
    if (!v) return;
    v.volume = Math.max(0, Math.min(1, (sound.vol ?? 1) * (sound.pos ? 0.6 : 1)));
    v.muted = !sound.on;
    if (v.ended) { this.t = this.dur; return; }
    if (v.paused && !this.done && !this.playReq) {
      this.playReq = true;
      const p = v.play();
      const done = () => { this.playReq = false; };
      if (p && p.then) p.then(done, () => { v.muted = true; v.play().then(done, done); }); else done();
    }
    if (v.readyState >= 2) this.t = Math.min(this.dur, Math.max(this.t, v.currentTime));
  }

  // ---- drawing
  /** draw the clip's current frame into (x, y, w, h) of a 2D context */
  drawFrame(ctx, x, y, w, h) {
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
    const c = this.clip;
    if (c && c.user) {
      const v = this.video;
      if (v && v.readyState >= 2 && v.videoWidth) {
        const s = Math.min(w / v.videoWidth, h / v.videoHeight);
        const dw = v.videoWidth * s, dh = v.videoHeight * s;
        try { ctx.drawImage(v, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); } catch (e) { /* tainted or not ready */ }
      } else spinner(ctx, x + w / 2, y + h / 2, performance.now() / 1000);
    } else if (c) {
      ctx.translate(x, y);
      ctx.scale(w / VW, h / VH);
      const seed = this.seed;
      const R = (i) => srand(seed, i);
      try { c.draw(ctx, this.t, R, this.extra); } catch (e) { /* a broken frame should never stop the game */ }
    }
    ctx.restore();
  }

  /** a whole phone screen: the video, the feed buttons, the caption and the progress bar */
  drawScreen(ctx, W, H, opt = {}) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    const top = 26, vh = Math.min(H - top - 10, W * 16 / 9);
    const vw = vh * 9 / 16, vx = (W - vw) / 2;
    this.drawFrame(ctx, vx, top, vw, vh);
    const c = this.clip || {};
    // status bar
    ctx.fillStyle = '#d7dbe2'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(opt.clock || '9:41', 10, 17);
    ctx.textAlign = 'right'; ctx.fillText('▮▮▮ 72%', W - 10, 17);
    if (opt.header) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(0, top, W, 26);
      ctx.fillStyle = '#7cc4ff'; ctx.textAlign = 'center'; ctx.font = 'bold 13px sans-serif';
      ctx.fillText(opt.header, W / 2, top + 18);
    }
    // right column: likes, comments, share
    if (!c.special || c.special !== 'found') {
      const likes = c.likes || ['1.2M', '845K', '2.9M', '377K', '4.1M', '96K'][Math.floor(srand(this.seed, 99) * 6)];
      ctx.textAlign = 'center'; ctx.font = '22px sans-serif';
      const rx = vx + vw - 20;
      ctx.fillStyle = '#ff3b5c'; ctx.fillText('♥', rx, top + vh * 0.55);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.fillText(likes, rx, top + vh * 0.55 + 13);
      ctx.font = '19px sans-serif'; ctx.fillText('✉', rx, top + vh * 0.68);
      ctx.font = 'bold 10px sans-serif'; ctx.fillText(String(Math.floor(srand(this.seed, 98) * 9000 + 300)), rx, top + vh * 0.68 + 13);
      ctx.font = '19px sans-serif'; ctx.fillText('➦', rx, top + vh * 0.8);
    }
    // handle + caption
    ctx.textAlign = 'left';
    const by = top + vh - 34;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(vx, by - 18, vw, 52);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif';
    ctx.fillText(c.user ? c.user_ : c.who || '@memes', vx + 8, by - 3);
    ctx.font = '11px sans-serif'; ctx.fillStyle = '#e8e8e8';
    wrapText(ctx, c.cap || '', vx + 8, by + 12, vw - 44, 12, 2);
    // progress
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(vx, top + vh - 3, vw, 3);
    ctx.fillStyle = '#fff'; ctx.fillRect(vx, top + vh - 3, vw * this.progress, 3);
    if (opt.paused && !this.done) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(vx, top, vw, vh);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath(); ctx.moveTo(W / 2 - 16, top + vh / 2 - 22); ctx.lineTo(W / 2 + 22, top + vh / 2); ctx.lineTo(W / 2 - 16, top + vh / 2 + 22); ctx.closePath(); ctx.fill();
    }
    if (opt.footer) {
      ctx.fillStyle = '#9aa4b2'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(opt.footer, W / 2, H - 2);
    }
  }
}

function spinner(c, x, y, t) {
  c.strokeStyle = '#fff'; c.lineWidth = 4;
  c.beginPath(); c.arc(x, y, 16, t * 6, t * 6 + 4.2); c.stroke();
}

export function wrapText(c, text, x, y, maxW, lh, maxLines = 9) {
  const words = String(text).split(' ');
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) {
      c.fillText(line, x, y); line = w; y += lh;
      if (++n >= maxLines - 1) { c.fillText(line + '…', x, y); return; }
    } else line = test;
  }
  if (line) c.fillText(line, x, y);
}

// ------------------------------------------------------------------ a phone someone holds out to you
/**
 * A 3D phone in a hand (with a forearm), held out by a classmate or a friend.
 * Its screen plays a clip; you have to look at it to watch.
 */
export class HeldPhone {
  constructor(scene, audio, portrait) {
    this.scene = scene;
    const g = (this.group = new THREE.Group());
    const S = 1.35; // a big phone, held close
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.072 * S, 0.145 * S, 0.01), new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.35, metalness: 0.5 }));
    g.add(body);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 240; this.canvas.height = 480;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.066 * S, 0.132 * S), new THREE.MeshBasicMaterial({ map: this.tex, fog: false, toneMapped: false }));
    screen.position.z = 0.0052;
    g.add(screen);
    this.light = new THREE.PointLight(0x9cc4ff, 0.5, 1.6, 2);
    this.light.position.set(0, 0, 0.1);
    g.add(this.light);
    const skin = new THREE.MeshStandardMaterial({ color: 0xc08a64, roughness: 0.7 });
    const sleeve = (this.sleeveMat = new THREE.MeshStandardMaterial({ color: 0x33415c, roughness: 0.9 }));
    this.arm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1, 8), sleeve);
    this.hand = new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6), skin);
    this.hand.scale.set(1, 1.25, 0.7);
    this.root = new THREE.Group();
    this.root.add(g, this.arm, this.hand);
    this.root.visible = false;
    scene.add(this.root);
    this.player = new ClipPlayer(audio, { portrait });
    this.redraw = 0;
    this.face = null; // set to an image to show his face on the screen
    this.portrait = portrait;
  }
  get visible() { return this.root.visible; }
  set visible(v) { this.root.visible = v; if (!v) this.player.pause(); }

  /** hand at `hold`, arm from `shoulder`, screen turned toward `viewer` */
  pose(shoulder, hold, viewer) {
    this.group.position.copy(hold);
    this.group.lookAt(viewer);
    const d = new THREE.Vector3().subVectors(hold, shoulder);
    const len = Math.max(0.05, d.length() - 0.05);
    this.arm.scale.set(1, len, 1);
    this.arm.position.copy(shoulder).addScaledVector(d, (len / 2) / d.length());
    this.arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    this.hand.position.copy(hold).addScaledVector(d, -0.04).add(new THREE.Vector3(0, -0.07, 0));
  }

  render(dt, opt = {}) {
    this.redraw -= dt;
    if (this.redraw > 0) return;
    this.redraw = 1 / 24;
    const c = this.ctx;
    if (this.face) drawFace(c, 240, 480, this.face);
    else this.player.drawScreen(c, 240, 480, opt);
    this.tex.needsUpdate = true;
  }

  dispose() {
    this.player.stopSound();
    this.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    this.tex.dispose();
  }
}

/** his face fills the screen, torn into glitching strips */
export function drawFace(c, W, H, img) {
  c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
  if (img) {
    for (let y = 0; y < H; y += 12) {
      const off = Math.random() < 0.3 ? (Math.random() - 0.5) * 40 : 0;
      c.drawImage(img, 0, (y / H) * img.height, img.width, (12 / H) * img.height, off - 40, y + 30, W + 80, 12);
    }
  }
  c.fillStyle = `rgba(200,0,0,${0.5 + Math.random() * 0.5})`;
  c.font = 'bold 42px "Special Elite", monospace';
  c.textAlign = 'center';
  c.fillText('LOOK UP', W / 2 + (Math.random() - 0.5) * 6, 48);
  c.fillText('LOOK UP', W / 2 + (Math.random() - 0.5) * 6, H - 22);
}
