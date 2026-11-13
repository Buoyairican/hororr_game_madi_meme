// Targeted tests: note mission (pass / caught), power cut (quiet / noisy), hard mode rules
const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const run = async (url, fn, arg) => {
    const page = await browser.newPage({ viewport: { width: 400, height: 225 } });
    page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    await page.goto(ROOT + '/index.html?debug=1&autostart=1&' + url);
    await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
    await page.evaluate(() => { game.post.render = () => {}; });
    const r = await page.evaluate(fn, arg);
    await page.close();
    return r;
  };
  const pass = (c, n) => (c ? ok : bad).push(n);
  // helper code injected into each test
  const H = `
    const g = game, subs = [];
    const step = (n, each) => { for (let i = 0; i < n && g.state === 'playing'; i++) { if (each) each(); g.playTick(0.05); g.ui.update(0.05); const s = document.getElementById('subtitle').innerText.replace(/\\n/g, ' '); if (s && s !== subs[subs.length - 1]) subs.push(s); } };
    const until = (fn, max, each) => { let n = 0; while (!fn() && n < max / 0.05 && g.state === 'playing') { if (each) each(); g.playTick(0.05); g.ui.update(0.05); const s = document.getElementById('subtitle').innerText.replace(/\\n/g, ' '); if (s && s !== subs[subs.length - 1]) subs.push(s); n++; } return fn(); };
  `;
  // 1. note mission: pass it while he is not looking
  let r = await run('mode=story&ch=1', new Function(H + `
    g.callsOn = false; g.buzzOn = false; g.memesOn = false;
    g.script = (function* () { yield* g.noteMission(); })();
    until(() => g.objectives.some((o) => o.id === 'pass'), 40, () => { if (g.ui.noteOpen) g.ui.closeNote(); });
    if (g.ui.noteOpen) g.ui.closeNote();
    const nora = g.friends.find((f) => f.kind === 'nora');
    // wait until his back is turned, then whisper to Nora
    until(() => !g.watching, 60);
    g.yaw = -1.52; g.pitch = -0.05;
    until(() => g.objDone('pass'), 20, () => { g.input.keys.talk = !g.watching; });
    g.input.keys.talk = false;
    step(80);
    return { done: g.objDone('pass'), strikes: g.strikes, said: subs.filter((s) => /Nora|Sam/.test(s)).slice(-3) };`));
  pass(r.done && r.strikes === 0 && r.said.some((s) => /Got it/.test(s)), 'note passed to Nora while he looks away: ' + JSON.stringify(r));
  // 2. note mission: caught passing it in front of him -> he reads it out
  r = await run('mode=story&ch=1', new Function(H + `
    g.callsOn = false; g.buzzOn = false; g.memesOn = false;
    g.script = (function* () { yield* g.noteMission(); })();
    until(() => g.objectives.some((o) => o.id === 'pass'), 40, () => { if (g.ui.noteOpen) g.ui.closeNote(); });
    if (g.ui.noteOpen) g.ui.closeNote();
    until(() => g.brainIdle, 30);
    g.interrupt(g.actStare(8));
    until(() => g.watching, 10);
    g.yaw = -1.52; g.pitch = -0.05; g.input.keys.talk = true;
    until(() => g.strikes > 0, 40);
    g.input.keys.talk = false;
    step(300);
    return { strikes: g.strikes, read: subs.some((s) => /a real... teacher/.test(s)) };`));
  pass(r.strikes === 1 && r.read, 'caught passing the note: he reads it out and you get a strike: ' + JSON.stringify(r));
  // 3. power cut, quiet
  r = await run('mode=story&ch=2', new Function(H + `
    g.callsOn = false; g.buzzOn = false; g.scaresOn = false; g.memesOn = false;
    g.lockBully = false;
    g.script = null;
    g.interrupt((function* () { yield* g.powerCut(); })());
    let sawDark = false, sawHim = 0;
    until(() => g.objDone('dark') || g.strikes > 0, 60, () => { if (g.world.master < 0.1) sawDark = true; if (g.teacher.root.visible && g.world.master < 0.1) sawHim++; });
    step(500);
    return { dark: sawDark, flashesWithHim: sawHim > 0, done: g.objDone('dark'), strikes: g.strikes, lights: g.world.master, afraid: subs.some((s) => /afraid/.test(s)) };`));
  pass(r.dark && r.flashesWithHim && r.done && r.strikes === 0 && r.lights === 1 && r.afraid, 'power cut, quiet: lights back, task done: ' + JSON.stringify(r));
  // 4. power cut, noisy
  r = await run('mode=story&ch=2', new Function(H + `
    g.callsOn = false; g.buzzOn = false; g.scaresOn = false; g.memesOn = false; g.script = null;
    g.interrupt((function* () { yield* g.powerCut(); })());
    until(() => g.world.master < 0.1, 10);
    g.yaw = 1.52; g.input.keys.talk = true;
    step(60); g.input.keys.talk = false;
    until(() => g.strikes > 0, 40);
    step(40);
    return { strikes: g.strikes, lights: g.world.master, blackout: g.blackoutTarget };`));
  pass(r.strikes === 1 && r.lights === 1 && r.blackout === 0, 'power cut, whispering in the dark: he gets you when the lights come back: ' + JSON.stringify(r));
  // 5. hard: seen whispering = caught at once = game over
  r = await run('mode=free&diff=hard', new Function(H + `
    until(() => g.brainIdle && g.memesOn, 60);
    g.interrupt(g.actStare(6));            // he is looking right at the class
    until(() => g.watching, 10);
    const t0 = g.t;
    g.yaw = 1.52; g.input.keys.talk = true;
    until(() => g.cutscene, 10);
    const reaction = g.t - t0;
    g.input.keys.talk = false;
    until(() => g.state === 'end', 40);
    return { maxStrikes: g.maxStrikes, reaction: +reaction.toFixed(2), state: g.state, title: document.getElementById('end-title').innerText, text: document.getElementById('end-text').innerText };`));
  pass(r.maxStrikes === 1 && r.reaction < 1.5 && r.state === 'end' && r.title === 'DETENTION' && /once is enough/.test(r.text), 'hard: seen whispering, he comes at once, one strike ends it: ' + JSON.stringify(r));
  // 6. easy: same thing only warns
  r = await run('mode=free&diff=easy', new Function(H + `
    until(() => g.brainIdle && g.memesOn, 60);
    until(() => g.watching, 60);
    g.yaw = 1.52; g.input.keys.talk = true;
    step(30);
    g.input.keys.talk = false;
    step(200);
    return { maxStrikes: g.maxStrikes, strikes: g.strikes, state: g.state };`));
  pass(r.maxStrikes === 3 && r.strikes === 0 && r.state === 'playing', 'easy: a short whisper in view is only a warning: ' + JSON.stringify(r));
  // 7. hard: whispering while he can NOT see you: no sixth sense, he warns first
  r = await run('mode=free&diff=hard', new Function(H + `
    until(() => g.brainIdle && g.memesOn, 60);
    const T = g.teacher, V = T.pos.constructor;
    g.interrupt((function* () { T.faceTo(Math.PI, 20); while (true) { T.lookAt(new V(T.pos.x, 1.7, -7.5), 20); yield; } })());
    step(20);
    g.yaw = 1.52; g.input.keys.talk = true;
    const t0 = g.t;
    until(() => g.flags.r40 || g.cutscene, 60);
    const res = { warned: g.flags.r40, strikesAtWarning: g.strikes, after: +(g.t - t0).toFixed(1), watchingMe: g.me.watching };
    g.input.keys.talk = false;
    return res;`));
  pass(r.warned && r.strikesAtWarning === 0 && r.after > 3, 'hard: unseen whispering only builds anger, he warns first: ' + JSON.stringify(r));
  // 8. hard: two echoes are not enough any more (same as easy: the third one is)
  r = await run('mode=free&diff=hard', new Function(H + `
    let n = 0;
    until(() => g.state !== 'playing' || n >= 2, 240, () => { if (g.canEcho() && n < 2) { g.input.pressed.echo = true; n++; } });
    until(() => !g.echoBusy, 60);
    return { echoes: n, state: g.state, strikes: g.strikes };`));
  pass(r.echoes === 2 && r.state === 'playing' && r.strikes === 0, 'hard: two echoes in a row are not a catch: ' + JSON.stringify(r));
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
