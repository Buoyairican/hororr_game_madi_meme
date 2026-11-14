// Content tables: what gets written, said, asked, texted and passed in notes.
export const FREE_LENGTH = 300;          // seconds for a whole free class (8:30 -> 12:30)
export const PHASE_AT = [0, 70, 150, 230];
export const PET_LIMIT = 100;            // leave with less mischief and he keeps you

export const BOARD_TEXT = [
  ['2 + 2 = 5', 'the mitochondria is the', '1066 = nothing happened', 'water boils at ___ ?', 'page 47', 'x + ? = ?', 'photosynthesis = ???', 'the heart has 4 rooms'],
  ['2 + 2 = 5', 'the mitochondria is the', 'water boils at ___ ?', 'page 47', 'photosynthesis = ???', 'x + ? = ?', 'a triangle has 5 sides'],
  ['WHO IS TALKING', 'eyes on the board', 'I can hear you', 'sit still', 'quiet quiet quiet quiet', '1 2 3 4 5 6 7 8 9 10 11 12 13', 'I KNOW'],
  ['I SEE YOU', 'NO ONE LEAVES', 'STAY STAY STAY STAY', 'you you you you you you', 'after class'],
];
export const LECTURE = [
  ['t_today', 't_page', 't_answer', 't_math', 't_mito', 't_water', 't_history', 't_writedown', 't_question', 't_continue', 't_forgot'],
  ['t_page', 't_answer', 't_math', 't_mito', 't_water', 't_history', 't_writedown', 't_question', 't_continue', 't_forgot', 't_silence'],
  ['t_attention', 't_eyes', 't_answer', 't_forgot', 't_laugh', 't_silence', 't_question', 't_hear', 't_still'],
  ['t_nobody', 't_laugh', 't_see', 't_still', 't_silence', 't_hear', 't_attention'],
];
export const WARN = ['t_quiet', 't_who', 't_hear', 't_eyes', 't_still'];
export const FRIEND_LINES = {
  sam: ['s_face', 's_arms', 's_board', 's_math', 's_blink', 's_real', 's_game', 's_after', 's_scared', 's_glasses', 's_kevin'],
  nora: ['n_look', 'n_writing', 'n_phone', 'n_quiet', 'n_chalk', 'n_head', 'n_clock', 'n_notes', 'n_hands', 'n_blind'],
};
// what they whisper about before the substitute walks in
export const FRIEND_EARLY = {
  sam: ['s_late', 's_game', 's_real', 's_after'],
  nora: ['n_free', 'n_phone', 'n_clock', 'n_quiet'],
};
export const PLAYER_LINES = ["shh... he'll hear us", 'I know, right?', 'look at his neck', 'stop making me laugh', 'what is he even teaching?',
  "I'm gonna fail this class", "his eyes... don't look at them", 'worst class ever', 'wait, what?', 'no way', "we're so dead", 'lol'];

export const MESSAGES = [
  [['Mom', 'pick up milk on the way home ❤️'], ['Sam', 'bro look at his HANDS 💀'], ['Nora', "don't let him see your phone"], ['Group: Room 13', 'who is the sub??']],
  [['Sam', 'why is he clapping so much'], ['Unknown', 'hello'], ['Group: Room 13', 'has anyone seen Mr. Hale since Friday?'], ['Nora', 'stop looking at your phone lol']],
  [['Unknown', 'i can see you'], ['Unknown', 'put it away'], ['Mr. Hale', "don't trust the substitute"], ['Unknown', 'eyes on the board']],
  [['Unknown', 'LOOK UP'], ['Mr. Hale', 'room 13. supply closet. hurry'], ['Unknown', 'stay after class'], ['Unknown', 'no one leaves']],
];

