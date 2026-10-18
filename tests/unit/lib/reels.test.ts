import { describe, expect, it } from 'vitest';
import { discipline } from '../../../src/lib/content';
import {
  AMBIENT_MAX,
  CARD_LAYOUTS,
  TOTAL_DAYS,
  bufferedRatio,
  cardLayout,
  loadingDay,
  orbitPose,
  playerMarkup,
  pinProgress,
  poseTransform,
  proximityGain,
  ringRadii,
  reelCaption,
  separation,
  stepIndex,
  swipeDirection,
} from '../../../src/lib/reels';

const ranges = (...spans: [number, number][]) => ({
  length: spans.length,
  start: (i: number) => spans[i]?.[0] ?? 0,
  end: (i: number) => spans[i]?.[1] ?? 0,
});

describe('reelCaption', () => {
  it('reads "Day N · caption"', () => {
    expect(reelCaption({ day: 4, caption: 'Said no to the fries' })).toBe(
      'Day 4 · Said no to the fries',
    );
  });

  it('works for every real reel', () => {
    for (const r of discipline.reels) expect(reelCaption(r)).toBe(`Day ${r.day} · ${r.caption}`);
  });
});

describe('stepIndex', () => {
  it('moves and wraps at both ends', () => {
    expect(stepIndex(0, 1, 5)).toBe(1);
    expect(stepIndex(4, 1, 5)).toBe(0);
    expect(stepIndex(0, -1, 5)).toBe(4);
    expect(stepIndex(0, 1, 1)).toBe(0);
  });
});

describe('swipeDirection', () => {
  it('drag left is next, drag right is previous', () => {
    expect(swipeDirection(-80, 5)).toBe(1);
    expect(swipeDirection(80, -5)).toBe(-1);
  });

  it('ignores short drags and mostly-vertical ones', () => {
    expect(swipeDirection(-49, 0)).toBeNull();
    expect(swipeDirection(-60, 80)).toBeNull();
    expect(swipeDirection(0, 0)).toBeNull();
  });
});

describe('card layouts', () => {
  it('has a preset for every real reel, all inside the stage and not identical', () => {
    expect(CARD_LAYOUTS.length).toBeGreaterThanOrEqual(discipline.reels.length);
    for (const l of CARD_LAYOUTS) {
      expect(l.left).toBeGreaterThanOrEqual(0);
      expect(l.left).toBeLessThanOrEqual(85);
      expect(l.top).toBeGreaterThanOrEqual(0);
      expect(l.top).toBeLessThanOrEqual(80);
    }
    expect(new Set(CARD_LAYOUTS.map((l) => `${l.rx}/${l.ry}/${l.rz}`)).size).toBe(
      CARD_LAYOUTS.length,
    );
  });

  it('wraps if there are more reels than presets', () => {
    expect(cardLayout(CARD_LAYOUTS.length)).toBe(CARD_LAYOUTS[0]);
  });
});

describe('pinProgress', () => {
  it('runs 0 to 1 over the pinned distance', () => {
    expect(pinProgress(0, 2000, 1000)).toBe(0);
    expect(pinProgress(-500, 2000, 1000)).toBeCloseTo(0.5);
    expect(pinProgress(-1000, 2000, 1000)).toBe(1);
    expect(pinProgress(300, 2000, 1000)).toBe(0);
    expect(pinProgress(-5000, 2000, 1000)).toBe(1);
  });

  it('is 0 when there is nothing to pin', () => {
    expect(pinProgress(0, 800, 1000)).toBe(0);
  });
});

describe('separation', () => {
  it('stays gathered at the start, opens in the middle and is fully open well before the end', () => {
    expect(separation(0)).toBe(0);
    expect(separation(0.15)).toBe(0);
    expect(separation(0.4)).toBeGreaterThan(0.3);
    expect(separation(0.4)).toBeLessThan(0.7);
    expect(separation(0.65)).toBe(1);
    expect(separation(1)).toBe(1);
  });

  it('never goes backwards as the visitor scrolls', () => {
    let prev = 0;
    for (let p = 0; p <= 1; p += 0.02) {
      const s = separation(p);
      expect(s).toBeGreaterThanOrEqual(prev);
      prev = s;
    }
  });
});

