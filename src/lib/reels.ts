// 75 Hard reels (SPEC "75 Hard", 2D section): floating cards, a full-screen player and a proximity audio bed.
// The maths is pure and unit-tested; initReels wires the DOM that Hard75.astro renders and builds the player dialog (playerMarkup).
import { iconSvg } from './icons';
import { audio } from './audio';
import type { Discipline } from './content';
import { settings } from './settings';
import { toast } from './toast';

export type Reel = Discipline['reels'][number];

export const TOTAL_DAYS = 75;
/** Ambient bed never gets louder than this, so a reel never startles. */
export const AMBIENT_MAX = 0.35;
/** A horizontal drag shorter than this is a tap, not a swipe. */
export const SWIPE_PX = 50;

/** "Day 4 · Said no to the fries" (SPEC: caption on each card in mono). */
export const reelCaption = (r: Pick<Reel, 'day' | 'caption'>): string =>
  `Day ${r.day} · ${r.caption}`;

/** Next or previous reel, wrapping at both ends. */
export const stepIndex = (i: number, dir: 1 | -1, n: number): number => (i + dir + n) % n;

/** A mostly-horizontal drag past the threshold changes reel; dragging left means "next". */
export function swipeDirection(dx: number, dy: number, threshold = SWIPE_PX): 1 | -1 | null {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy) * 1.2) return null;
  return dx < 0 ? 1 : -1;
}

export interface CardLayout {
  /** Resting position of the card's left and top edge, as a percentage of the pinned stage. */
  left: number;
  top: number;
  /** Resting tilt in degrees. */
  rx: number;
  ry: number;
  rz: number;
}

// Five resting spots around the centred headline, each tilted differently. The cards start in a ring around
// the headline and spread out to these spots as the visitor scrolls (orbitPose).
const FIRST_LAYOUT: CardLayout = { left: 5, top: 12, rx: 6, ry: 16, rz: -5 };
export const CARD_LAYOUTS: readonly CardLayout[] = [
  FIRST_LAYOUT,
  { left: 77, top: 8, rx: -4, ry: -18, rz: 6 },
  { left: 15, top: 60, rx: -6, ry: 14, rz: 4 },
  { left: 69, top: 58, rx: 5, ry: -14, rz: -4 },
  { left: 42, top: 64, rx: 8, ry: 6, rz: 2 },
];

/** Layout for the nth card; wraps if a later edit adds more reels than presets. */
export const cardLayout = (i: number): CardLayout =>
  CARD_LAYOUTS[i % CARD_LAYOUTS.length] ?? FIRST_LAYOUT;

/** Scroll progress through a section whose stage is pinned for (height − vh) px, 0 to 1. */
export function pinProgress(top: number, height: number, vh: number): number {
  const run = height - vh;
  if (run <= 0) return 0;
  return Math.min(1, Math.max(0, -top / run));
}

const smoothstep = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Radians per second the ring revolves while the cards are still gathered. */
export const ORBIT_SPEED = 0.5;
/** How quickly the drawn separation follows the scroll (per second) and how quickly a hovered card straightens. */
export const SEPARATION_RATE = 9;
export const HOVER_RATE = 16;
/** How far the ring has opened (0 = gathered round the headline, 1 = at the resting spots) at scroll progress p. */
export const SEPARATION_START = 0.06;
export const SEPARATION_SPAN = 0.5;
export const separation = (p: number): number =>
  smoothstep((p - SEPARATION_START) / SEPARATION_SPAN);

/**
 * Eases `current` towards `target` by an amount that depends on elapsed time, not on the frame rate: after `1/rate`
 * seconds it has covered about 63% of the way. A notched mouse wheel moves the scroll position in steps; running the
 * cards through this turns the steps into one continuous glide. With no time elapsed (the first render) it snaps.
 */
export const damp = (current: number, target: number, dt: number, rate: number): number =>
  dt <= 0 ? target : current + (target - current) * (1 - Math.exp(-rate * dt));

export interface Stage {
  /** Size of the pinned stage and of one card, in px. */
  w: number;
  h: number;
  cardW: number;
}

export interface Pose {
  /** Offset from the card's resting spot, in px. */
  x: number;
  y: number;
  scale: number;
  rx: number;
  ry: number;
  rz: number;
  opacity: number;
  /** Stacking: 0 behind the headline, 2 in front of it, 3 while hovered. */
  layer: 0 | 2 | 3;
}

// Exact at both ends, so a fully open card sits on its resting spot to the pixel.
const lerp = (a: number, b: number, t: number): number => (t >= 1 ? b : a + (b - a) * t);
const CARD_RATIO = 16 / 9;

