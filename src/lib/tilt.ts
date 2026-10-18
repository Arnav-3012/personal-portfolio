// Beyond code tiles (SPEC row 10): a small 3D tilt toward the pointer. Fine pointers with motion on only.

/** Rotation in degrees for a pointer at (x, y) inside a w × h box: up to `max`, zero at the centre. */
export function tiltFor(x: number, y: number, w: number, h: number, max = 5) {
  if (w <= 0 || h <= 0) return { rx: 0, ry: 0 };
  const nx = Math.min(1, Math.max(0, x / w)) * 2 - 1;
  const ny = Math.min(1, Math.max(0, y / h)) * 2 - 1;
  // Pointer on the right tilts the right edge away (positive Y rotation); pointer low tilts the bottom away.
  return { rx: +(-ny * max).toFixed(2), ry: +(nx * max).toFixed(2) };
}

export function initTilt(doc: Document = document): void {
  if (doc.documentElement.dataset['motion'] === 'reduced') return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  for (const tile of doc.querySelectorAll<HTMLElement>('[data-tilt]')) {
    tile.addEventListener('pointermove', (e) => {
      const r = tile.getBoundingClientRect();
      const { rx, ry } = tiltFor(e.clientX - r.left, e.clientY - r.top, r.width, r.height);
      tile.style.setProperty('--rx', `${rx}deg`);
      tile.style.setProperty('--ry', `${ry}deg`);
    });
    tile.addEventListener('pointerleave', () => {
      tile.style.removeProperty('--rx');
      tile.style.removeProperty('--ry');
    });
  }
}
