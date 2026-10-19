// The EDITH launcher's life (Arnav, 2026-10-19): the dot-sphere orb in place of the plain icon, a ripple every few seconds,
// and one speech-bubble nudge per session. A separate chunk from the launcher (src/lib/edith.ts) so the first script stays
// small: Lighthouse's model is sensitive to even a kilobyte of early JavaScript on this page.
import { startOrb } from './edith-orb';

const NUDGED = 'arnav:edith:nudged';
const NUDGE_AFTER_MS = 9000;

/** The living part of the launcher: the orb, a ripple now and then, and one speech-bubble nudge per session. */
export function startPresence(button: HTMLElement, doc: Document): void {
  const reduced = doc.documentElement.dataset['motion'] === 'reduced';
  const holder = button.querySelector<HTMLElement>('.edith-orb');
  const tip = button.querySelector<HTMLElement>('.edith-tip');
  let orb: { hover(on: boolean): void; ping(): void } | undefined;
  if (holder) {
    const canvas = doc.createElement('canvas');
    canvas.className = 'edith-orb__canvas';
    canvas.setAttribute('aria-hidden', 'true');
    holder.replaceChildren(canvas);
    orb = startOrb(canvas, button, reduced);
  }
  const on = (): void => orb?.hover(true);
  const off = (): void => orb?.hover(false);
  button.addEventListener('pointerenter', on);
  button.addEventListener('pointerleave', off);
  button.addEventListener('focus', on);
  button.addEventListener('blur', off);
  if (reduced) return;
  // A ripple through the orb every so often, a quiet "I'm here".
  setInterval(() => {
    if (!doc.hidden) orb?.ping();
  }, 7000);

  let seen = false;
  try {
    seen = sessionStorage.getItem(NUDGED) === '1';
  } catch {
    // Blocked storage: it nudges once per page load instead.
  }
  if (seen || !tip) return;
  let shown = false;
  const hide = (): void => {
    button.classList.remove('is-nudging');
    tip.textContent = '';
  };
  button.addEventListener('click', hide);
  button.addEventListener('pointerenter', hide);
  setTimeout(() => {
    const busy =
      button.classList.contains('is-away') || button.getAttribute('aria-expanded') === 'true';
    if (shown || busy || doc.hidden) return;
    shown = true;
    try {
      sessionStorage.setItem(NUDGED, '1');
    } catch {
      // Nothing to remember it with.
    }
    void fetch('/edith.json')
      .then((r) => (r.ok ? (r.json() as Promise<{ nudge?: string }>) : null))
      .then((c) => {
        if (!c?.nudge) return;
        // Three typing dots first, as if it were about to speak, then the line.
        button.classList.add('is-nudging', 'is-typing');
        setTimeout(() => {
          if (!button.classList.contains('is-nudging')) return;
          button.classList.remove('is-typing');
          tip.textContent = c.nudge ?? '';
          setTimeout(hide, 6000);
        }, 1100);
      })
      .catch(() => undefined);
  }, NUDGE_AFTER_MS);
}
