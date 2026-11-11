#!/usr/bin/env python3
"""Render a Reel from work/cutlist.json.

Usage:
  python tools/render.py [PROJECT] --preview   → work/preview.mp4 (540x960, fast)
  python tools/render.py [PROJECT] --final     → export/final.mp4 (1080x1920 H.264 CRF 18, AAC 192k, -14 LUFS)
                                                  + export/cover.jpg, export/captions.srt, export/edit-log.md

Pipeline: trim each segment → conform to 9:16 (cover-crop for vertical sources, blurred
background fill for everything else, never stretched) → punch-in → brand LUT → concat →
captions (ASS via libass, or a transparent Remotion overlay) → logo. Audio: source audio /
voiceover / music, music ducked under speech, 0.3 s fade in/out, loudness-normalised.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

from common import (
    FINAL_H, FINAL_W, FONTS, PREVIEW_H, PREVIEW_W, SAFE_SIDE, SAFE_TOP, TARGET_LUFS,
    die, load_json, require, resolve_project, run, summarize,
)

COMMANDS: list[str] = []


def ff(cmd: list[str], cwd: Path, quiet=False) -> subprocess.CompletedProcess:
    COMMANDS.append(" ".join(cmd))
    print("$ " + " ".join(cmd) if not quiet else "$ ffmpeg … (see edit-log)", flush=True)
    res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if res.returncode != 0:
        die("ffmpeg failed:\n" + "\n".join(res.stderr.strip().splitlines()[-30:]))
    return res


def esc(path: str) -> str:
    """Escape a path for use inside an ffmpeg filter argument."""
    return path.replace("\\", "/").replace(":", "\\:").replace("'", "\\'").replace(",", "\\,")


# ------------------------------------------------------------------ video

def video_graph(cut: dict, proj, brand, W: int, H: int, fps: int, mode: str) -> tuple[list[str], str, str]:
    """Return (input args, filter_complex, output label)."""
    inputs: list[str] = []
    chains: list[str] = []
    labels: list[str] = []
    fill_mode = str(brand.get("fill", "blur")).lower()  # blur | crop
    lut = brand.asset("lut")

    for i, seg in enumerate(cut["segments"]):
        src = seg["src"]
        dur = round(seg["out"] - seg["in"], 3)
        info = summarize(proj.path / src)
        if seg.get("still") or info["kind"] == "image":
            inputs += ["-loop", "1", "-framerate", str(fps), "-t", f"{dur}", "-i", src]
        else:
            inputs += ["-ss", f"{seg['in']}", "-t", f"{dur}", "-i", src]
        p = float(seg.get("punch_in", 1.0) or 1.0)
        vertical = info.get("vertical") or (info.get("width") and info["height"] / info["width"] >= 1.7)
        c = f"[{i}:v]"
        if vertical or fill_mode == "crop":
            c += f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H}"
        else:
            # Blurred background fill — never stretch non-9:16 footage.
            c += (f"split=2[bg{i}][fg{i}];[bg{i}]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
                  f"gblur=sigma={max(8, W // 30)},eq=brightness=-0.06:saturation=0.9[bgb{i}];"
                  f"[fg{i}]scale={W}:{H}:force_original_aspect_ratio=decrease[fgs{i}];"
                  f"[bgb{i}][fgs{i}]overlay=(W-w)/2:(H-h)/2")
        if seg.get("still") or info["kind"] == "image":
            frames = max(1, int(dur * fps))
            c += f",zoompan=z='1+0.06*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s={W}x{H}:fps={fps}"
        if p > 1.001:
            c += f",scale=ceil({W}*{p}/2)*2:ceil({H}*{p}/2)*2,crop={W}:{H}"
        if lut:
            c += f",lut3d=file='{esc(str(lut))}'"
        c += f",fps={fps},setsar=1,format=yuv420p,trim=duration={dur},setpts=PTS-STARTPTS[v{i}]"
        chains.append(c)
        labels.append(f"[v{i}]")

    n = len(labels)
    chains.append("".join(labels) + f"concat=n={n}:v=1:a=0[vcat]")
    last = "vcat"

    # Captions
    cap = cut.get("captions")
    if cap and (proj.path / cap).exists():
        if cap.endswith((".mov", ".webm")):
            idx = n
            inputs += ["-i", cap]
            chains.append(f"[{idx}:v]scale={W}:{H},format=yuva420p[capv];[{last}][capv]overlay=0:0:shortest=0:eof_action=pass[vcap]")
        else:
            fontdir = prepare_fonts(proj, brand)
            chains.append(f"[{last}]subtitles=filename='{esc(cap)}':fontsdir='{esc(str(fontdir))}'[vcap]")
        last = "vcap"
    elif cap:
        print(f"⚠ captions file {cap} not found — rendering without captions (run /captions)")

    # Logo
    logo = brand.asset("logo")
    if cut.get("logo") and logo:
        k = W / FINAL_W
        lw = int(int(brand.get("logo_width", 160)) * k) // 2 * 2
        pos = str(brand.get("logo_position", "top-right"))
        mx, my = int((SAFE_SIDE + 10) * k), int((SAFE_TOP - 90) * k)
        x = {"top-left": f"{mx}", "top-right": f"W-w-{mx}", "top-center": "(W-w)/2"}.get(pos, f"W-w-{mx}")
        when = str(brand.get("logo_when", "always"))
        length = cut["length"]
        enable = f":enable='gte(t,{max(0, length - 2):.2f})'" if when == "end" else ""
        idx = sum(1 for a in inputs if a == "-i")
        inputs += ["-i", str(logo)]
        chains.append(f"[{idx}:v]scale={lw}:-1,format=rgba,colorchannelmixer=aa={float(brand.get('logo_opacity', 0.9))}[lg];"
                      f"[{last}][lg]overlay={x}:{my}{enable}[vlogo]")
        last = "vlogo"
    return inputs, ";".join(chains), last


def prepare_fonts(proj, brand) -> Path:
    """One folder libass can scan: shared fonts/ plus the brand's own fonts."""
    d = proj.work / ".fonts"
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    for src in (FONTS, brand.fonts_dir):
        if src.exists():
            for f in src.rglob("*"):
                if f.suffix.lower() in (".ttf", ".otf", ".ttc"):
                    try:
                        os.symlink(f.resolve(), d / f.name)
                    except FileExistsError:
                        pass
    return d


