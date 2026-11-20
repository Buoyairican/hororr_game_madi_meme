# Past Summit: bug report and fix list

Written for the engineer (or AI agent) who will fix these. Reviewed at commit `80cf993` (main).

## How to use this document

- Work in the batches below, in order. Each batch is one pull request. Run `bash tests/run.sh quick` after each batch and `full` before merging the last one.
- Follow the repo's own rules in `PLAN.md` ("Rules for every phase"): features live in mixins, numbers and texts live in `src/data.js`, every change must also work online (host and guests), new sounds come from `tools/gen_sfx.py`.
- Every finding has a **Check**: how to prove the fix worked. Section 8 lists the permanent tests to add.
- Do not change behaviour that is not listed here. Section 7 lists what was checked and is fine.

### How the evidence was gathered

| Label | Meaning |
|---|---|
| **MEASURED** | Seen in a real run. 144 full classes were played in headless Chromium: three batches of 48 (Free Class and all 4 story periods, Easy and Hard, quiet and active random players, every quirk and event). Every `audio.play`, caption and hint was recorded in game time. Counts below are per batch of 48 unless they say otherwise. One 3-player online class was recorded on all three screens. The HUD was measured at 6 screen sizes. Several findings were then reproduced one by one. |
| **READ** | Found by reading the code path line by line. Not reproduced in a run. |

No class crashed and no JavaScript error appeared in any solo class or in the online class. The bugs below are about things that overlap, leak or get stuck, not about crashes.

Severity: **HIGH** = a player notices it in most sessions. **MEDIUM** = noticeable, not every session. **LOW** = small or rare.

### The ten to fix first

| # | Finding | Why first |
|---|---|---|
| 1 | **K1** story mode can lock up on the last strike (black screen, no end screen) | the player must reload the page |
| 2 | **K2** a reaction started from inside his own scene drops that scene's cleanup | leaves the class half-dead until it ends |
| 3 | **A1** the snoring stacks and does not stop | reported by the owner; every class with that quirk |
| 4 | **O1, O2, O5** the host's private hints, notes and "Psst!" calls land on every friend's screen | the main reason online is confusing |
| 5 | **O7** online jump scares leak and run out of step | scares are the point of the game |
| 6 | **C1, C2** captions and hints replace each other (about 13 and 5 times per class) | players miss what was said and how to play |
| 7 | **H1, H2** hints over the strikes; the phone alert over the prompt | on every phone and laptop |
| 8 | **A3** he cuts off his own sentences | several times per class |
| 9 | **A9, A10** the drone comes back on the "caught" end screen; the fire alarm rings through the last jump scare | the most common ending |
| 10 | **A12** after a period ends, the next one starts with his jaw moving and no voice | every NEXT PERIOD |

---

## 0. Batch 0: the game gets stuck

### K1. Story mode locks up on the last strike (CRITICAL, MEASURED)

- **Where:** `src/game.js:2332` (`beat`), `:1252-1264` (`cmd`), `:1244-1249` (`interrupt`), `:1944-1992` (`jumpscare`), `:327` (the story script runs every tick).
- **What the player sees:** the last strike. Lights out, his face, the scream. Then the screen stays black. No end screen. The keys do nothing and Esc does not open the pause menu. His voice goes on with the story in the dark. Only reloading the page helps.
- **Measured:** story period 4, active player, third strike at t = 337.3 s. Trace of that run:
  - 337.35 `lights_off` from `jumpscare` (`game.js:1953`), `ending = true`, `cutscene = true`.
  - 339.10 `scream`, `sub_hit`, `glitch` (his face).
  - 340.53 `stopAll()` (`game.js:1988`); the scene now waits 1 s before `finish()`.
  - 341.90 he says "Mister Hale... is... resting." This is the story beat at `game.js:3244` (`beat(() => this.saySomething('t_hale'))`).
  - From then until the run was stopped at 900 s: `state === 'playing'`, `ending === true`, `cutscene === true`, input off, blackout 1. He wrote on the board, wiped his glasses and sat on his chair, in the dark.
  - Reproduced step by step afterwards (the Check below): 150 s after the story beat replaced the jump scare the game was still `playing`, with `ending` and `cutscene` true, input off, `blackout === 1` and no end screen.
  - It happened in 1 of 24 story runs. It needs a story beat to fire inside the 4 seconds of the last jump scare, so a player who keeps him busy (echoes, questions, pranks) is the one who hits it.
- **Cause:** `beat()` waits for him to be free with a 40 s limit (`yield* this.until(() => this.ready(), 40)`). When the limit runs out it calls `cmd()`, and `cmd()` calls `this.interrupt(wrapped)` no matter what is running. If that is the final jump scare, `interrupt` returns it before it reaches `this.finish(kind)`. `jumpscare` has no `finally`. Nothing ever ends the class, and `jumpscare` already turned the input off (`this.input.enable(false)`), which also blocks Esc (`input.js:73`).
- **Fix (all three):**
  1. Nothing may replace the final jump scare, and it must always reach the end screen:
     ```js
     *jumpscare(kind) {
       this.jumping = true;
       try {
         // ... the existing body, without the last line `this.finish(kind)`
       } finally {
         this.jumping = false;
         if (this.state === 'playing') this.finish(kind);
       }
     }
     interrupt(gen) {
       if (this.jumping) return;          // the last jump scare always plays to the end
       // ... as before
     }
     ```
     Set `this.jumping = false` in `reset()` (it drops the brain without running `finally`).
  2. A story beat never cuts into a scene where somebody is being caught. In `cmd()`, before each `this.interrupt(wrapped)`: `yield* this.until(() => !this.cutscene && !this.jumping, 30); if (this.ending && this.state === 'playing' && this.jumping) return false;`
  3. In `playTick`: do not step the story script during the final jump scare: `if (this.script && !this.jumping && this.script.next().done) this.script = null;`
- **Why the tests missed it:** `tests/fuzz.js` skips its "cutscene stuck" check when `g.ending` is true. Add: `ending` true for more than 60 s while `state === 'playing'` is an error.
- **Check:** new test: story period 4, `game.strikes = game.maxStrikes - 1; game.bust('noise', game.me);` tick 3 s; `game.interrupt((function* () { yield; })());` tick 10 s; `game.state` must be `'end'`.

### K2. A reaction started from inside his own scene throws away that scene's cleanup (HIGH, MEASURED)

- **Where:** `src/game.js:1244-1249` (`interrupt`), `:330-331` (`playTick`); found through `src/sneak.js:715-741` (`cushionPop`), `src/pranks.js:703` (`addLaugh`), `src/quirks.js:169-180` (`laughQuirk`).
- **What the player sees (the case that was reproduced):** the class has the "hates laughing" quirk and you put the whoopee cushion on his chair. He sits on it and says "No... laughing." He never asks "Who did it?". The cushion stays on the chair. For the rest of the class there are no more jump scares from the director, he never creeps up on you or leans over a desk again, and at anger 70 he only glares.
- **Measured:** reproduced in the real game. With the laugh quirk: 60 s after the pop, `sneakBusy === true`, `cushionShown === true`, no "Who did it?", and the console shows `TypeError: Generator is already running at idleBrain.return ← Game.interrupt`. The same steps without the laugh quirk: `sneakBusy === false`, "You... Who... did it?" asked.
- **Cause:** `cushionPop` runs inside the brain generator. It calls `addLaugh(45)`, which calls `laughQuirk`, which calls `this.interrupt(this.reactLaugh(...))` while the brain is still executing. `this.brain.return()` on a running generator throws; `interrupt` catches it with `console.warn` and installs the new brain anyway. The old generator is never returned, so its `finally { this.sneakBusy = false; ... this.cushionShown = false; }` never runs. `sneakBusy` gates the scare director (`game.js:2021`), the warning (`game.js:1230`) and the creep / lean (`dread.js:325`).
- **Fix:** make `interrupt()` safe to call from inside the brain. Defer it to the end of the current step:
  ```js
  // playTick
  if (!this.brain) { this.brain = this.idleBrain(); this.brainIdle = true; }
  this.inBrain = true;
  let step;
  try { step = this.brain.next(); } finally { this.inBrain = false; }
  if (this.pendingBrain) { const g = this.pendingBrain; this.pendingBrain = null; this.interrupt(g); }
  else if (step.done) { this.brain = null; this.brainIdle = false; }

  // interrupt
  interrupt(gen) {
    if (this.jumping) return;
    if (this.inBrain) { this.pendingBrain = gen; return; }   // replace it once this step is over: its finally blocks run
    // ... as before
  }
  ```
  Reset `inBrain` and `pendingBrain` in `reset()`. Also make `laughQuirk` glare only (not interrupt) while `this.sneakBusy || this.blameBusy || this.sitting`.
- **Related (LOW, READ):** state that is set just before `interrupt()` leaks when the new generator is replaced before its first step (`events.js:327-333` `classEvent`, `game.js:1867-1872` `cutscene`, `game.js:895-899` `qBusy`). Give `interrupt()` a drop hook: when the brain it replaces has never been stepped, call `gen.onDrop && gen.onDrop()`; set `onDrop` at those three places to undo the flag.
- **Check:** the repro above ends with `sneakBusy === false`, `cushionShown === false` and "Who did it?" asked. No `already running` warning in any test log (make `tests/lib.js` fail on it).

---

## 1. Batch 1: sounds that overlap or do not stop

### A1. His snoring stacks on itself and keeps going after he wakes up (HIGH, MEASURED)

This is the bug the owner reported.

