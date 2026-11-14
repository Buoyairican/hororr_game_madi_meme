// node story.js <mode> <chapter> <policy> <finaleChoice> <seconds> [--hard]
// e.g. node story.js story 0 careful 0 1000   (period 1, a careful player)
// policies: none (do nothing), play (normal mischief), talkspam (keep whispering), echo (echo constantly), ask (ask constantly)
const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('./lib');
(async () => {
  const [mode, ch, policy, fin, secs] = process.argv.slice(2);
  const HARD = process.argv.includes('--hard');
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 800, height: 450 } });
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 3).join(' ')));
  await page.goto(`${ROOT}/index.html?debug=1&autostart=1&mode=${mode}&ch=${ch}${HARD ? '&diff=hard' : ''}`);
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  const res = await page.evaluate(async ([policy, fin, secs, HARD]) => {
    const g = window.game; const ev = [];
    const PR = await import('/src/pranks.js');
    // a throw at his back from your seat (the aim arc's own flight code)
    const backThrow = () => {
      const T = g.teacher, targets = g.prankTargets(), out = { pts: Array.from({ length: 70 }, () => g.camPos.clone()), n: 0, hit: null, at: g.camPos.clone() };
      const sp = g.camPos.clone(), sv = g.camPos.clone(), d = T.headWorld().sub(g.camPos), y0 = Math.atan2(-d.x, -d.z);
      for (let pitch = -0.2; pitch <= 0.8; pitch += 0.02) { PR.throwStart(g.camPos, y0, pitch, 1, 'ball', sp, sv); g.simThrow(sp, sv, 'ball', 0, g.me, targets, out); if (out.hit && out.hit.type === 'teacher' && out.hit.part === 'back') return { yaw: y0, pitch: pitch + 0.02, power: 1, kind: 'ball', curve: 0 }; }
      return null;
    };
    let lastSub = '', maxStrikes = 0, maxAnger = 0;
    for (let i = 0; i < Math.round(secs / 0.05) && g.state === 'playing'; i++) {
      if (g.choice) g.input.choiceKey = g.choice.labels[0].startsWith('Are you') ? fin : (g.choice.labels[0].startsWith('Four') ? 1 : 0);
      if (policy === 'play') {
        if (g.canEcho() && Math.random() < 0.03 && g.echoStreak < 2) g.input.pressed.echo = true;
        if (g.canAsk() && g.qCount < 2 && Math.random() < 0.01) g.input.pressed.ask = true;
        g.input.keys.phone = (i % 400) < 60;
      }
      if (policy === 'talkspam') { g.yaw = 1.52; g.input.keys.talk = (i % 200) < 190; }
      if (policy === 'careful') {
        // a sensible player: whisper / play only while he can't see you, answer friends, check the phone
        const safe = !g.watching && !g.near && !g.cutscene;
        const call = g.friends.find((f) => f.call && !f.gone);
        if (call) g.yaw = call.kind === 'sam' ? 1.52 : -1.52; else if (i % 300 < 150) g.yaw = 1.52; else g.yaw = 0;
        g.input.keys.talk = safe && (call || (i % 300 < 150)) && g.yaw !== 0;
        g.input.keys.phone = HARD ? safe && (!!g.buzz || i % 300 > 230) : !!g.buzz || (safe && i % 300 > 230);
        // videos: watch what you are sent / shown, only while he can't see you
        const show = g.shows.find((s) => !s.over && s.to === g.me && s.held);
        if (show) { if (safe) { const d = show.held.group.getWorldPosition(g.camPos.clone()).sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); } else { g.yaw = 0; g.pitch = 0; } g.input.keys.talk = false; }
        else g.pitch = 0;
        if (g.vidJob && !g.vidJob.done) { g.input.keys.phone = safe; g.input.keys.talk = false; }
        if (g.canEcho() && g.echoStreak < (HARD ? 1 : 2) && Math.random() < 0.03) g.input.pressed.echo = true;
        if (g.canAsk() && g.qCount < 2 && Math.random() < 0.008) g.input.pressed.ask = true;
        // Sam's dare (period 2): a paper ball at his back, only while it is turned
        const T = g.teacher;
        const away = Math.sin(T.root.rotation.y) * (g.camPos.x - T.pos.x) + Math.cos(T.root.rotation.y) * (g.camPos.z - T.pos.z) < 0;
        if (g.objectives.some((o) => o.id === 'prank' && !o.done) && safe && away && g.prankOpen() && !g.prankBusy && i % 40 === 0 && g.me.foldT <= 0) {
          const t = backThrow();
          if (t) { g.yaw = t.yaw; g.pitch = t.pitch; g.throwFrom(g.me, t); ev.push(g.t.toFixed(0) + ' [THROW] at his back'); }
        }
      }
      if (policy === 'echo' && g.canEcho()) g.input.pressed.echo = true;
      if (policy === 'ask' && g.canAsk()) g.input.pressed.ask = true;
      if (g.ui.noteOpen && (i % 60 === 0)) g.ui.closeNote();
      g.playTick(0.05); g.ui.update(0.05);
      const sub = document.getElementById('subtitle').innerText.replace(/\n/g, ' ');
      if (sub !== lastSub && sub) { lastSub = sub; ev.push(g.t.toFixed(0) + ": " + sub.slice(0, 70)); }
      const ob = g.objectives.map((o) => o.id + (o.done ? "+" : "-")).join(" "); if (ob !== g.__ob) { g.__ob = ob; ev.push(g.t.toFixed(0) + " [OBJ] " + ob); }
      if (g.shows.length !== (g.__sh || 0)) { g.__sh = g.shows.length; ev.push(g.t.toFixed(0) + ' [SHOWS] ' + g.shows.length); }
      if (!!g.vidJob !== !!g.__vj) { g.__vj = !!g.vidJob; ev.push(g.t.toFixed(0) + ' [VIDJOB] ' + !!g.vidJob); }
      if (g.memeBusy && !g.__mb) ev.push(g.t.toFixed(0) + " [MEME] " + (g.lastMemeKid && g.lastMemeKid.name)); g.__mb = g.memeBusy;
      maxStrikes = Math.max(maxStrikes, g.strikes); maxAnger = Math.max(maxAnger, g.anger);
      if (!isFinite(g.teacher.pos.x) || !isFinite(g.teacher.pos.z)) { ev.push('NaN teacher position!'); break; }
    }
    g.input.keys.talk = g.input.keys.phone = false;
    const T = g.teacher;
    return { state: g.state, end: document.getElementById('end-title').innerText, endText: document.getElementById('end-text').innerText.slice(0, 80),
      primary: document.getElementById('btn-again').innerText, t: +g.t.toFixed(0), clock: document.getElementById('clock-hud').innerText,
      strikes: g.strikes, maxStrikes, maxAnger: +maxAnger.toFixed(0), mischief: Math.floor(g.mischief), objs: g.objectives.map((o) => o.id + (o.done ? '✓' : '✗')).join(' '),
      teacherY: +T.root.position.y.toFixed(2), glassesOnHead: T.glasses.parent === T.head, cut: g.cutscene, memes: g.stats.memes, videos: g.stats.videos, fails: g.stats.fails,
      throws: g.stats.throws, hitHim: g.stats.hitHim, papers: g.papers.length, events: ev };
  }, [policy, +fin, +secs, HARD]);
  console.log(JSON.stringify(res, null, 0));
  // a careful player should get through the period (on Hard one strike ends it, which is allowed)
  const finished = res.state === 'end' && !/DETENTION/.test(res.end);
  if (finished || (HARD && res.state === 'end')) console.log('PASS (1):\n  ' + mode + ' ' + ch + ': ' + res.end + ' at ' + res.t + 's, strikes ' + res.strikes + '\nFAIL (0):');
  else console.log('PASS (0):\nFAIL (1):\n  ' + mode + ' ' + ch + ': ' + res.state + ' ' + res.end);
  console.log(logs.slice(0, 10).join('\n') || 'no console errors');
  await browser.close();
})();
