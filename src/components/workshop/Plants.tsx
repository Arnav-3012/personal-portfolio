// Plants for the room, drawn in code (the free plant models arrived as cut-out leaves without stems, which sorted badly and
// floated). Each plant is one merged leaf mesh with real stems, in a plain pot, so it is two or three draw calls, casts a
// soft shadow, and takes its colour from the room tokens. Three kinds: a tall rubber plant, an upright snake plant and a
// small succulent rosette.
import { useMemo } from 'react';
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  DoubleSide,
  Euler,
  Float32BufferAttribute,
  Matrix4,
  MeshStandardMaterial,
  Quaternion,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mixColour } from '../../lib/workshop/palette';
import { seeded } from '../../lib/workshop/textures';
import { useBlend, useRoom } from './context';

type V3 = readonly [number, number, number];
export type PlantKind = 'rubber' | 'snake' | 'succulent';

/** One leaf along +y: tapered at both ends, bent over by `curl`, with a centre crease. */
function leafGeometry(length: number, width: number, curl: number, segments = 8): BufferGeometry {
  const positions: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const w = width * Math.sin(Math.PI * Math.min(0.98, 0.04 + t * 0.94)) ** 0.75;
    const y = t * length;
    const z = curl * t * t * length;
    const crease = w * 0.12;
    positions.push(-w / 2, y, z + crease, 0, y, z, w / 2, y, z + crease);
  }
  for (let i = 0; i < segments; i++) {
    const a = i * 3;
    const b = a + 3;
    indices.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

interface LeafSpec {
  /** Where its base sits, its heading round the stem, its tilt out from vertical and its scale. */
  at: V3;
  yaw: number;
  tilt: number;
  scale: number;
}

function build(
  kind: PlantKind,
  seed: number,
): { leaves: BufferGeometry; stems: BufferGeometry | null } {
  const rand = seeded(seed);
  const specs: LeafSpec[] = [];
  const stems: BufferGeometry[] = [];
  let base: BufferGeometry;
  if (kind === 'rubber') {
    base = leafGeometry(0.3, 0.17, 0.3);
    const stem = new CylinderGeometry(0.01, 0.016, 0.95, 8);
    stem.translate(0, 0.475, 0);
    stems.push(stem);
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      specs.push({
        at: [0, 0.28 + t * 0.68, 0],
        yaw: i * 2.39996 + rand() * 0.3,
        tilt: 1.05 - t * 0.45 + rand() * 0.15,
        scale: 1.05 - t * 0.35 + rand() * 0.12,
      });
    }
  } else if (kind === 'snake') {
    base = leafGeometry(0.75, 0.085, 0.05, 10);
    for (let i = 0; i < 11; i++) {
      const ring = i < 5 ? 0 : 1;
      specs.push({
        at: [Math.cos(i * 1.9) * 0.02 * (ring + 1), 0, Math.sin(i * 1.9) * 0.02 * (ring + 1)],
        yaw: i * 2.1 + rand() * 0.2,
        tilt: 0.08 + rand() * 0.2 + ring * 0.12,
        scale: 1.0 - ring * 0.28 - rand() * 0.15,
      });
    }
  } else {
    base = leafGeometry(0.075, 0.045, 0.35, 5);
    for (let i = 0; i < 18; i++) {
      const t = i / 17;
      specs.push({ at: [0, 0, 0], yaw: i * 2.39996, tilt: 1.35 - t * 1.0, scale: 0.7 + t * 0.4 });
    }
  }
  const parts = specs.map((s) => {
    const g = base.clone();
    const m = new Matrix4().compose(
      new Vector3(...s.at),
      new Quaternion().setFromEuler(new Euler(s.tilt, s.yaw, 0, 'YXZ')),
      new Vector3(s.scale, s.scale, s.scale),
    );
    g.applyMatrix4(m);
    return g;
  });
  base.dispose();
  return {
    leaves: mergeGeometries(parts),
    stems: stems.length ? mergeGeometries(stems) : null,
  };
}

const POTS: Record<PlantKind, { top: number; bottom: number; height: number }> = {
  rubber: { top: 0.19, bottom: 0.14, height: 0.3 },
  snake: { top: 0.15, bottom: 0.12, height: 0.26 },
  succulent: { top: 0.05, bottom: 0.04, height: 0.07 },
};

/** A plant standing with its pot's base at `position`. `scale` resizes the whole plant. */
export function Plant({
  kind,
  position,
  scale = 1,
  potDark = false,
  seed = 1,
}: {
  kind: PlantKind;
  position: V3;
  scale?: number;
  potDark?: boolean;
  seed?: number;
}) {
  const { palettes } = useRoom();
  const built = useMemo(() => build(kind, seed), [kind, seed]);
  const mats = useMemo(
    () => ({
      leaf: new MeshStandardMaterial({ roughness: 0.55, side: DoubleSide }),
      stem: new MeshStandardMaterial({ roughness: 0.7 }),
      pot: new MeshStandardMaterial({ roughness: 0.45 }),
      soil: new MeshStandardMaterial({ roughness: 1 }),
      scratch: new Color(),
    }),
    [],
  );
  useBlend((k) => {
    const { scratch } = mats;
    mats.leaf.color.copy(mixColour(scratch, palettes.night.leaf, palettes.day.leaf, k));
    mats.stem.color.copy(scratch).multiplyScalar(0.7);
    mixColour(
      scratch,
      palettes.night[potDark ? 'steel' : 'paper'],
      palettes.day[potDark ? 'steel' : 'paper'],
      k,
    );
    mats.pot.color.copy(scratch);
    mats.soil.color.copy(palettes.night.ink);
  });
  const pot = POTS[kind];
  const [x, y, z] = position;
  return (
    <group position={[x, y, z]} scale={scale}>
      <mesh position={[0, pot.height / 2, 0]} material={mats.pot} castShadow receiveShadow>
        <cylinderGeometry args={[pot.top, pot.bottom, pot.height, 32]} />
      </mesh>
      <mesh position={[0, pot.height - 0.012, 0]} material={mats.soil}>
        <cylinderGeometry args={[pot.top - 0.012, pot.top - 0.012, 0.02, 32]} />
      </mesh>
      <group position={[0, pot.height, 0]}>
        <mesh geometry={built.leaves} material={mats.leaf} castShadow />
        {built.stems && <mesh geometry={built.stems} material={mats.stem} castShadow />}
      </group>
    </group>
  );
}
