// A different teacher every class (mixed into Game), part 3: he learns your slang.
//  - the class clowns' words (bruh, sus, six seven, rizz, skill issue, sheesh, yeet, the goat, oof, huh):
//    after he deals with one, he knows it
//  - your echoes: he learns your squeaky impression of him
//  - phonk: when he hears phonk from somebody's phone for a moment
// Later he uses them, wrong: a line in the lesson ("The mitochondria... has... rizz."), a word on the
// board ("2 + 2 = SUS"), your squeaky voice done back at you, and phonk from his own phone with a
// stiff little dance (the class laughs: the LAUGHS meter). He remembers his words next class
// (this browser; online, the host's). Everything is in SLANG / SLANG_USE (src/data.js).
import * as THREE from 'three';
import { rand, pick, chance } from './util.js';
import { SLANG, SLANG_USE, mock } from './data.js';
import { clipByKey } from './memes.js';

const V = THREE.Vector3;
const KEY = 'madiclass.slang';

function loadVocab() {
  try {
    const a = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(a) ? a.filter((v) => v && SLANG[v.id]).map((v) => ({ id: v.id, line: typeof v.line === 'string' ? v.line : undefined, text: typeof v.text === 'string' ? v.text.slice(0, 80) : undefined, old: true })) : [];
  } catch (e) { return []; }
}
function saveVocab(list) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(-SLANG_USE.keep).map((v) => ({ id: v.id, line: v.line, text: v.text })))); } catch (e) { /* storage blocked */ }
}
const fill = (t, o) => t.replace(/\{(\w+)\}/g, (_, k) => o[k] ?? '');

