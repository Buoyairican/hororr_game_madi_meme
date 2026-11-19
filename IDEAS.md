# IDEAS.md: new features for Madi Class

For the AI agent (Opus). **Read the Rules at the top of `DEBUG.md` first: they apply here too.** Do `DEBUG.md` Part A (the patch) before any feature: the features use what it adds (`ui.status`, `uiTo`, `classGiggle`, the safe `interrupt`).

## More rules for features

1. **One feature per session, in this order.** F2, then F3, F4, F5, F6. Each one is playable on its own. Stop after the one the owner names.
2. **Copy the table.** Every feature gives a data table: paste it into `src/data.js` as it is and read the numbers from it. Do not invent other numbers or texts.
3. **No new audio.** Every line and sound to use is named here and exists already. Do not run the audio tools.
4. **A scene is a generator with cleanup:** `try { ... } finally { put everything back }`. Never set a flag before a `yield` without clearing it in `finally`.
5. **Online, the host decides.** Logic runs on the host for every `p` in `this.players`. A message for one player: `this.uiTo(p, 'hint' | 'status' | 'toast' | 'subtitle', ...)`. For everybody: `this.showHint(text, seconds)`. Never `this.ui.hint(...)`.
6. **What a friend's screen must know goes into the snapshot row:** `sneakRow(p)` in `src/sneak.js` (it feeds `P` in `makeSnap`, `src/mp.js`); read it back in `applyMySneak` (your own row) and `applyOtherSneak` (the others).
7. **Count it:** `this.note(p, 'key')` for everything a player does.
8. **Build the simple version described here.** Each feature has a "Not in this version" list. Do not build those.
9. **Check:** `node tools/check.js ideas` (the F lines), plus the tests named in the feature. The checks were written before the features: if a check fails because the check is wrong, fix the check and say so.

---

## F1. He pats his stomach (done: it is in `fixes.patch`)

Nothing to do. For reference: when he ponders at the board, and one time in four after he writes a line, he turns a quarter so the class sees his right hand, stares at the board and pats his stomach in quick soft bursts (4 to 8 pats, about 4 per second, then a short pause). It is only a funny habit: it changes nothing about what he hears or sees.

- Code: `bellyPat(seconds)` in `src/game.js`, the pose `'belly'` and `startPat()` in `src/teacher.js`, the numbers in `BELLY` (`src/data.js`). The sound is the existing `bl_paw`, quiet.
- F2 uses `bellyPat`.

---

## F2. He gets stuck on a question (solo and online)

**What the player sees.** Now and then he writes a question on the board, for example `7 × 8 = ?`. He stares at it, pats his stomach, says "The answer is... is... is...". A tip says he is stuck and you can raise your hand. The first player who raises a hand gets three choices: the right answer, a wrong answer, or say nothing.

- **Right answer:** "Correct." He writes it down and calms down. You get 1 trust (used in F5 and F6). The catch: you are his pet now. He says "Such a... good... student.", keeps an eye on you for a while, and a kid throws a paper ball at you.
- **Wrong answer:** "Thank... you. Write this... down." He writes the wrong answer on the board. The class laughs, you get mischief. The catch: about 45 seconds later he looks it up on his laptop, says "No. No. That is wrong." and comes to ask who did it.
- **Nobody helps:** after 14 seconds he walks to his laptop and looks it up himself. While he types he is not watching: free time for everybody.

**Data** (paste into `src/data.js`):

