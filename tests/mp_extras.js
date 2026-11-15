// Phase 7 online (host + friend over a local PeerServer): the note that goes round (passed by the host, then
// by the friend, and caught when he looks right at them: he reads it out loud), the ghost kid in the corner
// (floating, the three haunts on every screen, the cooldowns, back to the seat), blaming a friend in "Who
// did it?", the decoy (a question keeps him busy while a friend gets to his desk), the microphone level of
// a friend, and the chaos scoreboard on every end screen.
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    page.on('crash', () => logs.push(`${tag} PAGEERROR: the page crashed`));
    page.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    return page;
  };
  const waitFor = (page, expr, ms = 30000, arg) => page.waitForFunction(expr, arg, { timeout: ms }).then(() => true, () => false);
  // the host's game runs slower than the clock on a busy machine: step it by hand
  const hostSteps = (n = 50) => H.evaluate((n) => { for (let i = 0; i < n && game.state === 'playing'; i++) game.playTick(0.05); }, n);
  // (in small pieces, with the network running in between: a host page blocked for long drops its friends)
  const stepUntil = async (fn, max = 400, arg) => {
    for (let done = 0; done < max; done += 40) {
      const r = await H.evaluate(([src, n, arg]) => { const f = new Function('arg', 'return (' + src + ')(arg)'); let i = 0; while (!f(arg) && i++ < n && game.state === 'playing') game.playTick(0.05); return !!f(arg); }, [String(fn), Math.min(40, max - done), arg]);
      if (r) return true;
      await H.waitForTimeout(60);
    }
    return H.evaluate(([src, arg]) => !!new Function('arg', 'return (' + src + ')(arg)')(arg), [String(fn), arg]);
  };
  const join = async (page, code, name) => {
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(BASE + '&join=' + code);
        await page.waitForFunction(() => window.game && !document.getElementById('mp').classList.contains('hidden'), null, { timeout: 240000 });
        await page.evaluate((n) => { const f = document.getElementById('mp-name'); f.value = n; f.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('btn-join').click(); }, name);
        return;
      } catch (e) { console.log(`  (${name}: could not open the join screen, try ${i + 1}: ${String(e.message).split('\n')[0].slice(0, 160)})`); }
    }
    throw new Error(name + ' could not open the join screen');
  };
  const H = await mk('host'), G = await mk('guest');
  await H.goto(BASE + '&events=none&quirks=none');
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 180000);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  await join(G, code, 'Bo');
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 30000);
  await H.click('#mp-easy'); await H.waitForTimeout(100);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 30000);
  await G.evaluate(() => { window.hints = []; const h0 = game.ui.hint.bind(game.ui); game.ui.hint = (t, d) => { hints.push(t); return h0(t, d); }; });
  // nothing random on the host; he stands at the board and sees nobody (unless a test says who: seeOnly)
  await H.evaluate(() => {
    const g = game, T = g.teacher;
    g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false;
    g.dreadAuto = false; g.nextSit = g.nextDeskGlasses = 1e9; g.chainNext = 1e9;
    window.seeOnly = null;
    const uw = g.updateWatching.bind(g);
    g.updateWatching = function () { uw(); for (const p of g.players) { const s = window.seeOnly === p.name; p.watching = s; p.lookDot = s ? 0.97 : -1; } };
    window.atBoard = () => { g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.prankBusy = false; g.anger = 0; };
    window.said = [];
    const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return say0(id, v); };
  });
  for (let i = 0; i < 8; i++) { await hostSteps(40); await H.waitForTimeout(150); } // (past his entrance; small steps, or the host would think the friend went silent)
  await H.evaluate(() => atBoard());
  await hostSteps(20);
  const ids = await H.evaluate(() => game.players.map((p) => p.name).join());
  pass(ids === 'Alex,Bo', 'two players in a Free Class (' + ids + ')');

  // ---------------------------------------------------------------- 1. the note chain
  await H.evaluate(() => { const g = game; g.startChain([g.me, g.players.find((p) => p.name === 'Bo')], true); });
  pass(await waitFor(G, () => /has a note for you/.test(document.getElementById('hint').innerText), 8000), 'guest: "Alex has a note for you"');
  pass(await H.evaluate(() => /You have the note/.test(document.getElementById('hint').innerText) && !!game.chain), 'host: "You have the note: ... Look at Bo and hold E"');
  // the host looks at Bo and holds E
  await H.evaluate(() => {
    const g = game, bo = g.players.find((p) => p.name === 'Bo'), d = g.headOf(bo).sub(g.camPos);
    g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    for (let i = 0; i < 4; i++) g.playTick(0.05);
  });
  pass(await H.evaluate(() => /pass the note to Bo/.test(document.getElementById('prompt').innerText)), 'host: the prompt says "hold [E] · pass the note to Bo"');
  await H.evaluate(() => { game.input.keys.talk = true; for (let i = 0; i < 14; i++) game.playTick(0.05); });
  pass(await H.evaluate(() => /PASSING THE NOTE/.test(document.getElementById('aim-kind').innerText)), 'host: a meter while you pass it');
  await stepUntil(() => !game.chain, 60);
  await H.evaluate(() => { game.input.keys.talk = false; game.playTick(0.05); });
  let r = await H.evaluate(() => { const g = game, bo = g.players.find((p) => p.name === 'Bo'); return { pass: g.track.of(g.me).chain_pass, doneA: g.track.of(g.me).chain_done, doneB: g.track.of(bo).chain_done, toast: document.getElementById('toast').innerText }; });
  pass(r.pass === 1 && r.doneA === 1 && r.doneB === 1 && /THE NOTE MADE IT/.test(r.toast), 'it made it: counted for both, "THE NOTE MADE IT!" ' + JSON.stringify(r));
  pass(await waitFor(G, () => /THE NOTE MADE IT/.test(document.getElementById('toast').innerText) || /got the note from/.test(document.getElementById('hint').innerText), 6000), 'guest: sees it arrive');

  // the friend passes the next one... and he looks right at them
  await H.evaluate(() => { const g = game; g.startChain([g.players.find((p) => p.name === 'Bo'), g.me], true); });
  pass(await waitFor(G, () => /You have the note/.test(document.getElementById('hint').innerText), 8000), 'guest: "You have the note" (with what it says)');
  await G.evaluate(() => {
    const g = game, al = g.players.find((p) => p.name === 'Alex'), d = g.headOf(al).sub(g.camPos);
    g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
  });
  pass(await waitFor(G, () => /pass the note to Alex/.test(document.getElementById('prompt').innerText), 6000), 'guest: the prompt says "pass the note to Alex"');
  await G.evaluate(() => { game.input.keys.talk = true; });
  pass(await waitFor(H, () => { const bo = game.players.find((p) => p.name === 'Bo'); for (let i = 0; i < 2; i++) game.playTick(0.05); return game.chain && game.chain.hold > 0.3 && bo.talk && bo.talk.peer === game.me; }, 15000), 'host: the friend is passing it (their whisper to the host)');
  pass(await waitFor(G, () => /PASSING THE NOTE/.test(document.getElementById('aim-kind').innerText), 6000), 'guest: their own pass meter');
  await H.evaluate(() => { window.seeOnly = 'Bo'; });
  await stepUntil(() => game.cutscene, 40);
  await G.evaluate(() => { game.input.keys.talk = false; });
  await stepUntil(() => window.said.some((x) => /^t_cn_/.test(x)), 600);
  await H.evaluate(() => { window.seeOnly = null; });
  r = await H.evaluate(() => { const g = game, bo = g.players.find((p) => p.name === 'Bo'); return { lost: g.track.of(bo).chain_lost, caught: g.track.of(bo).caught, strikes: g.strikes, read: said.filter((x) => /^t_cn_/.test(x)), chain: !!g.chain }; });
  pass(r.lost === 1 && r.caught === 1 && r.strikes === 1 && r.read.length === 1 && !r.chain, 'he looked right at the friend passing it: a strike, and he reads the note out loud ' + JSON.stringify(r));

  // ---------------------------------------------------------------- 2. the ghost kid
  await stepUntil(() => !game.cutscene, 400);
  r = await H.evaluate(() => { const bo = game.players.find((p) => p.name === 'Bo'); return { ghost: !!bo.ghost, n: game.track.of(bo).ghost }; });
  pass(r.ghost && r.n === 1, 'caught online (not the last strike): the friend becomes a ghost');
  pass(await waitFor(G, () => game.me.ghost && document.getElementById('ghost-hud').classList.contains('show'), 8000), 'guest: the GHOST hud ' + JSON.stringify(await G.evaluate(() => ({ g: !!game.me.ghost, k: game.me.ghostK, hud: document.getElementById('ghost-hud').className, hint: document.getElementById('hint').innerText.slice(0, 80) }))));
  pass(await G.evaluate(() => window.hints.some((h) => /You are a <b>ghost<\/b>/.test(h))), 'guest: "You are a ghost for a minute: press 1, 2, 3"');
  await hostSteps(60);
  await waitFor(G, () => game.me.ghostK > 0.98 && game.camera.position.x > 3, 10000);
  r = await G.evaluate(() => { const c = game.camera.position; return { x: +c.x.toFixed(2), z: +c.z.toFixed(2), y: +c.y.toFixed(2), k: game.me.ghostK }; });
  pass(r.x > 3 && r.z > 4.5 && r.k > 0.9, 'guest: their view floats into the back corner ' + JSON.stringify(r));
  r = await H.evaluate(() => { const bo = game.players.find((p) => p.name === 'Bo'), a = bo.avatar.c.root.position; return { x: +a.x.toFixed(2), z: +a.z.toFixed(2), see: bo.avatar.ghosted }; });
  pass(r.x > 3 && r.z > 4.5 && r.see, 'host: the friend\'s avatar floats in the corner, see-through ' + JSON.stringify(r));
  await G.screenshot({ path: shot('mp_extras_ghost_view.png') });
  // talking does nothing as a ghost
  await G.evaluate(() => { game.input.keys.talk = true; });
  await H.waitForTimeout(600); await hostSteps(10);
  pass(await H.evaluate(() => !game.players.find((p) => p.name === 'Bo').talk), 'a ghost cannot whisper (or anything else)');
  await G.evaluate(() => { game.input.keys.talk = false; });
  // the haunts
  await hostSteps(60);
  const press = async (k) => { await G.keyboard.press(k); await G.waitForTimeout(400); await hostSteps(4); };
  // (the first haunt: wait until the host has it; the HUD shows when the haunts are ready)
  await waitFor(G, () => !/wait/.test(document.querySelector('#ghost-haunts .h').className), 10000);
  await H.evaluate(() => { game.anger = 50; atBoard(); game.anger = 50; });
  await press('2');
  r = await H.evaluate(() => ({ haunts: game.track.log.filter((e) => e.type === 'haunt').map((e) => e.id), moved: game.chairAt.n, anger: Math.round(game.anger) }));
  if (r.moved !== 1) r.why = await G.evaluate(() => ({ hints: window.hints.slice(-3), hud: document.getElementById('ghost-haunts').innerText, k: game.me.ghostK }));
  pass(r.haunts.join() === 'chair' && r.moved === 1 && r.anger < 50, '2: the spare chair slides; it calms him a little ' + JSON.stringify(r));
  await H.evaluate(() => { window.backMax = 0; });
  for (let k = 0; k < 7; k++) { await H.evaluate(() => { for (let i = 0; i < 40 && game.state === 'playing'; i++) { game.playTick(0.05); window.backMax = Math.max(window.backMax, game.teacher.pos.z); } }); await H.waitForTimeout(60); }
  r = await H.evaluate(() => ({ back: +window.backMax.toFixed(2), said: said.slice(-4) }));
  pass(r.back > 3.5 && r.said.includes('t_gh_chair'), 'he walks all the way to the back to look: "Who... moved... that?" ' + JSON.stringify(r));
  pass(await waitFor(G, () => Math.abs(game.spareChair.group.position.x - 1.5) > 0.2, 6000), 'guest: sees the chair slide');
  await press('2');
  pass(await H.evaluate(() => game.track.log.filter((e) => e.type === 'haunt').length === 1), 'the chair again right away: not yet (a cooldown)');
  pass(await waitFor(G, () => /CHAIR \d/.test(document.getElementById('ghost-haunts').innerText), 4000), 'guest: the HUD shows the chair\'s cooldown ' + JSON.stringify(await G.evaluate(() => document.getElementById('ghost-haunts').innerText)));
  await press('1');
  pass(await waitFor(G, () => game.world.lights.banks.some((b) => b.flicker > 0.3), 4000), '1: the lights flicker on the friend\'s screen too');
  await press('3');
  pass(await waitFor(G, () => game.world.fallingBook.position.y < 0.3, 6000), '3: the book falls off his desk (on every screen)');
  r = await H.evaluate(() => ({ haunts: game.track.log.filter((e) => e.type === 'haunt').map((e) => e.id).join(), n: game.track.of(game.players.find((p) => p.name === 'Bo')).ghost_haunt }));
  pass(r.haunts === 'chair,light,book' && r.n === 3, 'three haunts counted for the ghost ' + JSON.stringify(r));
  await stepUntil(() => game.world.fallingBook.position.y > 0.7, 300);
  pass(await H.evaluate(() => game.world.fallingBook.position.y > 0.7), 'the book floats back onto his desk a while later');
  // time is up: back to the seat
  await stepUntil(() => !game.players.find((p) => p.name === 'Bo').ghost, 1400);
  pass(await H.evaluate(() => !game.players.find((p) => p.name === 'Bo').ghost), 'after a minute the ghost floats back to their chair');
  pass(await waitFor(G, () => !game.me.ghost && game.me.ghostK < 0.05 && !document.getElementById('ghost-hud').classList.contains('show') && game.camera.position.z < 1, 8000), 'guest: back in their seat (view, HUD) '
    + JSON.stringify(await G.evaluate(() => ({ g: !!game.me.ghost, k: game.me.ghostK, hud: document.getElementById('ghost-hud').className, z: game.camera.position.z }))));

  // ---------------------------------------------------------------- 3. blaming a friend
  await H.evaluate(() => { const g = game; atBoard(); g.me.heat = 0; g.interrupt(g.askWhoDidIt(g.me, 'prank')); });
  pass(await stepUntil(() => !!game.choice, 300) && await H.evaluate(() => game.choice.labels.length === 4 && /Point at Bo \(your friend\)/.test(game.choice.labels[3])), 'host: "Who did it?" has a fourth answer: Point at Bo (your friend)');
  await H.evaluate(() => { game.blameSure = () => 0.1; }); // (he is not sure it was you)
  await H.keyboard.press('4'); await hostSteps(2);
  await stepUntil(() => window.said.includes('t_bl_friend'), 300);
  await stepUntil(() => game.brainIdle || !game.blameBusy, 300);
  r = await H.evaluate(() => { const g = game, bo = g.players.find((p) => p.name === 'Bo'); return { n: g.track.of(g.me).blame_friend, watched: bo.watchedT > 0, w: bo.watchedT, said: said.includes('t_bl_friend'), log: g.track.log.filter((e) => e.type === 'blame').map((e) => e.result), busy: g.blameBusy, idle: g.brainIdle }; });
  pass(r.n === 1 && r.watched && r.said, 'he believes it: "Your... friend. Interesting." and watches the friend ' + JSON.stringify(r));
  pass(await waitFor(G, () => /Alex<\/b> blamed you|Alex blamed you/.test(document.getElementById('hint').innerHTML), 6000), 'guest: "Alex blamed you!"');
  // the friend gets the same choice on their own screen
  await H.evaluate(() => { const g = game; atBoard(); const bo = g.players.find((p) => p.name === 'Bo'); bo.heat = 0; g.interrupt(g.askWhoDidIt(bo, 'prank')); });
  const boAsked = await stepUntil(() => !!game.players.find((p) => p.name === 'Bo').choice, 700);
  pass(boAsked && await waitFor(G, () => document.querySelectorAll('#choices-list button').length === 4 && /Point at Alex/.test(document.getElementById('choices-list').innerText), 8000), 'guest: four answers on their screen (Point at Alex)');
  await G.keyboard.press('2');
  await stepUntil(() => !game.players.find((p) => p.name === 'Bo').choice && !game.blameBusy, 500);
  await waitFor(G, () => document.getElementById('choices').classList.contains('hidden'), 6000);

  // ---------------------------------------------------------------- 4. the decoy
  await H.evaluate(() => { const g = game; atBoard(); g.allowSneak = true; });
  await stepUntil(() => game.canAsk(game.players.find((p) => p.name === 'Bo')), 200);
  // the friend asks him something...
  await G.keyboard.press('t');
  const asked = await waitFor(G, () => !document.getElementById('choices').classList.contains('hidden') && /Raise your hand/.test(document.getElementById('choices-title').innerText), 8000);
  if (!asked) console.log('   (no questions on the guest:', JSON.stringify(await H.evaluate(() => { const g = game, bo = g.players.find((p) => p.name === 'Bo'); return { can: g.canAsk(bo), qBusy: bo.qBusy, choice: !!bo.choice, cut: g.cutscene, ev: g.classEvent, lock: g.eventLock, pres: g.present, allow: g.allowAsk, blame: g.blameBusy }; })), JSON.stringify(await G.evaluate(() => ({ en: game.input.enabled, ch: !!game.mp.choice, out: game.me.out, ghost: !!game.me.ghost }))), ')');
  await G.keyboard.press('1');
  const qb = await stepUntil(() => game.players.find((p) => p.name === 'Bo').qBusy, 200);
  let qwhy = '';
  if (!qb) qwhy = ' ' + JSON.stringify(await H.evaluate(() => { const g = game, bo = g.players.find((p) => p.name === 'Bo'); return { qs: g.track.log.filter((e) => e.type === 'question').length, choice: !!bo.choice, qCount: bo.qCount }; }))
    + JSON.stringify(await G.evaluate(() => ({ ch: document.getElementById('choices-title').innerText, open: !document.getElementById('choices').classList.contains('hidden') })));
  pass(qb, 'the friend asks him a question (it keeps him busy)' + qwhy);
  // ...while the host slips off their chair (the friend is told to keep him busy) and moves his clock
  r = await H.evaluate(async () => {
    const g = game, me = g.me, S = await import('/src/sneak.js'), at = S.SNEAK_SPOTS.clock;
    g.startOut(me); g.onOut(me); me.slipK = 1; me.pos.set(at.x, 0, at.z + 0.1);
    const kind = g.deskNear(me, 0.35);
    g.deskAct(me, kind);
    return { kind, toast: document.getElementById('toast').innerText };
  });
  pass(r.kind === 'clock' && /TEAMWORK/.test(r.toast) && /Bo/.test(r.toast), 'the host moves the clock while the friend\'s question keeps him busy: TEAMWORK! ' + JSON.stringify(r));
  pass(await waitFor(G, () => /TEAMWORK/.test(document.getElementById('toast').innerText) || game.mp.snap.m > 0, 6000) && await H.evaluate(() => game.track.of(game.players.find((p) => p.name === 'Bo')).team_distract === 1), 'the friend counts as the decoy');
  pass(await waitFor(G, () => /off their chair/.test(document.getElementById('hint').innerText) || /TEAMWORK/.test(document.getElementById('toast').innerText), 4000), 'guest: was told "Alex is off their chair. Ask him a question"');
  await H.evaluate(() => { const g = game; g.seatNow(g.me); });
  await stepUntil(() => !game.players.find((p) => p.name === 'Bo').qBusy, 600);

  // ---------------------------------------------------------------- 5. a friend's microphone
  await H.evaluate(() => { atBoard(); });
  await G.evaluate(() => { const g = game; g.mic.on = true; g.micUpdate = () => { g.mic.level = 0.8; return 0.8; }; });
  pass(await waitFor(H, () => { game.playTick(0.05); const bo = game.players.find((p) => p.name === 'Bo'); return bo.in.mc > 0.7 && game.track.of(bo).mic_noise >= 1; }, 10000), 'guest: a laugh into their microphone reaches the host as a level, and counts');
  pass(await waitFor(G, () => /real voice/.test(document.getElementById('hint').innerText), 6000), 'guest: "He heard that! Your real voice counts."');
  await G.evaluate(() => { const g = game; g.mic.on = false; g.mic.level = 0; g.micUpdate = () => 0; });
  pass(await waitFor(H, () => { game.playTick(0.05); return game.players.find((p) => p.name === 'Bo').in.mc === 0; }, 6000), 'microphone off: nothing more is sent');

  // ---------------------------------------------------------------- 6. the chaos scoreboard
  await H.evaluate(() => { game.t = 299; });
  await stepUntil(() => game.state !== 'playing', 4000);
  pass(await waitFor(H, () => game.state === 'end', 30000), 'the bell: the end screen');
  pass(await waitFor(G, () => game.state === 'end' && document.querySelectorAll('#end-chaos .chaos-row').length === 2, 20000), 'guest: the chaos scoreboard with both players');
  const board = (page) => page.evaluate(() => ({ text: document.getElementById('end-chaos').innerText, me: (document.querySelector('#end-chaos .chaos-row.me') || {}).innerText || '', rows: game.lastBoard && game.lastBoard.map((r) => [r.name, r.title.id, r.pts]) }));
  const bh = await board(H), bg = await board(G);
  pass(/WHO CAUSED THE MOST CHAOS/.test(bh.text) && /Alex \(you\)/.test(bh.me) && /Bo \(you\)/.test(bg.me), 'each screen marks its own row ' + JSON.stringify([bh.me, bg.me]));
  pass(JSON.stringify(bh.rows) === JSON.stringify(bg.rows) && new Set(bh.rows.map((x) => x[1])).size === 2, 'the same board on both screens, a different title for each ' + JSON.stringify(bh.rows));
  pass(bh.rows.some((x) => x[0] === 'Bo' && ['ghost', 'magnet', 'mailman', 'decoy', 'loudmouth'].includes(x[1])) && bh.rows.some((x) => x[0] === 'Alex' && ['snitch', 'mailman', 'sneak'].includes(x[1])), 'titles from what they did (the ghost, the snitch...)');
  await G.screenshot({ path: shot('mp_extras_guest_end.png') });
  await H.screenshot({ path: shot('mp_extras_host_end.png') });

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
