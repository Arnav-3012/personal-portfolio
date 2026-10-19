// Procedural textures (SPEC "Asset pipeline: code-only"): surfaces are generated on a canvas at load, so the room ships no
// image files for them. Each map is neutral light-grey detail that the material's token colour tints, which keeps the
// colours in tokens.css. A seeded generator makes every load identical.
import { CanvasTexture, NoColorSpace, RepeatWrapping, SRGBColorSpace } from 'three';

/** mulberry32: a tiny seeded random generator. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const canvas = (w: number, h = w): [HTMLCanvasElement, CanvasRenderingContext2D] => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return [c, ctx];
};

const finish = (c: HTMLCanvasElement, colour: boolean, repeat = 1): CanvasTexture => {
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.colorSpace = colour ? SRGBColorSpace : NoColorSpace;
  t.anisotropy = 8;
  return t;
};

const clamp = (v: number): number => Math.min(255, Math.max(0, v));

/** Fine grain over a flat tone: a painted plaster wall. `tone` 0 to 1; `grain` is the noise amplitude in 0 to 255 steps. */
function grain(
  size: number,
  seed: number,
  tone: number,
  amount: number,
  blotch: number,
): HTMLCanvasElement {
  const [c, ctx] = canvas(size);
  const rand = seeded(seed);
  ctx.fillStyle = `rgb(${tone * 255},${tone * 255},${tone * 255})`;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 60; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const r = (0.1 + rand() * 0.3) * size;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const v = rand() > 0.5 ? 255 : 0;
    g.addColorStop(0, `rgba(${v},${v},${v},${blotch * rand()})`);
    g.addColorStop(1, `rgba(${v},${v},${v},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const img = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = (rand() - 0.5) * amount;
    img.data[i] = clamp((img.data[i] ?? 0) + n);
    img.data[i + 1] = clamp((img.data[i + 1] ?? 0) + n);
    img.data[i + 2] = clamp((img.data[i + 2] ?? 0) + n);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Painted plaster: almost flat, with the faintest trowel mottling. */
export function plasterMap(): CanvasTexture {
  return finish(grain(1024, 21, 0.96, 10, 0.05), true);
}

/** Pale oak grain along x, for the desk, shelves and the door. */
export function woodMap(): CanvasTexture {
  const [c, ctx] = canvas(512);
  const rand = seeded(31);
  ctx.fillStyle = 'rgb(236,236,236)';
  ctx.fillRect(0, 0, 512, 512);
  for (let y = 0; y < 512; y += 2) {
    const v = 205 + rand() * 50;
    ctx.fillStyle = `rgba(${v},${v},${v},0.5)`;
    ctx.fillRect(0, y, 512, 1 + rand() * 2);
  }
  return finish(c, true);
}

/** Pale oak floor boards along x: wide planks, a fine seam, a soft satin finish. */
export function plankMaps(): { map: CanvasTexture; roughness: CanvasTexture } {
  const size = 1024;
  const boards = 5;
  const [c, ctx] = canvas(size);
  const [r, rctx] = canvas(size);
  const rand = seeded(61);
  const h = size / boards;
  for (let b = 0; b < boards; b++) {
    const tone = 0.88 + rand() * 0.1;
    ctx.fillStyle = `rgb(${tone * 255},${tone * 255},${tone * 255})`;
    ctx.fillRect(0, b * h, size, h);
    for (let g = 0; g < 38; g++) {
      const y = b * h + rand() * h;
      const v = rand() > 0.5 ? 255 : 0;
      ctx.strokeStyle = `rgba(${v},${v},${v},${0.03 + rand() * 0.06})`;
      ctx.lineWidth = 0.6 + rand() * 1.4;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(
        size * 0.3,
        y + (rand() - 0.5) * 5,
        size * 0.6,
        y + (rand() - 0.5) * 5,
        size,
        y + (rand() - 0.5) * 3,
      );
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(0, b * h, size, 1.5);
    ctx.fillRect((rand() * size) | 0, b * h, 1.5, h);
  }
  rctx.fillStyle = 'rgb(140,140,140)';
  rctx.fillRect(0, 0, size, size);
  return { map: finish(c, true), roughness: finish(r, false) };
}

/** A fine linen weave for the sheer curtains. */
export function linenMap(): CanvasTexture {
  const [c, ctx] = canvas(256);
  const rand = seeded(4);
  ctx.fillStyle = 'rgb(240,240,240)';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 256; i += 2) {
    ctx.fillStyle = `rgba(0,0,0,${0.02 + rand() * 0.05})`;
    ctx.fillRect(i, 0, 1, 256);
    ctx.fillStyle = `rgba(255,255,255,${0.05 + rand() * 0.08})`;
    ctx.fillRect(0, i, 256, 1);
  }
  return finish(c, true, 1);
}

/**
 * A shaggy fur rug. `strands` is a light-grey map of short, randomly combed strands (also used as the bump map); `edge` is
 * an alpha map: a round rug with a soft, slightly irregular fringe. The rug is drawn as a few stacked discs so the pile
 * has depth.
 */
export function furMaps(): { strands: CanvasTexture; edge: CanvasTexture } {
  const size = 1024;
  const [c, ctx] = canvas(size);
  const rand = seeded(97);
  ctx.fillStyle = 'rgb(196,196,196)';
  ctx.fillRect(0, 0, size, size);
  ctx.lineCap = 'round';
  for (let i = 0; i < 26000; i++) {
    const x = rand() * size;
    const y = rand() * size;
    const a = rand() * Math.PI * 2;
    const len = 6 + rand() * 12;
    const v = 150 + rand() * 105;
    ctx.strokeStyle = `rgba(${v},${v},${v},0.55)`;
    ctx.lineWidth = 1 + rand() * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
    ctx.stroke();
  }
  const [e, ectx] = canvas(size);
  ectx.fillStyle = 'rgb(0,0,0)';
  ectx.fillRect(0, 0, size, size);
  ectx.filter = 'blur(5px)';
  ectx.fillStyle = 'rgb(255,255,255)';
  ectx.beginPath();
  const steps = 180;
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    const r = size * (0.46 + Math.sin(a * 7) * 0.006 + (rand() - 0.5) * 0.012);
    const x = size / 2 + Math.cos(a) * r;
    const y = size / 2 + Math.sin(a) * r;
    if (i === 0) ectx.moveTo(x, y);
    else ectx.lineTo(x, y);
  }
  ectx.fill();
  const strands = finish(c, true);
  strands.wrapS = strands.wrapT = RepeatWrapping;
  const edge = finish(e, false);
  return { strands, edge };
}
