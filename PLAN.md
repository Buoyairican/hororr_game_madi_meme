# Madi Class: the plan to make it fun to replay

The game was scary once and then repetitive: you mostly sit and hold a key, the jokes are
scripted, he does the same things every time and every run is the same. This plan fixes that in
8 small phases. Each phase is one request ("do phase N"), ships on its own to `main` (Vercel),
and the game stays fully playable after every phase. Play it after each one; what feels off gets
fixed before the next phase starts.

## Rules for every phase

1. **Read before writing.** Open the exact code the phase touches and build on what is there:
   the teacher's brain (coroutines in `src/game.js`: `idleBrain`, `interrupt`, `cmd`, `beat`),
   the catch rules (`updateWatching`, `updateAnger`, `bust`, `bustedSeq`), the choice menu
   (`openChoice` / `pickChoice`), the phone (`src/phone.js`), the video mixin (`src/videos.js`)
   and the online sync (`src/mp.js`: host runs the game, guests send input, snapshots carry state).
2. **Same structure.** A new feature goes in its own mixin file next to `src/videos.js`
   (`Object.assign(Game.prototype, …)`), with its text and numbers in tables (`src/data.js`).
3. **No placeholders.** Every sound comes from `tools/gen_sfx.py`, every voice line from
   `tools/gen_voices.py`, listed in `src/audio.js` / `assets/audio/voices.json`.
4. **Online in the same phase.** Host-side logic covers every player (`players[]`, `p.in`);
   guests get what they need in `makeSnap` / `apply`. No "online later".
5. **Easy and Hard keep their rules.** Hard = same as Easy, one strike, instant catch only when
   he is looking right at you (`p.lookDot > 0.8`).
6. **Count it.** Everything a player does goes through `game.note(p, key)` and
   `game.track.event(...)` (`src/stats.js`) so the report card and scoreboard can use it.
7. **Test, then ship.** A test for the new feature in `tests/`, then `bash tests/run.sh full`,
   screenshots checked by eye, one pull request merged into `main`, the claude.ai link updated.

## Controls budget (everything new, in one place)

| | PC | Phone |
|---|---|---|
| Prank | hold **G** to aim, release to throw; **X** or mouse wheel switches | PRANK |
| Leave your seat | **C**, then **WASD** to crawl, **C** at your desk to sit | SEAT + joystick |
| Hold your breath | hold **B** | BREATH |
| Blame | the 1-3 choice menu you already know | the choice buttons |

Taken today: E / Space, Q / F / right click, R, T, 1-3, Esc / P, left click.

## Phases

### [x] Phase 0: Groundwork
- Tests moved into `tests/` with a runner (`bash tests/run.sh quick|full`), not deployed.
- This plan.
- `src/stats.js`: per-player counters (whispers, echoes, questions, videos, shown, fails,
  caught by reason, close calls, notes, talk / phone seconds) + an event log, reset every class.

### [ ] Phase 1: Pranks you aim + the laugh meter (ideas 1, 2)
- New `src/pranks.js`. Hold G: an arc preview from your hand; release: throw. Paper ball and
  paper plane (plane glides and curves). Hits: the board, his back, a friend, a kid's head.
- A projectile is a small simulated object (position, velocity, gravity, drag) hitting simple
  shapes: his capsule (from `teacher.pos` / head), the board plane, kids' heads, desks.
- He reacts per hit: on his back he spins around (if he sees you mid-throw: caught, reason
  `prank`); a kid that gets hit looks around and may throw one back; friends laugh.
- **Laugh meter** (HUD bar): good pranks make the class laugh, the meter multiplies mischief,
  decays over time, and laughter is noise (it feeds `updateAnger` for everyone near it).
- Online: guests send `{t:'press', k:'throw', yaw, pitch, power}`; the host simulates;
  snapshots carry active projectiles; avatars play a throw.
- Done when: tests for aiming, each hit type, his reactions, the meter, online throws.

### [ ] Phase 2: A different teacher every class (ideas 4, 6, 7)
- **Event deck** (`src/events.js`): each class draws 3-4 from: his embarrassing ringtone,
  a fly he hunts (slaps desks), a pizza delivery at the door, a fire-drill false alarm,
  he leaves the room for 30 seconds (chaos window, footsteps when he comes back).
- **Quirks**: 2 per class from: half deaf (one side), hates laughing, dozes off, obsessed with
  the clock, counts the class, hums. Each one changes numbers he already uses (hearing, anger
  rate, glance chance) or adds one small behaviour.
- **He learns your slang**: echoes and class-clown memes are remembered; later he uses them
  wrong (new voice lines), writes them on the board, tries to dance to phonk from a phone.

### [ ] Phase 3: Blame + note on his back + laser pointer (ideas 5, 1)
- "Who did it?" opens a choice: point at a kid, stay silent, confess. Lying while you are the
  obvious suspect (heat, last echo) can get you caught; a blamed kid gets revenge later.
- "Kick me" note: stick it on his back when he walks past your desk; every time he turns
  away the class laughs (laugh meter).
- Laser pointer: hold to show a red dot; he follows it like a cat; in his face, he finds you.

### [ ] Phase 4: Leave your seat (idea 3, the biggest phase)
- C: slip out of your seat, crawl with WASD along the aisles (the same aisle graph he walks),
  hide behind desks. His sight uses your real position.
- At his desk: steal his glasses (he is half blind and searches), read his laptop (story
  secrets), move the clock forward, put a whoopee cushion on his chair.
- Caught out of your seat = a strike and he walks you back. Online: positions in input,
  avatars crawl.

### [ ] Phase 5: Real dread (idea 8)
- While you stare at your phone he quietly gets closer.
- Things change when you look away: the board, an empty seat, a poster.
- When he leans over you: hold B and keep the mouse still until he leaves (breath meter).

### [ ] Phase 6: Reasons to replay (idea 9)
- Report card after every class (A to F) built from `game.track`.
- Unlocks (new pranks, phone themes, a third phone app), 12 hidden Mr. Hale notes and a
  notebook screen, 2 secret endings.
- Daily challenge: the same events and quirks for everyone that day (seeded setup only, not
  every dice roll), with a best score.

### [ ] Phase 7: Online extras
- Teamwork missions: one asks a question to distract him while another sneaks to his desk;
  pass a note down a chain of players.
- Betrayal and scoreboard: blame friends; the end screen ranks who caused the most chaos.
- Ghost kid: a caught player stands in the corner as a ghost for a minute with small haunts
  (flicker a light, slide a chair, drop a book).
- Microphone (optional, off by default): laugh out loud for real and he hears it. Only your
  volume level is used, never sent anywhere; the browser asks first.
