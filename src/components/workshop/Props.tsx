// The room's furniture and dressing (SPEC "Asset pipeline"): a warm-minimal AI engineer's studio. Pieces that carry the look
// (sofa, desk, lamps, shelves, the MacBook, Studio Display and Mac mini) are drawn in code so their colours follow the room
// tokens and the screens can show real-looking code; plants and the chair are free CC0 models from Poly Haven
// (scripts/room-assets.ts compresses them to public/media/room). Zone props (suits, whiteboard, rack, TV...) are separate tasks.
import { useEffect, useMemo } from 'react';
import {
  Box3,
  CatmullRomCurve3,
  Color,
  Group,
  InstancedMesh,
  MathUtils,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Quaternion,
  TubeGeometry,
  Vector3,
  type BufferGeometry,
} from 'three';
import { RoundedBox, useGLTF } from '@react-three/drei';
import { LIGHTS, ROOM } from '../../lib/workshop/layout';
import {
  createPoster,
  POSTER_H,
  POSTER_KINDS,
  POSTER_W,
  type PosterKind,
} from '../../lib/workshop/posters';
import { createScreen, type ScreenKind } from '../../lib/workshop/screens';
import { mixColour, type RoomKey } from '../../lib/workshop/palette';
import { seeded, woodMap } from '../../lib/workshop/textures';
import { box, merge } from './geometry';
import { useBlend, useRoom } from './context';
import { Plant } from './Plants';
import { Details } from './Details';

useGLTF.setDecoderPath('/draco/');

const HX = ROOM.width / 2;
const HZ = ROOM.depth / 2;
type V3 = readonly [number, number, number];

/* ----------------------------- shared materials ----------------------------- */

