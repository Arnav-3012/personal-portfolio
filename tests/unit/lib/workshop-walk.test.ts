// Walking (task 2.4b): movement, collision and zone proximity are pure functions, so every rule is checked here.
import { describe, expect, it } from 'vitest';
import { resolve } from '../../../src/lib/workshop/collision';
import {
  AVATAR_RADIUS,
  AVATAR_START,
  OBSTACLES,
  TABLE,
  WALK_BOUNDS,
  ZONE_SPOTS,
  nearestZone,
  standSpot,
} from '../../../src/lib/workshop/layout';
import {
  NO_KEYS,
  RUN_SPEED,
  WALK_SPEED,
  angleDiff,
  clampPitch,
  keyFor,
  lookVector,
  PITCH_MAX,
  PITCH_MIN,
  stepWalker,
  towards,
  wishDirection,
  type Walker,
} from '../../../src/lib/workshop/movement';
import { isThemeShortcut } from '../../../src/lib/theme';

const fresh = (): Walker => ({
  x: AVATAR_START[0],
  z: AVATAR_START[1],
  vx: 0,
  vz: 0,
  heading: Math.PI,
});
const run = (
  w: Walker,
  wish: readonly [number, number],
  seconds: number,
  running = false,
): number => {
  let speed = 0;
  for (let t = 0; t < seconds; t += 1 / 60)
    speed = stepWalker(w, wish, running, 1 / 60, OBSTACLES, WALK_BOUNDS, AVATAR_RADIUS);
  return speed;
};

describe('keys and wish direction', () => {
  it('maps WASD and the arrow keys, and Shift to running', () => {
    expect(keyFor('KeyW')).toBe('forward');
    expect(keyFor('ArrowLeft')).toBe('left');
    expect(keyFor('ShiftLeft')).toBe('run');
    expect(keyFor('KeyQ')).toBeUndefined();
  });
  it('walks away from the camera for W, whichever way it looks', () => {
    const [x, z] = wishDirection({ ...NO_KEYS, forward: true }, Math.PI);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-1, 6);
    const [x2, z2] = wishDirection({ ...NO_KEYS, forward: true }, Math.PI / 2);
    expect(x2).toBeCloseTo(1, 6);
    expect(z2).toBeCloseTo(0, 6);
  });
  it("turns D to the screen's right, and normalises diagonals", () => {
    const [x, z] = wishDirection({ ...NO_KEYS, right: true }, Math.PI);
    expect(x).toBeCloseTo(1, 6);
    expect(z).toBeCloseTo(0, 6);
    const [dx, dz] = wishDirection({ ...NO_KEYS, forward: true, right: true }, 0);
    expect(Math.hypot(dx, dz)).toBeCloseTo(1, 6);
  });
  it('stands still with no keys, or opposite keys', () => {
    expect(wishDirection(NO_KEYS, 1)).toEqual([0, 0]);
    expect(wishDirection({ ...NO_KEYS, forward: true, back: true }, 1)).toEqual([0, 0]);
  });
});

describe('first-person look', () => {
  it('looks along +z at yaw 0 and along -z at yaw π, level at pitch 0', () => {
    const [x, y, z] = lookVector(0, 0);
    expect([x, y, z].map((v) => Math.round(v * 1e6) / 1e6)).toEqual([0, 0, 1]);
    const [x2, , z2] = lookVector(Math.PI, 0);
    expect(x2).toBeCloseTo(0, 6);
    expect(z2).toBeCloseTo(-1, 6);
  });
  it('tips up and down, stays a unit vector, and cannot flip over', () => {
    const [, up] = lookVector(1, 0.5);
    const [, down] = lookVector(1, -0.5);
    expect(up).toBeGreaterThan(0);
    expect(down).toBeLessThan(0);
    expect(Math.hypot(...lookVector(2, 0.7))).toBeCloseTo(1, 6);
    expect(clampPitch(5)).toBe(PITCH_MAX);
    expect(clampPitch(-5)).toBe(PITCH_MIN);
    expect(PITCH_MAX).toBeLessThan(Math.PI / 2);
  });
});

