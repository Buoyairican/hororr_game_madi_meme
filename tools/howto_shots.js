#!/usr/bin/env node
// Takes the pictures for HOW TO PLAY (assets/ui/howto/*.jpg) from the real game: each one is a moment staged
// in debug mode, without the HUD. Run it after the classroom or Mr. Past change:
//   python3 tests/serve.py 8765 &      (from the repo root)
//   node tools/howto_shots.js          (needs Playwright with Chromium, like the tests)
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const ROOT = (process.env.BASE_URL || 'http://localhost:8765').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', 'assets', 'ui', 'howto');
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

// each picture: how to stage it (runs in the page, `g` is the game), then how many frames to let it settle
const SHOTS = {
  // the classroom from your seat: him at the board, writing, his back to you
  goal: { setup: (g) => { g.interrupt(g.actWrite('LESSON 7:  ???')); }, frames: 70, look: [0, 0.02] },
  // he turns round and stares right at you
  watch: { setup: (g) => { const T = g.teacher; g.interrupt((function* () { T.place(0.25, -3.9, 0); T.lookAt(g.camPos, 6); T.eyeGlow = 0.9; for (;;) yield; })()); }, frames: 40, look: [0, 0.12] },
  // caught: he comes to your desk and leans in
  caught: { setup: (g) => { const T = g.teacher; g.interrupt((function* () { T.place(0.05, -3.05, 0); T.leanTarget = 0.75; T.crouchTarget = 0.22; T.setPose('point', { at: g.camPos }); T.lookAt(g.camPos, 6); T.eyeGlow = 0.8; T.jawTarget = 0.25; for (;;) yield; })()); }, frames: 50, look: [0, 0.3] },
  // a whisper to Nora (right)
  whisper: { setup: (g) => { const n = g.friend('nora'); n.lookTarget = g.camPos; n.talking = 3; }, frames: 30, look: [-1.42, -0.02] },
  // his back is turned: a paper ball in your hand, the dotted arc to his back
  prank: { setup: (g) => { g.interrupt(g.actWrite('EYES ON THE BOARD')); }, frames: 40, look: [0.0, 0.16], hold: 'prank' },
  // he folds over your desk to listen
  breath: { setup: (g) => { const T = g.teacher; g.interrupt((function* () { T.place(-0.05, -2.62, 0); T.setPose('desk', { L: new (g.camPos.constructor)(0.2, 0.76, -2.15), R: new (g.camPos.constructor)(-0.3, 0.76, -2.15) }); T.leanTarget = 0.95; T.crouchTarget = 0.34; T.stanceTarget = 0.25; T.lookAt(new (g.camPos.constructor)(0.6, 1.0, -1.4), 3); T.rollTarget = 0.35; for (;;) yield; })()); g.dreadFear = 0.5; }, frames: 60, look: [0, 0.12] },
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: GL });
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free&ch=0&events=none&quirks=none');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  await page.evaluate(() => {
    const g = game;
    g.updateDirector = () => {}; g.updateCalls = g.updateBuzz = g.updateFreeShows = () => {}; g.startMeme = () => false; g.dreadAuto = false; g.eventsOn = false;
    for (let i = 0; i < 260; i++) g.playTick(0.05);
    g.script = null;
    document.getElementById('hud').style.visibility = 'hidden';
  });
  for (const [name, s] of Object.entries(SHOTS)) {
    await page.evaluate(([src, look, hold]) => {
      const g = game, setup = new Function('return ' + src)();
      g.anger = 0; g.input.keys.prank = false; g.me.aim = null;
      setup(g);
      g.yaw = look[0]; g.pitch = look[1];
      if (hold) g.input.keys[hold] = true;
    }, [String(s.setup), s.look, s.hold || null]);
    await page.evaluate((n) => { const g = game; for (let i = 0; i < n; i++) { g.playTick(0.05); g.yaw = g.__yaw ?? g.yaw; } }, s.frames);
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, name + '.jpg'), type: 'jpeg', quality: 72, clip: { x: 0, y: 0, width: 960, height: 540 } });
    await page.evaluate(() => { const g = game; g.input.keys.prank = false; g.me.aim = null; g.dreadFear = 0; const n = g.friend('nora'); if (n) n.lookTarget = null; });
    console.log('  ', name);
  }
  await browser.close();
})();
