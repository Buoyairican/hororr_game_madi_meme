// Shared bits for the browser tests (see tests/README.md).
// Every test prints what it checked; this file turns that output into one verdict
// (RESULT PASS / RESULT FAIL) and the process exit code, the same way for every test.
const path = require('path');
const fs = require('fs');
const { chromium, devices } = require('playwright');

const ROOT = (process.env.BASE_URL || 'http://localhost:8765').replace(/\/$/, '');
const PEER = process.env.PEER || '127.0.0.1:9000';
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// WebGL in headless Chromium (SwiftShader), sound allowed without a click
const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
// two or more players on one machine: real local IPs (no mDNS) and no throttling of background tabs
const MP_ARGS = [...GL, '--disable-features=WebRtcHideLocalIpsWithMdns', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-background-timer-throttling'];

/** where screenshots go: tests/out/<name> */
const shot = (name) => path.join(OUT, name);

// ---- the verdict, from everything the test printed
const lines = [];
const origLog = console.log;
console.log = (...a) => { const s = a.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(' '); lines.push(...s.split('\n')); origLog(...a); };
process.on('exit', (code) => {
  const why = [];
  if (code) why.push('exit code ' + code);
  for (const l of lines) {
    if (/PAGEERROR/.test(l)) why.push(l.trim().slice(0, 160));
    else if (/^\s*(error|console\.error):/.test(l) || / console: /.test(l)) why.push(l.trim().slice(0, 160));
    const m = l.match(/^\s*(FAIL|BAD) \(?(\d+)/);
    if (m && +m[2] > 0) why.push(l.trim());
    if (/"issues":\[\s*"/.test(l)) why.push('fuzz found issues');
    if (/^RESULT FAIL/.test(l)) why.push(l.trim());
  }
  if (!lines.some((l) => /^\s*(PASS|OK) \(?\d+|^RESULT PASS|"state":"/.test(l))) why.push('the test printed no results');
  const verdict = why.length ? 'RESULT FAIL: ' + [...new Set(why)].slice(0, 5).join(' | ') : 'RESULT PASS';
  origLog(verdict);
  process.exitCode = why.length ? 1 : 0;
});

module.exports = { chromium, devices, ROOT, PEER, GL, MP_ARGS, OUT, shot };
