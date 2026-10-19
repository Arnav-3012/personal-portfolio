import { describe, expect, it } from 'vitest';
import { buildNetwork, layersFor, nextEdge, rng, type Focus } from '../../../src/lib/neural';
import { BAND, BLOCKS, inBand } from '../../../src/lib/reveal';

const focus = (w: number): Focus => ({
  x: w / 2,
  y: 420,
  halfWidth: Math.min(w * 0.88, 560) * 0.3,
});

describe('rng', () => {
  it('is deterministic per seed and stays in [0, 1)', () => {
    const a = rng(5);
    const b = rng(5);
    const seq = Array.from({ length: 50 }, () => a());
    expect(seq).toEqual(Array.from({ length: 50 }, () => b()));
    expect(seq.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(rng(6)()).not.toBe(rng(5)());
  });
});

describe('buildNetwork', () => {
  it.each([375, 768, 1440])('builds a connected network at %i px', (w) => {
    const net = buildNetwork(w, 900, focus(w));
    const per = layersFor(w);
    expect(net.nodes).toHaveLength(per.reduce((n, c) => n + c, 0) * 2);
    // Every outer node can reach the head by following edges.
    for (const start of net.outer) {
      let at = start;
      for (let hops = 0; hops < per.length + 1; hops++) {
        const options = net.out[at] ?? [];
        if (options.length === 0) break;
        at = net.edges[options[0] ?? 0]?.b ?? at;
      }
      expect(net.inner, `from ${start}`).toContain(at);
    }
  });

  it('mirrors the layers on both sides of the focus and narrows towards it', () => {
    const net = buildNetwork(1440, 900, focus(1440));
    const f = focus(1440);
    const outerX = net.outer.map((i) => Math.abs((net.nodes[i]?.x ?? 0) - f.x));
    const innerX = net.inner.map((i) => Math.abs((net.nodes[i]?.x ?? 0) - f.x));
    expect(Math.min(...outerX)).toBeGreaterThan(Math.max(...innerX));
    expect(net.outer.some((i) => (net.nodes[i]?.x ?? 0) < f.x)).toBe(true);
    expect(net.outer.some((i) => (net.nodes[i]?.x ?? 0) > f.x)).toBe(true);
  });

  it('keeps every node inside the canvas and clear of the portrait', () => {
    for (const w of [375, 1440]) {
      const f = focus(w);
      const net = buildNetwork(w, 900, f);
      for (const n of net.nodes) {
        expect(n.x).toBeGreaterThan(-20);
        expect(n.x).toBeLessThan(w + 20);
        expect(n.y).toBeGreaterThan(-20);
        expect(n.y).toBeLessThan(920);
        if (w >= 768) expect(Math.abs(n.x - f.x)).toBeGreaterThan(f.halfWidth);
      }
    }
  });

  it('is the same every time for the same size, so a resize does not reshuffle it', () => {
    const a = buildNetwork(1440, 900, focus(1440));
    const b = buildNetwork(1440, 900, focus(1440));
    expect(a.nodes.map((n) => [n.x, n.y])).toEqual(b.nodes.map((n) => [n.x, n.y]));
    expect(a.edges).toEqual(b.edges);
  });

  it('only sends edges inwards, so signals always move towards the portrait', () => {
    const net = buildNetwork(1440, 900, focus(1440));
    for (const e of net.edges)
      expect((net.nodes[e.b]?.layer ?? 0) - (net.nodes[e.a]?.layer ?? 0)).toBe(1);
  });
});

describe('nextEdge', () => {
  it('picks an onward edge, and returns null at the innermost layer', () => {
    const net = buildNetwork(1440, 900, focus(1440));
    const start = net.outer[0] ?? 0;
    const edge = nextEdge(net, start, rng(1));
    expect(net.out[start]).toContain(edge);
    expect(nextEdge(net, net.inner[0] ?? 0, rng(1))).toBeNull();
  });
});

describe('reveal band', () => {
  it('counts a box as in when any part is inside the band', () => {
    expect(inBand(100, 400, 900)).toBe(true);
    expect(inBand(950, 1200, 900)).toBe(false);
    expect(inBand(-300, 10, 900)).toBe(false);
    expect(inBand(-300, 900 * BAND + 1, 900)).toBe(true);
    expect(inBand(900 * (1 - BAND) - 1, 2000, 900)).toBe(true);
  });
  it('never targets the sticky, scroll-driven or table blocks', () => {
    const joined = BLOCKS.join(' ');
    expect(joined).not.toMatch(/work__split|exp__rail|hard__|index__table|index__scroll/);
  });
});
