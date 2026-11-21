// The keyboard layout (Settings): QWERTY or AZERTY. On AZERTY the same spots as WASD / Q on QWERTY are
// Z Q S D (crawl) and A (your phone); the other keys (E R T G X C B F P) are the same letters on both.
export const LAYOUT = { now: 'qwerty' };
export const MOVE_KEYS = {
  qwerty: { w: 'f', s: 'b', a: 'l', d: 'r' },
  azerty: { z: 'f', s: 'b', q: 'l', d: 'r' },
};
export const PHONE_KEY = { qwerty: 'q', azerty: 'a' };
/** a hint or a legend as this layout shows it: WASD -> ZQSD, the Q (phone) key -> A */
export const keyLabels = (html) => (LAYOUT.now !== 'azerty' || typeof html !== 'string' ? html
  : html.replace(/WASD/g, 'ZQSD').replace(/<(b|kbd)>Q<\/\1>/g, '<$1>A</$1>'));
