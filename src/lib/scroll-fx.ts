// Scroll-linked depth: a hairline showing how far down the page you are, and a gentle parallax in the hero (the portrait
// sinks a little slower than the page, the name rises a little faster, the corner links trail), so the hero has layers
// instead of scrolling away as one flat sheet. Transform-free for the layers (the `translate` property), one rAF per
// scroll. Reduced motion keeps the hairline and drops the parallax.

export const PARALLAX = { stage: 0.16, name: -0.07, quads: 0.05 } as const;
/** Parallax stops mattering once the hero is gone. */
export const PARALLAX_RANGE = 1.2;

/** Layer offsets (px) at scroll position `y` in a viewport `vh` tall. */
export function parallaxOffsets(
  y: number,
  vh: number,
): { stage: number; name: number; quads: number } {
  const p = Math.max(0, Math.min(y, vh * PARALLAX_RANGE));
  return { stage: p * PARALLAX.stage, name: p * PARALLAX.name, quads: p * PARALLAX.quads };
}

/** 0–1 progress down the page. */
export const pageProgress = (y: number, total: number, vh: number): number =>
  total - vh <= 0 ? 0 : Math.max(0, Math.min(1, y / (total - vh)));

const CSS = `.sbar{position:fixed;left:0;right:0;bottom:0;z-index:var(--z-progress);height:2px;pointer-events:none;background:linear-gradient(90deg,transparent,var(--time));transform:scaleX(0);transform-origin:left}`;

export function startScrollFx(doc: Document = document): { stop(): void } {
  const root = doc.documentElement;
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);
  const bar = doc.createElement('div');
  bar.className = 'sbar';
  bar.setAttribute('aria-hidden', 'true');
  doc.body.append(bar);

  const parallax = root.dataset['motion'] !== 'reduced';
  const stage = doc.querySelector<HTMLElement>('.hero__stage');
  const name = doc.querySelector<HTMLElement>('.hero__name');
  const quads = doc.querySelector<HTMLElement>('.hero__quads');
  let queued = false;
  const update = (): void => {
    queued = false;
    const y = scrollY;
    bar.style.transform = `scaleX(${pageProgress(y, root.scrollHeight, innerHeight)})`;
    if (!parallax) return;
    const o = parallaxOffsets(y, innerHeight);
    if (stage) stage.style.translate = `0 ${o.stage.toFixed(1)}px`;
    if (name) name.style.translate = `0 ${o.name.toFixed(1)}px`;
    if (quads) quads.style.translate = `0 ${o.quads.toFixed(1)}px`;
  };
  const onScroll = (): void => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  };
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  update();
  return {
    stop() {
      removeEventListener('scroll', onScroll);
      removeEventListener('resize', onScroll);
      bar.remove();
      style.remove();
    },
  };
}
