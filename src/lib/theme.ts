// Theme + motion controller (SPEC "Theme switching"). The inline script in Base.astro sets the first
// paint; this keeps <html data-theme / data-motion> in sync afterwards and owns the D shortcut.
import { settings, type Settings, type SettingsStore } from './settings';
import { mumbaiPhase } from './workshop/mumbai-time';

export type Theme = 'day' | 'night';

/** Auto on the 2D site follows the OS colour scheme; in the workshop (`mumbai` given) it follows Mumbai's day and night. */
export const resolveTheme = (
  mode: Settings['theme'],
  prefersDark: boolean,
  mumbai?: Theme,
): Theme => (mode === 'auto' ? (mumbai ?? (prefersDark ? 'night' : 'day')) : mode);

export const resolveReduced = (motion: Settings['motion'], prefersReduce: boolean): boolean =>
  motion === 'reduced' || (motion === 'auto' && prefersReduce);

/** True when a key press is text input, so single-letter shortcuts must not fire. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (typeof HTMLElement === 'undefined' || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}

/** D toggles Day/Night; Shift+D is reserved for workshop free-roam, modifiers belong to the browser. */
export const isThemeShortcut = (e: KeyboardEvent, walking = false): boolean =>
  (e.key === 'd' || e.key === 'D') &&
  // While walking in the workshop D is a movement key, so the toggle moves to Shift+D (SPEC "Theme switching").
  e.shiftKey === walking &&
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
  // The workshop page (Base `workshop`) marks <html data-auto="mumbai">: Auto then follows Mumbai time (SPEC "Theme switching").
  const mumbai = root.dataset['auto'] === 'mumbai';

  const apply = (): void => {
    const s = store.get();
    const theme = resolveTheme(s.theme, dark.matches, mumbai ? mumbaiPhase() : undefined);
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
  // Dusk and dawn arrive while the page is open.
  if (mumbai) setInterval(apply, 60_000);

  document.addEventListener('keydown', (e) => {
    if (!isThemeShortcut(e, root.dataset['walk'] !== undefined)) return;
    store.set({ theme: root.dataset['theme'] === 'day' ? 'night' : 'day' });
  });
}