export const NOTES = [
  ['nora', 'Mr. Hale has never missed a day.<br>This guy just walked in.<br><b>Nobody called a substitute.</b>'],
  ['sam', 'did u notice?? he NEVER blinks.<br>and his hands hang down to his knees. why are his arms so long'],
  ['nora', 'Rules (trust me):<br>1. When the chalk stops, stop talking.<br>2. When he wipes his glasses, he can\'t see.<br>3. If he leans over your desk, <b>don\'t make a sound.</b>'],
  ['sam', 'Kevin talked in his class last week.<br>Kevin\'s desk is empty now.<br>dont tell anyone i wrote this'],
  ['nora', 'He keeps the quiet ones after class.<br>Don\'t be <b>too</b> quiet. Talk a little.<br>Just don\'t get caught.'],
];
// Notes passed to you as part of the story (one per period)
export const STORY_NOTES = [
  ['nora', 'Mr. Hale has never missed a day. Not once in 30 years.<br>This guy just walked in.<br><b>Nobody called a substitute.</b>'],
  ['sam', 'Kevin talked in class last Friday.<br>The "substitute" was here THAT day too.<br>Kevin\'s desk is still empty.<br><i>dont tell anyone i wrote this</i>'],
  ['nora', 'Rules (trust me):<br>1. When the chalk stops, stop talking.<br>2. When he wipes his glasses, he can\'t see.<br>3. If he stands behind you, <b>don\'t turn around.</b>'],
];
export const PLAN_NOTE = 'When he doesn\'t know something he <b>has</b> to look it up. He can\'t help it.<br><br>At the last bell, ask him something he can\'t look up.<br>While he\'s at the laptop, <b>we run.</b>';

