// Bootstrap: load assets, build the scene, wire menus and run the loop.
import * as THREE from 'three';
import { buildWorld } from './world.js';
import { Teacher } from './teacher.js';
import { Classmate } from './students.js';
import { PostFX } from './post.js';
import { AudioSys } from './audio.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { Phone } from './phone.js';
import { loadUserVideos } from './memes.js';
import { Game } from './game.js';
import { preloadModels, instantiate } from './models.js';
import { CHAPTERS } from './data.js';
import { MP, cleanName } from './mp.js';
import { cleanCode } from './net.js';

const ui = new UI();
window.addEventListener('error', (e) => {
  // a hiccup inside the network library (a bad packet from someone) must not stop the game
  if (/peerjs/.test(e.filename || '')) { console.warn('network:', e.message); e.preventDefault(); return; }
  ui.error('Something broke: ' + e.message);
});
window.addEventListener('unhandledrejection', (e) => ui.error('Something broke: ' + ((e.reason && e.reason.message) || e.reason)));

const query = new URLSearchParams(location.search);
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
// phones get the cheapest settings by default
const DEFAULTS = { sens: 1, vol: 0.9, retro: true, meter: false, subs: true, shadows: !isTouch, difficulty: 'easy' };
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('madiclass.settings') || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
function saveSettings(s) { try { localStorage.setItem('madiclass.settings', JSON.stringify(s)); } catch (e) { /* private mode */ } }
function progress() { try { return Number(localStorage.getItem('madiclass.progress') || 0); } catch (e) { return 0; } }
const settings = loadSettings();

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

// the class: [row, column, model, name]. Row 1 column 1 is Kevin's empty desk.
const KIDS = [[0, 0, 'kid_a', 'Leo'], [1, 2, 'kid_d', 'Ava'], [0, 4, 'kid_b', 'Omar'], [2, 1, 'kid_c', 'Maya'], [2, 3, 'kid_e', 'Jin'],
  [3, 0, 'kid_f', 'Zoe'], [3, 2, 'kid_a', 'Max'], [3, 4, 'kid_c', 'Lily']];

