// The meme clips. Each one is an original cartoon drawn into a 270x480 frame at time t.
//   who / cap: the account and the caption under the video
//   dur: seconds; music: [sound, volume, loop?]; snd: [time, sound, volume]
//   loud: [from, to] windows when the clip is loud enough for him to hear across the room
//   draw(c, t, R, extra): R(i) is a stable random number for this play of the clip
const TAU = Math.PI * 2;
const cl = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const seg = (t, a, b) => cl((t - a) / (b - a));
const ease = (k) => k * k * (3 - 2 * k);
const lerp = (a, b, k) => a + (b - a) * k;
const W = 270, H = 480;

// ------------------------------------------------------------------ drawing kit
function bg(c, a, b) {
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  c.fillStyle = g; c.fillRect(0, 0, W, H);
}
function rect(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(x, y, w, h); }
function rr(c, x, y, w, h, r, col) {
  c.beginPath();
  c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath();
  c.fillStyle = col; c.fill();
}
function circ(c, x, y, r, col, stroke, lw = 2) {
  c.beginPath(); c.arc(x, y, Math.max(0.1, r), 0, TAU);
  if (col) { c.fillStyle = col; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function ell(c, x, y, rx, ry, col, rot = 0) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, TAU); c.fillStyle = col; c.fill(); }
function poly(c, pts, col, stroke, lw = 2) {
  c.beginPath(); c.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]);
  c.closePath();
  if (col) { c.fillStyle = col; c.fill(); }
  if (stroke) { c.strokeStyle = stroke; c.lineWidth = lw; c.stroke(); }
}
function ln(c, x1, y1, x2, y2, col, w) {
  c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2);
  c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.stroke();
}
function eye(c, x, y, r, lx = 0, ly = 0) {
  circ(c, x, y, r, '#fff', '#111', Math.max(1, r * 0.18));
  circ(c, x + lx * r * 0.42, y + ly * r * 0.42, r * 0.52, '#111');
  circ(c, x + lx * r * 0.42 - r * 0.16, y + ly * r * 0.42 - r * 0.2, r * 0.16, '#fff');
}
function shut(c, x, y, r) { c.beginPath(); c.arc(x, y - r * 0.2, r, 0.15 * Math.PI, 0.85 * Math.PI); c.strokeStyle = '#111'; c.lineWidth = Math.max(1.5, r * 0.3); c.stroke(); }
function shades(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  poly(c, [-22, -4, -2, -4, -4, 7, -18, 7], '#050505'); poly(c, [2, -4, 22, -4, 18, 7, 4, 7], '#050505');
  ln(c, -24, -4, 24, -4, '#050505', 3);
  ln(c, -17, -1, -10, -1, 'rgba(255,255,255,0.5)', 2); ln(c, 7, -1, 14, -1, 'rgba(255,255,255,0.5)', 2);
  c.restore();
}
function lines(c, s, maxW) {
  const words = String(s).split(' '), out = [];
  let line = '';
  for (const w of words) {
    const t = line ? line + ' ' + w : w;
    if (c.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t;
  }
  if (line) out.push(line);
  return out;
}
/** classic meme text: white, black outline */
function meme(c, s, y, size = 30, col = '#fff') {
  c.font = `900 ${size}px Impact, "Arial Black", "Segoe UI Black", sans-serif`;
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
  const L = lines(c, s.toUpperCase(), W - 24);
  L.forEach((l, i) => {
    const yy = y + (i - (L.length - 1) / 2) * size * 1.05;
    c.lineWidth = size / 5; c.strokeStyle = '#000'; c.strokeText(l, W / 2, yy);
    c.fillStyle = col; c.fillText(l, W / 2, yy);
  });
  c.textBaseline = 'alphabetic';
}
/** caption in a white bubble */
function bubble(c, s, y, size = 17) {
  c.font = `bold ${size}px "Segoe UI", Arial, sans-serif`;
  c.textAlign = 'center';
  const L = lines(c, s, W - 50);
  const h = L.length * size * 1.2 + 12;
  let w = 0; for (const l of L) w = Math.max(w, c.measureText(l).width);
  rr(c, W / 2 - w / 2 - 10, y - 6, w + 20, h, 10, '#fff');
  c.fillStyle = '#111';
  L.forEach((l, i) => c.fillText(l, W / 2, y + 6 + size * 0.85 + i * size * 1.2 - 4));
}
function say(c, s, x, y, size = 15) {
  c.font = `bold ${size}px "Segoe UI", Arial, sans-serif`; c.textAlign = 'center';
  const L = lines(c, s, 150);
  let w = 0; for (const l of L) w = Math.max(w, c.measureText(l).width);
  const h = L.length * size * 1.2 + 10;
  rr(c, x - w / 2 - 8, y - h, w + 16, h, 10, '#fff');
  poly(c, [x - 6, y - 1, x + 6, y - 1, x - 2, y + 10], '#fff');
  c.fillStyle = '#111';
  L.forEach((l, i) => c.fillText(l, x, y - h + 5 + size * 0.95 + i * size * 1.2));
}
function shake(c, k, t) { if (k > 0) c.translate(Math.sin(t * 97) * k, Math.cos(t * 83) * k); }
function zoom(c, cx, cy, k) { c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy); }
function deepfry(c, k) {
  if (k <= 0) return;
  c.save(); c.globalCompositeOperation = 'overlay';
  c.fillStyle = `rgba(255,70,0,${0.55 * k})`; c.fillRect(0, 0, W, H);
  c.restore();
  c.fillStyle = `rgba(255,0,0,${0.12 * k})`; c.fillRect(0, 0, W, H);
}
function sepia(c, k) {
  if (k <= 0) return;
  c.save(); c.globalCompositeOperation = 'color'; c.fillStyle = `rgba(150,100,40,${k})`; c.fillRect(0, 0, W, H); c.restore();
  c.fillStyle = `rgba(80,50,10,${0.2 * k})`; c.fillRect(0, 0, W, H);
}
function tbc(c, k) {
  if (k <= 0) return;
  c.save(); c.globalAlpha = k;
  const x = 14, y = 400;
  poly(c, [x, y, x + 34, y - 26, x + 34, y - 10, x + 190, y - 10, x + 190, y + 10, x + 34, y + 10, x + 34, y + 26], '#f6d743', '#222', 2);
  c.fillStyle = '#222'; c.font = '900 15px Impact, "Arial Black", sans-serif'; c.textAlign = 'left';
  c.fillText('TO BE', x + 42, y - 0); c.fillText('CONTINUED', x + 92, y + 6);
  c.restore();
}
function rays(c, cx, cy, t, a, b, n = 14) {
  rect(c, 0, 0, W, H, a);
  c.fillStyle = b;
  for (let i = 0; i < n; i++) {
    const a0 = t + (i / n) * TAU;
    c.beginPath(); c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a0) * 700, cy + Math.sin(a0) * 700);
    c.lineTo(cx + Math.cos(a0 + TAU / n / 2) * 700, cy + Math.sin(a0 + TAU / n / 2) * 700);
    c.closePath(); c.fill();
  }
}
function starsAround(c, x, y, t, r = 22) {
  c.font = '14px sans-serif'; c.textAlign = 'center'; c.fillStyle = '#ffe14d';
  for (let i = 0; i < 4; i++) {
    const a = t * 5 + (i / 4) * TAU;
    c.fillText('★', x + Math.cos(a) * r, y + Math.sin(a) * r * 0.4);
  }
}
function clouds(c, t, y = 70, col = 'rgba(255,255,255,0.9)') {
  for (let i = 0; i < 3; i++) {
    const x = ((i * 120 + t * 12) % 380) - 60, yy = y + i * 28;
    ell(c, x, yy, 30, 13, col); ell(c, x + 20, yy - 8, 22, 14, col); ell(c, x + 38, yy, 26, 12, col);
  }
}
function grass(c, y = 380, a = '#5fb84a', b = '#3f8a33') { rect(c, 0, y, W, H - y, a); rect(c, 0, y, W, 6, b); }
function laughs(c, t, n = 6) {
  c.font = '22px sans-serif'; c.textAlign = 'center';
  for (let i = 0; i < n; i++) {
    const k = ((t * 0.7 + i / n) % 1);
    c.globalAlpha = 1 - k;
    c.fillText(['😂', '💀', '🤣'][i % 3], 30 + ((i * 53) % 220), 420 - k * 300);
  }
  c.globalAlpha = 1;
}
function limb(c, x, y, ang, len, col, w, end) {
  const ex = x + Math.sin(ang) * len, ey = y + Math.cos(ang) * len;
  ln(c, x, y, ex, ey, col, w);
  if (end) circ(c, ex, ey, w * 0.62, end);
  return [ex, ey];
}

