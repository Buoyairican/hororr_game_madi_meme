// Multiplayer chaos: host + 2 friends, random input everywhere, every mode; one friend drops and rejoins.
const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const logs = [], results = [], okRuns = [], badRuns = [];
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 225 } });
    await ctx.addInitScript(() => { try { localStorage.setItem('madiclass.progress', '4'); } catch (e) {} });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => logs.push(`${tag} PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console ${m.text().slice(0, 200)}`); });
    return p;
  };
  const waitFor = (page, fn, ms = 30000) => page.waitForFunction(fn, null, { timeout: ms }).then(() => true, () => false);
  const open = async (p, url) => {
    await p.goto(url);
    await waitFor(p, () => window.game && (!document.getElementById('menu').classList.contains('hidden') || !document.getElementById('mp').classList.contains('hidden')), 180000);
    await p.evaluate(() => { game.post.render = () => {}; });
  };
  const bot = (p) => p.evaluate(() => {
    clearInterval(window.__bot);
    window.__bot = setInterval(() => {
      const g = game;
      if (!g || g.state !== 'playing') return;
      if (g.ui.noteOpen && Math.random() < 0.3) g.ui.closeNote();
      if (!document.getElementById('choices').classList.contains('hidden') && Math.random() < 0.2) g.input.choiceKey = (Math.random() * 3) | 0;
      if (Math.random() < 0.1) g.yaw = (Math.random() * 2 - 1) * 2.8;
      const r = Math.random();
      if (Math.random() < 0.15) { g.input.keys.talk = r < 0.3; g.input.keys.phone = r > 0.9; }
      if (Math.random() < 0.04) g.input.pressed.echo = true;
      if (Math.random() < 0.015) g.input.pressed.ask = true;
      if (Math.random() < 0.06) g.input.pressed.tap = true; // phone: fly / next video
    }, 200);
  });
  const H = await mk('H');
  await open(H, BASE);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Host'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  const join = async (tag, name) => { const p = await mk(tag); await open(p, BASE + '&join=' + code); await p.fill('#mp-name', name); await p.click('#btn-join'); await waitFor(p, () => !!(game.mp && game.mp.myId), 30000); await bot(p); return p; };
  let A = await join('A', 'Ana'), B = await join('B', 'Ben');
  for (const mode of (process.argv[2] || 'easy,hard,easy').split(',')) {
    await waitFor(H, () => !document.getElementById('mp').classList.contains('hidden') && game.players.length === 3, 30000);
    await H.click(mode === 'hard' ? '#mp-hard' : '#mp-easy'); await H.click('#btn-mp-go');
    await waitFor(A, () => game.state === 'playing', 20000);
    const issues = new Set();
    let dropped = false, steps = 0;
    while (steps++ < 400) {
      const r = await H.evaluate(() => {
        const g = game, ROWS = [-2.05, -0.35, 1.35, 3.05], COLS = [-3, -1.5, 0, 1.5, 3], out = [];
        for (let i = 0; i < 100 && g.state === 'playing'; i++) {
          // host plays randomly too, but not recklessly
          if (Math.random() < 0.01) g.__intent = ['idle', 'idle', 'talk', 'phone', 'echo', 'ask', 'look'][(Math.random() * 7) | 0];
          const safe = !g.watching && !g.near;
          g.input.keys.talk = g.__intent === 'talk' && safe; g.yaw = g.__intent === 'talk' ? 1.52 : g.__intent === 'look' ? Math.sin(g.t) * 2.5 : g.yaw * 0.97;
          g.input.keys.phone = (g.__intent === 'phone' && safe) || !!g.buzz;
          if (g.__intent === 'echo' && g.echoStreak < 2 && Math.random() < 0.05) g.input.pressed.echo = true;
          if (g.__intent === 'ask' && g.qCount < 3 && Math.random() < 0.03) g.input.pressed.ask = true;
          if (g.input.keys.phone && Math.random() < 0.06) g.input.pressed.tap = true;
          if (g.input.keys.phone && Math.random() < 0.01) g.input.pressed.ask = true;
          if (g.input.keys.phone && Math.random() < 0.006) g.input.pressed.echo = true;
          if (g.choice && Math.random() < 0.05) g.input.choiceKey = (Math.random() * g.choice.labels.length) | 0;
          if (g.ui.noteOpen && Math.random() < 0.05) g.ui.closeNote();
          try { g.playTick(0.05); g.ui.update(0.05); } catch (e) { out.push('EXCEPTION ' + e.message + ' ' + (e.stack || '').split('\n')[1]); return { out, state: g.state, t: g.t }; }
          const T = g.teacher, p = T.pos;
          if (!isFinite(p.x) || !isFinite(p.z)) out.push('NaN teacher');
          if (g.present && T.root.visible && !g.ending && T.root.position.y === 0) {
            for (const z of ROWS) for (const x of COLS) if (Math.abs(p.x - x) < 0.42 && Math.abs(p.z - z) < 0.33) out.push(`teacher in desk (${x},${z})`);
            if (!(p.x > 3.5 && Math.abs(p.z + 5) < 0.6) && (p.x < -5.05 || p.x > 5.2 || p.z < -7.05 || p.z > 6.05)) out.push('teacher outside room');
          }
        }
        return { out, state: g.state, t: g.t, players: g.players.length };
      });
      r.out.forEach((x) => issues.add(x));
      if (r.state !== 'playing') break;
      // halfway through free class and period 2, Ben drops out and comes back
      if (!dropped && r.t > 90 && (mode === 'easy')) {
        dropped = true;
        await B.close();
        await waitFor(H, () => game.players.length === 2, 30000);
        B = await join('B', 'Ben');
        await waitFor(B, () => game.state === 'playing', 20000).then((x) => { if (!x) issues.add('rejoin did not reach the class'); });
      }
      await H.waitForTimeout(30);
    }
    await waitFor(H, () => game.state === 'end', 60000);
    const hEnd = await H.evaluate(() => [game.state, document.getElementById('end-title').innerText, Math.round(game.t), game.strikes + '/' + game.maxStrikes]);
    const ends = [];
    for (const p of [A, B]) { await waitFor(p, () => game.state === 'end', 30000); ends.push(await p.evaluate(() => game.state + ':' + document.getElementById('end-title').innerText)); }
    results.push(`${mode}: host ${hEnd.join(' ')} | friends ${ends.join(', ')}${issues.size ? ' | ISSUES ' + [...issues].slice(0, 4).join('; ') : ''}`);
    // everyone must reach the same end screen, with no issues on the way
    const same = hEnd[0] === 'end' && ends.length === 2 && ends.every((e) => e === 'end:' + hEnd[1]);
    (same && !issues.size ? okRuns : badRuns).push(results[results.length - 1]);
    await H.click('#btn-menu'); // back to the lobby
    await waitFor(A, () => !document.getElementById('mp').classList.contains('hidden'), 15000);
  }
  console.log(results.join('\n'));
  console.log('PASS (' + okRuns.length + '):\n  ' + okRuns.join('\n  '));
  console.log('FAIL (' + badRuns.length + '):\n  ' + badRuns.join('\n  '));
  console.log(logs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})();