/** Half-width and half-height of the ring. Tall enough that the front arc passes below the sub-line. */
export const ringRadii = (stage: Pick<Stage, 'w' | 'h'>): { x: number; y: number } => ({
  x: Math.min(stage.w * 0.34, 520),
  y: Math.min(stage.h * 0.31, 280),
});

/**
 * Where one card is, as an offset from its resting spot. `angle` is the ring's revolution in radians; `sep` is
 * separation(p). In the ring the cards sit on a tilted ellipse round the stage centre: the ones at the front
 * are lower, larger and fully opaque, the ones at the back higher, smaller, dimmer and behind the headline.
 * As `sep` rises each card blends to its resting spot, tilt and size. `hover` (0 to 1) straightens the card,
 * scales it up 4% and brings it fully forward.
 */
export function orbitPose(
  i: number,
  n: number,
  angle: number,
  sep: number,
  home: CardLayout,
  stage: Stage,
  hover = 0,
): Pose {
  const theta = (2 * Math.PI * i) / n + angle;
  const front = (Math.cos(theta) + 1) / 2;
  const cardH = stage.cardW * CARD_RATIO;
  const { x: radiusX, y: radiusY } = ringRadii(stage);
  // Ring centre of the card, then its offset from the resting centre (home is a top-left percentage).
  const ringX = stage.w / 2 + radiusX * Math.sin(theta);
  const ringY = stage.h / 2 + radiusY * Math.cos(theta);
  const homeX = (home.left / 100) * stage.w + stage.cardW / 2;
  const homeY = (home.top / 100) * stage.h + cardH / 2;
  const open = Math.min(1, Math.max(0, sep));
  const flat = 1 - hover;
  const opacity = lerp(0.45 + 0.55 * front, 1, open);
  return {
    x: (ringX - homeX) * (1 - open),
    y: (ringY - homeY) * (1 - open),
    scale: lerp(0.6 + 0.4 * front, 1, open) * (1 + 0.04 * hover),
    rx: lerp(-8, home.rx, open) * flat,
    ry: lerp(Math.sin(theta) * 28, home.ry, open) * flat,
    rz: lerp(Math.sin(theta) * -4, home.rz, open) * flat,
    opacity: lerp(opacity, 1, hover),
    layer: hover > 0.5 ? 3 : open > 0.5 || Math.cos(theta) > 0 ? 2 : 0,
  };
}

/** The CSS transform for a pose; perspective is per card, so cards at different depths need no shared 3D context. */
export const poseTransform = (p: Pose): string =>
  `perspective(1200px) translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0) rotateX(${p.rx.toFixed(2)}deg) rotateY(${p.ry.toFixed(2)}deg) rotateZ(${p.rz.toFixed(2)}deg) scale(${p.scale.toFixed(3)})`;

/**
 * Ambient bed level from how far into view the section is. Silent while the section is more than a
 * viewport away, fades in over its first 75% of a viewport as it enters, holds while it is on screen, and
 * fades out the same way on exit.
 */
export function proximityGain(top: number, height: number, vh: number, max = AMBIENT_MAX): number {
  const distance = Math.abs(top + height / 2 - vh / 2);
  const touching = height / 2 + vh / 2;
  return max * smoothstep((touching - distance) / (vh * 0.75));
}

interface Ranges {
  readonly length: number;
  start(i: number): number;
  end(i: number): number;
}

/** Fraction of the clip buffered from the playhead onwards. */
export function bufferedRatio(ranges: Ranges, time: number, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  for (let i = 0; i < ranges.length; i++)
    if (ranges.start(i) <= time && time <= ranges.end(i))
      return Math.min(1, ranges.end(i) / duration);
  return 0;
}

/** SPEC loader: "calendar days tick from 1 to 75 with the load". */
export const loadingDay = (ratio: number): number =>
  Math.min(TOTAL_DAYS, Math.max(1, Math.ceil(ratio * TOTAL_DAYS)));

/**
 * The full-screen player: one native <dialog> (focus trap, Esc, inert page for free) and one <video> whose src
 * is set only when a reel opens. Created by initReels, not server-rendered, to keep the HTML small.
 */
