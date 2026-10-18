// Experience rail (SPEC row 6), kept pure so it's unit-tested. The rail line draws with scroll progress and
// each role's node lights once the line reaches it.
import type { Site } from './content';

export type Honor = Site['honors'][number];

/** Hackathons and challenges, newest year first; the input order breaks ties so the file stays in charge. */
export const honorsNewestFirst = (honors: readonly Honor[]): Honor[] =>
  honors.toSorted((a, b) => b.year - a.year);

/**
 * How far a section has scrolled through a viewport line, 0 to 1. `anchor` is where that line sits as a
 * fraction of the viewport height (0.6 keeps the line a little below centre so the tip stays in view).
 */
export function scrollProgress(top: number, height: number, vh: number, anchor = 0.6): number {
  if (height <= 0) return 1;
  return Math.min(1, Math.max(0, (vh * anchor - top) / height));
}

/** A node is lit once the rail's drawn tip (as a y position on the page) has passed its centre. */
export const isLit = (nodeCentreY: number, tipY: number): boolean => tipY >= nodeCentreY;

/** Wires the rail. Without JS or with reduced motion the rail stays fully drawn and every node lit. */
export function initExperience(doc: Document = document): void {
  const rail = doc.querySelector<HTMLElement>('[data-rail]');
  if (!rail || doc.documentElement.dataset['motion'] === 'reduced') return;
  const nodes = [...rail.querySelectorAll<HTMLElement>('[data-rail-node]')];
  rail.dataset['rail'] = 'draw';

  const update = (): void => {
    const box = rail.getBoundingClientRect();
    const p = scrollProgress(box.top, box.height, innerHeight);
    rail.style.setProperty('--p', p.toFixed(4));
    const tip = box.top + box.height * p;
    for (const node of nodes) {
      const r = node.getBoundingClientRect();
      node.toggleAttribute('data-lit', isLit(r.top + r.height / 2, tip));
    }
  };
  let ticking = false;
  const onScroll = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      update();
    });
  };
  update();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', onScroll);
}
