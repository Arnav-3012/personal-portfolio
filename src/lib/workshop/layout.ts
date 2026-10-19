// The room's one layout table (metres, y up). A cosy workshop-studio: 10 m wide (x), 8.4 m deep (z), 3.5 m high. The
// window is on the back wall (z = -4.2), the door in the front wall (z = +4.2) at x = -1, the armour wall on the left
// (x = -5), the whiteboard and the discipline wall on the right. Props go where each zone's marker is; for now a marker
// and a camera shot show where each will live. Zone titles and blurbs are content (content/site.json), not here.
import type { Shot, Vec3 } from './camera-ease';

export const ROOM = { width: 10, depth: 8.4, height: 3.5 } as const;
export const WINDOW = { width: 3.4, bottom: 0.9, top: 2.7 } as const;
export const DOOR = { x: -1, width: 1.1, height: 2.2 } as const;
/** The holotable: a low, wide slab at the exact centre of the room, on the middle of the rug; `height` is its top, `width` runs along x. */
export const TABLE = { x: 0, z: 0, height: 0.78, width: 2.4, depth: 1.2 } as const;

/** Soft light sources (x, y, z): two paper pendants, an arc floor lamp over the sofa, the desk lamp. */
export const LIGHTS = {
  pendants: [
    [-2.7, 2.55, -0.7],
    [2.7, 2.55, -0.9],
  ],
  floorLamp: { base: [-1.8, 0, 3.55], shade: [-2.75, 1.62, 3.4] },
  deskLamp: [4.78, 1.02, -4.0],
} as const;

/** Dead centre on the room's long axis, so the window, table and rug sit square in the frame. */
export const OVERVIEW: Shot = { position: [0, 1.9, 3.9], target: [0, 0.95, -2.2] };

export interface ZoneSpot {
  /** Where the marker sits (and where the prop will). */
  marker: Vec3;
  shot: Shot;
}

export const ZONE_SPOTS: Readonly<Record<string, ZoneSpot>> = {
  holotable: { marker: [0, 1.2, 0], shot: { position: [0, 1.5, 2.1], target: [0, 0.95, 0] } },
  window: { marker: [0, 2.15, -4.1], shot: { position: [0, 1.6, -0.5], target: [0, 1.8, -4.2] } },
  'armor-wall': {
    marker: [-4.7, 1.45, -0.5],
    shot: { position: [-1.6, 1.55, -0.5], target: [-5, 1.4, -0.5] },
  },
  whiteboard: {
    marker: [4.75, 1.7, -1.5],
    shot: { position: [1.7, 1.6, -1.5], target: [5, 1.65, -1.5] },
  },
  'retro-tv': {
    marker: [-4.1, 0.85, 3.45],
    shot: { position: [-1.2, 1.5, 1.1], target: [-4.2, 0.7, 3.6] },
  },
  transformer: {
    marker: [-4.2, 1.3, -3.5],
    shot: { position: [-1.4, 1.7, -0.5], target: [-4.3, 1.1, -3.8] },
  },
  notebook: {
    marker: [4.0, 0.95, -3.5],
    shot: { position: [1.7, 1.6, -0.5], target: [4.0, 0.85, -3.8] },
  },
  chalkboard: {
    marker: [2.9, 1.5, 4.05],
    shot: { position: [2.1, 1.6, 1.0], target: [2.9, 1.5, 4.2] },
  },
  'server-rack': {
    marker: [2.6, 1.05, 0.9],
    shot: { position: [0.6, 1.5, 3.0], target: [2.6, 1.0, 0.9] },
  },
  'cricket-shelf': {
    marker: [2.7, 1.75, -3.95],
    shot: { position: [1.4, 1.6, -0.9], target: [2.7, 1.4, -4.1] },
  },
  'discipline-wall': {
    marker: [4.75, 1.7, 1.9],
    shot: { position: [1.7, 1.6, 1.9], target: [5, 1.7, 1.9] },
  },
  'neon-sign': {
    marker: [-1, 2.85, 4.05],
    shot: { position: [-1, 1.5, 1.5], target: [-1, 1.9, 4.3] },
  },
};

