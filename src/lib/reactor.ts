// ARNAV-OS boot (SPEC "Landing page" row 0, "Loading states"): a transformer drawn horizontally across the whole screen,
// with an original glowing core at the centre. Tokens enter at the left, pass through embedding, attention + feed-forward
// blocks, the core, more blocks and a softmax head, and the name decodes at the right. Every block lights in turn as REAL
// loading progress rises (fonts, portrait, the dot matrix), and the core's ring fills with the true percentage. When
// everything is ready the core ignites, the whole structure bursts into particles, and the particles recombine, quickly,
// into the exact dots of the dot portrait and of the dotted name, which then take over as the real hero.
// The timeline and the particle paths are pure and unit-tested; drawing is Canvas 2D with no library. Colours come from
// the theme tokens: the amber accent for the machine (it is drawn in the page's own dots and hairlines), the final colours for the dots it becomes.

// ——— Timeline ————————————————————————————————————————————————————————————————————————————————

export const R = {
  /** The charge never finishes faster than this, so the animation reads. */
  MIN_CHARGE: 2400,
  /** Past this the charge completes even if assets are still loading. */
  MAX_WAIT: 6500,
  /** After ignition (ms): the flash, when the burst ends and the recombine begins, its length, the hand-off, the end. */
  FLASH: 380,
  RECOMBINE_FROM: 880,
  RECOMBINE: 1050,
  HANDOFF_AT: 1850,
  DONE_AT: 2250,
} as const;

export type ReactorPhase = 'charge' | 'ignite' | 'burst' | 'recombine' | 'settle' | 'done';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const easeInOut = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};

export interface ReactorStep {
  igniteAt: number | null;
  phase: ReactorPhase;
  /** Displayed charge, 0–1: the lower of real progress and the minimum-duration curve. */
  charge: number;
  /** Milliseconds since ignition (0 while charging). */
  since: number;
}

/** Where the boot is at time `t` (ms), given real loading progress (0–1). `igniteAt` is the previous step's value. */
export function reactorStep(igniteAt: number | null, t: number, real: number): ReactorStep {
  const effective = t >= R.MAX_WAIT ? 1 : clamp01(real);
  const charge = Math.min(effective, easeOut(t / R.MIN_CHARGE));
  const at = igniteAt ?? (charge >= 1 ? t : null);
  if (at === null) return { igniteAt: null, phase: 'charge', charge, since: 0 };
  const since = t - at;
  const phase: ReactorPhase =
    since < R.FLASH
      ? 'ignite'
      : since < R.RECOMBINE_FROM
        ? 'burst'
        : since < R.HANDOFF_AT
          ? 'recombine'
          : since < R.DONE_AT
            ? 'settle'
            : 'done';
  return { igniteAt: at, phase, charge: 1, since };
}

/** Total length when everything is already loaded. */
export const fastestReactor = (): number => R.MIN_CHARGE + R.DONE_AT;

// ——— Colour ————————————————————————————————————————————————————————————————————————————————————

/** Reads `#rrggbb` or `rgb(r g b)` / `rgb(r, g, b)`: the tokens are hex, the dot-matrix ramp is rgb(). */
export function rgbOf(c: string): [number, number, number] {
  if (c.startsWith('#') && c.length >= 7)
    return [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
  const n = (c.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
  return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0];
}

/** Linear blend of two colours, as an `rgb()` string. */
export function mixColour(a: string, b: string, t: number): string {
  const pa = rgbOf(a);
  const pb = rgbOf(b);
  return `rgb(${pa.map((v, i) => Math.round(v + ((pb[i] ?? 0) - v) * clamp01(t))).join(' ')})`;
}

// ——— Small deterministic helpers ——————————————————————————————————————————————————————————————

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One attention matrix: rows are softmax distributions over the token columns. */
export function attentionWeights(n: number, seed: number, temperature = 0.35): number[][] {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, () => {
    const logits = Array.from({ length: n }, () => rand() / temperature);
    const max = Math.max(...logits);
    const exp = logits.map((l) => Math.exp(l - max));
    const sum = exp.reduce((a, b) => a + b, 0);
    return exp.map((e) => e / sum);
  });
}

// ——— Layout ——————————————————————————————————————————————————————————————————————————————————

export interface Stage {
  kind: 'embed' | 'layer' | 'head';
  /** Centre x, in px. */
  x: number;
  label: string;
}
export interface ReactorLayout {
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** Block size. */
  bw: number;
  bh: number;
  core: { x: number; y: number; r: number };
  /** Stages left to right; `coreIndex` is where the core sits between them (stages before it are left of the core). */
  stages: Stage[];
  coreIndex: number;
  chips: { x: number; y: number; w: number; h: number }[];
  out: { x: number; y: number; size: number }[];
  compact: boolean;
}

/** The pipeline across the screen. Phones (narrow) get a shorter pipeline, so each part stays legible. */
export function reactorLayout(
  w: number,
  h: number,
  tokens: number,
  outputLength: number,
): ReactorLayout {
  const compact = w < 760;
  const cx = w / 2;
  const cy = h * 0.5;
  const spec: [Stage['kind'], string, number][] = compact
    ? [
        ['embed', 'EMBED', 0.25],
        ['layer', 'L1', 0.375],
        ['layer', 'L2', 0.625],
        ['head', 'SOFTMAX', 0.75],
      ]
    : [
        ['embed', 'EMBED', 0.17],
        ['layer', 'L1', 0.265],
        ['layer', 'L2', 0.36],
        ['layer', 'L3', 0.64],
        ['layer', 'L4', 0.735],
        ['head', 'SOFTMAX', 0.83],
      ];
  const bw = w * (compact ? 0.085 : 0.066);
  const bh = Math.min(h * 0.3, bw * 3.4);
  const chipW = w * (compact ? 0.085 : 0.06);
  const chipH = Math.min(h * 0.045, 26);
  const chipX = w * (compact ? 0.09 : 0.075);
  const span = Math.min(h * 0.4, tokens * (chipH + 8));
  const outX = w * (compact ? 0.89 : 0.925);
  const outSize = Math.min(w * (compact ? 0.06 : 0.034), h * 0.07);
  const outSpan = outSize * 1.35 * Math.max(1, outputLength);
  return {
    w,
    h,
    cx,
    cy,
    bw,
    bh,
    compact,
    core: { x: cx, y: cy, r: Math.min(h * 0.115, w * 0.075) },
    coreIndex: spec.findIndex(([, , f]) => f > 0.5),
    stages: spec.map(([kind, label, f]) => ({ kind, label, x: w * f })),
    chips: Array.from({ length: tokens }, (_, i) => ({
      x: chipX,
      y: cy - span / 2 + (span * (i + 0.5)) / Math.max(1, tokens) - chipH / 2,
      w: chipW,
      h: chipH,
    })),
    out: Array.from({ length: outputLength }, (_, i) => ({
      x: outX,
      y: cy - outSpan / 2 + outSize * 1.35 * (i + 0.5),
      size: outSize,
    })),
  };
}

