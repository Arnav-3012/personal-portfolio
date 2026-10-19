// Starts decorative work only once the page has loaded, the largest paint has happened and the boot sequence is over.
// Work that runs earlier competes with the LCP element in Lighthouse's model and with the visitor's first impression
// of the page; a timer covers browsers that report no LCP entry.

export const SETTLE_MS = 600;
export const FALLBACK_MS = 3000;

export function afterLcp(run: () => void, doc: Document = document): void {
  const root = doc.documentElement;
  const start = (): void => {
    if (root.dataset['boot'] !== 'on') return run();
    const watch = new MutationObserver(() => {
      if (root.dataset['boot'] === 'on') return;
      watch.disconnect();
      run();
    });
    watch.observe(root, { attributes: true, attributeFilter: ['data-boot'] });
  };

  const afterLoad = (): void => {
    let done = false;
    const go = (): void => {
      if (done) return;
      done = true;
      observer?.disconnect();
      clearTimeout(timer);
      start();
    };
    let observer: PerformanceObserver | undefined;
    try {
      observer = new PerformanceObserver((list) => {
        if (list.getEntries().length > 0) setTimeout(go, SETTLE_MS);
      });
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {
      // No LCP entries in this browser: the timer below starts the work.
    }
    const timer = setTimeout(go, FALLBACK_MS);
  };

  if (doc.readyState === 'complete') afterLoad();
  else addEventListener('load', afterLoad, { once: true });
}
