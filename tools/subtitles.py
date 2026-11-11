"""Word grouping, SRT writing and brand-styled ASS caption generation."""
from __future__ import annotations

import re
from pathlib import Path

from common import FINAL_H, FINAL_W, SAFE_BOTTOM, SAFE_SIDE, SAFE_TOP, Brand, hex_to_ass

Word = dict  # {"word": str, "start": float, "end": float}


def group_words(words: list[Word], max_words: int = 4, max_chars: int = 26, max_gap: float = 0.45) -> list[list[Word]]:
    """Split words into short caption phrases at pauses, punctuation or length limits."""
    groups: list[list[Word]] = []
    cur: list[Word] = []
    for w in words:
        text = w["word"].strip()
        if not text:
            continue
        if cur:
            gap = w["start"] - cur[-1]["end"]
            length = sum(len(x["word"].strip()) + 1 for x in cur) + len(text)
            if gap > max_gap or len(cur) >= max_words or length > max_chars or re.search(r"[.!?,;:]$", cur[-1]["word"].strip()):
                groups.append(cur)
                cur = []
        cur.append({**w, "word": text})
    if cur:
        groups.append(cur)
    return groups


def srt_time(t: float) -> str:
    ms = int(round(max(0.0, t) * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def write_srt(words: list[Word], path: Path, max_words: int = 7, max_chars: int = 42):
    lines = []
    for i, g in enumerate(group_words(words, max_words=max_words, max_chars=max_chars, max_gap=0.6), 1):
        lines += [str(i), f"{srt_time(g[0]['start'])} --> {srt_time(g[-1]['end'])}", " ".join(w["word"] for w in g), ""]
    path.write_text("\n".join(lines), encoding="utf-8")


def _ass_time(t: float) -> str:
    cs = int(round(max(0.0, t) * 100))
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def _esc(text: str) -> str:
    return text.replace("\\", "\\\\").replace("{", "(").replace("}", ")").replace("\n", " ")


POSITIONS = {
    # Alignment numpad code, vertical margin (px at 1920 tall). All inside Instagram safe zones.
    "lower": (2, SAFE_BOTTOM + 140),
    "middle": (5, 0),
    "upper": (8, SAFE_TOP + 120),
}


def build_ass(words: list[Word], brand: Brand, style: str | None = None, position: str | None = None) -> str:
    """Brand-styled ASS captions at 1080x1920 (scaled automatically for previews by libass)."""
    style = (style or brand.get("caption_style", "pop")).lower()
    position = (position or brand.get("caption_position", "lower")).lower()
    font = str(brand.get("caption_font", brand.get("headline_font", "Montserrat")))
    size = int(brand.get("caption_size", 78))
    text_c = hex_to_ass(brand.color("caption_color", "#FFFFFF"))
    accent_c = hex_to_ass(brand.color("accent_color", "#FFD400"))
    outline_c = hex_to_ass(brand.color("caption_outline", "#000000"))
    upper = str(brand.get("caption_case", "upper")).lower() == "upper"
    align, margin_v = POSITIONS.get(position, POSITIONS["lower"])
    bold = -1 if int(brand.get("caption_weight", 800)) >= 600 else 0

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {FINAL_W}
PlayResY: {FINAL_H}
WrapStyle: 0
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Cap,{font},{size},{text_c},{accent_c},{outline_c},&H80000000,{bold},0,0,0,100,100,0,0,1,6,2,{align},{SAFE_SIDE + 20},{SAFE_SIDE + 20},{margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    events = []
    fmt = (lambda s: s.upper()) if upper else (lambda s: s)

    if style == "karaoke":
        for g in group_words(words, max_words=5, max_chars=30):
            parts = []
            for i, w in enumerate(g):
                nxt = g[i + 1]["start"] if i + 1 < len(g) else w["end"]
                dur_cs = max(1, int(round((nxt - w["start"]) * 100)))
                parts.append(f"{{\\kf{dur_cs}}}{_esc(fmt(w['word']))}")
            events.append((g[0]["start"], g[-1]["end"] + 0.15, " ".join(parts)))
        # karaoke fills from Secondary (accent) to Primary; swap so unsung = white, sung = accent
        header = header.replace(f"{text_c},{accent_c}", f"{accent_c},{text_c}", 1)
    elif style == "minimal":
        for g in group_words(words, max_words=6, max_chars=34):
            events.append((g[0]["start"], g[-1]["end"] + 0.1, f"{{\\fad(80,80)\\bord3\\shad0}}" + _esc(fmt(" ".join(w["word"] for w in g)))))
    else:  # pop: phrase stays, current word highlighted in accent, phrase pops in
        for g in group_words(words, max_words=3, max_chars=20):
            end_g = g[-1]["end"] + 0.12
            for i, w in enumerate(g):
                start = w["start"] if i else g[0]["start"]
                end = g[i + 1]["start"] if i + 1 < len(g) else end_g
                if end <= start:
                    continue
                words_txt = []
                for j, x in enumerate(g):
                    t = _esc(fmt(x["word"]))
                    words_txt.append(f"{{\\c{accent_c}}}{t}{{\\c{text_c}}}" if j == i else t)
                anim = "{\\fscx80\\fscy80\\t(0,90,\\fscx105\\fscy105)\\t(90,150,\\fscx100\\fscy100)}" if i == 0 else ""
                events.append((start, end, anim + " ".join(words_txt)))

    body = "\n".join(f"Dialogue: 0,{_ass_time(s)},{_ass_time(e)},Cap,,0,0,0,,{t}" for s, e, t in events)
    return header + body + "\n"
