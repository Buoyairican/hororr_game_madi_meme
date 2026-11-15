// Phase 4 online: a friend leaves their seat (the host sees their avatar crawl where they are), crawls to his
// desk and reads his laptop (the secret on the friend's screen), takes his glasses (both see them gone); the
// host off their chair (the friend sees that avatar crawl); he sees the friend on the floor: caught, carried
// back to their chair on both screens; the friend's whoopee cushion and "Who did it?" on the friend's screen.
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
  const expect = async (page, name, fn, ms, arg) => { (await waitFor(page, fn, ms, arg) ? ok : bad).push(name); };
  // the friend goes from waypoint to waypoint (around his desk); the host follows at crawling speed
  const goTo = async (pts) => {
    for (const [x, z] of pts) {
      await G.evaluate(([x, z]) => { game.me.pos.set(x, 0, z); }, [x, z]);
      await waitFor(H, ([x, z]) => { const p = window.bo(); return Math.hypot(p.pos.x - x, p.pos.z - z) < 0.1; }, 10000, [x, z]);
    }
  };
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
    });
  }
  // the host: nothing random; he stands where the test puts him, doing nothing
  await H.evaluate(() => {
    const g = game;
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.extrasAuto = false; // (Phase 7's note chain, ghosts and decoy hints: tests/mp_extras.js)
    g.startMeme = () => false;
    g.eventsOn = false; g.scaresOn = false; g.setup.plan = []; g.quirks = new Set();
    window.said = [];
    const ts = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return ts(id, v); };
    window.stand = (x, z, facing, at = null) => {
      const T = g.teacher;
      g.cat = null; g.blameBusy = false; g.sneakBusy = false; g.searching = false;
      g.interrupt((function* () { T.place(x, z, facing); T.lookAt(at); T.setPose('rest'); for (;;) yield; })());
      g.anger = 0; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; p.spotT = 0; p.noticed = false; p.emptyT = 0; p.emptyCool = 99; }
    };
    window.bo = () => g.players.find((x) => x.name === 'Bo');
    // (this test is about the friend: he does not notice empty chairs here)
    stand(0.3, -6.35, Math.PI);
  });
  await H.waitForTimeout(1500);
  await check(G, 'friend: leaving your seat is allowed (from the host), the SEAT button says so', `game.allowSneak && document.getElementById('btn-seat').textContent === 'SEAT'`);

  // ---- the friend leaves their seat and crawls
  await G.evaluate(() => { game.yaw = -0.5; game.input.pressed.seat = true; });
  await expect(G, 'friend: off their chair, eyes on the floor', () => game.me.out && game.camera.position.y < 0.7, 4000);
  await expect(H, 'host: the friend is off their chair, their avatar crawls on the floor', () => { const p = window.bo(); return p && p.out && p.slipK > 0.9 && p.avatar && p.avatar.c.root.rotation.x > 1; }, 6000);
  const z0 = await H.evaluate(() => window.bo().pos.z);
  await G.evaluate(() => { game.yaw = 0; game.input.moveKeys.f = true; });
  await G.waitForTimeout(1500);
  await G.evaluate(() => { game.input.moveKeys.f = false; });
  await expect(H, 'host: the friend crawls forward (their position follows)', (z) => window.bo().pos.z < z - 0.8, 4000, z0);
  await H.evaluate(() => { game.__render(game.scene, game.camera); });
  await H.screenshot({ path: shot('mp_sneak_crawl.png') });

  // ---- to his desk (the host follows at crawling speed), and his laptop
  // (he faces the board here; this part is about what both screens show, so he sees nobody on the floor)
  await H.evaluate(() => { game.sneakVisibleReal = game.sneakVisible; game.sneakVisible = () => false; });
  await goTo([[-2.25, -3.0], [-1.5, -3.0], [-1.5, -6.2]]);
  await check(H, 'host: the friend gets to the front of the room (around his desk)', `window.bo().pos.z < -6.1`);
  await G.evaluate(() => { game.me.pos.set(-3.03, 0, -6.1); game.yaw = Math.PI; });
  await expect(H, 'host: the friend is behind his desk, at his laptop', () => game.deskNear(window.bo()) === 'laptop', 8000);
  await G.evaluate(() => { game.input.keys.talk = true; });
  await expect(H, 'host: the friend comes up to read it: the lid opens', () => game.world.laptop.openTarget === 1 && window.bo().standK > 0.5, 6000);
  await expect(G, 'friend: what is on his laptop, on their screen', () => game.ui.noteOpen && /HIS LAPTOP/.test(document.getElementById('note-text').innerText), 8000);
  await G.evaluate(() => { game.input.keys.talk = false; });
  await check(H, 'host: counted for the friend', `game.track.of(window.bo()).secrets === 1`);
  await G.evaluate(() => game.ui.closeNote());

  // ---- his glasses: he puts them down (both see it), the friend takes them
  await goTo([[-1.5, -6.2], [-1.5, -4.2]]); // (out of his way)
  await H.evaluate(() => { game.interrupt(game.actDeskGlasses()); });
  await expect(G, 'friend: his glasses are on his desk, he is half blind (the eye says so)', () => game.glassesAt === 'desk' && game.halfBlind && game.teacher.glasses.parent === game.scene && document.getElementById('eye-label').textContent !== 'WATCHING', 15000);
  await goTo([[-2.8, -4.55]]);
  await G.evaluate(() => { game.yaw = Math.PI; });
  await expect(H, 'host: the friend is in front of his desk', () => game.deskNear(window.bo()) === 'glasses', 10000);
  await G.evaluate(() => { game.input.keys.talk = true; });
  await expect(H, 'host: the friend took his glasses', () => game.glassesAt === 'gone' && window.bo().hasGlasses, 6000);
  await G.evaluate(() => { game.input.keys.talk = false; });
  await expect(G, 'friend: the glasses are gone from the desk', () => !game.teacher.glasses.visible && game.me.hasGlasses, 5000);

  // ---- the host off their own chair: the friend sees that avatar crawl
  await H.evaluate(() => { game.input.pressed.seat = true; });
  await expect(G, 'friend: the host is off their chair, crawling', () => { const p = game.players.find((q) => q.name === 'Alex'); return p && p.out && p.avatar && p.avatar.c.root.rotation.x > 1; }, 6000);
  await H.evaluate(() => { game.seatNow(game.me); });

  // ---- he sees the friend: caught, carried back to their chair
  // (without his glasses he only sees what is close: he stands next to his desk)
  await H.evaluate(() => { game.sneakVisible = game.sneakVisibleReal; const p = window.bo(); stand(-1.9, -5.0, -Math.PI / 2, p.view); p.emptyCool = 99; });
  await expect(G, 'friend: the bar fills (HE SEES YOU)', () => game.me.spotT > 0.5 && /SEE/.test(document.getElementById('sneak-label').textContent), 5000);
  await expect(H, 'host: caught (seat), he takes the friend by the collar', () => window.bo().carried && (game.track.of(window.bo()).caughtFor.seat || 0) === 1, 15000);
  await expect(G, 'friend: carried (eyes up off the floor, the bar says CAUGHT)', () => game.me.carried && game.camera.position.y > 0.9 && /CAUGHT/.test(document.getElementById('sneak-label').textContent), 6000);
  await G.evaluate(() => { game.__render(game.scene, game.camera); });
  await G.screenshot({ path: shot('mp_sneak_carried.png') });
  await expect(G, 'friend: back on their chair', () => !game.me.out && game.me.slipK === 0 && Math.abs(game.camera.position.y - 1.17) < 0.05, 25000);
  await expect(H, 'host: "And these are mine." (the glasses back), one strike', () => !window.bo().hasGlasses && game.glassesAt === 'face' && game.strikes === 1, 20000);

  // ---- the friend's whoopee cushion: he sits on it, "Who did it?" on the friend's screen
  await waitFor(H, () => !game.cutscene, 30000);
  await H.evaluate(() => { stand(1.5, -6.3, Math.PI); });
  await waitFor(G, () => !game.cutscene && game.me.slipK === 0, 10000);
  await G.evaluate(() => { game.input.pressed.seat = true; });
  await expect(H, 'host: the friend is off their chair again', () => window.bo().out && window.bo().slipK > 0.9, 6000);
  await H.evaluate(() => { game.sneakVisible = () => false; });
  await goTo([[-2.25, -3.0], [-1.5, -3.0], [-1.5, -6.2], [-3.7, -6.25]]);
  await expect(H, 'host: the friend is at his chair', () => game.deskNear(window.bo()) === 'cushion', 8000);
  await G.evaluate(() => { game.input.keys.talk = true; });
  await expect(G, 'friend: the cushion is on his chair', () => game.cushionShown && game.cushionMesh.visible, 6000);
  await G.evaluate(() => { game.input.keys.talk = false; });
  await goTo([[-1.5, -6.2], [-1.5, -3.0], [-2.25, -3.0], [-2.25, 0.2]]);
  await G.evaluate(() => { game.input.pressed.seat = true; });
  await expect(H, 'host: the friend is back on their chair', () => !window.bo().out && window.bo().slipK === 0, 6000);
  await H.evaluate(() => { game.allowBlame = true; game.anger = 0; game.interrupt(game.actSit()); });
  await expect(H, 'host: he sits on it: the class laughs, counted for the friend', () => game.track.of(window.bo()).cushions === 1 && game.laugh > 30, 20000);
  await expect(G, 'friend: "Who did it?" on the friend\'s screen', () => !document.getElementById('choices').classList.contains('hidden') && /Who did it/.test(document.getElementById('choices-title').textContent), 25000);
  await G.evaluate(() => { game.input.choiceKey = 1; });
  await expect(H, 'host: the friend said nothing', () => game.track.log.some((e) => e.type === 'blame' && e.result === 'silent'), 12000);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
