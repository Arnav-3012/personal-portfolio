// Hero portrait as an ordered-dither dot-matrix (SPEC row 2). Each cell's tone is contrast-stretched, then a dot
// is drawn only where tone beats a 4×4 Bayer threshold, so the figure is built from dot density like a print:
// Night lights up where the photo is bright; Day inks where it is dark (ink on paper). The grey studio backdrop
// is dropped and the torso fades below the chin.
// Hover (fine pointers): dots near the pointer are pushed outward and ease back; a small density field trails
// the pointer, smears with its motion and dissipates, and the original photo shows through it while the dots
// there fade. Pure helpers are exported for tests; the canvas only animates while something is moving.

export interface Dot {
  /** Centre, as a fraction of the image (0–1), so dots survive resizes. */
  u: number;
  v: number;
  /** Cell size as a fraction of image width. */
  s: number;
  /** Stretched tone 0–1 (picks the colour). */
  t: number;
  /** Edge fade 0–1 (opacity). */
  a: number;
  /** Per-dot random 0–1 (push strength). */
  seed: number;
}

export type ToneMode = 'light' | 'ink';

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

export const luminance = (r: number, g: number, b: number): number =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

const saturation = (r: number, g: number, b: number): number => {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
};

/** The neutral grey studio backdrop: unsaturated and mid-bright. Hair and shirt are darker, skin is warmer. */
export const isBackdrop = (r: number, g: number, b: number): boolean => {
  const l = luminance(r, g, b);
  return saturation(r, g, b) < 0.12 && l > 0.22 && l < 0.75;
};

/**
 * Feathers the edges so the matrix dissolves into the page instead of ending in a rectangle, and fades the
 * torso out from 64% to 88% of the height (the chin is at ~56%), so the name sits on clean page.
 */
export const edgeFade = (u: number, v: number): number => {
  const d = Math.hypot((u - 0.5) / 0.5, (v - 0.5) / 0.5);
  return Math.min(clamp01((1.15 - d) / 0.35), clamp01((0.88 - v) / 0.24));
};

/** 4×4 Bayer matrix: ordered-dither thresholds in (0, 1). */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5] as const;
export const bayer = (x: number, y: number): number =>
  ((BAYER4[(y % 4) * 4 + (x % 4)] ?? 0) + 0.5) / 16;

/** Low and high percentiles of a sample, for contrast stretching. */
export function percentiles(values: readonly number[], lo = 0.02, hi = 0.98): [number, number] {
  if (values.length === 0) return [0, 1];
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number): number =>
    sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? 0;
  return [at(lo), at(hi)];
}

/** Samples an RGBA grid (the image downscaled to cols×rows, one pixel per cell) into dithered dots. */
export function sampleDots(
  grid: { data: ArrayLike<number>; cols: number; rows: number },
  mode: ToneMode,
): Dot[] {
  const cells: { x: number; y: number; l: number }[] = [];
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++) {
      const i = (y * grid.cols + x) * 4;
      const r = grid.data[i] ?? 0;
      const g = grid.data[i + 1] ?? 0;
      const b = grid.data[i + 2] ?? 0;
      if (!isBackdrop(r, g, b)) cells.push({ x, y, l: luminance(r, g, b) });
    }
  const [lo, hi] = percentiles(cells.map((c) => c.l));
  const span = Math.max(1e-3, hi - lo);
  const dots: Dot[] = [];
  for (const c of cells) {
    const u = (c.x + 0.5) / grid.cols;
    const v = (c.y + 0.5) / grid.rows;
    const fade = edgeFade(u, v);
    if (fade <= 0) continue;
    const l = clamp01((c.l - lo) / span);
    const t = mode === 'light' ? l : 1 - l;
    if (t * fade <= bayer(c.x, c.y)) continue;
    const seed = ((c.x * 73856093) ^ (c.y * 19349663)) >>> 0;
    dots.push({ u, v, s: 1 / grid.cols, t, a: fade, seed: (seed % 1000) / 1000 });
  }
  return dots;
}

