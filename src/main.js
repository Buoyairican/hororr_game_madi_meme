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

const ui = new UI();
window.addEventListener('error', (e) => ui.error('Something broke: ' + e.message));
window.addEventListener('unhandledrejection', (e) => ui.error('Something broke: ' + ((e.reason && e.reason.message) || e.reason)));

const query = new URLSearchParams(location.search);
const DEFAULTS = { sens: 1, vol: 0.9, retro: true, meter: true, subs: true, shadows: true };
function loadSettings() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem('deadstare.settings') || '{}') }; } catch (e) { return { ...DEFAULTS }; }
}
function saveSettings(s) { try { localStorage.setItem('deadstare.settings', JSON.stringify(s)); } catch (e) { /* private mode */ } }
const settings = loadSettings();

const withTimeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(r, ms))]);

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
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.03, 60);
  camera.rotation.order = 'YXZ';
  scene.add(camera);

  ui.progress(0.04, 'painting the walls&hellip;');
  await withTimeout(Promise.all([document.fonts.load('700 54px Caveat'), document.fonts.load('20px "Special Elite"')]), 4000);
  const world = buildWorld(scene, renderer);
  const tl = new THREE.TextureLoader();
  const [face, eyes, portrait] = await Promise.all(['teacher_face.jpg', 'teacher_eyes.jpg', 'teacher_portrait.jpg'].map((f) => tl.loadAsync('assets/textures/' + f)));
  face.colorSpace = THREE.SRGBColorSpace;
  portrait.colorSpace = THREE.SRGBColorSpace;
  face.anisotropy = 4;
  const teacher = new Teacher(face, eyes);
  scene.add(teacher.root);
  const seat = (r, c) => world.seats.find((s) => s.row === r && s.col === c);
  const friends = [new Classmate('sam', seat(0, 1)), new Classmate('nora', seat(0, 3))];
  const students = [[1, 0], [1, 2], [1, 4], [2, 1], [2, 3], [3, 0], [3, 2], [3, 4]].map(([r, c]) => new Classmate('blank', seat(r, c)));
  for (const c of [...friends, ...students]) scene.add(c.root);
  const phone = new Phone(camera, portrait.image);
  const post = new PostFX(renderer);
  const audio = new AudioSys();
  const input = new Input(canvas);
  if (input.touch) document.body.classList.add('touch');
  input.sens = settings.sens;
  input.bindButton(document.getElementById('btn-talk'), 'talk');
  input.bindButton(document.getElementById('btn-phone'), 'phone');

  ui.progress(0.12, 'tuning the whispers&hellip;');
  await audio.load((p) => ui.progress(0.12 + p * 0.83, p < 0.5 ? 'tuning the whispers&hellip;' : 'sharpening the chalk&hellip;'));
  audio.setVolume(settings.vol);

  const game = new Game({ renderer, scene, camera, post, audio, ui, input, world, teacher, friends, students, phone, portraitTex: portrait });
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
  const titlePose = () => { teacher.place(0.35, -5.1, 0); teacher.lookAt(game.camPos, 4); };
  titlePose();
  let musicOn = false;
  const startTitleAudio = () => {
    audio.unlock();
    if (musicOn || game.state !== 'title') return;
    musicOn = true;
    audio.fadeBus('music', 1, 0.3);
    audio.fadeBus('amb', 0.6, 0.5);
    audio.startAmbience(new THREE.Vector3(0, 3, -2), new THREE.Vector3(-5.5, 1.8, -1));
    game.titleMusic = audio.play('music_box', { loop: true, bus: 'music', vol: 0.55, reverb: 0.35 });
  };
  document.getElementById('title').addEventListener('pointerdown', startTitleAudio);

  // warm up shaders so the first seconds don't stutter
  renderer.compile(scene, camera);
  ui.progress(1, 'ready.');
  ui.show('loading', false);
  ui.show('menu', true);

  // ---------------- menus ----------------
  let backTo = 'title';
  const $ = (id) => document.getElementById(id);
  const go = (id) => ui.screen(id);
  const startGame = () => {
    audio.unlock();
    if (input.touch && innerHeight > innerWidth && !startGame.rotateOk) {
      ui.show('rotate', true);
      return;
    }
    ui.show('rotate', false);
    musicOn = false;
    game.start();
  };
  $('btn-start').onclick = startGame;
  $('btn-rotate-ok').onclick = () => { startGame.rotateOk = true; startGame(); };
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
    game.reset();
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
  $('btn-restart').onclick = () => { if (audio.ctx) audio.ctx.resume(); go(null); game.start(); };
  $('btn-quit').onclick = toTitle;
  $('btn-again').onclick = () => { go(null); game.start(); };
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
  if (query.has('autostart')) { go(null); game.start(); }
}

boot().catch((e) => { console.error(e); ui.error('Could not start the game: ' + e.message); });