export const SlangMixin = {
  resetSlang() {
    this.vocab = this.role === 'guest' ? [] : loadVocab();
    this.vocabUses = {}; this.slangLearnT = {}; this.boardSlang = new Set();
    for (const v of this.vocab) this.slangLearnT[v.id] = -1e9;           // words from last time: ready to use
    this.slangNext = SLANG_USE.first + rand(0, 10);
    this.danced = 0; this.dancing = false; this.slangQuipped = false; this.boardQuipped = false;
    for (const p of this.players) p.phonkT = 0;
    if (this.vocab.length && this.role !== 'guest') this.timers.after(16, () => this.state === 'playing' && !this.cutscene && this.firstHint('slang:old', SLANG_USE.remember, 4));
  },
  knows(id) { return !!(this.vocab && this.vocab.some((v) => v.id === id)); },
  slangWords() { return (this.vocab || []).map((v) => v.id); },

  /** he learned a word (by: the player who taught it, or null) */
  learnSlang(id, by = null, extra = null) {
    const s = SLANG[id];
    if (!s || this.role === 'guest') return false;
    const had = this.vocab.find((v) => v.id === id);
    if (had) {
      // (a newer echo replaces the old one: he does the newest impression)
      if (extra) { Object.assign(had, extra); saveVocab(this.vocab); }
      return false;
    }
    this.vocab.push({ id, ...(extra || {}) });
    while (this.vocab.length > SLANG_USE.keep) this.vocab.shift();
    this.slangLearnT[id] = this.t;
    saveVocab(this.vocab);
    this.track.global.learned.push(id);
    this.track.event(this.t, by, 'slang', { id });
    if (by && this.players.includes(by)) this.note(by, 'taught');
    this.ui.toast(fill(SLANG_USE.learnedToast, { word: s.word || id }), 2.6);
    this.firstHint('slang', SLANG_USE.hint, 5);
    return true;
  },
  /** after a class clown's meme: the word, if it was one */
  learnFromMeme(m) {
    if (!m) return;
    const id = Object.keys(SLANG).find((k) => SLANG[k].from === m.id);
    if (id) this.learnSlang(id, null);
  },

  /** host: is phonk playing from somebody's phone where he can hear it? (he learns it) */
  updateSlang(dt) {
    if (this.knows('phonk') || !this.present || this.cutscene) return;
    for (const p of this.players) {
      let clip = null;
      if (p.showWatch) clip = clipByKey(p.showWatch.key);
      else if (p.vid && p.local) clip = this.phone.clipPlayer && this.phone.clipPlayer.clip;
      else if (p.vid && p.in.pv && Number.isInteger(p.in.ck) && p.in.ck >= 0) clip = clipByKey(p.in.ck);
      const phonk = !!(clip && clip.music && clip.music[0] === 'v_phonk');
      const hears = phonk && (p.watching || p.dist < 3.6 || (p.noise || 0) >= 1) && !this.dozing;
      p.phonkT = hears ? (p.phonkT || 0) + dt : Math.max(0, (p.phonkT || 0) - dt * 0.5);
      if (p.phonkT > SLANG_USE.phonkHear) { this.learnSlang('phonk', p); break; }
    }
  },

  /** the idle lesson asks: time to use a word? (a generator to run, or null) */
  slangAct() {
    if (!this.vocab.length || this.t < this.slangNext || !this.present || this.anger >= 40 || this.blackout > 0.3) return null;
    const ready = (v) => this.t - (this.slangLearnT[v.id] ?? -1e9) >= SLANG_USE.first;
    const ph = this.vocab.find((v) => v.id === 'phonk');
    if (ph && ready(ph) && this.danced < 1 && !(this.mode === 'free' && this.t > 280)) return this.actDance();
    const words = this.vocab.filter((v) => !SLANG[v.id].dance && ready(v) && (this.vocabUses[v.id] || 0) < SLANG_USE.perWord && (v.id !== 'mock' || v.line));
    if (!words.length) return null;
    // the newest words first (he is proud of them)
    words.sort((a, b) => (this.vocabUses[a.id] || 0) - (this.vocabUses[b.id] || 0) || (this.slangLearnT[b.id] ?? 0) - (this.slangLearnT[a.id] ?? 0));
    return this.actSlang(words[0]);
  },

  /** he uses a word in the lesson. Wrong. */
  *actSlang(v) {
    const s = SLANG[v.id], T = this.teacher, A = this.audio;
    this.quirkBusy = true;
    this.vocabUses[v.id] = (this.vocabUses[v.id] || 0) + 1;
    this.slangNext = this.t + rand(SLANG_USE.gap[0], SLANG_USE.gap[1]);
    try {
      T.clap = null;
      yield* this.turnToClass();
      T.setPose('gesture');
      this.track.event(this.t, null, 'slangUse', { id: v.id });
      if (v.id === 'mock') {
        // your squeaky impression of him... done back at you
        const h = A.play(v.line, { rate: 1.42, vol: 1.15, pos: T.headWorld(new V()), ref: 2.4, reverb: 0.3, bus: 'voice' });
        this.voiceUntil = this.t + (h ? h.duration : 1.5);
        this.ui.subtitle('', mock(v.text || ''), 'teacher mock', (h ? h.duration : 2) + 0.6);
        yield* this.wait((h ? h.duration : 2) + 0.5);
      }
      yield* this.say(s.line, 0.5);
      T.setPose('rest');
      this.addLaugh(SLANG_USE.laugh, T.headWorld(new V()), null);
      if (s.kid) {
        // somebody in the back can't help it
        const back = this.students.filter((k) => !k.gone && !k.hollow && k.seat.row >= 2);
        const kid = back.length ? pick(back) : null;
        if (kid) {
          yield* this.wait(0.4);
          yield* this.wait(this.memeSound(kid, { voice: s.kid }) + 0.3);
          T.lookAt(kid.headWorld(new V()), 4);
          yield* this.say('t_veryfunny', 0.4);
        }
      }
      if (!this.slangQuipped) { this.slangQuipped = true; this.friendQuip(chance(0.5) ? 'sam' : 'nora', chance(0.5) ? 's_slang' : 'n_slang', 0.6); }
      yield* this.actStare(1.3);
    } finally { this.quirkBusy = false; T.setPose('rest'); }
  },

  /** writing on the board: sometimes one of his new words instead of the lesson (null: the lesson) */
  slangBoardText() {
    if (!this.vocab || !this.vocab.length || !chance(SLANG_USE.board)) return null;
    const ok = this.vocab.filter((v) => !this.boardSlang.has(v.id) && this.t - (this.slangLearnT[v.id] ?? -1e9) >= SLANG_USE.first && (SLANG[v.id].board || (v.id === 'mock' && v.text)));
    if (!ok.length) return null;
    const v = pick(ok);
    this.boardSlang.add(v.id);
    this.track.event(this.t, null, 'slangUse', { id: v.id, board: true });
    if (!this.boardQuipped) { this.boardQuipped = true; this.timers.after(1.5, () => { if (!this.cutscene) this.friendQuip('sam', 's_board2', 0); }); }
    return v.id === 'mock' ? mock(v.text.replace(/\.\.\./g, ' ')).replace(/\s+/g, ' ').trim().slice(0, 28) : SLANG[v.id].board;
  },

  /** phonk, from his own phone. He dances. Badly. */
  *actDance() {
    const T = this.teacher, s = SLANG.phonk;
    this.quirkBusy = true; this.danced++;
    this.slangNext = this.t + rand(SLANG_USE.gap[0], SLANG_USE.gap[1]);
    try {
      T.clap = null;
      yield* this.turnToClass();
      this.showMadiPhone(true);
      T.setPose('dance', { phone: true, still: true });
      yield* this.say(s.line, 0.3);
      this.dancing = true; // (the music: eventVisuals, on every screen)
      this.ui.subtitle('', SLANG_USE.danceCap, 'teacher', 3);
      this.track.event(this.t, null, 'slangUse', { id: 'phonk' });
      T.setPose('dance', { phone: true });
      this.firstHint('dance', SLANG_USE.danceHint, 4.5);
      yield* this.wait(1.0);
      this.addLaugh(SLANG_USE.danceLaugh, T.headWorld(new V()), null);
      this.friendQuip('sam', 's_dance', 1.4);
      this.friendQuip('nora', 'n_dance', 4.6);
      const x0 = T.pos.x, z0 = T.pos.z;
      let t = 0, step = 0;
      while (t < s.dance) {
        t += this.dt;
        const b = Math.sin(t * Math.PI * 4); // 120 bpm
        T.crouchTarget = 0.05 + 0.07 * Math.abs(b);
        T.rollTarget = 0.28 * Math.sin(t * Math.PI * 2);
        T.leanTarget = 0.08 * b;
        T.lookAt(T.handPos('R'), 6);
        if (t > step) { step += 2; T.moveTo(x0 + (Math.round(step / 2) % 2 ? 0.28 : -0.28), z0, 0.6); }
        yield;
      }
      // the music stops. He stares.
      this.dancing = false;
      this.showMadiPhone(false);
      T.crouchTarget = 0; T.rollTarget = 0; T.leanTarget = 0; T.setPose('rest'); T.moveTarget = null;
      T.lookAt(this.cp, 4);
      yield* this.actStare(1.5);
      yield* this.say('t_back', 0.5);
    } finally {
      this.dancing = false;
      this.showMadiPhone(false);
      T.crouchTarget = 0; T.rollTarget = 0; T.leanTarget = 0; T.setPose('rest'); T.moveTarget = null;
      this.quirkBusy = false;
    }
  },
};
