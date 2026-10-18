// Phase 1 gate: text contrast ≥ 4.5:1 in both themes, non-text UI (focus ring, live dot) ≥ 3:1 (WCAG 2.x).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync('src/styles/tokens.css', 'utf8');

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  const body = css.slice(css.indexOf('{', start) + 1, css.indexOf('}', start));
  return Object.fromEntries(
    [...body.matchAll(/--([\w-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1], m[2]]),
  );
}

type Theme = Record<string, string>;
const night: Theme = block(":root[data-theme='night']");
const day: Theme = { ...night, ...block(":root[data-theme='day']") };

const tok = (t: Theme, name: string): string => {
  const value = t[name];
  if (!value) throw new Error(`missing token --${name}`);
  return value;
};

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe.each([
  ['night', night],
  ['day', day],
])('%s theme', (_, t) => {
  it('defines every colour token', () => {
    for (const k of [
      'bg',
      'surface',
      'line',
      'text',
      'text-2',
      'holo',
      'action',
      'on-action',
      'time',
      'ok',
    ])
      expect(t[k], k).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(['text', 'text-2', 'holo', 'action', 'time', 'ok'])(
    '--%s is ≥ 4.5:1 on bg and surface',
    (k) => {
      expect(contrast(tok(t, k), tok(t, 'bg'))).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tok(t, k), tok(t, 'surface'))).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('button text (--on-action) is ≥ 4.5:1 on --action', () => {
    expect(contrast(tok(t, 'on-action'), tok(t, 'action'))).toBeGreaterThanOrEqual(4.5);
  });

  it('focus ring (--holo) is ≥ 3:1 on bg', () => {
    expect(contrast(tok(t, 'holo'), tok(t, 'bg'))).toBeGreaterThanOrEqual(3);
  });
});

it('chalk on the chalkboard is ≥ 4.5:1', () => {
  expect(contrast(tok(night, 'text'), tok(night, 'board'))).toBeGreaterThanOrEqual(4.5);
});
