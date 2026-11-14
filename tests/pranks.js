// Phase 1: pranks you aim (hold G, let go to throw) and the laugh meter.
// Throws are found by searching with the same flight code the aim arc uses, then thrown for real.
const { chromium, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const ok = [], bad = [], logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
  const check = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  await page.evaluate(async () => {
    const g = window.game;
    window.PR = await import('/src/pranks.js');
    window.DATA = await import('/src/data.js');
    g.__render = g.post.render.bind(g.post);
    g.post.render = () => {};
    // nothing random gets in the way: no calls, texts, scares, videos, class clowns
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    window.run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { if (g.state !== 'playing') break; g.playTick(1 / 30); g.ui.update(1 / 30); } };
    window.calm = () => { g.anger = 0; g.flags = { r40: true, r70: true }; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; } };
    // he stands at the board, back to the class, doing nothing
    window.atBoard = (x = 0.6) => {
      const T = g.teacher;
      g.interrupt((function* () { T.place(x, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })());
      g.prankBusy = false; g.searching = false; g.echoBusy = false;
      g.me.prankStreak = 0; // (each scenario starts fresh: three hits on him in a row get you caught)
      run(0.6); calm();
    };
    // a throw (yaw, pitch, power) from your seat that hits what `want` says, found with the arc's own flight code
    window.findThrow = (aimAt, want, kind = 'ball') => {
      const me = g.me, targets = g.prankTargets();
      const out = { pts: Array.from({ length: 70 }, () => g.camPos.clone()), n: 0, hit: null, at: g.camPos.clone() };
      const sp = g.camPos.clone(), sv = g.camPos.clone();
      const d = aimAt.clone().sub(g.camPos);
      const y0 = Math.atan2(-d.x, -d.z);
      // the middle of the widest run of pitches that hit (an edge hit could miss by a centimetre)
      let best = null;
      for (const pw of [1, 0.8, 0.6, 0.45])
        for (let dy = 0; dy <= 0.12; dy += 0.02)
          for (const sy of dy ? [1, -1] : [1]) {
            const yaw = y0 + dy * sy;
            let run0 = null, len = 0;
            for (let pitch = -0.3; pitch <= 0.9; pitch += 0.01) {
              PR.throwStart(g.camPos, yaw, pitch, pw, kind, sp, sv);
              g.simThrow(sp, sv, kind, 0, me, targets, out);
              if (out.hit && want(out.hit)) { if (run0 === null) run0 = pitch; len++; }
              else if (run0 !== null) break;
            }
            if (run0 !== null && (!best || len > best.len)) best = { yaw, pitch: run0 + (len - 1) * 0.005, power: pw, kind, curve: 0, len };
          }
      return best;
    };
    window.fire = (t) => { g.me.foldT = 0; g.yaw = t.yaw; g.pitch = t.pitch; return g.throwFrom(g.me, t); };
    window.lastHit = () => g.track.log.filter((e) => e.type === 'hit').slice(-1)[0] || null;
    run(1);
  });

  // ---------------------------------------------------------------- aiming with the keyboard
  await page.evaluate(() => { atBoard(); game.yaw = 0.05; game.pitch = 0.15; });
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.6));
  await check('hold G: aiming, the arc and the paper in your hand show', `!!game.me.aim && game.arcDots.visible && game.heldPaper.visible && document.getElementById('aim-hud').classList.contains('show')`);
  await check('the power grows while you hold', `game.me.aim.power > 0.6`);
  await check('the keys legend tells you how to throw', `/let go of/.test(document.getElementById('keys-legend').innerText)`);
  await page.keyboard.press('x');
  await page.evaluate(() => run(0.1));
  await check('X switches to the paper plane', `game.me.aim.kind === 'plane' && game.heldMeshes.plane.visible`);
  await page.mouse.move(320, 180);
  await page.mouse.wheel(0, 120);
  await page.evaluate(() => run(0.1));
  // (from period 3 on, and in Free Class, the laser pointer and the KICK ME note come after the plane: tests/blame.js)
  await check('the mouse wheel switches to the next one (the laser pointer, in Free Class)', `game.me.aim.kind === 'laser'`);
  for (let i = 0; i < 2; i++) { await page.keyboard.press('x'); await page.evaluate(() => run(0.05)); }
  await check('...and round again to the paper ball', `game.me.aim.kind === 'ball'`);
  await page.keyboard.press('e');
  await page.evaluate(() => run(0.1));
  await check('E puts it away without throwing', `!game.me.aim && game.papers.length === 0 && game.stats.throws === 0`);
  await page.keyboard.up('g');
  await page.evaluate(() => run(0.05));
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.5));
  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('prank_aim.png') });
  await page.keyboard.up('g');
  await page.evaluate(() => run(0.05));
  await page.evaluate(() => run(0.3));
  await check('after the throw the aim readout is gone', `!document.getElementById('aim-hud').classList.contains('show') && !game.arcDots.visible`);
  await check('let go of G: the paper flies, the throw is counted', `game.papers.length === 1 && game.stats.throws === 1 && game.track.log.some((e) => e.type === 'throw')`);
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.1));
  await page.keyboard.up('g');
  await page.evaluate(() => run(0.05));
  await check('right after a throw the next one is still being folded (no throw)', `game.stats.throws === 1`);
  await page.evaluate(() => run(2));

  // ---------------------------------------------------------------- the plane
  await check('a paper plane glides farther than a ball, and it curves', `(() => {
    const g = game, sp = g.camPos.clone(), sv = g.camPos.clone(), tg = [];
    const land = (kind, curve) => { const out = { pts: Array.from({ length: 70 }, () => g.camPos.clone()), n: 0, hit: null, at: g.camPos.clone() };
      PR.throwStart(g.camPos, 0.06, 0.05, 0.35, kind, sp, sv); g.simThrow(sp, sv, kind, curve, g.me, tg, out); return out.at.clone(); };
    const b = land('ball', 0), p = land('plane', 0), pl = land('plane', 1), pr = land('plane', -1);
    const dist = (v) => Math.hypot(v.x - g.camPos.x, v.z - g.camPos.z);
    return dist(p) > dist(b) + 0.5 && Math.sign(pl.x - p.x) !== Math.sign(pr.x - p.x) && Math.abs(pl.x - pr.x) > 0.3 ? true : [dist(b), dist(p), pl.x, pr.x];
  })()`);

  // ---------------------------------------------------------------- his back
  await page.evaluate(() => { atBoard(); game.papers.length = 0; });
  const back = await page.evaluate(() => { const T = game.teacher; const t = findThrow(T.headWorld().add(game.camPos.clone().set(0, -0.7, 0)), (h) => h.type === 'teacher' && h.part === 'back'); if (t) { window.__t = t; fire(t); } return !!t; });
  (back ? ok : bad).push('found a throw that hits his back');
  await page.evaluate(() => run(1.2));
  await check('the arc was right: it hit his back', `(() => { const h = lastHit(); return h && h.target === 'teacher' && h.part === 'back' ? true : h; })()`);
  await check('the class laughs: LAUGHS meter up and shown', `game.laugh > 20 && !document.getElementById('laugh').classList.contains('off')`);
  await check('hitting his back completes the task', `game.objDone('prank')`);
  await check('he reacts (stops, spins around toward the class)', `game.prankBusy && Math.abs(((game.teacher.facingTarget % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI) < 1.3`);
  await page.evaluate(() => run(1.5));
  await check('"Who... threw... that."', `/threw/i.test(document.getElementById('subtitle').innerText)`);
  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('prank_back.png') });
  await check('one hit on him so far, counted for you', `game.me.prankStreak === 1 && game.track.of(game.me).hitHim === 1 && game.stats.hitHim === 1`);
  await page.evaluate(() => run(8));
  await check('he is done reacting and goes back to his lesson', `!game.prankBusy`);

  // ---------------------------------------------------------------- his head: the glasses
  await page.evaluate(() => { atBoard(-0.4); });
  const head = await page.evaluate(() => { const t = findThrow(game.teacher.headWorld(), (h) => h.type === 'teacher' && h.part === 'head'); if (t) fire(t); return !!t; });
  (head ? ok : bad).push('found a throw that hits his head');
  await page.evaluate(() => run(1.4));
  await check('head hit: his glasses fly off and he can\'t see', `(() => { const h = lastHit(); return h && h.part === 'head' && game.teacher.glasses.parent === game.scene && game.blind ? true : [h, game.teacher.glasses.parent && game.teacher.glasses.parent.type, game.blind]; })()`);
  await page.evaluate(() => run(0.7));
  await check('the glasses land on the floor', `game.teacher.glasses.getWorldPosition(game.camPos.clone()).y < 0.2`);
  await check('the eye on the HUD says he can\'t see', `document.getElementById('eye').getAttribute('class') === 'blind'`);
  await page.evaluate(() => { game.__render(game.scene, game.camera); });
  await page.screenshot({ path: shot('prank_glasses.png') });
  await page.evaluate(() => run(4.5));
  await check('he finds them and puts them back on', `game.teacher.glasses.parent === game.teacher.head && !game.blind`);
  await page.evaluate(() => run(8));

  // ---------------------------------------------------------------- the board while he writes
  await page.evaluate(() => { calm(); game.prankBusy = false; game.me.prankStreak = 0; game.interrupt(game.actWrite('PAPER IS FOR WRITING 123456')); });
  await page.waitForFunction(() => { run(0.1); return game.boardWriting(); }, null, { timeout: 30000 }).catch(() => {});
  const brd = await page.evaluate(() => { const t = findThrow(game.camPos.clone().set(1.6, 1.4, -6.9), (h) => h.type === 'board'); if (t) fire(t); return !!t; });
  (brd ? ok : bad).push('found a throw that hits the board');
  await page.evaluate(() => run(1.2));
  await check('board hit while he writes: he turns around (it counts as hitting him)', `(() => { const h = game.track.log.filter((e) => e.type === 'hit' && e.target === 'board').slice(-1)[0]; return h && h.writing && game.prankBusy ? true : [h, game.prankBusy]; })()`);
  await page.evaluate(() => run(10));

  // ---------------------------------------------------------------- a kid, a friend
  await page.evaluate(() => { atBoard(); });
  const kid = await page.evaluate(() => { const k = game.students.find((s) => s.name === 'Leo'); const t = findThrow(k.headWorld(), (h) => h.type === 'kid' && h.who === k); if (t) fire(t); return !!t; });
  (kid ? ok : bad).push('found a throw that hits Leo');
  await page.evaluate(() => run(0.8));
  await check('Leo: "Ow! Hey!", he looks around and shakes', `(() => { const h = lastHit(); const k = game.students.find((s) => s.name === 'Leo'); return h && h.target === 'kid' && h.who === 'Leo' && !!k.lookTarget ? true : h; })()`);
  // a throw back at you
  await page.evaluate(() => {
    const g = game, k = g.students.find((s) => s.name === 'Leo');
    g.__bonks = 0; const lb = g.localBonk.bind(g); g.localBonk = (f) => { g.__bonks++; return lb(f); };
    const r = Math.random; Math.random = () => 0.9; g.npcThrow(k, g.me); Math.random = r;
    run(2);
  });
  await check('a kid throws one back: it hits you ("bop")', `game.__bonks >= 1 && game.track.log.some((e) => e.type === 'throwBack')`);
  await page.evaluate(() => run(2));
  await page.evaluate(() => { atBoard(); });
  const sam = await page.evaluate(() => { const f = game.friend('sam'); const t = findThrow(f.headWorld(), (h) => h.type === 'friend' && h.who === f); if (t) fire(t); return !!t; });
  (sam ? ok : bad).push('found a throw that hits Sam');
  await page.evaluate(() => run(1));
  await check('Sam gets hit: "Ow! Hey!"', `(() => { const h = lastHit(); return h && h.target === 'friend' && h.who === 'Sam' ? true : h; })()`);
  await page.evaluate(() => run(12));

  // ---------------------------------------------------------------- the laugh meter
  await check('the meter drops back down over time', `game.laugh < 15`);
  await check('laughing multiplies your mischief (full meter: x2)', `(() => { const g = game; g.laugh = 100; g.laughHold = 5; run(0.05); const m0 = g.mischief; g.mischief += 10; run(0.05); return Math.abs(g.mischief - m0 - 20) < 1.5 ? true : g.mischief - m0; })()`);
  await check('the class laughing at you is noise he hears', `(() => { const g = game; g.laugh = 70; g.laughHold = 5; g.laughAbout = g.me; run(0.1); return g.me.noise > 0.3 ? true : g.me.noise; })()`);
  await check('...but not for somebody far from it', `(() => { const g = game; g.laughAbout = null; g.laughAt.set(4, 1, 4); run(0.1); return g.me.noise === 0 ? true : g.me.noise; })()`);
  await page.evaluate(() => { game.laugh = 0; calm(); });

  // ---------------------------------------------------------------- things the review found
  await page.evaluate(() => { atBoard(); });
  await check('a prank never calms him down (anger 95, hit a kid: still >= 95)', `(() => { const g = game, k = g.students.find((s) => s.name === 'Omar');
    const t = findThrow(k.headWorld(), (h) => h.type === 'kid' && h.who === k); if (!t) return 'no throw'; g.anger = 95; g.flags = { r40: true, r70: true }; fire(t); run(0.8);
    const a = g.anger; calm(); return a >= 95 ? true : a; })()`);
  await page.evaluate(() => { run(3); atBoard(); const f = game.friend('sam'), d = f.headWorld().sub(game.camPos); game.yaw = Math.atan2(-d.x, -d.z); game.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); game.me.foldT = 0; });
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.3));
  await page.keyboard.down('e');
  await page.evaluate(() => run(0.5));
  await check('E puts the paper away and does NOT start a whisper to Sam (still holding E)', `!game.me.aim && !game.talk`);
  await page.keyboard.up('e'); await page.keyboard.up('g');
  await page.evaluate(() => run(0.1));
  await check('...letting go of E and pressing it again whispers as usual', `(() => { game.input.keys.talk = true; run(0.3); const ok = !!game.talk; game.input.keys.talk = false; run(0.1); return ok; })()`);
  await check('X does nothing while pranks are not allowed (no switch, no hint)', `(() => { const g = game; g.allowPrank = false; const k = g.me.prankKind; g.ui.hint('story hint', 5); g.input.pressed.swap = true; run(0.1);
    const r = g.me.prankKind === k && /story hint/.test(document.getElementById('hint').innerText); g.allowPrank = true; return r; })()`);
  await check('a kid he scolds stops shaking even if he is interrupted', `(() => { const g = game, k = g.students.find((s) => s.name === 'Max'); g.prankBusy = false;
    g.interrupt(g.reactSawKid(k)); run(4.9); const mid = k.tremble > 0; atBoard(); return mid && k.tremble === 0 ? true : [mid, k.tremble]; })()`);

  // ---------------------------------------------------------------- pausing
  await page.keyboard.down('g');
  await page.evaluate(() => run(0.3));
  await page.evaluate(() => { game.input.onPause(); });
  await page.waitForTimeout(300);
  await check('Esc pauses the class', `game.state === 'paused'`);
  await page.evaluate(() => { document.getElementById('btn-resume').click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => run(0.1));
  await page.keyboard.up('g');
  await page.evaluate(() => run(0.1));
  await check('pausing while aiming drops the paper (nothing thrown on resume)', `!game.me.aim && game.track.log.filter((e) => e.type === 'throw').length === game.stats.throws`);
  const t0 = await page.evaluate(() => game.stats.throws);

  // ---------------------------------------------------------------- caught
  // three hits on him in a row: he knows it was you
  await page.evaluate(() => { atBoard(); game.me.prankStreak = 2; game.me.lastPrankHit = game.t; });
  await page.evaluate(() => { const t = findThrow(game.teacher.headWorld().add(game.camPos.clone().set(0, -0.7, 0)), (h) => h.type === 'teacher' && h.part === 'back'); if (t) fire(t); run(4); });
  await check('third hit on him: caught for pranks (strike)', `game.track.of(game.me).caughtFor.prank === 1 && game.strikes === 1`);
  await check('"Paper... is for... writing."', `game.track.log.some((e) => e.type === 'caught' && e.reason === 'prank')`);
  await page.evaluate(() => run(14));
  // he looks right at you while your arm is up
  await page.evaluate(() => { const g = game, T = g.teacher; calm(); g.interrupt((function* () { T.place(0, -4.6, 0); T.lookAt(g.camPos, 20); for (;;) yield; })()); run(1); calm(); });
  await page.keyboard.down('g');
  await page.evaluate(() => run(1.2));
  await page.keyboard.up('g');
  await check('he looks right at you while you aim: caught (same rule on Easy and Hard)', `game.track.of(game.me).caughtFor.prank === 2 && game.strikes === 2`);
  await check('getting caught took the paper out of your hand', `!game.me.aim && game.stats.throws === ${t0 + 1}`);
  await page.evaluate(() => run(14));
  // the end screen counts it
  await page.evaluate(() => { game.finish('survived'); });
  await check('the end screen shows the papers thrown', `/Paper thrown/.test(document.getElementById('end-stats').innerText)`);
  await check('nothing left on screen after the class', `!game.arcDots.visible && !game.heldPaper.visible`);
  // the class ends while his glasses are on the floor: he still has them on for the ending
  await page.evaluate(() => { game.start('free', 0); run(1); atBoard(-0.4); });
  await page.evaluate(() => { const t = findThrow(game.teacher.headWorld(), (h) => h.type === 'teacher' && h.part === 'head'); if (t) fire(t); run(1.6); });
  await check('(glasses knocked off again)', `game.teacher.glasses.parent === game.scene`);
  await page.evaluate(() => { game.ending = true; game.interrupt(game.freeEnding()); run(0.2); });
  await check('the class ends while his glasses are on the floor: he has them on for the ending', `game.teacher.glasses.parent === game.teacher.head && !game.blind`);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
