// Online fix: friends can always join.
//  - the relay list: Google STUN + PeerJS's TURN relays + your own relay from api/turn (faked here
//    with page.route: no real TURN server is ever contacted), on the host AND on the friend
//  - falling back when api/turn is missing, broken, slow or answers junk
//  - patient joining: the host shows up a few seconds after the friend starts joining; a host
//    whose game doesn't answer (a phone in another app) and comes back; giving up with clear
//    words and a console diagnosis; CANCEL
//  - the host's lobby: keep-open tip, SHARE (navigator.share) with the copy fallback, the lobby
//    sounds and Mr. Madi's lines, healing the link to the game server with the same class code
// Real NAT traversal (two phones on different networks) can't be reproduced on one machine.
const { chromium, devices, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
const BUILTIN = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
];
// what a configured api/turn might answer (made-up .invalid hosts), with junk that must be dropped
const SERVED = { iceServers: [
  { urls: ['stun:stun.madi.invalid:3478'] },
  { urls: ['turn:relay.madi.invalid:3478?transport=udp', 'turns:relay.madi.invalid:443?transport=tcp'], username: 'u1', credential: 'c1' },
  { urls: 'turn:nocred.madi.invalid:3478' },
  { urls: ['https://evil.example/'] },
  'junk',
] };
const SERVED_CLEAN = [SERVED.iceServers[0], SERVED.iceServers[1]];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, name) => { (c ? ok : bad).push(name); console.log(' ', c ? 'ok ' : 'BAD', name); };
  const warns = {};
  /** a player's page; turn(route) answers api/turn for it (default: like Vercel with nothing set up) */
  const mk = async (tag, { turn, touch } = {}) => {
    const ctx = await browser.newContext(touch ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 } : { viewport: { width: 480, height: 270 } });
    const p = await ctx.newPage();
    p.turnCalls = 0;
    if (turn) await p.route('**/api/turn', async (r) => { p.turnCalls++; await turn(r, p); });
    p.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    p.on('console', (m) => {
      const url = (m.location() && m.location().url) || '';
      if (m.type() === 'error' && !/api\/turn/.test(url)) logs.push(`${tag} console: ${m.text().slice(0, 200)}`);
      if (m.type() === 'warning' || m.type() === 'info') (warns[tag] = warns[tag] || []).push(m.text());
    });
    return p;
  };
  const waitFor = (p, fn, ms = 30000, arg) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const open = async (p, url) => {
    await p.goto(url);
    await waitFor(p, () => window.game && (!document.getElementById('menu').classList.contains('hidden') || !document.getElementById('mp').classList.contains('hidden')), 180000);
    await p.evaluate(() => { game.post.render = () => {}; }); // CPU-only test machine: skip drawing, keep the game running
    // every status line the lobby shows, in order
    await p.evaluate(() => {
      window.statusLog = [];
      new MutationObserver(() => { const t = document.getElementById('mp-status').innerText; if (t && window.statusLog[window.statusLog.length - 1] !== t) window.statusLog.push(t); })
        .observe(document.getElementById('mp-status'), { childList: true, characterData: true, subtree: true });
    });
  };
  const tune = (p, o) => p.evaluate(async (o) => { const m = await import('./src/data.js'); Object.assign(m.ONLINE, o); }, o);
  const status = (p) => p.evaluate(() => document.getElementById('mp-status').innerText);
  const hostClass = async (p, name) => {
    if (await p.evaluate(() => document.getElementById('mp').classList.contains('hidden'))) await p.click('#btn-mp');
    await p.fill('#mp-name', name);
    await p.click('#btn-host');
    await waitFor(p, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent) && game.mp && game.mp.code, 25000);
    return p.evaluate(() => document.getElementById('mp-code-show').textContent);
  };
  const startJoin = async (p, code, name) => {
    if (await p.evaluate(() => document.getElementById('mp').classList.contains('hidden'))) await p.click('#btn-mp');
    await p.fill('#mp-name', name); await p.fill('#mp-code', code);
    await p.evaluate(() => { window.statusLog = []; });
    await p.click('#btn-join');
  };
  const joined = (p, ms = 30000) => waitFor(p, () => !!(game.mp && game.mp.myId), ms);
  const iceOf = (p) => p.evaluate(() => game.mp.net.peer.options.config.iceServers);
  const setHidden = (p, h) => p.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  const lobbyLog = (p) => p.evaluate(() => game.lobbyLog || []);

  // ---------------------------------------------------------------- 1. api/turn missing, broken, slow
  let mode = 'bad';
  const X = await mk('X', { turn: async (r) => {
    if (mode === 'bad') return r.fulfill({ status: 200, contentType: 'application/json', body: '<html>not json' });
    if (mode === '500') return r.fulfill({ status: 500, body: 'oops' });
    if (mode === '404') return r.fulfill({ status: 404, body: 'Not found' });
    // 'hang': never answers within the 3 s the game waits
    await new Promise((res) => setTimeout(res, 6000));
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVED) }).catch(() => {});
  } });
  await open(X, BASE + '&hostcode=QWERT');
  const iceNow = () => X.evaluate(async () => { const t0 = performance.now(); const l = await (await import('./src/net.js')).iceServers(); return { l, ms: performance.now() - t0 }; });
  let r = await iceNow();
  pass(same(r.l, BUILTIN), 'api/turn answers HTML instead of JSON: the built-in STUN + PeerJS TURN list');
  mode = 'hang'; r = await iceNow();
  pass(same(r.l, BUILTIN) && r.ms > 2500 && r.ms < 4500, `api/turn hangs: gives up after ${(r.ms / 1000).toFixed(1)} s with the built-in list`);
  mode = '500'; r = await iceNow();
  pass(same(r.l, BUILTIN), 'api/turn fails (500): the built-in list');
  mode = '404';
  const code404 = await hostClass(X, 'Xena');
  pass(code404 === 'QWERT' && same(await iceOf(X), BUILTIN), 'no api/turn on this host (404, like the local server): the class opens with STUN + PeerJS TURN');
  const calls = X.turnCalls;
  r = await iceNow();
  pass(X.turnCalls === calls, 'a 404 is remembered: api/turn is not asked again');
  await X.click('#btn-mp-leave');

  // ---------------------------------------------------------------- 2. api/turn has your own relay: host and friend use it
  const served = async (rt) => rt.fulfill({ status: 200, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify(SERVED) });
  const H = await mk('H', { turn: served });
  await open(H, BASE);
  const code = await hostClass(H, 'Alex');
  const hostIce = await iceOf(H);
  pass(same(hostIce, [...BUILTIN, ...SERVED_CLEAN]), 'host: Google STUN + PeerJS TURN + the api/turn relay (junk entries dropped): ' + hostIce.map((s) => s.urls[0]).join(', '));
  pass(H.turnCalls === 1, 'host asked api/turn once (' + H.turnCalls + ')');
  pass(await H.evaluate(() => !document.getElementById('mp-keep').classList.contains('hidden') && /Keep the game open on this screen/.test(document.getElementById("mp-keep").innerText) && !/SHARE/.test(document.getElementById("mp-keep").innerText)),
    'host lobby says to keep the game open on screen: "' + (await H.evaluate(() => document.getElementById('mp-keep').innerText)).slice(0, 60) + '…"');
  pass(await H.evaluate(() => document.getElementById('btn-share').classList.contains('hidden') && !document.getElementById('btn-copy').classList.contains('hidden')), 'desktop: COPY INVITE LINK (no share sheet)');
  const G = await mk('G', { turn: served });
  await open(G, BASE + '&join=' + code);
  await startJoin(G, code, 'Bo');
  pass(await joined(G), 'friend joins (the made-up relay hosts in the list do not get in the way)');
  pass(same(await G.evaluate(() => game.mp.net.ice), [...BUILTIN, ...SERVED_CLEAN]) && same(await iceOf(G), [...BUILTIN, ...SERVED_CLEAN]), 'friend: the same relay list (both sides need the relay)');
  await waitFor(H, () => game.players.length === 2, 10000);
  await H.waitForTimeout(400);
  let hl = await lobbyLog(H), gl = await lobbyLog(G);
  pass(hl.some((e) => e.kind === 'joined' && e.sfx === 'net_join' && e.line === 't_sitdown'), 'host lobby: a friend sits down (sound + "Sit... down.")');
  pass(/Bo is in/.test(await status(H)) && (await H.evaluate(() => window.statusLog)).some((t) => /Someone is connecting/.test(t)), 'host status: "Someone is connecting…" then "Bo is in."');
  pass(gl.some((e) => e.kind === 'in' && e.sfx === 'net_join') && gl.some((e) => e.kind === 'try'), 'friend: a ping for the try, the sit-down sound when in');
  pass(await G.evaluate(() => /You are in/.test(document.getElementById('mp-status').innerText) && document.getElementById('btn-join').textContent === 'JOIN'), 'friend status: "You are in."');

  // ---------------------------------------------------------------- 3. the host goes to another app and comes back
  await tune(H, { awayLine: 300, refreshAfter: 300 });
  await H.waitForTimeout(3500); // let "Sit... down." finish (one line at a time)
  const peerBefore = await H.evaluate(() => { window.peerA = game.mp.net.peer; return game.mp.code; });
  await setHidden(H, true);
  await H.waitForTimeout(700);
  await setHidden(H, false);
  await H.waitForTimeout(900);
  hl = await lobbyLog(H);
  pass(hl.some((e) => e.kind === 'away' && e.line === 't_dontleave'), 'host back from another app: Mr. Madi says "Do not... leave... my class."');
  pass(/Welcome back/.test(await status(H)) && /leave/.test(await H.evaluate(() => document.getElementById('mp-madi').innerText)), 'status "Welcome back…" and his line under the lobby: "' + (await H.evaluate(() => document.getElementById('mp-madi').innerText)) + '"');
  pass(await H.evaluate((c) => game.mp.code === c && game.mp.net.peer === window.peerA && !game.mp.net.peer.disconnected, peerBefore), 'the link to the game server was renewed, same class code');
  await H.waitForTimeout(2600);
  const G2 = await mk('G2', { turn: served });
  await open(G2, BASE + '&join=' + code);
  await startJoin(G2, code, 'Cy');
  pass(await joined(G2) && await waitFor(H, () => game.players.length === 3, 10000), 'after coming back, another friend can still join (3 players)');

  // the signalling link drops (Wi-Fi hiccup): it comes back by itself; friends in the class stay
  await H.evaluate(() => { window.statusLog = []; game.mp.net.peer.disconnect(); });
  const healed = await waitFor(H, () => (window.statusLog || []).some((t) => /open again/.test(t)), 15000);
  pass(healed && (await H.evaluate(() => window.statusLog)).some((t) => /Lost the game server/.test(t)), 'game server link drops: "Lost the game server. Reconnecting…", then "Your class is open again."');
  pass(await H.evaluate(() => !game.mp.net.peer.disconnected && game.players.length === 3), 'reconnected with the same code; both friends are still in');

  // ...and when the link comes back slowly (a phone network): still opening when the host first looks
  await H.waitForTimeout(500);
  await H.evaluate(() => {
    window.statusLog = [];
    const s = game.mp.net.peer.socket, start = s.start.bind(s);
    s.start = (...a) => { s.start = start; setTimeout(() => start(...a), 4000); }; // the next link opens 4 s late
    game.mp.net.peer.disconnect();
  });
  const slow = await waitFor(H, () => (window.statusLog || []).some((t) => /open again/.test(t)), 25000);
  pass(slow && (await H.evaluate(() => window.statusLog)).some((t) => /Lost the game server/.test(t)) && /open again/.test(await status(H)),
    'the link takes 4 s to come back: the lobby ends on "Your class is open again." (not stuck on "Reconnecting…"): ' + (await H.evaluate(() => window.statusLog)).join(' | '));
  pass(await H.evaluate(() => !game.mp.net.lostShown && game.mp.net.healN === 0), 'and a later drop would be shown again (the "lost" note is reset)');

  // the host's Peer dies completely: it opens the same code again (friends drop and can come back in)
  await H.evaluate(() => { window.statusLog = []; window.peerB = game.mp.net.peer; game.mp.net.peer.destroy(); });
  await setHidden(H, true); await setHidden(H, false); // and the phone comes back to the game
  const reopened = await waitFor(H, () => game.mp.net.peer && game.mp.net.peer !== window.peerB && !game.mp.net.peer.destroyed && (window.statusLog || []).some((t) => /open again/.test(t)), 20000);
  pass(reopened && await H.evaluate((c) => game.mp.code === c && game.mp.net.peer.id === 'madiclass-v1-' + c, code), 'Peer destroyed: a new one takes the same class code back');
  pass(await waitFor(G, () => /closed the class|Lost the connection/.test(document.getElementById('mp-status').innerText) && document.getElementById('mp-code').value.length === 5, 20000), 'the dropped friend is told, and the code stays in the box');
  pass((await lobbyLog(G)).some((e) => e.kind === 'lost' && e.sfx === 'door_slam'), 'and hears the door slam (back on the join screen)');
  await G.evaluate(() => { window.statusLog = []; });
  await G.click('#btn-join');
  pass(await joined(G), 'the friend presses JOIN again and is back in the same class');
  await waitFor(G2, () => !game.mp || !game.mp.myId, 15000);
  await G2.click('#btn-mp-leave').catch(() => {});

  // ---------------------------------------------------------------- 4. the host's game doesn't answer (phone in another app): retries, then clear words
  await tune(G2, { joinFor: 9000, tryFor: 3000, retryGap: 1000 });
  await H.evaluate(() => { const s = game.mp.net.peer.socket; window.deaf = s.listeners('message'); s.removeAllListeners('message'); });
  await startJoin(G2, code, 'Cy');
  const t0 = Date.now();
  await waitFor(G2, () => /Could not connect|No class/.test(document.getElementById('mp-status').innerText), 30000);
  const failMsg = await status(G2), failT = (Date.now() - t0) / 1000;
  const g2log = await G2.evaluate(() => window.statusLog);
  pass(g2log.some((t) => /Connecting to the class… try 2/.test(t)) && g2log.some((t) => /try 3/.test(t)), 'friend sees the tries: ' + g2log.filter((t) => /try/.test(t)).join(' | '));
  pass(/Could not connect to the host/.test(failMsg) && /keeps the game open on the screen/.test(failMsg) && /mobile data/.test(failMsg) && failMsg.split('\n').length === 4, `gives up after ${failT.toFixed(0)} s with simple steps, one per line: "${failMsg.replace(/\n/g, ' / ')}"`);
  const diag = (warns.G2 || []).find((t) => /\[net\] could not join class/.test(t)) || '';
  pass(/never answered/.test(diag) && /addresses found: host \d+, srflx \d+, relay \d+/.test(diag) && /ICE connection: \w+/.test(diag), 'console diagnosis: ' + diag.slice(0, 600));
  pass((warns.G2 || []).filter((t) => /\[net\] try \d+ to join/.test(t)).length >= 2, 'each failed try is logged too');
  gl = await lobbyLog(G2);
  pass(gl.some((e) => e.kind === 'fail' && e.sfx === 'net_fail' && e.line === 't_nocome') && gl.filter((e) => e.kind === 'try').length >= 3, 'a ping for every try, then the fail sound and "Nobody... is... coming."');
  pass(await G2.evaluate(() => game.mp === null && game.role === 'solo' && document.getElementById('btn-join').textContent === 'JOIN'), 'back to a working join screen (solo, JOIN button)');
  await G2.screenshot({ path: shot('mp_net_join_fail.png') });

  // ...and the host comes back while the friend is still trying: the next try gets in
  await tune(G2, { joinFor: 30000, tryFor: 4000 });
  await startJoin(G2, code, 'Cy');
  await G2.waitForTimeout(2500);
  await H.evaluate(() => { const s = game.mp.net.peer.socket; for (const f of window.deaf) s.on('message', f); });
  await setHidden(H, true); await setHidden(H, false);
  const back = await joined(G2, 20000);
  const tries = await G2.evaluate(() => game.mp && game.mp.net.tries);
  pass(back && tries >= 2, `host's game comes back: the friend gets in on try ${tries}`);
  pass(await waitFor(H, () => game.players.length === 3, 10000), 'host has 3 players again');

  // ---------------------------------------------------------------- 5. no class yet: the host appears a few seconds later
  const Y = await mk('Y');
  await open(Y, BASE + '&hostcode=QWERT');
  await startJoin(X, 'QWERT', 'Early');
  await X.waitForTimeout(500);
  pass(await X.evaluate(() => document.getElementById('btn-join').textContent === 'CANCEL'), 'while joining, JOIN says CANCEL');
  // the game server says "no such code" after about 5 s; the host opens the class at 8 s
  await X.waitForTimeout(7500);
  await hostClass(Y, 'Late Host');
  pass(await joined(X, 20000) && await waitFor(Y, () => game.players.length === 2, 10000), 'the friend started joining before the class existed, and got in when the host opened it');
  const xlog = await X.evaluate(() => window.statusLog);
  pass(xlog.some((t) => /Looking for class QWERT… try/.test(t) || /try 2/.test(t)), 'meanwhile: ' + xlog.slice(0, 4).join(' | '));

  // ---------------------------------------------------------------- 6. CANCEL
  await X.click('#btn-mp-leave');
  await X.click('#btn-mp');
  await startJoin(X, 'ZZZZ9', 'Early');
  await X.waitForTimeout(1500);
  await X.click('#btn-join');
  await X.waitForTimeout(400);
  pass(/Stopped/.test(await status(X)) && await X.evaluate(() => document.getElementById('btn-join').textContent === 'JOIN' && game.mp === null), 'CANCEL stops joining: "Stopped. Press JOIN to try again."');
  await X.waitForTimeout(7000);
  pass(/Stopped/.test(await status(X)), 'and nothing pops up later (no late error)');

  // ---------------------------------------------------------------- 7. a phone host: SHARE sends the code without leaving the game
  const P = await mk('P', { touch: true });
  await P.addInitScript(() => {
    window.shared = []; window.copied = [];
    navigator.share = async (d) => { window.shared.push(d); if (window.shareFails) { const e = new Error('x'); e.name = window.shareFails; throw e; } };
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (t) => { window.copied.push(t); } } });
  });
  await open(P, BASE);
  const pcode = await hostClass(P, 'Phone');
  pass(await P.evaluate(() => !document.getElementById('btn-share').classList.contains('hidden') && !document.getElementById('mp-keep').classList.contains('hidden')), 'phone host: SHARE CODE button and the keep-open tip');
  await P.screenshot({ path: shot('mp_net_lobby_phone.png') });
  await P.tap('#btn-share');
  await P.waitForTimeout(300);
  const sh = await P.evaluate(() => window.shared[0]);
  pass(!!sh && sh.text.includes(pcode) && sh.url.endsWith('?join=' + pcode) && /MADI CLASS/.test(sh.title), 'SHARE opens the share sheet with the code and the invite link: ' + (sh && sh.text));
  pass(/Sent! Stay here/.test(await status(P)), 'after sharing: "Sent! Stay here until your friends are in."');
  await P.evaluate(() => { window.shareFails = 'AbortError'; document.getElementById('mp-status').textContent = 'x'; });
  await P.tap('#btn-share'); await P.waitForTimeout(300);
  pass((await status(P)) === 'x' && (await P.evaluate(() => window.copied.length)) === 0, 'closing the share sheet does nothing');
  await P.evaluate(() => { window.shareFails = 'NotAllowedError'; });
  await P.tap('#btn-share'); await P.waitForTimeout(300);
  pass((await P.evaluate(() => window.copied[0] || '')).endsWith('?join=' + pcode) && /copied/.test(await status(P)), 'share not allowed: the invite link is copied instead');
  await P.tap('#btn-copy'); await P.waitForTimeout(300);
  pass((await P.evaluate(() => window.copied.length)) === 2, 'COPY INVITE LINK copies it too');
  const box = await P.evaluate(() => { const r = document.getElementById('btn-share').getBoundingClientRect(); return [r.top, r.bottom, innerHeight]; });
  pass(box[0] >= 0 && box[1] <= box[2], 'the SHARE button is on screen without scrolling on a landscape phone');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
