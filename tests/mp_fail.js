// When joining goes wrong (the Fable review, round 1): the cause is named and nothing loops forever.
//  - no relay: the host's game answers but the two networks need a relay (simulated: the friend's
//    browser may only use a relay, like a network that blocks every direct way). With no own relay
//    the friend is told "this game has no relay server" and the host gets the matching note; with an
//    own relay that can't be reached: "the relay server did not answer"
//  - api/turn too slow the first time: host and friend ask again and use the own relay later
//  - a host who closes the class and hosts again doesn't get a stale "could not connect"
//  - a friend whose Peer died between tries gets in with a new one: no false note on the host
//  - the game server never answering: "Could not reach the game server" (not "the host")
//  - a friend in a hidden tab on a computer: joining still ends (a limit on the clock)
//  - the host's time away is measured on the wall clock (a phone's performance.now() can stop asleep)
//  - the class code taken by another browser (after a drop, or after the Peer died): one message, no endless retries
// Real NAT traversal (two phones on different networks) can't be reproduced on one machine.
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
const SERVED = { iceServers: [
  { urls: ['stun:stun.madi.invalid:3478'] },
  { urls: ['turn:relay.madi.invalid:3478?transport=udp', 'turns:relay.madi.invalid:443?transport=tcp'], username: 'u1', credential: 'c1' },
] };

