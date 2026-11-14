// Multiplayer transport: WebRTC data channels through PeerJS.
// One player hosts the class (their browser runs the game); friends join with a short code.
// Signalling uses the free PeerJS cloud server, so the game itself stays a static site.
// Debug: ?peer=localhost:9000 uses a local PeerServer instead.
//
// How two browsers find each other (ICE):
//  - STUN (Google) tells a browser its public address. Enough for most home Wi-Fi.
//  - TURN relays the game when no direct way works: mobile data, carrier NAT, strict Wi-Fi.
//    PeerJS's free relays are always in the list (a custom PeerJS `config` replaces PeerJS's own
//    defaults, so they are named here), plus your own relay from GET api/turn (the Vercel function
//    api/turn.js) when it is set up. Without that function (a local server, other static hosts)
//    the game goes on with the built-in list.
//  - Joining is patient: a friend keeps trying for about a minute, because the host's phone may
//    be in another app for a moment (phones freeze a page in the background).
//  - The host's link to the signalling server heals itself, keeping the same class code, when it
//    drops and when the phone comes back to the game.
//  - A connection that fails logs a short diagnosis to the console (what kind of addresses were
//    found: host = this device, srflx = public address from STUN, relay = a TURN relay).
import { ONLINE } from './data.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PART = 12000;        // big messages (the chalkboard picture) go out in pieces
const PREFIX = 'madiclass-v1-';

/** always used: Google's STUN and PeerJS's free TURN relays (the same list PeerJS uses by default) */
export const BUILTIN_ICE = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];

let loading = null;
function loadPeerJS() {
  if (window.Peer) return Promise.resolve();
  if (!loading) {
    loading = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'vendor/peerjs.min.js';
      s.onload = () => res();
      s.onerror = () => { loading = null; rej(new Error('could not load the multiplayer library')); };
      document.head.appendChild(s);
    });
  }
  return loading;
}

// ---------------------------------------------------------------- relay servers
let extraIce = null, extraAt = 0;
const copyIce = (s) => ({ ...s, urls: [...s.urls] });

/** the ICE servers for new connections: the built-in ones + your own relay (if api/turn has one) */
export async function iceServers() {
  if (!extraIce || performance.now() - extraAt > ONLINE.turnCache) {
    const got = await fetchTurn();
    if (got) { extraIce = got; extraAt = performance.now(); }
  }
  return [...BUILTIN_ICE, ...(extraIce || [])].map(copyIce);
}

/** GET api/turn: a list, [] when this host has no such function, null when it can't tell right now */
async function fetchTurn() {
  if (typeof fetch !== 'function') return [];
  const ctl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer;
  const late = new Promise((_, rej) => { timer = setTimeout(() => { if (ctl) ctl.abort(); rej(new Error('timeout')); }, ONLINE.turnTimeout); });
  const ask = (async () => {
    const r = await fetch(ONLINE.turnUrl, { cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined });
    if (!r.ok) return r.status === 404 ? [] : null; // 404: no function here (local server, other static hosts): don't ask again
    const j = await r.json();
    return cleanIce(j && j.iceServers);
  })();
  try { return await Promise.race([ask, late]); } catch (e) { return null; } // timeout, offline, not JSON: built-in list only
  finally { clearTimeout(timer); }
}

/** only entries a browser accepts (one bad entry would break every connection) */
export function cleanIce(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list.slice(0, 8)) {
    if (!s || typeof s !== 'object') continue;
    const urls = (Array.isArray(s.urls) ? s.urls : [s.urls]).filter((u) => typeof u === 'string' && u.length < 256 && /^(stun|turns?):\S+$/i.test(u)).slice(0, 10);
    if (!urls.length) continue;
    const turn = urls.some((u) => /^turns?:/i.test(u));
    if (turn && !(typeof s.username === 'string' && s.username && typeof s.credential === 'string' && s.credential)) continue;
    const e = turn ? { urls, username: s.username, credential: s.credential } : { urls };
    try { if (typeof RTCPeerConnection === 'function') new RTCPeerConnection({ iceServers: [e] }).close(); } catch (err) { continue; }
    out.push(e);
  }
  return out;
}

