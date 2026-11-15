// Real dread (mixed into Game): the quiet moments are the scary ones.
//  1. While you stare at your phone he quietly gets closer. He walks BACKWARDS (so, by his own rules,
//     he can't see you) and without footsteps: the chalk stops, the lights at the front dim, somebody
//     breathes, a floorboard. Look up in time and you catch him standing there; don't, and he turns
//     around at your desk.
//  2. Things change when nobody looks at them: a line on the board, a poster, a seat (a kid is gone,
//     two kids changed places, Kevin is back). Never in front of anybody's eyes. A quiet sound gives
//     it away, and looking at it again counts as noticing.
//  3. When he leans over your desk he is listening: hold B (BREATH on a touch screen) and don't move
//     the view until he leaves. The BREATH meter runs out. Breathe, move, make a sound or run out of
//     air and he notices: heat on Easy (enough of it is a strike, as always), caught on Hard (he is
//     looking right at you).
// The host (or solo game) runs all of it for every player. Friends online send "I hold my breath" and
// what their screen can see, and get everything else through the snapshots.
// Every number, text and variant is in DREAD (src/data.js).
import * as THREE from 'three';
import { clamp, damp, rand, pick, chance, wrapAngle } from './util.js';
import { BOARD_Z } from './world.js';
import { SEAT_Y } from './students.js';
import { Chalkboard } from './board.js';
import { DREAD } from './data.js';

const _f = new THREE.Vector3(), _r = new THREE.Vector3(), _u = new THREE.Vector3(), _d = new THREE.Vector3();
const r1 = (x) => Math.round(x * 10) / 10;
const r2 = (x) => Math.round(x * 100) / 100;
const lvl = (g) => (g.hard ? 'hard' : 'easy');
const PAPER = { rules: '#d9d2b8', silence: '#2a3b5a', missing: '#e6e2d6', eyes: '#7a1d16', atoms: '#cfd8c8' };

/** pick from [[weight, value], ...] */
function wpick(list) {
  let tot = 0;
  for (const [w] of list) tot += w;
  let r = Math.random() * tot;
  for (const [w, v] of list) { r -= w; if (r <= 0) return v; }
  return list[list.length - 1][1];
}

/** a walk along [x, z] points, cut into `steps` pieces of the same length: the points to pass in each piece */
function splitRoute(start, pts, steps) {
  const v = [[start.x, start.z], ...pts], cum = [0];
  for (let i = 1; i < v.length; i++) cum.push(cum[i - 1] + Math.hypot(v[i][0] - v[i - 1][0], v[i][1] - v[i - 1][1]));
  const total = cum[cum.length - 1], legs = [];
  let i = 1;
  for (let s = 1; s <= steps; s++) {
    const want = total * s / steps, leg = [];
    while (i < v.length - 1 && cum[i] < want - 0.05) { leg.push(v[i]); i++; }
    if (s === steps) leg.push(v[v.length - 1]);
    else {
      const k = clamp((want - cum[i - 1]) / Math.max(1e-6, cum[i] - cum[i - 1]), 0, 1);
      leg.push([v[i - 1][0] + (v[i][0] - v[i - 1][0]) * k, v[i - 1][1] + (v[i][1] - v[i - 1][1]) * k]);
    }
    legs.push(leg);
  }
  return legs;
}

