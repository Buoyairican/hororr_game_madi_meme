// Mouse (pointer lock or drag), keyboard and touch input for a seated player (and one crawling on the floor).
import { LAYOUT, MOVE_KEYS as LAYOUT_MOVE, PHONE_KEY } from './keys.js';
const ARROWS = { arrowup: 'f', arrowdown: 'b', arrowleft: 'l', arrowright: 'r' };
// WASD (ZQSD on AZERTY: Settings, src/keys.js) or the arrow keys
const moveKey = (k) => ARROWS[k] || LAYOUT_MOVE[LAYOUT.now === 'azerty' ? 'azerty' : 'qwerty'][k];
const isPhoneKey = (k) => k === 'f' || k === PHONE_KEY[LAYOUT.now === 'azerty' ? 'azerty' : 'qwerty'];
const clampUnit = (v) => (v > 1 ? 1 : v < -1 ? -1 : v);

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.dx = 0; this.dy = 0;
    this.talk = false; this.phone = false; this.prank = false;
    this.keys = { talk: false, phone: false, prank: false };
    this.mouse = { talk: false, phone: false };
    this.touchBtn = { talk: false, phone: false, prank: false };
    // one-shot actions (tap: E / click with the phone up; swap: X / wheel, ball or plane; drop: put the paper away;
    // seat: C / SEAT, off your chair or back on it)
    this.pressed = { echo: false, ask: false, tap: false, swap: false, drop: false, seat: false };
    // crawling off your chair: WASD / the arrow keys, or the stick on a phone (x: right, y: forward)
    this.moveKeys = { f: false, b: false, l: false, r: false };
    this.joy = { x: 0, y: 0 };
    this.move = { x: 0, y: 0 };
    this.breath = false; this.keys.breath = false; this.touchBtn.breath = false; // hold your breath: B / BREATH (src/dread.js)
    this.wheelAt = 0;
    this.choiceKey = -1;
    this.sens = 1;
    this.enabled = false;
    this.locked = false;
    this.dragging = false;
    this.touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.lookTouch = null;
    this.onPause = null;
    this.onAnyInput = null;
    this.bind();
  }

  bind() {
    const c = this.canvas;
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === c;
      if (!this.locked && this.enabled && this.wantLock && this.onPause) this.onPause();
    });
    c.addEventListener('mousedown', (e) => {
      if (!this.enabled || this.isTouchMouse(e)) return;
      if (!this.locked && !this.touch) { this.wantLock = true; this.requestLock(); }
      // without pointer lock the left button drags the view, so talking stays on E
      if (e.button === 0 && this.locked) { this.mouse.talk = true; this.pressed.tap = true; }
      if (e.button === 2) this.mouse.phone = true;
      this.dragging = true;
      this.onAnyInput && this.onAnyInput();
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouse.talk = false;
      if (e.button === 2) this.mouse.phone = false;
      this.dragging = false;
    });
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled || this.isTouchMouse(e)) return;
      if (this.locked || this.dragging) { this.dx += e.movementX || 0; this.dy += e.movementY || 0; }
    });
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      const k = e.key.toLowerCase();
      if (k === 'e' || k === ' ') { this.keys.talk = true; if (this.enabled) this.pressed.tap = true; }
      if (isPhoneKey(k)) this.keys.phone = true;
      if (k === 'g' && this.enabled) this.keys.prank = true;
      if (this.enabled && k === 'x') this.pressed.swap = true;
      if (this.enabled && k === 'c') this.pressed.seat = true;
      const mk = moveKey(k);
      if (mk) { this.moveKeys[mk] = true; if (this.enabled && k.startsWith('arrow')) e.preventDefault(); }
      if (this.enabled && k === 'b') this.keys.breath = true;
      if (this.enabled && k === 'r') this.pressed.echo = true;
      if (this.enabled && k === 't') this.pressed.ask = true;
      const dig = /^(Digit|Numpad)([1-4])$/.exec(e.code || ''); // (the number row: on AZERTY it types & é " ' without Shift)
      if (this.enabled && ((k >= '1' && k <= '4' && k.length === 1) || dig)) this.choiceKey = Number(dig ? dig[2] : k) - 1; // (a fourth answer: blaming a friend online)
      if ((k === 'escape' || k === 'p') && this.enabled && this.onPause) this.onPause();
      if (this.enabled && this.onAnyInput) this.onAnyInput();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === ' ') this.keys.talk = false;
      if (isPhoneKey(k)) this.keys.phone = false;
      if (k === 'g') this.keys.prank = false;
      const mk = moveKey(k);
      if (mk) this.moveKeys[mk] = false;
      if (k === 'b') this.keys.breath = false;
    });
    window.addEventListener('blur', () => { this.keys.talk = this.keys.phone = this.keys.prank = this.mouse.talk = this.mouse.phone = false; this.pressed.drop = true; this.stopMove(); });
    window.addEventListener('blur', () => { this.keys.breath = false; });
    // the mouse wheel switches paper ball / paper plane
    // (a trackpad swipe or a free-spinning wheel sends a stream of events: one gesture, one switch)
    window.addEventListener('wheel', (e) => {
      if (!this.enabled || Math.abs(e.deltaY) < 1) return;
      const now = performance.now(), gap = now - this.wheelAt;
      this.wheelAt = now;
      if (gap > 220) this.pressed.swap = true;
    }, { passive: true });

    // touch: any finger that starts on the canvas looks around
    c.addEventListener('touchstart', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (this.lookTouch === null) { this.lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY }; }
      }
      e.preventDefault();
      this.onAnyInput && this.onAnyInput();
    }, { passive: false });
    c.addEventListener('touchmove', (e) => {
      if (!this.enabled) return;
      for (const t of e.changedTouches) {
        if (this.lookTouch && t.identifier === this.lookTouch.id) {
          this.dx += (t.clientX - this.lookTouch.x) * 1.6;
          this.dy += (t.clientY - this.lookTouch.y) * 1.6;
          this.lookTouch.x = t.clientX; this.lookTouch.y = t.clientY;
        }
      }
      e.preventDefault();
    }, { passive: false });
    const endTouch = (e) => {
      for (const t of e.changedTouches) if (this.lookTouch && t.identifier === this.lookTouch.id) this.lookTouch = null;
    };
    c.addEventListener('touchend', endTouch);
    c.addEventListener('touchcancel', endTouch);
    this.lastTouchTime = 0;
    window.addEventListener('touchstart', () => { this.lastTouchTime = performance.now(); }, { passive: true });
  }

  isTouchMouse() { return performance.now() - this.lastTouchTime < 800; }

  bindButton(el, name) {
    const on = (e) => { e.preventDefault(); this.touchBtn[name] = true; if (name === 'talk' && this.enabled) this.pressed.tap = true; el.classList.add('active'); this.onAnyInput && this.onAnyInput(); };
    const off = (e) => { e.preventDefault(); this.touchBtn[name] = false; el.classList.remove('active'); };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('touchend', off, { passive: false });
    el.addEventListener('touchcancel', off, { passive: false });
    el.addEventListener('mousedown', on);
    el.addEventListener('mouseup', off);
    el.addEventListener('mouseleave', off);
  }

  /** the stick (crawling on a phone): a finger anywhere on it pushes the knob */
  bindStick(el, knob) {
    let id = null;
    const set = (x, y) => {
      const r = el.getBoundingClientRect(), R = r.width / 2;
      let dx = (x - (r.left + R)) / R, dy = (y - (r.top + R)) / R;
      const n = Math.hypot(dx, dy);
      if (n > 1) { dx /= n; dy /= n; }
      this.joy.x = Math.abs(dx) < 0.12 ? 0 : dx; this.joy.y = Math.abs(dy) < 0.12 ? 0 : -dy;
      if (knob) knob.style.transform = `translate(${(dx * R * 0.55).toFixed(1)}px, ${(dy * R * 0.55).toFixed(1)}px)`;
    };
    const end = () => { id = null; this.joy.x = this.joy.y = 0; if (knob) knob.style.transform = ''; el.classList.remove('active'); };
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      if (!t || id !== null) return;
      id = t.identifier; el.classList.add('active'); set(t.clientX, t.clientY);
      this.onAnyInput && this.onAnyInput();
    }, { passive: false });
    el.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) if (t.identifier === id) set(t.clientX, t.clientY);
    }, { passive: false });
    const up = (e) => { for (const t of e.changedTouches) if (t.identifier === id) end(); };
    el.addEventListener('touchend', up);
    el.addEventListener('touchcancel', up);
    // (a mouse works it too: tests, a laptop with a touch screen)
    el.addEventListener('mousedown', (e) => {
      e.preventDefault(); id = 'mouse'; el.classList.add('active'); set(e.clientX, e.clientY);
      const mv = (ev) => set(ev.clientX, ev.clientY);
      const mu = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', mu); end(); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', mu);
    });
    this.stickEnd = end;
  }
  stopMove() {
    this.moveKeys.f = this.moveKeys.b = this.moveKeys.l = this.moveKeys.r = false;
    if (this.stickEnd) this.stickEnd();
  }

  /** tap buttons for one-shot actions (ECHO / ASK) */
  bindTap(el, name) {
    const on = (e) => { e.preventDefault(); if (this.enabled) this.pressed[name] = true; };
    el.addEventListener('touchstart', on, { passive: false });
    el.addEventListener('mousedown', on);
  }

  takePressed() {
    const p = { ...this.pressed };
    for (const k in this.pressed) this.pressed[k] = false;
    return p;
  }

  /** Settings: QWERTY or AZERTY (src/keys.js); nothing stays held from the old one */
  setLayout(l) { LAYOUT.now = l === 'azerty' ? 'azerty' : 'qwerty'; this.keys.phone = false; this.stopMove(); }
  takeChoice() { const c = this.choiceKey; this.choiceKey = -1; return c; }

  requestLock() {
    if (this.touch) return;
    try {
      const p = this.canvas.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.wantLock = false; });
    } catch (e) { this.wantLock = false; }
  }

  enable(on) {
    this.enabled = on;
    this.wantLock = on && !this.touch;
    if (on && !this.touch) this.requestLock();
    if (!on) {
      this.wantLock = false;
      if (document.pointerLockElement) document.exitPointerLock();
      this.touchBtn.talk = this.touchBtn.phone = this.touchBtn.prank = false;
      this.keys.prank = false;
      this.stopMove();
      this.pressed.drop = true; // a paper you were aiming is not thrown when you pause
      this.keys.breath = this.touchBtn.breath = false;
      document.querySelectorAll('.tbtn').forEach((b) => b.classList.remove('active'));
    }
  }

  /** consume look delta in radians */
  consume() {
    const k = 0.0022 * this.sens;
    const r = { yaw: -this.dx * k, pitch: -this.dy * k };
    this.dx = this.dy = 0;
    this.talk = this.keys.talk || this.mouse.talk || this.touchBtn.talk;
    this.phone = this.keys.phone || this.mouse.phone || this.touchBtn.phone;
    this.prank = this.keys.prank || this.touchBtn.prank;
    const m = this.moveKeys;
    this.move.x = clampUnit((m.r ? 1 : 0) - (m.l ? 1 : 0) + this.joy.x);
    this.move.y = clampUnit((m.f ? 1 : 0) - (m.b ? 1 : 0) + this.joy.y);
    this.breath = this.keys.breath || this.touchBtn.breath;
    return r;
  }
}
