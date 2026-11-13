# Tests

Browser tests that play the game in headless Chromium (WebGL through SwiftShader). They use the
game's debug hook (`?debug=1` puts the game on `window.game`) and tick it faster than real time.

```bash
bash tests/run.sh quick     # ~15 min: the checks to run after every change
bash tests/run.sh full      # ~60 min: quick + every story period, Hard, random input, online chaos
bash tests/run.sh ui mp     # only some of them
```

The runner serves the game on `localhost:8765`, starts a local PeerJS server on `127.0.0.1:9000`
for the online tests (`npm install` in this folder the first time), runs each test and prints
PASS / FAIL. Logs and screenshots go to `tests/out/` (not committed).

Needs: Node, Python 3 (static server), Playwright with Chromium installed on the machine
(`require('playwright')` must work; it is not a dependency here), ffmpeg (optional: the
own-video check makes a tiny test clip with it).

| Test | What it checks |
|---|---|
| `features` | the teacher's neck, PAPER PLANE and its loud crash, the meme app, phones held out to you, getting caught watching, the echo search, the 4 story video missions, your own video files, the stats tracker |
| `beats` | note passing, the power cut, the Hard / Easy rules |
| `ui` | menus, pause, settings, chapter select, end screens, keyboard controls |
| `touch`, `touch_phone` | phone-sized screen: touch buttons, choices, phone buttons (TAP / APP / SHOW) |
| `story1`–`story4` | a careful player plays a whole story period (`story.js`) |
| `hard` | a careful player on Hard in Free Class |
| `fuzz` | random input through every period: no errors, teacher stays out of desks and walls |
| `mp` | 2 players: lobby, sync, whispering, echo, questions, busts, jumpscare, late join |
| `mp_video` | 2 players: phone crash heard by the host, showing each other videos, caught watching |
| `mp_edge` | wrong / short codes, a 5th player turned away, a friend leaving and rejoining mid-class, bad messages, the host closing the tab |
| `mp_chaos` | host + 2 friends, random input, one drops and rejoins, Easy and Hard |

`tools/clipsheet.js` renders every meme clip at a few moments into `tests/out/clips_*.png`.

Every test ends with `RESULT PASS` or `RESULT FAIL: …` (decided in `lib.js` from what it printed:
failed checks, page errors, console errors) and the matching exit code.
