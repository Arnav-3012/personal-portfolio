// The all-projects table is 21 rows long, which is a lot of scrolling for what is a list of one-liners. This shows the
// first few rows of whatever the filter matches, fades the last one, and puts "Show all N projects" under it. The filter
// still works over every row: each filter starts folded again, and a filter with only a few matches shows no button.
// Without JavaScript nothing is folded. The fold uses its own `data-fold` attribute (not `hidden`, which the filter owns).

/** Rows shown before the fold. */
export const FOLD_ROWS = 8;

/**
 * Which rows to fold away. `shown` says which rows the filter lets through; of those, everything after the first `limit`
 * is folded unless the list is expanded. A row the filter hides is never marked as folded.
 */
export function foldPlan(shown: readonly boolean[], limit: number, expanded: boolean): boolean[] {
  let seen = 0;
  return shown.map((on) => {
    if (!on) return false;
    seen += 1;
    return !expanded && seen > limit;
  });
}

export const foldLabel = (matching: number, expanded: boolean): string =>
  expanded ? 'Show fewer' : `Show all ${matching} projects`;

const CSS = `.index__table tbody tr[data-fold]{display:none}
.index__scroll[data-folded]{-webkit-mask-image:linear-gradient(to bottom,black calc(100% - 110px),transparent);mask-image:linear-gradient(to bottom,black calc(100% - 110px),transparent)}
.index__more{display:flex;justify-content:center;padding:var(--space-4) 0 0}
.index__more[hidden]{display:none}`;

export interface Fold {
  stop(): void;
}

export function startFold(doc: Document = document): Fold | null {
  const table = doc.querySelector<HTMLElement>('[data-index-table]');
  const scroll = doc.querySelector<HTMLElement>('.index__scroll');
  const tbody = table?.querySelector('tbody');
  if (!table || !scroll || !tbody) return null;
  const rows = [...tbody.querySelectorAll<HTMLElement>('tr')];
  if (rows.length <= FOLD_ROWS) return null;

  const reduced = (): boolean => doc.documentElement.dataset['motion'] === 'reduced';
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);

  tbody.id ||= 'index-rows';
  const wrap = doc.createElement('div');
  wrap.className = 'index__more';
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'button button--ghost';
  button.setAttribute('aria-controls', tbody.id);
  wrap.append(button);
  scroll.after(wrap);

  let expanded = false;
  const apply = (animate = false): void => {
    const shown = rows.map((r) => !r.hidden);
    const matching = shown.filter(Boolean).length;
    const folded = foldPlan(shown, FOLD_ROWS, expanded);
    const reveal: HTMLElement[] = [];
    rows.forEach((row, i) => {
      const was = row.hasAttribute('data-fold');
      row.toggleAttribute('data-fold', folded[i] ?? false);
      if (animate && was && !folded[i] && shown[i]) reveal.push(row);
    });
    const foldable = matching > FOLD_ROWS;
    wrap.hidden = !foldable;
    scroll.toggleAttribute('data-folded', foldable && !expanded);
    button.textContent = foldLabel(matching, expanded);
    button.setAttribute('aria-expanded', String(expanded));
    if (!reduced())
      reveal.forEach((row, n) =>
        row.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'none' },
          ],
          {
            duration: 480,
            delay: n * 35,
            easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
            fill: 'backwards',
          },
        ),
      );
  };

  // A filter click changes which rows are hidden: fold again from the top of the new list. A mutation observer runs
  // right after the filter's own handler, before the next paint, whatever order the scripts were loaded in.
  const watch = new MutationObserver(() => {
    expanded = false;
    apply();
  });
  watch.observe(tbody, { attributes: true, attributeFilter: ['hidden'], subtree: true });

  button.addEventListener('click', () => {
    expanded = !expanded;
    apply(true);
    // Folding back would leave the visitor looking at whatever now sits where the long list ended.
    if (!expanded)
      doc
        .getElementById('projects')
        ?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  });

  apply();
  return {
    stop(): void {
      watch.disconnect();
      rows.forEach((r) => r.removeAttribute('data-fold'));
      scroll.removeAttribute('data-folded');
      wrap.remove();
      style.remove();
    },
  };
}
