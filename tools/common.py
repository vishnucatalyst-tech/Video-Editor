"""Shared helpers for the Weequb Reels tools: paths, brand config, ffmpeg/ffprobe wrappers."""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BRANDS = ROOT / "brands"
TEMPLATES = ROOT / "templates"
FONTS = ROOT / "fonts"

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".mkv", ".webm", ".avi", ".mts", ".3gp"}
AUDIO_EXT = {".wav", ".mp3", ".m4a", ".aac", ".flac", ".ogg", ".opus"}
IMAGE_EXT = {".jpg", ".jpeg", ".png", ".webp", ".heic"}

# Output spec from CLAUDE.md
FINAL_W, FINAL_H = 1080, 1920
PREVIEW_W, PREVIEW_H = 540, 960
SAFE_TOP, SAFE_BOTTOM, SAFE_SIDE = 250, 320, 60  # px at 1080x1920
TARGET_LUFS = -14.0


def die(msg: str, code: int = 1):
    print(f"error: {msg}", file=sys.stderr)
    sys.exit(code)


def run(cmd: list[str], *, quiet: bool = False, capture: bool = False) -> subprocess.CompletedProcess:
    """Run a command, echoing it (CLAUDE.md: show commands you ran)."""
    if not quiet:
        print("$ " + " ".join(_q(c) for c in cmd), file=sys.stderr)
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        tail = "\n".join((res.stderr or "").strip().splitlines()[-25:])
        die(f"command failed ({cmd[0]}):\n{tail}")
    return res


def _q(s: str) -> str:
    return s if re.fullmatch(r"[\w@%+=:,./-]+", s) else "'" + s.replace("'", "'\\''") + "'"


def require(binary: str):
    if not shutil.which(binary):
        die(f"'{binary}' not found on PATH — see README.md › Machine prerequisites")


# ---------------------------------------------------------------- projects

@dataclass
class Project:
    path: Path

    @property
    def raw(self) -> Path:
        return self.path / "raw"

    @property
    def work(self) -> Path:
        return self.path / "work"

    @property
    def export(self) -> Path:
        return self.path / "export"

    @property
    def brief(self) -> Path:
        return self.path / "brief.md"

    @property
    def brand_dir(self) -> Path:
        # brands/<brand>/projects/<project>
        return self.path.parent.parent

    @property
    def brand(self) -> "Brand":
        return Brand.load(self.brand_dir)

    def raw_files(self, kinds: set[str] | None = None) -> list[Path]:
        exts = kinds or (VIDEO_EXT | AUDIO_EXT | IMAGE_EXT)
        return sorted(p for p in self.raw.rglob("*") if p.is_file() and p.suffix.lower() in exts and not p.name.startswith("."))


def resolve_project(arg: str | None) -> Project:
    """Accept a project path, or default to the current directory if it is a project."""
    p = Path(arg).expanduser().resolve() if arg else Path.cwd()
    while p != p.parent:
        if (p / "raw").is_dir() and p.parent.name == "projects":
            return Project(p)
        p = p.parent
    die("not inside a project folder (brands/<brand>/projects/<date_topic>/). Pass the project path.")


# ---------------------------------------------------------------- brands

@dataclass
class Brand:
    path: Path
    config: dict

    @classmethod
    def load(cls, path: Path) -> "Brand":
        md = path / "BRAND.md"
        cfg = parse_front_matter(md.read_text(encoding="utf-8")) if md.exists() else {}
        return cls(path, cfg)

    def get(self, key: str, default=None):
        v = self.config.get(key)
        return default if v in (None, "") else v

    def color(self, key: str, default: str) -> str:
        v = str(self.get(key, default)).strip()
        return v if re.fullmatch(r"#?[0-9a-fA-F]{6}", v) else default

    def asset(self, key: str) -> Path | None:
        v = self.get(key)
        if not v:
            return None
        p = (self.path / v) if not Path(v).is_absolute() else Path(v)
        return p if p.exists() else None

    @property
    def fonts_dir(self) -> Path:
        return self.path / "assets" / "fonts"


def parse_front_matter(text: str) -> dict:
    """Parse the flat `key: value` YAML front matter at the top of BRAND.md."""
    m = re.match(r"^---\s*\n(.*?)\n---\s*(\n|$)", text, re.S)
    if not m:
        return {}
    out: dict = {}
    for line in m.group(1).splitlines():
        line = line.split(" #", 1)[0].rstrip()
        if not line.strip() or line.lstrip().startswith("#") or ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip().strip('"').strip("'")
        if re.fullmatch(r"-?\d+(\.\d+)?", v):
            v = float(v) if "." in v else int(v)
        elif v.lower() in ("true", "false"):
            v = v.lower() == "true"
        out[k.strip()] = v
    return out


# ---------------------------------------------------------------- media

def probe(path: Path) -> dict:
    require("ffprobe")
    res = run(
        ["ffprobe", "-v", "error", "-print_format", "json", "-show_format", "-show_streams", str(path)],
        quiet=True,
    )
    return json.loads(res.stdout)


def summarize(path: Path) -> dict:
    """Compact facts about a media file."""
    info = probe(path)
    v = next((s for s in info.get("streams", []) if s.get("codec_type") == "video" and not s.get("disposition", {}).get("attached_pic")), None)
    a = next((s for s in info.get("streams", []) if s.get("codec_type") == "audio"), None)
    dur = float(info.get("format", {}).get("duration") or (v or a or {}).get("duration") or 0)
    out = {"file": path.name, "path": str(path), "duration": round(dur, 3)}
    if v:
        w, h = int(v.get("width", 0)), int(v.get("height", 0))
        rot = _rotation(v)
        if rot in (90, 270):
            w, h = h, w
        fps = _fps(v.get("avg_frame_rate") or v.get("r_frame_rate"))
        out.update(
            kind="image" if path.suffix.lower() in IMAGE_EXT else "video",
            width=w,
            height=h,
            rotation=rot,
            fps=fps,
            vcodec=v.get("codec_name"),
            pix_fmt=v.get("pix_fmt"),
            aspect=f"{w}:{h}" if w and h else "?",
            vertical=bool(w and h and abs(w / h - 9 / 16) < 0.02),
        )
    else:
        out["kind"] = "audio" if a else "unknown"
    if a:
        out.update(acodec=a.get("codec_name"), channels=a.get("channels"), sample_rate=int(a.get("sample_rate", 0)))
    out["has_audio"] = bool(a)
    return out


def _fps(rate: str | None) -> float:
    try:
        n, d = (rate or "0/1").split("/")
        return round(float(n) / float(d), 3) if float(d) else 0.0
    except ValueError:
        return 0.0


def _rotation(stream: dict) -> int:
    rot = stream.get("tags", {}).get("rotate")
    for sd in stream.get("side_data_list", []) or []:
        if "rotation" in sd:
            rot = sd["rotation"]
    try:
        return int(float(rot or 0)) % 360
    except ValueError:
        return 0


def hex_to_ass(color: str, alpha: int = 0) -> str:
    """#RRGGBB -> ASS &HAABBGGRR."""
    c = color.lstrip("#")
    r, g, b = c[0:2], c[2:4], c[4:6]
    return f"&H{alpha:02X}{b}{g}{r}".upper()


def fmt_ts(t: float) -> str:
    m, s = divmod(max(0.0, t), 60)
    return f"{int(m):02d}:{s:06.3f}"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
