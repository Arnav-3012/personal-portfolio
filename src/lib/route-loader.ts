// No blank frames between pages. When a click leaves this page for another page of the site and the next page is not
// there within a moment, the site's loader (loader.ts) covers the wait instead of leaving the old page frozen. Links are
// also prefetched when the pointer or focus reaches them, so most navigations finish before the loader would show.
// Part of the shell (Base.astro): every current and future page gets it.
import { mountLoader, type Loader } from './loader';

/** How long a navigation may take before the loader shows; faster ones never flash it. */
export const SHOW_AFTER_MS = 200;
/** If the page is still here after this long, the navigation was cancelled or stalled: take the loader away. */
export const GIVE_UP_MS = 12_000;
export const MAX_PREFETCH = 6;

const FILE = /\.(pdf|png|jpe?g|gif|webp|avif|svg|mp4|webm|mp3|json|txt|xml|zip|woff2?)$/i;

export interface Place {
  href: string;
  origin: string;
  pathname: string;
  search: string;
}

/** True when following `a` from `from` loads another page of this site (not a hash jump, new tab, download or file). */
export function isPageNavigation(
  a: { href: string; target?: string; hasAttribute?: (n: string) => boolean },
  from: Place,
): boolean {
  if (a.target && a.target !== '_self') return false;
  if (a.hasAttribute?.('download')) return false;
  let url: URL;
  try {
    url = new URL(a.href, from.href);
  } catch {
    return false;
  }
  if (!/^https?:$/.test(url.protocol) || url.origin !== from.origin) return false;
  if (url.pathname === from.pathname && url.search === from.search) return false;
  if (url.pathname.startsWith('/api/') || FILE.test(url.pathname)) return false;
  return true;
}

export function initRouteLoader(doc: Document = document): void {
  let timer = 0;
  let giveUp = 0;
  let loader: Loader | undefined;
  const clear = (): void => {
    clearTimeout(timer);
    clearTimeout(giveUp);
    loader?.remove();
    loader = undefined;
  };

  const prefetched = new Set<string>();
  const prefetch = (target: EventTarget | null): void => {
    const a = (target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
    if (!a || !isPageNavigation(a, location) || prefetched.size >= MAX_PREFETCH) return;
    const url = new URL(a.href);
    if (prefetched.has(url.pathname)) return;
    prefetched.add(url.pathname);
    const link = doc.createElement('link');
    link.rel = 'prefetch';
    link.href = url.href;
    doc.head.append(link);
  };
  doc.addEventListener('pointerover', (e) => prefetch(e.target), { passive: true });
  doc.addEventListener('focusin', (e) => prefetch(e.target), { passive: true });

  doc.addEventListener('click', (e) => {
    // After every other handler: a link something else took over (the entry sequence, a menu) is not a page load.
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
      return;
    const a = (e.target as Element | null)?.closest?.<HTMLAnchorElement>('a[href]');
    if (!a || !isPageNavigation(a, location)) return;
    clear();
    timer = window.setTimeout(() => {
      loader = mountLoader({ label: 'Loading', doc });
      giveUp = window.setTimeout(clear, GIVE_UP_MS);
    }, SHOW_AFTER_MS);
  });
  // Leaving the page, or coming back to it from the back/forward cache, ends any loading state.
  addEventListener('pagehide', clear);
  addEventListener('pageshow', clear);
  doc.addEventListener('keydown', (e) => e.key === 'Escape' && clear());
}
