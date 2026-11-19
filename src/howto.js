// HOW TO PLAY: a few short picture pages instead of a wall of text (index.html #how).
// NEXT / BACK, the dots, the arrow keys or a swipe turn the pages; Esc closes.
// The very first class a player starts shows pages 1-6 first ("first": SKIP, and the last button starts
// the class); after that it never comes up by itself again. Computers see keys, phones the touch buttons (CSS).
const SEEN = 'madiclass.howto';

/** has this browser seen How to Play before a first class? */
export function howSeen() { try { return localStorage.getItem(SEEN) === '1'; } catch (e) { return true; } }
function markSeen() { try { localStorage.setItem(SEEN, '1'); } catch (e) { /* private mode */ } }

/** onClose(mode, after): `after` is the class to start (first time), otherwise go back where you came from */
export function setupHowTo({ onClose }) {
  const $ = (id) => document.getElementById(id);
  const root = $('how'), cards = [...root.querySelectorAll('.how-card')];
  const prev = $('how-prev'), next = $('how-next'), dots = $('how-dots'), count = $('how-count'), skip = $('how-skip');
  let i = 0, mode = 'menu', after = null;
  // (the first time: the six pages that matter; "more tricks" waits in the menu)
  const pages = () => (mode === 'first' ? cards.length - 1 : cards.length);

  function render() {
    const n = pages();
    cards.forEach((c, k) => c.classList.toggle('on', k === i));
    count.textContent = `${i + 1} / ${n}`;
    if (dots.children.length !== n) {
      dots.innerHTML = '';
      for (let k = 0; k < n; k++) {
        const b = document.createElement('button');
        b.setAttribute('aria-label', `Page ${k + 1}`);
        b.onclick = () => turn(k);
        dots.appendChild(b);
      }
    }
    [...dots.children].forEach((b, k) => b.classList.toggle('on', k === i));
    prev.disabled = i === 0;
    next.textContent = i < n - 1 ? 'NEXT ▶' : mode === 'first' ? 'START CLASS ▶' : 'GOT IT';
  }
  function turn(k) { i = Math.max(0, Math.min(pages() - 1, k)); render(); }
  function close() {
    const go = after;
    after = null;
    if (mode === 'first') markSeen();
    root.classList.remove('first');
    onClose(mode, go);
  }
  next.onclick = () => (i < pages() - 1 ? turn(i + 1) : close());
  prev.onclick = () => turn(i - 1);
  skip.onclick = close;
  const open = () => !root.classList.contains('hidden');
  addEventListener('keydown', (e) => {
    if (!open()) return;
    if (e.key === 'ArrowRight') turn(i + 1);
    else if (e.key === 'ArrowLeft') turn(i - 1);
    else if (e.key === 'Escape') close();
    else return;
    e.preventDefault(); e.stopPropagation();
  }, true);
  // a swipe on a phone
  let sx = null, sy = 0;
  const deck = $('how-deck');
  deck.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  deck.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    sx = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) turn(i + (dx < 0 ? 1 : -1));
  });
  return {
    /** mode: 'menu' (from the title or the pause menu) or 'first' (before the first class: then `start()`) */
    open(m = 'menu', start = null) {
      mode = m; after = start; i = 0;
      root.classList.toggle('first', m === 'first');
      for (const d of root.querySelectorAll('.tricks details')) d.open = false;
      render();
    },
    get page() { return i; },
  };
}
