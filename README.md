# MADI CLASS

A first-person 3D horror game set in Room 13, from **8:30 AM to 12:30 PM**.
You sit in the front row. Mr. Hale, your teacher, never misses class. Today a
substitute walks in: **Mr. Madi**. He is too tall, his hands hang past his
waist, he wears round glasses that are not his, and he knows nothing about the
lesson. He stares. He claps the chalk off his hands. He looks everything up on
his laptop. And he is listening.

Runs in any modern browser on desktop **and iPhone/Android** (no install, no build step).

## Modes

**Story mode**: four periods, each about 6–8 minutes, so roughly half an hour for the whole story. Each period has quiet stretches of lesson between the story moments, and new tasks show up one at a time. Progress is saved.

| Time | Period | What happens |
|---|---|---|
| 8:30 AM | Roll Call | Footsteps in the hallway, a face in the door window. He walks in, writes his name and claps the chalk off his hands. Roll call: Kevin is absent. Nora passes you a note. Kevin's empty chair slides back by itself. Sam sends you a meme video: watch all of it without him seeing. Sam dares you to repeat what he says. The storm gets worse. |
| 9:30 AM | The Lesson | "Open your books." Nobody has books. Ask him dumb questions: he walks to his laptop to look them up, and the projector shows the whole class what he searches for. He wipes Mr. Hale's glasses. Sam dares you to hit his back with a paper ball. The school speaker calls for Mr. Hale, and he tears it off the wall. Sam's note has to reach Nora without him seeing it (if he catches you, he reads it out loud). Nora holds her phone out: "Psst! You have to see this!" Then the projector shows his search history. |
| 10:30 AM | Pop Quiz | He quizzes you to your face, asks how many students are in the class, and Kevin is back for a moment. Sam slips you a laser pointer and a KICK ME note. Then he walks between the desks (past your desk: stick it on) and stops right behind your chair. Sam needs to show you a video right now. The power goes out: every flash of lightning shows him a little closer. Don't make a sound. |
| 11:30 AM | Detention | Nora has a plan. The clock runs backwards. Mr. Hale texts you. "There is no lunch." The speaker he tore out comes back on: *the school is closed today, there is nobody in the building.* Somebody sends you a video of this classroom, filmed from the back... At the last bell, ask him something he can't look up. Three different endings. |

**Free Class**: the whole morning in one go (about 5 minutes), getting darker and stranger every hour.

**Difficulty** (title screen): **Easy** gives you 3 strikes. **Hard** plays the same (he still warns you when he only *hears* something) but you get **one strike**, and if he actually **sees** you whispering or on your phone, he comes for you right away.

**Play with friends**: up to 4 players in the same Free Class (Easy or Hard, the host picks).

1. One player presses **PLAY WITH FRIENDS → HOST A CLASS** and gets a 5-letter class code.
2. The host sends the code with **SHARE CODE** (on a phone the share sheet opens on top of the game, so you never leave it) or **COPY INVITE LINK**. **Host: keep the game open on your screen until your friends are in.** On a phone, a game in another app is frozen and can't let anybody in.
3. Friends press **PLAY WITH FRIENDS**, type the code and **JOIN**, or just open the invite link. The game keeps trying for about a minute and says what it is doing ("Connecting to the class… try 2"). **CANCEL** stops it.
4. The host picks Easy or Hard and presses **START FREE CLASS**. Friends who join later drop straight into the running class.

In the lobby Mr. Madi waits at the door. He tells every friend to sit down, he doesn't like it when the host leaves, and the door slams when a class closes on you.

Everyone sits at their own desk and sees the others as students with name tags. Look at a friend and hold **E** to whisper to them (only they see it). Hold your phone in the meme app, look at a friend and press **R**: you shout "Bro! Look at this!" and hold your phone out to them; they look at it to watch. Throw paper at him, at the class or at each other: everyone sees the paper fly, your arm winding up, and the laugh meter. Repeating him, dumb questions, the phone and whispering all work for everyone, and he goes after whoever is making the most noise: he walks to *their* desk. Strikes are shared by the whole class (Easy: 3, plus 1 for every friend; Hard: one strike for everybody).

