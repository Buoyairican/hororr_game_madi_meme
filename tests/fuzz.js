// Random-input chaos test: node fuzz.js <rounds>
const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('./lib');
(async () => {
  const rounds = +(process.argv[2] || 1);
  const lazy = process.argv[3] === 'lazy';
  const hard = process.argv.includes('hard');
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  const logs = [];
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message + ' | ' + (e.stack || '').split('\n').slice(1, 4).join(' ')));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  const runs = [], ok = [], bad = [];
  for (let r = 0; r < rounds; r++) for (const x of [['story', 0], ['story', 1], ['story', 2], ['story', 3], ['free', 0]]) runs.push(x);
  for (const [mode, ch] of runs) {
    const res = await page.evaluate(([mode, ch, lazy, hard]) => {
      const g = game, issues = [], seen = new Set();
      const issue = (k, msg) => { if (seen.has(k)) return; seen.add(k); issues.push(`t=${g.t.toFixed(1)} ${msg}`); };
      g.difficulty = hard ? 'hard' : 'easy';
      g.start(mode, ch);
      const ROWS = [-2.05, -0.35, 1.35, 3.05], COLS = [-3.0, -1.5, 0, 1.5, 3.0];
      let reckless = false, intent = 'idle', yawT = 0, choiceDelay = -1, noteT = 0;
      let cutT = 0, memeT = 0, lockT = 0, choiceT = 0, blackT = 0, blameT = 0, catT = 0, lastSub = '', subs = [], memes = 0, wasMeme = false;
      let sneakT = 0, sitT = 0, huntT = 0, outT = 0, moveT = 0, leanT = 0, creepT = 0;
      const maxT = 1100;
      while (g.state === 'playing' && g.t < maxT) {
        // ---- random player
        if (lazy) { if (Math.random() < 0.006) intent = Math.random() < 0.85 ? (Math.random() < 0.5 ? 'idle' : 'look') : ['sam', 'nora', 'phone'][(Math.random() * 3) | 0]; if (g.memeBusy && g.canEcho() && Math.random() < 0.004) g.input.pressed.echo = true; }
        else if (Math.random() < 0.012) intent = ['idle', 'idle', 'idle', 'sam', 'nora', 'phone', 'phone', 'look', 'look', 'echo', 'ask', 'show', 'prank', 'sneak'][(Math.random() * 14) | 0];
        // Phase 4: off the chair, crawl about, use what is at his desk, back to the chair (C at the desk)
        const mk = g.input.moveKeys;
        if (intent === 'sneak' && g.allowSneak) {
          if (!g.me.out && g.me.slipK === 0 && Math.random() < 0.05) g.input.pressed.seat = true;
          if (g.me.out) {
            outT += 0.05;
            if ((moveT -= 0.05) <= 0) { moveT = 0.5 + Math.random() * 2; mk.f = Math.random() < 0.7; mk.b = !mk.f && Math.random() < 0.3; mk.l = Math.random() < 0.25; mk.r = !mk.l && Math.random() < 0.25; yawT = (Math.random() * 2 - 1) * 3.1; }
            g.yaw += (yawT - g.yaw) * 0.08;
            if (g.deskNear(g.me)) g.input.keys.talk = Math.random() < 0.97;
            if (outT > 25 || Math.random() < 0.002) { // head home: put back next to the chair, then C
              g.me.pos.set(g.me.desk.x + 0.75, 0, g.me.desk.z + 0.55); g.input.pressed.seat = true; outT = 0;
            }
          }
        } else {
          mk.f = mk.b = mk.l = mk.r = false;
          if (g.me.out && !g.me.carried) { g.me.pos.set(g.me.desk.x + 0.75, 0, g.me.desk.z + 0.55); g.input.pressed.seat = true; }
        }
        if (g.shows.some((s) => !s.over) && Math.random() < 0.02) intent = 'show';
        if (g.vidJob && Math.random() < 0.02) intent = 'phone';
        if (intent !== 'sneak') g.input.keys.talk = false;
        g.input.keys.phone = false; if (intent !== 'prank') g.input.keys.prank = false;
        const safe = (!g.watching && !g.near) || reckless;
        if (Math.random() < 0.004) reckless = Math.random() < 0.15;
        if (intent === 'sam') { g.yaw = 1.52; g.input.keys.talk = safe && Math.random() < 0.97; }
        else if (intent === 'nora') { g.yaw = -1.52; g.input.keys.talk = safe && Math.random() < 0.97; }
        else if (intent === 'phone') {
          g.input.keys.phone = (safe || !!g.buzz || g.vidJob) && Math.random() < 0.98;
          if (Math.random() < 0.08) g.input.pressed.tap = true;          // fly / next video
          if (Math.random() < 0.012) g.input.pressed.ask = true;         // switch app
          if (Math.random() < 0.006) g.input.pressed.echo = true;        // show a friend
        }
        else if (intent === 'show') { const sh = g.shows.find((s) => !s.over && s.held); if (sh && (safe || reckless)) { const d = sh.held.group.getWorldPosition(g.camPos.clone()).sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); } else intent = 'idle'; }
        else if (intent === 'look') { if (Math.random() < 0.02) yawT = (Math.random() * 2 - 1) * 2.8; g.yaw += (yawT - g.yaw) * 0.1; g.pitch = Math.sin(g.t) * 0.3; }
        else if (intent === 'echo') { if (Math.random() < 0.05 && (g.echoStreak < 2 || reckless)) g.input.pressed.echo = true; }
        else if (intent === 'ask') { if (Math.random() < 0.03 && (g.qCount < 3 || reckless)) g.input.pressed.ask = true; }
        else if (intent === 'prank') {
          // aim somewhere (often at him), hold, let go; switch ball / plane / laser / KICK ME now and then
          if (Math.random() < 0.03) { const T = g.teacher, d = T.headWorld().sub(g.camPos); yawT = Math.random() < 0.6 ? Math.atan2(-d.x, -d.z) : (Math.random() * 2 - 1) * 2.8; }
          g.yaw += (yawT - g.yaw) * 0.2; g.pitch = 0.15 + Math.sin(g.t * 0.7) * 0.2;
          g.input.keys.prank = (safe || reckless) ? (g.t * 1.3) % 2 < 1.4 : false;
          if (Math.random() < 0.01) g.input.pressed.swap = true;
          if (Math.random() < 0.004) g.input.pressed.drop = true;
        }
        else { g.yaw *= 0.97; }
        if (g.buzz && Math.random() < 0.01) g.input.keys.phone = true;
        // Phase 5: he leans over your desk: usually hold your breath and keep still (now and then not)
        const lean = g.dreadLeanOn && g.dreadLeanOn(g.me);
        if (lean) { if (!reckless) { g.input.keys.talk = g.input.keys.phone = g.input.keys.prank = false; } g.input.keys.breath = !reckless || Math.random() < 0.5; }
        else g.input.keys.breath = Math.random() < 0.002 ? true : g.input.keys.breath && Math.random() < 0.97;
        if (g.choice) {
          if (choiceDelay < 0) choiceDelay = Math.random() < 0.15 ? 99 : Math.random() * 6;
          choiceDelay -= 0.05;
          if (choiceDelay <= 0) { g.input.choiceKey = (Math.random() * g.choice.labels.length) | 0; choiceDelay = -1; }
        } else choiceDelay = -1;
        if (g.ui.noteOpen) { noteT += 0.05; if (noteT > 1 + Math.random() * 4) { g.ui.closeNote(); noteT = 0; } } else noteT = 0;
        // ---- tick
        try { g.playTick(0.05); g.ui.update(0.05); } catch (e) { issues.push('EXCEPTION ' + e.message + ' ' + (e.stack || '').split('\n').slice(1, 3).join(' ')); break; }
        const sub = document.getElementById('subtitle').innerText.replace(/\n/g, ' ');
        if (sub && sub !== lastSub) { lastSub = sub; subs.push(g.t.toFixed(0) + ' ' + sub.slice(0, 50)); if (subs.length > 8) subs.shift(); }
        if (g.memeBusy && !wasMeme) memes++; wasMeme = g.memeBusy;
        // ---- invariants
        const T = g.teacher, p = T.pos;
        if (!isFinite(p.x) || !isFinite(p.z) || !isFinite(g.anger)) { issue('nan', 'NaN teacher position/anger'); break; }
        if (g.present && T.root.visible && !g.ending) {
          // (the window scare puts him outside the glass on purpose: src/scares.js)
          if (g.scareBusy !== 'window' && !(p.x > 3.5 && Math.abs(p.z + 5) < 0.6) && (p.x < -5.05 || p.x > 5.2) || p.z < -7.05 || p.z > 6.05) issue('room' + Math.round(p.x) + Math.round(p.z), `teacher outside room at ${p.x.toFixed(2)},${p.z.toFixed(2)} | ${subs.slice(-2).join(' / ')}`);
          if (T.root.position.y === 0) for (const z of ROWS) for (const x of COLS) {
            if (Math.abs(p.x - x) < 0.42 && Math.abs(p.z - z) < 0.33) issue('desk' + x + z, `teacher inside desk (${x},${z}) at ${p.x.toFixed(2)},${p.z.toFixed(2)} | last: ${subs.slice(-2).join(' / ')}`);
          }
        }
        cutT = g.cutscene && !g.ending ? cutT + 0.05 : 0; if (cutT > 90) issue('cut', 'cutscene stuck > 90 s');
        memeT = g.memeBusy ? memeT + 0.05 : 0; if (memeT > 120) issue('meme', 'memeBusy stuck > 120 s');
        lockT = g.eventLock ? lockT + 0.05 : 0; if (lockT > 40) issue('lock', 'eventLock stuck > 40 s');
        choiceT = g.choice ? choiceT + 0.05 : 0; if (choiceT > 20) issue('choice', 'choice open > 20 s');
        blackT = g.blackout > 0.9 && !g.ending ? blackT + 0.05 : 0; if (blackT > 12) issue('black', 'screen black > 12 s');
        for (const s of g.students) if (s.hollow && !s.taken && !g.cutscene && !g.eventLock && !g.fx.length && g.phase < 3) issue('hollow' + s.name, s.name + ' hollow eyes with no reason');
        if (T.glassesHeld && !g.blind && !g.cutscene && g.brainIdle) issue('glasses', 'glasses still in his hand');
        if (T.glasses.parent !== T.head && !T.glassesHeld && !g.blind && !g.ending && g.brainIdle && g.glassesAt === 'face') issue('glassesFloor', 'glasses left on the floor');
        if (g.blind && g.brainIdle && !T.glassesHeld && T.glasses.parent === T.head) issue('blind', 'blind with his glasses on');
        if (g.papers.length > 16) issue('papers', 'too many papers: ' + g.papers.length);
        if (g.laugh < 0 || g.laugh > 100 || !isFinite(g.mischief)) issue('laugh', 'laugh/mischief out of range');
        // Phase 3: the red dot, the KICK ME note, "Who did it?"
        blameT = g.blameBusy ? blameT + 0.05 : 0; if (blameT > 60) issue('blame', 'blameBusy stuck > 60 s');
        catT = g.cat ? catT + 0.05 : 0; if (catT > 45) issue('cat', 'he chased the dot > 45 s');
        if (g.handNote.visible && g.brainIdle) issue('handnote', 'the KICK ME note left in his hand');
        if (g.me.laserOn && !g.me.aiming) issue('laser', 'laser on with nothing held up');
        if (g.me.notesLeft < 0) issue('notes', 'notes left < 0');
        // Phase 4: off your chair, his desk
        const me = g.me;
        if (me.out && !me.carried && me.slipK >= 1 && !g.onFloor(me.pos.x, me.pos.z)) issue('floor', `crawled off the floor to ${me.pos.x.toFixed(2)},${me.pos.z.toFixed(2)}`);
        if (!(me.slipK >= 0 && me.slipK <= 1) || !isFinite(me.pos.x) || !isFinite(me.pos.z)) issue('slip', 'slip / position out of range');
        if (me.carried && !g.cutscene) issue('carried', 'carried outside the caught scene');
        if (g.ending && (me.out || me.slipK > 0)) issue('endout', 'still off the chair at the bell');
        if (g.glassesAt === 'gone' && T.glasses.visible) issue('glassesSeen', 'stolen glasses still visible');
        if (g.glassesAt === 'face' && g.halfBlind) issue('halfBlind', 'half blind with his glasses on');
        sneakT = g.sneakBusy ? sneakT + 0.05 : 0; if (sneakT > 60) issue('sneakBusy', 'sneakBusy stuck > 60 s');
        sitT = g.sitting ? sitT + 0.05 : 0; if (sitT > 30) issue('sit', 'sitting > 30 s');
        huntT = g.glassesHunt ? huntT + 0.05 : 0; if (huntT > 60) issue('hunt', 'hunting his glasses > 60 s');
        // Phase 5: real dread
        const D = g.dread;
        if (!(me.breath >= 0 && me.breath <= 1)) issue('breath', 'breath out of range: ' + me.breath);
        leanT = D && D.lean ? leanT + 0.05 : 0; if (leanT > 45) issue('lean', 'he leaned over a desk > 45 s');
        creepT = D && D.creep ? creepT + 0.05 : 0; if (creepT > 45) issue('creep', 'creeping > 45 s');
        if (g.dreadSilent && !(D && D.creep)) issue('silent', 'no footsteps without a creep');
        if (D && D.lean && (D.lean.p.out || D.lean.p.slipK > 0) && D.lean.phase === 'hold') issue('leanout', 'listening at an empty chair');
      }
      if (g.state === 'playing') issue('nofinish', `did not finish by ${maxT}s: clock=${document.getElementById('clock-hud').innerText} script=${!!g.script} brainIdle=${g.brainIdle} cut=${g.cutscene} memeBusy=${g.memeBusy} objs=${g.objectives.map((o) => o.id + (o.done ? '+' : '-')).join(' ')}`);
      const out = { mode, ch, t: +g.t.toFixed(0), end: document.getElementById('end-title').innerText, strikes: g.strikes, memes, throws: g.stats.throws, hitHim: g.stats.hitHim, sneaks: g.stats.sneaks, deskThings: g.stats.glasses + g.stats.secrets + g.stats.clocks + g.stats.cushions,
        dread: { changes: g.dread ? g.dread.changes : 0, leans: g.track.of(g.me).dread_lean, creeps: g.track.of(g.me).dread_creep }, caughtFor: g.track.of(g.me).caughtFor, issues };
      g.input.keys.talk = g.input.keys.phone = g.input.keys.prank = g.input.keys.breath = false;
      g.input.stopMove();
      if (g.state === 'end' || g.state === 'playing') { g.state = 'title'; g.audio.stopAll(); }
      return out;
    }, [mode, ch, lazy, hard]);
    console.log(JSON.stringify(res));
    (res.issues.length ? bad : ok).push(`${mode} ${ch}: ${res.end || 'no end'} at ${res.t}s${res.issues.length ? ' | ' + res.issues.slice(0, 3).join('; ') : ''}`);
  }
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 15).join('\n') || 'no console errors');
  await browser.close();
})();
