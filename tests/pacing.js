// Pacing (src/pacing.js): room to breathe for the player.
//  - while he leans over your desk: no friend's call or phone buzz starts or runs out ("HEY!"), no "repeat him" cue, no asking;
//  - tips wait while a scare is on, and come one at a time with a gap;
//  - after a scene of his, a calm stretch before he starts another one of his own;
//  - his habits slow down and stop after a few per class; his habit lines are not said back to back;
//  - the task list shows a few open tasks (always the newest), a finished one only for a moment;
//  - your phone only buzzes while he is not looking at you;
//  - a whole Free Class with a player who does nothing: the guaranteed scares still come, calm stretches, no pile-ups.
//   node pacing.js
const { chromium, ROOT, GL } = require('./lib');

(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const page = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
  page.on('pageerror', (e) => logs.push(`PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`console: ${m.text().slice(0, 200)}`); });
  await page.addInitScript(() => {
    let s = 7; window.__seed = (n) => { s = n >>> 0 || 1; };
    Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  });
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free&ch=0&events=none&quirks=none');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 180000 });
  await page.evaluate(() => {
    const g = game;
    g.post.render = () => {};
    window.step = (sec, f) => { for (let i = 0; i < sec * 20; i++) { if (f && f()) return true; g.playTick(0.05); g.ui.update(0.05); } return false; };
    window.snds = []; const op = g.audio.play.bind(g.audio); g.audio.play = (n, o = {}) => { snds.push({ n, t: g.t }); return op(n, o); };
  });
  let r;

  // ---------------------------------------------------------------- 1. he leans over your desk: nothing else asks you
  r = await page.evaluate(() => {
    const g = game, D = g.dread;
    g.updateDirector = () => {}; g.startMeme = () => false; g.dreadAuto = false; g.eventsOn = false; g.updateFreeShows = () => {};
    step(40);
    g.anger = 0; g.callsOn = g.buzzOn = true;
    // Nora calls you, then he comes to listen at your desk: you do the right thing (hold your breath, keep still)
    const nora = g.friend('nora'); nora.call = { stage: 1, timer: 1 }; nora.lookTarget = g.camPos;
    g.interrupt(g.dreadLean(g.me, { from: 'visit' }));
    g.nextBuzz = 0; g.nextCall = 0;
    let stageMax = 1, buzzed = false, cue = false, ask = true, lean = false, hey = false;
    const t0 = g.t;
    snds.length = 0;
    for (let i = 0; i < 40 * 20 && (D.lean || i < 20); i++) {
      g.input.keys.breath = !!g.dreadLeanOn(g.me);
      g.playTick(0.05); g.ui.update(0.05);
      if (g.leanFor(g.me)) {
        lean = true;
        stageMax = Math.max(stageMax, nora.call ? nora.call.stage : 9);
        buzzed = buzzed || !!g.buzz;
        cue = cue || document.getElementById('echo-cue').classList.contains('show') || g.canEcho(g.me);
        ask = ask && !g.canAsk(g.me);
      }
    }
    g.input.keys.breath = false;
    hey = snds.some((s) => /^(n_hey|s_hey)$/.test(s.n));
    return { lean, stageMax, buzzed, cue, ask, hey, secs: +(g.t - t0).toFixed(1), anger: Math.round(g.anger) };
  });
  pass(r.lean, 'he walks over and leans over your desk (the test sets it up) ' + JSON.stringify(r));
  pass(r.stageMax === 1 && !r.hey, `a friend's call waits while he listens: it never turns into "HEY!" (stage ${r.stageMax}, anger ${r.anger})`);
  pass(!r.buzzed, 'your phone does not start buzzing while he comes to listen at your desk');
  pass(!r.cue && r.ask, 'no "repeat him" cue and no asking a question while he listens at your desk');

  // ---------------------------------------------------------------- 2. tips wait for a scare to end, and keep a gap
  r = await page.evaluate(() => {
    const g = game, ui = g.ui;
    const nora = g.friend('nora'); nora.call = null; g.callsOn = g.buzzOn = false; g.buzz = null; ui.phoneAlert(false);
    step(25);
    g.interrupt(g.scareScene('pencil'));
    step(0.5);
    g.showHint('TIP ONE: a test tip', 4);
    let inScare = false, t1 = -1, t2 = -1;
    for (let i = 0; i < 80 * 20; i++) {
      g.playTick(0.05); ui.update(0.05);
      if (i === 200) g.showHint('TIP TWO: another test tip', 4);
      const txt = document.getElementById('hint').classList.contains('show') ? document.getElementById('hint').textContent : '';
      if (/TIP ONE/.test(txt)) { if (g.scareBusy) inScare = true; if (t1 < 0) t1 = g.t; }
      if (/TIP TWO/.test(txt) && t2 < 0) t2 = g.t;
      if (t2 > 0) break;
    }
    return { inScare, t1: +t1.toFixed(1), t2: +t2.toFixed(1), gap: +(t2 - t1).toFixed(1) };
  });
  pass(r.t1 > 0 && !r.inScare, `a tip given during a scare waits until the scare is over (shown at ${r.t1} s)`);
  pass(r.t2 > 0 && r.gap >= 8.5, `two tips come one at a time, with a gap (${r.gap} s)`);

  // ---------------------------------------------------------------- 3. a calm stretch after his scenes
  r = await page.evaluate(() => {
    const g = game;
    step(5);
    g.interrupt(g.actCount());
    const busy = step(30, () => g.paceBusy) || g.paceBusy;
    step(30, () => !g.paceBusy);
    const endT = g.t, calm = +(g.calmUntil - endT).toFixed(1), okNow = g.calmOk();
    g.quirks = new Set(['count']); g.quirkNext = { count: 0 };
    const act = g.calmOk() ? g.quirkAct() : null;
    step(Math.max(0, g.calmUntil - g.t) + 0.2);
    return { busy, calm, okNow, act: !!act, okLater: g.calmOk() };
  });
  pass(r.busy && r.calm >= 11.9 && r.calm <= 18.1 && !r.okNow && !r.act, `after a scene of his, ${r.calm} s of plain lesson before he starts another one of his own`);
  pass(r.okLater, 'then he may start his next scene');

  // ---------------------------------------------------------------- 4. his habits: slower each time, a few per class; his lines not back to back
  r = await page.evaluate(async () => {
    const g = game, { PACE, QUIRKS } = await import('/src/data.js');
    g.quirkRuns = {}; g.quirkNext = {};
    const gaps = [];
    for (let i = 0; i < 4; i++) { const t0 = g.t; g.habitNext('count', [50, 50]); gaps.push(+(g.quirkNext.count - t0).toFixed(1)); }
    g.lineAt = {};
    const a = g.freshLine(['t_qc_tick']), b = g.freshLine(['t_qc_tick']);
    g.t += PACE.lineGap + 1; const c = g.freshLine(['t_qc_tick']);
    return { gaps, max: PACE.habits.max.count, a, b, c };
  });
  pass(r.gaps[0] === 50 && r.gaps[1] === 65 && r.gaps[2] > 1e6, `he counts the class at most ${r.max} times a class, each time a little later (next ones after ${r.gaps[0]} s, ${r.gaps[1]} s, then never)`);
  pass(r.a === 't_qc_tick' && r.b === null && r.c === 't_qc_tick', '"Tick... tock." is not said again before a while');

  // ---------------------------------------------------------------- 5. the task list: a few at a time, always the newest
  r = await page.evaluate(() => {
    const g = game;
    g.setObjectives([{ id: 'a', text: 'Task A' }, { id: 'b', text: 'Task B' }, { id: 'c', text: 'Task C' }, { id: 'd', text: 'Task D' }, { id: 'bell', text: 'Survive until 12:30' }]);
    g.addObjective({ id: 'e', text: 'Task E (new)' });
    const li = () => [...document.querySelectorAll('#objectives li')].map((x) => x.textContent);
    const first = li();
    g.completeObjective('a');
    const done = li();
    step(4.5);
    const later = li();
    return { first, done, later };
  });
  pass(r.first.length === 4 && r.first.includes('Task E (new)') && r.first[r.first.length - 1] === 'Survive until 12:30', 'the list shows 3 open tasks (the newest among them) and the bell ' + JSON.stringify(r.first));
  pass(r.done.includes('Task A') && !r.later.includes('Task A') && r.later.includes('Task C'), 'a finished task stays struck through for a moment, then the next one takes its place ' + JSON.stringify(r.later));

  // ---------------------------------------------------------------- 6. a whole Free Class, a player who does nothing
  r = await page.evaluate(() => {
    const g = game; window.__seed(202);
    for (const k of ['updateDirector', 'startMeme', 'updateFreeShows']) delete g[k];
    g.dreadAuto = true;
    g.start('free', 0, { seed: 202 });
    const T = g.teacher, D = g.dread;
    const leans = [], asksInLean = [], tipsInScare = [], scares = new Set(), busy = [];
    let prevHint = '', wasLean = false, callWas = false, buzzWas = false;
    snds.length = 0;
    while (g.state === 'playing' && g.t < 400) {
      g.input.keys.breath = !!g.dreadLeanOn(g.me);
      if (g.choice) g.input.choiceKey = g.choice.labels.length - 1;
      if (g.ui.noteOpen) g.ui.closeNote();
      g.playTick(0.05); g.ui.update(0.05);
      const lean = g.leanFor(g.me);
      if (lean && !wasLean) leans.push([g.t, null]); if (!lean && wasLean) leans[leans.length - 1][1] = g.t; wasLean = lean;
      const call = g.friends.some((f) => f.call), buzz = !!g.buzz;
      if (lean && ((call && !callWas) || (buzz && !buzzWas))) asksInLean.push(+g.t.toFixed(1));
      callWas = call; buzzWas = buzz;
      if (g.scareBusy) scares.add(g.scareBusy + '@' + Math.round(g.lastScare[g.scareBusy] || 0));
      const h = document.getElementById('hint'), txt = h.classList.contains('show') ? h.textContent : '';
      if (txt && txt !== prevHint && g.ui.hintIsTip && (g.scareBusy || g.scLocalOn)) tipsInScare.push(txt.slice(0, 50));
      prevHint = txt;
      busy.push(g.paceBusy);
    }
    const heyInLean = snds.filter((s) => /^(n_hey|s_hey)$/.test(s.n) && leans.some(([a, b]) => s.t >= a && s.t <= (b ?? 1e9))).length;
    // calm stretches: runs of 15 s or more with no scene of his
    let run = 0, calm15 = 0; for (const b of busy) { if (!b) run++; else { if (run >= 300) calm15++; run = 0; } } if (run >= 300) calm15++;
    const scenePct = Math.round(100 * busy.filter(Boolean).length / busy.length);
    return { state: g.state, t: Math.round(g.t), leans: leans.length, asksInLean, heyInLean, tipsInScare, scares: [...scares], strong: g.strongN, first: !!g.firstScare, scenePct, calm15 };
  });
  pass(r.state === 'end', `the class plays to the bell (${r.t} s)`);
  pass(!r.asksInLean.length && !r.heyInLean, `no call or buzz starts while he leans over your desk, and no "HEY!" lands then (${r.leans} leans) ` + JSON.stringify(r.asksInLean));
  pass(!r.tipsInScare.length, 'no tip pops up in the middle of a scare ' + JSON.stringify(r.tipsInScare));
  pass(r.first && r.strong >= 2, `the scares the class is owed still come: an early one and ${r.strong} big ones (${r.scares.join(', ')} ...)`);
  pass(r.scenePct <= 75 && r.calm15 >= 3, `room to breathe: he is in a scene ${r.scenePct}% of the class, ${r.calm15} calm stretches of 15 s or more`);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