// Dumb questions. type 'laptop': he stares, then has to look it up. 'instant': he "knows" this one.
export const QUESTIONS = [
  { id: 'wet', ask: 'p_q_wet', type: 'laptop', typed: 'is water wet', result: 'Yes. Water is wet.', answer: 'a_wet' },
  { id: 'two', ask: 'p_q_two', type: 'instant', answer: 'a_five' },
  { id: 'france', ask: 'p_q_france', type: 'laptop', typed: 'capital of franse', note: 'Did you mean: France', result: 'Paris', answer: 'a_france' },
  { id: 'fish', ask: 'p_q_fish', type: 'laptop', typed: 'do fish get thirsty', result: 'It depends on the fish.', answer: 'a_fish' },
  { id: 'bath', ask: 'p_q_bath', type: 'instant', answer: 't_nobody' },
  { id: 'sky', ask: 'p_q_sky', type: 'laptop', typed: 'why is sky', result: 'Sunlight scatters in the air.', answer: 'a_sky', thunder: true },
  { id: 'spell', ask: 'p_q_spell', type: 'laptop', typed: 'how to spell teecher', note: 'Did you mean: teacher', result: 'T - E - A - C - H - E - R', answer: 'a_spell' },
  { id: 'test', ask: 'p_q_test', type: 'instant', answer: 'a_test' },
  { id: 'name', ask: 'p_q_name', type: 'laptop', typed: 'what is my name', result: 'No results found.', answer: 'a_name' },
  { id: 'day', ask: 'p_q_day', type: 'laptop', typed: 'what day is it', result: 'Monday', answer: 'a_day' },
  { id: 'lunch', ask: 'p_q_lunch', type: 'laptop', typed: 'what do teachers eat', result: 'Sandwiches. Coffee. Apples.', answer: 'a_lunch' },
  { id: 'glasses', ask: 'p_q_glasses', type: 'instant', answer: 'a_glasses', anger: 12 },
  // only after that event happened in this class (src/events.js)
  { id: 'pizza', ask: 'p_q_pizza', type: 'instant', answer: 't_pz_mine', needs: 'pizza' },
  { id: 'call', ask: 'p_q_call', type: 'instant', answer: 't_ph_nobody', needs: 'ringtone' },
];
// Background classmates goofing off. When you do nothing for a while (no whispering, phone,
// repeating or questions), somebody in the back does a meme noise and he goes to check.
//   voice: kid line (a boy or girl version is picked)   sfx: sound effect   cap: subtitle for sfx
//   react: 'lookup' he looks the slang up and answers it | 'check' he walks over to the culprit
//          'snore' he wakes them up | 'smell' the laptop snitches | 'stare' a long dead stare
export const MEME_IDLE = [30, 75];  // seconds of you doing nothing before it happens (random each time)
export const MEMES = [
  { id: 'snore', sfx: 'm_snore', cap: '😴 <i>*loud snoring*</i>', react: 'snore' },
  { id: 'bruh', voice: 'm_bruh', react: 'lookup', typed: 'what does bruh mean', result: 'Slang. Disbelief. Also: brother.', answer: 't_bruh' },
  { id: 'fart', sfx: 'm_fart', cap: '💨 <i>*pfffrrrrrt*</i>', react: 'smell' },
  { id: 'airhorn', sfx: 'm_airhorn', cap: '📯 <i>*AIRHORN*</i>', react: 'check' },
  { id: 'sus', voice: 'm_sus', react: 'lookup', typed: 'what is sus', result: 'Short for: suspicious.', answer: 't_sus' },
  { id: 'boom', sfx: 'm_boom', cap: '<i>*dramatic BOOM*</i>', react: 'stare', line: 't_veryfunny' },
  { id: 'goat', voice: 'm_goat', react: 'check', line: 't_goat' },
  { id: 'trombone', sfx: 'm_trombone', cap: '🎺 <i>*wah wah wah wahhh*</i>', react: 'check' },
  { id: '67', voice: 'm_67', react: 'lookup', typed: 'what does 6 7 mean', result: 'Nobody knows.', answer: 't_67' },
  { id: 'pipe', sfx: 'm_pipe', cap: '<i>*CLANG* *clang* *clang*</i>', react: 'check' },
  { id: 'yeet', voice: 'm_yeet', react: 'check', line: 't_yeet' },
  { id: 'crickets', sfx: 'm_crickets', cap: '🦗 <i>*crickets*</i>', react: 'stare', line: 't_question', again: true },
  { id: 'rizz', voice: 'm_rizz', react: 'lookup', typed: 'what is rizz', result: 'Charm. Charisma.', answer: 't_rizz' },
  { id: 'honk', sfx: 'm_honk', cap: '🤡 <i>*honk honk*</i>', react: 'check' },
  { id: 'dun', sfx: 'm_dun', cap: '<i>*dun dun DUNNNN*</i>', react: 'stare', line: 't_veryfunny' },
  { id: 'skill', voice: 'm_skill', react: 'lookup', typed: 'what is a skill issue', result: 'A problem with your skill.', answer: 't_skill' },
  { id: 'oof', voice: 'm_oof', react: 'check' },
  { id: 'scratch', sfx: 'm_scratch', cap: '<i>*record scratch*</i>', react: 'stare', line: 't_veryfunny' },
  { id: 'sheesh', voice: 'm_sheesh', react: 'lookup', typed: 'what does sheesh mean', result: 'Amazement. A compliment.', answer: 't_thanks' },
  { id: 'slide', sfx: 'm_slide', cap: '<i>*slide whistle*</i>', react: 'check' },
  { id: 'huh', voice: 'm_huh', react: 'check' },
];
// ---------------- pranks (src/pranks.js): every number in one place
export const PRANK = {
  fold: { ball: 0.8, plane: 1.5 },                 // seconds to make the next one after a throw
  speed: { ball: [4.5, 11.5], plane: [4.0, 8.5] },  // metres per second at the lowest / highest power
  charge: 0.75,                                     // power gained per second while you hold G
  // how much the class laughs, and the mischief you get, for each kind of hit
  laugh: { head: 50, back: 38, front: 22, board: 8, boardWriting: 28, kid: 20, friend: 15, player: 22, npc: 18 },
  mischief: { head: 40, back: 30, front: 15, board: 5, boardWriting: 20, kid: 12, friend: 10, player: 10, throw: 2 },
  anger: { first: 8, again: 16, front: 6, ow: 4, thud: 3, busy: 10 },  // what a hit does to him
  throwBack: { kid: 0.4, friend: 0.3 },             // chance that whoever you hit throws one back at you
  laughHold: 1.6, laughDecay: 7,                    // the meter stays up this long, then drops this fast per second
  laughNear: 2.6, laughNoise: 0.55,                 // laughter is noise for the players this close to it
  streakReset: 45,                                  // seconds until he forgets the last hit (three hits: he knows)
  seenLimit: 0.3, exposeAfter: 0.7,                 // he looks right at your raised arm this long: caught
};
export const PRANK_NAMES = { ball: 'PAPER BALL', plane: 'PAPER PLANE', laser: 'LASER POINTER', note: 'KICK ME NOTE' };

