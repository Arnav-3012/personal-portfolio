// The small things that make the room lived in, kept minimal (beige and black): on the desk a mouse, a notebook and pen and
// headphones on a stand; a basket with a folded throw beside the sofa; an entryway console with a mirror by the door; a
// shoe tray; a candle and a succulent on the window sill; warm LED strips under the shelves and a cove light along the
// ceiling edge; a light switch and a socket. All drawn in code, from the shared materials, so they follow the room tokens.
import { useMemo } from 'react';
import { Color, MathUtils, MeshBasicMaterial, TorusGeometry } from 'three';
import { RoundedBox } from '@react-three/drei';
import { ROOM, WINDOW } from '../../lib/workshop/layout';
import { mixColour } from '../../lib/workshop/palette';
import { useBlend, useRoom } from './context';
import { Plant } from './Plants';
import type { Materials } from './Props';

const HX = ROOM.width / 2;
const HZ = ROOM.depth / 2;
const DESK_TOP = 0.74;

function DeskThings({ m }: { m: Materials }) {
  const band = useMemo(() => new TorusGeometry(0.075, 0.008, 8, 28, Math.PI), []);
  return (
    <group>
      {/* mouse */}
      <RoundedBox
        args={[0.06, 0.026, 0.1]}
        radius={0.012}
        smoothness={3}
        position={[4.56, DESK_TOP + 0.013, -3.66]}
        material={m.metal}
      />
      {/* notebook and pen */}
      <mesh position={[3.8, DESK_TOP + 0.007, -3.52]} rotation={[0, 0.25, 0]} material={m.ceramic}>
        <boxGeometry args={[0.15, 0.014, 0.21]} />
      </mesh>
      <mesh position={[3.8, DESK_TOP + 0.0145, -3.52]} rotation={[0, 0.25, 0]} material={m.black}>
        <boxGeometry args={[0.15, 0.001, 0.012]} />
      </mesh>
      <mesh
        position={[3.9, DESK_TOP + 0.022, -3.46]}
        rotation={[Math.PI / 2, 0, 0.9]}
        material={m.black}
      >
        <cylinderGeometry args={[0.005, 0.005, 0.14, 8]} />
      </mesh>
      {/* headphones on a stand */}
      <group position={[4.86, DESK_TOP, -3.62]}>
        <mesh material={m.black} position={[0, 0.006, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.012, 24]} />
        </mesh>
        <mesh material={m.black} position={[0, 0.12, 0]}>
          <cylinderGeometry args={[0.008, 0.008, 0.22, 8]} />
        </mesh>
        <group position={[0, 0.2, 0]}>
          <mesh geometry={band} material={m.black} position={[0, 0.0, 0]} />
          {([-1, 1] as const).map((s) => (
            <mesh
              key={s}
              material={m.metal}
              position={[s * 0.075, 0, 0]}
              rotation={[0, 0, Math.PI / 2]}
            >
              <cylinderGeometry args={[0.04, 0.04, 0.032, 24]} />
            </mesh>
          ))}
        </group>
      </group>
    </group>
  );
}

/** A woven basket with a folded throw hanging over its rim. */
function Basket({ m }: { m: Materials }) {
  return (
    <group position={[-4.55, 0, 2.1]}>
      <mesh material={m.oak} position={[0, 0.15, 0]} receiveShadow>
        <cylinderGeometry args={[0.27, 0.22, 0.3, 32, 1, true]} />
      </mesh>
      <mesh material={m.oak} position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
      </mesh>
      <RoundedBox
        args={[0.34, 0.12, 0.3]}
        radius={0.05}
        smoothness={4}
        position={[0, 0.32, 0]}
        rotation={[0, 0.4, 0]}
        material={m.fabric}
      />
      <RoundedBox
        args={[0.3, 0.3, 0.1]}
        radius={0.04}
        smoothness={4}
        position={[0.2, 0.2, 0.12]}
        rotation={[0.2, 0.4, 0.3]}
        material={m.fabricDark}
      />
    </group>
  );
}