```js
// ---- he is stuck on a question he wrote himself (src/stuck.js)
export const STUCK = {
  first: [45, 75], every: [80, 120], max: 2, // Free Class: seconds to the first one, between two, how many per class
  wait: 14,                 // seconds he stares before he looks it up himself
  choose: 8,                // seconds to pick an answer
  calm: 25, petWatch: 25,   // right: his anger goes down by this; he keeps an eye on you this long
  laugh: 40, mischief: 40,  // wrong: the class laughs, your mischief
  findOut: [35, 55],        // wrong: seconds until he looks it up
  maxTrust: 3,
  hint: 'He is stuck. <b>Raise your hand</b> to help him: <span class="desk-only">press <b>T</b></span><span class="touch-only">tap <b>ASK</b></span>.',
  title: 'Help him: ',
  nothing: 'Say nothing',
  list: [
    { q: '7 × 8 = ?', right: '56', wrong: '54', typed: 'what is 7 times 8' },
    { q: 'The capital of France is ___', right: 'Paris', wrong: 'F', typed: 'capital of france' },
    { q: 'H2O is ___', right: 'water', wrong: 'a robot', typed: 'what is h2o' },
    { q: 'How many days in a week?', right: '7', wrong: '9', typed: 'days in a week' },
    { q: 'The opposite of hot is ___', right: 'cold', wrong: 'spicy', typed: 'opposite of hot' },
    { q: 'A triangle has ___ sides', right: '3', wrong: '5', typed: 'how many sides has a triangle' },
    { q: 'How many legs has a spider?', right: '8', wrong: '2, like me', typed: 'spider legs' },
    { q: 'What is 6 + 7?', right: '13', wrong: 'six seven!', typed: 'what is 6 plus 7' },
    { q: 'What does "rizz" mean?', right: 'charm', wrong: 'a kind of rice', typed: 'what does rizz mean' },
    { q: 'What does "sus" mean?', right: 'suspicious', wrong: 'a soup', typed: 'what does sus mean' },
    { q: 'What is a "GOAT"?', right: 'the greatest of all time', wrong: 'you, sir', typed: 'what does goat mean' },
    { q: 'What is "aura"?', right: 'how cool you look', wrong: 'a Wi-Fi brand', typed: 'what is aura' },
    { q: '"No cap" means ___', right: 'no lie', wrong: 'no hats in class', typed: 'what does no cap mean' },
    { q: 'Ohio is a ___', right: 'state', wrong: 'final boss', typed: 'what is ohio' },
    { q: 'A "sigma" is ___', right: 'a Greek letter', wrong: 'a teacher', typed: 'what is a sigma' },
    { q: 'What is "skibidi"?', right: 'nothing. It means nothing.', wrong: 'the past tense of ski', typed: 'what does skibidi mean' },
  ],
};
```

**Build** (new file `src/stuck.js`, a mixin like `src/quirks.js`; add it to the `Object.assign(Game.prototype, ...)` list at the bottom of `src/game.js`; `Bag`, `rand` and `pick` come from `./util.js`, `STUCK` and `FREE_LENGTH` from `./data.js`):

1. State. In `resetPlayer` (`src/game.js`) add `trust: 0`. In `reset()` call a new `resetStuck()`: `this.stuck = null; this.stuckFind = null; this.stuckN = 0; this.stuckNext = rand(STUCK.first[0], STUCK.first[1]); this.stuckBag = new Bag(STUCK.list);`
2. When. In `idleBrain` (`grep -n "const habit = this.quirkAct() || this.slangAct() || this.sneakHabit();" src/game.js`) add `|| this.stuckAct()`. `stuckAct()` returns a generator or null:
   - if `this.stuckFind` is due (`this.t >= this.stuckFind.at`): return `this.stuckFoundOut()`;
   - if `this.mode === 'free' && this.t >= this.stuckNext && this.stuckN < STUCK.max && this.anger < 40 && this.t < FREE_LENGTH - 60`: return `this.actStuck()`;
   - else null.
