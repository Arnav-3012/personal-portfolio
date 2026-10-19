// The site's one loader (SPEC "Loading states and alerts"): minimal, on-theme, never a generic spinner. A small
// dot-matrix grid, the same dots the portrait and the globe are made of, with a diagonal wave of light running through
// it (the accent on the leading dot), a mono uppercase label, and a hairline bar underneath. The bar is indeterminate
// by default and shows true progress when a ratio is given (the 3D room will). Solid page colour behind it, so it joins
// seamlessly to the entry sequence's fade and to the arrival fade on the next page. Colours come from the tokens, so it
// is light on dark in Night and ink on paper in Day; with reduced motion it holds still.

export interface LoaderOptions {
  /** The words under the dots, e.g. "Loading". */
  label: string;
  /** True progress, 0–1. Leave out for an indeterminate bar. */
  progress?: number;
  doc?: Document;
}

export interface Loader {
  readonly el: HTMLElement;
  /** Updates progress (0–1), or `null` to go back to indeterminate. */
  set(ratio: number | null): void;
  remove(): void;
}

export const GRID = 5;

/** The diagonal a dot sits on (row + column): dots on the same diagonal light together, so a wave crosses the grid. */
export const diagonal = (index: number, size = GRID): number =>
  Math.floor(index / size) + (index % size);

const CSS = `.ld{position:fixed;inset:0;z-index:1150;display:grid;place-content:center;justify-items:center;gap:var(--space-5);background:var(--bg);color:var(--text-2);animation:ld-in 240ms var(--ease-out) both}
@keyframes ld-in{from{opacity:0}}
.ld__grid{display:grid;grid-template-columns:repeat(${GRID},6px);gap:8px}
.ld__dot{width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.2;animation:ld-wave 1.6s var(--ease-out) infinite;animation-delay:calc(var(--d) * 95ms)}
@keyframes ld-wave{0%,55%,100%{opacity:.2;background:currentColor}18%{opacity:1;background:var(--time)}}
.ld__label{margin:0;font:500 var(--type-hud)/1 var(--font-mono);letter-spacing:var(--track-hud);text-transform:uppercase}
.ld__bar{position:relative;width:120px;height:1px;overflow:hidden;background:var(--line)}
.ld__bar::after{content:'';position:absolute;inset:0;width:38%;background:var(--time);animation:ld-slide 1.5s var(--ease-out) infinite}
@keyframes ld-slide{from{transform:translateX(-100%)}to{transform:translateX(280%)}}
.ld[data-det] .ld__bar::after{width:100%;transform:scaleX(var(--p,0));transform-origin:left;animation:none;transition:transform 240ms var(--ease-out)}
:root[data-motion='reduced'] .ld__dot{animation:none;opacity:.5}
:root[data-motion='reduced'] .ld__bar::after{animation:none;width:38%;transform:none}
:root[data-motion='reduced'] .ld{animation:none}`;

let styled: WeakSet<Document> | undefined;
const ensureStyle = (doc: Document): void => {
  styled ??= new WeakSet();
  if (styled.has(doc)) return;
  styled.add(doc);
  const style = doc.createElement('style');
  style.dataset['loader'] = '';
  style.textContent = CSS;
  doc.head.append(style);
};

export function mountLoader({ label, progress, doc = document }: LoaderOptions): Loader {
  ensureStyle(doc);
  const el = doc.createElement('div');
  el.className = 'ld';
  el.setAttribute('role', 'status');
  const grid = doc.createElement('div');
  grid.className = 'ld__grid';
  grid.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < GRID * GRID; i++) {
    const dot = doc.createElement('span');
    dot.className = 'ld__dot';
    dot.style.setProperty('--d', String(diagonal(i)));
    grid.append(dot);
  }
  const text = doc.createElement('p');
  text.className = 'ld__label';
  text.textContent = label;
  const bar = doc.createElement('div');
  bar.className = 'ld__bar';
  bar.setAttribute('aria-hidden', 'true');
  el.append(grid, text, bar);
  const set = (ratio: number | null): void => {
    if (ratio === null) {
      el.removeAttribute('data-det');
      el.style.removeProperty('--p');
    } else {
      el.dataset['det'] = '';
      el.style.setProperty('--p', Math.min(1, Math.max(0, ratio)).toFixed(3));
    }
  };
  set(progress ?? null);
  doc.body.append(el);
  // Never leave it behind: a page restored from the back/forward cache must not still be covered.
  const gone = (): void => el.remove();
  addEventListener('pagehide', gone, { once: true });
  return { el, set, remove: gone };
}
