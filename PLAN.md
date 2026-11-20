# Past Summit: the plan to make it fun to replay

The game was scary once and then repetitive: you mostly sit and hold a key, the jokes are
scripted, he does the same things every time and every run is the same. This plan fixes that in
8 small phases. The phases run one after another; each one ships on its own to `main` (Vercel)
and the game stays fully playable after every phase. Before the next phase starts, the work is
reviewed: checked against this plan, the code read again, the full test suite run and the
screenshots looked at. Whatever the review finds gets fixed first.

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
   screenshots checked, the review passed, one pull request merged into `main`, the claude.ai link
   updated.

## Controls budget (everything new, in one place)

| | PC | Phone |
|---|---|---|
| Prank | hold **G** to aim, release to throw; **X** or mouse wheel switches | PRANK |
| Leave your seat | **C**, then **WASD** (or the arrows) to crawl, hold **E** at his desk, **C** at your desk to sit | SEAT / SIT + the stick, hold USE |
| Hold your breath | hold **B** | BREATH |
| Blame | the 1-3 choice menu you already know | the choice buttons |
| Laser pointer, KICK ME note | **X** / wheel picks them after the paper, hold **G** to use | SWAP, hold PRANK |
| Pass the note going round (online) | look at the next player, hold **E** | hold TALK |
| Haunt as a ghost (online) | **1** / **2** / **3** | LIGHT / CHAIR / BOOK (the ECHO / ASK / TALK buttons) |
| Blame a friend (online) | **4** in "Who did it?" | the fourth choice button |
| Microphone | SETTINGS (off by default) | SETTINGS |

Taken today: E / Space, Q / F / right click, R, T, 1-3, Esc / P, left click, G, X, mouse wheel (X / wheel / G also
work the laser pointer and the KICK ME note), C, W / A / S / D and the arrow keys (off your chair), B (hold your breath),
4 (a fourth answer). As a ghost, 1-3 are the haunts (a ghost gets no choices).

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
  a class closes on you) and Mr. Past at the door: "Sit... down.", "Do not... leave... my class.",
  "Nobody... is... coming." (`src/lobby.js`, `ONLINE` in `src/data.js`). Late joins and leaving are in
  the class log (`track.event`). README: "Friends can't join?" (switch on the own relay, how to check
  it). Tests: `tests/turn_api.js`, `tests/mp_net.js`, `tests/mp_lobby.js`, `tests/mp_fail.js`, `mp_edge`.
  Real NAT traversal (two phones on different networks) and a real TURN allocation can't be
  reproduced on the test machine: after deploying, test with two phones on different networks.

### [x] Phase 2: A different teacher every class (ideas 4, 6, 7)
- **Event deck** (`src/events.js`): each class draws 3-4 from: his embarrassing ringtone,
  a fly he hunts (slaps desks), a pizza delivery at the door, a fire-drill false alarm,
  he leaves the room for 30 seconds (chaos window, footsteps when he comes back).
- **Quirks**: 2 per class from: half deaf (one side), hates laughing, dozes off, obsessed with
  the clock, counts the class, hums. Each one changes numbers he already uses (hearing, anger
  rate, glance chance) or adds one small behaviour.
- **He learns your slang**: echoes and class-clown memes are remembered; later he uses them
  wrong (new voice lines), writes them on the board, tries to dance to phonk from a phone.
- Shipped: one seeded class setup (`classSetup` in `src/events.js`; `game.start(mode, chapter, { seed })`,
  `game.setup.seed`, `?seed=`) picks the events and quirks, so a daily challenge can reuse it. Free Class
  spreads the events over the class; story periods put each one in a quiet window that keeps the period's
  length and never lands on a scripted beat. Every event and quirk has a first-time hint, a line under his
  eye on the HUD, voice lines and sounds, and changes his hearing / sight / anger through the numbers he
  already uses; quirks show on the HUD only once you notice them. The slang he learns is kept in the
  browser for the next class. Online, guests get the setup (also late) and see and hear everything; a
  friend's desk can be slapped, a friend can swat the fly. Numbers and texts in `EVENTS`, `QUIRKS`, `SLANG`
  (`src/data.js`). Tests: `tests/events.js`, `tests/mp_events.js`.

