// ARNAV-OS boot (SPEC "Landing page" row 0, "Loading states"). The inline head script in Base.astro decides
// before first paint whether to show it (mirrors shouldBoot) and holds a failsafe timeout; this module measures
// real progress (fonts, portrait, the dot matrix), runs the boot scene (src/lib/reactor.ts) and handles skip.
// The scene itself (reactor.ts, boot-targets.ts) is a lazy chunk: it is needed only on a first visit, and loading it
// once the portrait (the LCP image) has painted keeps its bytes from competing with it.
// <html data-boot>: "on" while running, "out" once the particles have become the hero's dots, "skip" for a quick fade.
import type { DotMatrix } from './dotmatrix';
import { heroDots } from './hero-dots';

export const BOOT_KEY = 'arnav:boot:v1';
/** The inline script ends the boot after this even if the module script never loads. */
export const FAILSAFE_MS = 7500;
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

/** Weighted real progress: fonts, the portrait image and the built dot matrix (SPEC: loaders show a true percentage). */
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
  // The dot matrix is built by the hero's own script; wait for it, but never for more than a few seconds.
  let dotMatrix: DotMatrix | null = null;
  const dotsReady = Promise.race([
    heroDots,
    new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
  ]).then((d) => void (dotMatrix = d));
  const progress = trackProgress([
    [doc.fonts.ready, 0.3],
    [portrait?.decode() ?? Promise.resolve(), 0.3],
    [dotsReady, 0.4],
  ]);

  let finished = false;
  const end = (): void => {
    if (finished) return;
    finished = true;
    for (const type of SKIP_EVENTS) doc.removeEventListener(type, skip, true);
    // After a full boot the name must not play its entrance again when data-boot goes away (see Hero.astro).
    if (root.dataset['boot'] === 'out') root.dataset['booted'] = '';
    delete root.dataset['boot'];
  };

  let stop: () => void = () => undefined;
  let skipped = false;
  // Fetched only once the portrait (the LCP image) has been decoded and a frame has painted.
  const portraitPainted = (portrait?.decode() ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
  void portraitPainted
    .then(() => Promise.all([import('./reactor'), import('./boot-targets')]))
    .then(([scene, targets]) => {
      if (skipped || finished) return;
      stop = scene.runReactor(canvas, {
        tokens: content.tokens,
        output: content.output,
        log: content.log,
        progress,
        // Read when the burst begins: the portrait's own dots (once built) and the exact dots inside each letter of the name.
        targets: () => {
          const ink = getComputedStyle(root).getPropertyValue('--text').trim();
          const dots = doc.querySelector<HTMLCanvasElement>('.hero__dots');
          return [
            ...(dotMatrix && dots ? targets.portraitTargets(dotMatrix, dots) : []),
            ...targets.letterTargets([...doc.querySelectorAll<HTMLElement>('.hero__letter')], ink),
          ];
        },
        onHandoff: () => {
          for (const type of SKIP_EVENTS) doc.removeEventListener(type, skip, true);
          root.dataset['boot'] = 'out';
        },
        onDone: end,
      });
    })
    // The chunk could not load: never hold the page for it.
    .catch(() => skip());

  // Any key, click, scroll or tap skips (SPEC). Capture so it runs before page handlers.
  function skip(): void {
    skipped = true;
    stop();
    for (const type of SKIP_EVENTS) doc.removeEventListener(type, skip, true);
    root.dataset['boot'] = 'skip';
    setTimeout(end, SKIP_FADE_MS);
  }
  for (const type of SKIP_EVENTS)
    doc.addEventListener(type, skip, { capture: true, passive: true });
}