// ------------------------------------------------------------------ characters
/** a person (bean style). x, y = feet. o: la ra ll rl (limb angles, 0 = down), skin shirt pants hair face */
function person(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); if (o.rot) c.rotate(o.rot);
  const skin = o.skin || '#e2b08a', shirt = o.shirt || '#3b82f6', pants = o.pants || '#2f3b52', hair = o.hair || '#3b2a1e';
  limb(c, -7, -50, o.ll ?? 0.12, 48, pants, 10, '#222');
  limb(c, 7, -50, o.rl ?? -0.12, 48, pants, 10, '#222');
  rr(c, -17, -98, 34, 54, 11, shirt);
  limb(c, -15, -90, o.la ?? 0.25, 40, shirt, 9, skin);
  limb(c, 15, -90, o.ra ?? -0.25, 40, shirt, 9, skin);
  const hx = o.hx || 0, hy = -116 + (o.hy || 0);
  circ(c, hx, hy, 18, skin);
  if (o.bun) circ(c, hx, hy - 20, 9, hair);
  c.beginPath(); c.arc(hx, hy - 2, 18.5, Math.PI * 1.05, Math.PI * 1.95); c.lineWidth = 9; c.strokeStyle = hair; c.stroke();
  const f = o.face || 'smile';
  if (f === 'shut') { shut(c, hx + 1, hy - 2, 4); shut(c, hx + 10, hy - 2, 4); }
  else if (f === 'x') { ln(c, hx - 2, hy - 6, hx + 4, hy, '#111', 2); ln(c, hx + 4, hy - 6, hx - 2, hy, '#111', 2); ln(c, hx + 8, hy - 6, hx + 14, hy, '#111', 2); ln(c, hx + 14, hy - 6, hx + 8, hy, '#111', 2); }
  else { circ(c, hx + 2, hy - 3, 2.6, '#111'); circ(c, hx + 11, hy - 3, 2.6, '#111'); }
  if (o.glasses) { circ(c, hx + 2, hy - 3, 6, null, '#222', 1.5); circ(c, hx + 12, hy - 3, 6, null, '#222', 1.5); }
  if (o.cool) shades(c, hx + 6, hy - 3, 0.5);
  if (f === 'o' || f === 'x') circ(c, hx + 7, hy + 8, 4, '#5a1a1a');
  else if (f === 'flat') ln(c, hx + 2, hy + 7, hx + 12, hy + 7, '#111', 2);
  else { c.beginPath(); c.arc(hx + 7, hy + 4, 6, 0.15 * Math.PI, 0.85 * Math.PI); c.strokeStyle = '#111'; c.lineWidth = 2; c.stroke(); }
  c.restore();
}

/** a cat. x, y = feet. o: col, eyes ('open' 'shut' 'wide' 'side'), tilt, shades, sit */
function cat(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); if (o.rot) c.rotate(o.rot);
  const col = o.col || '#f0a04b', dark = o.dark || '#c47629', t = o.t || 0;
  c.beginPath(); c.moveTo(-26, -16); c.quadraticCurveTo(-52, -26, -44 + Math.sin(t * 4) * 6, -56);
  c.strokeStyle = col; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
  ell(c, 0, -20, 30, 19, col);
  for (const lx of [-18, -6, 10, 22]) rr(c, lx - 4, -12, 9, 13, 4, col);
  ln(c, -12, -32, -4, -18, dark, 3); ln(c, 0, -34, 6, -20, dark, 3);
  c.save(); c.translate(24 + (o.hx || 0), -42 + (o.hy || 0)); c.rotate(o.tilt || 0); c.scale(o.head || 1, o.head || 1);
  poly(c, [-18, -10, -14, -32, -2, -16], col); poly(c, [18, -10, 14, -32, 2, -16], col);
  poly(c, [-15, -13, -13, -26, -6, -16], '#f7b8c4'); poly(c, [15, -13, 13, -26, 6, -16], '#f7b8c4');
  circ(c, 0, 0, 21, col);
  const e = o.eyes || 'open';
  if (e === 'shut') { shut(c, -8, -2, 5); shut(c, 8, -2, 5); }
  else if (e === 'wide') { eye(c, -8, -3, 8, 0, 0); eye(c, 8, -3, 8, 0, 0); }
  else if (e === 'side') { eye(c, -8, -3, 6, 1, 0); eye(c, 8, -3, 6, 1, 0); c.fillStyle = col; c.fillRect(-15, -12, 30, 6); }
  else { eye(c, -8, -3, 6, 0.3, 0.2); eye(c, 8, -3, 6, 0.3, 0.2); }
  poly(c, [-3, 5, 3, 5, 0, 9], '#e88');
  c.beginPath(); c.moveTo(-5, 12); c.quadraticCurveTo(0, 15, 0, 9); c.quadraticCurveTo(0, 15, 5, 12); c.strokeStyle = '#111'; c.lineWidth = 1.5; c.stroke();
  for (const sx of [-1, 1]) for (const k of [-1, 1]) ln(c, sx * 10, 8 + k * 2, sx * 28, 6 + k * 5, 'rgba(0,0,0,0.6)', 1);
  if (o.shades) shades(c, 0, -3, 0.75);
  c.restore();
  c.restore();
}

function dog(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); if (o.rot) c.rotate(o.rot);
  const col = o.col || '#b07a45', t = o.t || 0;
  ln(c, -28, -26, -44, -40 + Math.sin(t * 20) * 8, col, 7);
  ell(c, 0, -24, 32, 18, col);
  for (const lx of [-20, -8, 12, 24]) rr(c, lx - 4, -14, 9, 16, 4, col);
  c.save(); c.translate(28, -44); c.rotate(o.tilt || 0);
  circ(c, 0, 0, 19, col); ell(c, 14, 6, 14, 10, '#d9a874');
  ell(c, -12, 2, 7, 16, '#6e4a26', 0.3);
  eye(c, 4, -6, 5, 0.4, 0); circ(c, 25, 2, 5, '#111');
  if (o.tongue) ell(c, 18, 18, 5, 8, '#e8687c');
  c.restore();
  c.restore();
}

function frog(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s); if (o.rot) c.rotate(o.rot);
  ell(c, 0, -22, 32, 24, '#58b947'); ell(c, 0, -14, 22, 14, '#a8e08f');
  circ(c, -14, -44, 11, '#58b947'); circ(c, 14, -44, 11, '#58b947');
  eye(c, -14, -45, 8, o.lx || 0, 0); eye(c, 14, -45, 8, o.lx || 0, 0);
  c.beginPath(); c.arc(0, -26, 16, 0.15 * Math.PI, 0.85 * Math.PI); c.strokeStyle = '#1d4d17'; c.lineWidth = 2.5; c.stroke();
  c.restore();
}

function duck(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s);
  const st = Math.sin((o.t || 0) * 18);
  ln(c, -4, -10, -4 + st * 5, 0, '#f08a1c', 4); ln(c, 6, -10, 6 - st * 5, 0, '#f08a1c', 4);
  ell(c, 0, -24, 24, 16, '#fbfbf5'); poly(c, [-22, -30, -36, -36, -24, -20], '#fbfbf5');
  circ(c, 18, -44, 12, '#fbfbf5');
  poly(c, [26, -46, 42, -42 + (o.open ? -4 : 0), 26, -40], '#f08a1c');
  if (o.open) poly(c, [26, -40, 40, -36, 26, -38], '#d2700f');
  circ(c, 21, -48, 2.5, '#111');
  c.restore();
}

function goat(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, -10, -34, 34, 20, '#f2efe6');
  for (const lx of [-34, -20, 6, 16]) rr(c, lx - 3, -18, 7, 20, 3, '#e5e0d2');
  c.save(); c.translate(26, -56); c.rotate(o.turn ? -0.1 : 0.25); c.scale(o.big || 1, o.big || 1);
  ell(c, 0, 0, 13, 19, '#f2efe6');
  c.beginPath(); c.moveTo(-6, -14); c.quadraticCurveTo(-20, -34, -4, -36); c.strokeStyle = '#8b7c62'; c.lineWidth = 5; c.stroke();
  c.beginPath(); c.moveTo(6, -14); c.quadraticCurveTo(20, -34, 4, -36); c.stroke();
  ell(c, -14, -6, 9, 4, '#e5e0d2', -0.4); ell(c, 14, -6, 9, 4, '#e5e0d2', 0.4);
  const ey = o.turn ? 1 : 0;
  rr(c, -9, -6, 7, 6, 2, '#d8b23a'); rr(c, 2, -6, 7, 6, 2, '#d8b23a');
  rect(c, -8, -4, 5, 2, '#111'); rect(c, 3, -4, 5, 2, '#111');
  if (ey && o.scream) ell(c, 0, 12, 7, 9 * o.scream, '#4a1010');
  else ln(c, -4, 12, 4, 12, '#555', 2);
  poly(c, [-4, 16, 4, 16, 0, 30], '#ddd6c4');
  c.restore();
  c.restore();
}

function hamster(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 0, -26, 34, 28, '#e7a85c'); ell(c, 0, -16, 24, 16, '#fbe6c6');
  c.save(); c.translate(o.hx || 0, -50); c.rotate(o.tilt || 0);
  circ(c, -16, -18, 7, '#e7a85c'); circ(c, 16, -18, 7, '#e7a85c'); circ(c, -16, -18, 4, '#f7b8c4'); circ(c, 16, -18, 4, '#f7b8c4');
  ell(c, 0, 0, 22, 19, '#e7a85c'); ell(c, -11, 7, 9, 7, '#fbe6c6'); ell(c, 11, 7, 9, 7, '#fbe6c6');
  if (o.eyes === 'shut') { shut(c, -8, -2, 4); shut(c, 8, -2, 4); } else { circ(c, -8, -3, 3.4, '#111'); circ(c, 8, -3, 3.4, '#111'); circ(c, -9, -4, 1, '#fff'); circ(c, 7, -4, 1, '#fff'); }
  circ(c, 0, 4, 2, '#d76b7b');
  if (o.mouth) ell(c, 0, 10, 3, 3 * o.mouth, '#5a1a1a');
  c.restore();
  c.restore();
}

function capy(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  rr(c, -46, -52, 84, 50, 24, '#9b6a3f');
  rr(c, 18, -66, 44, 34, 15, '#9b6a3f'); rr(c, 46, -58, 18, 24, 8, '#865a33');
  circ(c, 26, -66, 5, '#7a5230');
  shut(c, 38, -54, 4); circ(c, 58, -52, 2, '#222');
  if (o.orange) { circ(c, 32, -78, 11, '#f48c1e'); ln(c, 32, -89, 34, -93, '#3a7a2a', 3); }
  c.restore();
}

function penguin(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.rotate(o.rot || 0); c.scale(s, s);
  ell(c, 0, -30, 18, 30, '#1c1f2b'); ell(c, 3, -26, 12, 23, '#fbfbfb');
  circ(c, 2, -58, 13, '#1c1f2b'); ell(c, 5, -56, 8, 8, '#fbfbfb');
  circ(c, 7, -58, 2.4, '#111'); poly(c, [11, -55, 20, -52, 11, -50], '#f2a33a');
  ell(c, -4, 0, 6, 3, '#f2a33a'); ell(c, 8, 0, 6, 3, '#f2a33a');
  ell(c, -16, -30, 5, 16, '#1c1f2b', 0.2 + (o.flap || 0));
  c.restore();
}

