#!/usr/bin/env python3
"""Generate every spoken line in the game.

Requires: espeak-ng, mbrola voices (mbrola-us1/us2/us3), ffmpeg (with rubberband), numpy.
    sudo apt-get install espeak-ng mbrola mbrola-us1 mbrola-us2 mbrola-us3 ffmpeg
    python3 tools/gen_voices.py

The teacher speaks with a slowed-down, pitched-down MBROLA voice layered with a
sub-octave copy. Friends whisper: their MBROLA speech is "whisperised" by
keeping only the spectral envelope (cepstral smoothing) and re-exciting it with
noise, which keeps the words intelligible but removes the voiced pitch.
Writes assets/audio/voice/*.mp3 and assets/audio/voices.json (id -> text, duration).
"""
import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio", "voice")
os.makedirs(OUT, exist_ok=True)
TMP = tempfile.mkdtemp(prefix="voices_")
SR = 44100

# Segments separated by "|" get a silent gap between them (dramatic pauses).
TEACHER = {
    "t_iam": "I am | your | teacher.",
    "t_name": "My name | is | Mister | Madi.",
    "t_roll": "Roll | call.",
    "t_r_sam": "Sam.",
    "t_r_nora": "Nora.",
    "t_r_kevin": "Kevin.",
    "t_r_kevin2": "Kevin?",
    "t_absent": "Kevin | is | absent.",
    "t_andyou": "And | you.",
    "t_good1": "Good.",
    "t_answerme": "Answer | me.",
    "t_whosaid": "Who | said that?",
    "t_iknow": "I know | it was you.",
    "t_itwasyou": "It was | you.",
    "t_notfunny": "That | is not | funny.",
    "t_givephone": "Give | me | that | phone.",
    "t_sofunny": "What | is | so | funny?",
    "t_nophones": "No | phones | in | my | class.",
    "t_hmm": "Hmmmmm.",
    "t_wasityou": "Was it | you?",
    "t_ifind": "I | will | find you.",
    "t_whothrew": "Who | threw | that.",
    "t_isaw": "I | saw | that.",
    "t_myglasses": "My | glasses.",
    "t_paper": "Paper | is for | writing.",
    "t_funny": "Is something | funny?",
    "t_moment": "One | moment.",
    "t_noquestions": "No more | questions.",
    "t_toomany": "You ask | too many | questions.",
    "t_cantsee": "I | cannot | see.",
    "a_wet": "Water | is | dry.",
    "a_five": "Five.",
    "a_france": "The capital of France | is | F.",
    "a_fish": "Fish | do not | exist.",
    "a_sky": "The sky | is | gone.",
    "a_spell": "T | E | A | no.",
    "a_name": "Mister.",
    "a_test": "Everything | is on the test.",
    "a_day": "It is | always | Monday.",
    "a_glasses": "They are | mine | now.",
    "a_lunch": "I | already | ate.",
    "q_pop": "Pop | quiz.",
    "q_you": "You.",
    "q_name": "What | is my name?",
    "q_count": "How many students | are in | this class?",
    "q_two": "What is | two plus two?",
    "q_correct": "Correct.",
    "q_wrong": "Wrong.",
    "q_again": "Count | again.",
    "q_hale": "He is | not here.",
    "t_detention": "Detention.",
    "t_sitdown": "Sit | down.",
    "f_teacher1": "I am | a teacher.",
    "f_teacher2": "Am I | a teacher?",
    "f_teacher3": "What | am I?",
    "f_hale": "Mister Hale | is | in",
    "t_morning": "Good | morning | class.",
    "t_today": "Today | we will learn about | about",
    "t_page": "Open your books | to page | forty | seven.",
    "t_answer": "The answer is | is | is",
    "t_who": "Who | is talking?",
    "t_quiet": "Quiet.",
    "t_eyes": "Eyes | on the board.",
    "t_hear": "I can | hear you.",
    "t_see": "I see you.",
    "t_still": "Sit | still.",
    "t_attention": "You are not | paying attention.",
    "t_continue": "Let us | continue.",
    "t_math": "Two plus two | is | five.",
    "t_forgot": "I | forgot.",
    "t_last": "This is your | last | warning.",
    "t_dismissed": "Class | dismissed.",
    "t_stay": "You | will stay | after class.",
    "t_good": "Such a | good | student.",
    "t_notover": "Class | is not | over.",
    "t_phone": "Put it | away.",
    "t_mito": "The mitochondria | is the | the",
    "t_water": "Water boils at | | I do not know.",
    "t_silence": "Today's lesson | is | silence.",
    "t_writedown": "Write this | down.",
    "t_history": "In ten sixty six | nothing | happened.",
    "t_question": "Any | questions?",
    "t_nobody": "No one | leaves.",
    "t_laugh": "heh | heh | heh",
    "t_where": "Where | is your friend?",
    "t_hmm": "hmmmmmm",
    "t_wrong": "No. | No. | That is wrong.",
    "t_whodid": "Who | did | that?",
    "t_wasityou": "Was it | you?",
    "t_wakeup": "Wake | up.",
    "t_smell": "What | is | that | smell?",
    "t_back": "Back | to | work.",
    "t_veryfunny": "Very | funny.",
    "t_bruh": "Bruh.",
    "t_sus": "I am | not | suspicious.",
    "t_67": "Six. | | Seven.",
    "t_rizz": "I | have | riz.",
    "t_skill": "You | have | a skill | issue.",
    "t_goat": "We do not | have | a goat.",
    "t_yeet": "Do not | yeet.",
    "t_thanks": "Thank | you.",
    "t_rule": "In my class | nobody | talks.",
    "t_window": "Do not | look | at the window.",
    "t_books": "Open | your | books.",
    "t_everyone": "Now | everyone | is | here.",
    "t_pencils": "Pencils | down.",
    "t_quietfav": "Quiet | students | are my | favorite.",
    "t_nolunch": "There is | no | lunch.",
    "t_onehour": "One | more | hour.",
    "t_important": "This | is | very | important.",
    "t_hale": "Mister Hale | is | resting.",
    "t_nohale": "There is | no | Mister Hale.",
    "t_readnote": "He is not | a real | teacher.",
    "t_dark": "Do not | be afraid | of the dark.",
    "t_dontleave": "Do not | leave | my class.",
    "t_nocome": "Nobody | is | coming.",
    "t_ph_hello": "Hello?",
    "t_ph_mother": "Yes | Mother.",
    "t_ph_teaching": "I am | teaching.",
    "t_ph_bye": "Bye | bye.",
    "t_ph_wrong": "Wrong | number.",
    "t_ph_never": "That | never | happened.",
    "t_ph_nobody": "Nobody | called.",
    "t_fly": "A | fly.",
    "t_fly_still": "Hold | still.",
    "t_fly_got": "Got | you.",
    "t_fly_hate": "I hate | flies.",
    "t_pz_order": "I did not | order | pizza.",
    "t_pz_mine": "Mine.",
    "t_pz_noeat": "No | eating | in class.",
    "t_fd_seats": "Stay | in your | seats.",
    "t_fd_notreal": "It is not | a real | fire.",
    "t_lv_dontmove": "Do not | move.",
    "t_lv_back": "I | am | back.",
    "t_lv_whomoved": "Who | moved?",
    "t_qd_what": "What?",
    "t_qd_speak": "Speak | up.",
    "t_ql_who": "Who | laughed?",
    "t_ql_no": "No | laughing.",
    "t_qz_awake": "I was | not | sleeping.",
    "t_qc_tick": "Tick | tock.",
    "t_qc_notyet": "Not | yet.",
    "t_qn_toomany": "One | too | many.",
    "t_n1": "One.",
    "t_n2": "Two.",
    "t_n3": "Three.",
    "t_n4": "Four.",
    "t_n5": "Five.",
    "t_n6": "Six.",
    "t_n7": "Seven.",
    "t_n8": "Eight.",
    "t_n9": "Nine.",
    "t_n10": "Ten.",
    "t_n11": "Eleven.",
    "t_n12": "Twelve.",
    "t_n13": "Thirteen.",
    "t_n14": "Fourteen.",
    "t_n15": "Fifteen.",
    "t_sl_bruh": "Open your books | bruh.",
    "t_sl_sus": "Two plus two | is | sus.",
    "t_sl_67": "Open your books | to page | six | seven.",
    "t_sl_rizz": "The mitochondria | has | riz.",
    "t_sl_skill": "Mister Hale | had | a skill issue.",
    "t_sl_sheesh": "Sheesh. | Detention.",
    "t_sl_yeet": "Please | yeet | your homework.",
    "t_sl_goat": "I am | the goat.",
    "t_sl_oof": "Oof. | Pop quiz.",
    "t_sl_huh": "Huh? | Huh.",
    "t_sl_mock": "Is this | how you | talk?",
    "t_sl_phonk": "This | is | fonk.",
}
SUBS = {
    "t_iam": "I am... your... teacher.",
    "t_name": "My name... is... Mister... Madi.",
    "t_roll": "Roll... call.",
    "t_r_sam": "Sam.",
    "t_r_nora": "Nora.",
    "t_r_kevin": "Kevin.",
    "t_r_kevin2": "Kevin?",
    "t_absent": "Kevin... is... absent.",
    "t_andyou": "And... you.",
    "t_good1": "Good.",
    "t_answerme": "Answer... me.",
    "t_whosaid": "Who... said that?",
    "t_iknow": "I know... it was you.",
    "t_itwasyou": "It was... you.",
    "t_notfunny": "That... is not... funny.",
    "t_givephone": "Give... me... that... phone.",
    "t_sofunny": "What... is... so... funny?",
    "t_nophones": "No... phones... in... my... class.",
    "t_hmm": "Hmmm...",
    "t_wasityou": "Was it... you?",
    "t_ifind": "I... will... find you.",
    "t_whothrew": "Who... threw... that.",
    "t_isaw": "I... saw... that.",
    "t_myglasses": "My... glasses.",
    "t_paper": "Paper... is for... writing.",
    "t_funny": "Is something... funny?",
    "t_moment": "One... moment.",
    "t_noquestions": "No more... questions.",
    "t_toomany": "You ask... too many... questions.",
    "t_cantsee": "I... cannot... see.",
    "a_wet": "Water... is... dry.",
    "a_five": "Five.",
    "a_france": "The capital of France... is... F.",
    "a_fish": "Fish... do not... exist.",
    "a_sky": "The sky... is... gone.",
    "a_spell": "T... E... A... no.",
    "a_name": "Mister.",
    "a_test": "Everything... is on the test.",
    "a_day": "It is... always... Monday.",
    "a_glasses": "They are... mine... now.",
    "a_lunch": "I... already... ate.",
    "q_pop": "Pop... quiz.",
    "q_you": "You.",
    "q_name": "What... is my name?",
    "q_count": "How many students... are in... this class?",
    "q_two": "What is... two plus two?",
    "q_correct": "Correct.",
    "q_wrong": "Wrong.",
    "q_again": "Count... again.",
    "q_hale": "He is... not here.",
    "t_detention": "Detention.",
    "t_sitdown": "Sit... down.",
    "f_teacher1": "I am... a teacher.",
    "f_teacher2": "Am I... a teacher?",
    "f_teacher3": "What... am I?",
    "f_hale": "Mister Hale... is... in",
    "t_morning": "Good... morning... class.",
    "t_today": "Today... we will learn about... about...",
    "t_page": "Open your books... to page... forty... seven.",
    "t_answer": "The answer is... is... is...",
    "t_who": "Who... is talking?",
    "t_quiet": "Quiet.",
    "t_eyes": "Eyes... on the board.",
    "t_hear": "I can... hear you.",
    "t_see": "I see you.",
    "t_still": "Sit... still.",
    "t_attention": "You are not... paying attention.",
    "t_continue": "Let us... continue.",
    "t_math": "Two plus two... is... five.",
    "t_forgot": "I... forgot.",
    "t_last": "This is your... last... warning.",
    "t_dismissed": "Class... dismissed.",
    "t_stay": "You... will stay... after class.",
    "t_good": "Such a... good... student.",
    "t_notover": "Class... is not... over.",
    "t_phone": "Put it... away.",
    "t_mito": "The mitochondria... is the... the...",
    "t_water": "Water boils at... ... I do not know.",
    "t_silence": "Today's lesson... is... silence.",
    "t_writedown": "Write this... down.",
    "t_history": "In ten sixty-six... nothing... happened.",
    "t_question": "Any... questions?",
    "t_nobody": "No one... leaves.",
    "t_laugh": "Heh... heh... heh...",
    "t_where": "Where... is your friend?",
    "t_hmm": "Hmmmmm...",
    "t_wrong": "No. No. That is wrong.",
    "t_whodid": "Who... did... that?",
    "t_wasityou": "Was it... you?",
    "t_wakeup": "Wake... up.",
    "t_smell": "What... is... that... smell?",
    "t_back": "Back... to... work.",
    "t_veryfunny": "Very... funny.",
    "t_bruh": "Bruh.",
    "t_sus": "I am... not... suspicious.",
    "t_67": "Six... ... seven.",
    "t_rizz": "I... have... rizz.",
    "t_skill": "You... have... a skill... issue.",
    "t_goat": "We do not... have... a goat.",
    "t_yeet": "Do not... yeet.",
    "t_thanks": "Thank... you.",
    "t_rule": "In my class... nobody... talks.",
    "t_window": "Do not... look... at the window.",
    "t_books": "Open... your... books.",
    "t_everyone": "Now... everyone... is... here.",
    "t_pencils": "Pencils... down.",
    "t_quietfav": "Quiet... students... are my... favorite.",
    "t_nolunch": "There is... no... lunch.",
    "t_onehour": "One... more... hour.",
    "t_important": "This... is... very... important.",
    "t_hale": "Mister Hale... is... resting.",
    "t_nohale": "There is... no... Mister Hale.",
    "t_readnote": "\u201cHe is not... a real... teacher.\u201d",
    "t_dark": "Do not... be afraid... of the dark.",
    "t_dontleave": "Do not... leave... my class.",
    "t_nocome": "Nobody... is... coming.",
    "t_ph_hello": "Hello?",
    "t_ph_mother": "Yes... Mother.",
    "t_ph_teaching": "I am... teaching.",
    "t_ph_bye": "Bye... bye.",
    "t_ph_wrong": "Wrong... number.",
    "t_ph_never": "That... never... happened.",
    "t_ph_nobody": "Nobody... called.",
    "t_fly": "A... fly.",
    "t_fly_still": "Hold... still.",
    "t_fly_got": "Got... you.",
    "t_fly_hate": "I hate... flies.",
    "t_pz_order": "I did not... order... pizza.",
    "t_pz_mine": "Mine.",
    "t_pz_noeat": "No... eating... in class.",
    "t_fd_seats": "Stay... in your... seats.",
    "t_fd_notreal": "It is not... a real... fire.",
    "t_lv_dontmove": "Do not... move.",
    "t_lv_back": "I... am... back.",
    "t_lv_whomoved": "Who... moved?",
    "t_qd_what": "What?",
    "t_qd_speak": "Speak... up.",
    "t_ql_who": "Who... laughed?",
    "t_ql_no": "No... laughing.",
    "t_qz_awake": "I was... not... sleeping.",
    "t_qc_tick": "Tick... tock.",
    "t_qc_notyet": "Not... yet.",
    "t_qn_toomany": "One... too... many.",
    "t_n1": "One.",
    "t_n2": "Two.",
    "t_n3": "Three.",
    "t_n4": "Four.",
    "t_n5": "Five.",
    "t_n6": "Six.",
    "t_n7": "Seven.",
    "t_n8": "Eight.",
    "t_n9": "Nine.",
    "t_n10": "Ten.",
    "t_n11": "Eleven.",
    "t_n12": "Twelve.",
    "t_n13": "Thirteen.",
    "t_n14": "Fourteen.",
    "t_n15": "Fifteen.",
    "t_sl_bruh": "Open your books... bruh.",
    "t_sl_sus": "Two plus two... is... sus.",
    "t_sl_67": "Open your books... to page... six... seven.",
    "t_sl_rizz": "The mitochondria... has... rizz.",
    "t_sl_skill": "Mister Hale... had... a skill issue.",
    "t_sl_sheesh": "Sheesh... Detention.",
    "t_sl_yeet": "Please... yeet... your homework.",
    "t_sl_goat": "I am... the goat.",
    "t_sl_oof": "Oof... Pop quiz.",
    "t_sl_huh": "Huh?... Huh.",
    "t_sl_mock": "Is this... how you... talk?",
    "t_sl_phonk": "This... is... phonk.",
}
TEACHER_WHISPER = {
    "tw_turn": ("Turn | around.", "Turn... around."),
    "tw_behind": ("I am | behind you.", "I am... behind you."),
    "tw_here": ("Right | here.", "Right... here."),
    "tw_shh": ("shhhhhhhhh", "Shhhhhh..."),
}
SAM = {
    "s_late": "Mr. Hale is never late.",
    "s_sub": "Who is that? That's not Mr. Hale.",
    "s_dare": "I dare you. Repeat what he says.",
    "s_didit": "No way. You actually did it!",
    "s_lookdown": "Look down! Don't look at him!",
    "s_projector": "Bro. The projector is on. He doesn't know!",
    "s_plan": "At the bell, we run. Okay?",
    "s_now": "Now! Ask him now!",
    "s_five": "Just say five. He thinks it's five.",
    "s_glasses": "Those are Mr. Hale's glasses.",
    "s_laugh": "heh heh heh heh heh",
    "s_kevin": "Kevin never came back.",
    "s_psst": "Psst. Hey.",
    "s_psst2": "Psst! Hey, over here!",
    "s_face": "Bro, why is his face like that?",
    "s_arms": "Did you see his arms? They go past his knees.",
    "s_board": "He's been staring at the board for like, five minutes.",
    "s_math": "I don't think he knows any math.",
    "s_blink": "Dude. He doesn't blink. Ever.",
    "s_real": "Where is our real teacher?",
    "s_game": "Did you beat level three yet?",
    "s_after": "We're getting out of here after class. Right?",
    "s_scared": "I'm not scared. You're scared.",
    "s_sorry": "Sorry, sorry. I'll be quiet.",
    "s_warn": "Stop! He's looking at you!",
    "s_name": "Mister Madi? What kind of name is that?",
    "s_books": "We don't even have books.",
    "s_meme": "Bro. Who was that?",
    "s_meme2": "Oh no. He heard that.",
    "s_dead": "They are so dead.",
    "s_laughing": "Don't make me laugh. I'm gonna laugh.",
    "s_study": "I didn't study. Did you study?",
    "s_hungry": "I'm so hungry. When is lunch?",
    "s_ready": "Get ready. When the bell rings, we go.",
    "s_close": "That was close.",
    "s_note": "Pass this to Nora. Quick, while he's writing.",
    "s_chair": "Kevin's chair... it just moved.",
    "s_dark": "I can't see anything.",
    "s_noted": "Bro. He read it out loud.",
    "s_look": "Psst! Look! Look at this!",
    "s_lookagain": "No, look! You're missing it!",
    "s_sent": "Check your phone. I sent you something.",
    "s_told": "Told you. Best video ever.",
    "s_throw": "Throw a paper ball at his back. I dare you.",
    "s_hit": "Bro! Right in the back!",
    "s_ow": "Ow! Hey!",
    "s_ring": "Is that his ringtone? No way.",
    "s_fly": "He's gonna slap a desk. Watch.",
    "s_flyhit": "You got the fly! Legend!",
    "s_pizza": "Is he eating pizza? In class?",
    "s_alarm": "Is it a real fire?",
    "s_gone": "He's gone! Go, go, go!",
    "s_slang": "Bro. He's using our words.",
    "s_board2": "He wrote it on the board. He actually wrote it.",
    "s_dance": "He's dancing. He's actually dancing.",
    "s_asleep": "Is he asleep? He's asleep.",
    "s_count": "Why does he keep counting us?",
    "s_clock": "Why does he keep looking at the clock?",
}
NORA = {
    "n_free": "Maybe we get a free period.",
    "n_ask": "Ask him something. He never knows the answer.",
    "n_laptop": "See? He has to look everything up.",
    "n_blind": "He can't see without those glasses.",
    "n_missing": "Look at the screen. That's Mr. Hale!",
    "n_plan": "When he doesn't know, he has to check. That's how we get out.",
    "n_impossible": "Ask him something he can't look up.",
    "n_behind": "He's right behind you. Don't move.",
    "n_now": "Ask him! Now!",
    "n_count": "Count the empty chairs.",
    "n_laugh": "hee hee hee hee hee",
    "n_psst": "Psst. Over here.",
    "n_psst2": "Hey! Psst! Look at me!",
    "n_look": "Don't look at him. Don't look at him.",
    "n_writing": "What is he even writing?",
    "n_phone": "My phone keeps buzzing. Unknown number.",
    "n_quiet": "I heard he keeps the quiet ones after class.",
    "n_chalk": "When the chalk stops, we stop talking. Okay?",
    "n_head": "Did his head just turn all the way around?",
    "n_clock": "The clock. It's going backwards.",
    "n_notes": "I wrote you a note. Read it.",
    "n_hands": "Why does he keep clapping like that?",
    "n_sorry": "Okay, okay. Shh.",
    "n_warn": "He's coming. Stop talking!",
    "n_door": "There's someone at the door.",
    "n_name": "Madi. I've never heard of him.",
    "n_meme": "Don't laugh. Don't laugh.",
    "n_going": "He's going to the back...",
    "n_room13": "Room thirteen. That's our room.",
    "n_eyes": "Look at the back row. Their eyes are black.",
    "n_storm": "The storm is getting worse.",
    "n_hale_msg": "Mister Hale texted you? He's alive!",
    "n_almost": "Almost there. Just a little longer.",
    "n_quietone": "Don't be too quiet. He likes the quiet ones.",
    "n_poor": "Poor kid.",
    "n_pa": "Mister Hale is in the office?",
    "n_gotnote": "Got it.",
    "n_closed": "Nobody in the building? Then who is teaching us?",
    "n_dark": "Don't make a sound.",
    "n_look": "Psst! You have to see this!",
    "n_lookagain": "Look! This is the best part!",
    "n_told": "I can't breathe.",
    "n_hit": "Oh my god. You actually hit him.",
    "n_ow": "Ow! Seriously?",
    "n_ring": "Who would even call him?",
    "n_fly": "It's just a fly. Why is he so angry?",
    "n_pizza": "Who orders pizza to room thirteen?",
    "n_alarm": "He can't hear anything. Talk now!",
    "n_back": "He's coming back! Sit down!",
    "n_slang": "Stop teaching him words!",
    "n_dance": "I can't watch this.",
    "n_asleep": "Shh. Don't wake him up.",
    "n_deafL": "He can't hear with his left ear.",
    "n_deafR": "He can't hear with his right ear.",
    "n_hum": "When he stops humming, he's listening.",
    "n_window": "He's watching us through the door!",
}
# The school PA speaker: (text, subtitle)
PA = {
    "pa_hale": ("Attention, please. Mister Hale, please report to the main office. | Mister Hale, to the main office.",
                "Attention, please. Mister Hale, please report to the main office. Mister Hale, to the main office."),
    "pa_closed": ("Attention, students. | The school is closed today. | There is nobody in the building.",
                  "Attention, students. The school is closed today. There is nobody in the building."),
}
# Somebody in the dark hallway, behind the classroom door (muffled): (voice, speed, pitch, rubberband pitch, text, subtitle)
HALL = {
    "dl_pizza": ("mb-us2", 150, 45, 1.0, "Pizza | for room thirteen?", "Pizza... for Room 13?"),
    "dl_hale": ("mb-us2", 140, 40, 1.0, "It says | Mister Hale. | Paid on Friday.", "It says... Mister Hale. Paid on Friday."),
}
# Lines spoken aloud: (voice, speed, espeak pitch, rubberband pitch, who, text)
ALOUD = {
    "s_here": ("mb-us3", 150, 50, 0.97, "sam", "Here."),
    "n_here": ("mb-us1", 155, 55, 1.0, "nora", "Here."),
    "k_seven": ("mb-us1", 150, 60, 1.14, "kid", "Um. Seven?"),
    "p_here": ("mb-us3", 150, 55, 1.17, "you", "Here."),
    "p_look": ("mb-us3", 165, 60, 1.17, "you", "Bro! Look at this!"),
    "p_q_wet": ("mb-us3", 150, 55, 1.17, "you", "Sir? Is water wet?"),
    "p_q_two": ("mb-us3", 150, 55, 1.17, "you", "Sir? What is two plus two?"),
    "p_q_bath": ("mb-us3", 150, 55, 1.17, "you", "Sir? Can I go to the bathroom?"),
    "p_q_france": ("mb-us3", 150, 55, 1.17, "you", "Sir? What is the capital of France?"),
    "p_q_fish": ("mb-us3", 150, 55, 1.17, "you", "Sir? Do fish get thirsty?"),
    "p_q_sky": ("mb-us3", 150, 55, 1.17, "you", "Sir? Why is the sky blue?"),
    "p_q_spell": ("mb-us3", 150, 55, 1.17, "you", "Sir? How do you spell teacher?"),
    "p_q_name": ("mb-us3", 150, 55, 1.17, "you", "Sir? What is your first name?"),
    "p_q_test": ("mb-us3", 150, 55, 1.17, "you", "Sir? Is this on the test?"),
    "p_q_day": ("mb-us3", 150, 55, 1.17, "you", "Sir? What day is it?"),
    "p_q_glasses": ("mb-us3", 150, 55, 1.17, "you", "Sir? Are those Mister Hale's glasses?"),
    "p_q_lunch": ("mb-us3", 150, 55, 1.17, "you", "Sir? When is lunch?"),
    "p_q_pizza": ("mb-us3", 150, 55, 1.17, "you", "Sir? Can I have some pizza?"),
    "p_q_call": ("mb-us3", 150, 55, 1.17, "you", "Sir? Who was on the phone?"),
    "p_f_teacher": ("mb-us3", 140, 55, 1.17, "you", "Are you really a teacher?"),
    "p_f_hale": ("mb-us3", 140, 55, 1.17, "you", "Where is Mister Hale?"),
    "p_f_two": ("mb-us3", 140, 55, 1.17, "you", "What is two plus two?"),
    "p_a_madi": ("mb-us3", 150, 55, 1.17, "you", "Mister Madi."),
    "p_a_hale": ("mb-us3", 150, 55, 1.17, "you", "Mister Hale."),
    "p_a_dunno": ("mb-us3", 150, 55, 1.17, "you", "I don't know."),
    "p_a_five": ("mb-us3", 150, 55, 1.17, "you", "Five."),
    "p_a_four": ("mb-us3", 150, 55, 1.17, "you", "Four."),
    "p_a_fish": ("mb-us3", 150, 55, 1.17, "you", "Fish."),
}

