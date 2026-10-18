import { describe, expect, it, vi } from 'vitest';
import {
  createSettingsStore,
  DEFAULT_SETTINGS,
  sanitize,
  SETTINGS_KEY,
} from '../../../src/lib/settings';
import { resolveReduced, resolveTheme } from '../../../src/lib/theme';
import { clampPercent } from '../../../src/lib/progress';

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(initial));
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => data.delete(k),
    setItem: (k, v) => data.set(k, v),
  };
}

describe('settings store', () => {
  it('starts from defaults when nothing is stored', () => {
    expect(createSettingsStore(() => memoryStorage()).get()).toEqual(DEFAULT_SETTINGS);
  });

  it('defaults are muted, Auto theme, Auto motion', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({ sound: false, theme: 'auto', motion: 'auto' });
  });

  it('falls back to defaults on corrupt JSON', () => {
    const store = createSettingsStore(() => memoryStorage({ [SETTINGS_KEY]: '{not json' }));
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps valid fields and drops invalid ones', () => {
    expect(
      sanitize({ theme: 'day', sound: 'yes', motion: 'fast', quality: 'low', extra: 1 }),
    ).toEqual({
      ...DEFAULT_SETTINGS,
      theme: 'day',
      quality: 'low',
    });
    expect(sanitize(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('persists, reloads and notifies subscribers', () => {
    const storage = memoryStorage();
    const store = createSettingsStore(() => storage);
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    store.set({ theme: 'night', sound: true });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ theme: 'night', sound: true }));
    expect(createSettingsStore(() => storage).get()).toMatchObject({ theme: 'night', sound: true });
    unsubscribe();
    store.set({ theme: 'day' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('survives storage that throws on access, read and write', () => {
    const throwing = (): Storage => {
      throw new DOMException('blocked', 'SecurityError');
    };
    const store = createSettingsStore(throwing);
    expect(store.get()).toEqual(DEFAULT_SETTINGS);
    expect(() => store.set({ theme: 'day' })).not.toThrow();
    expect(store.get().theme).toBe('day');

    const failingWrites = {
      ...memoryStorage(),
      setItem: () => {
        throw new Error('QuotaExceeded');
      },
    };
    expect(() => createSettingsStore(() => failingWrites).set({ sound: true })).not.toThrow();
  });
});

describe('theme resolution', () => {
  it('Auto follows the OS colour scheme on the 2D site', () => {
    expect(resolveTheme('auto', true)).toBe('night');
    expect(resolveTheme('auto', false)).toBe('day');
    expect(resolveTheme('day', true)).toBe('day');
    expect(resolveTheme('night', false)).toBe('night');
  });

  it('reduced motion: explicit setting wins, Auto follows the OS', () => {
    expect(resolveReduced('auto', true)).toBe(true);
    expect(resolveReduced('auto', false)).toBe(false);
    expect(resolveReduced('full', true)).toBe(false);
    expect(resolveReduced('reduced', false)).toBe(true);
  });
});

describe('progress', () => {
  it('clamps to a whole 0–100 percentage', () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(42.6)).toBe(43);
    expect(clampPercent(140)).toBe(100);
    expect(clampPercent(Number.NaN)).toBe(0);
  });
});