### [x] Phase 3: Blame + note on his back + laser pointer (ideas 5, 1)
- "Who did it?" opens a choice: point at a kid, stay silent, confess. Lying while you are the
  obvious suspect (heat, last echo) can get you caught; a blamed kid gets revenge later.
- "Kick me" note: stick it on his back when he walks past your desk; every time he turns
  away the class laughs (laugh meter).
- Laser pointer: hold to show a red dot; he follows it like a cat; in his face, he finds you.
- Shipped (`src/blame.js`, numbers in `BLAME`, `NOTE`, `LASER` in `src/data.js`): the laser and the note are two more
  things to hold up after the paper ball and plane (X / wheel / SWAP, then hold G / PRANK), so no new keys. Sam
  gives them to you in period 3 (with two tasks) and you keep them in period 4; Free Class has them from the start
  (a hint and a task at 76 s). **Laser**: a red dot where you look (a real ray: walls, floor, desks, board, him,
  kids). He notices it in front of him after 0.7 s ("What is that?"), walks after it along the aisles and paws at
  it (laughs, mischief); the dot gone: "Where did it go?". After 4 paws or 14 s: "A trick." and he looks straight
  down the beam; in his eyes: "My eyes." and the same. Still on when he looks right at you = caught (the arm-up
  rule, reason `laser`); off in time, he comes and asks who did it. While he chases the dot the arm-up rule is off
  (he only has eyes for it). A dot on his back makes the class giggle. **KICK ME**: two per player per class; in
  reach when he is within 1.3 m and you are behind him (he walks down the aisle past a player's desk: a new idle
  walk while somebody still has a note). The class laughs every time he turns his back to them; a kid tells him
  after 35-50 s or 4 laughs; he tears it off, reads it ("Kick... me.") and asks. **"Who did it?"**: after the note,
  the laser, or a second hit on his back or a second echo (the row search stops at your desk), from period 3 on. How sure he is =
  your heat, a fresh echo, hits, earlier lies and the evidence; the choice title says whether he looks sure. A lie
  works below 0.5 (the kid says "What? Me?" and remembers: 20-45 s later, when you are up to something, "Sir! Sir!
  Look!" and he turns right to you; or the kid just takes the blame); a lie he sees through, or a kid you blamed
  before saying "It was them!", is a strike (`lie`). Say nothing: "I am watching you." (25 s of glares when you make
  a sound). Confess: anger halved the first time, "Again?" and a strike (`confess`) the second. Online: the friends'
  dots, the note on his back and in his hand, the arm with the pointer or the note, the choice on the friend's
  screen. Sounds: `bl_stick`, `bl_rip`, `bl_click`, `bl_paw`, `bl_ooh`; 35 voice lines. Tests: `tests/blame.js`,
  `tests/mp_blame.js`.

### [x] Phase 4: Leave your seat (idea 3, the biggest phase)
- C: slip out of your seat, crawl with WASD along the aisles (the same aisle graph he walks),
  hide behind desks. His sight uses your real position.
- At his desk: steal his glasses (he is half blind and searches), read his laptop (story
  secrets), move the clock forward, put a whoopee cushion on his chair.
- Caught out of your seat = a strike and he walks you back. Online: positions in input,
  avatars crawl.
- Shipped (`src/sneak.js`, numbers in `SNEAK` and the laptop texts in `SECRETS`, `src/data.js`): Nora gives you the idea in period 4
  (after Mr. Hale's message: "His laptop knows what he is") and Free Class has it from the start (a hint and a task at 100 s, two
  more tasks at 150 s). **C / SEAT** slips you off your chair into the aisle on the side you look at; WASD / the stick crawl
  (0.95 m/s) on the floor in front of and behind the rows, along the walls and in the aisles between the columns (not through
  desks, his desk or his chair, not into him); **C / SIT** next to your chair sits you back down. On the floor nothing else works
  (no phone, whisper, paper, questions). Everything he does still looks at your chair (`p.camPos`); only his sight looks at where
  you really are (`p.view`): a ray from his eyes to your head and your back, against the desks, chair backs, his desk, the kids
  and the seated players. A bar fills while he can see you (faster close up, slower in the dark, `SNEAK.see`); at the edge of his
  eye (lookDot 0.55..0.8) it stops at 0.95, half full he says "Hm?" and looks at you (a glance during a scene), full while he looks
  right at you (lookDot > 0.8) = caught, reason `seat` (Easy and Hard alike). He walks into you: caught too. Looking at your empty
  chair for 1.3 s: "Where did you go?" (a little anger), he walks to your desk scanning the floor; back in your chair in time:
  "Hmm." and he watches you (the glares from "Say nothing"), still gone: "I will find you." Caught: he comes to you, takes you by
  the collar (your view turns to his face), "Back to your seat.", walks you to your desk, then the usual strike ("You do not leave
  your seat."). **His desk** (hold E / USE; you come up off the floor to reach, easier to see): his **glasses** (a new habit: he
  puts them on his desk to rub his eyes, blind for 3 s, then writes without them: half blind, he only sees what is within 2.4 m,
  the eye says HALF BLIND; taken: "My glasses.", he pats the desk and hunts for them up and down the rows, then his spare pair
  from the drawer; caught with them: "And these are mine."), his **laptop** (the lid opens and glows while you read; one of 8
  secrets on your screen, in order in period 4), the **clock** (Free Class: stand up under it, +15 minutes, up to 45; the bell
  rings when it says 12:30; with the clock quirk he notices and puts it right), a **whoopee cushion** on his chair (one per player;
  a new habit: he sits down for a while and watches the class; on the cushion: the class laughs, he jumps up, "Who did it?"). Kids
  next to you look down at you; Sam and Nora react. The bell and the last strike put everybody back in their chairs. Online: each
  player crawls on their own screen and sends where they are; the host follows at crawling speed along the same floor, runs his
  sight and the desk, and sends everyone's position, the bar and the desk; avatars crawl on hands and knees (held up when he
  carries them); the laptop secret goes to the player who read it. Sounds: `sn_slip`, `sn_grab`, `sn_clock`, `sn_cushion`,
  `sn_squeak`, `sn_drawer`; 18 voice lines. Tests: `tests/sneak.js`, `tests/mp_sneak.js`.

