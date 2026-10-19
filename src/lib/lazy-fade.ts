// Smooth loading for images below the fold: a lazy image that arrives after the page has settled fades in instead of
// popping into place. Images already loaded (the hero, anything cached) are untouched. Reduced motion: nothing.

export const FADE_CSS = `@keyframes ld-in{from{opacity:0}}
.ld-in{animation:ld-in 700ms var(--ease-out) both}`;

export function startLazyFade(doc: Document = document): void {
  if (doc.documentElement.dataset['motion'] === 'reduced') return;
  const style = doc.createElement('style');
  style.textContent = FADE_CSS;
  doc.head.append(style);
  for (const img of doc.querySelectorAll<HTMLImageElement>('img[loading="lazy"]')) {
    if (img.complete) continue;
    img.addEventListener('load', () => img.classList.add('ld-in'), { once: true });
  }
}
