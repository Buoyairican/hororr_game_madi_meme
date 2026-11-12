# DEAD STARE: Room 13

A first-person 3D horror game set in a dark, foggy classroom. You sit in the
front row. The substitute teacher is not a real teacher: he doesn't know the
lesson, he stares at the board, he claps the chalk off his very long hands, and
he stares at **you**. Your friends won't stop whispering. Don't get caught.

Runs in any modern browser on desktop **and iPhone/Android** (no install, no build step).

## How to play

| | Desktop | Phone / tablet |
|---|---|---|
| Look around | mouse (click the game first) | drag anywhere |
| Whisper to a friend | look at Sam (left) / Nora (right), hold **E** or left click | hold **TALK** |
| Play on your phone | hold **Q** or right click | hold **PHONE** |
| Pause | **Esc** | **II** button |

* Survive until the bell rings at **3:00**.
* Talking and playing earn **mischief**. Leave class with almost none and he keeps you *after class*.
* **When the chalk stops, stop talking.** If he sees you, he gets angry: first a warning, then he comes closer,
  then he leans over your desk. Get caught at the top of his anger and one of your friends disappears.
  When nobody is left... it's you.
* Friends call you ("psst!"). Answer them quickly or they get loud.
* When your phone buzzes, check it before it rings.
* The red eye at the top tells you when he is watching you; the red line under it is his anger
  (both can be hidden in Settings).

Tip: headphones. The audio is positional, so you can hear where he is.

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

## What's inside

```
index.html, style.css      UI shell (menus, HUD, touch buttons)
src/main.js                boot, loading, menus, settings
src/game.js                gameplay: the teacher's brain (coroutines), anger, friends,
                           phone, scare director, punishments, endings
src/teacher.js             the monster: head built from the photo silhouette, long IK arms
src/world.js               the classroom (merged static geometry, lights, rain, dust)
src/board.js               chalkboard that is written letter by letter
src/students.js            Sam, Nora and the faceless students
src/audio.js               Web Audio engine: 3D HRTF sound, reverb, live synth ambience
src/post.js                retro post-processing (grain, aberration, glitch, blackout)
src/phone.js, input.js, ui.js, util.js
assets/textures/           teacher face texture + glow mask (made from the reference photo)
assets/audio/voice/        63 spoken lines (teacher + whispering friends)
assets/audio/sfx/          34 sound effects
tools/                     scripts that generate the assets above + a scene preview page
vendor/                    three.js r170
```

### How the monster was made

`tools/make_face_texture.py` cuts the face out of the reference photo, fills the background with the
nearest face colours, and builds a glow mask for the white eye crescents. In `src/teacher.js` the head
is a mesh shaped from the photo's measured silhouette (row by row), with the photo projected onto the
front, extra depth for the long nose and sunken eyes, glossy eyeballs, ears, and a jaw that unhinges.
He is about 2.35 m tall, his hands hang past his waist, and he glides rather than walks.

### Regenerating the assets

```bash
sudo apt-get install espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-us3 ffmpeg
pip install numpy pillow
python3 tools/make_face_texture.py   # face texture + eye glow
python3 tools/gen_voices.py          # all voice lines (teacher + whispers)
python3 tools/gen_sfx.py             # all sound effects
```

## Credits and licences

* Engine: [three.js](https://threejs.org) r170, MIT licence (`vendor/THREE_LICENSE`).
* Fonts: Caveat, Special Elite and Nosifer from Google Fonts via Fontsource, SIL Open Font License 1.1.
* Voices: generated with eSpeak NG + MBROLA voices (us1, us2, us3), then pitch-shifted and processed
  with ffmpeg/rubberband; whispers are made by re-exciting the speech envelope with noise.
* Sound effects and music box tune: synthesized from scratch by `tools/gen_sfx.py` (no samples).
* Classroom textures: painted procedurally at runtime (`src/textures.js`).
* Teacher face: the reference meme image supplied for this project.
