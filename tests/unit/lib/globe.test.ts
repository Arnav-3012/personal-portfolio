import { describe, expect, it } from 'vitest';
import { BEATS, frameAt, isLand, landCells, project } from '../../../src/lib/globe';

const MUMBAI = { lat: 19.07, lon: 72.87 };

describe('the baked land mask', () => {
  it('has about the real share of land, in plenty of cells', () => {
    const cells = landCells();
    expect(cells.length).toBeGreaterThan(4000);
    expect(cells.length).toBeLessThan(5600);
    // 29% of the Earth's surface is land (by cell count, a little less because the grid is not equal-area).
    expect(cells.length / 16200).toBeGreaterThan(0.25);
    expect(cells.length / 16200).toBeLessThan(0.33);
  });
  it.each([
    ['Mumbai', 19.07, 72.87],
    ['Delhi', 28.6, 77.2],
    ['Cairo', 30.0, 31.2],
    ['Kansas', 38.5, -98.0],
    ['Amazon', -5, -60],
    ['Sydney area', -33, 148],
    ['Siberia', 62, 100],
    ['Antarctica', -80, 0],
  ])('%s is land', (_name, lat, lon) => expect(isLand(lat, lon)).toBe(true));
  it.each([
    ['mid Pacific', 0, -150],
    ['mid Atlantic', 10, -35],
    ['Arabian Sea off Mumbai', 15, 66],
    ['southern Indian Ocean', -40, 80],
    ['Arctic Ocean', 85, 0],
  ])('%s is sea', (_name, lat, lon) => expect(isLand(lat, lon)).toBe(false));
  it('wraps longitudes beyond ±180', () => {
    expect(isLand(19.07, 72.87 + 360)).toBe(true);
    expect(isLand(19.07, 72.87 - 360)).toBe(true);
  });
});

describe('project', () => {
  it('puts the centre point in the middle of the view, facing the viewer', () => {
    const p = project(MUMBAI, MUMBAI);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(0);
    expect(p.z).toBeCloseTo(1);
  });
  it('keeps every point on the unit sphere', () => {
    for (const lat of [-80, -30, 0, 45, 85])
      for (const lon of [-170, -60, 0, 90, 175]) {
        const p = project({ lat, lon }, MUMBAI);
        expect(Math.hypot(p.x, p.y, p.z)).toBeCloseTo(1);
      }
  });
  it('puts the far side behind (z < 0) and the east of the centre to the right', () => {
    expect(project({ lat: 19.07, lon: 72.87 + 180 }, MUMBAI).z).toBeLessThan(0);
    expect(project({ lat: 19.07, lon: 80 }, MUMBAI).x).toBeGreaterThan(0);
    expect(project({ lat: 19.07, lon: 60 }, MUMBAI).x).toBeLessThan(0);
    expect(project({ lat: 30, lon: 72.87 }, MUMBAI).y).toBeGreaterThan(0);
  });
});

describe('frameAt (the timeline)', () => {
  const at = (ms: number) => frameAt(ms, MUMBAI);

  it('starts clear and ends faded to the page colour, done', () => {
    expect(at(0).wash).toBe(0);
    expect(at(0).globeAlpha).toBe(0);
    expect(at(0).brainAlpha).toBe(1);
    const end = at(BEATS.total);
    expect(end.fade).toBe(1);
    expect(end.done).toBe(true);
    expect(at(BEATS.total - 1).done).toBe(false);
  });
  it('dives into the brain, then the brain gives way to the globe', () => {
    expect(at(1200).brainScale).toBeGreaterThan(at(600).brainScale);
    expect(at(600).brainScale).toBeGreaterThan(1);
    expect(at(2000).brainAlpha).toBe(0);
    expect(at(2500).globeAlpha).toBe(1);
    expect(at(1400).globeAlpha).toBeGreaterThan(0);
  });
  it('settles exactly on Mumbai before the pin drops, and stays there for the zoom', () => {
    for (const ms of [BEATS.turn[1], BEATS.pin[1], BEATS.zoom[0], BEATS.zoom[1], BEATS.total]) {
      const c = at(ms).centre;
      expect(c.lat).toBeCloseTo(MUMBAI.lat, 1);
      expect(c.lon).toBeCloseTo(MUMBAI.lon, 1);
    }
    expect(at(BEATS.pin[0] - 1).pin).toBe(0);
    expect(at(BEATS.pin[1]).pin).toBe(1);
  });
  it('spins in decelerating: the turn is faster at the start than at the end', () => {
    const early = Math.abs(at(1500).centre.lon - at(1400).centre.lon);
    const late = Math.abs(at(3400).centre.lon - at(3300).centre.lon);
    expect(early).toBeGreaterThan(late);
  });
  it('pulls the globe out to full view, then dives in towards Mumbai', () => {
    expect(at(2300).radius).toBeGreaterThan(0.6);
    expect(at(2300).radius).toBeLessThan(0.9);
    expect(at(BEATS.zoom[1]).radius).toBeGreaterThan(at(2300).radius * 5);
  });
  it('moves through the stages in order', () => {
    const order = [0, 900, 2500, 3500, 4200].map((ms) => at(ms).stage);
    expect(order).toEqual(['dive', 'dive', 'lock', 'point', 'enter']);
  });
  it('never goes backwards: wash, fade and brain travel only increase', () => {
    let prev = at(0);
    for (let ms = 50; ms <= BEATS.total; ms += 50) {
      const f = at(ms);
      expect(f.wash).toBeGreaterThanOrEqual(prev.wash);
      expect(f.fade).toBeGreaterThanOrEqual(prev.fade);
      expect(f.brainTravel).toBeGreaterThanOrEqual(prev.brainTravel);
      prev = f;
    }
  });
});
