#!/usr/bin/env python3
"""Weequb premium motion: LOCKED sound kit (approved 2026-11-16). All sounds are synthesised, so there is nothing to license.

One sound per event:
  whoosh: scene transition. Place it 0.3 s BEFORE the transition starts (it peaks as the scene blurs out).
  tick:   an element (card, key word) lands. Place it at entrance time + 0.35 s.
  boom:   the logo reveal. Place it at the logo's entrance time + 0.05 s.
  chime:  the CTA pill. Place it at the CTA's entrance time + 0.1 s.
  pad:    a quiet ambient bed under everything (always on).

Usage:
  python templates/premium-motion/sfx.py cues.json OUT.wav
  cues.json = {"duration": 5.5, "cues": [["whoosh", 1.25], ["tick", 2.15], ...]}
Or import: from sfx import build; build(cues, duration, out_path)
"""
from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np

SR = 48000
GAINS = {"whoosh": 0.32, "whoosh_soft": 0.18, "tick": 0.16, "tick_soft": 0.12, "boom": 0.55, "chime": 0.10}


def _lowpass(x, a):
    y = np.empty_like(x)
    acc = 0.0
    for k, v in enumerate(x):
        acc += a * (v - acc)
        y[k] = acc
    return y


def whoosh(d=0.8, seed=3):
    m = int(d * SR)
    tt = np.arange(m) / m
    rng = np.random.default_rng(seed)
    return _lowpass(rng.uniform(-1, 1, m), 0.08) * np.sin(np.pi * tt ** 0.7) ** 2 * 3.0


def tick():
    tt = np.arange(int(0.12 * SR)) / SR
    return (np.sin(2 * np.pi * 1900 * tt) + 0.5 * np.sin(2 * np.pi * 2850 * tt)) * np.exp(-tt * 55)


def boom(seed=3):
    m = int(1.6 * SR)
    tt = np.arange(m) / SR
    f = 42 + 50 * np.exp(-tt * 6)
    rng = np.random.default_rng(seed)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 2.6) + 0.15 * _lowpass(rng.uniform(-1, 1, m), 0.05) * np.exp(-tt * 8)


def chime():
    tt = np.arange(int(1.4 * SR)) / SR
    return sum(a * np.sin(2 * np.pi * f * tt) for f, a in [(1318.5, 1), (1975.5, .5), (2637, .25)]) * np.exp(-tt * 3.2) * (1 - np.exp(-tt * 300))


def pad(n):
    t = np.arange(n) / SR
    out = sum(a * np.sin(2 * np.pi * f * t + 0.3 * np.sin(2 * np.pi * 0.2 * t))
              for f, a in [(110, .5), (220, .35), (261.63, .25), (329.63, .25), (493.88, .12)])
    return out * 0.05 * np.minimum(1, t / 0.6)


SOUNDS = {"whoosh": lambda: whoosh(0.8), "whoosh_soft": lambda: whoosh(0.6), "tick": tick, "tick_soft": tick, "boom": boom, "chime": chime}


def build(cues: list, duration: float, out: Path):
    n = int(SR * duration)
    mix = pad(n)
    for name, at in cues:
        sig = SOUNDS[name]() * GAINS[name]
        i = int(at * SR)
        j = min(n, i + len(sig))
        if i < n:
            mix[i:j] += sig[: j - i]
    t = np.arange(n) / SR
    mix *= np.minimum(1, (duration - t) / 0.4)
    mix /= np.max(np.abs(mix)) * 1.1
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(out), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.stack([mix, mix], axis=1) * 32767).astype(np.int16).tobytes())
    print("✓", out)


if __name__ == "__main__":
    spec = json.loads(Path(sys.argv[1]).read_text())
    build(spec["cues"], spec["duration"], Path(sys.argv[2]))
