// Theme + motion controller (SPEC "Theme switching"). The inline script in Base.astro sets the first
// paint; this keeps <html data-theme / data-motion> in sync afterwards and owns the D shortcut.
import { settings, type Settings, type SettingsStore } from './settings';

export type Theme = 'day' | 'night';

/** Auto on the 2D site follows the OS colour scheme. */
export const resolveTheme = (mode: Settings['theme'], prefersDark: boolean): Theme =>
  mode === 'auto' ? (prefersDark ? 'night' : 'day') : mode;

export const resolveReduced = (motion: Settings['motion'], prefersReduce: boolean): boolean =>
  motion === 'reduced' || (motion === 'auto' && prefersReduce);

/** True when a key press is text input, so single-letter shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** D toggles Day/Night; Shift+D is reserved for workshop free-roam, modifiers belong to the browser. */
export const isThemeShortcut = (e: KeyboardEvent): boolean =>
  (e.key === 'd' || e.key === 'D') &&
  !e.shiftKey &&
  !e.ctrlKey &&
  !e.metaKey &&
  !e.altKey &&
  !e.repeat &&
  !isTypingTarget(e.target);

const FADE_CLASS = 'theme-fading';
const FADE_MS = 600;

export function initTheme(store: SettingsStore = settings()): void {
  const root = document.documentElement;
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let fadeTimer: ReturnType<typeof setTimeout> | undefined;

  const apply = (): void => {
    const s = store.get();
    const theme = resolveTheme(s.theme, dark.matches);
    const reduced = resolveReduced(s.motion, reduce.matches);
    root.dataset['motion'] = reduced ? 'reduced' : 'full';
    if (root.dataset['theme'] === theme) return;
    if (!reduced) {
      // Cross-fade only on a change, never on first paint.
      root.classList.add(FADE_CLASS);
      clearTimeout(fadeTimer);
      fadeTimer = setTimeout(() => root.classList.remove(FADE_CLASS), FADE_MS);
    }
    root.dataset['theme'] = theme;
  };

  apply();
  store.subscribe(apply);
  dark.addEventListener('change', apply);
  reduce.addEventListener('change', apply);

  document.addEventListener('keydown', (e) => {
    if (!isThemeShortcut(e)) return;
    store.set({ theme: root.dataset['theme'] === 'day' ? 'night' : 'day' });
  });
}
