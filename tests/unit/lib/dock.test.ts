import { describe, expect, it } from 'vitest';
import { dockScale } from '../../../src/lib/dock';
import { tiltFor } from '../../../src/lib/tilt';

describe('dockScale', () => {
  it('is the max under the pointer and 1 at and beyond the radius', () => {
    expect(dockScale(0)).toBeCloseTo(1.35, 6);
    expect(dockScale(170)).toBe(1);
    expect(dockScale(400)).toBe(1);
  });

  it('falls off smoothly and symmetrically', () => {
    expect(dockScale(-60)).toBeCloseTo(dockScale(60), 9);
    expect(dockScale(30)).toBeGreaterThan(dockScale(60));
    expect(dockScale(60)).toBeGreaterThan(dockScale(100));
    // Halfway to the edge is halfway up the bell.
    expect(dockScale(85)).toBeCloseTo(1.175, 6);
    // A neighbouring pill about 110 px away still swells a little.
    expect(dockScale(110)).toBeGreaterThan(1.05);
  });
});

describe('tiltFor', () => {
  it('is flat at the centre and at most `max` at the edges', () => {
    expect(tiltFor(50, 50, 100, 100)).toEqual({ rx: 0, ry: 0 });
    expect(tiltFor(100, 0, 100, 100, 5)).toEqual({ rx: 5, ry: 5 });
    expect(tiltFor(0, 100, 100, 100, 5)).toEqual({ rx: -5, ry: -5 });
  });

  it('clamps a pointer outside the box and survives an empty box', () => {
    expect(tiltFor(999, -999, 100, 100, 5)).toEqual({ rx: 5, ry: 5 });
    expect(tiltFor(10, 10, 0, 0)).toEqual({ rx: 0, ry: 0 });
  });
});