# Background classmates goofing off with meme noises (each voiced by a boy and a girl).
# (text for espeak, subtitle, extra ffmpeg filter)
MEMES = {
    "m_bruh": ("Bruh.", "Bruh.", ""),
    "m_sus": ("Sus.", "Sus.", ""),
    "m_67": ("Six, seven!", "SIX SEVEN!", ""),
    "m_rizz": ("Mister Madi has no riz.", "Mister Madi has no rizz.", ""),
    "m_oof": ("Oof.", "Oof.", ""),
    "m_sheesh": ("[[S'i:::::::::S]]", "Sheeeeesh!", ""),
    "m_huh": ("Huh?", "Huh?", ""),
    "m_yeet": ("Yeet!", "YEET!", ""),
    "m_goat": ("[[m'E:::::::::]]", "Meeeeeh!", ""),
    "m_skill": ("Skill issue.", "Skill issue.", ""),
    "k_notme": ("It wasn't me!", "It wasn't me!", ""),
    "k_awake": ("Huh? I'm awake! I'm awake!", "Huh?! I'm awake! I'm awake!", ""),
    "k_sorry": ("Sorry, sir.", "Sorry, sir.", ""),
    "k_ow": ("Ow! Hey!", "Ow! Hey!", ""),
    "k_takethat": ("Take that!", "Take that!", ""),
}
KID_VOICES = {"b": ("mb-us3", 165, 62, 1.22), "g": ("mb-us1", 165, 70, 1.12)}

