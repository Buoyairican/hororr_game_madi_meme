// GET /api/turn: extra relay servers (TURN) for playing online, as {"iceServers": [...]}.
//
// Two phones on different networks (mobile data, strict Wi-Fi, carrier NAT) often cannot reach
// each other directly. A TURN server relays the game between them. The game already uses
// PeerJS's free public relays; this Vercel function adds your own relay when you set one up in
// Vercel -> Settings -> Environment Variables (never put keys in the repo):
//   Cloudflare Realtime TURN:  CF_TURN_KEY_ID + CF_TURN_API_TOKEN
//   Metered:                   METERED_DOMAIN (yourapp.metered.live) + METERED_API_KEY
//   any TURN server:           TURN_URLS (comma separated) + TURN_USERNAME + TURN_CREDENTIAL
// Credentials from Cloudflare and Metered are short-lived and made fresh for every request.
// With nothing set up, or when a provider fails, the answer is {"iceServers": []} with status
// 200: joining a class must never break because of this function.
// Plain CommonJS for the Vercel Node.js runtime (Node 18+ has fetch); no dependencies.
'use strict';

const TTL = 86400;           // seconds the Cloudflare credentials stay valid
const TIMEOUT_MS = 2500;     // the game waits 3 s for this function, so providers get less
const MAX_SERVERS = 8;
const MAX_URLS = 10;

/** keep only well-formed entries: stun:/turn:/turns: URLs, and TURN entries need a username and credential */
function clean(list) {
  if (list && !Array.isArray(list)) list = [list];       // Cloudflare's older answer: one object
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const s of list) {
    if (!s || typeof s !== 'object' || out.length >= MAX_SERVERS) continue;
    const urls = (Array.isArray(s.urls) ? s.urls : [s.urls || s.url])
      .filter((u) => typeof u === 'string' && /^(stun|turns?):\S+$/i.test(u.trim()))
      .map((u) => u.trim())
      .filter((u) => !/:53(\?|$)/.test(u))                // port 53 is blocked by browsers (Cloudflare's own advice)
      .slice(0, MAX_URLS);
    if (!urls.length) continue;
    const turn = urls.some((u) => /^turns?:/i.test(u));
    if (turn) {
      if (typeof s.username !== 'string' || typeof s.credential !== 'string' || !s.username || !s.credential) continue;
      out.push({ urls, username: s.username, credential: s.credential });
    } else out.push({ urls });
  }
  return out;
}

async function fetchJson(url, options, fetchImpl) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetchImpl(url, { ...options, signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally {
    clearTimeout(timer);
  }
}

const PROVIDERS = {
  /** Cloudflare Realtime TURN: dash.cloudflare.com -> Realtime -> TURN Server */
  cloudflare: {
    on: (env) => !!(env.CF_TURN_KEY_ID && env.CF_TURN_API_TOKEN),
    get: async (env, fetchImpl) => {
      const url = 'https://rtc.live.cloudflare.com/v1/turn/keys/' + encodeURIComponent(env.CF_TURN_KEY_ID.trim()) + '/credentials/generate-ice-servers';
      const j = await fetchJson(url, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + env.CF_TURN_API_TOKEN.trim(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ttl: TTL }),
      }, fetchImpl);
      return clean(j && j.iceServers);
    },
  },
  /** Metered: dashboard.metered.ca -> TURN Server (the app domain ends in .metered.live) */
  metered: {
    on: (env) => !!(env.METERED_DOMAIN && env.METERED_API_KEY),
    get: async (env, fetchImpl) => {
      const domain = env.METERED_DOMAIN.trim().replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
      const url = 'https://' + domain + '/api/v1/turn/credentials?apiKey=' + encodeURIComponent(env.METERED_API_KEY.trim());
      const j = await fetchJson(url, { method: 'GET' }, fetchImpl);
      return clean(Array.isArray(j) ? j : j && j.iceServers);
    },
  },
  /** any TURN server you run or rent (static username and password) */
  static: {
    on: (env) => !!(env.TURN_URLS && env.TURN_USERNAME && env.TURN_CREDENTIAL),
    get: async (env) => clean([{ urls: env.TURN_URLS.split(',').map((u) => u.trim()).filter(Boolean), username: env.TURN_USERNAME, credential: env.TURN_CREDENTIAL }]),
  },
};

/** every configured provider, asked at the same time; a provider that fails is logged and skipped */
async function getIceServers(env = process.env, { fetchImpl = globalThis.fetch, log = console } = {}) {
  const names = Object.keys(PROVIDERS).filter((n) => PROVIDERS[n].on(env));
  const results = await Promise.allSettled(names.map((n) => PROVIDERS[n].get(env, fetchImpl)));
  const iceServers = [];
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') iceServers.push(...r.value);
    else log.error('turn: ' + names[i] + ' failed: ' + ((r.reason && (r.reason.name === 'AbortError' ? 'timed out' : r.reason.message)) || r.reason));
  });
  return iceServers.slice(0, MAX_SERVERS);
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (req.method && req.method !== 'GET' && req.method !== 'HEAD') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, HEAD');
    res.end(JSON.stringify({ iceServers: [] }));
    return;
  }
  let iceServers = [];
  try { iceServers = await getIceServers(process.env); } catch (e) { console.error('turn: ' + (e && e.message)); }
  res.statusCode = 200;
  res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ iceServers }));
}

module.exports = handler;
module.exports.getIceServers = getIceServers;
module.exports.clean = clean;
