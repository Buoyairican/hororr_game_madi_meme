// api/turn.js (the Vercel function that hands out relay servers) with a fake fetch:
// each provider, nothing configured, a provider failing or hanging, bad answers, no secrets in logs.
require('./lib'); // the shared verdict (RESULT PASS / FAIL)
const path = require('path');
const handler = require(path.join(__dirname, '..', 'api', 'turn.js'));

const ok = [], bad = [];
const pass = (c, name) => (c ? ok : bad).push(name + (c ? '' : '  <-- wrong'));
const KEYS = ['CF_TURN_KEY_ID', 'CF_TURN_API_TOKEN', 'METERED_DOMAIN', 'METERED_API_KEY', 'TURN_URLS', 'TURN_USERNAME', 'TURN_CREDENTIAL'];
const realFetch = globalThis.fetch, realError = console.error;

/** call the handler like Vercel does; env + a fake fetch for this one request */
async function call(env, fake, method = 'GET') {
  for (const k of KEYS) delete process.env[k];
  Object.assign(process.env, env);
  const calls = [], errors = [];
  globalThis.fetch = async (url, opts = {}) => { calls.push({ url: String(url), opts }); return fake(String(url), opts); };
  console.error = (...a) => errors.push(a.join(' '));
  const res = { statusCode: 0, headers: {}, body: undefined, setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b; this.ended = true; } };
  const t0 = Date.now();
  try { await handler({ method, url: '/api/turn', headers: {} }, res); } finally { globalThis.fetch = realFetch; console.error = realError; }
  let json = null;
  try { json = res.body === undefined ? null : JSON.parse(res.body); } catch (e) { json = 'BAD JSON'; }
  return { res, json, calls, errors, ms: Date.now() - t0 };
}
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => (typeof body === 'string' ? JSON.parse(body) : body) });
const CF_NEW = { iceServers: [
  { urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.cloudflare.com:53'] },
  { urls: ['turn:turn.cloudflare.com:3478?transport=udp', 'turn:turn.cloudflare.com:53?transport=udp', 'turn:turn.cloudflare.com:3478?transport=tcp', 'turns:turn.cloudflare.com:5349?transport=tcp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'cf-user', credential: 'cf-pass' },
] };
const CF_OLD = { iceServers: { urls: ['stun:stun.cloudflare.com:3478', 'turn:turn.cloudflare.com:3478?transport=udp', 'turns:turn.cloudflare.com:443?transport=tcp'], username: 'old-user', credential: 'old-pass' } };
const METERED = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { urls: 'turn:global.relay.metered.ca:80', username: 'm-user', credential: 'm-pass' },
  { urls: 'turn:global.relay.metered.ca:80?transport=tcp', username: 'm-user', credential: 'm-pass' },
  { urls: 'turns:global.relay.metered.ca:443?transport=tcp', username: 'm-user', credential: 'm-pass' },
];
const urlsOf = (j) => (j && Array.isArray(j.iceServers) ? j.iceServers.flatMap((s) => s.urls) : []);
const sane = (j) => j && Array.isArray(j.iceServers) && j.iceServers.every((s) => Array.isArray(s.urls) && s.urls.length && s.urls.every((u) => /^(stun|turns?):/.test(u)) && (!s.urls.some((u) => /^turn/.test(u)) || (s.username && s.credential)));

(async () => {
  // 1. nothing configured
  let r = await call({}, () => { throw new Error('must not be called'); });
  pass(r.res.statusCode === 200 && JSON.stringify(r.json) === '{"iceServers":[]}', 'nothing configured: 200 {"iceServers":[]}');
  pass(r.calls.length === 0 && r.errors.length === 0, 'nothing configured: no request to any provider, nothing logged');
  pass(/no-store/.test(r.res.headers['cache-control'] || '') && /application\/json/.test(r.res.headers['content-type'] || ''), 'answers are never cached and are JSON: ' + r.res.headers['cache-control']);

  // 2. Cloudflare, the current answer (an array)
  r = await call({ CF_TURN_KEY_ID: 'key123', CF_TURN_API_TOKEN: 'tok-secret' }, () => reply(201, CF_NEW));
  const c0 = r.calls[0] || { opts: {} };
  pass(r.calls.length === 1 && c0.url === 'https://rtc.live.cloudflare.com/v1/turn/keys/key123/credentials/generate-ice-servers', 'Cloudflare: POSTs to the generate-ice-servers URL of the key: ' + c0.url);
  pass(c0.opts.method === 'POST' && (c0.opts.headers || {}).Authorization === 'Bearer tok-secret' && JSON.parse(c0.opts.body || '{}').ttl === 86400, 'Cloudflare: Bearer token and {"ttl":86400}');
  pass(sane(r.json) && urlsOf(r.json).includes('turns:turn.cloudflare.com:443?transport=tcp') && urlsOf(r.json).includes('turn:turn.cloudflare.com:3478?transport=udp'), 'Cloudflare: STUN + TURN (UDP, TCP, TLS on 443) handed on');
  pass(!urlsOf(r.json).some((u) => /:53\b/.test(u)), 'Cloudflare: the port 53 addresses (blocked by browsers) are left out');
  pass(r.json.iceServers.some((s) => s.username === 'cf-user' && s.credential === 'cf-pass'), 'Cloudflare: the fresh username / credential are passed on');

  // 3. Cloudflare, the older answer (one object instead of an array)
  r = await call({ CF_TURN_KEY_ID: 'key123', CF_TURN_API_TOKEN: 'tok' }, () => reply(200, CF_OLD));
  pass(sane(r.json) && r.json.iceServers.length === 1 && r.json.iceServers[0].username === 'old-user' && urlsOf(r.json).length === 3, 'Cloudflare: the older single-object iceServers shape works too');

  // 4. Metered
  r = await call({ METERED_DOMAIN: 'https://myapp.metered.live/', METERED_API_KEY: 'k&y' }, () => reply(200, METERED));
  pass(r.calls.length === 1 && r.calls[0].url === 'https://myapp.metered.live/api/v1/turn/credentials?apiKey=k%26y', 'Metered: GET <domain>/api/v1/turn/credentials?apiKey=… (domain cleaned, key escaped): ' + (r.calls[0] || {}).url);
  pass(sane(r.json) && r.json.iceServers.length === 4 && urlsOf(r.json).includes('turns:global.relay.metered.ca:443?transport=tcp'), 'Metered: the array of servers is handed on');

  // 5. a static TURN server
  r = await call({ TURN_URLS: ' turn:turn.example.com:3478 , turns:turn.example.com:443?transport=tcp,', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'p' }, () => { throw new Error('no fetch'); });
  pass(r.calls.length === 0 && sane(r.json) && JSON.stringify(r.json.iceServers) === JSON.stringify([{ urls: ['turn:turn.example.com:3478', 'turns:turn.example.com:443?transport=tcp'], username: 'u', credential: 'p' }]), 'static TURN: TURN_URLS split on commas, username + credential, no request');
  r = await call({ TURN_URLS: 'turn:turn.example.com:3478', TURN_USERNAME: 'u' }, () => reply(200, {}));
  pass(JSON.stringify(r.json) === '{"iceServers":[]}', 'static TURN without a credential: not used');

  // 6. provider errors: never break joining
  r = await call({ CF_TURN_KEY_ID: 'key', CF_TURN_API_TOKEN: 'very-secret-token' }, () => reply(401, { error: 'no' }));
  pass(r.res.statusCode === 200 && JSON.stringify(r.json) === '{"iceServers":[]}', 'Cloudflare says 401: still 200 {"iceServers":[]}');
  pass(r.errors.length === 1 && /cloudflare/.test(r.errors[0]) && /401/.test(r.errors[0]), 'the error is logged: ' + r.errors[0]);
  pass(!r.errors.join(' ').includes('very-secret-token'), 'the token never appears in the log');
  r = await call({ METERED_DOMAIN: 'x.metered.live', METERED_API_KEY: 'k' }, () => { throw new TypeError('fetch failed'); });
  pass(r.res.statusCode === 200 && JSON.stringify(r.json) === '{"iceServers":[]}' && /metered failed: fetch failed/.test(r.errors[0] || ''), 'network error: 200 {"iceServers":[]} and logged');
  r = await call({ METERED_DOMAIN: 'x.metered.live', METERED_API_KEY: 'k' }, () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } }));
  pass(JSON.stringify(r.json) === '{"iceServers":[]}' && r.errors.length === 1, 'a provider answering HTML instead of JSON: {"iceServers":[]}');
  r = await call({ METERED_DOMAIN: 'x.metered.live', METERED_API_KEY: 'k' }, () => reply(200, [{ urls: 'turn:a.b:3478' }, { urls: 'http://evil.example' }, { urls: ['stun:ok.example:3478'] }, null, 'x']));
  pass(JSON.stringify(r.json.iceServers) === JSON.stringify([{ urls: ['stun:ok.example:3478'] }]), 'bad entries (TURN without credentials, non-stun/turn URLs, junk) are dropped');
  // a provider that hangs: the function answers anyway, in time for the game's 3 s wait
  r = await call({ CF_TURN_KEY_ID: 'key', CF_TURN_API_TOKEN: 'tok' }, (url, opts) => new Promise((res, rej) => { opts.signal.addEventListener('abort', () => { const e = new Error('aborted'); e.name = 'AbortError'; rej(e); }); }));
  pass(r.ms < 3000 && JSON.stringify(r.json) === '{"iceServers":[]}' && /timed out/.test(r.errors[0] || ''), `a hanging provider is given up after ${r.ms} ms (under the game's 3 s)`);

  // 7. several providers: all are used; one failing doesn't hide the others
  r = await call({ CF_TURN_KEY_ID: 'key', CF_TURN_API_TOKEN: 'tok', METERED_DOMAIN: 'x.metered.live', METERED_API_KEY: 'k', TURN_URLS: 'turn:t.example:3478', TURN_USERNAME: 'u', TURN_CREDENTIAL: 'p' },
    (url) => (/cloudflare/.test(url) ? reply(500, {}) : reply(200, METERED)));
  pass(r.calls.length === 2 && sane(r.json) && urlsOf(r.json).includes('turn:t.example:3478') && urlsOf(r.json).includes('turn:global.relay.metered.ca:80') && r.errors.length === 1, 'Cloudflare fails, Metered + static still answer (' + (r.json.iceServers || []).length + ' servers)');
  pass(r.json.iceServers.length <= 8, 'never more than 8 entries');

  // 8. methods
  r = await call({}, () => reply(200, {}), 'HEAD');
  pass(r.res.statusCode === 200 && r.res.body === undefined, 'HEAD: 200, no body');
  r = await call({}, () => reply(200, {}), 'POST');
  pass(r.res.statusCode === 405 && r.res.headers.allow === 'GET, HEAD', 'POST: 405 with Allow: GET, HEAD');

  for (const k of KEYS) delete process.env[k];
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
})().catch((e) => { console.log('RESULT FAIL: ' + e.stack); process.exitCode = 1; });
