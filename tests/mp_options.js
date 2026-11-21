// Two options:
//  - Settings → Keyboard: QWERTY or AZERTY. AZERTY: Z Q S D crawl, A is the phone, Q is no longer the phone;
//    the key names on screen follow (WASD -> ZQSD, Q -> A) in the legend, How to Play and the tips;
//    the answer keys 1-4 work from the number row on AZERTY (it types & é " ' without Shift). Saved.
//  - Online: the host picks how long Free Class lasts (5, 10, 15 or 30 minutes). The friend sees it while
//    waiting; both games run that long (the clock goes slower), and a long class gets a new round of
//    events every 5 minutes. A 5-minute class is the same as before (same seed, same events).
//   node mp_options.js
const { chromium, ROOT, PEER, MP_ARGS } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;

(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const mk = async (tag) => {
    const p = await (await browser.newContext({ viewport: { width: 960, height: 540 } })).newPage();
    p.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    return p;
  };
  const waitFor = (p, fn, ms = 30000, arg) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const open = async (p) => {
    await p.goto(BASE);
    await waitFor(p, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 180000);
    await p.evaluate(() => { game.post.render = () => {}; });
  };

  // ---------------------------------------------------------------- the keyboard
  const A = await mk('A');
  await open(A);
  let r = await A.evaluate(() => ({ sel: document.getElementById('set-keys').value, legend: document.querySelector('#keys-legend').innerText }));
  pass(r.sel === 'qwerty' && /Q phone/.test(r.legend), `QWERTY by default (legend: "${r.legend.slice(0, 40)}")`);
  await A.evaluate(() => { const s = document.getElementById('set-keys'); s.value = 'azerty'; s.dispatchEvent(new Event('change')); });
  r = await A.evaluate(() => {
    const kb = (key, code, up) => window.dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { key, code: code || '' }));
    const I = game.input, o = {};
    I.enabled = true;
    kb('z'); o.fwd = I.moveKeys.f; kb('z', '', 1);
    kb('q'); o.left = I.moveKeys.l; o.qPhone = I.keys.phone; kb('q', '', 1); o.leftOff = !I.moveKeys.l;
    kb('a'); o.aPhone = I.keys.phone; o.aLeft = I.moveKeys.l; kb('a', '', 1); o.aOff = !I.keys.phone;
    kb('w'); o.w = I.moveKeys.f; kb('w', '', 1);
    kb('&', 'Digit1'); o.choice = I.takeChoice();
    I.enabled = false;
    game.ui.putHint('Hold <b>Q</b> to play. Crawl with <b>WASD</b>.', 1);
    o.hint = document.getElementById('hint').innerHTML;
    o.legend = document.querySelector('#keys-legend').innerText;
    o.howto = [...document.querySelectorAll('[data-key]')].map((e) => e.textContent).join(',');
    o.saved = JSON.parse(localStorage.getItem('madiclass.settings') || '{}').keys;
    return o;
  });
  pass(r.fwd && r.left && !r.qPhone && r.leftOff, 'AZERTY: Z forward, Q left (not the phone)');
  pass(r.aPhone && !r.aLeft && r.aOff, 'AZERTY: A holds the phone');
  pass(!r.w, 'AZERTY: W does nothing');
  pass(r.choice === 0, 'AZERTY: the number row (&) answers 1');
  pass(/<b>A<\/b>/.test(r.hint) && /ZQSD/.test(r.hint), `tips name the AZERTY keys (${r.hint})`);
  pass(/A phone/.test(r.legend) && /ZQSD/.test(r.howto) && !/WASD|(^|,)Q(,|$)/.test(r.howto), `legend and How to Play follow (${r.howto})`);
  pass(r.saved === 'azerty', 'the choice is saved');
  await A.reload();
  await waitFor(A, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 180000);
  r = await A.evaluate(() => {
    const kb = (key, up) => window.dispatchEvent(new KeyboardEvent(up ? 'keyup' : 'keydown', { key }));
    const I = game.input, o = { sel: document.getElementById('set-keys').value };
    I.enabled = true; kb('z'); o.fwd = I.moveKeys.f; kb('z', 1);
    const s = document.getElementById('set-keys'); s.value = 'qwerty'; s.dispatchEvent(new Event('change'));
    kb('w'); o.w = I.moveKeys.f; kb('w', 1); kb('q'); o.q = I.keys.phone; kb('q', 1); kb('a'); o.a = I.moveKeys.l; kb('a', 1);
    kb('1'); o.choice = I.takeChoice(); I.enabled = false;
    o.howto = [...document.querySelectorAll('[data-key]')].map((e) => e.textContent).join(',');
    return o;
  });
  pass(r.sel === 'azerty' && r.fwd, 'AZERTY again after a reload');
  pass(r.w && r.q && r.a && r.choice === 0 && /WASD/.test(r.howto), 'back to QWERTY: W, A, Q phone, 1, the labels');

  // ---------------------------------------------------------------- a 5-minute class is the same as before; longer ones get more events
  r = await A.evaluate(async () => {
    const { classSetup } = await import('./src/events.js');
    const a = classSetup(12345, 'free'), b = classSetup(12345, 'free', 0, { len: 300 }), c = classSetup(12345, 'free', 0, { len: 1800 });
    const d = classSetup(777, 'free', 0, { len: 600 });
    const sorted = (p) => p.every((x, i) => !i || x.at >= p[i - 1].at);
    return {
      same: JSON.stringify(a.plan) === JSON.stringify(b.plan), first: JSON.stringify(c.plan.slice(0, a.plan.length)) === JSON.stringify(a.plan),
      n5: a.plan.length, n30: c.plan.length, last30: c.plan[c.plan.length - 1].at, n10: d.plan.length, last10: d.plan[d.plan.length - 1].at,
      sorted: sorted(c.plan) && sorted(d.plan), noRepeatRound: [1, 2, 3, 4, 5].every(() => true),
    };
  });
  pass(r.same && r.first, 'a 5-minute class: the same events at the same times as before');
  pass(r.n30 >= 18 && r.last30 > 1500 && r.last30 < 1800 && r.n10 >= 6 && r.last10 > 300 && r.sorted, `more events in longer classes (10 min: ${r.n10}, last at ${r.last10}s; 30 min: ${r.n30}, last at ${r.last30}s)`);

  // ---------------------------------------------------------------- online: the host picks 10 minutes
  const H = await mk('H'), G = await mk('G');
  await open(H); await open(G);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Host'); await H.click('#btn-host');
  await waitFor(H, () => game.mp && game.mp.code && /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 25000);
  const code = await H.evaluate(() => game.mp.code);
  r = await H.evaluate(() => ({ seen: document.getElementById('mp-len-row').offsetParent !== null, on: document.querySelector('#mp-len-row button.on').dataset.len }));
  pass(r.seen && r.on === '5', 'the host sees 5 / 10 / 15 / 30 MIN (5 picked)');
  await G.click('#btn-mp'); await G.fill('#mp-name', 'Guest'); await G.fill('#mp-code', code); await G.click('#btn-join');
  pass(await waitFor(H, () => game.mp.lobby.length === 2, 30000), 'a friend joins');
  await H.click('#mp-len-row button[data-len="10"]');
  pass(await waitFor(G, () => /10 min/.test(document.getElementById('mp-wait').textContent), 15000), `the friend sees "10 min" (${await G.evaluate(() => document.getElementById('mp-wait').textContent)})`);
  await H.click('#btn-mp-go');
  pass(await waitFor(H, () => game.state === 'playing', 30000) && await waitFor(G, () => game.state === 'playing', 30000), 'the class starts for both');
  r = await H.evaluate(() => ({ len: game.freeLen, dur: game.clock.dur, plan: game.setup.plan.length, last: game.setup.plan[game.setup.plan.length - 1].at }));
  const g2 = await G.evaluate(() => ({ len: game.freeLen, setupLen: game.setup.len }));
  pass(r.len === 600 && r.dur === 600 && r.last > 300, `the host's class lasts 10 minutes (clock ${r.dur}s, ${r.plan} events, the last at ${r.last}s)`);
  pass(g2.len === 600 && g2.setupLen === 600, 'the friend\'s game knows it too');
  // the clock: after 300 s it is only half way (10:30), the class goes on; at 600 s the bell
  r = await H.evaluate(() => {
    const g = game; g.input.enable(false); g.dreadAuto = false;
    for (let i = 0; i < 300 * 10 && g.state === 'playing'; i++) { g.playTick(0.1); g.ui.update(0.1); if (g.choice || g.ui.choosing && g.ui.choosing()) { g.input.choiceKey = 0; } g.anger = 0; g.strikes = 0; }
    return { t: Math.round(g.t), min: Math.round(g.clockMin), state: g.state, ending: !!g.ending };
  });
  pass(r.state === 'playing' && !r.ending && r.min > 100 && r.min < 140, `after 5 minutes the class goes on (clock +${r.min} min, ${r.state})`);
  r = await H.evaluate(() => {
    const g = game;
    for (let i = 0; i < 340 * 10 && !g.ending && g.state === 'playing'; i++) { g.playTick(0.1); g.ui.update(0.1); if (g.ui.choosing && g.ui.choosing()) g.input.choiceKey = 0; g.anger = 0; g.strikes = 0; }
    return { t: Math.round(g.t), min: Math.round(g.clockMin), ending: !!g.ending || g.state !== 'playing', events: [...new Set(g.eventsDone)].length, all: g.eventsDone.length };
  });
  pass(r.ending && r.t >= 595 && r.t < 640, `the bell rings at 10 minutes (${r.t}s, ${r.all} events played)`);

  // ---------------------------------------------------------------- solo Free Class stays 5 minutes
  await A.evaluate(() => { game.onlineLen = 30; game.start('free'); });
  r = await A.evaluate(() => ({ len: game.freeLen, dur: game.clock.dur }));
  pass(r.len === 300 && r.dur === 300, 'solo Free Class is still 5 minutes');

  pass(!logs.length, 'no errors' + (logs.length ? ': ' + logs.slice(0, 3).join(' | ') : ''));
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
