// The room's architecture (SPEC "The Workshop"): a warm-minimal studio. Pale oak floor under a cream fur rug, oat plaster
// walls with black skirting, a black-framed window with sheer linen curtains, four softly lit display niches for the armour
// wall, a wall clock on Mumbai time and the holotable. Everything is code: boxes merged per material (a handful of draw
// calls) with procedural textures tinted by the room tokens, so Night and Day cross-fade through the palette.
import { useMemo, useRef } from 'react';
import {
  BackSide,
  BufferGeometry,
  Color,
  DoubleSide,
  MathUtils,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  type Group,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { furMaps, linenMap, plankMaps, plasterMap, woodMap } from '../../lib/workshop/textures';
import { mixColour, type RoomKey } from '../../lib/workshop/palette';
import { DOOR, ROOM, TABLE, WINDOW } from '../../lib/workshop/layout';
import { mumbaiClock } from '../../lib/workshop/room-clock';
import { useBlend, useRoom } from './context';
import { HoloTable } from './HoloTable';
import { box, merge } from './geometry';

const T = 0.3;
const HX = ROOM.width / 2;
const HZ = ROOM.depth / 2;
const H = ROOM.height;
const OUTER_W = ROOM.width + 2 * T;
const OUTER_D = ROOM.depth + 2 * T;
const WIN = WINDOW.width / 2;
const DOOR_L = DOOR.x - DOOR.width / 2;
const DOOR_R = DOOR.x + DOOR.width / 2;
const WIN_MID = (WINDOW.top + WINDOW.bottom) / 2;
const WIN_H = WINDOW.top - WINDOW.bottom;

/** The rug is centred on the holotable, which is centred on the room. */
export const FUR = { x: TABLE.x, z: TABLE.z, radius: 1.9 } as const;

/** The armour wall's four display niches (z centres), and their size. */
export const NICHES = {
  z: [-2.1, -1.2, -0.3, 0.6],
  width: 0.82,
  height: 2.35,
  depth: 0.32,
} as const;

function buildShell() {
  const plaster: BufferGeometry[] = [
    box(OUTER_W, WINDOW.bottom, T, 0, WINDOW.bottom / 2, -HZ - T / 2),
    box(OUTER_W, H - WINDOW.top, T, 0, (H + WINDOW.top) / 2, -HZ - T / 2),
    box(HX + T - WIN, WIN_H, T, -(HX + T + WIN) / 2, WIN_MID, -HZ - T / 2),
    box(HX + T - WIN, WIN_H, T, (HX + T + WIN) / 2, WIN_MID, -HZ - T / 2),
    box(HX + T + DOOR_L, H, T, (-HX - T + DOOR_L) / 2, H / 2, HZ + T / 2),
    box(HX + T - DOOR_R, H, T, (HX + T + DOOR_R) / 2, H / 2, HZ + T / 2),
    box(DOOR.width, H - DOOR.height, T, DOOR.x, (H + DOOR.height) / 2, HZ + T / 2),
    box(T, H, OUTER_D, -HX - T / 2, H / 2, 0),
    box(T, H, OUTER_D, HX + T / 2, H / 2, 0),
  ];

  const black: BufferGeometry[] = [
    // slim black skirting
    box(ROOM.width, 0.07, 0.02, 0, 0.035, -HZ + 0.01),
    box(0.02, 0.07, ROOM.depth, -HX + 0.01, 0.035, 0),
    box(0.02, 0.07, ROOM.depth, HX - 0.01, 0.035, 0),
    box(HX + DOOR_L, 0.07, 0.02, (-HX + DOOR_L) / 2, 0.035, HZ - 0.01),
    box(HX - DOOR_R, 0.07, 0.02, (HX + DOOR_R) / 2, 0.035, HZ - 0.01),
    // window: a thin black steel frame with two mullions and a transom
    // (the outer frame reaches 12 mm into the opening, so no face lies in the same plane as the wall's: no z-fighting)
    box(WINDOW.width + 0.1, 0.062, 0.1, 0, WINDOW.top + 0.019, -HZ + 0.02),
    box(WINDOW.width + 0.1, 0.062, 0.1, 0, WINDOW.bottom - 0.019, -HZ + 0.02),
    box(0.062, WIN_H, 0.1, -WIN - 0.019, WIN_MID, -HZ + 0.02),
    box(0.062, WIN_H, 0.1, WIN + 0.019, WIN_MID, -HZ + 0.02),
    box(0.03, WIN_H, 0.07, -WIN / 3, WIN_MID, -HZ + 0.02),
    box(0.03, WIN_H, 0.07, WIN / 3, WIN_MID, -HZ + 0.02),
    box(WINDOW.width, 0.03, 0.07, 0, WINDOW.top - 0.55, -HZ + 0.02),
    // door frame
    box(0.062, DOOR.height, 0.34, DOOR_L - 0.019, DOOR.height / 2, HZ + T / 2),
    box(0.062, DOOR.height, 0.34, DOOR_R + 0.019, DOOR.height / 2, HZ + T / 2),
    box(DOOR.width + 0.1, 0.062, 0.34, DOOR.x, DOOR.height + 0.019, HZ + T / 2),
  ];
  // armour wall niches: a black frame each (back panel and glass are separate meshes)
  const cx = -HX + NICHES.depth / 2;
  for (const z of NICHES.z) {
    black.push(
      box(NICHES.depth, 0.05, NICHES.width, cx, 0.1, z),
      box(NICHES.depth, 0.05, NICHES.width, cx, 0.1 + NICHES.height, z),
      box(
        NICHES.depth,
        NICHES.height,
        0.03,
        cx,
        0.1 + NICHES.height / 2,
        z - NICHES.width / 2 + 0.015,
      ),
      box(
        NICHES.depth,
        NICHES.height,
        0.03,
        cx,
        0.1 + NICHES.height / 2,
        z + NICHES.width / 2 - 0.015,
      ),
    );
  }

  const oak: BufferGeometry[] = [
    box(WINDOW.width + 0.4, 0.04, 0.3, 0, WINDOW.bottom + 0.02, -HZ + 0.15),
  ];
  // The door leaf stands open, hinged on the outer face of the wall (never inside it), so nothing overlaps the plaster.
  const leafW = DOOR.width - 0.04;
  const leaf = box(leafW, DOOR.height - 0.05, 0.045, -leafW / 2, (DOOR.height - 0.05) / 2, 0);
  leaf.rotateY(1.3);
  leaf.translate(DOOR_R - 0.03, 0, HZ + T + 0.04);
  oak.push(leaf);

  const nicheBacks = merge(
    NICHES.z.map((z) =>
      box(0.02, NICHES.height - 0.05, NICHES.width - 0.06, -HX + 0.03, 0.1 + NICHES.height / 2, z),
    ),
  );
  const nicheGlass = merge(
    NICHES.z.map((z) =>
      box(
        0.01,
        NICHES.height - 0.05,
        NICHES.width - 0.06,
        -HX + NICHES.depth - 0.02,
        0.1 + NICHES.height / 2,
        z,
      ),
    ),
  );
  return { plaster: merge(plaster), black: merge(black), oak: merge(oak), nicheBacks, nicheGlass };
}

const tint = (
  out: Color,
  palettes: ReturnType<typeof useRoom>['palettes'],
  key: RoomKey,
  k: number,
): Color => mixColour(out, palettes.night[key], palettes.day[key], k);

export function Shell() {
  const { palettes } = useRoom();
  const geo = useMemo(() => buildShell(), []);
  const parts = useMemo(() => {
    const planks = plankMaps();
    const std = (p: ConstructorParameters<typeof MeshStandardMaterial>[0]): MeshStandardMaterial =>
      new MeshStandardMaterial(p);
    return {
      floor: std({
        map: planks.map,
        roughnessMap: planks.roughness,
        roughness: 0.55,
        metalness: 0,
      }),
      plaster: std({ map: plasterMap(), roughness: 0.96 }),
      ceiling: std({ roughness: 1 }),
      black: std({ roughness: 0.5, metalness: 0.25 }),
      oak: std({ map: woodMap(), roughness: 0.6 }),
      back: std({
        color: new Color(0x000000),
        emissive: new Color(),
        emissiveIntensity: 0.5,
        roughness: 1,
      }),
      glass: std({ color: new Color(0xffffff), roughness: 0.22, transparent: true, opacity: 0.08 }),
      sheer: std({
        map: linenMap(),
        roughness: 1,
        side: DoubleSide,
        transparent: true,
        opacity: 0.62,
        depthWrite: false,
      }),
      table: std({
        color: new Color(0x0a0c0f),
        roughness: 0.42,
        metalness: 0.3,
        transparent: true,
        opacity: 0.88,
      }),
      scratch: new Color(),
    };
  }, []);

  useBlend((k) => {
    const { scratch } = parts;
    parts.floor.color.copy(tint(scratch, palettes, 'floor', k));
    parts.plaster.color.copy(tint(scratch, palettes, 'wall', k));
    parts.ceiling.color.copy(tint(scratch, palettes, 'ceiling', k));
    parts.black.color.copy(tint(scratch, palettes, 'steel', k));
    parts.oak.color.copy(tint(scratch, palettes, 'wood', k));
    parts.sheer.color.copy(tint(scratch, palettes, 'fabric', k));
    parts.back.emissive.copy(tint(scratch, palettes, 'glow', k));
    parts.back.emissiveIntensity = MathUtils.lerp(0.55, 0.2, k);
  });

  const curtain = useMemo(() => {
    const g = new PlaneGeometry(0.95, 2.4, 40, 1);
    const pos = g.getAttribute('position');
    for (let i = 0; i < pos.count; i++)
      pos.setZ(i, Math.sin((pos.getX(i) / 0.95) * Math.PI * 2 * 5) * 0.03);
    g.computeVertexNormals();
    return g;
  }, []);

  return (
    <group>
      <mesh geometry={geo.plaster} material={parts.plaster} castShadow receiveShadow />
      <mesh geometry={geo.black} material={parts.black} castShadow receiveShadow />
      <mesh geometry={geo.oak} material={parts.oak} castShadow receiveShadow />
      <mesh geometry={geo.nicheBacks} material={parts.back} />
      <mesh geometry={geo.nicheGlass} material={parts.glass} renderOrder={3} />
      <mesh position={[0, H + 0.15, 0]} material={parts.ceiling} receiveShadow>
        <boxGeometry args={[OUTER_W, 0.3, OUTER_D]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} material={parts.floor} receiveShadow>
        <planeGeometry
          args={[OUTER_W, OUTER_D]}
          onUpdate={(g) => {
            const uv = g.getAttribute('uv');
            for (let i = 0; i < uv.count; i++)
              uv.setXY(i, (uv.getX(i) * OUTER_W) / 2.4, (uv.getY(i) * OUTER_D) / 2.4);
          }}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={curtain}
          material={parts.sheer}
          position={[side * (WIN + 0.32), WINDOW.bottom + 1.3, -HZ + 0.26]}
          renderOrder={4}
        />
      ))}
      <mesh
        position={[0, WINDOW.bottom + 2.5, -HZ + 0.26]}
        material={parts.black}
        rotation={[0, 0, Math.PI / 2]}
      >
        <cylinderGeometry args={[0.012, 0.012, WINDOW.width + 1.8, 10]} />
      </mesh>
      <FurRug />
      <Corridor />
      <HoloTable glass={parts.table} black={parts.black} />
      <Clock />
    </group>
  );
}

