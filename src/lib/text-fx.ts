// Text motion (Arnav, 2026-10-20: "crazy dynamic text effects, minimal, smooth but engaging"). Three effects, each
// moving only transform, opacity or (for the mono labels) the characters of a fixed-width font, so nothing reflows:
//   - Titles: every letter flips up from behind its word's edge (a 3D tilt, 28 ms apart), and letters near the cursor
//     lift and swell, falling off with distance (fine pointers only).
//   - Paragraphs (About, the quote): a reading highlight. Words start dim and light up one after another as the
//     paragraph scrolls through the viewport, and dim again when scrolled back.
//   - Section labels (mono): a short decode from noise. Mono glyphs have one width, so the label never jitters.
// Title and paragraph effects reverse or follow the scroll in both directions. Real spaces stay between the spans,
// so wrapping, copy and screen readers see ordinary text. Nothing is split until this runs (after the LCP paint).
// Reduced motion: nothing is split or decoded; reveal.ts's plain fade is all that runs.
import { BAND, inBand } from './reveal';

export const TITLES = [
  '.work__head .display',
  '.index__head .display',
  '.exp__head .display',
  '.l-section__head .display',
] as const;
export const READING = ['.about__text p', '.about__quote blockquote p'] as const;
export const LABELS = ['.work__eyebrow', '.exp__eyebrow', '.l-section__eyebrow'] as const;

/** Opacity of a word before it is read. */
export const DIM = 0.16;
/** Words lit at the same time: the highlight is a soft band this many words wide. */
export const BAND_WORDS = 4;
/** Cursor reach (px) of the letter lift. */
export const REACH = 170;

export const TEXT_FX_CSS = `.tx-w{display:inline-block;white-space:nowrap;overflow:clip;vertical-align:top;padding-block:.25em;margin-block:-.25em;perspective:520px}
.tx-c{display:inline-block;transform-origin:50% 100%;transform:translate3d(0,130%,0) rotateX(-70deg);translate:0 var(--hy,0);scale:var(--hs,1);transition:transform 420ms var(--ease-out),translate 220ms var(--ease-out),scale 220ms var(--ease-out)}
.tx-in .tx-c{transform:none;transition:transform 900ms var(--ease-out) calc(var(--i,0) * var(--stagger) * .45),translate 220ms var(--ease-out),scale 220ms var(--ease-out)}
.tx-r{opacity:var(--o,${DIM});transition:opacity 160ms linear}
.tx-init,.tx-init *{transition:none!important}
.rv:has(.tx){--rv-y:0px}`;

/** Opacity of word `i` of `n` when the paragraph is `p` (0–1) of the way read: a soft band moving word by word. */
export function wordOpacity(p: number, i: number, n: number): number {
  const lit = (p * (n + BAND_WORDS) - i) / BAND_WORDS;
  return DIM + (1 - DIM) * Math.min(1, Math.max(0, lit));
}

/** Reading progress of a box: 0 as its top rises past 90% of the viewport, 1 when its bottom passes 40%. */
export function readProgress(top: number, height: number, viewport: number): number {
  const start = viewport * 0.9;
  const end = viewport * 0.4;
  return Math.min(1, Math.max(0, (start - top) / (start - end + height)));
}

/** How strongly a letter reacts to a cursor `distance` px away: 1 right under it, 0 at `REACH` and beyond. */
export function proximity(distance: number): number {
  const k = Math.max(0, 1 - distance / REACH);
  return k * k;
}

export const GLYPHS = '01<>/\\{}[]+=*#%&';

/** One frame of the label decode: the first `progress` (0–1) of the characters are real, the rest noise. */
export function scrambleFrame(target: string, progress: number, rand: () => number): string {
  const settled = Math.floor(progress * target.length);
  return [...target]
    .map((ch, i) =>
      i < settled || !/[A-Za-z0-9]/.test(ch)
        ? ch
        : (GLYPHS[Math.floor(rand() * GLYPHS.length)] ?? ch),
    )
    .join('');
}

/** The words of a text and the whitespace between them, in order. */
export function splitText(text: string): string[] {
  return text.split(/(\s+)/).filter((part) => part !== '');
}

export interface TextFx {
  stop(): void;
}

const plain = (el: HTMLElement): boolean =>
  el.children.length === 0 && (el.textContent ?? '').trim() !== '';

/** Titles become words of letters; returns the letters in order. */
function splitTitle(el: HTMLElement): HTMLElement[] {
  const letters: HTMLElement[] = [];
  const nodes: Node[] = [];
  for (const part of splitText(el.textContent ?? '')) {
    if (/^\s+$/.test(part)) {
      nodes.push(document.createTextNode(part));
      continue;
    }
    const word = document.createElement('span');
    word.className = 'tx-w';
    for (const ch of part) {
      const c = document.createElement('span');
      c.className = 'tx-c';
      c.textContent = ch;
      c.style.setProperty('--i', String(letters.length));
      word.append(c);
      letters.push(c);
    }
    nodes.push(word);
  }
  el.replaceChildren(...nodes);
  el.classList.add('tx');
  return letters;
}

/** Paragraphs become words that can be dimmed one by one. */
function splitReading(el: HTMLElement): void {
  const parts = splitText(el.textContent ?? '');
  const words = parts.filter((p) => !/^\s+$/.test(p)).length;
  let i = 0;
  el.replaceChildren(
    ...parts.map((part) => {
      if (/^\s+$/.test(part)) return document.createTextNode(part);
      const w = document.createElement('span');
      w.className = 'tx-r';
      w.textContent = part;
      w.style.setProperty('--i', String(i++));
      return w;
    }),
  );
  el.style.setProperty('--n', String(words));
  el.classList.add('tx');
}

