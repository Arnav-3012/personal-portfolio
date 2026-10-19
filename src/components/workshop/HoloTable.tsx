// The holotable (SPEC "The Workshop"): a low, wide slab in the manner of a command table in a sci-fi lab. A matte black plinth
// carries a thin black slab that seems to hover on a line of cyan light; the top is dark glass with a fine grid, corner
// brackets, three emitter lenses and a faint scan line; light pools on the floor below, and four threads of light rise from
// the corners to frame the volume where the projection will play (the table's OS comes in task 2.7). All procedural: a few
// meshes and three small shaders, tinted from the room's `holo` token.
import { useMemo } from 'react';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  MathUtils,
  MeshBasicMaterial,
  PlaneGeometry,
  ShaderMaterial,
  Vector2,
  type MeshStandardMaterial,
} from 'three';
import { RoundedBox } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { TABLE } from '../../lib/workshop/layout';
import { mixColour } from '../../lib/workshop/palette';
import { useBlend, useRoom } from './context';
import { box, merge } from './geometry';
import { setColour, uni } from './uniforms';

const VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/** The glass top, in metres from its centre: grid, rim line, corner brackets, emitter lenses, a slow scan. */
const TOP_FRAG = `uniform vec3 uColor; uniform float uStrength; uniform float uScan; uniform float uTime; uniform vec2 uSize; varying vec2 vUv;
float line(float v, float w){ return smoothstep(w, 0.0, abs(v)); }
void main(){
  vec2 p = (vUv - 0.5) * uSize;
  vec2 h = uSize * 0.5;
  vec2 q = abs(p) - (h - 0.035);
  float rim = line(max(q.x, q.y), 0.005) * 0.85;
  vec2 g = abs(fract(p / 0.1 + 0.5) - 0.5) * 0.1;
  vec2 gm = abs(fract(p / 0.5 + 0.5) - 0.5) * 0.5;
  float grid = line(min(g.x, g.y), 0.0016) * 0.13 + line(min(gm.x, gm.y), 0.0025) * 0.2;
  vec2 d = (h - 0.1) - abs(p);
  float arms = max(line(d.x, 0.006) * step(0.0, d.y) * step(d.y, 0.22), line(d.y, 0.006) * step(0.0, d.x) * step(d.x, 0.22)) * 0.9;
  float lens = 0.0;
  for (int i = 0; i < 3; i++) {
    float cx = (float(i) - 1.0) * 0.72;
    float rad = i == 1 ? 0.2 : 0.13;
    float r = length(p - vec2(cx, 0.0));
    lens += line(r - rad, 0.005) * 0.8 + line(r - rad * 0.55, 0.003) * 0.4 + smoothstep(0.035, 0.0, r) * 0.9 + exp(-r * r * 38.0) * 0.22;
  }
  float s = fract(uTime * 0.11);
  float scan = exp(-pow((vUv.x - s) / 0.018, 2.0)) * 0.3 * uScan * smoothstep(0.0, 0.1, s) * smoothstep(1.0, 0.9, s);
  float pool = exp(-dot(p / h, p / h) * 1.8) * 0.09;
  float fade = smoothstep(0.0, 0.015, h.x - abs(p.x)) * smoothstep(0.0, 0.015, h.y - abs(p.y));
  gl_FragColor = vec4(uColor * (rim + grid + arms + lens + scan + pool) * fade * uStrength, 1.0);
}`;

/** Light on the floor around the plinth: a soft rounded-rectangle glow. */
const FLOOR_FRAG = `uniform vec3 uColor; uniform float uStrength; uniform vec2 uSize; varying vec2 vUv;
void main(){
  vec2 p = (vUv - 0.5) * uSize;
  vec2 q = abs(p) - vec2(0.95, 0.38);
  float d = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0);
  float a = exp(-max(d, 0.0) * max(d, 0.0) * 7.0) * 0.5;
  vec2 e = 0.5 - abs(vUv - 0.5);
  a *= smoothstep(0.0, 0.18, min(e.x, e.y));
  gl_FragColor = vec4(uColor * a * uStrength, 1.0);
}`;

/** Threads of light rising from the corners, brightest at the glass and gone before the top; and a faint frame at the top. */
const THREAD_FRAG = `uniform vec3 uColor; uniform float uStrength; varying vec2 vUv;
void main(){
  float across = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float rise = pow(1.0 - vUv.y, 1.6);
  gl_FragColor = vec4(uColor * across * across * rise * 0.55 * uStrength, 1.0);
}`;
const FRAME_FRAG = `uniform vec3 uColor; uniform float uStrength; uniform vec2 uSize; varying vec2 vUv;
float line(float v, float w){ return smoothstep(w, 0.0, abs(v)); }
void main(){
  vec2 p = (vUv - 0.5) * uSize;
  vec2 h = uSize * 0.5;
  vec2 q = abs(p) - h;
  float rim = line(max(q.x, q.y), 0.006) * 0.55;
  vec2 d = h - abs(p);
  float arms = max(line(d.x, 0.008) * step(d.y, 0.16), line(d.y, 0.008) * step(d.x, 0.16)) * 0.5;
  gl_FragColor = vec4(uColor * (rim + arms + 0.012) * uStrength, 1.0);
}`;

