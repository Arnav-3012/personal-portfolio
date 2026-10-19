// Your arms in first person: two hoodie sleeves and two hands that hang from the shoulders at your sides and swing as you
// walk, exactly where your own arms are. They belong to the body, not the screen, so at eye level they are out of view and
// you see them when you look down, next to your chest and legs. They turn with the body and swing against the legs.
import { useMemo, useRef } from 'react';
import { CapsuleGeometry, Color, MeshStandardMaterial, type Group } from 'three';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { EYE_HEIGHT } from '../../lib/workshop/movement';
import { mixColour } from '../../lib/workshop/palette';
import { useBlend, useRoom, type FollowState } from './context';

/** Metres: where the shoulder sits below the eye and out from the middle, and the length of each arm segment. */
const SHOULDER = { x: 0.2, y: -0.2, z: -0.02 } as const;
const UPPER = 0.3;
const FORE = 0.28;
const SLEEVE_R = 0.045;

export function Hands({ visible, follow }: { visible: boolean; follow: FollowState }) {
  const { palettes, reduced } = useRoom();
  const root = useRef<Group>(null);
  const shoulders = useRef<(Group | null)[]>([]);
  const elbows = useRef<(Group | null)[]>([]);
  const mats = useMemo(() => {
    const make = (): MeshStandardMaterial => new MeshStandardMaterial({ roughness: 0.85 });
    return { sleeve: make(), skin: make(), scratch: new Color() };
  }, []);
  const geo = useMemo(
    () => ({
      upper: new CapsuleGeometry(SLEEVE_R, UPPER - SLEEVE_R * 2, 6, 12),
      fore: new CapsuleGeometry(SLEEVE_R * 0.9, FORE - SLEEVE_R * 1.8, 6, 12),
      finger: new CapsuleGeometry(0.0095, 0.04, 4, 8),
    }),
    [],
  );

  useBlend((k) => {
    mats.sleeve.color.copy(mixColour(mats.scratch, palettes.night.steel, palettes.day.steel, k));
    mats.skin.color.copy(mixColour(mats.scratch, palettes.night.skin, palettes.day.skin, k));
    // The room is dim at night; a little of their own colour keeps the hands readable.
    mats.skin.emissive.copy(mats.skin.color).multiplyScalar(0.18);
    mats.sleeve.emissive.copy(mats.sleeve.color).multiplyScalar(0.3);
  });

  useFrame((state) => {
    const g = root.current;
    if (!g || !g.visible) return;
    g.position.set(follow.x, EYE_HEIGHT, follow.z);
    g.rotation.y = follow.yaw;
    const amp = reduced ? follow.bob * 0.4 : follow.bob;
    const t = state.clock.elapsedTime;
    // The same stride as the legs: the left arm goes forward as the left leg goes back. Forward is +z, so forward is a
    // negative turn about x.
    const swing = Math.sin(follow.phase) * 0.55 * amp;
    ([-1, 1] as const).forEach((side, i) => {
      const shoulder = shoulders.current[i];
      const elbow = elbows.current[i];
      if (shoulder) {
        shoulder.rotation.x = side === -1 ? -swing : swing;
        shoulder.rotation.z = side * (0.05 + Math.sin(t * 1.1 + i) * 0.004);
      }
      // A relaxed bend at the elbow that deepens a little as the arm comes forward.
      if (elbow) {
        const forward = side === -1 ? swing : -swing;
        elbow.rotation.x = -(0.22 + Math.max(0, forward) * 0.9 + amp * 0.12);
      }
    });
  });

  return (
    <group ref={root} visible={visible}>
      {([-1, 1] as const).map((side, i) => (
        <group
          key={side}
          position={[side * SHOULDER.x, SHOULDER.y, SHOULDER.z]}
          ref={(g) => {
            shoulders.current[i] = g;
          }}
        >
          <mesh geometry={geo.upper} material={mats.sleeve} position={[0, -UPPER / 2, 0]} />
          <group
            position={[0, -UPPER, 0]}
            ref={(g) => {
              elbows.current[i] = g;
            }}
          >
            <mesh geometry={geo.fore} material={mats.sleeve} position={[0, -FORE / 2, 0]} />
            {/* a loose hand: a rounded palm and four fingers curled a little, the thumb along the side */}
            <group position={[0, -FORE - 0.02, 0.005]}>
              <RoundedBox
                args={[0.07, 0.085, 0.032]}
                radius={0.013}
                smoothness={3}
                material={mats.skin}
              />
              {[-0.025, -0.008, 0.008, 0.025].map((x, n) => (
                <mesh
                  key={x}
                  geometry={geo.finger}
                  material={mats.skin}
                  position={[x, -0.075 - (n === 1 || n === 2 ? 0.006 : 0), -0.012]}
                  rotation={[0.45, 0, 0]}
                />
              ))}
              <mesh
                geometry={geo.finger}
                material={mats.skin}
                position={[side * -0.04, -0.03, -0.014]}
                rotation={[0.2, 0, side * 0.5]}
              />
            </group>
          </group>
        </group>
      ))}
    </group>
  );
}
