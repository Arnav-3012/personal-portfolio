// Selected work and the all-projects index (SPEC rows 4–5), kept pure so they're unit-tested.
import type { Project } from './content';

export const SELECTED_COUNT = 5;
export const STATUS_FILTERS = ['all', 'shipped', 'building', 'coming-soon'] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

export const STATUS_LABEL: Record<Project['status'], string> = {
  shipped: 'Shipped',
  building: 'Building',
  'coming-soon': 'Coming soon',
};

/** The sticky split shows the first five hero-tier projects by `order`. */
export const selectedWork = (all: readonly Project[]): Project[] =>
  all
    .filter((p) => p.tier === 'hero')
    .toSorted((a, b) => a.order - b.order)
    .slice(0, SELECTED_COUNT);

export const filterProjects = (all: readonly Project[], filter: StatusFilter): Project[] =>
  filter === 'all' ? [...all] : all.filter((p) => p.status === filter);

/** Chip counts for the filter buttons; always derived from content. */
export const statusCounts = (all: readonly Project[]): Record<StatusFilter, number> => ({
  all: all.length,
  shipped: all.filter((p) => p.status === 'shipped').length,
  building: all.filter((p) => p.status === 'building').length,
  'coming-soon': all.filter((p) => p.status === 'coming-soon').length,
});

export const filterLabel = (f: StatusFilter): string => (f === 'all' ? 'All' : STATUS_LABEL[f]);

/** Year column: coming-soon projects have no year yet. */
export const yearLabel = (p: Pick<Project, 'year'>): string =>
  p.year === null ? '—' : String(p.year);

const UNITS = new Set(['ms', 'dB', 's', 'KB', 'MB', 'GB']);

/**
 * Splits a stat string into a big value and a small label, so the pane can show numbers first:
 * "95.75% fire recall" -> 95.75% / fire recall; "ECE 0.169 → 0.011" -> 0.169 → 0.011 / ECE.
 */
export function splitStat(stat: string): { value: string; label: string } {
  const words = stat.trim().split(/\s+/);
  const hasDigit = (w: string): boolean => /\d/.test(w);
  const first = words.findIndex(hasDigit);
  if (first === -1) return { value: stat.trim(), label: '' };
  if (first > 0) {
    // "ECE 0.169 → 0.011", "AUC unchanged 0.784": words first, then the figure
    return { value: words.slice(first).join(' '), label: words.slice(0, first).join(' ') };
  }
  const unit = words[1] !== undefined && UNITS.has(words[1]) ? 1 : 0;
  return {
    value: words.slice(0, 1 + unit).join(' '),
    label: words.slice(1 + unit).join(' '),
  };
}

/**
 * Index of the block nearest the viewport centre, or -1 with no blocks. With `current` and `margin`, the
 * active block only changes once another one is closer by more than `margin` px, so the pane doesn't flicker
 * between two projects at the boundary.
 */
export function activeIndex(
  centres: readonly number[],
  viewportCentre: number,
  current = -1,
  margin = 0,
): number {
  let best = -1;
  let bestDist = Infinity;
  centres.forEach((c, i) => {
    const d = Math.abs(c - viewportCentre);
    if (d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  const held = centres[current];
  if (
    best !== current &&
    held !== undefined &&
    Math.abs(held - viewportCentre) - bestDist <= margin
  )
    return current;
  return best;
}

/** Wires the filter buttons to the index rows. Without JS every row stays visible. */
export function initWork(doc: Document = document): void {
  const split = doc.querySelector<HTMLElement>('[data-work-split]');
  if (split) {
    const items = [...split.querySelectorAll<HTMLElement>('[data-work-item]')];
    const panes = [...split.querySelectorAll<HTMLElement>('[data-work-pane]')];
    const ticks = [...split.querySelectorAll<HTMLElement>('[data-work-tick]')];
    const count = split.querySelector<HTMLElement>('[data-work-count]');
    let current = -1;
    const setActive = (i: number): void => {
      current = i;
      ticks.forEach((el, n) => el.toggleAttribute('data-active', n <= i));
      if (count) count.textContent = String(i + 1).padStart(2, '0');
      items.forEach((el, n) => el.toggleAttribute('data-active', n === i));
      // Only the visible pane is focusable or announced; the others are inert.
      panes.forEach((el, n) => {
        el.toggleAttribute('data-active', n === i);
        el.inert = n !== i;
      });
    };
    setActive(0);
    const update = (): void => {
      const mid = innerHeight / 2;
      const i = activeIndex(
        items.map((el) => {
          const r = el.getBoundingClientRect();
          return r.top + r.height / 2;
        }),
        mid,
        current,
        innerHeight * 0.12,
      );
      if (i >= 0 && i !== current) setActive(i);
    };
    let ticking = false;
    addEventListener(
      'scroll',
      () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          update();
        });
      },
      { passive: true },
    );
    addEventListener('resize', update);
    items.forEach((el, n) => el.addEventListener('focusin', () => setActive(n)));
  }

  const table = doc.querySelector<HTMLElement>('[data-index-table]');
  if (table && 'IntersectionObserver' in window) {
    table.dataset['reveal'] = 'ready';
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      table.dataset['reveal'] = 'in';
      seen.disconnect();
    });
    seen.observe(table);
  }

  const buttons = [...doc.querySelectorAll<HTMLButtonElement>('[data-filter]')];
  const rows = [...doc.querySelectorAll<HTMLElement>('[data-status]')];
  const empty = doc.querySelector<HTMLElement>('[data-index-empty]');
  const live = doc.querySelector<HTMLElement>('[data-index-count]');
  buttons.forEach((btn) =>
    btn.addEventListener('click', () => {
      const f = btn.dataset['filter'] as StatusFilter;
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
      let shown = 0;
      rows.forEach((row) => {
        const match = f === 'all' || row.dataset['status'] === f;
        row.hidden = !match;
        if (match) shown++;
      });
      if (empty) empty.hidden = shown > 0;
      if (live) live.textContent = `${shown} ${shown === 1 ? 'project' : 'projects'}`;
    }),
  );
}
