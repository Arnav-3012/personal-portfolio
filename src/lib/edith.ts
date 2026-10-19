// EDITH-lite launcher (SPEC "EDITH tab", Agent). The button is built in JavaScript after the first sign of a visitor, because
// the landing HTML has no byte budget left; the chat panel itself is a separate chunk, fetched on first
// hover, focus or click, so it never counts against the landing JS before interaction.
import launchCss from '../styles/edith-launch.css?inline';
import { afterFirstSign } from './idle';

// Lucide "message-circle" (ISC): kept here, not in icons.ts, so the shared icon table stays out of this tiny launcher.
const BUBBLE =
  '<svg class="icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>';

type OpenPanel = (launcher: HTMLElement) => Promise<void>;
let panel: Promise<OpenPanel> | undefined;

const loadPanel = (): Promise<OpenPanel> =>
  (panel ??= import('./edith-ui').then((m) => m.openEdith));

export function initEdith(doc: Document = document): void {
  const mount = (): void => {
    if (doc.querySelector('[data-edith-launch]')) return;
    const style = doc.createElement('style');
    style.textContent = launchCss;
    doc.head.append(style);
    const button = doc.createElement('button');
    button.type = 'button';
    button.className = 'edith-launch';
    button.dataset['edithLaunch'] = '';
    button.setAttribute('aria-haspopup', 'dialog');
    // The text label hides on phones, so the name cannot depend on it.
    button.setAttribute('aria-label', 'Ask EDITH');
    button.setAttribute('aria-expanded', 'false');
    // The plain bubble is what shows until the orb (a small separate chunk) has loaded and takes its place.
    button.innerHTML = `<span class="edith-orb">${BUBBLE}</span><span class="hud">Ask EDITH</span><span class="edith-tip" aria-hidden="true"></span>`;
    const warm = (): void => void loadPanel();
    button.addEventListener('pointerenter', warm, { once: true });
    button.addEventListener('focus', warm, { once: true });
    // The orb, ripple and nudge are a separate chunk: the launcher itself stays as small as it can be.
    void import('./edith-presence').then((m) => m.startPresence(button, doc));
    button.addEventListener('click', () => void loadPanel().then((open) => open(button)));
    // On desktop the pill would sit on the hero's "Contact" corner, so it waits until the hero is mostly scrolled past.
    const hero = doc.querySelector('[data-hero]');
    if (hero && matchMedia('(min-width: 641px)').matches)
      new IntersectionObserver(
        ([entry]) => button.classList.toggle('is-away', (entry?.intersectionRatio ?? 0) > 0.45),
        { threshold: [0, 0.45, 1] },
      ).observe(hero);
    doc.body.append(button);
  };
  afterFirstSign(mount);
}
