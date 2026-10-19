// The walking figure's body (SPEC "Camera and navigation": optional free-roam). There is no head: the view is always from the eyes, and
// when a zone is open the figure is hidden altogether, so the object has the whole frame. Looking down you see your chest in a black hoodie, greige trousers and off-white
// trainers, which swing as you walk; your hands and forearms are in Hands.tsx, locked to the view. The body faces where you
// look. It has no likeness of anyone; Meshy or Mixamo can replace it later, as the controller only moves a group.
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { CapsuleGeometry, CircleGeometry, Color, MeshStandardMaterial, type Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { mixColour, type RoomKey } from '../../lib/workshop/palette';
import { useBlend, useRoom } from './context';

export interface AvatarHandle {
  /** Places the body, turns it to face `heading`, and sets the stride (`phase`, radians) and how wide it is (`amp`, 0 to 1). */
  set(x: number, z: number, heading: number, phase: number, amp: number): void;
}

const LEG = 0.8;

export const Avatar = forwardRef<AvatarHandle>(function Avatar(_props, ref) {
  const { palettes, reduced } = useRoom();
  const root = useRef<Group>(null);
  const legL = useRef<Group>(null);
  const legR = useRef<Group>(null);
  const state = useRef({ phase: 0, amp: 0 });

  const mats = useMemo(() => {
    const std = (r: number): MeshStandardMaterial => new MeshStandardMaterial({ roughness: r });
    return {
      hoodie: std(0.9),
      trousers: std(0.85),
      shoes: std(0.6),
      scratch: new Color(),
    };
  }, []);
  const geo = useMemo(
    () => ({
      leg: new CapsuleGeometry(0.058, LEG - 0.2, 6, 12),
      torso: new CapsuleGeometry(0.15, 0.44, 8, 16),
      shadow: new CircleGeometry(0.34, 24),
    }),
    [],
  );
  const shadow = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color(0x000000),
        transparent: true,
        opacity: 0.2,
        roughness: 1,
      }),
    [],
  );

  useBlend((k) => {
    const mix = (key: RoomKey): Color =>
      mixColour(mats.scratch, palettes.night[key], palettes.day[key], k);
    mats.hoodie.color.copy(mix('steel'));
    mats.trousers.color.copy(mix('wall-low'));
    mats.shoes.color.copy(mix('paper'));
  });

  useImperativeHandle(ref, () => ({
    set(x, z, heading, phase, amp) {
      const g = root.current;
      if (!g) return;
      g.position.set(x, 0, z);
      g.rotation.y = heading;
      state.current.phase = phase;
      state.current.amp = amp;
    },
  }));

  useFrame(() => {
    const st = state.current;
    const swing = Math.sin(st.phase) * 0.7 * st.amp * (reduced ? 0.5 : 1);
    if (legL.current) legL.current.rotation.x = swing;
    if (legR.current) legR.current.rotation.x = -swing;
  });

  return (
    <group ref={root}>
      <mesh
        geometry={geo.shadow}
        material={shadow}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.012, 0]}
      />
      {/* legs pivot at the hip; the body stands a little behind the eyes, so the feet show when you look down */}
      <group position={[0, 0, -0.02]}>
        {([-1, 1] as const).map((side) => (
          <group key={side} ref={side === -1 ? legL : legR} position={[side * 0.1, LEG + 0.02, 0]}>
            <mesh geometry={geo.leg} material={mats.trousers} position={[0, -LEG / 2, 0]} />
            <mesh material={mats.shoes} position={[0, -LEG + 0.03, 0.06]}>
              <boxGeometry args={[0.11, 0.07, 0.26]} />
            </mesh>
          </group>
        ))}
        <mesh
          geometry={geo.torso}
          material={mats.hoodie}
          position={[0, 1.14, -0.02]}
          scale={[1.12, 1, 0.78]}
        />
      </group>
    </group>
  );
});
