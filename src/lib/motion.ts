// Decorative motion for the landing (Arnav, 2026-10-18): the neural-network hero background, the section fades, scroll depth, the section cursor and smooth scrolling.
// Both are separate chunks, fetched and started only after the LCP paint (after-lcp.ts), so they never sit on the
// critical path.
import { afterLcp } from './after-lcp';

export function initMotion(): void {
  afterLcp(() => {
    void import('./neural').then((m) => m.startNeural());
    void import('./table-fold').then((m) => m.startFold());
    void import('./reveal').then((m) => m.startReveal());
    void import('./workshop-entry').then((m) => m.startWorkshopEntry());
    void import('./dynamic').then((m) => m.startDynamic());
    void import('./scroll-fx').then((m) => m.startScrollFx());
    void import('./lazy-fade').then((m) => m.startLazyFade());
    void import('./cursor').then((m) => m.startCursor());
    void import('./smooth').then((m) => m.startSmooth());
    void import('./beyond-fx').then((m) => m.startBeyond());
  });
}