3. `*actStuck(item = this.stuckBag.next())`:
   - `this.quirkBusy = true; this.stuckN++; this.stuckNext = this.t + rand(...STUCK.every);`
   - `yield* this.actWrite(item.q);` then `this.stuck = { item, by: null, kind: null };` and `this.showHint(STUCK.hint, 6);`
   - Loop up to `STUCK.wait` seconds while `!this.stuck.kind`: run `this.bellyPat(...)` in pieces of 2 s (`const pat = this.bellyPat(2); while (!pat.next().done && !this.stuck.kind) yield;` then `pat.return()`). After about 3 s say `this.teacherSay('t_answer')` once.
   - `kind === 'right'`: `yield* this.say('q_correct'); yield* this.actWrite(item.right);` then `this.anger = Math.max(0, this.anger - STUCK.calm); p.trust = Math.min(STUCK.maxTrust, p.trust + 1); this.note(p, 'helped'); yield* this.say('t_good'); p.watchedT = STUCK.petWatch;` and `this.timers.after(rand(3, 5), () => { const k = pick(this.students.filter((s) => !s.gone && !s.hollow)); if (k && this.players.includes(p)) this.npcThrow(k, p); });`
   - `kind === 'wrong'`: `yield* this.say('t_thanks'); yield* this.say('t_writedown'); yield* this.actWrite(item.wrong); this.addLaugh(STUCK.laugh, this.boardCenter.clone(), p); this.mischief += STUCK.mischief; this.note(p, 'trolled'); this.stuckFind = { p, item, at: this.t + rand(...STUCK.findOut) };`
   - nobody (`!kind`): `yield* this.say('t_moment'); yield* this.laptopLookup(item.typed, item.right); yield* this.actWrite(item.right);`
   - `finally { this.stuck = null; this.quirkBusy = false; this.teacher.setPose('rest'); }` and close the choice of whoever has it open (`if (by && by.choice) this.pickChoice(-1, by)`; for the local player `this.choice`).
4. Raising a hand. In `playerActs` (`grep -n "if (a.ask && this.canAsk(p)) this.openAsk(p);" src/game.js`) put first: `if (a.ask && this.stuck && !this.stuck.by && !p.out && !p.ghost) { this.openStuck(p); } else` ...
   - `openStuck(p)`: `this.stuck.by = p; p.handT = 2.8;` shuffle `[right, wrong]`, add `STUCK.nothing`, then `this.openChoice(STUCK.title + item.q, labels, STUCK.choose, (i) => this.answerStuck(p, i < 0 || labels[i] === STUCK.nothing ? null : labels[i] === item.right ? 'right' : 'wrong'), p);`
   - `answerStuck(p, kind)`: if `this.stuck` and `kind`: `this.stuck.by = p; this.stuck.kind = kind;` If `kind` is null: `this.stuck.by = null` (somebody else may still help).
5. `*stuckFoundOut()`: take `const { p, item } = this.stuckFind; this.stuckFind = null;` then `yield* this.laptopLookup(item.typed, item.right); yield* this.say('t_wrong');` then, if `this.players.includes(p)`: `if (this.allowBlame) yield* this.askWhoDidIt(p, 'prank'); else { this.focus = p; this.angerUp(25, 85); yield* this.say('t_itwasyou'); }`
6. Online: nothing extra. The choice already goes to the right player (`openChoice(..., p)`), the board and his lines are already sent to friends. Add `p.trust | 0` to `sneakRow(p)` and read it in `applyMySneak` so a friend's own screen knows its trust.
7. Show trust: one small line in the HUD under LAUGHS, `TRUST ★★☆`, hidden while trust is 0. Element `#trust` in `index.html` inside `#hud-left`, a `setTrust(n)` in `src/ui.js`, called from `updateHud` and `guestHud`.

**Voice lines used** (all exist): `t_answer`, `q_correct`, `t_good`, `t_thanks`, `t_writedown`, `t_moment`, `t_wrong`, `t_itwasyou`.

**Check:** `node tools/check.js ideas` (the three `F2` lines), then `bash tests/run.sh events blame features`.

**Not in this version:** story mode (Free Class and online only); questions that depend on the class; a reward for the wrong answer beyond laughs and mischief.

---

## F3. Online: one victim, the others watch

**What changes.** Today every player gets the same jump scare on their own screen at the same moment. New: the host picks **one** player. Only that player gets the scene. The others see him leave the front and stand bent over their friend's chair, and get a toast: "HE WENT FOR BO". Then he is back at the front.

**Data:** in `SCARES` (`src/data.js`) add `everyone: ['flash', 'fakebell'], watchToast: 'HE WENT FOR {name}',`

**Build:**

