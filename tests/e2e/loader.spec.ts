import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// While a navigation is pending, Playwright cannot query the old page (calls wait for the navigation to finish), so the
// loader is observed from inside the page: a MutationObserver reports each loader that appears or goes away over the
// console, which does not need a page context.
const watch = (page: Page) => {
  const log: { at: number; kind: string; [k: string]: unknown }[] = [];
  const t0 = Date.now();
  page.on('console', (m) => {
    const text = m.text();
    if (text.startsWith('LD '))
      log.push({
        at: Date.now() - t0,
        ...(JSON.parse(text.slice(3)) as object),
        kind: 'added',
      } as never);
    if (text === 'LD-GONE') log.push({ at: Date.now() - t0, kind: 'gone' });
  });
  page.on(
    'framenavigated',
    (f) => f === page.mainFrame() && log.push({ at: Date.now() - t0, kind: 'nav' }),
  );
  return log;
};

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
    new MutationObserver((records) => {
      for (const r of records) {
        r.addedNodes.forEach((n) => {
          const e = n as HTMLElement;
          if (!e.classList?.contains('ld')) return;
          const box = e.getBoundingClientRect();
          console.log(
            'LD ' +
              JSON.stringify({
                label: e.querySelector('.ld__label')?.textContent,
                role: e.getAttribute('role'),
                dots: e.querySelectorAll('.ld__dot').length,
                width: box.width,
                height: box.height,
                bg: getComputedStyle(e).backgroundColor,
                pageBg: getComputedStyle(document.body).backgroundColor,
                dotAnimation: getComputedStyle(e.querySelector('.ld__dot') as Element)
                  .animationName,
              }),
          );
        });
        r.removedNodes.forEach(
          (n) => (n as HTMLElement).classList?.contains('ld') && console.log('LD-GONE'),
        );
      }
    }).observe(document, { childList: true, subtree: true });
  }, theme);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
};

/** Makes the next page slow to arrive, so the wait is long enough for the loader to show. */
const slowWorkshop = (page: Page, ms: number) =>
  page.route(/\/workshop\/?$/, async (route) => {
    await new Promise((r) => setTimeout(r, ms));
    await route.continue();
  });

const navLink = (page: Page) => page.locator('.shell-bar a[href="/workshop"]');
/** Follows the nav link without hovering it first (a hover prefetches the page, which would make this wait vanish). */
const go = (page: Page) => navLink(page).evaluate((el) => (el as HTMLElement).click());
/** Switches link prefetching off for a test, so a slow page is really slow. */
const noPrefetch = (page: Page) =>
  page.addInitScript(() => {
    const create = Document.prototype.createElement;
    Document.prototype.createElement = function (
      this: Document,
      tag: string,
      options?: ElementCreationOptions,
    ) {
      const el = create.call(this, tag, options);
      if (tag.toLowerCase() === 'link')
        Object.defineProperty(el, 'rel', { get: () => '', set: () => undefined });
      return el;
    } as typeof Document.prototype.createElement;
  });
// The room's own loader ("Loading neural pathways") is a different thing from the page-transition loader these tests are about.
const added = (log: ReturnType<typeof watch>) =>
  log.filter((e) => e.kind === 'added' && !/neural/i.test(String(e.label ?? '')));