# ------------------------------------------------------------------ audio

def speech_intervals(cut: dict, proj) -> list[tuple[float, float]]:
    words_p = proj.work / "words.json"
    iv: list[list[float]] = []
    if words_p.exists():
        for w in load_json(words_p):
            if iv and w["start"] - iv[-1][1] < 0.4:
                iv[-1][1] = max(iv[-1][1], w["end"])
            else:
                iv.append([w["start"], w["end"]])
        return [(a, b) for a, b in iv]
    vo = cut.get("voiceover")
    if not vo:
        return []
    res = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(proj.path / vo["src"]), "-af", "silencedetect=noise=-35dB:d=0.35", "-f", "null", "-"],
        capture_output=True, text=True,
    )
    dur = summarize(proj.path / vo["src"])["duration"]
    off = float(vo.get("offset", 0))
    silences = []
    start = None
    for line in res.stderr.splitlines():
        if m := re.search(r"silence_start: ([\d.]+)", line):
            start = float(m.group(1))
        elif (m := re.search(r"silence_end: ([\d.]+)", line)) and start is not None:
            silences.append((start, float(m.group(1))))
            start = None
    if start is not None:
        silences.append((start, dur))
    t = 0.0
    for s, e in silences:
        if s > t:
            iv.append([t + off, s + off])
        t = e
    if t < dur:
        iv.append([t + off, dur + off])
    return [(a, b) for a, b in iv]


def duck_expr(intervals: list[tuple[float, float]], duck_db: float, ramp: float = 0.15) -> str:
    """volume expression: duck_db while speech is active, with short ramps."""
    if not intervals:
        return "1"
    terms = "+".join(
        f"clip((t-{a - ramp:.3f})/{ramp},0,1)*clip(({b + ramp:.3f}-t)/{ramp},0,1)" for a, b in intervals
    )
    return f"pow(10,{duck_db}*min(1,{terms})/20)"


