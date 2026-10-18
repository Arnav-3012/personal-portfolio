// Visitor settings (SPEC "Theme switching" → Settings panel). Persisted to localStorage; every access is
// wrapped in try/catch because storage can be missing or throw (private mode, blocked site data).

export const SETTINGS_KEY = 'arnav:settings:v1';

export const THEME_MODES = ['auto', 'day', 'night'] as const;
export const MOTION_MODES = ['auto', 'full', 'reduced'] as const;
export const QUALITY_MODES = ['auto', 'high', 'low'] as const;
export const HOLO_COLOURS = ['cyan'] as const;

export interface Settings {
  theme: (typeof THEME_MODES)[number];
  sound: boolean;
  motion: (typeof MOTION_MODES)[number];
  quality: (typeof QUALITY_MODES)[number];
  holo: (typeof HOLO_COLOURS)[number];
}

export const DEFAULT_SETTINGS: Readonly<Settings> = {
  theme: 'auto',
  sound: false,
  motion: 'auto',
  quality: 'auto',
  holo: 'cyan',
};

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

/** Keeps valid fields, replaces anything unknown or malformed with its default. */
export function sanitize(input: unknown): Settings {
  const raw = (typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>;
  const d = DEFAULT_SETTINGS;
  return {
    theme: oneOf(raw['theme'], THEME_MODES, d.theme),
    sound: typeof raw['sound'] === 'boolean' ? raw['sound'] : d.sound,
    motion: oneOf(raw['motion'], MOTION_MODES, d.motion),
    quality: oneOf(raw['quality'], QUALITY_MODES, d.quality),
    holo: oneOf(raw['holo'], HOLO_COLOURS, d.holo),
  };
}

type Listener = (settings: Settings) => void;

export interface SettingsStore {
  get(): Settings;
  set(patch: Partial<Settings>): void;
  subscribe(listener: Listener): () => void;
}

export function createSettingsStore(
  getStorage: () => Storage | undefined = () => globalThis.localStorage,
): SettingsStore {
  let state = load();
  const listeners = new Set<Listener>();

  function load(): Settings {
    try {
      const raw = getStorage()?.getItem(SETTINGS_KEY);
      return sanitize(raw ? JSON.parse(raw) : {});
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  return {
    get: () => state,
    set(patch) {
      state = sanitize({ ...state, ...patch });
      try {
        getStorage()?.setItem(SETTINGS_KEY, JSON.stringify(state));
      } catch {
        // Storage unavailable: the setting still applies for this page view.
      }
      for (const listener of listeners) listener(state);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

let shared: SettingsStore | undefined;

/** The page-wide store, created on first use so importing this module has no side effects. */
export const settings = (): SettingsStore => (shared ??= createSettingsStore());
