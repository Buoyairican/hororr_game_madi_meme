// Procedural canvas textures: everything in the room is painted at start-up,
// so the game needs no image downloads except the teacher's face.
import * as THREE from 'three';
import { rand, randInt, pick } from './util.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function tex(c, repeatX = 1, repeatY = 1, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeatX, repeatY);
  t.anisotropy = 4;
  return t;
}

function speckle(ctx, w, h, n, alphaMax, light = false) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * alphaMax;
    ctx.fillStyle = light ? `rgba(255,255,240,${a})` : `rgba(0,0,0,${a})`;
    const s = Math.random() < 0.9 ? 1 : randInt(2, 4);
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}

function stains(ctx, w, h, n, color, rMin, rMax) {
  for (let i = 0; i < n; i++) {
    const x = Math.random() * w, y = Math.random() * h, r = rand(rMin, rMax);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

export function floorTexture() {
  const c = canvas(512, 512), x = c.getContext('2d');
  const tiles = 4, s = 512 / tiles;
  for (let i = 0; i < tiles; i++) for (let j = 0; j < tiles; j++) {
    const base = (i + j) % 2 ? [92, 90, 78] : [70, 70, 62];
    const v = rand(-8, 8);
    x.fillStyle = `rgb(${base[0] + v},${base[1] + v},${base[2] + v})`;
    x.fillRect(i * s, j * s, s, s);
  }
  speckle(x, 512, 512, 9000, 0.25);
  speckle(x, 512, 512, 1500, 0.08, true);
  stains(x, 512, 512, 14, 'rgba(20,18,10,0.25)', 20, 90);
  x.strokeStyle = 'rgba(15,15,10,0.6)'; x.lineWidth = 3;
  for (let i = 0; i <= tiles; i++) {
    x.beginPath(); x.moveTo(i * s, 0); x.lineTo(i * s, 512); x.stroke();
    x.beginPath(); x.moveTo(0, i * s); x.lineTo(512, i * s); x.stroke();
  }
  x.strokeStyle = 'rgba(0,0,0,0.15)'; x.lineWidth = 1;
  for (let i = 0; i < 40; i++) { // scuffs
    x.beginPath(); const px = rand(0, 512), py = rand(0, 512);
    x.moveTo(px, py); x.lineTo(px + rand(-60, 60), py + rand(-10, 10)); x.stroke();
  }
  return tex(c, 8.4, 11);
}

export function wallTexture() {
  const c = canvas(512, 512), x = c.getContext('2d');
  x.fillStyle = '#6f7b6c'; x.fillRect(0, 0, 512, 512);
  speckle(x, 512, 512, 12000, 0.12);
  stains(x, 512, 512, 18, 'rgba(60,55,30,0.18)', 30, 120);
  // drips / water streaks
  for (let i = 0; i < 16; i++) {
    const px = rand(0, 512), len = rand(60, 300);
    const g = x.createLinearGradient(px, 0, px, len);
    g.addColorStop(0, 'rgba(40,40,20,0.22)'); g.addColorStop(1, 'rgba(40,40,20,0)');
    x.fillStyle = g; x.fillRect(px, 0, rand(2, 6), len);
  }
  return tex(c, 3, 1);
}

export function wainscotTexture() {
  const c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#2e3a33'; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 5000, 0.2);
  x.fillStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i < 256; i += 32) x.fillRect(i, 0, 2, 256);
  stains(x, 256, 256, 8, 'rgba(0,0,0,0.25)', 20, 60);
  return tex(c, 10, 1);
}

export function ceilingTexture() {
  const c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#9a9a8e'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { x.fillStyle = `rgba(40,40,30,${rand(0.1, 0.4)})`; x.fillRect(rand(0, 256), rand(0, 256), 1.5, 1.5); }
  stains(x, 256, 256, 3, 'rgba(110,90,40,0.35)', 15, 50);
  x.strokeStyle = '#55554b'; x.lineWidth = 4; x.strokeRect(0, 0, 256, 256);
  return tex(c, 16, 21);
}

export function woodTexture(light = false) {
  const c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = light ? '#8a6a45' : '#5b4128'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) {
    x.strokeStyle = `rgba(${light ? 60 : 30},${light ? 40 : 18},10,${rand(0.08, 0.3)})`;
    x.lineWidth = rand(0.5, 2.5);
    x.beginPath();
    const y0 = rand(0, 256);
    x.moveTo(0, y0);
    for (let px = 0; px <= 256; px += 32) x.lineTo(px, y0 + Math.sin(px * 0.02 + i) * rand(1, 5));
    x.stroke();
  }
  speckle(x, 256, 256, 2000, 0.12);
  // carved graffiti
  x.strokeStyle = 'rgba(20,10,0,0.35)'; x.lineWidth = 1.5;
  x.font = '22px monospace'; x.fillStyle = 'rgba(25,12,2,0.35)';
  x.fillText(pick(['HELP', 'JT+MK', 'RUN', '13', 'NO', ':(']), rand(20, 160), rand(40, 230));
  return tex(c, 1, 1);
}

