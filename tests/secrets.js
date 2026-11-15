// Phase 6: the two secret endings, reached by playing (no debug flags):
//  - CLASS CANCELLED (Free Class): paper on his head three times in one class breaks his glasses.
//    The first two crack them (a sound, a hint with the count); in the story they never break.
//  - MR. HALE (story, the last period): get the true ending; when he is gone something knocks at the
//    back; look at the supply closet and knock three times (E / click, TALK on a touch screen).
//    Without the knocks the true ending stays what it was.
//   node secrets.js
const { chromium, devices, ROOT, GL, shot } = require('./lib');

(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const open = async (url, ctxOpts = { viewport: { width: 640, height: 360 } }) => {
    const ctx = await browser.newContext(ctxOpts);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => logs.push(`${url} PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${url} console: ${m.text().slice(0, 200)}`); });
    await page.goto(ROOT + '/index.html?debug=1&autostart=1&' + url);
    await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 180000 });
    return page;
  };
  // helpers inside the page: g, step, until, blind, aimAt, said (his lines), subs (every subtitle), heard (sounds), headshot()
  const H = `
    const g = game, V = g.camPos.constructor;
    const realRender = g.post.render.bind(g.post);
    g.post.render = () => {};
    const step = (n, each) => { for (let i = 0; i < n && g.state === 'playing'; i++) { if (each) each(); g.playTick(0.05); g.ui.update(0.05); } };
    const until = (fn, max, each) => { let n = 0; while (!fn() && n < max / 0.05 && g.state === 'playing') { if (each) each(); g.playTick(0.05); g.ui.update(0.05); n++; } return !!fn(); };
    const uw = g.updateWatching.bind(g);
    g.updateWatching = function () { uw(); if (g.blindTest) for (const p of g.players) { p.watching = false; p.lookDot = -1; } };
    const blind = (on) => { g.blindTest = on; };
    const aimAt = (pt) => { const d = pt.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
    const said = [], subs = [], heard = [];
    const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return say0(id, v); };
    const sub0 = g.ui.subtitle.bind(g.ui); g.ui.subtitle = (who, text, cls, dur) => { subs.push(who + ': ' + text); return sub0(who, text, cls, dur); };
    const play0 = g.audio.play.bind(g.audio); g.audio.play = (name, o) => { heard.push(name); return play0(name, o); };
    const quiet = () => { g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false; };
    const atBoard = () => { const T = g.teacher; g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.prankBusy = false; g.anger = 0; };
    // a paper ball that really flies into the back of his head
    const headshot = () => { const T = g.teacher, head = T.headWorld(new V()), from = head.clone().add(new V(0, 0.05, 1.0)); const n = g.track.of(g.me).glassesOff; g.spawnPaper(g.me, null, 'ball', from, head.clone().sub(from).normalize().multiplyScalar(9), 0); return until(() => g.track.of(g.me).glassesOff > n || g.cutscene, 3); };
    const prof = () => JSON.parse(localStorage.getItem('madiclass.replay') || '{}');
  `;
  const ev = (page, body) => page.evaluate(new Function(H + body)).catch((e) => ({ error: e.message.slice(0, 300) }));
  let r, page;

  // ---------------------------------------------------------------- CLASS CANCELLED
  page = await open('mode=free');
  r = await ev(page, `
    quiet(); step(240); blind(true); atBoard(); step(6);
    const T = g.teacher, out = {};
    out.hit1 = headshot();
    until(() => /cracked/.test(document.getElementById('hint').innerText), 6);
    out.crack1 = document.getElementById('hint').innerText; out.sound1 = heard.includes('p6_crack');
    out.blindOnce = said.includes('t_myglasses');
    until(() => !g.prankBusy && T.glasses.parent === T.head, 12); atBoard(); g.me.prankStreak = 0; g.me.lastPrankHit = -99; step(4);
    out.hit2 = headshot();
    until(() => /2 \\/ 3/.test(document.getElementById('hint').innerText), 6);
    out.crack2 = document.getElementById('hint').innerText;
    until(() => !g.prankBusy && T.glasses.parent === T.head, 12); atBoard(); step(4);
    out.before = { state: g.state, cutscene: g.cutscene, hits: g.glassHits };
    window.__keep = { said, subs, heard, realRender };
    out.hit3 = headshot();
    step(2);
    out.started = g.cutscene && g.ending && g.strikes === 0;
    until(() => said.includes('t_broken'), 14);
    out.t = g.t;
    return out;`);
  pass(!r.error && r.hit1 && /cracked/.test(r.crack1) && /1 \/ 3/.test(r.crack1) && r.sound1 && r.blindOnce, 'paper on his head: the glasses fly off, and they crack (a sound, the hint says 1 / 3) ' + JSON.stringify(r.error || r.crack1));
  pass(!r.error && r.hit2 && /2 \/ 3/.test(r.crack2) && r.before.state === 'playing' && !r.before.cutscene && r.before.hits === 2, 'the second time: 2 / 3, the class goes on');
  pass(!r.error && r.hit3 && r.started, 'the third time: the secret ending starts (no strike, even right after the second hit)');
  await page.evaluate(() => { const g = game; g.yaw = 0.05; g.pitch = 0.02; g.applyCamera(0.016); window.__keep.realRender(g.scene, g.camera); });
  await page.screenshot({ path: shot('secret_glasses.png') });
  r = await page.evaluate(() => {
    const g = game, K = window.__keep, T = g.teacher;
    let n = 0, gone = false, doorOpen = false;
    while (g.state === 'playing' && n++ < 3000) { g.playTick(0.05); g.ui.update(0.05); gone = gone || !T.root.visible; doorOpen = doorOpen || g.world.door.openTarget === 1; }
    const p = JSON.parse(localStorage.getItem('madiclass.replay') || '{}');
    return { state: g.state, title: document.getElementById('end-title').innerText, text: document.getElementById('end-text').innerText, again: document.getElementById('btn-again').innerText,
      said: K.said.slice(-8), friends: K.subs.filter((s) => /^(Sam|Nora)/.test(s)).slice(-3), gone, doorOpen, broke: K.heard.includes('p6_break'), cheer: K.heard.includes('v_applause'), bell: K.heard.includes('bell'),
      kind: g.lastCard && g.lastCard.kind, win: g.lastCard && g.lastCard.win, ends: p.endings, log: g.track.log.some((e) => e.type === 'secret' && e.kind === 'glasses'), strikes: g.strikes };
  });
  pass(r.state === 'end' && /CLASS CANCELLED/.test(r.title) && /glasses broke/.test(r.text) && r.again === 'TRY AGAIN', 'its own end screen: CLASS CANCELLED ' + JSON.stringify(r.title));
  pass(['t_myglasses', 't_broken', 't_noclass', 't_isthere', 't_notteacher', 't_lookup'].every((x) => r.said.includes(x)) && r.broke, 'its own scene and lines: they break, "They are... broken.", "I cannot... see... the class.", "Is there... a class?", "Then... I am not... a teacher." ' + JSON.stringify(r.said));
  pass(r.friends.some((s) => /broke his glasses/.test(s)) && r.friends.some((s) => /can't see/.test(s)) && r.gone && r.doorOpen && r.cheer && r.bell, 'Sam and Nora say something, he walks out of the door, the class cheers, the bell rings');
  pass(r.kind === 'glasses' && r.win && r.ends.glasses === 1 && r.log && r.strikes === 0, 'it counts as a class that ended well; the ending is kept in the browser and in the class log');
  // a new class after it: he has his glasses again, the count starts over
  r = await page.evaluate(() => { const g = game; g.endPrimary(); for (let i = 0; i < 40; i++) g.playTick(0.05); const T = g.teacher; return { state: g.state, worn: T.glasses.parent === T.head && T.glassesOn, hits: g.glassHits, vis: T.root.visible, door: g.world.door.openTarget }; });
  pass(r.state === 'playing' && r.worn && r.hits === 0 && r.vis && r.door === 0, 'TRY AGAIN: a normal class again (glasses on, count at 0)');
  await page.close();

  // in the story they are Mr. Hale's glasses: they hold
  page = await open('mode=story&ch=2');
  r = await ev(page, `
    quiet(); g.script = null; g.cutscene = false; g.lockBully = false; g.allowPrank = true; step(20); blind(true); atBoard(); step(6);
    const T = g.teacher; let n = 0;
    for (let i = 0; i < 3; i++) {
      if (headshot()) n++;
      until(() => !g.prankBusy && T.glasses.parent === T.head, 12); atBoard(); g.me.prankStreak = 0; g.me.lastPrankHit = -99; step(4);
    }
    step(80);
    return { n, hits: g.glassHits, state: g.state, ending: g.ending, hint: /cracked/.test(document.getElementById('hint').innerText), crack: heard.includes('p6_crack'), stat: g.track.of(g.me).glassesOff };`);
  pass(!r.error && r.n === 3 && r.stat === 3 && r.state === 'playing' && !r.ending && !r.crack, 'story: three hits on his head, the glasses never crack or break ' + JSON.stringify(r));
  await page.close();

  // ---------------------------------------------------------------- MR. HALE
  // the last period: the finale, ask him what he is (the true ending)...
  const finale = `
    quiet(); g.script = null; step(10);
    g.cutscene = false; g.lockBully = false; g.eventLock = false;
    g.interrupt(g.finale());
    until(() => !!g.choice, 30);
    const labels = g.choice ? g.choice.labels.slice() : [];
    g.input.choiceKey = 0;                       // "Are you really a teacher?"
    until(() => heard.includes('p6_knock'), 120); // ...he looks it up, takes off the glasses, and is gone. Then: a knock.
  `;
  page = await open('mode=story&ch=3');
  r = await ev(page, finale + `
    const out = { labels, knockHeard: heard.includes('p6_knock'), gone: !g.teacher.root.visible, state: g.state };
    step(30);
    out.promptAway = document.getElementById('prompt').innerText;
    g.input.pressed.tap = true; step(2);                         // pressing E without looking at the closet does nothing
    aimAt(g.closetPos); step(3);
    out.prompt = document.getElementById('prompt').innerText;
    window.__keep = { said, subs, heard, realRender };
    return out;`);
  pass(!r.error && r.labels[0] === 'Are you really a teacher?' && r.knockHeard && r.gone && r.state === 'playing', 'true ending: when he is gone, something knocks at the back of the room ' + JSON.stringify(r.error || ''));
  pass(!r.error && r.promptAway === '' && /\[E\] · knock on the closet\s+0 \/ 3/.test(r.prompt), 'looking at the supply closet: "[E] · knock on the closet 0 / 3" (pressing E elsewhere did nothing): ' + r.prompt);
  await page.evaluate(() => { const g = game; g.applyCamera(0.016); window.__keep.realRender(g.scene, g.camera); });
  await page.screenshot({ path: shot('secret_closet.png') });
  // three real key presses
  for (let i = 0; i < 3; i++) { await page.keyboard.press('e'); await page.evaluate(() => { for (let k = 0; k < 4; k++) { game.playTick(0.05); game.ui.update(0.05); } }); }
  r = await page.evaluate(() => {
    const g = game, K = window.__keep;
    const knocks = K.heard.filter((x) => x === 'p6_knock').length;
    let n = 0, opened = false, sil = false, kevin = false;
    while (g.state === 'playing' && n++ < 400) { g.playTick(0.05); g.ui.update(0.05); opened = opened || g.closet.open > 0.5; sil = sil || g.closet.sil.visible; kevin = kevin || (!g.kevin.gone && !g.kevin.hollow); if (opened && sil && !window.__shot) { window.__shot = true; g.applyCamera(0.016); K.realRender(g.scene, g.camera); break; } }
    return { knocks, opened, sil, state: g.state };
  });
  pass(r.knocks >= 6 && r.opened && r.sil, 'three knocks (E): something knocks back, the door with no handle opens, somebody stands in the light ' + JSON.stringify(r));
  await page.screenshot({ path: shot('secret_hale.png') });
  r = await page.evaluate(() => {
    const g = game, K = window.__keep;
    let n = 0, kevin = false;
    while (g.state === 'playing' && n++ < 3000) { g.playTick(0.05); g.ui.update(0.05); kevin = kevin || (!g.kevin.gone && !g.kevin.hollow); }
    const p = JSON.parse(localStorage.getItem('madiclass.replay') || '{}');
    return { state: g.state, title: document.getElementById('end-title').innerText, text: document.getElementById('end-text').innerText, again: document.getElementById('btn-again').innerText,
      hale: K.subs.filter((s) => /^(MR\. HALE|\?\?\?)/.test(s)), others: K.subs.filter((s) => /^(Sam|Nora|Kevin)/.test(s)).slice(-4), kevin, bell: K.heard.includes('bell'),
      progress: localStorage.getItem('madiclass.progress'), kind: g.lastCard && g.lastCard.kind, win: g.lastCard && g.lastCard.win, ends: p.endings, card: !!document.getElementById('rc') };
  });
  pass(r.state === 'end' && r.title === 'MR. HALE' && /knocked three times/.test(r.text) && /THE REAL END/.test(r.text) && r.again === 'PLAY FREE CLASS', 'its own end screen: MR. HALE ... THE REAL END. ' + JSON.stringify(r.title));
  pass(r.hale.length === 6 && /^\?\?\?: Hello/.test(r.hale[0]) && r.hale.some((s) => /Sorry I'm late/.test(s)) && r.hale.some((s) => /seen my glasses/.test(s)) && r.hale.some((s) => /Class dismissed/.test(s)),
    'its own scene and lines: a voice behind the door ("???"), then Mr. Hale: "Sorry I\'m late, class." ... "Has anyone seen my glasses?" ... "Class dismissed." ' + r.hale.length);
  pass(r.kevin && r.others.some((s) => /^Kevin: Um\. Here/.test(s)) && r.others.some((s) => /^Sam: Kevin/.test(s)) && r.bell, 'Kevin is back at his desk and answers the roll call: "Um. Here."');
  pass(r.progress === '4' && r.kind === 'hale' && r.win && r.ends.hale === 1 && r.card, 'the story counts as finished; a report card; the ending is kept in the browser');
  await page.close();

  // ...and without knocking, the true ending is what it always was
  page = await open('mode=story&ch=3');
  r = await ev(page, finale + `
    const t0 = g.t;
    aimAt(g.closetPos); step(3);
    g.input.pressed.tap = true; step(3); g.input.pressed.tap = true; step(3);   // two knocks are not enough
    const two = document.getElementById('prompt').innerText;
    g.yaw = 0; g.pitch = 0;
    until(() => g.state === 'end', 60);
    return { two, state: g.state, title: document.getElementById('end-title').innerText, text: document.getElementById('end-text').innerText, took: +(g.t - t0).toFixed(1), closet: g.closet.openTarget,
      sam: subs.some((s) => /^Sam: Did you hear that/.test(s)), prompt: document.getElementById('prompt').innerText, kind: g.lastCard.kind };`);
  pass(!r.error && / 2 \/ 3/.test(r.two) && r.state === 'end' && /CLASS DISMISSED/.test(r.title) && /THE END/.test(r.text) && !/REAL END/.test(r.text) && r.kind === 'true' && r.closet === 0 && r.prompt === '',
    'two knocks and looking away: the true ending as before (CLASS DISMISSED, THE END.) ' + JSON.stringify(r.error || [r.two, r.title, r.took]));
  pass(!r.error && r.sam && r.took < 22, 'Sam heard it too ("Did you hear that? At the back."); the ending does not drag on (' + r.took + ' s after the knock)');
  await page.close();

  // on a touch screen you knock with TALK
  page = await open('mode=story&ch=3', { ...devices['iPhone 13 landscape'] });
  r = await ev(page, finale + `aimAt(g.closetPos); step(3); window.__keep = { subs }; return { prompt: document.getElementById('prompt').innerText, touch: g.input.touch };`);
  pass(!r.error && r.touch && /tap TALK · knock on the closet/.test(r.prompt), 'touch: the prompt says "tap TALK · knock on the closet"');
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => { const el = document.getElementById('btn-talk'); for (const type of ['touchstart', 'touchend']) el.dispatchEvent(new TouchEvent(type, { cancelable: true, bubbles: true, touches: [], changedTouches: [] })); });
    await page.evaluate(() => { for (let k = 0; k < 4; k++) { game.playTick(0.05); game.ui.update(0.05); } });
  }
  r = await page.evaluate(() => { const g = game; let n = 0; while (g.state === 'playing' && n++ < 3000) { g.playTick(0.05); g.ui.update(0.05); } return { title: document.getElementById('end-title').innerText }; });
  pass(r.title === 'MR. HALE', 'touch: three taps on TALK reach the same ending');
  await page.screenshot({ path: shot('secret_hale_end_touch.png') });
  await page.close();

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