How it works: the host's browser runs the game and streams it to the friends over WebRTC (peer to peer). [PeerJS](https://peerjs.com)'s free public server does the handshake. To find a way between two networks the game uses Google's STUN servers and **your own relay** (a TURN server, free for a small game). **Switch it on**, or friends on mobile data and strict Wi-Fi often can't join: see **Friends can't join?** below. Nothing to install and no game server; it works from any static host such as Vercel. If the host's link to the handshake server drops, or the host's phone comes back to the game, it reconnects by itself and keeps the same class code.

## Friends can't join?

**Why it happens.** Two phones on different networks (mobile data, school Wi-Fi, another country) often can't talk to each other directly. Then the game needs a *relay* in the middle (a TURN server). The game had no working relay, so these friends saw "could not connect to the host". It was not Vercel.

**Switch on your own relay. This is the real fix.** Without it, friends on mobile data or strict Wi-Fi will often still not get in.
- PeerJS's free relays are still in the game's list, but they are offline. (In November 2026 their addresses `eu-0.turn.peerjs.com` and `us-0.turn.peerjs.com` do not exist.) Don't count on them.
- Your own relay is free for a small game. You set it up once (below). It takes about 10 minutes.

**What the game does:**
- The host and every friend ask your relay for fresh passwords (`api/turn`).
- A friend keeps trying for about one minute.
- If it fails, the message says why. **"This game has no relay server"** means: switch on your own relay. The browser console (F12) shows the details.

**Try this first:**
1. Host: keep the game open on your screen. Don't switch apps. Send the code with **SHARE CODE**.
2. Friend: press **JOIN** and wait. It can take up to a minute.
3. Still not working? One of you switches from Wi-Fi to mobile data (or the other way).

**Switch on your own relay (Vercel).** The file `api/turn.js` is a small Vercel function. It gives the game fresh relay passwords. Your keys stay in Vercel, never in the code. Pick **one** provider:

