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
export const PRANK_NAMES = { ball: 'PAPER BALL', plane: 'PAPER PLANE' };

// Playing online: how patient joining is, what the lobby says, and what you hear there
// (src/net.js, src/lobby.js, the lobby in src/main.js). Times are in milliseconds.
export const ONLINE = {
  turnUrl: 'api/turn',       // your own relay servers, if set up (api/turn.js on Vercel; see the README)
  turnTimeout: 3000,         // wait this long for them, then go on with the built-in ones
  turnCache: 30 * 60000,     // reuse the answer this long (its credentials last a day)
  joinFor: 60000,            // a friend keeps trying to connect this long (time with the game on screen)
  tryFor: 15000,             // one try waits this long for the host to answer
  retryGap: 1500,            // pause between tries
  missingFor: 10000,         // "no class with that code" only after this long: the host may be coming back
  serverFor: 20000,          // the game server can't be reached at all: give up after this long
  openFor: 15000,            // one try to reach the game server
  hostTrying: 30000,         // host: a friend's connection that isn't open after this long has failed
  refreshAfter: 10000,       // host back after this long in another app: renew the link to the game server
  awayLine: 4000,            // host back in the lobby after this long away: Mr. Madi tells you to stay
  text: {
    server: 'Reaching the game server…',
    connect: 'Connecting to the class…',
    retry: 'Connecting to the class… try {n}',
    missing: 'Looking for class {code}… try {n}',
    noClass: 'No class with that code.\nCheck the code. The host must keep the game open on the screen.',
    blocked: 'Could not connect to the host.\n1. The host keeps the game open on the screen.\n2. Press JOIN again.\n3. Still not working? One of you uses mobile data instead of Wi-Fi.',
    noServer: 'Could not reach the game server. Check your internet, then press JOIN again.',
    noHostServer: 'Could not reach the game server. Check your internet, then try again.',
    stopped: 'Stopped. Press JOIN to try again.',
    inClass: 'You are in. Wait for the host to start the class.',
    lost: 'Lost the connection to the host. Press JOIN to go back in.',
    hostOpen: 'Send the code to your friends. Keep the game open until they are in.',
    keep: 'Keep the game open on your screen while friends join. If you switch to another app, they can\'t get in. SHARE sends the code without leaving the game.',
    shareTitle: 'MADI CLASS',
    shareText: 'Come to my class in MADI CLASS. Code: {code}',
    shared: 'Sent! Stay here until your friends are in.',
    copied: 'Invite link copied. Paste it to your friends, then come right back.',
    copyFailed: 'Send your friends this link: {url}',
    trying: 'Someone is connecting…',
    joined: '{name} is in.',
    left: '{name} left.',
    failed: 'Someone tried to join but could not connect. Ask them to press JOIN again.',
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
