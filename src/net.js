// Multiplayer transport: WebRTC data channels through PeerJS.
// One player hosts the class (their browser runs the game); friends join with a short code.
// Signalling uses the free PeerJS cloud server, so the game itself stays a static site.
// Debug: ?peer=localhost:9000 uses a local PeerServer instead.

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const PART = 12000;        // big messages (the chalkboard picture) go out in pieces
const PREFIX = 'madiclass-v1-';

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

function peerOptions() {
  const q = new URLSearchParams(location.search).get('peer');
  const opts = {
    debug: 0,
    config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] },
  };
  if (q) {
    const [host, port] = q.split(':');
    Object.assign(opts, { host, port: Number(port || 9000), path: '/', secure: false });
  }
  return opts;
}

export function makeCode() {
  let s = '';
  for (let i = 0; i < 5; i++) s += ALPHABET[(Math.random() * ALPHABET.length) | 0];
  return s;
}
export const cleanCode = (c) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);

export class Net {
  constructor() {
    this.peer = null;
    this.role = null;          // 'host' | 'guest'
    this.code = null;
    this.conns = new Map();    // host: peerId -> DataConnection;  guest: 'host' -> DataConnection
    this.on = {};              // event -> handler
    this.parts = new Map();    // incoming pieces of big messages
    this.partId = 1;
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

  /** create a room; resolves with the code */
  async host() {
    await loadPeerJS();
    for (let attempt = 0; attempt < 4; attempt++) {
      const code = makeCode();
      try {
        await this.open(PREFIX + code);
        this.role = 'host'; this.code = code;
        this.peer.on('connection', (c) => this.accept(c));
        return code;
      } catch (e) {
        if (e && e.type === 'unavailable-id') continue; // somebody has that code, roll again
        throw e;
      }
    }
    throw new Error('could not create a room, try again');
  }

  /** join a room by code */
  async join(code) {
    await loadPeerJS();
    await this.open(undefined);
    this.role = 'guest'; this.code = code;
    return new Promise((res, rej) => {
      const c = this.peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
      const blocked = 'could not connect to the host. One of your networks may block game connections: try again, or use another Wi-Fi or a phone hotspot';
      const fail = setTimeout(() => rej(new Error(blocked)), 20000);
      this.peer.on('error', (e) => {
        clearTimeout(fail);
        if (e.type === 'peer-unavailable') rej(new Error('no class with that code. Check the code, and that the host still has the class open'));
        else rej(new Error(blocked));
      });
      c.on('error', () => { clearTimeout(fail); rej(new Error(blocked)); });
      c.on('open', () => {
        clearTimeout(fail);
        this.conns.set('host', c);
        c.on('data', (d) => this.receive('host', d));
        c.on('close', () => { this.conns.delete('host'); this.emit('lost'); });
        c.on('error', () => {});
        res();
      });
    });
  }

  open(id) {
    return new Promise((res, rej) => {
      const p = new window.Peer(id, peerOptions());
      this.peer = p;
      const t = setTimeout(() => rej(new Error('could not reach the multiplayer server. Check your internet, or open the game from its own website (for example your Vercel link) instead of a preview window')), 15000);
      p.on('open', () => { clearTimeout(t); res(); });
      p.on('error', (e) => {
        clearTimeout(t);
        if (e && (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error')) rej(new Error('could not reach the multiplayer server. Check your internet, or open the game from its own website (for example your Vercel link) instead of a preview window'));
        else rej(e);
      });
      p.on('disconnected', () => { try { p.reconnect(); } catch (e) { /* closed */ } });
    });
  }

  accept(c) {
    c.on('open', () => {
      this.conns.set(c.peer, c);
      c.on('data', (d) => this.receive(c.peer, d));
      c.on('close', () => { this.conns.delete(c.peer); this.emit('leave', c.peer); });
      c.on('error', () => {});
      this.emit('join', c.peer);
    });
  }

  send(to, msg) { this.write(this.conns.get(to), msg); }
  broadcast(msg, except) { for (const [id, c] of this.conns) if (id !== except) this.write(c, msg); }
  kick(id) { const c = this.conns.get(id); if (c) c.close(); }

  close() {
    for (const c of this.conns.values()) { try { c.close(); } catch (e) { /* already */ } }
    this.conns.clear();
    if (this.peer) { try { this.peer.destroy(); } catch (e) { /* already */ } }
    this.peer = null; this.role = null; this.code = null;
  }
}
