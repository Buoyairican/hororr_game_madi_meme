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
  // real dread (src/dread.js)
  'dread_creep',        // times he crept up on you while you stared at your phone
  'dread_spotted',      // ...and you looked up before he got to your desk
  'dread_seen_change',  // things that changed behind your back, and you noticed
  'dread_lean',         // times he leaned over your desk to listen
  'breath_hold',        // ...and heard nothing: you held your breath and kept still
  'breath_fail',        // ...and heard you (you breathed, moved, made a sound or ran out of air)
  'breath_time',        // seconds you held your breath
  'throws',      // paper balls / planes thrown
  'hits',        // ...that hit someone (or the board)
  'hitHim',      // ...that hit him
  'flies',       // flies you swatted with a paper ball (his fly hunt)
  'taught',      // words he learned from you (your echoes, phonk from your phone)
  'woke',        // times you woke him up when he dozed off
  'chaos',       // seconds of mischief while he could not catch you (out of the room, asleep, on the phone, dancing, blind, typing)
  'kickme',      // KICK ME notes you stuck on his back
  'noteLaughs',  // times the class laughed at the note on his back
  'paws',        // times he pawed at your laser dot
  'chase',       // seconds he chased your laser dot
  'blamed',      // kids you blamed (and he believed you)
  'confessed',   // times you confessed
  'lies',        // lies he saw through
  'sneaks',      // times you left your seat
  'sneakTime',   // seconds off your chair
  'glasses',     // times you stole his glasses
  'secrets',     // things you read on his laptop
  'clocks',      // times you moved the clock forward
  'cushions',    // whoopee cushions he sat on
];

export class RunStats {
  constructor() { this.reset(); }

  reset() {
    this.by = new Map();        // player id -> counters
    this.log = [];              // what happened, in order: { t, who, type, ...info }
    this.global = { objectives: 0, memes: 0, peakAnger: 0, peakLaugh: 0, events: [], quirks: [], learned: [] };
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
    return { players, global: { ...this.global, events: this.global.events.slice(), quirks: this.global.quirks.slice(), learned: this.global.learned.slice() }, log: this.log.slice() };
  }
}
