// Web Audio engine: buffers, 3D (HRTF) sources, reverb bus and live
// synthesized ambience (fluorescent hum, dread drone, room tone, heartbeat).
import * as THREE from 'three';
import { clamp, lerp } from './util.js';

export const SFX = [
  'clap_1', 'clap_2', 'clap_3', 'clap_big', 'chalk_1', 'chalk_2', 'chalk_3', 'chalk_4', 'chalk_screech', 'chalk_tap',
  'erase', 'bell', 'scream', 'stinger_1', 'stinger_2', 'stinger_swell', 'sub_hit', 'breath', 'thunder', 'rain_loop',
  'whispers_loop', 'music_box', 'chair_scrape', 'door_slam', 'glitch', 'heartbeat', 'neck_crack', 'lights_off', 'zap',
  'paper', 'whoosh', 'book_drop', 'ringtone', 'phone_buzz',
  'step_1', 'step_2', 'step_3', 'step_4', 'keys_1', 'keys_2', 'keys_3', 'key_enter', 'lid_slam', 'door_open', 'giggle', 'gasp',
  'projector_on', 'wipe', 'ding', 'page',
  'm_snore', 'm_boom', 'm_fart', 'm_airhorn', 'm_trombone', 'm_scratch', 'm_crickets', 'm_dun', 'm_pipe', 'm_honk', 'm_slide', 'desk_slap',
];

const _v = new THREE.Vector3();
const _f = new THREE.Vector3();
const _u = new THREE.Vector3();

export class AudioSys {
  constructor(base = 'assets/audio/') {
    this.base = base;
    this.buffers = {};
    this.voices = {};
    this.ctx = null;
    this.volume = 0.9;
    this.active = new Set();
    this.tension = 0;
    this.fear = 0;
    this.hbTimer = 0;
  }

