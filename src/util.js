// Small math / random helpers shared by every module.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => clamp((v - a) / (b - a), 0, 1);
export const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
/** frame-rate independent exponential smoothing */
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const chance = (p) => Math.random() < p;
export const wrapAngle = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
export const dampAngle = (a, b, k, dt) => a + wrapAngle(b - a) * (1 - Math.exp(-k * dt));
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

/** piecewise-linear lookup in a sorted [[x, y], ...] table */
export function table(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) {
    if (x <= tab[i][0]) {
      const [x0, y0] = tab[i - 1];
      const [x1, y1] = tab[i];
      return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
    }
  }
  return tab[tab.length - 1][1];
}

/** shuffled bag: returns items without repetition until exhausted */
export class Bag {
  constructor(items) { this.items = items.slice(); this.pool = []; }
  next() {
    if (!this.pool.length) {
      this.pool = this.items.slice();
      for (let i = this.pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.pool[i], this.pool[j]] = [this.pool[j], this.pool[i]]; }
    }
    return this.pool.pop();
  }
}

/** tiny promise-based wait in game time (driven by Game.update) */
export class Timers {
  constructor() { this.list = []; this.time = 0; }
  after(sec, fn) { const t = { at: this.time + sec, fn }; this.list.push(t); return t; }
  cancel(t) { const i = this.list.indexOf(t); if (i >= 0) this.list.splice(i, 1); }
  clear() { this.list.length = 0; }
  update(dt) {
    this.time += dt;
    for (let i = 0; i < this.list.length; i++) {
      const t = this.list[i];
      if (t.at <= this.time) { this.list.splice(i, 1); i--; t.fn(); }
    }
  }
}
