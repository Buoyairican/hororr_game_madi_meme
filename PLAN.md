# Madi Class: the plan to make it fun to replay

The game was scary once and then repetitive: you mostly sit and hold a key, the jokes are
scripted, he does the same things every time and every run is the same. This plan fixes that in
8 small phases. The phases run one after another automatically (no "do phase N" needed); each
one ships on its own to `main` (Vercel) and the game stays fully playable after every phase.
Before the next phase starts, a review by the Fable model must pass: it checks the work against
this plan, reads the code, runs the full test suite and looks at screenshots. Whatever it finds
gets fixed first.

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
   screenshots checked, the Fable review passed, then one commit per phase merged into `main`.

## Controls budget (everything new, in one place)

| | PC | Phone |
|---|---|---|
| Prank | hold **G** to aim, release to throw; **X** or mouse wheel switches | PRANK |
| Leave your seat | **C**, then **WASD** to crawl, **C** at your desk to sit | SEAT + joystick |
| Hold your breath | hold **B** | BREATH |
| Blame | the 1-3 choice menu you already know | the choice buttons |

Taken today: E / Space, Q / F / right click, R, T, 1-3, Esc / P, left click, G, X, mouse wheel.

## Phases

### [x] Phase 0: Groundwork
- Tests moved into `tests/` with a runner (`bash tests/run.sh quick|full`), not deployed.
- This plan.
- `src/stats.js`: per-player counters (whispers, echoes, questions, videos, shown, fails,
  caught by reason, close calls, notes, talk / phone seconds) + an event log, reset every class.

### [x] Phase 1: Pranks you aim + the laugh meter (ideas 1, 2)
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
- Shipped: the aim arc uses the very same flight code as the real throw. His head: the glasses
  fly off and he is blind until he finds them. Three hits on him within 45 s: caught. A kid he
  sees throwing one back gets the blame ("I saw that."). Sam's dare in period 2; periods 3-4 and
  Free Class allow pranks (period 1 does not). Touch: PRANK, then DROP / BALL-PLANE / SWAP.
  Numbers in `PRANK` (`src/data.js`). Tests: `tests/pranks.js`, `tests/mp_prank.js`, touch.js.

### [x] Online fix: friends can always join
- The bug: `src/net.js` passed its own `iceServers` (STUN only) to PeerJS, which threw away
  PeerJS's default TURN relays. Without a relay, two phones on different networks (mobile data,
  strict Wi-Fi, carrier NAT) often cannot reach each other: "could not connect to the host".
  Vercel is not the cause.
- Relays: keep PeerJS's free TURN servers (they turned out to be offline, see Shipped), plus an own relay from a tiny Vercel function
  (`api/turn.js`, credentials in Vercel environment variables, never in the repo; Cloudflare or
  Metered TURN, or any TURN server), including TURN over TCP/TLS on port 443 for strict networks.
  Without the function (local server, other static hosts) the game falls back silently.
- Joining is patient: a guest retries for about a minute with a clear status, the host's lobby
  says to keep the game open on screen, has a share/copy button for the code, and reconnects to
  the signalling server when the phone comes back to the game.
- Clear errors that say what to do; the README explains how to switch on the own relay.
- Done when: tests for the relay config, the fallback, the retry, and every online test passes.
- Shipped: `src/net.js` lists Google STUN + PeerJS's TURN relays + the own relay from `api/turn.js`
  (Cloudflare, Metered or any TURN server, from Vercel environment variables; it answers
  `{"iceServers":[]}` when nothing is set up or a provider fails). Both sides ask it, wait 3 s at most
  and fall back silently; a slow first answer is asked again in the background and used for the next
  connections. **The own relay must be switched on in Vercel for the fix to work**: PeerJS's free
  relays turned out to be offline (November 2026: `eu-0` / `us-0.turn.peerjs.com` have no DNS records),
  so without it there is still no relay. A friend tries for 60 s of time on screen (5 minutes on the
  clock at most) ("Connecting to the class… try 2"), "no class with that code" only after ~10 s;
  JOIN turns into CANCEL; a friend is in only when the host says welcome (a full class never shows
  "You are in"). The host keeps a secret token so it can take its code back: it reconnects (1, 2, 4,
  8 s) when the signalling link drops (also when it comes back slowly), renews it when the phone comes
  back after 10 s away (wall clock), and reopens the same code if the Peer died; a code another
  browser took is reported once, then it stops trying. Host lobby: the keep-open tip (it names SHARE
  CODE only when the button is there), SHARE CODE (the phone's share sheet) + COPY INVITE LINK,
  "Someone is connecting…", "could not connect" (only for friends who never got in, never from a
  closed class), "the class is full". In a class the lobby shows the code, the status line, the
  players and START on one screen (two columns on landscape phones and computers; a new note scrolls
  into view on tiny screens). A failed connection logs a diagnosis (ICE state, host / srflx / relay
  addresses, relay names that don't resolve, TURN errors); when the host answered but no relay was
  found, the friend reads "this game has no relay server" (or "the relay server did not answer") and
  the host gets the matching note. Lobby sounds (`net_join`, `net_try`, `net_fail`, the door slam when
  a class closes on you) and Mr. Madi at the door: "Sit... down.", "Do not... leave... my class.",
  "Nobody... is... coming." (`src/lobby.js`, `ONLINE` in `src/data.js`). Late joins and leaving are in
  the class log (`track.event`). README: "Friends can't join?" (switch on the own relay, how to check
  it). Tests: `tests/turn_api.js`, `tests/mp_net.js`, `tests/mp_lobby.js`, `tests/mp_fail.js`, `mp_edge`.
  Real NAT traversal (two phones on different networks) and a real TURN allocation can't be
  reproduced on the test machine: after deploying, test with two phones on different networks.

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
