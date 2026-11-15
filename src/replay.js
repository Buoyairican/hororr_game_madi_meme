// Reasons to replay (mixed into Game):
//  - the REPORT CARD after every class (A to F), built from what game.track counted for each player
//    (src/stats.js) with the grading table REPORT (src/data.js). An A is not a compliment: he likes
//    the quiet ones. Online, the host grades everybody and each friend gets their own card.
//  - UNLOCKS, earned by grades and deeds and kept in the browser (src/profile.js): new pranks
//    (src/morepranks.js), phone themes and a third phone app (src/psst.js).
//  - MR. HALE'S 12 NOTES, hidden in class: each one is found by doing something specific (the find
//    conditions are the table HALE_NOTES in src/data.js). Read them in the notebook (src/notebook.js).
//  - the DAILY CLASS: the same class for everyone that day, built from one number (the class seed,
//    made from the UTC date), with a score and a best score per day.
// The two secret endings are in src/secrets.js.
import * as THREE from 'three';
import { REPORT, UNLOCKS, HALE_NOTES, DAILY, PHONE_THEMES } from './data.js';
import { clamp, seededRng, hashStr } from './util.js';
import { Profile } from './profile.js';

const RANK = { A: 5, B: 4, C: 3, D: 2, F: 1 };
const WINS = ['survived', 'true', 'escape', 'period', 'hale', 'glasses']; // how a class can end well
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const _p = new THREE.Vector3(), _v = new THREE.Vector3();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------------------------------------------------------------- the report card (pure functions)
export function gradeOf(score) {
  for (const [min, g] of REPORT.grades) if (score >= min) return g;
  return 'F';
}

/**
 * The report card for one player's numbers. The same numbers always give the same card, so a
 * friend online builds theirs from the numbers the host sends. A stat key that is not in
 * `stats` is worth nothing.
 */
