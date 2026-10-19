import { describe, expect, it } from 'vitest';
import {
  SECTION_KINDS,
  cursorKind,
  follow,
  isClickable,
  wantsNative,
} from '../../../src/lib/cursor';
import {
  PARALLAX,
  PARALLAX_RANGE,
  pageProgress,
  parallaxOffsets,
} from '../../../src/lib/scroll-fx';
import { anchorTarget, smoothEligible } from '../../../src/lib/smooth';

/** A stand-in element that is inside the given selectors. */
const inside = (...selectors: string[]) => ({
  closest: (s: string) =>
    s.split(',').some((part) => selectors.includes(part.trim())) ? {} : null,
});

describe('section cursor', () => {
  it('picks one glyph per section and the arrow everywhere else', () => {
    expect(cursorKind(inside('[data-hero]'))).toBe('cross');
    expect(cursorKind(inside('#work'))).toBe('open');
    expect(cursorKind(inside('#projects'))).toBe('open');
    expect(cursorKind(inside('#experience'))).toBe('vertical');
    expect(cursorKind(inside('[id="75-hard"]'))).toBe('horizontal');
    expect(cursorKind(inside('#beyond'))).toBe('play');
    expect(cursorKind(inside('#contact'))).toBe('pencil');
    expect(cursorKind(inside())).toBe('arrow');
    expect(cursorKind(null)).toBe('arrow');
  });
  it('uses only valid selectors (a leading digit in an id selector throws)', () => {
    for (const [selector] of SECTION_KINDS) expect(selector).not.toMatch(/#\d/);
  });
  it('shows a different glyph in at least eight sections', () => {
    expect(new Set(SECTION_KINDS.map(([, kind]) => kind)).size).toBeGreaterThanOrEqual(8);
  });
  it('swells over clickable things and gives way to the native cursor in fields and dialogs', () => {
    expect(isClickable(inside('a'))).toBe(true);
    expect(isClickable(inside())).toBe(false);
    expect(wantsNative(inside('dialog', '[role=dialog]'))).toBe(true);
    expect(wantsNative(inside())).toBe(false);
  });
  it('eases towards the pointer and snaps with no time elapsed', () => {
    expect(follow(0, 100, 0, 30)).toBe(100);
    const a = follow(0, 100, 1 / 60, 32);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(100);
    expect(follow(a, 100, 1 / 60, 32)).toBeGreaterThan(a);
  });
});

describe('scroll depth', () => {
  it('moves the layers apart as the page scrolls, and stops past the hero', () => {
    expect(parallaxOffsets(0, 900)).toEqual({ stage: 0, name: -0, quads: 0 });
    const mid = parallaxOffsets(450, 900);
    expect(mid.stage).toBeCloseTo(450 * PARALLAX.stage, 5);
    expect(mid.name).toBeLessThan(0);
    const far = parallaxOffsets(9000, 900);
    expect(far.stage).toBeCloseTo(900 * PARALLAX_RANGE * PARALLAX.stage, 5);
    expect(parallaxOffsets(-50, 900).stage).toBe(0);
  });
  it('reports page progress from 0 to 1 and 0 on a page that does not scroll', () => {
    expect(pageProgress(0, 3000, 900)).toBe(0);
    expect(pageProgress(1050, 3000, 900)).toBeCloseTo(0.5, 5);
    expect(pageProgress(5000, 3000, 900)).toBe(1);
    expect(pageProgress(0, 800, 900)).toBe(0);
  });
});

describe('smooth scrolling', () => {
  const root = (motion: string) => ({ dataset: { motion } }) as unknown as HTMLElement;
  it('runs for a fine pointer with full motion only', () => {
    expect(smoothEligible(root('full'), true)).toBe(true);
    expect(smoothEligible(root('reduced'), true)).toBe(false);
    expect(smoothEligible(root('full'), false)).toBe(false);
  });
  it('resolves in-page links to an element, and nothing else', () => {
    const doc = {
      getElementById: (id: string) => (id === 'work' ? ({ id } as HTMLElement) : null),
    };
    expect(anchorTarget('#work', doc)?.id).toBe('work');
    expect(anchorTarget('#nope', doc)).toBeNull();
    expect(anchorTarget('#', doc)).toBeNull();
    expect(anchorTarget('/workshop', doc)).toBeNull();
    expect(anchorTarget(null, doc)).toBeNull();
  });
});