SHOUTS = {
    "s_hey": ("mb-us3", 175, 70, "Hey! Are you even listening?"),
    "n_hey": ("mb-us1", 175, 75, "Hey! Answer me!"),
}

# Voices inside the meme clips on the phones: (espeak voice, speed, pitch, rubberband pitch, text)
CLIPV = {
    "v_br_pencil": ("it", 125, 30, 0.86, "Matitino Gommarino!"),
    "v_br_shark": ("it", 125, 30, 0.86, "Squalino Zainetto!"),
    "v_br_banana": ("it", 125, 30, 0.86, "Bananito Calcolatrice!"),
    "v_br_chalk": ("it", 118, 25, 0.82, "Gessetto Polverone!"),
    "v_br_frog": ("it", 125, 35, 0.86, "Ranocchio Monociclo!"),
    "v_tts_beat": ("mb-us1", 185, 60, 1.05, "When the beat drops in class."),
    "v_tts_wait": ("mb-us1", 185, 60, 1.05, "Wait for it."),
    "v_tts_pov": ("mb-us1", 185, 60, 1.05, "P O V. The sub does not know the lesson."),
    "v_tts_nobody": ("mb-us1", 185, 60, 1.05, "Nobody. | Absolutely nobody."),
    "v_tts_aura": ("mb-us1", 185, 60, 1.05, "Plus one thousand aura."),
    "v_tts_cat": ("mb-us1", 185, 60, 1.05, "This cat has more riz than me."),
    "v_tts_weather": ("mb-us1", 185, 60, 1.05, "The weather in my town be like."),
    "v_tts_mewing": ("mb-us1", 185, 60, 1.05, "Shh. I'm mewing."),
    "v_tts_bell": ("mb-us1", 185, 60, 1.05, "Me waiting for the bell."),
    "v_umactually": ("mb-us3", 170, 72, 1.28, "Um, actually."),
    "v_ohno": ("mb-us3", 160, 60, 1.1, "Oh no."),
    "v_wow": ("mb-us2", 115, 40, 0.92, "Wow."),
    "v_letsgo": ("mb-us3", 175, 65, 1.15, "Let's go!"),
}


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(" ".join(cmd), r.stderr[-800:], file=sys.stderr)
        raise SystemExit(1)


