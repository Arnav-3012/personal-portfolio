// Prints for the walls (SPEC "Posters on the walls"): a small gallery of original, minimal line prints in the room's own
// colours (paper, ink and one amber accent), drawn on a canvas, so the room ships no poster images. Pieces from Arnav's
// work (a transformer, a calibration plot) and his city and game (Mumbai, cricket). No Marvel names, logos or characters; no
// team logos or player likenesses. Fonts are the site's (Unbounded, JetBrains Mono): redrawn once they have loaded.
import { CanvasTexture, Color, SRGBColorSpace } from 'three';
import type { Palette } from './palette';
import { canvas, seeded } from './textures';

export const POSTER_W = 512;
export const POSTER_H = 724;

export const POSTER_KINDS = [
  'transformer',
  'calibration',
  'neural',
  'mumbai',
  'cricket',
  'shipit',
] as const;
export type PosterKind = (typeof POSTER_KINDS)[number];

type Ctx = CanvasRenderingContext2D;
const DISPLAY = '"Unbounded", "Arial Black", sans-serif';
const MONO = '"JetBrains Mono", ui-monospace, monospace';

interface Ink {
  paper: string;
  ink: string;
  amber: string;
}
const css = (c: Color): string => `#${c.getHexString()}`;
export const inkFrom = (p: Palette): Ink => ({
  paper: css(p.paper),
  ink: css(p.ink),
  amber: css(p.time),
});

const text = (
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  size: number,
  colour: string,
  opts: { font?: string; weight?: number; align?: CanvasTextAlign; track?: number } = {},
): void => {
  ctx.font = `${opts.weight ?? 500} ${size}px ${opts.font ?? MONO}`;
  ctx.fillStyle = colour;
  ctx.textAlign = opts.align ?? 'left';
  ctx.letterSpacing = `${opts.track ?? 0}px`;
  ctx.fillText(value, x, y);
  ctx.letterSpacing = '0px';
};

const base = (ctx: Ctx, c: Ink): void => {
  ctx.fillStyle = c.paper;
  ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
};

const dot = (ctx: Ctx, x: number, y: number, r: number, colour: string): void => {
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
};

function transformer(ctx: Ctx, c: Ink): void {
  base(ctx, c);
  const xs = [90, 170, 250, 330, 410];
  for (let i = 0; i < xs.length; i++)
    for (let j = i + 1; j < xs.length; j++) {
      const a = xs[i] ?? 0;
      const b = xs[j] ?? 0;
      ctx.strokeStyle = j - i === 1 ? c.amber : `${c.ink}55`;
      ctx.lineWidth = j - i === 1 ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(a, 400);
      ctx.bezierCurveTo(a, 400 - 55 * (j - i), b, 400 - 55 * (j - i), b, 400);
      ctx.stroke();
    }
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2;
  for (const x of xs) ctx.strokeRect(x - 20, 400, 40, 40);
  text(ctx, 'attention', 56, 120, 34, c.ink, { font: DISPLAY, weight: 600 });
  text(ctx, 'every token looks at every token', 56, 152, 13, c.ink, { track: 1 });
  text(ctx, 'softmax(QKᵀ/√d)V', 56, 640, 15, c.ink);
}

function calibration(ctx: Ctx, c: Ink): void {
  base(ctx, c);
  ctx.strokeRect(86, 190, 340, 340);
  ctx.setLineDash([6, 8]);
  ctx.beginPath();
  ctx.moveTo(86, 530);
  ctx.lineTo(426, 190);
  ctx.stroke();
  ctx.setLineDash([]);
  const rand = seeded(5);
  for (let i = 0; i < 8; i++) {
    const x = 98 + i * 40;
    const ideal = 34 + i * 40;
    ctx.strokeStyle = `${c.ink}66`;
    ctx.strokeRect(x, 530 - Math.max(18, ideal - 56 + rand() * 24), 16, Math.max(18, ideal - 56));
    ctx.fillStyle = c.amber;
    ctx.fillRect(x + 18, 530 - ideal, 14, ideal);
  }
  text(ctx, 'reliability', 56, 120, 34, c.ink, { font: DISPLAY, weight: 600 });
  text(ctx, 'ECE 0.169 → 0.011', 56, 640, 15, c.ink);
}

