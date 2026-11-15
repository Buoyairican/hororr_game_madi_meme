// More things to throw (mixed into Game): the pranks you unlock (UNLOCKS in src/data.js). They join the
// prank selector of src/pranks.js: hold G / PRANK to aim, X / the mouse wheel / SWAP switches.
//  - SPITBALL: fast and quiet, and it sticks where it lands. On him: he feels his neck and blames the
//    roof ("The roof... is... leaking."). The second time he knows it is not rain. The third: caught.
//  - RUBBER BAND: very fast, it stings ("Ow."), and the twang tells him where you sit. It snaps off
//    walls and keeps flying: a hit after a bounce is a TRICK SHOT, and he looks at the wall instead.
//  - WATER BALLOON: a slow lob that bursts and soaks everybody near it. He has to wipe his glasses
//    (he can't see meanwhile), on the board it washes the lesson away. Worth two hits; slow to refill.
// The numbers are in PRANK_MORE (src/data.js). The host (or solo game) simulates them like paper;
// friends online see them through the same snapshots, and can throw their own unlocked ones.
import * as THREE from 'three';
import { PRANK, PRANK_NAMES, PRANK_MORE } from './data.js';
import { PAPER_KINDS, PAPER_MESH, makePaperMesh } from './pranks.js';
import { Profile } from './profile.js';
import { clamp, rand, pick } from './util.js';

// ---- they join the tables the prank code reads (speeds, fold times, names, network numbers)
PRANK.flight = PRANK.flight || {};
PRANK.refill = PRANK.refill || {};
for (const k in PRANK_MORE) {
  const m = PRANK_MORE[k];
  PRANK.fold[k] = m.fold; PRANK.speed[k] = m.speed; PRANK.flight[k] = { grav: m.grav, drag: m.drag }; PRANK.refill[k] = m.refill;
  PRANK_NAMES[k] = m.name;
  if (!PAPER_KINDS.includes(k)) PAPER_KINDS.push(k);
}

const TIPS = {
  spit: '<b>SPITBALL</b>: fast and quiet, and it sticks. He blames the roof... the first two times.',
  band: '<b>RUBBER BAND</b>: very fast, and it stings. Bounce it off a wall and he looks the wrong way.',
  bomb: '<b>WATER BALLOON</b>: soaks everything near it. He has to wipe his glasses. Slow to refill.',
};
const THROW_SND = { spit: 'p6_spit', band: 'p6_twang' };

const _a = new THREE.Vector3(), _b = new THREE.Vector3();

// ---- what they look like (shared geometry, made on first use)
let PARTS = null;
function parts() {
  if (PARTS) return PARTS;
  const wet = new THREE.MeshStandardMaterial({ color: 0xe9e7df, roughness: 0.35 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0xc9a15a, roughness: 0.6 });
  const latex = new THREE.MeshStandardMaterial({ color: 0x2f86de, roughness: 0.22, metalness: 0.05 });
  const balloon = new THREE.SphereGeometry(0.07, 12, 9);
  balloon.scale(1, 1.18, 1);
  PARTS = {
    spit: [new THREE.SphereGeometry(0.02, 7, 5), wet],
    band: [new THREE.TorusGeometry(0.032, 0.0045, 5, 14), rubber],
    bomb: [balloon, latex],
    knot: [new THREE.ConeGeometry(0.014, 0.03, 6), latex],
  };
  return PARTS;
}
for (const k in PRANK_MORE) {
  PAPER_MESH[k] = () => {
    const P = parts();
    const m = new THREE.Mesh(P[k][0], P[k][1]);
    if (k === 'bomb') { const knot = new THREE.Mesh(P.knot[0], P.knot[1]); knot.position.y = 0.088; m.add(knot); }
    m.castShadow = false;
    return m;
  };
}

