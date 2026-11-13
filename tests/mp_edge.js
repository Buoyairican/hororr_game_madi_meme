// Connection edge cases
const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, name) => (c ? ok : bad).push(name);
  const pages = [];
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 225 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => logs.push(`${tag} PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console ${m.text().slice(0, 200)}`); });
    pages.push(p);
    return p;
  };
  const waitFor = (page, fn, ms = 30000, arg) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const ready = (p) => waitFor(p, () => window.game && document.getElementById('menu') && !document.getElementById('loading').classList.contains('hidden') === false, 180000);
  const open = async (p, url) => {
    await p.goto(url);
    await waitFor(p, () => window.game && (!document.getElementById('menu').classList.contains('hidden') || !document.getElementById('mp').classList.contains('hidden')), 180000);
    await p.evaluate(() => { game.post.render = () => {}; }); // CPU-only test machine: skip drawing, keep the game running
  };
  const join = async (p, code, name) => {
    await open(p, BASE + '&join=' + code);
    await p.fill('#mp-name', name); await p.click('#btn-join');
    await waitFor(p, () => !!(game.mp && game.mp.myId) || /could not|no class|full/i.test(document.getElementById('mp-status').innerText), 30000);
  };
  const status = (p) => p.evaluate(() => document.getElementById('mp-status').innerText);

  // 1. wrong code
  const X = await mk('X');
  await open(X, BASE);
  await X.click('#btn-mp'); await X.fill('#mp-name', 'Xi'); await X.fill('#mp-code', 'ZZZZZ'); await X.click('#btn-join');
  await waitFor(X, () => document.getElementById('mp-status').innerText.length > 12 && !/Joining/.test(document.getElementById('mp-status').innerText), 30000);
  const s1 = await status(X);
  pass(/no class with that code/i.test(s1), 'wrong code is refused with a clear message: "' + s1.slice(0, 60) + '"');
  pass(await X.evaluate(() => game.mp === null && game.role === 'solo'), 'after a failed join the game is back to solo');
  await X.fill('#mp-code', 'AB'); await X.click('#btn-join');
  pass(/5-letter/.test(await status(X)), 'too-short code is caught before connecting');

  // 2. host + 3 friends, then a 5th is turned away
  const H = await mk('H');
  await open(H, BASE);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  const A = await mk('A'), B = await mk('B'), C = await mk('C');
  await join(A, code, 'Sam'); await join(B, code, 'Sam'); await join(C, code, 'Cy');
  await waitFor(H, () => game.players.length === 4, 20000);
  const names = await H.evaluate(() => game.mp.lobby.map((x) => x.name + '@' + x.seat).join(','));
  pass(names.split(',').length === 4 && new Set(names.split(',').map((x) => x.split('@')[0])).size === 4, 'four players, duplicate names get told apart: ' + names);
  await join(X, code, 'Fifth');
  await waitFor(X, () => /full/i.test(document.getElementById('mp-status').innerText), 15000);
  pass(/full/i.test(await status(X)), '5th player is told the class is full');
  pass(await H.evaluate(() => game.players.length === 4), 'host still has 4 players after turning someone away');

  // 3. start, a friend leaves while he is waiting for their answer (roll call), host keeps going
  await H.click('#btn-mp-go');
  await waitFor(C, () => game.state === 'playing', 20000);
  pass(await A.evaluate(() => game.state === 'playing') && await B.evaluate(() => game.state === 'playing') && await C.evaluate(() => game.state === 'playing'), 'all three friends start with the host');
  // a friend opens the question picker, then closes the tab while it is open
  await H.evaluate(() => { const g = game; for (let i = 0; i < 2000 && !(g.brainIdle && g.allowAsk && !g.cutscene); i++) g.playTick(0.05); });
  await A.evaluate(() => { game.input.pressed.ask = true; });
  const opened = await waitFor(H, () => game.players.some((p) => p.name === 'Sam' && p.choice), 15000);
  pass(opened, 'friend opens the question picker');
  await A.close();
  await waitFor(H, () => game.players.length === 3, 30000);
  pass(await H.evaluate(() => game.players.length === 3 && !game.players.some((p) => p.name === 'Sam')), 'friend closes the tab with the picker open; host drops them');
  await H.evaluate(() => { const g = game; for (let i = 0; i < 600; i++) g.playTick(0.05); });
  pass(await H.evaluate(() => game.state === 'playing'), 'class carries on without them');
  const asked = 'Sam', leaver = A;
  // 4. the friend comes back (rejoins mid-class)
  const R = await mk('R');
  await join(R, code, 'Back');
  const back = await waitFor(R, () => game.state === 'playing', 25000);
  pass(back, 'a friend who left can rejoin the running class');

  // 5. a friend's bad / odd messages don't break the host
  await R.evaluate(() => { const m = game.mp; m.send({ t: 'pick', i: 99 }); m.send({ t: 'pick', i: 'x' }); m.send({ t: 'in', y: 'NaN', p: null }); m.send({ t: 'press', k: 'nuke' }); m.send({ t: 'unknown' }); m.net.conns.get('host').send(null); m.send([1, 2]); });
  await H.waitForTimeout(1500);
  pass(await H.evaluate(() => game.state === 'playing' && game.players.every((p) => isFinite(p.yaw) && isFinite(p.pitch)) && document.getElementById('err').classList.contains('hidden')), 'odd messages from a friend are ignored (no error screen)');

  // 6. the host closes the tab mid-class: friends are told
  const friends = [B, C, R].filter((p) => !p.isClosed());
  await H.close();
  let told = 0;
  for (const p of friends) if (await waitFor(p, () => /closed the class|Lost the connection/.test(document.getElementById('mp-status').innerText), 40000)) told++;
  pass(told === friends.length, `host closes the tab: all ${friends.length} friends are told and sent back (${told})`);
  pass((await Promise.all(friends.map((p) => p.evaluate(() => game.role === 'solo' && game.state === 'title')))).every(Boolean), 'friends are back to a working solo game');
  // and one of them can host a new class right away
  const F = friends[0];
  await F.click('#btn-host');
  pass(await waitFor(F, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000), 'a friend can host a new class right after');
  // solo still works after all that
  await F.click('#btn-mp-leave');
  await F.evaluate(() => document.getElementById('btn-free').click());
  pass(await waitFor(F, () => game.state === 'playing' && game.role === 'solo', 15000), 'solo free class starts fine after multiplayer');
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
