// Hero behaviour (SPEC row 2): builds the dot-matrix portrait, plays its assembly when the boot hands off (or
// at once without a boot), reacts to a fine pointer, and recolours on a theme change. Reduced motion: static.
import { createDotMatrix } from './dotmatrix';
import { provideHeroDots } from './hero-dots';

export function initHero(doc: Document = document): void {
  const hero = doc.querySelector<HTMLElement>('[data-hero]');
  const canvas = hero?.querySelector<HTMLCanvasElement>('.hero__dots');
  const img = hero?.querySelector<HTMLImageElement>('img[data-portrait]');
  if (!hero || !canvas || !img) return;
  const root = doc.documentElement;
  const animate = root.dataset['motion'] !== 'reduced';

  void createDotMatrix(canvas, img, { animate }).then((dots) => {
    provideHeroDots(dots);
    if (!dots) return;
    hero.dataset['dots'] = 'ready';

    // Dim the dots behind the name and role line (text over the dark shirt must stay readable).
    const text = [...hero.querySelectorAll<HTMLElement>('.hero__name, .hero__role')];
    const clear = (): void => {
      const c = canvas.getBoundingClientRect();
      dots.clear(
        text.map((el) => {
          const r = el.getBoundingClientRect();
          const pad = 6;
          return {
            x: r.left - c.left - pad,
            y: r.top - c.top - pad,
            w: r.width + pad * 2,
            h: r.height + pad * 2,
          };
        }),
      );
    };
    clear();
    void doc.fonts.ready.then(clear);
    new ResizeObserver(clear).observe(hero);

    // Assemble as the boot hands the decoded name over, or immediately when there is no boot.
    if (root.dataset['boot'] === 'on') {
      const watch = new MutationObserver(() => {
        if (root.dataset['boot'] === 'on') return;
        watch.disconnect();
        // After the boot's burst the particles have already formed the portrait: show it as it is, don't scatter it again.
        dots.assemble(root.dataset['boot'] === 'out');
      });
      watch.observe(root, { attributes: true, attributeFilter: ['data-boot'] });
    } else dots.assemble();

    new MutationObserver(() => dots.recolour()).observe(root, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    // Hover (fine pointers): dots are pushed aside and a fading trail reveals the original photo.
    const fine = matchMedia('(hover: hover) and (pointer: fine)');
    canvas.addEventListener('pointermove', (e) => {
      if (!fine.matches) return;
      const r = canvas.getBoundingClientRect();
      dots.pointer(e.clientX - r.left, e.clientY - r.top);
    });
    canvas.addEventListener('pointerleave', () => dots.pointer(null, null));
  });
}