async function boot() {
  const canvas = document.getElementById('view');
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) {
    ui.error('Your browser could not start WebGL, which this game needs. Try another browser or enable hardware acceleration.');
    return;
  }
  renderer.shadowMap.enabled = settings.shadows;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 60);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  ui.progress(0.03, 'painting the walls&hellip;');
  await withTimeout(Promise.all([document.fonts.load('700 54px Caveat'), document.fonts.load('20px "Special Elite"')]), 4000);
  const world = buildWorld(scene, renderer);
  const tl = new THREE.TextureLoader();
  const [face, eyes, portrait] = await Promise.all(['teacher_face.jpg', 'teacher_eyes.jpg', 'teacher_portrait.jpg'].map((f) => tl.loadAsync('assets/textures/' + f)));
  face.colorSpace = THREE.SRGBColorSpace;
  portrait.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 4;

  ui.progress(0.08, 'seating the students&hellip;');
  await preloadModels('assets/models/', (p) => ui.progress(0.08 + p * 0.12));
  const teacher = new Teacher(await instantiate('madi', { shadows: true }), face, eyes);
  scene.add(teacher.root);
  const seat = (r, c) => world.seats.find((s) => s.row === r && s.col === c);
  const friends = [new Classmate('sam', 'Sam', await instantiate('sam'), seat(0, 1)), new Classmate('nora', 'Nora', await instantiate('nora'), seat(0, 3))];
  const students = [];
  for (const [r, c, m, name] of KIDS) students.push(new Classmate('kid', name, await instantiate(m), seat(r, c)));
  const kevin = new Classmate('kid', 'Kevin', await instantiate('kid_e'), seat(1, 1));
  for (const c of [...friends, ...students, kevin]) scene.add(c.root);
  kevin.setGone(true);
  const hand = await instantiate('hand');
  const post = new PostFX(renderer);
  const audio = new AudioSys();
  const phone = new Phone(camera, portrait.image, audio);
  loadUserVideos(); // your own .mp4 files in assets/videos/ (optional)
  const input = new Input(canvas);
  if (input.touch) document.body.classList.add('touch');
  input.sens = settings.sens;
  input.bindButton(document.getElementById('btn-talk'), 'talk');
  input.bindButton(document.getElementById('btn-phone'), 'phone');
  input.bindTap(document.getElementById('btn-echo'), 'echo');
  input.bindTap(document.getElementById('btn-ask'), 'ask');

  ui.progress(0.2, 'tuning the whispers&hellip;');
  await audio.load((p) => ui.progress(0.2 + p * 0.78, p < 0.5 ? 'tuning the whispers&hellip;' : 'sharpening the chalk&hellip;'));
  audio.setVolume(settings.vol);

  const game = new Game({ renderer, scene, camera, post, audio, ui, input, world, teacher, friends, students, kevin, hand, phone, portraitTex: portrait });
  if (query.has('debug')) window.game = game;
  ui.subsOn = settings.subs;
  ui.meterOn = settings.meter;

  const resize = () => {
    const w = innerWidth, h = innerHeight;
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 84 : w / h < 1.4 ? 74 : 68;
    game.baseFov = camera.fov;
    camera.updateProjectionMatrix();
    post.setSize(w, h, settings.retro);
    if (input.touch && game.state !== 'title' && h <= w) ui.show('rotate', false);
  };
  addEventListener('resize', resize);
  addEventListener('orientationchange', () => setTimeout(resize, 200));
  resize();

  // ---------------- title screen ----------------
  const titlePose = () => { teacher.root.visible = true; teacher.place(0.35, -5.1, 0); teacher.lookAt(game.camPos, 4); };
  titlePose();
  let musicOn = false;
  const startTitleAudio = () => {
    audio.unlock();
    if (musicOn || game.state !== 'title') return;
    musicOn = true;
    audio.fadeBus('music', 1, 0.3);
    audio.fadeBus('amb', 0.6, 0.5);
    audio.startAmbience(new THREE.Vector3(0, 3, -2), new THREE.Vector3(-5.5, 1.8, -1));
    audio.play('music_box', { loop: true, bus: 'music', vol: 0.55, reverb: 0.35 });
  };
  document.getElementById('title').addEventListener('pointerdown', startTitleAudio);

  // warm up shaders so the first seconds don't stutter
  renderer.compile(scene, camera);
  ui.progress(1, 'ready.');
  ui.show('loading', false);
  ui.show('menu', true);

  // ---------------- menus ----------------
  let backTo = 'title';
  let pending = null;
  const $ = (id) => document.getElementById(id);
  const go = (id) => ui.screen(id);
  const launch = (mode, ch) => {
    audio.unlock();
    if (input.touch && innerHeight > innerWidth && !launch.rotateOk) { pending = [mode, ch]; ui.show('rotate', true); return; }
    ui.show('rotate', false);
    musicOn = false;
    game.difficulty = settings.difficulty === 'hard' ? 'hard' : 'easy';
    game.start(mode, ch);
  };
  const buildChapters = () => {
    const p = progress();
    const list = $('chapter-list');
    list.innerHTML = '';
    CHAPTERS.forEach((c, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<span>${i < p + 1 ? c.title : '???'}</span><span class="t">${c.time}</span>`;
      b.disabled = i > p;
      b.onclick = () => launch('story', i);
      list.appendChild(b);
    });
  };
  $('btn-story').onclick = () => { audio.unlock(); if (progress() === 0) launch('story', 0); else { buildChapters(); backTo = 'title'; go('chapters'); } };
  $('btn-free').onclick = () => launch('free', 0);
  $('btn-rotate-ok').onclick = () => { launch.rotateOk = true; if (pending) launch(...pending); };
  $('btn-how').onclick = () => { backTo = 'title'; go('how'); };
  $('btn-settings').onclick = () => { backTo = 'title'; go('settings'); };
  document.querySelectorAll('.back').forEach((b) => (b.onclick = () => go(backTo)));

  const pause = () => {
    if (game.state !== 'playing') return;
    if (game.mp) { input.enable(false); backTo = 'pause'; go('pause'); return; } // the class goes on for everyone else
    game.state = 'paused';
    input.enable(false);
    if (audio.ctx) audio.ctx.suspend();
    backTo = 'pause';
    go('pause');
  };
  const resume = () => {
    go(null);
    if (game.state === 'paused') game.state = 'playing';
    if (game.state === 'playing') input.enable(true);
    if (audio.ctx) audio.ctx.resume();
  };
  const toTitle = () => {
    if (audio.ctx && audio.ctx.state !== 'running') audio.ctx.resume();
    audio.stopAll();
    audio.stopAmbience();
    game.reset('free', 0);
    game.state = 'title';
    titlePose();
    ui.show('hud', false);
    go('title');
    musicOn = false;
    startTitleAudio();
  };
  input.onPause = pause;
  $('btn-pause').onclick = pause;
  $('btn-pause').addEventListener('touchend', (e) => { e.preventDefault(); pause(); });
  $('btn-resume').onclick = resume;
  $('btn-pause-settings').onclick = () => { backTo = 'pause'; go('settings'); };
  $('btn-restart').onclick = () => { if (audio.ctx) audio.ctx.resume(); go(null); game.start(game.mode, game.chapter); };
  $('btn-again').onclick = () => { go(null); if (!game.endPrimary()) toTitle(); };
  document.addEventListener('visibilitychange', () => { if (document.hidden && !game.mp) pause(); });

  // ---------------- multiplayer ----------------
  let mp = null;
  const SEAT_NAMES = ['front row, middle', 'second row, left', 'second row, right', 'second row, behind Nora'];
  const showEl = (id, on) => $(id).classList.toggle('hidden', !on);
  const mpStatus = (t, ok) => { $('mp-status').textContent = t || ''; $('mp-status').classList.toggle('ok', !!ok); };
  const savedName = () => { try { return localStorage.getItem('madiclass.name') || ''; } catch (e) { return ''; } };
  const mpName = () => {
    const n = cleanName($('mp-name').value) || 'Player';
    try { localStorage.setItem('madiclass.name', n); } catch (e) { /* private mode */ }
    return n;
  };
  const labels = () => {
    const t = !mp ? 'MAIN MENU' : mp.role === 'host' ? 'BACK TO LOBBY' : 'LEAVE CLASS';
    $('btn-menu').textContent = t; $('btn-quit').textContent = t;
    showEl('btn-restart', !mp || mp.role === 'host');
  };
  const renderLobby = () => {
    if (!mp) return;
    const list = $('mp-players');
    list.innerHTML = '';
    for (let s = 0; s < 4; s++) {
      const p = mp.lobby.find((x) => x.seat === s);
      const li = document.createElement('li');
      li.className = p ? '' : 'empty';
      const who = p ? p.name + (p.id === mp.myId ? ' (you)' : '') + (p.id === 'host' ? ' &#9733;' : '') : 'empty desk';
      li.innerHTML = `<span>${who}</span><span class="seat">${SEAT_NAMES[s]}</span>`;
      list.appendChild(li);
    }
    $('mp-code-show').textContent = mp.code || '-----';
  };
  const roomView = () => {
    showEl('mp-pick', false); showEl('mp-room', true);
    const host = mp.role === 'host';
    showEl('mp-host-ctl', host); showEl('mp-wait', !host);
    renderLobby();
    if (!host) $('mp-wait').textContent = `Waiting for the host to start Free Class (${mp.difficulty === 'hard' ? 'HARD' : 'Easy'})…`;
    $('btn-mp-leave').textContent = host ? 'CLOSE THE CLASS' : 'LEAVE';
    labels();
  };
  const openMp = (code) => {
    backTo = 'title';
    go('mp');
    if (!$('mp-name').value) $('mp-name').value = savedName();
    if (code) $('mp-code').value = code;
    if (mp) roomView(); else { showEl('mp-pick', true); showEl('mp-room', false); mpStatus(''); }
  };
  const hooks = {
    lobby: () => { renderLobby(); if (mp && mp.role === 'guest') $('mp-wait').textContent = `Waiting for the host to start Free Class (${mp.difficulty === 'hard' ? 'HARD' : 'Easy'})…`; },
    lost: (msg) => { if (mp) { mp.leave(); mp = null; } labels(); toTitle(); openMp(); mpStatus(msg); },
    started: () => { go(null); ui.show('rotate', false); },
    toLobby: () => { toTitle(); openMp(); mpStatus('The host is picking the next class…', true); },
  };
  const quitGame = () => {
    if (mp && mp.role === 'host') { mp.backToLobby(); toTitle(); openMp(); return; }
    if (mp) { mp.leave(); mp = null; labels(); }
    toTitle();
  };
  $('btn-quit').onclick = quitGame;
  $('btn-menu').onclick = quitGame;
  $('btn-mp').onclick = () => { audio.unlock(); openMp(); };
  $('btn-host').onclick = async () => {
    audio.unlock();
    const name = mpName();
    mpStatus('Opening your class…', true);
    $('btn-host').disabled = true;
    try {
      mp = new MP(game, hooks);
      await mp.host(name);
      mpStatus('Send the code (or the invite link) to your friends.', true);
      roomView();
      showDifficulty();
    } catch (e) {
      if (mp) mp.leave();
      mp = null;
      mpStatus('Could not open a class: ' + ((e && (e.message || e.type)) || e));
    }
    $('btn-host').disabled = false;
  };
  $('btn-join').onclick = async () => {
    audio.unlock();
    const code = cleanCode($('mp-code').value);
    if (code.length !== 5) { mpStatus('Type the 5-letter class code.'); return; }
    const name = mpName();
    mpStatus('Joining…', true);
    $('btn-join').disabled = true;
    try {
      mp = new MP(game, hooks);
      await mp.join(code, name);
      roomView();
      mpStatus('You are in. Wait for the host to start the class.', true);
    } catch (e) {
      if (mp) mp.leave();
      mp = null;
      mpStatus((e && e.message) || 'Could not join that class.');
    }
    $('btn-join').disabled = false;
  };
  $('mp-code').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('btn-join').click(); });
  $('btn-copy').onclick = async () => {
    if (!mp) return;
    const url = location.origin + location.pathname + '?join=' + mp.code;
    try { await navigator.clipboard.writeText(url); mpStatus('Invite link copied. Paste it to your friends.', true); } catch (e) { mpStatus(url, true); }
  };
  $('btn-mp-go').onclick = () => {
    if (!mp || mp.role !== 'host') return;
    launch('free', 0); // online play is Free Class
  };
  // ---------------- difficulty (title screen and the host's lobby) ----------------
  const DIFF_NOTES = { easy: 'Easy: 3 strikes. He warns you before he comes over.', hard: 'Hard: one strike and you\'re out. If he SEES you whispering or on your phone, he comes right away.' };
  const showDifficulty = () => {
    const d = settings.difficulty === 'hard' ? 'hard' : 'easy';
    for (const [id, v] of [['btn-easy', 'easy'], ['btn-hard', 'hard'], ['mp-easy', 'easy'], ['mp-hard', 'hard']]) $(id).classList.toggle('on', d === v);
    $('diff-note').textContent = DIFF_NOTES[d];
    $('mp-diff-note').textContent = DIFF_NOTES[d];
    if (mp && mp.role === 'host') { mp.difficulty = d; mp.sendLobby(); }
  };
  const setDifficulty = (d) => { settings.difficulty = d; saveSettings(settings); showDifficulty(); };
  for (const [id, v] of [['btn-easy', 'easy'], ['btn-hard', 'hard'], ['mp-easy', 'easy'], ['mp-hard', 'hard']]) $(id).onclick = () => setDifficulty(v);
  showDifficulty();

  $('btn-mp-leave').onclick = () => { if (mp) { mp.leave(); mp = null; } labels(); go('title'); };
  addEventListener('pagehide', () => { if (mp) mp.leave(); }); // say goodbye when the tab closes

  // ---------------- settings ----------------
  const bindSetting = (id, key, apply, isCheck) => {
    const el = $(id);
    if (isCheck) el.checked = settings[key]; else el.value = settings[key];
    el.addEventListener('input', () => {
      settings[key] = isCheck ? el.checked : Number(el.value);
      apply(settings[key]);
      saveSettings(settings);
    });
  };
  bindSetting('set-sens', 'sens', (v) => (input.sens = v));
  bindSetting('set-vol', 'vol', (v) => audio.setVolume(v));
  bindSetting('set-retro', 'retro', () => resize(), true);
  bindSetting('set-meter', 'meter', (v) => (ui.meterOn = v), true);
  bindSetting('set-subs', 'subs', (v) => (ui.subsOn = v), true);
  bindSetting('set-shadows', 'shadows', (v) => {
    renderer.shadowMap.enabled = v;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => (m.needsUpdate = true)); });
  }, true);

  // ---------------- loop ----------------
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    game.tick(dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // in multiplayer the class must go on when this tab is in the background (the browser stops
  // drawing hidden tabs, but a worker's timer keeps running)
  try {
    const ticker = new Worker(URL.createObjectURL(new Blob(['setInterval(() => postMessage(0), 50);'], { type: 'text/javascript' })));
    ticker.onmessage = () => {
      if (!document.hidden || !game.mp) return;
      const now = performance.now();
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      game.tick(dt);
    };
  } catch (e) { /* no workers: a hidden host pauses the class */ }
  if (query.has('autostart')) {
    go(null);
    game.difficulty = query.get('diff') === 'hard' ? 'hard' : settings.difficulty === 'hard' ? 'hard' : 'easy';
    game.start(query.get('mode') || 'free', Number(query.get('ch') || 0));
  }
  else if (query.get('join')) openMp(cleanCode(query.get('join')));
}

boot().catch((e) => { console.error(e); ui.error('Could not start the game: ' + e.message); });