### [x] Phase 5: Real dread (idea 8)
- While you stare at your phone he quietly gets closer.
- Things change when you look away: the board, an empty seat, a poster.
- When he leans over you: hold B and keep the mouse still until he leaves (breath meter).
- Shipped: new `src/dread.js`, numbers, texts and variants in `DREAD` (`src/data.js`).
  **The creep**: after 9-13 s on your phone (Hard 7-10) while he is at the board, he comes for you
  **backwards** (his back stays turned, so the catch rules are untouched: he can't see you), in three
  steps, with no footsteps. The tells: the chalk stops where it is, the lights at the front dim, a
  breath, a floorboard at your desk, plus the heartbeat that was already there. Easy: a quiet caption
  for each tell and Sam warns you; Hard: faster, quieter, no captions. Your phone does not make him
  angrier while he is on his way. Look up before he is there: he stops dead, only his head turns round
  ("I was... not... moving."), he goes back. Look up too late or never: he turns around at your desk
  and leans over (on Hard he then sees the phone: the usual instant catch; a video: he takes the phone).
  **The lean**: he also walks over by himself now and then. He bends over the desk ear first; hold
  **B** / **BREATH** and keep the view still until he straightens up. The BREATH meter (10 s Easy,
  8.5 s Hard) refills when you let go; out of air = a loud gasp. He hears you (breath, a move, the
  phone or talking, the gasp): Easy +30 anger and heat (100 is a strike as always), Hard: he looks
  right at you, caught (reason `breath`). He hears nothing: mischief, he calms down, "You... may...
  breathe." While he listens nothing else starts (`eventLock`).
  **Changes**: a poster (7 posters, two later versions each), a line on the board (written backwards,
  other words, or a line he never wrote), a seat (a kid gone and back later, two kids swapped, Kevin
  back for a while in the last hour). Only while the thing is outside every player's view (their real
  field of view plus a margin, for 0.6 s), each with a very quiet sound; looking at it again counts as
  noticing. Where: period 1 posters only; period 2 + board and the creep; periods 3-4 and Free Class
  (by the hour) everything; only in quiet stretches of lesson, never in a story moment.
  Online: the host runs it for every player (own breath, own lean); friends send "I hold my breath"
  and their field of view; snapshots carry everyone's breath, who he listens to, the lights, posters
  and seats; a change that reaches a friend while they look at it waits on their screen. Late joiners
  get everything; a friend who leaves mid-lean frees him. Stats: `dread_creep`, `dread_spotted`,
  `dread_seen_change`, `dread_lean`, `breath_hold`, `breath_fail`, `breath_time` (+ events in the
  log, `dreadChanges` in the class totals) and a line of your own numbers on the end screen.
  12 voice lines, 10 sounds (`gen_sfx.py dread`). Tests: `tests/dread.js`, `tests/mp_dread.js`; the
  careful story player holds its breath. Tests that need a class with no surprises: `game.dreadAuto = false`.
