// Phase 7: teamwork and betrayal (online).
// The decoy: when a friend slips off their chair, the others are told to ask him a question to keep him
// busy. A friend who gets something done at his desk (his glasses, his laptop, the clock, the cushion)
// while somebody's question keeps him busy: TEAMWORK, and the one who asked counts as the decoy.
// Betrayal: when he asks "Who did it?" (src/blame.js), you can point at a friend sitting in the class.
// If he believes you, he watches your friend instead (and they are told who blamed them).
// Numbers and texts: TEAM (src/data.js).
import * as THREE from 'three';
import { TEAM, BLAME } from './data.js';

const V = THREE.Vector3;

export const TeamMixin = {
  resetTeam() { for (const p of this.players || []) p.decoyHintAt = 0; this.decoys = 0; },

  /** host: a friend just left their chair: tell the others in their seats to keep him busy */
  decoyCall(p) {
    if (!this.mp || this.players.length < 2 || !this.extrasAuto) return;
    for (const q of this.players) {
      if (q === p || q.out || q.slipK > 0 || q.ghost || this.t < (q.decoyHintAt || 0)) continue;
      q.decoyHintAt = this.t + TEAM.decoy.hintCd;
      const key = q.local ? (this.input.touch ? 'ASK' : 'T') : 'T / ASK';
      this.uiTo(q, 'hint', TEAM.text.decoyAsk.replace('{name}', p.name).replace('{key}', key), 4.5);
    }
  },

  /** host: p got something done at his desk. Is somebody's question keeping him busy right now? */
  decoyCredit(p) {
    if (!this.mp) return;
    const q = this.players.find((x) => x !== p && x.qBusy && !x.ghost && x.decoyQ !== x.qLast);
    if (!q) return;
    q.decoyQ = q.qLast; // (once per question)
    this.decoys++;
    this.note(q, 'team_distract');
    this.mischief += TEAM.decoy.mischief;
    this.addLaugh(TEAM.decoy.laugh, this.headOf(q, new V()), null);
    this.track.event(this.t, q, 'decoy', { for: p.name });
    const msg = TEAM.text.decoyDone.replace('{decoy}', q.name);
    this.uiTo(q, 'toast', msg, 2.4); this.uiTo(p, 'toast', msg, 2.4);
  },

  /** "Who did it?": the friend you can point at (online: the nearest one sitting in the class), or null */
  blameFriendFor(p) {
    if (!this.mp) return null;
    let best = null, bd = 1e9;
    for (const q of this.players) {
      if (q === p || q.ghost || q.out || q.slipK > 0) continue;
      const d = Math.hypot(q.eye.x - p.eye.x, q.eye.z - p.eye.z);
      if (d < bd) { bd = d; best = q; }
    }
    return best;
  },

  /** you pointed at your friend */
  *blameFriend(p, q, sure) {
    const T = this.teacher, F = TEAM.friend;
    this.playerSay('p_bl_them', p); // "It was them!"
    yield* this.wait(1.0);
    if (!this.players.includes(q)) { yield* this.blameSilent(p); return; } // (they left meanwhile)
    if (sure >= BLAME.lieLimit) {
      yield* this.say('t_bl_no', 0.2); // "No. I do not believe you."
      p.lies = (p.lies || 0) + 1;
      this.note(p, 'lies'); this.track.event(this.t, p, 'blame', { result: 'lie', friend: q.name });
      yield* this.bustSoon('lie', p);
      return;
    }
    // he believes you: everybody turns to your friend
    const head = this.headOf(q, new V());
    T.lookAt(head, 5); T.facePoint(head, 4);
    this.audio.play('bl_ooh', { pos: new V(0, 1.1, 0.6), vol: 0.9, ref: 3.5, reverb: 0.3 });
    const looking = [];
    for (const k of this.students) if (!k.gone && !k.hollow && !k.call) { k.lookTarget = head; looking.push(k); }
    this.uiTo(q, 'hint', TEAM.text.blamed.replace('{name}', p.name), 4.5);
    yield* this.wait(0.8);
    yield* this.say('t_bl_friend', 0.3); // "Your... friend. Interesting."
    yield* this.say('t_bl_watch', 0.3); // "I am watching you."
    for (const k of looking) if (k.lookTarget === head) k.lookTarget = null;
    if (this.players.includes(q)) { q.watchedT = Math.max(q.watchedT || 0, F.watch); q.heat += F.heat; }
    this.mischief += F.mischief;
    this.addLaugh(F.laugh, head, null);
    p.heat = 0; p.prankStreak = 0;
    this.note(p, 'blame_friend'); this.track.event(this.t, p, 'blame', { result: 'friend', who: q.name });
    this.uiTo(p, 'hint', TEAM.text.blamer.replace('{name}', q.name), 3);
  },
};
