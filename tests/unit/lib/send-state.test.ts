import { describe, expect, it } from 'vitest';
import { packetAt, READOUT, wordCount } from '../../../src/lib/send-state';

describe('packetAt', () => {
  it('creeps near the first stop while verifying', () => {
    expect(packetAt('verify', 0)).toBeCloseTo(0.015, 3);
    expect(packetAt('verify', 5000)).toBeLessThan(0.06);
  });
  it('drifts from the middle towards the end while sending, and never arrives early', () => {
    expect(packetAt('send', 0)).toBeCloseTo(0.5, 3);
    expect(packetAt('send', 1000)).toBeGreaterThan(packetAt('send', 200));
    expect(packetAt('send', 60000)).toBeLessThan(0.95);
  });
  it('lands at the end only when done', () => {
    expect(packetAt('done', 0)).toBe(1);
    expect(packetAt('fail', 0)).toBeLessThan(1);
  });
});

describe('wordCount and the readouts', () => {
  it('counts words', () => {
    expect(wordCount('')).toBe(0);
    expect(wordCount('  hello   there world ')).toBe(3);
  });
  it('has a readout for every stage', () => {
    expect(Object.keys(READOUT).sort()).toEqual(['done', 'fail', 'send', 'verify']);
  });
});
