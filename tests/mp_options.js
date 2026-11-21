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
    const a = classSetup(12345, 'free'), b = classSetup(12345, 'free', 0, { len: 300 });
    const sorted = (p) => p.every((x, i) => !i || x.at >= p[i - 1].at);
    const check = (seed, len) => {
      const s = classSetup(seed, 'free', 0, { len }), p = s.plan, acts = s.acts || [];
      const ids = p.map((x) => x.id), gaps = p.slice(1).map((x, i) => x.at - p[i].at);
      const lastAt = {}; let far = true;
      for (const x of p) { if (x.at - (lastAt[x.id] ?? -1e9) < 300) far = false; lastAt[x.id] = x.at; }
      const oneChange = acts.slice(1).every((x, i) => x.quirks.filter((q) => !acts[i].quirks.includes(q)).length === 1);
      return {
        n: p.length, last: p.length ? p[p.length - 1].at : 0, sorted: sorted(p), far, noTwice: ids.every((x, i) => !i || x !== ids[i - 1]),
        firstFive: new Set(ids.slice(0, 5)).size === Math.min(5, ids.length), spread: gaps.length ? Math.max(...gaps) - Math.min(...gaps) : 0,
        acts: acts.length, starts: acts.map((x) => x.at).join('/'), moods: acts.map((x) => x.mood[0]).join(''), finale: acts.length ? acts[acts.length - 1].mood : '', oneChange,
        habits: new Set(acts.flatMap((x) => x.quirks)).size,
      };
    };
    return { same: JSON.stringify(a.plan) === JSON.stringify(b.plan) && !b.acts, c30: check(12345, 1800), d30: check(999, 1800), c10: check(777, 600), c15: check(4242, 900) };
  });
  pass(r.same, 'a 5-minute class (and the daily class): the same events at the same times as before');
  {
    const c = r.c30, d = r.d30;
    pass(c.n >= 10 && c.last > 1500 && c.last < 1800 && c.sorted, `30 min: ${c.n} events over the whole class (the last at ${c.last}s)`);
    pass(c.far && d.far && c.noTwice && d.noTwice && c.firstFive && d.firstFive, 'all 5 events once before any comes back; never the same one twice in a row or within 5 minutes');
    pass(c.spread > 60 && d.spread > 60, `uneven gaps between events, not a 5-minute loop (spread ${c.spread}s / ${d.spread}s)`);
    pass(c.acts >= 4 && c.finale === 'busy' && c.oneChange && c.habits >= 4, `stretches of their own pace (${c.moods} at ${c.starts}), the last one busy; he changes one habit each time (${c.habits} habits in all)`);
    pass(c.starts !== d.starts || c.moods !== d.moods, `another class, another shape (${d.moods} at ${d.starts})`);
    pass(r.c10.n >= 4 && r.c10.last > 240 && r.c10.acts >= 2 && r.c15.n >= 6 && r.c15.acts >= 2, `10 min: ${r.c10.n} events, ${r.c10.acts} stretches; 15 min: ${r.c15.n} events, ${r.c15.acts} stretches`);
  }

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
  await H.evaluate(() => {
    // the habit chips: did they change at the moment he changed a habit?
    window.chips = []; const sq = game.ui.setQuirks.bind(game.ui), sw = game.quirkSwap.bind(game);
    let swapAt = -99; game.quirkSwap = (l) => { swapAt = game.t; return sw(l); };
    game.ui.setQuirks = (l) => { chips.push({ t: game.t, swap: game.t - swapAt < 0.5 }); return sq(l); };
  });
  await H.evaluate(() => { window.toasts = []; const t = game.ui.toast.bind(game.ui); game.ui.toast = (x, d) => { toasts.push([Math.round(game.t), x]); return t(x, d); }; });
  const g2 = await G.evaluate(() => ({ len: game.freeLen, setupLen: game.setup.len }));
  pass(r.len === 600 && r.dur === 600 && r.last > 240, `the host's class lasts 10 minutes (clock ${r.dur}s, ${r.plan} events, the last at ${r.last}s)`);
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
    return { t: Math.round(g.t), min: Math.round(g.clockMin), ending: !!g.ending || g.state !== 'playing', events: [...new Set(g.eventsDone)].length, all: g.eventsDone.length,
      acts: g.actIdx, nActs: g.setup.acts.length, quirks: [...g.quirks].join('+'), first: g.setup.acts[0].quirks.join('+'), toasts: toasts.filter((x) => x[0] >= 200 && x[0] <= 420), chips: chips.slice() };
  });
  const gq = await G.evaluate(() => document.getElementById('quirks') ? document.getElementById('quirks').innerText : '');
  pass(r.ending && r.t >= 595 && r.t < 640, `the bell rings at 10 minutes (${r.t}s, ${r.all} events played)`);
  pass(r.acts === r.nActs && r.nActs >= 2 && r.quirks !== r.first, `a new stretch: he changed a habit (${r.first} -> ${r.quirks})`);
  pass(!r.chips.some((c) => c.swap), `nobody is told: no message, the habit chips don't change when he changes (toasts then: ${JSON.stringify(r.toasts)})`);

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
