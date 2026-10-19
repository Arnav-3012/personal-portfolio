// Dynamic motion (Arnav, 2026-10-19: "very dynamic" table and card animations). Started after the LCP paint
// (motion.ts) and skipped entirely with reduced motion:
//   - the all-projects table: one quiet highlight that glides between rows, a fine scan line on first view, rows that
//     slide in, rows that re-flow with a FLIP animation when a filter changes, counts that run up
//   - cards: a spotlight that follows the pointer
// Section titles moved to text-fx.ts (2026-10-20): the letter-noise decode rewrote the text every frame, so widths
// jittered and each frame cost a layout; the masked word rise there moves only transform and opacity.
// Pure helpers are exported for tests.
import dynamicCss from '../styles/dynamic.css?inline';

/** How far a row has to be moved back to look as if it had not moved: old top minus new top. */
export const flipDelta = (before: number, after: number): number => before - after;

/** Eases 0→1 so the number runs up quickly and settles. */
export const easeOut = (t: number): number => 1 - (1 - t) ** 3;

const POINTER_CARDS = '.service, .gh__repo';

/** A row is on screen unless the filter hid it or the fold (table-fold.ts) folded it away. */
const isShown = (row: HTMLElement): boolean => !row.hidden && !row.hasAttribute('data-fold');

export interface Dynamic {
  stop(): void;
}

function countUp(el: HTMLElement, ms = 900): void {
  const to = Number(el.textContent);
  if (!Number.isFinite(to) || to <= 0) return;
  const start = performance.now();
  const tick = (now: number): void => {
    const t = Math.min(1, (now - start) / ms);
    el.textContent = String(Math.round(to * easeOut(t)));
    if (t < 1) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

function table(doc: Document, fine: boolean): void {
  const scroll = doc.querySelector<HTMLElement>('.index__scroll');
  const tbl = doc.querySelector<HTMLElement>('[data-index-table]');
  if (!scroll || !tbl) return;
  const make = (cls: string): HTMLElement => {
    const el = doc.createElement('div');
    el.className = cls;
    el.setAttribute('aria-hidden', 'true');
    scroll.append(el);
    return el;
  };
  const glide = make('idx-glide');
  const scan = make('idx-scan');

  if (fine) {
    tbl.addEventListener('pointermove', (e) => {
      const row = (e.target as Element).closest<HTMLElement>('tbody tr');
      const box = scroll.getBoundingClientRect();
      if (!row || !isShown(row)) return;
      const r = row.getBoundingClientRect();
      glide.style.height = `${r.height}px`;
      glide.style.transform = `translate3d(0, ${r.top - box.top + scroll.scrollTop}px, 0)`;
      glide.style.opacity = '1';
    });
    tbl.addEventListener('pointerleave', () => {
      glide.style.opacity = '0';
    });
  }

  // First view: the scan line sweeps down and the filter counts run up.
  const first = (): void => {
    const height = tbl.getBoundingClientRect().height;
    scan.animate(
      [
        { transform: 'translateY(0)', opacity: 0 },
        { opacity: 1, offset: 0.12 },
        { transform: `translateY(${height}px)`, opacity: 0 },
      ],
      { duration: 1300, easing: 'cubic-bezier(0.65, 0, 0.35, 1)' },
    );
    doc.querySelectorAll<HTMLElement>('.index__count').forEach((el) => countUp(el));
  };
  if (tbl.dataset['reveal'] === 'in') first();
  else {
    const watch = new MutationObserver(() => {
      if (tbl.dataset['reveal'] !== 'in') return;
      watch.disconnect();
      first();
    });
    watch.observe(tbl, { attributes: true, attributeFilter: ['data-reveal'] });
  }

  // Filtering: rows that stay glide to their new place, rows that appear slide in, one after another.
  const filters = doc.querySelector('.index__filters');
  const rows = [...tbl.querySelectorAll<HTMLElement>('tbody tr')];
  filters?.addEventListener(
    'click',
    () => {
      const before = new Map(
        rows.filter((r) => !r.hidden).map((r) => [r, r.getBoundingClientRect().top]),
      );
      // After the filter's own handler has shown and hidden rows, and before the next paint.
      requestAnimationFrame(() => {
        let entering = 0;
        for (const row of rows) {
          if (!isShown(row)) continue;
          const old = before.get(row);
          const now = row.getBoundingClientRect().top;
          if (old === undefined) {
            row.animate(
              [
                { opacity: 0, transform: 'translateX(28px) scale(0.98)' },
                { opacity: 1, transform: 'none' },
              ],
              {
                duration: 520,
                delay: entering++ * 45,
                easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
                fill: 'backwards',
              },
            );
          } else if (Math.abs(flipDelta(old, now)) > 1) {
            row.animate(
              [{ transform: `translateY(${flipDelta(old, now)}px)` }, { transform: 'none' }],
              { duration: 480, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
            );
          }
        }
        glide.style.opacity = '0';
      });
    },
    true,
  );
}

function cards(doc: Document): void {
  let frame = 0;
  doc.addEventListener(
    'pointermove',
    (e) => {
      const card = (e.target as Element).closest<HTMLElement>(POINTER_CARDS);
      if (!card || frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--sx', `${e.clientX - r.left}px`);
        card.style.setProperty('--sy', `${e.clientY - r.top}px`);
      });
    },
    { passive: true },
  );
}

export function startDynamic(doc: Document = document): Dynamic | null {
  if (doc.documentElement.dataset['motion'] === 'reduced') return null;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const style = doc.createElement('style');
  style.textContent = dynamicCss;
  doc.head.append(style);
  table(doc, fine);
  if (fine) cards(doc);
  return {
    stop(): void {
      style.remove();
    },
  };
}
