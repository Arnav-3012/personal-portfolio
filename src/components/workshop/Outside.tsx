// What the window looks at: a sky that runs from night to day, a moon or sun, stars, a skyline of towers whose windows
// light up at night, rain when it rains in Mumbai (SPEC "Mumbai window"), and the glass with drops on it. All shader
// code and instancing, no images. Haze is mixed in the shaders, so the city thins with distance in both palettes.
import { useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BackSide,
  BoxGeometry,
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  MathUtils,
  Matrix4,
  type Mesh,
  Points,
  PointsMaterial,
  ShaderMaterial,
  Vector3,
} from 'three';
import { useFrame } from '@react-three/fiber';
import { mixColour } from '../../lib/workshop/palette';
import { seeded } from '../../lib/workshop/textures';
import { ROOM, WINDOW } from '../../lib/workshop/layout';
import { useBlend, useRoom } from './context';
import { keyDirection } from './Lighting';
import { setColour, uColour, uni } from './uniforms';

const TONE_TAIL = `
#include <tonemapping_fragment>
#include <colorspace_fragment>`;

const UV_VERT = `varying vec2 vUv;
void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

/* ---------------------------------- sky ---------------------------------- */

const SKY_VERT = `varying vec3 vDir;
void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SKY_FRAG = `uniform vec3 uTop; uniform vec3 uHorizon; uniform vec3 uHaze; varying vec3 vDir;
void main(){
  float h = vDir.y;
  vec3 c = mix(uHorizon, uTop, smoothstep(0.0, 0.5, h));
  c = mix(c, uHaze, smoothstep(0.16, -0.05, h) * 0.85);
  gl_FragColor = vec4(c, 1.0);${TONE_TAIL}
}`;

function Sky() {
  const { palettes } = useRoom();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTop: uColour(), uHorizon: uColour(), uHaze: uColour() },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const scratch = useMemo(() => new Color(), []);
  useBlend((k) => {
    const { night, day } = palettes;
    setColour(material, 'uTop', mixColour(scratch, night['sky-top'], day['sky-top'], k));
    setColour(
      material,
      'uHorizon',
      mixColour(scratch, night['sky-horizon'], day['sky-horizon'], k),
    );
    setColour(material, 'uHaze', mixColour(scratch, night.haze, day.haze, k));
  });
  return (
    <mesh material={material} renderOrder={-100} frustumCulled={false}>
      <sphereGeometry args={[600, 32, 16]} />
    </mesh>
  );
}

/* ------------------------------ moon and sun ------------------------------ */

const BODY_FRAG = `uniform vec3 uColor; uniform float uDisc; uniform float uGlow; varying vec2 vUv;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float disc = smoothstep(0.2, 0.17, d);
  float glow = exp(-d * d * 9.0);
  gl_FragColor = vec4(uColor * (disc * uDisc + glow * uGlow), 1.0);
}`;

function Celestial() {
  const { palettes } = useRoom();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uColor: uColour(), uDisc: { value: 1 }, uGlow: { value: 0.4 } },
        vertexShader: UV_VERT,
        fragmentShader: BODY_FRAG,
        blending: AdditiveBlending,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    [],
  );
  const scratch = useMemo(() => new Color(), []);
  const body = useRef<Mesh>(null);
  const dir = useMemo(() => new Vector3(), []);
  useBlend((k) => {
    // The moon and the sun sit where the key light comes from.
    body.current?.position.copy(keyDirection(k, dir)).multiplyScalar(300);
    body.current?.lookAt(0, 1.5, 0);
    setColour(material, 'uColor', mixColour(scratch, palettes.night.moon, palettes.day.moon, k));
    uni(material, 'uDisc').value = MathUtils.lerp(1.4, 3.2, k);
    uni(material, 'uGlow').value = MathUtils.lerp(0.5, 1.1, k);
  });
  return (
    <mesh ref={body} material={material} renderOrder={-90}>
      <planeGeometry args={[120, 120]} />
    </mesh>
  );
}

