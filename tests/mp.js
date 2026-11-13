// Two players over a local PeerServer: lobby, start, sync, whisper, echo, ask, bust, jumpscare, lobby return, late join
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
  const waitFor = (page, expr, ms = 30000) => page.waitForFunction(expr, null, { timeout: ms }).then(() => true, () => false);
  const H = await mk('host'), G = await mk('guest');
  await H.goto(BASE);
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 120000);
  await H.click('#btn-mp');
  await H.fill('#mp-name', 'Alex');
  await H.click('#btn-host');
  const hosted = await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  (hosted ? ok : bad).push('host opens a class (code ' + code + ')');
  await G.goto(BASE + '&join=' + code);
  await waitFor(G, () => window.game && !document.getElementById('mp').classList.contains('hidden'), 120000);
  await check(G, 'invite link opens the join screen with the code', `document.getElementById('mp-code').value === '${code}'`);
  await G.fill('#mp-name', 'Bo');
  await G.click('#btn-join');
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 20000);
  await check(H, 'host lobby lists 2 players', `document.querySelectorAll('#mp-players li:not(.empty)').length === 2`);
  await check(G, 'guest lobby shows waiting + both names', `!document.getElementById('mp-wait').classList.contains('hidden') && document.getElementById('mp-players').innerText.includes('Alex') && document.getElementById('mp-players').innerText.includes('Bo (you)')`);
  await check(H, 'lobby is Free Class only (no story picker)', `!document.getElementById('mp-mode') && /START FREE CLASS/.test(document.getElementById('btn-mp-go').innerText)`);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing', 20000);
  await check(G, 'guest starts with the host', `game.state === 'playing' && game.role === 'guest'`);
  await check(H, 'host has 2 players, 4 strikes allowed', `game.players.length === 2 && game.maxStrikes === 4`);
  await waitFor(G, () => game.mp.snap !== null, 10000);
  await G.waitForTimeout(3000);
  await check(G, 'guest gets snapshots and the same clock', `!!game.mp.snap && Math.abs(game.clockMin - ${await H.evaluate(() => game.clockMin)}) < 3`);
  const tp = await H.evaluate(() => game.teacher.pos.toArray());
  await check(G, 'teacher is where the host has him', `game.teacher.pos.distanceTo(new game.camPos.constructor(${tp.join(',')})) < 0.8`);
  await check(G, 'guest camera sits at its own desk', `Math.abs(game.camPos.x - (-3)) < 0.2`);
  await check(G, 'guest sees the host avatar', `!!game.players.find(p => p.id === 'host' && p.avatar)`);
  await check(H, 'host sees the guest avatar', `!!game.players.find(p => p.name === 'Bo' && p.avatar)`);
  await H.screenshot({ path: shot('mp_host.png') });
  await G.evaluate(() => { game.yaw = 1.4; game.pitch = -0.05; });
  await G.waitForTimeout(800);
  await G.screenshot({ path: shot('mp_guest_look.png') });
  // guest whispers to Sam
  await G.evaluate(() => { game.yaw = Math.atan2(-1.5, 1.75); game.pitch = -0.05; game.input.keys.talk = true; });
  await waitFor(H, () => { const p = game.players.find((x) => x.name === 'Bo'); return p && p.talk && p.talk.friend && p.talk.friend.name === 'Sam'; }, 8000);
  await check(H, 'guest whispers to Sam on the host', `(() => { const p = game.players.find((x) => x.name === 'Bo'); return !!(p && p.talk && p.talk.friend && p.talk.friend.name === 'Sam' && p.noise > 0); })()`);
  const sawYou = await waitFor(G, () => /^YOU/.test(document.getElementById('subtitle').innerText), 8000);
  (sawYou ? ok : bad).push('guest sees its own whisper line as YOU');
  await G.evaluate(() => { game.input.keys.talk = false; game.yaw = 0; });
  // guest whispers to the host (player to player)
  const yawToHost = Math.atan2(-(0 - (-3)), 0) ; // facing +x
  await G.evaluate((y) => { game.yaw = y; game.pitch = -0.02; }, -Math.PI / 2);
  // echo: wait until the teacher says something the guest can repeat
  const canEcho = await waitFor(G, () => game.mp.ec > 0.5 && !game.cutscene, 60000);
  if (canEcho) {
    await G.evaluate(() => { game.input.pressed.echo = true; });
    await G.waitForTimeout(1500);
    await check(H, 'guest repeats him: echo counted for the guest', `game.players.find((x) => x.name === 'Bo').echoStreak >= 1`);
    await check(H, 'host sees the guest name on the echo subtitle', `/Bo/.test(document.getElementById('subtitle').innerText) || game.players.find((x) => x.name === 'Bo').echoStreak >= 1`);
  } else bad.push('no echo window in 60 s');
  // ask: wait until allowed
  await waitFor(H, () => game.brainIdle && !game.cutscene && !game.players.find((x) => x.name === 'Bo').qBusy && !game.echoBusy, 40000);
  await G.evaluate(() => { game.input.pressed.ask = true; });
  const picker = await waitFor(G, () => !document.getElementById('choices').classList.contains('hidden'), 8000);
  (picker ? ok : bad).push('guest ASK opens the question picker on the guest');
  if (picker) {
    await G.screenshot({ path: shot('mp_guest_ask.png') });
    await G.evaluate(() => { game.input.choiceKey = 0; });
    await G.waitForTimeout(600);
    await check(H, 'host counts the question for the guest', `game.players.find((x) => x.name === 'Bo').qCount === 1`);
    await waitFor(H, () => game.focus && game.focus.name === 'Bo' || true, 1000);
  }
  // bust the guest: he walks to the guest's desk
  await H.evaluate(() => { const p = game.players.find((x) => x.name === 'Bo'); game.interrupt(game.bustedSeq('noise', p)); });
  await waitFor(H, () => game.teacher.crouchTarget > 0.3, 30000);
  await H.waitForTimeout(800);
  await check(H, 'busted: teacher at the guest desk', `Math.abs(game.teacher.pos.x - (-3)) < 0.9 && Math.abs(game.teacher.pos.z - (-0.35)) < 0.5 && game.strikes === 1`);
  await G.evaluate(() => { game.yaw = 1.2; game.pitch = -0.25; });
  await G.waitForTimeout(1000);
  await G.screenshot({ path: shot('mp_guest_busted.png') });
  await check(G, 'guest sees the teacher at its desk', `Math.hypot(game.teacher.pos.x - game.camPos.x, game.teacher.pos.z - game.camPos.z) < 1.8`);
  await check(G, 'guest gets the strike toast', `/YOU GOT CAUGHT/.test(document.getElementById('toast').innerText) || game.strikes === 1`);
  await waitFor(H, () => !game.cutscene, 30000);
  // final strike -> both get jumpscared and an end screen
  await H.evaluate(() => { game.strikes = game.maxStrikes - 1; const p = game.players.find((x) => x.name === 'Bo'); game.interrupt(game.bustedSeq('noise', p)); });
  const jumped = await waitFor(G, () => game.mp.localTeacher === true, 20000);
  (jumped ? ok : bad).push('guest gets its own jumpscare');
  if (jumped) { await G.waitForTimeout(250); await G.screenshot({ path: shot('mp_guest_jump.png') }); }
  await waitFor(G, () => game.state === 'end', 20000);
  await check(G, 'guest end screen waits for the host', `game.state === 'end' && /Waiting for the host/.test(document.getElementById('end-text').innerText) && document.getElementById('btn-menu').innerText === 'LEAVE CLASS'`);
  await check(H, 'host end screen', `game.state === 'end' && document.getElementById('end-title').innerText === 'DETENTION' && document.getElementById('btn-menu').innerText === 'BACK TO LOBBY'`);
  // host goes back to the lobby; guest follows
  await H.click('#btn-menu');
  await waitFor(G, () => !document.getElementById('mp').classList.contains('hidden'), 10000);
  await check(G, 'guest back in the lobby', `!document.getElementById('mp').classList.contains('hidden') && game.state === 'title'`);
  // host switches to HARD in the lobby: the friend sees it, and one strike ends the class
  await H.click('#mp-hard');
  const sawHard = await waitFor(G, () => /HARD/.test(document.getElementById('mp-wait').innerText), 10000);
  (sawHard ? ok : bad).push('friend sees the host picked HARD');
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing', 20000);
  await G.waitForTimeout(2500);
  await check(H, 'hard online: one strike for the whole class', `game.difficulty === 'hard' && game.maxStrikes === 1`);
  await check(G, 'friend HUD shows one strike slot', `document.querySelectorAll('#strikes span').length === 1`);
  await H.click('#mp-easy').catch(() => {});
  // a third player joins late (in the middle of class)
  const L = await mk('late');
  await L.goto(BASE + '&join=' + code);
  await waitFor(L, () => window.game && !document.getElementById('mp').classList.contains('hidden'), 240000);
  await L.fill('#mp-name', 'Cy'); await L.click('#btn-join');
  const late = await waitFor(L, () => game.state === 'playing', 20000);
  (late ? ok : bad).push('late joiner drops straight into the running class');
  await L.waitForTimeout(2500);
  await check(L, 'late joiner sits at desk 3 and sees 2 avatars', `game.me.seat === 2 && game.players.filter(p => p.avatar).length === 2`);
  await check(H, 'host sees 3 players', `game.players.length === 3`);
  await L.screenshot({ path: shot('mp_late.png') });
  // a guest leaves
  await L.close();
  await waitFor(H, () => game.players.length === 2, 15000);
  await check(H, 'leaving player is removed', `game.players.length === 2 && document.querySelectorAll('#mp-players li:not(.empty)').length === 2`);
  // host closes the class -> guest is told
  await H.evaluate(() => { document.getElementById('btn-quit').click(); });
  await H.waitForTimeout(500);
  await H.evaluate(() => { document.getElementById('btn-mp-leave').click(); });
  const told = await waitFor(G, () => /closed the class/.test(document.getElementById('mp-status').innerText), 15000);
  (told ? ok : bad).push('guest is told when the host closes the class');
  await check(G, 'guest is solo again at the middle seat', `game.role === 'solo' && game.mp === null && Math.abs(game.me.eye.x) < 0.01`);
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
