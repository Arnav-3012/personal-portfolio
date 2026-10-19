// The cricket tile's story frame, as a carousel (Arnav, 2026-10-19: "if I swipe with cursor or hand on the photo it switches
// to the next one"). Drag with a mouse or swipe with a finger and the photos follow the pointer, then settle on the next or
// previous one with a springy ease; a tap goes forward (the left third goes back), the arrow keys work, and it advances by
// itself every few seconds while the segmented progress bar at the top fills. It wraps round. Reduced motion: no auto-advance
// and no easing, but swiping, tapping and the keys still work.

/** Pixels of drag that count as a swipe, at most; below it the speed of the flick decides. */
export const SWIPE_PX = 90;
export const SWIPE_FRACTION = 0.18;
/** Pixels per millisecond that count as a flick. */
export const FLICK = 0.45;
/** A press that moves less than this is a tap. */
export const TAP_PX = 6;
export const AUTO_MS = 5200;

/** Where a release lands: -1 back, 0 stay, 1 forward. `dx` is the drag (negative = leftwards), `velocity` px/ms. */
export function swipeStep(dx: number, width: number, velocity: number): -1 | 0 | 1 {
  const threshold = Math.min(SWIPE_PX, Math.max(24, width * SWIPE_FRACTION));
  if (dx < -threshold || velocity < -FLICK) return 1;
  if (dx > threshold || velocity > FLICK) return -1;
  return 0;
}

/** The slide `index` moved by `step`, wrapping round. */
export const wrap = (index: number, step: number, count: number): number =>
  (((index + step) % count) + count) % count;

/** Where slide `k` sits relative to the active one, in frame widths: 0 is the active, -1 and 1 its neighbours. */
export function slidePosition(k: number, active: number, count: number): number {
  let p = (((k - active) % count) + count) % count;
  if (p > count / 2) p -= count;
  return p;
}

export interface Carousel {
  go(step: number): void;
  index(): number;
  stop(): void;
}

export interface CarouselOptions {
  slides: readonly HTMLElement[];
  bars: readonly HTMLElement[];
  /** Called whenever the active slide changes (and once at the start). */
  onChange(index: number): void;
  auto: boolean;
}

export function startCarousel(frame: HTMLElement, o: CarouselOptions): Carousel {
  const { slides, bars } = o;
  const count = slides.length;
  let index = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pointerId = -1;
  let startX = 0;
  let startY = 0;
  let dx = 0;
  let lastX = 0;
  let lastT = 0;
  let velocity = 0;
  let moved = false;
  let paused = false;

  const place = (drag = 0, jump = false): void => {
    const width = frame.clientWidth || 1;
    slides.forEach((slide, k) => {
      const p = slidePosition(k, index, count);
      // A slide that wraps from one side to the other must not glide across the frame.
      const before = Number(slide.dataset['p'] ?? p);
      const leap = Math.abs(p - before) > 1.5 || jump;
      slide.classList.toggle('is-leap', leap);
      slide.dataset['p'] = String(p);
      slide.style.setProperty('--p', String(p + drag / width));
      slide.style.setProperty('--ap', String(Math.min(1, Math.abs(p + drag / width))));
      slide.setAttribute('aria-hidden', p === 0 ? 'false' : 'true');
    });
  };
  const paint = (): void => {
    bars.forEach((bar, k) => {
      bar.classList.toggle('is-done', k < index);
      bar.classList.toggle('is-on', k === index);
    });
    o.onChange(index);
  };
  const schedule = (): void => {
    clearTimeout(timer);
    if (!o.auto || paused || count < 2) return;
    timer = setTimeout(() => go(1), AUTO_MS);
  };
  const go = (step: number): void => {
    index = wrap(index, step, count);
    place();
    // Restart the progress bar's fill for the new slide.
    const bar = bars[index];
    if (bar) {
      bar.classList.remove('is-on');
      void bar.offsetWidth;
    }
    paint();
    schedule();
  };
  const setPaused = (value: boolean): void => {
    paused = value;
    frame.classList.toggle('is-paused', value);
    if (value) clearTimeout(timer);
    else schedule();
  };

  const down = (e: PointerEvent): void => {
    if (pointerId !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
    pointerId = e.pointerId;
    startX = lastX = e.clientX;
    startY = e.clientY;
    lastT = e.timeStamp;
    dx = 0;
    velocity = 0;
    moved = false;
    frame.setPointerCapture(e.pointerId);
    setPaused(true);
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > TAP_PX && Math.abs(dx) > Math.abs(e.clientY - startY)) {
      moved = true;
      frame.classList.add('is-drag');
    }
    if (!moved) return;
    const dt = e.timeStamp - lastT;
    if (dt > 0) velocity = velocity * 0.6 + ((e.clientX - lastX) / dt) * 0.4;
    lastX = e.clientX;
    lastT = e.timeStamp;
    place(dx);
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    pointerId = -1;
    frame.classList.remove('is-drag');
    if (frame.hasPointerCapture(e.pointerId)) frame.releasePointerCapture(e.pointerId);
    const width = frame.clientWidth || 1;
    if (!moved) {
      // A tap: the left third goes back, the rest goes forward.
      const x = e.clientX - frame.getBoundingClientRect().left;
      go(x < width * 0.33 ? -1 : 1);
    } else {
      const step = swipeStep(dx, width, velocity);
      if (step === 0) {
        place();
        paint();
      } else go(step);
    }
    setPaused(false);
  };
  const cancel = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    pointerId = -1;
    frame.classList.remove('is-drag');
    place();
    setPaused(false);
  };
  const key = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
    else return;
    e.preventDefault();
  };
  const enter = (): void => setPaused(true);
  const leave = (): void => {
    if (pointerId === -1) setPaused(false);
  };
  const visibility = (): void => setPaused(document.hidden);

  place(0, true);
  paint();
  schedule();
  frame.addEventListener('pointerdown', down);
  frame.addEventListener('pointermove', move);
  frame.addEventListener('pointerup', up);
  frame.addEventListener('pointercancel', cancel);
  frame.addEventListener('keydown', key);
  frame.addEventListener('pointerenter', enter);
  frame.addEventListener('pointerleave', leave);
  frame.addEventListener('focusin', enter);
  frame.addEventListener('focusout', leave);
  document.addEventListener('visibilitychange', visibility);
  return {
    go,
    index: () => index,
    stop() {
      clearTimeout(timer);
      frame.removeEventListener('pointerdown', down);
      frame.removeEventListener('pointermove', move);
      frame.removeEventListener('pointerup', up);
      frame.removeEventListener('pointercancel', cancel);
      frame.removeEventListener('keydown', key);
      frame.removeEventListener('pointerenter', enter);
      frame.removeEventListener('pointerleave', leave);
      frame.removeEventListener('focusin', enter);
      frame.removeEventListener('focusout', leave);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
