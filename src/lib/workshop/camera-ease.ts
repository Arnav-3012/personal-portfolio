// Camera moves (SPEC "Motion tokens"): `--ease-cam` is cubic-bezier(0.65, 0, 0.35, 1). Browsers solve that curve for
// CSS only, so the room solves it here to move the camera with the same feel. No animation library: GSAP arrives with
// the holotable intro.

export type Ease = (t: number) => number;

/** A CSS-style cubic Bézier easing (x1, y1, x2, y2), solved by Newton's method with a bisection fallback. */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): Ease {
  const coord = (a: number, b: number, t: number): number =>
    3 * a * (1 - t) ** 2 * t + 3 * b * (1 - t) * t ** 2 + t ** 3;
  const slope = (a: number, b: number, t: number): number =>
    3 * a * (1 - t) ** 2 + 6 * (b - a) * (1 - t) * t + 3 * (1 - b) * t ** 2;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 6; i++) {
      const err = coord(x1, x2, t) - x;
      if (Math.abs(err) < 1e-6) return coord(y1, y2, t);
      const d = slope(x1, x2, t);
      if (Math.abs(d) < 1e-6) break;
      t -= err / d;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    for (let i = 0; i < 24; i++) {
      if (coord(x1, x2, t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return coord(y1, y2, t);
  };
}

export const easeCam: Ease = cubicBezier(0.65, 0, 0.35, 1);
export const CAMERA_MOVE_S = 1.6;

export type Vec3 = readonly [number, number, number];
export interface Shot {
  readonly position: Vec3;
  readonly target: Vec3;
}

export interface Tween {
  from: Shot;
  to: Shot;
  /** Seconds elapsed. */
  elapsed: number;
  duration: number;
}

const mix = (a: Vec3, b: Vec3, t: number): Vec3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Where the camera is `dt` seconds later. `duration` 0 (reduced motion) is a cut. */
export function stepTween(tween: Tween, dt: number): { shot: Shot; done: boolean } {
  tween.elapsed += dt;
  const t = tween.duration <= 0 ? 1 : Math.min(1, tween.elapsed / tween.duration);
  const k = easeCam(t);
  return {
    shot: {
      position: mix(tween.from.position, tween.to.position, k),
      target: mix(tween.from.target, tween.to.target, k),
    },
    done: t >= 1,
  };
}