/** An entryway console by the door: a slim oak top on black legs, a black key tray, a small vase with dried stems, two books, and a round mirror above it. */
function Console({ m }: { m: Materials }) {
  const x = 0.9;
  const z = HZ - 0.17;
  const top = 0.78;
  return (
    <group>
      <RoundedBox
        args={[1.1, 0.035, 0.3]}
        radius={0.01}
        smoothness={3}
        position={[x, top - 0.0175, z]}
        material={m.oak}
        castShadow
        receiveShadow
      />
      {[-0.5, 0.5].flatMap((dx) =>
        [-0.11, 0.11].map((dz) => (
          <mesh
            key={`${dx}:${dz}`}
            material={m.black}
            position={[x + dx, (top - 0.035) / 2, z + dz]}
          >
            <boxGeometry args={[0.028, top - 0.035, 0.028]} />
          </mesh>
        )),
      )}
      <mesh material={m.black} position={[x, 0.3, z]}>
        <boxGeometry args={[1.0, 0.014, 0.24]} />
      </mesh>
      {/* the key tray with a key */}
      <RoundedBox
        args={[0.22, 0.014, 0.14]}
        radius={0.005}
        smoothness={2}
        position={[x - 0.3, top + 0.007, z]}
        material={m.black}
      />
      <mesh material={m.metal} position={[x - 0.31, top + 0.018, z]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.014, 0.003, 6, 14]} />
      </mesh>
      <mesh material={m.metal} position={[x - 0.27, top + 0.016, z]}>
        <boxGeometry args={[0.05, 0.003, 0.008]} />
      </mesh>
      {/* a small vase with three dried stems */}
      <mesh material={m.ceramic} position={[x + 0.38, top + 0.08, z]} castShadow>
        <cylinderGeometry args={[0.032, 0.048, 0.16, 20]} />
      </mesh>
      {[-0.015, 0.004, 0.02].map((dx, i) => (
        <mesh
          key={dx}
          material={m.oak}
          position={[x + 0.38 + dx * 1.4, top + 0.27 + i * 0.03, z]}
          rotation={[0, 0, dx * 3]}
        >
          <cylinderGeometry args={[0.0025, 0.0025, 0.3 + i * 0.06, 5]} />
        </mesh>
      ))}
      {/* two books, one lying across the other */}
      <mesh
        material={m.ceramic}
        position={[x + 0.1, top + 0.0125, z + 0.02]}
        rotation={[0, 0.05, 0]}
      >
        <boxGeometry args={[0.2, 0.025, 0.14]} />
      </mesh>
      <mesh material={m.black} position={[x + 0.1, top + 0.0375, z + 0.02]} rotation={[0, -0.1, 0]}>
        <boxGeometry args={[0.17, 0.025, 0.12]} />
      </mesh>
      {/* a round mirror: a thin black ring round a soft grey glass */}
      <group position={[x, 1.55, HZ - 0.03]}>
        <mesh material={m.black}>
          <torusGeometry args={[0.36, 0.012, 8, 56]} />
        </mesh>
        <mesh material={m.metal} position={[0, 0, -0.004]} rotation={[0, Math.PI, 0]}>
          <circleGeometry args={[0.36, 56]} />
        </mesh>
      </group>
    </group>
  );
}

/** A low black shoe tray by the door with two pairs of trainers. */
function ShoeTray({ m }: { m: Materials }) {
  return (
    <group position={[-2.35, 0, HZ - 0.3]}>
      <RoundedBox
        args={[0.8, 0.03, 0.3]}
        radius={0.01}
        smoothness={3}
        position={[0, 0.015, 0]}
        material={m.black}
        receiveShadow
      />
      {[-0.2, 0.2].map((x, i) => (
        <group key={x} position={[x, 0.07, 0]} rotation={[0, 0.1 * (i ? -1 : 1), 0]}>
          <RoundedBox
            args={[0.1, 0.07, 0.26]}
            radius={0.03}
            smoothness={4}
            material={i ? m.black : m.ceramic}
          />
          <RoundedBox
            args={[0.1, 0.012, 0.27]}
            radius={0.005}
            smoothness={2}
            position={[0, -0.03, 0]}
            material={m.ceramic}
          />
        </group>
      ))}
    </group>
  );
}

/** A candle and a succulent on the window sill. */
function SillThings({ m }: { m: Materials }) {
  const y = WINDOW.bottom + 0.04;
  return (
    <group>
      <Plant kind="succulent" position={[-1.2, y, -HZ + 0.18]} scale={1.1} seed={21} />
      <mesh material={m.ceramic} position={[1.15, y + 0.04, -HZ + 0.18]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 20]} />
      </mesh>
      <mesh material={m.shade} position={[1.15, y + 0.095, -HZ + 0.18]}>
        <sphereGeometry args={[0.009, 8, 8]} />
      </mesh>
    </group>
  );
}

/** Warm LED under each floating shelf, a cove light along the ceiling edge, a light switch and a socket. */
function Glows({ m }: { m: Materials }) {
  const { palettes } = useRoom();
  const scratch = useMemo(() => new Color(), []);
  const glow = useMemo(() => new MeshBasicMaterial({ toneMapped: false }), []);
  useBlend((k) => {
    mixColour(scratch, palettes.night.glow, palettes.day.glow, k);
    glow.color.copy(scratch).multiplyScalar(MathUtils.lerp(1.5, 0.35, k));
  });
  return (
    <group>
      {[1.1, 1.55, 2.0].map((y) => (
        <mesh key={y} material={glow} position={[-HX + 0.13, y - 0.024, 2.0]}>
          <boxGeometry args={[0.012, 0.008, 1.3]} />
        </mesh>
      ))}
      <mesh material={glow} position={[0, ROOM.height - 0.04, -HZ + 0.03]}>
        <boxGeometry args={[ROOM.width - 0.2, 0.012, 0.02]} />
      </mesh>
      <mesh material={glow} position={[-HX + 0.03, ROOM.height - 0.04, 0]}>
        <boxGeometry args={[0.02, 0.012, ROOM.depth - 0.2]} />
      </mesh>
      <mesh material={glow} position={[HX - 0.03, ROOM.height - 0.04, 0]}>
        <boxGeometry args={[0.02, 0.012, ROOM.depth - 0.2]} />
      </mesh>
      <mesh material={m.ceramic} position={[-2.0, 1.2, HZ - 0.008]}>
        <boxGeometry args={[0.08, 0.08, 0.016]} />
      </mesh>
      <mesh material={m.black} position={[-2.0, 1.2, HZ - 0.018]}>
        <boxGeometry args={[0.012, 0.03, 0.006]} />
      </mesh>
      <mesh material={m.ceramic} position={[3.0, 0.32, -HZ + 0.008]}>
        <boxGeometry args={[0.08, 0.08, 0.016]} />
      </mesh>
    </group>
  );
}

export function Details({ m }: { m: Materials }) {
  return (
    <group>
      <DeskThings m={m} />
      <Basket m={m} />
      <Console m={m} />
      <ShoeTray m={m} />
      <SillThings m={m} />
      <Glows m={m} />
    </group>
  );
}