export const playerMarkup =
  (): string => `<dialog class="player" aria-label="Reel player" data-player>
  <div class="player__frame" data-player-frame>
    <div class="player__stage" data-player-stage>
      <video class="player__video" data-player-video playsinline preload="auto" aria-label="Reel video"></video>
      <div class="player__load" data-player-load hidden>
        <p class="hud" data-player-load-label>loading reel · day 1 / 75</p>
        <span class="player__bar" aria-hidden="true"></span>
      </div>
    </div>
    <p class="hud player__status" data-player-status aria-live="polite"></p>
    <div class="player__controls">
      <button class="icon-button" type="button" data-player-prev aria-label="Previous reel">${iconSvg('chevron-left')}</button>
      <button class="icon-button" type="button" data-player-play aria-label="Pause" data-state="playing">
        <span class="player__ico player__ico--pause">${iconSvg('pause')}</span>
        <span class="player__ico player__ico--play">${iconSvg('play')}</span>
      </button>
      <button class="icon-button" type="button" data-player-next aria-label="Next reel">${iconSvg('chevron-right')}</button>
      <button class="icon-button" type="button" data-player-mute aria-label="Mute" aria-pressed="false" data-state="sound">
        <span class="player__ico player__ico--sound">${iconSvg('volume-2')}</span>
        <span class="player__ico player__ico--muted">${iconSvg('volume-x')}</span>
      </button>
      <button class="icon-button player__close" type="button" data-player-close aria-label="Close player">${iconSvg('x')}</button>
    </div>
  </div>
</dialog>`;

const q = <T extends Element>(root: ParentNode, selector: string): T | null =>
  root.querySelector<T>(selector);

/** Wires the 75 Hard section: parallax, cursor glow, hover play, the player, and the proximity bed. */
export function initReels(doc: Document = document): void {
  const section = q<HTMLElement>(doc, '[data-hard]');
  if (!section) return;
  if (!q(doc, '[data-player]')) doc.body.insertAdjacentHTML('beforeend', playerMarkup());
  const dialog = q<HTMLDialogElement>(doc, '[data-player]');
  if (!dialog) return;
  const cards = [...section.querySelectorAll<HTMLAnchorElement>('[data-reel-open]')];
  if (cards.length === 0) return;

  const reduced = doc.documentElement.dataset['motion'] === 'reduced';
  const wide = matchMedia('(min-width: 768px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let playerOpen = false;

  section.dataset['live'] = '';

  const ambient = wireAmbient(doc, section, cards, () => playerOpen);
  const stage = q<HTMLElement>(section, '[data-hard-stage]');
  if (!reduced && stage) wireStage(stage, fine);
  if (!reduced) wireHover(cards, () => wide.matches && fine.matches && !playerOpen);

  let progress = 0;
  if (!reduced && stage)
    wireOrbit(
      section,
      stage,
      wide,
      () => progress,
      () => playerOpen,
    );

  let ticking = false;
  const update = (): void => {
    ticking = false;
    const box = section.getBoundingClientRect();
    progress = pinProgress(box.top, box.height, innerHeight);
    ambient.update(proximityGain(box.top, box.height, innerHeight));
  };
  const schedule = (): void => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  update();
  addEventListener('scroll', schedule, { passive: true });
  addEventListener('resize', schedule);
  settings().subscribe(schedule);

  wirePlayer(dialog, cards, (open) => {
    playerOpen = open;
    schedule();
  });
}

/**
 * The cards revolve round the headline on arrival and spread to their resting spots as the visitor scrolls
 * (orbitPose). The revolve is time-based and slows to a stop as the cards open; hovering a card holds the
 * whole ring still so it can be clicked. Runs only while the section is on screen and the layout is the
 * floating one (wide screen); below 768 px the cards stay in their plain strip.
 */
function wireOrbit(
  section: HTMLElement,
  stage: HTMLElement,
  wide: MediaQueryList,
  progress: () => number,
  playerOpen: () => boolean,
): void {
  const slots = [...section.querySelectorAll<HTMLElement>('.hard__slot')];
  const n = slots.length;
  const hover = slots.map(() => 0);
  const held = slots.map(() => false);
  slots.forEach((slot, i) => {
    const set = (on: boolean) => () => void (held[i] = on);
    slot.addEventListener('pointerenter', set(true));
    slot.addEventListener('pointerleave', set(false));
    slot.addEventListener('focusin', set(true));
    slot.addEventListener('focusout', set(false));
  });

  let angle = 0;
  let last = 0;
  let frame = 0;
  let visible = false;
  /** The separation the cards are drawn at: it glides towards the one the scroll position asks for. */
  let drawnSep = separation(progress());
  const clear = (): void =>
    slots.forEach((slot) => {
      slot.style.removeProperty('transform');
      slot.style.removeProperty('opacity');
      slot.style.removeProperty('z-index');
    });

  // Measured when the stage changes size, not every frame: reading sizes in the animation loop forces layout.
  const measure = (): Stage => ({
    w: stage.clientWidth,
    h: stage.clientHeight,
    cardW: slots[0]?.offsetWidth ?? 0,
  });
  let dims = measure();
  new ResizeObserver(() => (dims = measure())).observe(stage);

  const render = (dt: number): void => {
    if (!wide.matches) return;
    drawnSep = damp(drawnSep, separation(progress()), dt, SEPARATION_RATE);
    const sep = drawnSep;
    if (!held.some(Boolean) && !playerOpen()) angle += dt * ORBIT_SPEED * (1 - sep);
    slots.forEach((slot, i) => {
      hover[i] = damp(hover[i] ?? 0, held[i] ? 1 : 0, dt, HOVER_RATE);
      // Separation also swirls the ring half a turn, so the cards leave in motion rather than sliding.
      const pose = orbitPose(i, n, angle + sep * Math.PI, sep, cardLayout(i), dims, hover[i]);
      slot.style.transform = poseTransform(pose);
      slot.style.opacity = pose.opacity.toFixed(3);
      slot.style.zIndex = String(pose.layer);
    });
  };
  const tick = (now: number): void => {
    frame = 0;
    if (visible) frame = requestAnimationFrame(tick);
    render(Math.min(0.05, (now - last) / 1000));
    last = now;
  };

  // Place the ring before the section scrolls into view, so the cards never flash at their resting spots.
  render(0);
  new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !frame) {
      last = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }).observe(section);
  wide.addEventListener('change', () => !wide.matches && clear());
}

