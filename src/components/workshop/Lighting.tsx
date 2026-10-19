// Light is the room's decoration (SPEC "Look: day and night"). One shadow-casting key light comes through the window (cool
// moon at night, warm sun by day), soft pendants and lamps glow at night, a faint cyan light sits on the holotable plinth,
// and a soft environment fills the shadows. Everything cross-fades with the day/night blend.
import { useEffect, useMemo, useRef } from 'react';
import {
  Color,
  MathUtils,
  Vector3,
  type DirectionalLight,
  type HemisphereLight,
  type PointLight,
} from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AccumulativeShadows,
  useProgress,
  Environment,
  Lightformer,
  RandomizedLight,
} from '@react-three/drei';
import { mixColour } from '../../lib/workshop/palette';
import { DOOR, LIGHTS, TABLE, WINDOW } from '../../lib/workshop/layout';
import { useBlend, useRoom } from './context';

/** Direction from the room towards the moon or sun: out of the back window, a little left. The sun stands higher than the moon, so by day it throws clear patches of light across the floor. */
export const keyDirection = (k: number, out: Vector3 = new Vector3()): Vector3 =>
  out.set(-0.25, MathUtils.lerp(0.28, 0.62, k), -1).normalize();
const KEY_DISTANCE = 20;

export function Lighting() {
  const { palettes, tier, blend } = useRoom();
  const gl = useThree((s) => s.gl);
  // Only the number, so the many loader events do not re-render the lights.
  const progress = useProgress((s) => s.progress);
  const scene = useThree((s) => s.scene);
  const key = useRef<DirectionalLight>(null);
  const hemi = useRef<HemisphereLight>(null);
  const lamps = useRef<(PointLight | null)[]>([]);
  const holo = useRef<PointLight>(null);
  const desk = useRef<PointLight>(null);
  const screens = useRef<PointLight>(null);
  const cases = useRef<PointLight>(null);
  const scratch = useMemo(() => new Color(), []);
  const dir = useMemo(() => new Vector3(), []);
  useBlend((k) => {
    const { night, day } = palettes;
    if (key.current) {
      key.current.color.copy(mixColour(scratch, night.key, day.key, k));
      key.current.intensity = MathUtils.lerp(1.2, 3.8, k);
      key.current.position.copy(keyDirection(k, dir)).multiplyScalar(KEY_DISTANCE);
    }
    if (hemi.current) {
      hemi.current.color.copy(mixColour(scratch, night.glow, day.glow, k));
      hemi.current.groundColor.copy(mixColour(scratch, night['wall-low'], day['wall-low'], k));
      hemi.current.intensity = MathUtils.lerp(0.9, 1.35, k);
    }
    lamps.current.forEach((lamp, i) => {
      if (!lamp) return;
      lamp.color.copy(mixColour(scratch, night.glow, day.glow, k));
      lamp.intensity = MathUtils.lerp(i < 2 ? 11 : 8, 0, k);
    });
    if (desk.current) {
      desk.current.color.copy(mixColour(scratch, night.glow, day.glow, k));
      desk.current.intensity = MathUtils.lerp(5, 0, k);
    }
    if (screens.current) {
      screens.current.color
        .copy(mixColour(scratch, night.holo, day.holo, k))
        .lerp(scratch.set(0xffffff), 0.6);
      screens.current.intensity = MathUtils.lerp(2.2, 0.4, k);
    }
    if (cases.current) {
      cases.current.color.copy(mixColour(scratch, night.glow, day.glow, k));
      cases.current.intensity = MathUtils.lerp(6, 1, k);
    }
    if (holo.current) {
      holo.current.color.copy(mixColour(scratch, night.holo, day.holo, k));
      holo.current.intensity = MathUtils.lerp(1.8, 0.7, k);
    }
    scene.environmentIntensity = MathUtils.lerp(0.28, 0.9, k);
    gl.toneMappingExposure = MathUtils.lerp(1.25, 1.1, k);
  });

  // The room never moves, so its shadows are drawn only while they can change: the first moments (models still arriving, the
  // soft contact shadows baking), a tier change, and the minute the light travels between day and night. Every other frame
  // skips the whole shadow pass, which is a large part of what keeps the walk smooth.
  const settle = useRef(0);
  useEffect(() => {
    settle.current = 0;
  }, [progress, tier]);
  useFrame(() => {
    settle.current += 1;
    gl.shadowMap.autoUpdate = settle.current < 90 || blend.changed;
  }, -5);
  useEffect(() => () => void (gl.shadowMap.autoUpdate = true), [gl]);

  // The environment map is drawn once from these light panels. As an element built once, a re-render of this component hands
  // drei the very same children, so the map is not re-rendered (which showed as a one or two frame flash of brighter light).
  const environment = useMemo(
    () => (
      <Environment resolution={128} frames={1}>
        <Lightformer
          form="rect"
          intensity={2.6}
          position={[0, 2.2, -4.6]}
          scale={[WINDOW.width, 2.6, 1]}
        />
        <Lightformer
          form="rect"
          intensity={1.1}
          rotation-x={Math.PI / 2}
          position={[0, 4, 0]}
          scale={[8, 8, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          rotation-y={Math.PI / 2}
          position={[-5, 2, 0]}
          scale={[6, 3, 1]}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          rotation-y={-Math.PI / 2}
          position={[5, 2, 0]}
          scale={[6, 3, 1]}
        />
      </Environment>
    ),
    [],
  );

  return (
    <group>
      <hemisphereLight ref={hemi} />
      <directionalLight
        key={tier.shadowMap}
        ref={key}
        position={keyDirection(0).multiplyScalar(KEY_DISTANCE).toArray()}
        castShadow
        shadow-mapSize={[tier.shadowMap, tier.shadowMap]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={8}
        shadow-camera-bottom={-8}
        shadow-camera-near={2}
        shadow-camera-far={48}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
      {[...LIGHTS.pendants, LIGHTS.floorLamp.shade].map(([x, y, z], i) => (
        <pointLight
          key={`${x}:${z}`}
          ref={(l) => {
            lamps.current[i] = l;
          }}
          position={[x, y, z]}
          distance={9}
          decay={2}
        />
      ))}
      <pointLight
        position={[DOOR.x, 2.3, 5.6]}
        color={0xffd9a3}
        intensity={2}
        distance={4}
        decay={2}
      />
      <pointLight
        ref={holo}
        position={[TABLE.x, TABLE.height + 0.95, TABLE.z]}
        distance={5}
        decay={2}
      />
      <pointLight ref={desk} position={[4.56, 1.14, -3.78]} distance={4} decay={2} />
      <pointLight ref={screens} position={[4.15, 1.15, -3.5]} distance={3} decay={2} />
      <pointLight ref={cases} position={[-4.3, 1.4, -0.8]} distance={5} decay={2} />
      {environment}
      {tier.bakedShadowFrames > 0 && (
        <AccumulativeShadows
          key={tier.bakedShadowFrames}
          temporal={false}
          frames={tier.bakedShadowFrames}
          alphaTest={0.85}
          opacity={0.85}
          scale={12}
          position={[0, 0.003, 0]}
          color="black"
        >
          <RandomizedLight
            amount={8}
            radius={3.4}
            ambient={0.6}
            intensity={1.1}
            position={[1, 3.4, 1]}
            bias={0.001}
          />
        </AccumulativeShadows>
      )}
    </group>
  );
}