- Built in another session without Phases 2-4, then merged on top of them here. To fit them: he creeps
  up or leans over only when none of his other scenes is on (an event, a quirk habit, "Who did it?", the
  red dot, the empty-chair search, sitting on his chair); he never listens at an empty chair; off your
  chair, what you can see (for changes and noticing) is where you really are; you can't leave your seat
  while he leans over a desk or creeps up on you; the kids hide a crawling player where they sit now
  (two may have swapped seats); a breath heard on Hard gets "I can... hear you.". `tests/fuzz.js` holds
  its breath when he leans over and checks the breath, the lean and the creep never get stuck.

### [x] Phase 6: Reasons to replay (idea 9)
- Report card after every class (A to F) built from `game.track`.
- Unlocks (new pranks, phone themes, a third phone app), 12 hidden Mr. Hale notes and a
  notebook screen, 2 secret endings.
- Daily challenge: the same events and quirks for everyone that day (seeded setup only, not
  every dice roll), with a best score.
- Shipped: `src/replay.js` (report card, unlocks, notes, daily class), `src/morepranks.js`, `src/psst.js`,
  `src/secrets.js`, `src/profile.js` (what the browser keeps: one `localStorage` key, kept in memory
  when storage is blocked), `src/notebook.js`. Tables in `src/data.js`: `REPORT`, `UNLOCKS`,
  `PHONE_THEMES`, `PRANK_MORE`, `HALE_NOTES`, `SECRETS`, `DAILY`.
  **Report card**: its own block on every end screen (`#end-report`; in landscape it sits to the right, so
  the buttons stay in reach, and there is room for more blocks). Seven subjects, his comment for each,
  a stamped grade and his line ("A... for... awful." ... "F... for... favorite."). `REPORT.rows` is
  `[subject, stat key, points each, cap, comment]`: a key nobody counts yet is worth nothing, so later
  phases just add rows (blames, crawling, breath holds, events). The final grade is the average of the
  best 4 subjects (+6 on Hard). Online the host sends every player their own numbers and each browser
  builds its own card (only numbers are trusted from the network).
  **Unlocks** (8): SPITBALL (a C), RUBBER BAND (3 hits on him in one class), WATER BALLOON (an A), the
  phone app PSST! (3 classes), four phone themes. Shown on the end screen when earned, listed in the
  notebook. The pranks join Phase 1's selector through small hooks in `src/pranks.js` (`PAPER_KINDS`,
  `PAPER_MESH`, `nextPrank`, `morePaperRoom` / `morePaperPerson`), so a friend online can throw what only
  they unlocked. New counters: `glassesOff`, `soaked`, `trickShots`, `notesFound`; new log events:
  `text`, `haleNote`, `secret`, `daily`.
  **Mr. Hale's notes**: 12, each found by something you do in class; the find conditions are the `find`
  field of `HALE_NOTES` (`look` at a place for some seconds, a `stat`, a class counter, an `event` from
  the class log, your own phone), so later phases add triggers by adding rows (and places to
  `NOTE_PLACES`). The host checks them for every player; a note lands in that player's own browser.
  **Secret endings**: CLASS CANCELLED (Free Class, also online: three papers on his head break his
  glasses) and MR. HALE (story: after the true ending something knocks at the back; look at the supply
  closet and knock three times with E / TALK). The closet door is new in the room (right wall, at the back).
  **Daily class**: the seed is the UTC date as a number (`20261114`), passed as `opts.seed` to
  `game.start(mode, chapter, opts)` (stored as `game.nextSetup`, which Phase 2 turns into `game.setup`).
  From the seed: Easy or Hard, and today's special (a group of counters worth double in the daily
  score). A best score per day, DAILY CLASS in the menu with today's date and your best, DAILY in the
  host's lobby. `seededRng` and `hashStr` in `src/util.js`.
  Tests: `tests/replay.js`, `tests/replay_touch.js`, `tests/secrets.js`, `tests/mp_replay.js`.
