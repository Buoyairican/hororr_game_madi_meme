// Feature checks: the teacher's neck, the phone (PAPER PLANE + memes), phones held out to you,
// getting caught watching, the echo search, the story video missions, your own video files,
// and the per-player stats tracker.
//   node features.js
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { chromium, ROOT, GL, OUT } = require('./lib');

(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => (c ? ok : bad).push(n);
  const run = async (url, fn, arg, setup) => {
    const page = await browser.newPage({ viewport: { width: 400, height: 225 } });
    page.on('pageerror', (e) => logs.push('PAGEERROR ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    if (setup) await setup(page);
    // (a plain teacher: no events or quirks today, so nothing random gets in the way of these checks)
    await page.goto(ROOT + '/index.html?debug=1&autostart=1&events=none&quirks=none&' + url);
    await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
    await page.evaluate(() => { game.post.render = () => {}; });
    let r;
    try { r = await page.evaluate(fn, arg); } catch (e) { r = { error: e.message }; }
    await page.close();
    return r;
  };
  // helpers available inside every check: g, step, until, blind (he sees nobody), aimAt
  const H = `
    const g = game, V = g.camPos.constructor;
    const step = (n, each) => { for (let i = 0; i < n && g.state === 'playing'; i++) { if (each) each(); g.playTick(0.05); } };
    const until = (fn, max, each) => { let n = 0; while (!fn() && n < max / 0.05 && g.state === 'playing') { if (each) each(); g.playTick(0.05); n++; } return fn(); };
    const uw = g.updateWatching.bind(g);
    g.updateWatching = function () { uw(); if (g.blindTest) for (const p of g.players) { p.watching = false; p.lookDot = -1; } };
    const blind = (on) => { g.blindTest = on; };
    const aimAt = (pt) => { const d = pt.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
  `;

  // 1. his neck: with his back to you he turns his body to look, his head never points backwards
  let r = await run('mode=free', new Function(H + `
    step(300);
    const T = g.teacher;
    g.interrupt((function* () { while (true) yield; })());
    T.place(0, -5.5, Math.PI);
    T.lookAt(g.camPos, 6);
    step(60);
    const yaw = T.headYaw, fwd = T.forward(), to = g.camPos.clone().sub(T.headWorld()).normalize();
    return { headYaw: +yaw.toFixed(2), facesYou: +fwd.dot(to).toFixed(2), body: +T.root.rotation.y.toFixed(2) };`));
  pass(!r.error && Math.abs(r.headYaw) <= 1.21 && r.facesYou > 0.5, 'neck: he turns his body to look behind him, head within its limit: ' + JSON.stringify(r));

  // 2. the phone: PAPER PLANE crash is loud, the meme feed, a classmate showing you a video, an ignored one
  r = await run('mode=free', new Function(H + `
    step(400); blind(true);
    const ph = g.phone, out = {};
    g.input.keys.phone = true; step(10);
    g.input.pressed.tap = true; step(1);
    out.flying = ph.game.state === 'play';
    const a0 = g.anger;
    until(() => ph.game.state === 'dead', 15);
    out.crashed = ph.game.state === 'dead';
    out.angerUp = +(g.anger - a0).toFixed(0);
    out.failsTracked = g.track.of(g.me).fails;
    g.input.pressed.ask = true; step(1);
    out.memes = ph.mode === 'memes';
    until(() => ph.feed.done, 20);
    step(30);
    out.videoTask = g.objDone('video');
    out.nextClip = !ph.feed.done && ph.feed.t < 2;
    g.input.keys.phone = false; step(10);
    const sh = g.startShow({ npc: g.friend('nora'), to: g.me, key: 9 });
    step(3);
    until(() => sh.over, 30, () => { if (sh.held) aimAt(sh.held.group.getWorldPosition(new V())); });
    out.show = sh.result;
    out.zoomed = g.camera.fov < 40 || sh.result === 'done';
    g.yaw = 0; g.pitch = 0; step(20);
    out.unzoomed = g.camera.fov > 50;
    const sh2 = g.startShow({ npc: g.friend('nora'), to: g.me, key: 3 });
    until(() => sh2.over, 60);
    out.ignored = sh2.result;
    out.nags = sh2.nag;
    out.videosTracked = g.track.of(g.me).videos;
    return out;`));
  pass(!r.error && r.flying && r.crashed && r.angerUp >= 10 && r.failsTracked === 1, 'PAPER PLANE: you fly, the crash is loud and he gets angry: ' + JSON.stringify(r));
  pass(!r.error && r.memes && r.videoTask && r.nextClip, 'meme app: a whole video ticks the task, then the next clip plays');
  pass(!r.error && r.show === 'done' && r.unzoomed, 'Nora holds her phone out, you watch it to the end (zoom in and out)');
  pass(!r.error && r.ignored === 'gone' && r.nags >= 3 && r.videosTracked >= 2, 'ignore her and she nags, then gives up; videos are tracked per player');

  // 3. he sees you watching a video: he takes the phone, his face is on it, a strike
  r = await run('mode=free', new Function(H + `
    step(400);
    const ph = g.phone, T = g.teacher;
    g.input.keys.phone = true; step(4);
    g.input.pressed.ask = true; step(1);
    g.interrupt((function* () { while (true) { T.lookAt(g.camPos, 20); T.facePoint(g.camPos, 20); yield; } })());
    let face = false;
    until(() => g.strikes > 0 && !g.cutscene, 40, () => { if (ph.mode === 'face' && ph.forceT > 0) face = true; });
    g.input.keys.phone = false;
    const s = g.track.of(g.me);
    return { strikes: g.strikes, face, caughtFor: s.caughtFor, logged: g.track.log.some((e) => e.type === 'caught' && e.reason === 'video') };`));
  pass(!r.error && r.strikes === 1 && r.face && r.caughtFor.video === 1 && r.logged, 'caught watching a video: phone scare + strike, tracked as "video": ' + JSON.stringify(r));

  // 4. echo: he doesn't know who said it, walks down the rows, then goes back
  r = await run('mode=free', new Function(H + `
    step(400);
    // nothing else may interrupt him here: no friends calling, clowns, scares or phone buzzes
    g.callsOn = false; g.memesOn = false; g.scaresOn = false; g.buzzOn = false;
    until(() => g.canEcho(g.me), 120);
    const T = g.teacher, home = T.pos.clone();
    const interrupts = [], orig = g.interrupt.bind(g);
    g.interrupt = (gen) => { interrupts.push((new Error().stack.split('\\n')[2] || '').trim().slice(0, 80)); orig(gen); };
    g.doEcho(g.me);
    let searched = false, deepest = -99;
    until(() => searched && !g.echoBusy, 90, () => { g.anger = 0; if (g.searching) searched = true; deepest = Math.max(deepest, T.pos.z); });
    step(20);
    return { searched, deepest: +deepest.toFixed(2), backDist: +T.pos.distanceTo(home).toFixed(2), strikes: g.strikes, echoes: g.track.of(g.me).echoes, interrupts };`));
  pass(!r.error && r.searched && r.deepest > -2.5 && r.backDist < 1.5 && r.strikes === 0 && r.echoes === 1 && r.interrupts.length === 1, 'echo: he searches the rows and goes back to his spot: ' + JSON.stringify(r));

  // 5. story video missions
  const mission = (which) => new Function(H + `
    step(200);
    const which = ${JSON.stringify(which)}, caught = which.endsWith('Caught');
    blind(!caught);
    g.cutscene = false; g.eventLock = false;
    const T = g.teacher, ph = g.phone;
    let result = null;
    const gen = which.startsWith('sent') ? g.videoSent(g.friend('sam')) : which.startsWith('show') ? g.videoShow(g.friend('nora')) : g.videoSent(null, 'found', 'Unknown');
    g.script = (function* () { result = yield* gen; })();
    if (caught) g.interrupt((function* () { while (true) { T.lookAt(g.camPos, 20); T.facePoint(g.camPos, 20); yield; } })());
    else g.interrupt((function* () { while (true) yield; })());
    let face = false;
    until(() => result !== null, 150, () => {
      if (g.vidJob) g.input.keys.phone = true;
      const sh = g.shows.find((s) => !s.over && s.held);
      if (sh) aimAt(sh.held.group.getWorldPosition(new V()));
      if (ph.mode === 'face' && ph.forceT > 0) face = true;
    });
    g.input.keys.phone = false;
    return { result, strikes: g.strikes, face };`);
  r = await run('mode=story&ch=1', mission('sent'));
  pass(!r.error && r.result === 'done' && r.strikes === 0, 'Sam sends you a video, you watch all of it: ' + JSON.stringify(r));
  r = await run('mode=story&ch=1', mission('show'));
  pass(!r.error && r.result === 'done' && r.strikes === 0, 'Nora shows you her phone, you watch all of it: ' + JSON.stringify(r));
  r = await run('mode=story&ch=3', mission('found'));
  pass(!r.error && r.result === 'done' && r.face, 'the security-camera video ends with his face on your phone: ' + JSON.stringify(r));
  r = await run('mode=story&ch=1', mission('showCaught'));
  pass(!r.error && r.result === 'caught' && r.strikes === 1 && r.face, 'caught watching Nora\'s phone: strike + scare: ' + JSON.stringify(r));

  // 6. your own video files (assets/videos/list.json), served here without touching the repo
  const clip = path.join(OUT, 'test-clip.webm');
  let haveClip = fs.existsSync(clip);
  if (!haveClip) {
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=duration=3:size=240x426:rate=24', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
        '-shortest', '-c:v', 'libvpx', '-b:v', '300k', '-c:a', 'libvorbis', clip]);
      haveClip = true;
    } catch (e) { console.log('(no ffmpeg: skipping the own-video check)'); }
  }
  if (haveClip) {
    r = await run('mode=free', new Function(H + `
      return (async () => {
        const m = await import('/src/memes.js');
        const ph = g.phone;
        step(300); blind(true);
        g.input.keys.phone = true; step(2);
        g.input.pressed.ask = true; step(1);
        ph.nextClip('u:test-clip.webm', 1);
        let n = 0;
        while (ph.feed.key === 'u:test-clip.webm' && n++ < 200) { g.playTick(0.05); await new Promise((res) => setTimeout(res, 50)); }
        g.input.keys.phone = false;
        return { listed: m.USER_VIDEOS.map((v) => v.id), played: !!ph.feed.video && ph.feed.video.currentTime > 2.5, movedOn: ph.feed.key !== 'u:test-clip.webm' };
      })();`), undefined, async (page) => {
      await page.route('**/assets/videos/list.json', (rt) => rt.fulfill({ contentType: 'application/json', body: JSON.stringify([{ file: 'test-clip.webm', title: 'a test', from: '@tester' }]) }));
      await page.route('**/assets/videos/test-clip.webm', (rt) => rt.fulfill({ contentType: 'video/webm', body: fs.readFileSync(clip) }));
    });
    pass(!r.error && r.listed.includes('u:test-clip.webm') && r.played && r.movedOn, 'your own video file plays in the meme app to the end: ' + JSON.stringify(r));
  }

  // 7. the stats tracker is a plain copy you can save or send
  r = await run('mode=free', new Function(H + `
    step(200);
    g.note(g.me, 'echoes'); g.note(g.me, 'talk', 1.5); g.track.event(g.t, g.me, 'test');
    const s = g.track.summary();
    const copy = JSON.parse(JSON.stringify(s));
    const me = copy.players.find((p) => p.id === g.me.id);
    const legacy = g.stats.echoes;
    g.start('free', 0);
    return { me, events: copy.log.length, legacy, afterReset: g.track.summary().players.length };`));
  pass(!r.error && r.me && r.me.echoes === 1 && r.me.talk === 1.5 && r.legacy === 1 && r.events >= 1 && r.afterReset === 0, 'stats tracker: per-player counts, event log, cleared for a new class: ' + JSON.stringify(r));

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
