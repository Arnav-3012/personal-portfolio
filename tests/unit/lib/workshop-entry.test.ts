import { describe, expect, it } from 'vitest';
import { BRAIN, NEAR_PX, wrapNote } from '../../../src/lib/workshop-entry';

describe('wrapNote', () => {
  it('breaks a short note into lines at word boundaries', () => {
    expect(wrapNote('psst... press my brain')).toEqual(['psst... press', 'my brain']);
    expect(wrapNote('one two three', 7)).toEqual(['one two', 'three']);
  });
  it('never splits a word, and keeps a long one on its own line', () => {
    expect(wrapNote('extraordinarily short')).toEqual(['extraordinarily', 'short']);
    expect(wrapNote('a')).toEqual(['a']);
  });
  it('returns nothing for an empty note and ignores extra spaces', () => {
    expect(wrapNote('')).toEqual([]);
    expect(wrapNote('  hello   world  ', 20)).toEqual(['hello world']);
  });
});

describe('brain placement', () => {
  it('sits inside the stage, over the skull, with a sensible reach', () => {
    expect(BRAIN.x).toBeGreaterThan(0.3);
    expect(BRAIN.x).toBeLessThan(0.7);
    expect(BRAIN.y).toBeGreaterThan(0.15);
    expect(BRAIN.y).toBeLessThan(0.45);
    expect(BRAIN.x + BRAIN.size / 2).toBeLessThanOrEqual(1);
    expect(NEAR_PX).toBeGreaterThan(0);
  });
});
