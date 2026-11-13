// The phone on a touch screen: hold PHONE, the buttons turn into TAP / APP / SHOW and back.
const { chromium, devices, ROOT, GL, shot } = require('./lib');
(async () => {
  const browser = await chromium.launch({ args: GL });
  const ctx = await browser.newContext({ ...devices['iPhone 13 landscape'] });
  const page = await ctx.newPage();
  const ok = [], bad = [], logs = [];
  const pass = (c, n) => (c ? ok : bad).push(n);
  page.on('pageerror', (e) => logs.push('PAGEERROR: ' + e.message));
  await page.goto(ROOT + '/index.html?debug=1&autostart=1&mode=free');
  await page.waitForFunction(() => window.game && game.state === 'playing', null, { timeout: 120000 });
  // he sees nobody during this test (it is about the buttons)
  await page.evaluate(() => { const o = game.updateWatching.bind(game); game.updateWatching = function () { o(); for (const p of game.players) { p.watching = false; p.lookDot = -1; } }; });
  await page.waitForTimeout(3000);
  const btn = async (id) => (await page.$('#' + id)).boundingBox();
  const labels = () => page.evaluate(() => ['btn-talk', 'btn-ask', 'btn-echo'].map((id) => document.getElementById(id).textContent).join('/'));
  const tapBtn = async (id) => { const b = await btn(id); await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2); };
  await page.touchscreen.tap(1, 1);
  // hold PHONE with one finger (a touchstart without a touchend)
  await page.evaluate(() => document.getElementById('btn-phone').dispatchEvent(new TouchEvent('touchstart', { cancelable: true, bubbles: true, touches: [], changedTouches: [] })));
  await page.waitForTimeout(600);
  let l = await labels();
  pass(l === 'TAP/APP/SHOW' && await page.evaluate(() => game.phone.up && game.phone.mode === 'game'), 'holding PHONE: buttons become TAP / APP / SHOW (' + l + ')');
  await tapBtn('btn-talk');
  await page.waitForTimeout(300);
  pass(await page.evaluate(() => game.phone.game.state === 'play'), 'TAP flies the paper plane');
  await tapBtn('btn-ask');
  await page.waitForTimeout(400);
  l = await labels();
  pass(l === 'NEXT/APP/SHOW' && await page.evaluate(() => game.phone.mode === 'memes'), 'APP opens the meme app, TAP becomes NEXT (' + l + ')');
  await page.screenshot({ path: shot('touch_phone.png') });
  await page.evaluate(() => document.getElementById('btn-phone').dispatchEvent(new TouchEvent('touchend', { cancelable: true, bubbles: true, touches: [], changedTouches: [] })));
  await page.waitForTimeout(500);
  l = await labels();
  pass(l === 'TALK/ASK/ECHO' && await page.evaluate(() => !game.phone.up), 'letting go: the phone goes away, buttons are back (' + l + ')');
  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.join('\n') || 'no errors');
  await browser.close();
})();
