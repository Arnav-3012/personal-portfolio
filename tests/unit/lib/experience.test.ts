import { describe, expect, it } from 'vitest';
import { site } from '../../../src/lib/content';
import { honorsNewestFirst, isLit, scrollProgress } from '../../../src/lib/experience';

describe('honorsNewestFirst', () => {
  it('sorts by year, newest first, and keeps file order within a year', () => {
    const sorted = honorsNewestFirst(site.honors);
    const years = sorted.map((h) => h.year);
    expect(years).toEqual(years.toSorted((a, b) => b - a));
    const of2026 = site.honors.filter((h) => h.year === 2026).map((h) => h.event);
    expect(sorted.filter((h) => h.year === 2026).map((h) => h.event)).toEqual(of2026);
  });

  it('does not mutate its input', () => {
    const before = site.honors.map((h) => h.event);
    honorsNewestFirst(site.honors);
    expect(site.honors.map((h) => h.event)).toEqual(before);
  });

  it('returns every honor', () => {
    expect(honorsNewestFirst(site.honors)).toHaveLength(site.honors.length);
  });
});

describe('scrollProgress', () => {
  // vh 1000, anchor 0.6 → the draw line sits at y = 600
  it('is 0 before the section reaches the line, 1 once it has passed', () => {
    expect(scrollProgress(700, 1000, 1000)).toBe(0);
    expect(scrollProgress(-400, 1000, 1000)).toBe(1);
  });

  it('is linear between', () => {
    expect(scrollProgress(600, 1000, 1000)).toBe(0);
    expect(scrollProgress(100, 1000, 1000)).toBeCloseTo(0.5);
    expect(scrollProgress(-400, 1000, 1000)).toBe(1);
  });

  it('treats an empty section as drawn', () => {
    expect(scrollProgress(0, 0, 1000)).toBe(1);
  });

  it('honours a different anchor', () => {
    expect(scrollProgress(0, 1000, 1000, 0.5)).toBeCloseTo(0.5);
  });
});

describe('isLit', () => {
  it('lights a node once the tip has reached its centre', () => {
    expect(isLit(500, 499)).toBe(false);
    expect(isLit(500, 500)).toBe(true);
    expect(isLit(500, 800)).toBe(true);
  });
});
