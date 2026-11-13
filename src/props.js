// Classroom props with behaviour: Madi's laptop, the ceiling projector that
// mirrors it (he has no idea), and the classroom door.
import * as THREE from 'three';
import { damp, rand } from './util.js';

const box = new THREE.BoxGeometry(1, 1, 1);

export function buildLaptop(scene, x, y, z) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  const shell = new THREE.MeshStandardMaterial({ color: 0x2a2d31, roughness: 0.45, metalness: 0.6 });
  const base = new THREE.Mesh(box, shell);
  base.scale.set(0.34, 0.016, 0.24); base.position.y = 0.008;
  g.add(base);
  const keys = new THREE.Mesh(new THREE.PlaneGeometry(0.29, 0.11), new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.8 }));
  keys.rotation.x = -Math.PI / 2; keys.position.set(0, 0.0165, -0.035);
  g.add(keys);
  // lid hinges on the classroom side, so the screen faces the teacher and the back faces the class
  const lid = new THREE.Group();
  lid.position.set(0, 0.016, 0.115);
  lid.rotation.x = -Math.PI / 2;
  g.add(lid);
  const lidMesh = new THREE.Mesh(box, shell);
  lidMesh.scale.set(0.34, 0.225, 0.007); lidMesh.position.y = 0.1125;
  lid.add(lidMesh);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.315, 0.195), screenMat);
  screen.rotation.y = Math.PI; screen.position.set(0, 0.113, -0.0042);
  lid.add(screen);
  const sticker = new THREE.Mesh(new THREE.CircleGeometry(0.022, 12), new THREE.MeshBasicMaterial({ color: 0x33363a, fog: false }));
  sticker.position.set(0, 0.115, 0.0042);
  lid.add(sticker);
  scene.add(g);
  const L = {
    group: g, open: 0, openTarget: 0, glow: 0, glowTarget: 0,
    keyL: new THREE.Vector3(x + 0.075, y + 0.045, z - 0.03), keyR: new THREE.Vector3(x - 0.075, y + 0.045, z - 0.03),
    screenPos: new THREE.Vector3(x, y + 0.14, z + 0.08),
    lightPos: new THREE.Vector3(x, y + 0.2, z - 0.12),
    update(dt, t) {
      L.open = damp(L.open, L.openTarget, 6, dt);
      lid.rotation.x = -Math.PI / 2 + L.open * (Math.PI / 2 + 0.28);
      L.glow = damp(L.glow, L.glowTarget * (L.open > 0.6 ? 1 : 0), 8, dt);
      const k = L.glow * (0.9 + 0.1 * Math.sin(t * 31));
      screenMat.color.setRGB(0.55 * k, 0.7 * k, 0.95 * k);
      sticker.material.color.setRGB(0.2 + 0.5 * L.glow, 0.21 + 0.55 * L.glow, 0.23 + 0.6 * L.glow);
    },
    reset() { L.open = L.openTarget = 0; L.glow = L.glowTarget = 0; },
  };
  return L;
}