export function metalTexture() {
  const c = canvas(64, 64), x = c.getContext('2d');
  x.fillStyle = '#6d6f70'; x.fillRect(0, 0, 64, 64);
  speckle(x, 64, 64, 600, 0.3);
  return tex(c);
}

export function softDot() {
  const c = canvas(64, 64), x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  return t;
}

export function coneGradient() {
  const c = canvas(64, 256), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 256);
  // fade the sides
  const s = x.createLinearGradient(0, 0, 64, 0);
  s.addColorStop(0, 'rgba(0,0,0,1)'); s.addColorStop(0.3, 'rgba(0,0,0,0)'); s.addColorStop(0.7, 'rgba(0,0,0,0)'); s.addColorStop(1, 'rgba(0,0,0,1)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = s; x.fillRect(0, 0, 64, 256);
  return new THREE.CanvasTexture(c);
}

export function posterTexture(kind) {
  const c = canvas(256, 360), x = c.getContext('2d');
  const paper = { rules: '#d9d2b8', silence: '#2a3b5a', missing: '#e6e2d6', eyes: '#7a1d16', atoms: '#cfd8c8' }[kind] || '#ddd';
  x.fillStyle = paper; x.fillRect(0, 0, 256, 360);
  x.textAlign = 'center';
  const ink = kind === 'silence' || kind === 'eyes' ? '#ece6d2' : '#1d1b16';
  x.fillStyle = ink;
  if (kind === 'rules') {
    x.font = 'bold 30px "Special Elite", monospace'; x.fillText('CLASS RULES', 128, 50);
    x.font = '19px "Special Elite", monospace'; x.textAlign = 'left';
    ['1. NO TALKING', '2. NO PHONES', '3. EYES ON', '   THE BOARD', '4. DO NOT LOOK', '   AT HIS HANDS', '5. NOBODY', '   LEAVES EARLY'].forEach((l, i) => x.fillText(l, 22, 100 + i * 30));
    x.fillStyle = 'rgba(140,0,0,0.75)'; x.font = '26px "Caveat", cursive'; x.fillText('he means it', 120, 345);
  } else if (kind === 'silence') {
    x.font = 'bold 46px "Special Elite", monospace'; x.fillText('SILENCE', 128, 150);
    x.font = '30px "Special Elite", monospace'; x.fillText('IS', 128, 195); x.fillText('GOLDEN', 128, 240);
    x.fillStyle = '#c9a33a'; x.beginPath(); x.arc(128, 300, 24, 0, Math.PI * 2); x.fill();
  } else if (kind === 'missing') {
    x.font = 'bold 44px "Special Elite", monospace'; x.fillStyle = '#8a1010'; x.fillText('MISSING', 128, 52);
    x.fillStyle = '#999'; x.fillRect(58, 72, 140, 150);
    x.fillStyle = '#444'; x.beginPath(); x.arc(128, 135, 38, 0, Math.PI * 2); x.fill(); x.fillRect(80, 180, 96, 42);
    x.fillStyle = '#1d1b16'; x.font = '24px "Special Elite", monospace'; x.fillText('MR. HALE', 128, 255);
    x.font = '15px "Special Elite", monospace'; x.fillText('Teacher, Room 13', 128, 282); x.fillText('Last seen: Monday', 128, 304); x.fillText('after class', 128, 324);
  } else if (kind === 'eyes') {
    x.font = 'bold 34px "Special Elite", monospace'; x.fillText('EYES ON', 128, 80); x.fillText('THE BOARD', 128, 122);
    for (let i = 0; i < 2; i++) {
      x.fillStyle = '#ece6d2'; x.beginPath(); x.ellipse(84 + i * 88, 220, 34, 22, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#000'; x.beginPath(); x.arc(84 + i * 88, 220, 15, 0, Math.PI * 2); x.fill();
    }
    x.fillStyle = '#ece6d2'; x.font = '18px "Special Elite", monospace'; x.fillText('HE IS WATCHING', 128, 310);
  } else {
    x.font = 'bold 26px "Special Elite", monospace'; x.fillText('THE HUMAN BODY', 128, 44);
    x.strokeStyle = '#333'; x.lineWidth = 3;
    x.beginPath(); x.arc(128, 105, 28, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(128, 133); x.lineTo(128, 250); x.moveTo(128, 160); x.lineTo(70, 260); x.moveTo(128, 160); x.lineTo(186, 260);
    x.moveTo(128, 250); x.lineTo(95, 335); x.moveTo(128, 250); x.lineTo(161, 335); x.stroke();
    x.font = '13px "Special Elite", monospace'; x.fillText('ARMS: TOO LONG?', 128, 300);
  }
  speckle(x, 256, 360, 3000, 0.15);
  stains(x, 256, 360, 4, 'rgba(90,70,20,0.25)', 20, 60);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function clockTexture() {
  const c = canvas(256, 256), x = c.getContext('2d');
  x.fillStyle = '#e9e5d6'; x.beginPath(); x.arc(128, 128, 124, 0, Math.PI * 2); x.fill();
  x.fillStyle = '#1b1b1b'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = 'bold 30px serif';
  for (let i = 1; i <= 12; i++) {
    const a = i / 12 * Math.PI * 2;
    x.fillText(String(i), 128 + Math.sin(a) * 96, 128 - Math.cos(a) * 96);
  }
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, r1 = i % 5 ? 116 : 110;
    x.lineWidth = i % 5 ? 1 : 3; x.strokeStyle = '#222';
    x.beginPath(); x.moveTo(128 + Math.sin(a) * r1, 128 - Math.cos(a) * r1); x.lineTo(128 + Math.sin(a) * 121, 128 - Math.cos(a) * 121); x.stroke();
  }
  stains(x, 256, 256, 3, 'rgba(80,60,20,0.25)', 20, 50);
  const t = tex(c); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function outsideTexture() {
  const c = canvas(256, 512), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#0a1020'); g.addColorStop(0.6, '#0d1526'); g.addColorStop(1, '#05070b');
  x.fillStyle = g; x.fillRect(0, 0, 256, 512);
  // distant tree line / buildings
  x.fillStyle = '#030406';
  for (let px = 0; px < 256; px += 8) { const h = rand(40, 140); x.fillRect(px, 512 - h - 60, 9, h + 60); }
  return tex(c, 1, 1);
}

export function rainTexture() {
  const c = canvas(128, 256), x = c.getContext('2d');
  x.clearRect(0, 0, 128, 256);
  for (let i = 0; i < 160; i++) {
    const px = rand(0, 128), py = rand(0, 256), len = rand(8, 30);
    x.strokeStyle = `rgba(180,200,230,${rand(0.08, 0.35)})`; x.lineWidth = rand(0.5, 1.4);
    x.beginPath(); x.moveTo(px, py); x.lineTo(px - 1, py + len); x.stroke();
  }
  for (let i = 0; i < 40; i++) { // droplets on the glass
    x.fillStyle = `rgba(200,220,255,${rand(0.1, 0.3)})`;
    x.beginPath(); x.arc(rand(0, 128), rand(0, 256), rand(0.8, 2.2), 0, Math.PI * 2); x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** faces for seated classmates; kind: 'sam' | 'nora' | 'blank' */
export function faceTexture(kind) {
  const c = canvas(256, 256), x = c.getContext('2d');
  const skin = kind === 'sam' ? '#b88a64' : kind === 'nora' ? '#d2a07c' : '#b9b6ad';
  x.fillStyle = skin; x.fillRect(0, 0, 256, 256);
  speckle(x, 256, 256, 1500, 0.08);
  // three.js SphereGeometry puts local +z (the front) at u = 0.25
  const cx = 64, cy = 128;
  if (kind === 'blank') {
    // hollow eye pits, no mouth
    for (const dx of [-20, 20]) {
      const g = x.createRadialGradient(cx + dx, cy - 2, 0, cx + dx, cy - 2, 13);
      g.addColorStop(0, 'rgba(0,0,0,0.95)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(cx + dx - 14, cy - 16, 28, 28);
    }
  } else {
    for (const dx of [-17, 17]) {
      x.fillStyle = '#f2efe6'; x.beginPath(); x.ellipse(cx + dx, cy - 4, 8, 5, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#2a1a10'; x.beginPath(); x.arc(cx + dx, cy - 4, 3.6, 0, Math.PI * 2); x.fill();
      x.strokeStyle = 'rgba(40,20,10,0.8)'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx + dx - 9, cy - 15); x.lineTo(cx + dx + 8, cy - 14 - (dx > 0 ? 2 : 0)); x.stroke();
    }
    x.strokeStyle = 'rgba(80,30,25,0.8)'; x.lineWidth = 2.5;
    x.beginPath(); x.moveTo(cx - 9, cy + 26); x.quadraticCurveTo(cx, cy + 29, cx + 9, cy + 26); x.stroke();
    x.fillStyle = 'rgba(80,40,20,0.25)'; x.beginPath(); x.ellipse(cx, cy + 10, 5, 8, 0, 0, Math.PI * 2); x.fill();
  }
  const t = tex(c); t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export function fabricTexture(color) {
  const c = canvas(128, 128), x = c.getContext('2d');
  x.fillStyle = color; x.fillRect(0, 0, 128, 128);
  speckle(x, 128, 128, 3000, 0.18);
  speckle(x, 128, 128, 800, 0.06, true);
  return tex(c, 2, 2);
}

export function bookSpines() {
  const c = canvas(256, 128), x = c.getContext('2d');
  let px = 0;
  while (px < 256) {
    const w = randInt(8, 22);
    x.fillStyle = pick(['#4a1c1c', '#1c2f4a', '#2f4a1c', '#4a401c', '#2b2b2b', '#5a3a2a', '#3a2a5a']);
    x.fillRect(px, rand(0, 20), w, 128);
    x.fillStyle = 'rgba(255,255,255,0.15)'; x.fillRect(px + 2, 40, w - 4, 3);
    px += w + 1;
  }
  speckle(x, 256, 128, 1500, 0.2);
  return tex(c);
}