- **Where:** `src/quirks.js:226-233` (`actDoze`), `src/quirks.js:257-262` (`wakeUp`).
- **What the player hears:** 3 to 4 snores on top of each other while he sleeps. After he wakes up ("I was... not... sleeping."), the snoring continues for up to 13 seconds, over the next scene.
- **Measured:** he fell asleep in 39 classes (two batches); the snores overlapped in 34 of them. Up to 4 copies at once, about 170 overlapping pairs per batch. Snoring was still audible up to 13.2 s after `dozing` became false. In several classes he slept for under 1 s (an event woke him) and the snore still played for the full 13 s.
- **Cause:** the loop calls `A.play('m_snore', { rate: 0.62, ... })` every 3.3 s. The file is 8.2 s long, so 13.2 s at that rate. The handle is thrown away, so nothing can stop it: not `wakeUp`, not the `finally` block, not an interrupt.
- **Fix:** use the helper the game already has for sounds that belong to a state, `loopWhile` (`src/events.js:930`). It starts one looping copy, moves it, and fades it out the frame the state ends. It runs on every screen, so guests get it too (`dozing` is already in `eventSnap` and `dropEventState`).
  1. In `eventVisuals` (`src/events.js`, next to the `humSnd` line, about line 965) add:
     ```js
     this.loopWhile('snoreSnd', this.dozing && here, 'm_snore', here ? T.headWorld(_c) : null, { ref: 2, vol: 0.85, reverb: 0.25, rate: 0.62 }, 0.3);
     ```
  2. In `actDoze` delete the `A.play('m_snore', ...)` call. Keep the `*snoring* 💤` caption on its own timer (every 4 s is enough).
  3. Listen to the loop point. If the MP3 clicks or leaves a gap when it loops, regenerate `m_snore` in `tools/gen_sfx.py` so it starts and ends in silence between two snores.
- **Check:** in a class with `?debug=1&quirks=doze`, record `audio.play`. While `dozing` is true there is exactly one live `m_snore`. 0.5 s after `dozing` turns false there is none. Same on a guest's screen.

### A2. The class clown's snore cannot be stopped either (LOW, READ)

- **Where:** `src/game.js:1604` (`memeSound`), `src/game.js:1734`.
- **Cause:** `memeSound` plays the kid's 8.2 s `m_snore` and keeps no handle. If he is interrupted in the first 8 s (somebody gets caught), the kid keeps snoring through the next scene. A second copy starts at line 1734 when he reaches the desk.
- **Fix:** make `memeSound` return the handle too. In `reactMeme` keep it in the existing `snore` variable, stop it before starting the copy at line 1734, and let the existing `finally` (line 1774) stop it.
- **Check:** start the snore meme with `game.startMeme('snore')`, then `game.bust('noise')` 2 s later: no `m_snore` is alive 0.5 s after the bust.

### A3. He cuts off his own sentences (HIGH, MEASURED)

- **Where:** `src/game.js:1801-1808` (`glareWarn`), `src/game.js:1341` (`say`), callers at `src/game.js:1231`, `1235`, `src/blame.js:267`, `280`, `src/pranks.js:587`, `src/videos.js:104`, `src/quirks.js:187`.
- **What the player hears:** he starts a line and a different line replaces it within a second: "No pho— Eyes... on the board." Sometimes the first line is cut after 0.00 s, so only its caption flashes.
- **Measured:** 35 of his lines were cut off less than 1.2 s after they started, in one batch of 48 classes. `glareWarn` was one side of 29 of them. Examples: `t_nophones` (6.2 s long) cut after 0.00 s by `t_eyes`; `t_eyes` cut after 0.65 s by `t_pz_order`; `t_ql_no` cut after 0.35 s by `t_whosaid`.
- **Cause:** `glareWarn` runs in `this.fx`, beside his brain. It calls `teacherSay` at once, without checking whether he is speaking, and several `glareWarn` generators can be alive at the same time (anger warning + phone glare + prank glare). In the other direction, a scripted `say()` from his brain cuts a glare line that is still playing. `teacherSay` stops the previous line, so the result is a cut, not two voices.
- **Fix:**
  1. One glare at a time, and never over a line. Use the same wait `laughGlare` already uses (`src/quirks.js:182-185`):
     ```js
     *glareWarn(at = null, line = null) {
       const T = this.teacher;
       if (!this.present || this.dozing || this.glaring) return;
       this.glaring = true;
       try {
         let quiet = 0, t = 0;   // wait until he has finished his sentence
         while (quiet < 0.25 && t < 4) { t += this.dt; quiet = this.t >= (this.voiceUntil || 0) ? quiet + this.dt : 0; yield; }
         if (quiet < 0.25 || !this.present || this.dozing || this.cutscene) return;
         const before = T.lookTarget, look = at || this.focus.camPos;
         T.lookAt(look, 7);
         this.teacherSay(line || pick(WARN));
         yield* this.wait(1.9);
         if (T.lookTarget === look) T.lookAt(before, 4);
       } finally { this.glaring = false; }
     }
     ```
     Set `this.glaring = false` in `reset()` too (`reset` drops `this.fx` without running `finally`).
  2. In `*say()` let a line that is still in the air finish first:
     ```js
     *say(id, after = 0.4) {
       let w = 0;
       while (this.t < (this.voiceUntil || 0) && w < 2.5) { w += this.dt; yield; }
       const h = this.teacherSay(id);
       yield* this.wait((h ? h.duration : 1.6) + after);
     }
     ```
     `bustedSeq` and `jumpscare` already stop his voice and zero `voiceUntil` first (`src/game.js:1884`, `1950`), so being caught is not delayed.
- **Check:** in the recording test (section 8), no teacher line at normal pitch starts less than 1.0 s after another teacher line started, unless the first one had finished.

### A4. His whisper in your ear plays while he is talking out loud (LOW, MEASURED)

- **Where:** `src/game.js:2142-2157` (`fxWhisperEar`, `teacherSayAt`), `src/dread.js:458` (`dreadWhisper`).
- **Measured:** 9 times in 8 classes: `tw_shh` over `t_who` (2.1 s), `tw_here` over `t_bl_ask` (1.4 s), `tw_dr_breathe` over `t_who` (0.6 s).
- **Cause:** the whisper paths do not look at `voiceUntil`. Two of his voices at once sounds like a mistake, not like a scare.
- **Fix:** in `fxWhisperEar` wait (up to 3 s) until `this.t >= this.voiceUntil` before whispering; skip the whisper if he is still talking. In `dreadWhisper`, stop `this.teacherVoice` first if it is still playing.
- **Check:** no `tw_*` line overlaps a `t_*` line by more than 0.3 s.

### A5. Giggles pile up (MEDIUM, MEASURED)

- **Where:** `src/pranks.js:704-708` (`addLaugh`), `src/game.js:768` (`doEcho`), `src/game.js:938` (`giggle`), `src/blame.js:239`.
- **Measured:** `giggle` (3.9 s long) overlapped itself 16 to 30 times per batch, in 9 to 14 classes, sometimes twice in the very same frame.
- **Cause:** `addLaugh` rate-limits `class_laugh` (2.2 s) but plays `giggle` on every other call with no limit. The echo, the laser and the pranks each add their own.
- **Fix:** one helper used by all four places:
  ```js
  classGiggle(pos, vol = 0.6) {
    if (this.t - (this.lastGiggleSnd ?? -9) < 1.6 || this.t - (this.lastLaughSnd ?? -9) < 1.0) return;
    this.lastGiggleSnd = this.t;
    this.audio.play('giggle', { pos, vol, ref: 3, reverb: 0.2 });
  }
  ```
  Reset `lastGiggleSnd` in `resetPranks`.
- **Check:** two `giggle` sounds never start less than 1.6 s apart.

### A6. His breathing at your ear goes on after he straightens up (LOW, MEASURED)

- **Where:** `src/dread.js:507` (start), `src/dread.js:573` (stop in `finally`).
- **Measured:** the `breath` loop outlived the lean by up to 5.1 s, 23 times in one batch. It keeps playing while he says "You... may... breathe." and starts to walk away. The sound does not move with him.
- **Fix:** call `if (br) { br.stop(0.6); br = null; }` right after each `unlock()` that sets `L.phase = 'leave'` (two places, about lines 553 and 558).
- **Check:** no `breath` loop is alive 1 s after `dread.lean.phase` becomes `'leave'`.

### A7. Sam and Nora talk at the same time, and over him (MEDIUM, MEASURED)

- **Where:** `src/events.js:266-272` (`friendQuip`), `src/dread.js:790-798` (`dreadFriend`), `src/game.js:1082-1093` (`updateCalls`), `src/game.js:708-717` (`sayAt`).
- **Measured:** Sam and Nora spoke over each other 28 times in 21 classes. A friend spoke over the teacher 169 times in 48 classes. `sayAt` only stops the same character's previous line.
- **Fix:** add `friendBusy() { return this.friends.some((f) => this.t < (f.speakUntil || 0)); }`.
  - In `friendQuip` and in non-urgent `dreadFriend` lines: if `friendBusy()` or `this.t < this.voiceUntil`, try again 1.2 s later, at most twice, then drop the line.
  - In `updateCalls`: do not start a new "Psst!" while `friendBusy()`; push `nextCall` back by 2 s.
  - Keep urgent lines (a warning that he is right behind you) immediate.
- **Check:** `s_*` and `n_*` lines overlap by more than 0.5 s fewer than 3 times in 48 classes.

