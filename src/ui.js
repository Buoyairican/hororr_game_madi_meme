// DOM overlay: HUD, subtitles, hints, objectives, choices, menus.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'score-val', 'eye', 'eye-label', 'anger', 'anger-fill', 'clock-hud', 'prompt', 'hint', 'call-left', 'call-right', 'phone-alert',
      'subtitle', 'toast', 'blackout', 'flash', 'note', 'note-text', 'title', 'loading', 'load-fill', 'load-text', 'menu', 'how', 'settings',
      'pause', 'end', 'end-title', 'end-text', 'end-stats', 'rotate', 'err', 'crosshair', 'objectives', 'strikes', 'bully', 'echo-cue', 'echo-bar',
      'choices', 'choices-title', 'choices-list', 'choices-bar', 'card', 'card-time', 'card-title', 'card-sub', 'chapters', 'chapter-list', 'btn-again', 'btn-echo']) this.el[id] = $(id);
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
  screen(id) {
    for (const s of ['title', 'how', 'settings', 'pause', 'end', 'chapters']) this.show(s, s === id);
  }

  /** only touch the DOM when a value actually changes */
  set(key, v, fn) { if (this.cache[key] !== v) { this.cache[key] = v; fn(v); } }

  progress(p, text) {
    this.el['load-fill'].style.width = Math.round(p * 100) + '%';
    if (text) this.el['load-text'].innerHTML = text;
  }

  setScore(v) { this.set('score', Math.floor(v), (x) => (this.el['score-val'].textContent = x)); }
  setClock(s) { this.set('clock', s, (x) => (this.el['clock-hud'].textContent = x)); }
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
    this.set('strikes', n, () => { let h = ''; for (let i = 0; i < max; i++) h += `<span class="${i < n ? 'on' : ''}">✗</span>`; this.el.strikes.innerHTML = h; });
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
    this.el.objectives.innerHTML = list.map((o) => `<li class="${o.done ? 'done' : ''}">${o.text}</li>`).join('');
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
