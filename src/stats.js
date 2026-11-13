// Everything each player does during one class: how long they whispered, what they did,
// how often they got away with it. The end screen and (later) the report card read it.
// Counted on the host (or in solo), so it covers every player in an online class.

/** per-player counters (seconds for talk / phone, counts for the rest) */
export const STAT_KEYS = [
  'talk',        // seconds spent whispering
  'phone',       // seconds with the phone up
  'whispers',    // whisper exchanges finished
  'echoes',      // times you repeated him
  'questions',   // dumb questions asked
  'videos',      // meme videos watched to the end
  'shown',       // videos you showed a friend
  'fails',       // PAPER PLANE crashes (the loud ones)
  'caught',      // strikes you caused
  'closeCalls',  // he was about to come over... and didn't
  'notes',       // notes read
];

export class RunStats {
  constructor() { this.reset(); }

  reset() {
    this.by = new Map();        // player id -> counters
    this.log = [];              // what happened, in order: { t, who, type, ...info }
    this.global = { objectives: 0, memes: 0, peakAnger: 0 };
  }

  /** the counters for one player (made on first use) */
  of(p) {
    let s = this.by.get(p.id);
    if (!s) {
      s = { name: p.name, caughtFor: {} };
      for (const k of STAT_KEYS) s[k] = 0;
      this.by.set(p.id, s);
    }
    s.name = p.name;
    return s;
  }

  add(p, key, n = 1) {
    if (!p) return;
    const s = this.of(p);
    s[key] = (s[key] || 0) + n;
  }

  event(t, p, type, info = {}) {
    this.log.push({ t: Math.round(t * 10) / 10, who: p ? p.id : null, type, ...info });
    if (this.log.length > 500) this.log.shift();
  }

  /** a plain copy, safe to send over the network or save */
  summary() {
    const players = [];
    for (const [id, s] of this.by) {
      const o = { id };
      for (const k in s) o[k] = typeof s[k] === 'number' ? Math.round(s[k] * 10) / 10 : s[k];
      players.push(o);
    }
    return { players, global: { ...this.global }, log: this.log.slice() };
  }
}