def read_wav(path):
    with wave.open(path) as w:
        sr = w.getframerate()
        n = w.getnframes()
        data = np.frombuffer(w.readframes(n), dtype=np.int16).astype(np.float32) / 32768.0
        if w.getnchannels() == 2:
            data = data.reshape(-1, 2).mean(1)
    return data, sr


def write_wav(path, data, sr):
    data = np.clip(data, -1, 1)
    with wave.open(path, "w") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes((data * 32767).astype(np.int16).tobytes())


def resample(x, sr_in, sr_out):
    if sr_in == sr_out:
        return x
    n = int(len(x) * sr_out / sr_in)
    t = np.linspace(0, len(x) - 1, n)
    return np.interp(t, np.arange(len(x)), x).astype(np.float32)


def speak(voice, speed, pitch, text, gap=0.55):
    """Speak '|' separated segments with silent gaps, return mono float @SR."""
    parts = [p.strip() for p in text.split("|")]
    out = []
    for i, p in enumerate(parts):
        if p:
            f = os.path.join(TMP, "seg.wav")
            run(["espeak-ng", "-v", voice, "-s", str(speed), "-p", str(pitch), "-w", f, p])
            x, sr = read_wav(f)
            x = resample(x, sr, SR)
            # trim leading/trailing silence
            nz = np.where(np.abs(x) > 0.01)[0]
            if len(nz):
                x = x[max(0, nz[0] - 200): nz[-1] + 1500]
            out.append(x)
        else:
            out.append(np.zeros(int(SR * 0.4), np.float32))
        if i < len(parts) - 1:
            out.append(np.zeros(int(SR * gap), np.float32))
    return np.concatenate(out)


