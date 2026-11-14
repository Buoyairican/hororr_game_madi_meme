// The online lobby on phones and computers: a host must see who is in and what is happening
// without scrolling (the owner hosts from a phone in landscape).
//  - room view at 844x390 and 667x375 (landscape phones), 390x844 (portrait), 960x540 and 1280x720:
//    the code, SHARE / COPY, the status line ("Bo is in."), the player list and START are on screen;
//    the name field and the intro are gone; the keep-open tip names SHARE CODE only when it is there
//  - a friend opening the invite link in portrait: the CODE box and JOIN fit inside the panel
//  - back to the pick view: the name field, the status under JOIN and BACK at the bottom again
const { chromium, ROOT, PEER, MP_ARGS, shot } = require('./lib');
const BASE = ROOT + '/index.html?debug=1&peer=' + PEER;

(async () => {
  const browser = await chromium.launch({ args: MP_ARGS });
  const ok = [], bad = [], logs = [];
  const pass = (c, name) => { (c ? ok : bad).push(name); console.log(' ', c ? 'ok ' : 'BAD', name); };
  const mk = async (tag, touch) => {
    const ctx = await browser.newContext(touch
      ? { viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1 }
      : { viewport: { width: 960, height: 540 } });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => logs.push(`${tag} PAGEERROR: ${e.message} ${(e.stack || '').split('\n')[1] || ''}`));
    p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} console: ${m.text().slice(0, 200)}`); });
    return p;
  };
  const waitFor = (p, fn, ms = 30000, arg) => p.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
  const open = async (p, url) => {
    await p.goto(url);
    await waitFor(p, () => window.game && (!document.getElementById('menu').classList.contains('hidden') || !document.getElementById('mp').classList.contains('hidden')), 180000);
    await p.evaluate(() => { game.post.render = () => {}; });
  };
  const host = async (p, name) => {
    await p.click('#btn-mp'); await p.fill('#mp-name', name); await p.click('#btn-host');
    await waitFor(p, () => /^[A-Z0-9]{5}$/.test(document.getElementById('mp-code-show').textContent) && game.mp && game.mp.code, 25000);
    return p.evaluate(() => document.getElementById('mp-code-show').textContent);
  };
  /** where things are: on screen inside the panel's visible box, without scrolling it */
  const layout = (p) => p.evaluate(() => {
    const panel = document.getElementById('mp-panel'), pr = panel.getBoundingClientRect();
    const seen = (id) => {
      const el = typeof id === 'string' ? document.getElementById(id) : id;
      if (!el || el.offsetParent === null) return false;
      const r = el.getBoundingClientRect();
      return r.height > 0 && r.top >= pr.top - 1 && r.bottom <= pr.bottom + 1 && r.left >= pr.left - 1 && r.right <= pr.right + 1 && r.bottom <= innerHeight && r.right <= innerWidth;
    };
    const lis = [...document.querySelectorAll('#mp-players li')];
    return {
      scrollTop: panel.scrollTop, overflow: panel.scrollHeight - panel.clientHeight,
      code: seen('mp-code-show'), copy: seen('btn-copy'), share: seen('btn-share'), status: seen('mp-status'),
      statusText: document.getElementById('mp-status').innerText,
      players: lis.length === 4 && lis.every((li) => seen(li)), start: seen('btn-mp-go'), leave: seen('btn-mp-leave'),
      name: document.querySelector('.mp-name').offsetParent !== null, intro: document.querySelector('.mp-intro').offsetParent !== null,
      keep: document.getElementById('mp-keep').innerText, keepSeen: seen('mp-keep'),
      wide: panel.getBoundingClientRect().width,
    };
  });

  // ---------------------------------------------------------------- a phone host (with a share sheet)
  const P = await mk('P', true);
  await P.addInitScript(() => { navigator.share = async () => {}; });
  await open(P, BASE);
  const code = await host(P, 'Phone');
  const G = await mk('G');
  await open(G, BASE + '&join=' + code);
  await G.fill('#mp-name', 'Bo'); await G.click('#btn-join');
  pass(await waitFor(P, () => /Bo is in/.test(document.getElementById('mp-status').innerText), 30000), 'a friend joins the phone host\'s class');
  await P.waitForTimeout(300);
  for (const [w, h, tag] of [[844, 390, 'iphone landscape'], [667, 375, 'small phone landscape']]) {
    await P.setViewportSize({ width: w, height: h });
    await P.evaluate(() => { document.getElementById('mp-panel').scrollTop = 0; });
    await P.waitForTimeout(200);
    const L = await layout(P);
    await P.screenshot({ path: shot(`mp_lobby_${w}x${h}.png`) });
    pass(L.code && L.share && L.copy, `${tag} ${w}x${h}: the code, SHARE CODE and COPY INVITE LINK on screen`);
    pass(L.status && /Bo is in/.test(L.statusText), `${tag}: the status "${L.statusText}" on screen without scrolling`);
    pass(L.players, `${tag}: all 4 desks of the player list on screen`);
    pass(L.start, `${tag}: START FREE CLASS on screen`);
    pass(L.keepSeen && /SHARE CODE/.test(L.keep), `${tag}: the keep-open tip on screen, naming SHARE CODE (it is there): "${L.keep}"`);
    pass(!L.name && !L.intro, `${tag}: no name field or intro in the room view`);
  }
  // portrait: one column, the status and the players right under the code
  await P.setViewportSize({ width: 390, height: 844 });
  await P.evaluate(() => { document.getElementById('mp-panel').scrollTop = 0; });
  await P.waitForTimeout(200);
  let L = await layout(P);
  await P.screenshot({ path: shot('mp_lobby_390x844.png') });
  pass(L.code && L.share && L.status && L.players && L.start, `portrait 390x844: code, SHARE, status, players and START on screen (${JSON.stringify({ status: L.status, players: L.players, start: L.start })})`);
  // a new note scrolls into view when the panel was scrolled away from it (tiny screens)
  await P.setViewportSize({ width: 568, height: 320 });
  await P.evaluate(() => { const p = document.getElementById('mp-panel'); p.scrollTop = p.scrollHeight; });
  await G.click('#btn-mp-leave');
  pass(await waitFor(P, () => /Bo left/.test(document.getElementById('mp-status').innerText), 15000), 'the friend leaves: "Bo left."');
  await P.waitForTimeout(300);
  L = await layout(P);
  pass(L.status, `568x320, panel scrolled down: the new note "${L.statusText}" is scrolled into view (overflow ${L.overflow}px)`);
  await P.setViewportSize({ width: 844, height: 390 });

  // ---------------------------------------------------------------- a computer host (no share sheet)
  const D = await mk('D');
  await open(D, BASE);
  const dcode = await host(D, 'Desk');
  await open(G, BASE + '&join=' + dcode);
  await G.fill('#mp-name', 'Bo'); await G.click('#btn-join');
  pass(await waitFor(D, () => /Bo is in/.test(document.getElementById('mp-status').innerText), 30000), 'a friend joins the computer host\'s class');
  for (const [w, h] of [[960, 540], [1280, 720], [800, 450]]) {
    await D.setViewportSize({ width: w, height: h });
    await D.waitForTimeout(200);
    const M = await layout(D);
    await D.screenshot({ path: shot(`mp_lobby_${w}x${h}.png`) });
    pass(M.code && M.copy && M.status && M.players && M.start, `computer ${w}x${h}: code, COPY, status, players and START on screen (${JSON.stringify({ status: M.status, players: M.players, start: M.start, leave: M.leave })})`);
    pass(!M.share && M.keepSeen && !/SHARE/.test(M.keep), `computer ${w}x${h}: no SHARE button, and the tip doesn't mention one: "${M.keep}"`);
  }

  // ---------------------------------------------------------------- back to the pick view
  await D.click('#btn-mp-leave');
  await D.click('#btn-mp');
  const back = await D.evaluate(() => {
    const panel = document.getElementById('mp-panel');
    return { room: panel.classList.contains('room'), name: document.querySelector('.mp-name').offsetParent !== null,
      newsUnderJoin: document.getElementById('mp-pick').contains(document.getElementById('mp-status')), leaveLast: panel.lastElementChild.id === 'btn-mp-leave' };
  });
  pass(!back.room && back.name && back.newsUnderJoin && back.leaveLast, 'after CLOSE THE CLASS: the pick view again (name field, status under JOIN, BACK at the bottom) ' + JSON.stringify(back));

  // ---------------------------------------------------------------- a friend opens the invite link in portrait
  const F = await mk('F', true);
  await F.setViewportSize({ width: 390, height: 844 });
  await open(F, BASE + '&join=' + dcode);
  const row = await F.evaluate(() => {
    const pr = document.getElementById('mp-panel').getBoundingClientRect();
    const a = document.getElementById('mp-code').getBoundingClientRect(), b = document.getElementById('btn-join').getBoundingClientRect();
    return { panel: [pr.left, pr.right], code: [a.left, a.right], join: [b.left, b.right], ok: a.left >= pr.left + 1 && b.right <= pr.right - 1 && a.right <= b.left };
  });
  await F.screenshot({ path: shot('mp_lobby_join_portrait.png') });
  pass(row.ok, 'portrait 390x844: the CODE box and JOIN fit inside the panel ' + JSON.stringify(row));
  for (const w of [320, 360]) {
    await F.setViewportSize({ width: w, height: 640 });
    const fits = await F.evaluate(() => {
      const pr = document.getElementById('mp-panel').getBoundingClientRect();
      return document.getElementById('mp-code').getBoundingClientRect().left >= pr.left && document.getElementById('btn-join').getBoundingClientRect().right <= pr.right;
    });
    pass(fits, `portrait ${w} px wide: the join row still fits`);
  }

  console.log('PASS (' + ok.length + '):\n  ' + ok.join('\n  '));
  console.log('FAIL (' + bad.length + '):\n  ' + bad.join('\n  '));
  console.log(logs.slice(0, 20).join('\n') || 'no errors');
  await browser.close();
})().catch((e) => { console.log('RESULT FAIL: ' + (e && e.stack)); process.exit(1); });
