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
}
SUBS = {
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
}
TEACHER_WHISPER = {
    "tw_turn": ("Turn | around.", "Turn... around."),
    "tw_behind": ("I am | behind you.", "I am... behind you."),
    "tw_here": ("Right | here.", "Right... here."),
    "tw_shh": ("shhhhhhhhh", "Shhhhhh..."),
}
SAM = {
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
}
NORA = {
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
}
SHOUTS = {
    "s_hey": ("mb-us3", 175, 70, "Hey! Are you even listening?"),
    "n_hey": ("mb-us1", 175, 75, "Hey! Answer me!"),
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


def ffmpeg_proc(src, dst, filt, bitrate="80k"):
    run(["ffmpeg", "-y", "-loglevel", "error", "-i", src, "-af", filt,
         "-ac", "1", "-ar", "44100", "-b:a", bitrate, dst])


def duration(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                        "-of", "csv=p=0", path], capture_output=True, text=True)
    return round(float(r.stdout.strip()), 3)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) + 1e-9
    return x * (peak / m)


manifest = {}

# ---------------- Teacher -----------------
for key, text in TEACHER.items():
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
         "-ac", "1", "-ar", "44100", "-b:a", "80k", os.path.join(OUT, key + ".mp3")])
    manifest[key] = {"who": "teacher", "text": SUBS[key]}

for key, (text, sub) in TEACHER_WHISPER.items():
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
    manifest[key] = {"who": "teacher", "text": sub, "whisper": True}

# ---------------- Friends (whispers) -----------------
for who, voice, table, seed in (("sam", "mb-us3", SAM, 3), ("nora", "mb-us1", NORA, 5)):
    for key, text in table.items():
        x = speak(voice, 150 if who == "sam" else 155, 50, text, gap=0.15)
        y = whisperise(x, lifter=36, tilt=1.2, seed=seed + len(key))
        w = os.path.join(TMP, key + "_w.wav")
        write_wav(w, norm(y, 0.8), SR)
        ffmpeg_proc(w, os.path.join(OUT, key + ".mp3"),
                    "highpass=f=300,lowpass=f=8500,loudnorm=I=-18:TP=-1.5", "64k")
        manifest[key] = {"who": who, "text": text, "whisper": True}

for key, (voice, speed, pitch, text) in SHOUTS.items():
    x = speak(voice, speed, pitch, text, gap=0.1)
    raw = os.path.join(TMP, key + "_raw.wav")
    write_wav(raw, norm(x), SR)
    ffmpeg_proc(raw, os.path.join(OUT, key + ".mp3"),
                "rubberband=pitch=1.12:formant=preserved,highpass=f=120,"
                "acompressor=threshold=-20dB:ratio=6,loudnorm=I=-12:TP=-1", "64k")
    manifest[key] = {"who": "sam" if key.startswith("s") else "nora", "text": text.upper(), "shout": True}

for key in manifest:
    manifest[key]["dur"] = duration(os.path.join(OUT, key + ".mp3"))

with open(os.path.join(ROOT, "assets", "audio", "voices.json"), "w") as f:
    json.dump(manifest, f, indent=1)
print("generated", len(manifest), "lines")
