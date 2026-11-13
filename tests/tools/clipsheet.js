const { chromium, devices, ROOT, PEER, GL, MP_ARGS, shot } = require('../lib');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on('pageerror', (e) => console.log('PAGEERROR: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.text()); });
  await page.goto(ROOT + '/manifest.webmanifest');
  const parts = [[0, 13], [13, 26], [26, 38]];
  for (const [pi, [a, b]] of parts.entries()) {
    const url = await page.evaluate(async ([a, b]) => {
      const m = await import('/src/clips.js');
      const list = [...m.CLIPS, m.SPECIAL.found];
      const img = new Image(); img.src = '/assets/textures/' ; // portrait not needed here
      const cw = 135, ch = 240, ts = [0.15, 0.4, 0.62, 0.9];
      const cv = document.createElement('canvas'); cv.width = cw * ts.length * 2 + 30; cv.height = Math.ceil((b - a) / 2) * (ch + 18);
      const c = cv.getContext('2d'); c.fillStyle = '#444'; c.fillRect(0, 0, cv.width, cv.height);
      const errs = [];
      for (let i = a; i < Math.min(b, list.length); i++) {
        const k = i - a, col = k % 2, row = Math.floor(k / 2);
        const clip = list[i];
        ts.forEach((f, j) => {
          const x = col * (cw * ts.length + 30) + j * cw, y = row * (ch + 18) + 16;
          c.save(); c.beginPath(); c.rect(x, y, cw - 2, ch); c.clip(); c.translate(x, y); c.scale((cw - 2) / 270, ch / 480);
          try { clip.draw(c, clip.dur * f, (q) => ((q * 9301 + 49297) % 233280) / 233280, {}); } catch (e) { errs.push(i + ':' + e.message); }
          c.restore();
        });
        c.fillStyle = '#fff'; c.font = '12px sans-serif'; c.textAlign = 'left';
        c.fillText(i + ' ' + (clip.who || clip.special) + ' — ' + clip.cap.slice(0, 40), col * (cw * ts.length + 30), row * (ch + 18) + 12);
      }
      if (errs.length) console.error('ERRS ' + errs.join(' | '));
      return cv.toDataURL('image/png');
    }, [a, b]);
    require('fs').writeFileSync(shot(`clips_${pi}.png`), Buffer.from(url.split(',')[1], 'base64'));
  }
  console.log('PASS (' + parts.length + '): wrote tests/out/clips_0..' + (parts.length - 1) + '.png');
  await browser.close();
})();
