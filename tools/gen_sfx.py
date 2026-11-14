#!/usr/bin/env python3
"""Synthesise all sound effects used by the game (no samples, no licences).

    python3 tools/gen_sfx.py          (needs numpy + ffmpeg; add v3, v4, v5, v6, v7, p3 or memes for one group)

Writes assets/audio/sfx/*.mp3. Every sound is built from noise, oscillators,
filters and a synthetic room impulse response, so it can be tweaked freely.
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "audio", "sfx")
VOICE = os.path.join(ROOT, "assets", "audio", "voice")
os.makedirs(OUT, exist_ok=True)
TMP = tempfile.mkdtemp(prefix="sfx_")
SR = 44100
rng = np.random.default_rng(1337)


# ----------------------------------------------------------------- helpers
def t_axis(dur):
    return np.arange(int(dur * SR)) / SR


def noise(dur):
    return rng.standard_normal(int(dur * SR)).astype(np.float64)


def biquad(x, kind, f0, q=0.707, gain_db=0.0):
    """RBJ cookbook biquad, causal (keeps transients crisp)."""
    w0 = 2 * np.pi * f0 / SR
    cw, sw = np.cos(w0), np.sin(w0)
    alpha = sw / (2 * q)
    A = 10 ** (gain_db / 40)
    if kind == "lp":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "hp":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "bp":
        b = [alpha, 0, -alpha]; a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "peak":
        b = [1 + alpha * A, -2 * cw, 1 - alpha * A]; a = [1 + alpha / A, -2 * cw, 1 - alpha / A]
    else:
        raise ValueError(kind)
    b = np.array(b) / a[0]; a = np.array(a) / a[0]
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    b0, b1, b2, a1, a2 = b[0], b[1], b[2], a[1], a[2]
    for i in range(len(x)):
        xi = x[i]
        yi = b0 * xi + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2
        x2, x1, y2, y1 = x1, xi, y1, yi
        y[i] = yi
    return y


def fft_filter(x, resp):
    """Zero-phase filter; resp(freqs)->gain."""
    n = len(x)
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(X * resp(f), n)


def lowpass_f(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (f / fc) ** (2 * order))


def highpass_f(fc, order=2):
    return lambda f: 1 / np.sqrt(1 + (fc / np.maximum(f, 1e-3)) ** (2 * order))


def band_f(fc, octaves=1.0):
    return lambda f: np.exp(-0.5 * (np.log2(np.maximum(f, 1) / fc) / (octaves / 2)) ** 2)


def env_exp(dur, tau, attack=0.002):
    t = t_axis(dur)
    e = np.exp(-t / tau)
    a = np.clip(t / max(attack, 1e-5), 0, 1)
    return e * a


def impulse_response(dur=2.5, decay=0.6, damp=4000, pre=0.0, seed=3):
    r = np.random.default_rng(seed)
    t = t_axis(dur)
    ir = r.standard_normal(len(t)) * np.exp(-t / decay)
    # high frequencies die faster: blend progressively low-passed copies
    lp = fft_filter(ir, lowpass_f(damp * 0.35, 1))
    mix = np.clip(t / (dur * 0.5), 0, 1)
    ir = ir * (1 - mix) + lp * mix
    # a few early reflections
    for d, g in ((0.011, 0.6), (0.019, 0.45), (0.027, 0.35), (0.041, 0.3), (0.063, 0.22)):
        i = int(d * SR)
        if i < len(ir):
            ir[i] += g * 3
    ir[0] = 4.0
    ir *= np.clip((dur - t) / (dur * 0.45), 0, 1) ** 2  # smooth tail, no hard cut
    return ir / np.max(np.abs(ir))


def convolve(x, ir):
    n = len(x) + len(ir) - 1
    N = 1 << (n - 1).bit_length()
    return np.fft.irfft(np.fft.rfft(x, N) * np.fft.rfft(ir, N), N)[:n]


def reverb(x, wet=0.3, **kw):
    ir = impulse_response(**kw)
    w = convolve(x, ir)
    w = w / (np.max(np.abs(w)) + 1e-9) * np.max(np.abs(x))
    d = np.concatenate([x, np.zeros(len(w) - len(x))])
    return d * (1 - wet) + w * wet


def pad(x, dur):
    n = int(dur * SR)
    return np.concatenate([x, np.zeros(max(0, n - len(x)))])[:n] if n >= len(x) else x


def place(dst, src, at):
    i = int(at * SR)
    end = min(len(dst), i + len(src))
    if i < len(dst):
        dst[i:end] += src[: end - i]
    return dst


def normalize(x, peak=0.89):
    return x * (peak / (np.max(np.abs(x)) + 1e-9))


def fade(x, fin=0.005, fout=0.02):
    n_in, n_out = int(fin * SR), int(fout * SR)
    y = x.copy()
    if n_in:
        y[:n_in] *= np.linspace(0, 1, n_in)
    if n_out:
        y[-n_out:] *= np.linspace(1, 0, n_out)
    return y


def save(name, x, peak=0.89, bitrate="96k", stereo=None):
    x = normalize(fade(x), peak)
    wav = os.path.join(TMP, name + ".wav")
    with wave.open(wav, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1",
                    "-b:a", bitrate, os.path.join(OUT, name + ".mp3")], check=True)
    print("  ", name, round(len(x) / SR, 2), "s")


def loop_save(name, x, xfade=0.5, **kw):
    """Make a seamless loop by cross-fading the tail into the head."""
    n = int(xfade * SR)
    head, body, tail = x[:n], x[n:-n], x[-n:]
    ramp = np.linspace(0, 1, n)
    joined = np.concatenate([body, tail * (1 - ramp) + head * ramp])
    x2 = normalize(joined, kw.pop("peak", 0.8))
    wav = os.path.join(TMP, name + ".wav")
    with wave.open(wav, "w") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(x2, -1, 1) * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1",
                    "-b:a", kw.get("bitrate", "96k"), os.path.join(OUT, name + ".mp3")], check=True)
    print("  ", name, "(loop)", round(len(x2) / SR, 2), "s")


def read_mp3(path):
    wav = os.path.join(TMP, "rd.wav")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", path, "-ac", "1", "-ar", str(SR), wav], check=True)
    with wave.open(wav) as w:
        return np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(np.float64) / 32768


# ------------------------------------------------------------------ sounds
def one_clap(seed, body=1.0):
    r = np.random.default_rng(seed)
    dur = 0.25
    out = np.zeros(int(dur * SR))
    # a real clap is several micro-impacts a few ms apart
    t0 = 0.0
    for k in range(r.integers(3, 5)):
        n = noise(0.12) * env_exp(0.12, r.uniform(0.006, 0.012), 0.0004)
        place(out, n * r.uniform(0.6, 1.0), t0)
        t0 += r.uniform(0.002, 0.007)
    out = biquad(out, "bp", r.uniform(1050, 1500), 0.9) * 1.6 + biquad(out, "hp", 3000, 0.7) * 0.25
    # hollow palm cavity resonance
    thump = np.sin(2 * np.pi * r.uniform(170, 230) * t_axis(dur)) * env_exp(dur, 0.018, 0.001)
    out += thump * 0.35 * body
    return out


def make_claps():
    for i in range(3):
        save(f"clap_{i+1}", pad(one_clap(10 + i), 0.3), 0.9)
    # the frightening clap: heavier, slowed, with a long hall tail and a sub hit
    c = one_clap(99, body=2.0)
    slowed = np.interp(np.arange(0, len(c), 0.8), np.arange(len(c)), c)
    sub = np.sin(2 * np.pi * 48 * t_axis(0.6) * np.exp(-t_axis(0.6) * 1.5)) * env_exp(0.6, 0.18, 0.002)
    x = pad(slowed, 0.6) * 1.0 + sub * 0.5
    x = reverb(pad(x, 3.4), wet=0.55, dur=3.0, decay=0.9, damp=3500)
    save("clap_big", x, 0.95)


def chalk_stroke_sequence(dur, seed, squeak_prob=0.35):
    r = np.random.default_rng(seed)
    out = np.zeros(int(dur * SR))
    t = 0.05
    while t < dur - 0.15:
        sl = r.uniform(0.06, 0.32)
        n = noise(sl)
        # stick-slip grit: noise gated by fast random pulses
        grit_rate = r.uniform(140, 320)
        tt = t_axis(sl)
        gate = (np.sin(2 * np.pi * grit_rate * tt + r.uniform(0, 6)) > r.uniform(-0.2, 0.5)).astype(float)
        gate = fft_filter(gate, lowpass_f(2500, 1))
        stroke = n * (0.35 + gate)
        env = np.sin(np.pi * np.clip(tt / sl, 0, 1)) ** 0.6
        stroke *= env * r.uniform(0.5, 1.0)
        place(out, stroke, t)
        if r.random() < squeak_prob:
            ql = r.uniform(0.04, 0.16)
            qt = t_axis(ql)
            f0 = r.uniform(1800, 3600)
            vib = 1 + 0.02 * np.sin(2 * np.pi * r.uniform(20, 45) * qt)
            ph = 2 * np.pi * np.cumsum(f0 * vib) / SR
            sq = (np.sin(ph) + 0.4 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * np.sin(np.pi * qt / ql)
            place(out, sq * r.uniform(0.08, 0.2), t + r.uniform(0, sl * 0.6))
        # tap at the start of some strokes
        if r.random() < 0.5:
            tap = noise(0.02) * env_exp(0.02, 0.002, 0.0002)
            place(out, tap * 0.8, t)
        t += sl + r.uniform(0.02, 0.18)
    out = biquad(out, "hp", 1200, 0.7)
    out = biquad(out, "peak", 3200, 1.2, 6)
    out = biquad(out, "lp", 9000, 0.7)
    return out


def make_chalk():
    for i in range(4):
        save(f"chalk_{i+1}", chalk_stroke_sequence(2.2, 40 + i), 0.7)
    # long nails-on-a-board screech for scares
    dur = 1.8
    tt = t_axis(dur)
    f = 2400 + 500 * np.sin(2 * np.pi * 0.7 * tt) + 120 * np.sin(2 * np.pi * 11 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = sum(np.sin(k * ph + rng.uniform(0, 6)) / k ** 0.8 for k in range(1, 7))
    s *= (0.6 + 0.4 * (np.sin(2 * np.pi * 31 * tt) > 0))  # stick-slip chatter
    s += noise(dur) * 0.25
    s = biquad(s, "hp", 900, 0.7)
    s *= np.clip(tt / 0.05, 0, 1) * np.clip((dur - tt) / 0.4, 0, 1)
    save("chalk_screech", reverb(s, 0.25, dur=1.2, decay=0.35), 0.8)
    # tap of chalk on board / chalk set down
    tap = noise(0.08) * env_exp(0.08, 0.004, 0.0002)
    tap = biquad(tap, "bp", 2600, 1.5) + np.sin(2 * np.pi * 900 * t_axis(0.08)) * env_exp(0.08, 0.01) * 0.3
    save("chalk_tap", pad(tap, 0.12), 0.7)


def make_eraser():
    dur = 2.0
    tt = t_axis(dur)
    strokes = 0.5 + 0.5 * np.sin(2 * np.pi * 3.2 * tt) ** 2
    x = noise(dur) * strokes
    x = fft_filter(x, lambda f: band_f(700, 2.5)(f) + 0.2 * band_f(2500, 1.5)(f))
    save("erase", x, 0.6)


def make_bell():
    dur = 4.2
    out = np.zeros(int(dur * SR))
    partials = [(1.0, 1.0, 0.9), (2.32, 0.6, 0.6), (4.25, 0.35, 0.35), (6.63, 0.2, 0.2), (9.38, 0.12, 0.12)]
    f0 = 1180
    strike_rate = 24.0
    t = 0.0
    ring_len = 3.2
    one = np.zeros(int(0.5 * SR))
    tt = t_axis(0.5)
    for ratio, amp, tau in partials:
        one += amp * np.sin(2 * np.pi * f0 * ratio * tt + rng.uniform(0, 6)) * np.exp(-tt / (tau * 0.5))
    click = noise(0.004) * 0.6
    one[: len(click)] += click
    while t < ring_len:
        place(out, one * rng.uniform(0.75, 1.0), t + rng.uniform(-0.002, 0.002))
        t += 1 / strike_rate
    out = np.tanh(out * 0.6) * 1.2
    out = biquad(out, "peak", 2400, 1.0, 4)
    out = reverb(out, 0.35, dur=2.0, decay=0.5)
    save("bell", out, 0.85)


def make_scream():
    dur = 2.2
    tt = t_axis(dur)
    env = np.clip(tt / 0.015, 0, 1) * np.clip((dur - tt) / 0.9, 0, 1)
    # FM screech that bends up then wails down
    fc = 780 + 650 * np.clip(tt / 0.25, 0, 1) - 300 * np.clip((tt - 0.6) / 1.4, 0, 1)
    fc *= 1 + 0.03 * np.sin(2 * np.pi * 7.5 * tt)
    ph_m = 2 * np.pi * np.cumsum(fc * 1.48) / SR
    ph_c = 2 * np.pi * np.cumsum(fc) / SR + (3.5 + 2 * np.sin(2 * np.pi * 3 * tt)) * np.sin(ph_m)
    fm = np.sin(ph_c)
    # dissonant saw cluster
    cluster = np.zeros_like(tt)
    for semis in (0, 1, 6, 11, 13):
        f = 330 * 2 ** (semis / 12) * (1 + 0.004 * rng.standard_normal())
        ph = 2 * np.pi * f * tt * (1 + 0.01 * np.sin(2 * np.pi * 5 * tt + semis))
        cluster += 2 * ((ph / (2 * np.pi)) % 1) - 1
    cluster /= 5
    rasp = biquad(noise(dur), "bp", 2200, 0.6) * (0.6 + 0.4 * np.sin(2 * np.pi * 37 * tt))
    hit_t = t_axis(0.9)
    hit = np.sin(2 * np.pi * np.cumsum(90 * np.exp(-hit_t * 4) + 30) / SR) * np.exp(-hit_t / 0.3)
    hit += biquad(noise(0.9), "lp", 400) * np.exp(-hit_t / 0.08) * 2
    x = (fm * 0.7 + cluster * 0.6 + rasp * 1.1) * env
    x = place(x, hit * 1.4, 0)
    x = np.tanh(x * 2.2)
    x = biquad(x, "peak", 3000, 0.8, 5)
    x = reverb(x, 0.25, dur=1.5, decay=0.4)
    save("scream", x, 0.98)


def make_stingers():
    # 1: string cluster stab with bow noise (sharp attack, long reverb)
    dur = 2.4
    tt = t_axis(dur)
    s = np.zeros_like(tt)
    for semis in (0, 1, 2, 6, 7, 13):
        f = 587 * 2 ** (semis / 12)
        vib = 1 + 0.006 * np.sin(2 * np.pi * (5.5 + semis * 0.1) * tt)
        ph = 2 * np.pi * np.cumsum(f * vib) / SR
        s += (2 * ((ph / (2 * np.pi)) % 1) - 1)
    s = biquad(s / 6, "lp", 5000) + biquad(noise(dur), "bp", 3000, 0.8) * 0.15
    s *= np.clip(tt / 0.01, 0, 1) * np.exp(-tt / 0.6)
    save("stinger_1", reverb(pad(s, 3.6), 0.5, dur=3.0, decay=0.8), 0.92)
    # 2: low boom + metal
    dur = 4.0
    tt = t_axis(dur)
    boom = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-tt * 3) + 32) / SR) * np.exp(-tt / 0.9)
    metal = np.zeros_like(tt)
    for r_ in (1.0, 1.41, 2.03, 2.76, 3.9, 5.1):
        metal += np.sin(2 * np.pi * 210 * r_ * tt + rng.uniform(0, 6)) * np.exp(-tt / (1.2 / r_))
    x = boom * 1.2 + metal * 0.25 + biquad(noise(dur), "lp", 300) * np.exp(-tt / 0.15)
    save("stinger_2", reverb(np.tanh(x * 1.5), 0.45, dur=3.5, decay=1.0), 0.95)
    # 3: reverse swell that ends on a cut (place right before a scare)
    dur = 2.5
    tt = t_axis(dur)
    sw = noise(dur) * (tt / dur) ** 3
    sw = fft_filter(sw, band_f(900, 3))
    tone = np.zeros_like(tt)
    for semis in (0, 1, 5):
        tone += np.sin(2 * np.pi * 110 * 2 ** (semis / 12) * tt * (1 + 0.15 * tt / dur))
    x = sw + tone * (tt / dur) ** 2.5 * 0.4
    save("stinger_swell", x, 0.85)
    # 4: sub drop / dread hit
    dur = 3.0
    tt = t_axis(dur)
    x = np.sin(2 * np.pi * np.cumsum(55 - 25 * tt / dur) / SR) * np.exp(-tt / 1.2)
    x += biquad(noise(dur), "lp", 120) * np.exp(-tt / 0.5) * 0.6
    save("sub_hit", np.tanh(x * 1.6), 0.95)


def make_breath():
    dur = 6.0
    tt = t_axis(dur)
    out = np.zeros_like(tt)
    for start, length, inhale in ((0.1, 1.5, True), (1.8, 2.0, False), (3.9, 1.4, True), (5.4, 0.55, False)):
        n = noise(length)
        lt = t_axis(length)
        env = np.sin(np.pi * np.clip(lt / length, 0, 1)) ** (1.3 if inhale else 0.8)
        fc = 1500 + 600 * lt / length if inhale else 900 - 300 * lt / length
        y = np.zeros_like(n)
        # crude time-varying band: process in short blocks
        blk = 2048
        for i in range(0, len(n), blk):
            seg = n[i:i + blk]
            f_mid = fc[min(i, len(fc) - 1)]
            y[i:i + blk] = fft_filter(seg, band_f(f_mid, 1.8))
        rasp = 1 + 0.5 * np.sin(2 * np.pi * (28 if inhale else 22) * lt)
        place(out, y * env * rasp * (0.7 if inhale else 1.0), start)
    out = fft_filter(out, lambda f: band_f(1100, 3.5)(f))
    save("breath", out, 0.7)


def make_thunder():
    dur = 7.0
    tt = t_axis(dur)
    crack = biquad(noise(0.4), "hp", 400) * env_exp(0.4, 0.06, 0.003)
    rumble = fft_filter(noise(dur), lowpass_f(160, 3)) * 6
    mod = np.zeros_like(tt)
    for _ in range(9):
        c = rng.uniform(0.2, 4.5)
        w = rng.uniform(0.15, 0.6)
        mod += rng.uniform(0.3, 1.0) * np.exp(-0.5 * ((tt - c) / w) ** 2)
    mod = mod * np.exp(-tt / 3.5) + 0.05
    x = rumble * mod
    x = place(x, crack * 0.8, 0.0)
    save("thunder", reverb(x, 0.3, dur=2.5, decay=0.8), 0.95)


def make_rain():
    dur = 10.5
    tt = t_axis(dur)
    hiss = fft_filter(noise(dur), lambda f: highpass_f(900, 1)(f) * lowpass_f(9000, 1)(f) / np.sqrt(np.maximum(f, 50) / 1000))
    drops = np.zeros_like(tt)
    for _ in range(1300):
        d = noise(0.01) * env_exp(0.01, rng.uniform(0.0008, 0.002), 0.0001)
        d = np.sin(2 * np.pi * rng.uniform(2000, 6000) * t_axis(0.01)) * np.abs(d)
        place(drops, d * rng.uniform(0.05, 0.5), rng.uniform(0, dur - 0.02))
    # heavier drops on the window glass
    for _ in range(140):
        d = np.sin(2 * np.pi * rng.uniform(600, 1400) * t_axis(0.03)) * env_exp(0.03, 0.006, 0.0005)
        place(drops, d * rng.uniform(0.2, 0.7), rng.uniform(0, dur - 0.04))
    x = hiss * 0.5 + drops * 0.8
    x = fft_filter(x, lowpass_f(7000, 1))
    loop_save("rain_loop", x, 0.5, peak=0.7)


def make_whisper_bed():
    files = ["s_face", "n_quiet", "tw_turn", "n_look", "s_blink", "tw_behind", "n_chalk", "s_real"]
    dur = 14.0
    out = np.zeros(int(dur * SR))
    for i, f in enumerate(files):
        x = read_mp3(os.path.join(VOICE, f + ".mp3"))
        if i % 2 == 0:
            x = x[::-1]
        rate = rng.uniform(0.82, 1.05)
        x = np.interp(np.arange(0, len(x), rate), np.arange(len(x)), x)
        place(out, x * rng.uniform(0.4, 0.9), rng.uniform(0, dur - len(x) / SR - 0.1) if len(x) / SR < dur else 0)
    out = reverb(out, 0.6, dur=3.0, decay=0.9)[: int(dur * SR) + int(1.0 * SR)]
    loop_save("whispers_loop", out, 1.0, peak=0.7)


def music_box_note(f, dur=2.5):
    tt = t_axis(dur)
    x = np.zeros_like(tt)
    for ratio, amp, tau in ((1, 1.0, 1.1), (2.0, 0.25, 0.5), (3.01, 0.18, 0.25), (5.43, 0.1, 0.12), (8.1, 0.05, 0.06)):
        x += amp * np.sin(2 * np.pi * f * ratio * tt) * np.exp(-tt / tau)
    x[: int(0.002 * SR)] *= np.linspace(0, 1, int(0.002 * SR))
    return x


def make_music_box():
    # An original lullaby in A minor (not based on any existing tune).
    A4 = 440.0
    def nf(semi):
        return A4 * 2 ** (semi / 12)
    melody = [  # (semitones from A4, beats)
        (12, 1), (7, 1), (8, 1), (7, 1), (3, 2), (0, 2),
        (2, 1), (3, 1), (7, 1), (3, 1), (2, 3), (-1, 1),
        (12, 1), (14, 1), (15, 1), (14, 1), (12, 2), (7, 2),
        (8, 1), (7, 1), (3, 1), (2, 1), (0, 4),
    ]
    beat = 0.62
    total = sum(b for _, b in melody) * beat + 3
    out = np.zeros(int(total * SR))
    t = 0.3
    for semi, beats in melody:
        out = place(out, music_box_note(nf(semi + 12)) * 0.6, t + rng.uniform(-0.01, 0.01))
        if beats >= 2:  # a low accompaniment note on long notes
            out = place(out, music_box_note(nf(semi - 12)) * 0.3, t)
        t += beats * beat
    # tape wow: slow pitch wobble
    tt = np.arange(len(out)) / SR
    warp = tt + 0.004 * np.sin(2 * np.pi * 0.35 * tt) + 0.0015 * np.sin(2 * np.pi * 2.1 * tt)
    out = np.interp(warp * SR, np.arange(len(out)), out)
    out = reverb(out, 0.45, dur=3.0, decay=0.9)
    save("music_box", out, 0.75)


def make_misc():
    # chair scrape (stick-slip)
    dur = 1.4
    tt = t_axis(dur)
    rate = 45 + 35 * np.sin(np.pi * tt / dur)
    ph = np.cumsum(rate) / SR
    pulses = (ph % 1 < 0.12).astype(float)
    x = fft_filter(pulses + noise(dur) * 0.2, lambda f: band_f(650, 2)(f) + 0.5 * band_f(1800, 1)(f))
    x *= np.sin(np.pi * tt / dur) ** 0.5
    save("chair_scrape", reverb(x, 0.25, dur=1.5, decay=0.4), 0.85)
    # door slam
    dur = 2.5
    tt = t_axis(dur)
    thud = np.sin(2 * np.pi * np.cumsum(110 * np.exp(-tt * 8) + 55) / SR) * np.exp(-tt / 0.12)
    wood = fft_filter(noise(dur), band_f(400, 1.5)) * np.exp(-tt / 0.05) * 3
    rattle = biquad(noise(dur), "bp", 2500, 2) * np.exp(-tt / 0.2) * (np.sin(2 * np.pi * 18 * tt) > 0.3)
    save("door_slam", reverb(thud + wood + rattle * 0.3, 0.4, dur=2.2, decay=0.6), 0.95)
    # glitch
    dur = 0.9
    x = np.zeros(int(dur * SR))
    t = 0
    while t < dur - 0.05:
        l = rng.uniform(0.01, 0.07)
        kind = rng.integers(0, 3)
        tt = t_axis(l)
        if kind == 0:
            seg = np.sign(np.sin(2 * np.pi * rng.uniform(80, 1800) * tt))
        elif kind == 1:
            seg = np.round(noise(l) * 2) / 2
        else:
            seg = np.zeros_like(tt)
        place(x, seg * rng.uniform(0.3, 1.0), t)
        t += l
    save("glitch", biquad(x, "lp", 7000), 0.6)
    # heartbeat: single lub-dub
    dur = 0.7
    tt = t_axis(dur)
    def beat(at, f, amp):
        b = np.sin(2 * np.pi * np.cumsum(f * np.exp(-t_axis(0.25) * 6) + 30) / SR) * env_exp(0.25, 0.05, 0.004)
        return at, b * amp
    hb = np.zeros_like(tt)
    for at, b in (beat(0.0, 60, 1.0), beat(0.17, 50, 0.7)):
        place(hb, b, at)
    save("heartbeat", biquad(hb, "lp", 160), 0.95)
    # bone crack / neck creak (head turning around)
    dur = 1.6
    tt = t_axis(dur)
    x = np.zeros_like(tt)
    t = 0.05
    while t < dur - 0.1:
        c = biquad(noise(0.03), "bp", rng.uniform(1500, 4500), 2.5) * env_exp(0.03, 0.003, 0.0002)
        place(x, c * rng.uniform(0.4, 1.2), t)
        t += rng.exponential(0.06)
    creak_f = 90 + 40 * np.sin(2 * np.pi * 0.6 * tt)
    creak = np.sign(np.sin(2 * np.pi * np.cumsum(creak_f) / SR)) * 0.2
    creak = fft_filter(creak, band_f(700, 2)) * np.sin(np.pi * tt / dur)
    save("neck_crack", x + creak * 0.6, 0.85)
    # lights breaker "chunk" + buzz cut
    dur = 1.2
    tt = t_axis(dur)
    chunk = biquad(noise(dur), "lp", 900) * env_exp(dur, 0.03, 0.001) * 2
    buzz = np.sign(np.sin(2 * np.pi * 120 * tt)) * 0.25 * np.exp(-tt / 0.08)
    save("lights_off", reverb(chunk + biquad(buzz, "lp", 3000), 0.35, dur=1.5, decay=0.5), 0.85)
    # electrical zap for flickers
    dur = 0.25
    tt = t_axis(dur)
    zap = (np.sign(np.sin(2 * np.pi * 120 * tt)) * 0.5 + biquad(noise(dur), "hp", 2000)) * (rng.random(len(tt)) > 0.4)
    save("zap", biquad(zap * np.exp(-tt / 0.08), "lp", 8000), 0.5)
    # paper note
    dur = 0.8
    tt = t_axis(dur)
    crinkle = np.zeros_like(tt)
    for _ in range(60):
        c = biquad(noise(0.02), "hp", 2500) * env_exp(0.02, 0.003, 0.0003)
        place(crinkle, c * rng.uniform(0.2, 1.0), rng.uniform(0, dur - 0.03))
    save("paper", crinkle + biquad(noise(dur), "bp", 3000, 0.6) * 0.1 * np.sin(np.pi * tt / dur), 0.6)
    # whoosh (fast glide)
    dur = 1.3
    tt = t_axis(dur)
    sw = np.exp(-0.5 * ((tt - 0.55) / 0.22) ** 2)
    w = fft_filter(noise(dur), band_f(500, 2.5)) * sw
    save("whoosh", w, 0.6)
    # book drop
    dur = 1.2
    tt = t_axis(dur)
    slap = biquad(noise(dur), "bp", 900, 0.8) * env_exp(dur, 0.025, 0.0005) * 2
    body = np.sin(2 * np.pi * 95 * tt) * env_exp(dur, 0.07, 0.001)
    save("book_drop", reverb(slap + body, 0.35, dur=1.6, decay=0.5), 0.9)
    # phone ringtone (cheerful marimba – horribly out of place in the dark)
    notes = [(0, 0.15), (4, 0.15), (7, 0.15), (12, 0.3), (7, 0.15), (12, 0.45)]
    out = np.zeros(int(3.2 * SR))
    t = 0
    for rep in range(2):
        for semi, l in notes:
            f = 880 * 2 ** (semi / 12)
            tt = t_axis(0.5)
            n = (np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 4 * f * tt) * np.exp(-tt / 0.02)) * np.exp(-tt / 0.15)
            place(out, n, t)
            t += l
        t += 0.25
    save("ringtone", out, 0.8)
    # vibration buzz
    dur = 0.9
    tt = t_axis(dur)
    vib = np.sign(np.sin(2 * np.pi * 160 * tt)) * ((tt % 0.45) < 0.32)
    save("phone_buzz", biquad(vib * 0.6 + biquad(noise(dur), "lp", 300) * 0.3, "lp", 1200), 0.7)


def make_v2():
    """Sounds added for Madi Class: footsteps, typing, door, giggles, projector, glasses."""
    # hard-soled footsteps on tile
    for i in range(4):
        r = np.random.default_rng(200 + i)
        dur = 0.32
        tt = t_axis(dur)
        heel = biquad(noise(dur), "bp", r.uniform(900, 1500), 1.4) * env_exp(dur, 0.008, 0.0004)
        body = np.sin(2 * np.pi * np.cumsum(r.uniform(95, 130) * np.exp(-tt * 14) + 55) / SR) * env_exp(dur, 0.035, 0.001)
        toe = biquad(noise(dur), "bp", r.uniform(1800, 2600), 2.0) * env_exp(dur, 0.005, 0.0004) * 0.5
        x = heel * 1.2 + body * 0.9
        x = place(x, toe[: int(0.2 * SR)], r.uniform(0.045, 0.07))
        save(f"step_{i+1}", reverb(x, 0.3, dur=1.4, decay=0.4), 0.8)
    # laptop typing bursts
    for i in range(3):
        r = np.random.default_rng(300 + i)
        dur = 1.6
        x = np.zeros(int(dur * SR))
        t = 0.03
        while t < dur - 0.08:
            c = biquad(noise(0.03), "bp", r.uniform(2200, 4200), 3.0) * env_exp(0.03, 0.0035, 0.0002)
            c += np.sin(2 * np.pi * r.uniform(250, 420) * t_axis(0.03)) * env_exp(0.03, 0.006) * 0.35
            place(x, c * r.uniform(0.5, 1.0), t)
            t += r.choice([0.07, 0.09, 0.11, 0.16, 0.28], p=[0.3, 0.3, 0.2, 0.15, 0.05])
        save(f"keys_{i+1}", x, 0.6)
    # one decisive key (enter) and a laptop lid slam
    c = biquad(noise(0.06), "bp", 1800, 2.0) * env_exp(0.06, 0.006, 0.0002) + np.sin(2 * np.pi * 210 * t_axis(0.06)) * env_exp(0.06, 0.012) * 0.6
    save("key_enter", pad(c, 0.12), 0.7)
    dur = 0.9
    tt = t_axis(dur)
    slam = biquad(noise(dur), "bp", 700, 0.9) * env_exp(dur, 0.02, 0.0004) * 2 + np.sin(2 * np.pi * 140 * tt) * env_exp(dur, 0.05, 0.001)
    save("lid_slam", reverb(slam, 0.3, dur=1.2, decay=0.35), 0.9)
    # door: latch click, long creak, bump
    dur = 2.6
    tt = t_axis(dur)
    f = 240 + 160 * np.sin(2 * np.pi * 0.35 * tt + 0.4) + 25 * np.sin(2 * np.pi * 7 * tt)
    ph = 2 * np.pi * np.cumsum(f) / SR
    creak = sum(np.sin(k * ph) / k for k in range(1, 9)) * (0.5 + 0.5 * (np.sin(2 * np.pi * 23 * tt) > -0.2))
    creak = fft_filter(creak, band_f(1100, 2.5)) * np.clip((tt - 0.15) / 0.2, 0, 1) * np.clip((2.2 - tt) / 0.5, 0, 1)
    latch = biquad(noise(0.05), "bp", 2400, 3) * env_exp(0.05, 0.004, 0.0002) * 3
    x = creak * 0.5
    x = place(x, latch, 0.02)
    bump = np.sin(2 * np.pi * 85 * t_axis(0.3)) * env_exp(0.3, 0.05, 0.001) + biquad(noise(0.3), "lp", 500) * env_exp(0.3, 0.02) * 2
    x = place(x, bump * 0.8, 2.25)
    save("door_open", reverb(x, 0.3, dur=1.8, decay=0.5), 0.85)
    # the class snickering (layered whisper-laughs) and a sharp gasp
    out = np.zeros(int(2.4 * SR))
    for k, (f_, rate, at, g) in enumerate((("s_laugh", 1.0, 0.0, 1.0), ("n_laugh", 1.05, 0.12, 0.9), ("s_laugh", 1.25, 0.3, 0.6), ("n_laugh", 0.9, 0.45, 0.6), ("n_laugh", 1.3, 0.2, 0.5))):
        v = read_mp3(os.path.join(VOICE, f_ + ".mp3"))
        v = np.interp(np.arange(0, len(v), rate), np.arange(len(v)), v)
        place(out, v * g, at)
    save("giggle", reverb(out, 0.25, dur=1.5, decay=0.4), 0.75)
    dur = 0.7
    tt = t_axis(dur)
    g = np.zeros_like(tt)
    for blk in range(0, len(tt), 1024):
        seg = noise(1024 / SR)[: len(tt[blk:blk + 1024])]
        g[blk:blk + 1024] = fft_filter(seg, band_f(1300 + 1500 * blk / len(tt), 1.6)) if len(seg) > 8 else 0
    g *= np.sin(np.pi * np.clip(tt / 0.45, 0, 1)) ** 0.7 * (tt < 0.45)
    save("gasp", reverb(g, 0.3, dur=1.2, decay=0.35), 0.7)
    # projector: relay click + fan spinning up
    dur = 3.0
    tt = t_axis(dur)
    fan = fft_filter(noise(dur), band_f(900, 3)) * np.clip(tt / 1.6, 0, 1) * 0.5
    whine = np.sin(2 * np.pi * np.cumsum(120 + 500 * np.clip(tt / 1.8, 0, 1)) / SR) * 0.12 * np.clip(tt / 0.3, 0, 1)
    clk = biquad(noise(0.04), "bp", 1500, 2) * env_exp(0.04, 0.004, 0.0002) * 3
    x = (fan + whine) * np.clip((dur - tt) / 0.6, 0, 1)
    x = place(x, clk, 0.01)
    save("projector_on", x, 0.6)
    # wiping a lens with a tie: two soft squeaky rubs
    dur = 1.2
    tt = t_axis(dur)
    rub = fft_filter(noise(dur), band_f(2600, 1.5)) * (np.sin(2 * np.pi * 2.6 * tt) ** 2)
    sq = np.sin(2 * np.pi * np.cumsum(1900 + 500 * np.sin(2 * np.pi * 2.6 * tt)) / SR) * (np.sin(2 * np.pi * 2.6 * tt) ** 6) * 0.25
    save("wipe", (rub + sq) * np.sin(np.pi * tt / dur) ** 0.5, 0.5)
    # objective complete: two soft bell notes
    out = np.zeros(int(1.6 * SR))
    for k, semi in enumerate((7, 12)):
        f0 = 660 * 2 ** (semi / 12)
        nt = t_axis(1.2)
        n = (np.sin(2 * np.pi * f0 * nt) + 0.3 * np.sin(2 * np.pi * f0 * 2.01 * nt)) * np.exp(-nt / 0.3)
        place(out, n * 0.6, k * 0.13)
    save("ding", reverb(out, 0.25, dur=1.2, decay=0.4), 0.45)
    # page / attendance sheet rustle
    dur = 0.6
    tt = t_axis(dur)
    pg = biquad(noise(dur), "hp", 1800) * (np.sin(np.pi * tt / dur) ** 2) * (0.6 + 0.4 * np.sin(2 * np.pi * 31 * tt))
    save("page", pg, 0.45)


# ----------------------------------------------------------------- meme noises (background classmates)
def ph_of(freq):
    return np.cumsum(np.asarray(freq, dtype=np.float64)) / SR


def osc_sin(freq):
    return np.sin(2 * np.pi * ph_of(freq))


def osc_saw(freq):
    return 2 * (ph_of(freq) % 1.0) - 1


def osc_sq(freq, duty=0.5):
    return np.where((ph_of(freq) % 1.0) < duty, 1.0, -1.0)


def svf(x, fc, q=0.7, mode="lp"):
    """state-variable filter with a per-sample cutoff (for wah / sweeps)"""
    fc = np.broadcast_to(np.asarray(fc, dtype=np.float64), x.shape)
    f = 2 * np.sin(np.pi * np.clip(fc, 20, SR / 6) / SR)
    damp = 1 / q
    lp = bp = 0.0
    y = np.zeros_like(x)
    for i in range(len(x)):
        hp = x[i] - lp - damp * bp
        bp += f[i] * hp
        lp += f[i] * bp
        y[i] = lp if mode == "lp" else bp if mode == "bp" else hp
    return y


def adsr(dur, a=0.01, r=0.05):
    t = t_axis(dur)
    return np.clip(t / a, 0, 1) * np.clip((dur - t) / r, 0, 1)


def make_memes():
    # --- big cartoon snore with the whistling exhale
    def snore_in(dur, f0, amp=1.0):
        t = t_axis(dur)
        fl = f0 * (1 + 0.25 * np.sin(np.pi * t / dur))
        flap = np.maximum(0, osc_saw(fl)) ** 3
        n = noise(dur)
        body = biquad(n * (0.3 + flap * 1.6), "bp", 420, 0.9) + biquad(n * flap, "lp", 700) * 0.9
        return body * np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 0.6 * amp

    def snore_out(dur, f_hi=1550, f_lo=950):
        t = t_axis(dur)
        f = f_hi + (f_lo - f_hi) * (t / dur) + 25 * np.sin(2 * np.pi * 6 * t)
        wh = osc_sin(f) * 0.32
        br = biquad(noise(dur), "bp", 1700, 1.1) * 0.45
        return (wh + br) * np.sin(np.pi * t / dur) ** 1.4

    x = np.zeros(int(7.2 * SR))
    place(x, snore_in(1.5, 36), 0.05)
    place(x, snore_out(1.0), 1.75)
    place(x, snore_in(1.8, 32, 1.25), 3.15)
    place(x, snore_out(1.2, 1700, 900), 5.1)
    place(x, snore_in(0.35, 60, 0.9), 6.6)
    save("m_snore", reverb(x, 0.15, dur=1.0, decay=0.3), 0.85)

    # --- the deep dramatic "boom"
    dur = 3.0
    t = t_axis(dur)
    f = 52 + 75 * np.exp(-t / 0.05)
    body = osc_sin(f) * np.exp(-t / 0.7)
    mid = biquad(osc_saw(104 + 90 * np.exp(-t / 0.04)), "lp", 600) * np.exp(-t / 0.22) * 0.5
    ring = (osc_sin(np.full(len(t), 183.0)) * 0.25 + osc_sin(np.full(len(t), 412.0)) * 0.12) * np.exp(-t / 0.5)
    click = np.zeros(len(t)); click[: int(0.02 * SR)] = biquad(noise(0.02), "lp", 2500) * 0.6
    boom = np.tanh((body + mid + ring + click) * 2.6)
    save("m_boom", reverb(boom, 0.5, dur=2.8, decay=1.0, damp=2500), 0.95)

    # --- whoopee-cushion fart (with the squeak at the end)
    dur = 1.7
    t = t_axis(dur)
    wob = np.convolve(rng.standard_normal(len(t)), np.ones(2000) / 2000, "same") * 40
    f = 82 + 22 * np.sin(2 * np.pi * 3.3 * t) + wob
    tail = np.clip((t - 1.3) / 0.35, 0, 1)
    f = f * (1 + tail * 2.4)
    src = osc_sq(f, 0.22)
    amp = (0.55 + 0.45 * np.sin(2 * np.pi * 9 * t + np.sin(2 * np.pi * 2 * t))) * adsr(dur, 0.03, 0.08)
    amp *= 1 - 0.6 * np.clip((t - 1.45) / 0.25, 0, 1)
    fart = biquad(src * amp, "lp", 1000) + biquad(noise(dur) * amp, "bp", 260, 0.8) * 0.35
    fart = biquad(fart, "peak", 180, 1.0, 6)
    save("m_fart", reverb(fart, 0.12, dur=0.8, decay=0.25), 0.9)

    # --- airhorn: buh buh BUHHHHHH
    def blast(dur):
        t = t_axis(dur)
        bend = 1 - 0.04 * np.exp(-t / 0.04)
        v = sum(osc_saw(np.full(len(t), fr) * bend * (1 + 0.004 * np.sin(2 * np.pi * 5.5 * t + k))) for k, fr in enumerate((415.0, 523.0, 622.0, 830.0)))
        v = np.tanh(v * 1.4)
        v = biquad(biquad(v, "peak", 1700, 1.2, 9), "lp", 6500)
        return v * adsr(dur, 0.008, 0.04)
    x = np.zeros(int(2.0 * SR))
    place(x, blast(0.14), 0.0)
    place(x, blast(0.14), 0.22)
    place(x, blast(1.05), 0.44)
    save("m_airhorn", reverb(x, 0.2, dur=1.2, decay=0.4), 0.92)

    # --- sad trombone: wah wah wah wahhhhh
    notes = [(233.1, 0.45), (220.0, 0.45), (207.7, 0.45), (196.0, 1.7)]
    x = np.zeros(int(3.4 * SR))
    at = 0.0
    for i, (fr, d) in enumerate(notes):
        t = t_axis(d)
        vib = 1 + (0.02 * np.sin(2 * np.pi * 5.5 * t) * np.clip((t - 0.3) / 0.4, 0, 1) if i == 3 else 0)
        v = osc_saw(np.full(len(t), fr) * vib) + 0.3 * osc_sq(np.full(len(t), fr * vib), 0.5)
        cut = 350 + 1400 * np.sin(np.pi * np.clip(t / min(d, 0.45), 0, 1)) ** 0.8
        if i == 3:
            cut = 350 + 1300 * (0.55 + 0.45 * np.sin(2 * np.pi * 2.7 * t)) * np.exp(-t / 1.6)
        v = svf(v, cut, 1.4) * adsr(d, 0.03, 0.12)
        place(x, v, at)
        at += d + 0.04
    save("m_trombone", reverb(x, 0.25, dur=1.4, decay=0.45), 0.85)

    # --- record scratch
    x = np.zeros(int(1.3 * SR))
    for at, d, f0, f1 in ((0.0, 0.16, 900, 3800), (0.2, 0.14, 3400, 700), (0.42, 0.42, 3000, 300)):
        t = t_axis(d)
        fc = f0 + (f1 - f0) * (t / d) ** 0.7
        z = svf(noise(d), fc, 3.0, "bp") * 2.0 + osc_saw(fc * 0.08) * 0.2
        place(x, z * adsr(d, 0.005, 0.03), at)
    save("m_scratch", x + biquad(noise(1.3), "hp", 3000) * 0.015, 0.85)

    # --- crickets (awkward silence)
    dur = 4.5
    x = np.zeros(int(dur * SR))
    for fr, per, off in ((4700.0, 0.58, 0.1), (5300.0, 0.71, 0.37)):
        at = off
        while at < dur - 0.3:
            for k in range(3):
                pt = t_axis(0.018)
                place(x, osc_sin(np.full(len(pt), fr)) * np.sin(np.pi * pt / 0.018) ** 2 * 0.5, at + k * 0.032)
            at += per + rng.uniform(-0.04, 0.04)
    save("m_crickets", reverb(x, 0.3, dur=1.5, decay=0.5), 0.55)

    # --- dun dun DUNNNN
    def stab(freqs, d, trem=False):
        t = t_axis(d)
        v = sum(osc_saw(np.full(len(t), fr) * (1 + 0.003 * np.sin(2 * np.pi * (4.8 + k) * t))) for k, fr in enumerate(freqs))
        if trem:
            v *= 0.75 + 0.25 * np.sin(2 * np.pi * 9 * t)
        v = biquad(v, "lp", 1800) * adsr(d, 0.01, 0.25 if trem else 0.08)
        tim = osc_sin(70 + 40 * np.exp(-t / 0.03)) * np.exp(-t / 0.35) * 1.8
        return v + tim
    x = np.zeros(int(3.6 * SR))
    place(x, stab((65.4, 130.8, 155.6, 196.0, 261.6), 0.32), 0.0)
    place(x, stab((65.4, 130.8, 155.6, 196.0, 261.6), 0.32), 0.48)
    place(x, stab((46.2, 92.5, 110.0, 130.8, 185.0), 2.3, True), 1.0)
    save("m_dun", reverb(np.tanh(x * 0.6), 0.4, dur=2.5, decay=0.9), 0.92)

    # --- metal pipe falling on the floor
    def clang(d=2.4, seed=0):
        t = t_axis(d)
        r = np.random.default_rng(seed)
        v = np.zeros(len(t))
        for fr, dec, a in ((523, 1.5, 1.0), (531, 1.4, 0.7), (812, 1.2, 0.6), (1270, 0.9, 0.55), (2380, 0.6, 0.4), (3570, 0.4, 0.3), (4870, 0.25, 0.25)):
            v += np.sin(2 * np.pi * fr * (1 + r.uniform(-0.01, 0.01)) * t + r.uniform(0, 6)) * np.exp(-t / dec) * a
        hit = biquad(noise(0.03), "hp", 1500) * env_exp(0.03, 0.008)
        v[: len(hit)] += hit * 3
        return v
    x = np.zeros(int(3.4 * SR))
    for k, (at, a) in enumerate(((0.0, 1.0), (0.34, 0.55), (0.56, 0.32), (0.7, 0.18), (0.79, 0.1))):
        place(x, clang(2.5, k) * a, at)
    save("m_pipe", reverb(np.tanh(x * 1.3), 0.35, dur=2.2, decay=0.7), 0.92)

    # --- clown horn: honk honk
    def honk(d=0.26):
        t = t_axis(d)
        f = 400 * (1 - 0.12 * t / d)
        v = np.tanh(osc_sq(f, 0.35) * 2 + osc_saw(f * 1.5) * 0.4)
        v = biquad(biquad(v, "bp", 1300, 1.5), "peak", 650, 1.0, 6)
        return v * adsr(d, 0.01, 0.04)
    x = np.zeros(int(0.85 * SR))
    place(x, honk(), 0.0)
    place(x, honk(), 0.38)
    save("m_honk", reverb(x, 0.15, dur=0.7, decay=0.25), 0.85)

    # --- slide whistle up... and down
    d = 1.3
    t = t_axis(d)
    f = np.where(t < 0.5, 520 + 1300 * (t / 0.5) ** 1.3, 1820 - 1250 * np.clip((t - 0.5) / 0.8, 0, 1) ** 0.8)
    f = f * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    v = osc_sin(f) * 0.8 + svf(noise(d), f, 4.0, "bp") * 0.5
    save("m_slide", v * adsr(d, 0.03, 0.08), 0.75)

    # --- desk slap (he wakes a sleeper up)
    d = 0.9
    t = t_axis(d)
    slap = biquad(noise(d), "bp", 1400, 0.8) * np.exp(-t / 0.018) * 2
    body = (osc_sin(140 + 60 * np.exp(-t / 0.02)) + 0.5 * osc_sin(np.full(len(t), 310.0))) * np.exp(-t / 0.09)
    save("desk_slap", reverb(slap + body, 0.3, dur=1.2, decay=0.4), 0.95)



def make_v3():
    # school PA chime: three soft tones through a cheap speaker, with hiss
    x = np.zeros(int(2.6 * SR))
    for at, fr in ((0.0, 784.0), (0.45, 659.3), (0.9, 523.3)):
        t = t_axis(1.4)
        tone = (np.sin(2 * np.pi * fr * t) + 0.35 * np.sin(2 * np.pi * fr * 2 * t) + 0.12 * np.sin(2 * np.pi * fr * 3 * t)) * np.exp(-t / 0.5)
        place(x, tone * adsr(1.4, 0.01, 0.3), at)
    x += biquad(noise(len(x) / SR), "bp", 2200, 0.7) * 0.03
    x = biquad(biquad(x, "hp", 450), "lp", 3400)
    save("pa_chime", reverb(np.tanh(x * 1.5), 0.35, dur=1.6, decay=0.7), 0.8)
    # the speaker cable ripped out: crackle, a fat spark and a dying buzz
    d = 1.4
    t = t_axis(d)
    crackle = noise(d) * (rng.random(len(t)) < 0.02) * 3
    buzz = osc_saw(np.full(len(t), 120.0)) * np.exp(-t / 0.35) * 0.4
    spark = biquad(noise(d), "hp", 2500) * np.exp(-t / 0.06)
    save("pa_rip", biquad(crackle * np.exp(-t / 0.5), "bp", 3000, 0.5) + buzz + spark, 0.9)
    # power coming back: relays clunk and the hum rises
    d = 1.8
    t = t_axis(d)
    clunk = biquad(noise(0.05), "lp", 600) * env_exp(0.05, 0.015)
    hum = (osc_sin(np.full(len(t), 120.0)) + 0.4 * osc_saw(np.full(len(t), 240.0))) * np.clip(t / 1.2, 0, 1) * np.exp(-np.clip(t - 1.2, 0, None) / 0.4) * 0.25
    x = np.zeros(len(t))
    place(x, clunk, 0.0); place(x, clunk * 0.7, 0.18); place(x, clunk * 0.5, 0.4)
    save("power_up", reverb(x + hum, 0.3, dur=1.2, decay=0.4), 0.8)


# ----------------------------------------------------------------- v4: meme clips + phone game
def nfreq(semi):
    """semitones from A4"""
    return 440.0 * 2 ** (semi / 12)


def kick(d=0.45, f0=150, f1=45):
    t = t_axis(d)
    f = f1 + (f0 - f1) * np.exp(-t / 0.04)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16) + biquad(noise(d), "lp", 2000) * np.exp(-t / 0.004) * 0.3


def snare(d=0.25):
    t = t_axis(d)
    return biquad(noise(d), "bp", 1900, 0.8) * np.exp(-t / 0.07) + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5


def hat(d=0.06, open_=False):
    t = t_axis(d if not open_ else 0.25)
    return biquad(noise(len(t) / SR), "hp", 7500) * np.exp(-t / (0.02 if not open_ else 0.09))


def clap808(d=0.3):
    x = np.zeros(int(d * SR))
    for k, at in enumerate((0, 0.011, 0.022)):
        t = t_axis(0.2)
        place(x, biquad(noise(0.2), "bp", 1300, 1.2) * np.exp(-t / (0.008 if k < 2 else 0.06)), at)
    return x


def bass808(f, d):
    t = t_axis(d)
    return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(np.full(len(t), f) * (1 + 0.04 * np.exp(-t / 0.05))) / SR)) * np.clip((d - t) / 0.03, 0, 1) * np.exp(-t / (d * 1.4))


def cowbell(f, d=0.22):
    t = t_axis(d)
    x = osc_sq(np.full(len(t), f)) + osc_sq(np.full(len(t), f * 1.48))
    return biquad(x, "bp", f * 1.6, 1.5) * np.exp(-t / 0.07) * 1.6


def pluck(f, d=0.5, bright=1.0):
    t = t_axis(d)
    x = np.zeros(len(t))
    for h in range(1, 9):
        x += np.sin(2 * np.pi * f * h * t) * (bright ** h) / h * np.exp(-t * (3 + h * 2.2))
    return x * np.clip(t / 0.002, 0, 1)


def rhodes(f, d=1.2):
    t = t_axis(d)
    x = np.sin(2 * np.pi * f * t + 0.6 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.3))
    return x * np.exp(-t / 0.9) * (1 + 0.15 * np.sin(2 * np.pi * 4.5 * t)) * np.clip(t / 0.005, 0, 1)


def saw_note(f, d, cutoff=2500, vib=0.0):
    t = t_axis(d)
    fr = f * (1 + vib * np.sin(2 * np.pi * 5.5 * t))
    return biquad(osc_saw(fr), "lp", cutoff) * adsr(d, 0.01, 0.04)


def kazoo(f, d):
    t = t_axis(d)
    fr = f * (1 + 0.012 * np.sin(2 * np.pi * 6 * t))
    x = np.tanh(3 * osc_saw(fr))
    x = biquad(x, "bp", 900, 2.5) * 1.2 + biquad(x, "bp", 2300, 3) * 0.8 + biquad(noise(d), "bp", 1500, 1) * 0.12
    return x * adsr(d, 0.02, 0.05)


def seq_render(total, events):
    """events: (time, sound array, gain); render twice so tails wrap, return the second copy (seamless loop)"""
    x = np.zeros(int(total * 2 * SR) + SR)
    for at, snd, g in events:
        place(x, snd * g, at)
        place(x, snd * g, at + total)
    n = int(total * SR)
    return x[n:2 * n]


def make_v4():
    # ---- PHONK: cowbell riff, sliding 808, trap hats (120 bpm, 4 bars = 8 s)
    b = 0.5
    ev = []
    riff = [0, None, 0, 3, None, 0, 5, 3, 0, None, 0, 3, None, 7, 5, 3]
    for bar in range(4):
        base = bar * 4 * b
        shift = [0, 0, -2, 1][bar]
        for i, n in enumerate(riff):
            if n is not None:
                ev.append((base + i * b / 4, cowbell(nfreq(n + shift + 3), 0.2), 0.5))
        for i in range(16):
            ev.append((base + i * b / 4, hat(), 0.18 if i % 2 else 0.28))
        if bar % 2 == 1:
            for k in range(6):
                ev.append((base + 3.5 * b + k * b / 12, hat(), 0.16))
        ev.append((base, kick(), 1.0)); ev.append((base + 1.5 * b, kick(), 0.8)); ev.append((base + 2.75 * b, kick(), 0.7))
        ev.append((base + 2 * b, clap808(), 0.7))
        ev.append((base, bass808(nfreq(-33 + shift), 1.4), 0.6)); ev.append((base + 2.5 * b, bass808(nfreq(-30 + shift), 0.9), 0.55))
    x = seq_render(8 * b * 2, ev)
    save("v_phonk", np.tanh(x * 1.6), 0.85, "80k")

    # ---- LO-FI: soft chords, lazy drums, vinyl crackle (84 bpm, 4 bars)
    b = 60 / 84
    ev = []
    chords = [[-9, -5, -2, 2], [-11, -7, -4, 0], [-4, 0, 3, 7], [-6, -2, 1, 5]]
    for bar, ch in enumerate(chords):
        base = bar * 4 * b
        for k, n in enumerate(ch):
            ev.append((base + k * 0.02, rhodes(nfreq(n - 12), 4 * b), 0.22))
        ev.append((base, kick(0.4, 110, 45), 0.7)); ev.append((base + 2.5 * b, kick(0.4, 110, 45), 0.5))
        ev.append((base + b, snare(), 0.35)); ev.append((base + 3 * b, snare(), 0.35))
        for i in range(8):
            ev.append((base + i * b / 2 + (0.03 if i % 2 else 0), hat(), 0.12))
    total = 16 * b
    x = seq_render(total, ev)
    crackle = (rng.random(len(x)) < 0.0015) * rng.standard_normal(len(x)) * 0.5
    x = biquad(x, "lp", 3800) + biquad(crackle, "hp", 1500) + biquad(noise(len(x) / SR), "lp", 600) * 0.02
    save("v_lofi", x, 0.7, "64k")

    # ---- EURO dance: four on the floor, offbeat bass, saw arp (150 bpm, 4 bars)
    b = 0.4
    ev = []
    prog = [0, -4, 3, -2]
    for bar in range(4):
        base = bar * 4 * b
        r = prog[bar]
        for i in range(4):
            ev.append((base + i * b, kick(0.3), 0.9))
            ev.append((base + i * b + b / 2, saw_note(nfreq(r - 24), b / 2 * 0.9, 900), 0.45))
            ev.append((base + i * b + b / 2, hat(open_=True), 0.18))
        for i in range(16):
            n = r + [0, 7, 12, 7, 3, 7, 12, 15][i % 8]
            ev.append((base + i * b / 4, saw_note(nfreq(n), b / 4 * 0.8, 3500), 0.16))
        ev.append((base + b, clap808(), 0.4)); ev.append((base + 3 * b, clap808(), 0.4))
    save("v_euro", seq_render(16 * b, ev), 0.85, "80k")

    # ---- KAZOO chase: oom-pah bass and a silly buzzing tune (160 bpm)
    b = 60 / 160
    ev = []
    tune = [7, 7, 9, 7, 12, 11, None, 7, 7, 9, 7, 14, 12, None, 7, 7, 19, 16, 12, 11, 9, None, 17, 17, 16, 12, 14, 12, None, None]
    for i, n in enumerate(tune):
        if n is not None:
            ev.append((i * b / 2 * 1.0, kazoo(nfreq(n - 12), b / 2 * 0.9), 0.5))
    for i in range(16):
        ev.append((i * b, pluck(nfreq([-21, -14][i % 2] + (5 if i // 4 % 2 else 0)), 0.3, 0.5), 0.6 if i % 2 == 0 else 0.4))
        if i % 2:
            ev.append((i * b, snare(0.12), 0.2))
    save("v_kazoo", seq_render(16 * b, ev), 0.85, "80k")

    # ---- MANDOLIN tarantella (the "brainrot" sound): tremolo picking over a bouncy bass (6/8)
    e = 0.2  # one eighth
    ev = []
    mel = [5, 4, 5, 7, 5, 4, 2, 0, 2, 4, 2, 0, -1, -3, -1, 0, -1, -3, -5, -3, -1, 0, 2, 4]
    for i, n in enumerate(mel):
        for k in range(3):  # tremolo
            ev.append((i * e * 2 + k * e * 2 / 3, pluck(nfreq(n), 0.3, 0.75), 0.3))
    for bar in range(8):
        r = [-21, -21, -16, -21, -14, -16, -21, -16][bar]
        ev.append((bar * 6 * e, pluck(nfreq(r), 0.4, 0.4), 0.7)); ev.append((bar * 6 * e + 3 * e, pluck(nfreq(r + 7), 0.4, 0.4), 0.55))
        for k in (1, 2, 4, 5):
            ev.append((bar * 6 * e + k * e, hat(), 0.12))
        ev.append((bar * 6 * e, kick(0.3, 120, 50), 0.6))
    save("v_mando", seq_render(48 * e, ev), 0.85, "80k")

    # ---- "to be continued" funk riff (one shot)
    b = 0.6
    x = np.zeros(int(5.2 * SR))
    riff = [(0, -24), (0.75, -24), (1.5, -21), (2, -19), (2.5, -17), (3, -16), (3.25, -17), (3.5, -19), (4, -24)]
    for at, n in riff:
        place(x, np.tanh(2 * pluck(nfreq(n), 0.5, 0.6)), at * b)
    for i in range(8):
        place(x, hat(), i * b / 2 * 1.0); place(x, kick(0.3), i * b if i < 4 else 99)
    place(x, snare(), b); place(x, snare(), 3 * b)
    save("v_tbc", reverb(x, 0.15, dur=1.0, decay=0.3), 0.85, "80k")

    # ---- cartoon one-shots
    d = 0.25; t = t_axis(d)
    save("v_bonk", (np.sin(2 * np.pi * 620 * t) + 0.5 * np.sin(2 * np.pi * 1450 * t)) * np.exp(-t / 0.045) + biquad(noise(d), "bp", 2500) * np.exp(-t / 0.01), 0.9)
    d = 1.0; t = t_axis(d)
    save("v_splash", svf(noise(d) * np.exp(-t / 0.3), 3000 * np.exp(-t / 0.4) + 300, 0.8, "lp") + biquad(noise(d), "hp", 4000) * np.exp(-t / 0.12) * 0.4, 0.85)
    d = 0.12; t = t_axis(d)
    save("v_pop", np.sin(2 * np.pi * np.cumsum(400 + 2400 * t / d) / SR) * np.exp(-t / 0.03), 0.8)
    d = 0.9; t = t_axis(d)
    f0 = 520 + 300 * np.sin(np.pi * np.clip(t / 0.75, 0, 1)) ** 0.7
    m = osc_saw(f0) * adsr(d, 0.03, 0.2)
    save("v_meow", svf(m, 900 + 1500 * np.sin(np.pi * np.clip(t / 0.8, 0, 1)), 3, "bp") * 1.5 + biquad(m, "bp", 3200, 3) * 0.3, 0.85)
    x = np.zeros(int(0.8 * SR))
    for at in (0.0, 0.32):
        tt = t_axis(0.18)
        b1 = np.tanh(3 * osc_saw(np.full(len(tt), 330.0) * (1 - tt))) * np.exp(-tt / 0.06) + biquad(noise(0.18), "bp", 1200, 1) * np.exp(-tt / 0.05)
        place(x, biquad(b1, "bp", 900, 1.2) * 1.5, at)
    save("v_bark", x, 0.85)
    x = np.zeros(int(0.7 * SR))
    for at in (0.0, 0.3):
        tt = t_axis(0.22)
        q = osc_saw(np.full(len(tt), 260.0) * (1 + 0.3 * tt)) * np.clip(tt / 0.01, 0, 1) * np.exp(-tt / 0.12)
        place(x, biquad(q, "bp", 1250, 4) * 2.5 + biquad(q, "bp", 2600, 5), at)
    save("v_quack", x, 0.85)
    # applause: hundreds of little claps
    d = 3.2
    x = np.zeros(int(d * SR))
    for i in range(700):
        at = rng.random() * (d - 0.2)
        tt = t_axis(0.03)
        place(x, biquad(noise(0.03), "bp", rng.uniform(900, 2500), 1.0) * np.exp(-tt / 0.006) * rng.uniform(0.3, 1), at)
    x *= np.clip(t_axis(d) / 0.3, 0, 1) * np.clip((d - t_axis(d)) / 1.0, 0, 1)
    save("v_applause", reverb(x, 0.2, dur=1.0, decay=0.4), 0.8)
    # sitcom laugh: a crowd of "ha ha ha"
    d = 3.0
    x = np.zeros(int(d * SR))
    for v in range(16):
        f = rng.uniform(110, 300)
        start = rng.uniform(0, 0.5)
        n = int(rng.integers(4, 9))
        rate = rng.uniform(4.5, 6.5)
        for k in range(n):
            tt = t_axis(0.12)
            ff = f * (1.12 - 0.05 * k / n)
            h = osc_saw(np.full(len(tt), ff)) * np.sin(np.pi * tt / 0.12) ** 2
            h = biquad(h, "bp", 750, 2) * 1.3 + biquad(h, "bp", 1250, 3) + biquad(noise(0.12), "bp", 1500, 1) * 0.15 * np.sin(np.pi * tt / 0.12)
            place(x, h * (1 - k / (n + 2)), start + k / rate)
    x *= np.clip((d - t_axis(d)) / 1.4, 0, 1)
    save("v_laugh", reverb(x, 0.25, dur=1.2, decay=0.5), 0.8)
    d = 2.2; t = t_axis(d)
    save("v_explode", np.tanh(2 * (svf(noise(d), 4000 * np.exp(-t / 0.35) + 120, 0.7, "lp") * np.exp(-t / 0.6) + kick(d, 80, 30) * 1.5)), 0.95)
    # ---- the phone game
    d = 0.07; t = t_axis(d)
    save("phone_flap", osc_sq(np.full(len(t), 1.0) * (700 + 900 * t / d), 0.3) * np.exp(-t / 0.03) * 0.5, 0.5)
    d = 0.14; t = t_axis(d)
    save("phone_point", (osc_sq(np.where(t < 0.06, 988.0, 1319.0), 0.25)) * np.exp(-t / 0.08) * 0.5, 0.55)
    # crash: LOUD. A crunch, then a sad descending "wah wah wah waaaah" at full volume, with the phone buzzing
    x = np.zeros(int(3.0 * SR))
    tt = t_axis(0.35)
    place(x, np.tanh(4 * biquad(noise(0.35), "lp", 3000) * np.exp(-tt / 0.08)) + osc_sq(np.full(len(tt), 110.0)) * np.exp(-tt / 0.1), 0)
    for k, (n, dd) in enumerate(((-2, 0.32), (-3, 0.32), (-4, 0.32), (-5, 1.2))):
        tt = t_axis(dd)
        fr = nfreq(n) * (1 + (0.03 * np.sin(2 * np.pi * 7 * tt) if k == 3 else 0))
        note = (osc_sq(fr, 0.5) * 0.6 + osc_saw(fr * 0.5) * 0.4) * adsr(dd, 0.01, 0.08)
        place(x, note, 0.35 + k * 0.34)
    tt = t_axis(2.6)
    buzz = osc_sq(np.full(len(tt), 160.0)) * (np.sin(2 * np.pi * 9 * tt) > 0) * 0.25
    place(x, biquad(buzz, "lp", 900), 0.3)
    save("phone_fail", np.tanh(x * 2.2), 0.97, "96k")


def crinkle(dur, density, lo=1800, hi=6500, seed=0):
    """paper: lots of tiny dry crackles"""
    r = np.random.default_rng(seed)
    x = np.zeros(int(dur * SR))
    n = int(density * dur)
    for _ in range(n):
        at = r.random() * (dur - 0.02)
        d = r.uniform(0.002, 0.012)
        tt = t_axis(d)
        click = biquad(r.standard_normal(len(tt)), "bp", r.uniform(lo, hi), r.uniform(0.8, 2.5)) * np.exp(-tt / (d * 0.3))
        place(x, click * r.uniform(0.2, 1.0), at)
    return x


def make_v5():
    """pranks: crumpling paper, folding a plane, the throw, the hits, the class laughing"""
    # crumple a sheet into a ball: crackles that get denser, then a squeeze
    d = 0.6; t = t_axis(d)
    x = crinkle(d, 260, seed=11) * (0.35 + 0.65 * np.sin(np.pi * np.clip(t / d, 0, 1)))
    x += biquad(noise(d), "bp", 900, 0.8) * 0.06 * np.exp(-((t - 0.45) / 0.08) ** 2)
    save("prank_crumple", x, 0.6)
    # fold a paper plane: three crisp creases with a slide of the fingers between them
    d = 0.75
    x = np.zeros(int(d * SR))
    for k, at in enumerate((0.05, 0.3, 0.52)):
        tt = t_axis(0.16)
        slide = biquad(noise(0.16), "bp", 2400 + 500 * k, 1.2) * np.sin(np.pi * tt / 0.16) * 0.22
        place(x, slide, at)
        place(x, crinkle(0.06, 900, 2500, 7000, seed=20 + k) * 1.2, at + 0.12)
    save("prank_fold", x, 0.55)
    # the throw: a soft swish of air
    d = 0.32; t = t_axis(d)
    x = svf(noise(d), 500 + 2600 * (t / d), 1.4, "bp") * np.sin(np.pi * t / d) ** 2
    save("prank_swish", x, 0.5)
    # a paper ball hits a person: a soft thump with a crinkle
    d = 0.22; t = t_axis(d)
    x = biquad(noise(d), "lp", 700) * np.exp(-t / 0.025) * 1.4 + crinkle(d, 300, seed=31) * 0.5 * np.exp(-t / 0.06)
    x += osc_sin(np.full(len(t), 140.0)) * np.exp(-t / 0.03) * 0.5
    save("prank_hit", x, 0.75)
    # a paper ball hits the chalkboard: a hollow tok
    d = 0.5; t = t_axis(d)
    x = osc_sin(np.full(len(t), 185.0)) * np.exp(-t / 0.06) + osc_sin(np.full(len(t), 410.0)) * np.exp(-t / 0.03) * 0.5
    x += biquad(noise(d), "bp", 1400, 1.0) * np.exp(-t / 0.01) * 0.8 + crinkle(d, 200, seed=41) * 0.4 * np.exp(-t / 0.05)
    save("prank_board", reverb(x, 0.25, dur=0.8, decay=0.6), 0.8)
    # tapping a desk or the floor
    d = 0.12; t = t_axis(d)
    x = biquad(noise(d), "bp", 2200, 1.5) * np.exp(-t / 0.008) + crinkle(d, 200, seed=51) * 0.3
    save("prank_tick", x, 0.4)
    # you got hit: a cartoon "bop"
    d = 0.35; t = t_axis(d)
    x = osc_sin(620 * np.exp(-t / 0.12) + 180) * np.exp(-t / 0.09) + crinkle(d, 260, seed=61) * 0.35 * np.exp(-t / 0.08)
    save("bonk", x, 0.8)
    # the whole class laughing (kids, not a sitcom): many short "ha"s, higher voices, a big room
    d = 3.4
    x = np.zeros(int(d * SR))
    r = np.random.default_rng(71)
    for v in range(22):
        f = r.uniform(230, 430)
        start = r.uniform(0, 0.7)
        n = int(r.integers(4, 11))
        rate = r.uniform(5.0, 7.5)
        form = r.uniform(900, 1300)
        for k in range(n):
            tt = t_axis(0.1)
            ff = f * (1.1 - 0.06 * k / n) * r.uniform(0.97, 1.03)
            h = osc_saw(np.full(len(tt), ff)) * np.sin(np.pi * tt / 0.1) ** 2
            h = biquad(h, "bp", form, 2) * 1.2 + biquad(h, "bp", form * 2.1, 3) * 0.6 + biquad(noise(0.1), "bp", 2400, 1) * 0.2 * np.sin(np.pi * tt / 0.1)
            place(x, h * (1 - k / (n + 3)) * r.uniform(0.5, 1.0), start + k / rate)
    x *= np.clip(t_axis(d) / 0.05, 0, 1) * np.clip((d - t_axis(d)) / 1.6, 0, 1)
    save("class_laugh", reverb(x, 0.35, dur=1.4, decay=0.5), 0.8)


def make_v6():
    """playing online: a friend sits down in the lobby, every try to connect, could not get in.
    Uses its own random numbers, so building only this group gives the same files."""
    r = np.random.default_rng(91)

    def nz(d):
        return r.standard_normal(int(d * SR))

    def wow(x, depth=0.003):
        tt = np.arange(len(x)) / SR
        warp = tt + depth * np.sin(2 * np.pi * 0.5 * tt) + depth * 0.4 * np.sin(2 * np.pi * 2.3 * tt)
        return np.interp(warp * SR, np.arange(len(x)), x)

    # a friend sat down: two soft knocks on a wooden desk, then two notes from the title's music box
    d = 1.7
    x = np.zeros(int(d * SR))
    for k, at in enumerate((0.0, 0.11)):
        tt = t_axis(0.14)
        knock = biquad(nz(0.14), "bp", 420 + 70 * k, 3.0) * np.exp(-tt / 0.016) + osc_sin(np.full(len(tt), 150.0 + 25 * k)) * np.exp(-tt / 0.03) * 0.7
        place(x, knock * (1.0 - 0.3 * k), at)
    place(x, music_box_note(1318.5, 1.3) * 0.5, 0.27)    # E6
    place(x, music_box_note(1760.0, 1.2) * 0.42, 0.45)   # A6: a fourth up, "here"
    save("net_join", reverb(wow(x), 0.3, dur=1.4, decay=0.5), 0.6)

    # every try to connect: a small ping and its echo, like calling into an empty hallway
    d = 1.0
    tt = t_axis(d)
    ping = osc_sin(np.full(len(tt), 1046.5)) * np.exp(-tt / 0.07) + 0.3 * osc_sin(np.full(len(tt), 2101.0)) * np.exp(-tt / 0.025)
    ping[: int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
    x = ping.copy()
    place(x, ping * 0.32, 0.19)
    place(x, ping * 0.12, 0.38)
    save("net_try", reverb(biquad(x, "lp", 5000), 0.3, dur=1.0, decay=0.5), 0.4)

    # could not get in: two music-box notes falling out of tune, a low hum under them
    d = 2.4
    x = np.zeros(int(d * SR))
    place(x, music_box_note(659.25 * 1.006, 1.6) * 0.5, 0.0)    # E5, a little sharp
    place(x, music_box_note(587.33 * 0.982, 1.9) * 0.5, 0.34)   # D5, flat: wrong
    tt = t_axis(d)
    hum = (osc_sin(np.full(len(tt), 73.4)) + 0.45 * osc_sin(np.full(len(tt), 147.9))) * np.sin(np.pi * tt / d) ** 2 * 0.22
    x += biquad(hum + nz(d) * 0.01, "lp", 420)
    save("net_fail", reverb(wow(x, 0.006), 0.4, dur=1.8, decay=0.7), 0.55)


def make_v7():
    """a different teacher every class: his embarrassing ringtone, the voice in his phone, a fly, the
    pizza at the door, the fire alarm, his humming and snoring, the class chatting while he is out.
    Uses its own random numbers, so building only this group gives the same files."""
    r = np.random.default_rng(97)

    def nz(d):
        return r.standard_normal(int(d * SR))

    # his ringtone: a cheesy old-phone jingle (an original tune), pulse lead, bouncy bass, a "boing" at the end
    beat = 0.2
    lead = [(15, 1), (15, 1), (19, 1), (22, 1), (24, 2), (22, 1), (19, 1), (17, 1), (17, 1), (20, 1), (24, 1), (22, 2), None, (10, 1)]
    ev = []
    at = 0.0
    for n in lead:
        if n is None:
            at += beat
            continue
        semi, beats = n
        d = beats * beat * 0.92
        tt = t_axis(d)
        f = np.full(len(tt), nfreq(semi)) * (1 + 0.006 * np.sin(2 * np.pi * 7 * tt))
        tone = biquad(osc_sq(f, 0.25), "lp", 3200) * adsr(d, 0.004, 0.03)
        tone += osc_sin(f * 2) * 0.15 * adsr(d, 0.004, 0.03)
        ev.append((at, tone, 0.5))
        at += beats * beat
    total = 16 * beat
    for k in range(8):
        tt = t_axis(0.16)
        semi = [-9, -2, -9, -2, -7, 0, -7, -5][k]
        bass = osc_sq(np.full(len(tt), nfreq(semi - 12)), 0.5) * np.exp(-tt / 0.07)
        ev.append((k * 2 * beat, biquad(bass, "lp", 900), 0.35))
    tt = t_axis(0.5)
    boing = osc_sin(330 * (1 + 0.5 * np.exp(-tt / 0.05)) * (1 + 0.06 * np.sin(2 * np.pi * 18 * tt))) * np.exp(-tt / 0.18)
    ev.append((13.5 * beat, boing, 0.45))
    x = seq_render(total, ev)
    save("madi_ring", biquad(x, "hp", 300) * 0.9 + biquad(x, "bp", 2400, 0.8) * 0.3, 0.75, "64k")

    # the tiny voice in his phone: "wah-wah" syllables, a phone speaker (no bass, no highs)
    d = 2.0
    x = np.zeros(int(d * SR))
    at = 0.05
    while at < d - 0.25:
        sd = r.uniform(0.09, 0.2)
        tt = t_axis(sd)
        f0 = r.uniform(170, 260) * (1 + 0.15 * np.sin(np.pi * tt / sd))
        syl = osc_saw(f0)
        form = r.uniform(600, 1100)
        syl = biquad(syl, "bp", form, 3) + biquad(syl, "bp", form * 2.2, 4) * 0.5
        place(x, syl * np.sin(np.pi * tt / sd) ** 1.5 * r.uniform(0.5, 1), at)
        at += sd + r.uniform(0.02, 0.12)
    x = biquad(biquad(x, "hp", 450), "lp", 2800)
    save("phone_voice", np.tanh(x * 2.5), 0.5, "48k")

    # a dead line: crackles and hiss, and far under it a slow low voice
    d = 2.2
    tt = t_axis(d)
    x = biquad(nz(d), "bp", 1800, 0.7) * 0.25 * (0.6 + 0.4 * np.sin(2 * np.pi * 0.7 * tt))
    for _ in range(40):
        place(x, biquad(nz(0.01), "hp", 3000) * r.uniform(0.3, 1.0), r.uniform(0, d - 0.02))
    low = osc_saw(85 * (1 + 0.04 * np.sin(2 * np.pi * 0.9 * tt)))
    low = biquad(low, "bp", 420, 3) * 0.35 * np.sin(np.pi * tt / d) ** 2
    save("phone_static", biquad(x + low, "hp", 300), 0.45, "48k")

    # a fly: wings at ~200 Hz that never quite keep the same speed, louder and softer as it turns
    d = 1.6
    tt = t_axis(d)
    f = 205 + 14 * np.sin(2 * np.pi * 1.25 * tt) + 9 * np.sin(2 * np.pi * 3.75 * tt + 1) + 4 * np.sin(2 * np.pi * 11.25 * tt)
    wing = osc_saw(f) + 0.5 * osc_saw(f * 2.003)
    x = biquad(wing, "bp", 520, 1.2) + biquad(wing, "bp", 1600, 2.0) * 0.35
    x *= 0.75 + 0.25 * np.sin(2 * np.pi * 2.5 * tt)
    loop_save("fly_buzz", x, 0.3, peak=0.6, bitrate="48k")

    # ...swatted: a tiny wet tick
    d = 0.3
    tt = t_axis(d)
    x = biquad(nz(d), "bp", 2600, 2) * np.exp(-tt / 0.012) + osc_sin(900 * np.exp(-tt / 0.03) + 200) * np.exp(-tt / 0.04) * 0.4
    save("fly_splat", x, 0.5, "48k")

    # three knocks on the classroom door (wood, the empty hallway behind it)
    d = 1.3
    x = np.zeros(int(d * SR))
    for k, at in enumerate((0.0, 0.28, 0.5)):
        tt = t_axis(0.2)
        knock = biquad(nz(0.2), "bp", 380 + 40 * k, 2.5) * np.exp(-tt / 0.02) * 1.4 + osc_sin(np.full(len(tt), 120.0)) * np.exp(-tt / 0.045)
        knock += biquad(nz(0.2), "bp", 1700, 1.5) * np.exp(-tt / 0.006) * 0.5
        place(x, knock * (1.0 if k < 2 else 1.15), at)
    save("door_knock", reverb(x, 0.35, dur=1.2, decay=0.5), 0.85)

    # a pizza box: the lid flaps up, cardboard rubs
    d = 0.75
    tt = t_axis(d)
    x = biquad(nz(d), "lp", 500) * np.exp(-tt / 0.03) * 1.3
    x += biquad(nz(d), "bp", 1200, 0.8) * 0.3 * np.exp(-((tt - 0.25) / 0.12) ** 2)
    x += crinkle(d, 80, 900, 3000, seed=171) * 0.4 * np.exp(-tt / 0.3)
    save("pizza_box", x, 0.6, "48k")

    # chewing: a crunch, then wet squishy bites
    d = 1.7
    x = np.zeros(int(d * SR))
    for k, at in enumerate((0.0, 0.42, 0.8, 1.18)):
        bd = 0.28
        tt = t_axis(bd)
        bite = biquad(nz(bd), "bp", 900 if k else 2600, 1.2) * np.exp(-tt / (0.05 if k else 0.03))
        bite += biquad(nz(bd), "lp", 380) * np.sin(np.pi * tt / bd) * 0.6
        if k == 0:
            bite += crinkle(bd, 400, 2000, 6000, seed=181) * 0.6
        place(x, bite * r.uniform(0.7, 1.0), at)
    save("munch", x, 0.6, "48k")

    # the school fire alarm: a hammer on a bell, 16 strikes a second, harsh and very loud
    total = 2.0
    ev = []
    partials = ((1.0, 1.0, 0.5), (2.32, 0.6, 0.25), (4.25, 0.35, 0.12), (6.63, 0.25, 0.07))
    for k in range(32):
        tt = t_axis(0.5)
        ring = np.zeros(len(tt))
        for ratio, amp, tau in partials:
            ring += amp * np.sin(2 * np.pi * 930 * ratio * tt) * np.exp(-tt / tau)
        ring += biquad(nz(0.5), "bp", 4000, 1) * np.exp(-tt / 0.004) * 0.6
        ev.append((k / 16, ring, 0.45 + 0.08 * (k % 2)))
    x = seq_render(total, ev)
    save("fire_alarm", np.tanh(x * 2.2), 0.8, "64k")

    # his humming: the title's lullaby, low, through a closed mouth, a little off key
    melody = [(12, 1), (7, 1), (8, 1), (7, 1), (3, 2), (0, 2), (2, 1), (3, 1), (7, 1), (3, 1), (2, 3), None]
    beat = 0.55
    d = sum(n[1] if n else 1.5 for n in melody) * beat
    n_s = int(d * SR)
    f = np.zeros(n_s); amp = np.zeros(n_s)
    at = 0.0
    prev = None
    for n in melody:
        if n is None:   # a breath
            seg = int(1.5 * beat * SR)
            i0 = int(at * SR)
            f[i0:i0 + seg] = prev if prev else 110
            at += 1.5 * beat
            continue
        semi, beats = n
        i0, seg = int(at * SR), int(beats * beat * SR)
        target = nfreq(semi - 24) * (1 + r.uniform(-0.012, 0.012))
        start = prev if prev else target
        k = np.clip(np.arange(seg) / (0.06 * SR), 0, 1)
        f[i0:i0 + seg] = start + (target - start) * k
        a = np.ones(seg); a[: int(0.03 * SR)] = np.linspace(0, 1, int(0.03 * SR)); a[-int(0.04 * SR):] *= np.linspace(1, 0.7, int(0.04 * SR))
        amp[i0:i0 + seg] = a
        prev = target
        at += beats * beat
    tt = t_axis(d)
    f = f * (1 + 0.008 * np.sin(2 * np.pi * 5.2 * tt))
    amp = np.convolve(amp, np.ones(800) / 800, mode="same")
    glott = osc_saw(f)
    hum = biquad(glott, "lp", 700) * 0.8 + biquad(glott, "bp", 270, 2.5) * 1.2 + biquad(glott, "bp", 2300, 4) * 0.08
    save("madi_hum", hum * amp, 0.55, "48k")

    # waking up with a jolt: a snore that catches, then a snort
    d = 0.7
    tt = t_axis(d)
    flap = np.maximum(0, osc_saw(28 + 10 * tt)) ** 3
    x = biquad(nz(d) * (0.3 + flap * 1.6), "bp", 360, 0.9) * np.clip((0.42 - tt) / 0.05, 0, 1)
    sn = biquad(nz(0.25), "bp", 900, 1.2) * np.exp(-t_axis(0.25) / 0.05) * 1.8
    place(x, sn, 0.42)
    save("snort", x, 0.7, "48k")

    # the class chatting while he is out: lots of quick syllables, kids' voices, a big room
    d = 4.0
    x = np.zeros(int(d * SR))
    for v in range(16):
        f0 = r.uniform(200, 340)
        at = r.uniform(0, 0.5)
        while at < d - 0.2:
            sd = r.uniform(0.08, 0.18)
            tt2 = t_axis(sd)
            ff = f0 * (1 + 0.12 * np.sin(np.pi * tt2 / sd) * r.uniform(-1, 1))
            syl = osc_saw(ff)
            form = r.uniform(700, 1300)
            syl = biquad(syl, "bp", form, 2.5) + biquad(syl, "bp", form * 2.3, 3) * 0.4
            place(x, syl * np.sin(np.pi * tt2 / sd) ** 1.5 * r.uniform(0.2, 0.7), at)
            at += sd + (r.uniform(0.02, 0.08) if r.random() < 0.8 else r.uniform(0.3, 0.8))
    x = biquad(x, "hp", 160)
    loop_save("class_chatter", reverb(x, 0.4, dur=1.2, decay=0.5)[: int(d * SR)], 0.6, peak=0.6, bitrate="64k")

def make_p3():
    """Phase 3 (src/blame.js): the KICK ME note (stuck on, torn off), the laser pointer (click, him pawing
    at the dot), the class going "ooooh" when somebody gets the blame.
    Uses its own random numbers, so building only this group gives the same files."""
    r = np.random.default_rng(303)

    def nz(d):
        return r.standard_normal(int(d * SR))

    # the note goes on his back: a flat hand on a jacket (soft thud), paper and tape under it
    d = 0.3; t = t_axis(d)
    x = biquad(nz(d), "lp", 520) * np.exp(-t / 0.022) * 1.3 + osc_sin(np.full(len(t), 110.0)) * np.exp(-t / 0.03) * 0.5
    x += crinkle(d, 240, 2200, 6000, seed=304) * 0.45 * np.exp(-t / 0.07)
    save("bl_stick", x, 0.6)

    # he tears it off: tape letting go (a rising rasp), then the paper crackles in his hand
    d = 0.6; t = t_axis(d)
    rasp = svf(nz(d), 900 + 4200 * np.clip(t / 0.22, 0, 1), 2.2, "bp") * np.clip(t / 0.02, 0, 1) * np.exp(-np.clip(t - 0.2, 0, None) / 0.03)
    x = rasp * 0.9 + crinkle(d, 420, 1800, 7000, seed=305) * (0.25 + 0.75 * np.clip((t - 0.18) / 0.1, 0, 1)) * np.exp(-np.clip(t - 0.3, 0, None) / 0.12)
    save("bl_rip", x, 0.7)

    # the laser pointer's button: a tiny plastic click (down, up)
    d = 0.14
    x = np.zeros(int(d * SR))
    for k, (at, f) in enumerate(((0.0, 3400.0), (0.06, 2600.0))):
        tt = t_axis(0.03)
        click = (osc_sin(np.full(len(tt), f)) * 0.7 + biquad(nz(0.03), "bp", f * 1.6, 2.0) * 0.6) * np.exp(-tt / 0.004)
        place(x, click * (1.0 - 0.35 * k), at)
    save("bl_click", x, 0.45)

    # he paws at the red dot: an open hand swatting a desk / the wall, a swish of sleeve before it
    d = 0.3; t = t_axis(d)
    swish = svf(nz(d), 700 + 1800 * np.clip(t / 0.09, 0, 1), 1.2, "bp") * np.sin(np.pi * np.clip(t / 0.1, 0, 1)) ** 2 * 0.35
    pat = np.zeros(len(t))
    tt = t_axis(0.2)
    place(pat, (biquad(nz(0.2), "lp", 900) * np.exp(-tt / 0.02) * 1.2 + osc_sin(np.full(len(tt), 165.0)) * np.exp(-tt / 0.035) * 0.8
                + biquad(nz(0.2), "bp", 2600, 1.2) * np.exp(-tt / 0.006) * 0.5), 0.09)
    save("bl_paw", swish + pat, 0.7)

    # the whole class: "ooooOOOOooh" (somebody just got the blame): kids' voices sliding up and back down
    d = 2.1; t = t_axis(d)
    x = np.zeros(len(t))
    for v in range(18):
        f0 = r.uniform(210, 400)
        start = r.uniform(0, 0.25)
        dur = r.uniform(1.2, 1.6)
        tt = t_axis(dur)
        k = tt / dur
        f = f0 * (0.92 + 0.34 * np.sin(np.pi * np.clip(k * 1.15, 0, 1)) ** 2) * (1 + 0.012 * np.sin(2 * np.pi * r.uniform(4.5, 6.5) * tt))
        src = osc_saw(f) * 0.8 + nz(dur) * 0.05
        form = r.uniform(0.94, 1.08)
        voice = biquad(src, "bp", 420 * form, 4.0) * 1.0 + biquad(src, "bp", 820 * form, 5.0) * 0.7 + biquad(src, "bp", 2500 * form, 4.0) * 0.12
        voice *= np.sin(np.pi * np.clip(k, 0, 1)) ** 0.7 * np.clip(tt / 0.08, 0, 1)
        place(x, voice * r.uniform(0.5, 1.0), start)
    save("bl_ooh", fade(reverb(x, 0.35, dur=1.4, decay=0.5)[: int(2.7 * SR)], 0.005, 0.3), 0.75)



if __name__ == "__main__":
    import sys
    print("Synthesising sound effects ->", OUT)
    if "p3" in sys.argv:  # Phase 3: blame, the note on his back, the laser pointer
        make_p3()
        raise SystemExit(0)
    if "v7" in sys.argv:
        make_v7()
        raise SystemExit(0)
    if "v6" in sys.argv:
        make_v6()
        raise SystemExit(0)
    if "v5" in sys.argv:
        make_v5()
        raise SystemExit(0)
    if "memes" in sys.argv:  # only a newer group
        make_memes()
        raise SystemExit(0)
    if "v3" in sys.argv:
        make_v3()
        raise SystemExit(0)
    if "v4" in sys.argv:
        make_v4()
        raise SystemExit(0)
    make_claps()
    make_chalk()
    make_eraser()
    make_bell()
    make_scream()
    make_stingers()
    make_breath()
    make_thunder()
    make_rain()
    make_whisper_bed()
    make_music_box()
    make_misc()
    make_v2()
    make_memes()
    make_v3()
    make_v4()
    make_v5()
    make_v6()
    make_v7()
    make_p3()
    print("done")