function useMaterials() {
  const { palettes } = useRoom();
  const parts = useMemo(() => {
    const std = (p: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial =>
      new MeshStandardMaterial(p);
    return {
      oak: std({ map: woodMap(), roughness: 0.55 }),
      black: std({ roughness: 0.45, metalness: 0.3 }),
      metal: std({ roughness: 0.42, metalness: 0.85 }),
      fabric: std({ roughness: 1 }),
      fabricDark: std({ roughness: 1 }),
      ceramic: std({ roughness: 0.4 }),
      shade: std({ roughness: 0.9, emissiveIntensity: 1 }),
      scratch: new Color(),
    };
  }, []);
  useBlend((k) => {
    const mix = (key: RoomKey): Color =>
      mixColour(parts.scratch, palettes.night[key], palettes.day[key], k);
    parts.oak.color.copy(mix('wood'));
    parts.black.color.copy(mix('steel'));
    parts.metal.color.copy(mix('metal'));
    parts.fabric.color.copy(mix('fabric'));
    parts.fabricDark.color.copy(mix('fabric')).multiplyScalar(0.8);
    parts.ceramic.color.copy(mix('paper'));
    const glow = mix('glow');
    parts.shade.color.copy(glow).multiplyScalar(0.5);
    parts.shade.emissive.copy(glow);
    parts.shade.emissiveIntensity = MathUtils.lerp(1.0, 0.12, k);
  });
  return parts;
}
export type Materials = ReturnType<typeof useMaterials>;

/* --------------------------------- models --------------------------------- */

interface ModelProps {
  id: string;
  /** Height in metres: the model is scaled to it. */
  height: number;
  position: V3;
  rotY?: number;
}

function Model({ id, height, position, rotY = 0 }: ModelProps) {
  const { scene } = useGLTF(`/media/room/${id}.glb`);
  const holder = useMemo(() => {
    const clone = scene.clone(true);
    const size = new Box3().setFromObject(clone).getSize(new Vector3());
    clone.scale.setScalar(height / size.y);
    const fitted = new Box3().setFromObject(clone);
    clone.position.set(
      -(fitted.min.x + fitted.max.x) / 2,
      -fitted.min.y,
      -(fitted.min.z + fitted.max.z) / 2,
    );
    clone.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    const group = new Group();
    group.add(clone);
    return group;
  }, [scene, height]);
  return <primitive object={holder} position={position} rotation={[0, rotY, 0]} />;
}

/* ------------------------------- the tech desk ------------------------------- */

const DESK = { x: 4.05, z: -3.8, top: 0.74 } as const;

function Screen({
  kind,
  width,
  height,
  position,
  rotation = [0, 0, 0],
}: {
  kind: ScreenKind;
  width: number;
  height: number;
  position: V3;
  rotation?: V3;
}) {
  const { palettes } = useRoom();
  const screen = useMemo(() => createScreen(kind, palettes.night), [kind, palettes]);
  useEffect(() => {
    let alive = true;
    void document.fonts
      .load('500 20px "JetBrains Mono"')
      .then(() => {
        if (alive) screen.redraw();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [screen]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={screen.texture} toneMapped={false} />
    </mesh>
  );
}

/** An oak desk with a MacBook, a Studio Display on its stand, a Mac mini, a keyboard and trackpad, a mug and a black desk lamp. */
function TechDesk({ m }: { m: Materials }) {
  const { x, z, top } = DESK;
  const dz = z - 0.12; // the display sits towards the wall
  return (
    <group>
      {/* desk: an oak top on four black legs */}
      <RoundedBox
        args={[1.8, 0.04, 0.78]}
        radius={0.012}
        smoothness={3}
        position={[x, top - 0.02, z]}
        material={m.oak}

        receiveShadow
      />
      {[
        [-0.86, -0.34],
        [0.86, -0.34],
        [-0.86, 0.34],
        [0.86, 0.34],
      ].map(([dx, dzz]) => (
        <mesh
          key={`${dx}:${dzz}`}
          position={[x + (dx ?? 0), (top - 0.04) / 2, z + (dzz ?? 0)]}
          material={m.black}
        >
          <boxGeometry args={[0.035, top - 0.04, 0.035]} />
        </mesh>
      ))}

      {/* Studio Display */}
      <group position={[x + 0.12, top, dz]} rotation={[-0.06, 0, 0]}>
        <RoundedBox
          args={[0.2, 0.012, 0.16]}
          radius={0.005}
          smoothness={2}
          position={[0, 0.006, 0.02]}
          material={m.metal}
        />
        <mesh position={[0, 0.17, -0.005]} material={m.metal}>
          <boxGeometry args={[0.05, 0.3, 0.014]} />
        </mesh>
        <RoundedBox
          args={[0.66, 0.4, 0.02]}
          radius={0.01}
          smoothness={3}
          position={[0, 0.4, 0]}
          material={m.metal}
        />
        <mesh position={[0, 0.4, 0.0105]} material={m.black}>
          <planeGeometry args={[0.65, 0.39]} />
        </mesh>
        <Screen kind="editor" width={0.61} height={0.36} position={[0, 0.4, 0.0115]} />
      </group>

      {/* MacBook, open, angled towards the chair */}
      <group position={[x - 0.52, top, z + 0.02]} rotation={[0, 0.18, 0]}>
        <RoundedBox
          args={[0.3, 0.011, 0.21]}
          radius={0.004}
          smoothness={2}
          position={[0, 0.0055, 0]}
          material={m.metal}
        />
        <group position={[0, 0.011, -0.105]} rotation={[-1.95, 0, 0]}>
          <RoundedBox
            args={[0.3, 0.008, 0.21]}
            radius={0.004}
            smoothness={2}
            position={[0, 0, 0.105]}
            material={m.metal}
          />
          <mesh position={[0, -0.0045, 0.105]} rotation={[Math.PI / 2, 0, 0]} material={m.black}>
            <planeGeometry args={[0.285, 0.195]} />
          </mesh>
          <Screen
            kind="terminal"
            width={0.27}
            height={0.17}
            position={[0, -0.0052, 0.105]}
            rotation={[Math.PI / 2, 0, 0]}
          />
        </group>
      </group>

      {/* Mac mini, keyboard, trackpad, mug */}
      <RoundedBox
        args={[0.13, 0.036, 0.13]}
        radius={0.01}
        smoothness={3}
        position={[x + 0.62, top + 0.018, dz + 0.02]}
        material={m.metal}
      />
      <RoundedBox
        args={[0.29, 0.008, 0.1]}
        radius={0.004}
        smoothness={2}
        position={[x + 0.02, top + 0.004, z + 0.12]}
        material={m.metal}
      />
      <RoundedBox
        args={[0.11, 0.004, 0.09]}
        radius={0.004}
        smoothness={2}
        position={[x + 0.27, top + 0.002, z + 0.12]}
        material={m.metal}
      />
      <mesh position={[x - 0.78, top + 0.045, dz + 0.1]} material={m.ceramic}>
        <cylinderGeometry args={[0.04, 0.034, 0.09, 24]} />
      </mesh>

      {/* black desk lamp: a round base, a slim arm bent to a small cone head, over the desk's right corner */}
      <DeskLamp m={m} />
      <Plant kind="succulent" position={[x - 0.78, top, dz - 0.05]} seed={9} />
    </group>
  );
}

function DeskLamp({ m }: { m: Materials }) {
  const [lx, , lz] = LIGHTS.deskLamp;
  const arm = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, 0, 0),
          new Vector3(0, 0.3, 0),
          new Vector3(-0.07, 0.42, 0),
          new Vector3(-0.2, 0.42, 0.02),
        ]),
        24,
        0.005,
        8,
      ),
    [],
  );
  return (
    <group position={[lx, DESK.top, lz]}>
      <mesh material={m.black} position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.07, 0.07, 0.016, 32]} />
      </mesh>
      <mesh geometry={arm} material={m.black} />
      <mesh position={[-0.22, 0.4, 0.02]} rotation={[0, 0, 0.2]} material={m.black}>
        <coneGeometry args={[0.06, 0.1, 32, 1, true]} />
      </mesh>
      <mesh position={[-0.22, 0.375, 0.02]} material={m.shade}>
        <sphereGeometry args={[0.022, 16, 12]} />
      </mesh>
    </group>
  );
}