// ——— Particles ———————————————————————————————————————————————————————————————————————————————

export interface Target {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
  /** Drawn as a circle (the name's dots are round) rather than a square (the portrait's cells are square). */
  round?: boolean;
}

export interface Particle {
  sx: number;
  sy: number;
  /** Unit direction and initial speed (px/s) of the burst. */
  dx: number;
  dy: number;
  v0: number;
  /** 0–1 stagger of the recombine, and the sideways swing (px) of its path. */
  delay: number;
  swing: number;
  target: Target;
}

/** Seconds the burst keeps expanding before the recombine takes over. */
export const BURST_SECONDS = (R.RECOMBINE_FROM - R.FLASH * 0.6) / 1000;
const DRAG = 3;

/** Where a particle is, `since` ms after ignition: at rest, then flung outwards with drag, then pulled to its target. */
export function particlePos(p: Particle, since: number): { x: number; y: number; local: number } {
  const tau = Math.min(Math.max(0, since - R.FLASH * 0.6) / 1000, BURST_SECONDS);
  const reach = (p.v0 * (1 - Math.exp(-DRAG * tau))) / DRAG;
  const bx = p.sx + p.dx * reach;
  const by = p.sy + p.dy * reach;
  const rec = clamp01(
    (since - R.RECOMBINE_FROM - p.delay * R.RECOMBINE * 0.3) / (R.RECOMBINE * 0.7),
  );
  const local = easeInOut(rec);
  // A gentle arc: sideways (perpendicular to the way it travels) by `swing`, strongest mid-flight.
  const tx = p.target.x - bx;
  const ty = p.target.y - by;
  const len = Math.hypot(tx, ty) || 1;
  const bend = Math.sin(Math.PI * local) * p.swing;
  return {
    x: lerp(bx, p.target.x, local) + (-ty / len) * bend,
    y: lerp(by, p.target.y, local) + (tx / len) * bend,
    local,
  };
}

/** Evenly thins a list to at most `max`, keeping its spread (so a capped portrait still looks like the portrait). */
export function capTargets<T>(items: readonly T[], max: number): T[] {
  if (items.length <= max) return [...items];
  const out: T[] = [];
  const step = items.length / max;
  for (let i = 0; i < max; i++) {
    const item = items[Math.floor(i * step)];
    if (item !== undefined) out.push(item);
  }
  return out;
}

/** Points along the machine (block outlines, the core's rings, the connectors): where the burst starts from. */
export function structurePoints(l: ReactorLayout, spacing = 7): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const line = (x0: number, y0: number, x1: number, y1: number): void => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / spacing));
    for (let i = 0; i <= n; i++) pts.push({ x: lerp(x0, x1, i / n), y: lerp(y0, y1, i / n) });
  };
  const rect = (x: number, y: number, w: number, h: number): void => {
    line(x, y, x + w, y);
    line(x + w, y, x + w, y + h);
    line(x + w, y + h, x, y + h);
    line(x, y + h, x, y);
  };
  for (const s of l.stages) rect(s.x - l.bw / 2, l.cy - l.bh / 2, l.bw, l.bh);
  for (const c of l.chips) rect(c.x - c.w / 2, c.y, c.w, c.h);
  const xs = [l.chips[0]?.x ?? 0, ...l.stages.map((s) => s.x), l.core.x, l.out[0]?.x ?? l.w];
  xs.sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) line(xs[i] ?? 0, l.cy, xs[i + 1] ?? 0, l.cy);
  for (const k of [1, 0.74, 0.5]) {
    const r = l.core.r * k;
    const n = Math.round((2 * Math.PI * r) / spacing);
    for (let i = 0; i < n; i++)
      pts.push({
        x: l.core.x + Math.cos((i / n) * Math.PI * 2) * r,
        y: l.core.y + Math.sin((i / n) * Math.PI * 2) * r,
      });
  }
  return pts;
}

/** One particle per target: each starts on the machine, is flung outwards from the core, then flies to its dot. */
export function makeParticles(targets: readonly Target[], l: ReactorLayout, seed = 11): Particle[] {
  const rand = mulberry32(seed);
  const pool = structurePoints(l);
  const unit = Math.min(l.w, l.h) / 900;
  return targets.map((target, i) => {
    const s = pool[(i * 7919) % pool.length] ?? { x: l.cx, y: l.cy };
    const ax = s.x - l.core.x;
    const ay = s.y - l.core.y;
    const len = Math.hypot(ax, ay) || 1;
    // Outwards from the core, turned a little at random so the burst is a cloud and not a starburst.
    const turn = (rand() - 0.5) * 1.5;
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    return {
      sx: s.x + (rand() - 0.5) * 3,
      sy: s.y + (rand() - 0.5) * 3,
      dx: (ax / len) * cos - (ay / len) * sin,
      dy: (ax / len) * sin + (ay / len) * cos,
      v0: (220 + rand() * 760) * unit,
      delay: rand(),
      swing: (rand() - 0.5) * 120 * unit,
      target,
    };
  });
}

// ——— Drawing ———————————————————————————————————————————————————————————————————————————————

interface Palette {
  bg: string;
  holo: string;
  text: string;
  text2: string;
  line: string;
  amber: string;
  action: string;
  mono: string;
  /** The display face the hero name is set in. */
  display: string;
  day: boolean;
}

function readPalette(root: HTMLElement): Palette {
  const cs = getComputedStyle(root);
  const v = (name: string): string => cs.getPropertyValue(name).trim();
  return {
    bg: v('--bg'),
    holo: v('--holo'),
    text: v('--text'),
    text2: v('--text-2'),
    line: v('--line'),
    amber: v('--time'),
    action: v('--action'),
    mono: v('--font-mono') || 'monospace',
    display: v('--font-display') || 'sans-serif',
    day: root.dataset['theme'] === 'day',
  };
}

export interface ReactorOptions {
  tokens: readonly string[];
  output: string;
  log: readonly string[];
  /** Live 0–1 progress of real assets. */
  progress: () => number;
  /** The dots the particles become, in viewport px: read when the burst starts (the dot matrix is ready by then). */
  targets: () => Target[];
  onHandoff: () => void;
  onDone: () => void;
}

const MAX_PARTICLES = 6500;
const MAX_PARTICLES_PHONE = 3000;

