// Phase 4: leave your seat. C slips you off your chair; you crawl (WASD) along the aisles; desks and kids
// hide you; the meter fills while he can see you and he catches you only when he looks right at you; he
// notices your empty chair; caught, he walks you back (a strike). At his desk: his glasses (half blind, the
// hunt, the spare pair), his laptop, the clock (Free Class), a whoopee cushion on his chair.
// Free Class with no events or quirks, nothing random in the way; the game is ticked by hand.
const { chromium, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const ok = [], bad = [], logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
  const check = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  const snap = async (name) => { await page.evaluate(() => game.__render(game.scene, game.camera)); await page.screenshot({ path: shot(name) }); };
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free&events=none&quirks=none');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  await page.evaluate(async () => {
    const D = await import('/src/data.js');
    const S = await import('/src/sneak.js');
    window.D = D; window.SPOT = S.SNEAK_SPOTS;
    D.SNEAK.glasses.lost = 6; // (a short hunt for his glasses)
    const g = window.game, V = g.camPos.constructor;
    window.V = V;
    g.__render = g.post.render.bind(g.post);
    g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    g.timers.clear(); // (no Free Class hints and tasks on their timers)
    window.said = [];
    const ts = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return ts(id, v); };
    const sa = g.sayAt.bind(g); g.sayAt = (c, id, n, v) => { said.push(id); return sa(c, id, n, v); };
    window.saidNow = (re) => said.some((x) => re.test(x));
    window.run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { if (g.state !== 'playing') break; g.playTick(1 / 30); g.ui.update(1 / 30); } };
    window.until = (fn, sec) => { for (let i = 0; i < sec * 30; i++) { if (fn()) return true; if (g.state !== 'playing') return fn(); g.playTick(1 / 30); g.ui.update(1 / 30); } return fn(); };
    window.calm = () => { g.anger = 0; g.flags = { r40: true, r70: true }; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; p.watchedT = 0; p.spotT = 0; p.noticed = false; p.emptyT = 0; p.emptyCool = 0; } };
    // he stands somewhere doing nothing (facing 0: the class; Math.PI: the board), looking at `at` (or straight ahead)
    window.stand = (x, z, facing, at = null, idle = false) => {
      const T = g.teacher;
      g.cat = null; g.blameBusy = false; g.sneakBusy = false; g.sneakScan = null; g.searching = false;
      g.interrupt((function* () { T.place(x, z, facing); T.lookAt(at, 30); T.setPose('rest'); for (;;) yield; })());
      g.brainIdle = idle;
      run(0.3); calm();
    };
    // you, off your chair at (x, z) on the floor, looking toward (lx, lz)
    window.putAt = (x, z, lx = null, lz = null) => {
      const me = g.me;
      if (!me.out) g.startOut(me);
      me.slipK = 1; me.pos.set(x, 0, z); me.carried = false; me.deskJob = null; me.spotT = 0; me.noticed = false;
      if (lx !== null) g.yaw = Math.atan2(-(lx - x), -(lz - z));
      g.pitch = -0.1;
      run(0.05);
    };
    window.holdE = (sec) => { g.input.keys.talk = true; run(sec); g.input.keys.talk = false; run(0.05); };
    window.base = {};
    window.caught = (r) => (g.track.of(g.me).caughtFor[r] || 0) - (base[r] || 0);
    window.fresh = () => {
      until(() => !g.cutscene, 30); run(0.3); calm(); g.strikes = 0; said.length = 0;
      if (g.me.out || g.me.slipK > 0) g.seatNow(g.me);
      base = { ...g.track.of(g.me).caughtFor };
    };
    run(1);
  });

  // ---------------------------------------------------------------- off the chair
  await check('Free Class: you may leave your seat; the key legend says C', `game.allowSneak && /C sneak/.test(document.getElementById('keys-legend').innerText) && document.getElementById('btn-seat').textContent === 'SEAT' && !document.getElementById('btn-seat').classList.contains('hidden')`);
  await page.evaluate(() => { stand(0.3, -6.3, Math.PI); game.yaw = -0.4; game.pitch = 0; });
  await page.keyboard.press('c');
  await page.evaluate(() => run(0.8));
  await check('C: off your chair, onto the floor in the aisle on the side you look at', `game.me.out && game.me.slipK === 1 && game.me.pos.x === 0.75 && Math.abs(game.me.pos.z + 1.5) < 0.01`);
  await check('your eyes are on the floor; he still thinks of you at your chair (camPos)', `game.camera.position.y < 0.65 && Math.abs(game.camPos.y - 1.17) < 0.02 && Math.abs(game.camPos.z - game.me.eye.z) < 0.1`);
  await check('the bar shows (HIDDEN while he writes), the stick and USE on a phone, the legend says how', `document.getElementById('sneak-hud').classList.contains('show') && document.getElementById('sneak-label').textContent === 'HIDDEN' && document.getElementById('touch-buttons').classList.contains('out') && document.getElementById('btn-talk').textContent === 'USE' && document.getElementById('btn-seat').textContent === 'SIT' && /crawl/.test(document.getElementById('keys-legend').innerText)`);
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.3));
  await page.keyboard.up('g');
  await page.keyboard.down('e');
  await page.evaluate(() => { game.yaw = 1.6; run(0.5); });
  await page.keyboard.up('e');
  await check('on the floor: no paper, no whisper', `!game.me.aim && !game.me.talk && game.stats.throws === 0`);
  await page.evaluate(() => { game.yaw = 0; run(0.05); });
  await page.keyboard.down('w');
  await page.evaluate(() => run(1.2));
  await page.keyboard.up('w');
  await check('W crawls forward down the aisle (about 1 m/s)', `game.me.pos.z < -2.4 && game.me.pos.z > -3.0 && Math.abs(game.me.pos.x - 0.75) < 0.01 && game.track.of(game.me).sneaks === 1`);
  await page.evaluate(() => { putAt(0.75, 0.2); game.yaw = 0; });
  await page.keyboard.down('d');
  await page.evaluate(() => run(1));
  await page.keyboard.up('d');
  await check('...but not into the desks next to the aisle', `game.me.pos.x <= 0.951 && game.me.pos.x > 0.9`);
  await check('nor through his desk or his chair (the floor in front of the board, the aisles, the back: yes)', `!game.canBe(game.me, SPOT.desk.x, SPOT.desk.z) && !game.canBe(game.me, SPOT.cushion.x, SPOT.cushion.z) && game.canBe(game.me, 2, -6.2) && game.canBe(game.me, -2.25, 1) && game.canBe(game.me, 3, 5) && !game.canBe(game.me, 0, 1.35)`);
  await page.keyboard.press('c');
  await page.evaluate(() => run(0.2));
  await check('C far from your desk: still on the floor ("crawl back first")', `game.me.out && /back to your desk/.test(document.getElementById('hint').innerText)`);
  await page.evaluate(() => { putAt(-0.7, -1.4); });
  await check('next to your chair: "[C] · sit down"', `/sit down/.test(document.getElementById('prompt').textContent)`);
  await page.keyboard.press('c');
  await page.evaluate(() => run(0.8));
  await check('C next to your chair: back on it (eyes up, the bar gone)', `!game.me.out && game.me.slipK === 0 && Math.abs(game.camera.position.y - 1.17) < 0.02 && !document.getElementById('sneak-hud').classList.contains('show') && !document.getElementById('touch-buttons').classList.contains('out')`);

  // ---------------------------------------------------------------- his sight: desks hide you, the meter, caught
  await page.evaluate(() => { stand(-4.2, 1.35, Math.PI / 2, null); putAt(0.75, 1.35, -4.2, 1.35); game.teacher.lookAt(game.me.view.clone(), 30); run(0.5); });
  await check('he looks right at you from the side of the room, but the desks between you hide you', `game.me.sneakSeen === 0 && game.me.spotT === 0 && !game.losClear(game.teacher.headWorld(new V()), game.me.view, game.me)`);
  await page.evaluate(() => fresh());
  await page.evaluate(() => { stand(0.4, -5.6, 0, null); putAt(2.4, -3.3, 2.4, -6); const T = game.teacher; T.lookAt(new V(0.2, 0.5, -3.3), 30); game.sneakNoticeReal = game.sneakNotice; game.sneakNotice = () => {}; run(2.8); game.sneakNotice = game.sneakNoticeReal; });
  await check('at the edge of his eye (lookDot 0.55..0.8) the meter fills, but never to the top', `game.me.sneakSeen === 1 && game.me.spotT > 0.6 && game.me.spotT <= 0.951 && caught('seat') === 0 && document.getElementById('sneak-label').textContent === 'HE CAN SEE YOU'`);
  await page.evaluate(() => { game.me.noticed = false; run(0.1); });
  await check('half full: "Hm?" and he looks at you...', `until(() => saidNow(/t_sn_hmm/), 2)`);
  await check('...right at you: caught (reason seat)', `until(() => caught('seat') === 1, 4)`);
  await check('he walks over and takes you by the collar: "Back to your seat."', `until(() => game.me.carried, 8) && until(() => saidNow(/t_sn_back/), 4)`);
  await page.evaluate(() => { run(1.5); });
  await snap('sneak_carried.png');
  await check('...walks you to your desk, you are back on your chair, the strike ("You do not leave your seat")', `until(() => !game.me.out && game.me.slipK === 0 && !game.me.carried, 15) && until(() => saidNow(/t_sn_seat/), 10) && game.strikes === 1`);
  await page.evaluate(() => fresh());
  await page.evaluate(() => { stand(0.4, -5.6, 0, null); putAt(0.4, -3.4, 0.4, -6); game.teacher.lookAt(game.me.view, 30); run(0.4); });
  await check('in the open right in front of him: HE SEES YOU, caught in under a second', `until(() => caught('seat') === 1, 1.2)`);
  await page.evaluate(() => fresh());
  // Hard: the same rules (one strike); the edge of his eye still never fills the meter
  await page.evaluate(() => { game.hard = true; game.maxStrikes = 1; stand(0.4, -5.6, 0, null); putAt(2.4, -3.3, 2.4, -6); game.teacher.lookAt(new V(0.2, 0.5, -3.3), 30); game.sneakNotice = () => {}; run(2.8); game.sneakNotice = game.sneakNoticeReal; });
  await check('Hard: the same: the edge of his eye alone never catches you', `caught('seat') === 0 && game.me.spotT <= 0.951 && game.state === 'playing'`);
  await page.evaluate(() => { game.hard = false; game.maxStrikes = 3; fresh(); });

  // ---------------------------------------------------------------- he walks into you
  await page.evaluate(() => { stand(-2.2, -3.0, Math.PI / 2, null); game.sneakVisibleReal = game.sneakVisible; game.sneakVisible = () => false; putAt(0.75, -3.0, 0.75, 0); game.interrupt(game.walk(2.2, -3.0, 0.85)); });
  await check('he walks into you (even when he can\'t see you): caught', `until(() => caught('seat') === 1, 6) && game.track.log.some((e) => e.type === 'bumped')`);
  await page.evaluate(() => { fresh(); game.sneakVisible = game.sneakVisibleReal; });

  // ---------------------------------------------------------------- your empty chair
  await page.evaluate(() => {
    stand(0.4, -5.4, 0, null, true);
    game.sneakVisible = () => false; // (he can't see you where you are: this is about the chair)
    putAt(-0.75, 2.6);
    game.teacher.lookAt(game.me.camPos, 30);
  });
  await check('he looks at your empty chair: "Where did you go?" (a little anger)', `until(() => saidNow(/t_sn_where/), 4) && game.sneakBusy && game.anger > 0`);
  await page.evaluate(() => { putAt(-0.7, -1.4); game.input.pressed.seat = true; run(0.8); });
  await check('you are back on your chair before he gets there: "Hmm." and he watches you (no strike)', `until(() => saidNow(/^t_hmm$/), 12) && game.me.watchedT > 0 && caught('seat') === 0 && !game.me.out`);
  await page.evaluate(() => { game.sneakVisible = game.sneakVisibleReal; until(() => !game.sneakBusy, 10); fresh(); });

  // ---------------------------------------------------------------- his glasses
  await page.evaluate(() => { calm(); game.interrupt(game.actDeskGlasses()); });
  await check('he puts his glasses down on his desk, rubs his eyes (blind), and he is half blind', `until(() => game.glassesAt === 'desk' && game.blind, 12) && game.halfBlind && game.teacher.glasses.parent === game.scene && game.objectives.some((o) => o.id === 'steal')`);
  await page.evaluate(() => { run(0.6); });
  await snap('sneak_glasses_rub.png');
  await check('half blind: he does not see you at your chair from farther than 2.4 m (the eye says HALF BLIND)', `until(() => !game.blind, 6) && game.me.dist > 2.4 && game.me.lookDot === -1 && document.getElementById('eye-label').textContent === 'HALF BLIND'`);
  await page.evaluate(() => { putAt(SPOT.glasses.x, SPOT.desk.z + 0.62, SPOT.glasses.x, SPOT.desk.z); });
  await check('in front of his desk: "hold [E] · take his glasses"', `/take his glasses/.test(document.getElementById('prompt').textContent)`);
  await page.evaluate(() => holdE(0.5));
  await check('you have his glasses (gone from the desk, mischief, counted)', `game.glassesAt === 'gone' && game.me.hasGlasses && !game.teacher.glasses.visible && game.stats.glasses === 1 && game.objDone('steal')`);
  await page.evaluate(() => { putAt(-0.7, -1.4); game.input.pressed.seat = true; run(0.8); });
  await check('he goes back for them: "My glasses." and he hunts for them, squinting', `until(() => saidNow(/t_myglasses/), 40) && game.glassesHunt && game.halfBlind`);
  await check('after the hunt: his spare pair from the drawer ("My spare pair."), he can see again', `until(() => saidNow(/t_sn_spare/), 40) && game.glassesAt === 'face' && !game.halfBlind && game.teacher.glasses.visible`);
  await page.evaluate(() => { fresh(); game.me.hasGlasses = true; stand(0.4, -5.6, 0, null); putAt(0.4, -3.4, 0.4, -6); game.teacher.lookAt(game.me.view, 30); });
  await check('caught with his glasses: "And these... are mine."', `until(() => caught('seat') === 1, 2) && until(() => saidNow(/t_sn_mine/), 20) && !game.me.hasGlasses`);
  await page.evaluate(() => fresh());

  // ---------------------------------------------------------------- his laptop, the clock
  await page.evaluate(() => { stand(3.5, -5.5, Math.PI, null); putAt(SPOT.laptop.x, SPOT.laptop.z, SPOT.laptop.x, -5); });
  await check('behind his desk: "hold [E] · read his laptop"', `/read his laptop/.test(document.getElementById('prompt').textContent)`);
  await page.evaluate(() => { game.input.keys.talk = true; run(0.8); });
  await check('holding E: READING HIS LAPTOP fills up (not yet read)', `game.stats.secrets === 0 && document.getElementById('aim-kind').textContent === 'READING HIS LAPTOP' && document.getElementById('aim-hud').classList.contains('show')`);
  await page.evaluate(() => { run(1.0); game.input.keys.talk = false; run(0.05); });
  await check('...it opens: what is on his laptop (a note on your screen), counted', `game.ui.noteOpen && /HIS LAPTOP/.test(document.getElementById('note-text').innerText) && game.stats.secrets === 1 && game.world.laptop.openTarget === 1`);
  await snap('sneak_laptop.png');
  await page.evaluate(() => { game.ui.closeNote(); run(3); });
  await check('the laptop shuts again', `game.world.laptop.openTarget === 0`);
  await page.evaluate(() => { putAt(SPOT.clock.x, SPOT.clock.z, SPOT.clock.x, -7); game.pitch = 0.9; });
  const before = await page.evaluate(() => game.clockMin);
  await page.evaluate(() => { game.input.keys.talk = true; run(1.0); });
  await check('under the clock, holding E: you stand up to reach it (your eyes go up)', `game.camera.position.y > 1.2`);
  await page.evaluate(() => { run(1.4); game.input.keys.talk = false; run(0.1); });
  await check('the clock is 15 minutes fast (Free Class: the bell rings sooner)', `game.clockAhead === 15 && game.clockMin - ${before} > 14 && game.stats.clocks === 1`);
  await page.evaluate(() => { game.input.keys.talk = false; fresh(); });
  await check('he checks the clock (the clock quirk): "That is not the time." and puts it right', `(() => { game.quirkOn = (q) => q === 'clock'; game.interrupt(game.actClock()); return until(() => saidNow(/t_sn_time/), 8) && until(() => game.clockAhead === 0, 8); })()`);
  await page.evaluate(() => { delete game.quirkOn; fresh(); });

  // ---------------------------------------------------------------- the whoopee cushion
  await page.evaluate(() => { stand(3.5, -5.5, Math.PI, null); putAt(SPOT.cushion.x + 0.5, SPOT.cushion.z, SPOT.cushion.x, SPOT.cushion.z); });
  await check('next to his chair: "hold [E] · whoopee cushion on his chair"', `/whoopee/.test(document.getElementById('prompt').textContent)`);
  await page.evaluate(() => holdE(0.8));
  await check('the cushion is on his chair (you have no more)', `game.cushion && game.cushion.by === game.me && game.cushionMesh.visible && game.me.cushions === 0 && game.deskNear(game.me) !== 'cushion'`);
  await page.evaluate(() => { putAt(-0.7, -1.4); game.input.pressed.seat = true; run(0.8); calm(); game.allowBlame = true; game.interrupt(game.actSit()); });
  await check('he sits down on it...', `until(() => game.sitting, 15) && until(() => game.teacher.crouch > 0.25 && game.teacher.footFwd > 0.15, 3)`);
  await snap('sneak_sit.png');
  await check('...PFFFRT: the class laughs, mischief, counted', `until(() => game.stats.cushions === 1, 4) && game.laugh > 30 && !game.cushion`);
  await check('"Who did it?" (it was you: the choice is yours)', `until(() => game.choice && /Who did it/.test(document.getElementById('choices-title').innerText), 15)`);
  await page.evaluate(() => { game.pickChoice(1, game.me); run(4); fresh(); });

  // ---------------------------------------------------------------- his habits, the end
  await check('he sits down now and then (and stands up again)', `(() => { game.interrupt(game.actSit()); const a = until(() => game.sitting, 15); run(12); return a && !game.sitting; })()`);
  await page.evaluate(() => { run(2); calm(); putAt(0.75, 3.0); game.clockAhead = 0; game.t = 299; game.clock.t0 = game.t - 300; });
  await check('the bell: everybody is back on their chair for the end', `until(() => game.ending, 6) && !game.me.out && game.me.slipK === 0`);
  await check('the end screen counts it (out of your seat, glasses, laptop, cushion, clock)', `until(() => game.state !== 'playing', 40) && /Out of your seat/.test(document.getElementById('end-stats').innerText)`);

  console.log(logs.length ? logs.join('\n') : 'no page errors');
  console.log('OK (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  if (bad.length) console.log('RESULT FAIL');
  await browser.close();
})();
