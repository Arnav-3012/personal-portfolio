import { describe, expect, it } from 'vitest';
import {
  BAND_WORDS,
  DIM,
  GLYPHS,
  REACH,
  proximity,
  readProgress,
  scrambleFrame,
  splitText,
  wordOpacity,
} from '../../../src/lib/text-fx';
import { rng } from '../../../src/lib/neural';

describe('wordOpacity', () => {
  it('is fully dim before reading and fully lit after', () => {
    for (let i = 0; i < 20; i++) {
      expect(wordOpacity(0, i, 20)).toBe(DIM);
      expect(wordOpacity(1, i, 20)).toBe(1);
    }
  });

  it('lights words in reading order, never backwards', () => {
    const at = (p: number) => Array.from({ length: 12 }, (_, i) => wordOpacity(p, i, 12));
    for (const p of [0.2, 0.5, 0.8]) {
      const o = at(p);
      for (let i = 1; i < o.length; i++) expect(o.at(i) ?? 0).toBeLessThanOrEqual(o.at(i - 1) ?? 0);
    }
  });

  it('keeps a soft band: about BAND_WORDS words are part-lit at once', () => {
    const o = Array.from({ length: 40 }, (_, i) => wordOpacity(0.5, i, 40));
    const partial = o.filter((v) => v > DIM && v < 1).length;
    expect(partial).toBeGreaterThanOrEqual(BAND_WORDS - 1);
    expect(partial).toBeLessThanOrEqual(BAND_WORDS);
  });
});

describe('readProgress', () => {
  it('is 0 until the top reaches 90% of the viewport and 1 once the bottom passes 40%', () => {
    expect(readProgress(900, 200, 1000)).toBe(0);
    expect(readProgress(1200, 200, 1000)).toBe(0);
    expect(readProgress(400 - 200, 200, 1000)).toBe(1);
    expect(readProgress(-500, 200, 1000)).toBe(1);
  });

  it('rises steadily in between', () => {
    const a = readProgress(700, 200, 1000);
    const b = readProgress(500, 200, 1000);
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
  });
});

describe('proximity', () => {
  it('is 1 under the cursor, falls off smoothly and is 0 beyond the reach', () => {
    expect(proximity(0)).toBe(1);
    expect(proximity(REACH / 2)).toBeCloseTo(0.25);
    expect(proximity(REACH)).toBe(0);
    expect(proximity(REACH * 3)).toBe(0);
  });
});

describe('scrambleFrame', () => {
  const target = '01 · Work';
  it('is noise at 0 and the real text at 1, keeping spaces and punctuation', () => {
    expect(scrambleFrame(target, 1, rng(3))).toBe(target);
    const out = scrambleFrame(target, 0, rng(3));
    expect(out[2]).toBe(' ');
    expect(out[3]).toBe('·');
    for (const ch of [out.charAt(0), out.charAt(1), ...out.slice(5)]) expect(GLYPHS).toContain(ch);
  });
});

describe('splitText', () => {
  it('keeps the whitespace so the words rejoin to the original text', () => {
    const text = 'Selected  work\nby Arnav';
    expect(splitText(text).join('')).toBe(text);
    expect(splitText(text).filter((p) => !/^\s+$/.test(p))).toEqual([
      'Selected',
      'work',
      'by',
      'Arnav',
    ]);
  });

  it('returns nothing for empty text', () => {
    expect(splitText('')).toEqual([]);
  });
});