// ---------------- Phase 3 (src/blame.js): "Who did it?", the KICK ME note, the laser pointer
// "Who did it?": he comes to your desk and asks. How sure he is that it was you (0..1) decides
// whether a lie works: below lieLimit he believes you. The choice says which side you are on.
export const BLAME = {
  lieLimit: 0.5,
  sure: { base: 0.1, heat: 0.008, echo: 0.3, echoWithin: 20, streak: 0.05, lie: 0.25, evidence: { prank: 0.1, echo: 0.05, note: 0.2, laser: 0.35 } },
  answerTime: 7,                    // seconds to answer (no answer: you said nothing)
  silentAnger: 10, watchFor: 25,    // "I am watching you.": he glares at you when you make a sound
  watchGlareGap: 6,
  confessCalm: 0.5,                 // the first confession: his anger is halved (the second one: "Again?" and a strike)
  blameMischief: 30, blameLaugh: 25,
  revenge: { after: [20, 45], lasts: 90, takeIt: 0.25 }, // a blamed kid tells on you later (or just takes the blame)
  friendGoat: 0.3,                  // "Point at...": now and then Sam or Nora instead of the nearest classmate
};
// the KICK ME note: stick it on his back while he walks past your desk
export const NOTE = {
  reach: 1.3,             // metres from your eyes to him
  behind: -0.2,           // ...and you must be behind him (his facing · the way to you below this)
  perClass: 2,            // notes per player per class
  stickMischief: 60,
  laugh: 24, laughMischief: 35, laughGap: 5, // every time he turns his back on the class
  foundAfter: [35, 50],   // then a kid tells him (or after foundLaughs laughs)
  foundLaughs: 4,
  anger: 14,              // when he reads it
};
// the laser pointer: hold it on (G with the laser picked); he chases the red dot like a cat
export const LASER = {
  range: 14,
  notice: 0.7,            // the dot in front of him this long: he sees it
  cone: 0.5,              // ...in front of him: cos of the angle from where he faces
  seeDist: 9,
  paw: 0.7,               // he paws at it when it is this close (flat metres from him)
  chaseMax: 14, pawsMax: 4, // then he gets it: "A trick." and he follows the beam back
  lostAfter: 1.2,         // the dot gone this long: "Where did it go?"
  eyes: 0.15,             // in his eyes this long: "My eyes." and he looks right at you
  findHold: 1.4,          // how long he stares down the beam (still on: caught, like an arm up)
  cooldown: 18,           // after a chase he ignores the dot this long
  laugh: 16, pawMischief: 25, chaseMischief: 5, // per paw / per second of chasing
  onHim: { laugh: 7, mischief: 8, gap: 3 }, // the dot on his back or his belly: the class giggles
  anger: { trick: 14, eyes: 18 },
};

