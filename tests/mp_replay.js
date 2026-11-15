// Phase 6 online (host + friends over a local PeerServer): the host starts the DAILY class for everyone;
// a friend finds one of Mr. Hale's notes in their own browser (looking at the closet, the phone game);
// a friend throws a prank they unlocked (the host simulates it, everybody sees it); a friend joins late;
// at the end every player gets their own report card, daily score and unlocks; a friend leaves; and the
// glasses ending (CLASS CANCELLED) plays for everyone.
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const mk = async (tag, profile) => {
    const ctx = await browser.newContext({ viewport: { width: 480, height: 270 } });
    const page = await ctx.newPage();
    page.on('crash', () => logs.push(`${tag} PAGEERROR: the page crashed`));
    page.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    if (profile) await page.addInitScript((p) => { if (!localStorage.getItem('madiclass.replay')) localStorage.setItem('madiclass.replay', JSON.stringify(p)); }, profile);
    return page;
  };
  const waitFor = (page, expr, ms = 30000, arg) => page.waitForFunction(expr, arg, { timeout: ms }).then(() => true, () => false);
  const prof = (page) => page.evaluate(() => ({ notes: {}, unlocks: {}, daily: {}, totals: {}, endings: {}, ...JSON.parse(localStorage.getItem('madiclass.replay') || '{}') }));
  // the host's game runs slower than the clock on a busy machine: step it by hand (2.5 game seconds)
  const hostSteps = (n = 50) => H.evaluate((n) => { for (let i = 0; i < n && game.state === 'playing'; i++) game.playTick(0.05); }, n);
  const lookAtCloset = async (page, name) => {
    await page.evaluate(() => { const g = game, d = g.closetPos.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); });
    await waitFor(H, (name) => { const p = game.players.find((x) => x.name === name); return p && p.yaw < -1.5; }, 10000, name);
    await hostSteps(50);
  };
  const today = new Date().toISOString().slice(0, 10);
  const join = async (page, code, name) => {
    // (a busy machine: a page that dies or reloads while it loads is opened once more)
    // (the name goes in through the page itself: on the third page of this test Playwright's fill()
    // sometimes never finds the field, although it is there and visible; the JOIN button runs the same code)
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(BASE + '&join=' + code);
        await page.waitForFunction(() => window.game && !document.getElementById('mp').classList.contains('hidden'), null, { timeout: 240000 });
        await page.evaluate((n) => { const f = document.getElementById('mp-name'); f.value = n; f.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('btn-join').click(); }, name);
        return;
      } catch (e) {
        const seen = await page.evaluate(() => window.game ? { state: game.state, screens: [...document.querySelectorAll('body > *')].filter((x) => getComputedStyle(x).display !== 'none' && !x.classList.contains('hidden')).map((x) => x.id || x.className).join(',') } : 'no game').catch((x) => String(x).slice(0, 80));
        console.log(`  (${name}: could not open the join screen, try ${i + 1}: ${String(e.message).split('\n').slice(0, 4).join(' | ').slice(0, 400)} at ${page.url()} ${JSON.stringify(seen)})`);
      }
    }
    throw new Error(name + ' could not open the join screen');
  };
  const H = await mk('host'), G = await mk('guest', { v: 1, unlocks: { spit: 'x' }, notes: {}, daily: {}, totals: {}, endings: {}, best: {}, theme: 'classic', seen: {} });
  await H.goto(BASE);
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 180000);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  await join(G, code, 'Bo');
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 30000);

  // ---- the host makes it the daily class
  await H.click('#mp-daily'); await H.waitForTimeout(150);
  let r = await H.evaluate(() => ({ go: document.getElementById('btn-mp-go').innerText, on: document.getElementById('mp-daily').classList.contains('on'), easy: document.getElementById('mp-easy').classList.contains('on') || document.getElementById('mp-hard').classList.contains('on') }));
  pass(r.go === 'START DAILY CLASS' && r.on && !r.easy, 'host lobby: DAILY turns START into START DAILY CLASS (Easy / Hard no longer picked)');
  await H.click('#mp-easy'); await H.waitForTimeout(100);
  pass(await H.evaluate(() => document.getElementById('btn-mp-go').innerText === 'START FREE CLASS' && !document.getElementById('mp-daily').classList.contains('on')), 'picking EASY again: a normal Free Class');
  await H.click('#mp-daily'); await H.waitForTimeout(100);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 20000);
  r = await H.evaluate(async () => { const R = await import('/src/replay.js'); const g = game; return { daily: g.daily, day: R.dailyInfo(), seed: g.setup && g.setup.seed, hard: g.hard, max: g.maxStrikes, n: g.players.length }; });
  pass(r.daily && r.daily.date === today && r.seed === Number(today.replace(/-/g, '')) && r.hard === (r.day.difficulty === 'hard') && r.max === (r.hard ? 1 : 4), `host: the daily class for everyone (seed ${r.seed}, ${r.day.difficulty}, ${r.max} strikes for 2 players)`);
  pass(await waitFor(G, () => /DAILY CLASS/.test(document.getElementById('card-title').innerText), 8000), 'guest: sees the DAILY CLASS title card');
  // nothing random on the host: he stands at the board with his back to the class and sees nobody
  await H.evaluate(() => {
    const g = game, T = g.teacher;
    g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.extrasAuto = false; // (Phase 7's note chain, ghosts and decoy hints: tests/mp_extras.js) g.startMeme = () => false;
    const uw = g.updateWatching.bind(g); g.updateWatching = function () { uw(); for (const p of g.players) { p.watching = false; p.lookDot = -1; } };
    window.atBoard = () => { g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.prankBusy = false; g.anger = 0; for (const p of g.players) { p.prankStreak = 0; p.lastPrankHit = -99; } };
    atBoard();
  });
  await H.waitForTimeout(1500);

  // ---- a friend finds a note: looking at the supply closet from their own seat
  await lookAtCloset(G, 'Bo');
  const found = await waitFor(G, () => !!JSON.parse(localStorage.getItem('madiclass.replay')).notes[1], 12000);
  pass(found && await G.evaluate(() => /Mr\. Hale's notes/.test(document.getElementById('hint').innerText)), 'guest: looking at the closet finds note 1 in THEIR browser (with the hint)');
  r = await H.evaluate(() => { const g = game, bo = g.players.find((x) => x.name === 'Bo'); return { log: g.track.log.filter((e) => e.type === 'haleNote').map((e) => e.who === bo.id), stat: g.track.of(bo).notesFound, mine: g.track.of(g.me).notesFound }; });
  pass(r.log.length === 1 && r.log[0] && r.stat === 1 && r.mine === 0 && !(await prof(H)).notes[1], 'host: counted for the guest only (the host did not look, and has no note)');
  await G.screenshot({ path: shot('mp_replay_guest_closet.png') });
  await G.evaluate(() => { game.yaw = 0; game.pitch = 0; game.phone.onPoint(5); });
  pass(await waitFor(H, () => { const g = game, bo = g.players.find((x) => x.name === 'Bo'); return g.track.of(bo).notesFound === 2; }, 6000) && !!(await prof(G)).notes[6], 'guest: 5 points in PAPER PLANE on their own phone finds note 6; the host counts it');

  // ---- a friend throws what THEY unlocked: a spitball
  await G.evaluate(() => { game.me.foldT = 0; game.yaw = 0; game.pitch = 0.3; game.input.keys.prank = true; });
  await G.waitForTimeout(500);
  await G.keyboard.press('x'); await G.waitForTimeout(200); await G.keyboard.press('x'); await G.waitForTimeout(300);
  r = await G.evaluate(() => ({ kind: game.me.aim && game.me.aim.kind, name: document.getElementById('aim-kind').textContent, kinds: game.prankKinds(game.me).join() }));
  pass(r.kind === 'spit' && /SPITBALL/.test(r.name) && r.kinds === 'ball,plane,spit', 'guest: X picks the spitball they unlocked (' + r.kinds + ')');
  pass(await H.evaluate(() => game.prankKinds(game.me).join() === 'ball,plane'), 'host: has not unlocked it (their own selector has ball and plane)');
  await G.evaluate(() => { game.input.keys.prank = false; });
  pass(await waitFor(H, () => game.track.log.some((e) => e.type === 'throw' && e.kind === 'spit' && e.who !== 'host'), 6000), 'host: got the guest\'s throw as a spitball and threw it');
  pass(await waitFor(G, () => [...game.netPapers.values()].some((n) => n.kind === 'spit'), 4000), 'guest: sees their spitball (from the snapshots)');
  // one right on his back, thrown by the guest: he blames the roof, on every screen
  await H.evaluate(() => { const g = game, T = g.teacher, bo = g.players.find((x) => x.name === 'Bo'), V = g.camPos.constructor; atBoard(); const pt = new V(T.pos.x, 1.25, T.pos.z), from = pt.clone().add(new V(0.1, 0.1, 1.2)); g.spawnPaper(bo, null, 'spit', from, pt.clone().sub(from).normalize().multiplyScalar(9), 0); });
  pass(await waitFor(G, () => /roof/.test(document.getElementById('subtitle').innerText), 9000), 'guest: hears him: "The roof... is... leaking."');
  await H.waitForTimeout(2500);
  // a water balloon from the host bursts on the guest: "Alex soaked you", on the guest's screen only
  await H.evaluate(() => { const g = game, bo = g.players.find((x) => x.name === 'Bo'), V = g.camPos.constructor; atBoard(); const pt = g.headOf(bo, new V()); g.spawnPaper(g.me, null, 'bomb', pt.clone().add(new V(0.2, 0.6, 0)), new V(-0.9, -3, 0), 0); });
  pass(await waitFor(G, () => /Alex<\/b> soaked you|Alex soaked you/.test(document.getElementById('hint').innerHTML), 9000), 'guest: "Alex soaked you with a water balloon!"');
  pass(await H.evaluate(() => !/soaked you/.test(document.getElementById('hint').innerText) && game.track.log.some((e) => e.type === 'hit' && e.kind === 'bomb')), 'host: no such hint on their own screen; the hit is in the class log');
  await H.waitForTimeout(1500);

  // ---- a friend joins late
  const L = await mk('late');
  await join(L, code, 'Cy');
  await waitFor(L, () => game.state === 'playing' && game.mp.snap, 30000);
  pass(await H.evaluate(() => game.players.length === 3), 'a third player joins in the middle of the class');
  await lookAtCloset(L, 'Cy');
  pass(await waitFor(L, () => { const p = JSON.parse(localStorage.getItem('madiclass.replay') || '{}'); return !!(p.notes && p.notes[1]); }, 12000), 'the late friend can find notes too');

  // ---- the bell: everybody gets their own report card
  await H.evaluate(() => {
    const g = game, bo = g.players.find((x) => x.name === 'Bo');
    atBoard();
    for (let i = 0; i < 5; i++) g.note(bo, 'whispers');
    g.note(bo, 'echoes', 3); g.note(g.me, 'questions', 2);
    g.t = 301; g.mischief = 900;
  });
  await waitFor(H, () => game.state === 'end', 60000);
  await waitFor(G, () => game.state === 'end' && !!document.getElementById('rc'), 20000);
  await waitFor(L, () => game.state === 'end' && !!document.getElementById('rc'), 20000);
  const cardOf = (page) => page.evaluate(() => { const c = game.lastCard; return c && { name: c.name, grade: c.grade, subs: Object.fromEntries(c.subjects.map((s) => [s.name, s.grade])), daily: c.daily && { date: c.daily.date, score: c.daily.score, seed: c.daily.seed }, text: document.getElementById('end-report').innerText, w: c.stats.whispers, q: c.stats.questions, notes: c.stats.notesFound, hitHim: c.stats.hitHim, end: document.getElementById('end-text').innerText }; });
  const ch = await cardOf(H), cg = await cardOf(G), cl = await cardOf(L);
  // (notes: the closet, the phone game, and the bell that everybody stayed for)
  pass(cg && cg.name === 'Bo' && cg.w === 5 && cg.notes === 3 && cg.hitHim >= 1 && /Whispered 5 times/.test(cg.text) && /Room 13 · Bo/.test(cg.text), 'guest: their OWN report card (Bo: 5 whispers, 3 notes, a hit on him) ' + JSON.stringify(cg && [cg.name, cg.grade, cg.w, cg.notes, cg.hitHim]));
  pass(ch && ch.name === 'Alex' && ch.q === 2 && !ch.w && ch.subs.Science !== 'F' && ch.subs.Whispering === 'F', 'host: their own card (Alex: 2 questions, no whispers) ' + JSON.stringify(ch && [ch.name, ch.grade]));
  pass(cl && cl.name === 'Cy' && cl.notes === 2 && !cl.w && cl.subs.Attendance === 'A', 'the late friend gets a card too (Cy: the closet and the bell) ' + JSON.stringify(cl && [cl.name, cl.grade, cl.notes]));
  pass(cg.grade !== ch.grade || cg.text !== ch.text, 'the cards differ: each player is graded on what they did');
  pass(/Waiting for the host/.test(cg.end), 'guest: the card is its own block next to "Waiting for the host…"');
  pass(cg.daily && cg.daily.date === today && cg.daily.seed === Number(today.replace(/-/g, '')) && cg.daily.score > 250 && /DAILY CLASS/.test(cg.text) && /NEW BEST/.test(cg.text), `guest: a daily score on their card (${cg.daily && cg.daily.score})`);
  const pg = await prof(G), ph = await prof(H);
  pass(pg.daily[today] && pg.daily[today].score === cg.daily.score && ph.daily[today] && ph.daily[today].score === ch.daily.score && cg.daily.score !== ch.daily.score, `the best of the day is kept in each browser (guest ${cg.daily.score}, host ${ch.daily.score})`);
  pass(!!pg.unlocks.gold && /UNLOCKED: GOLD STAR/.test(cg.text) && pg.totals.classes === 1, 'guest: unlocks are earned from their own card, in their own browser');
  await G.screenshot({ path: shot('mp_replay_guest_end.png') });
  await H.screenshot({ path: shot('mp_replay_host_end.png') });

  // ---- a friend leaves; the host tries the daily class again; the glasses break for everyone
  await G.close();
  await waitFor(H, () => game.players.length === 2, 30000);
  pass(await H.evaluate(() => document.getElementById('btn-again').innerText === 'TRY AGAIN (DAILY)'), 'host: TRY AGAIN (DAILY) on the end screen');
  await H.click('#btn-again');
  await waitFor(L, () => game.state === 'playing' && game.mp.snap && game.t < 30, 20000);
  r = await H.evaluate(() => ({ daily: !!game.daily, n: game.players.length, report: document.getElementById('end-report').innerText }));
  pass(r.daily && r.n === 2 && r.report === '' && await L.evaluate(() => document.getElementById('end-report').innerText === ''), 'the daily class again, for the two who are left (the old cards are gone)');
  await H.evaluate(() => { const g = game; for (let i = 0; i < 260 && g.state === 'playing'; i++) g.playTick(0.05); atBoard(); });
  await H.waitForTimeout(600);
  for (let i = 0; i < 3; i++) {
    await H.evaluate((i) => {
      const g = game, T = g.teacher, V = g.camPos.constructor, who = g.players[i % g.players.length];
      const head = T.headWorld(new V()), from = head.clone().add(new V(0, 0.05, 1.0));
      g.spawnPaper(who, null, 'ball', from, head.clone().sub(from).normalize().multiplyScalar(9), 0);
    }, i);
    await waitFor(H, (n) => game.glassHits > n, 6000, i);
    if (i < 2) { await waitFor(H, () => !game.prankBusy && game.teacher.glasses.parent === game.teacher.head, 15000); await H.evaluate(() => atBoard()); await H.waitForTimeout(300); }
  }
  pass(await H.evaluate(() => game.cutscene && game.ending && game.glassHits === 3), 'three papers on his head, from two players: the glasses ending starts');
  // (the host's game is slower than the clock here: step it to his line, then look at the friend's screen)
  await H.evaluate(() => { const g = game; let said = false; const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { if (id === 't_broken') said = true; return say0(id, v); }; let n = 0; while (!said && g.state === 'playing' && n++ < 600) g.playTick(0.05); g.teacherSay = say0; });
  pass(await waitFor(L, () => /broken/.test(document.getElementById('subtitle').innerText), 15000), 'guest: sees and hears it ("They are... broken.")');
  await H.evaluate(() => { const g = game; let n = 0; while (g.state === 'playing' && n++ < 3000) g.playTick(0.05); });
  await waitFor(L, () => game.state === 'end' && !!document.getElementById('rc'), 30000);
  r = await L.evaluate(() => ({ title: document.getElementById('end-title').innerText, kind: game.lastCard.kind, ends: JSON.parse(localStorage.getItem('madiclass.replay')).endings, off: game.lastCard.stats.glassesOff }));
  pass(r.title === 'CLASS CANCELLED' && r.kind === 'glasses' && r.ends.glasses === 1 && r.off >= 1, 'guest: CLASS CANCELLED, their card, the ending kept in their browser ' + JSON.stringify(r));
  pass(await H.evaluate(() => document.getElementById('end-title').innerText === 'CLASS CANCELLED' && game.lastCard.kind === 'glasses'), 'host: the same ending');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