### A8. The "something changed" sting can play twice in one frame (LOW, MEASURED)

- **Where:** `src/dread.js:808` (`dreadStingLocal('notice')`).
- **Fix:** `if (kind === 'notice' && this.t - (this.lastNoticeSnd ?? -9) < 0.6) return; this.lastNoticeSnd = this.t;`

### A9. The drone comes back on the "YOU GOT CAUGHT" end screen and never stops (HIGH, MEASURED)

- **Where:** `src/game.js:1889`, `:1931`, `:1991`, `:3519-3520`; `src/dread.js:573`; `src/audio.js:309-317`, `:325`.
- **What the player hears:** the last strike, the scream, silence. Then, on the end screen, the low drone, the shimmer and the room tone fade back in and stay until TRY AGAIN. The other end screens are silent.
- **Measured:** the ambience bus gain 3.5 s after the end screen: **1.0** after a strike-out, **0** after the bell.
- **Cause:** `bustedSeq` runs `yield* this.jumpscare('caught'); return;` inside its `try`. `jumpscare` ends with `finish()`, which does `fadeBus('amb', 0, 0.5)` and `stopAll()`. Then the `finally` of `bustedSeq` runs `A.fadeBus('amb', 1, 1)`. The later call wins. `stopAll()` only stops buffer sounds; the ambience oscillators are still connected.
- **Fix:** `src/game.js:1931`: `if (this.state === 'playing' && !this.ending) A.fadeBus('amb', 1, 1);`. Same guard at `src/dread.js:573`: `if (ducked && this.state === 'playing' && !this.ending) A.fadeBus('amb', 1, 1);`
- **Check:** after a strike-out, `game.audio.buses.amb.gain.value` is below 0.05 three seconds after the end screen.

### A10. The fire alarm rings through the last jump scare and starts again after the scream (MEDIUM, MEASURED)

- **Where:** `src/events.js:725-737` (`fxAlarm`), `:930-938` (`loopWhile`); `src/game.js:1952-1956`, `:1988-1990`.
- **Measured:** last strike 1.5 s into the alarm: `fire_alarm` kept playing under the lights-out and the scream, was cut by `stopAll()`, and was started again 0.05 s later while `ending` was true. It then rang for the last second before the end screen. The fly buzz behaves the same way.
- **Cause:** `fxAlarm` lives in `this.fx` and never looks at `this.ending`. `loopWhile` restarts any handle that has ended (`if (!h || h.ended)`), and `stopAll()` marks every handle ended while `this.alarm` is still 1.
- **Fix:** `src/events.js:932`: `if (on && pos && this.state === 'playing' && !this.ending) {`. `src/events.js:732`: `while (t < dur && this.state === 'playing' && !this.ending)`. In that `finally`: `if (!this.ending) A.fadeBus('amb', 1, 1.5);`
- **Check:** in the recording test no `fire_alarm`, `fly_buzz`, `madi_hum`, `madi_ring`, `v_phonk` or `class_chatter` starts while `game.ending` is true.

### A11. The lean's breathing is not stopped when the lean ends in a strike (MEDIUM on Hard, READ)

- **Where:** `src/dread.js:507`, `:538`, `:548`, `:573`; `src/game.js:1908`.
- **What happens:** on Hard, failing the breath-hold while he looks at you is a strike. The breathing loop from the lean keeps running through the jump scare. On Easy, when the fail pushes anger to 100, two breathing loops play out of step for the whole 10 s scene (`bustedSeq` starts its own at line 1908).
- **Fix:** right before both `yield* this.bustedSeq(...)` calls in `dreadLean` (lines 538 and 548): `if (br) { br.stop(0.2); br = null; }`. This is the same change as A6, in two more places.

### A12. Voice timers survive a restart: he moves his jaw with no sound (HIGH, MEASURED)

- **Where:** `src/game.js:178-268` (`reset`), `:334`, `:1335`, `:713`, `:2344`; `src/events.js:270`; `src/dread.js:795`; `src/videos.js:136-137`.
- **Measured:** story period 1 ended at t = 820 s with `voiceUntil = 817.1`. After NEXT PERIOD, `t` was 0 and `voiceUntil` was still 817.1: his jaw moved with no sound for **8.2 s**, until his first line. Sam's and Nora's `speakUntil` were still 806 and 792 after the restart.
- **Cause:** `reset()` sets `this.t = 0` but does not reset `voiceUntil`, the friends' and kids' `speakUntil`, or each player's `showCool`. Everything that compares them with `this.t` is wrong until the old time is passed or the value is overwritten.
- **What else it breaks:** `friendQuip` and `dreadFriend` return silently while `this.t < f.speakUntil`, so Sam's and Nora's comments are dropped until each has spoken by another path. The story `whisper()` waits its full 14 s for each friend's first line. "Show a friend your video" (R with the phone up) does nothing until the old time is passed (up to 5 minutes).
- **Fix:** in `reset()`: `this.voiceUntil = 0;`, and for every character in `allKids()`: `c.speaking = null; c.speakUntil = 0;`. In `resetPlayer`: `showCool: 0`.
- **Check:** after `game.start(...)` following any ending, `game.teacher.talk === 0` until `teacherSay` is called.

### A13. His squeaky "mock" line cannot be stopped (LOW, READ)

- **Where:** `src/slang.js:111-112`; `src/game.js:1331`, `:1884`.
- **Cause:** `actSlang` plays his line at rate 1.42 with `A.play`, not `teacherSay`. A bust in that window stops `this.teacherVoice` (an older, finished line) and the squeaky line plays on over the new scene.
- **Fix:** after the play at `src/slang.js:111`: `this.teacherVoice = h; this.voiceUntil = this.t + (h ? h.duration : 0);`

### A14. The sound engine leaks between classes (LOW, READ)

- **Where:** `src/audio.js:264-317`, `:352-370`.
- **Cause:** `stopAmbience()` swaps the bus but never stops the 10 oscillators and the noise source of the old ambience. Every class start or return to the menu adds a set. `fear`, `tension` and `hbTimer` are never reset, so after a jump-scare ending the next class opens with a loud heartbeat and a drone swell.
- **Fix:** in `startAmbience` collect every source in `a.srcs`; in `stopAmbience` call `.stop()` on each inside the existing 600 ms timeout. At the top of `startAmbience`: `this.fear = this.tension = 0; this.hbTimer = 0.6;`

### A15. Pause does not pause everything (LOW, READ)

| What | Where | Fix |
|---|---|---|
| Captions, hints and toasts keep counting down behind the pause menu. On resume his line continues with no caption. | `src/game.js:3619`, `src/ui.js:305-310` | `this.ui.update(this.state === 'paused' ? 0 : dt)` |
| Turning the microphone on from the pause menu resumes the audio while the game is frozen. | `src/mic.js:53`, `src/main.js:199` | `if (ctx.state === 'suspended' && this.state !== 'paused')` |
| A player's own .mp4 (an HTML video) keeps playing with sound under the pause menu. | `src/memes.js:122-158`, `src/main.js:194-202` | in `pause()`: `game.phone.feed.pause(); if (game.phone.mission) game.phone.mission.player.pause();` |
| Sounds started while paused (notebook theme clicks) all fire together on RESUME. | `src/notebook.js:75` | play only when `game.audio.ctx.state === 'running'` |
| Tab hidden on the title or end screen: music and ambience keep playing. | `src/main.js:472-473` | on hidden: if not online and not playing, `audio.ctx.suspend()`; on visible: resume unless paused |
| Online on a phone, sound may stay off after coming back from another app (not verified on a device). | `src/input.js`, `src/main.js:472-483` | `input.onAnyInput = () => { if (audio.ctx && audio.ctx.state !== 'running' && game.state === 'playing') audio.ctx.resume(); };` |

---

## 2. Batch 2: captions and hints that replace each other

### C1. One caption line for everybody who talks (HIGH, MEASURED)

- **Where:** `src/ui.js:217-224` (`subtitle`), `index.html` `#subtitle`, `style.css:94`.
- **Measured:** about 600 captions per batch were replaced before they could be read (less than 1 s on screen, or less than half their time): 621, 640 and 586 in the three batches. That is 12 to 13 per class. Examples: "Nora: Who would even call him?" was on screen for 0.2 s; "Shh. Don't wake him up." for 0.6 s; his "No... phones... in... my... class." for 0 s.
- **Cause:** `subtitle()` writes into one element. Whoever speaks last wins.
- **Fix:** a small caption stack inside `UI`:
  - Keep an array of lines `{ who, text, cls, left }`. Show the newest 2 (3 when the window is taller than 600 px), newest at the bottom.
  - A new line from the same speaker replaces that speaker's line. A line from another speaker is added.
  - Every line stays at least 1.2 s even when it is pushed out of the list.
  - `update(dt)` counts each line down. `clearTransient()` empties the list.
  - Keep the function signature `subtitle(who, text, cls, dur)`. Nothing else has to change, and online gets it for free because guests call the same function.
- **Two cases to fix by hand as well:**
  - The `*snoring* 💤` caption is posted again every 3.3 s over whatever a friend is saying (`src/quirks.js:232`), exactly when the player is supposed to whisper. Post it only when no caption is showing.
  - Period 2: the PA line `pa_hale` is 6.6 s long and Nora's `n_pa` starts 2.6 s into it (`src/game.js:2401-2405`). Two voices at once and the PA text is lost. Wait for the PA line to end first.
- **Check:** in the recording test, no caption is visible for less than 1.2 s.

### C2. Tips are replaced by small status messages (HIGH, MEASURED)