/** Cursor heat glow behind the cards (fine pointers only). Positions are relative to the pinned stage. */
function wireStage(stage: HTMLElement, fine: MediaQueryList): void {
  if (!fine.matches) return;
  let queued = false;
  let x = 0;
  let y = 0;
  stage.addEventListener('pointermove', (e) => {
    const box = stage.getBoundingClientRect();
    x = e.clientX - box.left;
    y = e.clientY - box.top;
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      stage.style.setProperty('--mx', `${x.toFixed(0)}px`);
      stage.style.setProperty('--my', `${y.toFixed(0)}px`);
    });
  });
}

/** Hover straightens the card (CSS) and plays its muted loop; leaving pauses it. */
function wireHover(cards: HTMLAnchorElement[], allowed: () => boolean): void {
  for (const card of cards) {
    const video = q<HTMLVideoElement>(card, 'video');
    if (!video) continue;
    video.addEventListener('playing', () => (card.dataset['playing'] = ''));
    video.addEventListener('pause', () => delete card.dataset['playing']);
    card.addEventListener('pointerenter', () => {
      if (allowed()) void video.play().catch(() => undefined);
    });
    card.addEventListener('pointerleave', () => {
      video.pause();
      video.currentTime = 0;
    });
  }
}

/**
 * The proximity bed: the featured reel loops quietly as the section nears the viewport centre. Plays only
 * when Settings > Sound is on and the visitor has interacted, and it goes through AudioManager so the
 * toggle and tab-hidden suspend silence it. Default Settings keep it off, so nothing plays unasked.
 */
function wireAmbient(
  doc: Document,
  section: HTMLElement,
  cards: HTMLAnchorElement[],
  playerOpen: () => boolean,
): { update: (gain: number) => void } {
  const featured = cards.find((c) => c.hasAttribute('data-featured'));
  const mark = featured ? q<HTMLElement>(featured, '[data-live-mark]') : null;
  let bed: HTMLAudioElement | undefined;
  let level: { setLevel: (v: number) => void } | undefined;

  const stop = (): void => {
    bed?.pause();
    level?.setLevel(0);
    if (mark) mark.hidden = true;
    delete section.dataset['audible'];
  };

  return {
    update(gain) {
      const on = featured && gain > 0.01 && !audio().muted && !playerOpen() && !doc.hidden;
      if (!on) return stop();
      bed ??= Object.assign(new Audio(), { loop: true, preload: 'auto', src: featured.href });
      level ??= audio().attachElement(bed, 'music');
      // Not routed yet (no gesture): stay silent and try again on the next scroll tick.
      if (!level) return;
      level.setLevel(gain);
      if (bed.paused) void bed.play().catch(() => undefined);
      if (mark) mark.hidden = false;
      section.dataset['audible'] = '';
    },
  };
}