/* ----------------------------------- corridor ----------------------------------- */

/** What lies beyond the open door: a short, softly lit hall, so the doorway is never an empty hole onto the sky. */
function Corridor() {
  const { palettes } = useRoom();
  const scratch = useMemo(() => new Color(), []);
  const mats = useMemo(
    () => ({
      walls: new MeshStandardMaterial({ side: BackSide, roughness: 1 }),
      strip: new MeshBasicMaterial({ toneMapped: false }),
    }),
    [],
  );
  useBlend((k) => {
    mixColour(scratch, palettes.night.wall, palettes.day.wall, k);
    mats.walls.color.copy(scratch).multiplyScalar(0.62);
    mixColour(scratch, palettes.night.glow, palettes.day.glow, k);
    mats.strip.color.copy(scratch).multiplyScalar(MathUtils.lerp(2, 1, k));
  });
  return (
    <group position={[DOOR.x, 0, HZ + T]}>
      <mesh position={[0, 1.35, 1.4]} material={mats.walls}>
        <boxGeometry args={[2.4, 2.7, 2.8]} />
      </mesh>
      <mesh position={[0, 2.68, 1.2]} rotation={[Math.PI / 2, 0, 0]} material={mats.strip}>
        <planeGeometry args={[0.3, 1.6]} />
      </mesh>
    </group>
  );
}