/** Runs the boot on the canvas; returns a stop function (used by skip). */
export function runReactor(canvas: HTMLCanvasElement, opts: ReactorOptions): () => void {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    opts.onHandoff();
    opts.onDone();
    return () => undefined;
  }
  const root = document.documentElement;
  const pal = readPalette(root);
  const dpr = Math.min(devicePixelRatio || 1, 1.5);
  let w = 0;
  let h = 0;
  let lay: ReactorLayout;
  const resize = (): void => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lay = reactorLayout(w, h, opts.tokens.length, [...opts.output].length);
  };
  resize();
  addEventListener('resize', resize);

  const attn = Array.from({ length: 4 }, (_, i) => attentionWeights(5, 7 + i * 13));
  const rand = mulberry32(42);
  const letters = [...opts.output];
  const overlay = canvas.parentElement;
  const unit = (): number => Math.min(w, h) / 900;
  const stageIndexLit = (i: number, count: number, charge: number): number =>
    clamp01((charge - (i / count) * 0.9) / 0.12);

  // Pulses travel along the pipeline's centre line; their number and speed follow the charge.
  interface Pulse {
    s: number;
    speed: number;
    lane: number;
  }
  const pulses: Pulse[] = [];
  let coreEnergy = 0;
  const pathX = (s: number): number => lerp(lay.chips[0]?.x ?? 0, lay.out[0]?.x ?? w, s);

  let particles: Particle[] = [];
  let step: ReactorStep = { igniteAt: null, phase: 'charge', charge: 0, since: 0 };
  let handedOff = false;
  let finished = false;
  let frame = 0;
  let stopped = false;
  const start = performance.now();
  let prev = start;
  let lastPhase: ReactorPhase | '' = '';
  const colourCache = new Map<string, string>();
  const blend = (a: string, b: string, t: number): string => {
    const q = Math.round(t * 8) / 8;
    const key = `${a}|${b}|${q}`;
    let c = colourCache.get(key);
    if (!c) colourCache.set(key, (c = mixColour(a, b, q)));
    return c;
  };

  const rr = (x: number, y: number, bw: number, bh: number, r: number): void => {
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, bw, bh, r);
    else ctx.rect(x, y, bw, bh);
  };
  /** The machine fades as the burst takes it apart: every draw below goes through `A` and `glow`, which apply it. */
  let machineFade = 1;
  const A = (a: number): void => {
    ctx.globalAlpha = a * machineFade;
  };
  const glow = (x: number, y: number, r: number, color: string, alpha: number): void => {
    const [cr, cg, cb] = rgbOf(color);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${cr},${cg},${cb},1)`);
    g.addColorStop(0.45, `rgba(${cr},${cg},${cb},0.32)`);
    g.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
    // Light adds in the dark theme (a bloom); on paper it can only tint.
    ctx.globalCompositeOperation = pal.day ? 'source-over' : 'lighter';
    A(alpha);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    A(1);
    ctx.globalCompositeOperation = 'source-over';
  };
  /** Shade: black in the dark theme, ink on paper. */
  const ink = (a: number): string => {
    const [r, g, b] = pal.day ? rgbOf(pal.text) : [0, 0, 0];
    return `rgba(${r},${g},${b},${a})`;
  };
  const tint = (c: string, a: number): string => {
    const [r, g, b] = rgbOf(c);
    return `rgba(${r},${g},${b},${a})`;
  };
  const dot = (x: number, y: number, rad: number, color: string, alpha: number): void => {
    A(alpha);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  };
  /** Four corner marks round a box: the blueprint's way of drawing a part without a heavy outline. */
  const brackets = (x: number, y: number, bw: number, bh: number, len: number): void => {
    ctx.beginPath();
    for (const [cx, cy, sx, sy] of [
      [x, y, 1, 1],
      [x + bw, y, -1, 1],
      [x, y + bh, 1, -1],
      [x + bw, y + bh, -1, -1],
    ] as const) {
      ctx.moveTo(cx + sx * len, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + sy * len);
    }
    ctx.stroke();
  };

  const text = (
    s: string,
    x: number,
    y: number,
    size: number,
    color: string,
    align: CanvasTextAlign = 'left',
  ): void => {
    ctx.font = `500 ${size}px ${pal.mono}`;
    ctx.letterSpacing = `${(size * 0.14).toFixed(1)}px`;
    ctx.textAlign = align;
    ctx.fillStyle = color;
    ctx.fillText(s.toUpperCase(), x, y);
  };

  // The name's letters as dots, sampled from the site's display face on a grid, each with a random order in which it lights.
  const glyphCache = new Map<string, { x: number; y: number; k: number }[]>();
  const glyphCanvas = document.createElement('canvas');
  const glyphDots = (
    ch: string,
    fontSize: number,
    pitch: number,
    slot: number,
  ): { x: number; y: number; k: number }[] | undefined => {
    const key = `${slot}|${ch}|${Math.round(fontSize)}`;
    const hit = glyphCache.get(key);
    if (hit) return hit;
    const font = `700 ${fontSize}px ${pal.display}`;
    // Until the face has loaded the panel stays dark: sampling a fallback font would show the wrong letters.
    // (Checked on the first family only: the stack's size-adjusted fallbacks are never loaded, so the whole stack never passes.)
    const first = pal.display.split(',')[0]?.trim() ?? '';
    if (!ch || !first || !document.fonts.check(`700 ${fontSize}px ${first}`, ch)) return undefined;
    const side = Math.ceil(fontSize * 1.5);
    glyphCanvas.width = glyphCanvas.height = side;
    const g = glyphCanvas.getContext('2d', { willReadFrequently: true });
    if (!g) return undefined;
    g.clearRect(0, 0, side, side);
    g.font = font;
    g.textBaseline = 'alphabetic';
    g.fillStyle = 'black';
    const m = g.measureText(ch);
    const x0 = side / 2 - (m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2;
    const base = side / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
    g.fillText(ch, x0, base);
    const px = g.getImageData(0, 0, side, side).data;
    const order = mulberry32(slot * 977 + ch.charCodeAt(0));
    const out: { x: number; y: number; k: number }[] = [];
    for (let gy = pitch / 2; gy < side; gy += pitch)
      for (let gx = pitch / 2; gx < side; gx += pitch)
        if ((px[(Math.floor(gy) * side + Math.floor(gx)) * 4 + 3] ?? 0) > 128)
          out.push({ x: gx - side / 2, y: gy - side / 2, k: order() });
    glyphCache.set(key, out);
    return out;
  };

  /** The page's own dot grid under everything, a little brighter near the core. */
  const drawGrid = (charge: number, ignite: number): void => {
    const step = Math.round(26 * unit() + 12);
    const maxD = Math.hypot(w, h) * 0.5;
    ctx.fillStyle = pal.text2;
    for (let gy = step / 2; gy < h; gy += step)
      for (let gx = step / 2; gx < w; gx += step) {
        const d = clamp01(Math.hypot(gx - lay.core.x, gy - lay.cy) / maxD);
        A(
          (0.05 + 0.2 * (1 - d) ** 2 * (0.4 + 0.6 * charge) + 0.25 * ignite * (1 - d)) *
            (pal.day ? 0.8 : 1),
        );
        ctx.fillRect(gx - 0.7, gy - 0.7, 1.4, 1.4);
      }
  };

  /**
   * One part of the model, drawn as the site draws everything else: dots and hairlines. The embedding is a grid of
   * dots, a layer is attention (weighted lines between two columns of nodes) over a feed-forward block of dot rows,
   * and the head is a bar chart made of dots. Corner marks frame it; it warms from grey to amber as the pass reaches it.
   */
  const drawStage = (i: number, lit: number, t: number): void => {
    const s = lay.stages[i];
    if (!s) return;
    const x = s.x - lay.bw / 2;
    const y = lay.cy - lay.bh / 2;
    const u = unit();
    const col = blend(pal.text2, pal.amber, lit);
    const rad = 1.5 * u + 0.7;
    ctx.lineWidth = 1;
    ctx.strokeStyle = col;
    A(0.3 + 0.6 * lit);
    brackets(x - 6 * u, y - 6 * u, lay.bw + 12 * u, lay.bh + 12 * u, lay.bw * 0.18);
    if (s.kind === 'embed') {
      for (let r = 0; r < 7; r++)
        for (let c = 0; c < 3; c++) {
          const shimmer = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.004 + r * 1.3 + c * 2.1));
          dot(
            x + lay.bw * (0.2 + c * 0.3),
            y + lay.bh * (0.1 + r * 0.135),
            rad * 1.25,
            col,
            (0.18 + 0.75 * lit) * shimmer,
          );
        }
    } else if (s.kind === 'head') {
      for (let b = 0; b < 7; b++) {
        const base = 0.2 + 0.6 * (0.5 + 0.5 * Math.sin(t * 0.003 + b * 1.7));
        const settled = b === 2 ? 0.95 : 0.12 + 0.1 * ((b * 5) % 3);
        const n = Math.max(1, Math.round(10 * lerp(base, settled, lit)));
        for (let k = 0; k < n; k++)
          dot(
            x + lay.bw * (0.12 + k * 0.08),
            y + lay.bh * (0.14 + b * 0.115),
            rad,
            b === 2 && lit > 0.8 ? pal.amber : col,
            0.25 + 0.7 * lit,
          );
      }
    } else {
      // Attention: queries joined to keys by weights.
      const w4 = attn[i % attn.length] ?? [];
      ctx.strokeStyle = col;
      for (let a = 0; a < 4; a++)
        for (let b = 0; b < 4; b++) {
          const wt = w4[a]?.[b] ?? 0;
          A((0.04 + wt * 1.2) * (0.2 + 0.8 * lit));
          ctx.beginPath();
          ctx.moveTo(x + lay.bw * 0.22, y + lay.bh * (0.12 + a * 0.095));
          ctx.lineTo(x + lay.bw * 0.78, y + lay.bh * (0.12 + b * 0.095));
          ctx.stroke();
        }
      for (let a = 0; a < 4; a++)
        for (const px of [0.22, 0.78])
          dot(x + lay.bw * px, y + lay.bh * (0.12 + a * 0.095), rad * 1.2, col, 0.3 + 0.65 * lit);
      // The feed-forward block: rows of dots that shimmer.
      A(0.18 + 0.4 * lit);
      ctx.beginPath();
      ctx.moveTo(x + lay.bw * 0.1, y + lay.bh * 0.5);
      ctx.lineTo(x + lay.bw * 0.9, y + lay.bh * 0.5);
      ctx.stroke();
      for (let row = 0; row < 3; row++)
        for (let k = 0; k < 9; k++)
          dot(
            x + lay.bw * (0.12 + k * 0.095),
            y + lay.bh * (0.6 + row * 0.12),
            rad * 0.95,
            col,
            (0.12 + 0.7 * lit) *
              (0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.005 + row * 2 + k * 0.7 + i))),
          );
      // The residual connection: a shallow arc over the block, joining the stream before and after it.
      A(0.06 + 0.16 * lit);
      ctx.beginPath();
      ctx.moveTo(x - lay.bw * 0.2, lay.cy);
      ctx.bezierCurveTo(
        x - lay.bw * 0.1,
        y - lay.bh * 0.15,
        x + lay.bw * 1.1,
        y - lay.bh * 0.15,
        x + lay.bw * 1.2,
        lay.cy,
      );
      ctx.stroke();
    }
    A(0.4 + 0.5 * lit);
    text(s.label, s.x, y - 14 * u - 2, Math.max(9, 10 * u + 1), pal.text2, 'center');
    A(1);
  };

  /** A metal tone, 0 (in shade) to 1 (catching light): graphite in Night, brushed aluminium in Day. */
  const tone = (t: number): string =>
    pal.day
      ? mixColour(pal.text, pal.bg, 0.22 + 0.78 * clamp01(t))
      : mixColour(pal.bg, pal.text, 0.03 + 0.6 * clamp01(t));

  // Film grain: one tile of noise, laid over the machine and moved every frame so it crawls like real stock.
  const grain = document.createElement('canvas');
  grain.width = grain.height = 160;
  {
    const g = grain.getContext('2d');
    if (g) {
      const img = g.createImageData(160, 160);
      const seed = mulberry32(901);
      const [gr, gg, gb] = pal.day ? rgbOf(pal.text) : rgbOf(pal.text);
      for (let i = 0; i < img.data.length; i += 4) {
        img.data[i] = gr;
        img.data[i + 1] = gg;
        img.data[i + 2] = gb;
        img.data[i + 3] = Math.floor(seed() ** 2 * 70);
      }
      g.putImageData(img, 0, 0);
    }
  }
  const drawGrain = (strength: number): void => {
    A(strength * (pal.day ? 0.5 : 0.55));
    ctx.save();
    ctx.translate(Math.floor(rand() * 160), Math.floor(rand() * 160));
    ctx.fillStyle = ctx.createPattern(grain, 'repeat') ?? 'transparent';
    ctx.fillRect(-160, -160, w + 320, h + 320);
    ctx.restore();
  };

  // A point of light: a white-hot centre, amber body, and a soft skirt. Lit dots are drawn with it so each one blooms.
  const sprite = document.createElement('canvas');
  sprite.width = sprite.height = 64;
  {
    const g = sprite.getContext('2d');
    if (g) {
      const hot0 = mixColour(pal.amber, pal.day ? pal.amber : pal.text, 0.8);
      const [hr, hg, hb] = rgbOf(hot0);
      const [ar, ag, ab] = rgbOf(pal.amber);
      const rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      rg.addColorStop(0, `rgba(${hr},${hg},${hb},1)`);
      rg.addColorStop(0.18, `rgba(${hr},${hg},${hb},0.9)`);
      rg.addColorStop(0.4, `rgba(${ar},${ag},${ab},0.38)`);
      rg.addColorStop(1, `rgba(${ar},${ag},${ab},0)`);
      g.fillStyle = rg;
      g.fillRect(0, 0, 64, 64);
    }
  }

  /**
   * The reactor's housing, drawn once per size: a turned-metal bezel with a knurled outer edge, a spun (circular-brushed)
   * face, a bright chamfer, a dark lip and six screws. Two bright lobes sit opposite each other, as on a lathe-turned part
   * under one light. The core's own light is added over it every frame.
   */
  let bezelKey = '';
  let bezelTex: HTMLCanvasElement | undefined;
  const KEY_LIGHT = -2.2;
  const bezel = (r: number): HTMLCanvasElement | undefined => {
    // Measured before the overlay has a size: nothing to draw yet (a 0-sized canvas cannot be drawn from).
    if (!(r >= 2)) return undefined;
    const key = `${Math.round(r)}|${dpr}|${pal.day}`;
    if (bezelTex && key === bezelKey) return bezelTex;
    const side = Math.ceil(r * 3.4 * dpr);
    const c = document.createElement('canvas');
    c.width = c.height = side;
    const g = c.getContext('2d');
    if (!g) return undefined;
    bezelKey = key;
    bezelTex = c;
    const k = dpr;
    const m = side / 2;
    const R = r * k;
    const lobe = (a: number): number => {
      const d = Math.cos(2 * (a - KEY_LIGHT));
      return 0.5 + 0.5 * Math.sign(d) * Math.abs(d) ** 1.6;
    };
    const metal = (r0: number, r1: number, base: number, spread: number): void => {
      const cg = g.createConicGradient(0, m, m);
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2 - Math.PI;
        cg.addColorStop(i / 64, tone(base + spread * (lobe(a) - 0.5)));
      }
      g.fillStyle = cg;
      g.beginPath();
      g.arc(m, m, r1 * R, 0, Math.PI * 2);
      g.arc(m, m, r0 * R, 0, Math.PI * 2, true);
      g.fill();
    };
    const order = mulberry32(31);
    // The knurled edge, then the spun face, the chamfer and the lip.
    metal(1.42, 1.58, 0.3, 0.5);
    metal(1.2, 1.42, 0.34, 0.62);
    metal(1.1, 1.2, 0.52, 0.8);
    metal(1.03, 1.1, 0.08, 0.2);
    // Knurl: 132 flutes, each lit by the angle it faces.
    const teeth = 132;
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2;
      g.strokeStyle = tone(0.08 + 0.7 * lobe(a + 0.25) * (0.7 + 0.3 * order()));
      g.lineWidth = ((Math.PI * 2 * 1.5 * R) / teeth) * 0.5;
      g.beginPath();
      g.moveTo(m + Math.cos(a) * 1.43 * R, m + Math.sin(a) * 1.43 * R);
      g.lineTo(m + Math.cos(a) * 1.575 * R, m + Math.sin(a) * 1.575 * R);
      g.stroke();
      g.strokeStyle = tone(0.02);
      g.lineWidth = Math.max(0.6, k * 0.7);
      g.beginPath();
      g.moveTo(
        m + Math.cos(a + Math.PI / teeth) * 1.43 * R,
        m + Math.sin(a + Math.PI / teeth) * 1.43 * R,
      );
      g.lineTo(
        m + Math.cos(a + Math.PI / teeth) * 1.575 * R,
        m + Math.sin(a + Math.PI / teeth) * 1.575 * R,
      );
      g.stroke();
    }
    // Spun finish: hundreds of fine concentric scratches of random strength.
    g.lineWidth = Math.max(0.5, k * 0.55);
    for (let i = 0; i < 420; i++) {
      const rr0 = (1.2 + 0.22 * order()) * R;
      const a0 = order() * Math.PI * 2;
      const len = 0.4 + order() * 2.4;
      g.strokeStyle = tone(order() > 0.5 ? 0.95 : 0.04);
      g.globalAlpha = 0.04 + 0.12 * order();
      g.beginPath();
      g.arc(m, m, rr0, a0, a0 + len);
      g.stroke();
    }
    g.globalAlpha = 1;
    // The edges: a bright rim outside, a bright chamfer line, a dark line at the lip.
    for (const [rad, tn, wd] of [
      [1.585, 0.85, 1.1],
      [1.42, 0.12, 1.4],
      [1.2, 0.95, 1.1],
      [1.1, 0.02, 1.3],
    ] as const) {
      const cg = g.createConicGradient(0, m, m);
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * Math.PI * 2 - Math.PI;
        cg.addColorStop(i / 32, tone(tn * (0.35 + 0.65 * lobe(a))));
      }
      g.strokeStyle = cg;
      g.lineWidth = wd * k;
      g.beginPath();
      g.arc(m, m, rad * R, 0, Math.PI * 2);
      g.stroke();
    }
    // Six screws on the spun face, each a small sphere with its own shadow and a slot at its own angle.
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      const sx = m + Math.cos(a) * 1.31 * R;
      const sy = m + Math.sin(a) * 1.31 * R;
      const sr = r * 0.05 * k;
      g.fillStyle = tone(0.0);
      g.globalAlpha = 0.6;
      g.beginPath();
      g.ellipse(sx + k, sy + 1.8 * k, sr * 1.1, sr, 0, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
      const sg = g.createRadialGradient(sx - sr * 0.35, sy - sr * 0.4, 0, sx, sy, sr);
      sg.addColorStop(0, tone(0.95));
      sg.addColorStop(1, tone(0.18));
      g.fillStyle = sg;
      g.beginPath();
      g.arc(sx, sy, sr, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = tone(0.03);
      g.lineWidth = Math.max(0.8, k * 0.9);
      const slot = order() * Math.PI;
      g.beginPath();
      g.moveTo(sx - Math.cos(slot) * sr * 0.8, sy - Math.sin(slot) * sr * 0.8);
      g.lineTo(sx + Math.cos(slot) * sr * 0.8, sy + Math.sin(slot) * sr * 0.8);
      g.stroke();
    }
    return c;
  };

  /**
   * The core, as a physical object under its own light. A recessed housing throws a soft contact shadow; the turned-metal
   * bezel catches a key light and, as the charge builds, the amber light of the core; behind a smoked-glass diffuser the
   * etched dots are small light points that bloom when they light (in a sweep, with the real load). The centre is a hot
   * filament with bloom, a warm halation round it and one thin anamorphic streak. At ignition everything flares.
   */
  const drawCore = (charge: number, t: number, ignite: number): void => {
    const { x, y, r } = lay.core;
    const e = clamp01(coreEnergy);
    const u = unit();
    const day = pal.day;
    const add = day ? 'source-over' : 'lighter';
    const hot = mixColour(pal.amber, day ? pal.amber : pal.text, 0.7);
    const power = 0.1 + 0.9 * charge;

    // Light thrown onto everything round it, falling off as it does in air: bright near, nothing far.
    glow(
      x,
      y,
      r * 5.5,
      pal.action,
      (0.03 + 0.1 * charge * charge + 0.22 * ignite) * (day ? 0.5 : 1),
    );
    glow(
      x,
      y,
      r * 3,
      pal.amber,
      (0.05 + 0.2 * charge * charge + 0.3 * ignite + 0.05 * e) * (day ? 0.55 : 1),
    );

    // The housing's contact shadow, a little down and to the right of the key light.
    const ao = ctx.createRadialGradient(
      x + r * 0.06,
      y + r * 0.12,
      r * 1.3,
      x + r * 0.06,
      y + r * 0.12,
      r * 2.3,
    );
    ao.addColorStop(0, ink(day ? 0.38 : 0.85));
    ao.addColorStop(1, ink(0));
    A(1);
    ctx.fillStyle = ao;
    ctx.beginPath();
    ctx.arc(x + r * 0.06, y + r * 0.12, r * 2.3, 0, Math.PI * 2);
    ctx.fill();

    const tex = bezel(r);
    if (tex) {
      A(1);
      const sz = tex.width / dpr;
      ctx.drawImage(tex, x - sz / 2, y - sz / 2, sz, sz);
    }
    // The core's light on the metal: warm on the chamfer and the face, strongest nearest the glass.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 1.58, 0, Math.PI * 2);
    ctx.arc(x, y, r * 1.03, 0, Math.PI * 2, true);
    ctx.clip('evenodd');
    ctx.globalCompositeOperation = add;
    const wash = ctx.createRadialGradient(x, y, r * 1.0, x, y, r * 1.6);
    wash.addColorStop(0, tint(pal.amber, 0.9));
    wash.addColorStop(0.5, tint(pal.amber, 0.25));
    wash.addColorStop(1, tint(pal.amber, 0));
    A((0.1 + 0.55 * power * power + 0.5 * ignite) * (day ? 0.5 : 1));
    ctx.fillStyle = wash;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    // A slow specular glint travelling round the ring, as if the camera were drifting.
    const sweep = ctx.createConicGradient(t * 0.00028 - 0.9, x, y);
    sweep.addColorStop(0, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.035, tint(day ? pal.bg : pal.text, 0.5));
    sweep.addColorStop(0.07, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.5, 'rgba(255,255,255,0)');
    sweep.addColorStop(0.535, tint(day ? pal.bg : pal.text, 0.28));
    sweep.addColorStop(0.57, 'rgba(255,255,255,0)');
    A(day ? 0.5 : 0.7);
    ctx.fillStyle = sweep;
    ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';

    // The scale engraved on the face: 72 marks; the ones the pass has reached are lit.
    ctx.lineWidth = 1;
    for (let i = 0; i < 72; i++) {
      const f = i / 72;
      const a = f * Math.PI * 2 - Math.PI / 2;
      const long = i % 6 === 0;
      const reached = charge > f;
      ctx.strokeStyle = reached ? blend(pal.amber, hot, 0.3) : tone(0.04);
      A(reached ? 0.95 : 0.7);
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 1.24, y + Math.sin(a) * r * 1.24);
      ctx.lineTo(
        x + Math.cos(a) * r * (1.24 + (long ? 0.12 : 0.07)),
        y + Math.sin(a) * r * (1.24 + (long ? 0.12 : 0.07)),
      );
      ctx.stroke();
    }

    // The diffuser: smoked glass, deeper at its rim where the lip shadows it.
    const glass = ctx.createRadialGradient(x - r * 0.18, y - r * 0.22, r * 0.05, x, y, r * 1.04);
    glass.addColorStop(0, mixColour(pal.bg, pal.amber, 0.1 + 0.28 * power));
    glass.addColorStop(0.55, mixColour(pal.bg, pal.amber, 0.03 + 0.1 * power));
    glass.addColorStop(1, ink(day ? 0.82 : 0.96));
    A(1);
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.arc(x, y, r * 1.04, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r * 1.04, 0, Math.PI * 2);
    ctx.clip();
    // The glass is frosted: fine grain over it, and the lip's shadow across its upper left.
    A(day ? 0.5 : 0.75);
    ctx.fillStyle = ctx.createPattern(grain, 'repeat') ?? 'transparent';
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
    const lip = ctx.createLinearGradient(x - r, y - r, x + r * 0.2, y + r * 0.2);
    lip.addColorStop(0, ink(day ? 0.3 : 0.7));
    lip.addColorStop(0.45, ink(0));
    A(1);
    ctx.fillStyle = lip;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);

    // The etched dots: five rings of small light points. Unlit they are pinholes; lit they glow, brightest at the sweep's head.
    ctx.globalCompositeOperation = 'source-over';
    const pitch = 6.4 * u + 3.2;
    const lit: { px: number; py: number; s: number; v: number }[] = [];
    for (let k = 0; k < 5; k++) {
      const rk = r * (0.3 + 0.16 * k);
      const n = Math.max(8, Math.round((Math.PI * 2 * rk) / pitch));
      const rad = (1.05 + 0.1 * k) * u + 0.5;
      for (let j = 0; j < n; j++) {
        const f = j / n;
        const a = f * Math.PI * 2 - Math.PI / 2;
        const px = x + Math.cos(a) * rk;
        const py = y + Math.sin(a) * rk;
        const behind = charge - f;
        const on = clamp01(behind / 0.03);
        const head = behind > 0 ? clamp01(1 - behind * 9) : 0;
        const flare = Math.max(head, ignite);
        if (on > 0)
          lit.push({
            px,
            py,
            s: rad * (4.6 + 3 * flare),
            v: (0.55 + 0.45 * Math.sin(t * 0.006 + j * 0.5 + k)) * on * (0.7 + 0.3 * flare),
          });
        else {
          ctx.fillStyle = ink(day ? 0.55 : 0.9);
          A(0.9);
          ctx.beginPath();
          ctx.arc(px, py, rad * 0.8, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = tint(day ? pal.bg : pal.text, 0.1);
          A(1);
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.arc(px, py, rad * 0.8 + 0.5, 0, Math.PI * 0.8);
          ctx.stroke();
        }
      }
    }
    ctx.globalCompositeOperation = add;
    for (const d of lit) {
      A(Math.min(1, d.v) * (day ? 0.9 : 1));
      ctx.drawImage(sprite, d.px - d.s / 2, d.py - d.s / 2, d.s, d.s);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // The filament: a hot centre with bloom, and a warm halation (the red-orange bleed film gives bright light) round it.
    const heart = r * (0.1 + 0.05 * e + 0.06 * charge) * (1 + 0.5 * ignite);
    ctx.globalCompositeOperation = add;
    A((0.35 + 0.65 * power) * (day ? 0.8 : 1));
    ctx.drawImage(sprite, x - heart * 5, y - heart * 5, heart * 10, heart * 10);
    A((0.5 + 0.5 * power) * (day ? 0.9 : 1));
    ctx.drawImage(sprite, x - heart * 2.2, y - heart * 2.2, heart * 4.4, heart * 4.4);
    ctx.globalCompositeOperation = 'source-over';
    const core = ctx.createRadialGradient(x, y, 0, x, y, heart);
    core.addColorStop(0, mixColour(hot, day ? pal.bg : pal.text, 0.7));
    core.addColorStop(0.6, hot);
    core.addColorStop(1, tint(pal.amber, 0));
    A(0.95);
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(x, y, heart, 0, Math.PI * 2);
    ctx.fill();

    // The anamorphic streak: one thin horizontal line of light through the core, widening at ignition.
    const reach = r * (3 + 9 * ignite) * (0.45 + 0.55 * charge);
    const streak = ctx.createLinearGradient(x - reach, 0, x + reach, 0);
    streak.addColorStop(0, tint(hot, 0));
    streak.addColorStop(0.5, tint(hot, 1));
    streak.addColorStop(1, tint(hot, 0));
    ctx.globalCompositeOperation = add;
    ctx.fillStyle = streak;
    A((0.06 + 0.4 * charge * charge + 0.85 * ignite) * (day ? 0.3 : 1));
    ctx.fillRect(x - reach, y - 0.9, reach * 2, 1.8);
    A((0.025 + 0.1 * charge * charge + 0.25 * ignite) * (day ? 0.3 : 1));
    ctx.fillRect(x - reach, y - 4.5, reach * 2, 9);
    ctx.globalCompositeOperation = 'source-over';

    A(1);
    text(
      `${Math.round(charge * 100)}%`,
      x,
      y + r * 1.86 + 8,
      Math.max(12, 14 * u + 2),
      pal.amber,
      'center',
    );
  };

  const drawMachine = (
    charge: number,
    t: number,
    dt: number,
    ignite: number,
    fade: number,
  ): void => {
    const u = unit();
    const count = lay.stages.length + 1;
    machineFade = fade;
    drawGrid(charge, ignite);
    // Connectors along the centre line: grey hairlines, amber up to where the pass has got to.
    const xs = [
      lay.chips[0]?.x ?? 0,
      ...lay.stages.map((s) => s.x),
      lay.core.x,
      lay.out[0]?.x ?? w,
    ].sort((a, b) => a - b);
    const sx = lerp(xs[0] ?? 0, xs[xs.length - 1] ?? w, charge);
    ctx.lineWidth = 1;
    for (let i = 0; i < xs.length - 1; i++) {
      const from = (xs[i] ?? 0) + lay.bw * 0.5;
      const to = (xs[i + 1] ?? 0) - lay.bw * 0.5;
      ctx.strokeStyle = pal.text2;
      A(0.25);
      ctx.beginPath();
      ctx.moveTo(from, lay.cy);
      ctx.lineTo(to, lay.cy);
      ctx.stroke();
      if (sx > from) {
        ctx.strokeStyle = pal.amber;
        A(0.75);
        ctx.beginPath();
        ctx.moveTo(from, lay.cy);
        ctx.lineTo(Math.min(to, sx), lay.cy);
        ctx.stroke();
      }
    }
    // The pass itself: a thin vertical line moving left to right, trailing a faint warmth.
    if (charge > 0 && charge < 1) {
      // The warmth the pass leaves behind it: a soft, flat glow that fades away vertically as well as backwards.
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, sx, h);
      ctx.clip();
      ctx.translate(sx, lay.cy);
      ctx.scale((190 * u) / (lay.bh * 0.78), 1);
      const trail = ctx.createRadialGradient(0, 0, 0, 0, 0, lay.bh * 0.78);
      trail.addColorStop(
        0,
        tint(pal.amber, (pal.day ? 0.1 : 0.12) * clamp01((0.97 - charge) / 0.06)),
      );
      trail.addColorStop(1, tint(pal.amber, 0));
      A(1);
      ctx.fillStyle = trail;
      ctx.fillRect(-lay.bh, -lay.bh, lay.bh * 2, lay.bh * 2);
      ctx.restore();
      ctx.strokeStyle = pal.amber;
      A(0.6 * clamp01((0.98 - charge) / 0.06));
      ctx.beginPath();
      ctx.moveTo(sx, lay.cy - lay.bh * 0.78);
      ctx.lineTo(sx, lay.cy + lay.bh * 0.78);
      ctx.stroke();
    }
    // Token chips fan into the embedding block.
    const embed = lay.stages[0];
    lay.chips.forEach((c, i) => {
      const lit = clamp01(charge * 6 - i * 0.4);
      const col = blend(pal.text2, pal.amber, lit);
      ctx.strokeStyle = col;
      A(0.3 + 0.6 * lit);
      rr(c.x - c.w / 2, c.y, c.w, c.h, 3);
      ctx.stroke();
      if (embed) {
        A(0.1 + 0.4 * lit);
        ctx.beginPath();
        ctx.moveTo(c.x + c.w / 2, c.y + c.h / 2);
        ctx.lineTo(embed.x - lay.bw / 2, lay.cy + (i - lay.chips.length / 2 + 0.5) * lay.bh * 0.12);
        ctx.stroke();
      }
      A(0.45 + 0.5 * lit);
      text(
        opts.tokens[i] ?? '',
        c.x,
        c.y + c.h / 2 + 4,
        Math.max(8, 10 * u + 1),
        pal.text,
        'center',
      );
    });
    lay.stages.forEach((_, i) =>
      drawStage(i, stageIndexLit(i + (i >= lay.coreIndex ? 1 : 0), count, charge), t),
    );
    drawCore(charge, t, ignite);
    // The name decodes at the right, set like the hero's: the display face as a dot matrix. Each slot is a small panel of
    // dots; as the pass reaches it the dots of the letter light one by one (amber at first, settling to the page's ink).
    lay.out.forEach((o, i) => {
      const at = ((i + 1) / (letters.length + 1)) * 0.96 + 0.02;
      const s = easeOut((charge - (at - 0.11)) / 0.11);
      const done = charge >= at;
      const half = o.size * 0.6;
      const pitch = Math.max(2.4, o.size * 0.072);
      const rad = pitch * 0.36;
      ctx.strokeStyle = done ? pal.amber : pal.text2;
      ctx.lineWidth = 1;
      A(done ? 0.85 : 0.35);
      brackets(o.x - half, o.y - o.size * 0.55, half * 2, o.size * 1.1, o.size * 0.26);
      // The unlit panel.
      ctx.fillStyle = pal.text2;
      A(0.13);
      for (let gy = o.y - o.size * 0.5 + pitch / 2; gy < o.y + o.size * 0.5; gy += pitch)
        for (let gx = o.x - half * 0.85 + pitch / 2; gx < o.x + half * 0.85; gx += pitch) {
          ctx.beginPath();
          ctx.arc(gx, gy, rad * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
      const dots = glyphDots(letters[i] ?? '', o.size * 0.86, pitch, i);
      if (!dots || s <= 0) return;
      for (const d of dots) {
        if (d.k > s) continue;
        const fresh = clamp01((s - d.k) * 5);
        dot(
          o.x + d.x,
          o.y + d.y,
          rad * (1.25 - 0.25 * fresh),
          blend(pal.amber, pal.text, fresh),
          0.55 + 0.45 * fresh,
        );
      }
    });
    // Pulses: amber points with a short tail, running left to right along the centre line.
    const want = Math.round((lay.compact ? 8 : 18) * (0.25 + charge));
    while (pulses.length < want)
      pulses.push({ s: 0, speed: 0.16 + rand() * 0.14, lane: (rand() - 0.5) * lay.bh * 0.5 });
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      if (!p) continue;
      p.s += p.speed * dt * (0.6 + charge);
      const px = pathX(p.s);
      if (Math.abs(px - lay.core.x) < lay.core.r * 0.5) coreEnergy = Math.min(1, coreEnergy + 0.06);
      if (p.s >= 1) {
        p.s = 0;
        p.lane = (rand() - 0.5) * lay.bh * 0.5;
        continue;
      }
      const inside = lay.stages.some((s) => Math.abs(px - s.x) < lay.bw * 0.5);
      const py = lay.cy + (inside ? p.lane : 0);
      for (let k = 1; k <= 4; k++)
        dot(px - k * 5 * u, py, (1.9 * u + 0.7) * (1 - k * 0.18), pal.amber, 0.5 / k);
      dot(px, py, 1.9 * u + 0.8, pal.amber, 1);
    }
    coreEnergy *= 0.94;
    // Log lines (content.log), bottom left; "[ !! ]" ones in amber.
    // The last line ("ready") waits for ignition.
    const shown =
      charge >= 1
        ? opts.log.length
        : Math.min(opts.log.length - 1, Math.floor(clamp01(charge) * opts.log.length));
    opts.log.slice(0, shown).forEach((line, i) => {
      A(0.9);
      text(
        line,
        w * 0.04,
        h - h * 0.05 - (Math.min(shown, opts.log.length) - 1 - i) * (16 * u + 4),
        Math.max(10, 12 * u),
        line.includes('!!') ? pal.amber : pal.text2,
      );
    });
    A(0.7);
    text('FORWARD PASS', w * 0.04, h * 0.07, Math.max(10, 12 * u), pal.text2);
    drawGrain(0.45);
    machineFade = 1;
    ctx.globalAlpha = 1;
  };

  const draw = (stamp: number): void => {
    frame = 0;
    if (stopped) return;
    // A frame callback without a usable timestamp (a stubbed clock) falls back to the clock itself: the drawing below
    // builds gradients from time-driven values, and those throw on NaN.
    const now = Number.isFinite(stamp) ? stamp : performance.now();
    // The canvas can be measured before the overlay has a size: measure again until it has one.
    if (w === 0 || h === 0) resize();
    const t = now - start;
    const dt = Math.min(0.05, (now - prev) / 1000);
    prev = now;
    step = reactorStep(step.igniteAt, t, opts.progress());
    if (step.phase !== lastPhase) {
      lastPhase = step.phase;
      overlay?.setAttribute('data-phase', step.phase);
    }
    const since = step.since;
    // After the hand-off the page colour and the particles fade together, over the real hero already in place beneath.
    const veil =
      step.phase === 'settle' || step.phase === 'done'
        ? clamp01(1 - (since - R.HANDOFF_AT) / (R.DONE_AT - R.HANDOFF_AT))
        : 1;
    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = veil;
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    // A soft vignette pulls the eye to the core and gives the flat page a room.
    const vg = ctx.createRadialGradient(
      w / 2,
      lay.cy,
      h * 0.3,
      w / 2,
      lay.cy,
      Math.max(w, h) * 0.72,
    );
    const [vr, vgc, vb] = pal.day ? rgbOf(pal.text) : [0, 0, 0];
    vg.addColorStop(0, `rgba(${vr},${vgc},${vb},0)`);
    vg.addColorStop(1, `rgba(${vr},${vgc},${vb},${pal.day ? 0.08 : 0.4})`);
    ctx.globalAlpha = veil;
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
    const ignite = step.phase === 'charge' ? 0 : easeOut(1 - clamp01(since / (R.FLASH * 1.2)));
    // The machine fades out as the burst takes it apart.
    const machine =
      step.phase === 'charge' || step.phase === 'ignite' ? 1 : clamp01(1 - (since - R.FLASH) / 260);
    if (machine > 0) drawMachine(step.charge, t, dt, ignite, machine);

    if (step.phase !== 'charge') {
      if (!particles.length) {
        const raw = opts.targets();
        particles = makeParticles(
          capTargets(raw, lay.compact ? MAX_PARTICLES_PHONE : MAX_PARTICLES),
          lay,
        );
        // Same colour next to same colour: far fewer fillStyle changes while drawing thousands of squares.
        particles.sort((a, b) =>
          a.target.color < b.target.color ? -1 : a.target.color > b.target.color ? 1 : 0,
        );
      }
      // The ignition: a flash of light from the core that sweeps outwards.
      if (since < R.FLASH * 1.3) {
        const k = easeOut(since / (R.FLASH * 1.3));
        glow(
          lay.core.x,
          lay.core.y,
          lay.core.r * (1.5 + 16 * k),
          mixColour(pal.amber, pal.day ? pal.amber : pal.text, 0.35),
          (1 - k) * (pal.day ? 0.75 : 1) * 0.8,
        );
        // A hairline shock ring leaves the core with the flash.
        ctx.strokeStyle = pal.amber;
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = (1 - k) * 0.8;
        ctx.beginPath();
        ctx.arc(lay.core.x, lay.core.y, lay.core.r * (1.3 + 9 * k), 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      const fadeOut = veil;
      if (since >= R.FLASH * 0.5)
        for (const p of particles) {
          const pos = particlePos(p, since);
          const size = lerp(2 * unit() + 1, p.target.size, pos.local);
          ctx.globalAlpha = lerp(0.9, p.target.alpha, pos.local) * fadeOut;
          ctx.fillStyle = pos.local <= 0 ? pal.amber : blend(pal.amber, p.target.color, pos.local);
          if (p.target.round) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, size / 2, 0, Math.PI * 2);
            ctx.fill();
          } else ctx.fillRect(pos.x - size / 2, pos.y - size / 2, size, size);
        }
      ctx.globalAlpha = 1;
      if (!handedOff && since >= R.HANDOFF_AT) {
        handedOff = true;
        opts.onHandoff();
      }
    }
    if (step.phase === 'done' && !finished) {
      finished = true;
      removeEventListener('resize', resize);
      opts.onDone();
      return;
    }
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);

  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    removeEventListener('resize', resize);
  };
}
