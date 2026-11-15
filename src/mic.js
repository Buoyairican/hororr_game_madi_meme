// Phase 7: the microphone (optional, off by default, and off again every time the game starts).
// Turned on in SETTINGS, the browser asks first. Only how loud you are is measured, a number from 0 to 1,
// many times a second; no sound is recorded, kept or sent anywhere (online, a friend's browser sends
// the host that one number with the rest of what they do). Above a threshold he hears it like a whisper;
// a real laugh out loud counts (`mic_noise`) and may make him stop and ask what is so funny.
// Numbers and texts: MIC (src/data.js).
import { MIC } from './data.js';
import { clamp, damp, chance } from './util.js';

/**
 * One step of the level meter (pure, tested on its own). st: { level, amb } (amb: the steady background
 * noise, in dB, that slowly stops counting: a fan, a fridge). samples: the latest block of audio.
 * Returns the new level, 0..1.
 */
export function micStep(st, samples, dt) {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  const db = 20 * Math.log10(rms + 1e-9);
  if (!Number.isFinite(st.amb)) st.amb = MIC.floorDb;
  // the background: down at once, up only slowly (so a laugh hardly moves it, a fan does after a while)
  st.amb = db < st.amb ? Math.max(MIC.floorDb, db) : st.amb + (db - st.amb) * Math.min(1, MIC.floorRise * dt);
  const floor = Math.max(MIC.floorDb, st.amb + 3);
  const raw = clamp((db - floor) / (MIC.topDb - MIC.floorDb), 0, 1);
  st.level = damp(st.level || 0, raw, raw > (st.level || 0) ? MIC.attack : MIC.release, dt);
  return st.level;
}

/** how much noise he hears from a level (0 below the gate) */
export const micNoiseFrom = (level) => (level >= MIC.gate ? Math.min(1, MIC.minNoise + (level - MIC.gate) / (MIC.loud - MIC.gate) * (1 - MIC.minNoise)) : 0);

export const MicMixin = {
  setupMic() { this.mic = { on: false, level: 0, amb: MIC.floorDb, stream: null, src: null, an: null, buf: null }; },
  resetMicPlayer(p) { p.micRearm = 0; p.micHeard = false; },

  /** SETTINGS: turn it on (the browser asks) or off. Resolves to 'on', 'off', or why it could not: 'refused' |
   *  'missing' | 'insecure' | 'failed' (the keys of MIC.text) */
  async micSet(on) {
    const M = this.mic;
    if (!on) { this.micStop(); return 'off'; }
    if (M.on) return 'on';
    if (typeof window !== 'undefined' && window.isSecureContext === false) return 'insecure';
    const md = navigator.mediaDevices;
    if (!md || !md.getUserMedia) return window.isSecureContext === false ? 'insecure' : 'missing';
    let stream = null;
    try {
      stream = await md.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false }, video: false });
      if (!this.audio.ctx) this.audio.createContext();
      const ctx = this.audio.ctx;
      if (ctx.state === 'suspended') { try { await ctx.resume(); } catch (e) { /* it starts with the next click */ } }
      const src = ctx.createMediaStreamSource(stream);
      const an = ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(an); // (only to the meter: never to the speakers, never anywhere else)
      Object.assign(M, { on: true, level: 0, amb: MIC.floorDb, stream, src, an, buf: new Float32Array(an.fftSize) });
      for (const t of stream.getAudioTracks()) t.addEventListener('ended', () => { if (M.stream === stream) { this.micStop(); if (this.onMicLost) this.onMicLost(); } });
      return 'on';
    } catch (e) {
      if (stream) for (const t of stream.getTracks()) t.stop();
      const n = e && e.name;
      return n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError' ? 'refused'
        : n === 'NotFoundError' || n === 'OverconstrainedError' || n === 'DevicesNotFoundError' ? 'missing' : 'failed';
    }
  },
  micStop() {
    const M = this.mic;
    if (M.stream) for (const t of M.stream.getTracks()) t.stop();
    try { if (M.src) M.src.disconnect(); } catch (e) { /* already gone */ }
    Object.assign(M, { on: false, level: 0, stream: null, src: null, an: null, buf: null });
  },

  /** every frame (any role): your own level */
  micUpdate(dt) {
    const M = this.mic;
    if (!M.on || !M.an) { M.level = 0; return 0; }
    M.an.getFloatTimeDomainData(M.buf);
    return micStep(M, M.buf, dt);
  },

  /** host / solo, in playerActs: the noise this player's microphone makes (0 without one) */
  micNoise(p) {
    const lvl = p.local ? (this.mic.on ? this.mic.level : 0) : clamp(Number(p.in.mc) || 0, 0, 1);
    if (!(lvl >= MIC.gate) || p.ghost || this.cutscene || this.state !== 'playing') return 0;
    const n = micNoiseFrom(lvl);
    p.selfNoise = Math.max(p.selfNoise || 0, n); // (your own noise: on Hard, if he is looking right at you, that is a catch like a whisper)
    if (lvl >= MIC.loud && this.t >= (p.micRearm || 0)) {
      // a real laugh out loud
      p.micRearm = this.t + MIC.rearm;
      this.note(p, 'mic_noise'); this.track.event(this.t, p, 'mic');
      if (!p.micHeard) { p.micHeard = true; this.uiTo(p, 'hint', MIC.text.heard, 3); }
      if (this.present && this.brainIdle && chance(MIC.react) && this.canReactPrank()) this.interrupt(this.reactMic(p));
    }
    return n;
  },

  /** "What... is... so funny?" (he turns to you) */
  *reactMic(p) {
    const T = this.teacher;
    T.clap = null; T.setPose('rest'); T.moveTarget = null;
    T.lookAt(p.camPos, 8); T.facePoint(p.camPos, 4);
    yield* this.wait(0.5);
    yield* this.say('t_sofunny', 0.6);
    T.lookAt(null, 3);
  },
};