- Built in another session without Phases 2-5, then merged on top of them here. To fit them: the
  report card grades Phases 3-5 too (new `REPORT.rows`: `blamed`, `lies`, `kickme`, `confessed` (a
  little off), `glasses`, `cushions`, `woke` in Behaviour; `sneaks`, `sneakTime` in Gym; `paws`,
  `clocks` in Science; `secrets` in Media Studies; `breath_hold`, `dread_spotted` in Drama; still seven
  subjects). Phase 4's laptop texts are `LAPTOP_SECRETS` (the endings keep `SECRETS`). X / SWAP cycles
  every tool you have: paper ball, plane, the unlocked pranks, then the laser and the note (`toolKinds`,
  src/blame.js), with a short tip for each new prank. The water balloon soaks whoever is near across the
  room (not measured to heads, so a balloon on the floor wets the kid sitting above it). Note 8 ("my
  spare glasses are missing") also comes from taking his glasses from his desk (`alt` in `HALE_NOTES`:
  a second way to find a note). The daily seed goes through Phase 2's class setup (`game.setup.seed`):
  the same events, quirks and plan for everyone that day. One `seededRng` / `hashStr` in `src/util.js`.

### [x] Phase 7: Online extras
- Teamwork missions: one asks a question to distract him while another sneaks to his desk;
  pass a note down a chain of players.
- Betrayal and scoreboard: blame friends; the end screen ranks who caused the most chaos.
- Ghost kid: a caught player stands in the corner as a ghost for a minute with small haunts
  (flicker a light, slide a chair, drop a book).
- Microphone (optional, off by default): laugh out loud for real and he hears it. Only your
  volume level is used, never sent anywhere; the browser asks first.
