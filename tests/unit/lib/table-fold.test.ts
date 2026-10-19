import { describe, expect, it } from 'vitest';
import { FOLD_ROWS, foldLabel, foldPlan } from '../../../src/lib/table-fold';

const on = (n: number): boolean[] => Array.from({ length: n }, () => true);

describe('foldPlan', () => {
  it('shows the first rows and folds the rest', () => {
    const plan = foldPlan(on(21), FOLD_ROWS, false);
    expect(plan.slice(0, FOLD_ROWS).every((x) => !x)).toBe(true);
    expect(plan.slice(FOLD_ROWS).every(Boolean)).toBe(true);
    expect(plan.filter(Boolean)).toHaveLength(21 - FOLD_ROWS);
  });
  it('folds nothing when expanded, or when there are few rows', () => {
    expect(foldPlan(on(21), FOLD_ROWS, true).some(Boolean)).toBe(false);
    expect(foldPlan(on(FOLD_ROWS), FOLD_ROWS, false).some(Boolean)).toBe(false);
    expect(foldPlan(on(3), FOLD_ROWS, false).some(Boolean)).toBe(false);
  });
  it('counts only the rows the filter lets through, and never folds a row the filter hid', () => {
    // 21 rows; the filter hides every other one, leaving 11 matches.
    const shown = Array.from({ length: 21 }, (_, i) => i % 2 === 0);
    const plan = foldPlan(shown, FOLD_ROWS, false);
    expect(plan.filter(Boolean)).toHaveLength(3);
    shown.forEach((on, i) => {
      if (!on) expect(plan[i]).toBe(false);
    });
    // The 8 shown rows are the first 8 matches, in order.
    const kept = shown.map((s, i) => (s && !plan[i] ? i : -1)).filter((i) => i >= 0);
    expect(kept).toEqual([0, 2, 4, 6, 8, 10, 12, 14]);
  });
  it('handles an empty list', () => expect(foldPlan([], FOLD_ROWS, false)).toEqual([]));
});

describe('foldLabel', () => {
  it('names the count to expand to, and the way back', () => {
    expect(foldLabel(21, false)).toBe('Show all 21 projects');
    expect(foldLabel(12, false)).toBe('Show all 12 projects');
    expect(foldLabel(21, true)).toBe('Show fewer');
  });
});
