// Phase 6, reasons to replay (solo): the report card on every end screen (win and loss, Free Class and
// story, Easy and Hard), the grading table tolerating counters that do not exist, unlocks (earned, kept
// in the browser, shown, used), the three unlocked pranks (spitball, rubber band, water balloon), the
// third phone app (PSST!) and the phone themes, Mr. Hale's 12 hidden notes and the notebook screen (menu
// and pause menu), the daily class (one seed from the UTC date, a best score per day), and a browser
// that will not keep anything (the safe fallback).
//   node replay.js
const { chromium, ROOT, GL, shot } = require('./lib');

(async () => {
  const browser = await chromium.launch({ args: GL });
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => { (c ? ok : bad).push(n); console.log(' ', c ? 'ok ' : 'BAD', n); };
  const watch = (page, tag) => {
    page.on('pageerror', (e) => logs.push(`${tag} PAGEERROR ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    page.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
  };
  /** a fresh page in a class (autostart); profile: what the browser already keeps */
  const run = async (url, fn, { profile = null, setup = null, keep = false, view = { width: 400, height: 225 } } = {}) => {
    const page = await browser.newPage({ viewport: view });
    watch(page, url);
    if (profile) await page.addInitScript((p) => { try { if (!localStorage.getItem('madiclass.replay')) localStorage.setItem('madiclass.replay', JSON.stringify(p)); } catch (e) { /* blocked */ } }, profile);
    if (setup) await setup(page);
    await page.goto(ROOT + '/index.html?debug=1&autostart=1&' + url);
    await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 180000 });
    await page.evaluate(() => { game.post.render = () => {}; });
    let r;
    try { r = await page.evaluate(fn); } catch (e) { r = { error: e.message.slice(0, 300) }; }
    if (keep) return [r, page];
    await page.close();
    return r;
  };
  // helpers inside every check: g, step, until, blind (he sees nobody), aimAt, said (voice ids since `mark`), prof (the stored profile)
  const H = `
    const g = game, V = g.camPos.constructor;
    const step = (n, each) => { for (let i = 0; i < n && g.state === 'playing'; i++) { if (each) each(); g.playTick(0.05); g.ui.update(0.05); } };
    const until = (fn, max, each) => { let n = 0; while (!fn() && n < max / 0.05 && g.state === 'playing') { if (each) each(); g.playTick(0.05); g.ui.update(0.05); n++; } return !!fn(); };
    const uw = g.updateWatching.bind(g);
    g.updateWatching = function () { uw(); if (g.blindTest) for (const p of g.players) { p.watching = false; p.lookDot = -1; } };
    const blind = (on) => { g.blindTest = on; };
    const aimAt = (pt) => { const d = pt.clone().sub(g.camPos); g.yaw = Math.atan2(-d.x, -d.z); g.pitch = Math.atan2(d.y, Math.hypot(d.x, d.z)); };
    const heard = [];
    const play0 = g.audio.play.bind(g.audio);
    g.audio.play = (name, o) => { heard.push(name); return play0(name, o); };
    const prof = () => JSON.parse(localStorage.getItem('madiclass.replay') || '{}');
    const quiet = () => { g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false; };
    const atBoard = () => { const T = g.teacher; g.interrupt((function* () { T.place(0.3, -6.2, Math.PI); T.lookAt(null); T.setPose('rest'); for (;;) yield; })()); g.prankBusy = false; g.anger = 0; };
    const card = () => { const c = g.lastCard; return c && { grade: c.grade, score: c.score, hard: c.hard, win: c.win, kind: c.kind, subs: Object.fromEntries(c.subjects.map((s) => [s.name, s.grade])), n: c.subjects.length }; };
    const endText = () => document.getElementById('end-report').innerText;
  `;
  let r;

  // ---------------------------------------------------------------- 1. the grading table, the daily numbers (pure)
  r = await run('mode=free', new Function(H + `
    return (async () => {
      const R = await import('/src/replay.js'), D = await import('/src/data.js'), U = await import('/src/util.js');
      const empty = R.makeCard({});
      const odd = R.makeCard({ blames: 4, crawled: 99, breathHolds: 2, notAThing: 'x', whispers: 2 });
      // a row for a counter nobody counts yet: worth nothing until it exists, then graded like any other
      D.REPORT.rows.push(['Behaviour', 'blames', 10, 40, 'Blamed {n} classmates.']);
      const before = R.makeCard({ whispers: 2 }), after = R.makeCard({ whispers: 2, blames: 3 });
      D.REPORT.rows.pop();
      const good = R.makeCard({ whispers: 6, talk: 40, echoes: 4, questions: 4, videos: 4, hitHim: 3, hits: 5, throws: 7, survived: 1, minutes: 5 });
      const hard = R.makeCard({ whispers: 6, echoes: 4, questions: 2, survived: 1, minutes: 5 }, { hard: true }), easy = R.makeCard({ whispers: 6, echoes: 4, questions: 2, survived: 1, minutes: 5 });
      const a = R.dailyInfo('2026-11-14'), a2 = R.dailyInfo('2026-11-14'), days = [];
      for (let d = 1; d <= 28; d++) days.push(R.dailyInfo('2026-02-' + String(d).padStart(2, '0')));
      const sp = D.DAILY.specials.find((x) => x.id === a.special);
      const base = R.dailyScore({ survived: 1 }, a), plus = R.dailyScore({ survived: 1, [sp.keys[0]]: 1 }, a);
      const pts = D.DAILY.score.find((x) => x[0] === sp.keys[0])[1] * (a.difficulty === 'hard' ? D.DAILY.hardBonus : 1);
      // Phases 3-5 on the card: blame, sneaking, his desk, the dread
      const ph = R.makeCard({ blamed: 2, lies: 1, glasses: 1, sneaks: 2, sneakTime: 30, secrets: 2, clocks: 1, paws: 1, breath_hold: 2, dread_spotted: 1 });
      const sub = (c, n) => c.subjects.find((s) => s.name === n);
      const phases = { beh: sub(ph, 'Behaviour'), gym: sub(ph, 'Gym'), drama: sub(ph, 'Drama'), sci: sub(ph, 'Science'), media: sub(ph, 'Media Studies'), n: ph.subjects.length, honest: sub(R.makeCard({ confessed: 1 }), 'Behaviour').score };
      // note 8 also comes from taking his glasses from his desk (Phase 4)
      const g8 = game, had8 = !!(g8.me.noteGot && g8.me.noteGot.has(8));
      g8.track.event(g8.t, g8.me, 'glasses');
      phases.note8 = !had8 && g8.me.noteGot.has(8);
      const r1 = U.seededRng(42), r2 = U.seededRng(42), r3 = U.seededRng(43);
      const s1 = [r1(), r1(), r1()], s2 = [r2(), r2(), r2()], s3 = [r3(), r3(), r3()];
      return { emptyGrade: empty.grade, emptyN: empty.subjects.length, oddOk: odd.subjects.every((s) => Number.isFinite(s.score)) && odd.subjects[0].score === 28,
        before: before.subjects.find((s) => s.name === 'Behaviour').score, after: after.subjects.find((s) => s.name === 'Behaviour'),
        good: good.grade, hard: hard.score, easy: easy.score, bonus: D.REPORT.hardBonus,
        seed: a.seed, same: JSON.stringify(a) === JSON.stringify(a2), hardDays: days.filter((d) => d.difficulty === 'hard').length, specials: new Set(days.map((d) => d.special)).size,
        seeds: new Set(days.map((d) => d.seed)).size, doubled: Math.abs(plus - base - Math.round(2 * pts)) <= 1,
        phases, rng: JSON.stringify(s1) === JSON.stringify(s2) && JSON.stringify(s1) !== JSON.stringify(s3) && s1.every((x) => x >= 0 && x < 1), hash: U.hashStr('a') !== U.hashStr('b') && U.hashStr('abc') === U.hashStr('abc') };
    })();`));
  pass(!r.error && r.emptyGrade === 'F' && r.emptyN === 7, 'report card: no stats at all is an F in 7 subjects ' + JSON.stringify(r.error || [r.emptyGrade, r.emptyN]));
  pass(!r.error && r.oddOk, 'report card: counters that do not exist (blames, crawling, breath holds) are simply worth nothing');
  pass(!r.error && r.before === 50 && r.after.score === 80 && /Blamed 3 classmates/.test(r.after.comment), 'report card: a row added for a new counter grades it, with its comment ' + JSON.stringify(r.after));
  {
    const P = r.phases || {};
    pass(!r.error && P.n === 7 && P.beh.score === 92 && /Blamed 2 classmates/.test(P.beh.comment) && P.gym.score === 25 && /Left their seat 2 times/.test(P.gym.comment)
      && P.drama.score === 28 && /Held their breath 2 times/.test(P.drama.comment) && P.sci.score === 22 && /clock/.test(P.sci.comment) && P.media.score === 20 && /laptop/.test(P.media.comment),
      'report card: blaming, sneaking, his desk and the dread (Phases 3-5) are graded too ' + JSON.stringify(r.error || P));
    pass(!r.error && P.honest === 44, 'report card: telling him the truth takes a little off Behaviour');
    pass(!r.error && P.note8, 'note 8 ("my spare glasses are missing") also comes from taking his glasses from his desk');
  }
  pass(!r.error && r.good === 'A' && r.hard === r.easy + r.bonus, `report card: lots of mischief is an A; Hard adds ${r.bonus} points (${r.easy} -> ${r.hard})`);
  pass(!r.error && r.seed === 20261114 && r.same && r.seeds === 28, 'daily: the class seed is the UTC date as one number (2026-11-14 -> 20261114), the same every time');
  pass(!r.error && r.hardDays > 2 && r.hardDays < 20 && r.specials >= 4, `daily: the day picks Easy or Hard and a special (February: ${r.hardDays} Hard days, ${r.specials} different specials)`);
  pass(!r.error && r.doubled, 'daily: today\'s special counts double in the daily score');
  pass(!r.error && r.rng && r.hash, 'seededRng: the same seed gives the same numbers; hashStr is stable');

  // ---------------------------------------------------------------- 2. a card on every end screen
  r = await run('mode=free', new Function(H + `
    quiet(); step(100);
    for (let i = 0; i < 5; i++) g.note(g.me, 'whispers');
    g.note(g.me, 'echoes', 4); g.note(g.me, 'questions', 2);
    g.t = 301; g.mischief = 500;
    const done = until(() => g.state === 'end', 90);
    return { done, title: document.getElementById('end-title').innerText, card: card(), text: endText(), wide: document.querySelector('#end .panel').classList.contains('p6-card'),
      stats: document.getElementById('end-stats').innerText.length > 20, again: document.getElementById('btn-again').innerText, p: prof() };`));
  pass(!r.error && r.done && /CLASS DISMISSED/.test(r.title) && r.card && r.card.n === 7 && r.card.win && r.card.kind === 'survived', 'Free Class, survived: a report card with 7 subjects ' + JSON.stringify(r.error || r.card));
  pass(!r.error && /REPORT CARD/.test(r.text) && /Whispered 5 times/.test(r.text) && /Mr\. Madi/.test(r.text) && r.card.subs.Attendance === 'A' && r.stats && r.again === 'TRY AGAIN',
    'the card is its own block on the end screen: subjects, his comments, his signature (the old stats and buttons stay)');
  pass(!r.error && r.p.totals && r.p.totals.classes === 1 && r.p.endings.survived === 1 && r.p.best.score === r.card.score, 'the class is kept in the browser (classes, the ending, the best card)');

  r = await run('mode=free&diff=hard', new Function(H + `
    quiet(); step(60);
    g.note(g.me, 'whispers', 2);
    g.bust('noise', g.me);
    const done = until(() => g.state === 'end', 30);
    return { done, title: document.getElementById('end-title').innerText, card: card(), text: endText() };`));
  pass(!r.error && r.done && /DETENTION/.test(r.title) && r.card && !r.card.win && r.card.hard && r.card.kind === 'caught' && r.card.subs.Behaviour !== 'A' && /Caught 1 times/.test(r.text) && /HARD/.test(r.text),
    'Free Class on Hard, caught: a report card on the losing screen too (HARD, "Caught 1 times") ' + JSON.stringify(r.error || r.card));

  r = await run('mode=story&ch=1', new Function(H + `
    step(40);
    g.note(g.me, 'questions', 3); g.note(g.me, 'echoes', 2);
    g.completeChapter();
    const a = { title: document.getElementById('end-title').innerText, card: card(), again: document.getElementById('btn-again').innerText };
    g.endPrimary(); step(20);
    const cleared = endText() === '' && !document.querySelector('#end .panel').classList.contains('p6-card');
    g.finish('caught');
    return { a, cleared, b: { title: document.getElementById('end-title').innerText, card: card(), again: document.getElementById('btn-again').innerText } };`));
  pass(!r.error && /PERIOD 2 COMPLETE/.test(r.a.title) && r.a.card.win && r.a.card.kind === 'period' && r.a.again === 'NEXT PERIOD' && r.a.card.subs.Science !== 'F', 'story: a card after a finished period ' + JSON.stringify(r.error || r.a.card));
  pass(!r.error && r.cleared && /DETENTION/.test(r.b.title) && !r.b.card.win && r.b.again === 'RETRY PERIOD', 'story: the next class starts with no card; a lost period gets its own card');

  // ---------------------------------------------------------------- 3. unlocks: earned, shown, kept, used
  let page;
  [r, page] = await run('mode=free', new Function(H + `
    quiet(); step(60);
    for (let i = 0; i < 5; i++) g.note(g.me, 'whispers');
    g.note(g.me, 'echoes', 3); g.note(g.me, 'hitHim', 3); g.note(g.me, 'hits', 3); g.note(g.me, 'throws', 4);
    g.finish('survived');
    return { card: card(), text: endText(), p: prof(), kinds: g.prankKinds(g.me) };`), { keep: true });
  pass(!r.error && ['B', 'A'].includes(r.card.grade) && r.p.unlocks.spit && r.p.unlocks.band && r.p.unlocks.chalk && !r.p.unlocks.bomb && !r.p.unlocks.psst,
    'unlocks: a B with 3 hits on him and no strike earns the spitball, the rubber band and a phone theme (not the rest) ' + JSON.stringify(r.error || Object.keys(r.p.unlocks)));
  pass(!r.error && /UNLOCKED: SPITBALL/.test(r.text) && /UNLOCKED: RUBBER BAND/.test(r.text) && /UNLOCKED: CHALKBOARD/.test(r.text), 'unlocks: shown on the end screen when earned');
  pass(!r.error && r.kinds.join() === 'ball,plane,spit,band', 'unlocks: the new pranks join the prank selector (' + (r.kinds || []).join(', ') + ')');
  await page.waitForTimeout(4200);
  await page.screenshot({ path: shot('replay_end.png') });
  r = await page.evaluate(new Function(`const g = game; return { state: g.state, stampShown: !!document.getElementById('rc-grade'), grade: document.getElementById('rc-grade').textContent };`));
  pass(r.state === 'end' && r.stampShown && /^[A-F]$/.test(r.grade), 'the grade is stamped on the card (' + r.grade + ')');
  await page.close();

  // the stamp, his verdict and the unlock jingle are heard (each player: their own)
  [r, page] = await run('mode=free', new Function(H + `
    quiet(); step(40);
    window.__heard = heard; window.__said = [];
    const say0 = g.audio.say.bind(g.audio);
    g.audio.say = (id, o) => { window.__said.push(id); return say0(id, o); };
    for (let i = 0; i < 6; i++) g.note(g.me, 'whispers');
    g.note(g.me, 'echoes', 4); g.note(g.me, 'questions', 4); g.note(g.me, 'videos', 4);
    g.finish('survived');
    return { grade: g.lastCard.grade };`), { keep: true });
  await page.waitForTimeout(4600);
  const snd = await page.evaluate(() => ({ heard: window.__heard.filter((x) => x.startsWith('p6_')), said: window.__said }));
  pass(r.grade === 'A' && snd.heard.includes('p6_stamp') && snd.heard.includes('p6_unlock') && snd.said.includes('t_gradeA'), 'an A: the stamp, "A... for... awful." and the unlock jingle are played ' + JSON.stringify(snd));
  pass(await page.evaluate(() => /UNLOCKED: WATER BALLOON/.test(document.getElementById('end-report').innerText) && !!JSON.parse(localStorage.getItem('madiclass.replay')).unlocks.bomb), 'an A unlocks the water balloon');
  await page.close();

  // ---------------------------------------------------------------- 4. the unlocked pranks
  const ALL = { v: 1, unlocks: { spit: 'x', band: 'x', bomb: 'x', psst: 'x', chalk: 'x', neon: 'x' }, notes: {}, daily: {}, totals: {}, endings: {}, best: {}, theme: 'classic', seen: {} };
  // throwing them with the real controls: hold G, X switches through all five
  [r, page] = await run('mode=free', new Function(H + `quiet(); step(240); blind(true); atBoard(); g.me.foldT = 0; g.yaw = 0; g.pitch = 0.2; step(2); return { open: g.prankOpen() };`), { profile: ALL, keep: true });
  await page.keyboard.down('g'); await page.waitForTimeout(500);
  const names = [];
  for (let i = 0; i < 5; i++) { names.push(await page.evaluate(() => game.me.aim && game.me.aim.kind + ':' + document.getElementById('aim-kind').textContent + ':' + game.heldMeshes[game.me.aim.kind].visible)); await page.keyboard.press('x'); await page.waitForTimeout(250); }
  pass(names.join(' ') === 'ball:PAPER BALL:true plane:PAPER PLANE:true spit:SPITBALL:true band:RUBBER BAND:true bomb:WATER BALLOON:true', 'hold G, X: paper ball, paper plane, spitball, rubber band, water balloon (in your hand, named on screen): ' + names.join(' '));
  // (after the water balloon come the laser and the KICK ME note of Phase 3: on round to the spitball)
  for (let i = 0; i < 8 && (await page.evaluate(() => game.me.aim && game.me.aim.kind)) !== 'spit'; i++) { await page.keyboard.press('x'); await page.waitForTimeout(150); }
  await page.screenshot({ path: shot('replay_aim_spit.png') });
  await page.keyboard.up('g');
  await page.waitForFunction(() => game.track.log.some((e) => e.type === 'throw'), null, { timeout: 5000 }).catch(() => {});
  r = await page.evaluate(() => ({ ev: game.track.log.filter((e) => e.type === 'throw').map((e) => e.kind), fold: game.me.foldT, stat: game.track.of(game.me).throws }));
  pass(r.ev.join() === 'spit' && r.stat === 1 && r.fold < 0.5, 'letting go throws the spitball (counted, quick to make the next one) ' + JSON.stringify(r));
  await page.close();

  r = await run('mode=free', new Function(H + `
    quiet(); step(240); blind(true); atBoard(); step(10);
    g.allowBlame = false; // his own reactions only: "You. Who did it?" (Phase 3) is tested in blame.js
    const T = g.teacher, out = {}, me = g.me, said = [];
    const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return say0(id, v); };
    const at = (pt, kind, sp = 9) => { const from = pt.clone().add(new V(0.1, 0.1, 1.2)); return g.spawnPaper(me, null, kind, from, pt.clone().sub(from).normalize().multiplyScalar(sp), 0); };
    const back = () => new V(T.pos.x, 1.25, T.pos.z);
    // --- spitball on his back: he feels his neck and blames the roof; the second is not rain
    at(back(), 'spit'); until(() => said.includes('t_roof'), 6);
    out.roof = said.includes('t_roof') && g.strikes === 0 && me.prankStreak === 1 && !said.includes('t_whothrew');
    out.spitGone = g.papers.length === 0;
    until(() => !g.prankBusy, 8); atBoard(); step(4);
    at(back(), 'spit'); until(() => said.includes('t_notrain'), 6);
    out.notRain = said.includes('t_notrain') && me.prankStreak === 2;
    until(() => !g.prankBusy, 10); atBoard(); me.prankStreak = 0; step(4);
    // a spitball on the board sticks there
    const pr = at(new V(1.6, 1.7, -6.9), 'spit', 12); until(() => pr.state !== 'fly', 3); step(30);
    out.stuck = pr.state === 'rest' && pr.pos.y > 1.4 && Math.abs(pr.pos.z + 6.9) < 0.2 && g.papers.includes(pr);
    out.spitStats = g.track.of(me).hitHim === 2 && g.track.of(me).hits >= 3;
    // a spitball on a kid: "Ewww!"
    const kid = g.students.find((s) => !s.gone); const sub0 = [];
    const sayAt0 = g.sayAt.bind(g); g.sayAt = (c, id, n, v) => { sub0.push(id); return sayAt0(c, id, n, v); };
    at(kid.headWorld(new V()), 'spit'); until(() => sub0.some((x) => x.startsWith('k_ew')), 3);
    out.ew = sub0.some((x) => x.startsWith('k_ew'));
    until(() => g.brainIdle || !g.prankBusy, 6); atBoard(); me.prankStreak = 0; me.lastPrankHit = -99; step(4);
    // --- rubber band: straight at him: "Ow." and he turns to you
    at(back(), 'band', 16); until(() => said.includes('t_ow'), 5);
    out.ow = said.includes('t_ow') && g.track.of(me).trickShots === 0;
    until(() => said.filter((x) => x === 't_whothrew').length >= 1, 6);
    out.bandWho = said.includes('t_whothrew');
    until(() => !g.prankBusy, 12); atBoard(); me.prankStreak = 0; me.lastPrankHit = -99; step(4);
    // off the side wall first: a trick shot (he looks at the wall, and it counts)
    T.place(-4.3, -6.2, Math.PI); step(2);
    const band = g.spawnPaper(me, null, 'band', new V(-3.2, 1.3, -5.2), new V(-9, 0, -5.0), 0);
    let bounced = false;
    until(() => { bounced = bounced || !!band.banked; return band.hitDone || band.state !== 'fly'; }, 3);
    out.trick = bounced && band.hitDone && g.track.of(me).trickShots === 1;
    out.trickToast = /TRICK SHOT/.test(document.getElementById('toast').innerText);
    until(() => !g.prankBusy, 12); atBoard(); me.prankStreak = 0; me.lastPrankHit = -99; step(4);
    // --- water balloon on him: wet, he wipes his glasses (blind), worth two hits
    let wasBlind = false;
    at(back(), 'bomb', 7); until(() => said.includes('t_wet'), 6);
    out.wet = said.includes('t_wet') && g.track.of(me).soaked === 1 && me.prankStreak === 2;
    until(() => { wasBlind = wasBlind || g.blind; return wasBlind && !g.blind; }, 14);
    out.wiped = wasBlind;
    until(() => !g.prankBusy && g.brainIdle, 20); atBoard(); me.prankStreak = 0; me.lastPrankHit = -99; step(4);
    // on the board: the lesson is washed away
    T.place(-2.4, -5.0, 0); g.world.board.writeInstant('LESSON 7', 0); step(2);
    const lines0 = g.world.board.lines.length;
    at(new V(1.8, 1.7, -6.92), 'bomb', 7); until(() => said.includes('t_lesson'), 6);
    out.washed = lines0 > 0 && g.world.board.lines.length === 0 && said.includes('t_lesson');
    out.heard = ['p6_splat', 'p6_snap', 'p6_splash'].every((x) => heard.includes(x));
    out.said = said;
    return out;`), { profile: ALL });
  pass(!r.error && r.roof && r.spitGone, 'spitball on his back: he looks up, "The roof... is... leaking." (no strike, he does not look for you) ' + JSON.stringify(r.error || ''));
  pass(!r.error && r.notRain, 'the second spitball: "That... is not... rain."');
  pass(!r.error && r.stuck && r.spitStats, 'a spitball on the board sticks there; hits are counted');
  pass(!r.error && r.ew, 'a spitball on a kid: "Ewww! Gross!"');
  pass(!r.error && r.ow && r.bandWho, 'rubber band: "Ow." and then he looks for who did it');
  pass(!r.error && r.trick && r.trickToast, 'a rubber band off the wall that hits him is a TRICK SHOT (counted)');
  pass(!r.error && r.wet && r.wiped, 'water balloon: "I am... wet.", he has to wipe his glasses (blind meanwhile), worth two hits');
  pass(!r.error && r.washed, 'a water balloon on the board washes the lesson away: "My... lesson."');
  pass(!r.error && r.heard, 'each has its own sounds (splat, snap, splash)');
  if (r.error || bad.length) console.log('   pranks:', JSON.stringify(r));

  // the class gets it too: a rubber band on a kid, a spitball on Sam, a water balloon between the desks
  r = await run('mode=free', new Function(H + `
    quiet(); step(240); blind(true); atBoard(); step(10);
    const me = g.me, out = {}, lines = [];
    const sayAt0 = g.sayAt.bind(g); g.sayAt = (c, id, n, v) => { lines.push(c.name + ':' + id); return sayAt0(c, id, n, v); };
    const at = (pt, kind, sp = 9) => { const from = pt.clone().add(new V(0.1, 0.25, 1.0)); return g.spawnPaper(me, null, kind, from, pt.clone().sub(from).normalize().multiplyScalar(sp), 0); };
    const kid = g.students.find((s) => s.name === 'Ava'), sam = g.friend('sam');
    const l0 = g.laugh;
    at(kid.headWorld(new V()), 'band', 15); until(() => lines.some((x) => /^Ava:k_ow/.test(x)), 3);
    out.kidOw = lines.some((x) => /^Ava:k_ow/.test(x)) && g.laugh > l0;
    step(60);
    at(sam.headWorld(new V()), 'spit', 12); until(() => lines.some((x) => x === 'Sam:s_ow'), 3);
    out.samOw = lines.some((x) => x === 'Sam:s_ow');
    step(80); g.laugh = 0;
    // a balloon on the floor between Sam and you: Sam is soaked, he was not hit
    const hits0 = g.track.of(me).hits, mis0 = g.mischief, n0 = lines.length;
    const mid = sam.headWorld(new V()).add(new V(0.35, -0.5, 0.1));
    const b = g.spawnPaper(me, null, 'bomb', mid.clone().add(new V(0, 0.5, 0)), new V(0, -3, 0), 0);
    until(() => !g.papers.includes(b), 3);
    out.splash = !g.papers.includes(b) && g.track.of(me).hits === hits0 + 1 && g.mischief > mis0 && lines.slice(n0).some((x) => x === 'Sam:s_ow') && sam.tremble > 0 && g.track.of(me).soaked === 0;
    out.ev = g.track.log.filter((e) => e.type === 'hit').map((e) => e.target + ':' + (e.kind || 'paper'));
    step(60);
    out.calm = sam.tremble === 0 && g.strikes === 0 && g.state === 'playing';
    return out;`), { profile: ALL });
  pass(!r.error && r.kidOw && r.samOw, 'a rubber band on a kid: "Ow! Hey!"; a spitball on Sam: "Ow! Hey!" ' + JSON.stringify(r.error || r.ev));
  pass(!r.error && r.splash && r.calm, 'a water balloon bursting between the desks soaks who is near it (Sam), even without hitting anybody');

  // three spitballs in a row: he knows (the usual rule)
  r = await run('mode=free', new Function(H + `
    quiet(); step(240); blind(true); atBoard(); step(10);
    const T = g.teacher, me = g.me;
    for (let i = 0; i < 3 && g.strikes === 0; i++) {
      const pt = new V(T.pos.x, 1.25, T.pos.z), from = pt.clone().add(new V(0.1, 0.1, 1.2));
      g.spawnPaper(me, null, 'spit', from, pt.clone().sub(from).normalize().multiplyScalar(9), 0);
      until(() => g.track.of(me).hitHim > i, 3); step(10);
      if (i < 2) { g.prankBusy = false; atBoard(); step(2); }
    }
    return { strikes: g.strikes, why: g.track.of(me).caughtFor };`), { profile: ALL });
  pass(!r.error && r.strikes === 1 && r.why.prank === 1, 'three spitballs in a row: caught, like paper ' + JSON.stringify(r));

  // ---------------------------------------------------------------- 5. the third phone app and the themes
  r = await run('mode=free', new Function(H + `
    return (async () => {
    quiet(); step(240); blind(true); atBoard();
    const ph = g.phone, out = {};
    g.input.keys.phone = true; step(12);
    out.apps = ph.apps.join();
    g.input.pressed.ask = true; step(1); out.second = ph.mode;
    g.input.pressed.ask = true; step(1); out.third = ph.mode;
    out.legend = document.getElementById('keys-legend').innerText;
    out.hint = document.getElementById('hint').innerText;
    const ps = ph.psst;
    g.input.pressed.tap = true; step(1); out.started = ps.state === 'play';
    // pass only while he writes: one point is three passes
    let guard = 0;
    while (ps.score < 2 && ps.state === 'play' && guard++ < 4000) { if (ps.teacher === 'write' && ps.tt > 0.5 && ps.fly <= 0) g.input.pressed.tap = true; step(1); }
    out.score = ps.score; out.mis = g.mischief > 0; out.stat = g.track.of(g.me).psst;
    // now pass when he is about to look: caught, and the phone is LOUD
    const fails0 = g.track.of(g.me).fails, a0 = g.anger;
    guard = 0;
    while (ps.state === 'play' && guard++ < 4000) { if (ps.teacher === 'stop' && ps.tt < 0.2 && ps.fly <= 0) g.input.pressed.tap = true; step(1); }
    out.caught = ps.state === 'dead'; out.fails = g.track.of(g.me).fails - fails0; out.loud = heard.includes('phone_fail') && g.anger > a0;
    out.best = prof().best.psst;
    g.input.pressed.ask = true; step(1); out.back = ph.mode;
    g.input.keys.phone = false; step(5);
    // a theme: the handset and the game change colour
    const P = (await import('/src/profile.js')).Profile, D = await import('/src/data.js');
    P.setTheme('neon'); g.applyProfile();
    out.theme = ph.theme === D.PHONE_THEMES.neon && ph.body.material.color.getHex() === D.PHONE_THEMES.neon.body;
    P.setTheme('gold'); g.applyProfile();   // not unlocked: stays classic
    out.locked = ph.theme === D.PHONE_THEMES.classic;
    return out;
    })();`), { profile: ALL });
  pass(!r.error && r.apps === 'game,memes,psst' && r.second === 'memes' && r.third === 'psst' && /pass the note/.test(r.legend), 'PSST! unlocked: T switches game -> memes -> PSST! (the legend says how to play) ' + JSON.stringify(r.error || [r.apps, r.second, r.third]));
  pass(!r.error && /PSST!/.test(r.hint), 'the first time you open it, a hint explains it');
  pass(!r.error && r.started && r.score === 2 && r.mis && r.stat === 2, 'PSST!: passing the note while he writes scores (mischief, and counted for the report card)');
  pass(!r.error && r.caught && r.fails === 1 && r.loud && r.best === 2, 'PSST!: a note in the air when he turns around: CAUGHT, the phone is LOUD (he hears it), the best score is kept ' + JSON.stringify(r));
  pass(!r.error && r.back === 'game' && r.theme && r.locked, 'phone themes: an unlocked theme recolours the phone; a locked one is refused');
  r = await run('mode=free', new Function(H + `quiet(); step(240); blind(true); g.input.keys.phone = true; step(12); g.input.pressed.ask = true; step(1); const a = g.phone.mode; g.input.pressed.ask = true; step(1); return { a, b: g.phone.mode, apps: g.phone.apps.join() };`));
  pass(!r.error && r.apps === 'game,memes' && r.a === 'memes' && r.b === 'game', 'without the unlock the phone has its two apps, as before');

  // ---------------------------------------------------------------- 6. Mr. Hale's notes: every find condition
  r = await run('mode=free', new Function(H + `
    return (async () => {
      const D = await import('/src/data.js');
      quiet(); step(240); blind(true); atBoard(); step(4);
      const T = g.teacher, me = g.me, out = {}, got = () => Object.keys(prof().notes || {}).map(Number).sort((a, b) => a - b);
      const look = (pt, sec) => { aimAt(pt); step(Math.ceil(sec / 0.05) + 4); };
      // 1: the closet at the back (and nothing before you have looked long enough)
      aimAt(g.closetPos); step(20); out.early = got().length === 0;
      step(26); out.n1 = got().includes(1);
      out.hint = document.getElementById('hint').innerText; out.sound = heard.includes('p6_note');
      // 3: the MISSING poster. 9: Kevin's empty desk.
      look(g.world.missingPoster.position, 2); out.n3 = got().includes(3);
      look(g.world.kevinSeat, 2.5); out.n9 = got().includes(9);
      // 4: the face in the door window (only while it is there)
      const dw = g.doorFace.getWorldPosition(new V());
      look(dw, 1); out.n4no = !got().includes(4);
      g.doorFace.visible = true; look(dw, 0.5); g.doorFace.visible = false; out.n4 = got().includes(4);
      // 2: watch him clap the chalk off his hands
      g.interrupt((function* () { T.place(0.3, -5.6, 0); yield* g.actClap(8); for (;;) yield; })());
      until(() => got().includes(2), 8, () => aimAt(T.headWorld(new V()))); out.n2 = got().includes(2);
      atBoard(); g.yaw = 0; g.pitch = 0; step(4);
      // 5: repeat him three times
      for (let i = 0; i < 3; i++) g.note(me, 'echoes');
      step(2); out.n5 = got().includes(5);
      // 6: 5 points in PAPER PLANE
      g.phone.onPoint(4); out.n6no = !got().includes(6);
      g.phone.onPoint(5); out.n6 = got().includes(6);
      // 7: ask him his first name (not any other question)
      g.track.event(g.t, me, 'question', { q: 'wet' }); out.n7no = !got().includes(7);
      g.cutscene = false; g.askQuestion(D.QUESTIONS.find((q) => q.id === 'name'), me); out.n7 = got().includes(7);
      step(4); g.qBusy = false; atBoard();
      // 8: knock his glasses off (paper on his head; a rubber band on his head does not count)
      g.track.event(g.t, me, 'hit', { target: 'teacher', kind: 'band', where: 'head' }); out.n8no = !got().includes(8);
      const head = T.headWorld(new V()), from = head.clone().add(new V(0, 0.05, 1.0));
      g.spawnPaper(me, null, 'ball', from, head.clone().sub(from).normalize().multiplyScalar(9), 0);
      until(() => got().includes(8), 3); out.n8 = got().includes(8); out.glassesOff = g.track.of(me).glassesOff === 1;
      until(() => !g.prankBusy, 10); atBoard(); me.prankStreak = 0;
      // 10: the class clowns, twice
      g.track.global.memes = 1; step(2); out.n10no = !got().includes(10);
      g.track.global.memes = 2; step(2); out.n10 = got().includes(10);
      // 11: read a text from Mr. Hale (a text from somebody else does not count)
      const text = (from) => { g.buzz = { timer: 9, read: 0, tick: 0, msg: { from, text: 'room 13. supply closet. hurry' } }; g.input.keys.phone = true; until(() => !g.buzz, 5); g.input.keys.phone = false; step(6); };
      text('Sam'); out.n11no = !got().includes(11);
      text('Mr. Hale'); out.n11 = got().includes(11);
      // the hale theme unlocks at 6 notes (the toast says so)
      out.theme = !!prof().unlocks.hale;
      // 12: stay until the bell
      out.n12no = !got().includes(12);
      g.t = 301; g.mischief = 500; until(() => g.state === 'end', 90);
      out.n12 = got().includes(12); out.all = got().length;
      out.stat = g.lastCard.stats.notesFound; out.end = endText();
      out.log = g.track.log.filter((e) => e.type === 'haleNote').length;
      return out;
    })();`));
  pass(!r.error && r.early && r.n1 && r.sound && /Mr\. Hale's notes/.test(r.hint) && /1 \/ 12/.test(r.hint) && /NOTEBOOK/.test(r.hint), 'note 1: look at the supply closet for 2 seconds (a sound and a hint: "1 / 12 ... NOTEBOOK") ' + JSON.stringify(r.error || r.hint));
  pass(!r.error && r.n3 && r.n9, 'notes 3 and 9: the MISSING poster, Kevin\'s empty desk');
  pass(!r.error && r.n4no && r.n4, 'note 4: the face in the door window (only while it is there)');
  pass(!r.error && r.n2, 'note 2: watch him clap the chalk off his hands');
  pass(!r.error && r.n5 && r.n6no && r.n6, 'notes 5 and 6: three echoes; 5 points in PAPER PLANE (not 4)');
  pass(!r.error && r.n7no && r.n7, 'note 7: ask him his first name (another question does not count)');
  pass(!r.error && r.n8no && r.n8 && r.glassesOff, 'note 8: knock his glasses off with paper (counted as glassesOff)');
  pass(!r.error && r.n10no && r.n10 && r.n11no && r.n11, 'notes 10 and 11: the class clowns twice; a text from Mr. Hale (not from Sam)');
  pass(!r.error && r.n12no && r.n12 && r.all === 12, 'note 12: stay until the bell. All 12 found: ' + r.all);
  pass(!r.error && r.theme && r.stat === 12 && r.log === 12 && /Mr\. Hale's notes: 12 \/ 12 \(\+12 this class\)/.test(r.end), 'notes are counted (stat, class log), 6 of them unlock a phone theme, the end screen says how many are new');
  if (r.error) console.log('   notes:', JSON.stringify(r));

  // a note you already have is not "found" again
  r = await run('mode=free', new Function(H + `quiet(); step(240); aimAt(g.closetPos); step(50); return { hint: document.getElementById('hint').innerText, sound: heard.includes('p6_note'), stat: g.track.of(g.me).notesFound, n: Object.keys(prof().notes).length };`),
    { profile: { ...ALL, notes: { 1: 1 } } });
  pass(!r.error && !r.sound && !/Mr\. Hale/.test(r.hint) && r.n === 1, 'a note you already have makes no fuss the second time');

  // ---------------------------------------------------------------- 7. the menu: the notebook and the daily class
  page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  watch(page, 'menu');
  const today = new Date().toISOString().slice(0, 10), label = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'][+today.slice(5, 7) - 1] + ' ' + +today.slice(8, 10);
  await page.addInitScript((p) => { if (!localStorage.getItem('madiclass.replay')) localStorage.setItem('madiclass.replay', JSON.stringify(p)); }, { ...ALL, notes: { 1: 1, 8: 1, 12: 1 } });
  await page.goto(ROOT + '/index.html?debug=1');
  await page.waitForFunction(() => window.game && !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 180000 });
  const vis = (id) => page.evaluate((i) => !document.getElementById(i).classList.contains('hidden'), id);
  r = await page.evaluate(() => ({ daily: document.getElementById('btn-daily').innerText, nb: document.getElementById('btn-notebook').innerText }));
  pass(new RegExp(label).test(r.daily) && /not played yet/.test(r.daily) && /EASY|HARD/.test(r.daily), `menu: DAILY CLASS shows today's date (${label}) and "not played yet": ` + r.daily.replace(/\n/g, ' | '));
  pass(/3 \/ 12 notes/.test(r.nb) && /6 \/ 8 unlocks/.test(r.nb), 'menu: NOTEBOOK shows what you have: ' + r.nb.replace(/\n/g, ' | '));
  await page.click('#btn-notebook'); await page.waitForTimeout(200);
  r = await page.evaluate(() => ({ found: document.querySelectorAll('.nb-note:not(.missing)').length, missing: document.querySelectorAll('.nb-note.missing').length,
    n1: document.querySelector('[data-note="1"]').innerText, n2: document.querySelector('[data-note="2"]').innerText, count: document.getElementById('nb-count').innerText }));
  pass(await vis('notebook') && r.found === 3 && r.missing === 9 && /Thirty years in Room 13/.test(r.n1) && /Watch him clap/.test(r.n2) && !/claps\. Slowly/.test(r.n2) && r.count === '3 / 12',
    'notebook (from the menu): the 3 notes you found are readable, the other 9 show a hint, not the text');
  await page.screenshot({ path: shot('replay_notebook.png') });
  await page.click('#notebook-tabs button[data-tab="unlocks"]'); await page.waitForTimeout(150);
  r = await page.evaluate(() => ({ rows: document.querySelectorAll('.nb-list li').length, locked: document.querySelectorAll('.nb-list li.locked').length, use: [...document.querySelectorAll('button[data-theme]')].map((b) => b.dataset.theme + ':' + b.innerText).join(' '),
    how: document.querySelector('[data-unlock="gold"]').innerText }));
  pass(r.rows === 9 && r.locked === 2 && r.use === 'chalk:USE neon:USE classic:IN USE' && /Finish a daily class/.test(r.how), 'notebook, UNLOCKS: all 8 listed (locked ones say how), themes you own can be picked: ' + r.use);
  await page.click('button[data-theme="chalk"]'); await page.waitForTimeout(150);
  r = await page.evaluate(() => ({ theme: JSON.parse(localStorage.getItem('madiclass.replay')).theme, phone: game.phone.theme.name, btn: document.querySelector('button[data-theme="chalk"]').innerText }));
  pass(r.theme === 'chalk' && r.phone === 'CHALKBOARD' && r.btn === 'IN USE', 'picking a theme: kept in the browser and on the phone right away');
  await page.screenshot({ path: shot('replay_unlocks.png') });
  await page.click('#notebook-tabs button[data-tab="records"]'); await page.waitForTimeout(150);
  r = await page.evaluate(() => document.getElementById('notebook-body').innerText);
  pass(/REPORT CARDS/.test(r) && /DAILY CLASS/.test(r) && /ENDINGS/.test(r) && /a secret ending/.test(r) && /PAPER PLANE best/.test(r), 'notebook, RECORDS: report cards, the daily class, endings (secret ones hidden), phone games');
  await page.click('#notebook .back'); await page.waitForTimeout(150);
  pass(await vis('title') && !(await vis('notebook')), 'BACK returns to the menu');

  // the daily class
  await page.click('#btn-daily');
  await page.waitForFunction(() => game.state === 'playing', null, { timeout: 20000 });
  await page.waitForTimeout(600);
  r = await page.evaluate(async () => {
    const R = await import('/src/replay.js'), g = game, day = R.dailyInfo();
    return { daily: g.daily, day, seed: g.setup && g.setup.seed, shown: g.classSeed(), mode: g.mode, diff: g.difficulty, hard: g.hard, max: g.maxStrikes,
      card: document.getElementById('card-title').innerText + ' / ' + document.getElementById('card-time').innerText + ' / ' + document.getElementById('card-sub').innerText };
  });
  pass(r.daily && r.daily.date === today && r.daily.seed === Number(today.replace(/-/g, '')) && r.seed === r.daily.seed && r.shown === r.daily.seed, `daily: the class seed ${r.seed} (the UTC date) is passed to game.start as opts.seed`);
  pass(r.mode === 'free' && r.diff === r.day.difficulty && r.hard === (r.day.difficulty === 'hard') && r.max === (r.hard ? 1 : 3), `daily: Free Class, the day decides the difficulty (${r.diff}), not the menu`);
  pass(/DAILY CLASS/.test(r.card) && new RegExp(label).test(r.card) && /DAY/.test(r.card), 'daily: a title card says so (' + r.card + ')');
  await page.screenshot({ path: shot('replay_daily_card.png') });
  // RESTART keeps it the daily class
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  pass(await vis('pause') && await page.evaluate(() => !!document.getElementById('btn-pause-notebook')), 'pause menu has a NOTEBOOK button');
  await page.click('#btn-pause-notebook'); await page.waitForTimeout(200);
  pass(await vis('notebook') && await page.evaluate(() => game.state === 'paused'), 'notebook from the pause menu (the class stays paused)');
  await page.click('#notebook .back'); await page.waitForTimeout(200);
  pass(await vis('pause'), 'BACK returns to the pause menu');
  await page.click('#btn-restart'); await page.waitForTimeout(600);
  r = await page.evaluate(() => ({ daily: !!game.daily, t: game.t, state: game.state }));
  pass(r.daily && r.state === 'playing' && r.t < 3, 'RESTART restarts the daily class as the daily class');
  // finish it: a score, kept as the best of the day
  r = await page.evaluate(async () => {
    const g = game; g.post.render = () => {};
    g.updateCalls = g.updateBuzz = g.updateDirector = g.updateFreeShows = () => {}; g.startMeme = () => false;
    const said = []; const say0 = g.teacherSay.bind(g); g.teacherSay = (id, v) => { said.push(id); return say0(id, v); };
    for (let i = 0; i < 700 && g.state === 'playing'; i++) { g.playTick(0.05); g.ui.update(0.05); }
    const hint = said.includes('t_daily');
    g.note(g.me, 'echoes', 2); g.note(g.me, 'whispers', 3);
    g.t = 301; g.mischief = 500;
    for (let i = 0; i < 1500 && g.state === 'playing'; i++) g.playTick(0.05);
    const p = JSON.parse(localStorage.getItem('madiclass.replay'));
    return { hint, state: g.state, score: g.lastCard.daily && g.lastCard.daily.score, text: document.getElementById('end-report').innerText, best: p.daily, again: document.getElementById('btn-again').innerText, gold: !!p.unlocks.gold };
  });
  pass(r.state === 'end' && r.hint && r.score > 250 && /DAILY CLASS/.test(r.text) && /NEW BEST/.test(r.text) && new RegExp('class #' + today.replace(/-/g, '')).test(r.text), `daily: "Today... is... a special... day.", a score (${r.score}) on the card with the class number, NEW BEST`);
  pass(r.best[today] && r.best[today].score === r.score && r.again === 'TRY AGAIN (DAILY)' && r.gold && /UNLOCKED: GOLD STAR/.test(r.text), 'daily: the best of the day is kept; TRY AGAIN (DAILY); finishing one unlocks a theme');
  const first = r.score;
  await page.screenshot({ path: shot('replay_daily_end.png') });
  await page.click('#btn-again'); await page.waitForTimeout(600);
  r = await page.evaluate(() => {
    const g = game; const daily = !!g.daily;
    for (let i = 0; i < 100; i++) g.playTick(0.05);
    g.finish('caught');
    const p = JSON.parse(localStorage.getItem('madiclass.replay'));
    return { daily, score: g.lastCard.daily.score, text: document.getElementById('end-report').innerText, best: p.daily };
  });
  pass(r.daily && r.score < first && r.best[today].score === first && !/NEW BEST/.test(r.text) && new RegExp('your best today: ' + first).test(r.text), `daily: a worse try (${r.score}) does not replace the best (${first})`);
  await page.click('#btn-menu'); await page.waitForTimeout(600);
  r = await page.evaluate(() => ({ daily: document.getElementById('btn-daily').innerText, state: game.state, d: game.daily }));
  pass(r.state === 'title' && new RegExp('best ' + first).test(r.daily) && !r.d, 'menu: DAILY CLASS now shows your best (' + r.daily.replace(/\n/g, ' | ') + ')');
  await page.click('#btn-free'); await page.waitForTimeout(800);
  pass(await page.evaluate((d) => game.state === 'playing' && !game.daily && game.setup.seed !== d, Number(today.replace(/-/g, ''))), 'a normal Free Class after it is not a daily class (not the daily seed)');
  await page.close();

  // another day is another class (the date comes from the clock, in UTC)
  page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  watch(page, 'day');
  await page.addInitScript(() => { const D = Date; const t0 = D.UTC(2031, 0, 5, 23, 30); window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(t0); } static now() { return t0; } }; });
  await page.goto(ROOT + '/index.html?debug=1');
  await page.waitForFunction(() => window.game && !document.getElementById('menu').classList.contains('hidden'), null, { timeout: 180000 });
  r = await page.evaluate(() => ({ daily: document.getElementById('btn-daily').innerText, seed: game.replayMenu().day.seed }));
  pass(/JAN 5/.test(r.daily) && r.seed === 20310105, 'another day: another date on the menu, another class seed (' + r.seed + ')');
  await page.close();

  // ---------------------------------------------------------------- 8. a browser that keeps nothing
  r = await run('mode=free', new Function(H.replace("const prof = () => JSON.parse(localStorage.getItem('madiclass.replay') || '{}');", 'const prof = () => ({});') + `
    return (async () => {
      const P = (await import('/src/profile.js')).Profile;
      quiet(); step(60);
      for (let i = 0; i < 5; i++) g.note(g.me, 'whispers');
      g.note(g.me, 'echoes', 3); g.note(g.me, 'hitHim', 3);
      g.finish('survived');
      const a = { text: endText(), has: P.has('spit'), stored: P.stored, kinds: g.prankKinds(g.me).join() };
      g.start('free', 0); step(20); aimAt(g.closetPos); step(50);
      return { a, note: P.hasNote(1), state: g.state, stillHas: P.has('spit') };
    })();`), { setup: (p) => p.addInitScript(() => {
    const no = () => { throw new DOMException('blocked', 'SecurityError'); };
    Storage.prototype.getItem = no; Storage.prototype.setItem = no; Storage.prototype.removeItem = no;
  }) });
  pass(!r.error && /UNLOCKED: SPITBALL/.test(r.a.text) && r.a.has && r.a.stored === false && /spit/.test(r.a.kinds) && r.note && r.stillHas && r.state === 'playing',
    'storage blocked: no errors, unlocks and notes still work until the page closes ' + JSON.stringify(r.error || r.a.kinds));
  r = await run('mode=free', new Function(H + `quiet(); step(30); g.finish('survived'); return { grade: g.lastCard.grade, p: prof() };`), { setup: (p) => p.addInitScript(() => { try { localStorage.setItem('madiclass.replay', '{{{not json'); } catch (e) { /* */ } }) });
  pass(!r.error && r.p.totals.classes === 1, 'junk in storage: the profile starts over instead of breaking');

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 12).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
