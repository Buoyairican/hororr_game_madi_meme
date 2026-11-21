// The new jump scares (src/scares.js) on one screen: the table and the sounds, the director's list (Free Class
// and the story periods), and every scene played by a player who looks where it wants (the pencil under the
// desk, the wrong seat, the sprint from the door, the hanging, the window, the fake bell, the face flash),
// one played by a player who never looks (it comes anyway), that a scare is never a strike, and that
// everything is put back afterwards.
//   node scares.js
const { chromium, ROOT, GL, shot } = require('./lib');

(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => logs.push(`PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(`console: ${m.text().slice(0, 200)}`); });
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=story&ch=1&events=none&quirks=none');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 180000 });
  let r;
  // everything is back: he is at the front, right way up, lights on, friends in their seats, the door shut, no fake screen
  const clean = (a) => a.busy === null && !a.lock && !a.local && a.master === 1 && a.black === 0 && a.vis && a.rz === 0 && a.y === 0 && a.z < -4 && a.friends && a.door === 0 && a.fake;

  // ---------------------------------------------------------------- the table, the sounds, the voices
  r = await page.evaluate(async () => {
    const D = await import('/src/data.js'), S = await import('/src/scares.js');
    const g = game, ids = S.scareIds();
    const sfx = ['pencil_roll', 'knock_glass', 'glass_bang', 'drip', 'run_steps', 'stab', 'rev_scream', 'door_creak', 'rope_creak', 'flash_tick', 'bell_bend'];
    const voices = ['t_wrongseat', 't_norunning', 't_notover2', 'tw_found', 'tw_letmein', 's_pencil', 's_where', 's_stare', 'n_knock', 'n_door', 'n_stare', 'n_psst', 's_psst'];
    return { ids, len: ids.every((id) => D.SCARES.len[id] > 0), noSfx: sfx.filter((n) => !g.audio.buffers[n]), noVoice: voices.filter((n) => !g.audio.voices[n] || !g.audio.buffers[n]) };
  });
  pass(r.ids.join() === 'pencil,window,flash,wrongseat,sprint,hanging,fakebell,shoulder,underdesk,note,stare' && r.len, 'eleven new scares in the table (F4 added four), each with a length: ' + r.ids.join());
  pass(!r.noSfx.length, 'every new sound is loaded ' + JSON.stringify(r.noSfx));
  pass(!r.noVoice.length, 'every new voice line is loaded, with its subtitle ' + JSON.stringify(r.noVoice));

  // ---------------------------------------------------------------- the director
  r = await page.evaluate(() => {
    const g = game, pool = g.scarePool, mode = g.mode, phase = g.phase;
    const ids = () => g.scareList().map((s) => s.id);
    const open0 = g.scareOpen; g.scareOpen = null; // (the phases first: the story, and a class without a plan)
    g.mode = 'free'; g.scarePool = null; g.phase = 3; g.lastScare = {}; g.scareDone = {};
    const free3 = ids(), strong = g.scareList().filter((s) => s.strong).map((s) => s.id);
    g.phase = 0; const free0 = ids();
    g.mode = 'story'; g.phase = 3; const story = ids();
    g.mp = { scareAll() {} }; g.mode = 'free'; const online = ids(); g.mp = null;
    // a Free Class (any length): the jump scares come at random times, a new plan every class; any of them can come first
    const t0 = g.t, sn = [g.strongN, g.strongT, g.firstScare], plan0 = g.scarePlan, len0 = g.freeLen;
    const plans = [];
    for (const L of [300, 600, 1800]) for (let k = 0; k < 6; k++) {
      g.freeLen = L; g.planScares();
      const opened = Object.entries(g.scareOpen).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
      plans.push({ L, at: g.scarePlan.at.map(Math.round), big: g.scarePlan.big.filter(Boolean).length, first: opened[0], open0: Object.values(g.scareOpen).filter((x) => x === 0).length });
    }
    // what it owes: nothing before its time, 'strong' / 'any' at it, dropped when no moment came for it
    g.freeLen = 300; g.scarePlan = { at: [60, 150], big: [false, true], i: 0 };
    const owe = (t) => { g.t = t; return g.scareOwed(); };
    const owed = [owe(50), owe(61), owe(95), owe(149), owe(151), owe(200), owe(290)];
    g.freeLen = len0; g.scarePlan = plan0; g.scareOpen = open0;
    g.t = t0; [g.strongN, g.strongT, g.firstScare] = sn;
    g.mode = mode; g.scarePool = pool; g.phase = phase;
    const src = ['chapter1', 'chapter2', 'chapter3', 'chapter4'].map((c) => String(g[c]));
    return { owed, plans, free3, free0, strong, story, online, beats: [/scareBeat\('pencil'\)/.test(src[0]), /scareBeat\('wrongseat'\)/.test(src[1]) && /scareBeat\('fakebell'\)/.test(src[1]), /scareBeat\('sprint'\)/.test(src[2]), /scareBeat\('hanging'\)/.test(src[3])] };
  });
  pass(['pencil', 'window', 'flash', 'wrongseat', 'sprint', 'hanging', 'fakebell'].every((id) => r.free3.includes(id)), 'Free Class, last hour: the director can pick every new scare ' + r.free3.join());
  pass(r.free0.includes('pencil') && r.free0.includes('window') && !r.free0.includes('sprint') && !r.free0.includes('hanging'), 'Free Class, first hour: the pencil and the window, not his big ones yet');
  pass(['wrongseat', 'sprint', 'hanging', 'fakebell'].every((id) => r.strong.includes(id)), 'the wrong seat, the sprint, the hanging and the fake bell count as his big scares (one is owed before the bell)');
  pass(!r.story.includes('fakebell'), 'in the story the fake bell is a set piece, never random');
  pass(!r.online.includes('wrongseat') && r.online.includes('hanging'), 'online: no wrong seat (Sam and Nora are your friends there); the others stay');
  pass(JSON.stringify(r.owed) === JSON.stringify([null, 'any', null, null, 'strong', null, null]), 'Free Class owes a jump scare at its time (any, or one of his big ones), drops one no moment came for, nothing near the bell ' + JSON.stringify(r.owed));
  {
    const P = r.plans, by = (L) => P.filter((p) => p.L === L);
    const ok = P.every((p) => p.at.length >= 2 && p.at[0] >= 22 && p.at[p.at.length - 1] <= p.L - 18 && p.at.every((x, i) => !i || x - p.at[i - 1] >= 40) && p.big >= 1 && p.open0 >= 1);
    const n = (L) => by(L).map((p) => p.at.length);
    const firsts = new Set(P.map((p) => p.first)), times = new Set(P.map((p) => p.at[0]));
    pass(ok, `every class: at least 2 jump scares at random times (40 s apart, none in the first 22 s or the last 18 s), one big one at least (5 min: ${n(300)}; 10 min: ${n(600)}; 30 min: ${n(1800)})`);
    pass(Math.min(...n(1800)) > Math.max(...n(300)) && Math.min(...n(600)) >= 3, 'a longer class gets more of them');
    pass(firsts.size >= 5 && times.size >= 10, `a different one can come first, at a different time (first to open: ${[...firsts].join(', ')}; the first at ${[...times].slice(0, 8).join(', ')} s…)`);
  }
  pass(r.beats.every(Boolean), 'the story: the pencil in period 1, the wrong seat and the fake bell in period 2, the sprint in period 3, the hanging in period 4 ' + JSON.stringify(r.beats));

  // ---------------------------------------------------------------- every scene, played by a curious player
  await page.evaluate(() => {
    const g = game, V = g.camPos.constructor;
    g.post.render = () => {};
    g.updateDirector = () => {}; g.updateCalls = g.updateBuzz = g.updateFreeShows = () => {}; g.startMeme = () => false; g.dreadAuto = false;
    for (let i = 0; i < 300; i++) { g.playTick(0.05); g.ui.update(0.05); }
    g.script = null; // (the story waits: only the scenes run)
    window.snds = []; const op = g.audio.play.bind(g.audio); g.audio.play = (n, o = {}) => { snds.push(n); return op(n, o); };
    window.subs = []; const su = g.ui.subtitle.bind(g.ui); g.ui.subtitle = (...a) => { subs.push(String(a[1])); return su(...a); };
    window.hints = []; const hi = g.ui.hint.bind(g.ui); g.ui.hint = (...a) => { hints.push(String(a[0])); return hi(...a); };
    window.lookAt = (p) => { const d = p.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.max(-1.1, Math.min(1.05, Math.atan2(d.y, Math.hypot(d.x, d.z)))); };
    // play a scene: look(): where the player looks each frame (null: straight ahead); probe(): what to remember
    window.play = (id, look, probe, max = 900) => {
      const T = g.teacher, eye = g.me.eye;
      snds.length = 0; subs.length = 0; hints.length = 0; g.yaw = 0; g.pitch = 0;
      const seen = { maxFear: 0, prompt: '', strikes0: g.strikes, hush: false, minDist: 99, maxSpeed: 0, rz: 0, headY: null, x: 9, fake: '', flash: false, hidden: 0, door: 0, pencilFloor: false };
      g.interrupt(g.scareScene(id));
      let i = 0, px = T.pos.x, pz = T.pos.z;
      for (; i < max; i++) {
        const p = look && look(g, eye, V);
        if (p) lookAt(p); else { g.yaw = 0; g.pitch = 0; }
        g.input.keys.talk = true; // (whispering all the way through: a scare is never a strike)
        g.playTick(0.05); g.ui.update(0.05);
        g.input.keys.talk = false;
        const h = T.headWorld(new V());
        if (T.root.visible) seen.minDist = Math.min(seen.minDist, h.distanceTo(g.camPos));
        if (T.moving) seen.maxSpeed = Math.max(seen.maxSpeed, Math.hypot(T.pos.x - px, T.pos.z - pz) / 0.05);
        px = T.pos.x; pz = T.pos.z;
        if (i % 10 === 0) g.render(0.05); // (the giggle hush is set as the frame is drawn)
        seen.maxFear = Math.max(seen.maxFear, g.scareFear);
        seen.hush = seen.hush || g.audio.hush;
        if (g.scLocalOn && document.getElementById('prompt').textContent) seen.prompt = document.getElementById('prompt').textContent;
        seen.hidden = Math.max(seen.hidden, g.friends.filter((f) => !f.root.visible).length);
        seen.door = Math.max(seen.door, g.world.door.openTarget);
        const fe = document.getElementById('fake-end');
        if (!fe.classList.contains('hidden')) seen.fake += '|' + fe.querySelector('.fe-title').textContent;
        seen.flash = seen.flash || document.getElementById('face-flash').classList.contains('on');
        if (probe) probe(seen, g, T, h);
        if (!g.scareBusy && !g.scLocalOn && i > 5 && g.brainIdle) break;
      }
      for (let k = 0; k < 40; k++) { g.playTick(0.05); g.ui.update(0.05); }
      const T2 = g.teacher;
      return { ...seen, frames: i, snds: snds.join(), subs: subs.join('|'), hints: hints.join('|'), strikes: g.strikes, anger: Math.round(g.anger),
        after: { busy: g.scareBusy, lock: g.eventLock, local: g.scLocalOn, master: g.world.master, black: g.blackoutTarget, vis: T2.root.visible, rz: T2.root.rotation.z, y: T2.root.position.y, z: T2.pos.z, friends: g.friends.every((f) => f.root.visible), door: g.world.door.openTarget, fake: document.getElementById('fake-end').classList.contains('hidden') } };
    };
  });

  // 1. the pencil
  r = await page.evaluate(() => play('pencil', (g, eye, V) => (g.scPencil.position.y < 0.1 ? new V(eye.x + 0.5, 0.012, eye.z - 0.34) : null),
    (s, g, T, h) => { if (g.scPencil.visible && g.scPencil.position.y < 0.1) s.pencilFloor = true; if (T.root.visible && h.y < 0.7 && g.scLocalOn) s.headY = h.y; }));
  pass(r.pencilFloor && /pencil_roll/.test(r.snds) && /dropped your pencil/.test(r.subs) && !/Look down/.test(r.hints), 'the pencil rolls off your desk onto the floor; Sam: "You dropped your pencil" (no hint: you hear it)');
  pass(r.headY !== null && r.headY < 0.7 && /stab/.test(r.snds) && r.maxFear > 0.95, `look down: his face comes up out of the floor next to it (head at ${r.headY && r.headY.toFixed(2)} m), the stab`);
  pass(/tw_found/.test(r.snds) && /Found/.test(r.subs), 'in the dark: "Found... you."');
  pass(clean(r.after) && await page.evaluate(() => game.scPencil.visible && game.scPencil.position.y > 0.7), 'the lights: he is at the front, your pencil is back on your desk ' + JSON.stringify(r.after));
  pass(r.strikes === r.strikes0 && r.anger === 0, `whispering in his face all the way through: no strike, no anger (${r.strikes}, ${r.anger})`);
  pass(r.hush && !r.prompt, 'during a scare the class stops giggling and no prompt is in the way ' + JSON.stringify(r.prompt));

  // 2. the wrong seat
  r = await page.evaluate(() => play('wrongseat', (g) => { const f = g.friends.find((x) => x.scHidden); return f ? g.teacher.headWorld() : null; },
    (s, g, T, h) => { if (g.friends.some((f) => f.scHidden) && T.root.visible && s.headY === null) { s.headY = h.y; s.seatX = T.pos.x; } }));
  pass(r.hidden === 1 && r.headY > 0.9 && r.headY < 1.35 && Math.abs(Math.abs(r.seatX) - 1.5) < 0.2, `he vanishes from the front; a friend calls "psst!"... it is HIM in their seat, at their height (head ${r.headY && r.headY.toFixed(2)} m, x ${r.seatX && r.seatX.toFixed(2)})`);
  pass(/s_where/.test(r.snds) && /(n|s)_psst/.test(r.snds) && /stab/.test(r.snds) && /Wrong\.\.\. seat/.test(r.subs), '"Where did he go?" / "Psst!" / the stab / "Wrong... seat."');
  pass(/(n|s)_stare/.test(r.snds) && clean(r.after), 'the lights: your friend is back ("Why are you staring at me?"), he is at the front');

  // 3. the sprint
  r = await page.evaluate(() => play('sprint', (g, eye, V) => (g.world.door.openTarget > 0 ? new V(4.8, 1.4, g.world.doorZ) : null)));
  pass(r.door === 1 && /door_creak/.test(r.snds) && /Who opened the door/.test(r.subs), 'he vanishes; the door creaks open on the black corridor; Nora: "Who opened the door?"');
  pass(r.maxSpeed > 4 && /run_steps/.test(r.snds), `he RUNS at you (${r.maxSpeed.toFixed(1)} m/s; he walks at about 1)`);
  pass(r.minDist < 0.75 && r.minDist > 0.3 && /scream/.test(r.snds) && r.maxFear > 0.95, `in your face with a scream (${r.minDist.toFixed(2)} m: his face, not a blur)`);
  pass(/t_norunning/.test(r.snds) && clean(r.after), '"No... running... in... class." The door is shut, everything is back');

  // 4. the hanging
  r = await page.evaluate(() => play('hanging', null, (s, g, T, h) => { if (Math.abs(T.root.rotation.z) > 2.5 && g.scLocalOn) { s.rz = T.root.rotation.z; if (s.headY === null) s.headY = h.y - g.camPos.y; } }));
  pass(Math.abs(Math.abs(r.rz) - Math.PI) < 0.2 && r.headY !== null && Math.abs(r.headY) < 0.15, `drip, drip, the lights die: he hangs upside down in front of you, his face at yours (${r.headY && r.headY.toFixed(2)} m off)`);
  pass(/drip/.test(r.snds) && /rope_creak/.test(r.snds) && /scream/.test(r.snds) && r.minDist < 0.75, 'drips, the rope creaks, then he drops at you with a scream');
  pass(clean(r.after), 'the lights: right way up, at the front ' + JSON.stringify(r.after));

  // 5. the window
  r = await page.evaluate(() => play('window', (g, eye, V) => (g.scLocalOn ? new V(-4.95, 1.75, -0.9) : null), (s, g, T, h) => { if (T.root.visible && g.scLocalOn) s.x = Math.min(s.x, T.pos.x); }));
  pass(/knock_glass/.test(r.snds) && /tw_letmein/.test(r.snds) && /window/.test(r.subs), 'the rain stops, three knocks on the window, "Let... me... in."');
  pass(r.x < -5 && /glass_bang/.test(r.snds) && r.maxFear > 0.95, `you look: he slams into the glass from outside (x ${r.x.toFixed(2)})`);
  pass(clean(r.after), 'then he is gone, and back at the front');

  // 6. the fake bell (period 2: it looks like the real end)
  r = await page.evaluate(() => play('fakebell', null));
  pass(/bell_bend/.test(r.snds) && /PERIOD 2 COMPLETE/.test(r.fake) && /CLASS IS NOT OVER/.test(r.fake), 'the bell rings, "PERIOD 2 COMPLETE" comes up... and tears: "CLASS IS NOT OVER"');
  pass(r.minDist < 0.75 && /scream/.test(r.snds) && /t_notover2/.test(r.snds), `he is right there (${r.minDist.toFixed(2)} m), then: "The bell... is... not... for... you."`);
  pass(clean(r.after) && await page.evaluate(() => game.state === 'playing' && !game.ending), 'the class goes on (the period did not end)');

  // 7. the face flash
  r = await page.evaluate(() => {
    const g = game; snds.length = 0; let on = false;
    g.fx.push(g.scareFx('flash'));
    for (let i = 0; i < 10; i++) { g.playTick(0.05); on = on || document.getElementById('face-flash').classList.contains('on'); }
    return { on, off: !document.getElementById('face-flash').classList.contains('on'), snd: snds.join() };
  });
  pass(r.on && r.off && /flash_tick/.test(r.snd), 'the face flash: his face for a blink, a tick of noise, gone');

  // 8. a player who never looks: it comes anyway
  r = await page.evaluate(() => play('pencil', null, null, 1200));
  pass(/rev_scream/.test(r.snds) && /scream/.test(r.snds) && r.minDist < 0.75 && clean(r.after), `never looked down: you hear it coming, then he is in your face anyway (${r.minDist.toFixed(2)} m)`);

  // 9. off your chair: no scene for you (the director waits)
  r = await page.evaluate(() => { const g = game; g.me.slipK = 1; const c = g.canScareMe(); g.me.slipK = 0; return { c, back: g.canScareMe() }; });
  pass(!r.c && r.back, 'off your chair (or a ghost): no scare for you right now');
  await page.screenshot({ path: shot('scares_end.png') });

  // ---------------------------------------------------------------- his habit: tapping his stomach (src/teacher.js)
  r = await page.evaluate(() => {
    const g = game, T = g.teacher, V = g.camPos.constructor;
    snds.length = 0;
    g.interrupt((function* () { T.place(0.2, -4.2, 0); T.setPose('rest'); T.lookAt(null); T.thinking = true; for (;;) yield; })());
    let taps = 0; const o = T.onTap; T.onTap = (p) => { taps++; o(p); };
    for (let i = 0; i < 80; i++) g.playTick(0.05);
    const hand = T.handPos('R', new V()), belly = T.local(-0.05, T.bellyY, T.bellyZ, new V());
    const think = { k: T.tapK, taps, near: hand.distanceTo(belly), pat: snds.filter((n) => n === 'belly_tap').length };
    T.moveTo(-1.5, -4.5, 1); for (let i = 0; i < 20; i++) g.playTick(0.05);
    const walk = T.tapK;
    T.moveTarget = null; T.leanTarget = 0.9; T.crouchTarget = 0.3; for (let i = 0; i < 40; i++) g.playTick(0.05);
    const lean = T.tapK;
    T.leanTarget = 0; T.crouchTarget = 0; T.thinking = false; T.tapWait = 0;
    let on = 0; for (let i = 0; i < 600; i++) { g.playTick(0.05); if (T.tapOn) on++; }
    T.onTap = o; g.interrupt((function* () {})());
    return { think, walk, lean, idle: on / 600 };
  });
  pass(r.think.k > 0.95 && r.think.taps >= 6 && r.think.near < 0.2, `while he thinks his right hand is on his stomach and taps it (${r.think.taps} taps in 4 s, hand ${r.think.near.toFixed(2)} m from his stomach)`);
  pass(r.think.pat >= 6, 'each tap is a soft pat you can hear up close');
  pass(r.walk < 0.1 && r.lean < 0.1, `never while he walks or leans over a desk (${r.walk.toFixed(2)}, ${r.lean.toFixed(2)})`);
  pass(r.idle > 0.1 && r.idle < 0.8, `just standing, bouts come and go by themselves (${Math.round(r.idle * 100)}% of the time)`);

  // ---------------------------------------------------------------- his name: Mr. Past, PAST SUMMIT
  r = await page.evaluate(() => ({ title: document.title, logo: document.querySelector('.logo').textContent, voice: game.audio.voices.t_name.text, html: document.body.innerHTML.includes('Madi') }));
  pass(r.title === 'Past Summit' && r.logo === 'PAST SUMMIT' && /Mister\.\.\. Past/.test(r.voice) && !r.html, 'his name is Mr. Past and the game is PAST SUMMIT (title, logo, his voice; "Madi" is nowhere on the page) ' + JSON.stringify(r));

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