/* ------------------------------ walking (free-roam) ------------------------------ */

export interface Rect {
  kind: 'rect';
  id: string;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}
export interface Disc {
  kind: 'disc';
  id: string;
  x: number;
  z: number;
  r: number;
}
export type Obstacle = Rect | Disc;

/** What the walking figure cannot step through, on the floor plan (metres). Things hung above head height are left out. */
export const OBSTACLES: readonly Obstacle[] = [
  {
    kind: 'rect',
    id: 'holotable',
    x0: TABLE.x - TABLE.width / 2 - 0.05,
    x1: TABLE.x + TABLE.width / 2 + 0.05,
    z0: TABLE.z - TABLE.depth / 2 - 0.05,
    z1: TABLE.z + TABLE.depth / 2 + 0.05,
  },
  { kind: 'rect', id: 'desk', x0: 3.15, x1: 4.95, z0: -4.2, z1: -3.4 },
  { kind: 'rect', id: 'chair', x0: 3.7, x1: 4.4, z0: -3.3, z1: -2.6 },
  { kind: 'rect', id: 'sofa', x0: -4.12, x1: -2.08, z0: 2.97, z1: 3.93 },
  { kind: 'disc', id: 'coffee-table', x: -2.6, z: 2.15, r: 0.46 },
  { kind: 'rect', id: 'niches', x0: -5, x1: -4.66, z0: -2.55, z1: 1.0 },
  { kind: 'disc', id: 'rubber-plant', x: -4.55, z: 3.3, r: 0.26 },
  { kind: 'disc', id: 'snake-plant', x: 2.05, z: -3.8, r: 0.2 },
  { kind: 'disc', id: 'basket', x: -4.55, z: 2.1, r: 0.3 },
  {
    kind: 'rect',
    id: 'console',
    x0: 0.32,
    x1: 1.48,
    z0: ROOM.depth / 2 - 0.34,
    z1: ROOM.depth / 2,
  },
  { kind: 'rect', id: 'shoe-tray', x0: -2.75, x1: -1.95, z0: 3.75, z1: 4.05 },
  {
    kind: 'disc',
    id: 'floor-lamp',
    x: LIGHTS.floorLamp.base[0],
    z: LIGHTS.floorLamp.base[2],
    r: 0.2,
  },
];

/** Where the figure may walk: inside the walls, and not in the doorway (the corridor is scenery). */
export const WALK_BOUNDS = {
  x0: -ROOM.width / 2,
  x1: ROOM.width / 2,
  z0: -ROOM.depth / 2,
  z1: ROOM.depth / 2,
} as const;
export const AVATAR_RADIUS = 0.26;
export const AVATAR_START: readonly [number, number] = [-1.3, 1.5];

/** A spot to stand at to use a zone: 1.2 m in front of its marker, towards where the camera looks from. */
export function standSpot(spot: ZoneSpot): readonly [number, number] {
  const [mx, , mz] = spot.marker;
  const [cx, , cz] = spot.shot.position;
  const dx = cx - mx;
  const dz = cz - mz;
  const len = Math.hypot(dx, dz) || 1;
  const x = mx + (dx / len) * 1.2;
  const z = mz + (dz / len) * 1.2;
  return [
    Math.min(WALK_BOUNDS.x1 - 0.4, Math.max(WALK_BOUNDS.x0 + 0.4, x)),
    Math.min(WALK_BOUNDS.z1 - 0.4, Math.max(WALK_BOUNDS.z0 + 0.4, z)),
  ];
}

/** The zone whose stand spot is nearest to (x, z), if within `reach` metres. */
export function nearestZone(x: number, z: number, reach = 1.5): string | null {
  let best: string | null = null;
  let bestDist = reach;
  for (const [id, spot] of Object.entries(ZONE_SPOTS)) {
    const [mx, , mz] = spot.marker;
    const d = Math.min(
      Math.hypot(mx - x, mz - z),
      Math.hypot(standSpot(spot)[0] - x, standSpot(spot)[1] - z),
    );
    if (d < bestDist) {
      bestDist = d;
      best = id;
    }
  }
  return best;
}
