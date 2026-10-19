// Small geometry helpers for the room's architecture. Every piece of the shell is a box placed in world space; boxes
// that share a material are merged into one mesh (one draw call), and their UVs are scaled to metres so a texture
// repeats every `TILE` metres whatever the size of the piece.
import { BoxGeometry, CylinderGeometry, type BufferGeometry } from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TILE = 2.4;

const scaleUv = (g: BufferGeometry, faces: readonly (readonly [number, number])[]): void => {
  const uv = g.getAttribute('uv');
  for (let face = 0; face < 6; face++) {
    const [a, b] = faces[face] ?? [1, 1];
    for (let v = 0; v < 4; v++) {
      const i = face * 4 + v;
      uv.setXY(i, (uv.getX(i) * a) / TILE, (uv.getY(i) * b) / TILE);
    }
  }
};

/** A box of size w × h × d centred at (x, y, z), with metre-scaled UVs. */
export function box(
  w: number,
  h: number,
  d: number,
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  // BoxGeometry face order: +x, -x, +y, -y, +z, -z.
  scaleUv(g, [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ]);
  g.translate(x, y, z);
  return g;
}

/** A cylinder along the x, y or z axis. */
export function pipe(
  radius: number,
  length: number,
  axis: 'x' | 'y' | 'z',
  x: number,
  y: number,
  z: number,
): BufferGeometry {
  const g = new CylinderGeometry(radius, radius, length, 24, 1);
  if (axis === 'x') g.rotateZ(Math.PI / 2);
  else if (axis === 'z') g.rotateX(Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

export function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts.map((p) => p.toNonIndexed()));
  for (const p of parts) p.dispose();
  return merged;
}