def stft(x, n=1024, hop=256):
    win = np.hanning(n).astype(np.float32)
    pad = np.concatenate([np.zeros(n), x, np.zeros(n)])
    frames = [pad[i:i + n] * win for i in range(0, len(pad) - n, hop)]
    return np.fft.rfft(np.array(frames), axis=1), win


def istft(S, win, n=1024, hop=256, length=None):
    frames = np.fft.irfft(S, n=n, axis=1)
    out = np.zeros(hop * len(frames) + n)
    norm = np.zeros_like(out)
    for i, f in enumerate(frames):
        out[i * hop:i * hop + n] += f * win
        norm[i * hop:i * hop + n] += win ** 2
    out = out / np.maximum(norm, 1e-3)
    out = out[n:]
    if length:
        out = out[:length]
    return out.astype(np.float32)


def whisperise(x, lifter=34, tilt=1.0, seed=0):
    """Replace voiced excitation by noise while keeping the spectral envelope."""
    rng = np.random.default_rng(seed)
    n, hop = 1024, 256
    S, win = stft(x, n, hop)
    mag = np.abs(S) + 1e-6
    logm = np.log(mag)
    cep = np.fft.irfft(logm, axis=1)
    cep[:, lifter:-lifter] = 0
    env = np.exp(np.fft.rfft(cep, axis=1).real)
    freqs = np.fft.rfftfreq(n, 1 / SR)
    # whispers carry more high-frequency breath; small tilt boost above 1.5 kHz
    boost = 1 + tilt * np.clip((freqs - 1500) / 4000, 0, 1)
    phase = np.exp(1j * rng.uniform(0, 2 * np.pi, S.shape))
    W = env * boost * phase
    y = istft(W, win, n, hop, len(x))
    # follow the original loudness contour
    frame_rms = np.sqrt(np.convolve(x ** 2, np.ones(2048) / 2048, mode="same"))
    y_rms = np.sqrt(np.convolve(y ** 2, np.ones(2048) / 2048, mode="same")) + 1e-5
    y = y * np.clip(frame_rms / y_rms, 0, 8)
    return y


