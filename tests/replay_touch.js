// Phase 6 on a phone-sized touch screen: the title menu still fits with DAILY CLASS and NOTEBOOK
// (844x390, 667x375, 568x320 landscape; 390x844 portrait), both open by tap, the notebook's tabs and
// BACK work, the end screen shows the report card with the buttons in reach, an unlocked prank is
// picked with SWAP and thrown with PRANK, and the third phone app is reached with APP.
const { chromium, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const ALL = { v: 1, unlocks: { spit: 'x', band: 'x', bomb: 'x', psst: 'x', chalk: 'x' }, notes: { 1: 1, 2: 1 }, daily: {}, totals: {}, endings: {}, best: {}, theme: 'chalk', seen: {} };
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript((p) => { if (!localStorage.getItem('madiclass.replay')) localStorage.setItem('madiclass.replay', JSON.stringify(p)); }, ALL);
  await page.goto(ROOT + '/index.html?debug=1');
  await page.waitForFunction(() => window.game && !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 180000 });
  await page.evaluate(() => { game.post.render = () => {}; });
  const touch = (sel, type) => page.evaluate(([sel, type]) => {
    const el = document.querySelector(sel); const r = el.getBoundingClientRect();
    const t = new Touch({ identifier: 7, target: el, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 });
    el.dispatchEvent(new TouchEvent(type, { touches: type === 'touchend' ? [] : [t], changedTouches: [t], bubbles: true, cancelable: true }));
  }, [sel, type]);
  /** the title: every menu button on screen, and the two new ones overlap nothing */
  const menu = () => page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; };
    const on = (b) => b.l >= 0 && b.t >= 0 && b.r <= innerWidth && b.b <= innerHeight;
    const hit = (a, b) => a.l < b.r && a.r > b.l && a.t < b.b && a.b > b.t;
    const mine = [...document.querySelectorAll('#p6-menu button')].map(box);
    const others = [...document.querySelectorAll('#menu > button, .diff-row button')].map(box);
    const inner = document.querySelector('.title-inner').getBoundingClientRect();
    return { mineOn: mine.every(on), othersOn: others.every(on), clear: mine.every((m) => others.every((o) => !hit(m, o))) && !hit(mine[0], mine[1]), cut: Math.round(Math.max(0, -inner.top) + Math.max(0, inner.bottom - innerHeight)),
      text: document.getElementById('p6-menu').innerText.replace(/\n/g, ' | ') };
  });
  // the menu column was already taller than a landscape phone before this phase: how much is cut must not grow
  const CUT = { '844x390': 44, '667x375': 40, '568x320': 96 };
  for (const [w, h] of [[844, 390], [667, 375], [568, 320]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(150);
    const m = await menu();
    await page.screenshot({ path: shot(`replay_touch_menu_${w}x${h}.png`) });
    pass(m.mineOn && m.clear, `${w}x${h}: DAILY CLASS and NOTEBOOK on screen, covering no other button (${m.text})`);
    pass(m.cut <= CUT[w + 'x' + h], `${w}x${h}: the menu column is not cut more than before (${m.cut}px)`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  let m = await menu();
  await page.screenshot({ path: shot('replay_touch_menu_390x844.png') });
  pass(m.mineOn && m.othersOn && m.clear && m.cut === 0, 'portrait 390x844: the whole menu fits, with the two new buttons in a row');
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(150);

  // ---- the notebook by tap
  await page.tap('#btn-notebook'); await page.waitForTimeout(250);
  let r = await page.evaluate(() => { const p = document.getElementById('notebook-panel'), b = p.getBoundingClientRect(); return { open: !document.getElementById('notebook').classList.contains('hidden'), found: document.querySelectorAll('.nb-note:not(.missing)').length, fits: b.top >= 0 && b.bottom <= innerHeight, scrolls: p.scrollHeight > p.clientHeight, tabs: [...document.querySelectorAll('#notebook-tabs button')].every((x) => { const q = x.getBoundingClientRect(); return q.top >= 0 && q.bottom <= innerHeight; }) }; });
  pass(r.open && r.found === 2 && r.fits && r.tabs, 'tap NOTEBOOK: it opens, the panel and its tabs are on screen ' + JSON.stringify(r));
  await page.screenshot({ path: shot('replay_touch_notebook.png') });
  await page.tap('#notebook-tabs button[data-tab="unlocks"]'); await page.waitForTimeout(150);
  await page.evaluate(() => document.querySelector('button[data-theme="classic"]').scrollIntoView());
  await page.tap('button[data-theme="classic"]'); await page.waitForTimeout(150);
  pass(await page.evaluate(() => game.phone.theme.name === 'CLASSIC' && JSON.parse(localStorage.getItem('madiclass.replay')).theme === 'classic'), 'tap a theme: used');
  await page.evaluate(() => document.querySelector('#notebook .back').scrollIntoView());
  await page.tap('#notebook .back'); await page.waitForTimeout(200);
  pass(await page.evaluate(() => !document.getElementById('title').classList.contains('hidden')), 'tap BACK: the menu again');

  // ---- the daily class by tap; an unlocked prank with PRANK + SWAP; the third app with PHONE + APP
  await page.tap('#btn-daily');
  await page.waitForFunction(() => game.state === 'playing', null, { timeout: 20000 });
  pass(await page.evaluate(() => !!game.daily && game.mode === 'free'), 'tap DAILY CLASS: the daily class starts');
  await page.evaluate(() => {
    const g = game, T = g.teacher;
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false;
    const uw = g.updateWatching.bind(g); g.updateWatching = function () { uw(); for (const p of g.players) { p.watching = false; p.lookDot = -1; } };
    for (let i = 0; i < 260; i++) g.playTick(0.05);
    g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); for (;;) yield; })());
    g.me.foldT = 0; g.yaw = 0; g.pitch = 0.2; g.cutscene = false; g.lockBully = false;
  });
  await touch('#btn-prank', 'touchstart'); await page.waitForTimeout(600);
  const labels = [];
  for (let i = 0; i < 5; i++) { labels.push(await page.evaluate(() => document.getElementById('btn-ask').textContent)); await touch('#btn-echo', 'touchstart'); await page.waitForTimeout(250); }
  pass(labels.join('/') === 'BALL/PLANE/SPIT/BAND/BOMB', 'hold PRANK, tap SWAP: BALL / PLANE / SPIT / BAND / BOMB on the button (' + labels.join('/') + ')');
  // (after BOMB come the laser and the KICK ME note of Phase 3: tap on round to the rubber band)
  for (let i = 0; i < 8 && (await page.evaluate(() => game.me.aim && game.me.aim.kind)) !== 'band'; i++) { await touch('#btn-echo', 'touchstart'); await page.waitForTimeout(200); }
  r = await page.evaluate(() => ({ kind: game.me.aim && game.me.aim.kind, fits: (() => { const b = document.getElementById('btn-ask'); return b.scrollWidth <= b.clientWidth + 1; })() }));
  await page.screenshot({ path: shot('replay_touch_aim.png') });
  await touch('#btn-prank', 'touchend');
  pass(r.kind === 'band' && r.fits && await page.waitForFunction(() => game.track.log.some((e) => e.type === 'throw' && e.kind === 'band'), null, { timeout: 5000 }).then(() => true, () => false), 'let go of PRANK: the rubber band is thrown');
  await page.waitForTimeout(500);
  await touch('#btn-phone', 'touchstart'); await page.waitForTimeout(600);
  await touch('#btn-ask', 'touchstart'); await page.waitForTimeout(250); await touch('#btn-ask', 'touchstart'); await page.waitForTimeout(300);
  r = await page.evaluate(() => ({ mode: game.phone.mode, btns: ['btn-talk', 'btn-ask', 'btn-echo'].map((id) => document.getElementById(id).textContent).join('/'), hint: document.getElementById('hint').innerText }));
  pass(r.mode === 'psst' && r.btns === 'TAP/APP/SHOW' && /tap TAP to pass the note/.test(r.hint), 'hold PHONE, tap APP twice: PSST! (TAP passes the note; the hint says so) ' + JSON.stringify(r));
  await touch('#btn-talk', 'touchstart'); await touch('#btn-talk', 'touchend'); await page.waitForTimeout(300);
  pass(await page.evaluate(() => game.phone.psst.state === 'play'), 'TAP starts PSST!');
  await page.evaluate(() => { game.applyCamera(0.016); });
  await page.screenshot({ path: shot('replay_touch_psst.png') });
  await touch('#btn-phone', 'touchend'); await page.waitForTimeout(300);

  // ---- pause: NOTEBOOK by tap
  await page.tap('#btn-pause'); await page.waitForTimeout(300);
  r = await page.evaluate(() => { const b = document.getElementById('btn-pause-notebook').getBoundingClientRect(), q = document.getElementById('btn-quit').getBoundingClientRect(); return { on: b.top >= 0 && b.bottom <= innerHeight && q.bottom <= innerHeight }; });
  pass(r.on, 'pause menu: NOTEBOOK (and every other button) on screen');
  await page.tap('#btn-pause-notebook'); await page.waitForTimeout(200);
  pass(await page.evaluate(() => !document.getElementById('notebook').classList.contains('hidden')), 'tap NOTEBOOK in the pause menu');
  await page.evaluate(() => document.querySelector('#notebook .back').scrollIntoView());
  await page.tap('#notebook .back'); await page.waitForTimeout(200);
  await page.tap('#btn-resume'); await page.waitForTimeout(300);

  // ---- the end screen: the card and the buttons
  await page.evaluate(() => {
    const g = game;
    for (let i = 0; i < 5; i++) g.note(g.me, 'whispers');
    g.note(g.me, 'echoes', 3); g.note(g.me, 'questions', 3); g.note(g.me, 'videos', 2);
    g.finish('survived');
  });
  const endLayout = () => page.evaluate(() => {
    const seen = (id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; };
    const p = document.querySelector('#end .panel');
    return { card: seen('rc'), again: seen('btn-again'), menu: seen('btn-menu'), title: seen('end-title'), scroll: p.scrollHeight - p.clientHeight, text: document.getElementById('rc').innerText.length };
  });
  for (const [w, h] of [[844, 390], [667, 375]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { document.querySelector('#end .panel').scrollTop = 0; });
    await page.waitForTimeout(900);
    r = await endLayout();
    await page.screenshot({ path: shot(`replay_touch_end_${w}x${h}.png`) });
    pass(r.title && r.again && r.menu, `${w}x${h}: the end screen's title and both buttons on screen without scrolling ` + JSON.stringify(r));
    pass(r.text > 200 && (r.card || r.scroll > 0), `${w}x${h}: the report card next to them (${r.card ? 'all of it on screen' : 'scrolls ' + r.scroll + 'px'})`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(400);
  r = await endLayout();
  await page.screenshot({ path: shot('replay_touch_end_390x844.png') });
  pass(r.title && r.again && r.menu && (r.card || r.scroll > 0), 'portrait: one column, the buttons first and the card under them ' + JSON.stringify(r));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.evaluate(() => document.getElementById('btn-again').scrollIntoView());
  await page.tap('#btn-again'); await page.waitForTimeout(600);
  pass(await page.evaluate(() => game.state === 'playing' && !!game.daily), 'tap TRY AGAIN (DAILY): the daily class again');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