test.describe('page loads', () => {
  test('a slow page shows the minimal loader while it is on its way, and it is gone on arrival', async ({
    page,
  }) => {
    const log = watch(page);
    await open(page);
    await slowWorkshop(page, 1800);
    log.length = 0;
    await go(page);
    await page.waitForURL(/\/workshop\/?$/, { timeout: 8000 });
    await expect(page.getByRole('heading', { level: 1, name: 'The Workshop' })).toBeVisible();
    const first = added(log)[0];
    const nav = log.find((e) => e.kind === 'nav');
    expect(first, 'the loader appeared').toBeTruthy();
    expect(first?.label).toBe('Loading');
    expect(first?.role).toBe('status');
    expect(first?.dots).toBe(25);
    // It showed during the wait (after the short grace period), not after the page had already arrived.
    expect(first?.at ?? 0).toBeLessThan(nav?.at ?? 0);
    // (The room's own loader may be up by now; the page-transition loader must be gone.)
    await expect(page.locator('.ld').filter({ hasNotText: /neural/i })).toHaveCount(0);
  });

  test('it covers the whole screen in the page colour, so the wait is never a blank flash or a half page', async ({
    page,
  }) => {
    const log = watch(page);
    await open(page);
    await slowWorkshop(page, 1800);
    log.length = 0;
    await go(page);
    await page.waitForURL(/\/workshop\/?$/, { timeout: 8000 });
    const first = added(log)[0];
    expect(first?.width).toBe(1440);
    expect(first?.height).toBe(900);
    expect(first?.bg).toBe(first?.pageBg);
  });

  test('a hash jump on the same page never shows it', async ({ page }) => {
    const log = watch(page);
    await open(page);
    await page.locator('.shell-bar a[href="#work"]').first().click();
    await page.waitForTimeout(600);
    expect(added(log)).toHaveLength(0);
  });

  test('a fast page does not flash it', async ({ page }) => {
    const log = watch(page);
    await open(page);
    await navLink(page).click();
    await page.waitForURL(/\/workshop\/?$/);
    expect(added(log)).toHaveLength(0);
  });

  test('links are prefetched as soon as the pointer reaches them, once', async ({ page }) => {
    await open(page);
    await expect(page.locator('link[rel="prefetch"][href$="/workshop"]')).toHaveCount(0);
    await navLink(page).hover();
    await expect(page.locator('link[rel="prefetch"][href$="/workshop"]')).toHaveCount(1);
    await navLink(page).hover();
    await expect(page.locator('link[rel="prefetch"][href$="/workshop"]')).toHaveCount(1);
  });

  test('coming back with the back button never leaves it behind', async ({ page }) => {
    await open(page);
    await slowWorkshop(page, 800);
    await go(page);
    await page.waitForURL(/\/workshop\/?$/, { timeout: 8000 });
    await page.goBack();
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.ld')).toHaveCount(0);
  });

  test('Escape on a stalled load takes it away', async ({ page }) => {
    const log = watch(page);
    await open(page);
    await slowWorkshop(page, 6000);
    log.length = 0;
    await go(page);
    await expect.poll(() => added(log).length, { timeout: 2500 }).toBe(1);
    await page.keyboard.press('Escape');
    await expect.poll(() => log.some((e) => e.kind === 'gone'), { timeout: 2000 }).toBe(true);
  });

  test('reduced motion: the dots hold still', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const log = watch(page);
    await open(page);
    await slowWorkshop(page, 1800);
    log.length = 0;
    await go(page);
    await expect.poll(() => added(log).length, { timeout: 2500 }).toBe(1);
    expect(added(log)[0]?.dotAnimation).toBe('none');
  });

  test('the entry sequence ends on the loader, not a stuck last frame, when the workshop is slow', async ({
    page,
  }) => {
    const log = watch(page);
    await noPrefetch(page);
    await open(page);
    await slowWorkshop(page, 3000);
    const b = await page.locator('.hero__stage').boundingBox();
    const x = (b?.x ?? 0) + (b?.width ?? 0) * 0.49;
    const y = (b?.y ?? 0) + (b?.height ?? 0) * 0.3;
    await expect(page.locator('a.ws-brain')).toBeAttached({ timeout: 9000 });
    await page.mouse.move(x, y, { steps: 6 });
    await page.mouse.click(x, y);
    await expect(page.locator('.ent')).toBeVisible();
    log.length = 0;
    await page.keyboard.press('Escape');
    await expect.poll(() => added(log).length, { timeout: 3000 }).toBe(1);
    expect(added(log)[0]?.label).toBe('Entering the workshop');
    await page.waitForURL(/\/workshop\/?$/, { timeout: 10_000 });
  });

  test('coming near the brain starts fetching the workshop, so the sequence rarely has to wait', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('a.ws-brain')).toBeAttached({ timeout: 9000 });
    await expect(page.locator('link[rel="prefetch"][href="/workshop"]')).toHaveCount(0);
    const b = await page.locator('.hero__stage').boundingBox();
    await page.mouse.move(
      (b?.x ?? 0) + (b?.width ?? 0) * 0.49,
      (b?.y ?? 0) + (b?.height ?? 0) * 0.3,
      { steps: 6 },
    );
    await expect(page.locator('link[rel="prefetch"][href="/workshop"]')).toHaveCount(1);
  });
});

test.describe('the loader in the design system', () => {
  for (const theme of ['night', 'day'] as const)
    test(`it passes axe, and its progress bar follows the ratio (${theme})`, async ({ page }) => {
      await page.addInitScript(
        (t) => localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t })),
        theme,
      );
      await page.goto('/design/');
      await page.getByRole('button', { name: 'Show loader with progress' }).click();
      const loader = page.locator('.ld');
      await expect(loader).toBeVisible();
      await expect(loader.locator('.ld__label')).toHaveText('Loading the workshop');
      await page.waitForTimeout(900);
      expect(
        Number(await loader.evaluate((e) => getComputedStyle(e).getPropertyValue('--p'))),
      ).toBeGreaterThan(0.2);
      await expect(loader).toHaveAttribute('data-det', '');
      const results = await new AxeBuilder({ page }).include('.ld').analyze();
      expect(results.violations).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(loader).toHaveCount(0);
    });

  test('the indeterminate loader has a sliding bar, and clicking it dismisses it', async ({
    page,
  }) => {
    await page.goto('/design/');
    await page.getByRole('button', { name: 'Show loader', exact: true }).click();
    const loader = page.locator('.ld');
    await expect(loader).toBeVisible();
    await expect(loader).not.toHaveAttribute('data-det', '');
    expect(
      await loader
        .locator('.ld__bar')
        .evaluate((e) => getComputedStyle(e, '::after').animationName),
    ).toBe('ld-slide');
    await loader.click({ position: { x: 20, y: 20 } });
    await expect(loader).toHaveCount(0);
  });
});