  createContext() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC({ latencyHint: 'interactive' });
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = this.volume;
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -10; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
    this.master.connect(comp); comp.connect(c.destination);
    this.buses = {};
    for (const b of ['sfx', 'voice', 'amb', 'music']) {
      const g = c.createGain(); g.connect(this.master); this.buses[b] = g;
    }
    this.reverb = c.createConvolver();
    this.reverb.buffer = this.makeImpulse(2.4, 2.6);
    this.reverbIn = c.createGain(); this.reverbIn.gain.value = 1;
    const ret = c.createGain(); ret.gain.value = 0.8;
    this.reverbIn.connect(this.reverb); this.reverb.connect(ret); ret.connect(this.master);
    this.noiseBuf = this.makeNoise(2);
    this.tickBuf = this.makeTick();
  }

  makeImpulse(seconds, decay) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const t = i / len;
        const n = Math.random() * 2 - 1;
        lp += (n - lp) * (0.9 - 0.75 * t); // darker as it decays
        d[i] = lp * Math.pow(1 - t, decay) * (i < 30 ? 0 : 1);
      }
    }
    return buf;
  }

  makeNoise(seconds) {
    const c = this.ctx, len = Math.floor(c.sampleRate * seconds);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  makeTick() {
    const c = this.ctx, len = Math.floor(c.sampleRate * 0.03);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const t = i / c.sampleRate;
      d[i] = (Math.sin(2 * Math.PI * 2900 * t) * 0.6 + (Math.random() * 2 - 1) * 0.4) * Math.exp(-t / 0.003);
    }
    return buf;
  }

  decode(ab) {
    return new Promise((res, rej) => {
      const p = this.ctx.decodeAudioData(ab, res, rej);
      if (p && p.then) p.then(res, rej);
    });
  }

  async load(onProgress) {
    this.createContext();
    const vj = await fetch(this.base + 'voices.json').then((r) => r.json());
    this.voices = vj;
    const jobs = [
      ...Object.keys(vj).map((k) => [k, this.base + 'voice/' + k + '.mp3']),
      ...SFX.map((k) => [k, this.base + 'sfx/' + k + '.mp3']),
    ];
    let done = 0;
    const worker = async () => {
      while (jobs.length) {
        const [k, url] = jobs.shift();
        try {
          const ab = await fetch(url).then((r) => { if (!r.ok) throw new Error(url + ' ' + r.status); return r.arrayBuffer(); });
          this.buffers[k] = await this.decode(ab);
        } catch (e) {
          console.warn('audio load failed', k, e);
        }
        done++;
        onProgress && onProgress(done / (Object.keys(vj).length + SFX.length));
      }
    };
    await Promise.all([worker(), worker(), worker(), worker(), worker(), worker()]);
  }

  /** must be called from a user gesture (click / touchend) */
  unlock() {
    if (!this.ctx) this.createContext();
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
    if (this.ctx.state !== 'running') this.ctx.resume();
    const b = this.ctx.createBuffer(1, 1, 22050);
    const s = this.ctx.createBufferSource();
    s.buffer = b; s.connect(this.ctx.destination); s.start(0);
  }

  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  }

  makePanner(pos, refDistance = 1.2) {
    const p = this.ctx.createPanner();
    p.panningModel = 'HRTF';
    p.distanceModel = 'inverse';
    p.refDistance = refDistance;
    p.maxDistance = 40;
    p.rolloffFactor = 1.1;
    this.setPannerPos(p, pos);
    return p;
  }

  setPannerPos(p, pos) {
    if (p.positionX) { p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; }
    else p.setPosition(pos.x, pos.y, pos.z);
  }

  /**
   * Play a decoded buffer.
   * opts: vol, rate, pos (Vector3 -> 3D), reverb (send 0..1), bus, loop, delay, lowpass, ref
   */
  play(name, opts = {}) {
    const c = this.ctx;
    const buf = this.buffers[name];
    if (!c || !buf) return null;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate ?? 1;
    src.loop = !!opts.loop;
    const g = c.createGain();
    g.gain.value = opts.vol ?? 1;
    let node = src;
    let filter = null;
    if (opts.lowpass) {
      filter = c.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = opts.lowpass;
      node.connect(filter); node = filter;
    }
    node.connect(g);
    let out = g;
    let panner = null;
    if (opts.pos) { panner = this.makePanner(opts.pos, opts.ref ?? 1.2); g.connect(panner); out = panner; }
    out.connect(this.buses[opts.bus || 'sfx']);
    const rv = opts.reverb ?? 0.2;
    if (rv > 0) { const s = c.createGain(); s.gain.value = rv; out.connect(s); s.connect(this.reverbIn); }
    src.start(c.currentTime + (opts.delay || 0), opts.offset || 0);
    const h = {
      name, src, gain: g, panner, filter, ended: false,
      duration: buf.duration / (opts.rate ?? 1),
      stop: (fade = 0.05) => {
        if (h.ended) return;
        try {
          g.gain.setTargetAtTime(0, c.currentTime, fade / 3);
          src.stop(c.currentTime + fade + 0.02);
        } catch (e) { /* already stopped */ }
        h.ended = true;
      },
      setPos: (v) => panner && this.setPannerPos(panner, v),
      setVol: (v, t = 0.05) => g.gain.setTargetAtTime(v, c.currentTime, t),
    };
    src.onended = () => { h.ended = true; this.active.delete(h); };
    this.active.add(h);
    return h;
  }

  /** speak a voice line; returns handle (with .text, .who) */
  say(id, opts = {}) {
    const meta = this.voices[id];
    const h = this.play(id, { bus: 'voice', reverb: 0.3, ...opts });
    if (h && meta) { h.text = meta.text; h.who = meta.who; }
    return h;
  }

  tone(freq, dur, { type = 'sine', vol = 0.1, pos = null, slide = 0, bus = 'sfx' } = {}) {
    const c = this.ctx;
    if (!c) return;
    const o = c.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + dur);
    const g = c.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(vol, c.currentTime, 0.004);
    g.gain.setTargetAtTime(0, c.currentTime + dur * 0.7, dur * 0.15);
    o.connect(g);
    if (pos) { const p = this.makePanner(pos); g.connect(p); p.connect(this.buses[bus]); } else g.connect(this.buses[bus]);
    o.start(); o.stop(c.currentTime + dur + 0.3);
  }

  tick(pos) {
    const c = this.ctx;
    if (!c) return;
    const s = c.createBufferSource(); s.buffer = this.tickBuf;
    const g = c.createGain(); g.gain.value = 0.25;
    const p = this.makePanner(pos, 0.8);
    s.connect(g); g.connect(p); p.connect(this.buses.amb);
    const r = c.createGain(); r.gain.value = 0.15; p.connect(r); r.connect(this.reverbIn);
    s.start();
  }

  /** looping synthesized + sampled ambience for the classroom */
  startAmbience(hum, rainPos) {
    const c = this.ctx;
    if (!c || this.amb) return;
    const a = {};
    // room tone
    const rt = c.createBufferSource(); rt.buffer = this.noiseBuf; rt.loop = true;
    const rtf = c.createBiquadFilter(); rtf.type = 'lowpass'; rtf.frequency.value = 260;
    const rtg = c.createGain(); rtg.gain.value = 0.05;
    rt.connect(rtf); rtf.connect(rtg); rtg.connect(this.buses.amb); rt.start();
    // fluorescent hum (positioned at the ceiling lights)
    const o1 = c.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 120;
    const o2 = c.createOscillator(); o2.type = 'sine'; o2.frequency.value = 240;
    const hf = c.createBiquadFilter(); hf.type = 'bandpass'; hf.frequency.value = 480; hf.Q.value = 1.4;
    a.humGain = c.createGain(); a.humGain.gain.value = 0.05;
    o1.connect(hf); o2.connect(a.humGain); hf.connect(a.humGain);
    const hp = this.makePanner(hum, 1.5);
    a.humGain.connect(hp); hp.connect(this.buses.amb);
    o1.start(); o2.start();
    // dread drone
    a.droneFilter = c.createBiquadFilter(); a.droneFilter.type = 'lowpass'; a.droneFilter.frequency.value = 140; a.droneFilter.Q.value = 3;
    a.droneGain = c.createGain(); a.droneGain.gain.value = 0.05;
    for (const [f, type] of [[55, 'sawtooth'], [55.35, 'sawtooth'], [41.2, 'sine'], [82.6, 'triangle']]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f;
      o.connect(a.droneFilter); o.start();
    }
    a.droneFilter.connect(a.droneGain); a.droneGain.connect(this.buses.amb);
    // high dissonant shimmer for tension
    a.shimmer = c.createGain(); a.shimmer.gain.value = 0;
    const trem = c.createOscillator(); trem.frequency.value = 5.3;
    const tremG = c.createGain(); tremG.gain.value = 0.5;
    const shimmerAmp = c.createGain(); shimmerAmp.gain.value = 0.5;
    trem.connect(tremG); tremG.connect(shimmerAmp.gain); trem.start();
    for (const f of [1244.5, 1318.5, 1396.9]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; o.connect(shimmerAmp); o.start();
    }
    shimmerAmp.connect(a.shimmer); a.shimmer.connect(this.buses.amb);
    const sr = c.createGain(); sr.gain.value = 0.4; a.shimmer.connect(sr); sr.connect(this.reverbIn);
    // rain on the windows + whisper bed
    // (local: every player runs their own ambience)
    a.rain = this.play('rain_loop', { loop: true, vol: 0.32, pos: rainPos, ref: 3, reverb: 0.05, bus: 'amb', lowpass: 3200, local: true });
    a.whispers = this.play('whispers_loop', { loop: true, vol: 0.0, pos: new THREE.Vector3(0, 1.4, 2), ref: 1, reverb: 0.4, bus: 'amb', local: true });
    a.whisperAngle = 0;
    this.amb = a;
  }

  stopAmbience() {
    if (!this.amb) return;
    // simplest: rebuild the ambience bus
    const old = this.buses.amb;
    old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
    setTimeout(() => old.disconnect(), 600);
    const g = this.ctx.createGain(); g.connect(this.master); this.buses.amb = g;
    this.amb = null;
  }

  /** fade a bus (silence before a scare, etc.) */
  fadeBus(bus, v, t = 0.3) {
    if (!this.ctx) return;
    this.buses[bus].gain.setTargetAtTime(v, this.ctx.currentTime, t / 3);
  }

  stopAll() {
    for (const h of this.active) h.stop(0.08);
    this.active.clear();
  }

  updateListener(camera) {
    const c = this.ctx;
    if (!c) return;
    const l = c.listener;
    camera.getWorldPosition(_v);
    camera.getWorldDirection(_f);
    _u.set(0, 1, 0).applyQuaternion(camera.quaternion);
    if (l.positionX) {
      l.positionX.value = _v.x; l.positionY.value = _v.y; l.positionZ.value = _v.z;
      l.forwardX.value = _f.x; l.forwardY.value = _f.y; l.forwardZ.value = _f.z;
      l.upX.value = _u.x; l.upY.value = _u.y; l.upZ.value = _u.z;
    } else {
      l.setPosition(_v.x, _v.y, _v.z);
      l.setOrientation(_f.x, _f.y, _f.z, _u.x, _u.y, _u.z);
    }
  }

  /** per frame: drone + heartbeat follow tension/fear (0..1) */
  update(dt, camPos, { tension = 0, fear = 0, whispers = 0, humLevel = 1 } = {}) {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const a = this.amb;
    this.tension = lerp(this.tension, tension, 1 - Math.exp(-2 * dt));
    this.fear = lerp(this.fear, fear, 1 - Math.exp(-3 * dt));
    a.droneFilter.frequency.setTargetAtTime(110 + this.tension * 700, t, 0.2);
    a.droneGain.gain.setTargetAtTime(0.045 + this.tension * 0.13, t, 0.3);
    a.shimmer.gain.setTargetAtTime(Math.pow(this.tension, 2.2) * 0.022, t, 0.4);
    a.humGain.gain.setTargetAtTime(0.05 * humLevel, t, 0.02);
    if (a.whispers) {
      a.whispers.setVol(whispers * 0.55, 0.5);
      a.whisperAngle += dt * 0.35;
      _v.set(camPos.x + Math.cos(a.whisperAngle) * 1.6, camPos.y + 0.2, camPos.z + Math.sin(a.whisperAngle) * 1.6);
      a.whispers.setPos(_v);
    }
    // heartbeat
    if (this.fear > 0.22) {
      this.hbTimer -= dt;
      if (this.hbTimer <= 0) {
        this.hbTimer = lerp(1.15, 0.4, clamp((this.fear - 0.22) / 0.78, 0, 1));
        this.play('heartbeat', { vol: 0.25 + this.fear * 0.75, reverb: 0, bus: 'sfx', local: true });
      }
    }
  }
}