// ---------------- a different teacher every class (src/events.js, src/quirks.js, src/slang.js)
// One seeded setup per class (classSetup in src/events.js) draws the events and his quirks: the same
// seed always gives the same class (the daily challenge uses that). Where an event or quirk can happen:
// 'p1'..'p4' are the story periods, 'free' is Free Class (also online).
export const CLASS_SETUP = {
  events: [3, 4], four: 0.5,      // a class draws 3 or 4 events (4 with this chance)
  quirks: 2,                      // ...and 2 quirks
  // Free Class: when the events start (seconds after 8:30), spread over the morning
  freeWindows: { 3: [[38, 70], [118, 158], [192, 232]], 4: [[34, 56], [92, 124], [152, 188], [212, 240]] },
  freeQuiet: 12,                  // ...an event waits until he has been free this long after the last one
  freeEnd: 8,                     // every event must be over this many seconds before the bell (or it is skipped)
  storySlots: 4,                  // the quiet windows in each story period that can hold an event
  readyWait: 15,                  // an event waits this long for a moment when he is free...
  softWait: 30,                   // ...then this long for one when he is only busy with you (a reaction, a habit); then it is skipped
};
// The event deck. len: about how long it lasts (seconds). Texts: the hint the first time, phone messages after it.
export const EVENTS = {
  ringtone: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], weight: 1, len: 24, hear: 0.45, laugh: 24, now: '📱 ON THE PHONE · hears you less',
    hint: 'His phone is ringing! <b>While he is on the phone, his back is turned</b> and he hears you less.',
    msgs: [['Group: Room 13', 'HIS RINGTONE 💀💀💀'], ['Sam', 'who is calling HIM'], ['Nora', 'did his phone just play THAT']],
    // the calls (his lines, the tiny voice in the phone between them): mother / wrong number / (later) him
    calls: [['t_ph_hello', 'phone', 't_ph_mother', 'phone', 't_ph_teaching', 'phone', 't_ph_bye'], ['t_ph_hello', 'phone', 't_ph_wrong'], ['t_ph_hello', 'static', 't_hale']],
    meme: { id: 'ring', sfx: 'madi_ring', cap: '📱 <i>*his ringtone, from somebody\'s phone*</i>', react: 'check', line: 't_ph_never' },
  },
  fly: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], weight: 1, len: 34, tries: 3, laugh: 14, hitLaugh: 34, hitMischief: 35, now: '🪰 HUNTING A FLY',
    playerDesk: 0.45,               // the chance the fly lands on a player's desk (he comes and slaps it)
    maxLen: 50,                     // no new try after this many seconds of hunting (the fly gets away through the window)
    hint: 'A fly! He is hunting it, and <b>he only looks at the fly</b>.',
    hintPrank: 'A fly! He is hunting it, and <b>he only looks at the fly</b>. Hit it with a paper ball?',
    task: 'Hit the fly with a paper ball', taskTouch: 'Hit the fly with a paper ball (hold PRANK)',
    msgs: [['Nora', 'why is he so angry at a fly'], ['Sam', 'the fly is winning 😭']],
  },
  pizza: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], weight: 1, len: 32, laugh: 26, now: '🍕 PIZZA',
    hint: 'A pizza delivery?! He is at the door: <b>his back is turned</b>.',
    msgs: [['Sam', 'he is eating PIZZA 🍕 in class'], ['Group: Room 13', 'who orders pizza to room 13??'], ['Nora', 'it said Mr. Hale on the box']],
  },
  firedrill: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], weight: 1, len: 20, alarm: 11, hear: 0.08, now: '🔔 FIRE ALARM · can\'t hear you', nowAfter: '🔔 FIRE ALARM',
    hint: 'Fire alarm! It is so loud <b>he can\'t hear you</b>. He can still see you.',
    msgs: [['Group: Room 13', 'was that a real fire alarm??'], ['Unknown', 'there is no fire']],
  },
  leave: {
    // (not in detention: there he never leaves you alone)
    in: ['p1', 'p2', 'p3', 'free'], weight: 1, len: 44, now: '🚪 OUT OF THE ROOM', away: 30, peek: [11, 17], peekFor: 4.5, back: 7.2, caughtAnger: 32, sawAnger: 26, paper: [3.5, 6],
    hint: 'He left the room! <b>Go wild</b>, but listen for his footsteps.',
    hintPeek: 'His face is in the door window. <b>He is watching.</b>',
    task: 'He is out: make some noise before he is back',
    msgs: [['Unknown', 'he is right outside the door'], ['Sam', 'he left?? where did he go']],
  },
};
// His quirks: each changes a number he already uses (hearing, anger, glances) or adds one small habit.
// chip: what the HUD lists ("TODAY HE...") once you have noticed it; hint: said the first time it shows.
export const QUIRKS = {
  deaf: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], chip: '👂 is deaf in his {side} ear', hear: 0.3, edge: 0.35, react: [18, 30], tell: 75,
    hint: 'He is deaf in his <b>{SIDE}</b> ear. On that side of him, <b>he can barely hear you</b>.',
  },
  laugh: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], chip: '😠 hates laughing', noise: 2.2, anger: 9, react: 14, giggle: 4, glareEvery: 14,
    hint: 'He <b>hates laughing</b>. When the class laughs, he gets angry fast.',
  },
  doze: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], chip: '😴 dozes off', first: [24, 40], every: [44, 66], dur: [9, 13], hear: 0.25, wakeAnger: 16, wakeLaugh: 40,
    hint: 'He is dozing off. <b>He can\'t see you</b>, and he barely hears you. Don\'t wake him up.',
  },
  clock: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], chip: '🕒 keeps checking the clock', first: [14, 26], every: [22, 34], look: [2.4, 3.4], glance: 0.35,
    hint: 'He keeps checking the <b>clock</b>. While he stares at it, his back is turned.',
  },
  count: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], chip: '🔢 counts the class', first: [30, 48], every: [46, 70], per: 0.72, movedAnger: 14, movedHeat: 12,
    hint: 'He counts the class. <b>When he points at you, sit still.</b>',
  },
  hum: {
    in: ['p1', 'p2', 'p3', 'p4', 'free'], chip: '🎵 hums while he writes', first: [16, 28], hear: 0.5, stop: 1.7, stopFor: 3,
    hint: 'He hums while he writes, so <b>he hears you less</b>. When the humming stops, he is listening.',
  },
};
// He learns your slang: words from the class clowns and your echoes. Later he uses them wrong (line),
// writes them on the board (board), and phonk from a phone makes him dance. He remembers them next class.
export const SLANG = {
  bruh: { from: 'bruh', line: 't_sl_bruh', board: 'BRUH = BROTHER ?' },
  sus: { from: 'sus', line: 't_sl_sus', board: '2 + 2 = SUS' },
  six7: { from: '67', line: 't_sl_67', board: '6 + 7 = 67', kid: 'm_67', word: '6 7' },
  rizz: { from: 'rizz', line: 't_sl_rizz', board: 'MITOCHONDRIA = RIZZ' },
  skill: { from: 'skill', line: 't_sl_skill', board: 'MR. HALE: SKILL ISSUE', word: 'skill issue' },
  sheesh: { from: 'sheesh', line: 't_sl_sheesh', board: 'SHEESH (VERB)' },
  yeet: { from: 'yeet', line: 't_sl_yeet', board: 'HOMEWORK: YEET IT' },
  goat: { from: 'goat', line: 't_sl_goat', board: 'I AM THE GOAT', word: 'the goat' },
  oof: { from: 'oof', line: 't_sl_oof', board: 'OOF = 5' },
  huh: { from: 'huh', line: 't_sl_huh', board: 'HUH ?' },
  mock: { from: 'echo', line: 't_sl_mock', word: 'your squeaky voice' },
  phonk: { from: 'phonk', line: 't_sl_phonk', dance: 9, word: 'phonk' },
};
export const SLANG_USE = {
  first: 22, gap: [34, 52],     // seconds after he learned a word before he uses it; between two uses
  perWord: 2, board: 0.4,       // each word at most twice a class; the chance he writes a word instead of the lesson
  keep: 8, laugh: 20,           // he remembers this many words next class; the class laughs this much
  phonkHear: 2.2,               // seconds of phonk from a phone he must hear to learn it
  danceHear: 0.3, danceLaugh: 32, // hearing while he dances (he only looks at his phone); the class laughs this much
  danceHint: 'He is <b>dancing</b> to phonk. He only looks at his phone and <b>barely hears you</b>.',
  danceCap: '🎵 <i>*phonk, from his phone*</i> 🕺',
  msgs: [['Group: Room 13', 'STOP TEACHING HIM WORDS'], ['Sam', 'he said it wrong 💀']],
  learnedToast: '📒 He learned a word: <b>{word}</b>',
  hint: 'He <b>learns your slang</b>. Listen to him use it… wrong.',
  remember: 'He remembers your slang from last time.',
};

