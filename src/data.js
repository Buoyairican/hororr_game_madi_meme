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
  sure: { base: 0.1, heat: 0.008, echo: 0.3, echoWithin: 20, streak: 0.05, lie: 0.25, evidence: { prank: 0.1, echo: 0.05, note: 0.2, laser: 0.35, cushion: 0.15 } },
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

// ---------------- Phase 4 (src/sneak.js): leave your seat, crawl, his desk
export const SNEAK = {
  speed: 0.95,             // crawling, metres per second (he walks 0.85 when he is calm)
  eye: 0.52,               // your eyes on the floor (seated: 1.17)
  slip: 0.55,              // seconds to slip off your chair (or back on)
  sitReach: 0.75,          // how close to your chair you must be to sit back down
  slipNoise: 0.25, crawlNoise: 0.06, // a chair creaks; knees on the floor
  // his sight: a meter fills while he can see you (in front of him, nothing between his eyes and you).
  // Full while he looks right at you (lookDot > 0.8): caught. At the edge of his eye it only fills to `side`.
  see: {
    front: 1.7, edge: 0.5,  // per second at arm's length: straight ahead / at the edge of his eye
    far: 9, near: 1.4,      // it fills more slowly far away (a quarter as fast at `far`)
    dark: 0.45,             // ...and in the dark (gloom 1: this much slower)
    side: 0.95,             // the edge of his eye alone never fills it past this
    notice: 0.45,           // here he notices something: "Hm?" and he looks at you
    forget: 0.55,           // per second while he can't see you
  },
  bump: 0.42,              // he walks into you: caught (he feels you even without his glasses)
  emptySeat: { look: 0.86, time: 1.3, cool: 25 }, // looking at your empty chair this long: "Where did you go?"
  search: { stay: 4, scan: 1.2 },                  // he stands at your desk looking around, then goes back
  watchFor: 20,            // back in your seat in time: "Hmm." and he watches you this long
  outAnger: 10,            // when he finds your chair empty
  reach: 0.8,              // how close to a thing on (or at) his desk you must be to use it
  glasses: { gap: [50, 75], first: [35, 55], rub: 3.2, halfSee: 2.4, lost: 28, mischief: 60, anger: 12 },
  laptop: { hold: 1.6, mischief: 40, open: 2.5 },
  clock: { hold: 2.2, minutes: 15, max: 45, mischief: 50, anger: 10 }, // Free Class: the bell rings sooner
  reachUp: { glasses: 0.98, laptop: 1.02, cushion: 0.72, clock: 1.62 }, // your eyes while you hold E there (up on your knees, or standing for the clock)
  cushion: { perClass: 1, mischief: 80, laugh: 45, anger: 16 },
  sit: { gap: [45, 70], first: [25, 45], soon: 8, for: [7, 11], crouch: 0.42, chance: 0.5 },
};
// what is on his laptop (one per read; Free Class picks at random, period 4 goes in order)
export const LAPTOP_SECRETS = [
  ['SEARCH HISTORY', 'what is my name<br>what is a face<br>how to keep a face<br>how to give back a face'],
  ['EMAIL (not sent)', 'To: the principal<br>Mr. Hale will not be coming back.<br>I will take his classes.<br><b>All of them.</b>'],
  ['NOTES.txt', 'Sam: talks.<br>Nora: writes notes.<br>Kevin: done.<br>The new one: <b>soon.</b>'],
  ['CALENDAR', 'Friday: Mr. Hale, last lesson.<br>Monday: Room 13.<br>Tuesday: Room 13.<br><b>Every day: Room 13.</b>'],
  ['LESSON 7.doc', '<i>(empty)</i><br>0 words<br>Last changed: <b>1987</b>'],
  ['PHOTOS (1)', 'Mr. Hale at the board, from behind, in this classroom.<br>It was taken <b>from the ceiling.</b>'],
  ['SEARCH HISTORY', 'can a teacher hear a whisper<br>how far<br>how to hear through a desk<br>do children taste of chalk'],
  ['SEARCH HISTORY', 'questions I can not look up<br>what am i<br><b>No results found.</b>'],
];

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

