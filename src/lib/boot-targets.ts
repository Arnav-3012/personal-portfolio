// The dots the boot's particles fly to, in viewport pixels: the dot portrait's own final dots, and the exact dots inside each
// letter of the name. The name is real text filled with a dot grid (0.04em pitch, anchored at the letter's top-left), so
// the dots are found by drawing each glyph into a mask with the same font and keeping the grid points that fall inside it.
import type { DotMatrix } from './dotmatrix';
import type { Target } from './reactor';

export function portraitTargets(dots: DotMatrix, canvas: HTMLCanvasElement): Target[] {
  const box = canvas.getBoundingClientRect();
  return dots.finalDots().map((d) => ({ ...d, x: box.left + d.x, y: box.top + d.y }));
}

/** Pitch of the name's dot grid, as a fraction of the font size (the `0.04em` in Hero.astro). */
export const NAME_PITCH_EM = 0.04;

export function letterTargets(letters: readonly HTMLElement[], color: string): Target[] {
  const out: Target[] = [];
  const mask = document.createElement('canvas');
  const g = mask.getContext('2d', { willReadFrequently: true });
  if (!g) return out;
  for (const el of letters) {
    const box = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const fontSize = parseFloat(cs.fontSize);
    const pitch = fontSize * NAME_PITCH_EM;
    const width = Math.max(1, Math.ceil(box.width));
    const height = Math.max(1, Math.ceil(box.height));
    mask.width = width;
    mask.height = height;
    g.clearRect(0, 0, width, height);
    g.font = `${cs.fontWeight} ${fontSize}px ${cs.fontFamily}`;
    g.textBaseline = 'alphabetic';
    g.fillStyle = color || 'black';
    const metrics = g.measureText(el.textContent ?? '');
    // The letter's box is one line tall: the baseline sits where CSS puts it, half the leading below the line's top.
    const lineHeight = parseFloat(cs.lineHeight) || box.height;
    const ascent = metrics.fontBoundingBoxAscent;
    const baseline = (lineHeight - (ascent + metrics.fontBoundingBoxDescent)) / 2 + ascent;
    g.fillText(el.textContent ?? '', 0, baseline);
    const px = g.getImageData(0, 0, width, height).data;
    for (let y = pitch / 2; y < height; y += pitch)
      for (let x = pitch / 2; x < width; x += pitch)
        if ((px[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] ?? 0) > 128)
          out.push({
            x: box.left + x,
            y: box.top + y,
            size: pitch * 0.62,
            color,
            alpha: 1,
            round: true,
          });
  }
  return out;
}
