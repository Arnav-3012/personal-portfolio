// Runs low-priority work after the first sign of a visitor (pointer, key, scroll, touch) or, failing that, a few
// seconds after load. Work started at idle still sits on the page's critical path in Lighthouse's model (the chat
// launcher and the /api/live fetch cost LCP about 150 ms), so it waits until the page has painted and someone is there.

const SIGNS = ['pointermove', 'pointerdown', 'keydown', 'scroll', 'touchstart'] as const;
export const FALLBACK_MS = 4000;

export function afterFirstSign(run: () => void, fallbackMs = FALLBACK_MS): void {
  let done = false;
  const go = (): void => {
    if (done) return;
    done = true;
    for (const sign of SIGNS) removeEventListener(sign, go);
    clearTimeout(timer);
    run();
  };
  for (const sign of SIGNS) addEventListener(sign, go, { passive: true, once: true });
  const timer = setTimeout(go, fallbackMs);
}
