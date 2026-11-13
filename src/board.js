// The chalkboard is a canvas texture the teacher writes on letter by letter.
// It reports where the chalk is so the teacher's hand can follow it.
import * as THREE from 'three';
import { rand, clamp } from './util.js';

const FONT = '"Caveat", "Comic Sans MS", cursive';

export class Chalkboard {
  constructor(width = 5.2, height = 1.5) {
    this.wm = width; this.hm = height;
    this.W = 1024; this.H = Math.round(1024 * height / width);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.base = document.createElement('canvas');
    this.base.width = this.W; this.base.height = this.H;
    this.paintBase();
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
    this.rows = [56, 122, 188, 254];
    this.lines = [];
    this.job = null;
    this.hand = { x: this.W / 2, y: this.H / 2 };
    this.uploadTimer = 0;
    this.dirty = true;
    this.clear();
  }

  paintBase() {
    const x = this.base.getContext('2d');
    x.fillStyle = '#18221c'; x.fillRect(0, 0, this.W, this.H);
    // old eraser smudges
    for (let i = 0; i < 36; i++) {
      x.strokeStyle = `rgba(200,210,200,${rand(0.015, 0.05)})`;
      x.lineWidth = rand(18, 50);
      x.beginPath();
      const cx = rand(0, this.W), cy = rand(0, this.H);
      x.arc(cx, cy, rand(30, 140), rand(0, 6), rand(0, 6) + 1.5);
      x.stroke();
    }
    // ghost writing that never fully erased
    x.fillStyle = 'rgba(220,220,210,0.05)';
    x.font = `700 46px ${FONT}`;
    for (let i = 0; i < 6; i++) x.fillText(['help', 'he is not', 'RUN', '13', 'the real teacher', 'STAY'][i], rand(20, 800), rand(40, 280));
    const img = x.getImageData(0, 0, this.W, this.H);
    for (let i = 0; i < img.data.length; i += 4) {
      const n = (Math.random() - 0.5) * 10;
      img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n;
    }
    x.putImageData(img, 0, 0);
  }

  clear() {
    this.ctx.drawImage(this.base, 0, 0);
    this.lines = [];
    this.dirty = true;
  }

  /** lay out a string on a row; returns a line object */
  layout(text, row, { size = 54, indent = null, color = 'rgba(234,232,220,0.93)' } = {}) {
    const c = this.ctx;
    c.font = `700 ${size}px ${FONT}`;
    let x = indent ?? rand(40, 90);
    const y = typeof row === 'number' && row < this.rows.length ? this.rows[row] : row;
    const chars = [];
    for (const ch of text) {
      const w = c.measureText(ch).width + (ch === ' ' ? 4 : 1);
      chars.push({ ch, x, w, rot: rand(-0.06, 0.06), dy: rand(-2.5, 2.5) });
      x += w;
    }
    return { text, y, size, color, chars };
  }

  drawCharSlice(line, ci, f0, f1) {
    const ch = line.chars[ci];
    if (!ch || ch.ch === ' ') return;
    const c = this.ctx;
    const top = line.y - line.size * 1.05, h = line.size * 1.45;
    const x0 = ch.x + ch.w * f0 - 1, x1 = ch.x + ch.w * f1 + 1;
    c.save();
    c.beginPath(); c.rect(x0, top, x1 - x0, h); c.clip();
    c.translate(ch.x + ch.w / 2, line.y + ch.dy);
    c.rotate(ch.rot);
    c.font = `700 ${line.size}px ${FONT}`;
    c.fillStyle = line.color;
    c.shadowColor = 'rgba(255,255,255,0.25)'; c.shadowBlur = 3;
    c.fillText(ch.ch, -ch.w / 2, 0);
    c.restore();
    // chalk grain: knock tiny holes out of the fresh stroke
    c.save();
    c.beginPath(); c.rect(x0, top, x1 - x0, h); c.clip();
    c.globalCompositeOperation = 'destination-out';
    const n = Math.ceil((x1 - x0) * 3);
    for (let i = 0; i < n; i++) {
      c.fillStyle = `rgba(0,0,0,${rand(0.2, 0.7)})`;
      c.fillRect(rand(x0, x1), rand(top, top + h), rand(1, 2.5), rand(1, 2.5));
    }
    c.restore();
    // keep base slate under the holes
    c.save();
    c.globalCompositeOperation = 'destination-over';
    c.drawImage(this.base, x0, top, x1 - x0, h, x0, top, x1 - x0, h);
    c.restore();
  }

  /** begin writing text progressively */
  write(text, row, opts = {}) {
    const line = this.layout(text, row, opts);
    this.lines.push(line);
    this.job = { type: 'write', line, p: 0, drawn: 0, speed: opts.speed ?? 7, pauseLeft: 0 };
    return line;
  }

  writeInstant(text, row, opts = {}) {
    const line = this.layout(text, row, opts);
    this.lines.push(line);
    for (let i = 0; i < line.chars.length; i++) this.drawCharSlice(line, i, 0, 1);
    this.dirty = true;
    return line;
  }

