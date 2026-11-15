// PSST!: the third app on your phone (unlocked: UNLOCKS in src/data.js). A tiny version of the
// class itself: tap to pass the note from desk to desk while the teacher writes on the board.
// When the chalk stops, stop passing: he turns around, and a note in the air gets you caught
// (and the phone plays its LOUD game-over tune, like PAPER PLANE). Drawn on the phone's canvas
// (240 x 480) in the colours of the phone theme; the same one-button controls as the other apps.
const W = 240, H = 480;
const DESKS = 4, DESK_Y = 356;
const deskX = (i) => 36 + i * 56;

export class PsstGame {
  constructor() { this.best = 0; this.hint = 'tap: [E] / click'; this.reset(); }

  reset() {
    this.state = 'ready';            // ready | play | paused | dead
    this.score = 0;
    this.at = 0;                      // the desk that holds the note
    this.fly = 0;                     // > 0: the note is in the air to the next desk (seconds left)
    this.t = 0; this.deadT = 0;
    this.teacher = 'write';           // write (his back is turned) | stop (the chalk stops) | look
    this.tt = 2.2;                    // seconds until his next move
    this.chalk = 0;                   // how much he has written (drawn on the little board)
    this.got = 0;                     // a flash when the note arrives
  }

  /** E / click / TAP. Returns true when a note was passed. */
  tap() {
    if (this.state === 'dead') { if (this.deadT > 0.9) this.reset(); return false; }
    if (this.state === 'ready' || this.state === 'paused') { this.state = 'play'; return false; }
    if (this.fly > 0) return false;
    this.fly = this.passTime();
    return true;
  }
  pause() { if (this.state === 'play') this.state = 'paused'; }

  // it gets harder: he writes for a shorter time, and the warning gets shorter (never shorter than one pass:
  // a note that left before the chalk stopped always arrives)
  passTime() { return 0.34; }
  writeTime() { return Math.max(0.9, 2.6 - this.score * 0.09) * (0.7 + Math.random() * 0.6); }
  stopTime() { return Math.max(0.38, 0.62 - this.score * 0.015); }
  lookTime() { return 0.9 + Math.random() * 0.9; }

  /** ev: { point(score), crash(score), pass() } */
  step(dt, ev) {
    this.t += dt;
    if (this.got > 0) this.got -= dt;
    if (this.state === 'dead') { this.deadT += dt; return; }
    if (this.state !== 'play') return;
    // the teacher
    this.tt -= dt;
    if (this.teacher === 'write') this.chalk += dt;
    if (this.tt <= 0) {
      if (this.teacher === 'write') { this.teacher = 'stop'; this.tt = this.stopTime(); }
      else if (this.teacher === 'stop') { this.teacher = 'look'; this.tt = this.lookTime(); }
      else { this.teacher = 'write'; this.tt = this.writeTime(); }
    }
    // the note
    if (this.fly > 0) {
      if (this.teacher === 'look') { this.caught(ev); return; } // he saw it in the air
      this.fly -= dt;
      if (this.fly <= 0) {
        this.fly = 0; this.at++;
        if (this.at >= DESKS - 1) {
          // it got there: one point, and the next note starts at the first desk
          this.score++; this.at = 0; this.got = 0.5;
          this.best = Math.max(this.best, this.score);
          ev.point(this.score);
        } else if (ev.pass) ev.pass();
      }
    }
  }

  caught(ev) {
    this.state = 'dead'; this.deadT = 0; this.fly = 0;
    this.best = Math.max(this.best, this.score);
    ev.crash(this.score);
  }

