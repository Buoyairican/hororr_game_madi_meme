// He gets stuck on a question he wrote himself (mixed into Game). Free Class and online only.
// He writes a question on the board, stares at it, pats his stomach: "The answer is... is... is...".
// The first player who raises a hand (T / ASK) picks the right answer, a wrong one, or says nothing:
//  - right: "Correct." He calms down, you get 1 trust, but you are his pet now (he keeps an eye on you,
//    a kid throws a paper ball at you).
//  - wrong: he writes it down, the class laughs, you get mischief; a bit later he looks it up on his
//    laptop ("No. No. That is wrong.") and comes to ask who did it.
//  - nobody: he looks it up himself (while he types he is not watching).
// The host (or solo game) runs everything; the choice goes only to the player who raised a hand.
import { rand, pick, Bag } from './util.js';
import { STUCK, FREE_LENGTH } from './data.js';

export const StuckMixin = {
  resetStuck() {
    this.stuck = null; this.stuckFind = null; this.stuckN = 0;
    this.stuckNext = rand(STUCK.first[0], STUCK.first[1]);
    this.stuckBag = new Bag(STUCK.list);
  },

  /** the idle lesson asks: time to find out about a wrong answer, or to get stuck? (a generator to run, or null) */
  stuckAct() {
    if (this.stuckFind && this.t >= this.stuckFind.at) return this.stuckFoundOut();
    if (this.mode === 'free' && this.t >= this.stuckNext && this.stuckN < STUCK.max && this.anger < 40 && this.t < FREE_LENGTH - 60) return this.actStuck();
    return null;
  },

  *actStuck(item = this.stuckBag.next()) {
    const T = this.teacher;
    this.quirkBusy = true; this.stuckN++; this.stuckNext = this.t + rand(...STUCK.every);
    try {
      yield* this.actWrite(item.q);
      this.stuck = { item, by: null, kind: null, c: null };
      this.showHint(STUCK.hint, 6);
      // he stares at it and pats his stomach (somebody who is still picking an answer gets the time to pick it)
      let t = 0, said = false;
      while (!this.stuck.kind && (t < STUCK.wait || this.stuck.by)) {
        const pat = this.bellyPat(2);
        try {
          while (!this.stuck.kind && !pat.next().done) {
            t += this.dt;
            if (!said && t > 3) { said = true; this.teacherSay('t_answer'); } // "The answer is... is... is..."
            yield;
          }
        } finally { pat.return(); }
      }
      const { kind, by: p } = this.stuck;
      if (kind === 'right') {
        yield* this.say('q_correct');
        yield* this.actWrite(item.right);
        this.anger = Math.max(0, this.anger - STUCK.calm);
        p.trust = Math.min(STUCK.maxTrust, (p.trust || 0) + 1);
        this.note(p, 'helped');
        yield* this.say('t_good'); // "Such a... good... student."
        p.watchedT = STUCK.petWatch;
        this.timers.after(rand(3, 5), () => { const k = pick(this.students.filter((s) => !s.gone && !s.hollow)); if (k && this.players.includes(p)) this.npcThrow(k, p); });
      } else if (kind === 'wrong') {
        yield* this.say('t_thanks');
        yield* this.say('t_writedown');
        yield* this.actWrite(item.wrong);
        this.addLaugh(STUCK.laugh, this.boardCenter.clone(), p);
        this.mischief += STUCK.mischief;
        this.note(p, 'trolled');
        this.stuckFind = { p, item, at: this.t + rand(...STUCK.findOut) };
      } else {
        yield* this.say('t_moment');
        yield* this.laptopLookup(item.typed, item.right);
        yield* this.actWrite(item.right);
      }
    } finally {
      const s = this.stuck;
      this.stuck = null; this.quirkBusy = false; T.setPose('rest');
      // (cut short while somebody is still picking: their choice closes)
      if (s && s.by && s.c && (s.by.local ? this.choice : s.by.choice) === s.c) this.pickChoice(-1, s.by);
    }
  },

  /** the first player who raises a hand gets the three choices */
  openStuck(p) {
    const item = this.stuck.item;
    this.stuck.by = p; p.handT = 2.8;
    const labels = Math.random() < 0.5 ? [item.right, item.wrong] : [item.wrong, item.right];
    labels.push(STUCK.nothing);
    this.openChoice(STUCK.title + item.q, labels, STUCK.choose,
      (i) => this.answerStuck(p, i < 0 || labels[i] === STUCK.nothing ? null : labels[i] === item.right ? 'right' : 'wrong'), p);
    this.stuck.c = p.local ? this.choice : p.choice;
  },
  answerStuck(p, kind) {
    if (!this.stuck || this.stuck.kind) return;
    if (kind) { this.stuck.by = p; this.stuck.kind = kind; }
    else if (this.stuck.by === p) this.stuck.by = null; // (somebody else may still help)
  },

  /** a wrong answer, later: he looks it up, and he wants to know who it was */
  *stuckFoundOut() {
    const { p, item } = this.stuckFind;
    this.stuckFind = null;
    yield* this.laptopLookup(item.typed, item.right);
    yield* this.say('t_wrong'); // "No. No. That is wrong."
    if (!this.players.includes(p)) return;
    if (this.allowBlame) yield* this.askWhoDidIt(p, 'prank');
    else { this.focus = p; this.angerUp(25, 85); yield* this.say('t_itwasyou'); }
  },
};
