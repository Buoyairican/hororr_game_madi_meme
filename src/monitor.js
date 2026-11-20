// Online: the class monitor (mixed into Game; IDEAS.md F6), on top of the event "he leaves the room" (src/events.js ev_leave).
// Before he goes out he points at the seated player with the most trust (MONITOR.trust or more): "You. Such a... good...
// student." That player is in charge until he is back: on their feet (the off-chair code of src/sneak.js, walking, not
// crawling, and he cannot see them), E / USE on a friend writes that friend's name on the board.
// When he is back: the monitor at the board, "I... am... back. Good." and the first names get trouble (src/trust.js);
// anywhere else, "Where... did you... go?", trust 0, the names wiped, caught like anybody off their chair.
// The host runs all of it; the flag goes to the friends in sneakRow (src/sneak.js).
import { MONITOR } from './data.js';

export const MonitorMixin = {
  /** ev_leave, after "Do not... move.": online, he picks the seated player with the most trust */
  *monitorAppoint() {
    if (!this.mp) return;
    let m = null;
    for (const p of this.players) if (!p.out && !(p.slipK > 0) && !p.ghost && (p.trust | 0) >= MONITOR.trust && (!m || p.trust > m.trust)) m = p;
    if (!m) return;
    const T = this.teacher;
    T.lookAt(m.camPos, 6);
    T.setPose('point', { at: m.camPos.clone() });
    yield* this.say('q_you'); yield* this.say('t_good');
    T.setPose('rest');
    if (this.players.includes(m) && !m.ghost) this.monitorStart(m);
  },

  monitorStart(m) {
    this.monitor = { p: m, names: [], stunUntil: 0 }; m.monitor = true;
    this.startOut(m); this.onOut(m);
    m.pos.set(MONITOR.start.x, 0, MONITOR.start.z); m.slipK = 1;
    if (this.boardRow > 3) this.world.board.erase(1.5); // (his last line is on the names' row: a clean board for the names)
    for (const p of this.players) {
      this.uiTo(p, 'toast', MONITOR.inCharge.replace('{name}', m.name.toUpperCase()), 3);
      if (p === m) this.uiTo(p, 'hint', MONITOR.you, 8);
      else this.uiTo(p, 'hint', MONITOR.others.replace('{name}', m.name), 6);
    }
  },

  /** (the host) the monitor writes a friend's name on the board (a friend's press: { t: 'press', k: 'mark', id }) */
  monitorWrite(m, q) {
    const M = this.monitor;
    if (!M || !this.away || M.p !== m || !q || q === m || !this.players.includes(q) || q.ghost) return; // (only while he is out of the room)
    if (this.t <= M.stunUntil) { this.uiTo(m, 'status', MONITOR.dropped, 1.5); return; }
    if (M.names.filter((x) => x === q).length >= MONITOR.perFriend) { this.uiTo(m, 'status', MONITOR.wrote.replace('{name}', q.name), 2); return; }
    if (M.names.length >= MONITOR.marks) { this.uiTo(m, 'status', MONITOR.full, 2); return; }
    const B = this.world.board, text = q.name.toUpperCase(), indent = 40 + M.names.length * MONITOR.slot;
    if (B.busy) return; // (the last name is still being written: a new one would cut it off)
    const L = B.layout(text, MONITOR.row, { indent, size: MONITOR.size }).chars, w = L.length ? L[L.length - 1].x + L[L.length - 1].w - indent : 0;
    const size = w > MONITOR.slot - 20 ? Math.floor(MONITOR.size * (MONITOR.slot - 20) / w) : MONITOR.size; // (a long name is written smaller: it stays in its slot)
    M.names.push(q);
    B.write(text, MONITOR.row, { indent, size });
    this.note(m, 'marks');
    this.uiTo(m, 'status', MONITOR.wrote.replace('{name}', q.name), 2);
    this.uiTo(q, 'hint', `<b>${m.name.toUpperCase()}</b> wrote your name on the board!`, 4);
  },

  /** ev_leave, when he is back (instead of "who is still at it"): is the monitor at the board? */
  *monitorReturn() {
    const { p: m, names } = this.monitor;
    const ok = this.players.includes(m) && Math.abs(m.pos.x) < MONITOR.zone.x && m.pos.z < MONITOR.zone.z;
    try {
      const T = this.teacher;
      T.lookAt(m.view, 5); T.facePoint(m.view, 3);
      if (ok) {
        yield* this.say('t_lv_back'); yield* this.say('t_good1');
        this.seatNow(m); m.monitor = false; m.monitorUntil = this.t + 1.5; this.mischief += 30;
        const list = names.filter((q) => this.players.includes(q) && !q.ghost).slice(0, MONITOR.punish);
        for (const q of list) if (this.players.includes(q)) yield* this.trouble(q, m);
      } else {
        this.world.board.erase(1.5); // (the names go while he speaks)
        yield* this.say('t_sn_where');
        if (!this.players.includes(m)) return;
        m.trust = 0; this.monitor.caught = true; // (still off their chair and on their feet: he takes them back to it himself; seatNow ends `monitor`, src/sneak.js)
        this.bust('seat', m);
      }
    } finally {
      this.monitorEnd();
    }
  },

  /** the monitor's turn is over (also: ev_leave's finally, reset, the monitor left the game) */
  monitorEnd() {
    if (!this.monitor) return;
    const { p: m, caught } = this.monitor;
    if (!caught) { if (m.monitor && m.out) { this.seatNow(m); m.monitorUntil = this.t + 1.5; } m.monitor = false; }
    this.monitor = null; this.boardRow = 4;
  },
};
