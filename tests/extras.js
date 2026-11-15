// Phase 7 on one screen: the chaos scoreboard's grading and titles (pure), the microphone's level meter
// (pure: silence, a laugh, a key click, a fan that never stops), turning the microphone on in SETTINGS
// (a fake microphone: on, its level, off again; the browser saying no, no microphone, not https), a laugh
// into it in class (he hears it, it counts), and that a class on your own has none of the online extras
// (no note going round, no ghost after a strike, no friend to blame, no scoreboard).
//   node extras.js
const { chromium, devices, ROOT, GL, shot } = require('./lib');

(async () => {
  // a fake microphone (a beeping test signal) that the browser allows without asking
  const browser = await chromium.launch({ args: [...GL, '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const open = async (url, init = null) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => logs.push(`${url} PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${url} console: ${m.text().slice(0, 200)}`); });
    if (init) await page.addInitScript(init);
    await page.goto(ROOT + '/index.html?debug=1&' + url);
    await page.waitForFunction(() => window.game && (game.state === 'playing' || !document.getElementById('menu').classList.contains('hidden')), null, { timeout: 180000 });
    return page;
  };
  let r;

  // ---------------------------------------------------------------- 1. the numbers (pure)
  let page = await open('');
  r = await page.evaluate(async () => {
    const S = await import('/src/scoreboard.js'), M = await import('/src/mic.js'), D = await import('/src/data.js');
    const board = S.chaosBoard([
      { id: 'a', name: 'Ann', st: { hitHim: 3, hits: 4 } },
      { id: 'b', name: 'Ben', st: { echoes: 2, questions: 1 } },
      { id: 'c', name: 'Cat', st: {} },
      { id: 'd', name: 'Dan<b>', st: { hitHim: 2, ghost_haunt: 1 } },
    ]);
    const tie = S.chaosBoard([{ id: 'x', name: 'X', st: { whispers: 2 } }, { id: 'y', name: 'Y', st: { whispers: 2 } }]);
    // the microphone's meter, one block of samples at a time (60 blocks a second)
    const block = (amp, n = 1024) => { const b = new Float32Array(n); for (let i = 0; i < n; i++) b[i] = amp * Math.sin(i * 0.3); return b; };
    const run = (st, amp, secs) => { let l = 0; for (let t = 0; t < secs; t += 1 / 60) l = M.micStep(st, block(amp), 1 / 60); return l; };
    const quiet = run({ level: 0 }, 0, 1);
    const laugh = run({ level: 0 }, 0.5, 0.5);
    const st = { level: 0 }; run(st, 0, 0.5); M.micStep(st, block(0.5), 1 / 60); const click = run(st, 0, 0.05);
    const fan = { level: 0 }; const fan1 = run(fan, 0.014, 1), fan60 = run(fan, 0.014, 60);
    return {
      board: board.map((x) => [x.name, x.title.id, x.pts, x.rank]), tie: tie.map((x) => x.rank), pts: S.chaosPoints({ talk: 10, nothing: 99 }),
      mic: { quiet, laugh, click, fan1, fan60, gate: D.MIC.gate, loud: D.MIC.loud },
      noise: [M.micNoiseFrom(0.1), M.micNoiseFrom(D.MIC.gate), M.micNoiseFrom(D.MIC.loud), M.micNoiseFrom(1)],
      minNoise: D.MIC.minNoise,
    };
  });
  const B = Object.fromEntries(r.board.map((x) => [x[0], x]));
  pass(B.Ann[1] === 'sniper' && B.Ben[1] === 'clown' && B.Cat[1] === 'angel' && B.Danb && B.Danb[1] === 'ghost', 'scoreboard: a title for what each did (sniper, clown, ghost: each title once), nothing is THE ANGEL ' + JSON.stringify(r.board));
  pass(r.board[0][0] === 'Ann' && r.board[r.board.length - 1][0] === 'Cat' && r.board.every((x, i) => i === 0 || r.board[i - 1][2] >= x[2]), 'scoreboard: most chaos first');
  pass(!r.board.some((x) => /</.test(x[0])), 'scoreboard: names are cleaned (no HTML)');
  pass(r.tie.join() === '1,1' && r.pts === 6, 'scoreboard: a tie shares the rank; counters it does not know are worth nothing');
  pass(r.mic.quiet < 0.02, `microphone meter: silence is 0 (${r.mic.quiet.toFixed(3)})`);
  pass(r.mic.laugh >= r.mic.loud, `microphone meter: a laugh out loud reaches "loud" (${r.mic.laugh.toFixed(2)})`);
  pass(r.mic.click < r.mic.gate, `microphone meter: a key click is too short to count (${r.mic.click.toFixed(2)})`);
  pass(r.mic.fan1 >= r.mic.gate && r.mic.fan60 < r.mic.gate, `microphone meter: a fan that never stops counts at first, not after a minute (${r.mic.fan1.toFixed(2)} -> ${r.mic.fan60.toFixed(2)})`);
  pass(r.noise[0] === 0 && Math.abs(r.noise[1] - r.minNoise) < 1e-9 && r.noise[2] === 1 && r.noise[3] === 1, 'microphone: below the gate he hears nothing; from "loud" on it is a whisper');

  // ---------------------------------------------------------------- 2. SETTINGS: turning it on and off
  const settings = async (p) => { await p.click('#btn-settings'); await p.waitForTimeout(200); };
  await settings(page);
  r = await page.evaluate(() => ({ checked: document.getElementById('set-mic').checked, on: game.mic.on, saved: !!JSON.parse(localStorage.getItem('madiclass.settings') || '{}').mic }));
  pass(!r.checked && !r.on && !r.saved, 'the microphone is off at the start (and the setting is never saved)');
  await page.click('#set-mic');
  pass(await page.waitForFunction(() => game.mic.on && /Microphone on/.test(document.getElementById('set-mic-note').innerText), null, { timeout: 10000 }).then(() => true, () => false), 'turned on: the browser gave a microphone; "Only how loud you are is measured. Nothing is recorded or sent."');
  r = await page.evaluate(async () => { let max = 0; for (let i = 0; i < 40; i++) { await new Promise((res) => setTimeout(res, 50)); max = Math.max(max, game.mic.level); } return { max, meter: document.getElementById('set-mic-meter').classList.contains('on'), tracks: game.mic.stream.getAudioTracks().length }; });
  pass(r.tracks === 1 && r.meter && Number.isFinite(r.max), `its level shows under the setting (the test microphone peaks at ${r.max.toFixed(2)})`);
  await page.screenshot({ path: shot('extras_mic_setting.png') });
  await page.click('#set-mic');
  r = await page.evaluate(() => ({ on: game.mic.on, stream: !!game.mic.stream, level: game.mic.level, note: document.getElementById('set-mic-note').innerText }));
  pass(!r.on && !r.stream && r.level === 0 && r.note === '', 'turned off: the microphone is let go');
  await page.close();
  // (each case stubs the browser before the game loads: one init script per case)
  const refused = async (init) => {
    const p = await open('', init);
    await settings(p);
    await p.click('#set-mic');
    const res = await p.waitForFunction(() => document.getElementById('set-mic-note').innerText.length > 30, null, { timeout: 8000 }).then(() => true, () => false);
    const out = await p.evaluate(() => ({ checked: document.getElementById('set-mic').checked, on: game.mic.on, note: document.getElementById('set-mic-note').innerText }));
    await p.close();
    return res && out;
  };
  r = await refused(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('test', 'NotAllowedError')); });
  pass(r && !r.checked && !r.on && /did not allow/.test(r.note), 'the browser says no: the setting turns itself off again, and says how to allow it');
  r = await refused(() => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('test', 'NotFoundError')); });
  pass(r && !r.checked && /No microphone/.test(r.note), 'no microphone: off again, "No microphone was found"');
  r = await refused(() => { Object.defineProperty(window, 'isSecureContext', { get: () => false }); });
  pass(r && !r.checked && /secure \(https\)/.test(r.note), 'not https: off again, "only works on a secure (https) page"');

  // ---------------------------------------------------------------- 3. in class, on your own
  page = await open('autostart=1&mode=free&events=none&quirks=none');
  r = await page.evaluate(async () => {
    const g = game, T = g.teacher, out = {};
    g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false; g.dreadAuto = false;
    const step = (n) => { for (let i = 0; i < n && g.state === 'playing'; i++) { g.playTick(0.05); g.ui.update(0.05); } };
    const said = []; const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return say0(id, v); };
    step(300);
    g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.anger = 0;
    // a laugh into the microphone (its level, as if it were on)
    g.mic.on = true; g.micUpdate = () => { g.mic.level = 0.8; return 0.8; };
    step(6);
    out.heard = g.me.noise >= 0.99 && g.anger > 0 && g.track.of(g.me).mic_noise === 1 && /real voice/.test(document.getElementById('hint').innerText);
    step(54);
    out.rearm = g.track.of(g.me).mic_noise; // (counted again after MIC.rearm seconds of laughing)
    g.micUpdate = () => { g.mic.level = 0.1; return 0.1; };
    step(4); out.quietNoise = g.me.noise;
    g.mic.on = false; g.micUpdate = () => { g.mic.level = 0; return 0; };
    // no note going round on your own
    g.chainNext = 0; step(20); out.chain = !!g.chain;
    // "Who did it?": no friend to point at
    g.interrupt(g.askWhoDidIt(g.me, 'prank'));
    let n = 0; while (!g.choice && n++ < 400) g.playTick(0.05);
    out.labels = g.choice ? g.choice.labels.length : -1;
    g.pickChoice(1); step(80);
    // caught: no ghost on your own
    g.bust('noise', g.me);
    n = 0; while ((g.cutscene || !g.brainIdle) && n++ < 600) g.playTick(0.05);
    out.ghost = !!g.me.ghost || g.me.ghostK > 0;
    // the bell: no scoreboard
    g.t = 299; n = 0; while (g.state === 'playing' && n++ < 4000) g.playTick(0.05);
    out.end = g.state; out.board = document.getElementById('end-chaos').innerHTML;
    return out;
  });
  pass(r.heard, 'in class: a laugh into the microphone makes noise he hears, counts (mic_noise), "He heard that!"');
  pass(r.rearm >= 2 && r.rearm <= 3, `a long laugh is counted again every ${2.5} s, not every frame (${r.rearm})`);
  pass(r.quietNoise < 0.01, 'quiet again: no noise');
  pass(!r.chain && r.labels === 3 && !r.ghost, 'on your own: no note going round, three answers to "Who did it?", no ghost after a strike ' + JSON.stringify([r.chain, r.labels, r.ghost]));
  pass(r.end === 'end' && r.board === '', 'on your own: no chaos scoreboard on the end screen');

  // ---------------------------------------------------------------- 4. a ghost on a phone: LIGHT / CHAIR / BOOK
  {
    const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => logs.push(`touch PAGEERROR ${e.message}`));
    await p.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free&events=none&quirks=none');
    await p.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 180000 });
    // (a ghost needs friends online: here one is made by hand, to look at the buttons)
    await p.evaluate(() => { const g = game; g.post.render = () => {}; g.dreadAuto = false; for (let i = 0; i < 200; i++) g.playTick(0.05);
      g.me.ghost = { t0: g.t - 10, until: g.t + 50, cd: [0, 0, 0], out: false }; g.me.ghostK = 1; for (let i = 0; i < 4; i++) g.playTick(0.05); });
    await p.waitForTimeout(300);
    const vis = (id) => p.evaluate((id) => { const el = document.getElementById(id); return !!el && el.offsetParent !== null && getComputedStyle(el).display !== 'none'; }, id);
    r = await p.evaluate(() => ({ e: document.getElementById('btn-echo').textContent, a: document.getElementById('btn-ask').textContent, t: document.getElementById('btn-talk').textContent, hud: document.getElementById('ghost-hud').classList.contains('show') }));
    const hidden = !(await vis('btn-phone')) && !(await vis('btn-prank'));
    pass(r.e === 'LIGHT' && r.a === 'CHAIR' && r.t === 'BOOK' && r.hud && hidden, 'a ghost on a phone: the buttons are LIGHT / CHAIR / BOOK (PHONE and PRANK hidden), the GHOST hud ' + JSON.stringify(r));
    await p.tap('#btn-echo'); await p.waitForTimeout(300);
    await p.evaluate(() => { for (let i = 0; i < 3; i++) game.playTick(0.05); });
    pass(await p.evaluate(() => game.track.log.some((e) => e.type === 'haunt' && e.id === 'light')), 'tapping LIGHT flickers the lights');
    await p.screenshot({ path: shot('extras_ghost_phone.png') });
    await p.evaluate(() => { game.me.ghost = null; game.me.ghostK = 0; for (let i = 0; i < 3; i++) game.playTick(0.05); });
    r = await p.evaluate(() => ({ e: document.getElementById('btn-echo').textContent, t: document.getElementById('btn-talk').textContent, hud: document.getElementById('ghost-hud').classList.contains('show') }));
    pass(r.e === 'ECHO' && r.t === 'TALK' && !r.hud && await vis('btn-phone'), 'back in your seat: the usual buttons');
    await ctx.close();
  }

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