/* ------------------------------- soft furnishings ------------------------------- */

/** A cream sofa with a low back, round arms and two cushions, facing the room (-z). */
function Sofa({ m }: { m: Materials }) {
  return (
    <group position={[-3.1, 0, 3.45]}>
      <RoundedBox
        args={[2.0, 0.26, 0.92]}
        radius={0.06}
        smoothness={4}
        position={[0, 0.3, 0]}
        material={m.fabric}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[0.94, 0.14, 0.78]}
        radius={0.06}
        smoothness={4}
        position={[-0.47, 0.5, -0.05]}
        material={m.fabric}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[0.94, 0.14, 0.78]}
        radius={0.06}
        smoothness={4}
        position={[0.47, 0.5, -0.05]}
        material={m.fabric}
        castShadow
        receiveShadow
      />
      <RoundedBox
        args={[2.0, 0.5, 0.22]}
        radius={0.08}
        smoothness={4}
        position={[0, 0.66, 0.36]}
        material={m.fabric}
        castShadow
        receiveShadow
      />
      {[-1, 1].map((s) => (
        <RoundedBox
          key={s}
          args={[0.2, 0.4, 0.92]}
          radius={0.08}
          smoothness={4}
          position={[s * 0.98, 0.5, 0]}
          material={m.fabric}
          castShadow
          receiveShadow
        />
      ))}
      <RoundedBox
        args={[0.42, 0.42, 0.13]}
        radius={0.05}
        smoothness={4}
        position={[-0.55, 0.78, 0.2]}
        rotation={[-0.2, 0.15, 0.05]}
        material={m.fabricDark}
        castShadow
      />
      <RoundedBox
        args={[0.38, 0.38, 0.12]}
        radius={0.05}
        smoothness={4}
        position={[0.5, 0.74, 0.2]}
        rotation={[-0.2, -0.2, -0.05]}
        material={m.black}
        castShadow
      />
      {[
        [-0.9, -0.38],
        [0.9, -0.38],
        [-0.9, 0.38],
        [0.9, 0.38],
      ].map(([dx, dz]) => (
        <mesh key={`${dx}:${dz}`} position={[dx ?? 0, 0.08, dz ?? 0]} material={m.black}>
          <cylinderGeometry args={[0.02, 0.016, 0.16, 12]} />
        </mesh>
      ))}
    </group>
  );
}

/** A low round oak coffee table with a book and a cup. */
function CoffeeTable({ m }: { m: Materials }) {
  return (
    <group position={[-2.6, 0, 2.15]}>
      <mesh material={m.oak} position={[0, 0.37, 0]} receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.035, 48]} />
      </mesh>
      <mesh material={m.black} position={[0, 0.18, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.36, 16]} />
      </mesh>
      <mesh material={m.black} position={[0, 0.008, 0]}>
        <cylinderGeometry args={[0.2, 0.2, 0.016, 32]} />
      </mesh>
      <mesh material={m.ceramic} position={[0.08, 0.4, 0.04]} rotation={[0, 0.4, 0]}>
        <boxGeometry args={[0.22, 0.03, 0.16]} />
      </mesh>
      <mesh material={m.black} position={[0.08, 0.425, 0.04]} rotation={[0, 0.2, 0]}>
        <boxGeometry args={[0.18, 0.02, 0.13]} />
      </mesh>
      <mesh material={m.ceramic} position={[-0.17, 0.42, -0.1]}>
        <cylinderGeometry args={[0.04, 0.034, 0.07, 24]} />
      </mesh>
    </group>
  );
}

