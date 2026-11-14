// Mouse (pointer lock or drag), keyboard and touch input for a seated player.
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.dx = 0; this.dy = 0;
    this.talk = false; this.phone = false; this.prank = false;
    this.keys = { talk: false, phone: false, prank: false };
    this.mouse = { talk: false, phone: false };
    this.touchBtn = { talk: false, phone: false, prank: false };
    // one-shot actions (tap: E / click with the phone up; swap: X / wheel, ball or plane; drop: put the paper away)
    this.pressed = { echo: false, ask: false, tap: false, swap: false, drop: false };
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
      if (k === 'q' || k === 'f') this.keys.phone = true;
      if (k === 'g') this.keys.prank = true;
      if (this.enabled && k === 'x') this.pressed.swap = true;
      if (this.enabled && k === 'r') this.pressed.echo = true;
      if (this.enabled && k === 't') this.pressed.ask = true;
      if (this.enabled && k >= '1' && k <= '3') this.choiceKey = Number(k) - 1;
      if ((k === 'escape' || k === 'p') && this.enabled && this.onPause) this.onPause();
      if (this.enabled && this.onAnyInput) this.onAnyInput();
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === ' ') this.keys.talk = false;
      if (k === 'q' || k === 'f') this.keys.phone = false;
      if (k === 'g') this.keys.prank = false;
    });
    window.addEventListener('blur', () => { this.keys.talk = this.keys.phone = this.keys.prank = this.mouse.talk = this.mouse.phone = false; this.pressed.drop = true; });
    // the mouse wheel switches paper ball / paper plane
    window.addEventListener('wheel', (e) => {
      if (!this.enabled || Math.abs(e.deltaY) < 1) return;
      const now = performance.now();
      if (now - this.wheelAt > 160) { this.wheelAt = now; this.pressed.swap = true; }
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
      this.pressed.drop = true; // a paper you were aiming is not thrown when you pause
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
    return r;
  }
}