/** his comment with the number in it: "{n} times" reads "once" / "twice" for 1 and 2 */
const timesText = (comment, n) => comment.replace(/\{n\} times/g, (m, at) => {
  const w = n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`;
  const before = comment.slice(0, at);
  return /(^|[.!?]\s*)$/.test(before) && !/\.\.\.\s*$/.test(before) ? w[0].toUpperCase() + w.slice(1) : w; // (starting a sentence: "Once."; not after "...")
}).replace(/\{n\}/g, String(n));

export function makeCard(stats, o = {}) {
  const subjects = [], by = new Map();
  for (const [subject, key, per, cap, comment] of REPORT.rows) {
    let s = by.get(subject);
    if (!s) { s = { name: subject, score: REPORT.base[subject] || 0, grade: 'F', comment: '', top: 0 }; by.set(subject, s); subjects.push(s); }
    const n = Number(stats[key]) || 0;
    if (!n) continue;
    const pts = Math.sign(per) * Math.min(Math.abs(cap), Math.abs(n * per));
    s.score += pts;
    // his comment is about whatever counted most
    if (Math.abs(pts) > s.top) { s.top = Math.abs(pts); s.comment = timesText(comment, Math.round(n)); }
  }
  for (const s of subjects) {
    s.score = Math.round(clamp(s.score, 0, 100));
    s.grade = gradeOf(s.score);
    if (!s.comment) s.comment = REPORT.none[s.name] || '';
    delete s.top;
  }
  const best = subjects.map((s) => s.score).sort((a, b) => b - a).slice(0, REPORT.best);
  const score = Math.round(clamp(best.reduce((a, b) => a + b, 0) / Math.max(1, best.length) + (o.hard ? REPORT.hardBonus : 0), 0, 100));
  const grade = gradeOf(score);
  return { name: o.name || '', subjects, score, grade, remark: REPORT.remark[grade], hard: !!o.hard };
}

// ---------------------------------------------------------------- the daily class (pure functions)
/** today's date in UTC, 'YYYY-MM-DD': the same day for everyone in the world */
export const utcDay = (d = new Date()) => d.toISOString().slice(0, 10);
/** '2026-11-14' -> 'NOV 14' */
export const dayLabel = (date) => `${MONTHS[Number(date.slice(5, 7)) - 1] || '???'} ${Number(date.slice(8, 10))}`;

/**
 * Everything about the daily class of a date. All of it comes from ONE number, the class seed
 * (the date as a number: 2026-11-14 -> 20261114): the difficulty of the day and today's special.
 * The seed is also what game.start() gets as opts.seed, for the rest of the class setup.
 */
export function dailyInfo(date = utcDay()) {
  const seed = Number(date.replace(/-/g, ''));
  const rng = seededRng((seed ^ hashStr('madi daily')) >>> 0);
  const hard = rng() < DAILY.hardChance;
  const special = DAILY.specials[Math.floor(rng() * DAILY.specials.length)];
  return { date, seed, mode: DAILY.mode, difficulty: hard ? 'hard' : 'easy', special: special.id };
}
export const dailySpecial = (day) => DAILY.specials.find((x) => x.id === day.special) || DAILY.specials[0];

/** the daily score of one player, from their numbers */
export function dailyScore(stats, day) {
  const sp = dailySpecial(day);
  let s = 0;
  for (const [key, pts] of DAILY.score) {
    const n = Number(stats[key]) || 0;
    s += n * pts * (pts > 0 && sp.keys.includes(key) ? 2 : 1);
  }
  return Math.max(0, Math.round(s * (day.difficulty === 'hard' ? DAILY.hardBonus : 1)));
}

// ---------------------------------------------------------------- Mr. Hale's notes: where to look, and when
/** places a note can be found by looking at them: (game) -> a point in the room (or null: not there now) */
export const NOTE_PLACES = {
  closet: (g) => g.closetPos || null,                         // the supply closet door (src/secrets.js)
  poster: (g) => g.world.missingPoster.position,
  kevin: (g) => g.world.kevinSeat,
  doorWindow: (g) => g.doorFace.getWorldPosition(_p),
  teacher: (g) => (g.present && g.teacher.root.visible ? g.teacher.headWorld(_p) : null),
  clock: (g) => g.world.clock.pos,
  board: (g) => g.boardCenter,
};
/** extra conditions for a look: (game) -> true while it counts */
export const NOTE_WHEN = {
  clap: (g) => !!g.teacher.clap,
  doorFace: (g) => g.doorFace.visible,
  typing: (g) => g.typing,
  late: (g) => g.phase >= 2,
};
const NOTE_COS = 0.95; // how straight you have to look (about 18 degrees)

export function unlockMet(need, card) {
  if (!need) return false;
  if (need.grade) return !!card && RANK[card.grade] >= RANK[need.grade];
  if (need.stat) return !!card && (Number(card.stats[need.stat]) || 0) >= need.n && !(need.no && Number(card.stats[need.no]) > 0);
  if (need.total) return Profile.total(need.total) >= need.n;
  if (need.notes) return Profile.noteCount() >= need.notes;
  if (need.daily) return Profile.dailyCount() >= need.daily;
  return false;
}

export const ReplayMixin = {
  setupReplay() {
    this.daily = null;          // this class is the daily class: { date, seed, mode, difficulty, special }
    this.dailyNext = null;
    this.endKind = null;        // how the class ended ('survived', 'caught', 'true', ...)
    this.lastCard = null;       // your own report card of the last class
    this.endToken = null;
    this.newNotes = [];         // Mr. Hale's notes you found in this class (new ones)
    this.track.onEvent = (e, p) => this.noteEvent(e, p);
    // the phone games: best scores are kept, and a high score in PAPER PLANE hides a note
    const ph = this.phone, A = this.audio, point = ph.onPoint, crash = ph.onCrash, flap = ph.onFlap;
    ph.onPoint = (s, app) => { if (point) point(s); this.phonePoint(s, app || 'plane'); };
    ph.onCrash = (s, app) => { if (crash) crash(s); Profile.best(app || 'plane', s); };
    ph.onFlap = (app) => { if (app === 'psst') A.play('p6_pass', { vol: 0.35, local: true, reverb: 0 }); else if (flap) flap(); };
    ph.onApp = (app) => {
      if (app === 'psst' && this.state === 'playing' && Profile.once('tip_psst')) (this.ui.hint.local || this.ui.hint).call(this.ui, `<b>PSST!</b>: ${this.input.touch ? 'tap <b>TAP</b>' : 'press <b>E</b> / click'} to pass the note. Only while his back is turned: <b>when the chalk stops, stop.</b>`, 6);
    };
    ph.psst.hint = ph.game.hint;
    this.applyProfile();
  },

  /** what the profile changes in the game: the phone's theme and apps, the best scores on it */
  applyProfile() {
    const ph = this.phone, d = Profile.data;
    const theme = d.theme !== 'classic' && Profile.has(d.theme) && PHONE_THEMES[d.theme] ? PHONE_THEMES[d.theme] : PHONE_THEMES.classic;
    if (ph.theme !== theme) ph.setTheme(theme);
    ph.apps = Profile.has('psst') ? ['game', 'memes', 'psst'] : ['game', 'memes'];
    if (!ph.apps.includes(ph.app)) { ph.app = 'game'; if (ph.mode === 'psst') ph.mode = 'game'; }
    ph.game.best = Math.max(ph.game.best, Profile.best('plane'));
    ph.psst.best = Math.max(ph.psst.best, Profile.best('psst'));
  },

  resetReplay() {
    this.daily = this.dailyNext || null;
    this.dailyNext = null;
    this.endKind = null;
    this.endToken = null;                 // (the end screen's sounds belong to one end screen)
    this.newNotes = [];
    this.noteClass = new Set();           // notes the whole class found (already handed out)
    for (const p of this.players) { p.noteT = {}; p.noteGot = new Set(); }
    this.ui.report(null);
    this.applyProfile();
  },

  /** the class seed, for display (Phase 2 keeps the whole setup in game.setup; until then the daily class has its own) */
  classSeed() { return this.setup && this.setup.seed != null ? this.setup.seed : this.daily ? this.daily.seed : null; },

  // ---------------------------------------------------------------- the daily class
  /** start the daily class: the same class for everyone today (online: the host's daily class is everybody's) */
  startDaily(day = dailyInfo()) {
    this.dailyNext = day;
    this.difficulty = day.difficulty;
    this.start(day.mode, 0, { seed: day.seed });
    const sp = dailySpecial(day);
    this.track.event(this.t, null, 'daily', { date: day.date, seed: day.seed });
    this.ui.card({ time: dayLabel(day.date), title: 'DAILY CLASS', sub: `${day.difficulty === 'hard' ? 'HARD' : 'EASY'} · ${sp.name}` });
    this.timers.after(13.5, () => this.state === 'playing' && !this.cutscene && this.ui.hint(`<b>DAILY CLASS</b>: the same class for everyone today. <b>${sp.name}</b>: ${sp.text}. Your best score is kept.`, 4.5));
    return day;
  },

  // ---------------------------------------------------------------- Mr. Hale's notes
  /** every frame (host / solo): notes found by looking somewhere, or by a counter */
  updateReplay(dt) {
    this.updateSecrets(dt); // the closet door (src/secrets.js)
    if (this.ending) return;
    const G = this.track.global;
    for (const N of HALE_NOTES) {
      const f = N.find;
      if (f.global) {
        if ((G[f.global] || 0) >= f.n && !this.noteClass.has(N.n)) { this.noteClass.add(N.n); for (const p of [...this.players]) this.giveHaleNote(p, N.n); }
        continue;
      }
      if (!f.look && !f.stat) continue;
      for (const p of this.players) {
        const got = p.noteGot || (p.noteGot = new Set());
        if (got.has(N.n)) continue;
        if (f.stat) { if ((this.track.of(p)[f.stat] || 0) >= f.n) this.giveHaleNote(p, N.n); continue; }
        const T = p.noteT || (p.noteT = {});
        const place = NOTE_PLACES[f.look], pt = place ? place(this) : null;
        const on = !!pt && !(f.when && !(NOTE_WHEN[f.when] && NOTE_WHEN[f.when](this))) && p.camFwd.dot(_v.subVectors(pt, p.camPos).normalize()) > (f.cos || NOTE_COS);
        T[N.n] = on ? (T[N.n] || 0) + dt : Math.max(0, (T[N.n] || 0) - dt * 0.5);
        if (T[N.n] >= f.sec) this.giveHaleNote(p, N.n);
      }
    }
  },

  /** something was written into the class log (game.track.event): does it find a note? */
  noteEvent(e, p) {
    if (this.state !== 'playing' || this.role === 'guest') return;
    for (const N of HALE_NOTES) {
      // (`alt`: a second way to find the same note, e.g. taking his glasses from his desk)
      for (const f of N.alt ? [N.find, N.alt] : [N.find]) {
        const type = f.event || f.classEvent;
        if (!type || e.type !== type) continue;
        let ok = true;
        for (const k in f) if (k !== 'event' && k !== 'classEvent' && e[k] !== f[k]) ok = false;
        if (!ok) continue;
        if (f.classEvent) { if (!this.noteClass.has(N.n)) { this.noteClass.add(N.n); for (const q of [...this.players]) this.giveHaleNote(q, N.n); } }
        else if (p) this.giveHaleNote(p, N.n);
      }
    }
  },

  /** host / solo: this player found a note in class (counted once per class; their own browser knows if it is new) */
  giveHaleNote(p, n) {
    if (!p || !this.players.includes(p)) return false;
    const got = p.noteGot || (p.noteGot = new Set());
    if (got.has(n)) return false;
    got.add(n);
    this.note(p, 'notesFound'); this.track.event(this.t, p, 'haleNote', { n });
    if (p.local) this.foundNote(n);
    else if (this.mp) this.mp.toPlayer(p, { t: 'p6', k: 'note', n });
    return true;
  },

  /** on your own screen: one of Mr. Hale's notes (kept in your browser). True when it is a new one. */
  foundNote(n) {
    if (!HALE_NOTES.some((x) => x.n === n) || !Profile.addNote(n)) return false;
    this.newNotes.push(n);
    const ui = this.ui, count = Profile.noteCount();
    this.audio.play('p6_note', { local: true, vol: 0.8, reverb: 0.15 });
    (ui.hint.local || ui.hint).call(ui, `You found one of <b>Mr. Hale's notes</b> (${count} / ${HALE_NOTES.length}). Read it in the <b>NOTEBOOK</b>: ${this.input.touch ? 'the <b>II</b> button' : 'press <kbd>Esc</kbd>'}.`, 6);
    // (finding enough of them unlocks something)
    const un = this.checkUnlocks(null);
    if (un.length) this.timers.after(2.5, () => (ui.toast.local || ui.toast).call(ui, `UNLOCKED: ${un.map((u) => u.name).join(', ')}`, 3));
    return true;
  },

  /** the phone games (any role): a new best is kept; a high PAPER PLANE score hides a note */
  phonePoint(s, app) {
    Profile.best(app, s);
    if (this.state !== 'playing') return;
    if (app === 'psst') { // a note delivered in PSST!: counted for the report card (a friend's phone tells the host)
      if (this.role === 'guest') { if (this.mp) this.mp.send({ t: 'p6', k: 'psst' }); } else this.note(this.me, 'psst');
      return;
    }
    for (const N of HALE_NOTES) {
      if (N.find.local !== 'plane' || s < N.find.n) continue;
      if (this.role === 'guest') { if (this.foundNote(N.n) && this.mp) this.mp.send({ t: 'p6', k: 'note', n: N.n }); } // the host counts it
      else this.giveHaleNote(this.me, N.n);
    }
  },

  // ---------------------------------------------------------------- unlocks
  /** everything that is earned now (card: the report card just handed out, or null). Returns the new ones. */
  checkUnlocks(card) {
    const out = [];
    for (const u of UNLOCKS) if (!Profile.has(u.id) && unlockMet(u.need, card) && Profile.unlock(u.id)) out.push(u);
    if (out.length) this.applyProfile();
    return out;
  },

  // ---------------------------------------------------------------- the end of a class
  /** host / solo, when the end screen comes up: everybody's report card */
  replayEnd() {
    if (this.role === 'guest') return;
    if (this.daily) { const day = this.daily; this.endAction = { label: 'TRY AGAIN (DAILY)', go: () => this.startDaily(day) }; }
    const cards = {};
    for (const p of this.players) cards[p.id] = this.reportFor(p);
    if (this.mp && this.mp.role === 'host') this.mp.broadcastNow({ t: 'p6', k: 'end', cards });
    this.showReport(this.cardFrom(cards[this.me.id]));
  },

  /** one player's numbers for the report card (plain data: it goes over the network) */
  reportFor(p) {
    const s = this.track.of(p), st = { ...this.track.global };
    for (const k in s) if (typeof s[k] === 'number') st[k] = Math.round(s[k] * 10) / 10;
    st.survived = WINS.includes(this.endKind) ? 1 : 0;
    st.minutes = Math.round(this.t / 6) / 10;
    st.strikes = this.strikes;
    return { name: p.name, st, hard: this.hard ? 1 : 0, mode: this.mode, ch: this.chapter, kind: this.endKind || '', day: this.daily ? this.daily.date : null, seed: this.classSeed() };
  },

  /** the card itself, from those numbers (nothing but numbers is trusted from the network) */
  cardFrom(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const st = {};
    for (const k in raw.st || {}) if (Number.isFinite(raw.st[k])) st[k] = raw.st[k];
    const card = makeCard(st, { name: String(raw.name || '').slice(0, 12), hard: !!raw.hard });
    card.stats = st;
    card.mode = raw.mode === 'story' ? 'story' : 'free';
    card.chapter = Number(raw.ch) | 0;
    card.kind = String(raw.kind || '').slice(0, 12);
    card.win = st.survived > 0;
    if (typeof raw.day === 'string' && /^\d{4}-\d\d-\d\d$/.test(raw.day)) {
      const day = dailyInfo(raw.day);
      card.daily = { ...day, score: dailyScore(st, day), seed: Number.isFinite(raw.seed) ? raw.seed : day.seed };
    }
    return card;
  },

  /** on your own screen (any role): your report card, what it unlocked, your daily best. Kept in your browser. */
  showReport(card) {
    if (!card) return;
    this.lastCard = card;
    const st = card.stats, news = { notes: this.newNotes.slice(), best: false, dailyBest: false, dailyOld: null };
    Profile.bump({ classes: 1, wins: card.win ? 1 : 0, videos: st.videos, hitHim: st.hitHim, echoes: st.echoes, questions: st.questions, caught: st.caught });
    Profile.sawEnding(card.kind);
    news.best = Profile.best('score', card.score);
    if (card.daily) {
      const old = Profile.dailyBest(card.daily.date);
      news.dailyOld = old ? old.score : null;
      news.dailyBest = Profile.recordDaily(card.daily.date, card.daily.score, card.grade, card.hard, DAILY.keep);
    }
    news.unlocked = this.checkUnlocks(card);
    this.ui.report(reportHtml(card, news));
    // the stamp, his verdict, and the jingle for something new (once the end screen is really up)
    const A = this.audio, token = (this.endToken = {});
    this.whenEnd(token, 700, () => A.play('p6_stamp', { local: true, vol: 0.9, reverb: 0.12 }));
    this.whenEnd(token, 1400, () => A.say(REPORT.voice[card.grade], { local: true, vol: 1.1, reverb: 0.3 }));
    if (news.unlocked.length || news.dailyBest) this.whenEnd(token, 3600, () => A.play('p6_unlock', { local: true, vol: 0.8, reverb: 0.2 }));
  },

  /** run fn a moment after this end screen is up (a friend's end screen can come late: the jumpscare first); never in the next class */
  whenEnd(token, ms, fn, tries = 40) {
    setTimeout(() => {
      if (this.endToken !== token) return;
      if (this.state === 'end') fn();
      else if (tries > 0 && this.state === 'playing') this.whenEnd(token, 250, fn, tries - 1);
    }, ms);
  },

  // ---------------------------------------------------------------- online
  /** a friend's game got a message from the host */
  replayNet(e) {
    if (!e || typeof e !== 'object' || !this.mp) return;
    if (e.k === 'note') this.foundNote(Number(e.n));
    else if (e.k === 'end') this.showReport(this.cardFrom(e.cards && e.cards[this.mp.myId]));
  },
  /** the host got a message from a friend's game */
  replayFromGuest(p, m) {
    if (!m || this.state !== 'playing') return;
    // a note found on their own phone: counted here
    if (m.k === 'note') { const N = HALE_NOTES.find((x) => x.n === Number(m.n)); if (N && N.find.local) this.giveHaleNote(p, N.n); }
    // a note delivered in PSST! on their phone (it takes three passes: not more often than that)
    else if (m.k === 'psst' && p.phoneUp && this.t - (p.psstAt || -9) > 0.9) { p.psstAt = this.t; this.note(p, 'psst'); }
  },

  /** what the title menu shows: today's daily class and your best, the notebook's numbers */
  replayMenu() {
    const day = dailyInfo(), best = Profile.dailyBest(day.date), sp = dailySpecial(day);
    return {
      day,
      daily: `${dayLabel(day.date)} · ${day.difficulty === 'hard' ? 'HARD' : 'EASY'} · ${best ? 'best ' + best.score + ' (' + best.grade + ')' : 'not played yet'}`,
      dailyLong: `Daily class ${dayLabel(day.date)}: ${day.difficulty === 'hard' ? 'Hard' : 'Easy'}, ${sp.name} (${sp.text}). The same class for everyone today.`,
      notebook: `${Profile.noteCount()} / ${HALE_NOTES.length} notes · ${UNLOCKS.filter((u) => Profile.has(u.id)).length} / ${UNLOCKS.length} unlocks`,
    };
  },
};

