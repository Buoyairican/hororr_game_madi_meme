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
| 8:30 AM | Roll Call | Footsteps in the hallway, a face in the door window. He walks in, writes his name and claps the chalk off his hands. Roll call: Kevin is absent. Nora passes you a note. Sam dares you to repeat what he says. The storm gets worse. |
| 9:30 AM | The Lesson | "Open your books." Nobody has books. Ask him dumb questions: he walks to his laptop to look them up, and the projector shows the whole class what he searches for. He wipes Mr. Hale's glasses. Then the projector shows his search history. |
| 10:30 AM | Pop Quiz | He quizzes you to your face, asks how many students are in the class, and Kevin is back for a moment. Then he walks between the desks and stops right behind your chair. |
| 11:30 AM | Detention | Nora has a plan. Mr. Hale texts you. "There is no lunch." At the last bell, ask him something he can't look up. Three different endings. |

**Free Class**: the whole morning in one go (about 5 minutes), getting darker and stranger every hour.

## How to play

| | Desktop | Phone / tablet |
|---|---|---|
| Look around | mouse (click the game first) | drag anywhere |
| Whisper to a friend | look at Sam (left) / Nora (right), hold **E** | hold **TALK** |
| Play on your phone | hold **Q** or right click | hold **PHONE** |
| Repeat what he just said | **R** | **ECHO** |
| Ask him a dumb question | **T** (pick with 1–3) | **ASK** |
| Pause | **Esc** | **II** button |

* **Repeat him**: right after he speaks, your squeaky impression makes the class laugh. He looks for who said it. Do it too many times in a row and he knows it was you.
* **Dumb questions**: he stares at you, he doesn't know, he goes to his laptop. While he types he isn't watching you. Ask too many and you're in trouble.
* **When he wipes his glasses**, he can't see you.
* **When the chalk stops, stop talking.** He turns around without warning.
* If he catches you, he comes to your desk. **Three strikes** and the period is over.
* **The class clowns**: if you do nothing for a while (a random 30 seconds to over a minute each time; no whispering, phone, repeating or questions; just looking around doesn't count), somebody in the back does a meme noise: snoring, "bruh", an airhorn, a sad trombone, "six seven!", a goat, a whoopee cushion, crickets, a metal pipe… He stops, turns around and goes to find out who did it. He looks slang up on his laptop ("what does bruh mean"), wakes up the snorer by slapping their desk, and once the laptop even tells him who farted. In detention, the ones he catches don't look the same afterwards.
* An optional helper HUD (Settings) shows when he is watching you and how angry he is.

Tip: headphones. The audio is positional; you can hear his footsteps.

## Run it locally

The game is plain static files (ES modules), so any static web server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` directly from disk will not work, because browsers block module imports from `file://`.

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
src/data.js                board text, lines, questions, messages, notes, chapter titles
src/teacher.js             Mr. Madi: rigged suit body, IK arms and legs, walk cycle
                           (feet step, hips stay level so he seems to glide), glasses
src/madi_head.js           the head shaped from the reference photo, jaw, teeth, glasses
src/students.js            Sam, Nora, the class and Kevin (blink, talk, look, breathe)
src/props.js               laptop, projector (shows his searches), classroom door
src/world.js               the classroom (merged static geometry, lights, rain, dust)
src/board.js               chalkboard written letter by letter
src/models.js              loads the rigged character models
src/audio.js               Web Audio engine: 3D HRTF sound, reverb, live ambience
src/post.js                retro post-processing (grain, aberration, glitch, blackout)
assets/models/             rigged .glb characters (built by tools/build_characters.py)
assets/textures/           teacher face texture + glow mask (from the reference photo)
assets/audio/voice/        156 spoken lines
assets/audio/sfx/          50 sound effects
tools/                     scripts that generate all of the assets above + preview pages
vendor/                    three.js r170 (+ GLTFLoader)
```

### Regenerating the assets

```bash
sudo apt-get install espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-us3 ffmpeg
pip install numpy pillow pyfqmr
python3 tools/make_face_texture.py   # face texture + eye glow
python3 tools/build_characters.py    # all characters (downloads the CC0 MakeHuman base mesh once)
python3 tools/gen_voices.py          # voice lines that are missing (--all rebuilds every line)
python3 tools/gen_sfx.py             # all sound effects (add 'memes' to build only the meme noises)
```

## Credits and licences

* Engine: [three.js](https://threejs.org) r170, MIT licence (`vendor/THREE_LICENSE`).
* Human base mesh, skeleton, skin weights and shape targets: [MakeHuman](http://www.makehumancommunity.org/) / MPFB2, **CC0**.
  Clothes, hair, eyes and poses are generated from it by `tools/build_characters.py`.
* Fonts: Caveat, Special Elite and Nosifer from Google Fonts via Fontsource, SIL Open Font License 1.1.
* Voices: eSpeak NG + MBROLA voices (us1, us2, us3), processed with ffmpeg/rubberband; whispers are
  made by re-exciting the speech envelope with noise.
* Meme noises (snore, boom, airhorn, sad trombone, record scratch, crickets, metal pipe, clown horn, slide
  whistle, whoopee cushion) are synthesised from scratch in `tools/gen_sfx.py`: no samples, no licences.
* Sound effects and the music box tune: synthesized from scratch by `tools/gen_sfx.py` (no samples).
* Classroom textures: painted procedurally at runtime (`src/textures.js`).
* Teacher face: the reference image supplied for this project.