// ---------------- real dread (src/dread.js): every number, text and variant in one place
export const DREAD = {
  // 1. he creeps up on whoever stares at their phone: he walks backwards, no footsteps, only small tells
  creep: {
    after: { easy: [9, 13], hard: [7, 10] },   // seconds on your phone before he starts (a new number every time)
    gap: { easy: [50, 75], hard: [38, 55] },   // seconds between two creeps
    speed: { easy: 0.42, hard: 0.56 },         // metres per second
    pause: { easy: 2.4, hard: 1.6 },           // he stands still this long after every step (a tell plays)
    steps: 3,                                  // steps from the board to your desk
    lookUp: 0.35,                              // your phone down this long: you looked up
    tellVol: { easy: 1, hard: 0.6 },           // how loud the tells are
    dim: 0.55,                                 // how much the lights at the front dim
    calm: 40,                                  // he only does it while his anger is below this
    spotMischief: 15,                          // you looked up in time
  },
  // 2. things change while nobody looks at them: the board, a seat, a poster
  change: {
    gap: [[40, 60], [34, 50], [28, 42], [22, 34]],  // seconds between two changes, by phase (story: by period)
    first: [16, 26],                                // the first one comes this long after the lesson starts
    unseen: 0.6,                                    // out of everybody's view this long before it may change
    pad: 1.15, padNet: 1.45,                        // margin around what a player can see (friends online: more, their view arrives late)
    notice: { cos: 0.93, time: 0.35, within: 90 },  // looking this straight at it, this long: you noticed (if you look within 90 s)
    back: [25, 45],                                 // a kid who is gone is back after this long
    kevin: [14, 22],                                // Kevin stays this long
    mischief: 8, fear: 0.5,
  },
  // what happens to a line on the board: flip = the same line, backwards; swap = other words; add = a line he did not write
  board: [
    { id: 'flip', w: 1 },
    { id: 'swap', w: 2, text: [
      ['did you look away?', 'page 47  page 47  page 47', 'who is missing?', '2 + 2 = you'],
      ['did you look away?', 'count the chairs', 'who is missing?', 'x + ? = you'],
      ['I moved', 'do not turn around', 'I counted you twice', 'look at me'],
      ['I am closer now', 'do not look away', 'your seat is next', 'look at me'],
    ] },
    { id: 'add', w: 1, text: [['psst'], ['look behind you'], ['one of you is gone'], ['you looked away']] },
  ],
  // posters: each one has two later versions (they come one after the other)
  posters: {
    missing: [
      { name: 'KEVIN', lines: ['Student, Room 13', 'Last seen: Friday', 'in his seat'], kid: true },
      { name: 'YOU', lines: ['Student, Room 13', 'Last seen: today', 'on your phone'], kid: true },
    ],
    rules: [
      { lines: ['1. NO TALKING', '2. NO PHONES', '3. EYES ON', '   THE BOARD', '4. DO NOT LOOK', '   AWAY', '5. NOBODY', '   LEAVES'], note: 'he is counting' },
      { lines: ['1. NO BREATHING', '2. NO PHONES', '3. EYES ON', '   HIM', '4. DO NOT LOOK', '   AWAY', '5. NOBODY', '   LEAVES'], note: 'too late' },
    ],
    silence: [{ words: ['SILENCE', 'IS', 'SAFER'] }, { words: ['HE CAN', 'HEAR', 'YOU'] }],
    eyes: [{ look: 1, text: 'HE IS WATCHING YOU' }, { look: 0, wide: true, text: 'DO NOT LOOK AWAY' }],
    atoms: [{ arms: 1.45, text: 'ARMS: TOO LONG' }, { arms: 1.9, text: 'ARMS: HIS' }],
  },
  // seats: gone = a kid is not there any more (back later); swap = two kids changed places; kevin = Kevin is back for a while
  seats: [{ id: 'gone', w: 3, min: 0 }, { id: 'swap', w: 1.5, min: 1 }, { id: 'kevin', w: 1.2, min: 3 }],
  // 3. he leans over your desk and listens: hold your breath (B / BREATH) and don't move the view
  breath: {
    max: { easy: 10, hard: 8.5 },              // seconds of air
    refill: 3,                                 // seconds from empty to full
    gasp: 1.6, gaspNoise: 0.7,                 // out of air: you gasp this long, and it is loud
    lean: { easy: [4, 5.5], hard: [5, 6.5] },  // how long he listens
    grace: { easy: 1.8, hard: 1.0 },           // time to get ready when he bends down (a friend online gets `lag` more)
    first: 3.0, lag: 0.3,                      // ...the very first time in a class on Easy: longer
    resume: 1,                                 // back from the pause menu while he listens: this long to press B again
    still: { easy: 0.12, hard: 0.07 },         // how far your view may move while he listens (radians)
    gap: { easy: [80, 115], hard: [60, 90] },  // seconds between his visits to a desk
    failAnger: { easy: 30, hard: 45 }, failHeat: 25,   // he heard you (Hard: he is looking right at you: caught)
    okMischief: 30, okCalm: 15,                // he heard nothing
  },
  // where it happens. Story: by period. Free Class: by phase. (Only in quiet stretches of lesson, never in a story moment.)
  when: {
    story: [
      { change: ['poster'] },
      { change: ['poster', 'board'], creep: true },
      { change: ['poster', 'board', 'seat'], creep: true, lean: true },
      { change: ['poster', 'board', 'seat'], creep: true, lean: true },
    ],
    free: [
      { change: ['poster'], creep: true },
      { change: ['poster', 'board'], creep: true, lean: true },
      { change: ['poster', 'board', 'seat'], creep: true, lean: true },
      { change: ['poster', 'board', 'seat'], creep: true, lean: true },
    ],
  },
  // hints (the key or the touch button shows, whichever the player has) and the quiet captions for the tells (Easy only)
  text: {
    creepHint: 'It got very quiet. <b>Look up from your phone.</b>',
    spotHint: 'He was walking <b>backwards</b>. Look up from your phone now and then.',
    leanHint: 'He is <b>listening</b>. <span class="desk-only">Hold <b>B</b> to hold your breath and <b>keep the mouse still</b></span><span class="touch-only">Hold <b>BREATH</b> and <b>don\'t drag the view</b></span> until he leaves.',
    leanOther: 'He is listening at <b>{name}</b>\'s desk.',
    okHint: 'He heard nothing. <b>Breathe.</b>',
    fail: { breath: 'He heard you <b>breathe</b>.', air: 'You ran out of air. <b>He heard that.</b>', moved: 'You <b>moved</b>. He noticed.', noise: 'He <b>heard</b> that.' },
    changeHint: 'That was different a moment ago. <b>Things change when nobody is looking.</b>',
    tells: ['the chalk has stopped', 'the lights dim', 'somebody is breathing', 'a floorboard, very close'],
    hud: { idle: 'BREATH', hold: 'HOLD YOUR BREATH', still: 'DON\'T MOVE', out: 'OUT OF AIR' },
    legend: ' · <kbd>B</kbd> hold your breath',
  },
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

// ---------------- online extras (Phase 7): every number and every text in one place
// The note chain (src/chain.js): a note goes from player to player while he is not looking.
export const CHAIN = {
  minPlayers: 2,
  first: [42, 56],           // seconds into the class before the first note goes round
  gap: [55, 80],             // pause before the next one
  stopBefore: 50,            // no new note this close to the last bell
  time: [30, 22],            // seconds for the whole chain: this much, plus this much for every pass
  hold: 1.3,                 // look at the next player and hold E / TALK this long to pass it
  seen: 0.3,                 // he looks right at you (the instant-catch look) this long while you pass it: he takes it
  reward: { pass: 12, done: 40, perPass: 20, laugh: 34, calm: 25 }, // mischief per pass / when it arrives (+ per pass); the class laughs; he calms down
  lostAnger: 12,             // he got the note: this much angrier (and it is a strike, like any note he catches)
  // what is on the paper, and the line he says when he reads it out loud (tools/gen_voices.py)
  notes: [
    { text: 'Mr. Madi googles<br><b>how to be a teacher.</b>', read: 't_cn_google' },
    { text: 'His arms are longer<br>than <b>my future.</b>', read: 't_cn_arms' },
    { text: '2 + 2 = 5.<br><b>Pass it on.</b>', read: 't_cn_five' },
    { text: 'Sir, blink twice<br>if you need <b>help.</b>', read: 't_cn_blink' },
    { text: 'Mr. Madi smells like<br><b>old soup.</b>', read: 't_cn_soup' },
  ],
  text: {
    start: 'pass it on &rarr;',
    holder: 'You have the note: <i>{note}</i><br>Look at <b>{next}</b> and hold <b>{key}</b> to pass it on, but only while he isn\'t looking!',
    next: '<b>{holder}</b> has a note for you. Don\'t let him look that way.',
    others: 'A note is going round: {chain}. Keep him busy while they pass it.',
    got: 'You got the note from <b>{from}</b>: <i>{note}</i><br>Now pass it to <b>{next}</b>.',
    last: 'You got the note from <b>{from}</b>: <i>{note}</i>',
    done: 'THE NOTE MADE IT!<br>+{pts} mischief',
    lost: 'HE GOT THE NOTE',
    timeout: 'The note never made it.',
    cancel: 'The note chain fell apart.',
    moved: '{who} left. <b>{to}</b> picked up the note.',
    prompt: 'hold {key} · pass the note to {next}',
  },
};
// The ghost kid (src/ghost.js): online, a caught player stands in the corner as a ghost for a while.
export const GHOST = {
  minPlayers: 2,             // only with friends in the class (your haunts are for them)
  time: 60,                  // seconds in the corner
  spots: [[4.35, 5.45], [3.6, 5.5], [4.5, 4.7], [2.9, 5.5]], // where a ghost stands (the back right corner), one spot per seat
  eye: 1.42, yaw: 0.5,       // how high a ghost floats, and which way it faces first (toward the class)
  floatIn: 2.0, floatOut: 1.4, // seconds to float to the corner / back to the seat
  firstWait: 2.5,            // no haunting until you have arrived
  bookBack: 7,               // the book floats back onto his desk after this long
  fear: 0.45,                // how much a haunt scares everybody (the screen)
  chair: { x: 1.5, z: 5.45, yaw: Math.PI, moves: [[0.55, -0.2, 0.7], [-0.5, -0.05, -0.5], [0.1, -0.35, 0.25]] }, // the spare chair at the back wall, and where it slides to (dx, dz, turn)
  // key 1-3 (or the touch buttons). cd: cooldown; calm: how much of his anger a haunt takes away;
  // line: what he says; the sound of the haunt itself is in src/ghost.js
  haunts: [
    { id: 'light', name: 'LIGHT', does: 'flickers the lights', cd: 16, calm: 8, mischief: 6, line: 't_gh_light' },
    { id: 'chair', name: 'CHAIR', does: 'slides a chair', cd: 34, calm: 14, mischief: 10, line: 't_gh_chair', after: 't_gh_nobody' },
    { id: 'book', name: 'BOOK', does: 'drops a book', cd: 24, calm: 11, mischief: 8, line: 't_gh_book' },
  ],
  text: {
    you: 'He sent you to the corner. You are a <b>ghost</b> for a minute: press <b>1</b>, <b>2</b>, <b>3</b> to haunt the class and pull him away from your friends.',
    youTouch: 'He sent you to the corner. You are a <b>ghost</b> for a minute: tap <b>LIGHT</b>, <b>CHAIR</b> or <b>BOOK</b> to haunt the class and pull him away from your friends.',
    others: '<b>{name}</b> is a ghost in the corner for a minute. Their haunts pull him away from you.',
    back: 'You are back in your seat.',
    wait: 'Not yet…',
    legend: '<kbd>1</kbd> light · <kbd>2</kbd> chair · <kbd>3</kbd> book · look around',
  },
};
// Teamwork and betrayal (src/team.js)
export const TEAM = {
  // the decoy: one of you asks him a question while a friend is off their chair; the friend gets to his desk meanwhile
  decoy: { mischief: 30, laugh: 20, hintCd: 40 },
  // pointing at a friend when he asks "Who did it?" (only online, only a friend in their seat)
  friend: { heat: 30, watch: 12, mischief: 30, laugh: 26 },
  text: {
    decoyAsk: '<b>{name}</b> is off their chair. Ask him a question ({key}) to keep him busy!',
    decoyDone: 'TEAMWORK!<br><b>{decoy}</b> kept him busy',
    point: 'Point at {name} (your friend)',
    blamed: '<b>{name}</b> blamed you! He is <b>watching you</b> now.',
    blamer: 'You blamed <b>{name}</b>. He believed you. Friends...',
  },
};
// The microphone (src/mic.js): optional, off by default. Only how loud you are is used.
export const MIC = {
  floorDb: -58, topDb: -14,  // this quiet counts as 0, this loud as 1
  attack: 10, release: 4,    // how fast the level follows your voice up / down (a key click is too short to count)
  floorRise: 0.03,           // a noise that never stops (a fan) slowly stops counting
  gate: 0.22,                // below this he hears nothing
  loud: 0.55,                // from here on it is as loud as a whisper (and counts as "you laughed out loud")
  minNoise: 0.35,            // the noise he hears at the gate (it grows to 1 at "loud")
  rearm: 2.5,                // seconds before the next laugh is counted again
  react: 0.25,               // the chance he stops and asks "What is so funny?" when he hears a laugh (if he is free)
  text: {
    asking: 'Asking your browser for the microphone…',
    on: 'Microphone on: he can hear you now. Only how loud you are is measured. Nothing is recorded or sent.',
    refused: 'The browser did not allow the microphone, so this setting is off again. Allow the microphone for this page in your browser, then turn it on once more.',
    missing: 'No microphone was found, so this setting is off again.',
    insecure: 'The microphone only works on a secure (https) page, so this setting is off again.',
    blocked: 'This page may not use a microphone here (it is shown inside another page), so this setting is off again. Open the game on its own site to use it.',
    failed: 'The microphone could not be started, so this setting is off again.',
    lost: 'The microphone stopped. The setting is off again.',
    hint: 'Your <b>microphone</b> is on: laugh out loud and he hears it for real.',
    heard: 'He heard that! Your <b>real voice</b> counts. Keep it down.',
  },
};
// The chaos scoreboard on the online end screen (src/scoreboard.js).
// weights: points for every counted thing a player did (game.track, src/stats.js). A key nobody
// counted is simply worth nothing, so rows for other features can be added before they exist.
// titles: a player gets the title whose keys gave them the most points (each title is given once).
export const CHAOS = {
  weights: {
    talk: 0.6, phone: 0.3, whispers: 6, echoes: 14, questions: 9, videos: 8, shown: 8, fails: 12, caught: 18, closeCalls: 10, notes: 3,
    throws: 2, hits: 6, hitHim: 16, glassesOff: 10, soaked: 10, trickShots: 12, notesFound: 4,
    kickme: 12, paws: 8, blamed: 10, lies: 6, woke: 10,
    sneaks: 6, sneakTime: 0.3, glasses: 14, secrets: 8, clocks: 10, cushions: 12,
    breath_hold: 8, dread_spotted: 6,
    chain_pass: 12, chain_done: 10, chain_lost: 8, ghost: 4, ghost_haunt: 9, mic_noise: 6,
    blame_friend: 15, team_distract: 20,
  },
  minTitle: 8,               // fewer points than this from a title's keys: not that title
  titles: [
    { id: 'snitch', name: 'THE SNITCH', keys: ['blame_friend'], why: 'blamed a friend {blame_friend}×' },
    { id: 'clown', name: 'THE CLOWN', keys: ['echoes', 'questions'], why: 'repeated him {echoes}×, {questions} dumb questions' },
    { id: 'ghost', name: 'THE GHOST', keys: ['ghost_haunt', 'ghost'], why: 'haunted the class {ghost_haunt}×' },
    { id: 'sniper', name: 'THE SNIPER', keys: ['hitHim', 'hits', 'glassesOff', 'soaked', 'trickShots'], why: 'hit him {hitHim}× with paper' },
    { id: 'sneak', name: 'THE SNEAK', keys: ['sneaks', 'glasses', 'secrets', 'clocks', 'cushions'], why: 'left their seat {sneaks}×' },
    { id: 'liar', name: 'THE LIAR', keys: ['blamed', 'lies', 'kickme'], why: 'blamed {blamed} classmates' },
    { id: 'chatterbox', name: 'THE CHATTERBOX', keys: ['talk', 'whispers'], why: 'whispered for {talk} seconds' },
    { id: 'zombie', name: 'THE PHONE ZOMBIE', keys: ['phone', 'videos', 'fails'], why: '{phone} seconds on the phone' },
    { id: 'mailman', name: 'THE MAILMAN', keys: ['chain_pass', 'chain_done'], why: 'passed the note {chain_pass}×' },
    { id: 'loudmouth', name: 'THE LOUDMOUTH', keys: ['mic_noise'], why: 'laughed out loud {mic_noise}×' },
    { id: 'decoy', name: 'THE DECOY', keys: ['team_distract'], why: 'kept him busy {team_distract}×' },
    { id: 'statue', name: 'THE STATUE', keys: ['breath_hold', 'dread_spotted'], why: 'held their breath {breath_hold}×' },
    { id: 'magnet', name: 'THE DETENTION MAGNET', keys: ['caught', 'chain_lost'], why: 'caught {caught}×' },
    { id: 'daredevil', name: 'THE DAREDEVIL', keys: ['closeCalls'], why: '{closeCalls} close calls' },
    { id: 'influencer', name: 'THE INFLUENCER', keys: ['shown'], why: 'showed {shown} videos around' },
  ],
  none: { id: 'angel', name: 'THE ANGEL', why: 'did nothing. Suspicious.' },
  head: 'WHO CAUSED THE MOST CHAOS',
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
  // Phase 6: the two secret endings (src/secrets.js)
  hale: ['MR. HALE', 'You knocked three times. Something knocked back.<br>He walked out of a closet that was never there, and asked for his glasses.<br><i>Kevin\'s desk is not empty any more.</i>'],
  glasses: ['CLASS CANCELLED', 'His glasses broke, and he could not find the class any more.<br>No class, no teacher. He went out to look it up.<br><i>At the back of the room, something knocked. Three times.</i>'],
};

// ================= Phase 6: reasons to replay =================
// (src/replay.js: report card, unlocks, Mr. Hale's notes, the daily class; src/morepranks.js; src/psst.js; src/secrets.js)

// ---------------- the new jump scares (src/scares.js). Each one plays on every player's own screen.
// pool: what the scare director (game.js) may pick. min = first hour (0-3) in Free Class, w = weight,
// cool = seconds before the same one again, once = one per class, strong = one of his big scares,
// solo = not online (it needs Sam and Nora), free = only in Free Class (in the story it is a set piece).
export const SCARES = {
  pool: {
    pencil: { min: 0, w: 2, once: true },
    window: { min: 0, w: 2, cool: 150 },
    flash: { min: 1, w: 1.5, cool: 70, fx: true },
    wrongseat: { min: 1, w: 2, cool: 200, strong: true, solo: true },
    sprint: { min: 2, w: 2.5, cool: 160, strong: true },
    hanging: { min: 2, w: 2.5, cool: 160, strong: true },
    fakebell: { min: 3, w: 2, once: true, strong: true, free: true },
  },
  wait: { pencil: 25, wrongseat: 14, sprint: 10, window: 12 }, // seconds it waits for you to look before it comes anyway
  // Free Class: an early scare (one of `first`, after `firstAt` seconds), one of his big ones from the halfway point,
  // and `strong` big ones in all (the last before the bell, at least `strongGap` seconds after the one before)
  free: { firstAt: 40, first: ['pencil', 'window'], halfway: 0.5, strong: 2, strongGap: 35 },
  len: { pencil: 12, wrongseat: 12, sprint: 10, window: 10, hanging: 9, fakebell: 8, flash: 1 }, // (the host waits this long when it can't watch)
  dim: 0.7,            // the lights after he vanishes from the front
  runSpeed: 7.5,       // metres per second (he walks at about 1)
  lunge: [1.0, 0.42, 0.16], // his face in yours: from, to (metres from your eyes), seconds
  flashDur: 0.09,      // the face flash, seconds on screen
  hint: 'Your pencil fell on the floor. <b>Look down</b> to find it.',
  hintTouch: 'Your pencil fell on the floor. <b>Drag down</b> to look at the floor.',
  fake: {              // the fake bell: a fake "you made it" screen, then he tears through it
    story: [['PERIOD 1 COMPLETE', 'The bell rang. Nobody moved.<br><i>Kevin\'s desk is still empty.</i>'],
      ['PERIOD 2 COMPLETE', 'Mr. Hale has been missing since Friday.<br><i>The substitute is wearing his glasses.</i>'],
      ['PERIOD 3 COMPLETE', 'Kevin was back for a moment.<br><i>His eyes were black.</i>'],
      ['CLASS DISMISSED', 'You survived Madi\'s class.<br>See you tomorrow.']],
    free: ['CLASS DISMISSED', 'You survived Madi\'s class.<br>See you tomorrow.'],
    next: ['NEXT PERIOD', 'MAIN MENU'],
    tear: 'CLASS IS NOT OVER',
  },
};

// ---------------- the report card
// One row per thing he grades: [subject, stat key, points for each one, the most it can give (or take), his comment].
// "{n}" in a comment is the number. The stat keys are the counters of src/stats.js (the player's own, then the whole
// class's), plus "survived" (1 when the class ended well), "minutes" and "strikes". A key nobody counts (yet) is
// worth nothing, so a row for a later feature can be added here before the feature exists.
export const REPORT = {
  rows: [
    ['Whispering', 'whispers', 14, 70, 'Whispered {n} times. I heard... every word.'],
    ['Whispering', 'talk', 0.7, 30, '{n} seconds of talking. In my class... nobody talks.'],
    ['Whispering', 'notes', 9, 27, 'Reads notes. Notes... are not... the lesson.'],
    ['Whispering', 'chain_pass', 8, 24, 'Passed a note {n} times. I... read it.'],                    // Phase 7
    ['Drama', 'echoes', 24, 96, 'Repeated me {n} times. Repeated me... {n} times.'],
    ['Drama', 'breath_hold', 10, 30, 'Held their breath {n} times. I heard... nothing.'],          // Phase 5
    ['Drama', 'dread_spotted', 8, 24, 'Turned around {n} times. Just as I... got close.'],
    ['Drama', 'team_distract', 12, 24, 'Asked a question... to distract me. I... noticed.'],        // Phase 7
    ['Drama', 'mic_noise', 6, 18, 'Laughed out loud {n} times. I... heard you.'],
    ['Science', 'questions', 24, 96, 'Asked {n} questions. Water... is dry.'],
    ['Science', 'paws', 10, 30, 'Made me chase a red dot. I am... not... a cat.'],                // Phase 3
    ['Science', 'clocks', 12, 24, 'Moved my clock. Time... does not... go faster.'],               // Phase 4
    ['Science', 'ghost_haunt', 8, 24, 'The lights. My chair. My book. The room... is not... haunted.'], // Phase 7
    ['Media Studies', 'videos', 22, 88, 'Watched {n} videos. None of them... were the lesson.'],
    ['Media Studies', 'shown', 12, 36, 'Showed {n} videos to the class. Nobody... showed me.'],
    ['Media Studies', 'phone', 0.4, 24, '{n} seconds on a phone. No... phones.'],
    ['Media Studies', 'fails', 8, 16, 'A very loud phone. {n} times.'],
    ['Media Studies', 'psst', 5, 20, 'Passed {n} notes. On a phone. In my class.'],
    ['Media Studies', 'secrets', 10, 30, 'Read {n} things on my laptop. Those... are mine.'],       // Phase 4
    ['Gym', 'hitHim', 26, 78, 'Hit me with paper {n} times. I... counted.'],
    ['Gym', 'hits', 7, 35, '{n} hits. Paper... is for... writing.'],
    ['Gym', 'throws', 3, 21, 'Threw {n} things. Missed... most of them.'],
    ['Gym', 'glassesOff', 14, 28, 'My glasses fell off {n} times. Strange.'],
    ['Gym', 'soaked', 16, 32, 'I am... still... wet.'],
    ['Gym', 'trickShots', 12, 24, 'A rubber band came off the wall. Geometry.'],
    ['Gym', 'sneaks', 8, 24, 'Left their seat {n} times. Sit... down.'],                            // Phase 4
    ['Gym', 'sneakTime', 0.3, 18, '{n} seconds on the floor. The floor... is not... a seat.'],
    ['Behaviour', 'closeCalls', 14, 42, 'Almost caught {n} times. Almost.'],
    ['Behaviour', 'objectives', 9, 36, 'Finished {n} tasks. None of them... were mine.'],
    ['Behaviour', 'blamed', 10, 30, 'Blamed {n} classmates. It was... you.'],                      // Phase 3
    ['Behaviour', 'lies', 8, 24, 'Lied to me {n} times. I... remember.'],
    ['Behaviour', 'kickme', 10, 20, 'A note... on my back. I... found it.'],
    ['Behaviour', 'confessed', -6, 12, 'Told me the truth. Strange.'],
    ['Behaviour', 'glasses', 14, 28, 'Took my glasses. I saw... nothing.'],                         // Phase 4
    ['Behaviour', 'cushions', 12, 24, 'My chair... made a noise. {n} times.'],
    ['Behaviour', 'woke', 10, 20, 'Woke me up. I was... thinking.'],
    ['Behaviour', 'blame_friend', 12, 24, 'Blamed a friend. Friends... are... temporary.'],          // Phase 7
    ['Behaviour', 'caught', -30, 90, 'Caught {n} times. I... see you.'],
    ['Attendance', 'survived', 70, 70, 'Stayed until the bell. Nobody... leaves early.'],
    ['Attendance', 'minutes', 6, 30, 'Lasted {n} minutes. Then... detention.'],
  ],
  base: { Behaviour: 50 },                 // points a subject starts with
  none: {                                  // what he writes when there is nothing to grade
    Whispering: 'Silent. I like... silent.', Drama: 'Never repeated me. Good.', Science: 'No questions. I know... everything.',
    'Media Studies': 'No phone. Suspicious.', Gym: 'Threw nothing. Sits... very still.', Behaviour: 'Did nothing. Perfect.', Attendance: 'Did not... leave. Nobody leaves.',
  },
  grades: [[85, 'A'], [68, 'B'], [50, 'C'], [30, 'D'], [0, 'F']],   // points -> letter
  best: 4,                                 // the final grade is the average of your best subjects (some classes have no pranks or questions)
  hardBonus: 6,                            // on Hard the final grade gets this many points more
  remark: {                                // under the final grade (he likes the quiet ones: an A is not a compliment)
    A: 'The worst student... I have ever had.', B: 'A bad influence... on the others.', C: 'Could be worse. Could be... quieter.',
    D: 'Almost... a good student.', F: 'Quiet. Still. My... favorite.',
  },
  remarkCaught: { D: 'You stay... after class.', F: 'You stay... after class.' }, // caught one time too many: not his quiet favorite

  voice: { A: 't_gradeA', B: 't_gradeB', C: 't_gradeC', D: 't_gradeD', F: 't_gradeF' },
};

// ---------------- unlocks (kept in the browser: src/profile.js)
// need: { grade: 'C' }  a report card this good  |  { stat, n, no? }  that many in one class (and none of `no`)
//       { total, n }  that many over all your classes  |  { notes: n }  Mr. Hale's notes found  |  { daily: n }  daily classes finished
export const UNLOCKS = [
  { id: 'spit', type: 'prank', name: 'SPITBALL', how: 'Get a C or better on a report card.', what: 'A new prank: fast, quiet, and it sticks. He thinks the roof is leaking. Twice.', need: { grade: 'C' } },
  { id: 'band', type: 'prank', name: 'RUBBER BAND', how: 'Hit him with paper 3 times in one class.', what: 'A new prank: very fast, it stings, and it bounces off walls. Trick shots confuse him.', need: { stat: 'hitHim', n: 3 } },
  { id: 'bomb', type: 'prank', name: 'WATER BALLOON', how: 'Get an A on a report card.', what: 'A new prank: it soaks everything near it. He has to wipe his glasses. It wipes the board, too.', need: { grade: 'A' } },
  { id: 'psst', type: 'app', name: 'PSST!', how: 'Finish 3 classes (any grade).', what: 'A third app on your phone: pass the note while his back is turned. Switch apps with T / APP.', need: { total: 'classes', n: 3 } },
  { id: 'chalk', type: 'theme', name: 'CHALKBOARD', how: 'Stay until the bell without a single strike.', what: 'A phone theme: board green and chalk white.', need: { stat: 'survived', n: 1, no: 'strikes' } },
  { id: 'neon', type: 'theme', name: 'ARCADE', how: 'Watch 5 meme videos to the end (all classes count).', what: 'A phone theme: purple and neon.', need: { total: 'videos', n: 5 } },
  { id: 'hale', type: 'theme', name: 'MR. HALE\'S PHONE', how: 'Find 6 of Mr. Hale\'s notes.', what: 'A phone theme: old paper. It was his.', need: { notes: 6 } },
  { id: 'gold', type: 'theme', name: 'GOLD STAR', how: 'Finish a daily class.', what: 'A phone theme: black and gold.', need: { daily: 1 } },
];
// phone themes: the colours of the handset and its apps (src/phone.js, src/psst.js)
export const PHONE_THEMES = {
  classic: { name: 'CLASSIC', body: 0x0b0b0d, light: 0x9cc4ff, bar: '#000000', barText: '#d7dbe2', sky: ['#5ec2f2', '#c7ecff'], cloud: 'rgba(255,255,255,0.85)', ground: '#b07a43', groundDark: '#8f5f2f', groundTop: '#c98e52', ink: '#1d3557', text: '#ffffff', accent: '#ffe066', msgBg: '#0d1117', msgCard: '#1f2937', msgText: '#e5e7eb' },
  chalk: { name: 'CHALKBOARD', body: 0x1c2b22, light: 0xbfe6cf, bar: '#0f1a14', barText: '#dfe8d8', sky: ['#1f3a2c', '#2f5440'], cloud: 'rgba(232,230,218,0.35)', ground: '#6b4a2a', groundDark: '#4d3319', groundTop: '#8a623a', ink: '#12241a', text: '#f1efe2', accent: '#f6e58d', msgBg: '#14251b', msgCard: '#22402f', msgText: '#f1efe2' },
  neon: { name: 'ARCADE', body: 0x1a0b2e, light: 0xff6ad5, bar: '#12041f', barText: '#7afcff', sky: ['#2b0a4f', '#7b1fa2'], cloud: 'rgba(122,252,255,0.45)', ground: '#16213e', groundDark: '#0f3460', groundTop: '#e94560', ink: '#12041f', text: '#7afcff', accent: '#ff6ad5', msgBg: '#12041f', msgCard: '#2b0a4f', msgText: '#f5e9ff' },
  hale: { name: 'MR. HALE\'S PHONE', body: 0x3b3226, light: 0xffd9a0, bar: '#2b241a', barText: '#e8dcc0', sky: ['#d8c9a3', '#efe6cc'], cloud: 'rgba(255,255,255,0.55)', ground: '#7a5a3a', groundDark: '#5c4026', groundTop: '#94714a', ink: '#3a2a16', text: '#fff8e6', accent: '#b03a2e', msgBg: '#2b241a', msgCard: '#4a3d2b', msgText: '#f3ead2' },
  gold: { name: 'GOLD STAR', body: 0x8a6a12, light: 0xffe08a, bar: '#111111', barText: '#ffd54a', sky: ['#111111', '#3a2f0b'], cloud: 'rgba(255,213,74,0.4)', ground: '#2a2208', groundDark: '#1a1505', groundTop: '#ffd54a', ink: '#111111', text: '#ffd54a', accent: '#ffffff', msgBg: '#111111', msgCard: '#2a2208', msgText: '#ffe9a6' },
};

// ---------------- more things to throw (unlocked above). They join the PRANK tables when src/morepranks.js loads.
//   fold: seconds to make the next one   speed: [softest, hardest] throw   grav / drag: how it flies
//   expose: seconds your arm stays up after the throw   counts: how many hits on him it is worth (three: he knows)
export const PRANK_MORE = {
  spit: { name: 'SPITBALL', fold: 0.45, speed: [9, 16], grav: 1, drag: 0.5, expose: 0.25, counts: 1, refill: 'prank_crumple',
    laugh: { him: 14, kid: 16, friend: 12, player: 14, board: 6 }, mischief: { him: 18, kid: 10, friend: 8, player: 8, board: 4 }, anger: 3 },
  band: { name: 'RUBBER BAND', fold: 1.1, speed: [13, 22], grav: 0.6, drag: 1.1, expose: 1.0, counts: 1, refill: 'p6_stretch', bounce: 0.72, bounces: 4,
    laugh: { him: 44, kid: 24, friend: 18, player: 22, trick: 20 }, mischief: { him: 34, kid: 14, friend: 10, player: 10, trick: 25 }, anger: 8 },
  bomb: { name: 'WATER BALLOON', fold: 7, speed: [4.5, 9], grav: 1, drag: 0.02, expose: 0.9, counts: 2, refill: 'p6_fill', splash: 1.1,
    laugh: { him: 62, kid: 30, friend: 22, player: 26, board: 26, floor: 10 }, mischief: { him: 45, kid: 16, friend: 12, player: 12, board: 22, floor: 3 }, anger: 14, wipe: 6 },
};

// ---------------- Mr. Hale's 12 hidden notes (the notebook). find: what a player does in class to find it
//   { look: place, sec, when? }   look at a place that long (places and `when` checks: NOTE_PLACES / NOTE_WHEN in src/replay.js)
//   { stat: key, n }              one of that player's counters reaches n (src/stats.js)
//   { global: key, n }            a counter of the whole class reaches n (everybody in the class finds it)
//   { event: type, ...fields }    something that player did, from the class log (game.track.event): every field must match
//   { classEvent: type, ...}      the same, for things that happen to the whole class
//   { local: 'plane', n }         on your own phone: that score in PAPER PLANE
export const HALE_NOTES = [
  { n: 1, title: 'Monday', find: { look: 'closet', sec: 2 }, hint: 'There is a door at the back of the room, on the right. Was it always there?',
    text: 'Thirty years in Room 13 and I have never missed a day. I know every crack in these walls. There was never a supply closet at the back. This morning there is one. The door has no handle.' },
  { n: 2, title: 'Monday, later', find: { look: 'teacher', when: 'clap', sec: 1.2 }, hint: 'Watch him clap the chalk off his hands.',
    text: 'Something in the closet claps. Slowly. Like a man knocking chalk dust off his hands. I told the office. They said Room 13 has always had a closet.' },
  { n: 3, title: 'Tuesday', find: { look: 'poster', sec: 2 }, hint: 'Somebody is MISSING. Read the poster by the door.',
    text: 'A new name on the staff list: MADI. No first name, no subject. The office says he has "always been our substitute". Nobody can tell me what he looks like.' },
  { n: 4, title: 'Wednesday', find: { look: 'doorWindow', when: 'doorFace', sec: 0.4 }, hint: 'Sometimes there is a face in the door window. Look at it.',
    text: 'I stayed late to grade papers. A very tall man stood at the door window and watched me. For an hour. He did not blink once. I counted.' },
  { n: 5, title: 'Wednesday night', find: { stat: 'echoes', n: 3 }, hint: 'Repeat him three times in one class.',
    text: 'He spoke through the door. "What... is... a teacher?" I said: someone who knows the lesson. He wrote it down. Then he repeated it back to me. Wrong.' },
  { n: 6, title: 'Thursday', find: { local: 'plane', n: 5 }, hint: 'Score 5 in PAPER PLANE.',
    text: 'My lesson plan is gone from my desk. Page 47 is torn out of every book. He is studying my class. I think he wants it.' },
  { n: 7, title: 'Thursday, later', find: { event: 'question', q: 'name' }, hint: 'Ask him his first name.',
    text: 'He knows nothing by himself. He has to look everything up, and he hates it. Ask him something he cannot find, and he just... stops. Remember that.' },
  { n: 8, title: 'Thursday night', find: { event: 'hit', target: 'teacher', part: 'head' }, alt: { event: 'glasses' }, hint: 'Knock his glasses off. Or take them from his desk.',
    text: 'My spare glasses are missing from the drawer. I think he believes the glasses are what make a teacher. Without them, I don\'t think he can see a class at all.' },
  { n: 9, title: 'Friday', find: { look: 'kevin', sec: 2.5 }, hint: 'Kevin\'s desk is empty. Look at it for a while.',
    text: 'Kevin stayed after class to ask about his grade. I went to the office for five minutes. When I came back, the closet door was shut and Kevin\'s desk was empty.' },
  { n: 10, title: 'Friday, later', find: { global: 'memes', n: 2 }, hint: 'Sit still and let the class clowns get in trouble. Twice.',
    text: 'He keeps the quiet ones. The loud ones confuse him. So be loud. Be trouble. Be the worst class I ever had. Just don\'t let him catch you.' },
  { n: 11, title: 'Friday night', find: { event: 'text', from: 'Mr. Hale' }, hint: 'Read a text from Mr. Hale on your phone.',
    text: 'I went in after Kevin. I am writing this in the dark. The closet is bigger inside: rows of desks, a board with nothing on it. Everyone here sits very, very still.' },
  { n: 12, title: 'To my class', find: { classEvent: 'objective', id: 'bell' }, hint: 'Stay until the bell.',
    text: 'If you find this: at the last bell, ask him what he is. When he is gone, knock on the closet three times, like chalk dust off your hands. Then I will know it is you. <i>R. Hale</i>' },
];

// ---------------- the two secret endings (src/secrets.js)
export const SECRETS = {
  closet: { x: 4.975, z: 4.8, w: 0.9, h: 2.0 },   // the supply closet door on the right wall, at the back (it has no handle)
  knock: { wait: 5, window: 12, need: 3 },          // after he is gone: the quiet seconds, how long you get once you look at the closet, the knocks it takes
  glasses: { breakAt: 3 },                          // paper on his head this many times in one Free Class: his glasses break
};

// ---------------- the daily class: the same class for everyone that day, built from one number (the class seed)
export const DAILY = {
  mode: 'free',                // online play is Free Class, so the daily class is one too
  hardChance: 0.35,            // about one day in three is a Hard day
  // today's special (picked by the seed): these counters are worth double in the daily score
  specials: [
    { id: 'paper', name: 'PAPER DAY', text: 'everything you throw counts double', keys: ['throws', 'hits', 'hitHim', 'glassesOff', 'soaked', 'trickShots'] },
    { id: 'parrot', name: 'PARROT DAY', text: 'repeating him counts double', keys: ['echoes'] },
    { id: 'question', name: 'QUESTION DAY', text: 'dumb questions count double', keys: ['questions'] },
    { id: 'movie', name: 'MOVIE DAY', text: 'videos count double', keys: ['videos', 'shown'] },
    { id: 'gossip', name: 'GOSSIP DAY', text: 'whispering counts double', keys: ['whispers'] },
    { id: 'nerves', name: 'NERVES DAY', text: 'close calls count double', keys: ['closeCalls'] },
  ],
  // the daily score: points for each one of a counter (the same counters as the report card; unknown ones are worth nothing)
  score: [['whispers', 12], ['echoes', 30], ['questions', 25], ['videos', 25], ['shown', 15], ['throws', 2], ['hits', 10], ['hitHim', 35],
    ['glassesOff', 20], ['soaked', 25], ['trickShots', 20], ['closeCalls', 25], ['objectives', 30], ['notesFound', 20], ['caught', -100], ['survived', 250]],
  hardBonus: 1.25,             // a Hard day is worth a quarter more
  keep: 40,                    // days of best scores kept in the browser
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

// ---- his stomach pat: a funny habit while he thinks at the board (src/game.js bellyPat, src/teacher.js pose 'belly'). It changes nothing else.
export const BELLY = {
  afterWrite: 0.25,       // chance that he does it right after writing a line
  turn: 0.72,             // how far he turns from the board so the class sees his hand (x PI; 1 = his back to the class)
  pats: [4, 8],           // pats in one burst
  every: [0.2, 0.26],     // seconds between two pats: soft, but quick
  pause: [0.45, 0.9],     // seconds between two bursts
  vol: [0.2, 0.3], rate: [1.15, 1.4], // the sound (bl_paw, quiet and a little higher)
};
