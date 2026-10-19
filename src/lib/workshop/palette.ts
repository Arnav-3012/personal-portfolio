// The room's colours come from the same tokens as the rest of the site (src/styles/tokens.css), never from hex in code.
// Both themes are read once, through two hidden probe elements that carry `data-palette="night"` / `"day"` (the token
// file applies each theme's values to them), so the room can cross-fade between the two without a reload.
import { Color } from 'three';

export const PALETTE_KEYS = [
  'floor',
  'wall',
  'wall-low',
  'ceiling',
  'steel',
  'wood',
  'fabric',
  'fur',
  'leaf',
  'skin',
  'metal',
  'screen',
  'paper',
  'ink',
  'glow',
  'sky-top',
  'sky-horizon',
  'haze',
  'key',
  'city',
  'city-lit',
  'moon',
] as const;
export type RoomKey = (typeof PALETTE_KEYS)[number];

/** Site tokens the room also uses (hologram, practical lamp, signal red). */
export const SHARED_KEYS = ['holo', 'time', 'action'] as const;
export type SharedKey = (typeof SHARED_KEYS)[number];

export type Palette = Record<RoomKey | SharedKey, Color>;
export type Palettes = Record<'night' | 'day', Palette>;

/** Mid grey, used when a token is missing, so a typo shows up as grey rather than as a crash. */
const setFallback = (colour: Color): Color => colour.setRGB(0.5, 0.5, 0.5);

/** Builds one palette from a reader of CSS custom properties (injected so tests need no DOM). */
export function paletteFrom(read: (property: string) => string): Palette {
  const out = {} as Palette;
  for (const key of [...PALETTE_KEYS.map((k) => `room-${k}`), ...SHARED_KEYS]) {
    const raw = read(`--${key}`).trim();
    const colour = new Color();
    if (raw) colour.set(raw);
    else setFallback(colour);
    out[key.replace(/^room-/, '') as RoomKey | SharedKey] = colour;
  }
  return out;
}

export function readPalettes(doc: Document = document): Palettes {
  const read = (phase: 'night' | 'day'): Palette => {
    const probe = doc.createElement('div');
    probe.dataset['palette'] = phase;
    probe.hidden = true;
    doc.body.append(probe);
    const style = getComputedStyle(probe);
    const palette = paletteFrom((name) => style.getPropertyValue(name));
    probe.remove();
    return palette;
  };
  return { night: read('night'), day: read('day') };
}

/** `out` = `a` mixed towards `b` by `t` (0 to 1). */
export const mixColour = (out: Color, a: Color, b: Color, t: number): Color =>
  out.copy(a).lerp(b, t);