const additive = (fragment: string, size?: [number, number]): ShaderMaterial =>
  new ShaderMaterial({
    uniforms: {
      uColor: { value: new Color() },
      uStrength: { value: 1 },
      uScan: { value: 1 },
      uTime: { value: 0 },
      uSize: { value: new Vector2(size?.[0] ?? 1, size?.[1] ?? 1) },
    },
    vertexShader: VERT,
    fragmentShader: fragment,
    blending: AdditiveBlending,
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
  });

const TOP = { w: TABLE.width - 0.1, d: TABLE.depth - 0.1 } as const;
const VOLUME = { w: TABLE.width - 0.5, d: TABLE.depth - 0.3, h: 0.62 } as const;
const PLINTH = { w: TABLE.width - 0.4, d: TABLE.depth - 0.4, h: 0.56 } as const;
const SLAB = { thick: 0.2 } as const;

export function HoloTable({
  glass,
  black,
}: {
  glass: MeshStandardMaterial;
  black: MeshStandardMaterial;
}) {
  const { palettes, reduced } = useRoom();
  const scratch = useMemo(() => new Color(), []);
  const mats = useMemo(
    () => ({
      top: additive(TOP_FRAG, [TOP.w, TOP.d]),
      floor: additive(FLOOR_FRAG, [TABLE.width + 1.4, TABLE.depth + 1.2]),
      thread: additive(THREAD_FRAG),
      frame: additive(FRAME_FRAG, [VOLUME.w, VOLUME.d]),
      // The line of light the slab hovers on, and its edge lines: strong enough to bloom at night.
      line: new MeshBasicMaterial({ toneMapped: false }),
    }),
    [],
  );
  const geo = useMemo(() => {
    const y = TABLE.height - SLAB.thick;
    // A hairline of light along the lower edge of the slab's four sides, and the gap it hovers over.
    const edge = merge([
      box(TABLE.width - 0.06, 0.008, 0.004, 0, y + 0.03, TABLE.depth / 2 + 0.001),
      box(TABLE.width - 0.06, 0.008, 0.004, 0, y + 0.03, -TABLE.depth / 2 - 0.001),
      box(0.004, 0.008, TABLE.depth - 0.06, TABLE.width / 2 + 0.001, y + 0.03, 0),
      box(0.004, 0.008, TABLE.depth - 0.06, -TABLE.width / 2 - 0.001, y + 0.03, 0),
      box(PLINTH.w + 0.02, 0.016, PLINTH.d + 0.02, 0, PLINTH.h + 0.01, 0),
    ]);
    // Eight crossing strips: a thread at each corner of the volume, seen from any side.
    const strips: PlaneGeometry[] = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        for (const turn of [0, Math.PI / 2]) {
          const p = new PlaneGeometry(0.03, VOLUME.h);
          p.rotateY(turn);
          p.translate((sx * VOLUME.w) / 2, VOLUME.h / 2, (sz * VOLUME.d) / 2);
          // Flip v so 0 is the glass and 1 the top.
          const uv = p.getAttribute('uv');
          for (let i = 0; i < uv.count; i++) uv.setY(i, 1 - uv.getY(i));
          strips.push(p);
        }
    return { edge, threads: merge(strips) };
  }, []);

  useBlend((k) => {
    const holo = mixColour(scratch, palettes.night.holo, palettes.day.holo, k);
    for (const m of [mats.top, mats.floor, mats.thread, mats.frame]) setColour(m, 'uColor', holo);
    const strength = MathUtils.lerp(1.5, 1.35, k);
    for (const m of [mats.top, mats.floor, mats.thread, mats.frame])
      uni(m, 'uStrength').value = strength;
    uni(mats.floor, 'uStrength').value = MathUtils.lerp(1.3, 0.55, k);
    mats.line.color.copy(holo).multiplyScalar(MathUtils.lerp(2.2, 1.5, k));
  });
  useFrame((state) => {
    uni(mats.top, 'uTime').value = reduced ? 0 : state.clock.elapsedTime;
    uni(mats.top, 'uScan').value = reduced ? 0 : 1;
  });

  const slabY = TABLE.height - SLAB.thick / 2;
  return (
    <group position={[TABLE.x, 0, TABLE.z]}>
      <mesh material={black} position={[0, PLINTH.h / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[PLINTH.w, PLINTH.h, PLINTH.d]} />
      </mesh>
      <mesh geometry={geo.edge} material={mats.line} />
      <RoundedBox
        args={[TABLE.width, SLAB.thick, TABLE.depth]}
        radius={0.03}
        smoothness={3}
        material={black}
        position={[0, slabY, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        material={glass}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TABLE.height + 0.003, 0]}
      >
        <planeGeometry args={[TOP.w, TOP.d]} />
      </mesh>
      <mesh
        material={mats.top}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TABLE.height + 0.006, 0]}
        renderOrder={3}
      >
        <planeGeometry args={[TOP.w, TOP.d]} />
      </mesh>
      <mesh
        material={mats.floor}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.045, 0]}
        renderOrder={2}
      >
        <planeGeometry args={[TABLE.width + 1.4, TABLE.depth + 1.2]} />
      </mesh>
      <mesh
        geometry={geo.threads}
        material={mats.thread}
        position={[0, TABLE.height, 0]}
        renderOrder={3}
      />
      <mesh
        material={mats.frame}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, TABLE.height + VOLUME.h, 0]}
        renderOrder={3}
      >
        <planeGeometry args={[VOLUME.w, VOLUME.d]} />
      </mesh>
    </group>
  );
}
