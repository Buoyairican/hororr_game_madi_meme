// Fast checks for DEBUG.md and IDEAS.md. Each line it prints is PASS or FAIL for one task (D1, D2 ... F1, F2 ...).
//
//   node tools/check.js            sound + stuck + hud   (about 1 minute)
//   node tools/check.js stuck      only one group: sound | stuck | hud | online | ideas
//   node tools/check.js online     host + friend (needs `npm install` in tests/ once)
//   node tools/check.js ideas      the new features of IDEAS.md (they fail until the feature exists)
//
// It plays the real game in headless Chromium (like tests/), faster than real time, with a fixed
// random seed, so the same code always gives the same result. It starts its own web server.
// Needs: Node, Python 3, Playwright with Chromium (`require('playwright')` must work).
const path = require('path');
const { spawn, execSync } = require('child_process');
const http = require('http');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) {
  try { ({ chromium } = require(path.join(execSync('npm root -g').toString().trim(), 'playwright'))); } catch (e2) { console.error('Playwright not found: `require("playwright")` must work (see tests/README.md).'); process.exit(2); }
}
const ROOT_DIR = path.join(__dirname, '..');
const PORT = Number(process.env.CHECK_PORT || 8765), PEER_PORT = Number(process.env.PEER_PORT || 9000);
const BASE = `http://localhost:${PORT}`;
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required',
  '--disable-features=WebRtcHideLocalIpsWithMdns', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'];
