// Two players: phones, showing each other videos, the loud crash, getting caught watching
const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    return page;
  };
  const check = async (page, name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  const waitFor = (page, expr, ms = 30000, arg) => page.waitForFunction(expr, arg, { timeout: ms }).then(() => true, () => false);
  const H = await mk('host'), G = await mk('guest');
  await H.goto(BASE);
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 120000);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  await G.goto(BASE + '&join=' + code);
  await waitFor(G, () => window.game && !document.getElementById('mp').classList.contains('hidden'), 120000);
  await G.fill('#mp-name', 'Bo'); await G.click('#btn-join');
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 20000);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 20000);
  for (const P of [H, G]) await P.evaluate(() => { game.post.render = () => {}; });
  // keep him from seeing anybody for the show tests
  await H.evaluate(() => { const o = game.updateWatching.bind(game); game.updateWatching = function () { o(); if (game.blindTest) for (const p of game.players) { p.watching = false; p.lookDot = -1; } }; game.blindTest = true; });
  await H.waitForTimeout(2000);
  // --- guest plays the phone game and crashes: the host hears it, he gets angry
  await G.evaluate(() => { game.input.keys.phone = true; });
  await G.waitForTimeout(700);
  await check(G, 'guest phone is up in the game app', `game.phone.raise > 0.6 && game.phone.mode === 'game'`);
  const a0 = await H.evaluate(() => game.anger);
  await G.evaluate(() => { game.input.pressed.tap = true; });
  await waitFor(G, () => game.phone.game.state === 'dead', 15000);
  await check(G, 'guest crashed in PAPER PLANE', `game.phone.game.state === 'dead'`);
  await waitFor(H, () => game.stats.fails > 0, 5000);
  await check(H, 'host got the crash: anger up, fail counted', `game.stats.fails === 1 && game.anger > ${a0} + 10 && game.players.find(p => p.name === 'Bo').failT > 0`);
  // --- guest opens memes and shows the host a video
  await G.evaluate(() => { game.input.pressed.ask = true; });
  await G.waitForTimeout(400);
  await check(G, 'guest switched to the meme app', `game.phone.mode === 'memes' && typeof game.phone.feed.key === 'number'`);
  await waitFor(H, () => { const p = game.players.find((x) => x.name === 'Bo'); return p && p.in.pv; }, 5000);
  await check(H, 'host knows the guest is watching a video (louder)', `(() => { const p = game.players.find((x) => x.name === 'Bo'); return p.in.pv && p.vid && p.selfNoise >= 0.8; })()`);
  // aim at the host and press R (show)
  await G.evaluate(() => { const h = game.players.find((p) => p.id === 'host'); const d = game.headOf(h).sub(game.camPos); game.yaw = Math.atan2(-d.x, -d.z); game.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); });
  await G.waitForTimeout(300);
  await check(G, 'guest prompt says it can show the host', `/show Alex/.test(document.getElementById('prompt').innerText)`);
  await G.evaluate(() => { game.input.pressed.echo = true; });
  const showing = await waitFor(H, () => game.shows.length === 1 && game.shows[0].to.local, 5000);
  (showing ? ok : bad).push('host gets a show from the guest');
  // host looks at the phone until it is done
  const done = await waitFor(H, () => {
    const sh = game.shows[0];
    if (sh && sh.held) { const d = sh.held.group.getWorldPosition(game.camPos.clone()).sub(game.camPos); game.yaw = Math.atan2(-d.x, -d.z); game.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
    return game.stats.videos >= 1;
  }, 30000);
  (done ? ok : bad).push('host watched the guest\'s video to the end');
  await G.evaluate(() => { game.input.keys.phone = false; });
  await H.evaluate(() => { game.yaw = 0; game.pitch = 0; });
  await H.waitForTimeout(1500);
  // --- host shows the guest a video
  await H.evaluate(() => { game.input.keys.phone = true; });
  await H.waitForTimeout(500);
  await H.evaluate(() => { game.input.pressed.ask = true; });
  await H.waitForTimeout(300);
  await H.evaluate(() => { const b = game.players.find((p) => p.name === 'Bo'); const d = game.headOf(b).sub(game.camPos); game.yaw = Math.atan2(-d.x, -d.z); game.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); });
  await H.waitForTimeout(300);
  await H.evaluate(() => { game.input.pressed.echo = true; });
  const gshow = await waitFor(G, () => game.mp.helds && game.mp.helds.size === 1, 6000);
  (gshow ? ok : bad).push('guest sees the host holding a phone out');
  const gdone = await waitFor(G, () => {
    const h = [...game.mp.helds.values()][0];
    if (h) { const d = h.group.getWorldPosition(game.camPos.clone()).sub(game.camPos); game.yaw = Math.atan2(-d.x, -d.z); game.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); }
    return !!game.mp.helds && game.mp.helds.size === 0 && game.mp.watchedOnce;
  }, 40000);
  const hv = await H.evaluate(() => game.stats.videos);
  (hv >= 2 ? ok : bad).push('guest watched the host\'s video to the end (videos=' + hv + ')');
  await check(G, 'guest zoom ended', `!game.vidZoom`);
  await H.evaluate(() => { game.input.keys.phone = false; });
  // --- he catches the guest watching a video
  await H.evaluate(() => { game.blindTest = false; game.anger = 0; });
  await G.evaluate(() => { game.yaw = 0; game.pitch = 0; game.input.keys.phone = true; });
  await G.waitForTimeout(500);
  await G.evaluate(() => { if (game.phone.mode !== 'memes') game.input.pressed.ask = true; });
  await H.evaluate(() => { const T = game.teacher, b = game.players.find((p) => p.name === 'Bo'); game.interrupt((function* () { while (true) { T.lookAt(b.camPos, 20); T.facePoint(b.camPos, 20); yield; } })()); });
  const busted = await waitFor(H, () => game.strikes >= 1, 15000);
  (busted ? ok : bad).push('he caught the guest watching a video');
  const scared = await waitFor(G, () => game.phone.mode === 'face', 20000);
  (scared ? ok : bad).push('guest got the phone scare (his face on the phone)');
  await G.evaluate(() => { game.input.keys.phone = false; });
  console.log('OK ' + ok.length + '\n  ' + ok.join('\n  '));
  console.log('BAD ' + bad.length + '\n  ' + bad.join('\n  '));
  console.log(logs.join('\n') || 'no errors');
  await browser.close();
})();