  /** huge scrawl across the board (for the "it changed while you looked away" scares) */
  scrawl(text, { color = 'rgba(236,226,214,0.95)', size = 150 } = {}) {
    this.clear();
    const c = this.ctx;
    c.font = `700 ${size}px ${FONT}`;
    const w = c.measureText(text).width;
    const s = Math.min(1, (this.W - 60) / w);
    c.save();
    c.translate(this.W / 2, this.H / 2 + size * 0.32 * s);
    c.scale(s, s);
    c.rotate(rand(-0.04, 0.04));
    c.fillStyle = color;
    c.shadowColor = 'rgba(255,255,255,0.3)'; c.shadowBlur = 6;
    let x = -w / 2;
    for (const ch of text) {
      const cw = c.measureText(ch).width;
      c.save(); c.translate(x, rand(-8, 8)); c.rotate(rand(-0.08, 0.08)); c.fillText(ch, 0, 0); c.restore();
      x += cw;
    }
    c.restore();
    this.dirty = true;
    this.job = null;
  }

  drawEye(cx, cy, r) {
    const c = this.ctx;
    c.save();
    c.strokeStyle = 'rgba(234,232,220,0.9)'; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx - r, cy); c.quadraticCurveTo(cx, cy - r * 0.9, cx + r, cy); c.quadraticCurveTo(cx, cy + r * 0.9, cx - r, cy); c.stroke();
    c.beginPath(); c.arc(cx, cy, r * 0.32, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(234,232,220,0.9)'; c.beginPath(); c.arc(cx, cy, r * 0.12, 0, Math.PI * 2); c.fill();
    c.restore();
    this.dirty = true;
  }

  /** stop writing / erasing right where the chalk is */
  stopJob() { this.job = null; }

  erase(duration = 3.2) {
    this.job = { type: 'erase', t: 0, dur: duration, lastX: null, lastY: null };
  }

  get busy() { return !!this.job; }

  /** returns true on frames where chalk touched the board (for sounds) */
  update(dt) {
    let touched = false;
    const j = this.job;
    if (j && j.type === 'write') {
      if (j.pauseLeft > 0) { j.pauseLeft -= dt; }
      else {
        const line = j.line;
        const prev = j.p;
        j.p = Math.min(line.chars.length, j.p + dt * j.speed);
        // draw from prev to j.p
        let i = Math.floor(prev), f = prev - i;
        while (i < Math.floor(j.p) || (i === Math.floor(j.p) && f < j.p - i)) {
          const end = i < Math.floor(j.p) ? 1 : j.p - i;
          this.drawCharSlice(line, i, f, end);
          if (end >= 1) { i++; f = 0; if (line.chars[i - 1] && line.chars[i - 1].ch === ' ') j.pauseLeft = rand(0.05, 0.25); } else break;
        }
        const ci = Math.min(Math.floor(j.p), line.chars.length - 1);
        const ch = line.chars[ci];
        if (ch) {
          const fr = clamp(j.p - ci, 0, 1);
          this.hand.x = ch.x + ch.w * fr;
          this.hand.y = line.y - line.size * 0.3 + Math.sin(j.p * 9) * line.size * 0.22;
          touched = ch.ch !== ' ';
        }
        this.dirty = true;
        if (j.p >= line.chars.length) this.job = null;
      }
    } else if (j && j.type === 'erase') {
      j.t += dt;
      const k = clamp(j.t / j.dur, 0, 1);
      // zig-zag sweeps: 4 horizontal passes
      const passes = 4;
      const pk = k * passes, pi = Math.min(passes - 1, Math.floor(pk)), pf = pk - pi;
      const ex = (pi % 2 === 0 ? pf : 1 - pf) * (this.W - 80) + 40;
      const ey = (pi + 0.5) / passes * this.H;
      this.hand.x = ex; this.hand.y = ey + Math.sin(j.t * 22) * 14;
      const c = this.ctx;
      const lx = j.lastX ?? ex, ly = j.lastY ?? ey;
      const x0 = Math.min(lx, ex) - 70, w = Math.abs(ex - lx) + 140;
      const y0 = ey - this.H / passes / 2 - 10, h = this.H / passes + 20;
      c.save();
      c.globalAlpha = 0.88;
      c.drawImage(this.base, x0, y0, w, h, x0, y0, w, h);
      c.globalAlpha = 0.05;
      c.fillStyle = '#d8ddd4';
      c.fillRect(x0, y0, w, h);
      c.restore();
      j.lastX = ex; j.lastY = ey;
      touched = true;
      this.dirty = true;
      if (k >= 1) { this.job = null; this.lines = []; }
    }
    this.uploadTimer -= dt;
    if (this.dirty && this.uploadTimer <= 0) {
      this.texture.needsUpdate = true;
      this.dirty = false;
      this.uploadTimer = 1 / 18;
    }
    return touched;
  }

  /** canvas px -> world position on the board mesh */
  toWorld(cx, cy, mesh, out = new THREE.Vector3()) {
    out.set((cx / this.W - 0.5) * this.wm, (0.5 - cy / this.H) * this.hm, 0.02);
    return mesh.localToWorld(out);
  }
}
