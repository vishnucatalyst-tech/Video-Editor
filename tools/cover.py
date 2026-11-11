#!/usr/bin/env python3
"""Pick the best cover frame from a rendered Reel (sharp, well exposed, not on a cut).

Usage: python tools/cover.py VIDEO [OUT.jpg]
"""
from __future__ import annotations

import sys
from pathlib import Path


def make_cover(video: Path, out: Path, cut: dict | None = None) -> float:
    import cv2
    import numpy as np

    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1
    duration = total / fps
    cuts = []
    if cut:
        t = 0.0
        for s in cut.get("segments", []):
            t += s["out"] - s["in"]
            cuts.append(t)
    best, best_score, best_t = None, -1.0, 0.0
    step = max(0.2, duration / 60)
    t = 0.3
    while t < duration - 0.3:
        if any(abs(t - c) < 0.25 for c in cuts):
            t += step
            continue
        cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
        ok, frame = cap.read()
        if ok:
            g = cv2.cvtColor(cv2.resize(frame, (270, 480)), cv2.COLOR_BGR2GRAY)
            sharp = cv2.Laplacian(g, cv2.CV_64F).var()
            mean = float(g.mean())
            exposure = 1 - abs(mean - 128) / 128  # prefer mid-tones
            contrast = float(g.std()) / 64
            hsv = cv2.cvtColor(cv2.resize(frame, (270, 480)), cv2.COLOR_BGR2HSV)
            colour = float(hsv[..., 1].mean()) / 255
            score = np.log1p(sharp) * (0.4 + exposure) * (0.5 + min(contrast, 1.5)) * (0.8 + colour)
            if score > best_score:
                best, best_score, best_t = frame, score, t
        t += step
    cap.release()
    if best is None:
        raise SystemExit("could not read frames for cover")
    out.parent.mkdir(parents=True, exist_ok=True)
    cv2.imwrite(str(out), best, [cv2.IMWRITE_JPEG_QUALITY, 92])
    print(f"✓ cover: frame at {best_t:.2f}s → {out}")
    return best_t


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    v = Path(sys.argv[1])
    make_cover(v, Path(sys.argv[2]) if len(sys.argv) > 2 else v.with_name("cover.jpg"))
