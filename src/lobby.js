// Life in the online lobby (mixed into Game): what you hear while friends join.
// Mr. Madi stands at the classroom door behind the menu (the title screen) and watches the
// class fill up: a friend sits down ("Sit... down."; the 4th: "Now... everyone... is... here."),
// a friend who can't get in hears that nobody is coming, and a host who comes back from another
// app is told not to leave (a host whose game is not on screen can't let friends in).
// Every try to connect gives a soft ping. The sounds and lines are in ONLINE.lobby (src/data.js);
// they play only on this player's screen and never go over the network.
import * as THREE from 'three';
import { ONLINE } from './data.js';

export const LobbyMixin = {
  /** something happened in the lobby: play its sound, and maybe a line from him (not too often) */
  lobbyEvent(kind, o = {}) {
    const ev = ONLINE.lobby[kind];
    if (!ev || this.state !== 'title') return false;
    if (ev.sfx) this.audio.play(ev.sfx, { local: true, vol: ev.vol ?? 0.8, reverb: 0.15 });
    let line = (o.full && ev.fullLine) || ev.line;
    const now = this.titleT, next = this.lobbyNext || (this.lobbyNext = {});
    // one line at a time, and each kind of line not too often
    if (line && now >= (this.lobbyQuiet || 0) && now >= (next[kind] || 0)) {
      const delay = ev.sfx ? 0.45 : 0;
      const h = this.lobbySay(line, delay);
      this.lobbyQuiet = now + delay + (h ? h.duration : 2) + 0.8;
      next[kind] = now + (ev.gap || 6);
    } else line = null;
    // what happened here, newest last (the tests read it)
    this.lobbyLog = (this.lobbyLog || []).concat({ kind, sfx: ev.sfx || null, line }).slice(-20);
    return true;
  },

  /** he says a line from the door (3D, his jaw moves, the words show under the lobby if subtitles are on) */
  lobbySay(id, delay = 0) {
    const meta = this.audio.voices[id];
    const h = this.audio.say(id, { pos: this.teacher.headWorld(new THREE.Vector3()), ref: 2.4, vol: 1.25, reverb: 0.35, delay, local: true });
    const dur = h ? h.duration : 2;
    this.lobbyVoice = { from: this.titleT + delay, until: this.titleT + delay + dur };
    if (meta) this.ui.lobbyLine(meta.text, delay + dur + 1.6);
    return h;
  },

  /** how far his jaw opens right now (titleTick) */
  lobbyTalk() {
    const v = this.lobbyVoice, t = this.titleT;
    return v && t >= v.from && t < v.until ? 0.5 + 0.5 * Math.abs(Math.sin(t * 11) * Math.sin(t * 4.3 + 1)) : 0;
  },
};
