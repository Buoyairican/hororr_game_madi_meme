// The two secret endings (mixed into Game). Both are reached by playing, and Mr. Hale's notes
// (src/replay.js) tell you how:
//  - CLASS CANCELLED (Free Class, also online and in the daily class): paper on his head knocks
//    his glasses off. The third time in one class they break. Without them he cannot see a class
//    at all, so there is no class, so he is not a teacher: he walks out to look it up.
//  - MR. HALE (story, the last period): get the true ending. When he is gone, something knocks at
//    the back of the room. Look at the supply closet (the door with no handle, on the right wall
//    at the back) and knock three times: E / click, or TALK on a touch screen. Mr. Hale walks out.
// The closet door is built here; it is also where one of the notes is found (look at it).
import * as THREE from 'three';
import { ROOM, BOARD_Z } from './world.js';
import { SECRETS } from './data.js';
import { clamp, damp, rand, pick } from './util.js';

const STEPS = ['step_1', 'step_2', 'step_3', 'step_4'];
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

export const SecretMixin = {
  setupSecrets() {
    const S = SECRETS.closet, M = this.world.materials, scene = this.scene;
    const box = new THREE.BoxGeometry(1, 1, 1);
    const x1 = ROOM.x1, z = S.z, w = S.w, h = S.h;
    const group = new THREE.Group();
    const add = (mat, sx, sy, sz, px, py, pz, parent = group) => { const m = new THREE.Mesh(box, mat); m.scale.set(sx, sy, sz); m.position.set(px, py, pz); parent.add(m); return m; };
    add(M.frame, 0.1, 0.08, w + 0.16, x1 - 0.03, h + 0.04, z);
    add(M.frame, 0.1, h + 0.08, 0.08, x1 - 0.03, h / 2 + 0.04, z - w / 2 - 0.04);
    add(M.frame, 0.1, h + 0.08, 0.08, x1 - 0.03, h / 2 + 0.04, z + w / 2 + 0.04);
    // what is behind it: nothing you can see... until the light comes on
    const inside = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0x010102, fog: false }));
    inside.position.set(x1 - 0.012, h / 2, z); inside.rotation.y = -Math.PI / 2;
    group.add(inside);
    // the leaf (hinged on the far side, so from your seat you see into the doorway). No handle.
    const leaf = new THREE.Group();
    leaf.position.set(x1 - 0.045, 0, z + w / 2);
    add(M.darkWood, 0.045, h - 0.02, w - 0.01, 0, h / 2, -w / 2, leaf).castShadow = true;
    const cv = document.createElement('canvas');
    cv.width = 256; cv.height = 64;
    const c = cv.getContext('2d');
    c.fillStyle = '#cfc8ae'; c.fillRect(0, 0, 256, 64);
    c.fillStyle = '#1d1b16'; c.font = 'bold 34px "Special Elite", monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('SUPPLIES', 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.085), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    sign.position.set(-0.026, 1.58, -w / 2); sign.rotation.y = -Math.PI / 2;
    leaf.add(sign);
    group.add(leaf);
    // Mr. Hale in the doorway: a shape against the light
    const sc = document.createElement('canvas');
    sc.width = 128; sc.height = 256;
    const s = sc.getContext('2d');
    s.fillStyle = '#050403';
    s.beginPath(); s.ellipse(64, 40, 21, 26, 0, 0, Math.PI * 2); s.fill();                       // head
    s.fillRect(55, 60, 18, 14);                                                                   // neck
    s.beginPath(); s.moveTo(22, 96); s.quadraticCurveTo(64, 62, 106, 96); s.lineTo(100, 178); s.lineTo(28, 178); s.closePath(); s.fill(); // cardigan
    s.fillRect(14, 96, 15, 84); s.fillRect(99, 96, 15, 84);                                       // arms
    s.fillRect(36, 176, 24, 80); s.fillRect(68, 176, 24, 80);                                     // legs
    const sil = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 1.72), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, fog: false, depthWrite: false }));
    sil.position.set(x1 - 0.08, 0.86, z); sil.rotation.y = -Math.PI / 2;
    sil.visible = false;
    group.add(sil);
    // (the light is only part of the scene while the door is open: a light that is switched off still costs
    //  every lit pixel in the room a little, on phones and old computers)
    const light = new THREE.PointLight(0xffc27a, 0, 6, 1.6);
    light.position.set(x1 - 0.5, 1.5, z);
    light.visible = false;
    group.add(light);
    scene.add(group);
    this.closet = { group, leaf, inside, sil, light, open: 0, openTarget: 0, glow: 0, glowTarget: 0 };
    this.closetPos = V3(x1 - 0.1, 1.2, z);
    this.glassHits = 0;
  },

  resetSecrets() {
    const C = this.closet;
    C.open = C.openTarget = C.glow = C.glowTarget = 0;
    C.leaf.rotation.y = 0; C.sil.visible = false; C.light.intensity = 0; C.light.visible = false;
    C.inside.material.color.setHex(0x010102);
    this.glassHits = 0;
  },

  /** every frame: the closet door swings, the light inside comes on */
  updateSecrets(dt) {
    const C = this.closet;
    if (C.open === C.openTarget && C.glow === C.glowTarget) return;
    C.open = Math.abs(C.open - C.openTarget) < 0.002 ? C.openTarget : damp(C.open, C.openTarget, 1.8, dt);
    C.glow = Math.abs(C.glow - C.glowTarget) < 0.002 ? C.glowTarget : damp(C.glow, C.glowTarget, 1.2, dt);
    C.leaf.rotation.y = C.open * 1.45;
    C.light.intensity = C.glow * 2.2;
    C.light.visible = C.glow > 0.01;
    C.inside.material.color.setRGB(0.004 + 0.5 * C.glow, 0.004 + 0.36 * C.glow, 0.008 + 0.17 * C.glow);
  },

  // ---------------------------------------------------------------- CLASS CANCELLED: his glasses break
  /** paper hit his head (host / solo). True: that was the last time, the ending takes over. */
  glassesHit(p) {
    if (this.glassesAt !== 'face') return false;
    this.note(p, 'glassesOff');
    this.glassHits = (this.glassHits || 0) + 1;
    if (this.mode !== 'free') return false; // in the story they are Mr. Hale's glasses: they hold
    const need = SECRETS.glasses.breakAt, n = this.glassHits;
    if (n >= need && this.present && !this.cutscene && !this.ending && !this.eventLock && !this.lockBully) {
      this.track.event(this.t, p, 'secret', { kind: 'glasses' });
      this.cutscene = true; this.ending = true;
      this.interrupt(this.glassesEnding(p));
      return true;
    }
    // a crack: everybody hears it, and reads how many they can take
    this.timers.after(2.8, () => {
      if (this.state !== 'playing' || this.ending) return;
      this.audio.play('p6_crack', { pos: this.teacher.headWorld(V3(0, 0, 0)), vol: 0.9, ref: 2.2, reverb: 0.15 });
      this.ui.hint(`His glasses <b>cracked</b>. (${Math.min(n, need - 1)} / ${need})`, 3.5);
    });
    return false;
  },

  *glassesEnding(p) {
    const T = this.teacher, W = this.world, A = this.audio, g = T.glasses;
    const sam = this.friend('sam'), nora = this.friend('nora');
    this.cutscene = true; this.ending = true;
    this.ui.clearTransient();
    if (this.choice) this.pickChoice(-1);
    for (const q of this.players) { q.aim = null; q.aiming = false; if (q.choice) this.pickChoice(-1, q); }
    if (this.teacherVoice) { this.teacherVoice.stop(0.05); this.voiceUntil = 0; }
    A.fadeBus('amb', 0.35, 1.5);
    T.clap = null; T.setPose('rest'); T.lookAt(null, 3);
    T.leanTarget = 0; T.crouchTarget = 0; T.rollTarget = 0;
    // they fly off... and this time they do not survive the floor
    this.scene.attach(g);
    T.glassesHeld = false; T.glassesOn = false;
    const from = g.position.clone(), yaw = T.root.rotation.y;
    const land = V3(clamp(T.pos.x + Math.sin(yaw) * 0.6, ROOM.x0 + 0.4, ROOM.x1 - 0.4), 0.02, clamp(T.pos.z + Math.cos(yaw) * 0.6, BOARD_Z + 0.35, ROOM.z1 - 0.4));
    let t = 0;
    while (t < 0.6) {
      t += this.dt;
      const k = Math.min(1, t / 0.6);
      g.position.lerpVectors(from, land, k);
      g.position.y += Math.sin(k * Math.PI) * 0.35;
      g.rotation.x += this.dt * 9; g.rotation.z += this.dt * 6;
      yield;
    }
    g.position.copy(land);
    g.rotation.set(-Math.PI / 2, rand(0, Math.PI * 2), 0);
    A.play('p6_break', { pos: land, vol: 1.15, ref: 2.5, reverb: 0.25 });
    W.chalkBurst(V3(land.x, 0.06, land.z), 18, 0.35);
    for (const b of W.lights.banks) if (!b.dead) b.flicker = 0.5;
    this.lookAllAt(V3(land.x, 0.3, land.z));
    yield* this.wait(1.0);
    yield* this.say('t_myglasses', 0.3);
    // he feels around the floor, finds them, holds them up
    T.lookAt(land, 2);
    T.crouchTarget = 0.35; T.leanTarget = 0.9;
    T.setPose('desk', { L: land.clone().add(V3(0.18, 0.4, 0)), R: land.clone().add(V3(-0.12, 0.4, 0.05)) });
    yield* this.wait(2.0);
    T.takeGlasses();
    T.crouchTarget = 0; T.leanTarget = 0;
    T.setPose('wipe', { stage: 'hold' });
    T.lookAt(null, 2);
    T.faceTo(0, 2.2); // he turns to the class with them in his hands
    yield* this.wait(1.9);
    yield* this.say('t_broken', 0.4);
    if (sam && !sam.gone) this.friendSay(sam, 's_broke', 0);
    yield* this.wait(2.4);
    // they fall out of his hand
    this.scene.attach(g);
    T.glassesHeld = false;
    T.setPose('rest');
    const top = g.position.clone();
    t = 0;
    while (t < 0.4) { t += this.dt; const k = Math.min(1, t / 0.4); g.position.y = top.y + (0.02 - top.y) * k * k; g.rotation.x += this.dt * 7; yield; }
    g.rotation.set(-Math.PI / 2, rand(0, Math.PI * 2), 0);
    A.play('p6_crack', { pos: g.position.clone(), vol: 0.8, ref: 2 });
    this.lookAllBack();
    // he turns to the class... and cannot find it
    T.faceTo(0, 2);
    yield* this.wait(1.2);
    for (const x of [-2.6, 2.6, 0.4]) { T.lookAt(V3(x, 1.2, 0.5), 1.6); yield* this.wait(1.0); }
    yield* this.say('t_noclass', 0.5);
    if (nora && !nora.gone) this.friendSay(nora, 'n_cantsee', 0);
    yield* this.wait(2.8);
    T.rollTarget = 0.35;
    yield* this.say('t_isthere', 0.4);
    yield* this.wait(1.5); // nobody says a word
    this.classGiggle(V3(0, 1.1, 1.5), 0.7);
    yield* this.wait(1.2);
    T.rollTarget = 0;
    yield* this.say('t_notteacher', 0.6);
    yield* this.say('t_lookup', 0.4);
    // out of the door (the laptop is no use to him now)
    T.lookAt(null, 3);
    yield* this.walk(3.9, -5.0, 0.7);
    A.play('door_open', { pos: W.door.pos, vol: 1.1, ref: 2.5 });
    W.door.openTarget = 1;
    yield* this.wait(1.0);
    yield* this.walkLine(5.9, -5.0, 0.7);
    T.root.visible = false;
    this.present = false;
    W.door.openTarget = 0;
    yield* this.wait(1.3);
    A.play('door_slam', { pos: W.door.pos, vol: 0.7, ref: 2 });
    yield* this.wait(1.0);
    // the class
    A.play('v_applause', { pos: V3(0, 1.2, 1), vol: 0.9, ref: 3, reverb: 0.3 });
    A.play('class_laugh', { pos: V3(0, 1.1, 0.5), vol: 0.8, ref: 3, reverb: 0.25 });
    for (const k of this.allKids()) if (!k.gone && !k.hollow) k.talking = rand(1.5, 3);
    yield* this.wait(1.6);
    A.play('bell', { pos: V3(3.5, 2.8, -6.8), vol: 1.2, ref: 3, reverb: 0.4 });
    this.completeObjective('bell');
    yield* this.wait(2.8);
    this.blackoutTarget = 1;
    A.fadeBus('amb', 0, 2);
    yield* this.wait(2.2);
    this.finish('glasses');
  },

  // ---------------------------------------------------------------- MR. HALE: knock three times
  /**
   * The quiet moment after he is gone (the true ending). Something knocks at the back of the room.
   * Look at the closet and knock three times. Returns true when the secret ending ran.
   */
  *secretKnock(who = this.me) {
    const K = SECRETS.knock, A = this.audio, ui = this.ui, touch = this.input.touch, sam = this.friend('sam');
    const at = this.closetPos;
    for (let i = 0; i < 3; i++) A.play('p6_knock', { pos: at, vol: 0.6, ref: 3, reverb: 0.4, delay: 1.6 + i * 0.55, lowpass: 1100 });
    let t = 0, knocks = 0, limit = K.wait, said = false;
    this.input.pressed.tap = false;
    while (t < limit) {
      t += this.dt;
      if (!said && t > 3.7) { said = true; if (sam && !sam.gone) this.friendSay(sam, 's_knock', 0); }
      const looking = this.lookingAt(at, 0.9);
      if (looking) limit = Math.max(limit, Math.min(K.window, t + 4)); // while you look at it, there is time
      ui.prompt(looking ? `${touch ? 'tap TALK' : '[E]'} · knock on the closet  ${knocks} / ${K.need}` : '');
      if (this.input.pressed.tap) {
        this.input.pressed.tap = false;
        if (looking) {
          knocks++;
          A.play('p6_knock', { pos: this.camPos.clone().addScaledVector(this.camFwd, 0.7), vol: 0.95, ref: 1.5, reverb: 0.35 });
          this.handT = 0.4;
          limit = Math.max(limit, Math.min(K.window + 4, t + 4));
          if (knocks >= K.need) break;
        }
      }
      yield;
    }
    ui.prompt('');
    if (knocks < K.need) return false;
    yield* this.haleEnding(who);
    return true;
  },

  *haleEnding(who) {
    const W = this.world, A = this.audio, C = this.closet, kevin = this.kevin;
    const sam = this.friend('sam'), nora = this.friend('nora'), at = this.closetPos;
    this.cutscene = true;
    this.track.event(this.t, who, 'secret', { kind: 'hale' });
    yield* this.wait(1.5);
    // ...and something knocks back
    for (let i = 0; i < 3; i++) A.play('p6_knock', { pos: at, vol: 1.0, ref: 3, reverb: 0.4, delay: i * 0.5, rate: 0.85 });
    this.lookAllAt(at);
    this.scareFear = Math.max(this.scareFear, 0.4);
    yield* this.wait(2.5);
    yield* this.haleSay('h_who', true);
    if (nora && !nora.gone) yield* this.waitVoice(this.friendSay(nora, 'n_hale', 0), 0.4);
    // the door with no handle opens from the inside
    A.play('door_open', { pos: at, vol: 1.0, ref: 2.5, rate: 0.8 });
    C.openTarget = 1; C.glowTarget = 1;
    W.gloomTarget = 0;
    yield* this.wait(1.8);
    C.sil.visible = true;
    for (let i = 0; i < 2; i++) A.play(pick(STEPS), { pos: V3(at.x - 0.3, 0.05, at.z), vol: 0.5, ref: 1.6, reverb: 0.4, delay: i * 0.6, rate: 1.1 });
    yield* this.wait(1.5);
    yield* this.haleSay('h_late');
    yield* this.haleSay('h_never');
    // Kevin
    for (const b of W.lights.banks) if (!b.dead) b.flicker = 0.6;
    A.play('zap', { vol: 0.5 });
    yield* this.wait(0.4);
    if (kevin) { kevin.setGone(false); kevin.setHollow(false); kevin.lookTarget = at; kevin.speed = 4; }
    yield* this.wait(0.4);
    yield* this.haleSay('h_roll');
    if (kevin) yield* this.waitVoice(this.sayAt(kevin, 'k_here', 0, 1.0), 0.3);
    if (sam && !sam.gone) yield* this.waitVoice(this.friendSay(sam, 's_kevinback', 0), 0.4);
    yield* this.haleSay('h_glasses');
    this.lookAllAt(W.laptop.screenPos); // on his desk. Still warm.
    yield* this.wait(1.8);
    this.lookAllAt(at);
    yield* this.haleSay('h_dismissed');
    A.play('bell', { pos: V3(3.5, 2.8, -6.8), vol: 1.1, ref: 3, reverb: 0.4 });
    A.play('v_applause', { pos: V3(0, 1.2, 1), vol: 0.8, ref: 3, reverb: 0.3 });
    for (const k of this.allKids()) if (!k.gone && !k.hollow) k.talking = rand(1.5, 3);
    yield* this.wait(3.0);
    this.blackoutTarget = 1;
    A.fadeBus('amb', 0, 2);
    yield* this.wait(2.2);
    this.finish('hale');
  },

  /** Mr. Hale speaks from the closet (behind the door first: muffled, and nobody knows who it is) */
  *haleSay(id, muffled = false) {
    const meta = this.audio.voices[id] || { text: '' };
    const h = this.audio.say(id, { pos: this.closetPos, ref: 2.6, vol: 1.3, reverb: muffled ? 0.5 : 0.3, lowpass: muffled ? 800 : undefined });
    this.ui.subtitle(muffled ? '???' : 'MR. HALE', meta.text, 'hale', (h ? h.duration : 2) + 0.7);
    yield* this.wait((h ? h.duration : 2) + 0.5);
  },
};
