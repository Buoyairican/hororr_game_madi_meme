// DOM overlay: HUD, subtitles, hints, menus.
const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.el = {};
    for (const id of ['hud', 'score-val', 'eye', 'anger', 'anger-fill', 'clock-hud', 'prompt', 'hint', 'call-left', 'call-right', 'phone-alert',
      'subtitle', 'toast', 'blackout', 'flash', 'note', 'note-text', 'title', 'loading', 'load-fill', 'load-text', 'menu', 'how', 'settings',
      'pause', 'end', 'end-title', 'end-text', 'end-stats', 'rotate', 'err', 'crosshair']) this.el[id] = $(id);
    this.subTimer = 0;
    this.hintTimer = 0;
    this.toastTimer = 0;
    this.subsOn = true;
    this.meterOn = true;
    this.lastPrompt = '';
    this.noteOpen = false;
    this.el.note.addEventListener('click', () => this.closeNote());
    this.el.note.addEventListener('touchend', (e) => { e.preventDefault(); this.closeNote(); });
  }

  show(id, on = true) { this.el[id].classList.toggle('hidden', !on); }
  screen(id) {
    for (const s of ['title', 'how', 'settings', 'pause', 'end']) this.show(s, s === id);
  }

  progress(p, text) {
    this.el['load-fill'].style.width = Math.round(p * 100) + '%';
    if (text) this.el['load-text'].textContent = text;
  }

  setScore(v) { this.el['score-val'].textContent = Math.floor(v); }
  setClock(s) { this.el['clock-hud'].textContent = s; }
  setWatching(on) { this.el.eye.classList.toggle('open', on); }
  setAnger(v) {
    this.el.anger.style.visibility = this.meterOn ? 'visible' : 'hidden';
    this.el['anger-fill'].style.width = Math.round(v) + '%';
  }

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
    const label = who ? `<span class="who">${who}</span><br>` : '';
    this.el.subtitle.innerHTML = `${label}<span class="${cls}">${text}</span>`;
    this.el.subtitle.style.opacity = 1;
    this.subTimer = dur;
  }

  call(side, on) { this.el[side === 'left' ? 'call-left' : 'call-right'].classList.toggle('show', on); }
  phoneAlert(on) { this.el['phone-alert'].classList.toggle('show', on); }
  blackout(v) { this.el.blackout.style.opacity = v; }
  flash(v) { this.el.flash.style.opacity = v; }

  showNote(text) {
    this.el['note-text'].innerHTML = text;
    this.show('note', true);
    this.noteOpen = true;
  }
  closeNote() { this.show('note', false); this.noteOpen = false; }

  end(title, text, stats) {
    this.el['end-title'].textContent = title;
    this.el['end-text'].innerHTML = text;
    this.el['end-stats'].innerHTML = stats;
    this.screen('end');
  }

  error(msg) { this.el.err.textContent = msg; this.show('err', true); }

  update(dt) {
    if (this.subTimer > 0) { this.subTimer -= dt; if (this.subTimer <= 0) this.el.subtitle.style.opacity = 0; }
    if (this.hintTimer > 0) { this.hintTimer -= dt; if (this.hintTimer <= 0) this.el.hint.classList.remove('show'); }
    if (this.toastTimer > 0) { this.toastTimer -= dt; if (this.toastTimer <= 0) this.el.toast.classList.remove('show'); }
  }

  clearTransient() {
    this.subTimer = this.hintTimer = this.toastTimer = 0;
    this.el.subtitle.style.opacity = 0;
    this.el.hint.classList.remove('show');
    this.el.toast.classList.remove('show');
    this.call('left', false); this.call('right', false);
    this.phoneAlert(false);
    this.closeNote();
    this.prompt('');
  }
}
