// The 3D room's pure logic (task 2.4): Mumbai's day and night, the camera's easing, the layout table against content, quality
// tiers and the palette reader. The scene itself is checked in tests/e2e/room.spec.ts.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMERA_MOVE_S,
  cubicBezier,
  easeCam,
  stepTween,
  type Tween,
} from '../../../src/lib/workshop/camera-ease';
import { OVERVIEW, ZONE_SPOTS } from '../../../src/lib/workshop/layout';
import { mumbaiClock, mumbaiMinutes, mumbaiPhase } from '../../../src/lib/workshop/mumbai-time';
import { PALETTE_KEYS, SHARED_KEYS, paletteFrom } from '../../../src/lib/workshop/palette';
import { mumbaiClock as roomClock } from '../../../src/lib/workshop/room-clock';
import { TIERS, startingTier, tooWeak, type Device } from '../../../src/lib/workshop/quality';
import { resolveTheme } from '../../../src/lib/theme';

const utc = (h: number, m: number): Date => new Date(Date.UTC(2026, 9, 19, h, m));

describe('Mumbai time', () => {
  it('is UTC+5:30, wrapping past midnight', () => {
    expect(mumbaiClock(utc(0, 0))).toBe('05:30');
    expect(mumbaiClock(utc(12, 0))).toBe('17:30');
    expect(mumbaiClock(utc(18, 30))).toBe('00:00');
    expect(mumbaiClock(utc(20, 45))).toBe('02:15');
    expect(mumbaiMinutes(utc(23, 59))).toBe(5 * 60 + 29);
  });
  it('switches at 06:00 and 18:00 IST', () => {
    expect(mumbaiPhase(utc(0, 29))).toBe('night'); // 05:59
    expect(mumbaiPhase(utc(0, 30))).toBe('day'); // 06:00
    expect(mumbaiPhase(utc(12, 29))).toBe('day'); // 17:59
    expect(mumbaiPhase(utc(12, 30))).toBe('night'); // 18:00
    expect(mumbaiPhase(utc(18, 30))).toBe('night'); // midnight
  });
  it('drives the theme only in Auto, and only when the workshop asks', () => {
    expect(resolveTheme('auto', true, 'day')).toBe('day');
    expect(resolveTheme('auto', false, 'night')).toBe('night');
    expect(resolveTheme('auto', true)).toBe('night');
    expect(resolveTheme('day', false, 'night')).toBe('day');
  });
});

describe('camera easing', () => {
  it('matches --ease-cam at its ends and is monotonic', () => {
    expect(easeCam(0)).toBe(0);
    expect(easeCam(1)).toBe(1);
    expect(easeCam(0.5)).toBeCloseTo(0.5, 3);
    let last = 0;
    for (let i = 1; i <= 100; i++) {
      const v = easeCam(i / 100);
      expect(v).toBeGreaterThanOrEqual(last);
      last = v;
    }
  });
  it('is the identity for a linear curve', () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0.1, 0.37, 0.8]) expect(linear(t)).toBeCloseTo(t, 4);
  });
  it('moves a shot to its target in 1.6 s, or at once with duration 0', () => {
    const to = ZONE_SPOTS['holotable']?.shot;
    if (!to) throw new Error('no holotable shot');
    const tween: Tween = { from: OVERVIEW, to, elapsed: 0, duration: CAMERA_MOVE_S };
    expect(stepTween(tween, 0.8).done).toBe(false);
    const end = stepTween(tween, 0.8);
    expect(end.done).toBe(true);
    end.shot.position.forEach((v, i) => expect(v).toBeCloseTo(to.position[i] ?? NaN, 6));
    const cut = stepTween({ from: OVERVIEW, to, elapsed: 0, duration: 0 }, 0.016);
    expect(cut.done).toBe(true);
    cut.shot.target.forEach((v, i) => expect(v).toBeCloseTo(to.target[i] ?? NaN, 6));
  });
});

describe('layout', () => {
  const site = JSON.parse(readFileSync('content/site.json', 'utf8')) as {
    workshop: { zones: { id: string }[] };
  };
  it('has a marker and a camera shot for every zone in content/site.json, and no stray ones', () => {
    const ids = site.workshop.zones.map((z) => z.id).sort();
    expect(Object.keys(ZONE_SPOTS).sort()).toEqual(ids);
  });
  it('keeps every marker inside the room', () => {
    for (const [id, spot] of Object.entries(ZONE_SPOTS)) {
      const [x, y, z] = spot.marker;
      expect(Math.abs(x), id).toBeLessThanOrEqual(5);
      expect(Math.abs(z), id).toBeLessThanOrEqual(4.2);
      expect(y, id).toBeGreaterThan(0);
      expect(y, id).toBeLessThan(3.5);
    }
  });
});

describe('quality tiers', () => {
  const phone: Device = { coarsePointer: true, memoryGb: 4, cores: 8 };
  const desktop: Device = { coarsePointer: false, memoryGb: 8, cores: 8 };
  it('starts phones and modest machines low, strong desktops high', () => {
    expect(startingTier('auto', phone)).toBe('low');
    expect(startingTier('auto', desktop)).toBe('high');
    expect(startingTier('auto', { ...desktop, memoryGb: 4 })).toBe('low');
    expect(startingTier('auto', { ...desktop, cores: 4 })).toBe('low');
    expect(
      startingTier('auto', { coarsePointer: false, memoryGb: undefined, cores: undefined }),
    ).toBe('high');
  });
  it('lets Settings pin a tier', () => {
    expect(startingTier('high', phone)).toBe('high');
    expect(startingTier('low', desktop)).toBe('low');
  });
  it('turns 3D off only for very low memory, and the low tier is lighter in every respect', () => {
    expect(tooWeak({ ...desktop, memoryGb: 1 })).toBe(true);
    expect(tooWeak({ ...desktop, memoryGb: 2 })).toBe(false);
    expect(TIERS.low.dpr).toBeLessThan(TIERS.high.dpr);
    expect(TIERS.low.shadowMap).toBeLessThan(TIERS.high.shadowMap);
    expect(TIERS.low.post).toBe(false);
    expect(TIERS.low.rain).toBeLessThan(TIERS.high.rain);
  });
});

describe('palette reader', () => {
  it('reads every room and shared token, and falls back to grey for a missing one', () => {
    const palette = paletteFrom((name) => (name === '--room-floor' ? '' : '#ff0000'));
    for (const key of [...PALETTE_KEYS, ...SHARED_KEYS]) expect(palette[key]).toBeDefined();
    expect(palette.wall.r).toBeGreaterThan(0.9);
    expect(palette.floor.r).toBeCloseTo(0.5, 5);
    expect(palette.floor.g).toBeCloseTo(0.5, 5);
    expect(palette.floor.b).toBeCloseTo(0.5, 5);
  });
  it('has every --room token defined in both themes', () => {
    const css = readFileSync('src/styles/tokens.css', 'utf8');
    for (const key of PALETTE_KEYS) {
      const count = css.split(`--room-${key}:`).length - 1;
      expect(count, `--room-${key}`).toBe(2);
    }
  });
});

describe('the room clock', () => {
  it('reads the same as the site clock at any time of day', () => {
    for (let h = 0; h < 24; h++)
      for (const m of [0, 29, 30, 31, 59]) {
        const d = new Date(Date.UTC(2026, 9, 19, h, m));
        expect(roomClock(d)).toBe(mumbaiClock(d));
      }
  });
});
