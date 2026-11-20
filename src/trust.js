// Online: trust, and telling on a friend (mixed into Game; IDEAS.md F5).
// The "raise your hand" menu gets a fourth choice online: "Tell on BO" (the friend you look at, else the
// loudest one lately). He turns and looks at that friend:
//  - it was true (whispering, on the phone, aiming, off their chair, or repeated him in the last few
//    seconds): the friend gets trouble (he bends over their desk, "I see you.", a jump scare on their own
//    screen, he keeps an eye on them). Not a strike. You get 1 trust.
//  - it was not: "No. I do not believe you." You lose 1 trust and he keeps an eye on you.
// The host runs all of it; trust goes to the friends in sneakRow (src/sneak.js).
import { TRUST } from './data.js';

export const TrustMixin = {
  /** openAsk: the friend this player can tell on right now (null: no fourth choice) */
  tellTarget(p) {
    if (!this.mp || !(this.t - p.tellAt > TRUST.cooldown)) return null;
    const others = this.players.filter((q) => q !== p && !q.out && !(q.slipK > 0) && !q.ghost);
    if (!others.length) return null;
    const a = this.aimFriend(p);
    if (others.includes(a)) return a;
    let hot = others[0];
    for (const q of others) if ((q.heat || 0) > (hot.heat || 0)) hot = q;
    return hot;
  },

  tellOn(p, q) {
    if (!this.canAsk(p) || !this.players.includes(q)) { this.uiTo(p, 'status', 'He is busy right now. <b>Ask him later.</b>', 2.2); return; } // (the menu was open a while)
    p.tellAt = this.t; p.handT = 2.8;
    this.interrupt(this.reactTell(p, q));
  },

  *reactTell(p, q) {
    const T = this.teacher;
    this.lockBully = true;
    try {
      T.lookAt(q.camPos, 10); T.facePoint(q.camPos, 5);
      yield* this.wait(0.9);
      if (!this.players.includes(q)) return;
      if (this.t - q.badAt <= TRUST.recent) {
        p.trust = Math.min(TRUST.max, p.trust + 1);
        this.note(p, 'snitched');
        this.uiTo(q, 'hint', TRUST.told.replace('{name}', p.name), 4);
        yield* this.trouble(q, p);
      } else {
        yield* this.say('t_bl_no');
        p.trust = Math.max(0, p.trust - 1);
        p.watchedT = TRUST.liarWatch;
        this.uiTo(p, 'status', TRUST.liar, 3);
      }
    } finally {
      this.lockBully = false;
    }
  },

  /** he comes to that player's desk, "I see you.", a jump scare on their screen only. Not a strike. */
  *trouble(q, by) {
    const T = this.teacher;
    for (const r of this.players) this.uiTo(r, 'toast', TRUST.toast.replace('{name}', r === q ? 'YOU' : q.name.toUpperCase()).replace('{by}', by.name), 3);
    try {
      T.clap = null; T.setPose('rest');
      const spot = this.deskSpot(q);
      T.lookAt(q.camPos, 4);
      yield* this.walk(spot.approach.x, spot.approach.z, 1.4);
      yield* this.walk(spot.stand.x, spot.stand.z, 1.0);
      if (!this.players.includes(q)) return;
      T.faceTo(spot.face, 5);
      T.setPose('desk', spot.corners); T.leanTarget = 0.9; T.lookAt(q.camPos, 6);
      yield* this.say('t_see');
      if (!this.players.includes(q)) return;
      if (q.local) { if (this.canScareMe()) yield* this.scLocal('lunge'); }
      else if (this.mp) {
        q.scareDone = -1; // (an older report must not end this one)
        const t0 = this.t;
        this.mp.toPlayer(q, { t: 'gscare', k: 'lunge' });
        yield* this.until(() => q.scareDone > t0 || !this.players.includes(q), 2.5);
      }
      q.watchedT = TRUST.watch; q.heat += 15;
    } finally {
      T.setPose('rest'); T.leanTarget = 0;
    }
  },
};