1. `src/scares.js`, `scareScene(id)` (`grep -n "  \*scareScene(id) {" src/scares.js`). When `this.mp` and `!SCARES.everyone.includes(id)`:
   - `const v = pick(this.players.filter((p) => !p.out && !(p.slipK > 0) && !p.ghost));` no such player: do nothing.
   - Tell the others: `for (const q of this.players) if (q !== v) this.uiTo(q, 'toast', SCARES.watchToast.replace('{name}', v.name.toUpperCase()), 3);`
   - `v.local` (the host is the victim): run `yield* this.scLocal(id)` as today, but do **not** call `this.mp.scareAll(id)`. Friends see him at the host's desk through the normal snapshot.
   - `v` is a friend: `this.mp.toPlayer(v, { t: 'gscare', k: id });` and the host runs `yield* this.scWatch(v, (SCARES.len[id] || 8) + 1);`
   - Solo (`!this.mp`) and the `everyone` scares: unchanged.
2. `*scWatch(v, seconds)` (new, `src/scares.js`): what the others see.
   - `yield* this.scVanish(0.4);` then place him behind the victim: `const s = this.deskSpot(v); T.place(s.stand.x, s.stand.z, s.face); T.root.visible = true; T.setPose('desk', s.corners); T.leanTarget = 0.9; T.crouchTarget = 0.3; T.lookAt(v.camPos, 8);`
   - wait `seconds`, or until the friend reports the end (step 3), then `yield* this.scBlackoutBack(0.5);`
   - `scareScene`'s existing `finally` (`scEnd()`, `T.place(0.2, -5.4, 0)`) already puts everything back.
3. The friend says when it is over. `src/scares.js` `scareGuest`: in its `finally` add `if (mp) mp.send({ t: 'press', k: 'scareDone' });`. `src/mp.js` `onHostMsg`, in the `press` branch: `else if (m.k === 'scareDone') p.scareDone = this.g.t;`. In `scWatch` stop waiting when `v.scareDone > startTime` or when `!this.players.includes(v)`.
4. The older scares that teleport him to the host (`behind`, `neck`, `flickapproach` in `scareList`, `src/game.js`): give them weight 0 when `this.mp` (`w: this.mp ? 0 : 3`). They are host-only today.