- Shipped (the other session had only started the data tables; built here on top of Phases 2-6). Tables in
  `src/data.js`: `CHAIN`, `GHOST`, `TEAM`, `MIC`, `CHAOS`. Each part has its own file.
  **The note chain** (`src/chain.js`, online only): 42-56 s into the class and then every 55-80 s (not in the
  last 50 s) a note starts with one player and goes round by seat. The holder sees what it says and who is
  next; looking at the next player and holding E / TALK (a whisper) for 1.3 s passes it (a meter; with the
  note, the next player wins over Sam or Nora in the same line of sight). If he looks right at the one
  passing it (the instant-catch look, lookDot > 0.8, the same on Easy and Hard) for 0.3 s, he takes it: a
  strike, and in the busted scene he reads that note out loud (5 notes, 5 lines). Also caught for anything
  else while holding it: he finds it. Made it in time: +40 mischief and 20 per pass, the class laughs, he
  calms down a little. A player who leaves passes it on; fewer than two: it falls apart.
  Stats: `chain_pass`, `chain_done`, `chain_lost`; events `chain`.
  **The ghost kid** (`src/ghost.js`): online with a friend still in the class, a player caught (not the last
  strike) floats into the back right corner as a ghost for 60 s. Like off-your-chair, `p.camPos` stays at the
  seat (he never sees or catches a ghost: no talking, phone, pranks or questions, nobody listens at their
  chair); their view floats to the corner, their avatar is see-through there. 1 / 2 / 3 (LIGHT / CHAIR /
  BOOK on a phone, a HUD with the cooldowns 16 / 34 / 24 s): the lights flicker; the spare chair at the back
  wall slides (he walks all the way to the back to look: "Who... moved... that?" "Nobody... is... there."); the
  book drops off his desk (it floats back 7 s later). Each takes some anger away; he only reacts when he is
  free (not in a scene, an event or a habit). Stats: `ghost`, `ghost_haunt`; events `ghost`, `haunt`.
  **Teamwork and betrayal** (`src/team.js`): a friend slipping off their chair tells the others to ask him a
  question; a desk act (glasses, laptop, clock, cushion) while another player's question keeps him busy is
  TEAMWORK (`team_distract` for the one who asked, once per question). "Who did it?" gets a fourth answer
  online (key 4): point at the nearest friend in their seat. Not believed: a lie, as with a kid. Believed:
  "Your... friend. Interesting." and he watches the friend (`watchedT`, heat); they are told who blamed them
  (`blame_friend`).
  **The microphone** (`src/mic.js`): SETTINGS, off by default and never saved (off again every start). The
  browser asks; refused / no microphone / not https / it stops: the setting turns itself off with a line
  saying why. An analyser node reads the level (RMS, dB; a steady background like a fan slowly stops
  counting; a key click is too short); above the gate it is noise like a whisper (on Hard, with him looking
  right at you, a catch like whispering), a laugh out loud counts (`mic_noise`, every 2.5 s) and sometimes
  he asks "What... is... so funny?". No sound is recorded, kept or sent. Online the friend's browser sends the
  host only that number (0..1) with its other input, so the host can hear them: the one difference from the
  idea above, which said the level is never sent anywhere.
  **The scoreboard** (`src/scoreboard.js`): online, every end screen gets WHO CAUSED THE MOST CHAOS: points
  from `CHAOS.weights` (all phases' counters), most first, and a title each (THE SNITCH, THE GHOST, THE
  SNIPER, THE SNEAK, THE MAILMAN, THE DECOY...; every title once, the biggest pair first; nobody: THE ANGEL).
  The host sends everybody's numbers; each browser builds the board (only numbers and names are taken).
  The report card also grades `chain_pass`, `blame_friend`, `ghost_haunt`, `team_distract`, `mic_noise`.
  10 voice lines, 2 sounds (`gen_sfx.py p7`). Tests: `tests/extras.js`, `tests/mp_extras.js`. The online tests of
  other phases set `game.extrasAuto = false` (no note going round by itself, no ghost after a strike, no decoy
  hints), like `dreadAuto`; `mp`, `mp_chaos` and the network tests keep them on. In a page that allows no
  microphone (an embed or a preview: the permissions policy says no) the setting says so and stays off.