/** the report card block of the end screen */
export function reportHtml(card, news = {}) {
  const rows = card.subjects.map((s) => `<tr><td class="rc-sub">${esc(s.name)}</td><td class="rc-g g-${s.grade}">${s.grade}</td><td class="rc-c">${esc(s.comment)}</td></tr>`).join('');
  let extra = '';
  if (card.daily) {
    const d = card.daily, sp = dailySpecial(d);
    extra += `<div class="rc-daily">DAILY CLASS · ${dayLabel(d.date)} · ${sp.name}<br>Score <b id="rc-daily-score">${d.score}</b> · ${news.dailyBest ? '<b class="rc-new">NEW BEST!</b>' : 'your best today: <b>' + (news.dailyOld ?? d.score) + '</b>'} <span class="rc-seed">class #${esc(d.seed)}</span></div>`;
  }
  for (const u of news.unlocked || []) extra += `<div class="rc-unlock">★ UNLOCKED: <b>${esc(u.name)}</b><br><span>${esc(u.what)}${u.type === 'theme' ? ' Pick it in the NOTEBOOK.' : ''}</span></div>`;
  if ((news.notes || []).length) extra += `<div class="rc-notes">📓 Mr. Hale's notes: <b>${Profile.noteCount()} / ${HALE_NOTES.length}</b> (+${news.notes.length} this class). Read them in the NOTEBOOK.</div>`;
  return `<div class="rc" id="rc">
    <div class="rc-head"><b>REPORT CARD</b><span>Room 13 · ${esc(card.name)}${card.hard ? ' · HARD' : ''}</span></div>
    <table class="rc-rows">${rows}</table>
    <div class="rc-final"><div class="rc-stamp g-${card.grade}" id="rc-grade">${card.grade}</div><div class="rc-remark">${esc(card.remark)}<span class="rc-sign">Mr. Madi</span></div></div>
    ${extra}
  </div>`;
}
