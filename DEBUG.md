# DEBUG.md: fixes for Madi Class

For the AI agent (Opus) that works on this repo. Read the rules once, then do only the part the owner names.

## Rules (they keep the work small)

1. **One part per session.** Do the part the owner names (A, B or C). Then stop and report in 5 lines: what changed, what the checks print, what is left open.
2. **Open only what a task names.** `src/game.js` is 170 KB: never read it whole. Find the place with `grep -n "<the snippet in the task>" src/*.js` and read 40 lines around it. Do not open `BUG_REPORT.md`, `PLAN.md`, `src/clips.js`, `vendor/` or `assets/`.
3. **Smallest change that does the job.** No refactors, no renames, no new files unless the task says so, no reformatting, no edits to `README.md` or `PLAN.md`.
4. **No new sounds or voice lines.** Use only audio that exists (the ids are in `src/audio.js` and `assets/audio/voices.json`). Do not run `tools/gen_sfx.py` or `tools/gen_voices.py`.
5. **Check with the checker, not by reading.** `node tools/check.js` prints one PASS or FAIL line per task in about a minute. It plays the real game with a fixed seed, so the same code always gives the same result.
6. **Never run `bash tests/run.sh quick` or `full`** (17 and 40 minutes). Run only the tests a task names, like `bash tests/run.sh events dread` (under a minute each).
7. **Three tries.** If a task does not pass after three attempts, undo it (`git checkout -- <files>`), write one line why under "Left open" in your report, and go on.
8. **One commit per task**, message `D21: caption for the right player`. Do not push or open a pull request unless the owner asks.
9. **Do not ask questions.** If something is unclear, pick the simplest option and say which one in the report.

## The checker

```bash
node tools/check.js            # sound + stuck + hud, about 1 minute
node tools/check.js online     # host + friend in two browsers (run `npm install` in tests/ once)
node tools/check.js ideas      # the new features of IDEAS.md
```

Each line starts with `PASS` or `FAIL` and the task number. The last line is the count. It needs Node, Python 3 and Playwright with Chromium, the same as `tests/`.

---

## Part A: already fixed and tested (apply the patch)

`fixes.patch` holds the 18 tasks below (about 30 separate bugs) and one small feature (the stomach pat, `IDEAS.md` F1). It was written and tested against this repo at commit `80cf993`:

- every check of `tools/check.js` that belongs to it failed before the patch and passes with it (23 lines: `node tools/check.js` and `node tools/check.js online`);
- these tests of the repo pass with it: `events blame sneak replay secrets extras pranks dread ui touch features scares beats replay_touch`, and online `mp mp_extras mp_scares mp_dread mp_prank mp_replay mp_sneak mp_blame mp_video`. One check of `mp_events` ("late join: in the middle of the alarm") fails with and without the patch on a slow machine, because the third browser joins after the alarm has ended: ignore that one line.

```bash
git apply --check fixes.patch
```

```bash
git apply fixes.patch
```

```bash
node tools/check.js
```

```bash
node tools/check.js online
```

```bash
bash tests/run.sh events dread scares blame sneak pranks ui
```

Expected: every `D` line is PASS and the seven tests pass. Commit as `Part A: apply fixes.patch`. That is all of Part A: do not "improve" the patch.

If `git apply --check` fails, the code has moved. Do not rewrite the fixes from memory: open `fixes.patch` and make the same edits by hand, hunk by hunk (each hunk shows the lines around the change).

What the patch changes, so you know what you are looking at:

