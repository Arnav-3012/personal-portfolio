// The 3D workshop (SPEC "The Workshop"): React Three Fiber, lazy-loaded by /workshop only. This is the root: it reads the
// room's palettes from the tokens, follows the site's theme for day and night, keeps the quality tier, owns which object
// is selected, and lays the HUD over the canvas. The scene itself lives in Shell, Lighting, Outside, Markers and Rig.
import { Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ACESFilmicToneMapping } from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor, useProgress } from '@react-three/drei';
import { Bloom, EffectComposer, Noise, ToneMapping, Vignette } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { readPalettes } from '../../lib/workshop/palette';
import { OVERVIEW, ZONE_SPOTS } from '../../lib/workshop/layout';
import { mumbaiClock } from '../../lib/workshop/room-clock';
import {
  RESOLUTION_STEPS,
  TIERS,
  readDevice,
  startingTier,
  type Tier,
} from '../../lib/workshop/quality';
import { settings } from '../../lib/settings';
import { toast } from '../../lib/toast';
import { isTypingTarget } from '../../lib/workshop/typing';
import { AVATAR_START } from '../../lib/workshop/layout';
import {
  RoomContext,
  stepBlend,
  type Blend,
  type FollowState,
  type RoomState,
  type Weather,
} from './context';
import { Walker } from './Walker';
import { Shell } from './Shell';
import { Props } from './Props';
import { Lighting } from './Lighting';
import { Outside } from './Outside';
import { Rig } from './Rig';
import { Markers, type ZoneInfo } from './Markers';
import { Hud, type RoomCopy } from './Hud';

export interface RoomData {
  room: RoomCopy;
  zones: ZoneInfo[];
}
export interface RoomHooks {
  onProgress: (ratio: number) => void;
  onReady: () => void;
}

const html = (): HTMLElement => document.documentElement;
const readPhase = (): 'day' | 'night' => (html().dataset['theme'] === 'day' ? 'day' : 'night');
const readReduced = (): boolean => html().dataset['motion'] === 'reduced';

/**
 * Mouse-look: while walking, the pointer is captured so moving the mouse turns the head (like any first-person view), with no
 * dragging. It needs a user gesture, which the Walk button, F and Esc-back all are. If the browser refuses, the drag-to-look in
 * Walker still works. Esc frees the pointer first (the browser's own rule); a second Esc stops walking.
 */
const capturePointer = (): void => {
  const canvas = document.querySelector<HTMLCanvasElement>('.rm canvas');
  try {
    void Promise.resolve(canvas?.requestPointerLock()).catch(() => undefined);
  } catch {
    // Unsupported or refused: dragging still looks around.
  }
};
const freePointer = (): void => {
  if (document.pointerLockElement) document.exitPointerLock();
};

/**
 * The effects stack (bloom, vignette, grain, tone mapping). It is its own memoised component on purpose: the composer rebuilds
 * its passes whenever its children are new elements, and for a frame or two the picture is drawn without the final tone
 * mapping (a washed-out, brighter flash). Room re-renders whenever the figure walks past a zone, so the stack must not be
 * rebuilt with it; it only renders again when day and night change.
 */
const PostStack = memo(function PostStack({ day }: { day: boolean }) {
  return (
    <EffectComposer multisampling={2}>
      <Bloom
        intensity={day ? 0.1 : 0.6}
        luminanceThreshold={day ? 1.1 : 0.9}
        luminanceSmoothing={0.25}
        mipmapBlur
        levels={5}
      />
      <Vignette offset={0.28} darkness={0.55} />
      <Noise opacity={0.04} blendFunction={BlendFunction.SOFT_LIGHT} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
});

function BlendDriver({ blend, reduced }: { blend: Blend; reduced: boolean }) {
  useFrame((_, dt) => stepBlend(blend, dt, reduced), -10);
  return null;
}

/** Reports the real download progress of the models, then compiles every shader before the loader goes away. */
function Boot({ hooks }: { hooks: RoomHooks }) {
  const { gl, scene, camera } = useThree();
  const { progress } = useProgress();
  const { onProgress, onReady } = hooks;
  useEffect(() => onProgress(0.05 + (progress / 100) * 0.75), [progress, onProgress]);
  useEffect(() => {
    if (progress < 100) return;
    let alive = true;
    void (async () => {
      // Let the loaded models mount, then compile.
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        // A failed pre-compile only costs a stall on the first frame.
      }
      onProgress(0.92);
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      );
      if (!alive) return;
      onProgress(1);
      onReady();
    })();
    return () => {
      alive = false;
    };
  }, [progress, gl, scene, camera, onProgress, onReady]);
  return null;
}

