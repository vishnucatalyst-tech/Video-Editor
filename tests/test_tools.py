"""Unit tests for the pure parts of tools/ (no media needed). Run: python -m unittest discover tests"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

from common import Brand, hex_to_ass, parse_front_matter  # noqa: E402
from subtitles import build_ass, group_words, srt_time  # noqa: E402

W = lambda text, s, e: {"word": text, "start": s, "end": e}  # noqa: E731


class FrontMatter(unittest.TestCase):
    def test_parses_flat_values_and_comments(self):
        cfg = parse_front_matter('---\nname: Acme\naccent_color: "#FF0000"  # red\nmax_shot_seconds: 3\nratio: 1.5\nflag: true\n---\n# Body')
        self.assertEqual(cfg, {"name": "Acme", "accent_color": "#FF0000", "max_shot_seconds": 3, "ratio": 1.5, "flag": True})

    def test_template_parses(self):
        tpl = (Path(__file__).resolve().parent.parent / "templates" / "BRAND.md").read_text()
        cfg = parse_front_matter(tpl)
        self.assertEqual(cfg["caption_style"], "pop")
        self.assertEqual(cfg["max_shot_seconds"], 3)

    def test_bad_colour_falls_back(self):
        self.assertEqual(Brand(Path("."), {"accent_color": "red"}).color("accent_color", "#FFD400"), "#FFD400")


class Captions(unittest.TestCase):
    words = [W("Stop", 0, 0.3), W("scrolling!", 0.3, 0.8), W("This", 1.0, 1.2), W("is", 1.2, 1.3),
             W("new", 1.3, 1.5), W("today", 1.5, 1.8), W("later", 3.0, 3.4)]

    def test_groups_break_on_punctuation_pause_and_length(self):
        g = [[w["word"] for w in grp] for grp in group_words(self.words, max_words=3)]
        self.assertEqual(g, [["Stop", "scrolling!"], ["This", "is", "new"], ["today"], ["later"]])

    def test_ass_colours_and_safe_zone(self):
        self.assertEqual(hex_to_ass("#FFD400"), "&H0000D4FF")
        ass = build_ass(self.words, Brand(Path("."), {"accent_color": "#FFD400"}), style="pop", position="lower")
        self.assertIn("PlayResY: 1920", ass)
        self.assertIn(",2,80,80,460,1", ass)  # bottom-centre, 60 px side safe zone + padding, 320 px bottom + 140
        self.assertIn("STOP", ass)

    def test_all_styles_render(self):
        for style in ("pop", "karaoke", "minimal"):
            self.assertIn("Dialogue:", build_ass(self.words, Brand(Path("."), {}), style=style))

    def test_srt_time(self):
        self.assertEqual(srt_time(3725.5), "01:02:05,500")


class Render(unittest.TestCase):
    def test_duck_expression(self):
        from render import duck_expr

        self.assertEqual(duck_expr([], -14), "1")
        import math
        import re

        expr = duck_expr([(1.0, 2.0)], -14)
        gain = lambda t: eval(re.sub(r"\bt\b", str(t), expr), {"clip": lambda x, a, b: max(a, min(b, x)), "pow": pow, "min": min})  # noqa: E731
        self.assertAlmostEqual(20 * math.log10(gain(1.5)), -14, places=3)  # inside speech: ducked 14 dB
        self.assertAlmostEqual(gain(3.0), 1.0)  # well after speech: full level


class Cutlist(unittest.TestCase):
    def test_snap_to_beat(self):
        from cutlist import snap_to_beat

        self.assertEqual(snap_to_beat(1.0, 2.0, 3.0, [0.5, 1.9, 2.4, 3.5]), 1.9)
        self.assertEqual(snap_to_beat(1.0, 2.0, 3.0, []), 2.0)


if __name__ == "__main__":
    unittest.main()


class TrimSilence(unittest.TestCase):
    def test_cuts_pauses_and_fillers_and_retimes_words(self):
        from trim_silence import FILLERS, plan

        words = [W("Hello", 0.5, 0.9), W("everyone", 0.95, 1.5), W("um", 1.6, 1.9), W("today", 2.0, 2.4),
                 W("three", 3.5, 3.8), W("tips", 3.85, 4.2)]
        segs, retimed, stats = plan(words, 6.0, max_gap=0.4, pad=0.08, fillers=FILLERS, max_shot=3.0, punch=1.1)
        self.assertEqual(stats["removed_fillers"], 1)
        self.assertEqual([[w["word"] for w in s["words"]] for s in segs], [["Hello", "everyone"], ["today"], ["three", "tips"]])
        self.assertEqual(segs[0]["in"], 0.42)       # 0.5 - pad
        self.assertTrue(all(b["in"] >= a["out"] for a, b in zip(segs, segs[1:])))
        self.assertEqual([w["word"] for w in retimed], ["Hello", "everyone", "today", "three", "tips"])
        self.assertAlmostEqual(retimed[0]["start"], 0.08, places=3)   # starts after the pad on the new timeline
        self.assertLess(stats["new_duration"], 3.0)                   # 6 s of source → under 3 s of speech

    def test_long_takes_split_with_alternating_punch_in(self):
        from trim_silence import FILLERS, plan

        words = [W(f"w{i}", i * 0.5, i * 0.5 + 0.45) for i in range(14)]  # one continuous 7 s take
        segs, _, _ = plan(words, 8.0, max_gap=0.4, pad=0.08, fillers=FILLERS, max_shot=3.0, punch=1.1)
        self.assertGreaterEqual(len(segs), 3)
        self.assertTrue(all(s["out"] - s["in"] <= 3.2 for s in segs))
        self.assertEqual([s["punch_in"] for s in segs[:3]], [1.0, 1.1, 1.0])
        for a, b in zip(segs, segs[1:]):  # split pieces of one take join seamlessly
            self.assertAlmostEqual(a["out"], b["in"], places=3)