def audio_graph(cut: dict, proj, length: float) -> tuple[list[str], str, str, str]:
    """Return (input args, filter_complex, out label, description)."""
    inputs: list[str] = []
    chains: list[str] = []
    mix: list[str] = []
    desc = []
    n_in = 0
    fmt = "aresample=48000,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo"

    if cut.get("keep_source_audio", True):
        labels = []
        for i, seg in enumerate(cut["segments"]):
            dur = round(seg["out"] - seg["in"], 3)
            info = summarize(proj.path / seg["src"])
            if info.get("has_audio") and not seg.get("still"):
                inputs += ["-ss", f"{seg['in']}", "-t", f"{dur}", "-i", seg["src"]]
                chains.append(f"[{n_in}:a]{fmt},atrim=duration={dur},apad=whole_dur={dur},asetpts=PTS-STARTPTS,"
                              f"afade=t=in:d=0.01,afade=t=out:st={max(0, dur - 0.01):.3f}:d=0.01[sa{i}]")
                n_in += 1
            else:
                chains.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={dur},{fmt}[sa{i}]")
            labels.append(f"[sa{i}]")
        g = float(cut.get("source_audio_gain_db", 0))
        chains.append("".join(labels) + f"concat=n={len(labels)}:v=0:a=1,volume={g}dB[src]")
        mix.append("[src]")
        desc.append(f"source audio ({g:+g} dB)")

    vo = cut.get("voiceover")
    if vo:
        inputs += ["-i", vo["src"]]
        ms = int(float(vo.get("offset", 0)) * 1000)
        chains.append(f"[{n_in}:a]{fmt},adelay={ms}|{ms},volume={float(vo.get('gain_db', 0))}dB[vo]")
        n_in += 1
        mix.append("[vo]")
        desc.append(f"voiceover {Path(vo['src']).name} @ {ms / 1000:+.2f}s")

    music = cut.get("music")
    if music:
        inputs += ["-stream_loop", "-1", "-ss", f"{float(music.get('in', 0))}", "-i", music["src"]]
        duck_db = float(music.get("duck_db", -14))
        iv = speech_intervals(cut, proj)
        g = float(music.get("gain_db", -4))
        base = f"[{n_in}:a]{fmt},atrim=duration={length + 0.5:.3f},volume={g}dB"
        if iv:
            chains.append(base + f",volume='{duck_expr(iv, duck_db)}':eval=frame[mu]")
            desc.append(f"music {Path(music['src']).name} ({g:+g} dB, ducked {duck_db:g} dB under {len(iv)} speech span(s))")
        elif mix:
            # No timing info for speech: duck with a sidechain keyed on the other audio.
            chains.append(base + "[mub]")
            key = mix[0]
            chains.append(f"{key}asplit=2[key][keep]")
            mix[0] = "[keep]"
            chains.append("[mub][key]sidechaincompress=threshold=0.02:ratio=10:attack=20:release=350[mu]")
            desc.append(f"music {Path(music['src']).name} ({g:+g} dB, sidechain-ducked)")
        else:
            chains.append(base + "[mu]")
            desc.append(f"music {Path(music['src']).name} ({g:+g} dB)")
        n_in += 1
        mix.append("[mu]")

    if not mix:
        chains.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={length}[mixed]")
    elif len(mix) == 1:
        chains.append(f"{mix[0]}anull[mixed]")
    else:
        chains.append("".join(mix) + f"amix=inputs={len(mix)}:normalize=0:duration=longest[mixed]")
    chains.append(f"[mixed]atrim=duration={length:.3f},apad=whole_dur={length:.3f},"
                  f"afade=t=in:d=0.3,afade=t=out:st={max(0, length - 0.3):.3f}:d=0.3[aout]")
    return inputs, ";".join(chains), "aout", "; ".join(desc) or "silence"


def measure_loudness(path: Path, cwd: Path, extra_af: str = "") -> dict:
    af = (extra_af + "," if extra_af else "") + f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11:print_format=json"
    res = subprocess.run(["ffmpeg", "-hide_banner", "-i", str(path), "-af", af, "-f", "null", "-"], cwd=cwd, capture_output=True, text=True)
    m = re.search(r"\{[^{}]*\"input_i\"[^{}]*\}", res.stderr, re.S)
    return json.loads(m.group(0)) if m else {}