- **Where:** `src/ui.js:204-209` (`hint`), the queue in `src/events.js:231-263` (`firstHint`, `showHint`, `pumpHints`), and every direct `ui.hint(...)` / `uiTo(p, 'hint', ...)` call.
- **Measured:** 221, 231 and 259 hints were replaced early in the three batches (about 5 per class). The worst pairs in one batch:

  | Replaced hint (a tip the player needs) | Replaced by | Count |
  |---|---|---|
  | event and tutorial tips from `showHint` (`events.js:244`) | `uiTo(p, 'hint', ...)` status lines (`game.js:699`): "PAPER BALL ready", "KICK ME NOTE ready", "Still folding the next one…", "He heard nothing. Breathe." | 48 |
  | status line | another status line, 0.1 s later | 31 |
  | tips from `showHint` | "Repeat him right after he says something." (`game.js:530`), "Wait for him to answer first." (`game.js:531`) | 38 |
  | tips from `showHint` | "You found one of Mr. Hale's notes" (`replay.js:247`) | 18 |
  | the laser / note tip (`blame.js:805-806`) | "LASER POINTER ready" in the same frame | 30 |

- **Cause:** there is a queue with a reading time (`HINT_READ = 3.2`), but only `showHint` uses it. Every other caller writes straight to `ui.hint` and wipes whatever is there.
- **Fix:**
  1. Move the queue into `UI`. `ui.hint(html, dur, kind = 'tip')`. Tips queue and each gets at least `HINT_READ` seconds. `showHint` and `pumpHints` become thin wrappers or go away.
  2. Add a second, small line for status feedback: `ui.status(text, dur)`, a new element under the crosshair (near `#prompt`). It never touches the tip line. Move these to `ui.status`: "Still folding the next one…" (`pranks.js:270`), "Not now." (`sneak.js:218`), "Crawl back to your desk first…" (`sneak.js:217`), "Repeat him right after he says something." (`game.js:530`, `mp.js:820`), "Wait for him to answer first." (`game.js:531`), "He is busy right now. Ask him later." (`game.js:573`), "Not yet…" (`ghost.js:129`), "You are back in your seat.".
  3. Delete the "`<b>NAME</b> ready`" hint (`pranks.js:285`). The aim HUD (`#aim-kind`) already shows which tool is in your hand.
- **Check:** in the recording test, no tip is replaced before it has been up for 3 s. The tool-switch test in `tests/pranks.js` still passes.

---

## 3. Batch 3: things that cover each other on screen

Measured by showing combinations that really happen together (for example: your phone buzzes while you look at Sam and he has just spoken) and comparing the on-screen rectangles. Sizes: 1280×720, 1024×576, 844×390, 667×375, 568×320, 390×844 (the phone sizes with touch on).

| # | What covers what | Sizes | Severity |
|---|---|---|---|
| H1 | The **hint** covers the strikes (100 % of them) and the ECHO / QUESTIONS counters under his eye | every size at or below 1024 wide, also 854×480 | HIGH |
| H2 | "📳 your phone is buzzing" covers the prompt "hold E · whisper to Sam" (62-91 %), and the "repeat him" cue (58-80 %) | all sizes | HIGH |
| H3 | A **toast** ("BO GOT CAUGHT", "Bo left the class") covers the TASKS list (14-41 %) | all sizes | MEDIUM |
| H4 | The **choice menu** covers the TASKS list, the "TODAY HE" tags and the toast (the toast 100 %), and on phones the ASK / SEAT / ECHO / BREATH buttons (45-98 %) | 1024 and below | MEDIUM |
| H5 | **Captions** cover touch buttons: BREATH and PRANK (31-47 %) on 667 and 568 wide; ASK, ECHO and SEAT (up to 98 %) in portrait | phones | MEDIUM |
| H6 | The "HE CAN ALMOST SEE YOU" bar and a toast sit on the same spot (100 %) | phones | MEDIUM |
| H7 | "psst!" covers the "TODAY HE" tags (51-93 %); the event line ("🍕 a pizza is at the door") runs into "WATCHING" and the clock | 844 and below | LOW |
| H8 | On 568×320 the TASKS list and tags reach down into the ASK / SEAT / PHONE buttons | 568×320 | MEDIUM |

- **Where:** `style.css:92` (`#hint`: `top: 48px; width: min(400px, 44vw)`), `:102` (`#toast`: `top: 30%`), `:109` (`#phone-alert`), `:186` (`#echo-cue`), `:91` (`#prompt`), `:200` (`#choices`), `:355` (`#sneak-hud`), `:94` (`#subtitle`), `:178` (`#ev-now`), `:141` (`#hud-left`).
- **Cause:** every piece is placed with its own absolute position. Nothing reserves space.
- **Fix:**
  1. **H1:** the eye block is pushed to the right as the task column grows, because `#hud-top` uses `space-between`. Centre it and keep the hint off it: `#hud-top { display: grid; grid-template-columns: 1fr auto 1fr; }`, `#clock-hud { justify-self: end; }`, `#hint { width: min(400px, calc(50vw - 70px)); }`.
  2. **H2:** make one vertical stack in the middle for the things near the crosshair, in this order: prompt, aim / sneak bar, BREATH bar, "repeat him" cue, phone alert. Put them in one flex column (`#mid-stack { position: absolute; left: 50%; top: calc(50% + 22px); transform: translateX(-50%); display: flex; flex-direction: column; gap: 6px; align-items: center; }`) and remove their own `top` / `bottom` rules. Elements that are hidden must use `display: none` or zero height so the stack closes up.
  3. **H3, H6:** move `#toast` to `top: 18%` and centre it in the space right of the task list on wide screens. While a toast is up, fade `#sneak-hud` text, or put the toast above the mid stack.
  4. **H4:** while a choice menu is open add a class on `#hud` (`hud.choosing`) that fades `#hud-left`, `#toast`, `#hint` and the touch buttons to 15 % and turns their pointer events off. Remove it in `closeChoices()`.
  5. **H5:** on touch screens lift captions above the buttons: `bottom: calc(max(22px, env(safe-area-inset-bottom)) + 150px)` in the `max-height: 500px` and portrait rules, and `width: min(720px, 56vw)` in landscape so they stay between the two button groups.
  6. **H7, H8:** the task list has no limit. A Free Class starts with 5 tasks and gets more at 76 s, 100 s and 150 s, plus event tasks: 8 to 11 rows. In `addObjective` (`src/game.js:2352-2361`) keep at most 4 open tasks plus the bell task on screen and hold the rest in `this.objWait`; release them from `completeObjective` / `dropObjective`. Add `@media (max-height: 500px) { #hud-left { max-width: min(300px, 36vw); } }`. Hide the "TODAY HE" tags while a "psst!" is showing. Give `#ev-now` its own line under the strikes instead of beside the eye label.
- **Check:** add the overlap measurement as a test (section 8). No pair of visible HUD pieces overlaps by more than 4×4 px in the 6 scenarios × 6 sizes.

---

## 4. Batch 4: online (play with friends)

The owner's report: "when I play online it is so confusing, something is off". The recording of a 3-player class and the code reading agree on the reason. **The host's browser sends every `ui.hint`, `ui.toast`, `ui.subtitle` and `ui.showNote` call to all friends** (`src/mp.js:25`, `src/mp.js:971-985`). Code written for the solo player's own screen therefore lands on everybody's screen. On top of that, several systems still only look at the host (`this.me`, `this.camPos`, `this.choice`).

### O1. The host's private messages appear on every friend's screen (HIGH, MEASURED)

- **Measured:** when the host was caught and became a ghost, the friend's screen showed "ALEX GOT CAUGHT", then "Alex is a ghost in the corner…", and in the same frame "**He sent you to the corner. You are a ghost for a minute: press 1, 2, 3**". The friend was not a ghost. Pressing 1-3 does nothing.
- **Where and what leaks** (each of these calls the wrapped `ui.hint` directly):

  | Line | Text every friend receives | When |
  |---|---|---|
  | `src/ghost.js:77-81` | "You are a ghost for a minute…" | the host becomes a ghost |
  | `src/game.js:530` | "Repeat him right after he says something." | the host presses R too late |
  | `src/game.js:531` | "Wait for him to answer first." | the host presses T twice |
  | `src/sneak.js:217-218` | "Not now." / "Crawl back to your desk first…" | the host presses C |
  | `src/videos.js:80` | "Your phone: E / click to fly…" | the host first raises the phone |
  | `src/videos.js:300` | "Watch it while he isn't looking…" | check who it is for |
  | `src/blame.js:805-806` | "A red dot where you look…" / "Hold it while he walks past…" | the host first picks the laser or the note |

- **Fix:** send each one only to the player it is for: `this.uiTo(this.me, 'hint', text, dur)` (`uiTo` at `src/game.js:698` already uses the local, unwrapped function for the local player). For `ghost.js:81`: `(this.ui.hint.local || this.ui.hint).call(this.ui, ...)`. After batch 2 most of these become `ui.status`, which must not be in `UI_EVENTS`.
- **Check:** new test in `tests/mp_extras.js`: the host does each action; the friend's recorded hint list must not contain the text.

### O2. Sam's and Nora's paper note opens on every friend's screen and blocks their controls (HIGH, READ)

