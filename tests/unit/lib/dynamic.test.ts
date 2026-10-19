import { describe, expect, it } from 'vitest';
import { GLYPHS, easeOut, flipDelta, scrambleFrame } from '../../../src/lib/dynamic';
import { rng } from '../../../src/lib/neural';

describe('scrambleFrame', () => {
  const target = 'All projects, 2026';
  it('starts as noise, ends as the real text, and never changes length', () => {
    const r = rng(3);
    const first = scrambleFrame(target, 0, r);
    expect(first).not.toBe(target);
    expect(first).toHaveLength(target.length);
    expect(scrambleFrame(target, 1, r)).toBe(target);
  });
  it('keeps spaces and punctuation in place so the line keeps its shape', () => {
    const out = scrambleFrame(target, 0, rng(9));
    [...target].forEach((ch, i) => {
      if (!/[A-Za-z0-9]/.test(ch)) expect(out[i]).toBe(ch);
    });
  });
  it('resolves left to right: everything before the progress mark is real', () => {
    const out = scrambleFrame(target, 0.5, rng(1));
    const settled = Math.floor(0.5 * target.length);
    expect(out.slice(0, settled)).toBe(target.slice(0, settled));
  });
  it('only draws noise from the glyph set', () => {
    const out = scrambleFrame('abcdef', 0, rng(5));
    for (const ch of out) expect(GLYPHS).toContain(ch);
  });
});

describe('flipDelta and easeOut', () => {
  it('moves a row back by exactly how far it jumped', () => {
    expect(flipDelta(300, 120)).toBe(180);
    expect(flipDelta(120, 300)).toBe(-180);
    expect(flipDelta(50, 50)).toBe(0);
  });
  it('eases from 0 to 1, fast then slow', () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.5)).toBeGreaterThan(0.5);
  });
});