def ffmpeg_proc(src, dst, filt, bitrate="56k"):
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", filt,
         "-ac", "1", "-ar", "44100", "-b:a", bitrate, dst])


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    return round(float(r.stdout.strip()), 3)


def wobble(x, f=7.0, depth=0.04, trem=0.6):
    """goat bleat: fast pitch vibrato + tremolo"""
    n = len(x)
    t = np.arange(n) / SR
    pos = np.cumsum(1 + depth * np.sin(2 * np.pi * f * t))
    pos = pos[pos < n - 1]
    y = np.interp(pos, np.arange(n), x)
    tt = np.arange(len(y)) / SR
    return (y * (1 - trem * 0.5 * (1 + np.sin(2 * np.pi * f * tt)))).astype(np.float32)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


manifest = {}
ALL = "--all" in sys.argv


def need(key):
    return ALL or not os.path.exists(os.path.join(OUT, key + ".mp3"))

# ---------------- Teacher -----------------
for key, text in TEACHER.items():
    manifest[key] = {"who": "teacher", "text": SUBS[key]}
    if not need(key):
        continue
    x = speak("mb-us2", 92, 18, text, gap=0.7)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    low = os.path.join(TMP, key + "_low.wav")
    sub = os.path.join(TMP, key + "_sub.wav")
    # main voice: down a few semitones, darker formants
    ffmpeg_proc(raw, low, "rubberband=pitch=0.80:formant=shifted:tempo=0.92", "320k")
    # sub-octave growl layer
    ffmpeg_proc(raw, sub, "rubberband=pitch=0.5:formant=shifted:tempo=0.92,lowpass=f=900", "320k")
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", low.replace(".wav", ".wav"), "-i", sub,
         "-filter_complex",
         "[0:a]volume=1.0[a];[1:a]volume=0.42[b];[a][b]amix=inputs=2:normalize=0,"
         "highpass=f=70,lowpass=f=7500,acrusher=bits=10:mix=0.18:mode=log,"
         "aecho=0.8:0.55:45|97:0.22|0.12,alimiter=limit=0.9,loudnorm=I=-16:TP=-1.5",
         "-ac", "1", "-ar", "44100", "-b:a", "56k", os.path.join(OUT, key + ".mp3")])

