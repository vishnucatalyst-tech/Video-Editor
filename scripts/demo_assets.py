#!/usr/bin/env python3
"""Generate source material for the Weequb demo Reel (no camera footage or paid services needed).

Usage: python scripts/demo_assets.py PROJECT_DIR [--logo-dir brands/weequb/assets/logo]

Writes into PROJECT_DIR/raw/:
  01_hook_zoom.mp4      1080x1920  fast fractal zoom (strongest motion → picked as the hook)
  02_raw_clips.mp4      1920x1080  landscape "raw footage" (shows the blurred-background fill)
  03_gradient_flow.mp4  1080x1920  slow brand-colour gradient
  04_beat_viz.mp4       1080x1920  waveform of the music track (shows "cut on the beat")
  05_phone_mockup.png   1080x1920  still → gentle Ken Burns push
  06_end_card.png       1080x1920  logo end card
  music.wav             120 BPM electronic loop, 20 s
and a placeholder logo.png into --logo-dir.
"""
from __future__ import annotations

import argparse
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 44100
BPM = 120
BEAT = 60 / BPM


def ff(*args: str):
    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *args]
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, check=True)


def magick(*args: str):
    exe = "magick" if subprocess.run(["which", "magick"], capture_output=True).returncode == 0 else "convert"
    cmd = [exe, *args]
    print("$ " + " ".join(cmd))
    subprocess.run(cmd, check=True)


def music(path: Path, seconds: float = 20.0):
    """Kick on every beat, clap on 2 & 4, off-beat hats, bass line and a pad chord progression."""
    n = int(SR * seconds)
    t = np.arange(n) / SR
    out = np.zeros(n)
    rng = np.random.default_rng(7)

    def env(local, decay):
        return np.exp(-decay * local) * (local >= 0)

    beat_pos = t % BEAT
    beat_idx = (t // BEAT).astype(int)
    # Kick: pitch-swept sine
    out += 0.9 * np.sin(2 * np.pi * (45 + 90 * np.exp(-30 * beat_pos)) * beat_pos) * env(beat_pos, 9)
    # Clap on beats 2 and 4
    noise = rng.uniform(-1, 1, n)
    clap_mask = (beat_idx % 2 == 1)
    out += 0.35 * noise * env(beat_pos, 25) * clap_mask
    # Off-beat hats
    off = (t + BEAT / 2) % BEAT
    hp = noise - np.concatenate([[0], noise[:-1]])
    out += 0.12 * hp * env(off, 60)
    # Chords: Am – F – C – G, one bar (4 beats) each
    chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]
    bar = (t // (4 * BEAT)).astype(int) % 4
    pad = np.zeros(n)
    bass = np.zeros(n)
    for i, ch in enumerate(chords):
        m = bar == i
        for f in ch:
            pad[m] += np.sin(2 * np.pi * f * t[m]) + 0.3 * np.sin(2 * np.pi * 2 * f * t[m])
        eighth = (t[m] % (BEAT / 2))
        bass[m] = np.sign(np.sin(2 * np.pi * ch[0] / 2 * t[m])) * env(eighth, 6)
    out += 0.06 * pad + 0.18 * bass
    # Fade in/out and normalise
    fade = np.minimum(1, np.minimum(t / 0.5, (seconds - t) / 1.0))
    out *= fade
    out /= np.max(np.abs(out)) * 1.12
    stereo = np.stack([out, out], axis=1)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((stereo * 32767).astype(np.int16).tobytes())
    print(f"✓ {path.name}: {BPM} BPM, {seconds:.0f} s")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project")
    ap.add_argument("--logo-dir")
    args = ap.parse_args()
    raw = Path(args.project) / "raw"
    raw.mkdir(parents=True, exist_ok=True)
    enc = ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "16", "-an"]

    music(raw / "music.wav")

    ff("-f", "lavfi", "-i", "mandelbrot=s=540x960:rate=30:start_scale=3:end_scale=0.0005:end_pts=250:inner=convergence:bailout=10:maxiter=200",
       "-t", "5", "-vf", "scale=1080:1920:flags=bicubic,eq=saturation=1.3", *enc, str(raw / "01_hook_zoom.mp4"))
    ff("-f", "lavfi", "-i", "life=s=480x270:mold=10:rate=30:ratio=0.12:death_color=#101828:life_color=#5b8cff",
       "-t", "6", "-vf", "scale=1920:1080:flags=neighbor", *enc, str(raw / "02_raw_clips.mp4"))
    ff("-f", "lavfi", "-i", "gradients=s=1080x1920:rate=30:n=3:c0=#111111:c1=#FFD400:c2=#5b8cff:speed=0.035:type=radial",
       "-t", "6", *enc, str(raw / "03_gradient_flow.mp4"))
    ff("-i", str(raw / "music.wav"), "-filter_complex",
       "[0:a]showwaves=s=1080x1920:mode=cline:rate=30:colors=#FFD400:scale=sqrt:split_channels=0:draw=full,format=yuv420p[w];"
       "color=c=#0d0d12:s=1080x1920:r=30[bg];[bg][w]overlay=shortest=1",
       "-t", "6", *enc, str(raw / "04_beat_viz.mp4"))

    # Phone mockup still
    magick("-size", "1080x1920", "gradient:#1b1f2a-#0d0d12",
           "(", "-size", "560x1140", "xc:none", "-fill", "#20242f", "-draw", "roundrectangle 0,0 559,1139 70,70",
           "-fill", "gradient:#FFD400-#ff7a00", "-size", "520x1100", "-draw", "roundrectangle 20,20 539,1119 52,52", ")",
           "-gravity", "center", "-composite",
           "-fill", "#111111", "-draw", "translate 540,960 polygon -50,-70 -50,70 70,0",
           "-fill", "#FFFFFF", "-font", "DejaVu-Sans-Bold", "-pointsize", "44", "-annotate", "+0+260", "REELS",
           str(raw / "05_phone_mockup.png"))

    # Placeholder logo (replace with the real one in brands/weequb/assets/logo/logo.png)
    logo_dir = Path(args.logo_dir) if args.logo_dir else None
    if logo_dir:
        logo_dir.mkdir(parents=True, exist_ok=True)
        magick("-size", "400x400", "xc:none", "-fill", "#FFD400", "-draw", "roundrectangle 0,0 399,399 90,90",
               "-fill", "#111111", "-font", "DejaVu-Sans-Bold", "-pointsize", "260", "-gravity", "center",
               "-annotate", "+0+10", "W", str(logo_dir / "logo.png"))

    # End card
    logo_png = (logo_dir / "logo.png") if logo_dir else None
    card = ["-size", "1080x1920", "gradient:#111111-#1d2433"]
    if logo_png and logo_png.exists():
        card += ["(", str(logo_png), "-resize", "300x300", ")", "-gravity", "center", "-geometry", "+0-220", "-composite"]
    card += ["-gravity", "center", "-fill", "#FFFFFF", "-font", "DejaVu-Sans-Bold", "-pointsize", "84",
             "-annotate", "+0+60", "Weequb", "-fill", "#FFD400", "-pointsize", "40", "-annotate", "+0+150", "TECHNOLOGIES",
             str(raw / "06_end_card.png")]
    magick(*card)
    print("✓ demo assets ready in", raw)


if __name__ == "__main__":
    main()