/** Dot opacity behind the name and role line. Lower in Day: dimmed ink reads as grey on paper. */
export const CLEAR_ALPHA = 0.2;
export const CLEAR_ALPHA_DAY = 0.12;

/** Dot opacity near text: `floor` inside a rect, back to 1 over `feather` px outside it. */
export function clearAlpha(
  x: number,
  y: number,
  rects: readonly { x: number; y: number; w: number; h: number }[],
  feather = 28,
  floor = CLEAR_ALPHA,
): number {
  let a = 1;
  for (const r of rects) {
    const dx = Math.max(r.x - x, 0, x - (r.x + r.w));
    const dy = Math.max(r.y - y, 0, y - (r.y + r.h));
    const d = Math.hypot(dx, dy);
    a = Math.min(a, floor + (1 - floor) * Math.min(1, d / feather));
  }
  return a;
}

export const PUSH_RADIUS = 120;

/** Outward shove for a dot at (dx, dy) from the pointer: squared falloff, 8–22 px by seed, scaled by push. */
export function pushOffset(dx: number, dy: number, seed: number, push: number): [number, number] {
  const d = Math.hypot(dx, dy);
  if (d >= PUSH_RADIUS || push <= 0) return [0, 0];
  const fall = (1 - d / PUSH_RADIUS) ** 2;
  const k = (fall * push * (8 + seed * 14)) / Math.max(d, 28);
  return [dx * k, dy * k];
}

export const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
/** Photo visibility from field density: soft start, fully shown by 0.7. */
export const reveal = (density: number): number => smoothstep(0.02, 0.7, density);

/**
 * Trail field on a small grid: splats add density and velocity; each step advects density along the velocity
 * (semi-Lagrangian), blurs it slightly and decays both, so the reveal smears with motion and dissolves.
 */
export function createField(cols: number, rows: number) {
  const n = cols * rows;
  const d = new Float32Array(n);
  const tmp = new Float32Array(n);
  const vx = new Float32Array(n);
  const vy = new Float32Array(n);
  let peak = 0;
  const idx = (x: number, y: number): number =>
    Math.max(0, Math.min(rows - 1, y)) * cols + Math.max(0, Math.min(cols - 1, x));
  const sample = (src: Float32Array, x: number, y: number): number => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const a = src[idx(x0, y0)] ?? 0;
    const b = src[idx(x0 + 1, y0)] ?? 0;
    const c = src[idx(x0, y0 + 1)] ?? 0;
    const e = src[idx(x0 + 1, y0 + 1)] ?? 0;
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + e * fx) * fy;
  };
  return {
    cols,
    rows,
    /** Adds density (and velocity in cells/s) around (u, v) in 0–1 coordinates. */
    splat(u: number, v: number, velX: number, velY: number, radius = 2.6, amount = 0.55): void {
      const cx = u * cols - 0.5;
      const cy = v * rows - 0.5;
      const r = Math.ceil(radius * 2);
      for (let y = Math.floor(cy) - r; y <= Math.ceil(cy) + r; y++)
        for (let x = Math.floor(cx) - r; x <= Math.ceil(cx) + r; x++) {
          if (x < 0 || y < 0 || x >= cols || y >= rows) continue;
          const g = Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (radius * radius));
          const i = y * cols + x;
          d[i] = Math.min(1.2, (d[i] ?? 0) + g * amount);
          vx[i] = (vx[i] ?? 0) + velX * g * 0.5;
          vy[i] = (vy[i] ?? 0) + velY * g * 0.5;
          peak = Math.max(peak, d[i] ?? 0);
        }
    },
    /** Advances by dt seconds; returns false once the field has dissolved. */
    step(dt: number): boolean {
      const decay = 0.94 ** (dt * 60);
      const vdecay = 0.88 ** (dt * 60);
      peak = 0;
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          tmp[i] = sample(d, x - (vx[i] ?? 0) * dt, y - (vy[i] ?? 0) * dt);
        }
      for (let y = 0; y < rows; y++)
        for (let x = 0; x < cols; x++) {
          const i = y * cols + x;
          const blur =
            ((tmp[idx(x - 1, y)] ?? 0) +
              (tmp[idx(x + 1, y)] ?? 0) +
              (tmp[idx(x, y - 1)] ?? 0) +
              (tmp[idx(x, y + 1)] ?? 0)) /
            4;
          const val = ((tmp[i] ?? 0) * 0.8 + blur * 0.2) * decay;
          d[i] = val < 0.002 ? 0 : val;
          vx[i] = (vx[i] ?? 0) * vdecay;
          vy[i] = (vy[i] ?? 0) * vdecay;
          peak = Math.max(peak, d[i] ?? 0);
        }
      return peak > 0.002;
    },
    at: (u: number, v: number): number => sample(d, u * cols - 0.5, v * rows - 0.5),
    density: (): Float32Array => d,
    active: (): boolean => peak > 0.002,
    clear(): void {
      d.fill(0);
      tmp.fill(0);
      vx.fill(0);
      vy.fill(0);
      peak = 0;
    },
  };
}

