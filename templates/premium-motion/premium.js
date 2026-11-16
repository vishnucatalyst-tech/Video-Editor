/* Weequb premium motion — LOCKED motion system (approved 2026-11-16).
 * Every element uses PM.enter; every scene change uses PM.sceneIn/PM.sceneOut; icons draw with PM.drawIcon.
 * Timings below are the approved values. New scenes reuse them; do not invent new easings or durations.
 */
(function () {
  const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const io = (t, a, b) => cl((t - a) / (b - a));
  const ex = x => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));   // ease-out expo: quick start, long calm settle, no overshoot
  const ss = x => x * x * (3 - 2 * x);                          // smoothstep, for scene transitions

  const T = {
    TEXT_IN: 0.9,        // s, text entrance
    CARD_IN: 1.0,        // s, card/panel entrance
    PANEL_IN: 1.1,       // s, large panel entrance
    BLUR: 14,            // px blur at the start of an entrance
    SCALE_FROM: 0.96,
    DRIFT: 6,            // px/s upward drift after landing ("slow motion")
    STAGGER: 0.28,       // s between grouped elements
    ICON_DRAW: [0.15, 0.85], // s after the card's start: icon stroke draws on
    XFADE: 0.35,         // s, scene transition
    XBLUR: 22,           // px blur on the outgoing scene
    XZOOM: 0.10,         // outgoing scene scales 1 -> 1.10
    XIN_FROM: 1.06,      // incoming scene settles 1.06 -> 1
  };

  /** Calm entrance: blur 14->0, rise `rise` px, scale .96->1, then keep drifting up 6 px/s. */
  function enter(el, t, at, d = T.TEXT_IN, rise = 50) {
    const k = ex(io(t, at, at + d)), drift = Math.max(0, t - at) * -T.DRIFT;
    el.style.opacity = k;
    el.style.filter = `blur(${(1 - k) * T.BLUR}px)`;
    el.style.transform = `translateY(${(1 - k) * rise + drift}px) scale(${T.SCALE_FROM + (1 - T.SCALE_FROM) * k})`;
  }

  /** Stroke icons inside `el` draw themselves on, starting ICON_DRAW after the card's entrance time. */
  function drawIcon(el, t, at) {
    el.querySelectorAll('svg path,svg circle,svg rect,svg line,svg polyline').forEach(p => {
      if (!p.dataset.L) { const L = p.getTotalLength ? p.getTotalLength() : 80; p.dataset.L = L; p.style.strokeDasharray = L; }
      p.style.strokeDashoffset = p.dataset.L * (1 - ex(io(t, at + T.ICON_DRAW[0], at + T.ICON_DRAW[1])));
    });
  }

  /** Scene visibility for a scene living from `start` to `end` (end = when the zoom-through-blur out starts). */
  function scene(el, t, start, end, { first = false, lift = false } = {}) {
    const i = first ? 1 : ss(io(t, start, start + T.XFADE));
    const o = end == null ? 0 : ss(io(t, end, end + T.XFADE));
    el.style.opacity = i * (1 - o);
    el.style.filter = `blur(${o * T.XBLUR}px)`;
    const sc = o > 0 ? 1 + T.XZOOM * o : T.XIN_FROM - (T.XIN_FROM - 1) * i;
    el.style.transform = `scale(${first && o === 0 ? 1 : sc})` + (lift && o > 0 ? ` translateY(${-60 * o}px)` : '');
  }

  /** Background glows drift continuously. */
  function ambient(t, gold, blue) {
    if (gold) gold.style.transform = `translate(${-120 + 60 * Math.sin(t * .5)}px,${200 + 40 * t}px)`;
    if (blue) blue.style.transform = `translate(${520 - 50 * t}px,${1100 - 30 * Math.sin(t * .6)}px)`;
  }

  /** Logo lockup: blur-in + slow scale, light sweep 0.4 s later. */
  function logo(wrap, sweep, t, at) {
    const k = ex(io(t, at, at + 0.9));
    wrap.style.opacity = k; wrap.style.filter = `blur(${(1 - k) * 16}px)`;
    wrap.style.transform = `scale(${0.86 + 0.14 * k + Math.max(0, t - at) * 0.01})`;
    if (sweep) sweep.style.left = (-160 + 560 * ss(io(t, at + 0.4, at + 1.0))) + 'px';
  }

  /** Soft accent glow that rises and settles over `d` s, so a held card still has a visual change. */
  function highlight(el, t, at, d = 0.7) {
    const k = Math.sin(Math.PI * io(t, at, at + d));
    if (k <= 0.001) { el.style.borderColor = ''; el.style.boxShadow = ''; return; }
    el.style.borderColor = `rgba(255,212,0,${0.14 + 0.55 * k})`;
    el.style.boxShadow = `0 30px 80px rgba(0,0,0,.45),inset 0 1px 0 rgba(255,255,255,.18),0 0 ${70 * k}px rgba(255,212,0,${0.32 * k})`;
  }

  /** Line icons (24x24, stroke only). Add new ones here in the same style: 2.2 stroke, round caps, no fills. */
  const ICONS = {
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/>',
    phone: '<rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    cart: '<circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.5 12h12L22 7H6"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shield: '<path d="M12 2 4 5v6c0 5 3.5 9 8 11 4.5-2 8-6 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2c3 3 4.5 6.5 4.5 10S15 19 12 22c-3-3-4.5-6.5-4.5-10S9 5 12 2z"/>',
    chat: '<path d="M21 12a8 8 0 0 1-12 7l-6 2 2-6a8 8 0 1 1 16-3z"/>',
    star: '<path d="m12 2 3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21.1l1.4-7L2 9.3l7-.8L12 2z"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m8 12 3 3 5-6"/>',
    code: '<path d="m8 6-6 6 6 6M16 6l6 6-6 6M14 4l-4 16"/>',
    rocket: '<path d="M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 11a14 14 0 0 1 11-9 14 14 0 0 1-9 11l-2 2-4-4 2-2z"/><circle cx="15" cy="9" r="1.5"/>',
    pen: '<path d="M16 3l5 5L8 21H3v-5L16 3z"/>',
  };
  const icon = name => `<svg viewBox="0 0 24 24">${ICONS[name] || ICONS.check}</svg>`;

  /** Icon card markup (glass row). top: px. */
  const card = (id, top, iconName, title, sub) =>
    `<div class="abs glass pm-card" id="${id}" style="top:${top}px"><div class="pm-ic">${icon(iconName)}</div><div><b>${title}</b><span>${sub}</span></div></div>`;

  /** Grain overlay markup. */
  const grain = () => '<svg class="pm-grain" width="1080" height="1920"><filter id="pmn"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/></filter><rect width="100%" height="100%" filter="url(#pmn)"/></svg>';

  window.PM = { T, cl, io, ex, ss, enter, drawIcon, scene, ambient, logo, highlight, ICONS, icon, card, grain };
})();