function peerOptions(ice, token) {
  const q = new URLSearchParams(location.search).get('peer');
  const opts = { debug: 0, config: { iceServers: ice || BUILTIN_ICE.map(copyIce), sdpSemantics: 'unified-plan' } };
  if (token) opts.token = token; // the host keeps its token, so it can take its class code back after a drop
  if (q) {
    const [host, port] = q.split(':');
    Object.assign(opts, { host, port: Number(port || 9000), path: '/', secure: false });
  }
  return opts;
}

// ---------------------------------------------------------------- small helpers
export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  return s;
}
export const cleanCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
const makeToken = () => Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
const failure = (text, extra) => Object.assign(new Error(text), extra);
const cancelled = () => failure('cancelled', { cancelled: true });
const SERVER_ERRORS = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected']);
/** PeerJS 1.5.5: is the WebSocket to the signalling server open? */
const sockOpen = (p) => { try { const s = p.socket && p.socket._socket; return !!s && s.readyState === 1; } catch (e) { return false; } };

// time with the game on screen: a phone freezes a page in the background, and that time
// shouldn't use up a friend's minute of trying
let hiddenAt = document.hidden ? performance.now() : 0, hiddenTotal = 0;
document.addEventListener('visibilitychange', () => {
  const now = performance.now();
  if (document.hidden) { if (!hiddenAt) hiddenAt = now; }
  else if (hiddenAt) { hiddenTotal += now - hiddenAt; hiddenAt = 0; }
});
const awake = () => performance.now() - hiddenTotal - (hiddenAt ? performance.now() - hiddenAt : 0);