/** Three oak floating shelves on the left wall, with books, a speaker, a plant and a small edge board. */
function Shelves({ m }: { m: Materials }) {
  const { palettes } = useRoom();
  const books = useMemo(() => {
    const rand = seeded(13);
    const shelves = [1.1, 1.55, 2.0];
    const mesh = new InstancedMesh(
      box(1, 1, 1, 0, 0, 0),
      new MeshStandardMaterial({ roughness: 0.85 }),
      33,
    );
    const matrix = new Matrix4();
    const quat = new Quaternion();
    const colour = new Color();
    const palette: Color[] = [
      palettes.night.paper,
      palettes.night.wood,
      palettes.night.ink,
      palettes.night.fabric,
      palettes.night.time,
    ];
    let n = 0;
    for (const y of shelves) {
      let z = 1.45;
      for (let i = 0; i < 11 && z < 2.45; i++) {
        const thick = 0.025 + rand() * 0.02;
        const h = 0.17 + rand() * 0.1;
        quat.setFromAxisAngle(new Vector3(1, 0, 0), i === 9 ? 0.18 : 0);
        matrix.compose(
          new Vector3(-HX + 0.12, y + 0.0175 + h / 2, z + thick / 2),
          quat,
          new Vector3(0.17, h, thick),
        );
        mesh.setMatrixAt(n, matrix);
        colour.copy(palette[(rand() * palette.length) | 0] ?? palettes.night.paper);
        if (colour.equals(palettes.night.time) && rand() > 0.3) colour.copy(palettes.night.paper);
        mesh.setColorAt(n, colour);
        n += 1;
        z += thick + 0.003;
      }
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true;
    return mesh;
  }, [palettes]);
  return (
    <group>
      {[1.1, 1.55, 2.0].map((y) => (
        <mesh key={y} material={m.oak} position={[-HX + 0.12, y, 2.0]} receiveShadow>
          <boxGeometry args={[0.24, 0.035, 1.35]} />
        </mesh>
      ))}
      <primitive object={books} />
      <mesh material={m.black} position={[-HX + 0.13, 1.1 + 0.07 + 0.0175, 2.34]}>
        <cylinderGeometry args={[0.055, 0.055, 0.14, 24]} />
      </mesh>
      <mesh material={m.black} position={[-HX + 0.13, 1.55 + 0.02 + 0.0175, 1.72]}>
        <boxGeometry args={[0.1, 0.04, 0.1]} />
      </mesh>
      <mesh position={[-HX + 0.13, 1.55 + 0.04 + 0.0175, 1.72]}>
        <sphereGeometry args={[0.006, 8, 8]} />
        <meshBasicMaterial color={palettes.night.holo} toneMapped={false} />
      </mesh>
      <Plant kind="succulent" position={[-HX + 0.13, 2.0 + 0.0175, 2.3]} seed={11} />
    </group>
  );
}

/** A floating oak shelf above the desk, with a vase: the cricket shelf's place. */
function DeskShelf({ m }: { m: Materials }) {
  return (
    <group>
      <mesh material={m.oak} position={[2.7, 1.5, -HZ + 0.11]} castShadow receiveShadow>
        <boxGeometry args={[1.0, 0.035, 0.22]} />
      </mesh>
      <Model id="ceramic_vase_02" height={0.3} position={[2.95, 1.5175, -HZ + 0.12]} />
    </group>
  );
}

/* ---------------------------------- lamps ---------------------------------- */

/** Two paper-sphere pendants and a black arc floor lamp over the sofa: the room's soft light. */
function Lamps({ m }: { m: Materials }) {
  const arc = useMemo(
    () =>
      new TubeGeometry(
        new CatmullRomCurve3([
          new Vector3(0, 1.7, 0),
          new Vector3(-0.3, 2.0, 0),
          new Vector3(-0.7, 1.95, 0),
          new Vector3(-0.95, 1.72, 0),
        ]),
        32,
        0.012,
        8,
      ),
    [],
  );
  const [fx, , fz] = LIGHTS.floorLamp.base;
  return (
    <group>
      {LIGHTS.pendants.map(([x, y, z]) => (
        <group key={`${x}:${z}`}>
          <mesh material={m.black} position={[x, (ROOM.height + y + 0.3) / 2, z]}>
            <cylinderGeometry args={[0.004, 0.004, ROOM.height - y - 0.3, 6]} />
          </mesh>
          <mesh material={m.shade} position={[x, y, z]}>
            <sphereGeometry args={[0.2, 32, 24]} />
          </mesh>
        </group>
      ))}
      <group position={[fx, 0, fz]}>
        <mesh material={m.black} position={[0, 0.015, 0]}>
          <cylinderGeometry args={[0.17, 0.17, 0.03, 40]} />
        </mesh>
        <mesh material={m.black} position={[0, 0.86, 0]}>
          <cylinderGeometry args={[0.011, 0.011, 1.7, 10]} />
        </mesh>
        <mesh geometry={arc} material={m.black} />
        <mesh material={m.shade} position={[-0.95, 1.55, 0]}>
          <cylinderGeometry args={[0.2, 0.24, 0.3, 40, 1, true]} />
        </mesh>
      </group>
    </group>
  );
}

/* ---------------------------------- prints ---------------------------------- */

interface PrintSpec {
  kind: PosterKind;
  wall: 'back' | 'front' | 'left' | 'right';
  at: number;
  y: number;
  width: number;
}
const PRINTS: readonly PrintSpec[] = [
  { kind: 'transformer', wall: 'back', at: -3.5, y: 1.85, width: 0.62 },
  { kind: 'calibration', wall: 'back', at: -2.65, y: 1.85, width: 0.5 },
  { kind: 'neural', wall: 'back', at: 3.65, y: 2.3, width: 0.5 },
  { kind: 'shipit', wall: 'back', at: 4.4, y: 2.3, width: 0.45 },
  { kind: 'mumbai', wall: 'front', at: -3.7, y: 1.85, width: 0.6 },
  { kind: 'cricket', wall: 'front', at: -2.75, y: 1.85, width: 0.5 },
];
const WALLS = {
  back: { pos: (at: number, off: number): V3 => [at, 0, -HZ + off], rotY: 0 },
  front: { pos: (at: number, off: number): V3 => [at, 0, HZ - off], rotY: Math.PI },
  left: { pos: (at: number, off: number): V3 => [-HX + off, 0, at], rotY: Math.PI / 2 },
  right: { pos: (at: number, off: number): V3 => [HX - off, 0, at], rotY: -Math.PI / 2 },
} as const;
const printHeight = (width: number): number => (width * POSTER_H) / POSTER_W;

/** Black-framed prints; textures are drawn once and again when the site's fonts have loaded. */
function Prints({ m }: { m: Materials }) {
  const { palettes } = useRoom();
  const prints = useMemo(
    () => Object.fromEntries(POSTER_KINDS.map((k) => [k, createPoster(k, palettes.night)])),
    [palettes],
  );
  useEffect(() => {
    let alive = true;
    void Promise.all([
      document.fonts.load('700 40px Unbounded'),
      document.fonts.load('500 14px "JetBrains Mono"'),
    ])
      .then(() => {
        if (alive) for (const p of Object.values(prints)) p.redraw();
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [prints]);
  const frames = useMemo(() => {
    const parts: BufferGeometry[] = PRINTS.map((s) => {
      const wall = WALLS[s.wall];
      const g = box(s.width + 0.04, printHeight(s.width) + 0.04, 0.02, 0, 0, 0);
      g.rotateY(wall.rotY);
      const [x, , z] = wall.pos(s.at, 0.012);
      g.translate(x, s.y, z);
      return g;
    });
    return merge(parts);
  }, []);
  return (
    <group>
      <mesh geometry={frames} material={m.black} castShadow />
      {PRINTS.map((s) => {
        const wall = WALLS[s.wall];
        const [x, , z] = wall.pos(s.at, 0.024);
        return (
          <mesh key={s.kind} position={[x, s.y, z]} rotation={[0, wall.rotY, 0]}>
            <planeGeometry args={[s.width, printHeight(s.width)]} />
            <meshStandardMaterial map={prints[s.kind]?.texture ?? null} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

export function Props() {
  const m = useMaterials();
  return (
    <group>
      <TechDesk m={m} />
      <Model id="modern_arm_chair_01" height={0.95} position={[DESK.x, 0, -2.95]} rotY={Math.PI} />
      <DeskShelf m={m} />
      <Sofa m={m} />
      <CoffeeTable m={m} />
      <Shelves m={m} />
      <Lamps m={m} />
      <Prints m={m} />
      <Details m={m} />
      <Plant kind="rubber" position={[-4.55, 0, 3.3]} seed={3} />
      <Plant kind="snake" position={[2.05, 0, -3.8]} potDark seed={5} />
    </group>
  );
}
