#!/usr/bin/env python3
"""Write work/words.json from the Tanglish script (no voiceover yet, so timings come from the cut list)."""
import json
from pathlib import Path

LINES = [  # (start, end, caption text)
    (0.05, 1.45, "Unga website customers-ah miss pannudhu!"),
    (1.6, 3.9, "3 sec load aana... bye bye!"),
    (4.1, 6.9, "Mobile-la sari illaya? Google-la um illa."),
    (7.1, 8.9, "Kavalai venaam. Weequb irukku!"),
    (9.1, 11.9, "Before. After. Pakka upgrade!"),
    (12.1, 14.9, "Fast. Mobile-first. SEO-ready."),
    (15.1, 18.9, "Visitors-ah customers-ah maathura website."),
]

words = []
for start, end, text in LINES:
    toks = text.split()
    # each word gets an even slot; the last word holds until the line ends
    slot = min(0.4, (end - start) / (len(toks) + 1))
    for i, w in enumerate(toks):
        s = start + i * slot
        e = end if i == len(toks) - 1 else s + slot - 0.02
        words.append({"word": w, "start": round(s, 2), "end": round(e, 2), "prob": 1.0})

out = Path(__file__).resolve().parent.parent / "work" / "words.json"
out.write_text(json.dumps(words, indent=1, ensure_ascii=False))
print(f"✓ {out} ({len(words)} words)")