/** Linear blend between two #rrggbb colours. */
export function mix(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((c, i) => Math.round(c + ((pb[i] ?? 0) - c) * t)).join(' ')})`;
}

/** Three-stop ramp along tone 0–1. */
export function ramp(t: number, low: string, mid: string, high: string): string {
  return t < 0.5 ? mix(low, mid, t / 0.5) : mix(mid, high, (t - 0.5) / 0.5);
}

const toHex = (rgb: string): string =>
  '#' +
  (rgb.match(/\d+/g) ?? [])
    .slice(0, 3)
    .map((n) => Number(n).toString(16).padStart(2, '0'))
    .join('');

interface Style {
  mode: ToneMode;
  low: string;
  mid: string;
  high: string;
  clear: number;
}

/** Night: amber → parchment where bright. Day: amber → warm umber ink where dark (no black, no grey). */
function readStyle(root: HTMLElement): Style {
  const cs = getComputedStyle(root);
  const v = (n: string): string => cs.getPropertyValue(n).trim();
  const bg = v('--bg');
  const amber = v('--time');
  const text = v('--text');
  return root.dataset['theme'] === 'day'
    ? {
        mode: 'ink',
        low: toHex(mix(amber, bg, 0.35)),
        mid: amber,
        high: toHex(mix(text, amber, 0.3)),
        clear: CLEAR_ALPHA_DAY,
      }
    : {
        mode: 'light',
        low: toHex(mix(bg, amber, 0.6)),
        mid: amber,
        high: text,
        clear: CLEAR_ALPHA,
      };
}

const easeOut = (x: number): number => 1 - (1 - x) ** 3;

/** One dot as it is drawn once assembled, in canvas CSS pixels (the boot's particles fly to these). */
export interface FinalDot {
  x: number;
  y: number;
  size: number;
  color: string;
  alpha: number;
}

export interface DotMatrix {
  /** Plays the assembly (dots fly in from scatter), or with `instant` shows them already assembled. */
  assemble(instant?: boolean): void;
  /** Every dot's final position, size, colour and opacity (including the dimming behind the name). */
  finalDots(): FinalDot[];
  /** Pointer in canvas CSS pixels, or null when it leaves. */
  pointer(x: number | null, y: number | null): void;
  /** Re-reads the theme (D toggle / settings): tone mode and colours. */
  recolour(): void;
  /** Rects (canvas CSS pixels) where dots dim so overlapping text stays readable. */
  clear(rects: readonly { x: number; y: number; w: number; h: number }[]): void;
}

export async function createDotMatrix(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  { animate }: { animate: boolean },
): Promise<DotMatrix | null> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await img.decode().catch(() => undefined);
  if (!img.naturalWidth) return null;

  const grid = (cols: number) => {
    const rows = Math.round(cols * (img.naturalHeight / img.naturalWidth));
    const off = document.createElement('canvas');
    off.width = cols;
    off.height = rows;
    const octx = off.getContext('2d', { willReadFrequently: true });
    if (!octx) return { data: [], cols, rows };
    octx.drawImage(img, 0, 0, cols, rows);
    return { data: octx.getImageData(0, 0, cols, rows).data, cols, rows };
  };

  const root = document.documentElement;
  const lutFor = (s: Style): string[] =>
    Array.from({ length: 33 }, (_, i) => ramp(i / 32, s.low, s.mid, s.high));
  let style = readStyle(root);
  let lut = lutFor(style);
  let w = 0;
  let h = 0;
  let dots: Dot[] = [];
  const dpr = Math.min(devicePixelRatio || 1, 2);

  // Reveal layers: the photo at canvas size, and a field-sized alpha mask upscaled with smoothing.
  const field = createField(56, 70);
  const photo = document.createElement('canvas');
  const layer = document.createElement('canvas');
  const mask = document.createElement('canvas');
  mask.width = field.cols;
  mask.height = field.rows;
  const mctx = mask.getContext('2d');
  const maskData = mctx?.createImageData(field.cols, field.rows);

  const layout = (): void => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    for (const c of [canvas, photo, layer]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // The reveal shows Arnav only: backdrop pixels are cut out, so the trail never smears grey studio paper.
    const pctx = photo.getContext('2d', { willReadFrequently: true });
    if (pctx) {
      pctx.drawImage(img, 0, 0, photo.width, photo.height);
      const pixels = pctx.getImageData(0, 0, photo.width, photo.height);
      const p = pixels.data;
      for (let i = 0; i < p.length; i += 4)
        if (isBackdrop(p[i] ?? 0, p[i + 1] ?? 0, p[i + 2] ?? 0)) p[i + 3] = 0;
      pctx.putImageData(pixels, 0, 0);
    }
    // ~3.5 px cells (4.5 on phones): dense enough for a printed look, cheap enough to redraw while hovering.
    const cell = w < 480 ? 4.5 : 3.5;
    dots = sampleDots(grid(Math.max(60, Math.round(w / cell))), style.mode);
  };
  layout();

  const scatter = (i: number) => {
    const a = (i * 2.399963) % (Math.PI * 2);
    return { dx: Math.cos(a) * (0.3 + ((i * 7) % 10) / 20), dy: Math.sin(a) * 0.3 + 0.4 };
  };
  let assembleStart: number | null = animate ? null : -Infinity;
  let px: number | null = null;
  let py: number | null = null;
  let lastX: number | null = null;
  let lastY: number | null = null;
  let lastT = 0;
  let push = 0;
  let pushTarget = 0;
  let clearRects: readonly { x: number; y: number; w: number; h: number }[] = [];
  let frame = 0;
  let prev = 0;

  /** Static soft reveal around the pointer (reduced motion: no trail, no push). */
  const staticReveal = (x: number, y: number): number =>
    px === null || py === null ? 0 : reveal(1 - Math.hypot(x - px, y - py) / 90);

  const drawReveal = (): void => {
    const lctx = layer.getContext('2d');
    if (!mctx || !maskData || !lctx) return;
    const den = field.density();
    for (let i = 0; i < den.length; i++)
      maskData.data[i * 4 + 3] = Math.round(reveal(den[i] ?? 0) * 255);
    mctx.putImageData(maskData, 0, 0);
    lctx.globalCompositeOperation = 'copy';
    lctx.imageSmoothingEnabled = true;
    lctx.drawImage(mask, 0, 0, layer.width, layer.height);
    lctx.globalCompositeOperation = 'source-in';
    lctx.drawImage(photo, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    ctx.drawImage(layer, 0, 0, w, h);
  };

  const draw = (now: number): void => {
    frame = 0;
    const dt = prev ? Math.min(0.05, (now - prev) / 1000) : 1 / 60;
    prev = now;
    ctx.clearRect(0, 0, w, h);
    const k = assembleStart === null ? 0 : easeOut(Math.min(1, (now - assembleStart) / 1100));
    // Push eases towards its target (~200 ms), so dots spring back after the pointer leaves.
    push += (pushTarget - push) * Math.min(1, dt * 12);
    if (Math.abs(pushTarget - push) < 0.01) push = pushTarget;
    const trailing = animate && field.active() ? field.step(dt) : false;

    dots.forEach((d, i) => {
      // Stagger top-to-bottom so the figure builds downward.
      const local = assembleStart === null ? 0 : Math.max(0, Math.min(1, k * 1.4 - d.v * 0.4));
      const sc = scatter(i);
      let x = (d.u + sc.dx * (1 - local)) * w;
      let y = (d.v + sc.dy * (1 - local)) * h;
      if (px !== null && py !== null && push > 0) {
        const [ox, oy] = pushOffset(x - px, y - py, d.seed, push);
        x += ox;
        y += oy;
      }
      const shown = animate ? reveal(field.at(d.u, d.v)) : staticReveal(x, y);
      if (shown >= 0.99) return;
      const dim = clearRects.length ? clearAlpha(x, y, clearRects, 28, style.clear) : 1;
      const size = d.s * w * 0.82;
      ctx.globalAlpha =
        (assembleStart === null ? 0 : Math.min(1, local * 1.5)) * dim * d.a * (1 - shown);
      ctx.fillStyle = lut[Math.round(d.t * 32)] ?? '';
      // Revealed dots lift slightly as they give way to the photo.
      ctx.fillRect(x - size / 2, y - size / 2 - shown * 3, size, size);
    });
    ctx.globalAlpha = 1;

    if (animate) {
      if (field.active()) drawReveal();
    } else if (px !== null && py !== null) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(px, py, 90, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(photo, 0, 0, w, h);
      ctx.restore();
    }

    // Pointer moves request their own frames; the loop only runs while something is still settling.
    const moving = (assembleStart !== null && k < 1) || push !== pushTarget || trailing;
    if (moving) frame = requestAnimationFrame(draw);
    else prev = 0;
  };
  const request = (): void => {
    if (!frame) frame = requestAnimationFrame(draw);
  };

  new ResizeObserver(() => {
    layout();
    request();
  }).observe(canvas);
  request();

  return {
    assemble(instant = false) {
      assembleStart = animate && !instant ? performance.now() : -Infinity;
      request();
    },
    finalDots() {
      return dots.map((d) => {
        const x = d.u * w;
        const y = d.v * h;
        const dim = clearRects.length ? clearAlpha(x, y, clearRects, 28, style.clear) : 1;
        return {
          x,
          y,
          size: d.s * w * 0.82,
          color: lut[Math.round(d.t * 32)] ?? '',
          alpha: d.a * dim,
        };
      });
    },
    clear(rects) {
      clearRects = rects;
      request();
    },
    pointer(x, y) {
      px = x;
      py = y;
      if (x === null || y === null) {
        pushTarget = 0;
        lastX = lastY = null;
        request();
        return;
      }
      if (animate) {
        pushTarget = 1;
        const now = performance.now();
        const dt = Math.max(0.008, (now - lastT) / 1000);
        lastT = now;
        // Splat along the path since the last event so fast moves leave a continuous trail.
        const fx = lastX ?? x;
        const fy = lastY ?? y;
        const steps = Math.max(1, Math.ceil(Math.hypot(x - fx, y - fy) / 8));
        const velX = (((x - fx) / w) * field.cols) / dt;
        const velY = (((y - fy) / h) * field.rows) / dt;
        for (let s = 1; s <= steps; s++) {
          const t = s / steps;
          field.splat(
            (fx + (x - fx) * t) / w,
            (fy + (y - fy) * t) / h,
            velX,
            velY,
            2.6,
            0.5 / steps + 0.08,
          );
        }
        lastX = x;
        lastY = y;
      }
      request();
    },
    recolour() {
      style = readStyle(root);
      lut = lutFor(style);
      layout();
      request();
    },
  };
}