/* ------------------------------------ fur rug ------------------------------------ */

/** A round shaggy rug: four stacked discs with combed strands, so the pile has depth and a soft fringe. */
function FurRug() {
  const { palettes } = useRoom();
  const scratch = useMemo(() => new Color(), []);
  const layers = useMemo(() => {
    const { strands, edge } = furMaps();
    return Array.from({ length: 4 }, (_, i) => {
      const m = new MeshStandardMaterial({
        map: strands,
        alphaMap: edge,
        bumpMap: strands,
        bumpScale: 1.2,
        roughness: 1,
        transparent: true,
        alphaTest: 0.35,
        depthWrite: i === 0,
      });
      return { m, y: 0.006 + i * 0.006, scale: 1 - i * 0.012 };
    });
  }, []);
  useBlend((k) => {
    mixColour(scratch, palettes.night.fur, palettes.day.fur, k);
    layers.forEach(({ m }, i) =>
      m.color.copy(scratch).multiplyScalar(1 - (layers.length - 1 - i) * 0.035),
    );
  });
  return (
    <group position={[FUR.x, 0, FUR.z]}>
      {layers.map(({ m, y, scale }, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, y, 0]}
          scale={scale}
          material={m}
          receiveShadow
        >
          <circleGeometry args={[FUR.radius, 72]} />
        </mesh>
      ))}
    </group>
  );
}

