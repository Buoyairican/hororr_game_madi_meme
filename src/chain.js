// Phase 7: the note chain (online only). Now and then a note goes round the class: it starts with one
// player and has to reach every other player in turn (by seat). The one holding it looks at the next one
// and holds E / TALK (a whisper) to pass it on. Not while he looks right at you: if he looks straight at
// the one passing it (the instant-catch look, the same on Easy and Hard), he takes the note, it is a
// strike, and he reads it out loud. It also has to be done in time. When it gets to the last player,
// the class laughs, he calms down a little, and everyone in the chain gets mischief.
// Numbers and texts: CHAIN (src/data.js). The host runs it; friends get it in the snapshot (cn).
import { CHAIN, FREE_LENGTH } from './data.js';
import { rand, randInt, clamp } from './util.js';

const r2 = (x) => Math.round(x * 100) / 100;

export const ChainMixin = {
  resetChain() {
    this.chain = null;
    this.chainNext = rand(CHAIN.first[0], CHAIN.first[1]);
    this.chainN = 0;
    this.chainView = null; // friend: the chain as the host has it
    if (this.chainMeter) { this.chainMeter = false; this.ui.aim(null); }
  },

  /** the players who can take part (not a ghost), by seat */
  chainPlayers() { return this.players.filter((p) => !p.ghost).sort((a, b) => a.seat - b.seat); },
  chainOf(ids) { return ids.map((id) => this.players.find((p) => p.id === id)).filter(Boolean); },

  /** host / solo, every frame */
  updateChain(dt) {
    if (this.role === 'guest' || !this.mp || this.mode !== 'free') return;
    const C = CHAIN, ch = this.chain;
    if (!ch) {
      if (this.t < this.chainNext || !this.extrasAuto) return;
      // not close to the bell (the clock may have been moved forward)
      if (this.t > FREE_LENGTH - C.stopBefore || this.clockMin > 240 * (1 - C.stopBefore / FREE_LENGTH)) return;
      if (!this.present || this.cutscene || this.ending || this.eventLock || this.lockBully || this.choice) { this.chainNext = this.t + 3; return; }
      const ps = this.chainPlayers();
      if (ps.length < C.minPlayers) { this.chainNext = this.t + 8; return; }
      this.startChain(ps);
      return;
    }
    // somebody left: the next one picks the note up
    const ps = this.chainOf(ch.ids);
    if (ps.length !== ch.ids.length) {
      const gone = ch.ids.filter((id) => !this.players.some((p) => p.id === id));
      const holderGone = gone.includes(ch.ids[ch.i]), goneHolder = holderGone ? ch.ids[ch.i] : null;
      const before = ch.ids.slice(0, ch.i).filter((id) => gone.includes(id)).length;
      ch.ids = ch.ids.filter((id) => !gone.includes(id));
      ch.i = Math.max(0, ch.i - before);
      ch.hold = 0; ch.seen = 0;
      if (ch.ids.length < 2) { this.endChain('cancel'); return; }
      if (ch.i >= ch.ids.length - 1) { this.chainDone(); return; }
      if (holderGone) {
        const to = this.players.find((p) => p.id === ch.ids[ch.i]);
        const who = ch.names[goneHolder] || 'A friend';
        for (const q of this.chainOf(ch.ids)) this.uiTo(q, 'hint', C.text.moved.replace('{who}', who).replace('{to}', to.name), 3);
        this.chainTell();
      }
      return;
    }
    if (this.t > ch.until) { this.endChain('timeout'); return; }
    const holder = ps[ch.i], next = ps[ch.i + 1];
    if (holder.ghost || next.ghost) { this.endChain('cancel'); return; }
    const passing = !!(holder.talk && holder.talk.peer === next) && !this.cutscene && !holder.out && !(holder.slipK > 0);
    if (passing) {
      // he looks right at you while you pass it: he takes it (a strike, and he reads it out loud)
      const seen = this.present && holder.lookDot > 0.8 && !this.eventLock && !this.lockBully && !this.choice && !this.ending;
      ch.seen = seen ? ch.seen + dt : 0;
      if (ch.seen > C.seen) { ch.lost = holder; this.bust('note', holder); return; }
      ch.hold += dt;
      if (ch.hold >= C.hold) this.chainPass(holder, next);
    } else { ch.hold = Math.max(0, ch.hold - dt * 0.5); ch.seen = 0; }
  },

  /** ps: the players by seat; keep: in exactly this order (tests) */
  startChain(ps, keep = false) {
    const C = CHAIN;
    // it starts with somebody (not always the same seat), then goes round by seat
    const s = keep ? 0 : randInt(0, ps.length - 1);
    const order = ps.slice(s).concat(ps.slice(0, s));
    this.chain = { ids: order.map((p) => p.id), names: Object.fromEntries(order.map((p) => [p.id, p.name])), i: 0, hold: 0, seen: 0,
      note: randInt(0, C.notes.length - 1), until: this.t + C.time[0] + C.time[1] * (order.length - 1), lost: null };
    this.chainN++;
    this.track.event(this.t, order[0], 'chain', { k: 'start', n: order.length });
    this.audio.play('p6_pass', { pos: this.headOf(order[0]).clone(), vol: 0.5, ref: 1.2 });
    const chainNames = order.map((p) => p.name).join(' &rarr; ');
    for (const p of this.players) if (!order.includes(p)) this.uiTo(p, 'hint', C.text.others.replace('{chain}', chainNames), 5);
    this.chainTell();
  },

  /** tell the holder (what the note says, who to pass it to) and the next one */
  chainTell(from) {
    const C = CHAIN, ch = this.chain;
    if (!ch) return;
    const ps = this.chainOf(ch.ids), holder = ps[ch.i], next = ps[ch.i + 1];
    if (!holder || !next) return;
    const note = C.notes[ch.note].text.replace(/<br>/g, ' ');
    const msg = from ? C.text.got.replace('{from}', from.name) : C.text.holder;
    this.uiTo(holder, 'hint', msg.replace('{note}', note).replace('{next}', next.name).replace('{key}', holder.local ? (this.input.touch ? 'TALK' : 'E') : 'E / TALK'), 7);
    this.uiTo(next, 'hint', C.text.next.replace('{holder}', holder.name), 5);
  },

  chainPass(holder, next) {
    const C = CHAIN, ch = this.chain;
    this.note(holder, 'chain_pass');
    this.mischief += C.reward.pass;
    this.track.event(this.t, holder, 'chain', { k: 'pass', to: next.name });
    this.audio.play('p6_pass', { pos: this.headOf(next).clone(), vol: 0.55, ref: 1.2 });
    ch.i++; ch.hold = 0; ch.seen = 0;
    if (ch.i >= ch.ids.length - 1) this.chainDone(holder);
    else this.chainTell(holder);
  },

  /** it made it to the last one */
  chainDone(from) {
    const C = CHAIN, ch = this.chain, ps = this.chainOf(ch.ids), last = ps[ps.length - 1];
    const pts = C.reward.done + C.reward.perPass * (ch.ids.length - 1);
    this.mischief += pts;
    this.anger = Math.max(0, this.anger - C.reward.calm);
    for (const p of ps) this.note(p, 'chain_done');
    if (last) {
      this.addLaugh(C.reward.laugh, this.headOf(last).clone(), null);
      if (from) this.uiTo(last, 'hint', C.text.last.replace('{from}', from.name).replace('{note}', C.notes[ch.note].text.replace(/<br>/g, ' ')), 4);
    }
    this.track.event(this.t, last || ps[0], 'chain', { k: 'done', n: ch.ids.length });
    this.ui.toast(C.text.done.replace('{pts}', pts), 2.6);
    this.chain = null;
    this.chainNext = this.t + rand(CHAIN.gap[0], CHAIN.gap[1]);
  },

  endChain(why) {
    const C = CHAIN, ch = this.chain;
    if (!ch) return;
    for (const p of this.chainOf(ch.ids)) this.uiTo(p, 'hint', why === 'timeout' ? C.text.timeout : C.text.cancel, 2.5);
    this.track.event(this.t, null, 'chain', { k: why });
    this.chain = null;
    this.chainNext = this.t + rand(CHAIN.gap[0], CHAIN.gap[1]);
  },

  /** host, in the busted scene: caught with the note (passing it, or for anything else while you hold it).
   *  Returns the line he reads out loud, or null. */
  chainCaught(p) {
    const C = CHAIN, ch = this.chain;
    if (!ch || ch.ids[ch.i] !== p.id) return null;
    const note = C.notes[ch.note];
    this.note(p, 'chain_lost');
    this.track.event(this.t, p, 'chain', { k: 'lost' });
    this.ui.toast(C.text.lost, 2.4);
    this.chain = null;
    this.chainNext = this.t + rand(CHAIN.gap[0], CHAIN.gap[1]);
    return note.read;
  },

  // ---------------------------------------------------------------- what you see (host and friends alike)
  /** host: the chain for the snapshot: [ids, holder index, how far the pass is (0..1), the note] or 0 */
  chainSnap() {
    const ch = this.chain;
    return ch ? [ch.ids, ch.i, r2(clamp(ch.hold / CHAIN.hold, 0, 1)), ch.note] : 0;
  },
  applyChainSnap(s) { this.chainView = Array.isArray(s) ? { ids: s[0] || [], i: Number(s[1]) | 0, k: Number(s[2]) || 0, note: Number(s[3]) | 0 } : null; },

  /** you hold the note: who you pass it to (or null) */
  chainNextFor(p) {
    const v = this.role === 'guest' ? this.chainView : this.chain && { ids: this.chain.ids, i: this.chain.i, k: this.chain.hold / CHAIN.hold };
    if (!v || v.ids[v.i] !== p.id) return null;
    const next = this.players.find((q) => q.id === v.ids[v.i + 1]);
    return next ? { next, k: v.k } : null;
  },
  /** the prompt when you look at the one to pass it to; null when you don't hold the note */
  chainPrompt(aim) {
    const c = this.chainNextFor(this.me);
    if (!c || aim !== c.next) return null;
    return CHAIN.text.prompt.replace('{key}', this.input.touch ? 'TALK' : '[E]').replace('{next}', c.next.name);
  },
  /** every frame on your screen: the pass meter while you pass it */
  chainVisuals(talking) {
    const c = this.chainNextFor(this.me);
    const on = !!c && talking && c.k > 0.01;
    if (on) { this.chainMeter = true; this.ui.aim('PASSING THE NOTE', clamp(c.k, 0, 1), true); }
    else if (this.chainMeter) { this.chainMeter = false; this.ui.aim(null); }
  },
};
