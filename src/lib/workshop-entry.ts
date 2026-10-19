// The entry to the workshop (Phase 2a; task 2.3). When the pointer comes near the brain area of the dot-matrix head (or the
// brain is focused, or on touch screens always) a brain cutout pops up over the skull and a hand-drawn pencil arrow draws
// itself from beside the face to it, with a short note in a pencil handwriting font. Pressing the brain plays the entry
// sequence (enter-sequence.ts: dive into the brain, pull back to a globe, turn to Mumbai, zoom in) and arrives on
// /workshop. The brain is a real link, so a modifier-click, reduced motion and no-JS all just navigate. Made by
// JavaScript after the LCP paint so it adds nothing to the landing HTML; the nav also links to /workshop. Brain: CC0
// outline in public/media/brain.svg; note font: Reenie Beanie (OFL), fetched on the first hover. Both credited in
// content/credits.json.

/** Where the brain sits on the stage, as fractions of its width and height: over the skull. */
export const BRAIN = { x: 0.49, y: 0.3, size: 0.5 } as const;
export const BRAIN_URL = '/media/brain.svg';
/** How far past the brain's own box the pointer may be, in pixels, for it to pop up. */
export const NEAR_PX = 40;

/** Splits a short note into lines of about `max` characters at word breaks. */
export function wrapNote(text: string, max = 13): string[] {
  const lines: string[] = [];
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines[lines.length - 1];
    if (last !== undefined && last.length + 1 + word.length <= max)
      lines[lines.length - 1] = `${last} ${word}`;
    else lines.push(word);
  }
  return lines;
}

const CSS = `@font-face{font-family:'Reenie Beanie';src:url(/media/fonts/reenie-beanie-400.woff2) format('woff2');font-display:swap}
.ws-brain{position:absolute;z-index:1;left:${BRAIN.x * 100}%;top:${BRAIN.y * 100}%;width:${BRAIN.size * 100}%;aspect-ratio:1;transform:translate(-50%,-50%) scale(.6);opacity:0;pointer-events:none;border-radius:var(--radius-card);transition:opacity 520ms var(--ease-out),transform 900ms cubic-bezier(.34,1.25,.5,1);filter:drop-shadow(0 0 1.5px var(--bg)) drop-shadow(0 0 10px color-mix(in srgb,var(--time) 40%,transparent))}
.ws-brain:focus-visible{outline:var(--focus-ring);outline-offset:var(--focus-offset)}
.ws-brain__art{display:block;width:100%;height:100%;background:var(--time);-webkit-mask:url(${BRAIN_URL}) center/contain no-repeat;mask:url(${BRAIN_URL}) center/contain no-repeat;transform:scaleX(-1)}
.ws-near .ws-brain,.ws-brain:focus-visible{opacity:.95;transform:translate(-50%,-50%) scale(1);animation:ws-brain 3.2s ease-in-out infinite}
@keyframes ws-brain{50%{filter:drop-shadow(0 0 1.5px var(--bg)) drop-shadow(0 0 24px color-mix(in srgb,var(--time) 70%,transparent))}}
.ws-note{position:absolute;z-index:1;left:-36.5%;top:6%;width:62%;aspect-ratio:2/1;transform:translateY(var(--ws-dy,0px));pointer-events:none;overflow:visible;color:color-mix(in srgb,var(--text) 84%,transparent);translate:-14px 0;transition:translate 900ms var(--ease-out)}
.ws-note text{font:400 40px/1 'Reenie Beanie',cursive;fill:currentColor;clip-path:inset(0 100% 0 0);transition:clip-path 420ms var(--ease-out)}
.ws-note .ws-line{fill:none;stroke:currentColor;stroke-width:2.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;transition:stroke-dashoffset 360ms var(--ease-out)}
.ws-note .ws-line--2{stroke-width:1.4;opacity:.55}
.ws-near .ws-note.is-live{translate:0 0}
.ws-near .ws-note.is-live text{clip-path:inset(0 0 0 0);transition:clip-path 1300ms cubic-bezier(.45,0,.2,1) 160ms}
.ws-near .ws-note.is-live .ws-line{stroke-dashoffset:0;transition:stroke-dashoffset 1000ms cubic-bezier(.65,0,.35,1) 800ms}
@media (hover:none){.ws-brain{opacity:.5;transform:translate(-50%,-50%) scale(.85)}.ws-note{display:none}}
@media (max-width:640px){.ws-note{display:none}}`;