### [x] After Phase 7: More jump scares, a clear How to Play
- A playtest counted 2, 1, 2 and 8 loud jump scares in periods 1–4 and 1–2 in a Free Class: the first half was
  not scary. New scares (`src/scares.js`, numbers and texts in `SCARES`, `src/data.js`), each a "local" scene
  that waits until you look (or comes anyway) and is never a strike (`scareBusy`: he sees and hears nothing):
  **the pencil** (P1; it rolls off your desk, his face comes up out of the floor next to it), **the wrong seat**
  (P2; "Psst! Over here!": it is him in your friend's chair; not online), **the fake bell** (P2; "PERIOD 2
  COMPLETE" tears; in Free Class once, in the last hour), **the sprint** (P3; the door creaks open, two eyes, he
  runs at you), **the hanging** (P4; drips, the lights die, he hangs upside down in front of you), **the window**
  (three knocks, "Let... me... in.", he slams into the glass) and **the face flash** (his face for a blink).
  The director (`scareList`) picks them too; the wrong seat, the sprint, the hanging and the fake bell count as
  his strong scares. A Free Class owes you an early scare (the pencil or the window after 40 s) and two strong ones
  (one from the halfway point, one in the last 80 s): `SCARES.free`, `scareOwed()`. Online the host tells every friend to run the
  same scene on their own screen (`gscare`; the friend's teacher, lights and blackout are local meanwhile).
  11 sounds (`gen_sfx.py p8`), 14 voice lines. Tests: `tests/scares.js`, `tests/mp_scares.js`.
- **How to Play** (`src/howto.js`): 7 short pages with a real game picture each (`tools/howto_shots.js`,
  `assets/ui/howto/`), keys on a computer and touch buttons on a phone; page 7 "MORE TRICKS" keeps every rule
  as tiles that open. The very first class shows pages 1–6 first (SKIP; `madiclass.howto` in the browser;
  debug URLs skip it unless `?howto=first`). Also in the pause menu. Tests: `tests/ui.js`.

### [x] His habit, and his new name
- **Mr. Past** (was Mr. Madi) and **PAST SUMMIT** (was MADI CLASS) everywhere you see or hear it: the title, the board,
  the report card, the lobby, the notes, the share text and the 8 voice lines that say his name
  (`gen_voices.py --only=...` rebuilds just those). Internal names stay (the 3D model, sound files, the browser's saved
  progress keys, the daily class seed), so nobody loses progress and the daily class stays the same.
- **The tap** (`src/teacher.js`, numbers in `TAP`): standing still, and always while he thinks (`T.thinking`: pondering
  the board, the long stare), his right hand rests on his stomach and taps it lightly, 2.4–3.2 taps a second, in
  bouts with pauses, with a soft pat up close (`belly_tap`, `gen_sfx.py p9`). Never while he walks, leans, crouches,
  sits, holds his glasses or in a scare. Online the friends see it through his bones. Tests: `tests/scares.js`.

### [x] The November update: DEBUG.md D1-D23 and IDEAS.md F1-F6
- 36 commits built on `80cf993` (see `DEBUG.md`, `IDEAS.md`, `BUG_REPORT.md`; `node tools/check.js all` checks them):
  the story no longer locks up on the last strike, one snore loop, captions per speaker, tips that wait their turn
  (`showHint`, `uiTo`, `ui.status`), no more online leaks, each player's own control tips, "HE CAUGHT BO / YOU" at
  once, a friend's own meme videos count, ten small fixes; F2 he gets stuck on a question (`src/stuck.js`), F3 online
  one victim per scare and the others watch, F4 four new scares (shoulder, under the desk, the note, the stare),
  F5 trust and telling on a friend (`src/trust.js`), F6 the class monitor (`src/monitor.js`).
- Merged with his habit and his new name: his pat while he thinks at the board is F1's (`bellyPat`, pose `'belly'`,
  `BELLY`); the light tap above is what he does when he just stands still (and in the long stare at the board).
  They never overlap (the tap needs pose `'rest'`), and the tap never starts in a scare (`T.tapBlock`).

### [x] Room to breathe (a gameplay playtest, then the fixes)
- The playtest (17 whole classes played by bots, every tip, caption, sound and scene recorded) found: his lean over your desk
  collided with a friend's call, the phone and the "repeat him" cue (and Nora's "HEY!" punished a player who held still);
  Free Class never breathed (he was in a scene 79-97 % of the time); 6-10 tips in the first minute and an 8-line task list;
  control tips in the middle of a scare; habits repeated far too often in the long story periods (13 counts in period 2);
  the phone buzzed while he stared at you; several asks at once; the toast across the middle of a phone screen.
- `src/pacing.js` (numbers in `PACE`, `src/data.js`): `askHold(p)` (his lean from the moment he walks over, a scare,
  "Who did it?", his stuck question, a choice, a story moment): calls and the buzz neither start nor run out; `askBusy(p)`:
  one ask at a time (calls, buzz, a classmate's video, a sent video, a note); `calmOk()`: 12-18 s of plain lesson after any
  scene before his own next one (habits, events, scares, desk visits, class clowns; a scare the class is owed may cut it short,
  and events let it go first); tips wait while a scare or a lean is on and come 9 s apart, and a control tip is skipped when
  you found the control yourself (solo); habits come 30 % later each time and at most 3 naps / 3 counts / 5 clock checks a
  class; his habit lines are not repeated within 50 s; the buzz only starts while he is not looking and only counts down then;
  Sam and Nora never call over his lines; no echo cue and no question while he listens at your desk; the task list shows 3 open
  tasks (always the newest) and the bell, a finished one for 4 s; on a short screen the toast sits top left.
  Tests: `tests/pacing.js`.

