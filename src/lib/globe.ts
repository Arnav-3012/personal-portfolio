// The maths of the entry sequence (task 2.3), free of drawing so it can be unit-tested: the baked land mask, the
// orthographic projection that turns the globe to a chosen point, and the timeline that says what every part of the
// scene is doing at a given moment.
import { LAND_COLS, LAND_MASK, LAND_ROWS } from './land-mask';

export interface LatLon {
  lat: number;
  lon: number;
}

const rad = (deg: number): number => (deg * Math.PI) / 180;
const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const easeOut = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
export const easeIn = (t: number): number => clamp01(t) ** 3;
export const easeInOut = (t: number): number => {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
};
/** 0–1 progress of `now` through the span [from, to]. */
export const span = (now: number, from: number, to: number): number =>
  clamp01((now - from) / (to - from));

let bits: Uint8Array | undefined;
const mask = (): Uint8Array => (bits ??= Uint8Array.from(atob(LAND_MASK), (c) => c.charCodeAt(0)));

const cell = (lat: number, lon: number): number => {
  const row = Math.round((89 - lat) / 2);
  const col = Math.round((lon + 179) / 2);
  return row < 0 || row >= LAND_ROWS || col < 0 || col >= LAND_COLS ? -1 : row * LAND_COLS + col;
};

/** Whether the 2° cell nearest a point is land. */
export function isLand(lat: number, lon: number): boolean {
  const bit = cell(lat, ((((lon + 180) % 360) + 360) % 360) - 180);
  return bit >= 0 && ((mask()[bit >> 3] ?? 0) & (1 << (bit & 7))) !== 0;
}

let dots: LatLon[] | undefined;
/** Centres of every land cell: the dots of the dot-matrix globe. */
export function landCells(): LatLon[] {
  if (dots) return dots;
  const out: LatLon[] = [];
  for (let r = 0; r < LAND_ROWS; r++)
    for (let c = 0; c < LAND_COLS; c++) {
      const lat = 89 - r * 2;
      const lon = -179 + c * 2;
      if (isLand(lat, lon)) out.push({ lat, lon });
    }
  return (dots = out);
}

export interface Projected {
  /** Right and up, on the unit sphere. */
  x: number;
  y: number;
  /** Towards the viewer: above 0 means the point is on the visible side. */
  z: number;
}

/** Orthographic projection of a point on a globe turned so that `centre` faces the viewer. */
export function project(p: LatLon, centre: LatLon): Projected {
  const phi = rad(p.lat);
  const phi0 = rad(centre.lat);
  const dl = rad(p.lon - centre.lon);
  return {
    x: Math.cos(phi) * Math.sin(dl),
    y: Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(dl),
    z: Math.sin(phi0) * Math.sin(phi) + Math.cos(phi0) * Math.cos(phi) * Math.cos(dl),
  };
}

export interface Frame {
  /** Opacity of the screen-covering wash, 0–1. */
  wash: number;
  /** The brain's size multiplier (1 = its size on the page), opacity and how far it has travelled to the centre. */
  brainScale: number;
  brainAlpha: number;
  brainTravel: number;
  /** How lit the neuron nodes are, 0–1. */
  nodes: number;
  globeAlpha: number;
  /** Globe radius as a fraction of half the shorter screen side: 1 fills the screen's short side. */
  radius: number;
  centre: LatLon;
  /** 0–1 drop of the pin on the target. */
  pin: number;
  stage: 'dive' | 'lock' | 'point' | 'enter';
  /** Progress of the "locking coordinates" readout, 0–1. */
  lock: number;
  /** Opacity of the closing fade to the page colour, 0–1. */
  fade: number;
  done: boolean;
}

/** The beats of the sequence, in milliseconds from the press. */
export const BEATS = {
  wash: [0, 450],
  dive: [250, 1500],
  globe: [1050, 2150],
  turn: [1050, 3500],
  pin: [3300, 3800],
  zoom: [3800, 4950],
  fade: [4700, 5200],
  total: 5200,
} as const;

/** What the scene looks like `ms` after the press, with the globe turning to `target`. */
export function frameAt(ms: number, target: LatLon): Frame {
  const dive = span(ms, ...BEATS.dive);
  const globe = easeOut(span(ms, ...BEATS.globe));
  const turn = easeInOut(span(ms, ...BEATS.turn));
  const zoom = easeInOut(span(ms, ...BEATS.zoom));
  const radius = lerp(0.04, 0.78, globe) * lerp(1, 9, zoom);
  const stage: Frame['stage'] =
    ms < BEATS.globe[0]
      ? 'dive'
      : ms < BEATS.pin[0]
        ? 'lock'
        : ms < BEATS.zoom[0]
          ? 'point'
          : 'enter';
  return {
    wash: easeOut(span(ms, ...BEATS.wash)),
    brainScale: lerp(1, 9, easeIn(dive)),
    brainAlpha: 1 - easeIn(span(ms, 800, 1500)),
    brainTravel: easeInOut(span(ms, 0, 700)),
    nodes: easeOut(span(ms, 350, 900)) * (1 - span(ms, 1100, 1500)),
    globeAlpha: globe,
    radius,
    // The globe spins in from far round and settles, slowing, exactly on the target.
    centre: { lat: lerp(8, target.lat, turn), lon: target.lon - 230 * (1 - turn) },
    pin: easeOut(span(ms, ...BEATS.pin)),
    stage,
    lock: span(ms, BEATS.globe[0] + 200, BEATS.pin[0]),
    fade: easeIn(span(ms, ...BEATS.fade)),
    done: ms >= BEATS.total,
  };
}
