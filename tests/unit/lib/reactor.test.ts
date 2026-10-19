import { describe, expect, it } from 'vitest';
import {
  R,
  capTargets,
  makeParticles,
  mixColour,
  particlePos,
  reactorLayout,
  reactorStep,
  rgbOf,
  structurePoints,
  type Target,
} from '../../../src/lib/reactor';

describe('reactorStep', () => {
  it('charges with the lower of real progress and the minimum-duration curve', () => {
    expect(reactorStep(null, 0, 1).charge).toBe(0);
    expect(reactorStep(null, 600, 1).charge).toBeLessThan(1);
    expect(reactorStep(null, 1000, 0.2).charge).toBeCloseTo(0.2, 5);
    expect(reactorStep(null, 1000, 0.2).phase).toBe('charge');
  });

  it('never ignites before the minimum charge time, however fast the assets load', () => {
    expect(reactorStep(null, R.MIN_CHARGE - 50, 1).phase).toBe('charge');
    expect(reactorStep(null, R.MIN_CHARGE, 1).phase).toBe('ignite');
  });

  it('ignites at the wait limit even if loading never finishes', () => {
    expect(reactorStep(null, R.MAX_WAIT - 10, 0.3).phase).toBe('charge');
    expect(reactorStep(null, R.MAX_WAIT, 0.3).phase).toBe('ignite');
  });

  it('walks ignite → burst → recombine → settle → done from the moment of ignition', () => {
    const at = 3000;
    const phase = (since: number) => reactorStep(at, at + since, 1).phase;
    expect(phase(0)).toBe('ignite');
    expect(phase(R.FLASH)).toBe('burst');
    expect(phase(R.RECOMBINE_FROM)).toBe('recombine');
    expect(phase(R.HANDOFF_AT)).toBe('settle');
    expect(phase(R.DONE_AT)).toBe('done');
    expect(reactorStep(at, at + 500, 1).since).toBe(500);
  });
});

describe('colour helpers', () => {
  it('reads hex and rgb() forms', () => {
    expect(rgbOf('#4fd8ff')).toEqual([79, 216, 255]);
    expect(rgbOf('rgb(10 20 30)')).toEqual([10, 20, 30]);
    expect(rgbOf('rgb(10, 20, 30)')).toEqual([10, 20, 30]);
  });
  it('mixes linearly and clamps', () => {
    expect(mixColour('#000000', '#ffffff', 0.5)).toBe('rgb(128 128 128)');
    expect(mixColour('#102030', '#ffffff', 0)).toBe('rgb(16 32 48)');
    expect(mixColour('#000000', '#ffffff', 9)).toBe('rgb(255 255 255)');
  });
});

describe('reactorLayout', () => {
  const wide = reactorLayout(1440, 900, 5, 5);
  it('puts the core at the centre with stages either side of it', () => {
    expect(wide.core.x).toBe(720);
    expect(wide.cy).toBe(450);
    const left = wide.stages.filter((s) => s.x < wide.core.x).length;
    expect(wide.coreIndex).toBe(left);
    expect(wide.stages.every((s) => s.x > 0 && s.x < wide.w)).toBe(true);
  });
  it('keeps the tokens on the left, the name slots on the right, all on screen', () => {
    expect(wide.chips).toHaveLength(5);
    expect(wide.out).toHaveLength(5);
    expect(wide.chips.every((c) => c.x < wide.core.x)).toBe(true);
    expect(wide.out.every((o) => o.x > wide.core.x && o.y > 0 && o.y < wide.h)).toBe(true);
  });
  it('uses a shorter pipeline on phones', () => {
    const phone = reactorLayout(390, 844, 5, 5);
    expect(phone.compact).toBe(true);
    expect(phone.stages.length).toBeLessThan(wide.stages.length);
    expect(phone.stages.every((s) => s.x > 0 && s.x < 390)).toBe(true);
  });
});

describe('particles', () => {
  const layout = reactorLayout(1440, 900, 5, 5);
  const targets: Target[] = Array.from({ length: 200 }, (_, i) => ({
    x: 300 + (i % 20) * 40,
    y: 200 + Math.floor(i / 20) * 40,
    size: 6,
    color: '#ffffff',
    alpha: 1,
  }));
  const particles = makeParticles(targets, layout);

  it('makes one particle per target and is deterministic', () => {
    expect(particles).toHaveLength(targets.length);
    expect(makeParticles(targets, layout)[7]?.sx).toBe(particles[7]?.sx);
  });
  it('starts on the machine and ends exactly on its target dot', () => {
    for (const p of particles.slice(0, 30)) {
      // At the hand-off the dots are already within a couple of pixels of home (the real hero takes over seamlessly).
      const hand = particlePos(p, R.HANDOFF_AT);
      expect(Math.hypot(hand.x - p.target.x, hand.y - p.target.y)).toBeLessThan(2);
      const end = particlePos(p, R.DONE_AT);
      expect(end.x).toBeCloseTo(p.target.x, 3);
      expect(end.y).toBeCloseTo(p.target.y, 3);
      expect(end.local).toBe(1);
      expect(particlePos(p, 0).local).toBe(0);
    }
  });
  it('flies outwards during the burst before returning', () => {
    const p = particles[3];
    if (!p) throw new Error('no particle');
    const rest = particlePos(p, 0);
    const mid = particlePos(p, R.RECOMBINE_FROM - 5);
    expect(Math.hypot(mid.x - rest.x, mid.y - rest.y)).toBeGreaterThan(20);
  });
  it('samples the machine for burst origins inside the screen', () => {
    const pts = structurePoints(layout);
    expect(pts.length).toBeGreaterThan(100);
    expect(pts.every((q) => q.x >= 0 && q.x <= layout.w && q.y >= 0 && q.y <= layout.h)).toBe(true);
  });
  it('caps a long target list evenly, and leaves a short one alone', () => {
    const many = Array.from({ length: 1000 }, (_, i) => i);
    const capped = capTargets(many, 100);
    expect(capped).toHaveLength(100);
    expect(capped[0]).toBe(0);
    expect(capped[99]).toBeGreaterThan(900);
    expect(capTargets([1, 2, 3], 100)).toEqual([1, 2, 3]);
  });
});
