// Phase 7: the chaos scoreboard on the online end screen ("WHO CAUSED THE MOST CHAOS").
// Every player gets points for what they did (the weights in CHAOS, src/data.js) and a title
// (THE SNIPER, THE SNEAK, THE SNITCH...). The host sends everybody's numbers; every browser builds
// the board itself from them (only numbers and names are taken from the network, like the report card).
import { CHAOS } from './data.js';

const esc = (s) => String(s).replace(/[<>&"]/g, '');
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

/** a player's chaos points from their numbers */
export function chaosPoints(st) {
  let s = 0;
  for (const k in CHAOS.weights) s += num(st[k]) * CHAOS.weights[k];
  return Math.round(s);
}

/** "{hitHim}" in a title's line -> that number */
const fill = (why, st) => why.replace(/\{(\w+)\}/g, (_, k) => String(Math.round(num(st[k]))));

/**
 * rows: [{ id, name, st }] -> the board, most chaos first: [{ id, name, pts, rank, title: { id, name, why } }].
 * Titles: the biggest (player, title) pair first, every title and every player only once;
 * nobody with enough points for any title left is THE ANGEL.
 */
export function chaosBoard(rows) {
  const out = rows.map((r) => ({ id: r.id, name: esc(r.name || '').slice(0, 12), st: r.st || {}, pts: chaosPoints(r.st || {}), title: null }));
  const pairs = [];
  for (const r of out) {
    for (const t of CHAOS.titles) {
      let v = 0;
      for (const k of t.keys) v += num(r.st[k]) * (CHAOS.weights[k] || 0);
      if (v >= CHAOS.minTitle) pairs.push({ r, t, v });
    }
  }
  pairs.sort((a, b) => b.v - a.v);
  const used = new Set();
  for (const { r, t } of pairs) {
    if (r.title || used.has(t.id)) continue;
    r.title = t; used.add(t.id);
  }
  for (const r of out) { const t = r.title || CHAOS.none; r.title = { id: t.id, name: t.name, why: fill(t.why, r.st) }; }
  out.sort((a, b) => b.pts - a.pts || a.name.localeCompare(b.name));
  out.forEach((r, i) => { r.rank = i > 0 && out[i - 1].pts === r.pts ? out[i - 1].rank : i + 1; });
  for (const r of out) delete r.st;
  return out;
}

export const ScoreboardMixin = {
  /** host / solo, when the end screen comes up: the board for a class with friends in it (else nothing) */
  chaosEnd() {
    if (this.role === 'guest') return;
    if (!this.mp || this.players.length < 2) { this.ui.chaos(null); return; }
    const rows = this.players.map((p) => ({ id: p.id, name: p.name, st: this.chaosStats(p) }));
    if (this.mp.role === 'host') this.mp.broadcastNow({ t: 'p7', k: 'board', rows });
    this.showChaos(rows);
  },

  /** one player's numbers (plain data: they go over the network) */
  chaosStats(p) {
    const s = this.track.of(p), st = {};
    for (const k in CHAOS.weights) if (Number.isFinite(s[k]) && s[k]) st[k] = Math.round(s[k] * 10) / 10;
    return st;
  },

  /** on every screen: the board from everybody's numbers */
  showChaos(rows) {
    if (!Array.isArray(rows) || rows.length < 2) { this.ui.chaos(null); return; }
    const clean = rows.slice(0, 8).map((r) => {
      const st = {};
      for (const k in (r && r.st) || {}) if (CHAOS.weights[k] != null && Number.isFinite(r.st[k])) st[k] = r.st[k];
      return { id: String((r && r.id) || ''), name: String((r && r.name) || '?'), st };
    });
    const board = chaosBoard(clean);
    this.lastBoard = board;
    const mine = this.role === 'guest' && this.mp ? this.mp.myId : this.me.id;
    const html = `<div class="chaos-h">${CHAOS.head}</div>` + board.map((r) =>
      `<div class="chaos-row${r.id === mine ? ' me' : ''}"><span class="chaos-rank">#${r.rank}</span><span class="chaos-name">${r.name}${r.id === mine ? ' (you)' : ''}</span>`
      + `<span class="chaos-title">${r.title.name}</span><span class="chaos-pts">${r.pts}</span><span class="chaos-why">${esc(r.title.why)}</span></div>`).join('');
    this.ui.chaos(html);
  },
};
