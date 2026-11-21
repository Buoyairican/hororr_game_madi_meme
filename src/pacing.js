// Pacing: room to breathe for the player (a mixin on Game, like src/quirks.js). Numbers: PACE in src/data.js.
//  - One thing asks you for something at a time: a friend calling, your phone, a classmate's video, a note, a question.
//  - While he leans over your desk (from the moment he walks over), while a scare, "Who did it?", his stuck question or
//    a story moment is on, nothing new asks you, and what already asks you waits: no "HEY!" while you hold your breath.
//  - His own scenes (an event, a scare, a habit, a visit to a desk) leave a calm stretch of plain teaching between them.
//    What you cause (an echo, a question, a prank) he still answers at once: that is you playing.
//  - Your phone only buzzes while he is not looking at you, and its countdown only runs while he is not looking.
//  - Tips wait for a quiet moment (never in a scare or while he listens at your desk), one at a time with a gap,
//    and a control tip is skipped when you already found that control by yourself.
//  - His habits slow down each time and stop after a few per class; his habit lines don't come back to back.
//  - The task list shows a few open tasks at a time.
import { PACE, LONG_CLASS } from './data.js';
import { rand } from './util.js';

export const PacingMixin = {
  setupPacing() {
    this.ui.holdTip = () => this.tipHold();
  },
  resetPacing() {
    this.calmUntil = 0; this.paceBusy = false;
    this.quirkRuns = {}; this.lineAt = {}; this.taskSeq = 0;
  },

  // ---------------------------------------------------------------- his scenes, and the calm between them
  /** he is in one of his scenes (not just teaching) */
  inScene() {
    const D = this.dread;
    return !!(this.classEvent || this.scareBusy || this.jumping || this.cutscene || this.quirkBusy || this.stuck || this.blameBusy
      || this.memeBusy || this.echoBusy || this.searching || this.sitting || this.sneakBusy || (D && (D.lean || D.creep))
      || this.players.some((p) => p.qBusy));
  },
  /** every frame (host / solo): when a scene of his ends, a calm stretch of lesson begins */
  updatePacing() {
    const busy = this.inScene();
    if (this.paceBusy && !busy) this.calmUntil = Math.max(this.calmUntil, this.t + rand(PACE.calm[0], PACE.calm[1]) * (LONG_CLASS.calm[this.actMood] || 1)); // (a long online class: by the stretch's pace)
    this.paceBusy = busy;
  },
  /** may he start a scene of his own now? */
  calmOk() { return !this.paceBusy && this.t >= (this.calmUntil || 0); },

  // ---------------------------------------------------------------- what asks you for something
  /** he is bending over this player's desk, or on his way there to listen */
  leanFor(p = this.me) {
    if (!p) return false;
    if (this.role === 'guest') return !!(this.dreadLeanOn && this.dreadLeanOn(p));
    const L = this.dread && this.dread.lean;
    return !!(L && L.p === p && L.phase !== 'leave');
  },
  /** a moment that needs this player's full attention: nothing new may ask them, and what asks them already waits */
  askHold(p = this.me) {
    if (!p) return false;
    const D = this.dread;
    return this.leanFor(p) || !!(this.cutscene || this.scareBusy || this.scLocalOn || this.localScare || this.jumping || this.blameBusy
      || (p.local ? this.choice : p.choice) || (this.stuck && !this.stuck.kind) || (D && D.creep && D.creep.p === p));
  },
  /** something asks this player for an answer already (or they must not be asked now) */
  askBusy(p = this.me) {
    if (this.askHold(p)) return true;
    if (p.local && (this.buzz || this.ui.noteOpen || (this.vidJob && !this.vidJob.done))) return true;
    if (this.friends.some((f) => f.call && !f.gone)) return true;
    return (this.shows || []).some((s) => !s.over && s.to === p);
  },

  // ---------------------------------------------------------------- tips
  /** tips wait while this screen is in a scare, a lean or a story moment (they come after it, one at a time) */
  tipHold() {
    if (this.state !== 'playing') return false;
    const D = this.dread;
    const tense = this.leanFor(this.me) || !!(this.scareBusy || this.scLocalOn || this.localScare || this.jumping || this.blameBusy
      || (D && D.creep && D.creep.p === this.me) || this.ending || (this.cutscene && this.mode === 'free')); // (Free Class: being caught)
    if (tense) this.tenseAt = this.t;
    return tense || this.t - (this.tenseAt ?? -99) < PACE.tipAfter; // (and a moment after it: the lights come back first)
  },
  /** what this player already did by themselves (a control tip about it is not needed) */
  didAll(...keys) {
    const s = this.track.of(this.me);
    return keys.every((k) => (s[k] || 0) > 0);
  },

  // ---------------------------------------------------------------- his habits
  /** the next time this habit may come: a little later every time, and not at all after a few */
  habitNext(id, every) {
    const n = (this.quirkRuns[id] = (this.quirkRuns[id] || 0) + 1);
    const max = PACE.habits.max[id];
    this.quirkNext[id] = max && n >= max ? 1e9 : this.t + rand(every[0], every[1]) * Math.pow(PACE.habits.grow, n - 1);
  },
  /** one of these lines that he has not said lately (null: he says nothing this time) */
  freshLine(ids) {
    const ok = ids.filter((id) => this.t - (this.lineAt[id] ?? -1e9) >= PACE.lineGap);
    if (!ok.length) return null;
    const id = ok[(Math.random() * ok.length) | 0];
    this.lineAt[id] = this.t;
    return id;
  },

  // ---------------------------------------------------------------- the task list
  /** the tasks on screen: a few open ones (the oldest, and always the newest), the bell, a task just finished */
  taskView(list = this.objectives) {
    const open = list.filter((o) => !o.done && o.id !== 'bell');
    let keep = open.slice(0, PACE.tasks);
    const newest = open.reduce((a, o) => (!a || (o.seq || 0) > (a.seq || 0) ? o : a), null);
    if (newest && !keep.includes(newest)) keep = [...keep.slice(0, PACE.tasks - 1), newest];
    return list.filter((o) => (o.id === 'bell') || keep.includes(o) || (o.done && this.t - (o.doneAt ?? -1e9) < PACE.doneShow));
  },
  showTasks() {
    this.ui.setObjectives(this.taskView(this.objectives));
  },
};
