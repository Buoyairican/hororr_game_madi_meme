// Phase 4: leave your seat. C (SEAT on a phone) slips you off your chair onto the floor; crawl with WASD
// (the stick) along the aisles he walks and the floor in front of and behind the rows; C at your desk sits
// you back down. While you are on the floor you can only crawl and use what is at his desk.
//
// His sight uses where you really are: desks, chair backs, his desk and the kids sitting at them hide you,
// the dark helps. A meter fills while he can see you; it fills to the top only while he looks right at you
// (lookDot > 0.8, on Easy and Hard alike) and then you are caught (reason `seat`): he walks you back to your
// desk and it is a strike. Half full: "Hm?" and he looks at you. He walks into you: caught too. He also sees
// your empty chair: "Where did you go?" and he comes to your desk, looking around on the way.
// (He never looks at where you are without seeing you: everything he does looks at your chair, `p.camPos`;
// where you really are is `p.view`.)
//
// At his desk: his glasses (when he leaves them there to rub his eyes: without them he only sees what is close,
// and if they are gone he hunts for them), his laptop (what is on it), the clock (Free Class: the bell rings
// sooner), his chair (a whoopee cushion: he sits down now and then).
// Online: everybody crawls on their own screen and sends where they are; the host checks it, runs his sight
// and the desk, and the snapshot carries everyone's position (their avatars crawl).
import * as THREE from 'three';
import { clamp, lerp, damp, rand, pick, chance, smoothstep, Bag } from './util.js';
import { ROWS, COLS } from './world.js';
import { SNEAK, LAPTOP_SECRETS, MONITOR } from './data.js';

const V = THREE.Vector3;
const _a = new V(), _b = new V(), _c = new V(), _d = new V(), _hit = new V();
const _ray = new THREE.Ray();
const TD = { x: -3.15, z: -5.35 };                                        // his desk (src/world.js)
export const CHAIR = { x: TD.x - 1.05, z: TD.z - 0.9, face: 0.7, seat: 0.514 }; // his chair: where, which way it faces, seat height
const GLASSES_SPOT = new V(TD.x + 0.35, 0.797, TD.z + 0.22);               // where he puts his glasses down
const LAPTOP_READ = { x: TD.x + 0.12, z: TD.z - 0.75 };                    // in front of the laptop's screen (his side of the desk)
const CLOCK_SPOT = { x: 1.95, z: -6.45 };                                  // on the floor under the clock
const DESK_STAND = { x: TD.x + 0.35, z: TD.z - 0.62 };                     // where he stands to put his glasses down
const DRAWER = new V(TD.x - 0.55, 0.6, TD.z - 0.3);
const CUSHION_AT = new V(CHAIR.x, CHAIR.seat + 0.03, CHAIR.z);
const R = (x0, x1, z0, z1) => ({ x0, x1, z0, z1 });
// where you can crawl (the middle of your head): the floor in front of and behind the rows, along both walls,
// and the aisles between the desk columns (the lines he walks too)
const FLOOR = [
  R(-4.62, 4.62, -6.55, -2.42), R(-4.62, 4.62, 3.92, 5.55),
  R(-4.62, -3.55, -2.6, 4.1), R(3.55, 4.62, -2.6, 4.1),
  ...[-2.25, -0.75, 0.75, 2.25].map((a) => R(a - 0.2, a + 0.2, -2.6, 4.1)),
];
// ...but not through his desk or his chair
const BLOCK = [R(TD.x - 1.0, TD.x + 1.0, TD.z - 0.6, TD.z + 0.6), R(CHAIR.x - 0.32, CHAIR.x + 0.32, CHAIR.z - 0.32, CHAIR.z + 0.32)];
const inR = (r, x, z) => x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1;
const flat = (a, x, z) => Math.hypot(a.x - x, a.z - z);
// what you can do at his desk: how long you hold E / USE, what it says while you do
const HOLD = { glasses: 0.35, cushion: 0.6, laptop: SNEAK.laptop.hold, clock: SNEAK.clock.hold };
const DOING = { glasses: 'TAKING HIS GLASSES', cushion: 'WHOOPEE CUSHION', laptop: 'READING HIS LAPTOP', clock: 'MOVING THE CLOCK' };
const PROMPT = { glasses: 'take his glasses', cushion: 'whoopee cushion on his chair', laptop: 'read his laptop', clock: 'move the clock forward' };
export const SNEAK_KINDS = ['glasses', 'cushion', 'laptop', 'clock'];
/** where each thing is (for the tests): stand within SNEAK.reach of it */
export const SNEAK_SPOTS = { glasses: GLASSES_SPOT, laptop: LAPTOP_READ, clock: CLOCK_SPOT, cushion: CHAIR, desk: TD };