- **Where:** `src/game.js:674`, `src/game.js:739` (`giveNote`), `src/game.js:2467`, `src/mp.js:795-797`.
- **What happens:** after the host's third whisper with Sam or Nora, a paper note ("from Nora: …") opens in the middle of every friend's screen. While it is open their whisper, phone, echo, ask and aim are blocked (`blocked = ... || ui.noteOpen`).
- **Cause:** `giveNote` calls `this.ui.showNote(...)`, and `showNote` is in `UI_EVENTS`. Friends can never earn a note themselves (`if (p.local && ...)`).
- **Fix:** `(this.ui.showNote.local || this.ui.showNote).call(this.ui, ...)` in both places. Better: give the note to the player who whispered, `giveNote(text, who, p)` with `this.uiTo(p, 'showNote', ...)` and `this.note(p, 'notes')`, and drop the `p.local` condition at line 674.
- **Check:** the host whispers three lines with Sam; `ui.noteOpen` stays false on the friend.

### O3. Control tips use the host's device (HIGH, READ)

- **Where:** `src/game.js:2321-2325` (`hintControls`), `src/game.js:3366-3383` (`freeScript`), `src/sneak.js:596-598`.
- **What happens:** with a PC host, a friend on a phone reads "Press R… Press T… Hold Q… Hold G… Press C… WASD". None of these exist on a phone. With a phone host, PC friends read "Tap ECHO… Hold PHONE".
- **Cause:** `const touch = this.input.touch` is the host's. The chosen string is broadcast.
- **Fix:** put both versions into the string with the CSS classes the game already has (`style.css:117`, `:193`; `DREAD.text.leanHint` in `src/data.js:398` already does it): `<span class="desk-only">Press <b>R</b>…</span><span class="touch-only">Tap <b>ECHO</b>…</span>`. Remove the `touch ?` choice from every broadcast hint.
- **Check:** PC host + touch friend: the friend's hint text contains "ECHO", not "Press R".

### O4. "Three strikes and you are done." is wrong online (LOW, MEASURED)

- **Where:** `src/game.js:3370`, `src/game.js:224`, `src/mp.js:226`.
- **Measured:** the tip appeared while the HUD showed 5 strikes. Also `maxStrikes` is fixed when the class starts: a friend who joins late adds no strike, one who leaves removes none.
- **Fix:** the tip becomes `` `${this.maxStrikes} strikes for the whole class.` `` (skip it on Hard). Recompute `maxStrikes` when a friend joins or leaves a running class, never below `strikes + 1`.

### O5. Sam's and Nora's "Psst!" and the buzzing phone are only for the host, but everybody pays (HIGH, MEASURED + READ)

- **Where:** `src/game.js:1082-1125` (`updateCalls`), `src/game.js:1137-1175` (`updateBuzz`, `resolveBuzz`), `src/game.js:651-655`, `src/game.js:3394`.
- **Measured:** the friend's captions showed "Nora: Psst! You have to see this!", "Nora: I wrote you a note. Read it.", "Nora: Psst! Hey! Over here!". All three were meant for the host. The friend has no way to answer.
- **What happens:** every 20-42 s Sam or Nora calls. Only the host can answer (`this.camPos`, `this.talk`, `if (f && f.call && p.local)`). If the host does not, the friend shouts "HEY!", anger goes up 22 for the whole class and he warns. The same with the phone: everybody reads "♪ your phone is RINGING ♪", only the host's phone buzzes.
- **Fix (small):** `this.callsOn = this.buzzOn = !this.mp;` at `src/game.js:3394`.
- **Fix (proper):** pick a seated player: `f.call = { to: p, stage: 1, timer: 8 }`. That player answers by whispering to the friend. Send the "psst!" markers, the caption and the buzz to that player only with `uiTo(p, ...)`. Rotate the player.

### O6. Sam's and Nora's answers to one player are captioned for everybody (MEDIUM, READ + MEASURED)

- **Where:** `src/game.js:708-717` (`sayAt`), `src/game.js:666-668`, `src/dread.js:790-798`, `src/events.js:266-272`.
- **What happens:** one player whispers with Sam; all screens show "Sam: …". With 3-4 players the single caption line is mostly other people's talk.
- **Fix:** give `sayAt(c, id, noise, vol, to)` a target. When `to` is set, send the caption with `this.uiTo(to, 'subtitle', ...)`. Pass the player from `updateTalk` and from `dreadFriend`. The sound can stay positional for everyone (it is a whisper from that seat).

### O7. Jump scares: the host's copy leaks into friends, and the copies end at different times (HIGH, READ)

- **Where:** `src/scares.js:59-76`, `:85-94`, `:113-126`, `:265`; `src/mp.js:563`, `:633-648`, `:966-967`, `:997-998`.
- **Leak:** the pencil, sprint and window scares wait up to 25 / 10 / 12 s for each player to look. When the host's copy lunges, friends get a red flash, screen shake and glitch with no face and no sound, and then again at their own lunge. `applySnapOnce` always merges the host's `shake`, `glitch`, `scareFear` and `redFlash` (`mp.js:648`); `localScare` only protects the light and the blackout. The scenes also call the wrapped `audio.fadeBus` and `world.flash`, which are sent to friends.
- **Out of step:** the host's `scareBusy` / `eventLock` last only as long as the host's copy. If the host finishes first, the real teacher can warn or catch a friend who still sees their own local one. If the friend finishes first, they sit in a dim room with no teacher until the host looks (up to 25 s).
- **Fix:**
  1. While `g.localScare` is true, the friend ignores `fx[2..5]`, `flash` and `bus` events. In the scenes use the local functions (`fadeBus` and `flash` called on the unwrapped originals; add `.local` to them in `installProxies` like the UI functions).
  2. Online, shorten the wait for the look: `const wait = this.mp ? Math.min(6, SCARES.wait[id]) : SCARES.wait[id];`
  3. A friend sends `{ t: 'press', k: 'scareDone' }` when their scene ends. The host keeps `scareBusy` until every seated player is done or `SCARES.len[id] + 2` seconds passed.
- **Check:** `tests/mp_scares.js`: during the host's lunge the friend's `redFlash` stays 0 unless their own scene is at its lunge; `scareBusy` on the host is still set while the friend's scene runs.

### O8. A scare that is running on a friend's screen is not stopped by the end screen (LOW, READ)

- **Where:** `src/mp.js:473-478` (`toLobby`), `:587-603` (`showEnd`), `:711`, `:913-937` (`leave`); `src/game.js:235-242` (`reset`).
- **What happens:** if the class ends or the connection drops during a friend's scare, its screams, captions or the fake "CLASS DISMISSED" play over the real end screen. After leaving during the hanging scare he stays upside down in the menu, because `reset()` never clears `T.root.rotation.z`.
- **Fix:** call `this.stopScare()` in `showEnd`, in the `toLobby` case and in `leave()`. Add `T.root.rotation.x = T.root.rotation.z = 0;` to `reset()`.

### O9. Friends' actions are refused with no message (MEDIUM, READ)

- **Where:** `src/sneak.js:112-116`, `:208-218`, `:250`, `:778`; `src/game.js:572-573`, `:876`; `src/mp.js:822`.
- **What happens:**
  - A friend presses C while he leans over somebody's desk, asks somebody "Who did it?", or during a scare. On their screen they slide to the floor. 1.5 s later they snap back onto the chair. No message. The friend's `canLeave` reads flags that are never sent (`eventLock`, `blameBusy`, `lockBully`, `dread.lean`, `qBusy`).
  - A friend presses T while he is busy or out of the room. Nothing happens. Only the `classEvent` case answers with a hint.
- **Fix:** add the host's `canLeave(p)` as one bit in `sneakRow(p)`; the friend checks it in `localSneak` and shows "Not now." (status line). In `playerActs`, when `a.ask && !this.canAsk(p)`, always answer: `this.uiTo(p, 'status', p.qBusy ? 'Wait for him to answer first.' : 'Not now.', 2)`.

### O10. A friend's own meme videos never count (MEDIUM, READ)

- **Where:** `src/videos.js:49-53`, `src/replay.js:356-362`.
- **What happens:** a friend watches a whole video on their own phone. The task "Watch a whole meme video" does not tick and they get no `videos` stat (report card, chaos board, the 5-videos unlock). The host's videos count.
- **Cause:** `onFeedDone` returns when `role === 'guest'` and tells nobody.
- **Fix:** the friend sends `this.mp.send({ t: 'p6', k: 'video' })`. In `replayFromGuest` add: `else if (m.k === 'video' && p.phoneUp && this.t - (p.vidAt ?? -9) > 3) { p.vidAt = this.t; this.note(p, 'videos'); this.track.event(this.t, p, 'video', { how: 'feed' }); this.completeObjective('video'); }`

### O11. A friend's last input stays active for 20 s after they go quiet (MEDIUM, READ)

- **Where:** `src/mp.js:22` (`TIMEOUT = 20`), `:244-255`, `:325-331`; `src/main.js:196`, `:473`; `src/input.js:62-63`.
- **What happens:** a friend on a phone gets a call or switches apps while holding PHONE or TALK. The host keeps `p.in.phone` / `p.in.talk` for 20 s: anger rises, he walks to their desk, and on Hard that is the one strike for the whole class. Also: with the pause menu open online the class goes on, and E / Space / Q still whisper or raise the phone, because `keys.talk` and `keys.phone` are set even when input is disabled (`input.js:62`).
- **Fix:**
  - Host, in `remoteActs`: `if (performance.now() - p.heard > 1200) { p.in.talk = p.in.phone = p.in.aim = false; p.in.mc = 0; }`
  - Friend: on `visibilitychange` (hidden) and when the pause menu opens, send one `in` message with everything off.
  - `input.js`: only set `keys.talk` / `keys.phone` when `this.enabled`; on `enable(false)` clear `keys`, `touchBtn` and `moveKeys`.