function Stars() {
  const { palettes, tier } = useRoom();
  const points = useMemo(() => {
    const rand = seeded(77);
    const positions: number[] = [];
    for (let i = 0; i < tier.stars; i++) {
      const theta = rand() * Math.PI * 2;
      const y = 0.06 + rand() * 0.94;
      const r = Math.sqrt(1 - y * y);
      positions.push(Math.cos(theta) * r * 560, y * 560, Math.sin(theta) * r * 560);
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const m = new PointsMaterial({
      size: 1.7,
      sizeAttenuation: false,
      transparent: true,
      depthWrite: false,
      fog: false,
    });
    const p = new Points(g, m);
    p.renderOrder = -95;
    p.frustumCulled = false;
    return p;
  }, [tier.stars]);
  const scratch = useMemo(() => new Color(), []);
  useBlend((k) => {
    const m = points.material as PointsMaterial;
    m.color.copy(mixColour(scratch, palettes.night.moon, palettes.day.moon, k));
    m.opacity = (1 - k) * 0.85;
    points.visible = k < 0.98;
  });
  return <primitive object={points} />;
}

/* -------------------------------- skyline -------------------------------- */

const CITY_VERT = `varying vec3 vW; varying vec3 vN;
void main(){
  vec4 p = vec4(position, 1.0);
  vN = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p;
  vN = normalize(mat3(instanceMatrix) * normal);
#endif
  vec4 w = modelMatrix * p;
  vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const CITY_FRAG = `uniform vec3 uCity; uniform vec3 uLit; uniform vec3 uHaze; uniform float uNight; uniform float uFog;
varying vec3 vW; varying vec3 vN;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  float side = abs(vN.x) > 0.5 ? 1.0 : 0.0;
  vec3 base = uCity * (vN.y > 0.5 ? 1.25 : (0.55 + 0.35 * side + 0.1 * vN.x));
  vec2 cell = vec2((side > 0.5 ? vW.z : vW.x) / 0.6, vW.y / 0.9);
  vec2 id = floor(cell);
  vec2 f = fract(cell);
  float seed = floor(vW.x / 11.0) * 7.0 + floor(vW.z / 13.0);
  float on = step(0.62, hash(id + seed));
  float win = step(0.2, f.x) * step(f.x, 0.8) * step(0.28, f.y) * step(f.y, 0.78);
  vec3 col = base + uLit * 0.55 * on * win * uNight * (vN.y > 0.5 ? 0.0 : 1.0);
  // By day the panes read as darker glass in the sunlit walls.
  col = mix(col, col * 0.72, win * (1.0 - uNight) * (vN.y > 0.5 ? 0.0 : 0.55));
  float d = length(vW - cameraPosition);
  col = mix(col, uHaze, 1.0 - exp(-d * uFog));
  gl_FragColor = vec4(col, 1.0);${TONE_TAIL}
}`;

function Skyline() {
  const { palettes, tier } = useRoom();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uCity: uColour(),
          uLit: uColour(),
          uHaze: uColour(),
          uNight: { value: 1 },
          uFog: { value: 0.0125 },
        },
        vertexShader: CITY_VERT,
        fragmentShader: CITY_FRAG,
      }),
    [],
  );
  const mesh = useMemo(() => {
    const rand = seeded(5);
    const m = new InstancedMesh(new BoxGeometry(1, 1, 1), material, tier.towers);
    const matrix = new Matrix4();
    for (let i = 0; i < tier.towers; i++) {
      const band = Math.floor(rand() * 3);
      const z = -(34 + band * 24 + rand() * 18);
      const x = (rand() - 0.5) * 190;
      const w = 4 + rand() * 8;
      const d = 4 + rand() * 8;
      const h = 20 + rand() ** 2 * 36 + (rand() < 0.05 ? 22 : 0);
      matrix.makeScale(w, h, d).setPosition(x, -32 + h / 2, z);
      m.setMatrixAt(i, matrix);
    }
    m.instanceMatrix.needsUpdate = true;
    m.frustumCulled = false;
    return m;
  }, [material, tier.towers]);
  const scratch = useMemo(() => new Color(), []);
  useBlend((k) => {
    const { night, day } = palettes;
    setColour(material, 'uCity', mixColour(scratch, night.city, day.city, k));
    setColour(material, 'uLit', mixColour(scratch, night['city-lit'], day['city-lit'], k));
    setColour(material, 'uHaze', mixColour(scratch, night.haze, day.haze, k));
    uni(material, 'uNight').value = 1 - k;
    // Clear air by day: the city stays crisp instead of dissolving into a pale haze.
    uni(material, 'uFog').value = MathUtils.lerp(0.0125, 0.004, k);
  });
  return <primitive object={mesh} />;
}

/* ------------------------------ rain and glass ------------------------------ */

const RAIN_VERT = `uniform float uTime; attribute float aEnd; attribute float aSeed; varying float vA;
void main(){
  vec3 p = position;
  float fall = mod(p.y - uTime * (24.0 + aSeed * 10.0), 48.0) - 14.0;
  p.y = fall + aEnd * 1.2;
  p.x += aEnd * 0.18;
  vA = 1.0 - aEnd * 0.4;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;
const RAIN_FRAG = `uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main(){ gl_FragColor = vec4(uColor, uOpacity * vA * 0.55); }`;

function Rain() {
  const { palettes, tier, weather } = useRoom();
  const rainy = weather?.raining === true;
  const built = useMemo(() => {
    const rand = seeded(9);
    const positions: number[] = [];
    const ends: number[] = [];
    const seeds: number[] = [];
    for (let i = 0; i < tier.rain; i++) {
      const x = (rand() - 0.5) * 70;
      const y = rand() * 48 - 14;
      const z = -(6 + rand() * 40);
      const seed = rand();
      for (const end of [0, 1]) {
        positions.push(x, y, z);
        ends.push(end);
        seeds.push(seed);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(positions, 3));
    g.setAttribute('aEnd', new Float32BufferAttribute(ends, 1));
    g.setAttribute('aSeed', new Float32BufferAttribute(seeds, 1));
    const m = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: uColour(), uOpacity: { value: 0 } },
      vertexShader: RAIN_VERT,
      fragmentShader: RAIN_FRAG,
      transparent: true,
      depthWrite: false,
    });
    return { g, m };
  }, [tier.rain]);
  const scratch = useMemo(() => new Color(), []);
  useBlend((k) => {
    setColour(
      built.m,
      'uColor',
      mixColour(scratch, palettes.night['sky-horizon'], palettes.day.haze, k).multiplyScalar(2.2),
    );
  });
  useFrame((state, dt) => {
    const o = uni(built.m, 'uOpacity');
    o.value = MathUtils.damp(o.value as number, rainy ? 1 : 0, 1.5, dt);
    uni(built.m, 'uTime').value = state.clock.elapsedTime;
    built.m.visible = (o.value as number) > 0.01;
  });
  return (
    <lineSegments geometry={built.g} material={built.m} renderOrder={2} frustumCulled={false} />
  );
}