  /** th: the phone theme (PHONE_THEMES in src/data.js) */
  draw(c, th) {
    // the classroom wall and floor
    const g = c.createLinearGradient(0, 26, 0, 400);
    g.addColorStop(0, th.sky[0]); g.addColorStop(1, th.sky[1]);
    c.fillStyle = g; c.fillRect(0, 26, W, H - 26);
    c.fillStyle = th.ground; c.fillRect(0, 400, W, H - 400);
    c.fillStyle = th.groundTop; c.fillRect(0, 400, W, 4);
    // the board, with what he has written so far
    c.fillStyle = '#24402f'; c.fillRect(28, 96, 184, 84);
    c.strokeStyle = '#c9a66b'; c.lineWidth = 4; c.strokeRect(28, 96, 184, 84);
    c.strokeStyle = 'rgba(240,238,225,0.85)'; c.lineWidth = 2;
    const lines = Math.min(3, Math.floor(this.chalk / 2.4)), part = (this.chalk % 2.4) / 2.4;
    for (let i = 0; i <= lines && i < 3; i++) {
      const w = (i < lines ? 1 : part) * 150;
      c.beginPath();
      for (let x = 0; x <= w; x += 6) c.lineTo(42 + x, 116 + i * 22 + Math.sin(x * 0.35 + i) * 3);
      c.stroke();
    }
    // the teacher: too tall, round glasses. His back, or his face.
    const look = this.teacher === 'look', stop = this.teacher === 'stop';
    const tx = 120 + (this.teacher === 'write' ? Math.sin(this.t * 2) * 30 : 0), ty = 190;
    c.fillStyle = '#17181c';
    c.fillRect(tx - 15, ty, 30, 92);                                  // the suit
    c.fillRect(tx - 23, ty + 6, 8, look ? 74 : 40);                   // arms: hanging when he looks
    c.fillRect(tx + 15, ty + 6, 8, look ? 74 : 40);
    if (this.teacher === 'write') c.fillRect(tx + 15, ty - 22, 8, 34); // the writing arm, up
    c.fillStyle = look ? '#8a6a4c' : '#17181c';
    c.beginPath(); c.ellipse(tx, ty - 16, 15, 20, 0, 0, Math.PI * 2); c.fill();
    if (look) {
      c.strokeStyle = '#e8e6da'; c.lineWidth = 2;
      c.beginPath(); c.arc(tx - 7, ty - 18, 5.5, 0, Math.PI * 2); c.arc(tx + 7, ty - 18, 5.5, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ff4d4d'; c.fillRect(tx - 8, ty - 19, 2, 2); c.fillRect(tx + 6, ty - 19, 2, 2);
    }
    if (stop) { c.fillStyle = th.accent; c.font = 'bold 22px sans-serif'; c.textAlign = 'center'; c.fillText('. . .', tx, ty - 44); }
    // the desks and the kids
    for (let i = 0; i < DESKS; i++) {
      const x = deskX(i);
      c.fillStyle = '#f0c9a0'; c.beginPath(); c.arc(x, DESK_Y - 24, 11, 0, Math.PI * 2); c.fill();
      c.fillStyle = ['#3d6fb6', '#b6563d', '#4f9d69', '#8a5fb0'][i]; c.fillRect(x - 13, DESK_Y - 13, 26, 22);
      c.fillStyle = th.groundDark; c.fillRect(x - 21, DESK_Y + 6, 42, 8); c.fillRect(x - 17, DESK_Y + 14, 4, 26); c.fillRect(x + 13, DESK_Y + 14, 4, 26);
    }
    // the note
    const k = this.fly > 0 ? 1 - this.fly / this.passTime() : 0;
    const nx = deskX(this.at) + 56 * k, ny = DESK_Y - 2 - Math.sin(k * Math.PI) * 26;
    c.save(); c.translate(nx, ny); c.rotate(k * 5);
    c.fillStyle = '#fffbe8'; c.strokeStyle = th.ink; c.lineWidth = 1.5;
    c.fillRect(-7, -5, 14, 10); c.strokeRect(-7, -5, 14, 10);
    c.restore();
    if (this.got > 0) { c.fillStyle = th.accent; c.font = 'bold 20px sans-serif'; c.textAlign = 'center'; c.fillText('+1', deskX(DESKS - 1), DESK_Y - 46 - (0.5 - this.got) * 30); }
    // text
    c.textAlign = 'center';
    outline(c, String(this.score), W / 2, 76, 40, th);
    if (this.state === 'ready') {
      outline(c, 'PSST!', W / 2, 232, 34, th, th.accent);
      outline(c, 'PASS THE NOTE', W / 2, 262, 18, th);
      c.fillStyle = th.text; c.font = 'bold 12px sans-serif';
      c.fillText('only while his back is turned', W / 2, 428);
      c.fillText(this.hint, W / 2, 446);
      if (this.best) c.fillText('BEST ' + this.best, W / 2, 464);
    } else if (this.state === 'paused') {
      outline(c, 'TAP TO CONTINUE', W / 2, 440, 18, th);
    } else if (this.state === 'dead') {
      c.fillStyle = 'rgba(120,0,0,0.3)'; c.fillRect(0, 26, W, H - 26);
      outline(c, 'CAUGHT!', W / 2, 240, 36, th, '#ff4d4d');
      outline(c, 'BEST ' + this.best, W / 2, 272, 18, th);
      if (this.deadT > 0.9) outline(c, 'tap to retry', W / 2, 440, 18, th);
    } else if (stop) {
      outline(c, 'THE CHALK STOPPED', W / 2, 440, 16, th, th.accent);
    }
  }
}

function outline(c, s, x, y, size, th, col) {
  c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
  c.lineJoin = 'round'; c.lineWidth = size / 5; c.strokeStyle = th.ink;
  c.strokeText(s, x, y); c.fillStyle = col || th.text; c.fillText(s, x, y);
}
