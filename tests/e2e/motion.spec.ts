import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto('/');
};
const canvas = (page: Page) => page.locator('.hero > canvas');
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

test.describe('hero neural network', () => {
  test('appears after the page has settled, behind the content, and never blocks it', async ({
    page,
  }) => {
    await open(page);
    await expect(canvas(page)).toBeAttached({ timeout: 8000 });
    await expect(canvas(page)).toHaveAttribute('aria-hidden', 'true');
    expect(await canvas(page).evaluate((c) => getComputedStyle(c).pointerEvents)).toBe('none');
    // The hero links stay clickable through it.
    await page.getByRole('link', { name: /Work/ }).first().click();
    await expect(page).toHaveURL(/#work$/);
  });

  test('draws something: the canvas is not blank', async ({ page }) => {
    await open(page);
    await expect(canvas(page)).toBeAttached({ timeout: 8000 });
    await page.waitForTimeout(1500);
    const painted = await canvas(page).evaluate((c: HTMLCanvasElement) => {
      const px =
        c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? new Uint8ClampedArray();
      let n = 0;
      for (let i = 3; i < px.length; i += 4) if ((px[i] ?? 0) > 0) n++;
      return n;
    });
    expect(painted).toBeGreaterThan(500);
  });

  test('reduced motion draws one still frame and keeps no animation loop running', async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(canvas(page)).toBeAttached({ timeout: 8000 });
    const frame = () => canvas(page).evaluate((c: HTMLCanvasElement) => c.toDataURL());
    const first = await frame();
    await page.waitForTimeout(1200);
    expect(await frame()).toBe(first);
    expect(first.length).toBeGreaterThan(1000);
  });

  for (const theme of ['night', 'day'] as const)
    test(`the hero still passes axe with the network running (${theme})`, async ({ page }) => {
      await open(page, theme);
      await expect(canvas(page)).toBeAttached({ timeout: 8000 });
      await settled(page);
      const results = await new AxeBuilder({ page }).include('.hero').analyze();
      expect(results.violations).toEqual([]);
    });
});

test.describe('section fades', () => {
  const block = '.free__grid > .free__side';

  test('a block below the fold is hidden until it is reached, then fades in, and out again when left', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator(`${block}.rv`)).toBeAttached({ timeout: 8000 });
    await expect(page.locator(block)).not.toHaveClass(/rv-in/);
    await settled(page);
    expect(await page.locator(block).evaluate((e) => getComputedStyle(e).opacity)).toBe('0');

    await page.evaluate(() => document.querySelector('#freelance')?.scrollIntoView());
    await expect(page.locator(block)).toHaveClass(/rv-in/);
    await settled(page);
    expect(await page.locator(block).evaluate((e) => getComputedStyle(e).opacity)).toBe('1');

    await page.evaluate(() => scrollTo(0, 0));
    await expect(page.locator(block)).not.toHaveClass(/rv-in/);
  });

  test('what is on screen when it starts is never hidden', async ({ page }) => {
    await open(page);
    await expect(page.locator('.rv').first()).toBeAttached({ timeout: 8000 });
    const hiddenInView = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('.rv')].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.bottom > 0 && r.top < innerHeight && getComputedStyle(e).opacity === '0';
        }).length,
    );
    expect(hiddenInView).toBe(0);
  });

  test('the sticky split, the rail, the orbit and the table keep their own motion', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('.rv').first()).toBeAttached({ timeout: 8000 });
    for (const sel of ['.work__split', '.exp__rail', '.hard__cards', '.index__table'])
      await expect(page.locator(sel).first()).not.toHaveClass(/\brv\b/);
  });

  test('reduced motion fades without moving', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(page.locator('.free__grid > .free__side.rv')).toBeAttached({ timeout: 8000 });
    expect(
      await page
        .locator('.free__grid > .free__side')
        .evaluate((e) => getComputedStyle(e).transform),
    ).toBe('none');
  });
});