// ---------------------------------------------------------------- diagnosis
/** watch a connection's ICE: which kinds of address were found, the last TURN error */
function watchIce(c) {
  const d = { kinds: { host: 0, srflx: 0, prflx: 0, relay: 0 }, ice: 'new', gather: 'new', signal: 'new', turnErr: '', pc: null };
  const pc = c && c.peerConnection;
  if (!pc || !pc.addEventListener) return d;
  d.pc = pc;
  pc.addEventListener('icecandidate', (e) => {
    const cand = e.candidate;
    if (!cand || !cand.candidate) return;
    const k = cand.type || (/ typ (\w+)/.exec(cand.candidate) || [])[1];
    if (k in d.kinds) d.kinds[k]++;
  });
  pc.addEventListener('icecandidateerror', (e) => {
    if (/^turns?:/i.test(e.url || '')) d.turnErr = `${e.errorCode || ''} ${e.errorText || ''} (${e.url})`.replace(/\s+/g, ' ').trim();
  });
  return d;
}
/** read the states before the connection is closed (closing resets them) */
function snapshot(d) {
  const pc = d.pc;
  if (pc) { d.ice = pc.iceConnectionState; d.gather = pc.iceGatheringState; d.signal = pc.signalingState; }
  d.pc = null;
  return d;
}
/** one line for the console: what happened and what probably went wrong */
export function explain(d, why) {
  const k = d.kinds;
  let hint;
  if (why === 'missing') hint = 'the game server does not know this class code (the host closed the class, or the host\'s page is asleep)';
  else if (why === 'server' || why === 'gone') hint = 'the link to the game server dropped on one side';
  else if (d.signal === 'have-local-offer' || d.signal === 'new') hint = 'the host never answered: its game is probably closed or in another app';
  else if (!k.relay) hint = 'no relay address was found: the TURN relays could not be reached from this network (UDP or port 3478 blocked?). An own relay with TURN over TLS on port 443 fixes that (README: "Friends can\'t join?")';
  else hint = 'a relay was reached, but no way to the other player worked: their network may block it too (an own relay with TURN over TLS on port 443 helps)';
  return `${why}; ICE connection: ${d.ice}, address gathering: ${d.gather}, signalling: ${d.signal}; addresses found: host ${k.host}, srflx ${k.srflx}, relay ${k.relay}`
    + (d.turnErr ? `; TURN error ${d.turnErr}` : '') + '. ' + hint;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class Net {
  constructor() {
    this.peer = null;
    this.role = null;          // 'host' | 'guest'
    this.code = null;
    this.conns = new Map();    // host: peerId -> DataConnection;  guest: 'host' -> DataConnection
    this.on = {};              // event -> handler
    this.parts = new Map();    // incoming pieces of big messages
    this.partId = 1;
    this.ice = null;           // the ICE servers in use (built-in + your own relay)
    this.token = null;         // host: the secret that lets this browser take its class code back
    this.wantCode = null;      // tests: host this code
    this.hosting = false;
    this.closed = false;
    this.healN = 0;            // host: heal tries in a row (the wait grows: 1, 2, 4, 8 s)
    this.healTimer = null; this.checkTimer = null;
    this.lostShown = false;
    this.tries = 0;            // guest: connection tries so far
    this.diag = null;          // the last failed connection (also logged to the console)
  }

  /** a message arrived on a connection: reassemble pieces, then hand it on */
  receive(from, d) {
    if (d && d.t === '~part') {
      const key = from + ':' + d.id;
      let buf = this.parts.get(key);
      if (!buf) { buf = []; this.parts.set(key, buf); }
      buf[d.i] = d.s;
      if (buf.filter((x) => x !== undefined).length < d.n) return;
      this.parts.delete(key);
      try { d = JSON.parse(buf.join('')); } catch (e) { return; }
    }
    this.emit('msg', from, d);
  }

  write(c, msg) {
    if (!c || !c.open || !msg || typeof msg !== 'object') return;
    try {
      const s = JSON.stringify(msg);
      if (s.length <= PART) { c.send(msg); return; }
      const id = this.partId++, n = Math.ceil(s.length / PART);
      for (let i = 0; i < n; i++) c.send({ t: '~part', id, i, n, s: s.slice(i * PART, (i + 1) * PART) });
    } catch (e) { /* closing */ }
  }

  emit(ev, ...a) { const f = this.on[ev]; if (f) f(...a); }

  // ============================================================ HOST
  /** create a room; resolves with the code */
  async host() {
    this.closed = false;
    this.hosting = true;
    await loadPeerJS();
    this.ice = await iceServers();
    if (this.closed) throw cancelled();
    this.token = makeToken();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = attempt === 0 && cleanCode(this.wantCode).length === 5 ? cleanCode(this.wantCode) : makeCode();
      try {
        await this.open(PREFIX + code);
        this.role = 'host'; this.code = code;
        return code;
      } catch (e) {
        if (this.closed) throw cancelled();
        if (this.peer) { try { this.peer.destroy(); } catch (err) { /* already */ } this.peer = null; }
        if (e && e.type === 'unavailable-id') continue; // somebody has that code, roll again
        throw e;
      }
    }
    throw new Error('could not create a room, try again');
  }

  /** a friend's browser is connecting to the host */
  accept(c) {
    const d = watchIce(c);
    let settled = false;
    this.emit('trying', c.peer);
    const failed = (why) => {
      if (settled || c.open) return;
      settled = true;
      clearTimeout(timer);
      this.diag = snapshot(d);
      console.warn('[net] a friend could not connect: ' + explain(d, why));
      try { c.close(); } catch (e) { /* already */ }
      this.emit('failed', c.peer, d);
    };
    const timer = setTimeout(() => failed('timeout'), ONLINE.hostTrying);
    c.on('error', () => failed('ice'));
    c.on('open', () => {
      settled = true;
      clearTimeout(timer);
      const old = this.conns.get(c.peer);
      this.conns.set(c.peer, c);
      if (old && old !== c) { try { old.close(); } catch (e) { /* already */ } } // the friend's newest try wins
      c.on('data', (x) => this.receive(c.peer, x));
      c.on('close', () => { if (this.conns.get(c.peer) === c) { this.conns.delete(c.peer); this.emit('leave', c.peer); } });
      c.on('error', () => {});
      if (!old) this.emit('join', c.peer);
    });
  }

  /** host: make sure the signalling server can still reach this class (same code); force renews the link */
  heal(force = false) {
    if (this.role !== 'host' || this.closed || !this.code) return 'none';
    const p = this.peer;
    if (!p || p.destroyed) { this.reopen(); return 'reopen'; }
    if (p.disconnected) { this.reconnect(p); return 'reconnect'; }
    if (force) {
      // after a long time in the background the socket can look open but be dead: renew it
      this.refreshing = true;
      try { p.disconnect(); } catch (e) { /* already */ }
      this.refreshing = false;
      this.reconnect(p);
      return 'refresh';
    }
    return 'ok';
  }

  reconnect(p) {
    try { p.reconnect(); } catch (e) { /* not disconnected after all */ }
    // the server answers "open" when it registers us again, or takes us back silently (it still
    // knows our token): check the socket a moment later either way
    clearTimeout(this.checkTimer);
    this.checkTimer = setTimeout(() => {
      if (this.peer !== p || this.closed || this.role !== 'host') return;
      if (!p.disconnected && !p.destroyed && sockOpen(p)) this.healed();
      else this.scheduleHeal();
    }, 2500);
  }

  healed() {
    this.healN = 0;
    if (this.lostShown) { this.lostShown = false; this.emit('server', 'back'); }
  }

  /** the host's Peer is gone: open the same class code again (the token proves it is ours) */
  async reopen() {
    if (this.reopening || this.closed || this.role !== 'host') return;
    this.reopening = true;
    const old = this.peer;
    this.peer = null;
    if (old && !old.destroyed) { try { old.destroy(); } catch (e) { /* already */ } }
    try {
      await this.open(PREFIX + this.code, { quiet: true });
      this.takenN = 0;
      this.healed();
    } catch (e) {
      if (this.closed) return;
      if (this.peer) { try { this.peer.destroy(); } catch (err) { /* already */ } }
      if (e && e.type === 'unavailable-id' && (this.takenN = (this.takenN || 0) + 1) >= 4) { this.emit('server', 'taken'); return; }
      this.dropped();
    } finally { this.reopening = false; }
  }

  scheduleHeal() {
    if (this.role !== 'host' || this.closed || this.healTimer) return;
    const wait = [1000, 2000, 4000, 8000][Math.min(this.healN++, 3)];
    this.healTimer = setTimeout(() => { this.healTimer = null; this.heal(); }, wait);
  }

  /** the host lost the signalling server: friends can't join until it is back */
  dropped() {
    if (this.role !== 'host' || this.closed) return;
    if (!this.refreshing && !this.lostShown) { this.lostShown = true; this.emit('server', 'lost'); }
    if (!this.refreshing) this.scheduleHeal();
  }

  /** the page is on screen again after `awayMs` (a phone may have frozen it): heal the host's link */
  wake(awayMs = 0) { return this.heal(awayMs >= ONLINE.refreshAfter); }

  // ============================================================ GUEST
  /** join a room by code; status(kind, tries) reports progress: 'server' | 'connect' | 'missing' */
  async join(code, status = () => {}) {
    this.closed = false;
    this.role = 'guest'; this.code = code;
    status('server', 0);
    await loadPeerJS();
    this.ice = await iceServers();
    const T = ONLINE.text, t0 = awake(), since = () => awake() - t0;
    let missingAt = -1, serverAt = -1;
    this.tries = 0;
    for (;;) {
      if (this.closed) throw cancelled();
      // a live link to the signalling server first (a new Peer if the old one died)
      const p = this.peer;
      if (!p || p.destroyed || p.disconnected) {
        if (p) { this.peer = null; try { p.destroy(); } catch (e) { /* already */ } }
        status('server', this.tries);
        try {
          await this.open(undefined);
          serverAt = -1;
        } catch (e) {
          if (this.closed) throw cancelled();
          if (serverAt < 0) serverAt = since();
          if (since() - serverAt >= ONLINE.serverFor || since() >= ONLINE.joinFor) throw failure(T.noServer, { server: true });
          await sleep(ONLINE.retryGap);
          continue;
        }
      }
      this.tries++;
      status(missingAt >= 0 ? 'missing' : 'connect', this.tries);
      const started = since();
      const r = await this.attempt(code, Math.max(3000, Math.min(ONLINE.tryFor, ONLINE.joinFor - started)));
      if (r.ok) return;
      if (this.closed || r.why === 'cancel') throw cancelled();
      const now = since();
      // "no such code": the host may be coming back to the game (it registers again), so look a few more times
      if (r.why === 'missing') { if (missingAt < 0) missingAt = started; } else missingAt = -1;
      const noClass = r.why === 'missing' && now - missingAt >= ONLINE.missingFor;
      if (noClass || now + ONLINE.retryGap >= ONLINE.joinFor) {
        console.warn(`[net] could not join class ${code} after ${this.tries} tries (${Math.round(now / 1000)} s): ` + explain(r.diag, r.why));
        throw failure(r.why === 'missing' ? T.noClass : T.blocked, { missing: r.why === 'missing' });
      }
      console.info(`[net] try ${this.tries} to join ${code} failed: ` + explain(r.diag, r.why));
      await sleep(ONLINE.retryGap);
    }
  }

  /** one try: a new DataConnection to the host; resolves { ok } or { why, diag } */
  attempt(code, ms) {
    return new Promise((res) => {
      const p = this.peer;
      let c = null;
      try { c = p.connect(PREFIX + code, { reliable: true, serialization: 'json' }); } catch (e) { c = null; }
      const d = watchIce(c);
      if (!c) { this.diag = d; res({ why: 'server', diag: d }); return; }
      let done = false;
      const finish = (why) => {
        if (done) return;
        done = true;
        clearTimeout(timer); clearInterval(poll);
        p.removeListener('error', onErr);
        if (why === 'ok') { res({ ok: true }); return; }
        snapshot(d);
        try { c.close(); } catch (e) { /* already */ }
        this.diag = d;
        res({ why, diag: d });
      };
      const onErr = (e) => {
        const ty = e && e.type;
        if (ty === 'peer-unavailable') finish('missing');
        else if (SERVER_ERRORS.has(ty)) finish('server');
      };
      p.on('error', onErr);
      c.on('error', () => finish('ice'));
      c.on('open', () => {
        if (done) { try { c.close(); } catch (e) { /* already */ } return; }
        this.conns.set('host', c);
        c.on('data', (x) => this.receive('host', x));
        c.on('close', () => { if (this.conns.get('host') === c) { this.conns.delete('host'); this.emit('lost'); } });
        c.on('error', () => {});
        finish('ok');
      });
      // closed under us (the signalling server said the host's link died) or the player gave up
      const poll = setInterval(() => {
        if (this.closed) finish('cancel');
        else if (!c.open && !c.peerConnection) finish('gone');
      }, 400);
      const timer = setTimeout(() => finish('timeout'), ms);
    });
  }

  // ============================================================ BOTH
  /** connect to the signalling server as `id` (the host's class) or a new random id (a friend) */
  open(id, { quiet = false } = {}) {
    return new Promise((res, rej) => {
      const p = new window.Peer(id, peerOptions(this.ice, id ? this.token : null));
      this.peer = p;
      const t0 = performance.now();
      let settled = false;
      const done = (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer); clearInterval(poll);
        if (err) rej(err); else res();
      };
      const serverText = this.hosting ? ONLINE.text.noHostServer : ONLINE.text.noServer;
      const timer = setTimeout(() => done(failure(serverText, { server: true })), ONLINE.openFor);
      // taking a class code back: the server says nothing when it still knows our token, so an
      // open socket with no complaint for a moment means it worked
      const poll = quiet ? setInterval(() => { if (sockOpen(p) && performance.now() - t0 > 2500 && !p.disconnected) done(); }, 250) : 0;
      p.on('open', () => done());
      p.on('error', (e) => {
        if (settled) return;
        if (e && SERVER_ERRORS.has(e.type)) done(failure(serverText, { type: e.type, server: true }));
        else done(e);
      });
      p.on('close', () => {
        done(this.closed ? cancelled() : failure(serverText, { server: true }));
        if (this.peer === p && !this.closed && this.role === 'host') this.dropped();
      });
      p.on('disconnected', () => { if (this.peer === p && settled) this.dropped(); });
      p.on('connection', (c) => {
        if (this.peer === p && this.hosting && !this.closed) this.accept(c);
        else { try { c.close(); } catch (e) { /* already */ } }
      });
    });
  }

  send(to, msg) { this.write(this.conns.get(to), msg); }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except) this.write(c, msg); }
  kick(id) { const c = this.conns.get(id); if (c) c.close(); }

  close() {
    this.closed = true;
    clearTimeout(this.healTimer); clearTimeout(this.checkTimer);
    this.healTimer = null;
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* already */ } }
    this.conns.clear();
    const p = this.peer;
    this.peer = null;
    if (p) { try { p.destroy(); } catch (e) { /* already */ } }
    this.role = null; this.code = null; this.hosting = false;
  }
}

