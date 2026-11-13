// The player's phone: a 3D handset attached to the camera with a live canvas
// screen (mini-game, messages, and... other things).
import * as THREE from 'three';
import { damp, rand } from './util.js';

export class Phone {
  constructor(camera, portraitImg) {
    this.portrait = portraitImg;
    const g = (this.group = new THREE.Group());
    camera.add(g);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.145, 0.009), new THREE.MeshStandardMaterial({ color: 0x0b0b0d, roughness: 0.3, metalness: 0.5 }));
    g.add(body);
    this.canvas = document.createElement('canvas');
    this.canvas.width = 180; this.canvas.height = 360;
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
    this.mode = 'game';
    this.message = null;
    this.score = 0;
    this.t = 0;
    this.redraw = 0;
    // mini-game state
    this.runnerY = 0; this.runnerV = 0;
    this.obstacles = [{ x: 200 }, { x: 330 }];
    this.place(0);
  }

  place(k) {
    // hidden below the view -> held in front of the chest
    this.group.position.set(0.0, -0.45 + k * 0.33, -0.34);
    this.group.rotation.set(-0.5 + k * 0.2, 0, 0);
  }

  update(dt) {
    this.t += dt;
    this.raise = damp(this.raise, this.up ? 1 : 0, 10, dt);
    this.place(this.raise);
    this.group.visible = this.raise > 0.02;
    this.light.intensity = this.raise * (this.mode === 'face' ? 0.9 : 0.55);
    if (!this.group.visible) return;
    this.redraw -= dt;
    if (this.redraw > 0) return;
    this.redraw = 1 / 20;
    const c = this.ctx, W = 180, H = 360;
    if (this.mode === 'face') {
      c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
      if (this.portrait) {
        for (let y = 0; y < H; y += 12) {
          const off = Math.random() < 0.3 ? rand(-20, 20) : 0;
          c.drawImage(this.portrait, 0, (y / H) * this.portrait.height, this.portrait.width, (12 / H) * this.portrait.height, off - 30, y + 40, W + 60, 12);
        }
      }
      c.fillStyle = `rgba(200,0,0,${0.5 + Math.random() * 0.5})`;
      c.font = 'bold 34px "Special Elite", monospace';
      c.textAlign = 'center';
      c.fillText('LOOK UP', W / 2, 40);
      c.fillText('LOOK UP', W / 2 + rand(-3, 3), H - 20);
    } else if (this.mode === 'message' && this.message) {
      c.fillStyle = '#0d1117'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#9aa4b2'; c.font = '13px sans-serif'; c.textAlign = 'center';
      c.fillText(this.clock || '2:15', W / 2, 22);
      c.fillStyle = '#1f2937';
      roundRect(c, 8, 50, W - 16, 210, 16); c.fill();
      c.textAlign = 'left';
      c.fillStyle = this.message.from === 'Unknown' ? '#ff6b6b' : '#7cc4ff';
      c.font = 'bold 22px sans-serif';
      c.fillText(this.message.from, 18, 84);
      c.fillStyle = '#e5e7eb'; c.font = '22px sans-serif';
      wrap(c, this.message.text, 18, 118, W - 36, 27);
    } else {
      // tiny auto-runner game: the score keeps climbing while you hold the phone
      c.fillStyle = '#10142a'; c.fillRect(0, 0, W, H);
      const gy = 250;
      c.fillStyle = '#2b3a6b'; c.fillRect(0, gy, W, 3);
      for (const o of this.obstacles) {
        o.x -= 160 * (1 / 20);
        if (o.x < -20) o.x = W + rand(40, 160);
        c.fillStyle = '#ff5d73'; c.fillRect(o.x, gy - 22, 14, 22);
        if (o.x > 30 && o.x < 70 && this.runnerY === 0) this.runnerV = 330;
      }
      this.runnerV -= 900 * (1 / 20);
      this.runnerY = Math.max(0, this.runnerY + this.runnerV * (1 / 20));
      if (this.runnerY === 0) this.runnerV = Math.max(0, this.runnerV);
      c.fillStyle = '#ffd166'; c.fillRect(40, gy - 22 - this.runnerY, 18, 22);
      c.fillStyle = '#e5e7eb'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center';
      c.fillText('SCORE ' + Math.floor(this.score), W / 2, 50);
      c.font = '12px sans-serif'; c.fillStyle = '#8b93b0';
      c.fillText('BLOCK JUMPER', W / 2, 75);
    }
    this.tex.needsUpdate = true;
  }
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
}

function wrap(c, text, x, y, maxW, lh) {
  const words = text.split(' ');
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (c.measureText(test).width > maxW && line) { c.fillText(line, x, y); line = w; y += lh; }
    else line = test;
  }
  if (line) c.fillText(line, x, y);
}
