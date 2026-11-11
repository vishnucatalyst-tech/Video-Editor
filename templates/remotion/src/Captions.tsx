import { useEffect, useState } from 'react';
import { AbsoluteFill, Sequence, continueRender, delayRender, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export type CaptionProps = {
  words: { word: string; start: number; end: number }[];
  durationInFrames: number;
  fps: number;
  style: 'pop' | 'karaoke' | 'minimal';
  position: 'lower' | 'middle' | 'upper';
  font: string;
  textColor: string;
  accentColor: string;
  outlineColor: string;
  uppercase: boolean;
};

// Instagram safe zones at 1080x1920: 250 px top, 320 px bottom, 60 px sides.
const POSITION: Record<CaptionProps['position'], React.CSSProperties> = {
  lower: { justifyContent: 'flex-end', paddingBottom: 320 + 140 },
  middle: { justifyContent: 'center' },
  upper: { justifyContent: 'flex-start', paddingTop: 250 + 120 },
};
const MAX_WORDS: Record<CaptionProps['style'], number> = { pop: 3, karaoke: 5, minimal: 6 };
const MAX_CHARS: Record<CaptionProps['style'], number> = { pop: 20, karaoke: 30, minimal: 34 };

type Token = { text: string; fromMs: number; toMs: number };
type Page = { startMs: number; endMs: number; tokens: Token[] };

/** Same rules as tools/subtitles.py: break at pauses, punctuation and length limits. */
function toPages(words: CaptionProps['words'], style: CaptionProps['style']): Page[] {
  const pages: Page[] = [];
  let cur: Token[] = [];
  const flush = () => {
    if (cur.length) pages.push({ startMs: cur[0].fromMs, endMs: cur[cur.length - 1].toMs, tokens: cur });
    cur = [];
  };
  for (const w of words) {
    const text = w.word.trim();
    if (!text) continue;
    if (cur.length) {
      const last = cur[cur.length - 1];
      const chars = cur.reduce((n, t) => n + t.text.length + 1, 0) + text.length;
      if (w.start * 1000 - last.toMs > 450 || cur.length >= MAX_WORDS[style] || chars > MAX_CHARS[style] || /[.!?,;:]$/.test(last.text)) flush();
    }
    cur.push({ text, fromMs: w.start * 1000, toMs: w.end * 1000 });
  }
  flush();
  return pages;
}

// Starter font set from the setup guide. Add a brand font here (one import per family) —
// importing everything from @remotion/google-fonts makes the bundle too large to build.
const FONTS: Record<string, () => Promise<{ loadFont: (style?: 'normal', opts?: { weights?: string[] }) => { waitUntilDone: () => Promise<unknown> } }>> = {
  inter: () => import('@remotion/google-fonts/Inter') as never,
  montserrat: () => import('@remotion/google-fonts/Montserrat') as never,
  poppins: () => import('@remotion/google-fonts/Poppins') as never,
  'bebas neue': () => import('@remotion/google-fonts/BebasNeue') as never,
  'noto sans tamil': () => import('@remotion/google-fonts/NotoSansTamil') as never,
  'mukta malar': () => import('@remotion/google-fonts/MuktaMalar') as never,
};

/** Load a Google Font by family name (falls back to the system font if unknown). */
function useGoogleFont(family: string) {
  const [handle] = useState(() => delayRender(`font ${family}`));
  useEffect(() => {
    const load = FONTS[family.toLowerCase()];
    if (!load) {
      continueRender(handle);
      return;
    }
    load()
      .then((m) => m.loadFont('normal', { weights: [family.toLowerCase() === 'bebas neue' ? '400' : '800'] }).waitUntilDone())
      .catch(() => undefined)
      .finally(() => continueRender(handle));
  }, [family, handle]);
}

export const Captions: React.FC<CaptionProps> = (props) => {
  useGoogleFont(props.font);
  const { fps } = useVideoConfig();
  const pages = toPages(props.words, props.style);

  return (
    <AbsoluteFill style={{ alignItems: 'center', padding: '0 80px', ...POSITION[props.position] }}>
      {pages.map((page, i) => {
        const next = pages[i + 1]?.startMs ?? Infinity;
        const endMs = Math.min(next, page.endMs + 150);
        const from = Math.round((page.startMs / 1000) * fps);
        const dur = Math.max(1, Math.round(((endMs - page.startMs) / 1000) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <PageView page={page} props={props} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

const PageView: React.FC<{ page: Page; props: CaptionProps }> = ({ page, props }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const nowMs = page.startMs + (frame / fps) * 1000;
  const enter = spring({ frame, fps, config: { damping: 14, stiffness: 220 } });
  const scale = props.style === 'minimal' ? 1 : interpolate(enter, [0, 1], [0.8, 1]);
  const opacity = props.style === 'minimal' ? interpolate(frame, [0, 4], [0, 1], { extrapolateRight: 'clamp' }) : 1;

  return (
    <div
      style={{
        fontFamily: `${props.font}, Inter, sans-serif`,
        fontWeight: 800,
        fontSize: props.style === 'minimal' ? 64 : 84,
        lineHeight: 1.15,
        textAlign: 'center',
        textTransform: props.uppercase ? 'uppercase' : 'none',
        color: props.textColor,
        WebkitTextStroke: `${props.style === 'minimal' ? 6 : 12}px ${props.outlineColor}`,
        paintOrder: 'stroke fill',
        textShadow: '0 6px 18px rgba(0,0,0,0.45)',
        transform: `scale(${scale})`,
        opacity,
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        columnGap: '0.38em',
      }}
    >
      {page.tokens.map((t, i) => {
        const active = nowMs >= t.fromMs && nowMs < t.toMs;
        const sung = nowMs >= t.fromMs;
        const color =
          props.style === 'pop' ? (active ? props.accentColor : props.textColor) : props.style === 'karaoke' ? (sung ? props.accentColor : props.textColor) : props.textColor;
        const pop = props.style === 'pop' && active ? 1.08 : 1;
        return (
          <span key={i} style={{ color, display: 'inline-block', transform: `scale(${pop})` }}>
            {t.text}
          </span>
        );
      })}
    </div>
  );
};