**Check:** `bash tests/run.sh mp_scares mp scares`. `tests/mp_scares.js` expects the old behaviour (the friend gets the host's scare): update those expectations to the new rule (force the victim in the test with a debug field: `game.scareVictim = <player>` read first in step 1).

**Not in this version:** an avatar animation for the frightened friend; choosing the victim by what they did.

---

## F4. New scares, the kind the pencil is

The pencil works because something makes you **choose** to look somewhere, and he is exactly there. Four more, built from the helpers that exist in `src/scares.js`: `scVanish`, `scWaitLook`, `scFaceFront`, `scLunge`, `scComesAnyway`, `scBlackoutBack`, `scSting`, `scTeacherSay`, `scUi`, `scPlay`. Read `scPencilScene` first and copy its shape. Every scene is local (it runs on the screen of the player who gets it), is never a strike, and must end by itself if the player never looks.

**Data:** add to `SCARES` in `src/data.js`:

```js
// pool: (add these four)
    shoulder: { min: 1, w: 2, cool: 160, strong: true },
    underdesk: { min: 0, w: 2, cool: 150 },
    note: { min: 1, w: 2, cool: 180, strong: true },
    stare: { min: 2, w: 2.5, cool: 170, strong: true },
// wait: (add)   shoulder: 12, underdesk: 14, note: 10
// len: (add)    shoulder: 12, underdesk: 12, note: 13, stare: 30
  texts: {
    shoulder: 'Something touched your shoulder. <b>Look behind you.</b>',
    underdesk: 'Something is under your desk. <b>Look down.</b>',
    note: "DON'T LOOK LEFT", noteLate: 'TOO LATE',
    stare: 'He is staring at you. <b>Do not look away.</b>',
    stareOthers: 'He is staring at {name}. He only moves when they look away. <b>Warn them!</b>',
    fake: 'psst... look under your desk',
  },
  stare: { speed: 1.5, look: 0.8, giveUp: 26 }, // metres per second while unwatched; how straight "looking at him" is; seconds until he gives up
```

Add each id to the `if / else if` list in `scLocal` (`grep -n "else if (id === 'flash') yield\* this.scFlash();" src/scares.js`).

| Scare | The bait | If you look | If you never look |
|---|---|---|---|
| `shoulder` | `scVanish()`. A breath right behind you: `scPlay('dread_breath', { pos: <0.4 m behind the camera> })`, a small jolt (`this.bonkShake = 0.15`), the hint `texts.shoulder` (once per class). | Wait until `Math.abs(this.yaw) > 2.2`, up to `wait.shoulder`. Then `const dir = this.scFaceFront(0.8); yield* this.scLunge(dir);` and the whisper `scTeacherSay('tw_behind', ..., { whisper: true })` ("I am... behind you."). | `scComesAnyway()` |
| `underdesk` | A chair scrape at your feet (`scPlay('chair_scrape', { pos: <under your desk>, vol: 0.5 })`), `this.bonkShake = 0.2`, the hint `texts.underdesk`. Online only: first a private caption with a **friend's name**: `this.scUi('subtitle', <a random other player's name>, SCARES.texts.fake, 'you', 3)` and `scPlay('whispers_loop', ...)` for 1.5 s. The friend never sent it. | Wait with `scWaitLook(<the floor under your desk>, 0.9, wait.underdesk)`. Then his face comes up from under the desk: this is the same reveal as the pencil. Move the reveal part of `scPencilScene` (from `T.root.visible = true` to the `tw_found` whisper) into `*scFloorFace(x, z)` and call it from both. | `scComesAnyway()` |
| `note` | The sound `paper`, then `this.scUi('showNote', SCARES.texts.note)`. Wait until the note is closed (`!this.ui.noteOpen`) or 6 s. `scVanish()`. | Wait until you look left (`this.yaw > 0.9`), up to `wait.note`: he is crouched in the aisle on your left, face at your height: `scFaceFront(0.9)` then `scLunge(dir)`, then `scTeacherSay('t_wrongseat', ...)`. | `this.scUi('showNote', SCARES.texts.noteLate)`, wait 1 s, close it, `scComesAnyway()` |
| `stare` | The slow one: you see it coming. He stands at the front, turns to you, eyes glowing (`T.eyeGlow = 1.2`), no footsteps (`this.dreadSilent = true`). The hint `texts.stare`. | While you look at him (`this.camFwd.dot(<direction to his head>) > SCARES.stare.look` and your phone is down) he stands still. Hold it for `stare.giveUp` seconds: he says `tw_dr_looking` ("What... are you... looking at?") and walks back. You win: +30 mischief. | Every moment you do not look he walks toward your desk (`this.deskSpot(this.me)`: first `approach`, then `stand`) at `stare.speed`. Freeze him by setting `T.moveTarget = null`, move him with `T.moveTo(x, z, speed)`. When he arrives: `scFaceFront(0.8)`, `scLunge(dir)`. |

All four end with `yield* this.scBlackoutBack(0.4);` and reset what they changed in `finally` (`this.dreadSilent = false`, `T.eyeGlow = 0.12`).

**`stare` online:** it is the one scare everybody should watch. Run it as a normal host scene (not a local one) so friends see him move through the snapshot: in `scareScene`, for `id === 'stare'` with a friend as victim, the host runs the walking part itself using `v.camFwd` and `v.phoneUp` for "is looking", sends the hint `texts.stareOthers` to the others, and only the final lunge goes to the victim (`this.mp.toPlayer(v, { t: 'gscare', k: 'lunge' })`, where `lunge` is a tiny local scene: `scFaceFront`, `scLunge`, wait 0.9 s, `scBlackoutBack`). The friends can see him getting closer while the victim looks at their phone, and shout.

**Check:** `node tools/check.js ideas` (the four `F4` lines: each scare starts, ends by itself and puts everything back), then `bash tests/run.sh scares dread`.

**Not in this version:** new models, new sounds, a selfie on the phone, an extra kid in Kevin's chair.

---

## F5. Online: trust, and telling on a friend

**What the player sees.** Online, the "raise your hand" menu gets a fourth choice: **"Tell on BO"** (the friend you are looking at, else the friend who was loudest lately). He turns and looks at that friend at once.

- **It was true** (the friend was whispering, on the phone, aiming, off their chair, or repeated him in the last 5 seconds): the friend gets **trouble** (below). You get 1 trust. The friend is told: "ALEX told on you!".
- **It was not true:** "No... I do not... believe you." You lose 1 trust and he keeps an eye on you.

**Trouble** (used again in F6): he walks to that friend's desk, bends over it, says "I see you.", and that friend gets a jump scare on their own screen. He keeps an eye on them for 25 s. It is **not** a strike.

**Data** (paste into `src/data.js`):

```js
// ---- online: trust (src/trust.js). Telling on a friend; the class monitor (F6) needs trust.
export const TRUST = {
  max: 3, recent: 5, cooldown: 20, watch: 25, liarWatch: 15,
  label: 'Tell on {name}',
  told: '<b>{name}</b> told on you!',
  toast: 'HE CAUGHT {name} · told by {by}',
  liar: 'He did not believe you.',
};
```

**Build** (new file `src/trust.js`, a mixin):

1. "Recent": per player keep `p.badAt`: in `playerActs` (`src/game.js`), after `p.selfNoise` is set: `if (p.selfNoise >= 0.6 || p.phoneUp || p.aiming || p.out) p.badAt = this.t;` and in `doEcho`: `p.badAt = this.t;`. Reset it in `resetPlayer` (`badAt: -99, tellAt: -99`).
2. The choice. In `openAsk(p)` (`grep -n "  openAsk(p = this.me) {" src/game.js`): when `this.mp` and there is another seated player `q` and `this.t - p.tellAt > TRUST.cooldown`: `q = ` the player `this.aimFriend(p)` returns if it is a player, else the other player with the highest `heat`. Add the label `TRUST.label.replace('{name}', q.name)` as the last choice; picking it calls `this.tellOn(p, q)` and not `askQuestion`.
3. `tellOn(p, q)`: `p.tellAt = this.t; p.handT = 2.8; this.interrupt(this.reactTell(p, q));`
4. `*reactTell(p, q)`: `this.lockBully = true` in `try`, cleared in `finally`.
   - `T.lookAt(q.camPos, 10); T.facePoint(q.camPos, 5); yield* this.wait(0.9);`
   - true (`this.t - q.badAt <= TRUST.recent`): `p.trust = Math.min(TRUST.max, p.trust + 1); this.note(p, 'snitched'); this.uiTo(q, 'hint', TRUST.told.replace('{name}', p.name), 4); yield* this.trouble(q, p);`
   - else: `yield* this.say('t_bl_no'); p.trust = Math.max(0, p.trust - 1); p.watchedT = TRUST.liarWatch; this.uiTo(p, 'status', TRUST.liar, 3);`
5. `*trouble(q, by)`: toast to everybody (`TRUST.toast`), then like the start of `askWhoDidIt` (`src/blame.js`): walk to `this.deskSpot(q)` (`approach`, then `stand`), `T.faceTo(spot.face, 5)`, `T.setPose('desk', spot.corners); T.leanTarget = 0.9;`, `yield* this.say('t_see');`, then the scare on that player's screen only: local player `yield* this.scLocal('lunge')`, a friend `this.mp.toPlayer(q, { t: 'gscare', k: 'lunge' })` and wait 2.5 s. (`lunge` is the tiny scene from F4. If F4 is not built yet, add it now: `scFaceFront(0.8)`, `scLunge(dir)`, wait 0.9 s, `scBlackoutBack(0.4)`.) Then `q.watchedT = TRUST.watch; q.heat += 15;`. `finally`: pose back to `'rest'`, `T.leanTarget = 0`.
6. A strike sets that player's trust to 0: in `bustedSeq` add `p.trust = 0;`.
7. The chaos board: add `snitched: 14` to `CHAOS.weights` and `'snitched'` to the keys of the `snitch` title (`src/data.js`).

**Voice lines used:** `t_see`, `t_bl_no`.

**Check (by hand, two browser tabs: HOST A CLASS in one, JOIN in the other):** one tab holds the phone up; the other presses T and picks "Tell on …": he goes to the first tab's desk, that tab gets the scare, the second tab's TRUST shows one star. Then `bash tests/run.sh mp mp_extras`.

**Not in this version:** telling on Sam, Nora or the kids; a strike from being told on.

---

## F6. Online: the class monitor

**What the player sees.** When he leaves the room (the event that exists: "Do not... move.") and a player has 2 or more trust, he first points at the most trusted one: "You. Such a... good... student." That player is **in charge** until he comes back (30 seconds):

- They stand up and walk freely (the same keys as crawling, standing and faster).
- Looking at a friend and pressing **E** writes that friend's **name on the board**. He believes every name on the board, true or not.
- They can do what an off-the-chair player can do: read his laptop, move the clock, the cushion, his glasses.
- The others see the monitor standing in the room. A paper ball that hits the monitor makes them drop the chalk for a moment.
- **The catch:** his footsteps in the hall are the warning. When the door opens the monitor must be **standing at the board**. If so: "I... am... back. Good." and every friend whose name is on the board gets **trouble** (F5: he comes to their desk, a jump scare on their screen, no strike). If the monitor is anywhere else: "Where... did you... go?", he catches them like any player who left their seat (the scene that exists: by the collar, back to the chair, a strike), their trust goes to 0 and the names are wiped.

**Data** (paste into `src/data.js`):

```js
// ---- online: the class monitor (src/monitor.js), on top of the event "he leaves the room"
export const MONITOR = {
  trust: 2,                 // trust needed
  speed: 1.9, eye: 1.5,     // walking: metres per second, eye height (crawling: SNEAK.speed, SNEAK.eye)
  start: { x: 0, z: -5.4 }, // where the monitor stands first
  zone: { x: 2.9, z: -4.5 },// "at the board": |x| < zone.x and z < zone.z
  marks: 4, perFriend: 1, punish: 2, // names per turn, per friend, how many he goes to
  stun: 2.5,                // seconds without chalk after a paper hit
  row: 3, slot: 190, size: 46, // where the names go on the board: the last row, pixels per name
  inCharge: '{name} IS IN CHARGE',
  you: 'You are in charge. <b>Walk</b> around. Look at a friend and press <span class="desk-only"><b>E</b></span><span class="touch-only"><b>USE</b></span> to write their name on the board. <b>Be at the board when he comes back.</b>',
  others: '{name} is watching the class for him. A name on the board means trouble.',
  prompt: 'write {name} on the board',
  wrote: '{name} is on the board',
  full: 'No more room on the board.',
  dropped: 'You dropped the chalk!',
};
```

**Build** (new file `src/monitor.js`, a mixin). Read `*ev_leave()` in `src/events.js` first (`grep -n "  \*ev_leave() {" src/events.js`): the monitor is three hooks in it.

1. **Appoint** (in `ev_leave`, after `yield* this.say('t_lv_dontmove', 0.5);`): when `this.mp`: `const m = ` the seated, non-ghost player with the highest `trust`, if that is `>= MONITOR.trust`. If there is one: `T.setPose('point', { at: m.camPos.clone() }); yield* this.say('q_you'); yield* this.say('t_good'); T.setPose('rest'); this.monitorStart(m);`
2. `monitorStart(m)`: `this.monitor = { p: m, names: [], stunUntil: 0 }; m.monitor = true;` put them on their feet with the off-chair system: `this.startOut(m); this.onOut(m); m.pos.set(MONITOR.start.x, 0, MONITOR.start.z); m.slipK = 1;` Toast to all (`MONITOR.inCharge`), hint to `m` (`MONITOR.you`), hint to the others (`MONITOR.others`). Add the flag to the snapshot row (`sneakRow`: one more number, `p.monitor ? 1 : 0`) and read it in `applyMySneak` / `applyOtherSneak`.
3. **Walking, not crawling.** Wherever the off-chair code uses `SNEAK.speed` and `SNEAK.eye` (`grep -n "SNEAK.speed\|SNEAK.eye" src/*.js`), use `MONITOR.speed` / `MONITOR.eye` when that player has `monitor`. In `src/mp.js` `Avatar.update`, the `else if (k > 0.001)` branch draws a crawling body (`rotation 1.22`, height `0.4`): for a monitor (`st.monitor`) draw it upright: rotation x `0`, height `this.home.y`. Pass `monitor: p.monitor` in the two `avatar.update(...)` calls. The monitor has no sneak meter and he cannot "see" them (he is out of the room): skip `updateSneakSight` for a monitor.
4. **A name on the board.** For the monitor, in the off-chair action code (`localSneak` in `src/sneak.js` writes the prompt and handles E): when `this.aimFriend(me)` is a player `q`: prompt `MONITOR.prompt`; on E (one press, not hold): local host calls `this.monitorWrite(me, q)`, a friend sends `{ t: 'press', k: 'mark', id: q.id }` and `onHostMsg` (`src/mp.js`) calls `g.monitorWrite(p, q)`.
   - `monitorWrite(m, q)`: only if `this.monitor && this.monitor.p === m`, `this.t > stunUntil`, fewer than `MONITOR.marks` names, and `q` not on the list yet. Then `names.push(q)`, `this.world.board.write(q.name.toUpperCase(), MONITOR.row, { indent: 40 + (names.length - 1) * MONITOR.slot, size: MONITOR.size });` (the board is already sent to friends), `this.note(m, 'marks')`, status to `m` (`MONITOR.wrote`), hint to `q` ("ALEX wrote your name on the board!").
5. **Paper.** In `bonk` (`grep -n "  bonk(" src/pranks.js`): when the target is `this.monitor.p`: `this.monitor.stunUntil = this.t + MONITOR.stun;` and status `MONITOR.dropped` to the monitor.
6. **He comes back** (in `ev_leave`, right after `this.present = true; this.away = false;`): when `this.monitor`: `yield* this.monitorReturn();` and skip the usual "who is still at it" block.
   - `*monitorReturn()`: `const { p: m, names } = this.monitor; const ok = this.players.includes(m) && Math.abs(m.pos.x) < MONITOR.zone.x && m.pos.z < MONITOR.zone.z;`
   - `ok`: `yield* this.say('t_lv_back'); yield* this.say('t_good1'); this.seatNow(m); m.monitor = false; this.mischief += 30;` then for the first `MONITOR.punish` names still in the class: `yield* this.trouble(q, m);`
   - not `ok`: `yield* this.say('t_sn_where'); m.trust = 0; m.monitor = false; this.world.board.erase(1.5); this.bust('seat', m); return;` (`bust('seat', p)` is the scene that exists for a player caught off their chair).
   - `finally`: `this.monitorEnd()`: `if (this.monitor) { const m = this.monitor.p; m.monitor = false; if (m.out) this.seatNow(m); this.monitor = null; this.boardRow = 4; }` (`boardRow = 4` makes him wipe the board before his next line).
7. Call `monitorEnd()` also from the `finally` of `ev_leave`, from `reset()`, and from `removePlayer` when the monitor leaves.

**Voice lines used:** `q_you`, `t_good`, `t_lv_back`, `t_good1`, `t_sn_where`, `t_see`.

**Check (by hand, two tabs):** in the host's console (`?debug=1` in the URL): `game.players[1].trust = 2; game.interrupt(game.ev_leave())`. The friend's tab must: get "… IS IN CHARGE", stand up and walk, write the host's name with E. Wait at the board: the host gets the scare. Do it again and stay at his desk: the friend is caught. Then `bash tests/run.sh mp mp_sneak mp_events events sneak`.

**Not in this version:** hiding his glasses in a friend's desk; wiping your own name off the board; a monitor in solo play; more than one monitor.

---

## After the features (only if the owner asks)

- Add one line per feature to `README.md` ("How to play") and to `src/howto.js`.
- New voice lines to replace the borrowed ones ("You. Watch... them.", "I... trusted... you.").