describe('orbitPose', () => {
  const stage = { w: 1440, h: 900, cardW: 180 };
  const n = 5;
  const pose = (i: number, angle: number, sep: number, hover = 0) =>
    orbitPose(i, n, angle, sep, cardLayout(i), stage, hover);
  /** Where the card's centre ends up on the stage. */
  const centre = (i: number, angle: number, sep: number) => {
    const home = cardLayout(i);
    const p = pose(i, angle, sep);
    return {
      x: (home.left / 100) * stage.w + stage.cardW / 2 + p.x,
      y: (home.top / 100) * stage.h + (stage.cardW * 16) / 9 / 2 + p.y,
    };
  };

  it('gathered: every card sits on an ellipse round the stage centre, evenly spaced round it', () => {
    const angle = 0.7;
    const thetas = Array.from({ length: n }, (_, i) => {
      const c = centre(i, angle, 0);
      const radii = ringRadii(stage);
      const dx = (c.x - stage.w / 2) / radii.x;
      const dy = (c.y - stage.h / 2) / radii.y;
      expect(dx * dx + dy * dy).toBeCloseTo(1, 6);
      return Math.atan2(dx, dy);
    });
    for (let i = 0; i < n; i++) {
      const gap = (thetas[(i + 1) % n] ?? 0) - (thetas[i] ?? 0);
      expect(((gap % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)).toBeCloseTo(
        (2 * Math.PI) / n,
        6,
      );
    }
  });

  it('gathered: the front of the ring is lower, larger and brighter than the back, which sits behind the headline', () => {
    // Card 0 at angle 0 faces front (cos = 1); at angle π it is at the back.
    const front = pose(0, 0, 0);
    const back = pose(0, Math.PI, 0);
    expect(front.y).toBeGreaterThan(back.y);
    expect(front.scale).toBeGreaterThan(back.scale);
    expect(front.opacity).toBeGreaterThan(back.opacity);
    expect(front.layer).toBe(2);
    expect(back.layer).toBe(0);
    expect(front.scale).toBeCloseTo(1);
    expect(back.scale).toBeCloseTo(0.6);
  });

  it('revolving moves the cards but keeps them on the ring', () => {
    const a = centre(1, 0, 0);
    const b = centre(1, 1, 0);
    expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(50);
  });

  it('open: every card is exactly at its resting spot, tilt and size, whatever the angle', () => {
    for (let i = 0; i < n; i++)
      for (const angle of [0, 1.3, 4]) {
        const p = pose(i, angle, 1);
        const home = cardLayout(i);
        expect(p.x).toBeCloseTo(0);
        expect(p.y).toBeCloseTo(0);
        expect(p.scale).toBe(1);
        expect(p.opacity).toBe(1);
        expect([p.rx, p.ry, p.rz]).toEqual([home.rx, home.ry, home.rz]);
        expect(p.layer).toBe(2);
      }
  });

  it('opening moves each card monotonically from the ring to its spot', () => {
    for (let i = 0; i < n; i++) {
      const ring = Math.hypot(pose(i, 0.4, 0).x, pose(i, 0.4, 0).y);
      let prev = ring;
      for (const s of [0.25, 0.5, 0.75, 1]) {
        const d = Math.hypot(pose(i, 0.4, s).x, pose(i, 0.4, s).y);
        expect(d).toBeLessThanOrEqual(prev + 1e-9);
        prev = d;
      }
    }
  });

  it('hover straightens the card, scales it 4% and brings it fully forward', () => {
    const base = pose(2, 2, 1);
    const hovered = pose(2, 2, 1, 1);
    for (const angle of [hovered.rx, hovered.ry, hovered.rz]) expect(angle).toBeCloseTo(0);
    expect(hovered.scale).toBeCloseTo(base.scale * 1.04);
    expect(hovered.layer).toBe(3);
    const backCard = pose(0, Math.PI, 0);
    const backHovered = pose(0, Math.PI, 0, 1);
    expect(backHovered.opacity).toBe(1);
    expect(backHovered.opacity).toBeGreaterThan(backCard.opacity);
  });

  it('writes a transform with perspective, translate, three rotations and a scale', () => {
    const t = poseTransform(pose(0, 0, 0));
    expect(t).toMatch(
      /^perspective\(1200px\) translate3d\(.+px, .+px, 0\) rotateX\(.+deg\) rotateY\(.+deg\) rotateZ\(.+deg\) scale\(.+\)$/,
    );
  });
});

describe('proximityGain', () => {
  const vh = 1000;
  const height = 2200;

  it('is silent while the section is a viewport or more away', () => {
    expect(proximityGain(vh, height, vh)).toBe(0);
    expect(proximityGain(vh * 2, height, vh)).toBe(0);
    expect(proximityGain(-(height + vh), height, vh)).toBe(0);
  });

  it('fades in as the section enters and reaches the maximum', () => {
    const quarter = proximityGain(vh - 0.25 * vh, height, vh);
    const half = proximityGain(vh - 0.5 * vh, height, vh);
    expect(quarter).toBeGreaterThan(0);
    expect(half).toBeGreaterThan(quarter);
    expect(proximityGain(0, height, vh)).toBeCloseTo(AMBIENT_MAX);
  });

  it('holds while the section fills the screen and fades out on exit', () => {
    expect(proximityGain(-height / 2 + vh / 2, height, vh)).toBeCloseTo(AMBIENT_MAX);
    const leaving = proximityGain(-height + 0.5 * vh, height, vh);
    expect(leaving).toBeGreaterThan(0);
    expect(leaving).toBeLessThan(AMBIENT_MAX);
  });

  it('never exceeds the maximum and respects a custom one', () => {
    for (let top = -3000; top <= 2000; top += 100)
      expect(proximityGain(top, height, vh)).toBeLessThanOrEqual(AMBIENT_MAX);
    expect(proximityGain(0, height, vh, 0.1)).toBeCloseTo(0.1);
  });
});

describe('bufferedRatio and loadingDay', () => {
  it('measures the range that contains the playhead', () => {
    expect(bufferedRatio(ranges([0, 10]), 0, 40)).toBe(0.25);
    expect(bufferedRatio(ranges([0, 5], [20, 30]), 22, 40)).toBe(0.75);
  });

  it('is 0 with nothing buffered at the playhead, or with no duration yet', () => {
    expect(bufferedRatio(ranges(), 0, 40)).toBe(0);
    expect(bufferedRatio(ranges([10, 20]), 0, 40)).toBe(0);
    expect(bufferedRatio(ranges([0, 10]), 0, Number.NaN)).toBe(0);
    expect(bufferedRatio(ranges([0, 10]), 0, 0)).toBe(0);
  });

  it('caps at 1', () => {
    expect(bufferedRatio(ranges([0, 50]), 0, 40)).toBe(1);
  });

  it('ticks days 1 to 75 with the load', () => {
    expect(loadingDay(0)).toBe(1);
    expect(loadingDay(0.001)).toBe(1);
    expect(loadingDay(0.55)).toBe(42);
    expect(loadingDay(1)).toBe(TOTAL_DAYS);
    expect(loadingDay(2)).toBe(TOTAL_DAYS);
  });
});

describe('playerMarkup', () => {
  // The hooks initReels reads with get('…') and the frame it closes on; a typo here throws on page load.
  const hooks = [
    'frame',
    'stage',
    'video',
    'load',
    'load-label',
    'status',
    'play',
    'mute',
    'prev',
    'next',
    'close',
  ];

  it('carries every data-player hook the wiring needs, once', () => {
    const html = playerMarkup();
    for (const hook of hooks)
      expect(html.match(new RegExp(`data-player-${hook}(?=[\\s>])`, 'g')), hook).toHaveLength(1);
    expect(html.match(/<dialog /g)).toHaveLength(1);
  });

  it('keeps the video, buttons and status accessible', () => {
    const html = playerMarkup();
    expect(html).toContain('aria-label="Reel player"');
    expect(html).toContain('aria-label="Reel video"');
    for (const label of ['Previous reel', 'Next reel', 'Pause', 'Mute', 'Close player'])
      expect(html).toContain(`aria-label="${label}"`);
    expect(html).toContain('aria-live="polite"');
  });

  it('draws seven decorative icons that screen readers skip', () => {
    const html = playerMarkup();
    expect(html.match(/<svg /g)).toHaveLength(7);
    expect(html.match(/aria-hidden="true" focusable="false"/g)).toHaveLength(7);
  });
});
