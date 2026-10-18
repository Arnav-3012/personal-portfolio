// Skills dock (SPEC row 7): tiles grow as the pointer nears, like a macOS dock. Decoration only, so it runs for
// fine pointers with motion on; touch and reduced motion get the static row.

/** Scale for a tile `distance` px from the pointer: a cosine bell from `max` at 0 down to 1 at `radius`. */
export function dockScale(distance: number, radius = 170, max = 1.35): number {
  const d = Math.abs(distance);
  if (d >= radius) return 1;
  return 1 + ((max - 1) * (1 + Math.cos((Math.PI * d) / radius))) / 2;
}

export function initDock(doc: Document = document): void {
  const dock = doc.querySelector<HTMLElement>('[data-dock]');
  if (!dock || doc.documentElement.dataset['motion'] === 'reduced') return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const tiles = [...dock.querySelectorAll<HTMLElement>('[data-dock-item]')];

  const reset = (): void => {
    for (const t of tiles) t.style.removeProperty('--s');
  };
  dock.addEventListener('pointermove', (e) => {
    for (const t of tiles) {
      const r = t.getBoundingClientRect();
      t.style.setProperty('--s', dockScale(e.clientX - (r.left + r.width / 2)).toFixed(3));
    }
  });
  dock.addEventListener('pointerleave', reset);
}