*Cloudflare (recommended, a big free amount every month)*
1. Log in at [dash.cloudflare.com](https://dash.cloudflare.com). A free account is fine.
2. Open **Realtime → TURN Server** (older dashboards: **Calls → TURN**) and press **Create**.
3. Copy the **Turn Token ID** and the **API Token**. You see the API token only once.
4. In Vercel: your project → **Settings → Environment Variables**. Add:
   - `CF_TURN_KEY_ID` = the Turn Token ID
   - `CF_TURN_API_TOKEN` = the API Token
5. **Deployments → ⋯ → Redeploy.** New variables work only after a new deploy.

*Metered*
1. Sign up at [metered.ca](https://www.metered.ca) and open **TURN Server** in the dashboard.
2. Your app has a domain like `yourapp.metered.live`. Copy it. Copy your **API key** too.
3. In Vercel, add `METERED_DOMAIN` = `yourapp.metered.live` and `METERED_API_KEY` = the key. Redeploy.

*Any other TURN server* (for example your own coturn)
- Add `TURN_URLS` (comma separated, for example `turn:turn.example.com:3478,turns:turn.example.com:443?transport=tcp`), `TURN_USERNAME` and `TURN_CREDENTIAL`. Redeploy.
- Add a `turns:` address on port **443**. Strict networks (school, office) often allow only that.

**Check it:**
1. Open `https://<your-game>.vercel.app/api/turn` in a browser. You should see `turn:` addresses. `{"iceServers":[]}` means no relay is set up yet, or a key is wrong (Vercel → your project → **Logs** shows the error).
2. Host a class on a computer and open the console (F12). It says `own relay from api/turn: yes`.
3. Test with two phones on different networks: the host on Wi-Fi, the friend on mobile data. The friend should get in.

On a local server or GitHub Pages there is no `api/turn`, so there is no relay. Players on the same Wi-Fi can still play together.

## How to play

| | Desktop | Phone / tablet |
|---|---|---|
| Look around | mouse (click the game first) | drag anywhere |
| Whisper to a friend | look at Sam (left) / Nora (right), hold **E** | hold **TALK** |
| Use your phone | hold **Q** or right click | hold **PHONE** |
| …fly the plane / next video | **E**, **Space** or click (phone up) | **TAP** / **NEXT** |
| …switch app (game / memes) | **T** (phone up) | **APP** |
| …show a friend your video (online) | **R** (phone up) | **SHOW** |
| Repeat what he just said | **R** | **ECHO** |
| Ask him a dumb question | **T** (pick with 1–3) | **ASK** |
| Throw a paper ball / plane | hold **G** to aim, let go to throw | hold **PRANK**, let go |
| …ball or plane | **X** or the mouse wheel | **SWAP** |
| …put it away without throwing | **E** (or pull out your phone) | **DROP** |
| Laser pointer / KICK ME note (period 3 on, Free Class) | **X** picks them too; hold **G** to use | **SWAP**, hold **PRANK** |
| "Who did it?": point at a kid / say nothing / confess | **1–3** | the choice buttons |
| Pause | **Esc** | **II** button |

* **Repeat him**: right after he speaks, your squeaky impression makes the class laugh. He doesn't know who said it, so he walks down the rows and leans over the desks, looking at everyone, then goes back. Do it three times in a row and he knows it was you.
* **Your phone** has two apps. **PAPER PLANE**: tap to fly between the pencils. Crash and the phone plays a LOUD game-over tune that the whole class (and he) hears: he turns right to you, so put it away. **Memes**: an endless feed of short funny videos.
* **Meme videos**: friends send you videos and classmates hold their phone out to you ("LOOK! look at this!"). Watch them to the end, but **if he sees you watching a video, he comes and takes the phone**. The loud parts of a video can be heard across the room.
* **Dumb questions**: he stares at you, he doesn't know, he goes to his laptop. While he types he isn't watching you. Ask too many and you're in trouble.
* **Pranks**: hold **G** and a dotted arc shows where your paper goes and what it will hit; hold longer to throw harder, let go to throw. A **paper ball** flies fast and straight; a **paper plane** is slower, glides much farther and curves to one side (every one is folded a little differently). Hit **his back** and he spins around to find who did it (hit him three times and he knows it was you). Hit **his head** and his glasses fly off: he can't see until he finds them on the floor. Hit the **board while he writes** and the chalk screeches. Hit a **kid** and they yell "Ow!" and might throw one back at you; Sam and Nora laugh (or throw back). **If he sees your arm up, you're caught.**
* **LAUGHS meter**: good pranks make the class laugh. While they laugh, everything you do is worth more mischief (up to ×2), but laughing is noise, and he hears it around whoever it's about. It calms down by itself.
* **The laser pointer** (from period 3, and in Free Class): hold it on and a red dot sits where you look. When he sees the dot in front of him he **chases it like a cat**, pawing at it on the floor, the desks, the board; the class loses it. Keep it moving. After a while (or if you put it **in his eyes**) he gets it and looks straight down the beam: if it's still on when he looks at you, you're caught. A dot on his back just makes the class giggle.
* **KICK ME notes** (two per class): hold one out while he walks **past your desk with his back to you** and let go to stick it on. Every time he turns his back on the class, they laugh. Sooner or later a kid tells him.
* **"Who did it?"**: when he finds the note, gets the laser in his eyes, or his search after a second hit (or a second echo) reaches your desk, he asks you. **Point at a kid** (now and then he offers Sam or Nora): it works unless he's sure it was you (the choice says how sure he looks: your noise, a fresh echo, earlier lies), and the kid remembers it and may tell on you later. **Say nothing**: he watches you for a while. **Confess**: he forgives you once (and calms down); the second time, "Again?" and a strike.
* **When he wipes his glasses**, he can't see you.
* **When the chalk stops, stop talking.** He turns around without warning.
* If he catches you, he comes to your desk. **Three strikes** and the period is over.
* **The class clowns**: if you do nothing for a while (a random 30 seconds to over a minute each time; no whispering, phone, repeating or questions; just looking around doesn't count), somebody in the back does a meme noise: snoring, "bruh", an airhorn, a sad trombone, "six seven!", a goat, a whoopee cushion, crickets, a metal pipe… He stops, turns around and goes to find out who did it. He looks slang up on his laptop ("what does bruh mean"), wakes up the snorer by slapping their desk, and once the laptop even tells him who farted. In detention, the ones he catches don't look the same afterwards.
* **A different teacher every class.** Every class draws 3 or 4 **events** and 2 **quirks** from one seed (the same seed always gives the same class; `?seed=123` picks one).
  * **Events**: his embarrassing **ringtone** (he takes the call with his back to you and hears less), a **fly** he hunts (he only looks at the fly; it can land on your desk and he slaps it; hit it with a paper ball and he thanks you), a **pizza** at the door (his back is turned, then he eats it staring at you), a **fire alarm** that is so loud he hears nothing, and he **leaves the room** for 30 seconds (chaos counts double; watch the door window and listen for his footsteps). A hint tells you what each one means for you, and the line under his eye on the HUD says what he is doing.
  * **Quirks**: **half deaf** on one side (whisper on his deaf side), **hates laughing** (the class laughing makes him angrier), **dozes off** (he can't see you, but a loud noise wakes him), **obsessed with the clock** (he glances back less), **counts the class** (he points at every head) and **hums** while he writes (he hears you less, then more when he stops). You find them out by playing: the HUD lists the ones you noticed ("TODAY HE").
  * **He learns your slang**: class-clown memes and your echoes are remembered (also next class, in this browser). Later he uses them wrong in the lesson, writes them on the board, mocks your squeaky voice, and dances to phonk from his own phone.
  * Online, every player sees and hears all of it, also a friend who joins late.
* An optional helper HUD (Settings) shows when he is watching you and how angry he is.

Tip: headphones. The audio is positional; you can hear his footsteps.

## Run it locally

The game is plain static files (ES modules), so any static web server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk will not work, because browsers block module imports from `file://`.

## Put it online (Vercel)

The game is plain static files with no build step, so Vercel can host it as-is:

1. Sign in at [vercel.com](https://vercel.com) with your GitHub account.
2. **Add New… → Project**, then import `hororr_game_madi_meme` (give Vercel access to the repo if it asks).
3. Framework Preset: **Other**. Leave the build command and output directory empty.
4. Press **Deploy**. You get a link like `https://hororr-game-madi-meme.vercel.app` that anyone can open on a PC or phone.

Every push to `main` redeploys automatically. The `api/` folder has one small function (`api/turn.js`); Vercel runs it by itself. It gives online games your own relay. **Set it up** (see **Friends can't join?**), or friends on mobile data often can't join.

## Put it online (GitHub Pages)

1. On GitHub: **Settings → Pages**.
2. Source: *Deploy from a branch*, choose the branch with the game (e.g. `main`) and folder `/ (root)`.
3. After a minute it is live at `https://<your-user>.github.io/hororr_game_madi_meme/`.
4. On iPhone, open the link in Safari, then **Share → Add to Home Screen** to play fullscreen.

On iPhone, turn the silent switch off or you may not hear anything.

## Performance

The game is made to run on phones and old PCs: about 9k triangles per character, every
character is one or two draw calls, matte vertex-coloured materials, a low-resolution retro
render (setting), and shadows off by default on phones. The whole game is about 9 MB.

## What's inside

```
index.html, style.css      UI shell (menus, HUD, touch buttons, choices)
src/main.js                boot, loading, menus, settings
src/game.js                the teacher's brain (coroutines), story chapters, free class,
                           echo / question mechanics, friends, phone, scares, endings
src/videos.js              meme videos in class: missions, phones held out to you, the loud crash
src/pranks.js              pranks you aim: paper balls and planes, the aim arc, hits, his reactions, the LAUGHS meter
src/blame.js               the laser pointer (he chases the dot), KICK ME notes, "Who did it?" (lie, say nothing, confess)
src/events.js              a different teacher every class: the seeded class setup and the event deck
                           (ringtone, fly, pizza, fire alarm, he leaves the room)
src/quirks.js              his quirks (half deaf, hates laughing, dozes off, the clock, counts the class, hums)
src/slang.js               the slang he learns from you and uses wrong (remembered in the browser)
src/memes.js, src/clips.js the meme clips (original cartoons drawn live) and the clip player
src/phone.js               your phone: PAPER PLANE, the meme feed, messages
src/stats.js               what every player did in a class (counts + event log)
src/data.js                board text, lines, questions, messages, notes, chapter titles
src/teacher.js             Mr. Madi: rigged suit body, IK arms and legs, walk cycle
                           (feet step, hips stay level so he seems to glide), glasses
src/madi_head.js           the head shaped from the reference photo, jaw, teeth, glasses
src/students.js            Sam, Nora, the class and Kevin (blink, talk, look, breathe)
src/props.js               laptop, projector (shows his searches), classroom door
src/world.js               the classroom (merged static geometry, lights, rain, dust)
src/board.js               chalkboard written letter by letter
src/models.js              loads the rigged character models
src/mp.js                  multiplayer: lobby, streaming the class to friends, friends' desks and avatars
src/net.js                 WebRTC connections (PeerJS): host / join by class code, relay servers (STUN / TURN),
                           patient joining, the host reconnecting with the same code, connection diagnosis
src/lobby.js               the online lobby: its sounds, and Mr. Madi at the door while friends join
api/turn.js                Vercel function: your own TURN relay for online play (keys in Vercel, see above; switch it on)
src/audio.js               Web Audio engine: 3D HRTF sound, reverb, live ambience
src/post.js                retro post-processing (grain, aberration, glitch, blackout)
assets/models/             rigged characters (built by tools/build_characters.py, bundled in models.json)
assets/textures/           teacher face texture + glow mask (from the reference photo)
assets/audio/voice/        402 spoken lines
assets/audio/sfx/          111 sound effects and music loops
assets/videos/             your own .mp4 memes (optional, see assets/videos/README.md)
tools/                     scripts that generate all of the assets above + preview pages
tests/                     browser tests and their runner (bash tests/run.sh quick|full)
PLAN.md                    the plan for the next updates, phase by phase
vendor/                    three.js r170 (+ GLTFLoader), PeerJS 1.5.5
```

### Tests

`bash tests/run.sh quick` (about 10 minutes) or `bash tests/run.sh full` (about 17 minutes) plays the game in
headless Chromium and prints PASS / FAIL per test. See `tests/README.md`.

### Regenerating the assets

```bash
sudo apt-get install espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-us3 ffmpeg
pip install numpy pillow pyfqmr
python3 tools/make_face_texture.py   # face texture + eye glow
python3 tools/build_characters.py    # all characters (downloads the CC0 MakeHuman base mesh once)
python3 tools/gen_voices.py          # voice lines that are missing (--all rebuilds every line)
python3 tools/gen_sfx.py             # all sound effects (add 'memes', 'v4', 'v5', 'v6', 'v7' or 'p3' to build only one group)
python3 tools/pack_audio.py OUT      # every sound in one file (OUT.mp3 + OUT.json), for hosts that limit the number of
                                     # files (the claude.ai preview); the page then sets window.AUDIO_PACK = 'OUT'
```

## Credits and licences

* Engine: [three.js](https://threejs.org) r170, MIT licence (`vendor/THREE_LICENSE`).
* Multiplayer: [PeerJS](https://peerjs.com) 1.5.5, MIT licence (`vendor/PEERJS_LICENSE`).
* Human base mesh, skeleton, skin weights and shape targets: [MakeHuman](http://www.makehumancommunity.org/) / MPFB2, **CC0**.
  Clothes, hair, eyes and poses are generated from it by `tools/build_characters.py`.
* Fonts: Caveat, Special Elite and Nosifer from Google Fonts via Fontsource, SIL Open Font License 1.1.
* Voices: eSpeak NG + MBROLA voices (us1, us2, us3), processed with ffmpeg/rubberband; whispers are
  made by re-exciting the speech envelope with noise.
* Meme noises (snore, boom, airhorn, sad trombone, record scratch, crickets, metal pipe, clown horn, slide
  whistle, whoopee cushion) are synthesised from scratch in `tools/gen_sfx.py`: no samples, no licences.
* Sound effects and the music box tune: synthesized from scratch by `tools/gen_sfx.py` (no samples).
* Meme videos: 38 original cartoons drawn in code (`src/clips.js`), with music loops (phonk, lo-fi, euro dance,
  kazoo, mandolin) and cartoon sounds synthesised by `tools/gen_sfx.py` and voices made with eSpeak NG. They use
  popular meme formats (dramatic zoom, "to be continued", brainrot names, aura, six seven…) but no copied clips.
  PAPER PLANE is an original tap-to-fly game.
* Classroom textures: painted procedurally at runtime (`src/textures.js`).
* Teacher face: the reference image supplied for this project.
