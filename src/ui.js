// DOM overlay: HUD, subtitles, hints, objectives, choices, menus.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'score-val', 'eye', 'eye-label', 'anger', 'anger-fill', 'clock-hud', 'prompt', 'hint', 'call-left', 'call-right', 'phone-alert',
      'subtitle', 'toast', 'blackout', 'flash', 'note', 'note-text', 'title', 'loading', 'load-fill', 'load-text', 'menu', 'how', 'settings',
      'pause', 'end', 'end-title', 'end-text', 'end-stats', 'rotate', 'err', 'crosshair', 'objectives', 'strikes', 'bully', 'echo-cue', 'echo-bar',
      'choices', 'choices-title', 'choices-list', 'choices-bar', 'card', 'card-time', 'card-title', 'card-sub', 'chapters', 'chapter-list', 'btn-again', 'btn-echo', 'mp',
      'laugh', 'laugh-fill', 'laugh-mult', 'aim-hud', 'aim-kind', 'aim-pow-fill', 'quirks', 'ev-now', 'sneak-hud', 'sneak-label', 'sneak-fill', 'notebook', 'ghost-hud', 'ghost-veil', 'ghost-left', 'ghost-haunts']) this.el[id] = $(id);
    this.subTimer = 0;
    this.hintTimer = 0;
    this.toastTimer = 0;
    this.cardTimer = 0;
    this.subsOn = true;
    this.meterOn = true;
    this.lastPrompt = '';
    this.noteOpen = false;
    this.cache = {};
    this.el.note.addEventListener('click', () => this.closeNote());
    this.el.note.addEventListener('touchend', (e) => { e.preventDefault(); this.closeNote(); });
  }

  show(id, on = true) { this.el[id].classList.toggle('hidden', !on); }
  /** what Mr. Madi says in the online lobby (he stands at the door behind the menu) */
  lobbyLine(text, dur = 3) {
    const el = $('mp-madi');
    if (!el) return;
    clearTimeout(this.lobbyTimer);
    if (!text || !this.subsOn) { el.classList.remove('on'); return; }
    el.innerHTML = `<span class="who">MR. MADI</span> ${text}`;
    el.classList.add('on');
    this.lobbyTimer = setTimeout(() => el.classList.remove('on'), dur * 1000);
  }
  screen(id) {
    for (const s of ['title', 'how', 'settings', 'pause', 'end', 'chapters', 'mp', 'notebook']) this.show(s, s === id);
  }

  /** only touch the DOM when a value actually changes */
  set(key, v, fn) { if (this.cache[key] !== v) { this.cache[key] = v; fn(v); } }

  progress(p, text) {
    this.el['load-fill'].style.width = Math.round(p * 100) + '%';
    if (text) this.el['load-text'].innerHTML = text;
  }

  setScore(v) { this.set('score', Math.floor(v), (x) => (this.el['score-val'].textContent = x)); }
  setClock(s) { this.set('clock', s, (x) => (this.el['clock-hud'].textContent = x)); }
  /** the LAUGHS meter (0..100): the class laughing at your pranks multiplies your mischief */
  setLaugh(v) {
    const n = Math.round(v);
    this.set('laugh', n, (x) => {
      this.el.laugh.classList.toggle('off', x < 1);
      this.el['laugh-fill'].style.width = x + '%';
      this.el['laugh-mult'].textContent = x >= 5 ? '×' + (1 + x / 100).toFixed(1) : '';
    });
  }
  /** aiming a paper: what you hold and how hard you will throw (null hides it) */
  aim(name, power = 0, ready = true) {
    const on = !!name;
    this.set('aimOn', on, () => this.el['aim-hud'].classList.toggle('show', on));
    if (!on) return;
    // (the laser pointer and the KICK ME note have no power: power null hides the bar; not ready = out of reach)
    const bar = power !== null;
    this.set('aimBar', bar, () => this.el['aim-hud'].classList.toggle('nobar', !bar));
    this.set('aimKind', name + (ready ? '' : bar ? ' (folding…)' : ''), (x) => (this.el['aim-kind'].textContent = x));
    this.set('aimReady', !!ready, (x) => this.el['aim-hud'].classList.toggle('dim', !x));
    if (bar) this.set('aimPow', Math.round(power * 20), (x) => (this.el['aim-pow-fill'].style.width = x * 5 + '%'));
  }
  /** the BREATH meter (src/dread.js): the air you have left, and what to do while he listens at your desk.
   *  v: 0..1 (null hides it); mode: '' | 'hold' (hold your breath now!) | 'still' (you are holding it: don't move) | 'out' (gasping) */
  breath(v, mode = '', label = '') {
    const el = this.el['breath-hud'] || (this.el['breath-hud'] = $('breath-hud'));
    if (!el) return;
    const on = v !== null && v !== undefined;
    this.set('breathOn', on, () => el.classList.toggle('show', on));
    this.set('breathMode', on ? mode : '', (m) => {
      el.classList.toggle('lean', m === 'hold' || m === 'still'); el.classList.toggle('now', m === 'hold'); el.classList.toggle('out', m === 'out');
      const btn = $('btn-breath');
      if (btn) btn.classList.toggle('ready', m === 'hold');
    });
    if (!on) return;
    this.set('breathV', Math.round(v * 50), (x) => { $('breath-fill').style.width = x * 2 + '%'; el.classList.toggle('low', x < 13); });
    this.set('breathLabel', label, (x) => ($('breath-label').innerHTML = x));
  }
  setEye(state) {
    this.set('eye', state, (st) => {
      this.el.eye.setAttribute('class', st === 'closed' ? '' : st);
      this.el['eye-label'].textContent = { open: 'WATCHING', blind: "CAN'T SEE", busy: 'TYPING', asleep: 'ASLEEP', dance: 'DANCING', half: 'HALF BLIND', away: '', closed: '' }[st] || '';
    });
  }
  /** off your chair: how close he is to seeing you (null hides it) */
  sneak(st) {
    const on = !!st, el = this.el['sneak-hud'];
    if (!el) return;
    this.set('snOn', on, () => el.classList.toggle('show', on));
    if (!on) return;
    this.set('snCls', st.cls, (c) => { el.className = 'show ' + c; });
    this.set('snLabel', st.label, (x) => (this.el['sneak-label'].textContent = x));
    this.set('snK', Math.round(st.k * 50), (x) => (this.el['sneak-fill'].style.width = x * 2 + '%'));
  }
  /** a ghost in the corner (src/ghost.js): { left, back, h: [{ name, wait }] }, or null */
  ghost(st) {
    const on = !!st;
    this.set('ghOn', on, () => { this.el['ghost-hud'].classList.toggle('show', on); this.el['ghost-veil'].classList.toggle('show', on); document.body.classList.toggle('ghosting', on); });
    if (!on) return;
    this.set('ghLeft', st.back ? -1 : st.left, (x) => (this.el['ghost-left'].textContent = x < 0 ? '· back to your seat' : `0:${String(x).padStart(2, '0')}`));
    const key = st.h.map((h) => h.wait).join(',');
    this.set('ghH', key, () => {
      this.el['ghost-haunts'].innerHTML = st.h.map((h, i) => `<span class="h${h.wait !== 0 ? ' wait' : ''}"><kbd class="desk-only">${i + 1}</kbd>${h.name}${h.wait > 0 ? ' ' + h.wait : ''}</span>`).join('');
    });
  }
  /** the chaos scoreboard on the end screen (online; null clears it) */
  chaos(html) {
    const el = $('end-chaos');
    if (el) el.innerHTML = html || '';
  }
  /** the SEAT / SIT button on a phone ('' hides it) */
  seatButton(label) {
    this.seatKey = !!label;
    this.cache.phonectl = null; // (the key legend lists C now)
    const b = $('btn-seat');
    if (!b) return;
    b.classList.toggle('hidden', !label);
    if (label) b.textContent = label;
  }
  /** what kind of teacher he is today (his quirks you have noticed): small tags under the tasks */
  setQuirks(list) {
    const l = Array.isArray(list) ? list.filter((x) => typeof x === 'string').slice(0, 4) : [];
    this.quirkList = l;
    this.el.quirks.innerHTML = l.map((q) => `<span class="q">${q.replace(/[<>&"]/g, '')}</span>`).join('');
    this.el.quirks.classList.toggle('off', !l.length);
  }
  /** what is going on in class right now (one of today's events), under his eye ('' hides it) */
  setEventNow(text) {
    this.set('evNow', text || '', (x) => { this.el['ev-now'].textContent = x; this.el['ev-now'].classList.toggle('off', !x); });
  }
  setAnger(v) {
    const vis = this.meterOn ? 'visible' : 'hidden';
    this.el.anger.style.visibility = vis;
    this.el.eye.style.visibility = vis;
    this.el['eye-label'].style.visibility = vis;
    this.set('anger', Math.round(v), (x) => (this.el['anger-fill'].style.width = x + '%'));
  }
  setStrikes(n, max) {
    this.set('strikes', n + '/' + max, () => { let h = ''; for (let i = 0; i < max; i++) h += `<span class="${i < n ? 'on' : ''}">✗</span>`; this.el.strikes.innerHTML = h; });
  }
  setBully(echo, q) {
    this.set('bully', echo + ',' + q, () => {
      const dots = (n, max) => '●'.repeat(Math.min(n, max)) + '○'.repeat(Math.max(0, max - n));
      const parts = [];
      if (echo >= 0) parts.push(`ECHO <b>${dots(echo, 3)}</b>`);
      if (q >= 0) parts.push(`QUESTIONS <b>${dots(q, 4)}</b>`);
      this.el.bully.innerHTML = parts.join('<br>');
    });
  }
  echoCue(k, touch) {
    const on = k >= 0;
    this.set('echo', on, () => { this.el['echo-cue'].classList.toggle('show', on); if (this.el['btn-echo']) this.el['btn-echo'].classList.toggle('ready', on); });
    if (on) this.el['echo-bar'].style.width = Math.round(k * 100) + '%';
  }

  setObjectives(list) {
    const before = this.shownTasks || new Set();
    this.shownTasks = new Set(list.map((o) => o.text));
    // a task that just appeared glows for a moment so you notice it
    this.el.objectives.innerHTML = list.map((o) => `<li class="${o.done ? 'done' : before.has(o.text) ? '' : 'new'}">${o.text}</li>`).join('');
  }

  card(ch) {
    this.el['card-time'].textContent = ch.time;
    this.el['card-title'].textContent = ch.title;
    this.el['card-sub'].textContent = ch.sub;
    const c = this.el.card;
    c.classList.add('hidden'); void c.offsetWidth; c.classList.remove('hidden');
    this.cardTimer = 4.3;
  }

  openChoices(title, labels, touch, onPick) {
    this.el['choices-title'].textContent = title + (touch ? '' : '  (press 1–' + labels.length + ')');
    const list = this.el['choices-list'];
    list.innerHTML = '';
    labels.forEach((l, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<span class="n">${i + 1}</span>${l}`;
      const go = (e) => { e.preventDefault(); e.stopPropagation(); onPick(i); };
      b.addEventListener('click', go);
      b.addEventListener('touchend', go, { passive: false });
      list.appendChild(b);
    });
    this.show('choices', true);
    this.el.hint.classList.remove('show'); this.hintTimer = 0; // nothing behind the picker
  }
  closeChoices() { this.show('choices', false); }
  choiceTimer(k) { this.el['choices-bar'].style.width = Math.round(k * 100) + '%'; }

  prompt(text) {
    if (text === this.lastPrompt) return;
    this.lastPrompt = text;
    this.el.prompt.textContent = text;
  }

  hint(text, dur = 5) {
    this.el.hint.innerHTML = text;
    this.el.hint.classList.add('show');
    this.hintTimer = dur;
    this.hintSeq = (this.hintSeq || 0) + 1; // (a new hint went up: src/events.js lets each one be read)
  }

  toast(text, dur = 3) {
    this.el.toast.innerHTML = text;
    this.el.toast.classList.add('show');
    this.toastTimer = dur;
  }

  subtitle(who, text, cls = '', dur = 3) {
    if (!this.subsOn) return;
    const name = who === 'you' ? 'YOU' : who;
    const label = name ? `<span class="who">${name}</span><br>` : '';
    this.el.subtitle.innerHTML = `${label}<span class="${cls}">${text}</span>`;
    this.el.subtitle.style.opacity = 1;
    this.subTimer = dur;
  }

  call(side, on) { this.set('call' + side, on, () => this.el[side === 'left' ? 'call-left' : 'call-right'].classList.toggle('show', on)); }
  phoneAlert(on) { this.el['phone-alert'].classList.toggle('show', on); }
  /** with the phone up the keys (and touch buttons) work the phone instead */
  phoneControls(mode, touch) {
    this.set('phonectl', mode || '', () => {
      const lg = document.getElementById('keys-legend');
      const T = document.getElementById('btn-talk'), A = document.getElementById('btn-ask'), E = document.getElementById('btn-echo');
      if (lg && this.legendHtml == null) this.legendHtml = lg.innerHTML;
      const tb = document.getElementById('touch-buttons');
      if (tb) { tb.classList.toggle('out', mode === 'out'); tb.classList.toggle('ghost', mode === 'ghost'); }
      if (mode === 'ghost') {
        // a ghost in the corner (src/ghost.js): ECHO / ASK / TALK are the three haunts
        if (lg) lg.innerHTML = '<kbd>1</kbd> lights · <kbd>2</kbd> the chair · <kbd>3</kbd> the book · look around';
        if (T) T.textContent = 'BOOK'; if (A) A.textContent = 'CHAIR'; if (E) E.textContent = 'LIGHT';
        return;
      }
      if (mode === 'out') {
        // off your chair: the stick crawls, TALK is USE (his desk), SIT sits you back down
        if (lg) lg.innerHTML = '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> crawl · hold <kbd>E</kbd> use · <kbd>C</kbd> at your desk: sit down';
        if (T) T.textContent = 'USE'; if (A) A.textContent = 'ASK'; if (E) E.textContent = 'ECHO';
        return;
      }
      if (!mode) {
        if (lg) lg.innerHTML = this.legendHtml + (this.seatKey ? ' · <kbd>C</kbd> sneak' : '');
        if (T) T.textContent = 'TALK'; if (A) A.textContent = 'ASK'; if (E) E.textContent = 'ECHO';
        return;
      }
      if (mode.startsWith('aim')) {
        // aiming a paper: let go to throw; the other buttons switch ball / plane or put it away
        const kind = mode.slice(4);
        if (lg) {
          lg.innerHTML = (kind === 'laser' ? 'let go of <kbd>G</kbd>: laser off' : kind === 'note' ? 'let go of <kbd>G</kbd> behind him: stick it on' : 'let go of <kbd>G</kbd> to throw')
            + ' · <kbd>X</kbd> / wheel: switch · <kbd>E</kbd> put it away';
        }
        if (T) T.textContent = 'DROP';
        if (A) A.textContent = { ball: 'BALL', plane: 'PLANE', laser: 'LASER', note: 'NOTE' }[kind] || kind.toUpperCase(); // (unlocked pranks: SPIT, BAND, BOMB)
        if (E) E.textContent = 'SWAP';
        return;
      }
      if (lg) {
        lg.innerHTML = mode === 'game' ? '<kbd>E</kbd> / <kbd>SPACE</kbd> / click: fly · <kbd>T</kbd> meme app · let go of <kbd>Q</kbd> to hide it'
          : mode === 'memes' ? '<kbd>E</kbd> next video · <kbd>R</kbd> show the friend you look at · <kbd>T</kbd> next app'
            : mode === 'psst' ? '<kbd>E</kbd> / <kbd>SPACE</kbd> / click: pass the note · <kbd>T</kbd> game app · let go of <kbd>Q</kbd> to hide it'
              : 'let go of <kbd>Q</kbd> to hide it';
      }
      if (T) T.textContent = mode === 'memes' ? 'NEXT' : 'TAP';
      if (A) A.textContent = 'APP';
      if (E) E.textContent = 'SHOW';
    });
  }
  blackout(v) { this.el.blackout.style.opacity = v; }
  flash(v) { this.el.flash.style.opacity = v; }

  showNote(text) {
    this.el['note-text'].innerHTML = text;
    this.show('note', true);
    this.noteOpen = true;
  }
  closeNote() { this.show('note', false); this.noteOpen = false; }

  end(title, text, stats, primary) {
    this.el['end-title'].textContent = title;
    this.el['end-text'].innerHTML = text;
    this.el['end-stats'].innerHTML = stats;
    this.el['btn-again'].textContent = primary || '';
    this.show('btn-again', !!primary);
    this.screen('end');
  }

  /** the report card block on the end screen (src/replay.js). It is this player's own: null clears it. */
  report(html) {
    const el = $('end-report');
    if (!el) return;
    el.innerHTML = html || '';
    el.parentElement.classList.toggle('p6-card', !!html);
  }

  error(msg) { this.el.err.textContent = msg; this.show('err', true); }

  update(dt) {
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.el.subtitle.style.opacity = 0; }
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.el.hint.classList.remove('show'); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.classList.remove('show'); }
    if (this.cardTimer > 0) { this.cardTimer -= dt; if (this.cardTimer <= 0) this.show('card', false); }
  }

  clearTransient() {
    this.subTimer = this.hintTimer = this.toastTimer = this.cardTimer = 0;
    this.el.subtitle.style.opacity = 0;
    this.el.hint.classList.remove('show');
    this.el.toast.classList.remove('show');
    this.show('card', false);
    this.call('left', false); this.call('right', false);
    this.phoneAlert(false);
    this.closeNote();
    this.prompt('');
    this.cache = {};
  }
}