// Playing online: how patient joining is, what the lobby says, and what you hear there
// (src/net.js, src/lobby.js, the lobby in src/main.js). Times are in milliseconds.
export const ONLINE = {
  turnUrl: 'api/turn',       // your own relay servers, if set up (api/turn.js on Vercel; see the README)
  turnTimeout: 3000,         // wait this long for them, then go on with the built-in ones
  turnCache: 30 * 60000,     // reuse the answer this long (its credentials last a day)
  joinFor: 60000,            // a friend keeps trying to connect this long (time with the game on screen)
  joinWall: 5 * 60000,       // ...and never longer than this on the clock (a hidden tab on a computer)
  tryFor: 15000,             // one try waits this long for the host to answer
  retryGap: 1500,            // pause between tries
  missingFor: 10000,         // "no class with that code" only after this long: the host may be coming back
  serverFor: 20000,          // the game server can't be reached at all: give up after this long
  openFor: 15000,            // one try to reach the game server
  hostTrying: 30000,         // host: a friend's connection that isn't open after this long has failed
  welcomeFor: 15000,         // a friend is in when the host says "welcome" (or "full"): wait this long for it
  takenTries: 3,             // host: the game server says "that code belongs to someone else" this often: give up on it
  refreshAfter: 10000,       // host back after this long in another app: renew the link to the game server
  awayLine: 4000,            // host back in the lobby after this long away: Mr. Madi tells you to stay
  text: {
    server: 'Reaching the game server…',
    connect: 'Connecting to the class…',
    retry: 'Connecting to the class… try {n}',
    missing: 'Looking for class {code}… try {n}',
    noClass: 'No class with that code.\nCheck the code. The host must keep the game open on the screen.',
    blocked: 'Could not connect to the host.\n1. The host keeps the game open on the screen.\n2. Press JOIN again.\n3. Still not working? One of you uses mobile data instead of Wi-Fi.',
    // the host answered, but the two networks need a relay (a TURN server) and there is none / it did not answer
    noRelay: 'Could not connect to the host.\nYour networks can\'t reach each other, and this game has no relay server.\n1. One of you uses mobile data instead of Wi-Fi. Press JOIN again.\n2. Game owner: switch on a relay (README, "Friends can\'t join?").',
    relayDown: 'Could not connect to the host.\nThe relay server did not answer on your network.\n1. Press JOIN again.\n2. Still not working? One of you uses mobile data instead of Wi-Fi.',
    noServer: 'Could not reach the game server. Check your internet, then press JOIN again.',
    noHostServer: 'Could not reach the game server. Check your internet, then try again.',
    stopped: 'Stopped. Press JOIN to try again.',
    inClass: 'You are in. Wait for the host to start the class.',
    lost: 'Lost the connection to the host. Press JOIN to go back in.',
    closed: 'The host closed the class.',
    classFull: 'That class is full (4 players max).',
    hostOpen: 'Send the code to your friends. Keep the game open until they are in.',
    keep: 'Keep the game open on this screen until your friends are in. In another app, they can\'t get in.',
    keepShare: 'Keep the game open on this screen until your friends are in. In another app, they can\'t get in. SHARE CODE sends it and you stay here.',
    shareTitle: 'MADI CLASS',
    shareText: 'Come to my class in MADI CLASS. Code: {code}',
    shared: 'Sent! Stay here until your friends are in.',
    copied: 'Invite link copied. Paste it to your friends, then come right back.',
    copyFailed: 'Send your friends this link: {url}',
    trying: 'Someone is connecting…',
    joined: '{name} is in.',
    left: '{name} left.',
    failed: 'Someone tried to join but could not connect. Ask them to press JOIN again.',
    failedNoRelay: 'Someone tried to join but could not connect. This game has no relay server, so friends on some networks can\'t get in (owner: README, "Friends can\'t join?").',
    full: 'Someone tried to join, but the class is full (4 players).',
    serverLost: 'Lost the game server. Reconnecting… (keep the game open)',
    serverBack: 'Your class is open again. Friends can join.',
    taken: 'Your class code was lost. Close the class and host a new one.',
    back: 'Welcome back. Your class is still open. Stay here while friends join.',
  },
  // what you hear in the lobby: a sound, and sometimes Mr. Madi (at the door) says something
  lobby: {
    joined: { sfx: 'net_join', line: 't_sitdown', fullLine: 't_everyone', gap: 6 },  // a friend sat down (4 of 4: "now everyone is here")
    in: { sfx: 'net_join', line: 't_sitdown', gap: 6 },                                // you got into a class
    left: { sfx: 'chair_scrape', vol: 0.45 },
    try: { sfx: 'net_try', vol: 0.55 },                                                // every try to connect
    fail: { sfx: 'net_fail', line: 't_nocome', gap: 20 },                              // you could not get in
    away: { line: 't_dontleave', gap: 45 },                                            // the host came back from another app
    lost: { sfx: 'door_slam', vol: 0.5 },                                              // sent back to the join screen (the class closed, the link died)
  },
};