interface Content {
  city: string;
  lat: number;
  lon: number;
  locking: string;
  status: string;
  skip: string;
  handNote: string;
}
let content: Promise<Content | null> | undefined;
const loadContent = (): Promise<Content | null> =>
  (content ??= fetch('/workshop.json')
    .then((r) => (r.ok ? (r.json() as Promise<Content>) : null))
    .catch(() => null));

const SVG = 'http://www.w3.org/2000/svg';
const svgEl = <K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

/**
 * The pencil note: the words, and an arrow drawn with a wobble that curves from under them towards the brain.
 * Two slightly different strokes (one bold, one faint) give the sketched, gone-over-twice look; a turbulence filter
 * roughens the lines like pencil on paper. The viewBox is 340 × 170 and the arrow's tip lands just left of the brain.
 */
export function buildNote(text: string): SVGSVGElement {
  const svg = svgEl('svg', {
    class: 'ws-note',
    viewBox: '0 0 340 170',
    'aria-hidden': 'true',
    focusable: 'false',
  });
  const filter = svgEl('filter', {
    id: 'ws-pencil',
    x: '-5%',
    y: '-5%',
    width: '110%',
    height: '110%',
  });
  filter.append(
    svgEl('feTurbulence', {
      type: 'fractalNoise',
      baseFrequency: '0.035',
      numOctaves: '2',
      seed: '4',
      result: 'n',
    }),
    svgEl('feDisplacementMap', { in: 'SourceGraphic', in2: 'n', scale: '3.4' }),
  );
  const defs = svgEl('defs');
  defs.append(filter);
  const g = svgEl('g', { filter: 'url(#ws-pencil)' });
  const label = svgEl('text', { transform: 'rotate(-4 20 40)' });
  wrapNote(text).forEach((line, i) => {
    const t = svgEl('tspan', { x: String(14 + i * 22), y: String(42 + i * 40) });
    t.textContent = line;
    label.append(t);
  });
  const path = (d: string, cls: string): SVGPathElement =>
    svgEl('path', { d, class: cls, pathLength: '1' });
  g.append(
    label,
    path('M 214 92 C 238 118, 270 130, 318 138', 'ws-line'),
    path('M 296 124 L 318 138 L 294 147', 'ws-line'),
    path('M 216 95 C 242 116, 268 134, 316 140', 'ws-line ws-line--2'),
    path('M 298 120 L 319 139 L 296 149', 'ws-line ws-line--2'),
  );
  svg.append(defs, g);
  return svg;
}

