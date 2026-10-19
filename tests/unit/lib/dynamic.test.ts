import { describe, expect, it } from 'vitest';
import { easeOut, flipDelta } from '../../../src/lib/dynamic';

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
