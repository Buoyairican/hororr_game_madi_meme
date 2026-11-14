// Phase 2: a different teacher every class. The seeded setup (the same seed: the same class), each event
// of the deck (his ringtone, the fly, the pizza, the fire alarm, he leaves the room), each of his quirks
// (half deaf, hates laughing, dozes off, the clock, counts the class, hums) and his slang (he learns the
// class clowns' words, your squeaky voice and phonk; uses them wrong, writes them on the board, dances,
// remembers them next class). Every check looks for what a player sees or hears: his lines, the sounds,
// the props, the hints, the HUD, the numbers he uses (hearing, anger), and the stats.
const { chromium, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  let page = null;
  const open = async (q) => {
    if (page) await page.close();
    page = await browser.newPage({ viewport: { width: 640, height: 360 } });
    page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
    page.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text().slice(0, 200)); });
    await page.goto(ROOT + '/index.html?debug=1&autostart=1&' + q);
    await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
    await page.evaluate(async () => {
      const g = window.game;
      window.EV = await import('/src/events.js');
      window.DATA = await import('/src/data.js');
      window.PR = await import('/src/pranks.js');
      window.MEMES = await import('/src/memes.js');
      g.__render = g.post.render.bind(g.post);
      g.post.render = () => {};
      window.run = (sec, each) => { for (let i = 0; i < Math.round(sec * 20); i++) { if (g.state !== 'playing') break; if (each) each(); g.playTick(0.05); g.ui.update(0.05); } };
      window.until = (fn, max, each) => { let n = 0; while (!fn() && n < max * 20 && g.state === 'playing') { if (each) each(); g.playTick(0.05); g.ui.update(0.05); n++; } return !!fn(); };
      // nothing random in the way: no calls, texts, scares, videos, class clowns
      // (and his habits only when a check starts one)
      window.quiet = () => { g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.__startMeme = g.startMeme; g.startMeme = () => false; g.quirkNext = {}; g.slangNext = 1e9; };
      window.calm = () => { g.anger = 0; g.flags = { r40: true, r70: true }; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; p.prankStreak = 0; } g.lastEventEnd = -99; };
      // what a player hears, reads and is told
      window.played = []; const ap = g.audio.play.bind(g.audio); g.audio.play = (n, o) => { played.push(n); return ap(n, o); };
      window.subs = []; const su = g.ui.subtitle.bind(g.ui); g.ui.subtitle = (...a) => { subs.push(String(a[1])); return su(...a); };
      window.hints = []; const hi = g.ui.hint.bind(g.ui); g.ui.hint = (...a) => { hints.push(String(a[0])); return hi(...a); };
      window.toasts = []; const to = g.ui.toast.bind(g.ui); g.ui.toast = (...a) => { toasts.push(String(a[0])); return to(...a); };
      window.board = []; const B = g.world.board, bw = B.write.bind(B); B.write = (t, ...a) => { board.push(t); return bw(t, ...a); };
      window.said = (re) => subs.some((s) => re.test(s));
      window.heard = (n) => played.includes(n);
      window.hinted = (re) => hints.some((s) => re.test(s));
      window.idle = () => g.interrupt((function* () {})()); // (back to the idle lesson next frame)
      // he sees nobody (to test something else than getting caught)
      window.blindOn = () => { if (g.__uw) return; g.__uw = g.updateWatching; g.updateWatching = function () { g.__uw.call(g); for (const p of g.players) { p.watching = false; p.lookDot = -1; } }; };
      window.blindOff = () => { if (g.__uw) { g.updateWatching = g.__uw; g.__uw = null; } };
      window.fresh = () => { played.length = 0; subs.length = 0; hints.length = 0; toasts.length = 0; board.length = 0; };
      window.aimAt = (pt) => { const d = pt.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
      // he stands still somewhere, facing a way, doing nothing (idle = true: the quirks may react)
      window.stand = (x, z, facing, idle = false) => {
        const T = g.teacher;
        g.interrupt((function* () { T.place(x, z, facing); T.lookAt(null); T.setPose('rest'); for (;;) { T.place(x, z, facing); yield; } })());
        if (idle) g.brainIdle = true;
      };
      // a throw from your seat that hits what `want` says (the aim arc's own flight code)
      window.findThrow = (aimAt, want) => {
        const targets = g.prankTargets(), out = { pts: Array.from({ length: 70 }, () => g.camPos.clone()), n: 0, hit: null, at: g.camPos.clone() };
        const sp = g.camPos.clone(), sv = g.camPos.clone(), d = aimAt.clone().sub(g.camPos), y0 = Math.atan2(-d.x, -d.z);
        let best = null;
        for (const pw of [0.35, 0.5, 0.7, 1]) for (let dy = -0.1; dy <= 0.1; dy += 0.02) {
          const yaw = y0 + dy; let r0 = null, len = 0;
          for (let pitch = -1.1; pitch <= 0.9; pitch += 0.01) {
            PR.throwStart(g.camPos, yaw, pitch, pw, 'ball', sp, sv); g.simThrow(sp, sv, 'ball', 0, g.me, targets, out);
            if (out.hit && want(out.hit)) { if (r0 === null) r0 = pitch; len++; } else if (r0 !== null) break;
          }
          if (r0 !== null && (!best || len > best.len)) best = { yaw, pitch: r0 + (len - 1) * 0.005, power: pw, kind: 'ball', curve: 0, len };
        }
        return best;
      };
    });
    return page;
  };
  const check = async (name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  const ev = (fn) => page.evaluate(fn);
  const snap = async (name) => { await ev(() => game.__render(game.scene, game.camera)); await page.screenshot({ path: shot(name) }); };

  // =============================================================== the setup: one seed, the same class
  await open('mode=free&seed=12345');
  await check('?seed=12345: this class comes from that seed (visible to tests: game.setupInfo())', `game.setupInfo().seed === 12345`);
  await check('the class has 3-4 events and 2 quirks from the deck', `(() => { const s = game.setupInfo(); return s.events.length >= 3 && s.events.length <= 4 && s.quirks.length === 2 && s.events.every((e) => DATA.EVENTS[e]) && s.quirks.every((q) => DATA.QUIRKS[q]) ? true : s; })()`);
  await check('the same seed gives the same class (events, quirks, deaf side, the times)', `(() => { const a = EV.classSetup(12345, 'free', 0), s = game.setupInfo(); return JSON.stringify([a.events, a.quirks, a.deafSide, a.plan]) === JSON.stringify([s.events, s.quirks, s.deafSide, s.plan]) ? true : [a, s]; })()`);
  await check('Free Class: each event has a start time, in order, before the bell', `(() => { const p = game.setupInfo().plan; return p.every((x, i) => x.at > 20 && x.at < 250 && (i === 0 || x.at > p[i - 1].at)) ? true : p; })()`);
  await check('story: the events sit in the period\'s quiet windows (one each)', `(() => { const s = EV.classSetup(777, 'story', 1); return s.slots.length === 4 && s.slots.filter(Boolean).length === s.events.length && s.events.every((e) => s.slots.includes(e)) && JSON.stringify(s) === JSON.stringify(EV.classSetup(777, 'story', 1)) ? true : s; })()`);
  await check('100 seeds: every event and quirk shows up, classes differ', `(() => { const evs = new Set(), qs = new Set(), sets = new Set(); for (let i = 1; i <= 100; i++) { const s = EV.classSetup(i * 7919, 'free', 0); s.events.forEach((e) => evs.add(e)); s.quirks.forEach((q) => qs.add(q)); sets.add(s.events.join() + '|' + s.quirks.join()); } return evs.size === 5 && qs.size === 6 && sets.size > 40 ? true : [evs.size, qs.size, sets.size]; })()`);
  await check('a forced list (tests, a hand-made challenge) keeps the other dice the same', `(() => { const a = EV.classSetup(5, 'free', 0), b = EV.classSetup(5, 'free', 0, { events: ['fly'], quirks: ['hum', 'doze'] }); return b.events.join() === 'fly' && b.quirks.join() === 'hum,doze' && a.deafSide === b.deafSide ? true : [a, b]; })()`);
  await check('RESTART: a new class gets a new random setup; start(mode, ch, { seed }) picks one', `(() => { game.start('free', 0, { seed: 99 }); const a = game.setupInfo().seed; game.start('free', 0); const b = game.setupInfo().seed; return a === 99 && b !== 99 ? true : [a, b]; })()`);

  // =============================================================== the events
  await open('mode=free&events=none&quirks=none');
  await ev(() => { quiet(); run(12); calm(); });

  // ---- 1. his ringtone
  await ev(() => { fresh(); game.startClassEvent('ringtone'); run(1.2); });
  await check('ringtone: his embarrassing ringtone plays, the class laughs (LAUGHS meter)', `heard('madi_ring') && game.madiRinging && game.laugh > 10`);
  await check('ringtone: the first time, a hint says what it means for you (after the hint on screen)', `until(() => hinted(/phone is ringing/i), 8)`);
  await ev(() => until(() => game.onPhone, 6));
  await check('ringtone: his phone is in his hand at his ear, his back to the class, he hears you less', `game.madiPhone.visible && game.teacher.pose === 'phone' && game.hearMul(game.me) < 0.6 && !game.teacher.chalk.visible`);
  await check('ringtone: under his eye on the HUD: "ON THE PHONE"', `/ON THE PHONE/.test(document.getElementById('ev-now').textContent) && !document.getElementById('ev-now').classList.contains('off')`);
  await ev(() => { aimAt(game.teacher.headWorld()); run(1.5); });
  await snap('ev_ringtone.png');
  await ev(() => until(() => game.echoable && game.canEcho(), 12));
  await check('ringtone: echo him mid-call: he glares ("Who... said that?") and goes on with the call', `(() => { const g = game; g.doEcho(g.me); run(2.5); return g.classEvent && g.classEvent.id === 'ringtone' && g.me.echoStreak === 1 && said(/Who\\.\\.\\. said that/) ? true : [g.classEvent, g.me.echoStreak]; })()`);
  await ev(() => until(() => !game.classEvent, 40));
  await check('ringtone: the call (his lines, the tiny voice in the phone) and "That... never... happened."', `said(/Hello\\?/) && (heard('phone_voice') || heard('phone_static')) && said(/never\\.\\.\\. happened/) && !game.madiPhone.visible`);
  await check('ringtone: over: the line under his eye is gone', `(() => { run(0.1); return document.getElementById('ev-now').classList.contains('off'); })()`);
  await check('ringtone: a class clown can now play his ringtone; your next text is about it; it is counted', `game.extraMemes.some((m) => m.id === 'ring') && game.msgQueue.length >= 1 && game.track.log.some((e) => e.type === 'classEvent' && e.id === 'ringtone')`);
  await check('ASK after the call: "Who was on the phone?" -> "Nobody... called."', `(() => { const g = game; calm(); g.allowAsk = true; g.qBusy = false; fresh(); g.openAsk(g.me); const i = g.choice ? g.choice.labels.findIndex((l) => /on the phone/.test(l)) : -1; if (i < 0) return g.choice && g.choice.labels; g.pickChoice(i); until(() => said(/Nobody\\.\\.\\. called/), 25); return said(/Nobody\\.\\.\\. called/) ? true : subs.slice(-4); })()`);
  await ev(() => run(4));

  // ---- 2. the fly
  // (it will land on your desk first: he comes and slaps it)
  await ev(() => { const g = game; calm(); fresh(); g.flySpot = () => ({ player: g.me, at: new g.camPos.constructor(g.me.desk.x + 0.12, g.me.desk.top + 0.012, g.me.desk.z) }); g.startClassEvent('fly'); run(2.5); });
  await check('fly: a fly buzzes around the room (you see it, you hear it)', `game.flyMesh.visible && !!game.fly && heard('fly_buzz') && !!game.flySnd && !game.flySnd.ended`);
  await ev(() => run(2));
  await check('fly: his eyes follow it; "A... fly."; the hint; a task to swat it', `game.teacher.lookTarget === (game.fly && game.fly.pos) && said(/A\\.\\.\\. fly/) && until(() => hinted(/fly/i), 8) && game.objectives.some((o) => o.id === 'fly')`);
  await snap('ev_fly.png');
  // it lands on your desk: he comes and slaps it
  await check('fly: it lands on YOUR desk, he comes over and SLAPS it (your view jumps, a hint)', `(() => { const g = game; let shook = 0; until(() => g.track.log.some((e) => e.type === 'deskSlap' && e.who === g.me.id), 30); shook = g.bonkShake; return g.track.log.some((e) => e.type === 'deskSlap') && heard('desk_slap') && shook > 0 && hinted(/slapped <b>your<\\/b> desk/) ? true : [heard('desk_slap'), shook, hints.slice(-2)]; })()`);
  await ev(() => until(() => !game.classEvent, 40));
  // a new fly: hit it with a paper ball while it sits on a desk
  await ev(() => { const g = game; calm(); fresh(); delete g.flySpot; g.flySpot = () => ({ player: g.me, at: new g.camPos.constructor(g.me.desk.x + 0.1, g.me.desk.top + 0.012, g.me.desk.z + 0.02) }); g.startClassEvent('fly'); until(() => g.fly && g.fly.mode === 'sit', 20); });
  // (he is coming to slap it, facing you: if he saw your arm up you would be caught, so here he sees nobody)
  const t = await ev(() => { const g = game; if (!g.fly) return null; blindOn(); const t = findThrow(g.fly.pos, (h) => h.type === 'fly'); if (t) { g.me.foldT = 0; g.yaw = t.yaw; g.pitch = t.pitch; g.throwFrom(g.me, t); } return t; });
  (t ? ok : bad).push('fly: the aim arc finds the fly ("the FLY")');
  await ev(() => { run(1.5); blindOff(); });
  await check('fly: your paper ball got it: splat, the class laughs, swatted counted, task done', `(!game.fly || game.fly.mode === 'dead') && heard('fly_splat') && game.track.of(game.me).flies === 1 && game.objDone('fly') && game.laugh > 15`);
  await ev(() => until(() => !game.classEvent, 30));
  await check('fly: he turns to you: "Thank... you."', `said(/Thank\\.\\.\\. you/)`);
  await ev(() => { delete game.flySpot; run(3); });

  // ---- 3. pizza at the door
  await ev(() => { calm(); fresh(); game.startClassEvent('pizza'); run(1); });
  await check('pizza: three knocks at the door, the class looks', `heard('door_knock') && game.allKids().some((k) => k.lookTarget === game.world.door.pos)`);
  await ev(() => until(() => game.pizza === 'held', 30));
  await check('pizza: the door opens, a voice in the dark hallway: pizza... for Mr. Hale; he takes the box', `said(/Pizza\\.\\.\\. for Room 13/) && said(/Mister Hale/) && game.pizzaBox.visible && game.teacher.pose === 'hold'`);
  await ev(() => until(() => game.slice.visible, 30));
  await check('pizza: on his desk, lid up; he eats a slice, staring at you (munch)', `game.pizza === 'desk' && game.pizzaOpen && game.teacher.pose === 'eat'`);
  await ev(() => { aimAt(game.teacher.headWorld().add(game.camPos.clone().set(0, -0.3, 0))); run(0.6); });
  await snap('ev_pizza.png');
  await ev(() => until(() => !game.classEvent, 30));
  await check('pizza: "No... eating... in class." (the class laughs); the box stays on his desk', `heard('munch') && said(/No\\.\\.\\. eating/) && game.pizza === 'desk' && game.pizzaBox.visible`);
  await check('ASK: "Can I have some pizza?" -> "Mine."', `(() => { const g = game; calm(); g.qBusy = false; fresh(); g.openAsk(g.me); const i = g.choice ? g.choice.labels.findIndex((l) => /pizza/.test(l)) : -1; if (i < 0) return g.choice && g.choice.labels; g.pickChoice(i); until(() => said(/^Mine\\.$/), 25); return said(/^Mine\\.$/) ? true : subs.slice(-4); })()`);
  await ev(() => run(4));

  // ---- 4. the fire alarm
  await ev(() => { calm(); fresh(); game.startClassEvent('firedrill'); run(1); });
  await check('fire alarm: it rings (loud), red strobe; "it is so loud he can\'t hear you" hint', `game.alarmOn && game.alarm === 1 && heard('fire_alarm') && hinted(/can't hear you/) && /FIRE ALARM/.test(document.getElementById('ev-now').textContent)`);
  await check('fire alarm: whispering while he doesn\'t look adds (almost) no anger: he hears nothing', `(() => { const g = game, uw = g.updateWatching.bind(g); g.updateWatching = function () { uw(); for (const p of g.players) { p.watching = false; p.lookDot = -1; } }; calm(); g.yaw = 1.52; g.pitch = -0.05; g.input.keys.talk = true; run(3); g.input.keys.talk = false; g.updateWatching = uw; const a = g.anger; return a < 1.5 && g.hearMul(g.me) < 0.1 ? true : [a, g.hearMul(g.me)]; })()`);
  await ev(() => { game.yaw = 0; game.pitch = 0.05; run(0.4); });
  await snap('ev_firedrill.png');
  await ev(() => until(() => !game.classEvent, 30));
  await check('fire alarm: then silence. "It is not... a real... fire."', `!game.alarmOn && game.alarm === 0 && said(/Stay\\.\\.\\. in your/) && said(/not\\.\\.\\. a real\\.\\.\\. fire/)`);
  await ev(() => run(3));

  // ---- 5. he leaves the room
  await ev(() => { calm(); fresh(); game.mischief = 0; game.startClassEvent('leave'); until(() => game.away, 25); });
  await check('leave: "Do not... move." He walks out, the door closes: he is gone', `said(/Do not\\.\\.\\. move/) && game.away && !game.present && !game.teacher.root.visible && hinted(/left the room/) && /OUT OF THE ROOM/.test(document.getElementById('ev-now').textContent)`);
  await check('leave: a task for it, the class goes wild (chatter)', `game.objectives.some((o) => o.id === 'chaos') && heard('class_chatter') && heard('door_slam') || heard('door_open')`);
  await check('leave: whisper while he is out: no anger, chaos counted, task done, mischief counts double', `(() => { const g = game; g.yaw = 1.52; g.pitch = -0.05; const m0 = g.mischief; g.input.keys.talk = true; run(4); g.input.keys.talk = false; return g.anger === 0 && g.track.of(g.me).chaos > 2 && g.objDone('chaos') && g.mischief - m0 > 30 ? true : [g.anger, g.track.of(g.me).chaos, g.objDone('chaos'), g.mischief - m0]; })()`);
  await ev(() => until(() => game.doorFace.visible, 25));
  await check('leave: his face in the door window (a hint): whoever is at it, he saw', `(() => { const g = game; g.input.keys.talk = true; run(1.5); g.input.keys.talk = false; return g.doorFace.visible && hinted(/door window/) && g.awaySaw === g.me ? true : [g.doorFace.visible, g.awaySaw && g.awaySaw.id]; })()`);
  await ev(() => { aimAt(game.doorFace.getWorldPosition(game.camPos.clone())); run(0.2); });
  await snap('ev_leave_peek.png');
  await ev(() => { game.yaw = 0; until(() => game.present, 30); });
  await check('leave: footsteps coming back, then the door: he is back in the room', `game.present && !game.away && game.teacher.root.visible && played.filter((n) => /^step_/.test(n)).length >= 6`);
  await check('leave: he saw you through the window: "I... saw... that." and he is angrier', `until(() => said(/I\\.\\.\\. saw\\.\\.\\. that/), 10) && game.anger >= 15 && game.track.log.some((e) => e.type === 'seenFromDoor' || e.type === 'redHanded')`);
  await ev(() => until(() => !game.classEvent, 20));
  await check('the end screen says what kind of class it was', `/Today he|pizza|fly/.test(game.statsHtml())`);

  // =============================================================== his quirks
  await open('mode=free&events=none&quirks=deaf,laugh&deaf=left');
  await ev(() => { quiet(); run(12); calm(); });
  await check('quirks: none on the HUD until you notice them', `document.getElementById('quirks').classList.contains('off')`);
  // half deaf (left): to his left he barely hears you
  await check('half deaf: with you on his LEFT (deaf) side he hears you at 30%; behind him: normal', `(() => { const g = game; stand(1.5, -5.6, Math.PI); run(0.2); const a = g.onDeafSide(g.me), ka = g.hearMul(g.me); stand(0, -5.6, Math.PI); run(0.2); const b = g.onDeafSide(g.me), kb = g.hearMul(g.me); return a && Math.abs(ka - 0.3) < 0.01 && !b && kb === 1 ? true : [a, ka, b, kb]; })()`);
  await check('half deaf: whisper on his deaf side: he cups his good ear: "What?" / "Speak... up." (hint, HUD tag)', `(() => { const g = game; fresh(); stand(1.5, -5.6, Math.PI, true); calm(); g.yaw = 1.52; g.pitch = -0.05; g.input.keys.talk = true; const okk = until(() => g.teacher.pose === 'cup', 8, () => { calm(); }); g.input.keys.talk = false; run(3); return okk && (said(/^What\\?$/) || said(/Speak\\.\\.\\. up/)) && hinted(/deaf in his <b>LEFT<\\/b> ear/) && /left ear/.test(document.getElementById('quirks').innerText) ? true : [okk, subs.slice(-3)]; })()`);
  await check('half deaf: an echo from his deaf side: "What?" (it does not count toward "it was you")', `(() => { const g = game; calm(); fresh(); stand(1.5, -5.6, Math.PI); run(0.2); g.echoable = { id: 't_still', text: 'Sit... still.', until: g.t + 4 }; g.echoBusy = false; g.me.echoStreak = 0; g.doEcho(g.me); run(4); return g.me.echoStreak === 0 && said(/^What\\?$/) && !g.searching ? true : [g.me.echoStreak, subs.slice(-3)]; })()`);
  await check('...from his good side it counts, and he goes looking', `(() => { const g = game; calm(); fresh(); idle(); stand(-1.5, -5.6, Math.PI); run(0.2); g.echoable = { id: 't_still', text: 'Sit... still.', until: g.t + 4 }; g.echoBusy = false; g.doEcho(g.me); const s = until(() => g.searching, 6); return g.me.echoStreak === 1 && s ? true : [g.me.echoStreak, s]; })()`);
  await ev(() => until(() => !game.echoBusy, 40, () => calm()));
  // hates laughing
  await check('hates laughing: the class laughing is louder to him (noise x2.2)', `(() => { const g = game; g.laugh = 60; g.laughAbout = g.me; const a = g.laughNoise(g.me); g.quirks.delete('laugh'); const b = g.laughNoise(g.me); g.quirks.add('laugh'); g.laugh = 0; return a > b * 1.5 ? true : [a, b]; })()`);
  await check('hates laughing: a big laugh at your prank: angrier, he spins around: "Who... laughed?"', `(() => { const g = game; calm(); fresh(); idle(); stand(0, -6.0, Math.PI, true); const a0 = g.anger; g.addLaugh(30, g.camPos.clone(), g.me); const up = g.anger - a0; run(4); return up >= 9 && (said(/Who\\.\\.\\. laughed/) || said(/No\\.\\.\\. laughing/)) && /hates laughing/.test(document.getElementById('quirks').innerText) ? true : [up, subs.slice(-3)]; })()`);
  await check('...the class laughing at HIM (his ringtone, his dance) does not make him angrier at you', `(() => { const g = game; calm(); idle(); stand(0, -6.0, Math.PI); const a0 = g.anger; g.addLaugh(30, g.teacher.headWorld(), null); return g.anger - a0 < 0.01 ? true : g.anger - a0; })()`);

  await open('mode=free&events=none&quirks=doze,hum,clock,count');
  await ev(() => { quiet(); run(12); calm(); idle(); run(0.1); });
  // dozes off
  await ev(() => { const g = game; fresh(); g.interrupt(g.actDoze()); run(0.1); until(() => g.dozing, 15); run(1); });
  await check('doze: he leans on his desk, eyes dark, snoring; the eye on the HUD says ASLEEP', `game.dozing && game.teacher.eyeGlow === 0 && heard('m_snore') && document.getElementById('eye-label').textContent === 'ASLEEP' && until(() => hinted(/dozing off/), 6)`);
  await check('doze: he can\'t see anybody and barely hears (25%)', `!game.me.watching && game.me.lookDot === -1 && Math.abs(game.hearMul(game.me) - 0.25) < 0.01`);
  await ev(() => { aimAt(game.teacher.headWorld()); run(0.1); });
  await snap('q_doze.png');
  await check('doze: your phone game crashes (LOUD): he wakes up with a snort: "I was... not... sleeping." (counted)', `(() => { const g = game; g.phoneFail(g.me); until(() => !g.dozing, 3); run(5); return heard('snort') && g.track.of(g.me).woke === 1 && said(/not\\.\\.\\. sleeping/) ? true : [heard('snort'), g.track.of(g.me).woke, subs.slice(-3)]; })()`);
  await ev(() => { until(() => !game.quirkBusy && game.brainIdle, 20); calm(); game.me.failT = 0; });
  // hums
  await ev(() => { const g = game; fresh(); g.interrupt(g.actWrite('WE LEARN HUMMING')); run(0.1); until(() => g.humming, 12); run(0.5); });
  await check('hum: he hums while he writes (you hear it at his head), he hears you at 50%', `game.humming && heard('madi_hum') && !!game.humSnd && Math.abs(game.hearMul(game.me) - 0.5) < 0.01 && until(() => hinted(/hums while he writes/), 6)`);
  await ev(() => { until(() => !game.humming, 20); stand(game.teacher.pos.x, game.teacher.pos.z, game.teacher.facing); }); // (and then he stands there: no new line to write)
  await check('hum: the humming stops: for 3 seconds he hears you MORE (x1.7)', `Math.abs(game.hearMul(game.me) - 1.7) < 0.01`);
  await ev(() => run(3.2));
  await check('hum: ...then normal again', `game.hearMul(game.me) === 1`);
  // the clock
  await ev(() => { const g = game; idle(); run(0.1); until(() => g.brainIdle && !g.humming, 15); fresh(); g.interrupt(g.actClock()); run(1.6); });
  await check('clock: he stares at the clock, checking his watch (his back to the class)', `game.teacher.lookTarget === game.world.clock.pos && game.teacher.pose === 'wrist' && until(() => hinted(/clock/), 8)`);
  await ev(() => until(() => !game.quirkBusy, 10));
  await check('clock: "Tick... tock." / "Not... yet."; he glances back at you less (35%)', `(said(/Tick\\.\\.\\. tock/) || said(/Not\\.\\.\\. yet/)) && Math.abs(game.glanceChance(1) - 0.35) < 0.001`);
  // counts the class
  await ev(() => { const g = game; calm(); fresh(); g.interrupt(g.actCount()); run(0.1); });
  const counted = await ev(() => { const g = game; let pointed = false; until(() => !g.quirkBusy, 30, () => { const at = g.teacher.poseData && g.teacher.poseData.at; if (g.teacher.pose === 'point' && at && at.distanceTo(g.headOf(g.me)) < 0.3) pointed = true; }); return { pointed, nums: subs.filter((s) => /^(One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Eleven|Twelve|Thirteen|Fourteen|Fifteen)\.$/.test(s)).length, heads: g.allKids().filter((k) => !k.gone).length + g.players.length + 1, end: said(/One\.\.\. too\.\.\. many/) }; });
  (counted.pointed && counted.nums === counted.heads && counted.end ? ok : bad).push('count: he points at every head (you too) and counts out loud... and Kevin\'s empty chair: "One... too... many." ' + JSON.stringify(counted));
  await check('the HUD lists the quirks you have noticed ("TODAY HE")', `(() => { const t = document.getElementById('quirks').innerText; return /dozes off/.test(t) && /hums/.test(t) && /clock/.test(t) && /counts/.test(t) && !document.getElementById('quirks').classList.contains('off') ? true : t; })()`);
  await snap('q_chips.png');

  // =============================================================== his slang
  await open('mode=free&events=none&quirks=none');
  await ev(() => { quiet(); run(12); calm(); idle(); run(0.1); });
  await check('slang: a class clown says "bruh"; when he is done with it, he knows the word (a toast)', `(() => { const g = game; fresh(); g.__startMeme('bruh'); run(0.3); until(() => !g.memeBusy, 60, () => { if (g.ui.noteOpen) g.ui.closeNote(); }); return g.knows('bruh') && toasts.some((t) => /bruh/.test(t)) && g.track.global.learned.includes('bruh') ? true : [g.slangWords(), toasts]; })()`);
  await check('slang: he remembers it in this browser for next class', `JSON.parse(localStorage.getItem('madiclass.slang') || '[]').some((v) => v.id === 'bruh')`);
  await check('slang: later he uses it in the lesson, wrong: "Open your books... bruh." (the class laughs)', `(() => { const g = game; calm(); fresh(); g.slangLearnT.bruh = -100; g.slangNext = 0; const gen = g.slangAct(); if (!gen) return 'no act'; g.interrupt(gen); run(0.1); until(() => !g.quirkBusy, 20); return said(/Open your books\\.\\.\\. bruh/) && g.vocabUses.bruh === 1 && g.track.log.some((e) => e.type === 'slangUse' && e.id === 'bruh') ? true : subs.slice(-4); })()`);
  await check('slang: ...and writes it on the board ("BRUH = BROTHER ?")', `(() => { const g = game; calm(); fresh(); DATA.SLANG_USE.board = 1; g.boardSlang.clear(); g.interrupt(g.actWrite()); run(0.1); until(() => board.length > 0, 10); DATA.SLANG_USE.board = 0.4; run(6); return board.includes('BRUH = BROTHER ?') ? true : board; })()`);
  await check('slang: your echo teaches him your squeaky voice (counted for you)', `(() => { const g = game; calm(); idle(); stand(0, -6, Math.PI); g.echoable = { id: 't_still', text: 'Sit... still.', until: g.t + 4 }; g.echoBusy = false; g.doEcho(g.me); return g.knows('mock') && g.vocab.find((v) => v.id === 'mock').line === 't_still' && g.track.of(g.me).taught >= 1 ? true : g.vocab; })()`);
  await ev(() => until(() => !game.echoBusy, 40, () => calm()));
  await check('slang: he does it back at you: his own line, squeaky, then "Is this... how you... talk?"', `(() => { const g = game; calm(); fresh(); idle(); run(0.1); g.interrupt(g.actSlang(g.vocab.find((v) => v.id === 'mock'))); run(0.1); until(() => !g.quirkBusy, 20); return heard('t_still') && said(/sIt/) && said(/Is this\\.\\.\\. how you/) ? true : subs.slice(-4); })()`);
  // phonk from your phone
  const k = await ev(() => MEMES.CLIPS.findIndex((c) => c.music && c.music[0] === 'v_phonk'));
  await check('slang: phonk plays on your phone near him for a moment: he learns phonk (counted for you)', `(() => { const g = game, T = g.teacher; calm(); idle(); stand(0.6, -3.1, Math.PI); run(0.3); const t0 = g.track.of(g.me).taught; g.input.keys.phone = true; run(0.3); g.phone.switchApp(); g.phone.nextClip(${k}); until(() => g.knows('phonk'), 8, () => { calm(); }); g.input.keys.phone = false; run(0.3); return g.knows('phonk') && g.track.of(g.me).taught === t0 + 1 && toasts.some((t) => /phonk/.test(t)) ? true : [g.knows('phonk'), g.me.phonkT, g.me.vid]; })()`);
  await ev(() => { const g = game; calm(); fresh(); idle(); run(0.2); g.interrupt(g.actDance()); run(0.1); until(() => g.dancing, 8); run(2); aimAt(g.teacher.headWorld()); run(0.05); });
  await check('slang: he dances to phonk from his own phone (music, his phone up, the class laughs, he hears 30%)', `game.dancing && heard('v_phonk') && game.madiPhone.visible && game.teacher.pose === 'dance' && game.laugh > 15 && Math.abs(game.hearMul(game.me) - 0.3) < 0.01`);
  await snap('q_dance.png');
  await ev(() => until(() => !game.quirkBusy && !game.dancing, 20));
  await check('slang: the music stops: "Back... to... work."', `!game.dancing && !game.madiPhone.visible && said(/Back\\.\\.\\. to\\.\\.\\. work/)`);
  await check('the end screen lists the words he learned', `/New words he learned: <b>.*bruh/.test(game.statsHtml())`);
  await check('next class: he still knows them ("He remembers your slang from last time.")', `(() => { const g = game; g.start('free', 0, { events: [], quirks: [] }); quiet(); fresh(); run(18); return g.knows('bruh') && g.knows('phonk') && g.knows('mock') && hinted(/remembers your slang/) ? true : [g.slangWords(), hints]; })()`);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
