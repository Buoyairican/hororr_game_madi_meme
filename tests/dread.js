// Phase 5: real dread. Your breath (hold B, the BREATH meter, running out of air), him leaning over your
// desk to listen (hold your breath and keep still; what happens when he hears you, on Easy and on Hard),
// him creeping up on you while you stare at your phone (backwards, no footsteps, the tells, looking up in
// time or not), and things that change while nobody looks (the board, a poster, a seat): never on screen.
// Last: the BREATH button on a phone.
const { chromium, devices, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const ok = [], bad = [], logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
  let P = page;
  const check = async (name, expr) => { let r; try { r = await P.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  const ev = (fn, arg) => P.evaluate(fn, arg);
  // a picture for the review (a capture can stall once on a busy machine: then it is taken again)
  const shoot = async (pg, name) => {
    for (let i = 0; i < 5; i++) {
      await pg.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
      await pg.evaluate(() => snap());
      if (await pg.screenshot({ path: shot(name), timeout: 10000 }).then(() => true, () => false)) return;
    }
    console.log('(no picture: ' + name + ')');
  };
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  const helpers = async () => {
    const g = window.game, T = g.teacher;
    window.DATA = await import('/src/data.js');
    window.DR = DATA.DREAD;
    g.__render = g.post.render.bind(g.post);
    g.post.render = () => {};
    g.tick = () => {};                       // only the test moves time (run), so every scene plays the same way
    g.input.requestLock = () => {};          // no pointer lock: the mouse still drags the view, and screen captures don't stall
    g.input.wantLock = false;
    if (document.pointerLockElement) document.exitPointerLock();
    DR.breath.resume = 0;                    // (no extra moment after a pause: the test's clock jumps all the time)
    g.__snd = [];
    const play0 = g.audio.play.bind(g.audio);
    g.audio.play = (n, o) => { g.__snd.push(n); return play0(n, o); };
    window.run = (sec) => { for (let i = 0; i < Math.round(sec * 30); i++) { if (g.state !== 'playing') break; g.playTick(1 / 30); g.ui.update(1 / 30); } };
    window.snap = () => { g.render(0); g.__render(g.scene, g.camera); };
    window.calm = () => { g.anger = 0; g.flags = { r40: true, r70: true }; for (const p of g.players) p.heat = 0; };
    window.me = () => g.track.of(g.me);
    window.hud = () => { const el = document.getElementById('breath-hud'); return { show: el.classList.contains('show'), cls: el.className, label: document.getElementById('breath-label').innerText.replace(/\s+/g, ' ').trim(), w: parseFloat(document.getElementById('breath-fill').style.width) }; };
    window.sub = () => document.getElementById('subtitle').innerText.replace(/\n/g, ' ');
    window.hint = () => document.getElementById('hint').innerText.replace(/\n/g, ' ');
    // his lesson, as the test wants it: he stands at the board with his back to the class...
    window.standing = () => { g.idleBrain = function* () { T.lookAt(null); T.faceTo(Math.PI, 6); T.setPose('rest'); for (;;) yield; }; g.interrupt((function* () { T.place(0.5, -6.3, Math.PI); yield; })()); };
    // ...or he writes, line after line
    window.writing = () => { g.idleBrain = function* () { for (;;) { this.boardRow = 1; yield* this.actWrite('the quick brown fox jumps over the lazy dog'); } }; g.interrupt((function* () { T.place(0.5, -6.3, Math.PI); yield; })()); };
    // a class with nothing in it but what the test asks for (no intro, no bell, no random calls / scares / clowns)
    window.fresh = (phase = 1, hard = false) => {
      g.input.keys.breath = g.input.keys.phone = g.input.keys.talk = false;
      g.difficulty = hard ? 'hard' : 'easy';
      g.start('free', 0);
      g.script = null;
      g.idleKind = 'lesson'; g.memesOn = true; g.allowEcho = g.allowAsk = g.allowPrank = true;
      g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
      g.startMeme = () => false;
      g.t = [5, 75, 155, 235][phase];
      g.yaw = 0; g.pitch = 0;
      document.getElementById('subtitle').innerHTML = '';
      const D = g.dread;
      D.nextCreep = D.nextLean = D.nextChange = 1e9; // nothing by itself, until a check asks for it
      standing();
      run(0.5);
      g.__snd.length = 0;
    };
    window.lean = (o = { from: 'visit' }) => g.interrupt(g.dreadLean(g.me, o));
    window.phase = () => (g.dread.lean ? g.dread.lean.phase : '');
    /** run until his lean is in this phase (or over) */
    window.until = (ph, max = 40) => { for (let i = 0; i < max * 10; i++) { if (phase() === ph || g.state !== 'playing') return true; run(0.1); } return phase() === ph; };
    // is this point on the screen right now? (the real camera, not the game's own test)
    window.onScreen = (pt) => { const v = g.camPos.clone().copy(pt).project(g.camera); return v.z < 1 && Math.abs(v.x) <= 1 && Math.abs(v.y) <= 1; };
    window.look = (yaw, pitch = 0) => { g.yaw = yaw; g.pitch = pitch; run(0.05); };
    window.backTurned = (tol = 0.4) => { const a = T.facing - Math.PI; return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < tol; };
    window.creepNow = () => { g.startCreep(g.me); run(0.1); };
    DR.breath.lean.easy = [4, 4]; DR.breath.lean.hard = [5, 5]; // (the same length every time)
  };
  await page.evaluate(helpers);

  // ================================================================ your breath
  await ev(() => fresh(1));
  await check('the keys legend names B', `/B\\s*hold your breath/.test(document.getElementById('keys-legend').innerText)`);
  await check('nothing held: no BREATH meter', `!hud().show && game.me.breath === 1`);
  await page.keyboard.down('b');
  await ev(() => run(2));
  await check('hold B: you hold your breath, the meter shows and goes down', `game.me.holding && game.me.breath > 0.74 && game.me.breath < 0.86 && hud().show && hud().label === 'BREATH' && hud().w < 90`);
  await check('you hear yourself breathe in', `game.__snd.includes('dread_inhale')`);
  await page.keyboard.up('b');
  await ev(() => run(0.3));
  await check('let go: you breathe out, the air comes back', `!game.me.holding && game.__snd.includes('dread_exhale') && game.me.breath > 0.8`);
  await ev(() => run(3.5));
  await check('full again: the meter goes away', `game.me.breath === 1 && !hud().show`);
  await page.keyboard.down('b');
  await ev(() => run(9.6));
  await check('Easy: 10 seconds of air (almost gone after 9.6)', `game.me.holding && game.me.breath > 0.01 && game.me.breath < 0.08 && /low/.test(hud().cls)`);
  await ev(() => run(0.8));
  await check('out of air: you gasp, loud, and the meter says so', `!game.me.holding && game.me.gaspT > 0 && game.__snd.includes('dread_gasp') && game.me.noise >= 0.7 && /out/.test(hud().cls) && hud().label === 'OUT OF AIR'`);
  await ev(() => run(2.5));
  await check('still pressing B after the gasp: no new breath until you let go', `!game.me.holding && game.me.breath > 0.3`);
  await page.keyboard.up('b');
  await ev(() => run(0.1));
  await page.keyboard.down('b');
  await ev(() => run(0.3));
  await check('let go and press again: holding', `game.me.holding`);
  await page.keyboard.up('b');
  await ev(() => run(0.2));
  await check('counted: seconds of held breath, the gasp in the log', `me().breath_time > 12 && me().breath_time < 13.5 && game.track.log.some((e) => e.type === 'gasp')`);
  await check('Hard has less air than Easy', `DR.breath.max.hard < DR.breath.max.easy && DR.breath.lean.hard[0] >= DR.breath.lean.easy[0] && DR.breath.grace.hard < DR.breath.grace.easy && DR.breath.still.hard < DR.breath.still.easy`);

  // ================================================================ he leans over your desk
  // by himself: now and then he walks over to listen
  await ev(() => { fresh(1); game.dread.nextLean = game.t; run(0.5); });
  await check('in a quiet stretch he walks over to your desk by himself', `!!game.dread.lean && game.dread.lean.p === game.me && game.dread.lean.from === 'visit' && phase() === 'come'`);
  await check('...with footsteps (this is not the creep)', `(() => { run(2.5); return game.__snd.some((n) => /^step_/.test(n)); })()`);
  await ev(() => { until('grace'); window.__g0 = game.t; });
  await ev(() => run(0.6));
  await check('he bends over the desk: everything else waits (no calls, no scares)', `phase() === 'grace' && game.eventLock === true && game.dreadLeanOn() === 'grace'`);
  await check('the hint tells you the key', `/Hold B to hold your breath and keep the mouse still/.test(hint()) && !/BREATH and/.test(hint())`);
  await check('the meter turns into a big prompt', `/lean/.test(hud().cls) && /now/.test(hud().cls) && /^HOLD YOUR BREATH\\s*B$/.test(hud().label)`);
  await check('Easy, the first time: Nora whispers what to do', `/Hold your breath/.test(sub())`);
  await ev(() => { run(0.9); snap(); });
  await check('he comes ear first: by his own rules he is not watching you', `!game.me.watching && game.me.lookDot < 0.5 && game.me.dist < 1.6`);
  await shoot(page, 'dread_lean.png');
  await page.keyboard.down('b');
  await ev(() => until('hold'));
  await check('the first time on Easy you get 3 seconds to get ready', `(() => { const d = game.t - __g0; return d > 2.85 && d < 3.25 && DR.breath.first === 3 ? true : d; })()`);
  await ev(() => run(1));
  await check('holding: the prompt says DON\'T MOVE', `phase() === 'hold' && hud().label === "DON'T MOVE" && !/now/.test(hud().cls)`);
  await ev(() => { game.yaw += 0.05; run(0.3); });
  await check('a tiny move of the view is fine', `phase() === 'hold'`);
  const m0 = await ev(() => { calm(); game.anger = 30; return game.mischief; });
  await ev(() => until('leave'));
  await check('he heard nothing: counted, mischief, he calms down', `me().breath_hold === 1 && me().breath_fail === 0 && me().dread_lean === 1 && game.mischief >= ${m0} + 30 && game.anger <= 16 && game.track.log.some((e) => e.type === 'breathHold')`);
  await check('the lock is off as soon as he straightens up', `game.eventLock === false && game.dreadLeanOn() === ''`);
  await ev(() => run(2.2));
  await check('"You... may... breathe." (or a hum)', `/may\\.\\.\\. breathe|Hmm/i.test(sub())`);
  await page.keyboard.up('b');
  await ev(() => run(9));
  await check('he walks back to the front and the lesson goes on', `!game.dread.lean && game.brainIdle && game.teacher.pos.z < -4.5 && game.track.log.some((e) => e.type === 'dreadLean' && e.out === 'ok') ? true : [!!game.dread.lean, game.brainIdle, game.teacher.pos.z, game.track.log.filter((e) => /dread|breath|caught/.test(e.type)), game.anger, game.cutscene, sub()]`);
  await check('the lights are back', `game.dread.dim < 0.02 && game.world.lights.banks[0].target > 0.98`);

  // what he hears (Easy): heat, no strike
  const fail = async (name, why, act, extra = 'true') => {
    await ev(() => { fresh(1); lean(); until('grace'); game.input.keys.breath = true; until('hold'); run(0.5); calm(); });
    await act();
    await ev(() => run(0.2));
    await check(`${name}: he heard you (${why}): Easy, a lot of heat at once`, `phase() === 'caught' && game.dread.lean.why === '${why}' && me().breath_fail === 1 && game.track.log.some((e) => e.type === 'breathFail' && e.why === '${why}') && game.anger > 25 && game.anger <= 36 && game.me.heat > 20 && ${extra}`);
  };
  await fail('you let go of B', 'breath', () => ev(() => { game.input.keys.breath = false; }));
  await check('the hint says why', `/He heard you breathe/.test(hint())`);
  await check('his face snaps round to yours', `(() => { run(0.6); return game.me.lookDot > 0.8 && game.me.watching; })()`);
  await ev(() => { run(0.4); snap(); });
  await shoot(page, 'dread_heard.png');
  await check('"I can hear you... breathing."', `/hear you\\.\\.\\. breathing/.test(sub())`);
  await ev(() => run(4));
  await check('Easy: heat, not a strike; he straightens up and leaves', `game.strikes === 0 && !game.cutscene && game.eventLock === false && game.dreadLeanOn() === '' && game.track.log.some((e) => e.type === 'dreadLean' && e.out === 'fail')`);
  await fail('you moved the view', 'moved', () => ev(() => { game.yaw += 0.2; }));
  await check('...and the hint says so', `/You moved/.test(hint())`);
  await fail('you pulled out your phone', 'noise', () => ev(() => { game.input.keys.phone = true; }));
  await ev(() => { game.input.keys.phone = false; });
  await fail('you ran out of air', 'air', () => ev(() => { game.me.breath = 0.004; }), `game.__snd.includes('dread_gasp')`);
  // the mouse, for real: drag the view while he listens
  await ev(() => { fresh(1); lean(); until('grace'); game.input.keys.breath = true; until('hold'); run(0.5); });
  await page.mouse.move(400, 200);
  await page.mouse.down();
  await page.mouse.move(540, 200, { steps: 5 });
  await page.mouse.up();
  await ev(() => run(0.2));
  await check('moving the mouse for real: he noticed', `phase() === 'caught' && game.dread.lean.why === 'moved'`);
  // never held at all
  await ev(() => { fresh(1); lean(); until('caught'); });
  await check('not holding your breath at all: he hears you the moment he listens', `phase() === 'caught' && game.dread.lean.why === 'breath' && game.dread.lean.t < 0.1`);
  // already angry: the usual rule makes it a strike
  await ev(() => { fresh(1); lean(); until('grace'); game.input.keys.breath = true; until('hold'); run(0.5); game.anger = 75; game.input.keys.breath = false; run(1.5); });
  await check('he was angry already: this was one too many (a strike, by the usual rule)', `game.strikes === 1 && game.track.log.some((e) => e.type === 'caught' && e.reason === 'noise') && game.eventLock === false`);
  await ev(() => run(25));
  await check('Easy: the class goes on after the strike', `game.state === 'playing' && !game.cutscene && !game.dread.lean`);

  // Hard
  await ev(() => { fresh(1, true); lean(); until('grace'); game.input.keys.breath = true; until('hold'); });
  await check('Hard: less time to get ready, he listens longer', `game.dread.lean.dur === 5 && DR.breath.grace.hard === 1`);
  await ev(() => { run(4.9); });
  await check('Hard: holding and keeping still works the same', `(() => { until('leave'); return me().breath_hold === 1 && game.strikes === 0; })()`);
  await ev(() => { game.input.keys.breath = false; fresh(1, true); lean(); until('grace'); game.input.keys.breath = true; until('hold'); run(1); game.yaw += 0.1; run(0.2); });
  await check('Hard: he allows less movement', `phase() === 'caught' && game.dread.lean.why === 'moved'`);
  await ev(() => run(4));
  await check('Hard: he is looking right at you and he heard you: caught', `game.strikes === 1 && game.track.of(game.me).caughtFor.breath === 1 && game.eventLock === false`);
  await ev(() => { game.input.keys.breath = false; for (let i = 0; i < 600 && game.state === 'playing'; i++) { game.playTick(1 / 30); game.ui.update(1 / 30); } });
  await check('Hard: one strike ends the class', `game.state === 'end' && /DETENTION/.test(document.getElementById('end-title').innerText)`);
  await check('the end screen has a line about it', `/He listened at your desk: 1/.test(document.getElementById('end-dread').innerText) && /held your breath: 0/.test(document.getElementById('end-dread').innerText)`);

  // ================================================================ he creeps up on you
  await ev(() => { fresh(0); writing(); run(4); game.dread.nextCreep = 0; game.input.keys.phone = true; run(6); });
  await check('a few seconds on your phone: nothing yet', `!game.dread.creep && game.me.phoneT > 5 && game.world.board.busy`);
  const started = await ev(() => { for (let i = 0; i < 200 && !game.dread.creep; i++) run(0.1); return { on: !!game.dread.creep, at: game.me.phoneT, due: game.me.creepAt, anger: game.anger }; });
  (started.on && started.due >= 9 && started.due <= 13 && started.at >= started.due && started.at <= started.due + 7 ? ok : bad).push(`after 9 to 13 seconds on your phone (this time ${started.due.toFixed(1)}) he starts, as soon as he stands at the board with his back turned (${started.at.toFixed(1)} s)`);
  await check('the chalk stops right where it is: no footsteps from now on', `game.dread.creep.p === game.me && !game.world.board.busy && game.dreadSilent === true && game.__snd.includes('chalk_tap')`);
  // watch him come: three steps, a tell after each
  const walk = await ev(() => {
    const g = game, T = g.teacher, o = { stages: [], back: true, seen: false, steps: 0, d0: g.me.dist, angerMax: 0, tells: [], cap: [] };
    g.__snd.length = 0;
    let last = 0;
    for (let i = 0; i < 400 && g.dread.creep && g.dread.creep.stage < 3; i++) {
      run(0.1);
      const c = g.dread.creep;
      if (!c) break;
      if (c.stage !== last) { last = c.stage; o.stages.push(c.stage + '@' + g.me.dist.toFixed(1)); }
      if (c.stage >= 1 && !backTurned()) o.back = false;
      if (g.me.watching || g.me.lookDot > 0.3) o.seen = true;
      o.angerMax = Math.max(o.angerMax, g.anger);
      const s = sub(); if (s && !o.cap.includes(s)) o.cap.push(s);
    }
    o.steps = g.__snd.filter((n) => /^step_/.test(n)).length;
    o.tells = g.__snd.filter((n) => /^dread_/.test(n));
    o.d1 = g.me.dist; o.dim = g.dread.dim; o.bank = g.world.lights.banks[0].target; o.hint = hint();
    return o;
  });
  console.log('creep:', JSON.stringify(walk));
  (walk.stages.length === 3 && walk.d1 < walk.d0 - 1.5 ? ok : bad).push('he comes closer in three steps' + (walk.stages.length === 3 ? '' : ' -> ' + JSON.stringify(walk.stages)));
  (walk.back && !walk.seen ? ok : bad).push('backwards: his back stays turned, he never looks at you (the catch rules stay as they are)');
  (walk.steps === 0 ? ok : bad).push('without a single footstep' + (walk.steps ? ' -> ' + walk.steps : ''));
  (walk.tells.join(',') === 'dread_light,dread_breath' ? ok : bad).push('the tells: the lights dip, then somebody breathes' + ' (' + walk.tells.join(',') + ')');
  (walk.dim > 0.4 && walk.bank < 0.75 ? ok : bad).push('the lights at the front are dimmer now');
  (walk.cap.some((s) => /the lights dim/.test(s)) && walk.cap.some((s) => /somebody is breathing/.test(s)) ? ok : bad).push('Easy: a quiet caption for every tell' + ' (' + walk.cap.join(' | ') + ')');
  (/Look up from your phone/.test(walk.hint) ? ok : bad).push('the hint: look up from your phone');
  (walk.angerMax <= started.anger + 0.5 ? ok : bad).push('your phone does not make him angrier while he is on his way' + ` (${started.anger.toFixed(1)} -> ${walk.angerMax.toFixed(1)})`);
  await check('counted: he crept up on you', `me().dread_creep === 1`);
  await ev(() => { run(1.5); snap(); });
  await shoot(page, 'dread_creep.png');
  // look up: caught in the act
  const spot = await ev(() => { const g = game, T = g.teacher, m0 = g.mischief; g.input.keys.phone = false; run(0.6); const p0 = T.pos.clone(); run(1.2); return { moved: p0.distanceTo(T.pos), spotted: me().dread_spotted, dm: g.mischief - m0, silent: g.dreadSilent, hint: hint() }; });
  (spot.spotted === 1 && spot.moved < 0.1 && spot.dm >= 14.9 && !spot.silent ? ok : bad).push('you look up: he stops dead where he is (counted, mischief)' + ' ' + JSON.stringify(spot));
  (/backwards/i.test(spot.hint) ? ok : bad).push('the hint: he was walking backwards');
  await ev(() => run(1.6));
  await check('only his head comes round, all the way, to you', `game.teacher.owl === true && game.me.lookDot > 0.8 && backTurned() && game.__snd.includes('neck_crack')`);
  await ev(() => snap());
  await shoot(page, 'dread_spotted.png');
  await ev(() => run(1.5));
  await check('"I was... not... moving."', `/not\\.\\.\\. moving/.test(sub())`);
  await ev(() => run(12));
  await check('then he walks back (with footsteps) and the lights come back', `!game.dread.creep && !game.dread.lean && game.teacher.owl === false && game.__snd.some((n) => /^step_/.test(n)) && game.dread.dim < 0.05 && game.strikes === 0 && game.track.log.some((e) => e.type === 'dreadCreep' && e.out === 'spotted' && e.stage === 3)`);

  // never look up (Easy): he turns around at your desk and listens
  const arrive = await ev(() => {
    const g = game, T = g.teacher;
    fresh(0); writing(); run(4); g.input.keys.phone = true; run(1);
    const t0 = g.t;
    creepNow();
    for (let i = 0; i < 600 && g.dread.creep && !g.__snd.includes('dread_creak'); i++) run(0.1);
    const spot = g.deskSpot(g.me);
    return { t: g.t - t0, at: Math.hypot(T.pos.x - spot.stand.x, T.pos.z - spot.stand.z), back: backTurned(0.3), dist: g.me.dist, tells: g.__snd.filter((n) => /^dread_/.test(n)).join(','), cap: sub(), watching: g.me.watching };
  });
  console.log('arrival:', JSON.stringify(arrive));
  (arrive.at < 0.12 && arrive.back && !arrive.watching && arrive.dist < 2.3 ? ok : bad).push('he stands right at your desk, his back to you');
  (arrive.tells === 'dread_light,dread_breath,dread_creak' ? ok : bad).push('the last tell: a floorboard, very close' + ' (' + arrive.tells + ')');
  await ev(() => { until('grace', 12); });
  await check('you never looked up: he turns around and bends over you', `phase() === 'grace' && game.dread.lean.from === 'creep' && !game.dread.creep && game.eventLock`);
  await check('"What... are you... looking at?"', `/looking at/.test(sub()) || game.__snd.includes('tw_dr_looking')`);
  await check('Easy: no strike for the phone, you get the moment to put it away', `game.strikes === 0 && !game.cutscene && /now/.test(hud().cls)`);
  await ev(() => { game.input.keys.phone = false; game.input.keys.breath = true; until('leave'); });
  await check('phone away, breath held: he heard nothing', `me().breath_hold === 1 && me().dread_creep === 1 && me().dread_spotted === 0 && game.strikes === 0 && game.track.log.some((e) => e.type === 'dreadCreep' && e.out === 'lean')`);
  // look up when he is already there
  await ev(() => { game.input.keys.breath = false; fresh(0); writing(); run(4); game.input.keys.phone = true; run(1); creepNow(); for (let i = 0; i < 600 && game.dread.creep && !game.__snd.includes('dread_creak'); i++) run(0.1); run(0.5); game.input.keys.phone = false; run(0.8); });
  await check('you look up at the last moment: he is RIGHT there, and he leans over anyway', `!game.dread.creep && !!game.dread.lean && game.__snd.includes('stinger_2') && game.dreadFear > 0.5 && game.track.log.some((e) => e.type === 'dreadCreep' && e.out === 'late')`);

  // Hard: faster, quieter, no captions, and at the desk the usual rule
  const hard = await ev(() => {
    const g = game, T = g.teacher;
    fresh(0, true); writing(); run(4); g.input.keys.phone = true; run(1);
    const t0 = g.t, cap = [];
    creepNow();
    let seen = false;
    for (let i = 0; i < 600 && g.dread.creep && !g.__snd.includes('dread_creak'); i++) { run(0.1); if (g.me.watching) seen = true; const s = sub(); if (s && !cap.includes(s)) cap.push(s); }
    return { t: g.t - t0, seen, cap, strikes: g.strikes, hint: hint() };
  });
  console.log('hard:', JSON.stringify(hard));
  (hard.t < arrive.t - 2 ? ok : bad).push(`Hard: he is at your desk sooner (${hard.t.toFixed(1)} s, Easy ${arrive.t.toFixed(1)} s)`);
  (!hard.cap.some((s) => /lights dim|breathing|floorboard|chalk has/.test(s)) && /Look up from your phone/.test(hard.hint) ? ok : bad).push('Hard: the tells are there (sounds, the lights, the hint) but nobody spells them out');
  (!hard.seen && hard.strikes === 0 ? ok : bad).push('Hard: no catch while his back is turned');
  await ev(() => { window.__ld = -1; for (let i = 0; i < 240 && !game.cutscene; i++) { __ld = game.me.lookDot; run(1 / 30); } run(0.1); });
  await check('Hard: he turns around, he SEES the phone: caught (the usual Hard rule)', `game.cutscene && game.strikes === 1 && game.track.log.some((e) => e.type === 'caught' && e.reason === 'noise') && __ld > 0.8 && !game.dread.creep && !game.dreadSilent ? true : [game.cutscene, game.strikes, __ld]`);
  await ev(() => { game.input.keys.phone = false; fresh(0, true); writing(); run(4); game.input.keys.phone = true; run(1); creepNow(); for (let i = 0; i < 300 && !(game.dread.creep && game.dread.creep.stage === 2); i++) run(0.1); game.input.keys.phone = false; run(8); });
  await check('Hard: look up in time and nothing happens to you', `me().dread_spotted === 1 && game.strikes === 0 && game.state === 'playing'`);

  // when it does not happen
  await check('not while he faces the class, not while he is angry, not in a story moment', `(() => {
    const g = game, T = g.teacher, r = [];
    const tryIt = (prep) => { fresh(0); prep(); run(2); g.dread.nextCreep = 0; g.input.keys.phone = true; run(16); g.input.keys.phone = false; return !!g.dread.creep || me().dread_creep > 0; };
    r.push(tryIt(() => { g.idleBrain = function* () { T.faceTo(0, 6); T.lookAt(null); for (;;) yield; }; g.interrupt((function* () { T.place(0.5, -5.6, 0); yield; })()); }));
    r.push(tryIt(() => { g.anger = 60; g.updateAnger = () => {}; }));
    delete g.updateAnger;
    r.push(tryIt(() => { g.lockBully = true; }));
    r.push(tryIt(() => { g.memesOn = false; }));
    r.push(tryIt(() => { g.vidJob = { done: false }; }));
    r.push(tryIt(() => { g.dreadAuto = false; }));
    g.dreadAuto = true;
    r.push(!tryIt(() => {}));
    return r.every((x) => !x) ? true : r;
  })()`);
  await check('story period 1: only posters change, no creeping, no leaning; period 3 and 4: everything', `(() => {
    const g = game, o = [];
    for (const ch of [0, 1, 2, 3]) { g.start('story', ch); g.script = null; g.idleKind = 'lesson'; g.memesOn = true; o.push(['creep', 'lean', 'poster', 'board', 'seat'].map((k) => (g.dreadOpen(k) ? 1 : 0)).join('')); }
    g.start('story', 0);
    const intro = ['creep', 'lean', 'poster'].some((k) => g.dreadOpen(k));
    return o.join(' ') === '00100 10110 11111 11111' && !intro ? true : [o, intro];
  })()`);

  // ================================================================ things change while nobody looks
  await ev(() => { fresh(0); look(0); });
  await check('what you can see: the board ahead, not the posters beside or behind you', `(() => {
    const g = game, P = g.dreadPosters;
    const right = P.filter((x) => x.mesh.position.x > 4.9), back = P.filter((x) => x.mesh.position.z > 5.9), front = P.filter((x) => x.mesh.position.z < -6.9);
    const a = g.dreadSees(g.me, g.dreadBoardPts) && front.every((x) => g.dreadSees(g.me, g.dreadPosterPts(x))) && back.every((x) => !g.dreadSees(g.me, g.dreadPosterPts(x)));
    look(-1.52);
    const b = right.some((x) => g.dreadSees(g.me, g.dreadPosterPts(x))) && !g.dreadSees(g.me, g.dreadBoardPts, 1.15);
    look(0);
    return a && b && P.length === 7 ? true : [a, b, P.length];
  })()`);
  // posters (phase 0: only posters change)
  const post = await ev(() => {
    const g = game, D = g.dread, o = { viol: 0, changed: [], frontChanged: false };
    const dp = g.dreadPoster.bind(g);
    g.dreadPoster = (x, st) => { if (st > x.stage) { o.changed.push(x.kind + st); if (g.dreadPosterPts(x).some(onScreen)) o.viol++; if (x.mesh.position.z < -6.9) o.frontChanged = true; } return dp(x, st); };
    D.nextChange = g.t; DR.change.gap[0] = [3, 4];
    for (let i = 0; i < 400; i++) run(0.1);   // 40 s, eyes on the board
    o.n = D.changes; o.snd = g.__snd.filter((n) => n === 'dread_paper').length; o.seen = me().dread_seen_change;
    o.kinds = g.track.log.filter((e) => e.type === 'dreadChange').map((e) => e.kind).join(',');
    return o;
  });
  console.log('posters:', JSON.stringify(post));
  (post.n >= 5 && post.viol === 0 && !post.frontChanged && post.snd === post.n && /^(poster,?)+$/.test(post.kinds) ? ok : bad).push(`eyes on the board: ${post.n} posters change beside and behind you, never the one you can see, each with a quiet rustle`);
  (post.seen === 0 ? ok : bad).push('nothing noticed yet (you have not looked)');
  await check('you look at one of them: you noticed (counted, a quiet sting, the hint)', `(() => {
    const g = game, x = g.dreadPosters.find((p) => p.stage > 0 && p.mesh.position.x > 4.9);
    if (!x) return 'no changed poster on the right wall';
    g.__snd.length = 0;
    const d = x.mesh.position.clone().sub(g.camPos);
    look(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
    run(0.6);
    return me().dread_seen_change >= 1 && g.__snd.includes('dread_notice') && g.dreadFear > 0.2 && /Things change when nobody is looking/.test(hint()) && g.track.log.some((e) => e.type === 'dreadSeen' && e.kind === 'poster') ? true : [me().dread_seen_change, g.__snd, hint()];
  })()`);
  await ev(() => { snap(); });
  await shoot(page, 'dread_poster.png');
  await check('each poster has two later versions, then it stays', `(() => {
    const g = game; look(0); for (let i = 0; i < 900; i++) run(0.1);
    const st = g.dreadPosters.map((x) => x.stage);
    return st.filter((s) => s === 2).length >= 5 && Math.max(...st) === 2 ? true : st;
  })()`);

  // the board
  const board = await ev(() => {
    const g = game, B = g.world.board, o = {};
    fresh(1);
    const D = g.dread;
    g.interrupt((function* () { this.boardRow = 0; yield* this.actWrite('2 + 2 = 5'); yield* this.actWrite('the heart has 4 rooms'); }).call(g));
    for (let i = 0; i < 400 && !g.brainIdle; i++) run(0.1);
    o.before = B.lines.map((l) => l.text);
    g.dreadCandidates = () => (g.dreadBoardLines().length ? [{ id: 'board', kind: 'board', pts: g.dreadBoardPts }] : []);
    let viol = 0;
    const ba = g.dreadBoardApply.bind(g);
    g.dreadBoardApply = (x) => { if (g.dreadBoardPts.some(onScreen)) viol++; o.o = x; return ba(x); };
    D.nextChange = g.t;
    look(0); for (let i = 0; i < 150; i++) run(0.1);
    o.whileLooking = D.changes;
    look(1.52); for (let i = 0; i < 30 && !D.changes; i++) run(0.1);       // whispering to Sam
    o.after = B.lines.map((l) => l.text); o.n = D.changes; o.viol = viol; o.snd = g.__snd.includes('dread_board'); o.row = g.boardRow;
    return o;
  });
  console.log('board:', JSON.stringify(board));
  (board.whileLooking === 0 ? ok : bad).push('the board never changes while you look at it (15 s)');
  (board.n === 1 && board.viol === 0 && board.snd && board.after.join('|') !== board.before.join('|') ? ok : bad).push('you look at Sam: a line on the board says something else now (a quiet scratch of chalk)');
  const mode = board.o && board.o.mode;
  const fits = mode === 'flip' ? board.after.includes([...board.before[board.o.r]].reverse().join('')) : mode === 'swap' ? board.after.length === 2 && !board.after.includes(board.before[board.o.r]) : mode === 'add' ? board.after.length === 3 && board.row === 3 : false;
  (fits ? ok : bad).push(`the change is one from the table (${mode}: "${board.o && board.o.text}")`);
  await check('you look back at the board: noticed', `(() => { const n = me().dread_seen_change; look(0); run(0.7); return me().dread_seen_change === n + 1 && game.track.log.some((e) => e.type === 'dreadSeen' && e.kind === 'board'); })()`);
  await ev(() => { snap(); });
  await shoot(page, 'dread_board.png');
  await check('every kind of board change works (flip, other words, a line he did not write)', `(() => {
    const g = game, B = g.world.board, seen = new Set();
    look(1.52);
    for (let i = 0; i < 60 && seen.size < 3; i++) {
      B.clear(); g.boardRow = 0;
      B.writeInstant('page 47', 0, {}); B.writeInstant('x + ? = ?', 1, {}); g.boardRow = 2;
      const o = g.dreadBoardChange();
      if (!o) return 'no change';
      seen.add(o.mode);
      const t = B.lines.map((l) => l.text);
      if (o.mode === 'add' ? !(t.length === 3 && g.boardRow === 3) : t.length !== 2) return [o, t];
    }
    return seen.size === 3 ? true : [...seen];
  })()`);
  await check('no board change while he writes, or on an empty board', `(() => {
    const g = game, B = g.world.board;
    B.clear(); g.boardRow = 0;
    const a = g.dreadBoardLines().length;
    B.write('still writing this', 0, {});
    const b = g.dreadBoardLines().length;
    B.stopJob(); B.clear();
    return a === 0 && b === 0 ? true : [a, b];
  })()`);

  // seats
  const seat = await ev(() => {
    const g = game, o = { viol: 0 };
    fresh(2); delete g.dreadCandidates; delete g.dreadBoardApply;
    const D = g.dread;
    const all = g.dreadCandidates.bind(g);
    g.dreadCandidates = () => all().filter((c) => c.kid && c.kid.seat.row >= 2);   // (the kids behind you: you can see all of them at once)
    DR.seats.find((s) => s.id === 'swap').w = 0;           // first: a kid is gone
    for (const s of g.students) { const sg = s.setGone.bind(s); s.setGone = (v) => { if (g.dreadSeatPts(s.seat).some(onScreen)) o.viol++; return sg(v); }; }
    look(3.0);                                              // you look at the back of the room
    D.nextChange = g.t; for (let i = 0; i < 150; i++) run(0.1);
    o.whileLooking = D.changes;
    look(0); for (let i = 0; i < 40 && !D.changes; i++) run(0.1);
    o.gone = g.students.filter((s) => s.gone).map((s) => s.name); o.snd = g.__snd.includes('dread_seat');
    o.log = g.track.log.filter((e) => e.type === 'dreadChange').map((e) => e.kind + ':' + e.v).join(',');
    return o;
  });
  console.log('seat:', JSON.stringify(seat));
  (seat.whileLooking === 0 ? ok : bad).push('nobody disappears while you look at the class');
  (seat.gone.length === 1 && seat.snd && seat.viol === 0 && seat.log === 'seat:gone' ? ok : bad).push(`eyes front: a seat is empty now (${seat.gone[0]}), with a quiet creak`);
  await check('you look at the empty seat: noticed', `(() => {
    const g = game, w = g.dread.watch.find((x) => x.kind === 'seat'), n = me().dread_seen_change;
    const d = w.pts[0].clone().sub(g.camPos);
    look(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z))); run(0.7);
    return me().dread_seen_change === n + 1 && g.track.log.some((e) => e.type === 'dreadSeen' && e.kind === 'seat') ? true : [n, me().dread_seen_change];
  })()`);
  await ev(() => { snap(); });
  await shoot(page, 'dread_seat.png');
  await check('the kid stays gone while you look at the seat, and is back once you look away', `(() => {
    const g = game, D = g.dread, kid = D.gone[0].kid;
    D.nextChange = 1e9; D.gone[0].backAt = g.t;
    for (let i = 0; i < 80; i++) run(0.1);
    const a = kid.gone;
    look(0); for (let i = 0; i < 30 && kid.gone; i++) run(0.1);
    return a && !kid.gone && D.gone.length === 0 && g.track.log.some((e) => e.type === 'dreadChange' && e.v === 'back') ? true : [a, kid.gone];
  })()`);
  await check('two kids change places (only while both seats are out of sight)', `(() => {
    const g = game, D = g.dread;
    DR.seats.find((s) => s.id === 'swap').w = 100; DR.seats.find((s) => s.id === 'gone').w = 0;
    const before = g.students.map((s) => s.seat);
    let viol = 0;
    const ds = g.dreadSeat.bind(g);
    g.dreadSeat = (k, s) => { if (g.dreadSeatPts(k.seat).some(onScreen) || g.dreadSeatPts(s).some(onScreen)) viol++; return ds(k, s); };
    look(0); D.nextChange = g.t; for (let i = 0; i < 40 && !D.moved; i++) run(0.1);
    const moved = g.students.filter((s, i) => s.seat !== before[i]);
    const ok = moved.length === 2 && moved[0].seat === before[g.students.indexOf(moved[1])] && Math.abs(moved[0].root.position.x - moved[0].seat.x) < 0.01 && viol === 0;
    DR.seats.find((s) => s.id === 'swap').w = 1.5; DR.seats.find((s) => s.id === 'gone').w = 3; delete g.dreadSeat;
    return ok ? true : [moved.map((s) => s.name), viol];
  })()`);
  await check('late in the day Kevin is back in his seat for a while, then gone again (never while you look)', `(() => {
    const g = game, D = g.dread, K = g.kevin;
    g.t = 236; run(0.1);
    if (g.phase !== 3) return 'phase ' + g.phase;
    const all = Object.getPrototypeOf(g).dreadCandidates.bind(g);
    g.dreadCandidates = () => all().filter((c) => c.kevin);
    look(0); D.nextChange = g.t; for (let i = 0; i < 40 && !D.kevin; i++) run(0.1);
    const a = !K.gone && K.hollow && !!D.kevin;
    const d = K.headWorld().sub(g.camPos); look(Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
    D.kevin.until = g.t; D.nextChange = 1e9;
    for (let i = 0; i < 50; i++) run(0.1);
    const b = !K.gone;                                   // you are looking at him: he stays
    look(0); for (let i = 0; i < 30 && !K.gone; i++) run(0.1);
    delete g.dreadCandidates;
    return a && b && K.gone && !D.kevin ? true : [a, b, K.gone];
  })()`);
  // a long class with the eyes going everywhere: nothing ever changes on screen
  const sweep = await ev(() => {
    const g = game, o = { viol: [], kinds: {} };
    fresh(2); delete g.dreadCandidates;
    const D = g.dread;
    for (const i of [0, 1, 2, 3]) DR.change.gap[i] = [2, 4];
    g.idleBrain = function* () { for (;;) { yield* this.actWrite(); yield* this.actPonder(); } };   // he writes, thinks, writes...
    g.interrupt((function* () { yield; })());
    const dp = g.dreadPoster.bind(g), ds = g.dreadSeat.bind(g), ba = g.dreadBoardApply.bind(g);
    g.dreadPoster = (x, st) => { if (st > x.stage && g.dreadPosterPts(x).some(onScreen)) o.viol.push('poster'); return dp(x, st); };
    g.dreadSeat = (k, s) => { if (g.dreadSeatPts(k.seat).some(onScreen) || g.dreadSeatPts(s).some(onScreen)) o.viol.push('swap'); return ds(k, s); };
    g.dreadBoardApply = (x) => { if (g.dreadBoardPts.some(onScreen)) o.viol.push('board'); return ba(x); };
    for (const s of [...g.students, g.kevin]) { const sg = Object.getPrototypeOf(s).setGone.bind(s); s.setGone = (v) => { if (g.dreadSeatPts(s.seat).some(onScreen)) o.viol.push('seat ' + s.name); return sg(v); }; }
    D.nextChange = g.t;
    let yawT = 0, pitchT = 0;
    for (let i = 0; i < 9000 && g.state === 'playing'; i++) {
      if (i % 45 === 0) { yawT = (Math.random() * 2 - 1) * 2.8; pitchT = (Math.random() * 2 - 1) * 0.5; if (Math.random() < 0.3) yawT = 0; }
      g.yaw += (yawT - g.yaw) * 0.12; g.pitch += (pitchT - g.pitch) * 0.12;
      if (i === 3000) g.t = 236;                           // the last hour: Kevin too
      g.playTick(1 / 30); g.ui.update(1 / 30);
      calm();
    }
    for (const e of g.track.log) if (e.type === 'dreadChange') o.kinds[e.kind + ':' + e.v] = (o.kinds[e.kind + ':' + e.v] || 0) + 1;
    o.n = D.changes; o.seen = me().dread_seen_change; o.global = g.track.global.dreadChanges; o.strikes = g.strikes; o.state = g.state;
    return o;
  });
  console.log('sweep:', JSON.stringify(sweep));
  (sweep.viol.length === 0 ? ok : bad).push(`5 minutes of looking everywhere, ${sweep.n} changes: not one of them in front of your eyes` + (sweep.viol.length ? ' -> ' + sweep.viol.join(',') : ''));
  const kinds = Object.keys(sweep.kinds).map((k) => k.split(':')[0]);
  (sweep.n >= 15 && kinds.includes('poster') && kinds.includes('board') && kinds.includes('seat') && sweep.global === sweep.n ? ok : bad).push('the board, the posters and the seats all changed (' + Object.entries(sweep.kinds).map(([k, v]) => k + ' x' + v).join(', ') + ')');
  (sweep.seen >= 3 ? ok : bad).push(`you noticed ${sweep.seen} of them`);
  await check('a new class: every poster, seat and light is as it was', `(() => {
    const g = game; g.start('free', 0);
    return g.dreadPosters.every((x) => x.stage === 0 && x.mesh.material.map === x.base) && g.students.every((s) => s.seat === s.dreadHome && !s.gone && Math.abs(s.root.position.x - s.seat.x) < 0.01) && g.kevin.gone && g.dread.changes === 0 && g.world.lights.banks[0].target === 1 && g.me.breath === 1 ? true : 'not reset';
  })()`);

  // ================================================================ a phone: the BREATH button
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const phone = await ctx.newPage();
  phone.on('pageerror', (e) => logs.push('phone PAGEERROR: ' + e.message));
  phone.on('console', (m) => { if (m.type() === 'error') logs.push('phone console: ' + m.text().slice(0, 200)); });
  await phone.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free');
  await phone.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  P = phone;
  await phone.evaluate(helpers);
  const touch = (sel, type) => phone.evaluate(([sel, type]) => {
    const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 7, target: el, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
    el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [sel, type]);
  const layout = `(() => {
    const ids = ['btn-breath', 'btn-talk', 'btn-echo', 'btn-ask', 'btn-phone', 'btn-prank', 'btn-pause'];
    const r = Object.fromEntries(ids.map((id) => [id, document.getElementById(id).getBoundingClientRect()]));
    const b = r['btn-breath'];
    if (!(b.width >= 56 && b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight)) return 'BREATH is off screen: ' + JSON.stringify(b);
    for (const id of ids.slice(1)) { const o = r[id]; if (!(b.right <= o.left + 1 || b.left >= o.right - 1 || b.bottom <= o.top + 1 || b.top >= o.bottom - 1)) return 'BREATH overlaps ' + id; }
    return true;
  })()`;
  await ev(() => fresh(1));
  await check('phone: the BREATH button is there', `getComputedStyle(document.getElementById('btn-breath')).display !== 'none' && document.getElementById('btn-breath').offsetParent !== null`);
  for (const [w, h] of [[844, 390], [667, 375], [568, 320], [390, 844], [360, 740]]) {
    await phone.setViewportSize({ width: w, height: h });
    await phone.waitForTimeout(150);
    await check(`phone ${w}x${h}: BREATH is on screen and clear of the other buttons`, layout);
  }
  await phone.setViewportSize({ width: 844, height: 390 });
  await touch('#btn-breath', 'touchstart');
  await ev(() => run(1));
  await check('phone: hold BREATH holds your breath', `game.me.holding && game.me.breath < 0.95 && document.getElementById('btn-breath').classList.contains('active') && hud().show`);
  await touch('#btn-breath', 'touchend');
  await ev(() => run(0.3));
  await check('phone: let go to breathe', `!game.me.holding && !document.getElementById('btn-breath').classList.contains('active')`);
  await ev(() => { lean(); until('grace'); run(0.5); });
  await check('phone: the hint names the button, the button pulses', `/Hold BREATH and don't drag the view/.test(hint()) && !/Hold B to/.test(hint()) && document.getElementById('btn-breath').classList.contains('ready') && hud().label === 'HOLD YOUR BREATH'`);
  await touch('#btn-breath', 'touchstart');
  await ev(() => { until('hold'); run(0.5); snap(); });
  await shoot(phone, 'dread_phone.png');
  await check('phone: holding it, he listens', `phase() === 'hold' && game.me.holding && !document.getElementById('btn-breath').classList.contains('ready')`);
  await phone.evaluate(() => {
    const c = document.getElementById('view');
    const mk = (x) => new Touch({ identifier: 1, target: c, clientX: x, clientY: 180 });
    c.dispatchEvent(new TouchEvent('touchstart', { touches: [mk(400)], changedTouches: [mk(400)], bubbles: true, cancelable: true }));
    for (let x = 400; x >= 300; x -= 10) c.dispatchEvent(new TouchEvent('touchmove', { touches: [mk(x)], changedTouches: [mk(x)], bubbles: true, cancelable: true }));
    c.dispatchEvent(new TouchEvent('touchend', { touches: [], changedTouches: [mk(300)], bubbles: true, cancelable: true }));
    run(0.2);
  });
  await check('phone: dragging the view while he listens: he noticed', `phase() === 'caught' && game.dread.lean.why === 'moved'`);
  await touch('#btn-breath', 'touchend');
  await ev(() => { fresh(1); lean(); until('grace'); });
  await touch('#btn-breath', 'touchstart');
  await ev(() => { until('leave'); });
  await check('phone: BREATH held and no dragging: he heard nothing', `me().breath_hold === 1`);
  await touch('#btn-breath', 'touchend');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
