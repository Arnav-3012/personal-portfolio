// ARNAV-OS boot (SPEC "Landing page" row 0, "Loading states"). The inline head script in Base.astro decides
// before first paint whether to show it (mirrors shouldBoot) and holds a failsafe timeout; this module measures
// real progress (fonts + portrait), runs the transformer animation (src/lib/transformer.ts) and handles skip.
// <html data-boot>: "on" while running, "out" while the letters fly into the hero, "skip" for a quick fade.
import { runTransformer } from './transformer';

export const BOOT_KEY = 'arnav:boot:v1';
/** The inline script ends the boot after this even if the module script never loads. */
export const FAILSAFE_MS = 4500;
export const SKIP_FADE_MS = 250;

type SessionLike = Pick<Storage, 'getItem' | 'setItem'>;

/** Once per session, never with reduced motion. Blocked storage → show it (the page still works). */
export function shouldBoot(storage: SessionLike | null, reduced: boolean): boolean {
  if (reduced) return false;
  try {
    return storage?.getItem(BOOT_KEY) !== 'seen';
  } catch {
    return true;
  }
}

export function markSeen(storage: SessionLike | null): void {
  try {
    storage?.setItem(BOOT_KEY, 'seen');
  } catch {
    // Storage blocked: the boot may replay next load, which is harmless.
  }
}

/** Weighted real progress: fonts 40%, portrait 60% (SPEC: loaders show a true percentage). */
export function trackProgress(tasks: readonly [Promise<unknown>, number][]): () => number {
  let done = 0;
  for (const [task, weight] of tasks) {
    void task.then(
      () => (done += weight),
      () => (done += weight),
    );
  }
  return () => Math.min(1, done);
}

export interface BootContent {
  tokens: readonly string[];
  output: string;
  log: readonly string[];
}

const SKIP_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart'] as const;

export function initBoot(doc: Document = document): void {
  const root = doc.documentElement;
  const overlay = doc.querySelector<HTMLElement>('[data-boot-overlay]');
  const canvas = overlay?.querySelector('canvas');
  if (root.dataset['boot'] !== 'on' || !overlay || !canvas) return;

  let storage: Storage | null = null;
  try {
    storage = sessionStorage;
  } catch {
    // Blocked storage: markSeen no-ops.
  }
  markSeen(storage);

  const content = JSON.parse(overlay.dataset['content'] ?? '{}') as BootContent;
  const portrait = doc.querySelector<HTMLImageElement>('[data-portrait]');
  const progress = trackProgress([
    [doc.fonts.ready, 0.4],
    [portrait?.decode() ?? Promise.resolve(), 0.6],
  ]);

  let finished = false;
  const end = (): void => {
    if (finished) return;
    finished = true;
    for (const type of SKIP_EVENTS) doc.removeEventListener(type, skip, true);
    delete root.dataset['boot'];
  };

  const stop = runTransformer(canvas, {
    ...content,
    progress,
    targets: () =>
      [...doc.querySelectorAll('.hero__letter')].map((el) => el.getBoundingClientRect()),
    onHandoff: () => {
      for (const type of SKIP_EVENTS) doc.removeEventListener(type, skip, true);
      root.dataset['boot'] = 'out';
    },
    onDone: end,
  });

  // Any key, click, scroll or tap skips (SPEC). Capture so it runs before page handlers.
  function skip(): void {
    stop();
    for (const type of SKIP_EVENTS) doc.removeEventListener(type, skip, true);
    root.dataset['boot'] = 'skip';
    setTimeout(end, SKIP_FADE_MS);
  }
  for (const type of SKIP_EVENTS)
    doc.addEventListener(type, skip, { capture: true, passive: true });
}
