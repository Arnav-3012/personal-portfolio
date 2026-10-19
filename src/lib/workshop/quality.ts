// 3D quality tiers (SPEC "Performance"): the room starts as high as the device plausibly allows and steps down when
// frames drop. Phones start low. The Settings panel can pin high or low; Auto lets drei's PerformanceMonitor decide.
import type { Settings } from '../settings';

export type Tier = 'high' | 'low';

export interface TierSettings {
  /** Upper bound on the device pixel ratio. */
  dpr: number;
  shadowMap: number;
  /** Mirror-like floor and the soft baked shadows: a second pass over the scene. */
  reflections: boolean;
  bakedShadowFrames: number;
  /** Bloom, vignette and grain. */
  post: boolean;
  rain: number;
  towers: number;
  stars: number;
}

export const TIERS: Readonly<Record<Tier, TierSettings>> = {
  high: {
    dpr: 1.5,
    shadowMap: 2048,
    reflections: true,
    bakedShadowFrames: 36,
    post: true,
    rain: 900,
    towers: 150,
    stars: 700,
  },
  low: {
    dpr: 1,
    shadowMap: 1024,
    reflections: false,
    bakedShadowFrames: 0,
    post: false,
    rain: 350,
    towers: 70,
    stars: 260,
  },
};

/** Resolution steps the room walks down when frames drop, as a share of the tier's pixel ratio. Gentle, and no remounting. */
export const RESOLUTION_STEPS: readonly number[] = [1, 0.8, 0.64];

export interface Device {
  coarsePointer: boolean;
  /** `navigator.deviceMemory`, in GB, when the browser tells us. */
  memoryGb: number | undefined;
  cores: number | undefined;
}

/** True when the device is too small for 3D at all (SPEC: very low memory gets the 2D list instead). */
export const tooWeak = (d: Device): boolean => d.memoryGb !== undefined && d.memoryGb <= 1;

export function startingTier(mode: Settings['quality'], d: Device): Tier {
  if (mode !== 'auto') return mode;
  const modest =
    d.coarsePointer ||
    (d.memoryGb !== undefined && d.memoryGb <= 4) ||
    (d.cores !== undefined && d.cores <= 4);
  return modest ? 'low' : 'high';
}

export function readDevice(): Device {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    coarsePointer: matchMedia('(pointer: coarse)').matches,
    memoryGb: nav.deviceMemory,
    cores: nav.hardwareConcurrency,
  };
}
