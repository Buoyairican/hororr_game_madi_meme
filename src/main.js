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
import { Game } from './game.js';
import { preloadModels, instantiate } from './models.js';
import { CHAPTERS } from './data.js';

const ui = new UI();
window.addEventListener('error', (e) => ui.error('Something broke: ' + e.message));
window.addEventListener('unhandledrejection', (e) => ui.error('Something broke: ' + ((e.reason && e.reason.message) || e.reason)));

const query = new URLSearchParams(location.search);
const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
// phones get the cheapest settings by default
const DEFAULTS = { sens: 1, vol: 0.9, retro: true, meter: false, subs: true, shadows: !isTouch };
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('madiclass.settings') || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
function saveSettings(s) { try { localStorage.setItem('madiclass.settings', JSON.stringify(s)); } catch (e) { /* private mode */ } }
function progress() { try { return Number(localStorage.getItem('madiclass.progress') || 0); } catch (e) { return 0; } }
const settings = loadSettings();

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

// the class: [row, column, model, name]. Row 1 column 1 is Kevin's empty desk.
const KIDS = [[1, 0, 'kid_a', 'Leo'], [1, 2, 'kid_d', 'Ava'], [1, 4, 'kid_b', 'Omar'], [2, 1, 'kid_c', 'Maya'], [2, 3, 'kid_e', 'Jin'],
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
  const phone = new Phone(camera, portrait.image);
  const post = new PostFX(renderer);
  const audio = new AudioSys();
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
    game.state = 'paused';
    input.enable(false);
    if (audio.ctx) audio.ctx.suspend();
    backTo = 'pause';
    go('pause');
  };
  const resume = () => {
    go(null);
    game.state = 'playing';
    input.enable(true);
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
  $('btn-quit').onclick = toTitle;
  $('btn-again').onclick = () => { go(null); if (!game.endPrimary()) toTitle(); };
  $('btn-menu').onclick = toTitle;
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); });

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
  if (query.has('autostart')) { go(null); game.start(query.get('mode') || 'free', Number(query.get('ch') || 0)); }
}

boot().catch((e) => { console.error(e); ui.error('Could not start the game: ' + e.message); });
