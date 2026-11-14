// Phase 3: the laser pointer (he chases the red dot like a cat; in his eyes he finds you), the KICK ME
// note (stick it on as he walks past; the class laughs when he turns away), and "Who did it?" (point at
// a kid, say nothing, confess; a lie he sees through, a kid who tells on you later).
// Free Class with no events or quirks, nothing random in the way; the game is ticked by hand.
const { chromium, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const ok = [], bad = [], logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
  const check = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free&events=none&quirks=none');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  await page.evaluate(async () => {
    const D = await import('/src/data.js');
    D.BLAME.friendGoat = 0; // ("Point at...": always the nearest classmate here, so the grudge can be tested)
    const g = window.game, V = g.camPos.constructor;
    window.V = V;
    g.__render = g.post.render.bind(g.post);
    g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    // what he and the kids say
    window.said = [];
    const ts = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return ts(id, v); };
    const sa = g.sayAt.bind(g); g.sayAt = (c, id, n, v) => { said.push(id); return sa(c, id, n, v); };
    const ps = g.playerSay.bind(g); g.playerSay = (id, p) => { said.push(id); return ps(id, p); };
    window.saidNow = (re) => said.some((x) => re.test(x));
    window.run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { if (g.state !== 'playing') break; g.playTick(1 / 30); g.ui.update(1 / 30); } };
    window.until = (fn, sec) => { for (let i = 0; i < sec * 30; i++) { if (fn()) return true; if (g.state !== 'playing') return fn(); g.playTick(1 / 30); g.ui.update(1 / 30); } return fn(); };
    window.calm = () => { g.anger = 0; g.flags = { r40: true, r70: true }; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; p.prankStreak = 0; p.lastEcho = -99; p.watchedT = 0; } };
    // he stands somewhere doing nothing (facing 0: the class; Math.PI: the board)
    window.stand = (x, z, facing) => {
      const T = g.teacher;
      g.cat = null; g.catCool = 0; g.blameBusy = false; g.prankBusy = false; g.searching = false;
      g.interrupt((function* () { T.place(x, z, facing); T.lookAt(null); T.setPose('rest'); for (;;) yield; })());
      run(0.5); calm();
    };
    window.lookAt = (v) => { const d = v.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); run(0.05); };
    window.hold = (kind) => { g.me.prankKind = kind; g.input.keys.prank = true; run(0.1); };
    window.letGo = () => { g.input.keys.prank = false; run(0.05); };
    // strikes for a reason since the last fresh()
    window.base = {};
    window.caught = (r) => (g.track.of(g.me).caughtFor[r] || 0) - (base[r] || 0);
    window.fresh = () => { // after a busted scene: back to a clean class
      until(() => !g.cutscene, 30); letGo(); run(0.3); calm(); g.strikes = 0; said.length = 0;
      base = { ...g.track.of(g.me).caughtFor };
      for (const k of g.allKids()) k.grudge = null;
    };
    run(1);
  });

  // ---------------------------------------------------------------- the tools
  await check('Free Class: the laser pointer and KICK ME notes are there (with paper)', `JSON.stringify(game.toolKinds(game.me)) === '["ball","plane","laser","note"]' && game.allowBlame`);
  await page.evaluate(() => { stand(0.5, -5.6, Math.PI); game.yaw = 0; game.pitch = 0.1; game.me.prankKind = 'ball'; });
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.2));
  const cycle = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('x'); cycle.push(await page.evaluate(() => { run(0.05); return game.me.aim && game.me.aim.kind; })); }
  (cycle.join(',') === 'plane,laser,note,ball' ? ok : bad).push('X goes paper ball → plane → laser → note → ball (' + cycle.join(',') + ')');
  for (let i = 0; i < 2; i++) { await page.keyboard.press('x'); await page.evaluate(() => run(0.05)); } // (one game frame per press)
  await page.evaluate(() => run(0.1));
  await check('holding the laser: the pointer in your hand, a red dot, no arc, LASER POINTER and no power bar', `game.me.aim.kind === 'laser' && game.heldMeshes.laser.visible && game.laserDots[0].visible && !game.arcDots.visible && document.getElementById('aim-kind').textContent === 'LASER POINTER' && document.getElementById('aim-hud').classList.contains('nobar')`);
  await check('the dot lands where you look (the board)', `game.me.laserOn && game.me.laserHit.type === 'board'`);
  await check('touch: the ASK button says LASER, the legend says how', `document.getElementById('btn-ask').textContent === 'LASER' && /laser off/.test(document.getElementById('keys-legend').innerText)`);
  await page.keyboard.up('g');
  await page.evaluate(() => run(0.1));
  await check('let go: the dot is gone, nothing thrown', `!game.me.laserOn && !game.laserDots[0].visible && game.stats.throws === 0`);

  // ---------------------------------------------------------------- the cat and the red dot
  await page.evaluate(() => { stand(0.6, -5.2, 0); game.teacher.lookAt(game.camPos, 20); run(0.3); lookAt(new V(2.2, 0, -3.4)); hold('laser'); run(0.4); });
  await check('the laser up while he looks right at you: caught at once (like an arm up)', `until(() => caught('laser') === 1, 3)`);
  await page.evaluate(() => fresh());
  await page.evaluate(() => { stand(0.6, -5.2, 0); game.catCool = 0; game.teacher.lookAt(new V(2.2, 0, -3.4), 20); run(0.4); lookAt(new V(2.2, 0, -3.4)); hold('laser'); });
  await check('the dot on the floor in front of him (he looks at the floor, not at you)', `game.me.laserHit && game.me.laserHit.type === 'floor' && game.me.lookDot < 0.8`);
  await check('he sees it: "What is that?" and he goes after it', `until(() => game.cat && saidNow(/t_lz_what/), 4)`);
  await check('he paws at it (the class laughs, mischief, counted)', `until(() => game.stats.paws >= 1, 6) && game.laugh > 5 && game.track.log.some((e) => e.type === 'paw')`);
  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('blame_laser.png') });
  const before = await page.evaluate(() => ({ x: game.teacher.pos.x, z: game.teacher.pos.z }));
  await page.evaluate(() => { lookAt(new V(-1.6, 0, -3.6)); run(2.2); });
  const after = await page.evaluate(() => ({ x: game.teacher.pos.x, z: game.teacher.pos.z }));
  (after.x < before.x - 0.8 ? ok : bad).push(`move the dot and he follows it (x ${before.x.toFixed(2)} → ${after.x.toFixed(2)})`);
  await check('while he chases it, an arm up does not count', `game.cat && game.cat.phase === 'chase' && game.me.prankSeenT === 0 && game.strikes === 0`);
  await check('in the end he gets it: "A trick." (he looks down the beam)', `until(() => game.cat && game.cat.phase === 'trick', 16) && saidNow(/t_lz_trick/)`);
  await check('the laser still on when he looks at you: caught (laser)', `until(() => caught('laser') === 1, 4)`);
  await page.evaluate(() => fresh());

  // the dot goes off: "Where did it go?"
  await page.evaluate(() => { stand(0.6, -5.2, 0); game.catCool = 0; game.teacher.lookAt(new V(2.2, 0, -3.4), 20); run(0.4); lookAt(new V(2.2, 0, -3.4)); hold('laser'); until(() => game.cat && game.cat.phase === 'chase', 4); run(0.6); letGo(); });
  await check('the dot gone: "Where did it go?", he looks around and gives up', `until(() => !game.cat, 8) && saidNow(/t_lz_gone/) && game.strikes === 0`);
  await check('...and ignores the dot for a while after', `game.catCool > game.t + 5`);

  // let go right after "A trick.": he comes to your desk and asks
  await page.evaluate(() => { stand(0.6, -5.2, 0); game.catCool = 0; said.length = 0; game.teacher.lookAt(new V(2.2, 0, -3.4), 20); run(0.4); lookAt(new V(2.2, 0, -3.4)); hold('laser'); until(() => game.cat && game.cat.phase === 'trick', 22); letGo(); });
  await check('let go in time after "A trick.": not caught...', `game.strikes === 0 && !game.me.laserOn`);
  await check('...he comes to your desk: "You. Who did it?" and the choice opens', `(until(() => !!game.choice, 12) && saidNow(/t_bl_ask/) && game.choice.labels.length === 3 && /^Point at /.test(game.choice.labels[0]) && game.choice.labels[1] === 'Say nothing' && game.choice.labels[2] === 'Confess') || JSON.stringify({ cat: game.cat && game.cat.phase, said: said.slice(-8), st: game.strikes, cut: game.cutscene, busy: game.blameBusy, x: game.teacher.pos.x, z: game.teacher.pos.z, brainIdle: game.brainIdle })`);
  await check('the choice says how sure he is (the beam: a fair guess)', `/Who did it\\?/.test(document.getElementById('choices-title').textContent)`);
  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('blame_choice.png') });
  await page.evaluate(() => { game.anger = 60; game.pickChoice(2); });
  await check('confess (the first time): "Honest. Do not do it again." His anger halves, no strike', `until(() => game.track.log.some((e) => e.type === 'blame' && e.result === 'confessed'), 10) && saidNow(/p_bl_me/) && saidNow(/t_bl_honest/) && game.anger <= 31 && game.strikes === 0 && game.track.of(game.me).confessed === 1`);
  await page.evaluate(() => fresh());

  // in his eyes
  await page.evaluate(() => { stand(0.4, -4.4, 0); game.teacher.lookAt(game.camPos.clone().add(new V(2.6, 0, 0)), 20); run(0.6); lookAt(game.teacher.headWorld(new V())); hold('laser'); });
  await check('(he faces your way but isn\'t looking right at you)', `game.me.lookDot > 0.35 && game.me.lookDot < 0.8 && game.strikes === 0`);
  await check('the dot in his face', `game.me.laserHit && game.me.laserHit.type === 'teacher' && game.me.laserHit.part === 'face'`);
  await check('"My eyes." and he looks right down the beam: still on, caught', `until(() => caught('laser') === 1, 5) && saidNow(/t_lz_eyes/)`);
  await page.evaluate(() => fresh());
  await page.evaluate(() => { stand(0.4, -4.4, 0); game.teacher.lookAt(game.camPos.clone().add(new V(2.6, 0, 0)), 20); run(0.6); lookAt(game.teacher.headWorld(new V())); hold('laser'); until(() => saidNow(/t_lz_eyes/), 3); letGo(); });
  await check('in his eyes but off quickly: no strike, he comes over and asks', `until(() => !!game.choice, 12) && game.strikes === 0`);
  await page.evaluate(() => { game.pickChoice(2); });
  await check('confess a second time: "Again?" and a strike', `until(() => caught('confess') === 1, 6) && saidNow(/t_bl_again/)`);
  await page.evaluate(() => fresh());

  // on his back: the class giggles, he doesn't notice
  await page.evaluate(() => { stand(0.4, -5.0, Math.PI); game.catCool = 0; game.laugh = 0; lookAt(game.teacher.local(0, 1.1, -0.2, new V())); hold('laser'); run(1.0); });
  await check('the dot on his back: the class giggles, he doesn\'t chase it', `game.me.laserHit.type === 'teacher' && game.me.laserHit.part !== 'face' && game.laugh > 3 && !game.cat`);
  await page.evaluate(() => letGo());

  // ---------------------------------------------------------------- KICK ME
  await page.evaluate(() => { fresh(); stand(0.5, -5.6, Math.PI); game.yaw = 0; game.pitch = 0; hold('note'); });
  await check('holding the note: KICK ME NOTE (not in reach), the note in your hand', `game.heldMeshes.note.visible && document.getElementById('aim-kind').textContent === 'KICK ME NOTE' && /wait until he walks past/.test(game.aimLabel)`);
  await page.evaluate(() => letGo());
  await check('let go too far away: "Too far", the note is kept', `game.me.notesLeft === 2 && !game.kickNote && /Too far/.test(document.getElementById('hint').innerText)`);
  // he walks past your desk and stops just past it, his back to you
  await page.evaluate(() => { stand(0.75, -0.75, 0); game.yaw = 0; game.pitch = -0.1; hold('note'); });
  await check('he is right past your desk, back to you: "→ his back: let go to stick it"', `game.noteReach(game.me) && /let go to stick it/.test(game.aimLabel)`);
  await page.evaluate(() => letGo());
  await check('let go: KICK ME is on his back (counted, mischief, one note left)', `!!game.kickNote && game.kickNote.owner === game.me && game.me.notesLeft === 1 && game.stats.kickme === 1 && game.backNote.visible`);
  await page.evaluate(() => { stand(0.75, -0.75, 0); game.kickNote.foundAt = game.t + 99; game.laugh = 0; });
  await page.evaluate(() => { stand(0.3, -5.6, Math.PI); run(0.5); });
  await check('he turns his back on the class: they laugh at the note', `game.kickNote.laughs >= 1 && game.laugh > 5 && game.track.of(game.me).noteLaughs >= 1`);
  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('blame_kickme.png') });
  await check('the arm-up rule: no catch from behind his back', `game.strikes === 0`);
  // a kid tells him
  await page.evaluate(() => { game.kickNote.foundAt = game.t; said.length = 0; game.interrupt((function* () { for (let i = 0; i < 3; i++) yield; })()); });
  await check('a kid: "Sir! There is something on your back!"; he: "What is on my back?"', `until(() => saidNow(/k_bl_back/) && saidNow(/t_bl_back/), 10)`);
  await check('he tears it off and reads it: "Kick... me."', `until(() => saidNow(/t_bl_kickme/), 8) && !game.kickNote`);
  await check('then he comes to your desk: who did it?', `until(() => !!game.choice, 15) && saidNow(/t_bl_ask/)`);
  const goat = await page.evaluate(() => game.choice.labels[0].replace('Point at ', ''));
  await page.evaluate(() => { calm(); window.__rand = Math.random; Math.random = () => 0.9; game.pickChoice(0); });
  await check(`point at ${goat} while he isn't sure: he believes you ("ooooh"), counted`, `until(() => game.stats.blamed === 1, 12) && saidNow(/p_bl_them/) && game.strikes === 0 && saidNow(/t_bl_watch/)`);
  const grudge = await page.evaluate(() => { Math.random = window.__rand; const k = game.allKids().find((x) => x.grudge); return k ? k.name : null; });
  (grudge === goat ? ok : bad).push(`${goat}: "What? Me?" and they remember it (grudge: ${grudge})`);
  if (grudge) {
    // revenge: the next time you're up to something, they tell him
    await page.evaluate(() => { stand(0.3, -5.6, Math.PI); const k = game.allKids().find((x) => x.grudge); k.grudge.at = game.t; said.length = 0; game.input.keys.phone = true; });
    await check('the kid you blamed tells on you: "Sir! Sir! Look!" and he turns to you', `until(() => saidNow(/k_bl_tell/), 4) && until(() => game.me.lookDot > 0.8, 3)`);
    await page.evaluate(() => { game.input.keys.phone = false; run(3); });
    await check('...the toldOn event is in the class log', `game.track.log.some((e) => e.type === 'toldOn')`);
  }
  await page.evaluate(() => fresh());

  // a lie he sees through
  await page.evaluate(() => { stand(0.3, -5.6, Math.PI); game.me.heat = 70; said.length = 0; game.interrupt(game.askWhoDidIt(game.me, 'note')); });
  await check('you are the obvious suspect: the choice says he looks sure', `until(() => !!game.choice, 15) && /looks sure/.test(document.getElementById('choices-title').textContent)`);
  await page.evaluate(() => { game.pickChoice(0); });
  await check('point at a kid anyway: "No. I do not believe you." and a strike (lie)', `until(() => caught('lie') === 1, 10) && saidNow(/t_bl_no/)`);
  await page.evaluate(() => fresh());
  // say nothing
  await page.evaluate(() => { stand(0.3, -5.6, Math.PI); said.length = 0; game.interrupt(game.askWhoDidIt(game.me, 'note')); until(() => !!game.choice, 15); game.pickChoice(1); });
  await check('say nothing: "I am watching you." He watches you now (no strike)', `until(() => game.me.watchedT > 0, 8) && saidNow(/t_bl_watch/) && game.me.watchedT > 15 && game.strikes === 0 && game.track.log.some((e) => e.type === 'blame' && e.result === 'silent')`);
  await page.evaluate(() => fresh());

  // seen sticking it on
  await page.evaluate(() => { stand(0.75, -0.75, 0); game.me.notesLeft = 1; hold('note'); game.teacher.lookAt(game.camPos, 30); run(1.2); });
  await check('he looks right at you while you hold the note out: caught (kickme)', `caught('kickme') === 1`);
  await page.evaluate(() => fresh());

  // two hits on his back: he searches the rows and (at your desk) asks who did it
  await page.evaluate(() => {
    stand(0.3, -5.6, Math.PI);
    const r = Math.random; Math.random = () => 0.05; // (he follows the sound to your row)
    window.__rand = r;
    game.me.prankStreak = 1; game.me.lastPrankHit = game.t;
    game.hitTeacher(game.me, 'back', game.teacher.headWorld(new V()));
  });
  await check('a second hit on his back: he searches and asks you at your desk', `until(() => !!game.choice, 30) && saidNow(/t_bl_ask/)`);
  await page.evaluate(() => { Math.random = window.__rand; game.pickChoice(1); run(4); });
  await check('...and the search ends there (no strike, he goes back)', `until(() => !game.searching, 20) && game.strikes === 0`);

  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('blame_end.png') });
  await check('the end screen line counts it all', `/KICK ME notes: <b>1<\\/b>/.test(game.statsHtml()) && /Kids you blamed: <b>1<\\/b>/.test(game.statsHtml())`);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
