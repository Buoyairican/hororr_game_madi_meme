// Phase 5 online (host + a friend, later a third who joins in the middle): everybody has their own
// breath; he leans over a friend's desk (the friend holds B on their screen, the host decides, everyone
// sees him bend over); he creeps up on a friend who stares at their phone; the board, the posters and
// the seats change for everyone the same, and only while NO player looks; a late joiner gets all of it;
// a friend who leaves while he listens at their desk; everybody's own line on the end screen.
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
  const waitFor = (page, expr, ms = 15000, arg) => page.waitForFunction(expr, arg, { timeout: ms }).then(() => true, () => false);
  const say = (good, name) => (good ? ok : bad).push(name);
  // a picture for the review (a capture can stall once on a busy machine: then it is taken again)
  const shoot = async (pg, name) => {
    for (let i = 0; i < 5; i++) {
      await pg.evaluate(() => snap());
      if (await pg.screenshot({ path: shot(name), timeout: 10000 }).then(() => true, () => false)) return;
    }
    console.log('(no picture: ' + name + ')');
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
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 20000);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 20000);
  const common = async () => {
    const g = window.game;
    window.DATA = await import('/src/data.js');
    window.DR = DATA.DREAD;
    g.__render = g.post.render.bind(g.post);
    g.post.render = () => {};
    g.input.requestLock = () => {};          // no pointer lock (screen captures stall while the pointer is locked)
    g.input.wantLock = false;
    if (document.pointerLockElement) document.exitPointerLock();
    window.snap = () => { g.render(0); g.__render(g.scene, g.camera); };
    window.hud = () => { const el = document.getElementById('breath-hud'); return { show: el.classList.contains('show'), cls: el.className, label: document.getElementById('breath-label').innerText.replace(/\s+/g, ' ').trim() }; };
    window.hint = () => document.getElementById('hint').innerText.replace(/\n/g, ' ');
    window.sub = () => document.getElementById('subtitle').innerText.replace(/\n/g, ' ');
    window.who = (name) => g.players.find((x) => x.name === name || x.id === name);
    window.lookAt = (pt) => { const d = pt.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
    g.__stings = [];
    const st0 = g.dreadStingLocal.bind(g);
    g.dreadStingLocal = (k) => { g.__stings.push(k); return st0(k); };
    g.__snd = [];
    const play0 = g.audio.play.bind(g.audio);
    g.audio.play = (n, o) => { g.__snd.push(n); return play0(n, o); };
  };
  await H.evaluate(common); await G.evaluate(common);
  // the host: no intro, no bell, nothing random; he stands at the board with his back to the class
  await H.evaluate(() => {
    const g = game, T = g.teacher;
    g.script = null;
    g.idleKind = 'lesson'; g.memesOn = true; g.allowEcho = g.allowAsk = g.allowPrank = true;
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    g.idleBrain = function* () { T.lookAt(null); T.faceTo(Math.PI, 6); T.setPose('rest'); for (;;) yield; };
    g.interrupt((function* () { T.place(0.5, -6.3, Math.PI); yield; })());
    const D = g.dread;
    D.nextCreep = D.nextLean = D.nextChange = 1e9;
    setInterval(() => { g.anger = 0; g.flags = { r40: true, r70: true }; if (g.t > 200) g.t = 80; }, 200); // (he stays calm; the morning never ends)
    g.t = 80;                                               // the second hour: everything is on
    DR.breath.lean.easy = [3, 3]; DR.breath.first = 2.5; DR.creep.pause.easy = 1.3; DR.creep.speed.easy = 0.9;
    window.lean = (name) => g.interrupt(g.dreadLean(who(name), { from: 'visit' }));
    g.dreadVisits = () => {};                               // (he only comes over when the test says so)
    // one change per request: after a change nothing else changes until the test asks again
    const dc = g.dreadChange.bind(g);
    g.dreadChange = (k, r) => { const done = dc(k, r); if (done) setTimeout(() => { g.dread.nextChange = 1e9; }, 0); return done; };
    window.phase = () => (g.dread.lean ? g.dread.lean.phase : '');
  });
  await H.waitForTimeout(1500);

  // ---------------------------------------------------------------- everybody has their own breath
  await G.evaluate(() => { game.input.keys.breath = true; });
  say(await waitFor(H, () => who('Bo').holding && who('Bo').breath < 0.97, 5000), 'host: the friend holds their breath (their own meter runs down on the host)');
  say(await waitFor(G, () => hud().show && game.me.breath < 0.97 && game.me.holding, 5000), 'friend: their own BREATH meter shows and goes down');
  await check(G, 'friend: hears themselves breathe in', `game.__snd.includes('dread_inhale')`);
  say(await waitFor(H, () => who('Bo').avatar && who('Bo').avatar.c.tremble > 0, 3000), 'host: the friend at their desk is visibly holding it in');
  await G.evaluate(() => { game.input.keys.breath = false; });
  say(await waitFor(H, () => !who('Bo').holding, 5000), 'host: the friend let go');
  await check(H, 'host: counted for the friend, not for the host', `game.track.of(who('Bo')).breath_time > 0.3 && game.track.of(game.me).breath_time === 0`);
  await H.evaluate(() => { game.input.keys.breath = true; });
  say(await waitFor(G, () => who('host').netHold && who('host').avatar && who('host').avatar.c.tremble > 0 && who('host').breath < 0.97, 5000), 'friend: sees the host holding their breath');
  await check(G, 'friend: their own meter is not the host\'s', `game.me.breath > 0.9 && !game.me.holding`);
  await H.evaluate(() => { game.input.keys.breath = false; });
  await H.waitForTimeout(3500);

  // ---------------------------------------------------------------- he leans over the friend's desk
  await H.evaluate(() => lean('Bo'));
  say(await waitFor(G, () => game.dreadLeanOn() === 'grace', 20000), 'friend: he bends over THEIR desk (their screen knows)');
  await check(G, 'friend: the big prompt and the hint with their key', `/now/.test(hud().cls) && /^HOLD YOUR BREATH\\s*B$/.test(hud().label) && /Hold B to hold your breath/.test(hint())`);
  await check(H, 'host: reads that he is listening at the friend\'s desk; the host\'s own meter stays quiet', `/listening at Bo's desk/.test(hint()) && !/lean/.test(hud().cls) && game.dreadLeanOn() === '' && game.dreadLeanOn(who('Bo')) !== ''`);
  await G.evaluate(() => { game.input.keys.breath = true; });
  say(await waitFor(H, () => phase() === 'hold', 8000), 'host: he is listening now');
  await check(G, 'friend: sees him folded over their desk, right there', `(() => { const g = game, T = g.teacher; return T.headWorld().distanceTo(g.camPos) < 1.7 && T.rest.root.y - T.bones.root.position.y > 0.2 ? true : [T.headWorld().distanceTo(g.camPos), T.rest.root.y - T.bones.root.position.y]; })()`);
  await G.evaluate(() => snap());
  await shoot(G, 'mp_dread_lean_guest.png');
  await check(H, 'host: sees him lean over the friend', `(() => { const g = game, T = g.teacher, bo = who('Bo'); return T.headWorld().distanceTo(g.headOf(bo)) < 1.7 && T.crouch > 0.2; })()`);
  await H.evaluate(() => snap());
  await shoot(H, 'mp_dread_lean_host.png');
  say(await waitFor(H, () => game.track.of(who('Bo')).breath_hold === 1, 10000), 'host: the friend held their breath and kept still: he heard nothing');
  say(await waitFor(G, () => game.dreadLeanOn() === '' && /He heard nothing/.test(hint()), 5000), 'friend: told that he heard nothing');
  await G.evaluate(() => { game.input.keys.breath = false; });
  await waitFor(H, () => !game.dread.lean && game.brainIdle, 20000);
  // again, and this time the friend moves
  await H.evaluate(() => lean('Bo'));
  await waitFor(G, () => game.dreadLeanOn() === 'grace', 20000);
  await G.evaluate(() => { game.input.keys.breath = true; });
  await waitFor(H, () => phase() === 'hold', 8000);
  await H.waitForTimeout(600);
  await G.evaluate(() => { game.yaw += 0.35; });
  say(await waitFor(H, () => game.track.of(who('Bo')).breath_fail === 1 && game.track.log.some((e) => e.type === 'breathFail' && e.why === 'moved' && e.who === who('Bo').id), 5000), 'host: the friend moved their view: he noticed');
  say(await waitFor(G, () => game.__stings.includes('fail') && /You moved/.test(hint()), 5000), 'friend: the jolt and the reason on their screen only');
  await check(H, 'host: no jolt on the host\'s screen, heat for the friend, no strike on Easy', `!game.__stings.includes('fail') && who('Bo').heat > 5 && game.strikes === 0`);
  await G.evaluate(() => { game.input.keys.breath = false; game.yaw = 0; });
  await waitFor(H, () => !game.dread.lean && game.brainIdle, 25000);

  // ---------------------------------------------------------------- he leans over the host: the friend watches
  await H.evaluate(() => lean('host'));
  say(await waitFor(G, () => game.dreadLeanOn(who('host')) !== '' && game.dreadLeanOn() === '', 20000), 'friend: he listens at the host\'s desk now (not theirs)');
  await check(G, 'friend: sees him bent over the host, and reads it', `(() => { const g = game, T = g.teacher, h = who('host'); return T.headWorld().distanceTo(g.headOf(h)) < 1.7 && /listening at Alex's desk/.test(hint()) && !/lean/.test(hud().cls) ? true : [T.headWorld().distanceTo(g.headOf(h)), hint()]; })()`);
  await G.evaluate(() => { lookAt(game.headOf(who('host'))); });
  await G.waitForTimeout(400);
  await G.evaluate(() => snap());
  await shoot(G, 'mp_dread_watch.png');
  await G.evaluate(() => { game.yaw = 0; game.pitch = 0; });
  await H.evaluate(() => { game.input.keys.breath = true; });
  say(await waitFor(H, () => game.track.of(game.me).breath_hold === 1, 12000), 'host: holds their own breath, he heard nothing');
  await H.evaluate(() => { game.input.keys.breath = false; });
  await waitFor(H, () => !game.dread.lean && game.brainIdle, 20000);

  // ---------------------------------------------------------------- he creeps up on the friend
  await G.evaluate(() => { game.input.keys.phone = true; });
  await waitFor(H, () => who('Bo').phoneUp && who('Bo').phoneT > 0.5, 5000);
  await H.evaluate(() => { game.__snd.length = 0; game.startCreep(who('Bo')); });
  say(await waitFor(G, () => /the lights dim/.test(sub()), 20000), 'friend: gets the tells on their screen (the caption)');
  say(await waitFor(G, () => game.dread.dim > 0.3 && game.world.lights.banks[0].target < 0.85, 5000), 'friend: the lights at the front dim on their screen too');
  await check(G, 'friend: he comes backwards (his back to the class)', `(() => { const a = game.teacher.root.rotation.y - Math.PI; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.5; })()`);
  await waitFor(H, () => game.dread.creep && game.dread.creep.stage >= 2, 15000);
  await G.evaluate(() => { game.input.keys.phone = false; });
  say(await waitFor(H, () => game.track.of(who('Bo')).dread_spotted === 1, 5000), 'host: the friend looked up in time (counted for them)');
  await check(H, 'host: not one footstep while he crept', `!game.__snd.some((n) => /^step_/.test(n)) && game.track.of(who('Bo')).dread_creep === 1`);
  say(await waitFor(G, () => /backwards/.test(hint()), 4000), 'friend: the hint about walking backwards');
  await waitFor(H, () => !game.dread.creep && game.brainIdle, 25000);
  say(await waitFor(G, () => game.dread.dim < 0.05, 8000), 'friend: the lights come back');

  // ---------------------------------------------------------------- changes: the same for everyone, only while NO player looks
  // a poster on the right wall
  await H.evaluate(() => {
    const g = game, D = g.dread;
    window.only = (i) => { const x = g.dreadPosters[i]; g.dreadCandidates = () => (x.stage < 2 ? [{ id: 'poster' + i, kind: 'poster', poster: x, pts: g.dreadPosterPts(x) }] : []); };
    window.PI = g.dreadPosters.findIndex((x) => x.kind === 'missing');
    only(PI);
    DR.change.gap[1] = [1, 1.5];
    g.yaw = 0; g.pitch = 0;
  });
  const PI = await H.evaluate(() => PI);
  await G.evaluate((i) => { lookAt(game.dreadPosters[i].mesh.position); }, PI);
  await G.waitForTimeout(700);
  await H.evaluate(() => { game.dread.nextChange = game.t; });
  await H.waitForTimeout(4000);
  await check(H, 'the friend looks at the poster, the host does not: it does not change', `game.dreadPosters[PI].stage === 0 && game.dread.changes === 0`);
  await G.evaluate(() => { game.yaw = 1.3; game.pitch = 0; });
  say(await waitFor(H, () => game.dreadPosters[PI].stage === 1, 6000), 'the friend looks away too: now it changes');
  say(await waitFor(G, (i) => game.dreadPosters[i].stage === 1 && game.dreadPosters[i].mesh.material.map !== game.dreadPosters[i].base, 5000, PI), 'friend: the same poster is different on their screen');
  await H.evaluate(() => { game.dread.nextChange = 1e9; lookAt(game.dreadPosters[PI].mesh.position); });
  await H.waitForTimeout(600);
  await H.evaluate(() => { game.dread.nextChange = game.t; });
  await H.waitForTimeout(3500);
  await check(H, 'the host looks at it, the friend does not: it does not change again', `game.dreadPosters[PI].stage === 1`);
  await check(H, 'host: looking at it counts as noticing (for the host)', `game.track.of(game.me).dread_seen_change === 1 && game.__stings.includes('notice')`);
  await H.evaluate(() => { game.dread.nextChange = 1e9; game.yaw = 0; game.pitch = 0; });
  await G.evaluate((i) => { game.__stings.length = 0; lookAt(game.dreadPosters[i].mesh.position); }, PI);
  say(await waitFor(H, () => game.track.of(who('Bo')).dread_seen_change === 1, 5000), 'host: the friend looks at it: noticed, counted for the friend');
  say(await waitFor(G, () => game.__stings.includes('notice') && /Things change/.test(hint()), 4000), 'friend: the quiet sting and the hint on their screen');
  await G.evaluate(() => snap());
  await shoot(G, 'mp_dread_poster.png');
  // the friend's screen is a moment behind: a change that arrives while they look waits until they look away
  const RI = await H.evaluate(() => { window.RI = game.dreadPosters.findIndex((x) => x.kind === 'rules'); only(RI); return RI; });
  await G.evaluate(() => { game.yaw = 1.3; game.pitch = 0; });
  await G.waitForTimeout(600);
  await G.evaluate((i) => { const m = game.mp, s0 = m.send.bind(m); m.__send = s0; m.send = (x) => { if (x.t !== 'in') s0(x); }; lookAt(game.dreadPosters[i].mesh.position); }, RI);
  await H.evaluate(() => { game.dread.nextChange = game.t; });
  say(await waitFor(H, () => game.dreadPosters[RI].stage === 1, 6000), 'host: (the friend\'s view arrives late) the poster changes on the host');
  await G.waitForTimeout(900);
  await check(G, 'friend: they are looking right at it: on their screen it waits', `game.dreadPosters[${RI}].stage === 0 && game.dread.defer.length === 1`);
  await G.evaluate(() => { game.mp.send = game.mp.__send; game.yaw = 1.3; game.pitch = 0; });
  say(await waitFor(G, (i) => game.dreadPosters[i].stage === 1 && game.dread.defer.length === 0, 4000, RI), 'friend: they look away: now it is different');
  // the board
  await H.evaluate(() => {
    const g = game, B = g.world.board;
    g.dread.nextChange = 1e9;
    B.clear(); g.boardRow = 0;
    B.writeInstant('page 47', 0, { indent: 60 }); B.writeInstant('x + ? = ?', 1, { indent: 60 }); g.boardRow = 2;
    g.dreadCandidates = () => (g.dreadBoardLines().length && !g.dread.changes2 ? [{ id: 'board', kind: 'board', pts: g.dreadBoardPts }] : []);
    const bc = g.dreadBoardChange.bind(g);
    g.dreadBoardChange = () => { g.dread.changes2 = 1; return bc(); };
    g.yaw = 1.52; g.pitch = 0;
  });
  await G.evaluate(() => { game.yaw = 0; game.pitch = 0.05; });       // the friend reads the board
  await waitFor(G, () => game.world.board.lines.length === 2, 5000);
  await H.evaluate(() => { game.dread.nextChange = game.t; });
  await H.waitForTimeout(3500);
  await check(H, 'the friend reads the board: nothing on it changes', `!game.dread.changes2 && game.world.board.lines.map((l) => l.text).join('|') === 'page 47|x + ? = ?'`);
  await G.evaluate(() => { game.yaw = 1.6; });
  say(await waitFor(H, () => game.dread.changes2 === 1, 6000), 'nobody looks at the board: a line changes');
  const hostBoard = await H.evaluate(() => game.world.board.lines.slice().sort((a, b) => a.y - b.y).map((l) => l.text).join('|'));
  say(await waitFor(G, (t) => game.world.board.lines.slice().sort((a, b) => a.y - b.y).map((l) => l.text).join('|') === t, 5000, hostBoard), `friend: the board says the same on their screen (${hostBoard})`);
  say(hostBoard !== 'page 47|x + ? = ?', 'the board really changed');
  await G.evaluate(() => { game.yaw = 0; game.pitch = 0.05; });
  say(await waitFor(H, () => game.track.log.some((e) => e.type === 'dreadSeen' && e.kind === 'board' && e.who === who('Bo').id), 5000), 'host: the friend looks at the board again: noticed');
  // a seat
  await H.evaluate(() => {
    const g = game, D = g.dread;
    D.nextChange = 1e9;
    g.t = 160;                                             // the third hour: seats too
    DR.change.gap[2] = [1, 1.5];
    DR.seats.find((s) => s.id === 'swap').w = 0;
    window.ZOE = g.students.find((s) => s.name === 'Zoe');
    g.dreadCandidates = () => (g.dreadKidFree(ZOE) && !D.gone.length ? [{ id: 'seat:Zoe', kind: 'seat', kid: ZOE, pts: g.dreadSeatPts(ZOE.seat) }] : []);
    g.yaw = 0; g.pitch = 0;
  });
  await G.evaluate(() => { lookAt(game.students.find((s) => s.name === 'Zoe').headWorld()); });
  await G.waitForTimeout(700);
  await H.evaluate(() => { game.dread.nextChange = game.t; });
  await H.waitForTimeout(3500);
  await check(H, 'the friend looks at Zoe: she stays', `!ZOE.gone`);
  await G.evaluate(() => { game.yaw = 1.57; game.pitch = 0; });
  say(await waitFor(H, () => ZOE.gone, 6000), 'the friend looks away: her seat is empty');
  say(await waitFor(G, () => { const z = game.students.find((s) => s.name === 'Zoe'); return z.gone && !z.root.visible; }, 5000), 'friend: her seat is empty on their screen too');
  await H.evaluate(() => { game.dread.nextChange = 1e9; game.dread.gone[0].backAt = 1e9; });

  // ---------------------------------------------------------------- somebody joins in the middle
  const C = await mk('late');
  await C.goto(BASE + '&join=' + code);
  await waitFor(C, () => window.game && !document.getElementById('mp').classList.contains('hidden'), 120000);
  await C.fill('#mp-name', 'Cy'); await C.click('#btn-join');
  say(await waitFor(C, () => game.state === 'playing' && game.mp.snap, 30000), 'a third player joins in the middle of the class');
  await C.evaluate(common);
  await C.evaluate(() => { game.yaw = 1.57; game.pitch = 0; });   // (looking at the windows: nothing has to wait)
  say(await waitFor(C, ([a, b]) => game.dreadPosters[a].stage === 1 && game.dreadPosters[b].stage === 1 && game.dreadPosters.filter((x) => x.stage).length === 2, 8000, [PI, RI]), 'late joiner: the changed posters are changed for them');
  say(await waitFor(C, () => { const z = game.students.find((s) => s.name === 'Zoe'); return z.gone && !z.root.visible; }, 5000), 'late joiner: the empty seat is empty for them');
  await check(C, 'late joiner: has their own full breath and no prompt', `game.me.breath === 1 && !hud().show`);
  await C.evaluate(() => { game.input.keys.breath = true; });
  say(await waitFor(H, () => who('Cy') && who('Cy').holding, 5000), 'host: the late joiner can hold their breath too');
  await C.evaluate(() => { game.input.keys.breath = false; });

  // ---------------------------------------------------------------- a friend leaves while he listens at their desk
  await H.evaluate(() => lean('Cy'));
  say(await waitFor(H, () => phase() === 'grace' && game.eventLock, 25000), 'host: he bends over the late joiner\'s desk');
  await C.close();
  say(await waitFor(H, () => !who('Cy') && !game.dread.lean && game.eventLock === false, 30000), 'the friend leaves right then: he lets go, nothing stays locked');
  say(await waitFor(H, () => game.brainIdle && game.teacher.crouch < 0.05 && game.teacher.pose === 'rest', 20000), 'host: he straightens up, the lesson goes on');
  say(await waitFor(G, () => game.dreadLeanOn(who('host')) === '' && !who('Cy'), 5000), 'friend: sees the class go on');

  // ---------------------------------------------------------------- the end screen: everybody's own numbers
  await H.evaluate(() => { game.finish('survived'); });
  say(await waitFor(G, () => game.state === 'end' && /He listened at your desk: 2/.test(document.getElementById('end-dread').innerText), 8000), 'friend: the end screen has THEIR numbers (he listened twice)');
  await check(G, 'friend: held once, crept up on once and spotted, noticed changes', `(() => { const t = document.getElementById('end-dread').innerText; return /held your breath: 1/.test(t) && /crept up on you: 1/.test(t) && /looked up in time: 1/.test(t) && /Things changed behind your back: 4/.test(t) && /You noticed: 2/.test(t) ? true : t; })()`);
  await check(H, 'host: the end screen has the host\'s own numbers', `(() => { const t = document.getElementById('end-dread').innerText; return /He listened at your desk: 1/.test(t) && /held your breath: 1/.test(t) && !/crept up/.test(t) && /Things changed behind your back: 4/.test(t) && /You noticed: [12]/.test(t) ? true : t; })()`);
  await shoot(G, 'mp_dread_end.png');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