| Task | What was wrong | Where |
|---|---|---|
| D1 | Story mode could lock up on the last strike: a story beat replaced the last jump scare, black screen, no end screen. Now nothing can replace that scene (`this.jumping`) and it always reaches `finish()`. | `src/game.js` `jumpscare`, `interrupt`, `playTick` |
| D2 | A reaction started from inside his own scene threw away that scene's cleanup (whoopee cushion + "hates laughing": no more scares for the rest of the class). `interrupt()` now waits until the current step is over (`inBrain`, `pendingBrain`). | `src/game.js` `interrupt`, `playTick` |
| D3 | His snoring: 3-4 copies at once, and 13 s more after he woke up. Now one loop tied to `dozing`, on every screen. | `src/events.js` `eventVisuals`, `src/quirks.js` `actDoze` |
| D4 | After a restart his jaw moved with no sound, friends skipped their lines, and he could stay upside down. `reset()` now clears `voiceUntil`, `speakUntil`, `showCool` and his rotation. | `src/game.js` `reset`, `resetPlayer` |
| D5 | The drone came back on the "caught" end screen; the fire alarm rang through the last jump scare; the lean's breathing went on after it ended. | `src/game.js` `bustedSeq`, `src/events.js` `loopWhile`, `fxAlarm`, `src/dread.js` `dreadLean` |
| D6 | He cut off his own sentences. One glare at a time, and a line waits for the one before it. | `src/game.js` `glareWarn`, `say` |
| D7 | Giggles piled up. One helper with a 1.6 s limit: `classGiggle(pos, vol)`. | `src/pranks.js`, callers in `game.js`, `blame.js`, `secrets.js`, `videos.js` |
| D8 | Jump scares started on top of his nap, his counting, his chair. | `src/game.js` `updateDirector` |
| D9 | A note that arrived while E or Q was held closed in the same frame. | `src/game.js` `updateActions`, `src/mp.js` `guestActions` |
| D10 | One caption line for everybody: about 13 captions per class were wiped unread. Now a small stack, one line per speaker, each at least 1.2 s. | `src/ui.js` `subtitle`, `drawCaps`, `update` |
| D11 | Tips were wiped by small messages. Tips now wait their turn (3.2 s each) and come back if a message covers them. Small feedback ("Not now.", "PAPER BALL ready") goes to a new line, `ui.status()`, element `#status`. | `src/ui.js` `hint`, `status`, `src/events.js` `showHint`, `index.html`, callers |
| D12 | Things covered each other: the hint over the strikes, "your phone is buzzing" over the prompt, toasts over the task list, captions over the touch buttons. | one block at the end of `style.css`; `body.toasting`, `body.choosing` |
| D13 | The "TODAY HE" list is removed (the owner asked). The first-time tip for each habit stays; `ui.quirkList` still holds what was noticed. | `src/ui.js` `setQuirks`; `tests/events.js`, `tests/mp_events.js` updated |
| D14 | Online: the host's private messages went to every friend ("You are a ghost", key tips, Sam's note opened on every screen). | `src/ghost.js`, `src/game.js` `giveNote`, `src/blame.js` `toolHint`, `src/videos.js`, `src/sneak.js` |
| D15 | Online: Sam's and Nora's "Psst!" and the buzzing phone could only be answered by the host and everybody paid. Off online. | `src/game.js` `freeScript` |
| D16 | Online: the tip said "Three strikes" while the class had 5. | `src/game.js` `freeScript` |
| D17 | Online: a friend got the host's red flash and shake during their own scare; a friend's scare kept running over the end screen. | `src/mp.js` `applySnapOnce`, `apply`, `showEnd`, `leave` |
| D18 | Online: a friend who switched apps was still "holding" the phone for 20 s. | `src/game.js` `remoteActs` |
| F1 | New: he pats his stomach while he thinks at the board. | `src/game.js` `bellyPat`, `src/teacher.js` pose `'belly'`, `BELLY` in `src/data.js` |

Three rules the patch introduces. Keep them in everything you write later:

- **Three kinds of message.** A tip for the class (how to play, what is going on): `this.showHint(text, seconds)`; it waits its turn. A message for one player about right now: `this.uiTo(p, 'hint', text, seconds)`; it shows at once. Small feedback to a key press: `this.uiTo(p, 'status', text, seconds)`. Never call `this.ui.hint(...)` from game code: online that sends the text to every player.
- **A sound that belongs to a state is a `loopWhile` line in `eventVisuals`** (`src/events.js`), not a timer that plays it again and again.
- **`interrupt()` may be called from anywhere**, also from inside his own scene: it swaps the scene when the current step is over, so every `finally` runs.

---

## Part B: still to fix (one session)

Do these in order. After each: the named check, then commit. Find every place with `grep -n`, the snippet is given.

### D19. Online: control tips for the friend's own device

- **Problem:** the tips are written for the host's device and sent to everybody. A friend on a phone reads "Press R", a friend on a PC reads "Tap ECHO".
- **Where:** `grep -n "const touch = this.input.touch" src/game.js src/sneak.js` (in `hintControls`, `freeScript`, `giveSneak`) and `grep -n "showHint(touch ?" src/*.js`.
- **Change:** every `touch ? 'A' : 'B'` inside a `showHint(...)` or `h(...)` call becomes one string with both: `` `<span class="touch-only">A</span><span class="desk-only">B</span>` ``. The classes exist in `style.css` (`body.touch .desk-only { display: none }`). `DREAD.text.leanHint` in `src/data.js` already does it this way: copy that.
- **Do not touch** `touch ?` choices that are shown with `uiTo(me, ...)` or on the local screen only.
- **Check:** `node tools/check.js` (D11 must still pass), then `bash tests/run.sh touch ui`.

### D20. Online: who was caught, at the moment it happens

- **Problem:** he walks to somebody's desk and everybody's controls stop for 10 seconds. The name comes only at the end; on the last strike never.
- **Where:** `grep -n "  bust(reason, p = this.focus) {" src/game.js`.
- **Change:** in `bust()`, when `this.mp`: send a toast to every player right away, with the existing helper pattern of `mp.strikeToast` (`grep -n "strikeToast" src/mp.js`): "HE CAUGHT BO" on the others' screens, "HE CAUGHT YOU" on the caught player's screen. Add a small function `caughtToast(p)` next to `strikeToast` and call it from `bust()`.
- **Check:** `node tools/check.js online` (the "online run" line must still pass), then `bash tests/run.sh mp`.

### D21. Online: Sam's and Nora's answers are captioned for the player they answer