export function startTextFx(doc: Document = document): TextFx | null {
  const root = doc.documentElement;
  if (root.dataset['motion'] === 'reduced') return null;
  const style = doc.createElement('style');
  style.textContent = TEXT_FX_CSS;
  doc.head.append(style);

  const originals = new Map<HTMLElement, string>();
  const pick = (selectors: readonly string[]): HTMLElement[] =>
    selectors
      .flatMap((s) => [...doc.querySelectorAll<HTMLElement>(s)])
      // Plain text only: anything with markup inside (links, emphasis) is left to the block fade.
      .filter(plain);
  const remember = (els: HTMLElement[]): void =>
    els.forEach((el) => originals.set(el, el.textContent ?? ''));

  const titles = pick(TITLES);
  const reading = pick(READING);
  const labels = pick(LABELS);
  remember([...titles, ...reading, ...labels]);

  const vh = window.innerHeight;
  const letters = new Map<HTMLElement, HTMLElement[]>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('tx-in', entry.isIntersecting);
    },
    { rootMargin: `-${BAND * 100}% 0px -${BAND * 100}% 0px`, threshold: 0 },
  );
  for (const el of titles) {
    letters.set(el, splitTitle(el));
    el.classList.add('tx-init');
    const r = el.getBoundingClientRect();
    if (inBand(r.top, r.bottom, vh)) el.classList.add('tx-in');
    io.observe(el);
  }

  // Reading highlight: one scroll listener, one frame at a time, one custom property per paragraph.
  for (const el of reading) {
    splitReading(el);
    el.classList.add('tx-init');
  }
  const words = new Map(reading.map((el) => [el, [...el.querySelectorAll<HTMLElement>('.tx-r')]]));
  let frame = 0;
  const last = new Map<HTMLElement, number>();
  const paint = (): void => {
    frame = 0;
    for (const [el, spans] of words) {
      const r = el.getBoundingClientRect();
      const p = readProgress(r.top, r.height, window.innerHeight);
      // Far above or below the reading band the progress is pinned at 0 or 1, so nothing is rewritten.
      if (last.get(el) === p) continue;
      last.set(el, p);
      spans.forEach((w, i) => w.style.setProperty('--o', String(wordOpacity(p, i, spans.length))));
    }
  };
  const schedule = (): void => {
    if (!frame) frame = requestAnimationFrame(paint);
  };
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule, { passive: true });
  paint();

  // Letters near the cursor lift and swell. `translate` and `scale` are separate from the rise's `transform`.
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  let pointer: { x: number; y: number } | null = null;
  let hoverFrame = 0;
  const lift = (): void => {
    hoverFrame = 0;
    for (const [el, cs] of letters) {
      if (!el.classList.contains('tx-in')) continue;
      for (const c of cs) {
        let k = 0;
        if (pointer) {
          const r = c.getBoundingClientRect();
          k = proximity(
            Math.hypot(pointer.x - (r.left + r.width / 2), pointer.y - (r.top + r.height / 2)),
          );
        }
        c.style.setProperty('--hy', `${(-k * 0.16).toFixed(3)}em`);
        c.style.setProperty('--hs', (1 + k * 0.14).toFixed(3));
      }
    }
  };
  const onMove = (e: PointerEvent): void => {
    pointer = { x: e.clientX, y: e.clientY };
    if (!hoverFrame) hoverFrame = requestAnimationFrame(lift);
  };
  const onLeave = (): void => {
    pointer = null;
    if (!hoverFrame) hoverFrame = requestAnimationFrame(lift);
  };
  if (fine) {
    addEventListener('pointermove', onMove, { passive: true });
    doc.documentElement.addEventListener('pointerleave', onLeave);
  }

  // Mono labels decode each time they scroll into view.
  const rand = Math.random;
  const running = new WeakSet<HTMLElement>();
  const decode = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const el = entry.target as HTMLElement;
        if (!entry.isIntersecting || running.has(el)) continue;
        running.add(el);
        const text = originals.get(el) ?? '';
        // Assistive tech keeps the real words; only the visible copy is noise while it resolves.
        const real = doc.createElement('span');
        real.className = 'visually-hidden';
        real.textContent = text;
        const shown = doc.createElement('span');
        shown.setAttribute('aria-hidden', 'true');
        el.replaceChildren(real, shown);
        const start = performance.now();
        const step = (now: number): void => {
          const t = Math.min(1, (now - start) / 650);
          shown.textContent = scrambleFrame(text, 1 - (1 - t) ** 2, rand);
          if (t < 1) requestAnimationFrame(step);
          else {
            el.textContent = text;
            running.delete(el);
          }
        };
        requestAnimationFrame(step);
      }
    },
    { threshold: 1 },
  );
  for (const el of labels) if (el.getBoundingClientRect().top > vh) decode.observe(el);

  requestAnimationFrame(() =>
    requestAnimationFrame(() =>
      [...titles, ...reading].forEach((el) => el.classList.remove('tx-init')),
    ),
  );

  return {
    stop(): void {
      io.disconnect();
      decode.disconnect();
      removeEventListener('scroll', schedule);
      removeEventListener('resize', schedule);
      removeEventListener('pointermove', onMove);
      doc.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(hoverFrame);
      for (const [el, text] of originals) {
        el.classList.remove('tx', 'tx-in', 'tx-init');
        el.style.removeProperty('--n');
        el.textContent = text;
      }
      style.remove();
    },
  };
}
