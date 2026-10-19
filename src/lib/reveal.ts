// Section fades (Arnav, 2026-10-18: "animations for all sections, fade in and out"). Blocks fade and rise in as they
// enter the viewport and fade back out as they leave, so scrolling both ways feels alive. Only plain blocks are
// animated: the sticky Selected-work split, the experience rail, the 75 Hard orbit and the projects table keep
// their own scroll behaviour. Nothing is hidden until this runs (after the LCP paint), and the styles are injected
// here, not added to the render-blocking stylesheet. Reduced motion: opacity only, no movement.

/** Blocks that fade as one. */
export const BLOCKS = [
  '.work__head',
  '.index__head',
  '.exp__head',
  '.exp__honors',
  '.l-section__head',
  '.about__intro',
  '.about__skills',
  '.dock',
  '.free__grid > .free__side',
  '.gh__body',
  '.contact__grid',
  '.foot__inner',
] as const;
/** Lists whose items fade one after another. */
export const STAGGERED = ['.beyond__tiles > li', '.free__services > li'] as const;

/** The band of the viewport (6% in from top and bottom) in which a block counts as "in". */
export const BAND = 0.06;

/** True when any part of a box is inside the viewport band. */
export const inBand = (top: number, bottom: number, viewport: number): boolean =>
  bottom > viewport * BAND && top < viewport * (1 - BAND);

export const REVEAL_CSS = `.rv{opacity:0;transform:translate3d(0,var(--rv-y,28px),0);transition:opacity 450ms var(--ease-out),transform 450ms var(--ease-out)}
.rv.rv-in{opacity:1;transform:none;transition-duration:var(--dur-reveal);transition-delay:calc(var(--rv-i,0) * var(--stagger))}
:root[data-motion='reduced'] .rv{transform:none}
.rv-init{transition:none!important}`;

export interface Reveal {
  stop(): void;
}

export function startReveal(doc: Document = document): Reveal {
  const style = doc.createElement('style');
  style.textContent = REVEAL_CSS;
  doc.head.append(style);

  const targets = new Set<HTMLElement>();
  for (const selector of BLOCKS)
    for (const el of doc.querySelectorAll<HTMLElement>(selector)) targets.add(el);
  for (const selector of STAGGERED)
    doc.querySelectorAll<HTMLElement>(selector).forEach((el, i) => {
      el.style.setProperty('--rv-i', String(i));
      targets.add(el);
    });

  const vh = window.innerHeight;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('rv-in', entry.isIntersecting);
    },
    { rootMargin: `-${BAND * 100}% 0px -${BAND * 100}% 0px`, threshold: 0 },
  );
  for (const el of targets) {
    const r = el.getBoundingClientRect();
    // Decide the starting state at once, so what is already on screen never flashes or fades in on load.
    // rv-init makes the first hide instant: only later changes animate (a fade at start would be caught mid-way by audits).
    el.classList.add('rv', 'rv-init');
    if (inBand(r.top, r.bottom, vh)) el.classList.add('rv-in');
    io.observe(el);
  }
  requestAnimationFrame(() =>
    requestAnimationFrame(() => targets.forEach((el) => el.classList.remove('rv-init'))),
  );
  return {
    stop(): void {
      io.disconnect();
      for (const el of targets) el.classList.remove('rv', 'rv-in', 'rv-init');
      style.remove();
    },
  };
}