export class Projector {
  /** screen is centred at (cx, cy) on the front wall (z = wallZ) */
  constructor(scene, cx, cy, w, h, wallZ, ceilingY) {
    this.W = 512; this.H = Math.round(512 * h / w);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W; this.canvas.height = this.H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.anisotropy = 4;
    const frame = new THREE.MeshStandardMaterial({ color: 0x1b1d1e, roughness: 0.6 });
    const roll = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, w + 0.12, 8), frame);
    roll.rotation.z = Math.PI / 2; roll.position.set(cx, cy + h / 2 + 0.04, wallZ + 0.06);
    scene.add(roll);
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ color: 0x9c9d98, roughness: 0.95 }));
    sheet.position.set(cx, cy, wallZ + 0.045);
    scene.add(sheet);
    this.imageMat = new THREE.MeshBasicMaterial({ map: this.tex, fog: false, transparent: true, opacity: 0, toneMapped: false });
    const image = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.96, h * 0.94), this.imageMat);
    image.position.set(cx, cy, wallZ + 0.05);
    scene.add(image);
    // the device on the ceiling and its beam
    const dev = new THREE.Group();
    this.devPos = new THREE.Vector3(cx + 0.35, ceilingY - 0.2, wallZ + 2.7);
    dev.position.copy(this.devPos);
    const body = new THREE.Mesh(box, frame); body.scale.set(0.3, 0.11, 0.26);
    dev.add(body);
    const pole = new THREE.Mesh(box, frame); pole.scale.set(0.03, 0.15, 0.03); pole.position.y = 0.13;
    dev.add(pole);
    this.lensMat = new THREE.MeshBasicMaterial({ color: 0x111111, fog: false });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), this.lensMat);
    lens.position.set(0, 0, -0.131); lens.rotation.y = Math.PI;
    dev.add(lens);
    scene.add(dev);
    // beam: a thin pyramid from the lens to the screen corners
    const o = new THREE.Vector3(this.devPos.x, this.devPos.y, this.devPos.z - 0.14);
    const c = [[-1, 1], [1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => new THREE.Vector3(cx + sx * w * 0.48, cy + sy * h * 0.47, wallZ + 0.06));
    const pos = [];
    for (let i = 0; i < 4; i++) { const a = c[i], b = c[(i + 1) % 4]; pos.push(o.x, o.y, o.z, a.x, a.y, a.z, b.x, b.y, b.z); }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.beamMat = new THREE.MeshBasicMaterial({ color: 0xbfd4ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
    scene.add(new THREE.Mesh(bg, this.beamMat));
    this.centre = new THREE.Vector3(cx, cy, wallZ + 0.1);
    this.on = false; this.level = 0; this.flicker = 0;
    this.noSignal();
  }

  setOn(on) { this.on = on; if (on) this.flicker = 0.5; }
  reset() { this.on = false; this.level = 0; this.noSignal(); }

  update(dt, master = 1) {
    this.level = damp(this.level, this.on ? 1 : 0, 9, dt);
    let k = this.level;
    if (this.flicker > 0) { this.flicker -= dt; k *= Math.random() < 0.4 ? 0.2 : 1; }
    this.imageMat.opacity = k * 0.92;
    this.beamMat.opacity = k * 0.035;
    this.lensMat.color.setScalar(0.07 + k * 0.93);
  }

  // ------------------------------------------------------------ pages
  chrome(title) {
    const c = this.ctx, W = this.W, H = this.H;
    c.fillStyle = '#eceae2'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#3a3d42'; c.fillRect(0, 0, W, 34);
    c.fillStyle = '#c9ccd2'; c.font = '16px sans-serif'; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(title || 'Search', 14, 18);
    for (let i = 0; i < 3; i++) { c.fillStyle = ['#e06c5a', '#e0b44a', '#6cbf5a'][i]; c.beginPath(); c.arc(W - 20 - i * 20, 17, 6, 0, 7); c.fill(); }
    c.textBaseline = 'alphabetic';
  }

  noSignal() {
    const c = this.ctx;
    c.fillStyle = '#10214d'; c.fillRect(0, 0, this.W, this.H);
    c.fillStyle = '#c8d4ff'; c.font = 'bold 40px sans-serif'; c.textAlign = 'center';
    c.fillText('NO SIGNAL', this.W / 2, this.H / 2 + 14);
    this.tex.needsUpdate = true;
  }

  /** the search page: what he has typed so far and (optionally) the answer he got */
  search(typed, result, note) {
    const c = this.ctx, W = this.W, H = this.H;
    this.chrome('Search');
    c.fillStyle = '#fff'; c.strokeStyle = '#8a8d92'; c.lineWidth = 3;
    c.beginPath(); c.roundRect(20, 52, W - 40, 62, 31); c.fill(); c.stroke();
    c.fillStyle = '#1c1d20'; c.textAlign = 'left';
    let size = 36;
    c.font = `${size}px sans-serif`;
    while (c.measureText(typed + '|').width > W - 96 && size > 18) { size -= 2; c.font = `${size}px sans-serif`; }
    c.fillText(typed + (result ? '' : '|'), 48, 96);
    if (note) { c.fillStyle = '#b3261e'; c.font = 'italic 22px sans-serif'; c.fillText(note, 30, 146); }
    if (result) {
      c.fillStyle = '#1a3fa0'; c.font = 'bold 38px sans-serif';
      const lines = wrap(c, result, W - 60);
      lines.slice(0, 3).forEach((l, i) => c.fillText(l, 30, (note ? 190 : 170) + i * 44));
    }
    this.tex.needsUpdate = true;
  }

  /** his recent searches (the reveal) */
  history(list, highlight = -1) {
    const c = this.ctx, W = this.W;
    this.chrome('History');
    c.textAlign = 'left';
    c.fillStyle = '#55585e'; c.font = 'bold 24px sans-serif'; c.fillText('Recent searches', 26, 66);
    list.forEach((l, i) => {
      c.fillStyle = i === highlight ? '#b3261e' : '#1c1d20';
      c.font = (i === highlight ? 'bold ' : '') + '26px sans-serif';
      c.fillText('🕘 ' + l, 30, 104 + i * 36);
    });
    this.tex.needsUpdate = true;
  }

  news() {
    const c = this.ctx, W = this.W, H = this.H;
    this.chrome('Local News');
    c.fillStyle = '#b3261e'; c.font = 'bold 40px sans-serif'; c.textAlign = 'left';
    c.fillText('TEACHER MISSING', 24, 82);
    c.fillStyle = '#1c1d20'; c.font = '22px sans-serif';
    wrap(c, 'Mr. Hale, Room 13, was last seen on Friday after class. He never goes anywhere without his glasses.', W - 210).forEach((l, i) => c.fillText(l, 24, 116 + i * 28));
    // photo: a man with round glasses
    const px = W - 172, py = 96;
    c.fillStyle = '#b8b5aa'; c.fillRect(px, py, 150, H - py - 18);
    c.fillStyle = '#5b5850'; c.beginPath(); c.ellipse(px + 75, py + 62, 36, 44, 0, 0, 7); c.fill();
    c.fillRect(px + 22, py + 112, 106, 80);
    c.strokeStyle = '#111'; c.lineWidth = 4;
    c.beginPath(); c.arc(px + 59, py + 58, 13, 0, 7); c.stroke();
    c.beginPath(); c.arc(px + 91, py + 58, 13, 0, 7); c.stroke();
    c.beginPath(); c.moveTo(px + 72, py + 58); c.lineTo(px + 78, py + 58); c.stroke();
    this.tex.needsUpdate = true;
  }

  glitch(text) {
    const c = this.ctx, W = this.W, H = this.H;
    c.fillStyle = '#000'; c.fillRect(0, 0, W, H);
    for (let i = 0; i < 26; i++) {
      c.fillStyle = `rgba(${rand(120, 255) | 0},${rand(0, 60) | 0},${rand(0, 60) | 0},${rand(0.2, 0.9)})`;
      c.fillRect(rand(-40, W), rand(0, H), rand(40, 300), rand(2, 16));
    }
    if (text) {
      c.fillStyle = '#fff'; c.font = 'bold 44px sans-serif'; c.textAlign = 'center';
      c.fillText(text, W / 2 + rand(-6, 6), H / 2 + rand(-6, 6));
    }
    this.tex.needsUpdate = true;
  }
}

function wrap(c, text, maxW) {
  const out = [];
  let line = '';
  for (const w of text.split(' ')) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}

export function buildDoor(scene, M, x1, doorZ) {
  const frame = M.frame;
  const add = (sx, sy, sz, px, py, pz) => { const m = new THREE.Mesh(box, frame); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); scene.add(m); };
  add(0.1, 0.08, 1.16, x1 - 0.03, 2.12, doorZ);
  add(0.1, 2.16, 0.08, x1 - 0.03, 1.08, doorZ - 0.54);
  add(0.1, 2.16, 0.08, x1 - 0.03, 1.08, doorZ + 0.54);
  // the corridor beyond is pitch black
  const dark = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.08), new THREE.MeshBasicMaterial({ color: 0x010102, fog: false }));
  dark.position.set(x1 - 0.012, 1.04, doorZ); dark.rotation.y = -Math.PI / 2;
  scene.add(dark);
  const g = new THREE.Group();
  g.position.set(x1 - 0.045, 0, doorZ - 0.5);
  const leaf = new THREE.Mesh(box, M.darkWood);
  leaf.scale.set(0.045, 2.06, 0.99); leaf.position.set(0, 1.04, 0.5);
  leaf.castShadow = true;
  g.add(leaf);
  const handle = new THREE.Mesh(box, M.alu);
  handle.scale.set(0.06, 0.035, 0.13); handle.position.set(-0.05, 1.0, 0.86);
  g.add(handle);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.45), new THREE.MeshStandardMaterial({ color: 0x05080a, roughness: 0.1, metalness: 0.5 }));
  glass.position.set(-0.026, 1.62, 0.5); glass.rotation.y = -Math.PI / 2;
  g.add(glass);
  scene.add(g);
  const D = {
    group: g, glass, open: 0, openTarget: 0,
    pos: new THREE.Vector3(x1 - 0.1, 1.2, doorZ),
    update(dt) { D.open = damp(D.open, D.openTarget, 3.2, dt); g.rotation.y = -D.open * 1.45; },
    reset() { D.open = D.openTarget = 0; g.rotation.y = 0; },
  };
  return D;
}
