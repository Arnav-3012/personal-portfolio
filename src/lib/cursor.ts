// A cursor that changes with the section under it (Arnav, 2026-10-19: "a different cursor arrow according to the
// sections"). A small glass disc follows the pointer and carries a glyph that fits where you are: crosshair over the
// hero, an open-out arrow over work, a vertical arrow over the experience rail, a horizontal one over 75 Hard, a play
// mark over the tiles, a pencil over contact. Over anything clickable the disc swells and fills with the amber.
// Fine pointers with full motion only; text fields, dialogs, the EDITH panel and the entry sequence keep the native
// cursor. Never in the render-blocking CSS: the styles are injected here, after the LCP paint.

export type CursorKind =
  'arrow' | 'cross' | 'open' | 'vertical' | 'horizontal' | 'next' | 'commit' | 'play' | 'pencil';

/** Section selector → glyph. Sections never nest, so order does not matter. (`#75-hard` is not a valid selector.) */
export const SECTION_KINDS: readonly [string, CursorKind][] = [
  ['[data-hero]', 'cross'],
  ['#work,#projects', 'open'],
  ['#experience', 'vertical'],
  ['[id="75-hard"]', 'horizontal'],
  ['#about', 'arrow'],
  ['#freelance', 'next'],
  ['#github', 'commit'],
  ['#beyond', 'play'],
  ['#contact', 'pencil'],
];

interface Closest {
  closest(selector: string): unknown;
}

export function cursorKind(el: Closest | null): CursorKind {
  if (!el) return 'arrow';
  // Anything you can drag sideways says so, wherever it sits.
  if (el.closest('[data-swipe]')) return 'horizontal';
  for (const [selector, kind] of SECTION_KINDS) if (el.closest(selector)) return kind;
  return 'arrow';
}

export const CLICKABLE =
  'a,button,summary,label,[role=button],[role=tab],[tabindex]:not([tabindex="-1"])';
export const NATIVE =
  'input,textarea,select,[contenteditable],dialog,[role=dialog],video,iframe,[class*="edith"],.ent';

export const isClickable = (el: Closest | null): boolean => Boolean(el?.closest(CLICKABLE));
export const wantsNative = (el: Closest | null): boolean => Boolean(el?.closest(NATIVE));

/** Frame-rate independent ease: about 63% of the way after `1/rate` seconds. */
export const follow = (current: number, target: number, dt: number, rate: number): number =>
  dt <= 0 ? target : current + (target - current) * (1 - Math.exp(-rate * dt));

const GLYPHS: Record<CursorKind, string> = {
  arrow: '<path d="M6 4l12 6.5-5.2 1.7L10.6 18z"/>',
  cross: '<circle cx="12" cy="12" r="2"/><path d="M12 3.5v4M12 16.5v4M3.5 12h4M16.5 12h4"/>',
  open: '<path d="M7 17 17 7M8.5 7H17v8.5"/>',
  vertical: '<path d="M12 4v16M8.5 7.5 12 4l3.5 3.5M8.5 16.5 12 20l3.5-3.5"/>',
  horizontal: '<path d="M4 12h16M7.5 8.5 4 12l3.5 3.5M16.5 8.5 20 12l-3.5 3.5"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  commit: '<circle cx="12" cy="12" r="3.5"/><path d="M3.5 12h5M15.5 12h5"/>',
  play: '<path d="M9 6.5v11l9-5.5z"/>',
  pencil: '<path d="M5 19l.9-3.9L16 5l3 3L8.9 18.1zM14 7l3 3"/>',
};

export const CURSOR_CSS = `html.cur-on,html.cur-on *{cursor:none!important}
.cur{position:fixed;left:0;top:0;z-index:calc(var(--z-toast) + 20);pointer-events:none;opacity:0;transition:opacity 180ms var(--ease-out)}
.cur--show{opacity:1}
.cur__disc{display:grid;place-items:center;width:34px;height:34px;margin:-17px 0 0 -17px;border:1px solid color-mix(in srgb,var(--text) 26%,transparent);border-radius:50%;background:color-mix(in srgb,var(--bg) 60%,transparent);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);color:var(--text);transition:transform 240ms var(--ease-out),background-color 200ms var(--ease-out),border-color 200ms var(--ease-out),color 200ms var(--ease-out)}
.cur__glyph{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.cur--hot .cur__disc{transform:scale(1.5);border-color:var(--time);background:var(--time);color:var(--bg)}
.cur--down .cur__disc{transform:scale(.82)}
.cur--hot.cur--down .cur__disc{transform:scale(1.2)}
.cur--swap .cur__glyph{animation:cur-pop 220ms var(--ease-out)}
@keyframes cur-pop{from{transform:scale(.4) rotate(-25deg);opacity:0}}`;

export function startCursor(doc: Document = document): { stop(): void } | null {
  const root = doc.documentElement;
  if (
    root.dataset['motion'] === 'reduced' ||
    !matchMedia('(hover: hover) and (pointer: fine)').matches
  )
    return null;

  const style = doc.createElement('style');
  style.textContent = CURSOR_CSS;
  doc.head.append(style);
  const cur = doc.createElement('div');
  cur.className = 'cur';
  cur.setAttribute('aria-hidden', 'true');
  cur.innerHTML = `<div class="cur__disc"><svg class="cur__glyph" viewBox="0 0 24 24">${GLYPHS.arrow}</svg></div>`;
  doc.body.append(cur);
  const glyph = cur.querySelector('svg') as SVGSVGElement;

  let kind: CursorKind = 'arrow';
  let tx = -100;
  let ty = -100;
  let x = tx;
  let y = ty;
  let seen = false;
  let last = performance.now();
  let frame = 0;

  const setKind = (next: CursorKind): void => {
    if (next === kind) return;
    kind = next;
    glyph.innerHTML = GLYPHS[next];
    cur.classList.remove('cur--swap');
    void cur.offsetWidth;
    cur.classList.add('cur--swap');
  };
  const tick = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    x = follow(x, tx, dt, 32);
    y = follow(y, ty, dt, 32);
    cur.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;
    frame = requestAnimationFrame(tick);
  };
  const onMove = (e: PointerEvent): void => {
    if (e.pointerType !== 'mouse') return;
    tx = e.clientX;
    ty = e.clientY;
    const el = e.target as Element | null;
    if (!seen) {
      seen = true;
      x = tx;
      y = ty;
    }
    const native = wantsNative(el);
    root.classList.toggle('cur-on', !native);
    cur.classList.toggle('cur--show', !native);
    if (native) return;
    setKind(cursorKind(el));
    cur.classList.toggle('cur--hot', isClickable(el));
  };
  const onLeave = (e: MouseEvent): void => {
    if (e.relatedTarget) return;
    cur.classList.remove('cur--show');
    root.classList.remove('cur-on');
  };
  const down = (): void => cur.classList.add('cur--down');
  const up = (): void => cur.classList.remove('cur--down');
  doc.addEventListener('pointermove', onMove, { passive: true });
  doc.addEventListener('mouseout', onLeave);
  doc.addEventListener('pointerdown', down, { passive: true });
  doc.addEventListener('pointerup', up, { passive: true });
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(frame);
      doc.removeEventListener('pointermove', onMove);
      doc.removeEventListener('mouseout', onLeave);
      doc.removeEventListener('pointerdown', down);
      doc.removeEventListener('pointerup', up);
      root.classList.remove('cur-on');
      cur.remove();
      style.remove();
    },
  };
}