- **Problem:** one player whispers with Sam and every screen shows "Sam: …".
- **Where:** `grep -n "  sayAt(c, id, noise = 0, vol = 1.15) {" src/game.js` and its caller in `updateTalk` (`grep -n "this.friendSay(f, (this.present ? f.bag : f.earlyBag).next()" src/game.js`).
- **Change:** give `sayAt` and `friendSay` a fifth argument `to = null`. When `to` is a player, show the caption with `this.uiTo(to, 'subtitle', c.name, meta.text, ..., ...)` in place of `this.ui.subtitle(...)`. Pass `p` from `updateTalk`. Leave every other caller as it is. The sound stays as it is.
- **Check:** `bash tests/run.sh mp features`.

### D22. Online: a friend's own meme videos count

- **Problem:** a friend watches a whole video on their own phone; the task does not tick and they get no credit.
- **Where:** `grep -n "ph.onFeedDone" src/videos.js` and `grep -n "replayFromGuest" src/replay.js`.
- **Change:** in `onFeedDone`, when `this.role === 'guest'`: `this.mp.send({ t: 'p6', k: 'video' }); return;`. In `replayFromGuest(p, m)` add: `else if (m.k === 'video' && p.phoneUp && this.t - (p.vidAt ?? -9) > 3) { p.vidAt = this.t; this.note(p, 'videos'); this.track.event(this.t, p, 'video', { how: 'feed' }); this.completeObjective('video'); }`
- **Check:** `bash tests/run.sh mp_video mp_replay`.

### D23. Small fixes (each is a few lines)

| # | Problem | Find it with | Change |
|---|---|---|---|
| a | His glasses jump from his desk back onto his face after a paper hit. | `grep -n "if (T.glasses.parent !== T.head && !T.glassesHeld) { T.wearGlasses(); this.blind = false; }" src/pranks.js` | In `reactPrank`: `let flew = false;` then `if (part === 'head' && this.glassesAt === 'face') { flew = true; yield* this.glassesFlyOff(); } else yield* this.wait(part === 'board' ? 0.35 : 0.45);`. Run that `finally` line only when `flew`. In `glassesHit` (`src/secrets.js`): `if (this.glassesAt !== 'face') return false;` first. |
| b | An open note stays on screen through the whole "caught" scene. | `grep -n "  bust(reason, p = this.focus) {" src/game.js` | In `bust()` and at the top of `jumpscare`: `if (this.ui.noteOpen) { this.ui.closeNote(); this.noteLatch = true; }` |
| c | A dumb question cuts a jump scare or "Who did it?". | `grep -n "this.interrupt(this.reactQuestion(q, p.qCount, p));" src/game.js` | Name the timer callback `fire`. First line: `if (this.eventLock || this.scareBusy || this.blameBusy) { this.timers.after(0.5, fire); return; }`. Add `&& !this.blameBusy` to `canAsk`. |
| d | "Turn your phone sideways" does not react when you turn the phone. | `grep -n "const launch = (mode, ch) => {" src/main.js` | Leave `resize` alone (it runs before `launch` exists). Right **after** the `launch` function add: `const unrotate = () => { if (input.touch && innerHeight <= innerWidth && !$('rotate').classList.contains('hidden')) { ui.show('rotate', false); if (pending) { const p = pending; pending = null; launch(...p); } } }; addEventListener('resize', unrotate); addEventListener('orientationchange', () => setTimeout(unrotate, 250));` |
| e | A video somebody sent you is lost if you switch apps. | `grep -n "  switchApp() {" src/phone.js` | First lines: `if (this.mission && !this.mission.player.done) { if (this.mode !== 'video') { this.feed.pause(); this.game.pause(); this.psst.pause(); this.mode = 'video'; this.redraw = 0; } return; }` |
| f | The desk-action bar stays after you are caught at his desk. | `grep -n "if (me.deskJob || this.sneakAimOn) this.sneakUi(null);" src/sneak.js` | `if (me.deskJob || this.sneakAimOn) { this.sneakAimOn = false; ui.aim(null); }` |
| g | The SEAT button stays in a class without sneaking. | `grep -n "this.sneakQuipped = false; this.sneakSeatOn = '';" src/sneak.js` | `this.sneakSeatOn = null;` |
| h | "Punishments" lower his anger when it is already high. | `grep -n "this.anger = Math.min(" src/game.js src/videos.js` | Each `this.anger = Math.min(CAP, this.anger + N)` becomes `this.angerUp(N, CAP)`. |
| i | Kids keep staring at the pizza box after you are caught. | `grep -n "\*ev_pizza() {" src/events.js` | In its `finally`: `this.lookAllBack();` |
| j | The open choice menu stays over the bell scene. | `grep -n "  \*freeEnding() {" src/game.js` | First line of the body: `if (this.choice) this.pickChoice(-1);` |

- **Check after all ten:** `node tools/check.js`, then `bash tests/run.sh pranks sneak blame events features touch`.

---

## Part C: not planned

These are real but small. Leave them unless the owner asks for one by name. The long description of each is in `BUG_REPORT.md` under the same id.

A2, A4, A7, A8, A13, A14, A15, O9, O12, O13, O14, O15, O16, O17, O18, S2, S6, S9, S10, S11, P5, P6, P7, P9, P10, P11, P12.