function pigeon(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ln(c, -2, -12, -2, 0, '#d46a5a', 3); ln(c, 8, -12, 8, 0, '#d46a5a', 3);
  ell(c, 0, -26, 24, 15, '#8d96a8'); poly(c, [-20, -30, -38, -24, -20, -20], '#6f7789');
  c.save(); c.translate(16 + (o.bob || 0), -42);
  ell(c, -4, 8, 9, 10, '#5b8f7a'); ell(c, -2, 12, 7, 6, '#7c5c9e');
  circ(c, 0, 0, 9, '#8d96a8'); circ(c, 3, -2, 2.2, '#e8742c'); circ(c, 3, -2, 1, '#111');
  poly(c, [8, 0, 15, 2, 8, 4], '#c9b9a0');
  c.restore();
  c.restore();
}

function chicken(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ln(c, -4, -14, -4, 0, '#e8a33a', 3); ln(c, 8, -14, 8, 0, '#e8a33a', 3);
  ell(c, 0, -30, 26, 20, '#fbf7ee'); poly(c, [-22, -36, -36, -46, -24, -24], '#fbf7ee');
  c.save(); c.translate(16, -54); c.rotate(o.turn || 0); c.scale(o.big || 1, o.big || 1);
  circ(c, 0, 0, 13, '#fbf7ee');
  circ(c, -4, -14, 5, '#e33'); circ(c, 2, -15, 5, '#e33'); circ(c, 7, -12, 4, '#e33');
  poly(c, [10, -2, 20, 2, 10, 5], '#e8a33a'); ell(c, 9, 9, 3, 5, '#e33');
  eye(c, o.turn ? 0 : 4, -3, 4, 1, 0);
  c.fillStyle = '#fbf7ee'; c.fillRect(o.turn ? -5 : -1, -9, 10, 4);
  c.restore();
  c.restore();
}

function owl(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s);
  ell(c, 0, -32, 24, 32, '#8a5a32'); ell(c, 0, -26, 16, 22, '#d9b48a');
  poly(c, [-20, -58, -14, -72, -8, -60], '#8a5a32'); poly(c, [20, -58, 14, -72, 8, -60], '#8a5a32');
  eye(c, -9, -48, 9, 0.2, 0);
  if (o.wink) shut(c, 9, -48, 7); else eye(c, 9, -48, 9, 0.2, 0);
  poly(c, [-3, -40, 3, -40, 0, -32], '#e8a33a');
  c.restore();
}

function seal(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 0, -30, 26, 40, '#8a99a6', -0.1);
  circ(c, 4, -70, 20, '#8a99a6');
  eye(c, -2, -74, 4.5, 0.4, 0); eye(c, 12, -74, 4.5, 0.4, 0);
  circ(c, 8, -64, 3, '#222');
  const a = o.clap || 0;
  ell(c, -16 + a * 10, -40, 6, 18, '#76858f', 1.1 - a * 0.9); ell(c, 24 - a * 10, -40, 6, 18, '#76858f', -1.1 + a * 0.9);
  ell(c, -12, 6, 14, 6, '#76858f'); ell(c, 12, 6, 14, 6, '#76858f');
  c.restore();
}

function fish(c, x, y, s, o = {}) {
  c.save(); c.translate(x, y); c.scale(o.flip ? -s : s, s); c.rotate(o.rot || 0);
  ell(c, 0, 0, 16, 10, '#ff8a2a'); poly(c, [-14, 0, -26, -10, -26, 10], '#ff6a1a');
  circ(c, 7, -3, 2.2, '#111');
  c.restore();
}

function cow(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  ell(c, 0, -30, 34, 20, '#fafafa');
  ell(c, -12, -34, 10, 8, '#222'); ell(c, 14, -26, 8, 7, '#222');
  for (const lx of [-24, -10, 12, 24]) rect(c, lx - 3, -14, 7, 14, '#eee');
  c.save(); c.translate(34, -44);
  ell(c, 0, 0, 13, 15, '#fafafa'); ell(c, 4, 9, 10, 7, '#f4b4b4'); circ(c, -2, -4, 2.4, '#111');
  poly(c, [-8, -12, -14, -20, -4, -14], '#d9c9a0');
  c.restore();
  c.restore();
}

function stoneHead(c, x, y, s) {
  c.save(); c.translate(x, y); c.scale(s, s);
  poly(c, [-40, 80, -46, -40, -30, -96, 30, -96, 40, -40, 34, 80], '#7d7f86');
  poly(c, [-30, -60, -4, -60, -4, -50, -30, -48], '#4c4e55');
  poly(c, [6, -60, 32, -60, 32, -48, 6, -50], '#4c4e55');
  poly(c, [-6, -50, 8, -50, 14, 10, -10, 10], '#6a6c72');
  rect(c, -20, 30, 40, 7, '#4c4e55');
  c.restore();
}

/** a little brainrot creature. kind: pencil shark banana chalk frog */
function creature(c, kind, x, y, s, t) {
  c.save(); c.translate(x, y); c.scale(s, s);
  const legs = (y0) => {
    const k = Math.sin(t * 16);
    limb(c, -10, y0, 0.4 * k, 34, '#f1c27d', 6); limb(c, 10, y0, -0.4 * k, 34, '#f1c27d', 6);
    ell(c, -10 + Math.sin(0.4 * k) * 34 + 6, y0 + 34, 12, 6, '#e8452f'); ell(c, 10 - Math.sin(0.4 * k) * 34 + 6, y0 + 34, 12, 6, '#2f6fe8');
  };
  if (kind === 'pencil') {
    legs(30);
    rect(c, -14, -70, 28, 100, '#f7c531'); rect(c, -14, -70, 9, 100, '#e8b11d');
    rect(c, -14, -84, 28, 14, '#bcbcbc'); rr(c, -14, -108, 28, 26, 8, '#f39bb0');
    poly(c, [-14, 30, 14, 30, 0, 56], '#f2d2a2'); poly(c, [-5, 46, 5, 46, 0, 56], '#333');
    eye(c, -6, -96, 5, 0, 0); eye(c, 7, -96, 5, 0, 0);
    const w = Math.sin(t * 22) * 0.6;
    ell(c, -30, -50, 26, 10, 'rgba(220,240,255,0.85)', -0.4 + w); ell(c, 30, -50, 26, 10, 'rgba(220,240,255,0.85)', 0.4 - w);
  } else if (kind === 'shark') {
    legs(18);
    ell(c, 0, -10, 50, 30, '#7b8fa6'); ell(c, 4, 2, 36, 16, '#e8eef2');
    poly(c, [-6, -36, 8, -66, 18, -34], '#7b8fa6'); poly(c, [-46, -12, -70, -34, -66, 6], '#7b8fa6');
    eye(c, 26, -18, 6, 0.4, 0);
    poly(c, [22, 4, 46, 2, 44, 8, 40, 4, 36, 8, 32, 4, 28, 8], '#fff');
    rr(c, -34, -36, 30, 36, 8, '#d93a3a'); rect(c, -30, -24, 22, 4, '#a12828');
  } else if (kind === 'banana') {
    legs(36);
    c.beginPath(); c.moveTo(-14, -80); c.quadraticCurveTo(-40, -10, 6, 40); c.quadraticCurveTo(-14, -10, 14, -80); c.closePath(); c.fillStyle = '#ffd93b'; c.fill();
    rr(c, -16, -30, 30, 40, 4, '#2b2f36');
    rect(c, -12, -26, 22, 8, '#9fd08a');
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) rect(c, -12 + i * 8, -14 + j * 8, 6, 6, '#c7ccd4');
    eye(c, -6, -58, 5, 0, 0); eye(c, 6, -58, 5, 0, 0);
    rect(c, -3, -88, 6, 10, '#6b4b1e');
  } else if (kind === 'chalk') {
    legs(30);
    rr(c, -16, -80, 32, 112, 10, '#f5f4ee');
    eye(c, -6, -50, 5, 0, 0); eye(c, 7, -50, 5, 0, 0);
    c.beginPath(); c.moveTo(-14, -36); c.quadraticCurveTo(-7, -44, 0, -38); c.quadraticCurveTo(7, -44, 14, -36); c.quadraticCurveTo(0, -30, -14, -36); c.fillStyle = '#2b1d12'; c.fill();
    ell(c, 0, -84, 24, 8, '#c0262d'); circ(c, 0, -92, 4, '#c0262d');
    for (let i = 0; i < 5; i++) circ(c, Math.sin(t * 3 + i * 2) * 34, 20 - ((t * 30 + i * 20) % 90), 7, 'rgba(255,255,255,0.5)');
  } else if (kind === 'frog') {
    const rot = t * 10;
    circ(c, 0, 40, 26, null, '#333', 5);
    for (let i = 0; i < 6; i++) ln(c, 0, 40, Math.cos(rot + i) * 24, 40 + Math.sin(rot + i) * 24, '#777', 2);
    ln(c, 0, 40, 0, 0, '#999', 5);
    frog(c, 0, 4, 1.1, { lx: 0.5 });
    ln(c, -20, -24, -34, -40 + Math.sin(t * 8) * 6, '#58b947', 6); ln(c, 20, -24, 34, -40 - Math.sin(t * 8) * 6, '#58b947', 6);
  }
  c.restore();
}

