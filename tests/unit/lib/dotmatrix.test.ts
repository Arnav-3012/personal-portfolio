import { describe, expect, it } from 'vitest';
import {
  BAYER4,
  CLEAR_ALPHA,
  CLEAR_ALPHA_DAY,
  PUSH_RADIUS,
  bayer,
  clearAlpha,
  createField,
  edgeFade,
  isBackdrop,
  luminance,
  mix,
  percentiles,
  pushOffset,
  ramp,
  reveal,
  sampleDots,
} from '../../../src/lib/dotmatrix';

/** A cols×rows RGBA grid filled by a function of (u, v). */
const grid = (
  cols: number,
  rows: number,
  px: (u: number, v: number) => [number, number, number],
) => {
  const data: number[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < cols; x++) data.push(...px((x + 0.5) / cols, (y + 0.5) / rows), 255);
  return { data, cols, rows };
};
/** Dark warm hair on the left half, lit skin on the right half (no backdrop). */
const split = (u: number): [number, number, number] => (u < 0.5 ? [30, 22, 18] : [215, 160, 128]);
const density = (dots: { u: number }[], half: 'left' | 'right') =>
  dots.filter((d) => (half === 'left' ? d.u < 0.5 : d.u >= 0.5)).length;

describe('ordered dither', () => {
  it('Bayer 4×4 holds each threshold once, all inside (0, 1)', () => {
    expect([...BAYER4].sort((a, b) => a - b)).toEqual(Array.from({ length: 16 }, (_, i) => i));
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        expect(bayer(x, y)).toBeGreaterThan(0);
        expect(bayer(x, y)).toBeLessThan(1);
      }
    expect(bayer(4, 4)).toBe(bayer(0, 0));
  });

  it('Day inks dark areas densely; Night lights bright areas densely', () => {
    const g = grid(40, 50, split);
    const ink = sampleDots(g, 'ink');
    const light = sampleDots(g, 'light');
    expect(density(ink, 'left')).toBeGreaterThan(density(ink, 'right') * 3);
    expect(density(light, 'right')).toBeGreaterThan(density(light, 'left') * 3);
  });

  it('contrast stretch maps the 2nd–98th percentiles to the full range', () => {
    const values = Array.from({ length: 100 }, (_, i) => i / 100);
    const [lo, hi] = percentiles(values);
    expect(lo).toBeCloseTo(0.02);
    expect(hi).toBeCloseTo(0.98);
    expect(percentiles([])).toEqual([0, 1]);
  });

  it('drops the neutral grey backdrop but keeps hair, shirt and skin', () => {
    expect(isBackdrop(110, 112, 115)).toBe(true);
    expect(isBackdrop(25, 20, 18)).toBe(false);
    expect(isBackdrop(8, 8, 8)).toBe(false);
    expect(isBackdrop(205, 150, 120)).toBe(false);
    const grey = (): [number, number, number] => [110, 112, 115];
    expect(sampleDots(grid(20, 25, grey), 'light')).toHaveLength(0);
  });

  it('edge fade: centre full, corners gone, torso fades below the chin', () => {
    expect(edgeFade(0.5, 0.5)).toBe(1);
    expect(edgeFade(0, 0)).toBe(0);
    expect(edgeFade(0.5, 0.76)).toBeCloseTo(0.5);
    expect(edgeFade(0.5, 0.9)).toBe(0);
  });
});

describe('hover: push and trail', () => {
  it('push shoves outward with squared falloff and stops at the radius', () => {
    const [ox, oy] = pushOffset(40, 0, 0.5, 1);
    expect(ox).toBeGreaterThan(0);
    expect(oy).toBe(0);
    expect(Math.hypot(...pushOffset(20, 0, 0.5, 1))).toBeGreaterThan(Math.hypot(ox, oy));
    expect(pushOffset(PUSH_RADIUS + 1, 0, 0.5, 1)).toEqual([0, 0]);
    expect(pushOffset(40, 0, 0.5, 0)).toEqual([0, 0]);
  });

  it('a splat reveals the photo there, smears with velocity and dissolves', () => {
    const f = createField(20, 20);
    f.splat(0.5, 0.5, 30, 0);
    expect(f.active()).toBe(true);
    expect(reveal(f.at(0.5, 0.5))).toBeGreaterThan(0.5);
    expect(f.at(0.9, 0.9)).toBeLessThan(0.01);
    const before = f.at(0.65, 0.5);
    f.step(1 / 60);
    expect(f.at(0.65, 0.5)).toBeGreaterThan(before); // carried along +x
    let steps = 0;
    while (f.step(1 / 60) && steps < 600) steps++;
    expect(f.active()).toBe(false);
    expect(steps).toBeLessThan(600);
  });

  it('reveal curve: nothing below 0.02, full by 0.7', () => {
    expect(reveal(0)).toBe(0);
    expect(reveal(0.7)).toBe(1);
    expect(reveal(0.36)).toBeCloseTo(0.5, 1);
  });
});

describe('text clear zone and colour', () => {
  it('dots dim behind text and feather back to full outside it; Day dims harder', () => {
    const rect = [{ x: 100, y: 100, w: 200, h: 50 }];
    expect(clearAlpha(150, 120, rect)).toBe(CLEAR_ALPHA);
    expect(clearAlpha(150, 150 + 14, rect)).toBeCloseTo(CLEAR_ALPHA + (1 - CLEAR_ALPHA) / 2);
    expect(clearAlpha(150, 300, rect)).toBe(1);
    expect(clearAlpha(150, 120, rect, 28, CLEAR_ALPHA_DAY)).toBe(CLEAR_ALPHA_DAY);
    expect(CLEAR_ALPHA_DAY).toBeLessThan(CLEAR_ALPHA);
  });

  it('ramp and mix', () => {
    expect(luminance(255, 255, 255)).toBeCloseTo(1);
    expect(mix('#000000', '#ffffff', 0.5)).toBe('rgb(128 128 128)');
    expect(ramp(0, '#000000', '#808080', '#ffffff')).toBe('rgb(0 0 0)');
    expect(ramp(1, '#000000', '#808080', '#ffffff')).toBe('rgb(255 255 255)');
  });
});