function neural(ctx: Ctx, c: Ink): void {
  base(ctx, c);
  const layers = [4, 6, 6, 3];
  const rand = seeded(17);
  const pts = layers.map((n, li) =>
    Array.from({ length: n }, (_, i) => [96 + li * 106, 380 - (n - 1) * 30 + i * 60] as const),
  );
  for (let li = 0; li < pts.length - 1; li++)
    for (const a of pts[li] ?? [])
      for (const b of pts[li + 1] ?? []) {
        const hot = rand() > 0.88;
        ctx.strokeStyle = hot ? c.amber : `${c.ink}30`;
        ctx.lineWidth = hot ? 2.5 : 1;
        ctx.beginPath();
        ctx.moveTo(a[0], a[1]);
        ctx.lineTo(b[0], b[1]);
        ctx.stroke();
      }
  for (const layer of pts)
    for (const [x, y] of layer) dot(ctx, x, y, 9, rand() > 0.82 ? c.amber : c.ink);
  text(ctx, 'forward pass', 56, 120, 34, c.ink, { font: DISPLAY, weight: 600 });
  text(ctx, 'tokens → embeddings → logits', 56, 640, 14, c.ink);
}

function mumbai(ctx: Ctx, c: Ink): void {
  base(ctx, c);
  dot(ctx, 256, 330, 58, c.amber);
  const rand = seeded(8);
  ctx.strokeStyle = c.ink;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(40, 520);
  let x = 40;
  while (x < 472) {
    const w = 18 + rand() * 30;
    const h = 40 + rand() * 150;
    ctx.lineTo(x, 520 - h);
    ctx.lineTo(x + w, 520 - h);
    ctx.lineTo(x + w, 520);
    x += w;
  }
  ctx.lineTo(472, 520);
  ctx.stroke();
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(40 + i * 12, 546 + i * 14);
    ctx.lineTo(472 - i * 12, 546 + i * 14);
    ctx.stroke();
  }
  text(ctx, 'mumbai', 56, 120, 38, c.ink, { font: DISPLAY, weight: 600 });
  text(ctx, '19.07°N  72.87°E', 56, 640, 15, c.ink, { track: 2 });
}

function cricket(ctx: Ctx, c: Ink): void {
  base(ctx, c);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.ellipse(256, 470, 190, 66, 0, 0, Math.PI * 2);
  ctx.stroke();
  for (const x of [244, 256, 268]) {
    ctx.beginPath();
    ctx.moveTo(x, 380);
    ctx.lineTo(x, 450);
    ctx.stroke();
  }
  dot(ctx, 330, 320, 16, c.amber);
  ctx.beginPath();
  ctx.moveTo(370, 270);
  ctx.quadraticCurveTo(350, 300, 336, 314);
  ctx.stroke();
  text(ctx, 'club cricket', 56, 120, 34, c.ink, { font: DISPLAY, weight: 600 });
  text(ctx, 'under the lights', 56, 640, 15, c.ink, { track: 3 });
}

function shipit(ctx: Ctx, c: Ink): void {
  base(ctx, c);
  text(ctx, 'ship', 56, 330, 128, c.ink, { font: DISPLAY, weight: 700 });
  text(ctx, 'it.', 56, 470, 128, c.amber, { font: DISPLAY, weight: 700 });
  text(ctx, 'done is better than perfect', 56, 600, 15, c.ink);
}

const DRAW: Record<PosterKind, (ctx: Ctx, c: Ink) => void> = {
  transformer,
  calibration,
  neural,
  mumbai,
  cricket,
  shipit,
};

export interface Poster {
  kind: PosterKind;
  texture: CanvasTexture;
  /** Draws again (after the site's fonts have loaded). */
  redraw: () => void;
}

export function createPoster(kind: PosterKind, palette: Palette): Poster {
  const [cv, ctx] = canvas(POSTER_W, POSTER_H);
  const texture = new CanvasTexture(cv);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  const ink = inkFrom(palette);
  const redraw = (): void => {
    DRAW[kind](ctx, ink);
    texture.needsUpdate = true;
  };
  redraw();
  return { kind, texture, redraw };
}
