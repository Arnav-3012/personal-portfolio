// Shared state for the room's scene components. Day and night are one number (`blend`, 0 night to 1 day) that eases over
// 1.2 s when the theme changes; every light, surface and the sky reads it and mixes the two palettes (SPEC: a 1.2 s
// cross-fade of lights and environment, no reload).
import { createContext, useContext, useEffect, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Palettes } from '../../lib/workshop/palette';
import type { TierSettings } from '../../lib/workshop/quality';

export interface Blend {
  /** Eased, 0 = night, 1 = day: what the scene reads. */
  k: number;
  /** Linear progress towards `target`. */
  linear: number;
  target: 0 | 1;
  /** True on frames where `k` moved, so consumers only do work while the light is changing. */
  changed: boolean;
}

export interface Weather {
  raining: boolean;
  temperatureC: number;
}

export interface RoomState {
  palettes: Palettes;
  blend: Blend;
  tier: TierSettings;
  reduced: boolean;
  weather: Weather | null;
}

export const FADE_SECONDS = 1.2;
export const smooth = (t: number): number => t * t * (3 - 2 * t);

export const RoomContext = createContext<RoomState | null>(null);

export function useRoom(): RoomState {
  const state = useContext(RoomContext);
  if (!state) throw new Error('useRoom outside the room');
  return state;
}

/** Moves the blend a frame closer to its target. Runs before every other frame callback. */
export function stepBlend(blend: Blend, dt: number, reduced: boolean): void {
  const goal = blend.target;
  if (blend.linear === goal) {
    blend.changed = false;
    return;
  }
  const step = reduced ? 1 : dt / FADE_SECONDS;
  blend.linear =
    Math.abs(goal - blend.linear) <= step
      ? goal
      : blend.linear + Math.sign(goal - blend.linear) * step;
  blend.k = smooth(blend.linear);
  blend.changed = true;
}

/** Runs `apply(k)` once on mount and again on every frame in which the day/night blend moved. */
export function useBlend(apply: (k: number) => void): void {
  const { blend } = useRoom();
  const latest = useRef(apply);
  useEffect(() => {
    latest.current = apply;
    apply(blend.k);
  });
  useFrame(() => {
    if (blend.changed) latest.current(blend.k);
  });
}

/** Where the walking figure is and which way the walk camera looks (yaw, radians: 0 looks along +z). Shared by the walker and the camera. */
export interface FollowState {
  x: number;
  z: number;
  heading: number;
  yaw: number;
  /** Looking up (positive) or down, radians. */
  pitch: number;
  /** 0 to 1: how much the body swings, from how fast the figure walks. Eased, so starting and stopping are gentle. */
  bob: number;
  /** The stride, radians: one full turn is two steps. The camera, legs and arms all read it, so they stay in step. */
  phase: number;
  /** 0 to 1: how far the view has flown from the tour into the figure's eyes. The body and hands appear near the end. */
  arrive: number;
}