(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, name) => { (c ? ok : bad).push(name); console.log(' ', c ? 'ok ' : 'BAD', name); };
  const notes = {};
  const mk = async (tag, { turn } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    await ctx.addInitScript(() => {
      // the next `relayOnly` connections the game makes may only use a relay: a network that blocks
      // every direct way (the game's Peer config carries sdpSemantics; other RTCPeerConnections don't)
      const R = window.RTCPeerConnection;
      window.relayOnly = 0;
      function P(cfg, ...a) {
        if (window.relayOnly > 0 && cfg && cfg.sdpSemantics) { window.relayOnly--; cfg = { ...cfg, iceTransportPolicy: 'relay' }; }
        return new R(cfg, ...a);
      }
      P.prototype = R.prototype;
      window.RTCPeerConnection = P;
      // every Peer the game makes (to kill one in the middle of joining)
      window.peers = [];
      let Real = null, Wrapped = null;
      Object.defineProperty(window, 'Peer', {
        configurable: true,
        get: () => Wrapped,
        set: (v) => { Real = v; Wrapped = class extends Real { constructor(...a) { super(...a); window.peers.push(this); } }; },
      });
    });
    const p = await ctx.newPage();
    p.turnCalls = 0;
    if (turn) await p.route('**/api/turn', async (r) => { p.turnCalls++; await turn(r, p); });
    p.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    p.on('console', (m) => {
      const url = (m.location() && m.location().url) || '';
      if (m.type() === 'error' && !/api\/turn/.test(url)) logs.push(`${tag} console: ${m.text().slice(0, 200)}`);
      if (m.type() === 'warning' || m.type() === 'info') (notes[tag] = notes[tag] || []).push(m.text());
    });
    return p;
  };
  const waitFor = (p, fn, ms = 30000, arg) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const open = async (p, url) => {
    await p.goto(url);
    await waitFor(p, () => window.game && (!document.getElementById('menu').classList.contains('hidden') || !document.getElementById('mp').classList.contains('hidden')), 180000);
    await p.evaluate(() => { game.post.render = () => {}; });
    await p.evaluate(() => {
      window.statusLog = [];
      new MutationObserver(() => { const t = document.getElementById('mp-status').innerText; if (t && window.statusLog[window.statusLog.length - 1] !== t) window.statusLog.push(t); })
        .observe(document.getElementById('mp-status'), { childList: true, characterData: true, subtree: true });
    });
  };
  const tune = (p, o) => p.evaluate(async (o) => { const m = await import('./src/data.js'); Object.assign(m.ONLINE, o); }, o);
  const status = (p) => p.evaluate(() => document.getElementById('mp-status').innerText);
  const log = (p) => p.evaluate(() => window.statusLog);
  const inMp = async (p) => { if (await p.evaluate(() => document.getElementById('mp').classList.contains('hidden'))) await p.click('#btn-mp'); };
  const hostClass = async (p, name) => {
    await inMp(p);
    await p.fill('#mp-name', name);
    await p.evaluate(() => { window.statusLog = []; });
    await p.click('#btn-host');
    await waitFor(p, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent) && game.mp && game.mp.code, 25000);
    return p.evaluate(() => document.getElementById('mp-code-show').textContent);
  };
  const startJoin = async (p, code, name) => {
    await inMp(p);
    await p.fill('#mp-name', name); await p.fill('#mp-code', code);
    await p.evaluate(() => { window.statusLog = []; });
    await p.click('#btn-join');
  };
  const joined = (p, ms = 30000) => waitFor(p, () => !!(game.mp && game.mp.myId), ms);
  const leave = async (p) => { if (await p.evaluate(() => !document.getElementById('mp').classList.contains('hidden'))) await p.click('#btn-mp-leave'); };
  const setHidden = (p, h) => p.evaluate((h) => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
    document.dispatchEvent(new Event('visibilitychange'));
  }, h);
  const lastNote = (tag, re) => (notes[tag] || []).filter((t) => re.test(t)).pop() || '';
  // api/turn that is too slow the first time (a cold start), then answers at once
  const slowFirst = async (r, p) => {
    if (p.turnCalls === 1) { await new Promise((res) => setTimeout(res, 5000)); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVED) }).catch(() => {}); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(SERVED) });
  };

  const H = await mk('H'), G = await mk('G'), S = await mk('S', { turn: slowFirst }), S2 = await mk('S2', { turn: slowFirst });
  await Promise.all([open(H, BASE), open(G, BASE), open(S, BASE), open(S2, BASE)]);

  // ---------------------------------------------------------------- 1. api/turn too slow the first time
  const scode = await hostClass(S, 'Slow');
  const sOpen = lastNote('S', /\[net\] class \w+ is open/);
  pass(/own relay from api\/turn: NONE/.test(sOpen), 'host: api/turn took over 3 s, so the class opened with the built-in list: "' + sOpen.slice(0, 90) + '…"');
  pass(await waitFor(S, () => game.mp.net.peer.options.config.iceServers.some((s) => s.urls.some((u) => /relay\.madi\.invalid/.test(u))), 5000) && S.turnCalls === 2,
    `host: it asked again at once, and the next connections get the own relay (api/turn asked ${S.turnCalls} times)`);
  await startJoin(S2, scode, 'Late');
  pass(await joined(S2), 'a friend whose api/turn is slow the first time joins anyway');
  pass(await waitFor(S2, () => game.mp.net.ice.some((s) => s.urls.some((u) => /relay\.madi\.invalid/.test(u))) && game.mp.net.peer.options.config.iceServers.some((s) => s.urls.some((u) => /relay\.madi\.invalid/.test(u))), 5000),
    `friend: the own relay came on the second ask and is used for the next tries (api/turn asked ${S2.turnCalls} times)`);
  await leave(S2); await leave(S);

  // ---------------------------------------------------------------- 2. the networks need a relay, and there is none
  await tune(H, { hostTrying: 6000 });
  const code = await hostClass(H, 'Alex');
  await tune(G, { joinFor: 7000, tryFor: 2500, retryGap: 500 });
  await G.evaluate(() => { window.relayOnly = 99; });
  await startJoin(G, code, 'Bo');
  await waitFor(G, () => /Could not|No class/.test(document.getElementById('mp-status').innerText), 30000);
  let msg = await status(G);
  pass(/no relay server/.test(msg) && /Game owner: switch on a relay/.test(msg) && /mobile data/.test(msg) && msg.split('\n').length === 4,
    'the host answered, no relay anywhere: the friend is told the game has no relay server: "' + msg.replace(/\n/g, ' / ') + '"');
  let diag = lastNote('G', /\[net\] could not join class/);
  pass(/the host answered: yes/.test(diag) && /a relay address: no/.test(diag) && /This game has NO relay/.test(diag) && /PeerJS's free relays are offline/.test(diag), 'diagnosis in the console log, ' + diag.slice(0, 500));
  pass(/own relay from api\/turn: NONE/.test(lastNote('G', /\[net\] joining class/)), 'the console log when joining starts, "' + lastNote('G', /\[net\] joining class/).slice(0, 120) + '…"');
  pass(await waitFor(H, () => (window.statusLog || []).some((t) => /could not connect\. This game has no relay server/.test(t)), 12000), 'the host\'s lobby: "Someone tried to join but could not connect. This game has no relay server…"');
  pass(/a friend could not connect: .*NO relay/.test(lastNote('H', /a friend could not connect/)), 'the host\'s console log, ' + lastNote('H', /a friend could not connect/).slice(0, 300));
  await G.screenshot({ path: shot('mp_fail_norelay.png') });

  // ...the own relay is set up but can't be reached from this network
  await tune(S2, { joinFor: 7000, tryFor: 2500, retryGap: 500 });
  await S2.evaluate(() => { window.relayOnly = 99; });
  await startJoin(S2, code, 'Cy');
  await waitFor(S2, () => /Could not|No class/.test(document.getElementById('mp-status').innerText), 30000);
  msg = await status(S2);
  pass(/relay server did not answer/.test(msg) && !/no relay server/.test(msg), 'own relay set up but unreachable: "' + msg.replace(/\n/g, ' / ') + '"');
  diag = lastNote('S2', /\[net\] could not join class/);
  pass(/own relay/.test(diag) && /relay names not found \(DNS\): .*relay\.madi\.invalid/.test(diag), 'the console log names the relay that was not found, ' + diag.slice(0, 400));
  await H.waitForTimeout(6500); // the host's half-open connections from these tries run out

  // ---------------------------------------------------------------- 3. close the class and host again: no stale note
  await tune(G, { joinFor: 60000, tryFor: 15000 });
  await G.evaluate(() => { window.relayOnly = 99; });
  await startJoin(G, code, 'Bo');
  await waitFor(H, () => (window.statusLog || []).some((t) => /Someone is connecting/.test(t)), 10000);
  await H.click('#btn-mp-leave');
  const code2 = await hostClass(H, 'Alex');
  await G.click('#btn-join'); // CANCEL
  await H.waitForTimeout(7500);
  const hl = await log(H);
  pass(!hl.some((t) => /could not connect/.test(t)), `a friend was connecting when the host closed the class and hosted again (${code2}): no "could not connect" in the new class 7 s later (${hl.join(' | ')})`);

  // ---------------------------------------------------------------- 4. the friend's Peer dies between tries: in with a new one, no false note
  await tune(G, { joinFor: 30000, tryFor: 5000, retryGap: 400 });
  await G.evaluate(() => { window.relayOnly = 1; window.peers = []; }); // the first try can't get through...
  await startJoin(G, code2, 'Bo');
  await waitFor(H, () => (window.statusLog || []).some((t) => /Someone is connecting/.test(t)), 10000);
  await G.waitForTimeout(800);
  await G.evaluate(() => window.peers[window.peers.length - 1].destroy()); // ...and its Peer dies (the phone lost the network)
  pass(await joined(G, 20000), 'the friend\'s Peer died during the first try: a new Peer gets in');
  const ids = await G.evaluate(() => window.peers.map((p) => p.id || p._lastServerId));
  pass(ids.length === 2 && ids[0] !== ids[1], 'with a new id: ' + ids.join(' then '));
  await H.waitForTimeout(6500); // longer than the host waits for the first, half-open connection
  const hl2 = await log(H);
  pass(hl2.some((t) => /Bo is in/.test(t)) && !hl2.some((t) => /could not connect/.test(t)), 'the host never says "could not connect" for that friend: ' + hl2.join(' | '));
  await leave(G);

  // ---------------------------------------------------------------- 5. the game server never answers: the right message
  await tune(G, { openFor: 1500, serverFor: 4000, retryGap: 300, joinFor: 30000 });
  await G.evaluate(() => {
    window.RealWS = window.WebSocket;
    window.WebSocket = class { constructor(url) { this.url = url; this.readyState = 0; } send() {} close() { this.readyState = 3; } };
  });
  await G.evaluate(() => { window.peers = []; });
  const t5 = Date.now();
  await startJoin(G, code2, 'Bo');
  await waitFor(G, () => /Could not|No class/.test(document.getElementById('mp-status').innerText), 20000);
  const g5 = await log(G), dt5 = (Date.now() - t5) / 1000;
  pass(/Could not reach the game server/.test(await status(G)) && !g5.some((t) => /Connecting to the class/.test(t)), `the game server never answers: "Could not reach the game server" after ${dt5.toFixed(1)} s, no try on a half-open Peer (${g5.join(' | ')})`);
  pass(await G.evaluate(() => window.peers.length >= 2 && window.peers.every((p) => p.destroyed)), 'every Peer that never reached the server was thrown away (' + await G.evaluate(() => window.peers.length) + ')');
  await G.evaluate(() => { window.WebSocket = window.RealWS; });

  // ---------------------------------------------------------------- 6. a friend in a hidden tab (computer): joining still ends
  await tune(G, { joinFor: 60000, missingFor: 60000, tryFor: 8000, retryGap: 400, joinWall: 5000, openFor: 15000, serverFor: 20000 });
  await setHidden(G, true);
  const t6 = Date.now();
  await startJoin(G, 'NOPE7', 'Bo');
  const ended = await waitFor(G, () => /No class|Could not/.test(document.getElementById('mp-status').innerText), 20000);
  pass(ended && /No class with that code/.test(await status(G)), `tab hidden the whole time: "No class with that code" after ${((Date.now() - t6) / 1000).toFixed(1)} s (a 5 s clock limit here, 5 min in the game)`);
  await setHidden(G, false);

  // ---------------------------------------------------------------- 7. the host's time away is on the wall clock
  await tune(H, { refreshAfter: 10000, awayLine: 4000 });
  await H.waitForTimeout(3000);
  await H.evaluate(() => { window.statusLog = []; window.sock0 = game.mp.net.peer.socket._socket; });
  await setHidden(H, true);
  // the phone sleeps for a minute: Date.now moves on, performance.now hardly does
  await H.evaluate(() => { window.realNow = Date.now; const t = Date.now(); Date.now = () => window.realNow() + 60000; window.sleptAt = t; });
  await setHidden(H, false);
  await H.evaluate(() => { Date.now = window.realNow; });
  await H.waitForTimeout(800);
  const lobby = await H.evaluate(() => game.lobbyLog || []);
  pass(lobby.some((e) => e.kind === 'away') && (await log(H)).some((t) => /Welcome back/.test(t)), 'a minute away on the clock: "Welcome back…" and Mr. Madi\'s line');
  pass(await waitFor(H, () => game.mp.net.peer.socket._socket !== window.sock0 && !game.mp.net.peer.disconnected, 6000), 'and the link to the game server was renewed (same code)');

  // ---------------------------------------------------------------- 8. the class code is taken by another browser
  // (a) while the host's link was down
  const takeCode = async (p) => p.evaluate(async () => {
    const net = game.mp.net, o = net.peer.options, id = net.peer.id || net.peer._lastServerId;
    window.takenErrs = 0;
    net.peer.on('error', (e) => { if (e.type === 'unavailable-id') window.takenErrs++; });
    return { id, host: o.host, port: o.port, path: o.path };
  });
  const thief = (p, where) => p.evaluate(async (w) => {
    // another browser registers the same class code (it has a different secret token)
    for (let i = 0; i < 20; i++) {
      const t = new window.Peer(w.id, { host: w.host, port: w.port, path: w.path, secure: false, token: 'thief' + i, debug: 0 });
      const got = await new Promise((res) => { t.on('open', () => res(true)); t.on('error', () => res(false)); });
      if (got) { window.thiefPeer = t; return true; }
      t.destroy();
      await new Promise((r) => setTimeout(r, 100));
    }
    return false;
  }, where);
  await H.click('#btn-mp-leave');
  await hostClass(H, 'Alex');
  const w1 = await takeCode(H);
  await H.evaluate(() => { window.statusLog = []; window.peers = []; game.mp.net.peer.disconnect(); });
  pass(await thief(H, w1), 'another browser takes the code while the host\'s link is down');
  const told1 = await waitFor(H, () => (window.statusLog || []).some((t) => /class code was lost/.test(t)), 25000);
  const errs1 = await H.evaluate(() => window.takenErrs);
  pass(told1, `the host is told once: "Your class code was lost…" (after ${errs1} "taken" answers)`);
  await H.waitForTimeout(9000);
  const after1 = await H.evaluate(() => ({ errs: window.takenErrs, timer: !!game.mp.net.healTimer, taken: game.mp.net.taken, n: window.statusLog.filter((t) => /class code was lost/.test(t)).length }));
  pass(after1.errs === errs1 && !after1.timer && after1.taken && after1.n === 1, 'then it stops asking (no more tries 9 s later, the message only once) ' + JSON.stringify(after1));
  await setHidden(H, true); await setHidden(H, false);
  await H.waitForTimeout(300);
  pass(/class code was lost/.test(await status(H)), 'back from another app: still "Your class code was lost" (not "your class is still open")');
  await H.evaluate(() => window.thiefPeer.destroy());

  // (b) while the host's Peer was dead (it opens the same code again)
  await H.click('#btn-mp-leave');
  await hostClass(H, 'Alex');
  const w2 = await takeCode(H);
  await H.evaluate(() => { window.statusLog = []; window.peers = []; game.mp.net.peer.destroy(); });
  pass(await thief(H, w2), 'another browser takes the code after the host\'s Peer died');
  const told2 = await waitFor(H, () => (window.statusLog || []).some((t) => /class code was lost/.test(t)), 30000);
  const gamePeers = () => H.evaluate(() => window.peers.filter((p) => !/^thief/.test(p.options.token)).length);
  const made = await gamePeers();
  pass(told2, `the host is told: "Your class code was lost…" (${made} tries to open it again)`);
  await H.waitForTimeout(9000);
  pass(await gamePeers() === made && await H.evaluate(() => !game.mp.net.healTimer && window.statusLog.filter((t) => /class code was lost/.test(t)).length === 1), 'and no new Peers after that: the endless loop is gone');
  await H.evaluate(() => window.thiefPeer.destroy());

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
