import { describe, expect, it } from 'vitest';
import { FLICK, slidePosition, swipeStep, wrap } from '../../../src/lib/story-swipe';

describe('swipeStep', () => {
  it('goes forward on a long drag left and back on a long drag right', () => {
    expect(swipeStep(-120, 340, 0)).toBe(1);
    expect(swipeStep(120, 340, 0)).toBe(-1);
  });
  it('stays on a short, slow drag', () => {
    expect(swipeStep(-30, 340, 0)).toBe(0);
    expect(swipeStep(20, 340, -0.1)).toBe(0);
  });
  it('a quick flick counts even when the drag was short', () => {
    expect(swipeStep(-20, 340, -(FLICK + 0.1))).toBe(1);
    expect(swipeStep(20, 340, FLICK + 0.1)).toBe(-1);
  });
  it('uses a smaller threshold on a narrow frame', () => {
    expect(swipeStep(-45, 200, 0)).toBe(1);
  });
});

describe('wrap and slidePosition', () => {
  it('wraps both ways', () => {
    expect(wrap(2, 1, 3)).toBe(0);
    expect(wrap(0, -1, 3)).toBe(2);
    expect(wrap(1, 1, 3)).toBe(2);
  });
  it('puts the neighbours at -1 and 1 and the active one at 0', () => {
    expect([0, 1, 2].map((k) => slidePosition(k, 0, 3))).toEqual([0, 1, -1]);
    expect([0, 1, 2].map((k) => slidePosition(k, 2, 3))).toEqual([1, -1, 0]);
  });
});
