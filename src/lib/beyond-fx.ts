import { startCarousel } from './story-swipe';

// Beyond code decoration (SPEC row 10), built only when a visitor nears the section: Instagram-style stickers and a pinned
// photo over the cricket story frame, and a fanned deck of the 75 Hard day cards. None of it is in the landing HTML or its
// CSS (decoration, aria-hidden), and its styles are injected here, so it never delays the first paint.

export type StickerKind =
  'date' | 'ask' | 'pin' | 'tag' | 'live' | 'bat' | 'ball' | 'cup' | 'jersey';
export interface StickerSpec {
  kind: StickerKind;
  a: string;
  b?: string | undefined;
  c?: string | undefined;
}
export interface BeyondData {
  cricket: {
    stickers: readonly StickerSpec[];
    firstCaption: string;
    slides: readonly { src: string; alt: string; caption: string }[];
  };
  hard: { reels: readonly { poster: string; day: number; caption: string }[] };
}

/** Where each sticker sits on the stage (percent of its width and height), its tilt in degrees and its height above the frame. */
export const PLACE: Record<StickerKind, { x: number; y: number; r: number; z: number }> = {
  ask: { x: 26, y: 15, r: -4, z: 70 },
  date: { x: 1, y: 42, r: -7, z: 90 },
  pin: { x: 48, y: 34, r: 5, z: 60 },
  live: { x: 4, y: 90, r: -3, z: 55 },
  tag: { x: 40, y: 78, r: 4, z: 65 },
  bat: { x: 64, y: 3, r: 18, z: 95 },
  ball: { x: 56, y: 64, r: -10, z: 85 },
  cup: { x: 73, y: 60, r: 7, z: 100 },
  jersey: { x: 77, y: 80, r: -6, z: 80 },
};

const SVG = 'http://www.w3.org/2000/svg';

type IconKind = 'bat' | 'ball' | 'cup' | 'jersey';
/** The four icon stickers: original line and fill drawings on a 24 × 24 grid (a bat, a ball with its seam, a trophy, a shirt). */
const ICONS: Record<IconKind, readonly { tag: 'path' | 'rect'; attrs: Record<string, string> }[]> =
  {
    bat: [
      { tag: 'rect', attrs: { x: '10.6', y: '1.5', width: '2.8', height: '7.5', rx: '1.2' } },
      { tag: 'rect', attrs: { x: '8.2', y: '8.5', width: '7.6', height: '14', rx: '2.4' } },
      { tag: 'path', attrs: { d: 'M12 11v9', class: 'cut' } },
    ],
    ball: [
      { tag: 'path', attrs: { d: 'M4.2 6.2c3.4 2.8 3.4 8.8 0 11.6', class: 'seam' } },
      { tag: 'path', attrs: { d: 'M19.8 6.2c-3.4 2.8-3.4 8.8 0 11.6', class: 'seam' } },
    ],
    cup: [
      { tag: 'path', attrs: { d: 'M7 3h10v4.5a5 5 0 0 1-10 0z', class: 'line' } },
      {
        tag: 'path',
        attrs: {
          d: 'M7 5H4.6a1 1 0 0 0-1 1c0 2.3 1.8 3.9 4 4.2M17 5h2.4a1 1 0 0 1 1 1c0 2.3-1.8 3.9-4 4.2',
          class: 'line',
        },
      },
      { tag: 'path', attrs: { d: 'M12 12.5V17M8.6 21h6.8M9.6 17.5h4.8', class: 'line' } },
    ],
    jersey: [
      {
        tag: 'path',
        attrs: {
          d: 'M8.6 3 3 5.6l1.9 4 2.1-.9V21h10V8.7l2.1.9 1.9-4L15.4 3c-.5 1.3-1.7 2.1-3.4 2.1S9.1 4.3 8.6 3z',
        },
      },
      { tag: 'path', attrs: { d: 'M7 14h10', class: 'cut' } },
    ],
  };
