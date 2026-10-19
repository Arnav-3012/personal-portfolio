// Where each object will live (SPEC "Zones and hotspots"): a small, soft glow of hologram light on the spot, brighter on
// hover or when the walking figure stands beside it, with a mono label (`[ E ] OPEN HOLOTABLE`). A click flies the camera
// there. These are the generic hotspot kit the props will reuse. The keyboard route is the HUD list; the glows are for the
// mouse and touch, so they are not tab stops. The glow is a feathered ring and core in a shader, with no hard edge.
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdditiveBlending, Color, Group, MathUtils, ShaderMaterial } from 'three';
import { Billboard, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { ZONE_SPOTS } from '../../lib/workshop/layout';
import { useBlend, useRoom } from './context';
import { mixColour } from '../../lib/workshop/palette';
import { uni } from './uniforms';

export interface ZoneInfo {
  id: string;
  title: string;
  blurb: string;
  href: string;
}

const VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
// A soft ring, a faint core and a wide halo, all gaussian: nothing has an edge.
const FRAG = `uniform vec3 uColor; uniform float uAmount; varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float ring = exp(-pow((d - 0.5) / 0.14, 2.0)) * 0.55;
  float core = exp(-pow(d / 0.16, 2.0)) * 0.55;
  float halo = exp(-d * d * 4.5) * 0.12;
  gl_FragColor = vec4(uColor * (ring + core + halo) * uAmount, 1.0);
}`;

const SIZE = 0.34;
const IDLE = 0.34;
const HOVER = 1.0;
const ACTIVE = 0.22;
/** Standing beside it while walking: a gentle lift, never the full glow (that saturates to a white disc as you pass). */
const BESIDE = 0.5;

function Marker({
  zone,
  index,
  colour,
  active,
  hover,
  beside,
  onHover,
  onSelect,
}: {
  zone: ZoneInfo;
  index: number;
  colour: { value: Color };
  active: boolean;
  /** The mouse is over it. */
  hover: boolean;
  /** The walking figure is standing beside it. */
  beside: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}) {
  const { reduced } = useRoom();
  const spot = ZONE_SPOTS[zone.id];
  const group = useRef<Group>(null);
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: colour, uAmount: { value: IDLE } },
        vertexShader: VERT,
        fragmentShader: FRAG,
        blending: AdditiveBlending,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      }),
    [colour],
  );
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const breathe = reduced ? 0 : Math.sin(state.clock.elapsedTime * 1.4 + index) * 0.06;
    const goal = (hover ? 1.25 : beside ? 1.08 : active ? 0.8 : 1) + breathe;
    g.scale.setScalar(MathUtils.damp(g.scale.x, goal, 4, dt));
    const amount = uni(material, 'uAmount');
    amount.value = MathUtils.damp(
      amount.value as number,
      hover ? HOVER : beside ? BESIDE : active ? ACTIVE : IDLE,
      4,
      dt,
    );
  });
  if (!spot) return null;
  return (
    <group position={spot.marker}>
      <Billboard>
        <group ref={group}>
          <mesh material={material} renderOrder={10}>
            <planeGeometry args={[SIZE, SIZE]} />
          </mesh>
        </group>
        <mesh
          visible={false}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(zone.id);
          }}
          onPointerOut={() => onHover(null)}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(zone.id);
          }}
        >
          <sphereGeometry args={[0.28, 8, 8]} />
        </mesh>
      </Billboard>
      {(hover || beside) && (
        <Html center position={[0, 0.3, 0]} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <span className="rm-tag" aria-hidden="true">
            [ E ] OPEN {zone.title}
          </span>
        </Html>
      )}
    </group>
  );
}

export function Markers({
  zones,
  active,
  near,
  onSelect,
}: {
  zones: readonly ZoneInfo[];
  active: string | null;
  /** The zone the walking figure is standing beside, if any. */
  near: string | null;
  onSelect: (id: string) => void;
}) {
  const { palettes } = useRoom();
  const [hovered, setHovered] = useState<string | null>(null);
  const colour = useMemo(() => ({ value: new Color() }), []);
  useBlend((k) => {
    mixColour(colour.value, palettes.night.holo, palettes.day.holo, k).multiplyScalar(
      MathUtils.lerp(1.0, 0.85, k),
    );
  });

  useEffect(() => {
    document.body.style.cursor = hovered ? 'pointer' : '';
    if (!hovered) return;
    const onKey = (e: KeyboardEvent): void => {
      if ((e.key === 'e' || e.key === 'E') && !e.ctrlKey && !e.metaKey && !e.altKey)
        onSelect(hovered);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.cursor = '';
    };
  }, [hovered, onSelect]);

  return (
    <group>
      {zones.map((zone, i) => (
        <Marker
          key={zone.id}
          zone={zone}
          index={i}
          colour={colour}
          active={active === zone.id}
          hover={hovered === zone.id}
          beside={near === zone.id}
          onHover={setHovered}
          onSelect={onSelect}
        />
      ))}
    </group>
  );
}