/** a later version of a poster: the picture that hangs on the wall, with one part painted over */
function posterVariant(kind, base, v) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 360;
  const x = c.getContext('2d');
  const paper = PAPER[kind] || '#ddd', ink = kind === 'silence' || kind === 'eyes' ? '#ece6d2' : '#1d1b16';
  if (base && base.image) x.drawImage(base.image, 0, 0, 256, 360);
  else { x.fillStyle = paper; x.fillRect(0, 0, 256, 360); }
  // (fresh paper over the old print, with a few specks so it does not look pasted on)
  const patch = (px, py, w, h) => {
    x.fillStyle = paper; x.fillRect(px, py, w, h);
    for (let i = 0; i < w * h / 26; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`; x.fillRect(px + Math.random() * w, py + Math.random() * h, 1, 1); }
  };
  x.textAlign = 'center';
  if (kind === 'missing') {
    if (v.kid) {
      // the photo: somebody smaller
      x.fillStyle = '#999'; x.fillRect(58, 72, 140, 150);
      x.fillStyle = '#444'; x.beginPath(); x.arc(128, 152, 29, 0, Math.PI * 2); x.fill(); x.fillRect(92, 188, 72, 34);
    }
    patch(14, 230, 228, 104);
    x.fillStyle = ink; x.font = '24px "Special Elite", monospace'; x.fillText(v.name, 128, 255);
    x.font = '15px "Special Elite", monospace';
    v.lines.forEach((l, i) => x.fillText(l, 128, [282, 304, 324][i] || 324));
  } else if (kind === 'rules') {
    patch(10, 70, 236, 284);
    x.fillStyle = ink; x.font = '19px "Special Elite", monospace'; x.textAlign = 'left';
    v.lines.forEach((l, i) => x.fillText(l, 22, 100 + i * 30));
    x.fillStyle = 'rgba(140,0,0,0.8)'; x.font = '26px "Caveat", cursive'; x.fillText(v.note, 120, 345);
  } else if (kind === 'silence') {
    patch(8, 104, 240, 150);
    x.fillStyle = ink; x.font = 'bold 46px "Special Elite", monospace'; x.fillText(v.words[0], 128, 150);
    x.font = '30px "Special Elite", monospace'; x.fillText(v.words[1], 128, 195); x.fillText(v.words[2], 128, 240);
  } else if (kind === 'eyes') {
    patch(40, 188, 176, 66);
    for (let i = 0; i < 2; i++) {
      const ex = 84 + i * 88;
      x.fillStyle = '#ece6d2'; x.beginPath(); x.ellipse(ex, 220, 34, v.wide ? 28 : 22, 0, 0, Math.PI * 2); x.fill();
      x.fillStyle = '#000'; x.beginPath(); x.arc(ex + (v.look || 0) * 15, 220, v.wide ? 9 : 15, 0, Math.PI * 2); x.fill();
    }
    patch(14, 292, 228, 28);
    x.fillStyle = '#ece6d2'; x.font = '18px "Special Elite", monospace'; x.fillText(v.text, 128, 310);
  } else {
    // "the human body": the arms
    patch(40, 62, 176, 290);
    const k = v.arms || 1, sx = 58 * Math.min(k, 1.25);
    x.strokeStyle = '#333'; x.lineWidth = 3;
    x.beginPath(); x.arc(128, 105, 28, 0, Math.PI * 2); x.stroke();
    x.beginPath(); x.moveTo(128, 133); x.lineTo(128, 250);
    x.moveTo(128, 160); x.lineTo(128 - sx, 160 + 100 * k); x.moveTo(128, 160); x.lineTo(128 + sx, 160 + 100 * k);
    x.moveTo(128, 250); x.lineTo(95, 335); x.moveTo(128, 250); x.lineTo(161, 335); x.stroke();
    x.fillStyle = ink; x.font = '13px "Special Elite", monospace'; x.fillText(v.text, 128, 300);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

export const DreadMixin = {
  // ================================================================ setup
  setupDread() {
    const W = this.world;
    this.dreadAuto = true;       // the class starts creeps, visits and changes by itself (tests switch it off)
    this.dreadSilent = false;    // no footsteps while he creeps up on somebody
    this.dreadFear = 0;          // holding your breath, noticing a change: your own screen only
    this.dreadPosters = (W.posters || []).map((mesh) => ({ mesh, kind: mesh.userData.kind, base: mesh.material.map, stage: 0, want: 0, tex: {}, pts: null }));
    for (const s of this.students) s.dreadHome = s.seat;
    this.dreadBoardPts = [];
    for (const x of [-2.6, -1.3, 0, 1.3, 2.6]) for (const y of [0.9, 1.65, 2.4]) this.dreadBoardPts.push(new THREE.Vector3(x, y, BOARD_Z));
    // the page: the BREATH button (touch), B in the keys legend, a line of its own on the end screen
    const btn = (this.dreadBtn = document.getElementById('btn-breath'));
    if (btn) this.input.bindButton(btn, 'breath');
    const lg = document.getElementById('keys-legend');
    if (lg) lg.insertAdjacentHTML('beforeend', DREAD.text.legend);
    const st = document.getElementById('end-stats');
    if (st && !document.getElementById('end-dread')) st.insertAdjacentHTML('afterend', '<div id="end-dread"></div>');
    this.dread = null;
  },

  resetDreadPlayer(p) {
    Object.assign(p, { breath: 1, holding: false, gaspT: 0, breathLatch: false, netHold: false, phoneT: 0, phoneOffT: 9, creepAt: 0, dreadHint: {} });
    if (p.in) p.in.breath = false;
    if (p.avatar) p.avatar.c.tremble = 0;
  },

  resetDread() {
    const B = DREAD.breath, k = lvl(this), banks = this.world.lights.banks;
    this.dread = {
      creep: null, lean: null,                 // { p, stage } / { p, phase, ... } while he is at it
      nextCreep: rand(18, 28), nextLean: rand(B.gap[k][0], B.gap[k][1]) * 0.8, nextChange: -1,
      dim: 0, dimTo: 0, dimSet: 0,             // the lights at the front
      acc: 0, unseenT: new Map(), watch: [], gone: [], kevin: null, moved: false, lastKind: '', changes: 0, lastFriend: -99,
      lastNow: 0, slack: 0,                    // back from the pause menu: a moment to press B again
      // a friend online: changes waiting until you look away, what the host said last, what you told the host
      defer: [], netGone: new Set(), netLean: 0, sentHold: null, sendT: 0, viewKey: '', viewT: 0,
    };
    this.dreadSilent = false; this.dreadFear = 0;
    for (const x of this.dreadPosters) { x.want = 0; this.dreadPoster(x, 0); }
    for (const s of this.students) { s.dreadWant = null; if (s.dreadHome && s.seat !== s.dreadHome) this.dreadSeat(s, s.dreadHome); }
    banks[0].target = banks[1].target = 1;
    if (this.ui.breath) this.ui.breath(null);
    const el = document.getElementById('end-dread');
    if (el) el.innerHTML = '';
  },

  // ================================================================ every frame (host / solo)
  updateDread(dt) {
    const D = this.dread;
    if (!D) return;
    const now = performance.now();
    if (D.lastNow && now - D.lastNow > 600) D.slack = DREAD.breath.resume; // (the game stood still: the pause menu, a hidden tab)
    else if (D.slack > 0) D.slack -= dt;
    D.lastNow = now;
    this.dreadBreath(dt);
    this.dreadPhones(dt);
    D.acc += dt;
    if (D.acc >= 0.2) { const step = D.acc; D.acc = 0; this.dreadVisits(); this.dreadChanges(step); }
    this.dreadNotices(dt);
    this.dreadLights(dt);
    this.dreadHud(this.me, this.dreadLeanOn(this.me), dt);
  },

  /** is he bending over this player's desk right now? '' | 'grace' (get ready) | 'hold' (he is listening) */
  dreadLeanOn(p = this.me) {
    const D = this.dread;
    if (!D) return '';
    if (this.role === 'guest') { const l = D.netLean; return l && l[0] === p.id ? (l[1] === 2 ? 'hold' : 'grace') : ''; }
    const L = D.lean;
    return L && L.p === p && (L.phase === 'grace' || L.phase === 'hold') ? L.phase : '';
  },

  // ---------------------------------------------------------------- your breath
  /** everybody's lungs: hold B to hold your breath; it runs out, and then you gasp (loud) */
  dreadBreath(dt) {
    const B = DREAD.breath, A = this.audio, max = B.max[lvl(this)];
    for (const p of this.players) {
      const want = !this.cutscene && (p.local ? !!this.input.breath : !!p.in.breath);
      if (!want) p.breathLatch = false;
      if (p.gaspT > 0) p.gaspT -= dt;
      const can = want && !p.breathLatch && !(p.gaspT > 0) && !p.talk && p.breath > 0;
      if (can !== p.holding) {
        p.holding = can;
        if (p.local && can) A.play('dread_inhale', { vol: 0.5, local: true, reverb: 0.02 });
        else if (p.local && !(p.gaspT > 0)) A.play('dread_exhale', { vol: 0.45, local: true, reverb: 0.02 });
      }
      if (p.holding) {
        p.breath -= dt / max;
        this.note(p, 'breath_time', dt);
        if (p.breath <= 0) {
          // out of air
          p.breath = 0; p.holding = false; p.gaspT = B.gasp; p.breathLatch = true;
          const pos = this.headOf(p, new THREE.Vector3()).addScaledVector(p.camFwd, 0.15);
          pos.y -= 0.08;
          A.play('dread_gasp', { pos, vol: 1.0, ref: 0.9, reverb: 0.1 });
          this.track.event(this.t, p, 'gasp');
        }
      } else p.breath = Math.min(1, p.breath + dt / B.refill * (p.gaspT > 0 ? 0.4 : 1));
      if (p.gaspT > 0) p.noise = Math.max(p.noise, B.gaspNoise);
      if (p.avatar) p.avatar.c.tremble = p.holding ? 0.45 : 0;
    }
  },

  /** the BREATH meter on your own screen (any role) */
  dreadHud(p, lean, dt) {
    const H = DREAD.text.hud;
    const want = p.holding ? (lean ? 0.6 : 0.3) : lean ? 0.35 : 0;
    this.dreadFear = Math.max(want, (this.dreadFear || 0) - dt * 0.45);
    if (this.dreadBtn && !this.input.touchBtn.breath) this.dreadBtn.classList.remove('active'); // (a pause lets go of it)
    if (!(p.holding || p.breath < 0.995 || p.gaspT > 0 || lean) || this.cutscene) { this.ui.breath(null); return; }
    let mode = '', label = H.idle;
    if (p.gaspT > 0) { mode = 'out'; label = H.out; }
    else if (lean && p.holding) { mode = 'still'; label = H.still; }
    else if (lean) { mode = 'hold'; label = H.hold + '<span class="desk-only"><kbd>B</kbd></span>'; }
    this.ui.breath(p.breath, mode, label);
  },

  // ---------------------------------------------------------------- what a player can see
  /** half the view, as tangents [sideways, up]: your own camera, or what a friend's screen told the host */
  dreadView(p) {
    if (!p.local) return p.viewTan || [1.75, 1.0];
    const ty = Math.tan(THREE.MathUtils.degToRad(Math.max(this.camera.fov, this.baseFov || 0) / 2));
    return [ty * this.camera.aspect, ty];
  },

  /** can this player see any of these points? (`pad`: a safety margin around the view) */
  dreadSees(p, pts, pad = 1) {
    const [tx, ty] = this.dreadView(p);
    const yaw = p.local ? this.yaw : p.yaw, pitch = p.local ? this.pitch : p.pitch, cp = Math.cos(pitch);
    _f.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    _r.set(Math.cos(yaw), 0, -Math.sin(yaw));
    _u.crossVectors(_r, _f);
    const eye = p.slipK > 0 ? p.view : p.camPos; // (off your chair you see from where you are, src/sneak.js)
    for (const pt of pts) {
      _d.subVectors(pt, eye);
      const z = _d.dot(_f);
      if (z < 0.05) continue;
      if (Math.abs(_d.dot(_r)) < z * tx * pad + 0.12 && Math.abs(_d.dot(_u)) < z * ty * pad + 0.12) return true;
    }
    return false;
  },

  /** nobody in the class can see it */
  dreadUnseen(pts) {
    const C = DREAD.change;
    return !this.players.some((p) => this.dreadSees(p, pts, p.local ? C.pad : C.padNet));
  },

  dreadPosterPts(x) {
    if (x.pts) return x.pts;
    const m = x.mesh, w = m.scale.x / 2, h = m.scale.y / 2, c = Math.cos(m.rotation.y), s = Math.sin(m.rotation.y);
    x.pts = [m.position.clone()];
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) x.pts.push(new THREE.Vector3(m.position.x + c * w * a, m.position.y + h * b, m.position.z - s * w * a));
    return x.pts;
  },

  /** a seat, the kid on it and the desk in front of it */
  dreadSeatPts(seat) {
    if (!seat.dreadPts) {
      const { x, z } = seat;
      seat.dreadPts = [[0, 1.15, 0], [0, 0.85, 0], [-0.25, 0.8, 0], [0.25, 0.8, 0], [0, 0.35, 0], [0, 0.75, -0.5], [-0.3, 0.72, -0.5], [0.3, 0.72, -0.5]]
        .map(([dx, y, dz]) => new THREE.Vector3(x + dx, y, z + dz));
    }
    return seat.dreadPts;
  },

  // ================================================================ 1. he creeps up on you
  /** how long everybody has been staring at their phone; and the start of a creep */
  dreadPhones(dt) {
    const D = this.dread, C = DREAD.creep, T = this.teacher, k = lvl(this);
    for (const p of this.players) {
      if (p.phoneUp) { if (p.phoneT === 0) p.creepAt = rand(C.after[k][0], C.after[k][1]); p.phoneT += dt; p.phoneOffT = 0; }
      else { p.phoneOffT += dt; if (p.phoneOffT > 0.8) p.phoneT = 0; }
    }
    if (D.creep) {
      // he is on his way already: their phone doesn't make him any angrier (a crash or a shout still does)
      const p = D.creep.p;
      if (p.phoneUp && !(p.failT > 0) && !(p.shoutT > 0)) p.noise = 0;
      return;
    }
    if (!this.dreadAuto || D.lean || this.t < D.nextCreep || !this.dreadOpen('creep') || !this.dreadIdle() || this.anger >= C.calm) return;
    // only from the board, with his back to the class
    if (T.pos.z > -4.2 || Math.abs(wrapAngle(T.facing - Math.PI)) > 0.9) return;
    let who = null;
    for (const p of this.players) if (p.phoneUp && !p.out && p.phoneT >= p.creepAt && !p.watching && !p.choice && (!who || p.phoneT > who.phoneT)) who = p;
    if (who) this.startCreep(who);
  },

  /** he starts creeping up on this player (the chalk stops right where it is) */
  startCreep(p) {
    const B = this.world.board, wasWriting = !!(B.job && B.job.type === 'write');
    this.interrupt(this.dreadCreep(p, wasWriting));
  },

  /** which mechanics are on in this period / phase */
  dreadWhen() { return (this.mode === 'story' ? DREAD.when.story[this.chapter] : DREAD.when.free[this.phase]) || null; },
  /** 'creep', 'lean', or a kind of change: is it on, and is this a quiet stretch of lesson (no story moment)? */
  dreadOpen(kind) {
    const w = this.dreadWhen();
    if (!w || !this.memesOn || this.idleKind === 'none' || this.lockBully) return false;
    return kind === 'creep' ? !!w.creep : kind === 'lean' ? !!w.lean : w.change.includes(kind);
  },
  /** he is in his idle lesson and nothing else is going on */
  dreadIdle() {
    const W = this.world;
    return this.state === 'playing' && this.present && this.teacher.root.visible && this.brainIdle && !this.cutscene && !this.ending && !this.eventLock
      && !this.memeBusy && !this.echoBusy && !this.searching && !this.prankBusy && !this.blind && !this.typing && !this.choice && !this.players.some((p) => p.choice)
      // (none of his other scenes: an event, a habit, "Who did it?", the red dot, looking for an empty chair, sitting on his chair)
      && !this.classEvent && !this.quirkBusy && !this.dozing && !this.dancing && !this.away && !this.blameBusy && !this.cat && !this.sneakBusy && !this.sitting
      && this.blackout < 0.3 && W.master > 0.6 && !this.vidJob && !this.noteJob && !this.buzz && !this.ui.noteOpen && !this.shows.some((s) => !s.over);
  },

  /** from where he stands (at the front) to the spot at a player's desk, clear of his own desk */
  dreadRoute(p, spot) {
    const T = this.teacher, pts = [];
    const sx = clamp(T.pos.x, -1.8, 3.4), sz = clamp(T.pos.z, -6.3, -4.2);
    if (Math.hypot(sx - T.pos.x, sz - T.pos.z) > 0.25) pts.push([sx, sz]);
    if (p.desk.row !== 0) {
      // a desk further back: down the aisle next to it
      if (sz < -4.25) pts.push([sx, -4.2]);
      pts.push([spot.approach.x, spot.approach.z]);
    }
    pts.push([spot.stand.x, spot.stand.z]);
    return pts;
  },

  /** one small tell: 0 the chalk stopped, 1 the lights, 2 a breath, 3 a floorboard right at your desk */
  dreadTell(p, n, wasWriting = true) {
    const T = this.teacher, A = this.audio, W = this.world, C = DREAD.creep, v = C.tellVol[lvl(this)];
    if (n === 0) {
      if (!wasWriting) return;
      A.play('chalk_tap', { pos: this.writePose.point.clone(), vol: 0.45 * v, ref: 2 });
    } else if (n === 1) {
      this.dread.dimTo = C.dim;
      for (const b of [W.lights.banks[0], W.lights.banks[1]]) if (!b.dead) b.flicker = Math.max(b.flicker, 0.3);
      A.play('dread_light', { pos: W.lights.banks[0].light.position.clone(), vol: 0.9 * v, ref: 3, reverb: 0.2 });
    } else if (n === 2) {
      A.play('dread_breath', { pos: T.headWorld(new THREE.Vector3()), vol: v, ref: 1.4, reverb: 0.1 });
      if (!this.hard && p.local) this.dreadFriend('sam', 's_dr_lookup', 1.0, 1, true); // Easy: a friend warns you
    } else A.play('dread_creak', { pos: new THREE.Vector3(T.pos.x, 0.05, T.pos.z), vol: v, ref: 1.4, reverb: 0.15 });
    if (n === (this.hard ? 2 : 1)) this.dreadHintOnce(p, 'creep', DREAD.text.creepHint, 5);
    if (!this.hard) this.uiTo(p, 'subtitle', '', `<i>${DREAD.text.tells[Math.min(n, 3)]}</i>`, 'dread', 2.4);
  },

  /**
   * He comes for whoever stares at their phone: backwards, in a few steps, a tell after every step.
   * They look up before he is at the desk: he stops dead, his head turns all the way round, and he goes back.
   * They don't: he turns around at the desk (the usual rules apply: on Hard he sees the phone) and leans over.
   */
  *dreadCreep(p, wasWriting) {
    const T = this.teacher, A = this.audio, C = DREAD.creep, D = this.dread, k = lvl(this);
    const cr = (D.creep = { p, stage: 0 });
    D.nextCreep = this.t + rand(C.gap[k][0], C.gap[k][1]);
    D.nextLean = Math.max(D.nextLean, this.t + 30);
    const here = () => this.players.includes(p);
    const up = () => !p.phoneUp && p.phoneOffT > C.lookUp;
    let out = 'cut';
    try {
      T.lookAt(null, 3);
      T.faceTo(Math.PI, 3);
      this.dreadSilent = true;
      this.dreadTell(p, 0, wasWriting);
      const legs = splitRoute(T.pos, this.dreadRoute(p, this.deskSpot(p)), C.steps);
      // first nothing happens at all (look up now and there is nothing to see)
      for (let t = 0; t < C.pause[k] * 0.5; t += this.dt) { if (!here()) return; if (up()) { D.nextCreep = this.t + 12; return; } yield; }
      this.note(p, 'dread_creep');
      out = 'walk';
      walk: for (let s = 0; s < legs.length; s++) {
        cr.stage = s + 1;
        for (const [x, z] of legs[s]) {
          T.moveTo(x, z, C.speed[k]);
          while (T.moving) {
            if (!here()) { out = 'left'; return; }
            if (up()) { out = 'spotted'; break walk; }
            yield;
          }
        }
        const last = s === legs.length - 1;
        this.dreadTell(p, s + 1);
        for (let t = 0; t < C.pause[k]; t += this.dt) {
          if (!here()) { out = 'left'; return; }
          if (up()) { out = last ? 'late' : 'spotted'; break walk; }
          yield;
        }
        if (last) out = 'lean';
      }
      if (out === 'spotted') {
        // caught in the act: he stops dead, back still turned... then only his head comes round
        T.moveTarget = null;
        this.dreadSilent = false;
        this.note(p, 'dread_spotted');
        this.mischief += C.spotMischief;
        if (p.dist < 3.6) this.dreadSting(p, 'spot');
        this.dreadHintOnce(p, 'spot', DREAD.text.spotHint, 5);
        yield* this.wait(0.8);
        A.play('neck_crack', { pos: T.headWorld(new THREE.Vector3()), vol: 0.9, ref: 2.2 });
        T.owl = true;
        T.lookAt(p.camPos, 1.6);
        yield* this.wait(1.9);
        yield* this.say('t_dr_notmoving', 0.5);
        T.lookAt(null, 2.2);
        yield* this.wait(1.1);
        T.owl = false;
        if (p.local) this.dreadFriend('sam', 's_dr_backwards', 1.5, 0.6);
      }
    } finally {
      D.creep = null;
      this.dreadSilent = false;
      T.owl = false;
      if (out !== 'lean' && out !== 'late') D.dimTo = 0;
      if (out !== 'cut') this.track.event(this.t, p, 'dreadCreep', { out, stage: cr.stage });
    }
    if (out === 'lean' || out === 'late') { yield* this.dreadLean(p, { there: true, late: out === 'late', from: 'creep' }); return; }
    if (out === 'spotted') { T.lookAt(null, 3); yield* this.walk(rand(-1.2, 1.2), -5.5); }
  },

  // ================================================================ 3. he leans over your desk
  /** now and then he walks over to somebody's desk to listen */
  dreadVisits() {
    const D = this.dread;
    if (!this.dreadAuto || D.creep || D.lean || this.t < D.nextLean || !this.dreadOpen('lean') || !this.dreadIdle() || this.anger >= DREAD.creep.calm) return;
    // (only somebody in their chair: he does not come to listen at an empty one, src/sneak.js)
    const seated = this.players.filter((q) => !q.out && !(q.slipK > 0) && !q.ghost); // (nor at a ghost's, src/ghost.js)
    if (!seated.length) return;
    const p = chance(0.6) && seated.includes(this.focus) ? this.focus : pick(seated);
    this.interrupt(this.dreadLean(p, { from: 'visit' }));
  },

  /** what he hears while he listens at this player's desk: '' or why he noticed */
  dreadHeard(p, L) {
    if (p.out || p.slipK > 0) return 'moved'; // (off the chair, src/sneak.js)
    if (p.talk || p.phoneUp || p.aiming || p.failT > 0 || p.shoutT > 0) return 'noise';
    if (p.gaspT > 0) return 'air';
    if (!p.holding) return p.local && this.dread.slack > 0 ? '' : 'breath';
    if (Math.hypot(wrapAngle(p.yaw - L.yaw), p.pitch - L.pitch) > DREAD.breath.still[lvl(this)]) return 'moved';
    return '';
  },

  /** he whispers, at somebody's desk (close to them, far away for the others; everybody reads it) */
  dreadWhisper(id) {
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: this.teacher.headWorld(new THREE.Vector3()), ref: 0.6, vol: 1.3, reverb: 0.04 });
    this.ui.subtitle('', `<i>${meta.text}</i>`, 'teacher', (h ? h.duration : 2) + 0.6);
    return h;
  },

  /**
   * He bends over a player's desk, an ear first, and listens. The player holds their breath and
   * keeps the view still until he straightens up again.
   * o.there: he already stands at the desk with his back to it (the end of a creep); o.late: they just looked up.
   */
  *dreadLean(p, o = {}) {
    const T = this.teacher, A = this.audio, B = DREAD.breath, D = this.dread, k = lvl(this);
    const L = (D.lean = { p, phase: 'come', t: 0, dur: rand(B.lean[k][0], B.lean[k][1]), why: '', from: o.from || 'visit', yaw: 0, pitch: 0 });
    D.nextLean = this.t + rand(B.gap[k][0], B.gap[k][1]);
    const here = () => this.players.includes(p);
    let br = null, out = 'cut', locked = false, ducked = false;
    const unlock = () => { if (locked) { locked = false; this.eventLock = false; } };
    try {
      const spot = this.deskSpot(p);
      if (o.there) {
        // (the end of a creep) he stands at the desk with his back to it... and turns around
        // (the usual rules apply while he does: on Hard he sees a phone that is still up, on Easy a video)
        T.faceTo(spot.face, 1.6);
        T.lookAt(p.camPos, 2.5);
        if (o.late) this.dreadSting(p, 'late');
        else if (p.phoneUp) this.dreadWhisper('tw_dr_looking');
        yield* this.wait(1.7);
      } else {
        T.lookAt(null, 3);
        yield* this.walk(spot.approach.x, spot.approach.z, 0.8);
        if (!here()) return;
        yield* this.walk(spot.stand.x, spot.stand.z, 0.7);
        T.faceTo(spot.face, 4);
        yield* this.wait(0.45);
      }
      yield* this.until(() => !this.eventLock, 6);
      if (!here() || this.eventLock) return;
      // he folds over the desk, an ear first: he is listening. Nothing else happens meanwhile.
      this.eventLock = locked = true;
      L.phase = 'grace';
      this.note(p, 'dread_lean');
      D.dimTo = Math.max(D.dimTo, DREAD.creep.dim * 0.6);
      T.crouchTarget = 0.34; T.stanceTarget = 0.25; T.leanTarget = 0.95;
      T.setPose('desk', spot.corners);
      T.rollTarget = 0.3; T.jawTarget = 0.12; T.eyeGlow = 0.45;
      const side = chance(0.5) ? 1 : -1;
      _d.subVectors(p.camPos, T.pos).setY(0).normalize();
      T.lookAt(new THREE.Vector3(p.camPos.x + _d.z * side * 2.4 - _d.x * 0.5, p.camPos.y - 0.1, p.camPos.z - _d.x * side * 2.4 - _d.z * 0.5), 2.2);
      A.fadeBus('amb', 0.3, 1); ducked = true;
      br = A.play('breath', { loop: true, pos: new THREE.Vector3().copy(p.camPos).addScaledVector(_d, -0.4), vol: 0.85, ref: 0.6, reverb: 0.05 });
      const n = (p.dreadHint.lean = (p.dreadHint.lean || 0) + 1);
      if (n <= 3) this.uiTo(p, 'hint', DREAD.text.leanHint, 6);
      for (const q of this.players) if (q !== p) this.uiTo(q, 'hint', DREAD.text.leanOther.replace('{name}', p.name), 3.5);
      if (!this.hard && p.local && n === 1) this.dreadFriend('nora', 'n_dr_hold', 0.3, 1, true);
      // a moment to get ready (longer the very first time on Easy, and for a friend whose screen is a little behind)
      const grace = (n === 1 && !this.hard ? B.first : B.grace[k]) + (p.local ? 0 : B.lag);
      for (let t = 0; t < grace; t += this.dt) { if (!here()) return; yield; }
      L.phase = 'hold'; L.yaw = p.yaw; L.pitch = p.pitch;
      while (L.t < L.dur) {
        if (!here()) return;
        L.why = this.dreadHeard(p, L);
        if (L.why) break;
        L.t += this.dt;
        yield;
      }
      if (L.why) {
        // he heard that: his face snaps round to yours
        out = 'fail'; L.phase = 'caught';
        this.note(p, 'breath_fail');
        this.track.event(this.t, p, 'breathFail', { why: L.why });
        T.rollTarget = 0; T.jawTarget = 0.3; T.eyeGlow = 1.0;
        T.lookAt(p.camPos, 14);
        this.dreadSting(p, 'fail');
        A.play('sub_hit', { vol: 0.8 });
        this.uiTo(p, 'hint', DREAD.text.fail[L.why] || DREAD.text.fail.noise, 4);
        p.heat += B.failHeat;
        this.focus = p;
        // EASY: heat. (If he was angry already, this is one too many: at 100 it is a strike, as always.)
        if (!this.hard) {
          this.anger = Math.min(100, this.anger + B.failAnger.easy);
          if (this.anger >= 100) { unlock(); L.phase = 'bust'; out = 'caught'; yield* this.bustedSeq('noise', p); return; }
        }
        yield* this.wait(0.55);
        const h = this.dreadWhisper('tw_dr_breathe');
        yield* this.wait((h ? h.duration : 2) * 0.6);
        if (!here()) return;
        if (this.hard) {
          if (p.lookDot > 0.8) {
            // HARD: he is looking right at you, and he heard you
            unlock(); L.phase = 'bust'; out = 'caught';
            yield* this.bustedSeq('breath', p);
            return;
          }
          this.anger = Math.min(100, this.anger + B.failAnger.hard); // (he can't see you right now: no glasses, no light)
        }
        unlock(); L.phase = 'leave';
        yield* this.wait(1.6);
      } else {
        // he heard nothing
        out = 'ok'; L.phase = 'leave';
        unlock();
        this.note(p, 'breath_hold');
        this.track.event(this.t, p, 'breathHold', { held: r1(L.dur) });
        this.mischief += B.okMischief;
        this.anger = Math.max(0, this.anger - B.okCalm);
        this.uiTo(p, 'hint', DREAD.text.okHint, 3.5);
        T.rollTarget = 0; T.jawTarget = 0; T.eyeGlow = 0.12;
        T.leanTarget = 0.25; T.crouchTarget = 0.08; T.stanceTarget = 0;
        T.lookAt(null, 2);
        yield* this.wait(0.9);
        yield* this.say(chance(0.6) ? 't_dr_maybreathe' : 't_hmm', 0.3);
        if (p.local) { if (chance(0.5)) this.dreadFriend('sam', 's_dr_smell', 2.0, 0.6); else this.dreadFriend('nora', 'n_dr_still', 2.0, 0.6); }
      }
    } finally {
      if (br) br.stop(0.4);
      if (ducked) A.fadeBus('amb', 1, 1);
      unlock();
      T.leanTarget = 0; T.crouchTarget = 0; T.stanceTarget = 0; T.rollTarget = 0; T.jawTarget = 0; T.setPose('rest');
      T.eyeGlow = 0.12;
      D.lean = null; D.dimTo = 0;
      this.track.event(this.t, p, 'dreadLean', { out, from: L.from });
    }
    T.lookAt(null, 3);
    yield* this.walk(rand(-1.2, 1.2), -5.4);
  },

  // ================================================================ 2. things change while nobody looks
  dreadChanges(step) {
    const D = this.dread, C = DREAD.change, W = this.world, A = this.audio;
    const calm = this.state === 'playing' && !this.cutscene && !this.ending && !this.eventLock;
    if (calm) {
      // a kid who was gone is back (again: only while nobody looks at the seat)
      for (const g of [...D.gone]) {
        if (this.t < g.backAt) continue;
        g.un = this.dreadUnseen(this.dreadSeatPts(g.kid.seat)) ? g.un + step : 0;
        if (g.un < C.unseen) continue;
        g.kid.setGone(false);
        D.gone = D.gone.filter((x) => x !== g);
        A.play('dread_seat', { pos: new THREE.Vector3(g.kid.seat.x, 0.5, g.kid.seat.z), vol: 0.4, ref: 1.2, reverb: 0.15 });
        this.track.event(this.t, null, 'dreadChange', { kind: 'seat', v: 'back', who: g.kid.name });
      }
      // ...and Kevin is not
      const kv = D.kevin;
      if (kv && this.t >= kv.until) {
        kv.un = this.dreadUnseen(this.dreadSeatPts(this.kevin.seat)) ? kv.un + step : 0;
        if (kv.un >= C.unseen) { this.kevin.setGone(true); this.kevin.lookTarget = null; D.kevin = null; }
      }
    }
    // something new: only in a quiet stretch of the lesson
    const open = calm && this.dreadAuto && this.present && this.brainIdle && !this.memeBusy && !this.lockBully && this.memesOn && this.idleKind !== 'none'
      && this.blackout < 0.3 && W.master > 0.6;
    if (!open) { D.unseenT.clear(); return; }
    if (D.nextChange < 0) D.nextChange = this.t + rand(C.first[0], C.first[1]);
    if (this.t < D.nextChange) return;
    const ready = [];
    for (const c of this.dreadCandidates()) {
      const un = this.dreadUnseen(c.pts) ? (D.unseenT.get(c.id) || 0) + step : 0;
      D.unseenT.set(c.id, un);
      if (un >= C.unseen) ready.push(c);
    }
    if (!ready.length) return;
    const kind = wpick([...new Set(ready.map((c) => c.kind))].map((kd) => [kd === D.lastKind ? 0.5 : 1.5, kd]));
    if (!this.dreadChange(kind, ready.filter((c) => c.kind === kind))) return;
    const g = C.gap[this.phase] || C.gap[0];
    D.nextChange = this.t + rand(g[0], g[1]);
    D.lastKind = kind;
    D.unseenT.clear();
  },

  /** everything that could change right now (if nobody is looking at it) */
  dreadCandidates() {
    const w = this.dreadWhen(), D = this.dread, out = [];
    if (!w) return out;
    if (w.change.includes('poster')) this.dreadPosters.forEach((x, i) => {
      if (x.stage < (DREAD.posters[x.kind] || []).length) out.push({ id: 'poster' + i, kind: 'poster', poster: x, pts: this.dreadPosterPts(x) });
    });
    if (w.change.includes('board') && this.dreadBoardLines().length) out.push({ id: 'board', kind: 'board', pts: this.dreadBoardPts });
    if (w.change.includes('seat')) {
      for (const s of this.students) if (this.dreadKidFree(s)) out.push({ id: 'seat:' + s.name, kind: 'seat', kid: s, pts: this.dreadSeatPts(s.seat) });
      const kv = DREAD.seats.find((v) => v.id === 'kevin');
      if (this.kevin && this.kevin.gone && !D.kevin && kv && this.phase >= kv.min) out.push({ id: 'kevin', kind: 'seat', kevin: true, pts: this.dreadSeatPts(this.kevin.seat) });
    }
    return out;
  },

  /** a kid in the background who is just sitting there */
  dreadKidFree(s) { return !s.gone && !s.hollow && !s.taken && !s.call && !s.lookTarget && s.forcePitch == null && !(s.tremble > 0); },
  /** lines he wrote that can be changed (not the big scrawls, not while the chalk is on the board) */
  dreadBoardLines() {
    const B = this.world.board;
    if (B.busy) return [];
    return B.lines.filter((l) => B.rows.includes(l.y) && l.size <= 60 && l.text.trim().length > 2);
  },

  /** change one thing of this kind now. Returns true if something changed. */
  dreadChange(kind, ready) {
    const D = this.dread, A = this.audio, C = DREAD.change;
    let w = null, v = '';
    if (kind === 'poster') {
      const x = pick(ready).poster;
      this.dreadPoster(x, x.stage + 1);
      v = x.kind + x.stage;
      A.play('dread_paper', { pos: x.mesh.position.clone(), vol: 0.5, ref: 1.6, reverb: 0.15 });
      w = { id: 'poster:' + v, pts: [x.mesh.position.clone()] };
    } else if (kind === 'board') {
      const o = this.dreadBoardChange();
      if (!o) return false;
      v = o.mode;
      const at = this.world.board.toWorld(Math.min(900, o.indent + 220), this.world.board.rows[o.r] - 16, this.world.boardAnchor, new THREE.Vector3());
      A.play('dread_board', { pos: at, vol: 0.5, ref: 2, reverb: 0.2 });
      w = { id: 'board:' + o.r, pts: [at] };
    } else {
      const kids = ready.filter((c) => c.kid), kv = ready.find((c) => c.kevin);
      const opts = DREAD.seats.filter((s) => this.phase >= s.min && (s.id === 'gone' ? kids.length && D.gone.length < 2 : s.id === 'swap' ? kids.length >= 2 : !!kv));
      if (!opts.length) return false;
      v = wpick(opts.map((s) => [s.w, s.id]));
      if (v === 'gone') {
        const kid = wpick(kids.map((c) => [c.kid.seat.row === 0 ? 3 : 1, c.kid]));
        const at = kid.headWorld(new THREE.Vector3());
        kid.setGone(true);
        D.gone.push({ kid, backAt: this.t + rand(C.back[0], C.back[1]), un: 0 });
        w = { id: 'gone:' + kid.name, pts: [at], kid };
      } else if (v === 'swap') {
        const a = pick(kids).kid, b = pick(kids.filter((c) => c.kid !== a)).kid;
        const sa = a.seat, sb = b.seat;
        this.dreadSeat(a, sb); this.dreadSeat(b, sa);
        D.moved = true;
        w = { id: 'swap:' + a.name + '+' + b.name, pts: [a.headWorld(new THREE.Vector3()), b.headWorld(new THREE.Vector3())] };
      } else {
        // Kevin is in his seat. He looks at whoever is closest.
        const K = this.kevin;
        let near = this.me, best = 1e9;
        for (const p of this.players) { const d = Math.hypot(p.eye.x - K.seat.x, p.eye.z - K.seat.z); if (d < best) { best = d; near = p; } }
        K.setGone(false); K.setHollow(true); K.lookTarget = near.camPos; K.speed = 50;
        D.kevin = { until: this.t + rand(C.kevin[0], C.kevin[1]), un: 0 };
        w = { id: 'kevin', pts: [K.headWorld(new THREE.Vector3())], kevin: true };
      }
      A.play('dread_seat', { pos: w.pts[0].clone().setY(0.5), vol: 0.5, ref: 1.2, reverb: 0.15 });
    }
    D.changes++;
    this.track.global.dreadChanges = (this.track.global.dreadChanges || 0) + 1;
    this.track.event(this.t, null, 'dreadChange', { kind, v });
    D.watch.push({ kind, until: this.t + C.notice.within, look: new Map(), seen: new Set(), ...w });
    return true;
  },

  /** a line on the board says something else now (the same on every screen) */
  dreadBoardChange() {
    const B = this.world.board, lines = this.dreadBoardLines();
    if (!lines.length) return null;
    const vars = DREAD.board.filter((b) => b.id !== 'add' || this.boardRow <= 3);
    const b = wpick(vars.map((x) => [x.w, x]));
    const pool = b.text ? b.text[Math.min(this.phase, b.text.length - 1)] : null;
    let o;
    if (b.id === 'add') {
      o = { mode: 'add', r: this.boardRow++, text: pick(pool), indent: Math.round(rand(60, 160)), size: 46, wipe: 0 };
    } else {
      const line = pick(lines);
      const text = b.id === 'flip' ? [...line.text].reverse().join('') : pick(pool.filter((t) => t !== line.text));
      o = { mode: b.id, r: B.rows.indexOf(line.y), text, indent: Math.round(line.chars[0] ? line.chars[0].x : 60), size: line.size, wipe: 1 };
    }
    this.dreadBoardApply(o);
    this.dreadCast({ e: 'board', o });
    return o;
  },
  dreadBoardApply(o) {
    const B = this.world.board, r = o.r | 0, size = clamp(Number(o.size) || 54, 20, 80);
    if (r < 0 || r >= B.rows.length || typeof o.text !== 'string') return;
    const y = B.rows[r];
    if (o.wipe) {
      const top = y - size * 0.86, h = size * 1.2;
      B.ctx.drawImage(B.base, 0, top, B.W, h, 0, top, B.W, h);
      B.lines = B.lines.filter((l) => l.y !== y);
    }
    // (straight to the canvas: the host tells friends about it itself, so their board only changes while they look away)
    Chalkboard.prototype.writeInstant.call(B, o.text.slice(0, 60), r, { indent: clamp(Number(o.indent) || 60, 20, 600), size });
    B.dirty = true;
  },

  dreadPoster(x, stage) {
    const vs = DREAD.posters[x.kind] || [];
    stage = clamp(stage | 0, 0, vs.length);
    x.stage = stage;
    const map = stage === 0 ? x.base : x.tex[stage] || (x.tex[stage] = posterVariant(x.kind, x.base, vs[stage - 1]));
    if (x.mesh.material.map !== map) { x.mesh.material.map = map; x.mesh.material.needsUpdate = true; }
  },

  /** a kid sits somewhere else now */
  dreadSeat(kid, seat) {
    kid.seat = seat;
    kid.root.position.set(seat.x, SEAT_Y, seat.z + 0.03);
  },

  /** who looked at something that changed (looking at it again is noticing it) */
  dreadNotices(dt) {
    const D = this.dread, N = DREAD.change.notice;
    if (!D.watch.length) return;
    D.watch = D.watch.filter((w) => this.t < w.until && (!w.kid || w.kid.gone) && (!w.kevin || D.kevin));
    if (this.cutscene || this.world.master < 0.3 || this.blackout > 0.5) return;
    for (const w of D.watch) for (const p of this.players) {
      if (w.seen.has(p.id)) continue;
      let looking = false;
      const eye = p.slipK > 0 ? p.view : p.camPos;
      for (const pt of w.pts) { if (p.camFwd.dot(_d.subVectors(pt, eye).normalize()) > N.cos) { looking = true; break; } }
      const t = looking ? (w.look.get(p.id) || 0) + dt : 0;
      w.look.set(p.id, t);
      if (t < N.time) continue;
      w.seen.add(p.id);
      this.note(p, 'dread_seen_change');
      this.track.event(this.t, p, 'dreadSeen', { kind: w.kind, id: w.id });
      this.mischief += DREAD.change.mischief;
      this.dreadSting(p, 'notice');
      this.dreadHintOnce(p, 'change', DREAD.text.changeHint, 5);
      if (p.local) this.dreadFriend(w.kind === 'seat' ? 'sam' : 'nora', w.kind === 'seat' ? 's_dr_seat' : w.kind === 'board' ? 'n_dr_board' : 'n_dr_poster', 1.4, 0.45);
    }
  },

  // ================================================================ small things
  /** the lights at the front dim while he creeps and while he listens */
  dreadLights(dt) {
    const D = this.dread, banks = this.world.lights.banks;
    D.dim = Math.abs(D.dim - D.dimTo) < 0.004 ? D.dimTo : damp(D.dim, D.dimTo, 1.4, dt);
    if (D.dim !== D.dimSet) { D.dimSet = D.dim; banks[0].target = 1 - 0.6 * D.dim; banks[1].target = 1 - 0.3 * D.dim; }
  },

  dreadHintOnce(p, key, text, dur) {
    if (p.dreadHint[key]) return;
    p.dreadHint[key] = 1;
    this.uiTo(p, 'hint', text, dur);
  },

  /** Sam or Nora whispers something about it (in a quiet moment; `urgent`: right now) */
  dreadFriend(kind, id, delay = 1.2, prob = 0.5, urgent = false) {
    const f = this.friend(kind), D = this.dread;
    if (!f || f.gone || !chance(prob) || (!urgent && this.t - D.lastFriend < 30)) return;
    D.lastFriend = this.t;
    this.timers.after(delay, () => {
      if (this.state !== 'playing' || this.cutscene || f.gone || f.call || this.anyTalkWith(f) || this.t < (f.speakUntil || 0)) return;
      if (!urgent && (this.watching || this.dread.lean)) return;
      this.friendSay(f, id, 0);
    });
  },

  /** a jolt on one player's screen: 'spot' (caught him creeping), 'late' (he is right there), 'fail' (he heard you), 'notice' (something changed) */
  dreadSting(p, kind) {
    if (p.local) this.dreadStingLocal(kind);
    else if (this.mp) this.mp.toPlayer(p, { t: 'dread', e: 'sting', k: kind });
  },
  dreadStingLocal(kind) {
    const A = this.audio;
    if (kind === 'notice') { A.play('dread_notice', { vol: 0.55, local: true, reverb: 0.1 }); this.dreadFear = Math.max(this.dreadFear, DREAD.change.fear); }
    else if (kind === 'spot') { A.play('stinger_1', { vol: 0.6, local: true }); this.dreadFear = Math.max(this.dreadFear, 0.8); }
    else if (kind === 'late') { A.play('stinger_2', { vol: 0.8, local: true }); this.dreadFear = 1; this.bonkShake = Math.max(this.bonkShake || 0, 0.25); }
    else if (kind === 'fail') { A.play('stinger_1', { vol: 0.9, local: true }); this.dreadFear = 1; this.bonkShake = Math.max(this.bonkShake || 0, 0.3); }
  },

  /** the end of a class: a line of your own numbers (every player gets theirs) */
  dreadEnd() {
    if (this.role === 'guest' || !this.dread) return;
    const row = (p) => { const s = this.track.of(p); return [s.breath_hold, s.breath_fail, s.dread_creep, s.dread_spotted, s.dread_seen_change]; };
    const n = this.dread.changes;
    this.dreadEndShow(row(this.me), n);
    if (this.mp) for (const p of this.players) if (!p.local) this.mp.toPlayer(p, { t: 'dread', e: 'end', row: row(p), n });
  },
  dreadEndShow(row, n) {
    const el = document.getElementById('end-dread');
    if (!el) return;
    const [hold, fail, creep, spot, seen] = [0, 1, 2, 3, 4].map((i) => (Array.isArray(row) ? Number(row[i]) | 0 : 0));
    const parts = [];
    if (hold + fail) parts.push(`He listened at your desk: <b>${hold + fail}</b> &nbsp;·&nbsp; You held your breath: <b>${hold}</b>`);
    if (creep) parts.push(`He crept up on you: <b>${creep}</b> &nbsp;·&nbsp; You looked up in time: <b>${spot}</b>`);
    if (n | 0) parts.push(`Things changed behind your back: <b>${n | 0}</b> &nbsp;·&nbsp; You noticed: <b>${seen}</b>`);
    el.innerHTML = parts.join('<br>');
  },

  // ================================================================ online
  /** host: one event for every friend, in order with the board and the sounds */
  dreadCast(e) {
    const m = this.mp;
    if (m && m.role === 'host' && m.live()) m.q.push({ t: 'dread', ...e });
  },

  /** host: a friend holds their breath / tells what their screen can see */
  dreadMsg(p, m) {
    if (m.h !== undefined) p.in.breath = !!m.h;
    if (Array.isArray(m.v)) p.viewTan = [clamp(Number(m.v[0]) || 1.75, 0.3, 4), clamp(Number(m.v[1]) || 1, 0.3, 4)];
  },

  /** host: the dread part of a snapshot */
  dreadSnap() {
    const D = this.dread, L = D.lean, kids = this.allKids(), g = [];
    for (const x of D.gone) g.push(kids.indexOf(x.kid));
    if (D.kevin) g.push(kids.indexOf(this.kevin));
    return {
      l: L && (L.phase === 'grace' || L.phase === 'hold') ? [L.p.id, L.phase === 'hold' ? 2 : 1] : 0,   // who he listens to
      d: r2(D.dimTo),                                                                                   // the lights
      po: this.dreadPosters.map((x) => x.stage),                                                        // the posters
      ks: D.moved ? this.students.map((s) => this.world.seats.indexOf(s.seat)) : 0,                     // who sits where
      g,                                                                                                // kids that dread took away (or brought back)
      b: this.players.map((p) => [p.id, Math.round(p.breath * 100), p.gaspT > 0 ? 2 : p.holding ? 1 : 0]), // everybody's breath
    };
  },

  /** friend: a change waits here until you look away (never in front of your eyes) */
  dreadDefer(pts, apply) {
    if (!this.dreadSees(this.me, pts, 1.05)) apply();
    else this.dread.defer.push({ pts, apply });
  },

  /** friend: the dread part of a snapshot from the host */
  applyDreadSnap(s) {
    const D = this.dread;
    if (!s || !D || typeof s !== 'object') return;
    D.dimTo = clamp(Number(s.d) || 0, 0, 1);
    D.netLean = Array.isArray(s.l) ? s.l : 0;
    if (Array.isArray(s.po)) s.po.forEach((st, i) => {
      const x = this.dreadPosters[i];
      if (!x || x.want === st) return;
      x.want = st | 0;
      this.dreadDefer(this.dreadPosterPts(x), () => this.dreadPoster(x, x.want));
    });
    const seats = this.world.seats;
    this.students.forEach((c, i) => {
      const want = (Array.isArray(s.ks) && seats[s.ks[i]]) || c.dreadHome;
      if (!want || (c.dreadWant || c.seat) === want) return;
      c.dreadWant = want;
      this.dreadDefer([...this.dreadSeatPts(c.seat), ...this.dreadSeatPts(want)], () => { if (c.seat !== c.dreadWant) this.dreadSeat(c, c.dreadWant); });
    });
    // a kid who is gone, or back: the snapshot has hidden / shown them already. If you are looking, it waits.
    const gone = new Set(Array.isArray(s.g) ? s.g : []);
    this.allKids().forEach((c, i) => {
      if (gone.has(i) === D.netGone.has(i)) return;
      const pts = this.dreadSeatPts(c.seat);
      if (!this.dreadSees(this.me, pts, 1.05)) return;
      c.root.visible = c.gone;
      D.defer.push({ pts, apply: () => { c.root.visible = !c.gone; } });
    });
    D.netGone = gone;
    if (Array.isArray(s.b)) for (const row of s.b) {
      const p = this.players.find((q) => q.id === row[0]);
      if (!p) continue;
      p.breath = clamp((Number(row[1]) || 0) / 100, 0, 1);
      p.netHold = row[2] === 1;
      p.gaspT = row[2] === 2 ? 0.3 : 0;
    }
  },

  /** friend: something the host sent just to you (or to everybody) */
  dreadNet(e) {
    if (!e || this.role !== 'guest' || !this.dread) return;
    if (e.e === 'sting') this.dreadStingLocal(String(e.k));
    else if (e.e === 'board' && e.o && typeof e.o === 'object') {
      // (if it has to wait and he wipes or rewrites that line meanwhile, it is dropped)
      const B = this.world.board, at = () => { const l = B.lines.find((x) => x.y === B.rows[e.o.r | 0]); return l ? l.text : null; }, was = at();
      this.dreadDefer(this.dreadBoardPts, () => { if (at() === was && !(B.job && B.job.type === 'erase')) this.dreadBoardApply(e.o); });
    }
    else if (e.e === 'end') this.dreadEndShow(e.row, e.n);
  },

  /** friend: every frame */
  guestDread(dt) {
    const D = this.dread, me = this.me, A = this.audio;
    if (!D || !this.mp) return;
    // your breath: tell the host (and again now and then while you hold it)
    const want = !!this.input.breath && !this.cutscene;
    D.sendT -= dt;
    if (want !== D.sentHold || (want && D.sendT <= 0)) { D.sentHold = want; D.sendT = 0.4; this.mp.send({ t: 'dread', h: want ? 1 : 0 }); }
    const holding = want && me.breath > 0.01 && !(me.gaspT > 0);
    if (holding !== me.holding) {
      me.holding = holding;
      if (holding) A.play('dread_inhale', { vol: 0.5, reverb: 0.02 });
      else if (!(me.gaspT > 0)) A.play('dread_exhale', { vol: 0.45, reverb: 0.02 });
    }
    // what your screen can see: the host needs it, so nothing changes in front of your eyes
    D.viewT -= dt;
    const v = this.dreadView(me), key = v[0].toFixed(2) + ',' + v[1].toFixed(2);
    if (key !== D.viewKey || D.viewT <= 0) { D.viewKey = key; D.viewT = 5; this.mp.send({ t: 'dread', v: [r2(v[0]), r2(v[1])] }); }
    // changes that waited until you looked away
    if (D.defer.length) D.defer = D.defer.filter((x) => { if (this.dreadSees(me, x.pts, 1.05)) return true; x.apply(); return false; });
    this.dreadLights(dt);
    for (const p of this.players) if (p.avatar) p.avatar.c.tremble = p.netHold ? 0.45 : 0;
    this.dreadHud(me, this.dreadLeanOn(me), dt);
  },
};