export const MorePranksMixin = {
  setupMorePranks() {
    // the one in your hand while you aim
    for (const k in PRANK_MORE) { const mesh = makePaperMesh(k); this.heldMeshes[k] = mesh; this.heldPaper.add(mesh); }
  },

  resetMorePranks() {
    // (the profile can change between classes: a prank you no longer have goes back to the paper ball)
    for (const p of this.players) if (!this.prankKinds(p).includes(p.prankKind)) p.prankKind = 'ball';
  },

  /** what this player can pick with X / the wheel / SWAP: paper ball, paper plane, and what they unlocked */
  prankKinds(p) {
    const list = ['ball', 'plane'];
    if (p && p.local) for (const k in PRANK_MORE) if (Profile.has(k)) list.push(k);
    return list;
  },
  /** the next thing in your hand (X / wheel / SWAP): paper, the pranks you unlocked, the laser and the note (src/blame.js toolKinds) */
  nextPrank(p) {
    const list = this.toolKinds(p);
    const k = list[(list.indexOf(p.prankKind) + 1) % list.length];
    this.prankTip(p, k);
    return k;
  },
  /** the first time you pick a new one: what it does */
  prankTip(p, k) {
    if (p.local && TIPS[k] && Profile.once('tip_' + k)) this.timers.after(0.15, () => (this.ui.hint.local || this.ui.hint).call(this.ui, TIPS[k], 7));
  },

  /** just thrown (host / solo): its own sound, and how long your arm stays up */
  morePrankThrown(p, kind, pos) {
    const m = PRANK_MORE[kind];
    if (!m) return;
    p.exposeT = m.expose;
    if (kind === 'bomb') p.crumpleT = 1.6; // filling the next one is not quiet
    if (THROW_SND[kind]) this.audio.play(THROW_SND[kind], { pos, vol: kind === 'band' ? 0.8 : 0.6, ref: 1.2, reverb: 0.05 });
  },

  // ---------------------------------------------------------------- hits
  /** one of these touched the room. True: handled here (paper's own bounce is skipped). */
  morePaperRoom(pr, h) {
    const m = PRANK_MORE[pr.kind];
    if (!m) return false;
    const type = h.type;
    if (pr.kind === 'bomb') { pr.pos.copy(pr.prev); this.burst(pr, pr.pos.clone(), { type }); return true; }
    const scores = pr.owner && !this.cutscene && !this.ending && this.players.includes(pr.owner);
    if (pr.kind === 'spit') {
      // it sticks where it lands
      pr.pos.copy(pr.prev); pr.vel.set(0, 0, 0); pr.state = 'rest'; pr.dead = true;
      this.audio.play('p6_splat', { pos: pr.pos.clone(), vol: 0.6, ref: 1.2, reverb: 0.05 });
      if (type === 'board' && !pr.board) { pr.board = true; if (scores) this.hitBoard(pr.owner, pr.pos.clone()); }
      return true;
    }
    // a rubber band snaps off walls and keeps going (a hit after that is a trick shot)
    if (pr.hitDone || (pr.bounces || 0) >= m.bounces) return false; // spent: it drops like paper
    const v = pr.vel, vn = v.x * h.nx + v.y * h.ny + v.z * h.nz;
    pr.pos.copy(pr.prev);
    if (vn < 0) { const k = (1 + m.bounce) * vn; v.x -= k * h.nx; v.y -= k * h.ny; v.z -= k * h.nz; v.multiplyScalar(0.9); }
    pr.bounces = (pr.bounces || 0) + 1;
    if (type !== 'floor' && type !== 'desk') { pr.banked = true; pr.bankAt = pr.pos.clone(); }
    const sp = v.length();
    this.audio.play('p6_snap', { pos: pr.pos.clone(), vol: clamp(sp / 16, 0.2, 0.7), ref: 1.4, reverb: 0.15, rate: rand(1.1, 1.3) });
    if (type === 'board' && !pr.board) { pr.board = true; if (scores) this.hitBoard(pr.owner, pr.pos.clone()); }
    return sp >= 1.5; // too slow to bounce on: it settles like paper
  },

  /** one of these hit somebody. True: handled here. */
  morePaperPerson(pr, h) {
    const m = PRANK_MORE[pr.kind];
    if (!m) return false;
    pr.hitDone = true; pr.dead = true;
    pr.pos.copy(pr.prev);
    const at = pr.pos.clone();
    if (pr.kind === 'bomb') { this.burst(pr, at, h); return true; }
    const trick = pr.kind === 'band' && !!pr.banked, wallAt = trick ? pr.bankAt : null;
    if (pr.kind === 'spit') {
      this.audio.play('p6_splat', { pos: at, vol: 0.85, ref: 1.3, reverb: 0.05 });
      pr.state = 'gone'; this.removePaper(pr); // it stays on them
    } else {
      pr.vel.multiplyScalar(-0.25); pr.vel.y = Math.abs(pr.vel.y) * 0.3 + 0.8;
      this.audio.play('p6_snap', { pos: at, vol: 0.95, ref: 1.6, reverb: 0.1 });
    }
    // (while he is busting somebody, or the class is over, it still flies but scores nothing)
    if (this.cutscene || this.ending) return true;
    const by = pr.owner;
    if (!by || !this.players.includes(by)) return true;
    const kind = pr.kind, name = m.name.toLowerCase();
    if (trick) { this.note(by, 'trickShots'); this.mischief += m.mischief.trick; this.uiTo(by, 'toast', 'TRICK SHOT!', 1.8); }
    if (h.type === 'teacher') this.moreHitsHim(by, kind, h.part, at, trick, wallAt);
    else if (h.type === 'kid') {
      if (kind === 'band' || h.who.hollow) this.hitKid(by, h.who, at); // "OW!" (and they may throw one back)
      else this.spitKid(by, h.who, at);
      if (trick) this.addLaugh(m.laugh.trick, at, by);
    } else if (h.type === 'friend') { this.hitFriend(by, h.who, at); if (trick) this.addLaugh(m.laugh.trick, at, by); }
    else if (h.type === 'player') {
      this.note(by, 'hits'); this.track.event(this.t, by, 'hit', { target: 'player', who: h.who.id, kind, trick });
      this.mischief += m.mischief.player;
      this.bonk(h.who, by.name, at, null);
      this.uiTo(h.who, 'hint', `<b>${by.name}</b> got you with a ${name}!`, 2.5);
    }
    return true;
  },

  /** a spitball on a kid: "Ewww!" (they never find out who) */
  spitKid(p, kid, at) {
    const m = PRANK_MORE.spit;
    this.note(p, 'hits'); this.track.event(this.t, p, 'hit', { target: 'kid', who: kid.name, kind: 'spit' });
    this.mischief += m.mischief.kid;
    this.addLaugh(m.laugh.kid, at, p);
    kid.tremble = 0.5; kid.speed = 6;
    const guess = this.guessOrigin(p);
    kid.lookTarget = guess;
    this.sayAt(kid, this.kidVoice(kid, 'k_ew'), 0, 1.0);
    this.timers.after(1.6, () => { kid.tremble = 0; if (kid.lookTarget === guess) { kid.lookTarget = null; kid.speed = 4; } });
    if (this.present) {
      this.angerUp(PRANK.anger.ow, 92);
      if (this.brainIdle && this.canReactPrank()) this.interrupt(this.reactThud(kid.headWorld(new THREE.Vector3())));
    }
  },

  /** one of these hit him */
  moreHitsHim(p, kind, part, at, trick, wallAt) {
    const m = PRANK_MORE[kind];
    this.note(p, 'hits'); this.note(p, 'hitHim');
    // (`where`, not `part`: only paper on his head knocks the glasses off)
    this.track.event(this.t, p, 'hit', { target: 'teacher', kind, where: part, trick: !!trick });
    this.completeObjective('prank');
    if (part === 'back') this.completeObjective('prankBack');
    this.mischief += m.mischief.him;
    this.addLaugh(m.laugh.him + (trick ? m.laugh.trick : 0), at, p);
    if (p.local && kind !== 'spit') {
      const f = pick(this.friends.filter((x) => !x.gone && !x.call));
      if (f) this.timers.after(1.3, () => { if (this.state === 'playing' && !this.cutscene && !this.watching) this.friendSay(f, f.kind === 'sam' ? 's_hit' : 'n_hit', 0.2); });
    }
    this.moreTeacherHit(p, kind, part, wallAt);
  },

  /** he was hit by one of these: his own reaction for each (or, the third time, he knows) */
  moreTeacherHit(p, kind, part, wallAt) {
    if (!this.present || this.cutscene || this.ending) return;
    const m = PRANK_MORE[kind] || { counts: 1 };
    if (this.t - p.lastPrankHit > PRANK.streakReset) p.prankStreak = 0;
    p.prankStreak += m.counts; p.lastPrankHit = this.t;
    p.heat += 8;
    const n = p.prankStreak;
    if (n >= 3 && !this.eventLock && !this.lockBully && !this.choice) this.bust('prank', p);
    else if (this.canReactPrank()) {
      this.interrupt(kind === 'spit' ? this.reactSpit(p, n) : kind === 'band' ? this.reactBand(p, n, wallAt) : kind === 'wash' ? this.reactLesson(p, n) : this.reactSoaked(p, n));
    } else this.angerUp(PRANK.anger.busy, 92);
  },

  /** a water balloon bursts: everybody near it gets wet */
  burst(pr, at, h) {
    const m = PRANK_MORE.bomb, by = pr.owner, T = this.teacher;
    pr.state = 'gone'; this.removePaper(pr);
    this.audio.play('p6_splash', { pos: at, vol: 1.0, ref: 2.2, reverb: 0.2 });
    this.world.chalkBurst(at, 70, 1.3);
    if (this.cutscene || this.ending || !by || !this.players.includes(by)) return;
    const r2 = m.splash * m.splash;
    const near = (pt) => pt.distanceToSquared(at) < r2;
    this.note(by, 'hits');
    let wet = 0, laugh = m.laugh.floor, said = false;
    this.mischief += m.mischief.floor;
    // the kids and your friends
    for (const k of this.allKids()) {
      if (k.gone || !(h.who === k || near(k.headWorld(_a)))) continue;
      wet++;
      if (k.hollow) { k.lookTarget = by.camPos; k.speed = 1.2; this.timers.after(5, () => { if (k.lookTarget === by.camPos) { k.lookTarget = null; k.speed = 4; } }); continue; }
      const friend = k.kind === 'sam' || k.kind === 'nora';
      this.mischief += friend ? m.mischief.friend : m.mischief.kid;
      laugh = Math.max(laugh, friend ? m.laugh.friend : m.laugh.kid);
      k.tremble = 0.7;
      this.timers.after(1.8, () => { k.tremble = 0; });
      if (!said) { said = true; if (friend) this.friendSay(k, k.kind === 'sam' ? 's_ow' : 'n_ow', 0.3); else this.sayAt(k, this.kidVoice(k, 'k_ew'), 0, 1.0); }
    }
    // friends playing online
    for (const q of this.players) {
      if (q === by || !(h.who === q || near(this.headOf(q, _a)))) continue;
      wet++;
      this.mischief += m.mischief.player;
      laugh = Math.max(laugh, m.laugh.player);
      this.bonk(q, by.name, at, null);
      this.uiTo(q, 'hint', `<b>${by.name}</b> soaked you with a water balloon!`, 2.5);
    }
    // him
    const him = this.present && T.root.visible && (h.type === 'teacher' || near(T.headWorld(_a)) || near(_b.set(T.pos.x, 1.0, T.pos.z)));
    // the board: the lesson runs down the wall
    const board = h.type === 'board';
    if (board) {
      const B = this.world.board;
      if (B.job) B.stopJob();
      B.clear(); this.boardRow = 0;
      this.mischief += m.mischief.board;
      laugh = Math.max(laugh, m.laugh.board);
    }
    this.track.event(this.t, by, 'hit', { target: him ? 'teacher' : board ? 'board' : wet ? 'class' : 'floor', kind: 'bomb', wet });
    if (him) {
      this.note(by, 'hitHim'); this.note(by, 'soaked');
      this.completeObjective('prank'); this.completeObjective('prankBack');
      this.mischief += m.mischief.him;
      laugh = m.laugh.him;
    }
    this.addLaugh(laugh, at, by);
    if (him) this.moreTeacherHit(by, 'bomb', 'body', null);
    else if (board && this.present) this.moreTeacherHit(by, 'wash', 'board', null);
    else if (this.present) {
      this.angerUp(wet ? PRANK.anger.ow + 4 : PRANK.anger.thud, 92);
      if (this.brainIdle && this.canReactPrank()) this.interrupt(this.reactThud(at));
    }
  },

  // ---------------------------------------------------------------- his reactions
  /** a spitball: he feels his neck and looks up. The roof? The second one is not rain. */
  *reactSpit(p, n) {
    const T = this.teacher;
    this.prankBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      yield* this.wait(0.5);
      T.setPose('wipe', { stage: 'reach', target: T.headWorld(new THREE.Vector3()).add(_a.set(0, -0.12, 0)) });
      T.lookAt(new THREE.Vector3(T.pos.x, 3.6, T.pos.z + 0.1), 2.5); // up, at the ceiling
      yield* this.wait(1.2);
      T.setPose('rest');
      if (n <= 1) {
        yield* this.say('t_roof', 0.5);
        this.angerUp(PRANK_MORE.spit.anger, 85);
        yield* this.wait(0.7);
      } else {
        yield* this.say('t_notrain', 0.3);
        // now he looks for whoever did it (an arm still up: caught)
        const origin = this.guessOrigin(p);
        T.lookAt(origin, 6); T.facePoint(origin, 5);
        yield* this.wait(0.6);
        for (const dx of [-1.1, 1.1, 0]) { T.lookAt(origin.clone().add(_a.set(dx, 0, 0)), 3); yield* this.wait(0.65); }
        this.angerUp(PRANK.anger.again, 85);
      }
      T.lookAt(null, 3);
      yield* this.wait(0.4);
    } finally { this.prankBusy = false; T.setPose('rest'); }
  },

  /** a rubber band: "Ow." Then straight to where the twang came from (off a wall: to the wall) */
  *reactBand(p, n, wallAt) {
    const T = this.teacher;
    this.prankBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      T.jitter = 0.5;
      yield* this.wait(0.25);
      T.jitter = 0;
      yield* this.say('t_ow', 0.15);
      this.angerUp(PRANK_MORE.band.anger, 88);
    } finally { T.jitter = 0; this.prankBusy = false; }
    const origin = wallAt ? wallAt.clone() : new THREE.Vector3(p.eye.x + rand(-0.5, 0.5), 1.1, p.eye.z + rand(-0.3, 0.3));
    yield* this.reactPrank(p, 'back', origin, wallAt ? 1 : n);
  },

  /** a water balloon: he is wet, and so are his glasses */
  *reactSoaked(p, n) {
    const T = this.teacher;
    this.prankBusy = true;
    try {
      T.clap = null; T.setPose('rest'); T.lookAt(null, 3);
      T.jitter = 0.35;
      yield* this.wait(0.5);
      T.jitter = 0;
      yield* this.wait(0.7);
      yield* this.say('t_wet', 0.5);
      this.angerUp(PRANK_MORE.bomb.anger, 88);
    } finally { T.jitter = 0; this.prankBusy = false; }
    yield* this.glassesWipe(PRANK_MORE.bomb.wipe);
    yield* this.reactPrank(p, 'back', this.guessOrigin(p), n);
  },

  /** the board was washed clean: he looks at where his lesson was */
  *reactLesson(p, n) {
    const T = this.teacher;
    this.prankBusy = true;
    try {
      T.clap = null; T.setPose('rest');
      T.faceTo(Math.PI, 4); T.lookAt(this.boardCenter, 3);
      yield* this.wait(1.7);
      yield* this.say('t_lesson', 0.6);
    } finally { this.prankBusy = false; }
    yield* this.reactPrank(p, 'board', this.guessOrigin(p), n);
  },
};