function brainrot(kind, name, voice, cap, who) {
  return {
    who, cap, dur: 8.5, music: ['v_mando', 0.55], snd: [[0.6, voice, 1], [4.4, 'm_boom', 0.7], [4.6, voice, 1]], loud: [[4.4, 5.6]],
    draw(c, t, R) {
      const hue = Math.floor(R(1) * 360);
      rays(c, 135, 220, t * 0.6, `hsl(${hue},85%,55%)`, `hsl(${(hue + 40) % 360},90%,65%)`);
      const boom = seg(t, 4.4, 4.7) * (1 - seg(t, 5.3, 6));
      c.save(); shake(c, boom * 6, t); zoom(c, 135, 240, 1 + boom * 0.35 + seg(t, 0, 8.5) * 0.15);
      const jx = kind === 'shark' ? Math.sin(t * 2) * 50 : 0;
      creature(c, kind, 135 + jx, 260 + Math.abs(Math.sin(t * 4)) * -18, 1.25, t);
      c.restore();
      deepfry(c, boom);
      c.save(); c.translate(135, 420); c.rotate(Math.sin(t * 3) * 0.05); c.translate(-135, -420);
      meme(c, name, 420, 28 + boom * 8, '#fff');
      c.restore();
    },
  };
}

// ------------------------------------------------------------------ the clips
export const CLIPS = [
  { // 0
    who: '@catvibes.official', cap: 'when the beat drops in class 🎧🔥', dur: 9, music: ['v_phonk', 0.32], snd: [[0.2, 'v_tts_beat', 1]], loud: [[4, 6]],
    draw(c, t, R) {
      const drop = t > 4;
      const beat = Math.abs(Math.sin((Math.PI * t) / 0.5));
      bg(c, drop ? `hsl(${(t * 120) % 360},70%,30%)` : '#2a1f3d', '#0d0a14');
      if (drop) for (let i = 0; i < 8; i++) { c.fillStyle = `hsla(${(i * 45 + t * 200) % 360},90%,60%,0.35)`; c.fillRect(i * 34, 0, 18, H); }
      c.save(); c.translate(135, 360); c.rotate(Math.sin(t * Math.PI * 2) * 0.05); c.translate(-135, -360);
      cat(c, 120, 380, 2.4, { col: R(2) < 0.5 ? '#f0a04b' : '#9a9a9f', dark: '#555', hy: -beat * 6, tilt: (drop ? 0.25 : 0.12) * Math.sin((Math.PI * t) / 0.5), eyes: drop ? 'open' : 'shut', shades: false, t });
      c.restore();
      if (t > 3.6) {
        const k = ease(seg(t, 3.6, 4.0));
        shades(c, 120 + 24 * 2.4, 380 - 42 * 2.4 - beat * 6 * 2.4 - 3 * 2.4 - (1 - k) * 200, 1.8);
      }
      meme(c, 'when the beat drops', 60, 30);
      if (drop) { c.font = '28px sans-serif'; c.textAlign = 'center'; for (let i = 0; i < 5; i++) c.fillText('🔥', 30 + i * 52, 450 - ((t * 80 + i * 40) % 120)); }
    },
  },
  { // 1
    who: '@boat.kid.aura', cap: 'aura farming on the way to school 🛶 +1000', dur: 9.5, music: ['v_phonk', 0.28], snd: [[2.6, 'v_tts_aura', 1]],
    draw(c, t) {
      bg(c, '#ffb36b', '#ff6f91');
      circ(c, 200, 150, 38, '#fff3b0');
      for (let i = 0; i < 4; i++) { c.fillStyle = `rgba(30,90,160,${0.6 + i * 0.1})`; c.beginPath(); c.moveTo(0, 300 + i * 30); for (let x = 0; x <= W; x += 10) c.lineTo(x, 300 + i * 30 + Math.sin(x / 30 + t * 2 + i) * 6); c.lineTo(W, H); c.lineTo(0, H); c.fill(); }
      const by = 320 + Math.sin(t * 2) * 5, rock = Math.sin(t * 2) * 0.05;
      c.save(); c.translate(135, by); c.rotate(rock); c.translate(-135, -by);
      poly(c, [30, by, 240, by, 210, by + 34, 60, by + 34], '#7a4a24');
      if (t > 2.5) { const a = 0.35 + Math.sin(t * 6) * 0.15; ell(c, 170, by - 60, 40, 70, `rgba(255,215,0,${a})`); }
      const sw = Math.sin(t * Math.PI * 2 / 1);
      person(c, 170, by, 0.95, { shirt: '#222', la: 2.2 + sw * 0.6, ra: -2.2 + sw * 0.6, cool: t > 2.5, face: 'smile', hy: Math.abs(sw) * -3 });
      person(c, 80, by, 0.8, { shirt: '#c33', la: 0.9, ra: -0.6, face: 'flat' });
      ln(c, 100, by - 40, 50, by + 10, '#5a3a1a', 4);
      c.restore();
      if (t > 2.6) { const k = seg(t, 2.6, 3.0); meme(c, '+' + Math.floor(1000 * k + Math.max(0, t - 3) * 900) + ' AURA', 80, 34 + Math.sin(t * 10) * 2, '#ffd700'); }
      else meme(c, 'POV: you are the main character', 80, 24);
    },
  },
  { // 2
    who: '@math.class.67', cap: 'teacher: what comes after 5? 💀', dur: 7.5, snd: [[2.1, 'm_67_b', 1], [2.4, 'm_boom', 0.6], [4.3, 'm_67_g', 0.9], [4.5, 'v_laugh', 0.6]], loud: [[2.1, 3.2], [4.3, 5.6]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#e8dcc4');
      rect(c, 20, 40, 230, 120, '#25443a'); rect(c, 20, 160, 230, 8, '#8a6a42');
      c.fillStyle = '#f2f2e6'; c.font = '28px "Comic Sans MS", cursive'; c.textAlign = 'center'; c.fillText('5 + 1 = ?', 135, 110);
      person(c, 60, 400, 1.0, { shirt: '#555', pants: '#333', ra: -1.5, face: 'flat', glasses: true });
      if (t < 2) say(c, 'What comes after 5?', 90, 250);
      const up = t > 2.0;
      const k = Math.sin(t * 9);
      c.save(); if (up) { shake(c, 2, t); }
      person(c, 195, 400, 1.0, { shirt: '#e85d2a', flip: true, la: up ? 1.6 + k * 0.5 : 0.2, ra: up ? -1.6 + k * 0.5 : -0.2, face: up ? 'o' : 'smile', hy: up ? -4 : 0 });
      c.restore();
      if (up) {
        c.save(); c.translate(135, 220); c.rotate(Math.sin(t * 14) * 0.1); c.scale(1 + Math.abs(k) * 0.12, 1 + Math.abs(k) * 0.12);
        c.translate(-135, -220); meme(c, '6️ 7️', 220, 70, '#ffdd33'); c.restore();
      }
      if (t > 4.6) laughs(c, t);
    },
  },
  brainrot('pencil', 'Matitino Gommarino', 'v_br_pencil', 'he flies to your desk when you forget yours ✏️', '@brainrot.daily'),
  brainrot('shark', 'Squalino Zainetto', 'v_br_shark', 'late for first period again 🦈🎒', '@brainrot.daily'),
  brainrot('banana', 'Bananito Calcolatrice', 'v_br_banana', 'does your math homework for 1 banana 🍌', '@italian.memes.4u'),
  brainrot('chalk', 'Gessetto Polverone', 'v_br_chalk', 'lives behind the blackboard. do not clap near him', '@brainrot.daily'),
  brainrot('frog', 'Ranocchio Monociclo', 'v_br_frog', 'the only frog with a driving license 🐸', '@italian.memes.4u'),
  { // 8
    who: '@goat.facts', cap: 'when someone says "quick quiz"', dur: 7, snd: [[2.6, 'm_goat_b', 1.1]], loud: [[2.6, 4.2]],
    draw(c, t) {
      bg(c, '#8ecdf5', '#d8f0ff'); clouds(c, t);
      c.fillStyle = '#6fbf4d'; c.beginPath(); c.moveTo(0, 340); c.quadraticCurveTo(140, 280, 270, 330); c.lineTo(270, H); c.lineTo(0, H); c.fill();
      const turn = t > 2.3, k = seg(t, 2.5, 2.8);
      c.save(); zoom(c, 160, 280, 1 + k * 1.3); shake(c, turn ? 3 * seg(t, 2.6, 2.8) * (1 - seg(t, 4.2, 4.6)) : 0, t);
      goat(c, 140, 330, 1.5, { turn, scream: turn ? 0.5 + Math.abs(Math.sin(t * 20)) * 0.5 * (1 - seg(t, 4.0, 4.4)) : 0 });
      c.restore();
      meme(c, 'quick quiz', 60, 34);
      if (turn) meme(c, 'me:', 420, 34);
    },
  },
  { // 9
    who: '@hamster.drama', cap: 'when he says "pop quiz" 😳', dur: 6, snd: [[1.9, 'm_dun', 1]], loud: [[1.9, 3.6]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#c9a27a'); rect(c, 0, 330, W, 150, '#8c6a46');
      const k1 = seg(t, 1.9, 2.0), k2 = seg(t, 2.6, 2.7), k3 = seg(t, 3.3, 3.4);
      const z = 1 + k1 * 0.6 + k2 * 0.8 + k3 * 1.2;
      c.save(); zoom(c, 135, 240, z);
      hamster(c, 135, 340, 2.2, { tilt: t > 1.4 ? -0.3 : 0, hx: t > 1.4 ? 6 : 0 });
      c.restore();
      if (t < 1.6) bubble(c, 'POP QUIZ!', 70);
    },
  },
  { // 10
    who: '@fail.army.of.one', cap: 'me walking into class on test day', dur: 8, snd: [[4.8, 'v_bonk', 1], [5.6, 'm_bruh_b', 1]], loud: [[4.8, 5.4]],
    draw(c, t) {
      bg(c, '#a7d8ff', '#eaf6ff'); clouds(c, t);
      rect(c, 0, 360, W, 120, '#9a9a9a'); rect(c, 0, 356, W, 6, '#777');
      const slow = t > 2.5 && t < 4.6;
      if (t < 2.4) {
        const x = 30 + t * 40, st = Math.sin(t * 10);
        person(c, x, 360, 0.95, { ll: st * 0.4, rl: -st * 0.4, la: -st * 0.4, ra: st * 0.4, cool: true });
      } else if (t < 4.8) {
        const k = seg(t, 2.4, 4.8);
        const x = 126 + k * 50, y = 360 - Math.sin(k * Math.PI) * 120;
        person(c, x, y, 0.95, { rot: k * Math.PI * 1.4, la: 2.5, ra: -2.5, ll: 0.8, rl: -0.8, face: 'o' });
      } else {
        person(c, 200, 362, 0.95, { rot: Math.PI / 2, face: 'x', la: 1.4, ra: -1.4 });
        starsAround(c, 210, 300, t);
      }
      c.save(); c.translate(120 + (t > 2.4 ? 30 * seg(t, 2.4, 3) : 0), 356); c.rotate(t > 2.4 ? t * 3 : 0);
      c.fillStyle = '#ffd93b'; c.beginPath(); c.moveTo(-14, 0); c.quadraticCurveTo(0, -12, 14, 0); c.quadraticCurveTo(0, -5, -14, 0); c.fill();
      c.restore();
      if (slow) { meme(c, 'slow motion', 90, 24, '#ff5'); c.fillStyle = 'rgba(255,255,255,0.08)'; c.fillRect(0, 0, W, H); }
    },
  },
  { // 11
    who: '@skate.or.die.trying', cap: 'wait for it… 🛹', dur: 9.5, snd: [[0.2, 'v_tts_wait', 1], [3.4, 'm_scratch', 0.8], [3.5, 'v_tbc', 0.9], [7.3, 'v_bonk', 1], [7.5, 'm_pipe', 0.8]], loud: [[7.3, 8.2]],
    draw(c, t) {
      bg(c, '#9dd6ff', '#e7f6ff');
      rect(c, 0, 380, W, 100, '#b8b8b8');
      poly(c, [120, 380, 190, 380, 190, 330], '#7a7a7a');
      rr(c, 220, 330, 40, 50, 4, '#3d6b3d'); rect(c, 216, 326, 48, 8, '#2e522e');
      const frozen = t > 3.4 && t < 6.8;
      const tt = frozen ? 3.4 : t > 6.8 ? 3.4 + (t - 6.8) : t;
      let x, y, rot = 0;
      if (tt < 2.2) { x = 20 + tt * 55; y = 380; }
      else if (tt < 2.8) { const k = seg(tt, 2.2, 2.8); x = 141 + k * 49; y = 380 - k * 50; rot = -0.6 * k; }
      else { const k = seg(tt, 2.8, 4.0); x = 190 + k * 50; y = 330 - Math.sin(k * Math.PI * 0.75) * 80 + k * k * 60; rot = -0.6 + k * 2.4; }
      if (t > 7.3) {
        rr(c, 228, 300, 9, 30, 4, '#2f3b52'); rr(c, 243, 296, 9, 34, 4, '#2f3b52');
        c.font = '22px sans-serif'; c.textAlign = 'center'; c.fillText('💀', 240, 290);
      } else {
        c.save(); c.translate(x, y); c.rotate(rot);
        rr(c, -22, -8, 44, 6, 3, '#e04e2a'); circ(c, -14, 0, 4, '#222'); circ(c, 14, 0, 4, '#222');
        person(c, 0, -8, 0.8, { la: 1.6, ra: -1.6, ll: 0.3, rl: -0.3, shirt: '#2a9d8f', face: tt > 3 ? 'o' : 'smile' });
        c.restore();
      }
      sepia(c, frozen ? 1 : 0);
      tbc(c, frozen ? seg(t, 3.5, 3.8) : 0);
    },
  },
  { // 12
    who: '@cat.fails.daily', cap: 'confidence: 100 / skill: 0', dur: 7, snd: [[0.6, 'v_meow', 0.8], [3.0, 'm_slide', 0.9]], loud: [],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#f3e3c8'); rect(c, 0, 400, W, 80, '#a8865c');
      rect(c, 170, 110, 90, 70, '#9ed3f2'); rect(c, 170, 176, 100, 10, '#fff');
      rr(c, 10, 300, 150, 100, 10, '#6c8ebf'); rr(c, 10, 280, 60, 30, 10, '#fff');
      let x = 90, y = 300, rot = 0, eyes = 'open';
      if (t < 2.4) { x = 90 + Math.sin(t * 20) * (t > 1.2 ? 3 : 0); }
      else if (t < 3.0) { const k = seg(t, 2.4, 3.0); x = 90 + k * 90; y = 300 - Math.sin(k * Math.PI * 0.8) * 140; rot = -0.4; eyes = 'wide'; }
      else { const k = seg(t, 3.0, 4.2); x = 182; y = 190 + k * 210; rot = 0.2; eyes = 'wide'; }
      cat(c, x, y, 1.1, { rot, eyes, t, col: '#2d2d30', dark: '#000' });
      if (t > 4.3) { meme(c, 'I meant to do that', 70, 26); }
    },
  },
  { // 13
    who: '@penguin.news', cap: 'group project when one person gives up', dur: 8, snd: [[3.0, 'v_bonk', 0.7], [3.3, 'v_bonk', 0.7], [3.6, 'v_bonk', 0.7], [3.9, 'v_bonk', 0.7], [4.2, 'v_bonk', 0.9], [4.6, 'm_slide', 0.9]],
    draw(c, t) {
      bg(c, '#cfe8ff', '#ffffff'); rect(c, 0, 360, W, 120, '#e8f4ff'); rect(c, 0, 358, W, 4, '#b9dcf5');
      const slide = seg(t, 4.6, 7) * 300;
      for (let i = 0; i < 5; i++) {
        const fallT = 3.0 + (4 - i) * 0.3;
        const k = seg(t, fallT, fallT + 0.25);
        const wob = t < 3 ? Math.sin(t * 8 + i) * 0.1 : 0;
        penguin(c, 40 + i * 48 + (t > 4.6 ? slide : 0), 360, 1.0, { rot: wob + k * 1.4, flap: Math.sin(t * 10 + i) * 0.3 });
      }
      meme(c, t < 3 ? 'everyone: we got this' : 'one guy:', 70, 26);
    },
  },
  { // 14
    who: '@capy.chill', cap: 'me when the sub starts yelling 🍊', dur: 10, music: ['v_lofi', 0.9], snd: [],
    draw(c, t) {
      bg(c, '#ffd6a5', '#fdffb6');
      ell(c, 135, 380, 160, 60, '#7ec8e3'); ell(c, 135, 372, 150, 48, '#9edbf0');
      for (let i = 0; i < 6; i++) { const k = (t * 0.25 + i / 6) % 1; c.fillStyle = `rgba(255,255,255,${0.5 * (1 - k)})`; c.beginPath(); c.arc(40 + i * 40, 340 - k * 120, 10 + k * 14, 0, TAU); c.fill(); }
      capy(c, 110, 395, 1.5, { orange: true });
      if (t > 4) { const k = ease(seg(t, 4, 5)); const bx = lerp(-30, 150, k), by = lerp(80, 245, k); ell(c, bx, by, 10, 7, '#4a7fd1'); poly(c, [bx + 8, by - 2, bx + 15, by, bx + 8, by + 2], '#f5a623'); circ(c, bx + 4, by - 2, 1.5, '#111'); }
      if (t > 6.5) frog(c, 205, 365, 0.7);
      meme(c, t < 5 ? 'sub: SIT DOWN!!' : 'me:', 60, 28);
      if (t > 7.5) meme(c, 'no thoughts just vibes', 440, 22);
    },
  },
  { // 15
    who: '@duck.mafia', cap: 'the sub when you ask ONE question', dur: 8, music: ['v_kazoo', 0.55], snd: [[1.5, 'v_quack', 0.9], [3.6, 'v_quack', 0.9], [5.6, 'v_quack', 1]],
    draw(c, t) {
      bg(c, '#b3e5fc', '#e1f5fe'); grass(c, 330);
      const sp = 1.6 + t * 0.35;
      const a1 = t * sp, a2 = a1 - 0.9;
      const P = (a) => ({ x: 135 + Math.cos(a) * 90, y: 395 + Math.sin(a) * 30, back: Math.sin(a) < 0 });
      const p = P(a1), d = P(a2);
      const tree = () => { rect(c, 122, 260, 26, 140, '#7a5230'); circ(c, 135, 230, 60, '#3f9a3f'); circ(c, 100, 250, 40, '#4caf50'); circ(c, 170, 250, 40, '#4caf50'); };
      const kid = () => person(c, p.x, p.y, 0.75 * (p.back ? 0.85 : 1), { flip: Math.cos(a1) > 0, ll: Math.sin(t * 20) * 0.5, rl: -Math.sin(t * 20) * 0.5, la: 2.6, ra: -2.6, face: 'o' });
      const dk = () => duck(c, d.x, d.y, 0.9 * (d.back ? 0.85 : 1), { flip: Math.cos(a2) > 0, t, open: Math.sin(t * 9) > 0.6 });
      const items = [[p.y, kid], [d.y, dk], [395, tree]].sort((a, b) => a[0] - b[0]);
      for (const [, f] of items) f();
      meme(c, 'me: um sir?', 60, 26);
    },
  },
  { // 16
    who: '@pigeon.beats', cap: 'he has never missed a beat 🕺', dur: 8, music: ['v_euro', 0.45],
    draw(c, t) {
      const beat = t / 0.4, ph = beat % 1;
      rect(c, 0, 0, W, H, '#1a1030');
      for (let i = 0; i < 6; i++) { c.fillStyle = `hsla(${(i * 60 + Math.floor(beat) * 40) % 360},90%,60%,0.25)`; c.beginPath(); c.moveTo(135, -20); c.lineTo(i * 54 - 20, 420); c.lineTo(i * 54 + 20, 420); c.fill(); }
      rect(c, 0, 380, W, 100, '#2b2b3a');
      for (let i = 0; i < 6; i++) rect(c, i * 45, 380, 45, 100, (i + Math.floor(beat)) % 2 ? '#3a2b55' : '#55306e');
      const spin = t > 5 && t < 5.8;
      c.save(); c.translate(135, 380); if (spin) c.scale(Math.cos(seg(t, 5, 5.8) * TAU * 2), 1); c.translate(-135, -380);
      pigeon(c, 130, 380, 2.4, { bob: ph < 0.5 ? ph * 16 : (1 - ph) * 16 });
      c.restore();
      meme(c, 'the rhythm is in his blood', 60, 24);
    },
  },
  { // 17
    who: '@zoomies.inc', cap: 'me when the bell rings', dur: 8, music: ['v_kazoo', 0.5], snd: [[6.0, 'v_bonk', 1], [6.1, 'v_bark', 0.9]], loud: [[6, 6.6]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#f1e4d0'); rect(c, 0, 380, W, 100, '#c49a6c');
      rr(c, 150, 300, 110, 80, 12, '#a33b3b'); rr(c, 150, 280, 110, 30, 12, '#bf4a4a');
      if (t < 6) {
        const a = t * (3 + t * 0.8);
        const x = 120 + Math.cos(a) * 80, y = 400 + Math.sin(a) * 25;
        for (let i = 1; i < 5; i++) { c.globalAlpha = 0.15; dog(c, 120 + Math.cos(a - i * 0.15) * 80, 400 + Math.sin(a - i * 0.15) * 25, 0.8, { flip: Math.sin(a) > 0, t }); }
        c.globalAlpha = 1;
        dog(c, x, y, 0.8, { flip: Math.sin(a) > 0, t, tongue: true });
      } else {
        dog(c, 160, 384, 0.8, { rot: -0.4, t: 0 });
        starsAround(c, 190, 330, t);
      }
      meme(c, t < 6 ? 'the bell rang' : 'the couch:', 60, 28);
    },
  },
  { // 18
    who: '@um.actually', cap: 'the kid who reminds the teacher about homework', dur: 6, snd: [[0.5, 'v_umactually', 1], [2.5, 'v_bonk', 1], [2.7, 'v_laugh', 0.7]], loud: [[2.5, 3.6]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#f7f2e8');
      const hit = t > 2.5;
      c.save(); if (hit) shake(c, 4 * (1 - seg(t, 2.5, 3.0)), t);
      circ(c, 135, 250, 80, '#ffcc33');
      if (hit) { ln(c, 100, 222, 120, 242, '#111', 4); ln(c, 120, 222, 100, 242, '#111', 4); ln(c, 150, 222, 170, 242, '#111', 4); ln(c, 170, 222, 150, 242, '#111', 4); ell(c, 135, 290, 14, 10, '#5a1a1a'); }
      else {
        circ(c, 110, 232, 18, null, '#111', 5); circ(c, 160, 232, 18, null, '#111', 5); ln(c, 128, 232, 142, 232, '#111', 5);
        circ(c, 110, 232, 5, '#111'); circ(c, 160, 232, 5, '#111');
        c.beginPath(); c.arc(135, 270, 26, 0.1 * Math.PI, 0.9 * Math.PI); c.fillStyle = '#5a1a1a'; c.fill();
        rect(c, 125, 274, 9, 10, '#fff'); rect(c, 136, 274, 9, 10, '#fff');
      }
      c.restore();
      const fy = 170 - Math.abs(Math.sin(t * 2)) * 6;
      if (!hit) { ln(c, 220, fy + 60, 220, fy, '#ffcc33', 14); circ(c, 220, fy - 4, 8, '#ffcc33'); }
      if (t > 1.8 && t < 2.6) { const k = seg(t, 1.8, 2.5); circ(c, lerp(-20, 120, k), lerp(120, 220, k), 16, '#f4f4f4', '#bbb', 1); }
      meme(c, hit ? '' : 'erm, actually…', 70, 30);
    },
  },
  { // 19
    who: '@stone.face', cap: 'when he says "see me after class"', dur: 6, snd: [[2.5, 'm_boom', 1]], loud: [[2.5, 3.2]],
    draw(c, t) {
      const boom = t > 2.5;
      bg(c, boom ? '#300' : '#14223a', boom ? '#100' : '#070b14');
      c.save(); shake(c, boom ? 5 * (1 - seg(t, 2.5, 3.2)) : 0, t); zoom(c, 135, 260, 1 + seg(t, 0, 2.5) * 0.25 + (boom ? 0.5 : 0));
      stoneHead(c, 135, 300, 1.3);
      c.restore();
      deepfry(c, boom ? 1 - seg(t, 3, 5) * 0.5 : 0);
      meme(c, 'see me after class', 70, 30);
    },
  },
  { // 20
    who: '@my.cat.did.it', cap: 'my cat "helping" with my essay', dur: 8, snd: [[1.0, 'keys_1', 0.7], [1.6, 'keys_2', 0.7], [2.2, 'keys_3', 0.7], [5.0, 'ding', 0.8], [5.6, 'm_crickets', 0.9]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#e9dfcf'); rect(c, 0, 380, W, 100, '#a07a50');
      rr(c, 30, 140, 210, 150, 8, '#222'); rr(c, 38, 148, 194, 134, 4, '#fff');
      rr(c, 20, 290, 230, 20, 6, '#444');
      c.fillStyle = '#111'; c.font = 'bold 11px sans-serif'; c.textAlign = 'left'; c.fillText('ESSAY - due today', 46, 166);
      c.font = '10px monospace';
      const typed = 'asdfghjkl;;;;;;;;;;;;;;;; mmmmmmmmmm bbbbbbbbbbbbb ppppp'.slice(0, Math.floor(seg(t, 0.8, 4.5) * 56));
      if (t < 5) { c.fillText('The causes of the war were', 46, 184); c.fillText(typed.slice(0, 28), 46, 198); c.fillText(typed.slice(28), 46, 212); }
      if (t > 5) { rr(c, 60, 190, 150, 50, 6, '#f2f2f2'); c.fillStyle = '#c00'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('Document deleted', 135, 212); c.fillStyle = '#333'; c.font = '10px sans-serif'; c.fillText('Undo not available', 135, 228); }
      const x = lerp(-60, 150, seg(t, 0.5, 4.2));
      cat(c, x, 300, 1.0, { col: '#ececec', dark: '#999', t, eyes: t > 5.5 ? 'wide' : 'open', tilt: t > 5.5 ? -0.2 : 0 });
      if (t > 5.5) meme(c, '…', 380, 40);
    },
  },
  { // 21
    who: '@waiting.room', cap: 'me waiting for the bell', dur: 9, snd: [[0.2, 'v_tts_bell', 1], [3.4, 'm_trombone', 0.9]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#dfe7ec'); rect(c, 0, 300, W, 180, '#c7b299');
      rr(c, 20, 160, 160, 110, 8, '#e9e9e9'); rr(c, 32, 172, 100, 86, 6, '#222');
      rr(c, 142, 176, 30, 20, 3, '#123');
      const secs = t < 3.2 ? Math.max(1, 3 - Math.floor(t)) : 599;
      c.fillStyle = '#4f4'; c.font = 'bold 13px monospace'; c.textAlign = 'center';
      c.fillText(Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0'), 157, 191);
      c.fillStyle = 'rgba(255,220,120,0.25)'; c.fillRect(32, 172, 100, 86);
      person(c, 220, 470, 1.6, { flip: true, face: t > 3.4 ? 'o' : 'flat', la: 0.3, ra: -0.3, hx: -2 });
      meme(c, t < 3.3 ? '3… 2… 1…' : 'the bell: +10 minutes', 70, 30);
    },
  },
  { // 22
    who: '@seal.of.approval', cap: 'the class when the sub trips 👏', dur: 6, snd: [[0.4, 'v_applause', 0.8], [1.0, 'v_laugh', 0.7]], loud: [[1, 3]],
    draw(c, t) {
      bg(c, '#4fb3d9', '#c9f1ff');
      rect(c, 0, 380, W, 100, '#2b7da6');
      poly(c, [60, 380, 210, 380, 190, 350, 80, 350], '#d9d2c3');
      seal(c, 135, 350, 1.6, { clap: Math.abs(Math.sin(t * 12)) });
      meme(c, 'sub: *trips*', 60, 28);
      meme(c, 'the whole class:', 420, 24);
    },
  },
  { // 23
    who: '@locker.problems', cap: 'closing my locker "quietly"', dur: 6, snd: [[2.0, 'v_explode', 1]], loud: [[2.0, 3.6]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#cfd6dc'); rect(c, 0, 400, W, 80, '#9aa3ab');
      for (let i = 0; i < 4; i++) { rr(c, 10 + i * 64, 100, 58, 300, 4, '#3a6ea5'); for (let j = 0; j < 4; j++) rect(c, 20 + i * 64, 120 + j * 8, 38, 3, '#2c5582'); }
      const boom = t > 2.0;
      if (!boom) person(c, 150, 410, 1.0, { la: -1.2 + seg(t, 0.5, 2) * 0.6, face: 'shut' });
      else {
        person(c, 150, 410, 1.0, { la: 2.6, ra: -2.6, face: 'o', skin: '#4a4040', shirt: '#333', hair: '#111' });
        const k = seg(t, 2.0, 2.6);
        c.globalAlpha = 1 - seg(t, 2.6, 3.8);
        for (let i = 0; i < 9; i++) { const a = (i / 9) * TAU; circ(c, 140 + Math.cos(a) * 80 * k, 240 + Math.sin(a) * 80 * k, 40 * (1 - k * 0.5), i % 2 ? '#ff9f1c' : '#ffbf69'); }
        circ(c, 140, 240, 50 * k, '#fff3b0');
        c.globalAlpha = 1;
      }
      meme(c, boom ? '' : 'me: *closes it gently*', 60, 24);
    },
  },
  { // 24
    who: '@ufo.sightings', cap: 'me carrying my backpack on monday', dur: 9, snd: [[0.5, 'whoosh', 0.6], [5.2, 'm_slide', 0.8], [5.8, 'v_bonk', 1], [6.1, 'm_pipe', 0.9]], loud: [[5.8, 6.8]],
    draw(c, t) {
      bg(c, '#0b1030', '#24305e');
      for (let i = 0; i < 30; i++) circ(c, (i * 89) % W, (i * 53) % 260, 1.2, '#fff');
      grass(c, 400, '#2f5d2a', '#24481f');
      const lift = t < 5.2 ? Math.min(60, t * 14) + Math.sin(t * 6) * 4 : Math.max(0, 60 - (t - 5.2) * 160);
      const ux = 135 + (t > 5.4 ? (t - 5.4) * 90 : Math.sin(t * 7) * 3), uy = 120 + (t > 5.6 ? (t - 5.6) * 140 : 0);
      if (t < 5.2) { c.fillStyle = 'rgba(180,255,180,0.25)'; c.beginPath(); c.moveTo(ux - 20, uy + 10); c.lineTo(ux + 20, uy + 10); c.lineTo(ux + 70, 400); c.lineTo(ux - 70, 400); c.fill(); }
      cow(c, 120, 400 - lift, 1.3);
      c.save(); c.translate(ux, uy); c.rotate(t > 5.4 ? (t - 5.4) * 2 : 0);
      ell(c, 0, 0, 60, 16, '#a9b2bd'); ell(c, 0, -10, 26, 18, 'rgba(160,220,255,0.8)');
      for (let i = 0; i < 5; i++) circ(c, -44 + i * 22, 4, 4, (Math.floor(t * 6) + i) % 2 ? '#ff5' : '#f55');
      if (t > 3 && t < 5.2) { c.font = '18px sans-serif'; c.fillText('💦', 30, -24); }
      c.restore();
      meme(c, t < 5.2 ? 'my backpack:' : 'nope', 60, 28);
    },
  },
  { // 25
    who: '@fishbowl.fights', cap: "don't touch my lunch 🐟", dur: 6, snd: [[2.1, 'v_splash', 0.8], [2.4, 'desk_slap', 1], [2.6, 'v_meow', 0.8]], loud: [[2.4, 2.9]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#f6ead7'); rect(c, 0, 360, W, 120, '#b48a5a');
      circ(c, 170, 300, 60, 'rgba(160,220,255,0.6)', '#7fb7d9', 3); rect(c, 110, 300, 120, 60, 'rgba(160,220,255,0.6)');
      let fx = 170 + Math.sin(t * 2) * 25, fy = 315, rot = 0;
      if (t > 2.0 && t < 2.8) { const k = seg(t, 2.0, 2.8); fx = lerp(170, 90, Math.sin(k * Math.PI)); fy = 315 - Math.sin(k * Math.PI) * 120; rot = k * TAU; }
      cat(c, 60, 362, 1.3, { col: '#ffb15e', eyes: t > 2.4 ? 'wide' : 'open', tilt: t > 2.4 ? -0.4 : 0.1 * Math.sin(t * 3), t });
      fish(c, fx, fy, 1.4, { rot, flip: Math.cos(t * 2) < 0 });
      if (t > 2.4 && t < 3.4) meme(c, 'SLAP', 160, 40, '#ff5');
      meme(c, t < 2 ? 'me: just a little taste' : '', 60, 24);
    },
  },
  { // 26
    who: '@grandma.moves', cap: 'grandma at the family party 💃', dur: 8, music: ['v_euro', 0.5], snd: [[2.2, 'v_letsgo', 1], [5.2, 'v_applause', 0.6]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#120a22');
      for (let i = 0; i < 5; i++) for (let j = 0; j < 3; j++) rect(c, i * 54, 380 + j * 34, 54, 34, `hsl(${(i * 70 + j * 40 + Math.floor(t * 2.5) * 50) % 360},70%,${45 + ((i + j) % 2) * 15}%)`);
      circ(c, 135, 70, 26, '#ccc'); for (let i = 0; i < 12; i++) ln(c, 135, 70, 135 + Math.cos(t + i) * 120, 70 + Math.sin(t + i) * 120, 'rgba(255,255,255,0.08)', 6);
      if (t < 2.4) person(c, 135, 380, 1.1, { bun: true, hair: '#ddd', shirt: '#b56576', glasses: true, la: 0.8 + Math.sin(t * 8) * 0.4, ra: -0.8 - Math.sin(t * 8) * 0.4 });
      else {
        c.save(); c.translate(135, 380 - 134 * 1.1); c.rotate(Math.PI); c.scale(Math.cos(t * 12), 1);
        person(c, 0, 0, 1.1, { bun: true, hair: '#ddd', shirt: '#b56576', glasses: true, la: 2.4, ra: -2.4, ll: 1.0, rl: -1.0, face: 'smile' });
        c.restore();
      }
      meme(c, 'grandma after 1 cup of coffee', 60, 22);
    },
  },
  { // 27
    who: '@sus.farm', cap: 'when someone says they didn\'t study but gets 100', dur: 6, snd: [[2.2, 'm_sus_b', 1], [2.3, 'm_dun', 0.5]], loud: [[2.2, 3]],
    draw(c, t) {
      bg(c, '#ffe9a8', '#ffd16b'); rect(c, 0, 380, W, 100, '#b98b4f');
      const k = seg(t, 1.6, 2.2);
      c.save(); zoom(c, 150, 250, 1 + k * 1.2);
      chicken(c, 120, 380, 2.0, { turn: k > 0.5 ? 0.2 : 0 });
      c.restore();
      if (t > 2.4) meme(c, 'sus', 420, 48, '#e33');
    },
  },
  { // 28
    who: '@night.owls', cap: 'rizz level: owl 🦉', dur: 6, snd: [[2.0, 'm_sheesh_b', 1]], loud: [[2.0, 3.2]],
    draw(c, t) {
      bg(c, '#20264a', '#3c3f7a');
      circ(c, 210, 80, 28, '#f4f1c9');
      ln(c, 0, 330, 270, 300, '#5b3b22', 14);
      owl(c, 90, 322, 1.4, { wink: t > 1.6 && t < 2.2 });
      owl(c, 185, 312, 1.3, { flip: true });
      if (t > 2.2) { c.font = '22px sans-serif'; c.textAlign = 'center'; for (let i = 0; i < 4; i++) { const k = (t - 2.2 + i * 0.3) % 1.5 / 1.5; c.globalAlpha = 1 - k; c.fillText('❤', 185 + Math.sin(i * 2 + t) * 20, 240 - k * 120); } c.globalAlpha = 1; }
      meme(c, t > 2.2 ? 'sheeeesh' : 'watch this', 60, 30);
    },
  },
  { // 29
    who: '@wifi.problems', cap: 'my wifi during the best part', dur: 8, snd: [[5.3, 'v_wow', 1]],
    draw(c, t) {
      const frozen = t > 2 && t < 5;
      const tt = frozen ? 2 : t;
      rect(c, 0, 0, W, H, '#f0e2c8'); rect(c, 0, 400, W, 80, '#a5835a');
      rect(c, 160, 160, 110, 12, '#7a5636');
      if (t > 5) { cat(c, 200, 160, 0.9, { col: '#777', dark: '#444', eyes: 'shut' }); c.fillStyle = '#333'; c.font = 'bold 18px sans-serif'; c.fillText('z z z', 210, 100); }
      else {
        const k = seg(tt, 1.2, 2.2);
        cat(c, lerp(70, 140, k), 400 - Math.sin(k * Math.PI * 0.7) * 160, 0.9, { col: '#777', dark: '#444', eyes: 'wide', t: tt });
      }
      if (frozen) {
        c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(0, 0, W, H);
        for (let y = 0; y < H; y += 24) for (let x = 0; x < W; x += 24) if ((x + y) % 48 === 0) { c.fillStyle = 'rgba(255,255,255,0.06)'; c.fillRect(x, y, 24, 24); }
        c.strokeStyle = '#fff'; c.lineWidth = 5; c.beginPath(); c.arc(135, 240, 22, t * 6, t * 6 + 4.5); c.stroke();
      }
      if (t > 5) meme(c, 'what did I miss', 60, 26);
    },
  },
  { // 30
    who: '@tiny.house', cap: 'bless you 🐹', dur: 6, snd: [[2.5, 'whoosh', 1], [2.5, 'v_pop', 0.8]], loud: [[2.5, 3]],
    draw(c, t) {
      bg(c, '#d6f5d6', '#f6fff0'); grass(c, 380);
      const blown = t > 2.5;
      const k = seg(t, 2.5, 3.4);
      c.save(); c.translate(150 + k * 220, 380 - k * 200); c.rotate(k * 3);
      poly(c, [-50, 0, 50, 0, 50, -60, -50, -60], '#e8c07a'); poly(c, [-60, -60, 0, -100, 60, -60], '#c0392b'); rect(c, -12, -36, 24, 36, '#7a4a24');
      c.restore();
      const inh = t < 2.5 ? seg(t, 0.5, 2.4) : 0;
      hamster(c, 120, 384, 1.2 + inh * 0.15, { eyes: t > 1.4 && t < 2.6 ? 'shut' : 'open', mouth: t > 2.4 && t < 2.8 ? 1 : 0 });
      if (t < 2.5) meme(c, t < 1.4 ? 'ah…' : 'ah… AH…', 80, 30); else meme(c, 'CHOO', 80, 40);
      if (blown && t > 3.6) meme(c, '…oops', 430, 26);
    },
  },
  { // 31
    who: '@town.forecast', cap: 'the weather in my town be like', dur: 9, snd: [[0.2, 'v_tts_weather', 1], [3.2, 'thunder', 0.5], [7.4, 'v_explode', 0.9]], loud: [[7.4, 8.4]],
    draw(c, t) {
      const phase = Math.min(4, Math.floor(t / 1.6));
      const skies = [['#7ec8ff', '#d6f0ff'], ['#4b5563', '#9ca3af'], ['#cbd5e1', '#f8fafc'], ['#3f3f46', '#71717a'], ['#3b0d0d', '#ff7b00']];
      bg(c, skies[phase][0], skies[phase][1]);
      for (let i = 0; i < 6; i++) rect(c, i * 46, 300 - ((i * 37) % 80), 40, 200, '#374151');
      if (phase === 0) circ(c, 200, 100, 34, '#ffe066');
      if (phase === 1) for (let i = 0; i < 60; i++) ln(c, (i * 37 + t * 300) % W, (i * 53 + t * 900) % H, (i * 37 + t * 300) % W - 4, (i * 53 + t * 900) % H + 12, '#cde', 2);
      if (phase === 2) for (let i = 0; i < 50; i++) circ(c, (i * 41 + Math.sin(t + i) * 10) % W, (i * 29 + t * 60) % H, 3, '#fff');
      if (phase === 3) { c.strokeStyle = 'rgba(200,200,200,0.7)'; c.lineWidth = 8; c.beginPath(); for (let k = 0; k < 40; k++) { const y = 380 - k * 8, r = 6 + k * 2.2; c.lineTo(135 + Math.cos(t * 14 + k * 0.6) * r, y); } c.stroke(); }
      if (phase === 4) { const k = seg(t, 6.4, 7.4); circ(c, lerp(260, 140, k), lerp(-40, 330, k), 18, '#ffb703'); if (t > 7.4) { const e = seg(t, 7.4, 8.2); circ(c, 140, 330, 120 * e, `rgba(255,${180 - e * 120},0,${1 - e * 0.6})`); } }
      meme(c, ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'][phase], 60, 30);
    },
  },
  { // 32
    who: '@jawline.journey', cap: "shh… I'm mewing 🤫", dur: 9, music: ['v_phonk', 0.26], snd: [[0.3, 'v_tts_mewing', 1]],
    draw(c, t) {
      bg(c, '#111', '#2a2a2a');
      const k = seg(t, 0.5, 6);
      c.fillStyle = '#e2b08a';
      c.beginPath(); c.moveTo(80, 120); c.quadraticCurveTo(200, 60, 200, 180); c.lineTo(214, 230); c.lineTo(198, 240);
      c.lineTo(202, 280); c.lineTo(lerp(170, 205, k), lerp(330, 330, k)); c.lineTo(lerp(110, 150, k), lerp(360, 345, k)); c.lineTo(100, 470); c.lineTo(60, 470); c.closePath(); c.fill();
      c.beginPath(); c.arc(120, 140, 70, Math.PI, Math.PI * 1.9); c.fillStyle = '#2a1a10'; c.fill();
      shut(c, 168, 180, 7); ln(c, 180, 300, 196, 298, '#7a3a2a', 3);
      if (t > 4) { say(c, 'ANSWER THE QUESTION!', 80, 90, 13); }
      if (t > 5.5) { ln(c, 230, 400, 210, 320, '#e2b08a', 12); circ(c, 208, 316, 7, '#e2b08a'); }
      if (t > 6.5) meme(c, '+100 aura', 430, 32, '#ffd700');
    },
  },
  { // 33
    who: '@sub.pov', cap: "POV: the sub doesn't know the lesson", dur: 9, snd: [[0.2, 'v_tts_pov', 1], [4.2, 'v_laugh', 0.8]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#d9cfb8');
      rect(c, 15, 60, 240, 140, '#26443a'); rect(c, 15, 200, 240, 8, '#8a6a42');
      c.fillStyle = '#f2f2e6'; c.font = '22px "Comic Sans MS", cursive'; c.textAlign = 'left';
      const s = 'LESSON 1:  2 + 2 = fish';
      c.fillText(s.slice(0, Math.floor(seg(t, 1, 3.8) * s.length)), 28, 110);
      if (t > 3.8) c.fillText('trust me', 60, 150);
      person(c, 200, 420, 1.25, { shirt: '#1d1d22', pants: '#1d1d22', skin: '#7a5236', hair: '#1a1a1a', glasses: true, face: 'flat', ra: t < 3.8 ? -2.6 + Math.sin(t * 12) * 0.1 : -0.3 });
      if (t > 4.2) laughs(c, t);
    },
  },
  { // 34
    who: '@3am.thoughts', cap: 'nobody: … me at 3AM:', dur: 7.5, snd: [[0.3, 'v_tts_nobody', 1], [2.8, 'v_euro', 0.5]],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#05060a');
      c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.textAlign = 'left';
      if (t > 0.3) c.fillText('Nobody:', 20, 60);
      if (t > 1.3) c.fillText('Absolutely nobody:', 20, 90);
      if (t > 2.4) c.fillText('Me at 3 AM:', 20, 120);
      if (t > 2.8) {
        ell(c, 135, 330, 90, 120, 'rgba(120,170,255,0.18)');
        const k = Math.sin(t * 14);
        person(c, 135, 430, 1.2, { la: 2.6 + k, ra: -2.6 + k, ll: 0.5 * k, rl: -0.5 * k, face: 'o', hy: Math.abs(k) * -6, shirt: '#6d28d9' });
      }
    },
  },
  { // 35
    who: '@lunch.lady.beats', cap: 'lunch in 5 minutes 🍟', dur: 8, music: ['v_euro', 0.5],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#ffe6e6');
      for (let i = 0; i < 10; i++) circ(c, (i * 61) % W, (i * 97) % H, 18, `hsla(${i * 36},80%,70%,0.4)`);
      rr(c, 75, 280, 120, 130, 10, '#e63946');
      c.fillStyle = '#fff'; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('M M M', 135, 360);
      for (let i = 0; i < 7; i++) {
        const k = Math.sin(t * 9 + i);
        c.save(); c.translate(88 + i * 16, 285); c.rotate(k * 0.25);
        rr(c, -6, -70 - Math.abs(k) * 14, 12, 80, 3, '#ffd166');
        c.restore();
      }
      eye(c, 115, 320, 8, Math.sin(t * 3), 0); eye(c, 155, 320, 8, Math.sin(t * 3), 0);
      rr(c, 200, 300, 40, 90, 8, '#c1121f'); rr(c, 210, 280, 20, 24, 4, '#f1faee');
      meme(c, 'the fries when the bell rings', 70, 22);
    },
  },
  { // 36: a cute one... that does not stay cute
    who: '@cute.kittens.4u', cap: 'the cutest kitten you will ever see 🥺', dur: 8, snd: [[0.6, 'v_meow', 0.7], [3.5, 'glitch', 0.9], [3.6, 'stinger_1', 0.8]], loud: [[3.5, 5]], scary: true,
    draw(c, t, R, extra) {
      if (t < 3.5 || t > 5.6) {
        bg(c, '#ffd6e7', '#fff0f6');
        for (let i = 0; i < 6; i++) { c.font = '20px sans-serif'; c.fillText('♥', 20 + i * 45, 80 + Math.sin(t * 2 + i) * 10); }
        cat(c, 110, 360, 1.8, { col: '#f6f6f6', dark: '#ccc', eyes: t > 5.6 ? 'wide' : 'open', t, tilt: Math.sin(t * 2) * 0.1 });
        if (t > 5.6) meme(c, 'did you see that', 420, 22);
      } else {
        rect(c, 0, 0, W, H, '#000');
        const img = extra && extra.portrait;
        if (img) for (let y = 0; y < H; y += 16) { const off = Math.random() < 0.4 ? (Math.random() - 0.5) * 60 : 0; c.drawImage(img, 0, (y / H) * img.height, img.width, (16 / H) * img.height, off - 40, y, W + 80, 16); }
        meme(c, 'LOOK UP', 60, 44, '#d00');
      }
    },
  },
];