for key, (text, sub) in TEACHER_WHISPER.items():
    manifest[key] = {"who": "teacher", "text": sub, "whisper": True}
    if not need(key):
        continue
    x = speak("mb-us2", 90, 10, text, gap=0.6)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    low = os.path.join(TMP, key + "_low.wav")
    ffmpeg_proc(raw, low, "rubberband=pitch=0.85:formant=shifted:tempo=0.85", "320k")
    y, sr2 = read_wav(low)
    y = whisperise(resample(y, sr2, SR), lifter=40, tilt=1.6, seed=7)
    w = os.path.join(TMP, key + "_w.wav")
    write_wav(w, norm(y, 0.8), SR)
    ffmpeg_proc(w, os.path.join(OUT, key + ".mp3"),
                "highpass=f=250,lowpass=f=9000,aecho=0.8:0.4:30|60:0.18|0.1,loudnorm=I=-17:TP=-1.5")

# ---------------- Friends (whispers) -----------------
for who, voice, table, seed in (("sam", "mb-us3", SAM, 3), ("nora", "mb-us1", NORA, 5)):
    for key, text in table.items():
        manifest[key] = {"who": who, "text": text, "whisper": True}
        if not need(key):
            continue
        x = speak(voice, 150 if who == "sam" else 155, 50, text, gap=0.15)
        y = whisperise(x, lifter=36, tilt=1.2, seed=seed + len(key))
        w = os.path.join(TMP, key + "_w.wav")
        write_wav(w, norm(y, 0.8), SR)
        ffmpeg_proc(w, os.path.join(OUT, key + ".mp3"),
                    "highpass=f=300,lowpass=f=8500,loudnorm=I=-18:TP=-1.5", "48k")

