// Walking (SPEC "Camera and navigation": optional free-roam, WASD to walk, E to interact). Pure functions: the keys give a
// wish direction relative to the camera, the figure accelerates towards it, and collision keeps it out of the walls and
// furniture. Click-to-walk steers to a floor point and stops on arrival, or at an obstacle.
import { resolve, type Bounds, type Vec2 } from './collision';
import type { Obstacle } from './layout';

export const WALK_SPEED = 1.9;
export const RUN_SPEED = 2.8;
/** How fast the velocity follows the wish (1/s): a quick start and stop without sliding about. */
export const RESPONSE = 12;
export const ARRIVE_DISTANCE = 0.12;

export interface Walker {
  x: number;
  z: number;
  vx: number;
  vz: number;
  /** Facing, radians: 0 looks along +z (towards the door), positive turns towards +x. */
  heading: number;
}

export interface Keys {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  run: boolean;
}

export const NO_KEYS: Readonly<Keys> = {
  forward: false,
  back: false,
  left: false,
  right: false,
  run: false,
};

const KEY_MAP: Record<string, keyof Keys> = {
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'run',
  ShiftRight: 'run',
};

/** The movement key a `KeyboardEvent.code` stands for, if any. */
export const keyFor = (code: string): keyof Keys | undefined => KEY_MAP[code];

/**
 * A unit wish direction on the floor from the held keys, turned by the camera's yaw (the heading the camera looks along), or
 * `[0, 0]` when nothing is held or opposite keys cancel.
 */
export function wishDirection(keys: Keys, cameraYaw: number): Vec2 {
  const f = Number(keys.forward) - Number(keys.back);
  const r = Number(keys.right) - Number(keys.left);
  if (f === 0 && r === 0) return [0, 0];
  const len = Math.hypot(f, r);
  const sin = Math.sin(cameraYaw);
  const cos = Math.cos(cameraYaw);
  // The camera looks along (sin yaw, cos yaw) on the floor; the screen's right-hand side is (-cos yaw, sin yaw).
  return [(f * sin - r * cos) / len, (f * cos + r * sin) / len];
}

/** The direction from the figure to a floor point, and how far. */
export function towards(w: Pick<Walker, 'x' | 'z'>, target: Vec2): { dir: Vec2; dist: number } {
  const dx = target[0] - w.x;
  const dz = target[1] - w.z;
  const dist = Math.hypot(dx, dz);
  return { dir: dist === 0 ? [0, 0] : [dx / dist, dz / dist], dist };
}

/** Shortest turn from `from` to `to`, in radians, within ±π. */
export const angleDiff = (from: number, to: number): number => {
  const d = (to - from + Math.PI) % (Math.PI * 2);
  return (d < 0 ? d + Math.PI * 2 : d) - Math.PI;
};

/** Advances the figure `dt` seconds. Returns its speed (m/s) afterwards, which drives the walk cycle. */
export function stepWalker(
  w: Walker,
  wish: Vec2,
  run: boolean,
  dt: number,
  obstacles: readonly Obstacle[],
  bounds: Bounds,
  radius: number,
): number {
  const top = run ? RUN_SPEED : WALK_SPEED;
  const k = 1 - Math.exp(-RESPONSE * dt);
  w.vx += (wish[0] * top - w.vx) * k;
  w.vz += (wish[1] * top - w.vz) * k;
  const [x, z] = resolve(w.x + w.vx * dt, w.z + w.vz * dt, radius, obstacles, bounds);
  // Whatever the wall took away is taken from the velocity too, so pushing into a wall does not wind speed up.
  const realVx = (x - w.x) / (dt || 1);
  const realVz = (z - w.z) / (dt || 1);
  w.vx = Math.abs(realVx) < Math.abs(w.vx) ? realVx : w.vx;
  w.vz = Math.abs(realVz) < Math.abs(w.vz) ? realVz : w.vz;
  w.x = x;
  w.z = z;
  const speed = Math.hypot(w.vx, w.vz);
  if (speed > 0.15)
    w.heading += angleDiff(w.heading, Math.atan2(w.vx, w.vz)) * (1 - Math.exp(-14 * dt));
  return speed;
}

/** First person: eye height, and how far the head may tip up and down (radians). */
export const EYE_HEIGHT = 1.62;
export const PITCH_MIN = -1.15;
export const PITCH_MAX = 1.0;
export const clampPitch = (pitch: number): number =>
  Math.min(PITCH_MAX, Math.max(PITCH_MIN, pitch));

/** The unit vector the eyes look along, from yaw (0 looks along +z) and pitch (positive looks up). */
export function lookVector(yaw: number, pitch: number): readonly [number, number, number] {
  const c = Math.cos(pitch);
  return [Math.sin(yaw) * c, Math.sin(pitch), Math.cos(yaw) * c];
}
