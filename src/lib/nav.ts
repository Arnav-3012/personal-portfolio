// Sticky nav behaviour (SPEC row 1): hides on scroll down, returns on scroll up; the mobile menu sheet.
// Focus inside the bar always shows it (CSS :focus-within), so keyboard users never lose it.

/** Small moves are ignored so trackpad jitter doesn't flicker the bar; near the top it always shows. */
export function navVisibility(
  prevY: number,
  y: number,
  threshold = 8,
  topZone = 80,
): 'hide' | 'show' | null {
  if (y <= topZone) return 'show';
  if (y - prevY > threshold) return 'hide';
  if (prevY - y > threshold) return 'show';
  return null;
}

/** "Sun 18 · 19:42 IST": the nav's live clock in Arnav's timezone. */
export function zoneClock(date: Date, timeZone: string): string {
  const part = (opts: Intl.DateTimeFormatOptions): string =>
    new Intl.DateTimeFormat('en-GB', { timeZone, ...opts }).format(date);
  const zone =
    new Intl.DateTimeFormat('en-GB', { timeZone, timeZoneName: 'short' })
      .formatToParts(date)
      .find((p) => p.type === 'timeZoneName')?.value ?? '';
  // en-GB names India's zone "GMT+5:30"; show the familiar abbreviation.
  const label = timeZone === 'Asia/Kolkata' ? 'IST' : zone;
  return `${part({ weekday: 'short' })} ${part({ day: 'numeric' })} · ${part({ hour: '2-digit', minute: '2-digit', hour12: false })} ${label}`;
}

export function initNav(doc: Document = document): void {
  const bar = doc.querySelector<HTMLElement>('[data-nav-bar]');
  const menu = doc.querySelector<HTMLDialogElement>('[data-menu]');
  if (!bar) return;

  let lastY = scrollY;
  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const next = navVisibility(lastY, scrollY);
        if (next) {
          bar.toggleAttribute('data-hidden', next === 'hide');
          lastY = scrollY;
        }
        ticking = false;
      });
    },
    { passive: true },
  );

  // Live clock in Arnav's timezone, refreshed on the minute.
  const clock = doc.querySelector<HTMLTimeElement>('[data-clock]');
  if (clock?.dataset['tz']) {
    const tz = clock.dataset['tz'];
    const tick = (): void => {
      const now = new Date();
      clock.textContent = zoneClock(now, tz);
      clock.dateTime = now.toISOString();
      setTimeout(tick, 60_000 - (now.getTime() % 60_000));
    };
    tick();
  }

  // Marks the section in view (amber marker) with aria-current="location".
  const links = [...doc.querySelectorAll<HTMLAnchorElement>('[data-nav-link]')];
  const sections = links
    .map((a) => doc.getElementById(a.hash.slice(1)))
    .concat(doc.querySelector<HTMLElement>('[data-hero]'))
    // The hero matches no link, so scrolling back up clears the marker.
    .filter((el): el is HTMLElement => el !== null);
  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        for (const a of links) {
          if (a.hash === `#${entry.target.id}`) a.setAttribute('aria-current', 'location');
          else a.removeAttribute('aria-current');
        }
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  for (const s of sections) spy.observe(s);

  if (!menu) return;
  doc.querySelector('[data-menu-open]')?.addEventListener('click', () => menu.showModal());
  doc.querySelector('[data-menu-close]')?.addEventListener('click', () => menu.close());
  // A link jumps to its section; closing first lets the browser scroll the page, not the dialog.
  menu.addEventListener('click', (e) => {
    if (e.target instanceof Element && e.target.closest('a')) menu.close();
  });
}
