// What a player keeps between classes: unlocks, Mr. Hale's notes, daily bests, endings seen, the
// phone theme, high scores. It lives in the browser (localStorage, one key). When storage is
// blocked (private mode, an embedded page) everything still works for as long as the page is
// open: the same data is kept in memory instead.
const KEY = 'madiclass.replay';
const obj = (x) => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});

let data = null;       // the profile, loaded once
let stored = true;     // false when the browser would not keep it

function load() {
  let raw = null;
  try { raw = localStorage.getItem(KEY); } catch (e) { stored = false; }
  let d = {};
  try { d = obj(JSON.parse(raw || '{}')); } catch (e) { d = {}; } // junk in storage: start over
  return {
    v: 1,
    unlocks: obj(d.unlocks),     // id -> the day it was earned
    notes: obj(d.notes),         // note number -> 1
    daily: obj(d.daily),         // 'YYYY-MM-DD' -> { score, grade, hard }
    totals: obj(d.totals),       // counters over all your classes (classes, videos, ...)
    endings: obj(d.endings),     // ending kind -> 1
    best: obj(d.best),           // plane, psst (phone games), score, grade (report cards)
    theme: typeof d.theme === 'string' ? d.theme : 'classic',
    seen: obj(d.seen),           // hints already given once
  };
}

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(data)); stored = true; } catch (e) { stored = false; }
  if (Profile.onChange) Profile.onChange();
}

export const Profile = {
  onChange: null,               // called after every change (the menu shows the numbers)
  get data() { return data || (data = load()); },
  /** is it really kept in the browser? (false: only until the page closes) */
  get stored() { void this.data; return stored; },
  /** read it again from the browser (tests; another tab changed it) */
  reload() { data = load(); return data; },

  has(id) { return !!this.data.unlocks[id]; },
  /** true when it is new */
  unlock(id) {
    if (this.has(id)) return false;
    this.data.unlocks[id] = new Date().toISOString().slice(0, 10);
    save();
    return true;
  },
  hasNote(n) { return !!this.data.notes[n]; },
  noteCount() { return Object.keys(this.data.notes).length; },
  /** true when it is new */
  addNote(n) {
    if (this.hasNote(n)) return false;
    this.data.notes[n] = 1;
    save();
    return true;
  },
  /** add to the counters over all your classes */
  bump(add) {
    const t = this.data.totals;
    for (const k in add) if (Number.isFinite(add[k]) && add[k] > 0) t[k] = Math.round(((t[k] || 0) + add[k]) * 10) / 10;
    save();
  },
  total(k) { return this.data.totals[k] || 0; },
  sawEnding(kind) { if (kind && !this.data.endings[kind]) { this.data.endings[kind] = 1; save(); } },
  /** a high score (phone games, the best report card): true when it is a new best */
  best(k, v) {
    if (v === undefined) return this.data.best[k] || 0;
    if (!(v > (this.data.best[k] || 0))) return false;
    this.data.best[k] = v;
    save();
    return true;
  },
  setTheme(id) { this.data.theme = id; save(); },
  /** your best in the daily class of that day (or null) */
  dailyBest(date) { return this.data.daily[date] || null; },
  dailyCount() { return Object.keys(this.data.daily).length; },
  /** a daily class is over: true when it beat your best of that day. Old days are forgotten. */
  recordDaily(date, score, grade, hard, keep = 40) {
    const d = this.data.daily, old = d[date];
    const better = !old || score > old.score;
    if (better) d[date] = { score, grade, hard: hard ? 1 : 0 };
    const days = Object.keys(d).sort();
    while (days.length > keep) delete d[days.shift()];
    save();
    return better;
  },
  /** a hint shown only once ever: true the first time */
  once(k) {
    if (this.data.seen[k]) return false;
    this.data.seen[k] = 1;
    save();
    return true;
  },
};