export const SneakMixin = {
  setupSneak() {
    // what can hide you: the desks (top and book box), the chair backs, his desk, the kids at their desks
    const occ = (this.sneakOcc = []);
    const box = (x0, y0, z0, x1, y1, z1, kid = null) => occ.push({ box: new THREE.Box3(new V(x0, y0, z0), new V(x1, y1, z1)), kid });
    for (const z of ROWS) {
      for (const x of COLS) {
        box(x - 0.33, 0.53, z - 0.24, x + 0.33, 0.755, z + 0.24);
        box(x - 0.21, 0.6, z + 0.66, x + 0.21, 0.9, z + 0.74);
      }
    }
    box(TD.x - 0.8, 0, TD.z - 0.4, TD.x + 0.8, 0.81, TD.z + 0.4);
    for (const k of this.allKids()) if (k.seat) box(k.seat.x - 0.2, 0.45, k.seat.z - 0.22, k.seat.x + 0.2, 1.25, k.seat.z + 0.18, k);
    // the whoopee cushion (on his chair)
    const g = (this.cushionMesh = new THREE.Group());
    const mat = new THREE.MeshStandardMaterial({ color: 0xd3447a, roughness: 0.42 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 18, 10), mat);
    body.scale.set(1, 0.26, 1.08);
    const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.034, 0.09, 8), mat);
    nub.rotation.x = Math.PI / 2; nub.position.set(0, 0, 0.2);
    g.add(body, nub);
    g.position.copy(CUSHION_AT); g.rotation.y = CHAIR.face;
    g.visible = false;
    this.scene.add(g);
    this.eyeTmp = new V();
  },
  resetSneak() {
    const T = this.teacher;
    this.allowSneak = false;
    this.glassesAt = 'face'; this.glassesBy = null; this.halfBlind = false; this.glassesHunt = false; this.huntEnd = 0;
    if (T.glasses) T.glasses.visible = true;
    this.cushion = null; this.cushionShown = false;
    this.clockAhead = 0;
    this.sitting = false; this.sneakBusy = false; this.sneakScan = null;
    this.nextSit = 1e9; this.nextDeskGlasses = 1e9;
    this.secretBag = new Bag(LAPTOP_SECRETS.map((_, i) => i)); this.secretNext = 0;
    this.laptopShutAt = 0; this.sneakAimOn = false; this.sneakQuipped = false; this.sneakSeatOn = null;
    if (this.cushionMesh) this.cushionMesh.visible = false;
  },
  resetSneakPlayer(p) {
    if (!p.pos) p.pos = new V();
    if (!p.view) p.view = new V();
    if (!p.seatBox) p.seatBox = new THREE.Box3();
    Object.assign(p, { out: false, carried: false, slipK: 0, spotT: 0, noticed: false, sneakSeen: 0, emptyT: 0, emptyCool: 0, hasGlasses: false,
      cushions: SNEAK.cushion.perClass, deskJob: null, outSince: -99, satAt: -99, slipNoiseT: 0, crawlT: 0, standK: 0, standY: 0, moving: false, monitor: false, monitorUntil: 0 });
    p.pos.set(p.eye.x, 0, p.eye.z);
    p.view.copy(p.eye);
  },
  /** from now on you can leave your seat (period 4, Free Class); his new habits (his chair, his glasses on the desk)
   *  start `later` seconds from now at the earliest (Free Class: after the hint that tells you about it) */
  giveSneak(later = 0) {
    if (this.allowSneak) return;
    this.allowSneak = true;
    this.nextSit = this.t + later + rand(SNEAK.sit.first[0], SNEAK.sit.first[1]);
    this.nextDeskGlasses = this.t + later + rand(SNEAK.glasses.first[0], SNEAK.glasses.first[1]);
  },

  // ---------------------------------------------------------------- off the chair, back on it
  canLeave(p) {
    return !!this.allowSneak && this.state === 'playing' && !p.out && p.slipK <= 0.01 && !p.ghost && !this.cutscene && !this.ending && !this.lockBully && !this.eventLock
      && !p.choice && !(p.local && this.choice) && !p.talk && !p.phoneUp && !p.aim && !p.aiming && !(p.handT > 0) && !p.qBusy && !p.showWatch
      && !this.blameBusy && !(this.cat && this.cat.p === p) && !(this.dread && (this.dread.lean || (this.dread.creep && this.dread.creep.p === p)));
  },
  /** the two places next to your chair (in the aisles on both sides) */
  seatSide(p, side, out = new V()) { return out.set(p.desk.x + side * 0.75, 0, p.desk.z + 0.55); },
  nearSeat(p) {
    return Math.min(flat(this.seatSide(p, -1, _d), p.pos.x, p.pos.z), flat(this.seatSide(p, 1, _d), p.pos.x, p.pos.z)) <= SNEAK.sitReach;
  },
  canSit(p) { return p.out && !p.carried && !p.monitor && p.slipK >= 0.99 && this.nearSeat(p); }, // (the class monitor stays up: src/monitor.js)
  /** off the chair, onto the floor in the aisle on the side you look at */
  startOut(p, side = 0) {
    if (!side) side = (p.local ? this.yaw : p.yaw) > 0 ? -1 : 1;
    p.out = true; p.carried = false; p.outSince = this.t; p.spotT = 0; p.noticed = false; p.emptyT = 0; p.deskJob = null; p.standK = 0;
    this.seatSide(p, side, p.pos);
  },
  /** (the host) the chair creaks; counted */
  onOut(p) {
    p.slipNoiseT = SNEAK.slip;
    this.audio.play('sn_slip', { pos: _a.set(p.eye.x, 0.5, p.eye.z).clone(), vol: 0.6, ref: 1.2, reverb: 0.1 });
    this.note(p, 'sneaks');
    this.track.event(this.t, p, 'out');
    if (!this.sneakQuipped) { this.sneakQuipped = true; this.friendQuip('sam', 's_sn_go', 0.9); }
    this.decoyCall(p); // online: the others are told to keep him busy (src/team.js)
  },
  sitDown(p) { p.out = false; p.carried = false; p.satAt = this.t; p.deskJob = null; p.standK = 0; },
  onSit(p) {
    p.slipNoiseT = SNEAK.slip * 0.6;
    this.audio.play('sn_slip', { pos: _a.set(p.eye.x, 0.5, p.eye.z).clone(), vol: 0.45, ref: 1.2, reverb: 0.1, rate: 1.15 });
    this.track.event(this.t, p, 'sat');
  },
  /** right back in your chair (caught, the bell, the last strike) */
  seatNow(p) {
    p.out = false; p.carried = false; p.slipK = 0; p.deskJob = null; p.standK = 0; p.spotT = 0; p.noticed = false; p.emptyT = 0; p.moving = false;
    p.monitor = false; // (a class monitor he caught: on their feet until now, src/monitor.js)
    p.pos.set(p.eye.x, 0, p.eye.z);
    if (p.local) this.sneakUi(null);
  },
  allSeated() {
    for (const p of this.players) if (p.out || p.slipK > 0) this.seatNow(p);
    if (this.allGhostsBack) this.allGhostsBack(); // (and the ghosts in the corner, src/ghost.js)
  },
  /** the chair <-> the floor, over SNEAK.slip seconds (carried: up off the floor) */
  animSlip(p, dt) {
    p.slipK = p.out || p.carried ? Math.min(1, p.slipK + dt / SNEAK.slip) : Math.max(0, p.slipK - dt / SNEAK.slip);
  },

  // ---------------------------------------------------------------- crawling
  /** on the floor you can crawl on (the aisles, the front, the back; not his desk or his chair) */
  onFloor(x, z) {
    let ok = false;
    for (const r of FLOOR) if (inR(r, x, z)) { ok = true; break; }
    if (!ok) return false;
    for (const r of BLOCK) if (inR(r, x, z)) return false;
    return true;
  },
  canBe(p, x, z) {
    if (!this.onFloor(x, z)) return false;
    // not into him (away from him is fine)
    const T = this.teacher;
    if (T.root.visible) {
      const d = Math.hypot(x - T.pos.x, z - T.pos.z);
      if (d < 0.5 && d < flat(p.pos, T.pos.x, T.pos.z)) return false;
    }
    return true;
  },
  /** one step toward (x, z), sliding along whatever is in the way */
  stepTo(p, x, z) {
    const o = p.pos;
    if (this.canBe(p, x, z)) { o.x = x; o.z = z; return true; }
    if (this.canBe(p, x, o.z)) { o.x = x; return true; }
    if (this.canBe(p, o.x, z)) { o.z = z; return true; }
    return false;
  },
  /** move with the stick / WASD, relative to where you look */
  crawl(p, mx, my, yaw, dt) {
    const n = Math.hypot(mx, my);
    if (n < 0.08 || p.slipK < 0.99 || p.carried) return false;
    const k = Math.min(1, n) * (p.monitor ? MONITOR.speed : SNEAK.speed) * dt / n; // (the class monitor walks)
    const dx = (-Math.sin(yaw) * my + Math.cos(yaw) * mx) * k, dz = (-Math.cos(yaw) * my - Math.sin(yaw) * mx) * k;
    return this.stepTo(p, p.pos.x + dx, p.pos.z + dz);
  },
  /** your eyes: on the chair, on the floor, or in between (and up high: carried, or reaching for the clock) */
  sneakEye(p, out = new V()) {
    const k = smoothstep(0, 1, p.slipK);
    let y = (p.monitor ? MONITOR.eye : SNEAK.eye) + (p.crawlT > 0 ? Math.abs(Math.sin(p.crawlT * 4.6)) * 0.03 : 0);
    if (p.carried) y = 1.05;
    else if (p.standK > 0) y = lerp(y, p.standY || SNEAK.reachUp.clock, smoothstep(0, 1, p.standK));
    return out.set(lerp(p.eye.x, p.pos.x, k), lerp(p.eye.y, y, k), lerp(p.eye.z, p.pos.z, k));
  },

  // ---------------------------------------------------------------- your own controls (host and friends alike)
  /** C / SEAT, crawling, holding E / USE at his desk. Returns true while you are off your chair (nothing else then). */
  localSneak(dt, inp, pressed, blocked) {
    const me = this.me, ui = this.ui, touch = this.input.touch, host = this.role !== 'guest';
    this.animSlip(me, dt);
    if (pressed.seat && !blocked) {
      if (!me.out && this.canLeave(me)) {
        this.startOut(me);
        if (host) this.onOut(me);
        this.firstHint('sneak:out', `<span class="touch-only">Crawl with the <b>stick</b>. Desks and kids hide you; <b>don't let him see you</b>. Tap <b>SIT</b> at your desk to sit down.</span>`
          + `<span class="desk-only">Crawl with <b>WASD</b>. Desks and kids hide you; <b>don't let him see you</b>. Press <b>C</b> at your desk to sit down.</span>`, 7);
      } else if (me.out && this.canSit(me)) {
        this.sitDown(me);
        if (host) this.onSit(me);
      } else if (me.out && !me.carried && !me.monitor) this.uiTo(me, 'status', touch ? 'Crawl back to your desk first, then tap <b>SIT</b>.' : 'Crawl back to your desk first, then press <b>C</b>.', 2.5);
      else if (!me.out && this.allowSneak && me.slipK <= 0) this.uiTo(me, 'status', '<b>Not now.</b>', 1.4);
    }
    if (!me.out && me.slipK <= 0) { if (me.deskJob || this.sneakAimOn) { this.sneakAimOn = false; ui.aim(null); } me.deskJob = null; return false; }
    // crawling (not while you read, choose, or hold E at his desk)
    const mv = inp.move || { x: 0, y: 0 };
    me.moving = !blocked && !me.deskJob && me.out && this.crawl(me, mv.x, mv.y, this.yaw, dt);
    me.crawlT = me.moving ? me.crawlT + dt : 0;
    // his desk: hold E / USE
    const kind = blocked ? null : this.deskNear(me);
    if (kind && inp.talk && !me.talkLatch) {
      if (!me.deskJob || me.deskJob.kind !== kind) { me.deskJob = { kind, t: 0 }; me.standY = SNEAK.reachUp[kind]; }
      me.deskJob.t += dt;
      ui.aim(DOING[kind], clamp(me.deskJob.t / HOLD[kind], 0, 1), true);
      this.sneakAimOn = true;
      if (me.deskJob.t >= HOLD[kind]) { me.deskJob = null; me.talkLatch = true; this.noteHold = true; this.sneakUse(me, kind); }
    } else if (me.deskJob || this.sneakAimOn) { me.deskJob = null; this.sneakAimOn = false; ui.aim(null); }
    // the class monitor (src/monitor.js): look at a friend, press E / USE: their name on the board
    const aim = me.monitor && this.away && !kind && !blocked ? this.aimFriend(me) : null; // (only while he is out of the room)
    const mark = aim && this.players.includes(aim) && !aim.ghost ? aim : null;
    if (mark && pressed.tap) { if (host) this.monitorWrite(me, mark); else this.mp.send({ t: 'press', k: 'mark', id: mark.id }); }
    // (holding E there you come up off the floor to reach it: easier to see)
    me.standK = me.deskJob ? Math.min(1, me.standK + dt / 0.45) : Math.max(0, me.standK - dt / 0.4);
    const sit = me.out && !me.carried && !me.monitor && this.nearSeat(me);
    ui.prompt(me.carried || !me.out ? '' : kind ? (touch ? `hold USE · ${PROMPT[kind]}` : `hold [E] · ${PROMPT[kind]}`)
      : mark ? (touch ? 'tap USE · ' : '[E] · ') + MONITOR.prompt.replace('{name}', mark.name)
      : sit ? (touch ? 'tap SIT · sit down' : '[C] · sit down') : '');
    return true;
  },
  /** a thing at his desk: done here (solo, the host) or asked of the host (a friend) */
  sneakUse(p, kind) {
    if (this.role === 'guest' && this.mp) this.mp.send({ t: 'press', k: 'use', w: kind });
    else this.deskAct(p, kind);
  },
  /** the friends' bodies (on the host): where they say they are, at crawling speed at most */
  remoteSneak(p, dt) {
    const i = p.in;
    this.animSlip(p, dt);
    if (i.so && !p.out && !p.carried && this.canLeave(p) && !(this.t < (p.monitorUntil || 0))) { // (monitorUntil: their screen does not know yet that their turn as the class monitor is over, src/monitor.js)
      const side = i.sx < p.desk.x ? -1 : 1;
      this.startOut(p, side); this.onOut(p);
    } else if (!i.so && p.out && !p.carried && !p.monitor) { // (the class monitor stays up: src/monitor.js)
      // back on their chair (on their screen they sat down next to it; if the two ever disagree, theirs wins after a moment)
      p.sitWait = (p.sitWait || 0) + dt;
      if (this.canSit(p) || flat(p.pos, p.desk.x, p.desk.z + 0.55) < 1.6 || p.sitWait > 2) { this.sitDown(p); this.onSit(p); p.sitWait = 0; }
    }
    if (i.so) p.sitWait = 0;
    if (!p.out || p.carried || p.slipK < 0.99 || (p.monitor && !i.so) || !Number.isFinite(i.sx) || !Number.isFinite(i.sz)) { p.moving = false; return; }
    const dx = i.sx - p.pos.x, dz = i.sz - p.pos.z, d = Math.hypot(dx, dz);
    const max = (p.monitor ? MONITOR.speed : SNEAK.speed) * 1.6 * dt + 0.01;
    const k = d > max ? max / d : 1;
    p.moving = d > 0.02 && this.stepTo(p, p.pos.x + dx * k, p.pos.z + dz * k);
    p.crawlT = p.moving ? p.crawlT + dt : 0;
    if (i.st > 0) p.standY = clamp(i.st, SNEAK.eye, SNEAK.reachUp.clock);
    p.standK = i.st > 0 ? Math.min(1, p.standK + dt / 0.45) : Math.max(0, p.standK - dt / 0.4);
  },

  // ---------------------------------------------------------------- his sight (the host)
  /** after updateWatching: for everybody off their chair, what he sees of where they really are */
  updateSneakSight(dt) {
    const T = this.teacher, W = this.world, S = SNEAK.see;
    const head = T.headWorld(_a), fwd = T.forward(_b);
    const present = this.present && T.root.visible;
    const canSee = present && W.master > 0.3 && this.blackout < 0.5 && !this.blind && !this.typing && !this.dozing && !this.dancing;
    const blur = this.halfBlind ? SNEAK.glasses.halfSee : 99;
    for (const q of this.players) q.seatBox.set(_c.set(q.eye.x - 0.2, 0.45, q.eye.z - 0.27), _d.set(q.eye.x + 0.2, 1.25, q.eye.z + 0.13));
    // (the kids sit where they sit now: two of them may have changed places, src/dread.js)
    for (const o of this.sneakOcc) if (o.kid && o.kid.seat) { const k = o.kid.seat; o.box.min.set(k.x - 0.2, 0.45, k.z - 0.22); o.box.max.set(k.x + 0.2, 1.25, k.z + 0.18); }
    for (const p of this.players) {
      if (!p.local) { if (p.slipK > 0) this.sneakEye(p, p.view); else p.view.copy(p.camPos); }
      if (p.monitor) { p.spotT = 0; p.sneakSeen = 0; p.emptyT = 0; p.watching = false; continue; } // (the class monitor: he is out of the room, src/monitor.js)
      if (p.slipK <= 0) { p.spotT = Math.max(0, p.spotT - S.forget * dt); p.sneakSeen = 0; p.emptyT = 0; if (p.emptyCool > 0) p.emptyCool -= dt; continue; }
      _c.subVectors(p.view, head);
      const dist = _c.length();
      const dot = fwd.dot(_c.divideScalar(dist || 1));
      p.dist = dist;
      p.near = present && dist < 2.6 && !this.blind;
      let seen = 0; // 2: right in front of him, 1: at the edge of his eye
      if (canSee && dist < blur && dot > 0.55 && this.sneakVisible(p, head)) seen = dot > 0.8 ? 2 : 1;
      p.sneakSeen = seen; p.watching = seen > 0; p.lookDot = seen ? dot : -1;
      if (seen && !p.carried) {
        const near = clamp((S.far - dist) / (S.far - S.near), 0.25, 1);
        const light = clamp(W.master, 0, 1) * (1 - S.dark * W.gloom);
        const cap = seen === 2 ? 1 : S.side;
        if (p.spotT < cap) p.spotT = Math.min(cap, p.spotT + (seen === 2 ? S.front : S.edge) * near * light * dt);
      } else p.spotT = Math.max(0, p.spotT - S.forget * dt);
      // your empty chair: he is looking where you should be
      if (p.out && !p.carried && canSee) {
        _c.subVectors(p.camPos, head);
        const d = _c.length();
        if (d < blur && fwd.dot(_c.divideScalar(d || 1)) > SNEAK.emptySeat.look) p.emptyT += dt;
        else p.emptyT = Math.max(0, p.emptyT - dt * 0.5);
      } else p.emptyT = 0;
      if (p.emptyCool > 0) p.emptyCool -= dt;
    }
    const me = this.me;
    if (me.slipK > 0) { this.teacherDist = me.dist; this.watching = me.watching; this.near = me.near; }
  },
  /** is there a clear line from his eyes to your head, or to your back? */
  sneakVisible(p, head) {
    if (this.losClear(head, p.view, p)) return true;
    const yaw = p.local ? this.yaw : p.yaw;
    _hit.set(p.view.x + Math.sin(yaw) * 0.35, Math.max(0.32, p.view.y - 0.2), p.view.z + Math.cos(yaw) * 0.35);
    return this.losClear(head, _hit.clone(), p);
  },
  losClear(from, to, who) {
    _d.subVectors(to, from);
    const len = _d.length();
    if (len < 0.05) return true;
    _ray.set(from, _d.divideScalar(len));
    const lim = (len - 0.12) * (len - 0.12);
    for (const o of this.sneakOcc) {
      if (o.kid && (o.kid.gone || !o.kid.root.visible)) continue;
      if (_ray.intersectBox(o.box, _hit) && _hit.distanceToSquared(from) < lim) return false;
    }
    for (const q of this.players) {
      if (q === who || q.slipK > 0.3) continue;
      if (_ray.intersectBox(q.seatBox, _hit) && _hit.distanceToSquared(from) < lim) return false;
    }
    return true;
  },

  // ---------------------------------------------------------------- every frame (the host)
  updateSneak(dt) {
    const T = this.teacher, S = SNEAK.see;
    const free = !this.cutscene && !this.ending && !this.eventLock && !this.lockBully && !this.choice;
    // (in a cutscene nobody's controls run: a slide off or onto a chair still finishes)
    if (this.cutscene) for (const p of this.players) this.animSlip(p, dt);
    for (const p of this.players) {
      // the noise you make: the chair, your knees on the floor
      if (p.slipNoiseT > 0) { p.slipNoiseT -= dt; p.noise = Math.max(p.noise, SNEAK.slipNoise); }
      if (p.moving) p.noise = Math.max(p.noise, SNEAK.crawlNoise);
      if (p.out) this.note(p, 'sneakTime', dt);
      if (p.carried) {
        // he has you by the collar
        T.local(0.05, 0, 0.55, _c);
        p.pos.x = damp(p.pos.x, _c.x, 9, dt); p.pos.z = damp(p.pos.z, _c.z, 9, dt);
        continue;
      }
      if (p.slipK <= 0 || !this.players.includes(p) || p.monitor) continue; // (the class monitor: src/monitor.js)
      // he walks into you
      if (free && p.slipK > 0.9 && this.present && T.root.visible && !this.away && flat(p.pos, T.pos.x, T.pos.z) < SNEAK.bump) {
        this.track.event(this.t, p, 'bumped');
        this.bust('seat', p); return;
      }
      // he sees you: caught when he looks right at you
      if (free && p.spotT >= 1 && p.sneakSeen === 2) { this.bust('seat', p); return; }
      if (p.spotT >= S.notice && !p.noticed && free) { p.noticed = true; this.sneakNotice(p); }
      if (p.spotT < S.notice * 0.4) p.noticed = false;
      // your empty chair
      if (p.out && p.emptyT > SNEAK.emptySeat.time && p.emptyCool <= 0 && free && this.brainIdle && !this.sneakBusy && !this.blameBusy && !this.cat
        && !this.classEvent && !this.quirkBusy && !this.memeBusy) {
        p.emptyT = 0; p.emptyCool = SNEAK.emptySeat.cool;
        this.interrupt(this.seatSearch(p));
      }
    }
    if (this.me.slipK > 0) this.noise = this.me.noise;
    // he scans the floor while he looks for you
    if (this.sneakScan) {
      const a = T.facing + Math.sin(this.t * SNEAK.search.scan) * 1.05;
      this.sneakScan.set(T.pos.x + Math.sin(a) * 3, 0.4, T.pos.z + Math.cos(a) * 3);
    }
    // somebody up at his laptop, reading: the lid is open and the screen glows (he can see that light)
    const L = this.world.laptop;
    if (!this.typing && !this.cutscene && this.players.some((p) => p.standK > 0.5 && this.deskNear(p, 0.35) === 'laptop')) {
      L.openTarget = 1; L.glowTarget = 1; this.laptopShutAt = Math.max(this.laptopShutAt, this.t + 1);
    }
    // the laptop shuts again after you read it
    if (this.laptopShutAt && this.t > this.laptopShutAt) {
      this.laptopShutAt = 0;
      if (!this.typing && !this.cutscene) { L.openTarget = 0; L.glowTarget = 0; }
    }
    // kids next to you look down at you
    for (const k of this.students) {
      if (k.gone || k.hollow || k.call || k.showing) continue;
      let at = null;
      for (const p of this.players) if (p.slipK > 0.5 && !p.carried && k.headWorld(_c).distanceTo(p.view) < 1.3) { at = p.view; break; }
      if (at && !k.lookTarget) { k.lookTarget = at; k.sneakLook = true; }
      else if (!at && k.sneakLook) { if (this.players.some((p) => k.lookTarget === p.view)) k.lookTarget = null; k.sneakLook = false; }
    }
  },

  // ---------------------------------------------------------------- what he does about it
  sneakNotice(p) {
    this.track.event(this.t, p, 'noticed');
    const at = p.view.clone();
    if (!this.brainIdle || this.sneakBusy || this.classEvent || this.quirkBusy || this.blameBusy || this.cat || this.memeBusy || !this.present) this.fx.push(this.sneakGlance(at));
    else this.interrupt(this.sneakLook(p, at));
    if (p.out) { const [who, id] = chance(0.5) ? ['nora', 'n_sn_hide'] : ['sam', 's_sn_down']; this.friendQuip(who, id, 0.1); }
  },
  /** a look without stopping what he is doing */
  *sneakGlance(at) {
    const T = this.teacher, before = T.lookTarget;
    if (!this.present || this.dozing) return;
    T.lookAt(at, 6);
    this.teacherSay('t_sn_hmm', 1.1);
    yield* this.wait(1.7);
    if (T.lookTarget === at) T.lookAt(before, 4);
  },
  /** "Hm?" He stops and looks at where he saw something move */
  *sneakLook(p, at) {
    const T = this.teacher;
    T.clap = null; T.setPose('rest');
    T.lookAt(at, 5);
    yield* this.wait(0.3);
    this.teacherSay('t_sn_hmm', 1.1);
    yield* this.wait(2.4);
    T.lookAt(null, 3);
    yield* this.wait(0.4);
  },
  /** your chair is empty: "Where did you go?" He comes to your desk, looking around on the way */
  *seatSearch(p) {
    const T = this.teacher;
    if (!this.players.includes(p)) return;
    this.sneakBusy = true;
    this.track.event(this.t, p, 'emptySeat');
    const scan = (this.sneakScan = new V());
    try {
      T.clap = null; T.setPose('rest');
      T.lookAt(p.camPos, 5);
      this.angerUp(SNEAK.outAnger, 80);
      p.heat += 6;
      yield* this.wait(0.4);
      this.friendQuip('nora', 'n_sn_back', 0.6);
      yield* this.say('t_sn_where', 0.3); // "Where... did you go?"
      const spot = this.deskSpot(p);
      T.lookAt(scan, 4);
      yield* this.walk(spot.approach.x, spot.approach.z, 1.25);
      yield* this.walk(spot.stand.x, spot.stand.z, 1.0);
      T.faceTo(spot.face, 4);
      if (!this.players.includes(p)) return;
      if (!p.out) {
        // back in time
        T.lookAt(p.camPos, 6); T.leanTarget = 0.5; T.crouchTarget = 0.1;
        p.watchedT = SNEAK.watchFor; p.lastGlare = this.t;
        this.note(p, 'closeCalls');
        this.track.event(this.t, p, 'backInTime');
        this.uiTo(p, 'hint', 'He is <b>watching you</b> now. Sit still for a while.', 3.5);
        yield* this.say('t_hmm', 0.4);
      } else {
        // still gone: he looks around from your desk
        yield* this.wait(SNEAK.search.stay);
        T.lookAt(p.camPos, 4);
        yield* this.say('t_ifind', 0.4); // "I... will find you."
      }
    } finally {
      this.sneakBusy = false; this.sneakScan = null;
      T.leanTarget = 0; T.crouchTarget = 0;
    }
    T.lookAt(null, 3);
    yield* this.walk(rand(-1.2, 1.2), -5.3);
  },
  /** caught off your chair: he comes to you, takes you by the collar and walks you back (called by bustedSeq) */
  *walkBack(p) {
    const T = this.teacher;
    const at = p.view.clone();
    T.lookAt(at, 8);
    const s = this.walkSpot(p.pos.x, p.pos.z, new V());
    yield* this.walkUntil(s.x, s.z, 2.3, () => flat(T.pos, p.pos.x, p.pos.z) < 0.8);
    if (!this.players.includes(p)) return;
    T.facePoint(p.view, 6); T.lookAt(p.view, 8);
    T.leanTarget = 0.7; T.crouchTarget = 0.25;
    T.setPose('grab');
    yield* this.wait(0.45);
    this.audio.play('sn_grab', { pos: p.view.clone(), vol: 0.9, ref: 1.2 });
    p.carried = true; p.monitor = false; p.deskJob = null; p.standK = 0; // (a class monitor: by the collar now, src/monitor.js)
    if (p.local) { // (you look up at him)
      const h = T.headWorld(_c), d = h.sub(p.view);
      this.yaw = Math.atan2(-d.x, -d.z); this.pitch = clamp(Math.atan2(d.y, Math.hypot(d.x, d.z)), -1, 1);
    }
    T.leanTarget = 0.2; T.crouchTarget = 0;
    yield* this.say('t_sn_back', 0.1); // "Back... to your... seat."
    const spot = this.deskSpot(p);
    T.lookAt(null, 3);
    yield* this.walk(spot.approach.x, spot.approach.z, 1.3);
    yield* this.walk(spot.stand.x, spot.stand.z, 1.0);
    T.setPose('rest');
    this.seatNow(p);
    this.audio.play('chair_scrape', { pos: p.eye.clone(), vol: 0.6, ref: 1.5 });
  },
  /** he takes his glasses back from you (caught while you have them) */
  *takeBackGlasses(p) {
    p.hasGlasses = false;
    yield* this.say('t_sn_mine', 0.3); // "And these... are mine."
    this.restoreGlasses();
    this.audio.play('sn_grab', { pos: this.teacher.headWorld(new V()), vol: 0.6 });
  },

  // ---------------------------------------------------------------- his desk
  /** what you can do where you are (null: nothing); slack: how far off the host still lets it count */
  deskNear(p, slack = 0) {
    if (!p.out || p.carried || p.slipK < 0.99 || !(this.allowSneak || p.monitor)) return null; // (the class monitor can, any period: src/monitor.js)
    const r = SNEAK.reach + slack, x = p.pos.x, z = p.pos.z;
    let best = null, bd = 1e9;
    const consider = (kind, at, reach) => { const d = flat(at, x, z); if (d < reach && d < bd) { bd = d; best = kind; } };
    if (this.glassesAt === 'desk') consider('glasses', GLASSES_SPOT, r + 0.1);
    if (!this.typing) consider('laptop', LAPTOP_READ, r);
    if (this.allowSneak && !this.cushion && !this.sitting && p.cushions > 0) consider('cushion', CHAIR, r + 0.1); // (he only sits down when sneaking is on: sneakHabit)
    if (this.mode === 'free' && this.clockAhead < SNEAK.clock.max) consider('clock', CLOCK_SPOT, r);
    return best; // (the nearest one)
  },
  deskAct(p, kind) {
    if (!this.players.includes(p) || this.state !== 'playing' || !SNEAK_KINDS.includes(kind) || this.deskNear(p, 0.35) !== kind) return;
    const A = this.audio, T = this.teacher, W = this.world;
    if (kind === 'glasses') {
      this.glassesAt = 'gone'; this.glassesBy = p; p.hasGlasses = true;
      T.glasses.visible = false;
      A.play('sn_grab', { pos: GLASSES_SPOT.clone(), vol: 0.75, ref: 1.2 });
      this.mischief += SNEAK.glasses.mischief;
      this.note(p, 'glasses'); this.track.event(this.t, p, 'glasses');
      this.completeObjective('steal');
      this.uiTo(p, 'toast', 'You have his glasses', 2.4);
      this.friendQuip('sam', 's_sn_glasses', 0.6);
    } else if (kind === 'laptop') {
      const L = W.laptop;
      if (!this.typing) { L.openTarget = 1; L.glowTarget = 1; this.laptopShutAt = this.t + SNEAK.laptop.open; }
      A.play('keys_2', { pos: L.screenPos.clone(), vol: 0.45, ref: 1 });
      const i = this.mode === 'story' ? this.secretNext++ % LAPTOP_SECRETS.length : this.secretBag.next();
      const [title, body] = LAPTOP_SECRETS[i];
      this.uiTo(p, 'showNote', `<div class="secret"><div class="secret-h">HIS LAPTOP · ${title}</div>${body}</div>`);
      this.mischief += SNEAK.laptop.mischief;
      this.note(p, 'secrets'); this.track.event(this.t, p, 'secret', { i });
      this.completeObjective('secret');
    } else if (kind === 'clock') {
      this.clockAhead = Math.min(SNEAK.clock.max, this.clockAhead + SNEAK.clock.minutes);
      A.play('sn_clock', { pos: W.clock.pos.clone(), vol: 0.9, ref: 2 });
      this.mischief += SNEAK.clock.mischief;
      this.note(p, 'clocks'); this.track.event(this.t, p, 'clock', { ahead: this.clockAhead });
      this.completeObjective('clock');
      this.uiTo(p, 'toast', `The clock is ${this.clockAhead} minutes fast`, 2.4);
    } else if (kind === 'cushion') {
      p.cushions--;
      this.cushion = { by: p, t: this.t }; this.cushionShown = true;
      A.play('sn_squeak', { pos: CUSHION_AT.clone(), vol: 0.55, ref: 1 });
      this.nextSit = Math.min(this.nextSit, this.t + SNEAK.sit.soon);
      this.track.event(this.t, p, 'cushionSet');
      this.uiTo(p, 'toast', 'Now wait for him to sit down', 2.4);
    }
    this.decoyCredit(p); // online: a friend's question kept him busy meanwhile (src/team.js)
  },
  /** Free Class: how many seconds of class the clock skips (the bell rings when it says 12:30) */
  clockMinutes() { return this.mode === 'free' ? this.clockAhead : 0; },

  // ---------------------------------------------------------------- his habits (src/game.js idleBrain asks first)
  sneakHabit() {
    if (!this.allowSneak || this.idleKind !== 'lesson' || !this.present) return null;
    if (this.glassesAt !== 'face' && !this.glassesHunt) return this.actFetchGlasses(); // he goes back for his glasses
    if (this.t > this.nextSit && (this.cushion || chance(SNEAK.sit.chance))) {
      this.nextSit = this.t + rand(SNEAK.sit.gap[0], SNEAK.sit.gap[1]);
      return this.actSit();
    }
    if (this.t > this.nextDeskGlasses && chance(0.5)) {
      this.nextDeskGlasses = this.t + rand(SNEAK.glasses.gap[0], SNEAK.glasses.gap[1]);
      return this.actDeskGlasses();
    }
    return null;
  },
  /** to his desk without walking through it */
  *walkDesk(x, z, speed = 0.85) {
    const T = this.teacher;
    if (T.pos.z > TD.z - 0.55 && T.pos.x < TD.x + 1.2) yield* this.walk(TD.x + 1.25, T.pos.z, speed);
    if (T.pos.z > TD.z - 0.6) yield* this.walk(TD.x + 1.25, TD.z - 0.75, speed);
    yield* this.walk(x, z, speed);
  },
  /** he takes off his glasses, puts them on his desk and rubs his eyes... and writes without them */
  *actDeskGlasses() {
    const T = this.teacher, G = SNEAK.glasses;
    if (this.glassesAt !== 'face' || T.glassesHeld || T.glasses.parent !== T.head) return;
    T.lookAt(null, 3);
    yield* this.walkDesk(DESK_STAND.x, DESK_STAND.z);
    T.faceTo(0, 4);
    yield* this.wait(0.4);
    T.setPose('wipe', { stage: 'reach' });
    yield* this.wait(0.8);
    T.takeGlasses();
    this.blind = true; // (glasses off: he sees nothing until he has rubbed his eyes)
    T.setPose('wipe', { stage: 'hold' });
    yield* this.wait(0.4);
    T.leanTarget = 0.35;
    T.setPose('wipe', { stage: 'reach', target: GLASSES_SPOT.clone() });
    yield* this.wait(0.9);
    this.putGlassesDown();
    T.leanTarget = 0;
    if (this.mode === 'story') this.friendQuip('nora', 'n_sn_hale', 1.2); // "Those are Mr. Hale's glasses."
    else this.friendQuip('sam', 's_sn_left', 1.2);
    this.firstHint('sneak:glasses', 'He left his <b>glasses</b> on his desk. Without them he only sees what is close. '
      + '<span class="touch-only">Tap <b>SEAT</b></span><span class="desk-only">Press <b>C</b></span> and go take them!', 7);
    if (!this.objectives.some((o) => o.id === 'steal')) this.addObjective({ id: 'steal', text: 'Steal his glasses from his desk' });
    try {
      T.setPose('rub');
      this.blind = true; // rubbing his eyes: he sees nothing
      yield* this.wait(G.rub);
    } finally { this.blind = false; T.setPose('rest'); }
    // he writes without them (he can only see what is close); then he goes back for them
    yield* this.actWrite();
    yield* this.actFetchGlasses();
  },
  putGlassesDown() {
    const T = this.teacher, g = T.glasses;
    T.glassesHeld = false; T.glassesOn = false;
    this.scene.attach(g);
    g.position.copy(GLASSES_SPOT);
    g.rotation.set(-0.08, Math.PI + 0.4, 0);
    this.glassesAt = 'desk'; this.halfBlind = true;
    this.audio.play('chalk_tap', { pos: GLASSES_SPOT.clone(), vol: 0.35, rate: 1.4 });
  },
  /** his glasses back on his face (from the desk, his spare pair, from you) */
  restoreGlasses() {
    const T = this.teacher;
    T.glasses.visible = true;
    T.wearGlasses(this.glassesAt === 'gone');
    this.glassesAt = 'face'; this.halfBlind = false; this.glassesHunt = false;
  },
  *actFetchGlasses() {
    const T = this.teacher;
    T.lookAt(null, 3);
    T.leanTarget = 0.2;
    try { yield* this.walkDesk(DESK_STAND.x, DESK_STAND.z, 0.75); } finally { T.leanTarget = 0; }
    T.faceTo(0, 4);
    yield* this.wait(0.3);
    if (this.glassesAt === 'desk') {
      T.leanTarget = 0.35;
      T.setPose('wipe', { stage: 'reach', target: GLASSES_SPOT.clone() });
      yield* this.wait(0.9);
      T.leanTarget = 0;
      if (this.glassesAt === 'desk') this.restoreGlasses();
      T.setPose('rest');
      yield* this.wait(0.5);
      return;
    }
    if (this.glassesAt === 'gone') yield* this.lostGlasses();
  },
  /** they are gone. He pats the desk, squints, and hunts for them up and down the rows... then a spare pair */
  *lostGlasses() {
    const T = this.teacher, G = SNEAK.glasses, A = this.audio;
    this.glassesHunt = true; this.sneakBusy = true;
    const first = !this.huntEnd;
    if (first) this.huntEnd = this.t + G.lost;
    try {
      if (first) {
        T.setPose('swat', { at: GLASSES_SPOT.clone() });
        yield* this.wait(0.5);
        T.poseData.down = true;
        A.play('desk_slap', { pos: GLASSES_SPOT.clone(), vol: 0.5, ref: 2 });
        yield* this.wait(0.5);
        T.setPose('rest');
        yield* this.say('t_myglasses', 0.3); // "My... glasses."
        this.angerUp(G.anger, 85);
        this.track.event(this.t, this.glassesBy, 'glassesMissed');
        this.firstHint('sneak:blind', 'Without his glasses <b>he only sees what is close</b>. He will look for them.', 5);
      }
      // squinting, his face close to everything
      T.leanTarget = 0.35;
      const spots = [[-1.6, -3.4], [1.6, -3.4], [-0.75, -0.6], [0.75, 1.0], [2.25, -1.2], [-2.25, 0.6], [0, -4.2]];
      while (this.t < this.huntEnd) {
        const [x, z] = pick(spots);
        T.lookAt(null, 3);
        yield* this.walk(x, z, 0.7);
        const scan = (this.sneakScan = new V());
        T.lookAt(scan, 3);
        if (chance(0.45)) this.teacherSay(pick(['t_cantsee', 't_sn_hear']), 1.2);
        yield* this.wait(rand(1.4, 2.2));
        this.sneakScan = null;
      }
      T.leanTarget = 0;
      // his spare pair, from his desk drawer
      T.lookAt(null, 3);
      yield* this.walkDesk(DESK_STAND.x - 0.6, DESK_STAND.z, 0.9);
      T.faceTo(0, 4);
      A.play('sn_drawer', { pos: DRAWER.clone(), vol: 0.9, ref: 2 });
      yield* this.wait(0.9);
      this.restoreGlasses();
      this.huntEnd = 0;
      yield* this.say('t_sn_spare', 0.5); // "My... spare... pair."
    } finally {
      this.glassesHunt = false; this.sneakBusy = false; this.sneakScan = null;
      T.leanTarget = 0;
    }
  },
  /** he sits down on his chair for a while and watches the class (or a whoopee cushion is waiting) */
  *actSit() {
    const T = this.teacher, SI = SNEAK.sit;
    const fx = Math.sin(CHAIR.face), fz = Math.cos(CHAIR.face);
    T.lookAt(null, 3);
    yield* this.walkDesk(CHAIR.x + fx * 0.6, CHAIR.z + fz * 0.6);
    T.faceTo(CHAIR.face, 4);
    yield* this.wait(0.6);
    this.sitting = true;
    let popped = false;
    try {
      T.footFwdTarget = 0.3; T.crouchTarget = SI.crouch; T.leanTarget = -0.08;
      T.moveTo(CHAIR.x + fx * 0.1, CHAIR.z + fz * 0.1, 0.35);
      yield* this.wait(0.9);
      if (this.cushion) { popped = true; yield* this.cushionPop(); return; }
      T.lookAt(this.cp, 1.5);
      yield* this.wait(rand(SI.for[0], SI.for[1]));
    } finally {
      this.sitting = false;
      T.footFwdTarget = 0; T.crouchTarget = 0; T.leanTarget = 0;
    }
    if (!popped) { yield* this.wait(0.5); T.lookAt(null, 3); yield* this.walk(rand(-1.4, 0.6), -5.4); }
  },
  /** PFFFFRRRT. Up he jumps; the class can't breathe; "Who did it?" */
  *cushionPop() {
    const T = this.teacher, c = this.cushion, C = SNEAK.cushion;
    this.cushion = null;
    this.sneakBusy = true;
    const by = c && this.players.includes(c.by) ? c.by : null;
    try {
      this.audio.play('sn_cushion', { pos: CUSHION_AT.clone(), vol: 1.5, ref: 3, reverb: 0.3 });
      yield* this.wait(0.3);
      this.sitting = false;
      T.footFwdTarget = 0; T.crouchTarget = 0; T.leanTarget = 0.25; T.stretchTarget = 0.12;
      this.addLaugh(C.laugh, T.headWorld(new V()), null);
      if (by) { this.mischief += C.mischief; this.note(by, 'cushions'); this.track.event(this.t, by, 'cushion'); }
      this.completeObjective('cushion');
      this.friendQuip('sam', 's_sn_cushion', 1.4);
      yield* this.wait(0.9);
      T.stretchTarget = 0; T.leanTarget = 0.45;
      T.lookAt(CUSHION_AT, 5);
      yield* this.wait(1.0);
      this.cushionShown = false; // he takes it off the chair
      this.audio.play('sn_squeak', { pos: CUSHION_AT.clone(), vol: 0.45, ref: 1, rate: 0.8 });
      T.leanTarget = 0;
      this.angerUp(C.anger, 88);
      yield* this.turnToClass();
    } finally { this.sneakBusy = false; T.stretchTarget = 0; T.leanTarget = 0; this.cushionShown = false; }
    if (by && this.allowBlame && !by.out && by.slipK <= 0) yield* this.askWhoDidIt(by, 'cushion');
    else { yield* this.say('t_sn_whodid', 0.4); yield* this.actStare(1.5); }
  },
  /** (clock quirk) he checks the clock: a clock that runs fast, he puts right */
  *clockNoticed() {
    if (this.clockMinutes() <= 0) return;
    const T = this.teacher, W = this.world;
    yield* this.say('t_sn_time', 0.3); // "That... is not... the time."
    T.setPose('point', { at: W.clock.pos.clone() });
    yield* this.wait(0.5);
    this.audio.play('sn_clock', { pos: W.clock.pos.clone(), vol: 0.9, ref: 2, rate: 0.85 });
    this.clockAhead = 0;
    this.angerUp(SNEAK.clock.anger, 85);
    this.track.event(this.t, null, 'clockFixed');
    yield* this.wait(0.8);
    T.setPose('rest');
  },

  // ---------------------------------------------------------------- online
  sneakSnap() {
    return [{ face: 0, desk: 1, gone: 2 }[this.glassesAt] | 0, this.halfBlind ? 1 : 0, this.cushionShown ? 1 : 0, this.clockAhead | 0, this.allowSneak ? 1 : 0, this.sitting ? 1 : 0];
  },
  applySneakSnap(s) {
    if (!Array.isArray(s)) return;
    this.glassesAt = ['face', 'desk', 'gone'][s[0] | 0] || 'face';
    this.halfBlind = !!s[1]; this.cushionShown = !!s[2]; this.cushion = s[2] ? this.cushion || {} : null;
    this.clockAhead = Number(s[3]) || 0; this.allowSneak = !!s[4]; this.sitting = !!s[5];
    this.teacher.glasses.visible = this.glassesAt !== 'gone';
  },
  /** one row of a player in the snapshot: [out (0 sitting, 1 out, 2 carried), x, z, the meter, glasses, cushions left, trust (src/stuck.js), the class monitor (src/monitor.js)] */
  sneakRow(p) { return [p.out ? (p.carried ? 2 : 1) : 0, Math.round(p.pos.x * 100) / 100, Math.round(p.pos.z * 100) / 100, Math.round(p.spotT * 100) / 100, p.hasGlasses ? 1 : 0, p.cushions | 0, p.trust | 0, p.monitor ? 1 : 0]; },
  /** a friend's screen: your own row (the host may have put you back in your chair, or be carrying you) */
  applyMySneak(r) {
    if (!Array.isArray(r)) return;
    const me = this.me, st = r[0] | 0;
    if (st === 2) {
      me.carried = true; me.out = true; me.deskJob = null; me.standK = 0;
      me.pos.set(Number(r[1]) || 0, 0, Number(r[2]) || 0);
    } else if (me.carried) { this.seatNow(me); }
    else if (!st && me.out && this.t - me.outSince > 1.5) this.seatNow(me);  // (you did not get off your chair after all, or he put you back)
    me.spotT = Number(r[3]) || 0; me.hasGlasses = !!r[4]; me.cushions = r[5] | 0; me.trust = r[6] | 0;
    if (r[7] && !me.out) { this.startOut(me); me.pos.set(Number(r[1]) || 0, 0, Number(r[2]) || 0); } // (in charge: on your feet where the host put you)
    me.monitor = !!r[7];
  },
  applyOtherSneak(p, r) {
    if (!Array.isArray(r)) return;
    const st = r[0] | 0;
    p.out = st > 0; p.carried = st === 2;
    p.netX = Number(r[1]) || 0; p.netZ = Number(r[2]) || 0;
    p.monitor = !!r[7];
  },

  // ---------------------------------------------------------------- what you see
  sneakVisuals(dt) {
    if (this.cushionMesh) this.cushionMesh.visible = !!this.cushionShown && this.state === 'playing';
    const T = this.teacher;
    if (T.glasses) T.glasses.visible = this.glassesAt !== 'gone';
    if (this.role === 'guest') {
      // the others: glide toward where the host says they are
      for (const p of this.players) {
        if (p.local) continue;
        this.animSlip(p, dt);
        if (p.netX !== undefined) { p.pos.x = damp(p.pos.x, p.netX, 12, dt); p.pos.z = damp(p.pos.z, p.netZ, 12, dt); }
      }
      this.animSlip(this.me, 0); // (your own: localSneak)
    }
    this.sneakHud();
  },
  /** the meter under the crosshair (only while you are off your chair), and the SEAT button */
  sneakHud() {
    const me = this.me, ui = this.ui, touch = this.input.touch;
    const seat = !this.allowSneak || this.state !== 'playing' || me.monitor ? '' : me.out || me.slipK > 0 ? 'SIT' : 'SEAT';
    if (seat !== this.sneakSeatOn) { this.sneakSeatOn = seat; ui.seatButton(seat); }
    if ((me.slipK <= 0 && !me.out) || me.monitor) { this.sneakUi(null); return; } // (the class monitor: no meter)
    const k = clamp(me.spotT, 0, 1);
    const seen = this.role === 'guest' ? k > 0.03 : me.sneakSeen > 0 || k > 0.05; // (a friend's screen: the meter from the host)
    const label = me.carried ? 'CAUGHT' : k >= 0.99 ? 'HE SEES YOU' : seen ? 'HE CAN SEE YOU' : 'HIDDEN';
    this.sneakUi({ label, k, cls: me.carried ? 'caught' : k > SNEAK.see.notice ? 'hot' : seen ? 'warm' : 'cool', touch });
  },
  sneakUi(st) { this.ui.sneak(st); },
};