// clips that only the story uses
export const SPECIAL = {
  found: { // security-camera footage of your own classroom
    special: 'found', who: 'Unknown', cap: '', dur: 11, snd: [[0.2, 'whispers_loop', 0.3], [7.0, 'stinger_swell', 0.8], [9.4, 'tw_behind', 1.2]], loud: [],
    draw(c, t) {
      rect(c, 0, 0, W, H, '#0c0f0c');
      const g = 0.6 + Math.random() * 0.1;
      c.save(); c.globalAlpha = g;
      // the room from the back corner, the rows going away from the camera
      poly(c, [0, 160, 270, 140, 270, 480, 0, 480], '#222821');
      rect(c, 40, 60, 200, 70, '#1b2a22');
      c.fillStyle = '#99a'; c.font = '10px monospace'; c.fillText('THERE IS NO MR. HALE', 70, 100);
      for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) {
        const s = 0.6 + r * 0.25, x = 30 + k * 62 * s + (1 - s) * 60, y = 180 + r * 70;
        rect(c, x, y, 40 * s, 14 * s, '#3a3326');
        if (!(r === 3 && k === 1)) { circ(c, x + 20 * s, y - 14 * s, 9 * s, '#2a2a2a'); }
      }
      // your seat... and who is standing behind it
      const ys = 180 + 3 * 70, xs = 30 + 62 * 1.35 + (1 - 1.35) * 60;
      circ(c, xs + 27, ys - 19, 12, '#2d2d2d');
      const k = seg(t, 3, 7);
      if (k > 0) {
        c.globalAlpha = g * k;
        rect(c, xs + 6, ys - 150, 42, 140, '#050505');
        ell(c, xs + 27, ys - 168, 15, 20, '#3a2618');
        circ(c, xs + 21, ys - 172, 4, '#eee'); circ(c, xs + 33, ys - 172, 4, '#eee');
        circ(c, xs + 21, ys - 172, 7, null, '#888', 1.5); circ(c, xs + 33, ys - 172, 7, null, '#888', 1.5);
      }
      c.restore();
      for (let i = 0; i < 40; i++) { c.fillStyle = `rgba(255,255,255,${Math.random() * 0.08})`; c.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
      c.fillStyle = Math.floor(t * 2) % 2 ? '#f33' : '#600'; circ(c, 20, 20, 6, c.fillStyle);
      c.fillStyle = '#ddd'; c.font = 'bold 12px monospace'; c.textAlign = 'left'; c.fillText('REC  CAM 13', 32, 25);
      c.textAlign = 'right'; c.fillText('12:0' + Math.min(9, Math.floor(t / 1.2)) + ' PM', 262, 25);
      if (t > 8.5) meme(c, 'LOOK BEHIND YOU', 430, 26, '#d00');
    },
  },
};