const started = [];
const up = (url) => new Promise((res) => { const r = http.get(url, (x) => { x.resume(); res(true); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });
async function serve(url, cmd, args, opts) {
  if (await up(url)) return true;
  const p = spawn(cmd, args, { stdio: 'ignore', ...opts }); started.push(p);
  for (let i = 0; i < 40; i++) { if (await up(url)) return true; await new Promise((r) => setTimeout(r, 250)); }
  return false;
}
const results = [];
const out = (ok, id, text) => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${text}`); };

// runs in the page before the game: a random generator the checks can re-seed (the same class every time)
const INIT = () => {
  let s = 1;
  window.__seed = (n) => { s = n >>> 0 || 1; };
  Math.random = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
};
async function open(browser, query, vp = { width: 640, height: 360 }, touch = false) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: touch, isMobile: touch });
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || /already running/i.test(m.text())) page.errors.push(m.type() + ': ' + m.text().slice(0, 140)); });
  await page.addInitScript(INIT);
  await page.goto(`${BASE}/index.html?debug=1&${query}`);
  return page;
}
const playing = (page) => page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 180000 });

// ---------------------------------------------------------------- sound: whole classes, everything recorded
async function sound(browser) {
  const page = await open(browser, 'autostart=1&mode=free');
  await playing(page);
  const r = await page.evaluate(() => {
    const g = window.game;
    g.post.render = () => {};
    const strip = (s) => String(s).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    const el = (id) => document.getElementById(id);
    const A = g.audio, play0 = A.play.bind(A);
    const sub0 = g.ui.subtitle.bind(g.ui), hint0 = g.ui.hint.bind(g.ui);
    const T = { snoreMax: 0, snoreAfter: 0, snores: 0, naps: 0, napsCut: [], cut: [], giggleGap: 99, capBad: [], caps: 0, hintBad: [], hints: 0, noEnd: [], errors: [] };
    const CLASSES = [
      [11, ['doze', 'hum'], ['ringtone', 'fly', 'pizza', 'leave'], 'quiet'],
      [12, ['doze', 'laugh'], ['fly', 'firedrill', 'leave', 'pizza'], 'busy'],
      [13, ['doze', 'clock'], ['leave', 'ringtone', 'firedrill', 'fly'], 'quiet'],
      [14, ['deaf', 'count'], ['pizza', 'fly', 'firedrill', 'ringtone'], 'busy'],
      [15, ['doze', 'deaf'], ['ringtone', 'fly', 'pizza', 'leave'], 'busy'],
      [16, ['laugh', 'hum'], ['fly', 'firedrill', 'leave', 'pizza'], 'busy'],
    ];
    for (const [seed, quirks, events, style] of CLASSES) {
      window.__seed(seed);
      const rec = [], caps = [], hints = [];
      A.play = (n, o = {}) => {
        const h = play0(n, o), rate = o.rate ?? 1;
        const e = { n, t0: g.t + (o.delay || 0), len: h ? (o.loop ? 1e9 : h.duration - (o.offset || 0) / rate) : 0, stop: null, bus: o.bus || 'sfx', rate, ok: !!h };
        rec.push(e);
        if (h) { const s0 = h.stop; h.stop = (f = 0.05) => { if (e.stop === null) e.stop = g.t + f; return s0(f); }; }
        return h;
      };
      g.ui.subtitle = (who, text, cls = '', dur = 3) => { caps.push({ who: String(who || ''), text: strip(text), dur: +dur, seen: 0, t: g.t }); return sub0(who, text, cls, dur); };
      g.ui.hint = (text, dur = 5, ...a) => { hints.push({ text: strip(text), dur: +dur, seen: 0, t: g.t, tip: a[0] === true }); return hint0(text, dur, ...a); };
      g.difficulty = 'easy';
      g.start('free', 0, { seed, quirks, events });
      let intent = 'idle', yawT = 0, napOn = -1, wasScare = false, wasEvent = false, choiceT = -1;
      try {
        while (g.state === 'playing' && g.t < 400) {
          // a simple player: quiet (looks around, now and then a whisper) or busy (whispers, phone, echoes, questions, paper)
          if (Math.random() < 0.012) intent = style === 'quiet' ? (Math.random() < 0.9 ? 'look' : 'sam') : ['idle', 'sam', 'nora', 'phone', 'look', 'echo', 'ask', 'prank', 'prank'][(Math.random() * 9) | 0];
          const K = g.input.keys, P = g.input.pressed, safe = !g.watching && !g.near;
          K.talk = K.phone = false; if (intent !== 'prank') K.prank = false;
          if (intent === 'sam') { g.yaw = 1.52; K.talk = safe; }
          else if (intent === 'nora') { g.yaw = -1.52; K.talk = safe; }
          else if (intent === 'phone') { K.phone = safe || !!g.buzz; if (Math.random() < 0.08) P.tap = true; }
          else if (intent === 'look') { if (Math.random() < 0.02) yawT = (Math.random() * 2 - 1) * 2.8; g.yaw += (yawT - g.yaw) * 0.1; g.pitch = Math.sin(g.t) * 0.3; }
          else if (intent === 'echo') { if (Math.random() < 0.05 && g.echoStreak < 2) P.echo = true; }
          else if (intent === 'ask') { if (Math.random() < 0.03 && g.qCount < 3) P.ask = true; }
          else if (intent === 'prank') { if (Math.random() < 0.03) { const d = g.teacher.headWorld().sub(g.camPos); yawT = Math.atan2(-d.x, -d.z); } g.yaw += (yawT - g.yaw) * 0.2; g.pitch = 0.15; K.prank = safe ? (g.t * 1.3) % 2 < 1.4 : false; if (Math.random() < 0.01) P.swap = true; }
          else g.yaw *= 0.97;
          K.breath = !!(g.dreadLeanOn && g.dreadLeanOn(g.me));
          if (K.breath) K.talk = K.phone = K.prank = false;
          if (g.choice) { if (choiceT < 0) choiceT = 1 + Math.random() * 2; choiceT -= 0.05; if (choiceT <= 0) { g.input.choiceKey = (Math.random() * g.choice.labels.length) | 0; choiceT = -1; } } else choiceT = -1;
          if (g.ui.noteOpen && Math.random() < 0.03) g.ui.closeNote();
          g.playTick(0.05); g.ui.update(0.05);
          // captions and hints: how long each one could really be read
          const sEl = el('subtitle'), hEl = el('hint');
          const sTxt = sEl && +getComputedStyle(sEl).opacity > 0.05 ? strip(sEl.textContent) : '';
          const hTxt = hEl && hEl.classList.contains('show') ? strip(hEl.textContent) : '';
          for (let i = caps.length - 1; i >= 0 && g.t - caps[i].t < 14; i--) if (sTxt.includes(caps[i].text)) caps[i].seen += 0.05;
          for (let i = hints.length - 1; i >= 0 && g.t - hints[i].t < 40; i--) if (hTxt.includes(hints[i].text)) hints[i].seen += 0.05;
          // naps that a scare or an event started on top of
          if (g.dozing && napOn < 0) { napOn = g.t; T.naps++; }
          if (!g.dozing && napOn >= 0) { if (g.t - napOn < 4 && ((g.scareBusy && !wasScare) || (g.classEvent && !wasEvent))) T.napsCut.push(`class ${seed} at ${g.t.toFixed(0)}s: a ${(g.t - napOn).toFixed(1)}s nap cut by ${g.scareBusy || (g.classEvent && g.classEvent.id)}`); napOn = -1; }
          wasScare = !!g.scareBusy; wasEvent = !!g.classEvent;
          // his snore: how many at once, and after he woke up
          const live = rec.filter((e) => e.n === 'm_snore' && e.rate < 0.9 && e.ok && e.t0 <= g.t && g.t < Math.min(e.t0 + e.len, e.stop === null ? 1e9 : e.stop));
          if (g.dozing) { T.snoreMax = Math.max(T.snoreMax, live.length); if (live.length) T.snores++; g.__wokeAt = -1; }
          else { if (g.__wokeAt < 0) g.__wokeAt = g.t; if (live.length && g.t - g.__wokeAt > 0.7) T.snoreAfter = Math.max(T.snoreAfter, +(g.t - g.__wokeAt).toFixed(1)); }
        }
      } catch (e) { T.errors.push(`class ${seed}: ${e.message}`); }
      if (g.state === 'playing') T.noEnd.push(`class ${seed} still playing at ${g.t.toFixed(0)}s (ending=${g.ending}, cutscene=${g.cutscene})`);
      // one of his lines cut off by his next line less than a second after it started
      const tl = rec.filter((e) => e.ok && e.bus === 'voice' && Math.abs(e.rate - 1) < 0.2 && /^(t_|a_|q_)/.test(e.n)).sort((a, b) => a.t0 - b.t0);
      for (let i = 1; i < tl.length; i++) { const a = tl[i - 1], b = tl[i]; if (a.n !== b.n && a.len > 1 && b.t0 - a.t0 < Math.min(1.0, a.len * 0.6)) T.cut.push(`class ${seed} at ${b.t0.toFixed(0)}s: ${a.n} cut after ${(b.t0 - a.t0).toFixed(2)}s by ${b.n}`); }
      const gg = rec.filter((e) => e.n === 'giggle' && e.ok).sort((a, b) => a.t0 - b.t0);
      for (let i = 1; i < gg.length; i++) T.giggleGap = Math.min(T.giggleGap, +(gg[i].t0 - gg[i - 1].t0).toFixed(2));
      const endT = g.t;
      for (let i = 0; i < caps.length; i++) { const c = caps[i], need = Math.min(1.2, c.dur); if (endT - c.t < 3) continue; T.caps++;
        if (c.seen >= need - 0.11) continue;
        if (caps.slice(i + 1, i + 6).some((d) => d.who === c.who && d.t - c.t < need)) continue; // (the same speaker went on: that is not a caption lost)
        T.capBad.push(`"${c.text.slice(0, 40)}" ${c.seen.toFixed(1)}s`); }
      // (tips are the how-to and what-is-going-on hints: ui.hint(text, seconds, true). Before that flag existed, every hint counts.)
      const tips = hints.some((h) => h.tip) ? hints.filter((h) => h.tip) : hints;
      for (const h of tips) { if (endT - h.t < 12) continue; T.hints++; if (h.seen < Math.min(2.5, h.dur) - 0.11) T.hintBad.push(`"${h.text.slice(0, 40)}" ${h.seen.toFixed(1)}s`); }
      g.state = 'title'; A.play = play0; A.stopAll(); g.ui.subtitle = sub0; g.ui.hint = hint0;
    }
    return T;
  });
  const eg = (a) => (a.length ? ' e.g. ' + a.slice(0, 3).join(' | ') : '');
  out(!r.noEnd.length && !r.errors.length && !page.errors.length, 'run   ', `6 classes played to the end, no errors${eg([...r.noEnd, ...r.errors, ...page.errors])}`);
  out(r.naps > 0 && r.snores > 0 && r.snoreMax <= 1 && r.snoreAfter === 0, 'D3 snore', `at most 1 snore at a time (found ${r.snoreMax}), none after he wakes (found up to ${r.snoreAfter}s after), ${r.naps} naps`);
  out(r.cut.length <= 1, 'D6 lines', `his lines cut off in under 1 s: ${r.cut.length} (allowed 1)${eg(r.cut)}`);
  out(r.giggleGap >= 1.5, 'D7 giggle', `shortest gap between two giggles: ${r.giggleGap === 99 ? 'none played' : r.giggleGap + 's'} (must be 1.5 s or more)`);
  out(r.capBad.length <= r.caps * 0.02, 'D10 captions', `captions that could not be read (under 1.2 s): ${r.capBad.length} of ${r.caps} (allowed 2 %)${eg(r.capBad)}`);
  out(r.hints >= 20 && r.hintBad.length <= r.hints * 0.04, 'D11 hints', `tips that could not be read (under 2.5 s): ${r.hintBad.length} of ${r.hints} (allowed 4 %)${eg(r.hintBad)}`);
  await page.context().close();
}

// ---------------------------------------------------------------- stuck: one scripted situation each
async function stuck(browser) {
  const page = await open(browser, 'autostart=1&mode=story&ch=3&seed=9');
  await playing(page);
  await page.evaluate(() => { const g = game; g.post.render = () => {}; window.run = (s, f) => { for (let i = 0; i < s * 20; i++) { if (f && f()) return true; if (g.state !== 'playing') return false; g.playTick(0.05); g.ui.update(0.05); } return false; }; });
  // D1: a story beat fires during the last jump scare
  const k1 = await page.evaluate(() => { const g = game; window.__seed(9); g.start('story', 3); run(40);
    let cut = false; const sa = g.audio.stopAll.bind(g.audio); g.audio.stopAll = () => { cut = true; return sa(); };
    g.strikes = g.maxStrikes - 1; g.bust('noise', g.me); run(8, () => cut); run(0.3);
    g.interrupt((function* () { yield* g.saySomething('t_hale'); })()); // what cmd() does when beat()'s wait runs out
    run(12); g.audio.stopAll = sa; return { state: g.state, ending: g.ending, end: !document.getElementById('end').classList.contains('hidden') }; });
  out(k1.state === 'end' && k1.end, 'D1 last strike', `the end screen comes after the last jump scare (state=${k1.state}, end screen=${k1.end})`);
  // D5a: the ambience stays off on the "caught" end screen
  await page.waitForTimeout(3200);
  const amb = await page.evaluate(() => +game.audio.buses.amb.gain.value.toFixed(2));
  out(k1.state === 'end' && amb < 0.05, 'D5 end drone', `ambience level 3 s after the "caught" end screen: ${amb} (must be 0)`);
  // D2: the whoopee cushion with the "hates laughing" teacher
  const k2 = await page.evaluate(() => { const g = game; window.__seed(77); g.difficulty = 'easy'; g.start('free', 0, { seed: 77, quirks: ['laugh', 'hum'], events: [] }); run(104);
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false; g.quirkNext = {}; g.slangNext = 1e9; g.nextDeskGlasses = 1e9; g.dreadAuto = false; g.anger = 0;
    g.cushion = { by: g.me, t: g.t }; g.cushionShown = true; g.nextSit = 0;
    const popped = run(60, () => g.sneakBusy); run(45);
    const r = { popped, sneakBusy: g.sneakBusy, cushionShown: g.cushionShown };
    for (const k of ['updateCalls', 'updateBuzz', 'updateDirector', 'updateFreeShows', 'startMeme']) delete g[k]; g.dreadAuto = true; return r; });
  out(k2.popped && !k2.sneakBusy && !k2.cushionShown && !page.errors.some((e) => /already running/i.test(e)), 'D2 cushion', `after he sits on the cushion the scene cleans up (popped=${k2.popped}, sneakBusy=${k2.sneakBusy}, cushion still there=${k2.cushionShown}${page.errors.some((e) => /already running/i.test(e)) ? ', "Generator is already running"' : ''})`);
  // D4: RESTART while he is speaking
  const k4 = await page.evaluate(() => { const g = game; window.__seed(3); g.start('free', 0, { seed: 3, quirks: ['hum', 'clock'], events: [] });
    run(120, () => g.t > 20 && g.t < (g.voiceUntil || 0) - 1 && g.friends.some((f) => (f.speakUntil || 0) > 5));
    g.start('free', 0, { seed: 3 }); g.playTick(0.05);
    return { talk: +g.teacher.talk.toFixed(2), voiceUntil: +(g.voiceUntil || 0).toFixed(1), friends: Math.max(...g.friends.map((f) => f.speakUntil || 0)) }; });
  out(k4.talk === 0 && k4.voiceUntil < 0.2 && k4.friends < 0.2, 'D4 restart', `after RESTART nobody is "still speaking" (his jaw=${k4.talk}, voiceUntil=${k4.voiceUntil}, friends=${k4.friends.toFixed(1)})`);
  // D5b: the last strike during the fire alarm
  const k5 = await page.evaluate(() => { const g = game; window.__seed(3); g.start('free', 0, { seed: 3, quirks: ['hum', 'clock'], events: ['firedrill'] });
    const late = []; const ap = g.audio.play.bind(g.audio); g.audio.play = (n, o) => { if (g.ending && o && o.loop) late.push(n); return ap(n, o); };
    const got = run(330, () => g.alarmOn); run(1.5); g.strikes = g.maxStrikes - 1; g.bust('noise', g.me); run(12); g.audio.play = ap;
    return { got, late, state: g.state }; });
  out(k5.got && k5.late.length === 0, 'D5 alarm', `no looping sound starts during the last jump scare (${k5.got ? k5.late.join(', ') || 'none' : 'the alarm never started: check the test'})`);
  // D8: he is asleep and the scare director is due
  const k8 = await page.evaluate(() => { const g = game; window.__seed(21); g.start('free', 0, { seed: 21, quirks: ['doze', 'hum'], events: [] }); run(42);
    g.updateCalls = g.updateBuzz = () => {}; g.startMeme = () => false; g.dreadAuto = false; g.nextScare = 1e9; g.quirkNext.doze = g.t;
    const slept = run(60, () => g.dozing);
    let scare = '';
    for (let i = 0; i < 5 && g.dozing && !scare; i++) { g.nextScare = 0; if (run(1.2, () => !!g.scareBusy)) scare = String(g.scareBusy); } // (the director picks 5 times in 6 s; a nap lasts 9 s or more)
    const r = { slept, dozing: g.dozing, scare }; for (const k of ['updateCalls', 'updateBuzz', 'startMeme']) delete g[k]; g.dreadAuto = true; return r; });
  out(k8.slept && !k8.scare, 'D8 nap', `no jump scare starts on top of his nap (${k8.scare ? 'a scare started: ' + k8.scare : 'none started'}${k8.slept ? '' : ', he never fell asleep: check the test'})`);
  // D4 / D9: he is not left upside down; a note opens while E is held
  const k6 = await page.evaluate(() => { const g = game; g.teacher.root.rotation.z = Math.PI; window.__seed(5); g.start('free', 0, { seed: 5, events: [] }); const rot = +g.teacher.root.rotation.z.toFixed(2);
    run(12); g.input.keys.talk = true; g.giveNote('test', 'sam'); run(0.2); const note = g.ui.noteOpen; g.input.keys.talk = false; g.ui.closeNote(); return { rot, note }; });
  out(k6.rot === 0, 'D4 upside down', `a new class starts with him the right way up (rotation ${k6.rot})`);
  out(k6.note, 'D9 note', `a note that arrives while E is held stays open (open=${k6.note})`);
  await page.context().close();
}

// ---------------------------------------------------------------- hud: what covers what
async function hud(browser) {
  const bad = { H1: [], H2: [], H3: [], H5: [], Q: [] };
  for (const [name, w, h, touch] of [['1024x576', 1024, 576, false], ['844x390', 844, 390, true], ['667x375', 667, 375, true]]) {
    const page = await open(browser, 'autostart=1&mode=free&seed=7', { width: w, height: h }, touch);
    await playing(page);
    for (const sc of ['whisper', 'lean']) {
      await page.evaluate(() => { const g = game; if (!window.__frozen) { g.post.render = () => {}; for (let i = 0; i < 40; i++) { g.playTick(0.05); g.ui.update(0.05); } window.__frozen = true; g.playTick = () => {}; g.tick = () => {}; }
        g.ui.clearTransient(); g.ui.closeChoices(); g.ui.breath(null); g.ui.echoCue(-1, g.input.touch); g.ui.aim(null); });
      await page.waitForTimeout(800);
      await page.evaluate((sc) => { const g = game, ui = g.ui, t = g.input.touch;
        ui.setObjectives([{ text: 'Whisper to Sam or Nora without getting caught', done: true }, { text: 'Repeat something he says', done: false }, { text: 'Hit his back with a paper ball', done: false }, { text: 'Stick a KICK ME note on his back', done: false }]);
        ui.setQuirks(['😴 dozes off', '🎵 hums while he writes']); ui.setLaugh(64); ui.setStrikes(2, 4); ui.setBully(2, 3); ui.setEye('open'); ui.meterOn = true; ui.setAnger(70);
        ui.toast('BO GOT CAUGHT<br>STRIKE 2 / 4', 3);
        if (sc === 'whisper') { ui.echoCue(0.7, t); ui.phoneAlert(true); ui.prompt(t ? 'hold TALK · whisper to Sam' : 'hold [E] · whisper to Sam'); ui.hint('He hums while he writes, so he hears you less. When the humming stops, he is listening.', 6); ui.subtitle('', 'This is your... last... warning.', 'teacher', 4); }
        else { ui.breath(0.4, 'hold', 'HOLD <b>B</b>: hold your breath'); ui.hint('He is listening. Hold <b>B</b> to hold your breath and keep the mouse still until he straightens up.', 6); ui.subtitle('Nora', "Don't breathe. Don't move. He's right there.", '', 4); }
      }, sc);
      await page.waitForTimeout(800);
      const pairs = await page.evaluate(() => {
        const box = (id) => { const el = document.getElementById(id); if (!el) return null; const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2 || !el.innerText.trim() && !el.children.length) return null;
          for (let p = el; p; p = p.parentElement) { const c = getComputedStyle(p); if (c.display === 'none' || c.visibility === 'hidden' || +c.opacity < 0.3) return null; } return r; };
        const hit = (a, b) => { const A = box(a), B = box(b); if (!A || !B) return false; return Math.min(A.right, B.right) - Math.max(A.left, B.left) > 4 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 4; };
        const o = [];
        for (const b of ['strikes', 'bully', 'eye-label']) if (hit('hint', b)) o.push(['H1', 'hint over ' + b]);
        for (const b of ['prompt', 'echo-cue']) if (hit('phone-alert', b)) o.push(['H2', 'phone alert over ' + b]);
        if (hit('toast', 'objectives')) o.push(['H3', 'toast over the task list']);
        for (const b of ['btn-ask', 'btn-phone', 'btn-seat', 'btn-prank', 'btn-echo', 'btn-talk', 'btn-breath', 'joy']) if (hit('subtitle', b)) o.push(['H5', 'caption over ' + b]);
        if (box('quirks')) o.push(['Q', 'the TODAY HE list is still shown']);
        return o; });
      for (const [k, what] of pairs) bad[k].push(`${what} at ${name}`);
    }
    await page.context().close();
  }
  const say = (k) => (bad[k].length ? [...new Set(bad[k])].slice(0, 4).join(' | ') : 'none');
  out(!bad.H1.length, 'D12 hint', `the hint does not cover the strikes or the counters under his eye: ${say('H1')}`);
  out(!bad.H2.length, 'D12 phone alert', `"your phone is buzzing" does not cover the prompt or the repeat cue: ${say('H2')}`);
  out(!bad.H3.length, 'D12 toast', `a toast does not cover the task list: ${say('H3')}`);
  out(!bad.H5.length, 'D12 captions', `captions do not cover the touch buttons: ${say('H5')}`);
  out(!bad.Q.length, 'D13 today he', `the "TODAY HE" list is gone: ${say('Q')}`);
}

// ---------------------------------------------------------------- online: what a friend's screen is told
async function online(browser) {
  if (!(await serve(`http://127.0.0.1:${PEER_PORT}/`, 'node', ['peer-server.cjs'], { cwd: path.join(ROOT_DIR, 'tests'), env: { ...process.env, PEER_PORT: String(PEER_PORT) } }))) { out(false, 'online', 'no PeerJS server: run `npm install` in tests/ first'); return; }
  const q = `peer=127.0.0.1:${PEER_PORT}`;
  const H = await open(browser, q, { width: 640, height: 360 });
  await H.waitForFunction(() => window.game && !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 180000 });
  await H.click('#btn-mp'); await H.fill('#mp-name', 'Alex'); await H.click('#btn-host');
  await H.waitForFunction(() => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent), null, { timeout: 30000 });
  const code = await H.evaluate(() => document.getElementById('mp-code-show').textContent);
  const G = await open(browser, `${q}&join=${code}`, { width: 640, height: 360 });
  await G.waitForFunction(() => window.game && !document.getElementById('mp').classList.contains('hidden'), null, { timeout: 180000 });
  await G.fill('#mp-name', 'Bo'); await G.click('#btn-join');
  await H.waitForFunction(() => document.querySelectorAll('#mp-players li:not(.empty)').length === 2, null, { timeout: 30000 });
  await G.evaluate(() => { const g = game; g.post.render = () => {}; window.told = [];
    for (const fn of ['hint', 'status', 'toast', 'subtitle']) { if (typeof g.ui[fn] !== 'function') continue; const f = g.ui[fn].bind(g.ui); g.ui[fn] = (...a) => { told.push(fn + ': ' + String(fn === 'subtitle' ? a[0] + ' ' + a[1] : a[0]).replace(/<[^>]+>/g, '')); return f(...a); }; } });
  await H.evaluate(() => { game.post.render = () => {}; });
  await H.click('#btn-mp-go');
  await playing(G);
  // the host alone on his own screen: a wrong key, a note from Sam, caught and sent to the corner as a ghost
  await H.evaluate(() => { const g = game; const run = (s) => { for (let i = 0; i < s * 20 && g.state === 'playing'; i++) g.tick(0.05); };
    run(14); g.updateDirector = g.updateCalls = g.updateBuzz = () => {}; g.dreadAuto = false;
    g.echoable = null; g.allowEcho = true; g.input.pressed.echo = true; run(0.5);
    g.giveNote('a note for the host only', 'sam'); run(1); g.ui.closeNote();
    g.strikes = 0; g.bust('noise', g.me); run(22); });
  await G.waitForTimeout(2500);
  const r = await G.evaluate(() => ({ told: window.told, note: game.ui.noteOpen, state: game.state }));
  const has = (re) => r.told.filter((x) => re.test(x));
  out(r.state === 'playing' && has(/GOT CAUGHT/).length > 0, 'online run', `the friend is in the class and saw the host get caught (${r.state}, ${r.told.length} messages)`);
  out(!has(/You are a ghost/i).length, 'D14 ghost hint', `the friend is not told "You are a ghost" when the host is: ${has(/You are a ghost/i).length ? 'told' : 'not told'}`);
  out(!has(/Repeat him right after/i).length, 'D14 key hint', `the friend does not get the host's "Repeat him right after…": ${has(/Repeat him right after/i).length ? 'got it' : 'not sent'}`);
  out(!r.note && !has(/a note for the host only/).length, 'D14 note', `Sam's note to the host does not open on the friend's screen (open=${r.note})`);
  await H.context().close(); await G.context().close();
}

