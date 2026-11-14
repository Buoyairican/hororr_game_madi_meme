// Phase 3 online: the friend's laser dot (host and friend see it; he chases a friend's dot too),
// the host's dot on the friend's screen, the friend sticking KICK ME on his back (both see it),
// and "Who did it?" asked to the friend (the choice on their screen, the answer back on the host).
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
  const expect = async (page, name, fn, ms) => { (await waitFor(page, fn, ms) ? ok : bad).push(name); };
  const H = await mk('host'), G = await mk('guest');
  await H.goto(BASE);
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 120000);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  await G.goto(BASE + '&join=' + code);
  await waitFor(G, () => window.game && !document.getElementById('mp').classList.contains('hidden'), 120000);
  await G.fill('#mp-name', 'Bo'); await G.click('#btn-join');
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 30000);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 30000);
  for (const P of [H, G]) {
    await P.evaluate(() => {
      const g = window.game;
      g.__render = g.post.render.bind(g.post);
      g.post.render = () => {};
      window.V = g.camPos.constructor;
      window.lookAt = (v) => { const d = v.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
    });
  }
  // the host: nothing random; he stands where the test puts him, doing nothing
  await H.evaluate(() => {
    const g = game;
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    // no events and no quirks today (an online class draws its own; the friend gets the same)
    g.eventsOn = false; g.setup.plan = []; g.quirks = new Set();
    window.said = [];
    const ts = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return ts(id, v); };
    window.stand = (x, z, facing) => {
      const T = g.teacher;
      g.cat = null; g.catCool = 0; g.blameBusy = false; g.prankBusy = false; g.searching = false;
      g.interrupt((function* () { T.place(x, z, facing); T.lookAt(null); T.setPose('rest'); for (;;) yield; })());
      g.anger = 0; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; p.prankStreak = 0; }
    };
    window.bo = () => g.players.find((x) => x.name === 'Bo');
    stand(0.5, -5.6, Math.PI);
  });
  await H.waitForTimeout(1500);
  await check(G, 'friend: the laser and the note are in the tool list (from the host)', `JSON.stringify(game.toolKinds(game.me)) === '["ball","plane","laser","note"]'`);

  // ---- the friend's laser: on their screen, on the host's, and their arm points it
  await G.evaluate(() => { lookAt(new V(-1.4, 1.6, -6.9)); game.me.prankKind = 'laser'; game.input.keys.prank = true; });
  await expect(G, 'friend: the red dot on their own screen (the board)', () => game.me.laserHit && game.me.laserHit.type === 'board' && game.laserDots[0].visible, 5000);
  await expect(H, 'host: sees the friend\'s dot too (and their arm out with the pointer)', () => {
    const p = window.bo(); return p && p.laserOn && p.laserHit && p.laserHit.type === 'board' && game.laserDots.some((s) => s.visible) && p.avatar && p.avatar.pointer.visible;
  }, 6000);
  await H.evaluate(() => { game.__render(game.scene, game.camera); });
  await H.screenshot({ path: shot('mp_blame_dot.png') });
  // he faces the board: the friend's dot is right in front of him
  await expect(H, 'host: he sees the friend\'s dot and chases it', () => game.cat && game.cat.p === window.bo(), 8000);
  await expect(G, 'friend: "he\'s chasing it!" on their screen', () => /chasing it/.test(game.aimLabel), 6000);
  await G.evaluate(() => { game.input.keys.prank = false; });
  await expect(H, 'friend lets go: "Where did it go?" and the chase ends', () => !game.cat && said.includes('t_lz_gone'), 12000);
  await expect(G, 'friend: the dot is gone from their screen', () => !game.laserDots.some((s) => s.visible), 4000);

  // ---- the host's dot on the friend's screen
  await H.evaluate(() => { stand(0.5, -5.6, Math.PI); game.catCool = game.t + 60; lookAt(new V(2.2, 1.4, -6.9)); game.me.prankKind = 'laser'; game.input.keys.prank = true; });
  await expect(G, 'friend: sees the host\'s red dot', () => game.netDots.length === 1 && game.laserDots[0].visible && game.netDots[0][3] === 'host', 6000);
  await H.evaluate(() => { game.input.keys.prank = false; });
  await H.waitForTimeout(500);

  // ---- the friend sticks KICK ME on his back (he stops just past their desk, back to them)
  await H.evaluate(() => { const p = window.bo(); stand(p.desk.x >= 0 ? p.desk.x + 0.75 : p.desk.x - 0.75, p.camPos.z + 0.8, 0); });
  await G.waitForTimeout(800);
  await G.evaluate(() => { game.yaw = 0; game.pitch = -0.1; game.me.prankKind = 'note'; game.input.keys.prank = true; });
  await expect(G, 'friend: "→ his back: let go to stick it"', () => /let go to stick it/.test(game.aimLabel), 5000);
  await G.evaluate(() => { game.input.keys.prank = false; });
  await expect(H, 'host: the note is on his back, stuck by the friend (counted for them)', () => game.kickNote && game.kickNote.owner === window.bo() && game.track.of(window.bo()).kickme === 1, 5000);
  await expect(G, 'friend: sees KICK ME on his back; one note left', () => game.netKick && game.backNote.visible && game.me.notesLeft === 1, 5000);
  await H.evaluate(() => { stand(0.3, -5.6, Math.PI); });
  await expect(H, 'he turns his back on the class: they laugh (for the friend\'s note)', () => game.kickNote && game.kickNote.laughs >= 1 && game.track.of(window.bo()).noteLaughs >= 1, 6000);
  await G.evaluate(() => { game.__render(game.scene, game.camera); });
  await G.screenshot({ path: shot('mp_blame_kickme.png') });

  // ---- he finds it and asks the friend who did it
  await H.evaluate(() => { game.kickNote.foundAt = game.t; game.interrupt((function* () { for (let i = 0; i < 3; i++) yield; })()); });
  await expect(G, 'friend: the note is gone from his back...', () => !game.netKick, 15000);
  await expect(G, '...and the "Who did it?" choice opens on the friend\'s screen', () => !document.getElementById('choices').classList.contains('hidden') && /Who did it/.test(document.getElementById('choices-title').textContent), 20000);
  await G.evaluate(() => { game.input.choiceKey = 1; });
  await expect(H, 'host: the friend said nothing: he watches them now', () => { const p = window.bo(); return p.watchedT > 0 && game.track.log.some((e) => e.type === 'blame' && e.result === 'silent' && e.who !== 'host'); }, 12000);
  await check(H, 'host: no strike for that', `game.strikes === 0`);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
