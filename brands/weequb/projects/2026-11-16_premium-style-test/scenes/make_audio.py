#!/usr/bin/env python3
"""Synthesise the sound bed for the premium test: soft ambient pad + SFX placed on every element entrance.
Writes raw/music.wav (48 kHz stereo, 5.5 s). All sounds are generated here, so there is nothing to license."""
import wave
from pathlib import Path

import numpy as np

SR, DUR = 48000, 5.5
n = int(SR * DUR)
t = np.arange(n) / SR
rng = np.random.default_rng(3)
mix = np.zeros(n)


def place(sig, at, gain):
    i = int(at * SR)
    j = min(n, i + len(sig))
    mix[i:j] += gain * sig[: j - i]


def lowpass(x, a):  # one-pole, a in (0,1): smaller = darker
    y = np.empty_like(x)
    acc = 0.0
    for k, v in enumerate(x):
        acc += a * (v - acc)
        y[k] = acc
    return y


def whoosh(d=0.7):
    m = int(d * SR)
    tt = np.arange(m) / m
    env = np.sin(np.pi * tt ** 0.7) ** 2
    return lowpass(rng.uniform(-1, 1, m), 0.08) * env * 3.0


def tick():  # soft UI click/glass tap
    m = int(0.12 * SR)
    tt = np.arange(m) / SR
    return (np.sin(2 * np.pi * 1900 * tt) + 0.5 * np.sin(2 * np.pi * 2850 * tt)) * np.exp(-tt * 55)


def boom():  # low cinematic hit
    m = int(1.6 * SR)
    tt = np.arange(m) / SR
    f = 42 + 50 * np.exp(-tt * 6)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6) + 0.15 * lowpass(rng.uniform(-1, 1, m), 0.05) * np.exp(-tt * 8)


def chime():
    m = int(1.4 * SR)
    tt = np.arange(m) / SR
    return sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(1318.5, 1), (1975.5, .5), (2637, .25)]) * np.exp(-tt * 3.2) * (1 - np.exp(-tt * 300))


# ambient pad: Am9 voicing, slow swell
for f, a in [(110, .5), (220, .35), (261.63, .25), (329.63, .25), (493.88, .12)]:
    mix += a * np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.2 * t))
mix *= 0.05 * np.minimum(1, t / 0.6)

place(whoosh(0.6), 0.0, 0.18)        # hook text drifts in
place(tick(), 0.45, 0.12)            # "slow-ah?" lands
place(whoosh(0.8), 1.25, 0.32)       # zoom-through transition A→B (peak at ~1.6 s)
for i in range(3):                   # each icon card lands
    place(tick(), 1.8 + i * 0.28 + 0.35, 0.16)
place(whoosh(0.8), 3.05, 0.32)       # transition B→C
place(boom(), 3.55, 0.55)            # logo reveal
place(chime(), 4.3, 0.10)            # CTA pill

fade = np.minimum(1, (DUR - t) / 0.4)
mix *= fade
mix /= np.max(np.abs(mix)) * 1.1
out = Path(__file__).resolve().parent.parent / "raw" / "music.wav"
out.parent.mkdir(parents=True, exist_ok=True)
st = (np.stack([mix, mix], axis=1) * 32767).astype(np.int16)
with wave.open(str(out), "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(st.tobytes())
print("✓", out)
