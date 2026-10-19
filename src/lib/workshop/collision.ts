// Collision for the walking figure: a circle on the floor plan against the room's walls and its furniture. A move is made
// first, then anything the circle overlaps pushes it back out along the shortest way, so walking into a wall or a corner
// slides along it instead of sticking. No physics engine: a flat room needs none.
import type { Obstacle, Rect } from './layout';

export type Vec2 = readonly [number, number];
export interface Bounds {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

/** Pushes a circle at (x, z) out of one rectangle. Returns the corrected centre. */
function outOfRect(x: number, z: number, r: number, rect: Rect): Vec2 {
  const cx = Math.min(rect.x1, Math.max(rect.x0, x));
  const cz = Math.min(rect.z1, Math.max(rect.z0, z));
  let dx = x - cx;
  let dz = z - cz;
  const dist = Math.hypot(dx, dz);
  if (dist >= r) return [x, z];
  if (dist === 0) {
    // The centre is inside the rectangle: leave by the nearest side.
    const gaps = [
      [x - rect.x0, -1, 0],
      [rect.x1 - x, 1, 0],
      [z - rect.z0, 0, -1],
      [rect.z1 - z, 0, 1],
    ] as const;
    const nearest = gaps.reduce((a, b) => (b[0] < a[0] ? b : a));
    return [x + nearest[1] * (nearest[0] + r), z + nearest[2] * (nearest[0] + r)];
  }
  dx /= dist;
  dz /= dist;
  return [cx + dx * r, cz + dz * r];
}

/** Moves a circle's centre so it lies inside `bounds` and clear of every obstacle. */
export function resolve(
  x: number,
  z: number,
  radius: number,
  obstacles: readonly Obstacle[],
  bounds: Bounds,
): Vec2 {
  let px = x;
  let pz = z;
  // A few passes, so that being pushed out of one obstacle into another settles.
  for (let pass = 0; pass < 4; pass++) {
    px = Math.min(bounds.x1 - radius, Math.max(bounds.x0 + radius, px));
    pz = Math.min(bounds.z1 - radius, Math.max(bounds.z0 + radius, pz));
    for (const o of obstacles) {
      if (o.kind === 'rect') {
        [px, pz] = outOfRect(px, pz, radius, o);
      } else {
        const dx = px - o.x;
        const dz = pz - o.z;
        const dist = Math.hypot(dx, dz);
        const min = o.r + radius;
        if (dist < min) {
          const nx = dist === 0 ? 1 : dx / dist;
          const nz = dist === 0 ? 0 : dz / dist;
          px = o.x + nx * min;
          pz = o.z + nz * min;
        }
      }
    }
  }
  return [px, pz];
}
