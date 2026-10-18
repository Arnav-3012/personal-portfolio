import { describe, expect, it } from 'vitest';
import {
  T,
  attentionWeights,
  bootLayout,
  bootStep,
  fastestBoot,
  mulberry32,
  softmaxTopK,
} from '../../../src/lib/transformer';
import { site } from '../../../src/lib/content';

describe('transformer boot', () => {
  it('PRNG is deterministic per seed', () => {
    const a = mulberry32(7);
    const b = mulberry32(7);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(mulberry32(8)()).not.toBe(mulberry32(7)());
  });

  it('attention rows are probability distributions', () => {
    const w = attentionWeights(5, 3);
    expect(w).toHaveLength(5);
    for (const row of w) {
      expect(row).toHaveLength(5);
      expect(row.reduce((s, x) => s + x, 0)).toBeCloseTo(1);
      for (const x of row) expect(x).toBeGreaterThan(0);
    }
  });

  it('layout: columns centred and ordered, data flows up (input below layers below output)', () => {
    const l = bootLayout(1440, 900, 5, 4);
    expect(l.cols).toHaveLength(5);
    expect((l.cols[0] ?? 0) + (l.cols[4] ?? 0)).toBeCloseTo(1440);
    expect(l.layers).toHaveLength(4);
    let below = l.inputY;
    for (const L of l.layers) {
      expect(L.attnY).toBeLessThan(below);
      expect(L.ffnY).toBeLessThan(L.attnY);
      below = L.ffnY;
    }
    expect(l.outputY).toBeLessThan(below);
  });

  it('progress is the lower of real loading and the minimum duration', () => {
    const s = { forwardDoneAt: null };
    expect(bootStep(s, T.MIN_FORWARD / 2, 1, 5).progress).toBeCloseTo(0.5);
    expect(bootStep(s, T.MIN_FORWARD, 0.3, 5).progress).toBeCloseTo(0.3);
    expect(bootStep(s, T.MAX_WAIT, 0, 5).progress).toBe(1);
  });

  it('decodes the output one letter per pass, then hands off and finishes', () => {
    let state = bootStep({ forwardDoneAt: null }, T.MIN_FORWARD, 1, 5).state;
    expect(state.forwardDoneAt).toBe(T.MIN_FORWARD);
    const at = (dt: number) => bootStep(state, T.MIN_FORWARD + dt, 1, 5);
    expect(at(0)).toMatchObject({ phase: 'decode', decoded: 1 });
    expect(at(T.DECODE * 2 + 1)).toMatchObject({ phase: 'decode', decoded: 3 });
    expect(at(T.DECODE * 5 + T.HOLD + T.HANDOFF / 2)).toMatchObject({ phase: 'handoff' });
    expect(at(T.DECODE * 5 + T.HOLD + T.HANDOFF)).toMatchObject({ phase: 'done', handoff: 1 });
    state = at(0).state;
    expect(state.forwardDoneAt).toBe(T.MIN_FORWARD);
  });

  it('softmax top-k: target leads when confident, shown bars sum to ≤ 1, no duplicates', () => {
    const top = softmaxTopK('R', 5, 0.88, 3);
    expect(top).toHaveLength(5);
    expect(top[0]).toEqual({ ch: 'R', p: 0.88 });
    expect(top.reduce((s, c) => s + c.p, 0)).toBeLessThanOrEqual(1);
    expect(new Set(top.map((c) => c.ch)).size).toBe(5);
    expect(softmaxTopK('R', 5, 0.88, 3)).toEqual(top);
  });

  it('fastest boot for the real output stays within SPEC (~2.5–3 s) and under the failsafe', () => {
    const ms = fastestBoot([...site.boot.output].length);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThan(3200);
  });
});