describe('moving', () => {
  it('speeds up to walking pace and to running pace, and stops again', () => {
    const w = fresh();
    expect(run(w, [1, 0], 1)).toBeCloseTo(WALK_SPEED, 1);
    expect(run(w, [1, 0], 1, true)).toBeGreaterThan(WALK_SPEED);
    expect(run(w, [1, 0], 0.01, true)).toBeLessThanOrEqual(RUN_SPEED + 0.01);
    expect(run(w, [0, 0], 1)).toBeLessThan(0.05);
  });
  it('turns to face the way it goes by the short way round', () => {
    const w = fresh();
    run(w, [1, 0], 1);
    expect(w.heading).toBeCloseTo(Math.PI / 2, 1);
    expect(angleDiff(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2, 6);
  });
  it('points from the figure to a target', () => {
    const { dir, dist } = towards({ x: 0, z: 0 }, [3, 4]);
    expect(dist).toBeCloseTo(5, 6);
    expect(dir[0]).toBeCloseTo(0.6, 6);
    expect(dir[1]).toBeCloseTo(0.8, 6);
  });
});

const clearOfAll = (x: number, z: number): boolean =>
  OBSTACLES.every((o) => {
    if (o.kind === 'disc') return Math.hypot(x - o.x, z - o.z) >= o.r + AVATAR_RADIUS - 1e-6;
    const cx = Math.min(o.x1, Math.max(o.x0, x));
    const cz = Math.min(o.z1, Math.max(o.z0, z));
    return Math.hypot(x - cx, z - cz) >= AVATAR_RADIUS - 1e-6;
  });

describe('collision', () => {
  it('keeps the figure inside the walls', () => {
    const w = fresh();
    run(w, [0, 1], 4);
    expect(w.z).toBeLessThanOrEqual(WALK_BOUNDS.z1 - AVATAR_RADIUS + 1e-9);
    run(w, [-1, 0], 8);
    expect(w.x).toBeGreaterThanOrEqual(WALK_BOUNDS.x0 + AVATAR_RADIUS - 1e-9);
  });
  it('cannot walk through the holotable, and slides round it', () => {
    const w: Walker = { x: 0, z: 2.4, vx: 0, vz: 0, heading: Math.PI };
    run(w, [0, -1], 3);
    expect(w.z).toBeGreaterThanOrEqual(TABLE.z + TABLE.depth / 2 + AVATAR_RADIUS - 0.06);
    // Pushing at an angle slides along the rim instead of sticking
    const s: Walker = { x: 0.3, z: 2.4, vx: 0, vz: 0, heading: Math.PI };
    run(s, [0.4, -1], 3);
    expect(Math.abs(s.x - 0.3)).toBeGreaterThan(0.2);
  });
  it('pushes a circle out of a rectangle and out of a disc, from inside too', () => {
    const [x, z] = resolve(-3.1, 3.45, 0.26, OBSTACLES, WALK_BOUNDS); // inside the sofa
    expect(clearOfAll(x, z)).toBe(true);
    const [dx, dz] = resolve(0, TABLE.z, 0.26, OBSTACLES, WALK_BOUNDS); // the table's centre
    expect(Math.max(Math.abs(dx), Math.abs(dz - TABLE.z))).toBeGreaterThanOrEqual(0.6);
  });
  it('starts the figure on free floor', () => {
    const [x, z] = resolve(AVATAR_START[0], AVATAR_START[1], AVATAR_RADIUS, OBSTACLES, WALK_BOUNDS);
    expect(x).toBeCloseTo(AVATAR_START[0], 6);
    expect(z).toBeCloseTo(AVATAR_START[1], 6);
  });
});

describe('zones within reach', () => {
  it('places every stand spot on free floor inside the room', () => {
    for (const [id, spot] of Object.entries(ZONE_SPOTS)) {
      const [sx, sz] = standSpot(spot);
      expect(sx, id).toBeGreaterThan(WALK_BOUNDS.x0);
      expect(sx, id).toBeLessThan(WALK_BOUNDS.x1);
      expect(sz, id).toBeGreaterThan(WALK_BOUNDS.z0);
      expect(sz, id).toBeLessThan(WALK_BOUNDS.z1);
    }
  });
  it('finds the zone beside the figure, and none in the open', () => {
    const desk = ZONE_SPOTS['notebook'];
    if (!desk) throw new Error('no notebook zone');
    const [sx, sz] = standSpot(desk);
    expect(nearestZone(sx, sz)).toBe('notebook');
    expect(nearestZone(0.2, 2.9, 0.3)).toBeNull();
  });
});

describe('theme key while walking', () => {
  const key = (init: { key: string; shiftKey?: boolean }): KeyboardEvent =>
    ({
      shiftKey: false,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      repeat: false,
      target: null,
      ...init,
    }) as KeyboardEvent;
  it('is D normally, and Shift+D while walking, never D alone then', () => {
    expect(isThemeShortcut(key({ key: 'd' }))).toBe(true);
    expect(isThemeShortcut(key({ key: 'D', shiftKey: true }))).toBe(false);
    expect(isThemeShortcut(key({ key: 'd' }), true)).toBe(false);
    expect(isThemeShortcut(key({ key: 'D', shiftKey: true }), true)).toBe(true);
  });
});
