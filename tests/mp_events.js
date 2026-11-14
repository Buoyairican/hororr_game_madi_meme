// Online: a different teacher every class, for every player. The host runs today's events and his quirks;
// a friend sees and hears all of it on their own screen (his phone and its ringtone, the fly and its buzz,
// the slap on THEIR desk, the pizza box, the fire alarm and its red strobe, his empty spot while he is out,
// his face in the door window, him asleep / humming / dancing), gets the hints and the "TODAY HE" tags,
// the line under his eye, can swat the fly with paper and is counted for it. A friend who joins in the middle
// gets the class's setup, the tags so far and what the event going on means; a friend who leaves in the
// middle of a fly hunt at their desk breaks nothing.
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;
(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const mk = async (tag) => {
    const ctx = await browser.newContext({ viewport: { width: 640, height: 360 } });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    return page;
  };
  const check = async (page, name, expr) => { let r; try { r = await page.evaluate(expr); } catch (e) { r = 'ERR ' + e.message; } (r === true ? ok : bad).push(name + (r === true ? '' : ' -> ' + JSON.stringify(r))); return r === true; };
  const waitFor = (page, expr, ms = 30000, arg) => page.waitForFunction(expr, arg, { timeout: ms }).then(() => true, () => false);
  const expect = async (page, name, expr, ms = 15000) => { const r = await waitFor(page, expr, ms); (r ? ok : bad).push(name); return r; };
  // what this screen heard, read and was told (sounds from the host and the ones it plays by itself)
  const spy = (P) => P.evaluate(() => {
    const g = window.game;
    window.played = []; const ap = g.audio.play.bind(g.audio); g.audio.play = (n, o) => { played.push(n); return ap(n, o); };
    window.hints = []; const hi = g.ui.hint.bind(g.ui); g.ui.hint = (...a) => { hints.push(String(a[0])); return hi(...a); };
    window.subs = []; const su = g.ui.subtitle.bind(g.ui); g.ui.subtitle = (...a) => { subs.push(String(a[1])); return su(...a); };
    window.heard = (n) => played.includes(n);
    window.hinted = (re) => hints.some((s) => re.test(s));
    window.said = (re) => subs.some((s) => re.test(s));
    window.evNow = () => (document.getElementById('ev-now').classList.contains('off') ? '' : document.getElementById('ev-now').textContent);
  });
  const join = async (P, name, code) => {
    await P.goto(BASE + '&join=' + code);
    await waitFor(P, () => window.game && !document.getElementById('mp').classList.contains('hidden'), 120000);
    await P.fill('#mp-name', name); await P.click('#btn-join');
  };

  const H = await mk('host'), G = await mk('guest');
  await H.goto(BASE);
  await waitFor(H, () => window.game && !document.getElementById('menu').classList.contains('hidden'), 120000);
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await waitFor(H, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), 20000);
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  await join(G, 'Bo', code);
  await waitFor(H, () => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, 20000);
  await H.click('#btn-mp-go');
  await waitFor(G, () => game.state === 'playing' && game.mp.snap, 20000);
  await check(G, 'START: the friend gets the host\'s class (the same seed, events and quirks)', `!!game.setup && typeof game.setup.seed === 'number'`);
  const hostSeed = await H.evaluate(() => game.setup.seed);
  await check(G, '...the very same setup as the host', `game.setup.seed === ${hostSeed}`);

  // today's teacher, picked for the test: no random events, he dozes off, hums and is deaf on his left
  await H.evaluate(() => { game.start('free', 0, { seed: 4242, events: [], quirks: ['doze', 'hum', 'deaf'], deafSide: 'left' }); });
  await waitFor(G, () => game.state === 'playing' && game.setup && game.setup.seed === 4242, 20000);
  await check(G, 'a new class (RESTART online): the friend gets the new setup (seed, quirks, his deaf side)', `game.setup.seed === 4242 && game.setup.quirks.join() === 'doze,hum,deaf' && game.setup.deafSide === 'left' && game.quirkOn('hum')`);
  for (const P of [H, G]) {
    await spy(P);
    await P.evaluate(async () => {
      const g = window.game;
      window.PR = await import('/src/pranks.js');
      g.__render = g.post.render.bind(g.post);
      g.post.render = () => {};
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
          if (r0 !== null && (!best || len > best.len)) best = { yaw, pitch: r0 + (len - 1) * 0.005, power: pw, len };
        }
        return best;
      };
    });
  }
  // the host: nothing random (no calls, texts, scares, class clowns, habits unless a check starts one)
  await H.evaluate(() => {
    const g = game;
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {};
    g.startMeme = () => false;
    window.quiet = () => { g.quirkNext = {}; g.slangNext = 1e9; g.deafNext = 1e9; g.deafTell = 1e9; };
    window.calm = () => { g.anger = 0; g.flags = { r40: true, r70: true }; for (const p of g.players) { p.heat = 0; p.prankSeenT = 0; p.prankStreak = 0; } g.lastEventEnd = -99; };
    window.idle = () => g.interrupt((function* () {})());
    window.bo = () => g.players.find((x) => x.name === 'Bo');
    quiet();
  });
  await H.waitForTimeout(9000); // (past the first seconds of the class: hints and tags show from 8 s on)
  await H.evaluate(() => { calm(); quiet(); });

  // ---- 1. his ringtone
  await H.evaluate(() => { calm(); game.startClassEvent('ringtone'); });
  await expect(G, 'ringtone: the friend hears his ringtone (played on their own screen from the state)', () => game.madiRinging && !!game.ringSnd && heard('madi_ring'));
  await expect(G, 'ringtone: the friend gets the hint', () => hinted(/phone is ringing/i), 12000);
  await expect(G, 'ringtone: his phone at his ear on the friend\'s screen, "ON THE PHONE" under his eye', () => game.madiPhone.visible && !game.teacher.chalk.visible && /ON THE PHONE/.test(evNow()), 15000);
  await expect(G, 'ringtone: the friend hears the call ("Hello?" and the tiny voice in the phone)', () => said(/Hello\?/) && (heard('phone_voice') || heard('phone_static')), 15000);
  await G.evaluate(() => { const g = game; g.__render(g.scene, g.camera); });
  await G.screenshot({ path: shot('mp_events_ringtone.png') });
  await H.evaluate(() => idle());
  await expect(G, 'ringtone: over: his phone is gone, the line under his eye too', () => !game.madiPhone.visible && !evNow() && !game.ringSnd, 8000);

  // ---- 2. the fly: it lands on the friend's desk, he slaps it, the friend swats it
  await H.evaluate(() => { const g = game; calm(); g.flySpot = () => { const p = bo(); return { player: p, at: new g.camPos.constructor(p.desk.x + 0.1, p.desk.top + 0.012, p.desk.z + 0.02) }; }; g.startClassEvent('fly'); });
  await expect(G, 'fly: the friend sees the fly and hears it buzz', () => game.flyMesh.visible && !!game.netFly && !!game.flySnd, 10000);
  await G.evaluate(() => { game.__slaps = 0; const ls = game.localSlap.bind(game); game.localSlap = () => { game.__slaps++; return ls(); }; });
  await expect(G, 'fly: "HUNTING A FLY" under his eye, the hint', () => /FLY/.test(evNow()) && hinted(/A fly!/), 15000);
  await expect(G, 'fly: it lands on the FRIEND\'s desk and he slaps it: their view jumps, a hint', () => game.__slaps >= 1 && game.bonkShake > 0 && hinted(/slapped <b>your<\/b> desk/), 40000);
  await check(H, 'fly: counted on the host (a slap on Bo\'s desk)', `game.track.log.some((e) => e.type === 'deskSlap' && e.who === bo().id)`);
  await H.evaluate(() => idle());
  await waitFor(G, () => !game.netFly, 15000);
  // a second fly: Bo throws a paper ball at it as soon as it lands (he sees nobody meanwhile: this is not about getting caught)
  await H.evaluate(() => { const g = game; calm(); g.__uw = g.updateWatching; g.updateWatching = function () { g.__uw.call(g); for (const p of g.players) { p.watching = false; p.lookDot = -1; } }; g.startClassEvent('fly'); });
  await waitFor(G, () => game.netFly && game.netFly.mode === 1, 20000);
  // Bo throws (a second try if the first paper missed: the fly sits still, but a busy test machine can be late)
  let thr = null, swat = false;
  for (let tryN = 0; tryN < 2 && !swat; tryN++) {
    await waitFor(G, () => game.netFly && game.netFly.mode === 1 && game.netFly.pos.distanceTo(game.netFly.target) < 0.01 && !(game.me.foldT > 0), 8000);
    thr = await G.evaluate(() => { const g = game; if (!g.netFly) return null; const t = findThrow(g.netFly.target, (h) => h.type === 'fly'); if (t) { g.yaw = t.yaw; g.pitch = t.pitch; g.input.keys.prank = true; } return t; });
    if (!thr) break;
    await G.waitForTimeout(250);
    await G.evaluate((t) => { const g = game; g.yaw = t.yaw; g.pitch = t.pitch; if (g.me.aim) { g.me.aim.power = t.power; g.me.aim.kind = 'ball'; } }, thr);
    await G.waitForTimeout(80);
    await G.evaluate(() => { game.input.keys.prank = false; });
    swat = await waitFor(H, () => (game.track.of(bo()).flies || 0) === 1, 5000);
  }
  (thr ? ok : bad).push('fly: on the friend\'s screen the aim arc finds the fly');
  (swat ? ok : bad).push('fly: the friend\'s paper ball got it (host: swatted counted for Bo)');
  await expect(G, 'fly: the friend hears the splat and is told ("You got the fly!")', () => heard('fly_splat') && hinted(/got the fly/), 6000);
  await expect(G, 'fly: he thanks them ("Thank... you.")', () => said(/Thank\.\.\. you/), 20000);
  await H.evaluate(() => { const g = game; delete g.flySpot; if (g.__uw) { g.updateWatching = g.__uw; g.__uw = null; } });
  await waitFor(H, () => !game.classEvent, 20000);
  await expect(G, 'fly: gone from the friend\'s screen (no buzz left)', () => !game.flyMesh.visible && !game.flySnd, 10000);

  // ---- 3. pizza
  await H.evaluate(() => { calm(); game.startClassEvent('pizza'); });
  await expect(G, 'pizza: the friend hears the knocks and the voice in the hallway', () => heard('door_knock') && said(/Pizza\.\.\. for Room 13/), 15000);
  await expect(G, 'pizza: the friend sees him carry the box', () => game.pizza === 'held' && game.pizzaBox.visible, 30000);
  await expect(G, 'pizza: ...on his desk with the lid up, a slice in his hand (munch)', () => game.pizza === 'desk' && game.pizzaOpen && game.slice.visible, 30000);
  await G.evaluate(() => { const g = game; g.__render(g.scene, g.camera); });
  await G.screenshot({ path: shot('mp_events_pizza.png') });
  await H.evaluate(() => idle());
  await expect(G, 'pizza: afterwards the box stays on his desk, the slice is gone, the chalk is back', () => game.pizza === 'desk' && game.pizzaBox.visible && !game.slice.visible && game.teacher.chalk.visible, 8000);

  // ---- 4. the fire alarm, and a friend who joins in the middle of it
  await H.waitForTimeout(1000);
  await H.evaluate(() => { calm(); game.startClassEvent('firedrill'); });
  await expect(G, 'fire alarm: the friend hears the bell, sees "FIRE ALARM", gets the hint', () => game.alarm === 1 && !!game.alarmSnd && /FIRE ALARM/.test(evNow()) && hinted(/can't hear you/), 10000);
  await expect(G, 'fire alarm: the red strobe by the door flashes on the friend\'s screen', () => game.world.lights.red.intensity > 1, 5000);
  const C = await mk('late');
  await join(C, 'Cy', code);
  await waitFor(C, () => window.game && game.state === 'playing' && game.mp && game.mp.snap, 30000);
  await spy(C);
  await check(C, 'late join: the friend gets the class\'s setup', `game.setup.seed === 4242 && game.setup.quirks.join() === 'doze,hum,deaf'`);
  await expect(C, 'late join: in the middle of the alarm they hear it too (it rings on every screen from the state)', () => game.alarm === 1 && !!game.alarmSnd, 8000);
  await expect(C, 'late join: ...and are told what it means', () => hinted(/can't hear you/), 8000);
  await H.evaluate(() => idle());
  await waitFor(H, () => !game.alarmOn, 20000);
  await expect(G, 'fire alarm: silence on the friend\'s screen too', () => game.alarm === 0 && !game.alarmSnd, 6000);

  // ---- 5. he leaves the room; a friend whispers while he is out
  await H.waitForTimeout(1000);
  await H.evaluate(() => { calm(); game.startClassEvent('leave'); });
  await expect(G, 'leave: he walks out: gone from the friend\'s screen, "OUT OF THE ROOM", the class goes wild (chatter)', () => !game.teacher.root.visible && /OUT OF THE ROOM/.test(evNow()) && !!game.chatterSnd && hinted(/left the room/), 30000);
  await waitFor(G, () => game.players.some((x) => x.name === 'Alex' && x.avatar), 8000);
  await G.evaluate(() => { const g = game; const f = g.players.find((x) => x.name === 'Alex'); const h = g.headOf(f); const d = h.sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); g.input.keys.talk = true; });
  const chaos = await waitFor(H, () => (game.track.of(bo()).chaos || 0) > 1.5, 10000);
  (chaos ? ok : bad).push('leave: the friend whispers while he is out: counted for them (chaos)');
  await G.evaluate(() => { game.input.keys.talk = false; });
  await expect(G, 'leave: his face in the door window on the friend\'s screen', () => game.doorFace.visible, 25000);
  await expect(G, 'leave: footsteps coming back, then he is back', () => game.teacher.root.visible && played.filter((n) => /^step_/.test(n)).length >= 6, 30000);
  await waitFor(H, () => !game.classEvent, 20000);

  // ---- his quirks on the friend's screen: asleep, humming, dancing; the "TODAY HE" tags
  await H.evaluate(() => { calm(); quiet(); game.interrupt(game.actDoze()); });
  await expect(G, 'doze: the friend sees him asleep: the eye on their HUD says ASLEEP, the hint, he snores', () => document.getElementById('eye-label').textContent === 'ASLEEP' && hinted(/dozing off/) && heard('m_snore'), 25000);
  await expect(G, 'doze: "TODAY HE ... dozes off" on the friend\'s HUD', () => /dozes off/.test(document.getElementById('quirks').innerText), 5000);
  await G.evaluate(() => { const g = game; g.__render(g.scene, g.camera); });
  await G.screenshot({ path: shot('mp_events_doze.png') });
  await check(C, 'doze: the friend who joined late sees the tags too', `/dozes off/.test(document.getElementById('quirks').innerText)`);
  await H.evaluate(() => { game.dozing && game.wakeUp(null); idle(); });
  await expect(G, 'doze: awake again (eye back)', () => document.getElementById('eye-label').textContent !== 'ASLEEP', 8000);
  await H.waitForTimeout(1500);
  await H.evaluate(() => { calm(); game.interrupt(game.actWrite('WE LEARN HUMMING')); });
  await expect(G, 'hum: the friend hears him hum while he writes; the tag', () => game.humming && !!game.humSnd && /hums/.test(document.getElementById('quirks').innerText), 15000);
  await H.evaluate(() => idle());
  await expect(G, 'hum: the humming stops on the friend\'s screen too', () => !game.humming && !game.humSnd, 8000);
  await H.waitForTimeout(1000);
  await H.evaluate(() => { calm(); game.interrupt(game.actDance()); });
  await expect(G, 'dance: the friend sees him dance to phonk from his phone (music, DANCING, his phone up)', () => game.dancing && !!game.danceSnd && document.getElementById('eye-label').textContent === 'DANCING' && game.madiPhone.visible, 15000);
  await H.evaluate(() => idle());
  await expect(G, 'dance: the music stops on the friend\'s screen too', () => !game.dancing && !game.danceSnd && !game.madiPhone.visible, 8000);

  // ---- a friend leaves in the middle of a fly hunt at their desk
  await H.waitForTimeout(1000);
  await H.evaluate(() => { const g = game; calm(); g.__flySpot = g.flySpot; g.flySpot = function (i) { const p = g.players.find((x) => x.name === 'Cy'); if (p && i === 0) return { player: p, at: new g.camPos.constructor(p.desk.x, p.desk.top + 0.012, p.desk.z) }; return g.__flySpot(i); }; g.startClassEvent('fly'); });
  await H.waitForTimeout(3500);
  await C.evaluate(() => game.mp.leave());
  await expect(H, 'a friend leaves in the middle of the fly hunt at their desk: they are gone from the class...', () => game.players.length === 2, 15000);
  const done = await waitFor(H, () => !game.classEvent && game.state === 'playing', 100000);
  (done ? ok : bad).push('...and the hunt goes on and ends without them');
  await check(G, 'the other friend is still in the class', `game.state === 'playing' && game.players.length === 2`);
  await check(H, 'host: every event of this class is in the class log', `['ringtone', 'fly', 'pizza', 'firedrill', 'leave'].every((id) => game.track.log.some((e) => e.type === 'classEvent' && e.id === id))`);

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 10).join('\n') || 'no errors');
  await browser.close();
})();