export function startWorkshopEntry(doc: Document = document): void {
  const stage = doc.querySelector<HTMLElement>('.hero__stage');
  const navLink = doc.querySelector<HTMLAnchorElement>('a[href="/workshop"]');
  if (!stage || doc.querySelector('.ws-brain')) return;
  const style = doc.createElement('style');
  style.textContent = CSS;
  doc.head.append(style);

  const name = (navLink?.textContent?.trim() || 'Workshop').toLowerCase();
  // The brain is the door, and a real link: focusable, named, and followed by plain navigation when nothing else handles it.
  const brain = doc.createElement('a');
  brain.className = 'ws-brain';
  brain.href = '/workshop';
  brain.setAttribute('aria-label', `Enter the ${name}`);
  const art = doc.createElement('span');
  art.className = 'ws-brain__art';
  art.setAttribute('aria-hidden', 'true');
  brain.append(art);
  stage.append(brain);

  const reduced = (): boolean => doc.documentElement.dataset['motion'] === 'reduced';

  // The first time the visitor shows interest: warm the sequence, fetch the copy, and draw the pencil note.
  let warmed = false;
  const warm = (): void => {
    if (warmed) return;
    warmed = true;
    void import('./enter-sequence');
    new Image().src = BRAIN_URL;
    const hint = doc.createElement('link');
    hint.rel = 'prefetch';
    hint.href = '/workshop';
    doc.head.append(hint);
    void loadContent().then((c) => {
      if (c?.handNote) {
        const note = buildNote(c.handNote);
        stage.append(note);
        clearWork();
        // The note arrives while the pointer is already near, so it would be drawn in its finished state at once: let it settle
        // in its resting state for a frame, then let it play.
        void note.getBoundingClientRect();
        requestAnimationFrame(() => note.classList.add('is-live'));
      }
    });
  };

  /** On a short or narrow screen the stage is small and the note's words land on the "Work" corner: slide the note down until they clear it. */
  const clearWork = (): void => {
    const note = stage.querySelector<SVGSVGElement>('.ws-note');
    const words = note?.querySelector('text');
    const work = doc.querySelector('.hero a[href="#work"]');
    if (!note || !words || !work) return;
    note.style.setProperty('--ws-dy', '0px');
    const t = words.getBoundingClientRect();
    const k = work.getBoundingClientRect();
    const hit = t.left < k.right + 12 && t.right > k.left && t.bottom > k.top;
    const dy = hit
      ? Math.min(k.bottom + 10 - t.top, stage.getBoundingClientRect().height * 0.22)
      : 0;
    note.style.setProperty('--ws-dy', `${Math.max(0, Math.round(dy))}px`);
  };
  addEventListener('resize', clearWork, { passive: true });

  /** Whether a point (client coordinates) is inside the brain's box. */
  const inside = (x: number, y: number): boolean => {
    const b = stage.getBoundingClientRect();
    const half = (b.width * BRAIN.size) / 2;
    return (
      Math.abs(x - (b.left + b.width * BRAIN.x)) < half &&
      Math.abs(y - (b.top + b.height * BRAIN.y)) < half * 0.8
    );
  };

  let near = false;
  const setNear = (value: boolean): void => {
    if (value === near) return;
    near = value;
    stage.classList.toggle('ws-near', value);
    if (value) {
      warm();
      clearWork();
    }
  };
  let frame = 0;
  let lastEvent: PointerEvent | undefined;
  doc.addEventListener(
    'pointermove',
    (e) => {
      lastEvent = e;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!lastEvent) return;
        const b = stage.getBoundingClientRect();
        const half = (b.width * BRAIN.size) / 2;
        const cx = b.left + b.width * BRAIN.x;
        const cy = b.top + b.height * BRAIN.y;
        const { clientX: x, clientY: y } = lastEvent;
        // A box around the brain (a little generous), not a circle: the brain is wider than it is tall.
        setNear(Math.abs(x - cx) < half + NEAR_PX && Math.abs(y - cy) < half * 0.8 + NEAR_PX);
        // The brain itself lets the pointer through (so the dots underneath still react); the stage shows the hand.
        stage.style.cursor = near && inside(x, y) ? 'pointer' : '';
      });
    },
    { passive: true },
  );
  brain.addEventListener('focus', () => {
    stage.classList.add('ws-near');
    warm();
  });
  brain.addEventListener('blur', () => {
    if (!near) stage.classList.remove('ws-near');
  });

  const press = (e: MouseEvent, fromStage = false): void => {
    if (e.defaultPrevented || e.button !== 0) return;
    const modifier = e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    // Only a plain left click plays the sequence. Everything else is a plain link: on the link itself the browser does it;
    // on the stage (a press that landed on the dots under the brain) it is done here.
    if (modifier || reduced()) {
      if (fromStage) {
        if (modifier) window.open('/workshop', '_blank', 'noopener');
        else location.assign('/workshop');
      }
      return;
    }
    e.preventDefault();
    const b = stage.getBoundingClientRect();
    const side = b.width * BRAIN.size;
    const from = new DOMRect(
      b.left + b.width * BRAIN.x - side / 2,
      b.top + b.height * BRAIN.y - side / 2,
      side,
      side,
    );
    void Promise.all([import('./enter-sequence'), loadContent()])
      .then(([m, c]) => {
        if (!c) throw new Error('no content');
        return m.playEnter({ content: c, brainUrl: BRAIN_URL, from });
      })
      .catch(() => location.assign('/workshop'));
  };
  // Keyboard and assistive-tech activation arrive on the link itself; a mouse or finger arrives on whatever is under the
  // brain (the dots), so the stage checks whether the press landed inside the brain's box.
  brain.addEventListener('click', press);
  stage.addEventListener('click', (e) => {
    if (!inside(e.clientX, e.clientY)) return;
    if (!near && !matchMedia('(hover: none)').matches) return;
    press(e, true);
  });
}