export const HISTORY = ['how to be a teacher', 'what is 2 + 2', 'how often do people blink', 'how long can a class last', 'mr hale room 13 found?'];

export const CHAPTERS = [
  { time: '8:30 AM', title: 'ROLL CALL', sub: 'Period 1' },
  { time: '9:30 AM', title: 'THE LESSON', sub: 'Period 2' },
  { time: '10:30 AM', title: 'POP QUIZ', sub: 'Period 3' },
  { time: '11:30 AM', title: 'DETENTION', sub: 'Period 4' },
];

export const ENDINGS = {
  true: ['CLASS DISMISSED', 'He could not answer. He took off the glasses, and then there was nobody at the desk.<br>Mr. Hale\'s glasses were still warm.'],
  escape: ['YOU RAN', 'You never found out what was in the supply closet of Room 13.<br><i>The substitute is still looking it up.</i>'],
  wrong: ['WRONG QUESTION', 'He knew that one.<br><i>Ask him something he can\'t look up.</i>'],
  silent: ['TOO SLOW', 'You had one chance to ask.<br>Nobody leaves his class.'],
  caught: ['DETENTION', 'He caught you one time too many.<br>Nobody leaves his class.'],
  pet: ['AFTER CLASS', 'You were too quiet. He keeps the quiet ones.<br><i>Next time, don\'t be such a good student.</i>'],
  survived: ['CLASS DISMISSED', ''],
};

/** "sPoNgE cAsE" for mocking him */
export function mock(text) {
  let i = 0;
  return text.replace(/\.\.\./g, '…').replace(/[a-z]/gi, (c) => (i++ % 2 ? c.toUpperCase() : c.toLowerCase()));
}

/** minutes since 8:30 -> "9:05 AM" */
export function clockLabel(mins) {
  const total = 8 * 60 + 30 + mins;
  const h24 = Math.floor(total / 60), m = Math.floor(total % 60);
  const h = ((h24 + 11) % 12) + 1;
  return { text: `${h}:${String(m).padStart(2, '0')} ${h24 >= 12 ? 'PM' : 'AM'}`, h: h24, m, s: Math.floor((total * 60) % 60) };
}