const GLASS_FRAG = `uniform float uTime; uniform float uRain; uniform vec3 uSheen; varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 uv = vUv * vec2(26.0, 14.0);
  vec2 cell = floor(uv);
  vec2 f = fract(uv);
  float seed = hash(cell);
  vec2 centre = vec2(0.25 + 0.5 * hash(cell + 3.1), 0.3 + 0.4 * seed);
  vec2 q = (f - centre) * vec2(1.0, 1.25);
  float has = step(0.45, seed);
  float drop = smoothstep(0.17, 0.09, length(q)) * has;
  float rim = smoothstep(0.03, 0.0, abs(length(q) - 0.12)) * has;
  float trail = smoothstep(0.03, 0.0, abs(f.x - centre.x)) * step(f.y, centre.y) * step(0.8, seed) * 0.5;
  float a = uRain * (drop * 0.28 + rim * 0.3 + trail * 0.18);
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(vUv.x - 0.2 - vUv.y * 0.3) * 4.0) * 0.035;
  gl_FragColor = vec4(uSheen, a + sheen);
}`;

function Glass({ rainy }: { rainy: boolean }) {
  const { palettes } = useRoom();
  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uRain: { value: 0 }, uSheen: uColour() },
        vertexShader: UV_VERT,
        fragmentShader: GLASS_FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    [],
  );
  const scratch = useMemo(() => new Color(), []);
  useBlend((k) => {
    setColour(material, 'uSheen', mixColour(scratch, palettes.night.moon, palettes.day.haze, k));
  });
  useFrame((state, dt) => {
    uni(material, 'uTime').value = state.clock.elapsedTime;
    const r = uni(material, 'uRain');
    r.value = MathUtils.damp(r.value as number, rainy ? 1 : 0, 1.5, dt);
  });
  const height = WINDOW.top - WINDOW.bottom;
  return (
    <mesh
      material={material}
      position={[0, (WINDOW.top + WINDOW.bottom) / 2, -ROOM.depth / 2 + 0.06]}
      renderOrder={5}
    >
      <planeGeometry args={[WINDOW.width, height]} />
    </mesh>
  );
}

export function Outside() {
  const { weather } = useRoom();
  return (
    <group>
      <Sky />
      <Stars />
      <Celestial />
      <Skyline />
      <Rain />
      <Glass rainy={weather?.raining === true} />
    </group>
  );
}
