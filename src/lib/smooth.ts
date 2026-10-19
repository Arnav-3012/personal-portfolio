// Smooth scrolling (Arnav, 2026-10-19: "proper scroll animations, smooth transitions"). Lenis eases the mouse wheel into
// one continuous glide and makes in-page links glide to their section. It runs only for a fine pointer with full motion
// (touch keeps the browser's own momentum scrolling, reduced motion keeps plain scrolling), starts after the LCP paint
// (motion.ts), and leaves scrollable panels (EDITH, the reel player) alone. The projects table is not one of them: it only scrolls sideways, so
// a wheel over it must go to the page's glide, or the first flick is swallowed and the visitor has to scroll twice.

export const SMOOTH_CSS = `html.lenis,html.lenis body{height:auto}
.lenis.lenis-smooth{scroll-behavior:auto!important}
.lenis.lenis-stopped{overflow:clip}
.lenis.lenis-smooth iframe{pointer-events:none}`;

/** Wheel and touch inside these keep the browser's own scrolling. */
export const NATIVE_SCROLL = 'dialog,[role=dialog],[data-lenis-prevent],[class*="edith"],.ent';

/** Fine pointer, full motion. */
export function smoothEligible(root: HTMLElement, fine: boolean): boolean {
  return fine && root.dataset['motion'] !== 'reduced';
}

/** An in-page link's target: `#id` only, and only when that element exists. */
export function anchorTarget(
  href: string | null,
  doc: Pick<Document, 'getElementById'>,
): HTMLElement | null {
  if (!href || href.length < 2 || !href.startsWith('#')) return null;
  return doc.getElementById(decodeURIComponent(href.slice(1)));
}

export interface Smooth {
  stop(): void;
}

export async function startSmooth(doc: Document = document): Promise<Smooth | null> {
  const root = doc.documentElement;
  if (!smoothEligible(root, matchMedia('(hover: hover) and (pointer: fine)').matches)) return null;
  const { default: Lenis } = await import('lenis');
  const style = doc.createElement('style');
  style.textContent = SMOOTH_CSS;
  doc.head.append(style);

  const lenis = new Lenis({
    lerp: 0.11,
    wheelMultiplier: 0.95,
    prevent: (node: Element) => Boolean(node.closest(NATIVE_SCROLL)),
  });
  let frame = requestAnimationFrame(function tick(time: number) {
    lenis.raf(time);
    frame = requestAnimationFrame(tick);
  });

  // In-page links glide to their section instead of jumping, keeping the section's own scroll margin below the nav.
  const onClick = (event: MouseEvent): void => {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey
    )
      return;
    const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href^="#"]');
    const target = anchorTarget(link?.getAttribute('href') ?? null, doc);
    if (!link || !target) return;
    event.preventDefault();
    const margin = parseFloat(getComputedStyle(target).scrollMarginTop) || 0;
    lenis.scrollTo(target, { offset: -margin, duration: 1.3, easing: (t) => 1 - (1 - t) ** 4 });
    history.pushState(null, '', link.getAttribute('href'));
  };
  doc.addEventListener('click', onClick);

  return {
    stop() {
      cancelAnimationFrame(frame);
      doc.removeEventListener('click', onClick);
      lenis.destroy();
      style.remove();
    },
  };
}
