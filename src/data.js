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
export const MEME_IDLE = 30;  // seconds of you doing nothing
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