### O12. A slow or sleeping host freezes the class with no message (MEDIUM, READ)

- **Where:** `src/mp.js:672`; `src/main.js:473`, `:533`, `:542-549`.
- **What happens:** the host's phone goes to another app. Friends see a frozen teacher while their own phone, aim and crawl still work locally. Nothing is said for 20 s, then "Lost the connection". A host under 20 fps runs the class in slow motion for all (`dt = Math.min(0.05, ...)`).
- **Fix:** in `guestTick`, when `performance.now() - this.heard > 1500`, show a local toast "Waiting for the host…" and block local actions until snapshots return. When the host's page becomes hidden, `broadcastNow` a toast "The host stepped away".

### O13. Friends are caught by sight with no allowance for delay (MEDIUM, READ; depends on ping)

- **Where:** `src/game.js:1191-1210`; `src/chain.js:65-67`; `src/data.js:114` (`seenLimit: 0.3`), `:372` (`lag: 0.3`, used only for the breath lean).
- **What happens:** a friend lowers the phone or arm the moment they see him turn and is caught anyway. The host never is. A friend sees him 0.2-0.4 s late (15 snapshots per second, smoothing, input 20 times per second).
- **Fix:** add `(p.local ? 0 : DREAD.breath.lag)` to the four thresholds: arm up (`PRANK.seenLimit`), Hard "seen" (0.3), video (0.45), note chain (0.3).

### O14. The player who is hit by a friend's paper takes the blame (LOW, READ)

- **Where:** `src/pranks.js:543-547`, `:649-655`, `:720-726`; `src/game.js:591-592`.
- **What happens:** A throws at B. B "says ow" (noise 0.5) and becomes `laughAbout`, so the class laughing counts as B's noise. He warns B or walks to B. A gets nothing.
- **Fix:** pass the thrower: `bonk(target, from, at, npc, by)` then `addLaugh(..., at, by || target)`; skip the `bonkT` noise when a player threw it.

### O15. The older scares and the scare director only look at the host (MEDIUM, READ)

- **Where:** `src/game.js:2021`, `:2101`, `:2113-2121`, `:2133-2138`, `:2159-2208`, `:613-616`, `:2252-2275`.
- **What happens:** "behind you" always teleports him to the host's desk. Scares wait only for the host to be in their seat. Friends hear a full-volume sting (played without a position) when the host looks at the door face or the board.
- **Fix:** online, pick the target among seated players (`pick(this.players.filter(seated))`) and run the scene with that player's `camPos`; use `this.players.some(...)` for the look tests and for the seat check at line 2021. Until then give `behind` weight 0 online.

### O16. Rules that only watch the host (LOW, READ)

- **Where:** `src/game.js:1199`, `:1208`, `:1213`, `:1228`, `:632`; `src/pranks.js:556`, `:583`.
- **What happens:** while the host's question menu is open (7 s) nobody can be caught by sight and no warnings fire; a friend's open menu does not do that. Only the host looking at him or at the board calms him faster. Sam's and Nora's loud lines count as the host's noise (`(f.partner || this.me) === p`).
- **Fix:** remove `!this.choice` from the class-wide checks; use `this.players.some(...)` for the calming; use `f.partner === p` only.

### O17. Leaving and coming back (LOW, READ)

- **Where:** `src/net.js:437`, `:301`; `src/mp.js:217-229`, `:428`, `:672`, `:287`.
- **What happens:** (a) any closed connection says "The host closed the class.", also a network failure, so the friend does not try again. (b) A friend who rejoins is a new player: new seat, counters lost, and for up to 20 s the old avatar still sits there (the name becomes "Bo 2") or the class says "full". (c) A dead host is only noticed while `state === 'playing'`.
- **Fix:** say "closed" only after a `bye` message, otherwise "lost the connection". Keep a player id in `sessionStorage`, send it in `hello`; the host replaces the old entry with the same id (same seat, same stats). Run the silence check in every state.

### O18. Small wording problems online (LOW, READ)

- End-screen stats sent to friends say "Times you repeated him" but are class totals (`src/game.js:3457-3460`).
- The ending says "He caught you one time too many" to players who were never caught.
- "someone behind you" is relative to the host's row (`src/game.js:1594`).
- A friend's phone clock always shows 9:41 (`src/phone.js:174`).

### Why online feels confusing, beyond the bugs (design, not bugs)

These are not errors in the code. They are the reasons a friend cannot tell what is going on. Fix O1-O7 first; then these.

| # | What a player experiences | Why | Suggested change |
|---|---|---|---|
| D1 | He walks to somebody's desk and my controls stop for 10 s. I learn who was caught only at the end; on the last strike never. | A bust sets `cutscene` for everyone (`game.js:346-351`); the name comes in the toast at `game.js:1925`; line 1889 returns before the toast on the last strike. | At `bust()` send a toast to all at once: "HE CAUGHT BO (phone)". |
| D2 | I cannot tell who he is angry at. | One shared anger bar. `focus` and `heat` are never sent. His lines have no name on them. | Put `focus.id` in the snapshot. Show "LISTENING TO: BO" under the eye, tint that name tag, start his warnings with "→ Bo". |
| D3 | Strikes, mischief and tasks change and I do not know why. | All shared; a task ticks when anyone does it. | A 3-line feed: "Bo repeated him", "Ana hit his head". Every action already goes through `track.event(t, p, type)` (`stats.js:81`). |
| D4 | Too much starts in the first two minutes. | Tips at 1, 8, 18, 30, 44, 58, 76 and 100 s; a scare owed at 40 s; the note chain at 42-56 s; then events, quirks, leans, class clowns, calls, the decoy and ghost hints. | Online: start the note chain only after the first event. One team system at a time (chain, decoy or ghost). |
| D5 | The note that goes round is invisible. | Only a 5-7 s hint; no lasting display of who holds it. The data is already on every screen (`chainSnap`). | A HUD chip "NOTE: Ana → YOU → Bo · 0:31" and a paper icon on the holder's name tag. |
| D6 | When I am caught I am a ghost for 60 s and my friends do not know what I do. | The others get one 5 s hint. | Feed line "Bo (ghost) slid the chair"; a ghost icon on the name tag. |
| D7 | A scene with one player locks everybody else, silently. | "Who did it?", the desk lean, the dot chase and the row search block the others' echo, ask, prank and leaving. | One lasting line: "He is busy with Bo: wait." |
| D8 | A first-time friend gets no tutorial. | How To Play is only wired to the solo buttons (`main.js:187-188`), not to JOIN or START. | Show the pages in the lobby while waiting. |
| D9 | Host and friends play different games. | The host gets the texts, the calls, the notes and the older scares. | Turn host-only systems off online, or rotate the target (see O5, O15). |
| D10 | The shared goal is never said. | Strikes are shared; the mischief total decides the ending. | A start card: "TEAM: survive to 12:30 · 5 shared strikes". Label the list "CLASS TASKS". |

---

## 5. Batch 5: his scenes and the class state

### S1. Jump scares and events start on top of his naps and other habits (MEDIUM, MEASURED)

- **Where:** `src/game.js:2019-2022` (`updateDirector`), `:1367-1368` (habits run inside `idleBrain`), `:613`, `:1112`, `:1160`; `src/slang.js:150`; `src/sneak.js:558-560`.
- **Measured:** 13 of 61 naps in one batch lasted under 3 s. What cut them: a jump scare (wrong seat, window, pencil ×3), the pizza, the fire drill, him leaving the room. The HUD had just said "ASLEEP" and the hint "He is dozing off. He can't see you".
- **Cause:** his habits (nap, counting, the clock, the dance, sitting, wiping his glasses) run inside the idle brain, so `brainIdle` is true during them. The director only checks `brainIdle && anger < 30 && !memeBusy`. There is no `quirkBusy`, `sitting`, `blind` or `typing` check. The story's `ready()` does check `quirkBusy`.
- **Side effects:** a cut dance is lost for the class (`danced++` happens before the music). A cut `actSit` leaves a waiting cushion for another 45-70 s.
- **Fix:** in `updateDirector`: `const busy = this.anger >= 30 || this.memeBusy || this.quirkBusy || this.sitting || this.blind || this.typing;`. Add `&& !this.quirkBusy` at lines 613, 1112 and 1160. Move `danced++` next to `this.dancing = true`. In `actSit`, when it is cut while `this.cushion` is still set: `this.nextSit = this.t + SNEAK.sit.soon`.
- **Check:** in the recording test, no nap is shorter than 5 s unless a player made the noise that woke him.

### S2. Scares and events are started in the last seconds and cut by the bell (MEDIUM, MEASURED)

- **Where:** `src/game.js:2015-2035`, `:2280`, `:3397-3400`; `src/events.js:301`; `src/quirks.js:115`; `src/slang.js:90`; `src/sneak.js:535`.
- **Measured:** a window scare that started at 296.45 s was cut at 300.0 s by the bell (its knock and bang rang into "Class dismissed"). In other classes an event and a desk lean were cut at exactly 300.0 s.
- **Cause:** the director has no "time left" check. The other guards compare with `FREE_LENGTH` (300 s), but after the clock prank the bell rings up to 56 s earlier (`clockMin >= 240`), so he can be out of the room, asleep or mid-event when it rings.
- **Fix:** one helper, `bellIn() { return this.mode === 'free' ? Math.min(FREE_LENGTH - this.t, (240 - this.clockMin) * FREE_LENGTH / 240) : 1e9; }`. Use it in the four guards above. In the director, drop brain scares when `bellIn() < (SCARES.len[s.id] || 10) + 8`. In `freeScript` wait for `!this.cutscene && !this.eventLock` (with a 12 s limit) before the ending.

