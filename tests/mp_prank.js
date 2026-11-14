// Two players: aiming and throwing paper online. The guest aims on their screen, the host simulates
// the throw; both see the paper, the laugh meter, the arm wind-up; a paper can hit the other player;
// the guest gets caught when he looks right at their raised arm.
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
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
  for (const P of [H, G]) {
    await P.evaluate(async () => {
      const g = window.game;
      window.PR = await import('/src/pranks.js');
      g.__render = g.post.render.bind(g.post);
      g.post.render = () => {};
      // a throw from this screen that hits what `want` says (the arc's own flight code; middle of the hitting range)
      window.findThrow = (aimAt, want) => {
        const targets = g.prankTargets(), out = { pts: Array.from({ length: 70 }, () => g.camPos.clone()), n: 0, hit: null, at: g.camPos.clone() };
        const sp = g.camPos.clone(), sv = g.camPos.clone(), d = aimAt.clone().sub(g.camPos), y0 = Math.atan2(-d.x, -d.z);
        let best = null;
        for (const pw of [1, 0.8, 0.6]) for (let dy = -0.08; dy <= 0.08; dy += 0.02) {
          const yaw = y0 + dy; let r0 = null, len = 0;
          for (let pitch = -0.3; pitch <= 0.9; pitch += 0.01) {
            PR.throwStart(g.camPos, yaw, pitch, pw, 'ball', sp, sv); g.simThrow(sp, sv, 'ball', 0, g.me, targets, out);
            if (out.hit && want(out.hit)) { if (r0 === null) r0 = pitch; len++; } else if (r0 !== null) break;
          }
          if (r0 !== null && (!best || len > best.len)) best = { yaw, pitch: r0 + (len - 1) * 0.005, power: pw, len };
        }
        return best;
      };
    });
  }
  // the host: nothing random, he stands at the board with his back to the class
  await H.evaluate(() => {
    const g = game, T = g.teacher;
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    window.atBoard = () => { g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.prankBusy = false; g.anger = 0; for (const p of g.players) { p.prankStreak = 0; p.prankSeenT = 0; } };
    atBoard();
  });
  await H.waitForTimeout(2500);
  await H.evaluate(() => { game.anger = 0; });

  // ---- the guest aims: their screen shows the arc, the host sees the arm up
  await G.evaluate(() => { game.yaw = 0; game.pitch = 0.15; game.input.keys.prank = true; });
  await G.waitForTimeout(700);
  await check(G, 'guest: hold G aims (arc and paper on their screen)', `!!game.me.aim && game.arcDots.visible && game.heldPaper.visible`);
  const seenAim = await waitFor(H, () => { const p = game.players.find((x) => x.name === 'Bo'); return p && p.aiming && p.avatar && p.avatar.arm.visible && p.avatar.ball.visible; }, 5000);
  (seenAim ? ok : bad).push('host: sees the guest aiming (arm up with a paper ball)');
  // aim at his back, let go
  const t = await G.evaluate(() => { const T = game.teacher; const t = findThrow(T.headWorld().add(game.camPos.clone().set(0, -0.7, 0)), (h) => h.type === 'teacher' && h.part === 'back'); if (t) { game.yaw = t.yaw; game.pitch = t.pitch; game.me.aim.power = t.power; game.me.aim.kind = 'ball'; } return t; });
  (t ? ok : bad).push('guest: found a throw at his back from their seat');
  await G.waitForTimeout(100);
  await G.evaluate(() => { game.input.keys.prank = false; });
  const thrown = await waitFor(H, () => game.track.log.some((e) => e.type === 'throw' && e.who !== 'host'), 5000);
  (thrown ? ok : bad).push('host: got the guest\'s throw and threw it');
  const seenPaper = await waitFor(G, () => game.netPapers.size > 0, 3000);
  (seenPaper ? ok : bad).push('guest: sees the paper flying (from the snapshots)');
  const hit = await waitFor(H, () => game.track.log.some((e) => e.type === 'hit' && e.who !== 'host' && e.target === 'teacher'), 5000);
  (hit ? ok : bad).push('host: the guest\'s paper hit him');
  await check(H, 'host: counted for the guest (throws, hits on him)', `(() => { const s = game.track.of(game.players.find((x) => x.name === 'Bo')); return s.throws === 1 && s.hitHim === 1; })()`);
  const laughG = await waitFor(G, () => game.laugh > 10 && !document.getElementById('laugh').classList.contains('off'), 5000);
  (laughG ? ok : bad).push('guest: the LAUGHS meter shows the class laughing');
  await G.evaluate(() => { game.__render(game.scene, game.camera); });
  await G.screenshot({ path: shot('mp_prank_guest.png') });
  await H.waitForTimeout(9000);

  // ---- the host aims: the guest sees the host's arm up; then the host hits the guest
  await H.evaluate(() => { atBoard(); game.yaw = 0; game.pitch = 0; game.input.keys.prank = true; });
  const hostArm = await waitFor(G, () => { const p = game.players.find((x) => x.id === 'host'); return p && p.avatar && p.avatar.ball.visible; }, 5000);
  (hostArm ? ok : bad).push('guest: sees the host winding up a throw');
  await H.evaluate(() => { game.input.keys.prank = false; game.me.aim = null; });
  await G.evaluate(() => { game.__bonks = 0; const lb = game.localBonk.bind(game); game.localBonk = (f) => { game.__bonks++; return lb(f); }; });
  await H.waitForTimeout(400);
  const hb = await H.evaluate(() => { const bo = game.players.find((x) => x.name === 'Bo'); const t = findThrow(game.headOf(bo), (h) => h.type === 'player' && h.who === bo); if (t) { game.me.foldT = 0; game.yaw = t.yaw; game.pitch = t.pitch; game.throwFrom(game.me, { yaw: t.yaw, pitch: t.pitch, power: t.power, kind: 'ball', curve: 0 }); } return !!t; });
  (hb ? ok : bad).push('host: found a throw at the guest');
  const bonked = await waitFor(G, () => game.__bonks > 0, 5000);
  (bonked ? ok : bad).push('guest: got hit ("Alex got you with a paper ball!")');
  await check(G, 'guest: the hint names who threw it', `/Alex/.test(document.getElementById('hint').innerText)`);
  await H.waitForTimeout(3000);

  // ---- he turns around and looks right at the guest while their arm is up: caught
  await H.evaluate(() => {
    const g = game, T = g.teacher, bo = g.players.find((x) => x.name === 'Bo');
    g.anger = 0; for (const p of g.players) { p.prankStreak = 0; p.prankSeenT = 0; }
    g.interrupt((function* () { T.place(-1.5, -3.6, 0); for (;;) { T.lookAt(bo.camPos, 20); T.facePoint(bo.camPos, 8); yield; } })());
  });
  await H.waitForTimeout(1200);
  await G.evaluate(() => { game.input.keys.prank = true; });
  const caught = await waitFor(H, () => { const p = game.players.find((x) => x.name === 'Bo'); return p && (game.track.of(p).caughtFor.prank || 0) >= 1; }, 8000);
  (caught ? ok : bad).push('host: he saw the guest\'s arm up: caught for pranks');
  await G.evaluate(() => { game.input.keys.prank = false; });
  const gotAim = await waitFor(G, () => !game.me.aim, 5000);
  (gotAim ? ok : bad).push('guest: the paper is out of their hand during the scene');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
