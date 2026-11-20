// The new jump scares online (host + friend over a local PeerServer). One victim (IDEAS.md F3, forced here
// with game.scareVictim): the friend's own screen gets it (his own teacher for the moment: hanging upside
// down in front of HIS face, his own pencil under his own desk) while the host watches him bent over the
// friend's chair ("HE WENT FOR BO"); or the host gets it and the friend only gets the toast. The fake bell
// (SCARES.everyone) still hits every screen. The host's lights don't overwrite the friend's scene, nobody
// gets a strike meanwhile, and the friend's teacher goes back to the host's afterwards.
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    page.on('crash', () => logs.push(`${tag} PAGEERROR: the page crashed`));
    page.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    return page;
  };
  const waitFor = (page, expr, ms = 30000, arg) => page.waitForFunction(expr, arg, { timeout: ms }).then(() => true, () => false);
  // the host's game runs slower than the clock on a busy machine: step it by hand
  const hostSteps = (n = 50) => H.evaluate((n) => { for (let i = 0; i < n && game.state === 'playing'; i++) game.playTick(0.05); }, n);
  // (in small pieces, with the network running in between: a host page blocked for long drops its friends)
  const stepUntil = async (fn, max = 400, arg) => {
    for (let done = 0; done < max; done += 40) {
      const r = await H.evaluate(([src, n, arg]) => { const f = new Function('arg', 'return (' + src + ')(arg)'); let i = 0; while (!f(arg) && i++ < n && game.state === 'playing') game.playTick(0.05); return !!f(arg); }, [String(fn), Math.min(40, max - done), arg]);
      if (r) return true;
      await H.waitForTimeout(60);
    }
    return H.evaluate(([src, arg]) => !!new Function('arg', 'return (' + src + ')(arg)')(arg), [String(fn), arg]);
  };
  const join = async (page, code, name) => {
    for (let i = 0; i < 3; i++) {
      try {
        await page.goto(BASE + '&join=' + code);
        await page.waitForFunction(() => window.game && !document.getElementById('mp').classList.contains('hidden'), null, { timeout: 240000 });
        await page.evaluate((n) => { const f = document.getElementById('mp-name'); f.value = n; f.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('btn-join').click(); }, name);
        return;
      } catch (e) { console.log(`  (${name}: could not open the join screen, try ${i + 1}: ${String(e.message).split('\n')[0].slice(0, 160)})`); }
    }
    throw new Error(name + ' could not open the join screen');
  };
  const H = await mk('host'), G = await mk('guest');
  await H.goto(BASE + '&events=none&quirks=none');
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 180000);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  await join(G, code, 'Bo');
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 30000);
  await H.click('#mp-easy'); await H.waitForTimeout(100);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 30000);
  await G.evaluate(() => { window.hints = []; const h0 = game.ui.hint.bind(game.ui); game.ui.hint = (t, d) => { hints.push(t); return h0(t, d); }; });
  // the toasts on both screens ("HE WENT FOR ...")
  // (on the host, uiTo calls toast.local for his own screen only: keep it)
  for (const P of [H, G]) await P.evaluate(() => { window.toasts = []; const u = game.ui, t0 = u.toast, l0 = t0.local;
    u.toast = (t, d) => { toasts.push(String(t)); return t0.call(u, t, d); };
    if (l0) u.toast.local = (t, d) => { toasts.push(String(t)); return l0(t, d); }; });
  // nothing random on the host; he stands at the board and sees nobody (unless a test says who: seeOnly)
  await H.evaluate(() => {
    const g = game, T = g.teacher;
    g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false;
    g.dreadAuto = false; g.nextSit = g.nextDeskGlasses = 1e9; g.chainNext = 1e9;
    g.eventsOn = false; g.scaresOn = false; g.setup.plan = []; g.quirks = new Set(); // (no class events or quirks: an online class has its own setup)
    window.seeOnly = null;
    const uw = g.updateWatching.bind(g);
    g.updateWatching = function () { uw(); for (const p of g.players) { const s = window.seeOnly === p.name; p.watching = s; p.lookDot = s ? 0.97 : -1; } };
    window.atBoard = () => { g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.prankBusy = false; g.anger = 0; };
    window.said = [];
    const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return say0(id, v); };
  });
  for (let i = 0; i < 8; i++) { await hostSteps(40); await H.waitForTimeout(150); } // (past his entrance; small steps, or the host would think the friend went silent)
  await H.evaluate(() => atBoard());
  await hostSteps(20);

  // what the friend hears and sees
  await G.evaluate(() => {
    const g = game; window.gs = []; const op = g.audio.play.bind(g.audio); g.audio.play = (n, o = {}) => { gs.push(n); return op(n, o); };
    window.gw = { rz: 0, head: 9, local: false, fake: '', pencil: null, hint: 0 };
    const V = g.camPos.constructor;
    // (what the host sends while he hangs upside down in front of the host: his red flash and shake, when you only watch)
    const a0 = g.mp.applySnapOnce.bind(g.mp);
    g.mp.applySnapOnce = (s) => { if (!g.localScare && Math.abs(Number(s.T[22]) || 0) > 2.5) { gw.hung = (gw.hung || 0) + 1; gw.hit = Math.max(gw.hit || 0, s.fx[2], s.fx[5]); } return a0(s); };
    setInterval(() => {
      const T = g.teacher;
      if (g.localScare) gw.local = true;
      if (Math.abs(T.root.rotation.z) > 2.5) { gw.rz = T.root.rotation.z; gw.head = Math.min(gw.head, T.headWorld(new V()).distanceTo(g.camPos)); }
      const fe = document.getElementById('fake-end');
      if (!fe.classList.contains('hidden')) gw.fake += '|' + fe.querySelector('.fe-title').textContent;
      // (a curious friend: when his pencil is on the floor, he looks down at it)
      const P = g.scPencil;
      if (P.visible && P.position.y < 0.1) { gw.pencil = [P.position.x, P.position.z, g.me.eye.x, g.me.eye.z]; const d = P.position.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.max(-1.1, Math.atan2(d.y, Math.hypot(d.x, d.z))); }
      if (g.scLocalOn && T.root.visible && T.headWorld(new V()).y < 0.7) gw.under = true;
    }, 16);
  });
  const runScare = async (id, secs, victim = null) => {
    await H.evaluate(([id, victim]) => { const g = game; window.hs = []; const T = g.teacher; window.hrz = 0; window.hnear = 9; window.toasts = [];
      if (!window.__hp) { window.__hp = true; const op = g.audio.play.bind(g.audio); g.audio.play = (n, o = {}) => { (window.hs || []).push(n); return op(n, o); }; }
      g.scareVictim = victim ? g.players.find((p) => p.name === victim) : null;
      g.interrupt(g.scareScene(id)); }, [id, victim]);
    for (let t = 0; t < secs; t += 2) {
      await hostSteps(40);
      await H.evaluate(() => { const g = game, T = g.teacher, v = g.scareVictim; if (Math.abs(T.root.rotation.z) > 2.5) window.hrz = T.root.rotation.z;
        // (how near he came to the friend's chair, on the host's screen)
        if (v && !v.local && T.root.visible) { const s = g.deskSpot(v); window.hnear = Math.min(window.hnear, Math.hypot(T.pos.x - s.stand.x, T.pos.z - s.stand.z)); } });
      await H.waitForTimeout(250);
      if (await H.evaluate(() => !game.scareBusy && game.brainIdle)) break;
    }
    // (the host was stepped faster than real time: the friend's own scene runs at its own pace)
    // (on a busy machine the friend's page runs few frames a second, and the game's clock with it: wait for it)
    const done = await waitFor(G, () => game.mp && !game.mp.gscare && !game.localScare, 150000);
    if (!done) console.log('  (the friend\'s scene was still running after 150 s)');
    await H.waitForTimeout(800);
  };

  // ---- the hanging, the friend is the victim: the host watches
  await G.evaluate(() => { gs.length = 0; gw.rz = 0; gw.head = 9; gw.local = false; toasts.length = 0; });
  await H.evaluate(() => { game.players.find((p) => p.name === 'Bo').scareDone = 999; }); // (left over from the last class: must not end this watch)
  await runScare('hanging', 20, 'Bo');
  await G.waitForTimeout(1200);
  const hostT = await H.evaluate(() => [game.teacher.pos.x, game.teacher.pos.z]);
  let r = await G.evaluate(() => ({ ...gw, snds: gs.join(), localNow: game.localScare, lt: game.mp.localTeacher, rzNow: game.teacher.root.rotation.z, x: game.teacher.pos.x, z: game.teacher.pos.z, toasts: toasts.join('|') }));
  r.off = Math.hypot(r.x - hostT[0], r.z - hostT[1]);
  let h = await H.evaluate(() => ({ hrz: window.hrz, near: window.hnear, snds: hs.join(), strikes: game.strikes, busy: game.scareBusy, toasts: toasts.join('|'), done: game.players.find((p) => p.name === 'Bo').scareDone > 0 }));
  pass(Math.abs(h.hrz) < 0.01 && !/rope_creak/.test(h.snds) && !/scream/.test(h.snds), 'the host does NOT get the hanging on his own screen');
  pass(/HE WENT FOR BO/.test(h.toasts) && !/HE WENT FOR/.test(r.toasts), `the host gets the toast "HE WENT FOR BO", the friend doesn't (${h.toasts} / ${r.toasts})`);
  pass(h.near < 0.3, `on the host's screen he stands bent over the friend's chair (${h.near.toFixed(2)} m from the spot)`);
  pass(r.local && Math.abs(r.rz) > 2.5 && r.head < 1.3, `the friend gets it on HIS screen: upside down in front of his own face (${r.head.toFixed(2)} m)`);
  pass(/rope_creak/.test(r.snds) && /scream/.test(r.snds), 'the friend hears it on his own screen (the creak, the scream)');
  pass(h.done, 'the friend told the host when his scene was over (scareDone)');
  pass(!r.localNow && !r.lt && Math.abs(r.rzNow) < 0.01 && r.off < 0.8, 'afterwards the friend\'s teacher is the host\'s again (right way up, where the host has him) ' + JSON.stringify([r.localNow, r.lt, r.rzNow, +r.off.toFixed(2)]));
  pass(h.strikes === 0 && h.busy === null, 'nobody got a strike');

  // ---- the hanging, the host is the victim: the friend only gets the toast
  await G.evaluate(() => { gs.length = 0; gw.rz = 0; gw.head = 9; gw.local = false; gw.hit = 0; gw.hung = 0; toasts.length = 0; });
  await runScare('hanging', 20, 'Alex');
  await G.waitForTimeout(1200);
  r = await G.evaluate(() => ({ ...gw, snds: gs.join(), toasts: toasts.join('|') }));
  pass(r.hung > 0 && r.hit === 0, `the host's hit stays on the host's screen: no red flash or shake sent to the friend (${r.hit} in ${r.hung} snapshots)`);
  h = await H.evaluate(() => ({ hrz: window.hrz, snds: hs.join(), strikes: game.strikes, busy: game.scareBusy, toasts: toasts.join('|') }));
  pass(Math.abs(h.hrz) > 2.5 && /rope_creak/.test(h.snds) && /scream/.test(h.snds), 'the host is the victim: he gets the hanging on his own screen');
  pass(!r.local && !/rope_creak/.test(r.snds) && /HE WENT FOR ALEX/.test(r.toasts) && !/HE WENT FOR/.test(h.toasts), `the friend does not get it, only the toast "HE WENT FOR ALEX" (${r.toasts})`);
  pass(h.strikes === 0 && h.busy === null, 'nobody got a strike');

  // ---- the fake bell (Free Class: "CLASS DISMISSED")
  await G.evaluate(() => { gs.length = 0; gw.fake = ''; });
  await runScare('fakebell', 16); // (SCARES.everyone: every screen)
  r = await G.evaluate(() => ({ fake: gw.fake, snds: gs.join(), hidden: document.getElementById('fake-end').classList.contains('hidden'), state: game.state }));
  pass(/CLASS DISMISSED/.test(r.fake) && /CLASS IS NOT OVER/.test(r.fake) && /bell_bend/.test(r.snds) && /scream/.test(r.snds), 'the friend sees the fake "CLASS DISMISSED" tear, and hears the bell and the scream');
  pass(r.hidden && r.state === 'playing', 'the fake screen goes away; the class goes on for the friend');

  // ---- the pencil: under the friend's own desk
  await G.evaluate(() => { gs.length = 0; gw.pencil = null; gw.under = false; window.hints = []; });
  await runScare('pencil', 24, 'Bo');
  r = await G.evaluate(() => ({ p: gw.pencil, under: gw.under, snds: gs.join(), hints: hints.join('|') }));
  pass(r.p && Math.hypot(r.p[0] - r.p[2], r.p[1] - r.p[3]) < 0.8, 'the friend\'s pencil falls by HIS own desk ' + JSON.stringify(r.p));
  pass(r.under && /stab/.test(r.snds), 'he looks down: the face comes up out of the floor next to it, on his screen');
  pass((r.hints.match(/Look down/g) || []).length === 1, 'the friend gets the hint once (his own, not the host\'s too)');
  await G.screenshot({ path: shot('mp_scares_guest.png') });

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