### S3. His glasses jump from the desk back onto his face after a paper hit (MEDIUM, READ)

- **Where:** `src/pranks.js:744`, `:762`, `:767-800`; `src/morepranks.js:333`; `src/secrets.js:96-114`; `src/sneak.js:609-617`.
- **What the player sees:** he has put his glasses on his desk (or you stole them). You hit him with paper. At the end of "Who threw that?" the glasses are on his face again. The game still thinks they are on the desk: "take his glasses" is offered at an empty desk. With stolen glasses, a head hit says "His glasses flew off", and three head hits play the glasses-break ending with no glasses.
- **Cause:** the `finally` of `reactPrank` does `if (T.glasses.parent !== T.head && !T.glassesHeld) { T.wearGlasses(); ... }`. That is also true when they are on the desk or stolen. `glassesFlyOff`, `glassesHit` and `reactSoaked` never check `glassesAt`.
- **Fix:** in `reactPrank`: `let flew = false; if (part === 'head' && this.glassesAt === 'face') { flew = true; yield* this.glassesFlyOff(); } else yield* this.wait(0.45);` and run the `wearGlasses()` in `finally` only when `flew`. In `glassesHit`: `if (this.glassesAt !== 'face') return false;`. In `reactSoaked`: skip the wipe unless `'face'`.

### S4. A dumb question cuts a jump scare, the desk lean, or "Who did it?" (MEDIUM, READ)

- **Where:** `src/game.js:876` (`canAsk`), `:889-901` (`askQuestion`), `:3414-3417`; `src/blame.js:554-592`; `src/scares.js:59-71`; `src/dread.js:435-443`.
- **What happens:** you raise your hand. In the 1.6-2.5 s before he reacts, a scare starts or he arrives to listen at your desk. The timer then fires `interrupt(reactQuestion)`: the lights snap on, he pops to the front and answers. The scare is used up. While he walks to your desk to ask "Who did it?", a question does the same: if the menu was already open it stays for 7 s and picking does nothing.
- **Cause:** the timer only checks `state` and `cutscene`. `canAsk` does not check `blameBusy`.
- **Fix:** in the timer: `if (this.eventLock || this.scareBusy || this.blameBusy) { this.timers.after(0.5, fire); return; }` (name the callback `fire`). Add `&& !this.blameBusy` to `canAsk`. In the director and in `dreadIdle()`: return early while `this.players.some((p) => p.qBusy)`. In `askWhoDidIt`, close its own menu in `finally` (`this.pickChoice(-1, p)` when it is still open). At the top of `freeEnding`: `if (this.choice) this.pickChoice(-1);`

### S5. An open note stays on screen through the whole "caught" scene (MEDIUM, READ)

