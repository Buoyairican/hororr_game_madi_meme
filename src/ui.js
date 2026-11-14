// DOM overlay: HUD, subtitles, hints, objectives, choices, menus.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'score-val', 'eye', 'eye-label', 'anger', 'anger-fill', 'clock-hud', 'prompt', 'hint', 'call-left', 'call-right', 'phone-alert',
      'subtitle', 'toast', 'blackout', 'flash', 'note', 'note-text', 'title', 'loading', 'load-fill', 'load-text', 'menu', 'how', 'settings',
      'pause', 'end', 'end-title', 'end-text', 'end-stats', 'rotate', 'err', 'crosshair', 'objectives', 'strikes', 'bully', 'echo-cue', 'echo-bar',
      'choices', 'choices-title', 'choices-list', 'choices-bar', 'card', 'card-time', 'card-title', 'card-sub', 'chapters', 'chapter-list', 'btn-again', 'btn-echo', 'mp',
      'laugh', 'laugh-fill', 'laugh-mult', 'aim-hud', 'aim-kind', 'aim-pow-fill']) this.el[id] = $(id);
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
    for (const s of ['title', 'how', 'settings', 'pause', 'end', 'chapters', 'mp']) this.show(s, s === id);
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
    this.set('aimKind', name + (ready ? '' : ' (folding…)'), (x) => (this.el['aim-kind'].textContent = x));
    this.set('aimPow', Math.round(power * 20), (x) => (this.el['aim-pow-fill'].style.width = x * 5 + '%'));
  }
  setEye(state) {
    this.set('eye', state, (st) => {
      this.el.eye.setAttribute('class', st === 'closed' ? '' : st);
      this.el['eye-label'].textContent = { open: 'WATCHING', blind: "CAN'T SEE", busy: 'TYPING', away: '', closed: '' }[st] || '';
    });
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
      if (!mode) {
        if (lg) lg.innerHTML = this.legendHtml;
        if (T) T.textContent = 'TALK'; if (A) A.textContent = 'ASK'; if (E) E.textContent = 'ECHO';
        return;
      }
      if (mode.startsWith('aim')) {
        // aiming a paper: let go to throw; the other buttons switch ball / plane or put it away
        if (lg) lg.innerHTML = 'let go of <kbd>G</kbd> to throw · <kbd>X</kbd> / wheel: ball or plane · <kbd>E</kbd> put it away';
        if (T) T.textContent = 'DROP';
        if (A) A.textContent = mode === 'aim:plane' ? 'PLANE' : 'BALL';
        if (E) E.textContent = 'SWAP';
        return;
      }
      if (lg) {
        lg.innerHTML = mode === 'game' ? '<kbd>E</kbd> / <kbd>SPACE</kbd> / click: fly · <kbd>T</kbd> meme app · let go of <kbd>Q</kbd> to hide it'
          : mode === 'memes' ? '<kbd>E</kbd> next video · <kbd>R</kbd> show the friend you look at · <kbd>T</kbd> game app'
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