# ------------------------------------------------------------------ main

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("project", nargs="?")
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--preview", action="store_true")
    g.add_argument("--final", action="store_true")
    args = ap.parse_args()
    require("ffmpeg")
    proj = resolve_project(args.project)
    brand = proj.brand
    cl = proj.work / "cutlist.json"
    if not cl.exists():
        die("no work/cutlist.json — run /cutlist first")
    cut = load_json(cl)
    if not cut.get("segments"):
        die("cutlist has no segments")
    length = round(sum(s["out"] - s["in"] for s in cut["segments"]), 3)
    cut["length"] = length
    fps = int(cut.get("fps", 30))
    mode = "final" if args.final else "preview"
    W, H = (FINAL_W, FINAL_H) if args.final else (PREVIEW_W, PREVIEW_H)
    proj.work.mkdir(exist_ok=True)
    proj.export.mkdir(exist_ok=True)

    # 1. Audio mix → wav
    a_in, a_graph, a_out, a_desc = audio_graph(cut, proj, length)
    mix_wav = proj.work / f"mix_{mode}.wav"
    print(f"[1/3] Mixing audio: {a_desc}")
    ff(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *a_in, "-filter_complex", a_graph, "-map", f"[{a_out}]",
        "-c:a", "pcm_s16le", "-ar", "48000", str(mix_wav.relative_to(proj.path))], proj.path)

    # 2. Loudness
    if args.final:
        m = measure_loudness(mix_wav, proj.path)
        af = (f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
              f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000"
              if m else f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11,aresample=48000")
        print(f"[2/3] Loudness measured {m.get('input_i', '?')} LUFS → normalising to {TARGET_LUFS:g} LUFS (two-pass)")
    else:
        af = f"loudnorm=I={TARGET_LUFS}:TP=-1.5:LRA=11,aresample=48000"

    # 3. Video + mux
    v_in, v_graph, v_out = video_graph(cut, proj, brand, W, H, fps, mode)
    n_v_inputs = sum(1 for a in v_in if a == "-i")
    out = proj.export / "final.mp4" if args.final else proj.work / "preview.mp4"
    enc = (["-c:v", "libx264", "-preset", "slow", "-crf", "18", "-profile:v", "high", "-level", "4.2"]
           if args.final else ["-c:v", "libx264", "-preset", "veryfast", "-crf", "26"])
    print(f"[3/3] Rendering {W}x{H} @ {fps} fps, {len(cut['segments'])} segments, {length:.2f}s → {out.relative_to(proj.path)}")
    ff(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", *v_in, "-i", str(mix_wav.relative_to(proj.path)),
        "-filter_complex", v_graph, "-map", f"[{v_out}]", "-map", f"{n_v_inputs}:a", "-af", af,
        *enc, "-pix_fmt", "yuv420p", "-r", str(fps), "-g", str(fps * 2),
        "-color_primaries", "bt709", "-color_trc", "bt709", "-colorspace", "bt709",
        "-c:a", "aac", "-b:a", "192k" if args.final else "128k", "-ar", "48000",
        "-movflags", "+faststart", "-t", f"{length:.3f}", str(out.relative_to(proj.path))], proj.path)

    info = summarize(out)
    loud = measure_loudness(out, proj.path)
    report = (f"{info['width']}x{info['height']} {info['vcodec']} {info['fps']:g} fps, {info['duration']:.2f}s, "
              f"{info.get('acodec')} {info.get('sample_rate')} Hz, {float(loud.get('input_i', 'nan')):.1f} LUFS, "
              f"TP {float(loud.get('input_tp', 'nan')):.1f} dBTP, {out.stat().st_size / 1e6:.1f} MB")
    print(f"✓ {out.relative_to(proj.path)}: {report}")

    if args.final:
        import cover
        cover.make_cover(out, proj.export / "cover.jpg", cut)
        srt = proj.work / "captions.srt"
        if srt.exists():
            shutil.copy(srt, proj.export / "captions.srt")
        write_edit_log(proj, cut, a_desc, report)
        checks = [
            ("1080x1920", info["width"] == 1080 and info["height"] == 1920),
            ("H.264", info["vcodec"] == "h264"),
            ("AAC", info.get("acodec") == "aac"),
            ("-14 LUFS ±1", abs(float(loud.get("input_i", 0)) - TARGET_LUFS) <= 1.0),
            ("7–90 s", 7 <= info["duration"] <= 90),
        ]
        print("Checks: " + "  ".join(f"{'✓' if ok else '✗'} {name}" for name, ok in checks))
        print("Exported: export/final.mp4, export/cover.jpg" + (", export/captions.srt" if srt.exists() else "") + ", export/edit-log.md")
    else:
        print("Preview ready — check it on a phone in 9:16, then approve or request changes before /final.")


def write_edit_log(proj, cut: dict, audio_desc: str, report: str):
    lines = [f"# Edit log — {proj.path.name}", "", f"Rendered {dt.datetime.now():%Y-%m-%d %H:%M}", "",
             f"**Output:** {report}", "", f"**Audio:** {audio_desc}; 0.3 s fade in/out; two-pass loudnorm to {TARGET_LUFS:g} LUFS / -1.5 dBTP", "",
             "## Cuts", "", "| # | Timeline | Source | In → Out | Punch-in | Notes |", "|---|---|---|---|---|---|"]
    t = 0.0
    for i, s in enumerate(cut["segments"], 1):
        d = s["out"] - s["in"]
        lines.append(f"| {i} | {t:6.2f} → {t + d:6.2f} | {Path(s['src']).name} | {s['in']:.2f} → {s['out']:.2f} | "
                     f"{float(s.get('punch_in', 1)):.2f}× | {s.get('note', '')} |")
        t += d
    lines += ["", f"**Captions:** {cut.get('captions') or 'none'}", "", "## Commands", "", "```"] + COMMANDS + ["```", ""]
    (proj.export / "edit-log.md").write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
