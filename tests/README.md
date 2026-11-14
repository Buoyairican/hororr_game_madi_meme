# Tests

Browser tests that play the game in headless Chromium (WebGL through SwiftShader). They use the
game's debug hook (`?debug=1` puts the game on `window.game`) and tick it faster than real time.

```bash
bash tests/run.sh quick     # ~10 min: the checks to run after every change
bash tests/run.sh full      # ~15 min: quick + every story period, Hard, random input, online edge cases and chaos
bash tests/run.sh ui mp     # only some of them
```

The runner serves the game on `localhost:8765` (`serve.py`: the static files, plus `api/turn` answering
`{"iceServers":[]}` like the Vercel function with no relay set up), starts a local PeerJS server on `127.0.0.1:9000`
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
| `touch`, `touch_phone` | phone-sized screen: touch buttons, choices, phone buttons (TAP / APP / SHOW), PRANK (DROP / BALL / SWAP) |
| `pranks` | aiming with G (arc, power, X / wheel, E to put it away, pause), the plane's glide and curve, hits on his back / head (glasses) / the board while he writes / a kid / Sam, a kid throwing back, the LAUGHS meter (mischief x2, noise), caught: three hits or he sees your arm up |
| `story1`–`story4` | a careful player plays a whole story period (`story.js`; in period 2 it does Sam's paper-ball dare) |
| `hard` | a careful player on Hard in Free Class |
| `fuzz` | random input through every period: no errors, teacher stays out of desks and walls |
| `mp` | 2 players: lobby, sync, whispering, echo, questions, busts, jumpscare, late join |
| `mp_video` | 2 players: phone crash heard by the host, showing each other videos, caught watching |
| `mp_prank` | 2 players: the guest aims and throws (host simulates it, both see the paper, the arm, the laugh meter), the host hits the guest, the guest caught with their arm up |
| `mp_edge` | wrong / short codes (it looks for the code about 10 s first), a 5th player turned away (the host's lobby says so), a friend leaving and rejoining mid-class, bad messages, the host closing the tab |
| `turn_api` | the relay function `api/turn.js` with a fake `fetch` (no browser): Cloudflare (both answer shapes, port 53 dropped), Metered, a static TURN server, nothing set up, provider errors, junk and timeouts, no secrets in the log, HEAD / POST |
| `mp_net` | joining: the relay list (Google STUN + PeerJS TURN + `api/turn`, faked with `page.route`, never a real TURN server) on host and friend; falling back when `api/turn` is missing / broken / slow; the host showing up a few seconds late; a host whose game doesn't answer (the tries, the final message, the console diagnosis) and comes back; CANCEL; the host's lobby (keep-open tip, SHARE / COPY on a phone, sounds and his lines, back from another app); the link to the game server dropping or the Peer dying and coming back with the same code |
| `mp_chaos` | host + 2 friends, random input, one drops and rejoins, Easy and Hard |

`tools/clipsheet.js` renders every meme clip at a few moments into `tests/out/clips_*.png`.

Every test ends with `RESULT PASS` or `RESULT FAIL: …` (decided in `lib.js` from what it printed:
failed checks, page errors, console errors) and the matching exit code.