for key, (voice, speed, pitch, text) in SHOUTS.items():
    manifest[key] = {"who": "sam" if key.startswith("s") else "nora", "text": text.upper(), "shout": True}
    if not need(key):
        continue
    x = speak(voice, speed, pitch, text, gap=0.1)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                "rubberband=pitch=1.12:formant=preserved,highpass=f=120,"
                "acompressor=threshold=-20dB:ratio=6,loudnorm=I=-12:TP=-1", "64k")

for key, (voice, speed, pitch, rb, who, text) in ALOUD.items():
    manifest[key] = {"who": who, "text": text}
    if not need(key):
        continue
    x = speak(voice, speed, pitch, text, gap=0.12)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                f"rubberband=pitch={rb}:formant=preserved,highpass=f=110,lowpass=f=9000,"
                "acompressor=threshold=-22dB:ratio=4,loudnorm=I=-15:TP=-1.2", "64k")

for base, (text, sub, extra) in MEMES.items():
    for g, (voice, speed, pitch, rb) in KID_VOICES.items():
        key = base + "_" + g
        manifest[key] = {"who": "kid", "text": sub, "meme": True}
        if not need(key):
            continue
        sp = {"m_bruh": 120, "m_goat": 70, "m_sheesh": 90}.get(base, speed)
        x = speak(voice, sp, pitch if base != "m_bruh" else 40, text, gap=0.12)
        if base == "m_goat":
            x = wobble(x, f=11.0)
        raw = os.path.join(TMP, key + "_raw.wav")
        write_wav(raw, norm(x), SR)
        r = rb if base != "m_bruh" else rb * 0.86
        tempo = {"m_sheesh": 0.36, "m_goat": 0.6}.get(base, 1.0)
        ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                    f"rubberband=pitch={r}:tempo={tempo}:formant=preserved,{extra}highpass=f=110,lowpass=f=9000,"
                    "acompressor=threshold=-22dB:ratio=4,loudnorm=I=-14:TP=-1.2", "64k")

for key, (text, sub) in PA.items():
    manifest[key] = {"who": "pa", "text": sub}
    if not need(key):
        continue
    x = speak("mb-us1", 150, 46, text, gap=0.5)
    raw = os.path.join(TMP, key + "_raw.wav")
    rng = np.random.default_rng(len(key))
    hiss = rng.standard_normal(len(x)).astype(np.float32) * 0.03
    write_wav(raw, norm(x) * 0.9 + hiss, SR)
    # old ceiling speaker: narrow band, a bit of crunch, the empty hallway behind it
    ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                "highpass=f=450,lowpass=f=3200,acrusher=bits=8:mix=0.25:mode=log,"
                "aecho=0.8:0.5:90|160:0.35|0.2,loudnorm=I=-16:TP=-1.5", "48k")

for key, (voice, speed, pitch, rb, text, sub) in HALL.items():
    manifest[key] = {"who": "hall", "text": sub}
    if not need(key):
        continue
    x = speak(voice, speed, pitch, text, gap=0.35)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    # through a closed door, from an empty hallway: no highs, a long dark echo
    ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                f"rubberband=pitch={rb}:formant=preserved,highpass=f=140,lowpass=f=1500,"
                "aecho=0.8:0.6:120|210:0.4|0.25,loudnorm=I=-17:TP=-1.5", "48k")

for key, (voice, speed, pitch, rb, text) in CLIPV.items():
    manifest[key] = {"who": "clip", "text": text.replace(" | ", " ")}
    if not need(key):
        continue
    x = speak(voice, speed, pitch, text, gap=0.5)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    # a phone speaker: no bass, a bit boxy
    ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                f"rubberband=pitch={rb}:formant=preserved,highpass=f=260,lowpass=f=7000,"
                "acompressor=threshold=-22dB:ratio=5,loudnorm=I=-14:TP=-1.2", "56k")

for key in manifest:
    manifest[key]["dur"] = duration(os.path.join(OUT, key + ".mp3"))

with open(os.path.join(ROOT, "assets", "audio", "voices.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print("generated", len(manifest), "lines")