/* ------------------------------- wall clock ------------------------------- */

/** A slim wall clock on Mumbai time: the hands follow IST. */
function Clock() {
  const { palettes } = useRoom();
  const minute = useRef<Group>(null);
  const hour = useRef<Group>(null);
  const last = useRef(-1);
  useFrame((state) => {
    // The hands move a minute at a time, so read the clock once a second, not every frame.
    const second = Math.floor(state.clock.elapsedTime);
    if (second === last.current) return;
    last.current = second;
    const [h = 0, m = 0] = mumbaiClock().split(':').map(Number);
    if (hour.current) hour.current.rotation.z = -((h % 12) + m / 60) * (Math.PI / 6);
    if (minute.current) minute.current.rotation.z = -m * (Math.PI / 30);
  });
  const night = palettes.night;
  return (
    <group position={[0, 3.12, -HZ + 0.03]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.17, 0.17, 0.03, 48]} />
        <meshStandardMaterial color={night.steel} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.016]}>
        <circleGeometry args={[0.155, 48]} />
        <meshStandardMaterial color={night.paper} roughness={0.9} />
      </mesh>
      <group position={[0, 0, 0.02]} ref={hour}>
        <mesh position={[0, 0.04, 0]}>
          <boxGeometry args={[0.012, 0.08, 0.003]} />
          <meshBasicMaterial color={night.ink} />
        </mesh>
      </group>
      <group position={[0, 0, 0.024]} ref={minute}>
        <mesh position={[0, 0.06, 0]}>
          <boxGeometry args={[0.008, 0.12, 0.003]} />
          <meshBasicMaterial color={night.ink} />
        </mesh>
      </group>
    </group>
  );
}