/** The full-screen player: one native <dialog> and one <video>, with the clip set only when opened. */
function wirePlayer(
  dialog: HTMLDialogElement,
  cards: HTMLAnchorElement[],
  onToggle: (open: boolean) => void,
): void {
  const get = <T extends HTMLElement>(name: string): T => {
    const el = q<T>(dialog, `[data-player-${name}]`);
    if (!el) throw new Error(`player is missing [data-player-${name}]`);
    return el;
  };
  const video = get<HTMLVideoElement>('video');
  const stage = get('stage');
  const loader = get('load');
  const loaderLabel = get('load-label');
  const status = get('status');
  const playBtn = get<HTMLButtonElement>('play');
  const muteBtn = get<HTMLButtonElement>('mute');

  let index = 0;
  let opener: HTMLElement | null = null;
  let muted = false;
  let loading = false;

  const setLoading = (on: boolean): void => {
    loading = on;
    loader.hidden = !on;
    if (!on) return;
    const ratio = bufferedRatio(video.buffered, video.currentTime, video.duration);
    loader.style.setProperty('--load', ratio.toFixed(3));
    loaderLabel.textContent = `loading reel · day ${loadingDay(ratio)} / ${TOTAL_DAYS}`;
  };
  const syncButtons = (): void => {
    playBtn.dataset['state'] = video.paused ? 'paused' : 'playing';
    playBtn.setAttribute('aria-label', video.paused ? 'Play' : 'Pause');
    muteBtn.dataset['state'] = video.muted ? 'muted' : 'sound';
    muteBtn.setAttribute('aria-pressed', String(video.muted));
    muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
  };
  const play = (): void => {
    video.muted = muted;
    void video.play().catch((error: unknown) => {
      // Only a refusal to autoplay with sound falls back to muted playback. Pausing or switching reel while
      // play() is still pending rejects it with AbortError, which must not restart the clip.
      if (error instanceof DOMException && error.name === 'NotAllowedError' && !video.muted) {
        muted = video.muted = true;
        void video.play().catch(() => undefined);
      }
      syncButtons();
    });
  };

  const show = (i: number): void => {
    index = i;
    const card = cards[i];
    if (!card) return;
    status.textContent = `Reel ${i + 1} of ${cards.length} · ${card.dataset['caption'] ?? ''}`;
    video.poster = card.dataset['poster'] ?? '';
    video.src = card.href;
    setLoading(true);
    play();
    syncButtons();
  };
  const step = (dir: 1 | -1): void => show(stepIndex(index, dir, cards.length));

  for (const [i, card] of cards.entries())
    card.addEventListener('click', (e) => {
      // Let modified clicks open the file; the plain click is the player. Without JS the link plays the file.
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      opener = card;
      show(i);
      dialog.showModal();
      onToggle(true);
    });

  dialog.addEventListener('close', () => {
    video.pause();
    video.removeAttribute('src');
    video.load();
    setLoading(false);
    onToggle(false);
    opener?.focus();
  });
  // A click on the empty area around the clip (the dialog or its full-size frame) closes it.
  dialog.addEventListener('click', (e) => {
    if (
      e.target === dialog ||
      (e.target instanceof Element && e.target.hasAttribute('data-player-frame'))
    )
      dialog.close();
  });
  get('close').addEventListener('click', () => dialog.close());
  get('prev').addEventListener('click', () => step(-1));
  get('next').addEventListener('click', () => step(1));
  playBtn.addEventListener('click', () => (video.paused ? play() : video.pause()));
  muteBtn.addEventListener('click', () => {
    muted = video.muted = !video.muted;
    syncButtons();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') step(1);
    else if (e.key === 'ArrowLeft') step(-1);
  });

  // Swipe to change reel; a tap toggles pause.
  let start: { x: number; y: number; id: number } | undefined;
  stage.addEventListener(
    'pointerdown',
    (e) => (start = { x: e.clientX, y: e.clientY, id: e.pointerId }),
  );
  stage.addEventListener('pointerup', (e) => {
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    start = undefined;
    const dir = swipeDirection(dx, dy);
    if (dir) step(dir);
    else if (Math.hypot(dx, dy) < 10) playBtn.click();
  });
  stage.addEventListener('pointercancel', () => (start = undefined));

  for (const event of ['loadstart', 'progress', 'loadedmetadata'] as const)
    video.addEventListener(event, () => loading && setLoading(true));
  for (const event of ['canplay', 'playing'] as const)
    video.addEventListener(event, () => setLoading(false));
  video.addEventListener('waiting', () => dialog.open && setLoading(true));
  for (const event of ['play', 'pause', 'volumechange'] as const)
    video.addEventListener(event, syncButtons);
  video.addEventListener('error', () => {
    // The src is cleared on close, which also raises an error event; only report while open.
    if (!dialog.open) return;
    setLoading(false);
    toast({
      kind: 'error',
      message: "Couldn't load this reel. Check your connection and try again.",
    });
  });
}