- **Where:** `src/game.js:346-351`, `:512`, `:1867-1886`, `:1944-1951`; `src/sneak.js:530`; `src/ui.js:21-22`.
- **What the player sees:** you are reading his laptop (or a friend's note) when he catches you. The paper stays in the middle of the screen for the whole scene, and on the last strike over the jump scare. With the mouse locked it cannot be closed: keys are ignored in a cutscene and clicks go to the canvas.
- **Fix:** in `bust()` and at the top of `jumpscare`: `if (this.ui.noteOpen) { this.ui.closeNote(); this.noteLatch = true; }` (online: `uiTo` the caught player). Make `giveNote` return false while `this.eventLock || this.scLocalOn`.

### S6. Kids keep staring at the wrong thing after a scene is cut (LOW, READ)

- **Where:** `src/events.js:623`, `:657`, `:677-684` (pizza); `src/game.js:2777-2782` (`windowBeat`); `:1457-1459` (`actClap`); `src/blame.js:626-639`.
- **What the player sees:** you are caught while he eats the pizza: most of the class stares at the pizza box for the rest of the class. In period 1, repeating "Do not look at the window" leaves the class turned to the window.
- **Cause:** `lookTarget` never decays, and these resets sit after a `yield`, outside any `finally`.
- **Fix:** `this.lookAllBack()` in the `ev_pizza` `finally`; wrap `windowBeat` in `try / finally` with its reset loop; move the friends loop of `actClap` inside its `try`; reset the blamed kid's `tremble` and `lookTarget` in the `askWhoDidIt` `finally`.

### S7. "Punishments" lower his anger when it is already high (LOW, READ)

- **Where:** `src/game.js:816`, `:913`, `:922`, `:1111`, `:1155`, `:2750`, `:2764`, `:3049-3059`; `src/videos.js:101`.
- **Cause:** `this.anger = Math.min(cap, this.anger + n)`. At anger 95, a friend's "HEY!" sets it to 70 and your ringtone sets it to 75.
- **Fix:** use the helper that exists, `this.angerUp(n, cap)` (`src/pranks.js:592`), in every one of these places.

### S8. Restart during the hanging scare leaves him upside down (LOW, READ)

- **Where:** `src/scares.js:416`, `:430`; `src/game.js:236-241`.
- **Fix:** in `reset()`: `T.root.rotation.x = T.root.rotation.z = 0; T.owl = false; T.footFwdTarget = 0;` (same line as O8).

### S9. Period 4 can play the hanging scare twice in a row (LOW, READ)

- **Where:** `src/game.js:2289-2292` (`scareBeat`), `:3164`, `:3170`, `:2003`.
- **Cause:** the scripted `scareBeat` does not record `lastScare[id]` / `scareDone[id]`, and `'hanging'` is also in the director's list for period 4. `headturn` has no cooldown.
- **Fix:** in `scareBeat`: `this.lastScare[id] = this.t; this.scareDone[id] = true;` before the beat and `this.nextScare = Math.max(this.nextScare, SCARE_GAP[this.phase][0]);` after it. Give `headturn` `cool: 60`.

### S10. Story scenes in the dark only clean up on the normal path (LOW, READ)

- **Where:** `src/game.js:3077-3092` (`countClass`), `:2295-2302` (`blinkTo`), `:2540-2541`.
- **What happens:** a strike in the dark leaves the room black (`master = 0`, `blackoutTarget = 0.96`) through the caught scene and the retry. Kevin stays visible. The "dark" task is never dropped.
- **Fix:** `try / finally` around the dark parts with `W.setMaster(1); this.blackoutTarget = 0; kevin.setGone(true);` and `dropObjective('dark')` in the `powerCut` `finally`.

### S11. He may walk through his own desk (LOW, READ, not reproduced)

- **Where:** `src/game.js:952`, `:1319-1328`; `src/quirks.js:211`; `src/events.js:479`; `src/sneak.js:569-574`.
- **Note:** found by geometry (desk box x −3.95…−2.35, z −5.75…−4.95). It did **not** happen in 6 measured classes with a quiet player. Check it with a player who makes him search the rows before changing anything.
- **Fix if confirmed:** use the existing `walkDesk(x, z)` for walks to the laptop and the chair.

---

## 6. Batch 6: the player's actions and the screen

### P1. A note that arrives while you hold E or Q closes in the same frame (HIGH, READ)

- **Where:** `src/game.js:511-514`, `:674`, `:729-743`, `:2362-2368`, `:2464-2467`; `src/mp.js:795`.
- **What the player sees:** you are still holding E after a friend's third line, or holding Q on the phone game, when a note arrives. You hear the paper and get +15 mischief. No note appears.
- **Cause:** `if (ui.noteOpen && !this.noteHold && (inp.talk || inp.phone || ...)) ui.closeNote()` tests whether the key is down, not whether it was pressed now. `noteHold` is only set for the laptop.
- **Fix:** before line 512: `if (ui.noteOpen && !this.noteWasOpen) this.noteHold = inp.talk || inp.phone; this.noteWasOpen = ui.noteOpen;` and clear `noteHold` only when both keys are up. Same in `src/mp.js:795`.

### P2. "Turn your phone sideways" does not react when you turn the phone (MEDIUM, READ)

- **Where:** `src/main.js:118-127` (`resize`), `:157-165` (`launch`).
- **What the player sees:** start a class in portrait; the overlay asks you to turn the phone; you turn it; nothing happens. Only "PLAY ANYWAY" works, and it switches the prompt off for the rest of the session.
- **Cause:** `resize` hides the overlay only when `game.state !== 'title'`, but the overlay is only shown while the state is `'title'`. `pending` is never launched.
- **Fix:** in `resize`: `if (input.touch && h <= w && !$('rotate').classList.contains('hidden')) { ui.show('rotate', false); if (pending) { const p = pending; pending = null; launch(...p); } }`

### P3. A video somebody sent you is lost if you switch apps (MEDIUM, READ)

- **Where:** `src/phone.js:214-224`; `src/videos.js:84`, `:301`.
- **What the player sees:** during "Watch the video Sam sent you" you press T (or tap APP). The phone shows the game. The video never comes back, the task cannot be done, and the story waits up to 150 s.
- **Cause:** `switchApp()` leaves `'video'` mode; only `home()` goes back to it, and `home()` is only called after a message or a scare.
- **Fix:** at the top of `switchApp()`: `if (this.mission && !this.mission.player.done) { if (this.mode !== 'video') { this.feed.pause(); this.game.pause(); this.psst.pause(); this.mode = 'video'; this.redraw = 0; } return; }`

### P4. The desk-action bar stays on screen after you are caught at his desk (MEDIUM, READ)

- **Where:** `src/sneak.js:220`, `:227-233`.
- **What the player sees:** "READING HIS LAPTOP" and its frozen bar stay under the crosshair after he carried you back, until you next aim a paper.
- **Cause:** the seated branch calls `this.sneakUi(null)` (the sneak bar) where it should hide the action bar. `sneakAimOn` is never reset.
- **Fix:** `if (me.deskJob || this.sneakAimOn) { this.sneakAimOn = false; ui.aim(null); }`

### P5. Friends call you and your phone buzzes while you are on the floor (MEDIUM, READ)

- **Where:** `src/game.js:1082-1125`, `:1137-1163`.
- **What happens:** while you crawl to his desk a friend calls or your phone buzzes. You cannot answer from the floor. After 15 s the friend shouts (+22 anger) or the phone rings (+25). He turns to your empty chair.
- **Fix:** `const off = this.me.out || this.me.slipK > 0;` Do not start a call or a buzz while `off`, and do not count their timers down while `off`.

### P6. Captions cover the lower part of your phone on a phone screen (MEDIUM, READ)

- **Where:** `style.css:94-95`, `:137`; `src/phone.js:254-259`.
- **Fix:** in `ui.phoneControls` toggle `body.phone-up` for the game, memes, PSST! and video modes; `@media (max-height: 500px) { body.phone-up #subtitle { bottom: max(2px, env(safe-area-inset-bottom)); } }`

### P7. The prompt, the pass meter and the button labels freeze during a cutscene (LOW, READ)

- **Where:** `src/game.js:346-351`, `:544-545`; `src/chain.js:174-179`.
- **What the player sees:** "hold [E] · whisper to Sam", the PASSING THE NOTE meter, or TAP / APP / SHOW on the buttons stay for the whole "caught" scene.
- **Fix:** on the first cutscene frame only: `ui.prompt(''); ui.phoneControls(null, touch); if (this.chainMeter) { this.chainMeter = false; ui.aim(null); }` (keep a `cutWas` flag; the closet knock writes its own prompt inside a cutscene).

### P8. Leftovers after a restart or going back to the menu (LOW, READ)

| What stays | Where | Fix |
|---|---|---|
| The SEAT button and "C sneak" in the key legend, in a class without sneaking | `src/sneak.js:90`, `:807-808` | in `resetSneak`: `this.sneakSeatOn = null;` |
| Your phone or raised hand floating in front of the title or lobby screen | `src/phone.js:178-186`, `:261-266`; `src/main.js:209-220` | `Phone.reset()`: `this.place(0); this.group.visible = false; this.light.intensity = 0;` · `Game.reset()`: `this.handUp = 0; if (this.handGroup) this.handGroup.visible = false;` |
| "Show a friend your video" does nothing (old `showCool`) | `src/videos.js:57-67`, `:136-137` | see A12 |

### P9. The "psst!" marker for a phone held out to you never shows (LOW, READ)

- **Where:** `src/videos.js:222-227`; `src/game.js:1123-1124`.
- **Cause:** `localShow` sets the marker; `updateCalls` runs later in the same tick and overwrites it from the friend calls only.
- **Fix:** store `this.showSide` in `localShow` and OR it into the two `ui.call(...)` lines in `updateCalls`.

### P10. ASK, PRANK and ECHO are shown but do nothing in period 1, with no message (LOW, READ)

- **Where:** `src/game.js:530-531`, `:572-573`, `:2650`; `src/pranks.js:250`.
- **What happens:** How To Play teaches R, T and G. In period 1 `allowAsk` and `allowPrank` are false all period and `allowEcho` is false until Sam's dare. The keys and buttons do nothing.
- **Fix:** hide or dim the buttons until they are allowed (the `seatButton` pattern), or show "Not yet." on the status line.

### P11. The aim arc is shorter than the real flight (LOW, READ)

- **Where:** `src/pranks.js:22`, `:390-408`; `src/morepranks.js:116-126`.
- **Cause:** `ARC_N = 70` dots cover 1.56 s; long lobs and slow planes end in mid-air. The rubber band's arc stops at the first wall although the band bounces up to 4 times.
- **Fix:** `ARC_N` about 130 (or sample every third step). For the band, continue the preview through the bounces with the reflection in `morePaperRoom`.

### P12. Small layout problems that were not measured (LOW, READ)

- On a very short landscape screen (320-345 px high) the title column (about 430 px) is cut off with no scroll: `.title-inner { max-height: 100%; overflow: auto; touch-action: pan-y; }`
- `#hint { top: 48px }` ignores the notch in home-screen mode: use `calc(max(10px, env(safe-area-inset-top)) + 38px)`.
- With storage blocked the story menu always starts at period 1 (`src/main.js:36`, `:187`): fall back to `game.lastSaved`.

---

## 7. Checked and fine (do not spend time here)

- **Crashes:** none. 144 solo classes and the 3-player class ran with no exception and no console error.
- **Looping sounds:** every loop that was started was stopped by its handle (hum, fly, his ringtone, the alarm in normal play, chatter, phonk, whisper loops, laptop keys, eraser, chalk, the "caught" breathing). The gaps are A1, A6, A10 and A11.
- **Deliberate layers:** footsteps overlapping by their tails, thunder over thunder in the power cut, the rope creak and drips of the hanging scare, the scream + stab + bass hit of a jump scare. Leave them.
- **His voice:** `teacherSay` always stops his previous line, so there are never two normal lines at once. The problem is lines being cut (A3), not doubled.
- **Echo:** the player's squeaky copy over his line is by design.
- **Cleanup of scenes:** no `finally` contains a `yield`. `reset()` clears timers and side effects. Strike counting is right. These restore their state on every exit: `laptopLookup`, `glassesWipe`, the echo search, `reactQuestion`, `reactMeme`, `bustedSeq`, the older scares, `powerCut`, every event (ringtone, fly, fire drill, he leaves the room), every quirk reaction, the creep and the lean, and `scareScene` / `scEnd`.
- **Online plumbing:** sound start, stop, position, volume and `stopAll` are forwarded; no doubled sounds. His pose, glasses and the upside-down state are in the snapshot. Late join brings the board, projector, tasks, quirks, event sounds, ghosts, the note chain, KICK ME and off-chair players. A player leaving in the middle of a scene is handled everywhere it was checked. `chain.js`, `team.js`, `ghost.js` (except line 81), `dread.js`, the laser, KICK ME, "Who did it?" and the microphone send their messages to the right player.
- **Connection code (`net.js`):** join retries, cancel, welcome / full, the host healing and reopening with the same code, message chunking.
- **Input:** key-up, blur and `enable(false)` clear held actions. No stuck aim, phone, whisper, breath, laser or crawl was found (except online with the pause menu open: O11). One press never triggers two actions.
- **Rules:** the README rules match the code (strikes, Hard, arm up, three echoes, questions, confess / silent / point, breath times, the sneak bar). Report-card maths, unlocks, the daily seed and storage handling are right.
- **Touch buttons:** they do not overlap each other at any measured size.

---

## 8. Tests to add

1. **`tests/overlap.js` (sounds, captions, hints).** Play 8 full classes at 20 ticks per `playTick(0.05)` like `tests/fuzz.js` (seeds fixed, quirks `doze,hum` / `laugh,count` / `deaf,clock`, both a quiet and an active random player). Wrap `game.audio.play` to record `{ name, start: game.t + delay, length: loop ? Infinity : duration - offset / rate, rate, bus }` and wrap each handle's `stop` to record the stop time. Wrap `ui.subtitle` and `ui.hint`. Sample `game.dozing`, `game.ending`, `game.alarmOn`. Assert:
   - at most one live `m_snore` per source; none 0.5 s after `dozing` turns false (A1);
   - no state loop starts while `game.ending` (A10);
   - no teacher line at normal rate starts less than 1.0 s after another unfinished teacher line (A3);
   - `giggle` starts are at least 1.6 s apart (A5);
   - no caption is visible for less than 1.2 s; no tip is replaced in under 3 s (C1, C2);
   - no nap shorter than 5 s unless a player was loud (S1);
   - the class reaches `state === 'end'`; `ending` is never true for more than 60 s while playing (K1).
2. **`tests/hud.js` (overlap).** At 1280×720, 1024×576, 844×390, 667×375, 568×320 and 390×844 (touch on for the last four), freeze the class, show these combinations through the `UI` functions and compare `getBoundingClientRect()` of every visible HUD element (wait 900 ms after hiding and after showing, because the elements fade): the desk lean (BREATH bar + hint + caption + toast), whisper + buzz (prompt + phone alert + both "psst!" + echo cue + hint + caption), aiming, a 4-answer choice with a toast, off the chair at his desk, a ghost. Always with 4 tasks, 2 "TODAY HE" tags, the event line, strikes and the ECHO / QUESTIONS counters. No pair may overlap by more than 4×4 px.
3. **`tests/mp_leak.js`.** Host + friend. The host does each action of O1 and whispers three lines with Sam (O2). The friend's recorded hints, notes and captions must not contain the host's private texts. Keep the original `.local` functions when wrapping `ui.*` on the host, or every private line will look broadcast.
4. **K1 and K2 repros** as written in their Check lines.
5. **`tests/fuzz.js`:** add the `ending` invariant (K1), fail on any `already running` console warning (K2), and add the cushion to the random player's sneak actions.
