// Top progress bar + curtain wipe (SPEC "Loading states": real percentage, done within 300 ms of load).
// Markup lives in ProgressBar.astro. Navigation wiring comes with the nav in task 1.4.

const HIDE_MS = 250;

const bar = (): HTMLElement | null => document.querySelector('[data-progress]');
const curtain = (): HTMLElement | null => document.querySelector('[data-curtain]');

let hideTimer: ReturnType<typeof setTimeout> | undefined;

export const clampPercent = (value: number): number =>
  Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 0;

export function setProgress(percent: number): void {
  const el = bar();
  if (!el) return;
  const value = clampPercent(percent);
  el.style.setProperty('--progress', String(value / 100));
  el.setAttribute('aria-valuenow', String(value));
}

export function startProgress({ wipe = false }: { wipe?: boolean } = {}): void {
  const el = bar();
  if (!el) return;
  clearTimeout(hideTimer);
  setProgress(0);
  el.hidden = false;
  if (wipe) curtain()?.classList.add('is-active');
}

export function doneProgress(): void {
  const el = bar();
  if (!el) return;
  setProgress(100);
  curtain()?.classList.remove('is-active');
  hideTimer = setTimeout(() => {
    el.hidden = true;
  }, HIDE_MS);
}