// ---------------------------------------------------------------- ideas: the new features (IDEAS.md), on one screen
// These were written before the features existed. If one fails because the CHECK is wrong, fix the check.
async function ideas(browser) {
  const page = await open(browser, 'autostart=1&mode=free&seed=5');
  await playing(page);
  await page.evaluate(async () => { const g = game; g.post.render = () => {}; window.DATA = await import('/src/data.js');
    window.run = (s, f) => { for (let i = 0; i < s * 20; i++) { if (f && f()) return true; if (g.state !== 'playing') return false; g.playTick(0.05); g.ui.update(0.05); } return false; };
    window.fresh = (seed) => { window.__seed(seed); g.difficulty = 'easy'; g.start('free', 0, { seed, quirks: [], events: [] }); run(14);
      g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false; g.dreadAuto = false; g.stuckNext = 1e9; g.anger = 0; };
    window.wrote = []; const B = g.world.board; for (const fn of ['write', 'writeInstant']) { const f = B[fn].bind(B); B[fn] = (t, ...a) => { wrote.push(String(t)); return f(t, ...a); }; } });
  const safe = async (id, text, fn) => { let r; try { r = await page.evaluate(fn); } catch (e) { r = { ok: false, why: String(e.message).split('\n')[0].slice(0, 120) }; } out(!!r.ok, id, text + (r.why ? ': ' + r.why : '')); };
  // F1: the belly pat
  await safe('F1 belly pat', 'he pats his stomach (pose "belly", soft pats) and stops', () => { const g = game; fresh(31);
    let pats = 0; const ap = g.audio.play.bind(g.audio); g.audio.play = (n, o) => { if (n === 'bl_paw') pats++; return ap(n, o); };
    g.interrupt(g.bellyPat(3)); run(1.6); const pose = g.teacher.pose, mid = pats; run(5); g.audio.play = ap;
    return { ok: pose === 'belly' && mid >= 3 && g.teacher.pose !== 'belly', why: `pose=${pose}, pats in 1.6 s=${mid}, pose afterwards=${g.teacher.pose}` }; });
  // F2: stuck on a question
  await safe('F2 stuck: right', 'he writes a question, a right answer gives trust', () => { const g = game, item = DATA.STUCK.list[0]; fresh(32); wrote.length = 0;
    g.interrupt(g.actStuck(item)); const stuck = run(40, () => g.stuck && wrote.some((t) => t.includes(item.q)));
    if (stuck) { g.answerStuck(g.me, 'right'); run(25, () => !g.stuck); }
    return { ok: stuck && !g.stuck && g.me.trust === 1 && wrote.some((t) => t.includes(item.right)), why: `question on the board=${stuck}, trust=${g.me.trust}, still stuck=${!!g.stuck}` }; });
  await safe('F2 stuck: wrong', 'a wrong answer goes on the board, and later he looks it up', () => { const g = game, item = DATA.STUCK.list[1]; fresh(33); wrote.length = 0;
    g.interrupt(g.actStuck(item)); const stuck = run(40, () => g.stuck && wrote.some((t) => t.includes(item.q)));
    if (stuck) { g.answerStuck(g.me, 'wrong'); run(25, () => !g.stuck); }
    const onBoard = wrote.some((t) => t.includes(item.wrong)); const looked = run(90, () => g.typing);
    return { ok: stuck && onBoard && looked && !g.me.trust, why: `wrong answer on the board=${onBoard}, he looked it up=${looked}, trust=${g.me.trust}` }; });
  await safe('F2 stuck: nobody', 'when nobody helps he looks it up himself', () => { const g = game, item = DATA.STUCK.list[2]; fresh(34); wrote.length = 0;
    g.interrupt(g.actStuck(item)); const looked = run(60, () => g.typing); run(30, () => !g.stuck);
    return { ok: looked && !g.stuck, why: `he looked it up=${looked}, still stuck=${!!g.stuck}` }; });
  // F4: the new scares, with a player who never looks (each one must come anyway, end, and put everything back)
  for (const id of ['shoulder', 'underdesk', 'note', 'stare']) {
    let r;
    try {
      r = await page.evaluate((id) => { const g = game, T = g.teacher; fresh(40 + id.length); g.yaw = 0.4; g.pitch = 0;
        g.interrupt(g.scareScene(id)); const started = run(3, () => g.scareBusy === id); const ended = started && run(60, () => !g.scareBusy); run(4);
        const back = T.root.visible && T.root.position.y === 0 && T.root.rotation.z === 0 && g.blackout < 0.2 && g.world.master > 0.9 && !g.eventLock && g.strikes === 0;
        return { ok: started && ended && back, why: `started=${started}, ended=${ended}, everything back=${back}` }; }, id);
    } catch (e) { r = { ok: false, why: String(e.message).split('\n')[0].slice(0, 120) }; }
    out(!!r.ok, 'F4 ' + id, `the "${id}" scare plays, ends, and puts everything back: ${r.why}`);
  }
  out(!page.errors.length, 'F  errors', `no errors in the page${page.errors.length ? ': ' + page.errors.slice(0, 2).join(' | ') : ''}`);
  await page.context().close();
}

(async () => {
  const want = process.argv.slice(2).filter((x) => ['sound', 'stuck', 'hud', 'online', 'ideas'].includes(x));
  const groups = want.length ? want : process.argv[2] === 'all' ? ['sound', 'stuck', 'hud', 'online', 'ideas'] : ['sound', 'stuck', 'hud'];
  if (!(await serve(`${BASE}/index.html`, 'python3', ['tests/serve.py', String(PORT)], { cwd: ROOT_DIR }))) { console.error('could not start the web server (python3 tests/serve.py)'); process.exit(2); }
  const browser = await chromium.launch({ args: GL });
  const run = { sound, stuck, hud, online, ideas };
  for (const g of groups) { try { await run[g](browser); } catch (e) { out(false, g, 'the check itself failed: ' + String(e.message).split('\n')[0]); } }
  await browser.close();
  for (const p of started) p.kill();
  const bad = results.filter((x) => !x).length;
  console.log(`\n${results.length - bad} passed, ${bad} failed`);
  process.exit(bad ? 1 : 0);
})();