const drawIcon = (kind: IconKind): SVGElement => {
  const svg = document.createElementNS(SVG, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', 'stk__glyph');
  for (const part of ICONS[kind]) {
    const node = document.createElementNS(SVG, part.tag);
    for (const [k, v] of Object.entries(part.attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
};

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  cls: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  node.className = cls;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** One sticker: a die-cut card in the page's own materials, placed by `PLACE` and popping in with `delay` ms. */
export function buildSticker(spec: StickerSpec, index: number): HTMLElement {
  const place = PLACE[spec.kind];
  const node = el('div', `stk stk--${spec.kind}`);
  node.style.setProperty('--x', `${place.x}%`);
  node.style.setProperty('--y', `${place.y}%`);
  node.style.setProperty('--r', `${place.r}deg`);
  node.style.setProperty('--z', `${place.z}px`);
  node.style.setProperty('--d', `${index * 110}ms`);
  if (spec.kind === 'date') {
    node.append(el('span', 'stk__top', spec.b ?? ''), el('b', 'stk__big', spec.a));
    if (spec.c) node.append(el('span', 'stk__sub', spec.c));
  } else if (spec.kind === 'ask') {
    node.append(el('span', 'stk__head', spec.a), el('span', 'stk__reply', spec.b ?? ''));
  } else if (spec.kind === 'pin') {
    const pin = document.createElementNS(SVG, 'svg');
    pin.setAttribute('viewBox', '0 0 24 24');
    pin.setAttribute('class', 'stk__icon');
    const path = document.createElementNS(SVG, 'path');
    path.setAttribute(
      'd',
      'M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Zm0-9.2a2.8 2.8 0 1 1 0-5.6 2.8 2.8 0 0 1 0 5.6Z',
    );
    pin.append(path);
    node.append(pin, el('span', 'stk__text', spec.a));
  } else if (spec.kind === 'live') {
    node.append(el('i', 'stk__dot'), el('span', 'stk__text', spec.a));
  } else if (spec.kind in ICONS) {
    node.classList.add('stk--icon');
    node.dataset['name'] = spec.a;
    node.append(drawIcon(spec.kind as IconKind));
  } else {
    node.append(el('span', 'stk__text', spec.a));
  }
  return node;
}

/** The next photo, taped beside the frame; it turns over to the following one as the story moves on. */
export function buildPolaroid(): { node: HTMLElement; show(src: string, caption: string): void } {
  const fig = el('figure', 'stk-polaroid');
  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';
  const cap = el('figcaption', 'stk-polaroid__cap');
  fig.append(img, cap, el('i', 'stk-polaroid__tape'));
  return {
    node: fig,
    show(src, caption) {
      img.src = src;
      cap.textContent = caption;
      fig.classList.remove('is-turn');
      void fig.offsetWidth;
      fig.classList.add('is-turn');
    },
  };
}

/** The story chrome over the photos: segmented progress, and where the viewer is. */
export function buildStory(count: number): {
  node: HTMLElement;
  bars: HTMLElement[];
  set(label: string, caption: string): void;
} {
  const story = el('div', 'story');
  const bars = el('div', 'story__bars');
  const list: HTMLElement[] = [];
  for (let i = 0; i < count; i++) {
    const bar = el('i', 'story__bar');
    list.push(bar);
    bars.append(bar);
  }
  const label = el('span', 'story__label');
  const cap = el('span', 'story__cap');
  story.append(bars, label, cap);
  return {
    node: story,
    bars: list,
    set(l, c) {
      label.textContent = l;
      cap.textContent = c;
    },
  };
}

/** The deck of reel posters, fanned from the middle, each stamped with its day. */
export function buildFan(reels: BeyondData['hard']['reels']): HTMLElement {
  const fan = el('div', 'fan');
  const mid = (reels.length - 1) / 2;
  reels.forEach((reel, i) => {
    const card = el('div', 'fan__card');
    card.style.setProperty('--k', String(i - mid));
    card.style.setProperty('--a', String(Math.abs(i - mid)));
    const img = document.createElement('img');
    img.src = reel.poster;
    img.alt = '';
    img.loading = 'lazy';
    img.decoding = 'async';
    card.append(img, el('span', 'fan__day', `DAY ${String(reel.day).padStart(2, '0')}`));
    fan.append(card);
  });
  return fan;
}

export const BEYOND_CSS = `
.tile__stage{transform-style:preserve-3d}
.stk-layer,.fan{position:absolute;inset:0;pointer-events:none;transform-style:preserve-3d}
.stk{--edge:color-mix(in srgb,var(--text) 80%,transparent);position:absolute;left:var(--x);top:var(--y);rotate:var(--r);transform:translateZ(var(--z));scale:0;display:flex;align-items:center;gap:8px;color:var(--text);background:var(--surface);border:2px solid var(--edge);border-radius:var(--radius-pill);box-shadow:0 12px 24px -8px var(--bead-cast),0 2px 4px var(--bead-cast),inset 0 1px 0 color-mix(in srgb,var(--text) 14%,transparent);white-space:nowrap}
.tile.is-in .stk{scale:1;animation:stk-pop 700ms cubic-bezier(.34,1.56,.5,1) var(--d) backwards,stk-float 6s ease-in-out calc(var(--d) + 700ms) infinite alternate}
.stk__text{font:600 14px/1 var(--font-display);letter-spacing:-.01em}
.stk--pin,.stk--tag,.stk--live{padding:9px 14px 9px 11px}
.stk--tag{padding:9px 14px;color:var(--holo)}
.stk--tag .stk__text{font-weight:700}
.stk__icon{width:18px;height:18px;fill:var(--time)}
.stk__dot{width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 0 color-mix(in srgb,var(--ok) 60%,transparent);animation:stk-live 1.8s ease-out infinite}
.stk--live .stk__text{font:500 11px/1 var(--font-mono);letter-spacing:var(--track-hud);text-transform:uppercase}
.stk--date{flex-direction:column;gap:0;width:104px;overflow:hidden;border-radius:14px;text-align:center;white-space:normal}
.stk__top{align-self:stretch;padding:5px 0;background:var(--time);color:var(--on-action);font:600 11px/1 var(--font-mono);letter-spacing:.22em}
.stk__big{padding:6px 0 0;font:800 46px/1 var(--font-display);letter-spacing:-.03em}
.stk__sub{padding:4px 8px 9px;color:var(--text-2);font:500 9.5px/1.35 var(--font-mono);letter-spacing:.06em;text-transform:uppercase}
.stk--ask{flex-direction:column;align-items:stretch;gap:0;width:178px;overflow:hidden;border-radius:16px;white-space:normal}
.stk__head{padding:10px 14px;background:linear-gradient(120deg,var(--time),var(--action));color:var(--on-action);font:700 15px/1.2 var(--font-display);text-align:center}
.stk__reply{padding:12px 14px;font:500 12px/1.4 var(--font-mono);color:var(--text-2)}
.stk__reply::after{content:'';display:inline-block;width:1px;height:1em;margin-left:3px;vertical-align:-2px;background:var(--time);animation:stk-caret 1s steps(1) infinite}
.stk--icon{width:84px;height:84px;justify-content:center;border-radius:50%}
.stk__glyph{width:52px;height:52px;fill:currentColor;stroke:none}
.stk__glyph .cut,.stk__glyph .seam,.stk__glyph .line{fill:none;stroke-linecap:round;stroke-linejoin:round}
.stk__glyph .cut{stroke:var(--bgi);stroke-width:1.4}
.stk--bat{--bgi:var(--time);background:var(--time);color:var(--on-action)}
.stk--ball{background:radial-gradient(circle at 32% 28%,color-mix(in srgb,var(--action) 55%,var(--text)),var(--action) 45%,color-mix(in srgb,var(--action) 55%,var(--bg)));color:var(--text)}
.stk--ball .stk__glyph{width:76px;height:76px}
.stk--bat .stk__glyph{width:58px;height:58px;rotate:40deg}
.stk--ball .seam{stroke:var(--text);stroke-width:1.5;stroke-dasharray:2.2 1.8}
.stk--cup{color:var(--time)}
.stk--cup .line{stroke:var(--time);stroke-width:1.8}
.stk--jersey{--bgi:var(--holo);background:var(--holo);color:var(--on-action)}
.stk-polaroid{position:absolute;right:-2%;top:9%;width:42%;margin:0;padding:8px 8px 34px;background:var(--surface);border:1px solid var(--line);border-radius:4px;rotate:7deg;transform:translateZ(-30px);transform-origin:50% 0;box-shadow:0 22px 38px -14px var(--bead-cast),0 3px 6px var(--bead-cast)}
.stk-polaroid img{display:block;width:100%;aspect-ratio:3/4;object-fit:cover;border-radius:2px}
.stk-polaroid__cap{position:absolute;left:10px;right:10px;bottom:9px;color:var(--text-2);font:500 10px/1.2 var(--font-mono);letter-spacing:.08em;text-transform:uppercase}
.stk-polaroid__tape{position:absolute;left:50%;top:-12px;width:64px;height:22px;margin-left:-32px;rotate:-5deg;background:color-mix(in srgb,var(--time) 55%,transparent);box-shadow:0 1px 2px var(--bead-cast)}
.story{position:absolute;inset:0;padding:14px 14px 0;pointer-events:none;background:linear-gradient(to bottom,color-mix(in srgb,var(--bg) 62%,transparent),transparent 26%)}
.story__bars{display:flex;gap:4px}
.story__bar{position:relative;flex:1;height:3px;overflow:hidden;border-radius:2px;background:color-mix(in srgb,var(--text) 30%,transparent)}
.story__bar::after{content:'';position:absolute;inset:0;background:var(--text);transform:scaleX(0);transform-origin:left}
.story__bar.is-done::after{transform:scaleX(1)}
.story__bar.is-on::after{animation:stk-story 5.2s linear forwards}
.is-paused .story__bar.is-on::after{animation-play-state:paused}
.story__label{display:block;margin-top:10px;color:var(--text);font:500 11px/1 var(--font-mono);letter-spacing:var(--track-hud);text-transform:uppercase}
.story__cap{display:block;margin-top:5px;color:var(--text-2);font:500 10px/1.3 var(--font-mono);letter-spacing:.08em;text-transform:uppercase}
.tile[data-tile=cricket] .tile__stage{z-index:2;pointer-events:none}
.tile[data-tile=cricket] .tile__image{pointer-events:auto;touch-action:pan-y;cursor:grab;user-select:none;-webkit-user-select:none;outline-offset:3px}
.tile[data-tile=cricket] .tile__image.is-drag{cursor:grabbing}
.story__track{position:absolute;inset:0;overflow:hidden}
.story__slide{position:absolute;inset:0;translate:calc(var(--p,0) * 100%) 0;scale:calc(1 - var(--ap,0) * .06);transition:translate 640ms cubic-bezier(.22,1.15,.36,1),scale 640ms var(--ease-out)}
.story__slide img{width:100%;height:100%;object-fit:cover;pointer-events:none;-webkit-user-drag:none;translate:calc(var(--p,0) * -16%) 0;transition:translate 640ms cubic-bezier(.22,1.15,.36,1)}
.is-drag .story__slide,.is-drag .story__slide img,.story__slide.is-leap,.story__slide.is-leap img{transition:none}
.tile:hover .tile__image .story__slide img{transform:none}
.stk-polaroid.is-turn{animation:stk-turn 700ms cubic-bezier(.34,1.3,.5,1)}
.fan__card{position:absolute;left:50%;top:6%;width:33%;aspect-ratio:9/16;margin-left:-16.5%;overflow:hidden;border:2px solid var(--edge,color-mix(in srgb,var(--text) 70%,transparent));border-radius:16px;background:var(--surface);transform-origin:50% 120%;rotate:calc(var(--k) * 8deg);translate:calc(var(--k) * 38%) calc(var(--a) * 12px);z-index:calc(10 - var(--a) * 2);transform:translateZ(calc(40px - var(--a) * 14px));box-shadow:0 22px 40px -14px var(--bead-cast),0 3px 6px var(--bead-cast);transition:rotate 700ms var(--ease-out),translate 700ms var(--ease-out)}
.fan__card img{display:block;width:100%;height:100%;object-fit:cover}
.fan__day{position:absolute;left:8px;bottom:8px;padding:5px 8px;border-radius:var(--radius-pill);background:var(--surface);color:var(--text);font:600 10px/1 var(--font-mono);letter-spacing:.14em}
.tile:hover .fan__card,.tile:focus-within .fan__card{rotate:calc(var(--k) * 10deg);translate:calc(var(--k) * 43%) calc(var(--a) * 16px)}
.tile.is-in .fan__card{animation:fan-in 800ms var(--ease-out) backwards}
.tile__stage.is-fanned .tile__image{display:none}
@keyframes stk-pop{from{scale:0;translate:0 24px}}
@keyframes stk-float{to{translate:0 -8px}}
@keyframes stk-live{70%,100%{box-shadow:0 0 0 8px transparent}}
@keyframes stk-caret{50%{opacity:0}}
@keyframes stk-story{to{transform:scaleX(1)}}
@keyframes stk-turn{from{rotate:-4deg;translate:0 -14px}}
@keyframes fan-in{from{rotate:0deg;translate:0 40px}}
:root[data-motion='reduced'] .stk{scale:1;animation:none}
:root[data-motion='reduced'] :is(.stk__dot,.fan__card,.stk-polaroid){animation:none}
:root[data-motion='reduced'] :is(.story__slide,.story__slide img){transition:none}
:root[data-motion='reduced'] .stk__reply::after{animation:none}
:root[data-motion='reduced'] .fan__card{transition:none}
`;

let injected = false;
const inject = (): void => {
  if (injected) return;
  injected = true;
  const style = document.createElement('style');
  style.textContent = BEYOND_CSS;
  document.head.append(style);
};

export function decorate(doc: Document, data: BeyondData): void {
  inject();
  const cricket = doc.querySelector<HTMLElement>('.tile[data-tile="cricket"] .tile__stage');
  if (cricket && !cricket.querySelector('.stk-layer')) {
    const layer = el('div', 'stk-layer');
    layer.setAttribute('aria-hidden', 'true');
    const pinned = buildPolaroid();
    layer.append(pinned.node, ...data.cricket.stickers.map((s, i) => buildSticker(s, i)));
    cricket.append(layer);
    const frame = cricket.querySelector<HTMLElement>('.tile__image');
    const first = frame?.querySelector('img');
    const title = cricket.closest('.tile')?.querySelector('.tile__title')?.textContent ?? '';
    if (frame && first) {
      // The tile's own photo becomes the first slide; the rest come from the data.
      const photos = [
        { src: first.currentSrc || first.src, alt: first.alt, caption: data.cricket.firstCaption },
        ...data.cricket.slides,
      ];
      const track = el('div', 'story__track');
      const slides = photos.map((p, i) => {
        const slide = el('div', 'story__slide');
        slide.setAttribute('role', 'group');
        slide.setAttribute('aria-roledescription', 'slide');
        slide.setAttribute('aria-label', `${i + 1} of ${photos.length}`);
        if (i === 0) slide.append(first);
        else {
          const img = document.createElement('img');
          img.src = p.src;
          img.alt = p.alt;
          img.loading = 'lazy';
          img.decoding = 'async';
          img.draggable = false;
          slide.append(img);
        }
        track.append(slide);
        return slide;
      });
      first.draggable = false;
      const story = buildStory(photos.length);
      frame.append(track, story.node);
      frame.dataset['swipe'] = '';
      frame.tabIndex = 0;
      frame.setAttribute('role', 'group');
      frame.setAttribute('aria-roledescription', 'carousel');
      frame.setAttribute(
        'aria-label',
        `${title} photos. Swipe, or use the left and right arrow keys.`,
      );
      const reduced = doc.documentElement.dataset['motion'] === 'reduced';
      startCarousel(frame, {
        slides,
        bars: story.bars,
        auto: !reduced,
        onChange(i) {
          const photo = photos[i];
          const next = photos[(i + 1) % photos.length];
          story.set(`${title} · ${i + 1}/${photos.length}`, photo?.caption ?? '');
          if (next) pinned.show(next.src, next.caption);
        },
      });
    }
  }
  const hard = doc.querySelector<HTMLElement>('.tile[data-tile="75-hard"] .tile__stage');
  if (hard && !hard.querySelector('.fan') && data.hard.reels.length > 0) {
    const fan = buildFan(data.hard.reels);
    fan.setAttribute('aria-hidden', 'true');
    hard.append(fan);
    hard.classList.add('is-fanned');
  }
}

/** Starts it all: decoration when the section is near, and a pop-in on each tile when it comes into view. */
export function startBeyond(doc: Document = document): void {
  const section = doc.querySelector('#beyond');
  if (!section || typeof IntersectionObserver === 'undefined') return;
  const near = new IntersectionObserver(
    (entries, observer) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      void fetch('/beyond.json')
        .then((r) => (r.ok ? (r.json() as Promise<BeyondData>) : null))
        .then((data) => {
          if (data) decorate(doc, data);
        })
        .catch(() => undefined);
    },
    { rootMargin: '900px 0px' },
  );
  near.observe(section);
  const seen = new IntersectionObserver(
    (entries) => {
      for (const e of entries)
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          seen.unobserve(e.target);
        }
    },
    { threshold: 0.25 },
  );
  for (const tile of doc.querySelectorAll('#beyond .tile')) seen.observe(tile);
}