// The static parts of the scene take no props, so a re-render of Room (the figure passing a zone, the clock) must not re-render
// them: re-rendering the lights rebuilt the environment lighting, which flashed the picture brighter for a frame or two.
const StaticOutside = memo(Outside);
const StaticLighting = memo(Lighting);
const StaticShell = memo(Shell);
const StaticProps = memo(Props);

export default function Room({ data, hooks }: { data: RoomData; hooks: RoomHooks }) {
  const store = useMemo(() => settings(), []);
  const device = useMemo(() => readDevice(), []);
  const palettes = useMemo(() => readPalettes(), []);
  const [quality, setQuality] = useState(store.get().quality);
  const [tier, setTier] = useState<Tier>(() => startingTier(store.get().quality, device));
  // How far the picture's resolution has stepped down because frames dropped (an index into RESOLUTION_STEPS).
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState(readPhase);
  const [reduced, setReduced] = useState(readReduced);
  const [weather, setWeather] = useState<Weather | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  // Free-roam is for desktops with a mouse (SPEC: phones keep the tap-to-hotspot tour).
  const [canWalk] = useState(() => matchMedia('(pointer: fine)').matches && innerWidth >= 768);
  const [follow] = useState<FollowState>(() => ({
    x: AVATAR_START[0],
    z: AVATAR_START[1],
    heading: Math.PI,
    yaw: Math.PI,
    pitch: -0.08,
    bob: 0,
    phase: 0,
    arrive: 0,
  }));
  const [clock, setClock] = useState(() => mumbaiClock());
  const warned = useRef(false);

  const [blend] = useState<Blend>(() => {
    const k = readPhase() === 'day' ? 1 : 0;
    return { k, linear: k, target: k, changed: false };
  });
  useEffect(() => {
    blend.target = phase === 'day' ? 1 : 0;
  }, [blend, phase]);

  // The site's theme and motion settings live on <html>; follow them.
  useEffect(() => {
    const watch = new MutationObserver(() => {
      setPhase(readPhase());
      setReduced(readReduced());
    });
    watch.observe(html(), { attributes: true, attributeFilter: ['data-theme', 'data-motion'] });
    return () => watch.disconnect();
  }, []);

  useEffect(
    () =>
      store.subscribe((s) => {
        setQuality(s.quality);
        setStep(0);
        if (s.quality !== 'auto') setTier(s.quality);
        else setTier(startingTier('auto', device));
      }),
    [store, device],
  );

  useEffect(() => {
    const tick = setInterval(() => setClock(mumbaiClock()), 15_000);
    return () => clearInterval(tick);
  }, []);

  // Mumbai's weather, cached by the Worker (/api/weather); the window stays dry when it is not there yet.
  useEffect(() => {
    let alive = true;
    const load = (): void => {
      fetch('/api/weather')
        .then((r) => (r.ok ? (r.json() as Promise<Weather & { raining: boolean }>) : null))
        .then((w) => {
          if (alive && w) setWeather({ raining: w.raining === true, temperatureC: w.temperatureC });
        })
        .catch(() => undefined);
    };
    load();
    const again = setInterval(load, 10 * 60_000);
    return () => {
      alive = false;
      clearInterval(again);
    };
  }, []);

  const onSelect = useCallback((id: string) => {
    if (ZONE_SPOTS[id]) setActive(id);
  }, []);
  const onBack = useCallback(() => setActive(null), []);
  const toggleWalk = useCallback(() => {
    setActive(null);
    setWalking((w) => !w);
  }, []);

  useEffect(() => {
    if (walking && !active) capturePointer();
    else freePointer();
    return freePointer;
  }, [walking, active]);

  // While walking, D moves the figure, so the site's theme key becomes Shift+D (see isThemeShortcut).
  useEffect(() => {
    if (walking) html().dataset['walk'] = '';
    else delete html().dataset['walk'];
    return () => {
      delete html().dataset['walk'];
    };
  }, [walking]);

  // Esc steps back one level: out of a zone (back to walking if we were), then out of walking. F starts and stops walking.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (isTypingTarget(e.target) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Escape') {
        if (active) setActive(null);
        else if (walking) setWalking(false);
      } else if ((e.key === 'f' || e.key === 'F') && canWalk && !e.repeat && !active) {
        setWalking((w) => !w);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, walking, canWalk]);

  const settingsForTier = TIERS[tier];
  const state = useMemo<RoomState>(
    () => ({ palettes, blend, tier: settingsForTier, reduced, weather }),
    [palettes, blend, settingsForTier, reduced, weather],
  );
  const shot = (active ? ZONE_SPOTS[active]?.shot : undefined) ?? OVERVIEW;

  // Frames dropped. First answer: draw fewer pixels, a step at a time (the scene, lights and effects stay exactly as they are,
  // so nothing flashes or shifts). Only when that is spent does the room fall to the lighter tier, which does change the look.
  const lower = useCallback(() => {
    if (quality !== 'auto') return;
    if (step < RESOLUTION_STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    if (tier === 'low') return;
    setTier('low');
    setStep(0);
    if (!warned.current) {
      warned.current = true;
      toast({ kind: 'warn', message: data.room.lowPower });
    }
  }, [quality, tier, step, data.room.lowPower]);
  const pixelRatio = Math.max(
    0.75,
    Math.min(devicePixelRatio, settingsForTier.dpr * (RESOLUTION_STEPS[step] ?? 1)),
  );

  return (
    <RoomContext.Provider value={state}>
      <div className="rm" data-phase={phase}>
        <Canvas
          shadows
          dpr={pixelRatio}
          camera={{
            fov: 52,
            near: 0.1,
            far: 1500,
            position: OVERVIEW.position.slice() as [number, number, number],
          }}
          gl={{
            antialias: !TIERS[startingTier(quality, device)].post,
            powerPreference: 'high-performance',
            toneMapping: ACESFilmicToneMapping,
          }}
          aria-hidden="true"
        >
          <BlendDriver blend={blend} reduced={reduced} />
          <PerformanceMonitor flipflops={2} onDecline={lower} onFallback={lower} />
          <Rig shot={shot} reduced={reduced} follow={walking && !active ? follow : null} />
          <StaticOutside />
          <StaticLighting />
          <StaticShell />
          <Suspense fallback={null}>
            <StaticProps />
          </Suspense>
          <Walker
            visible={walking}
            enabled={walking && !active}
            follow={follow}
            onNearby={setNear}
            onOpen={onSelect}
          />
          <Markers
            zones={data.zones}
            active={active}
            near={walking && !active ? near : null}
            onSelect={onSelect}
          />
          {settingsForTier.post && <PostStack day={phase === 'day'} />}
          <Boot hooks={hooks} />
        </Canvas>
        <Hud
          copy={data.room}
          zones={data.zones}
          active={active}
          onSelect={onSelect}
          onBack={onBack}
          phase={phase}
          clock={clock}
          raining={weather?.raining === true}
          canWalk={canWalk}
          walking={walking}
          near={walking && !active ? (data.zones.find((z) => z.id === near) ?? null) : null}
          onToggleWalk={toggleWalk}
        />
      </div>
    </RoomContext.Provider>
  );
}
