import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, motion?: 'reduce') => {
  if (motion) await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(() => sessionStorage.setItem('arnav:boot:v1', 'seen'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
};
const glyph = (page: Page) => page.locator('.cur__glyph').innerHTML();

test.describe('section cursor', () => {
  test('appears once the page has settled and changes glyph with the section', async ({ page }) => {
    await open(page);
    await expect(page.locator('.cur')).toBeAttached({ timeout: 9000 });
    await page.mouse.move(700, 400);
    await expect(page.locator('.cur')).toHaveClass(/cur--show/);
    await expect(page.locator('html')).toHaveClass(/cur-on/);
    const hero = await glyph(page);
    await page.evaluate(() =>
      document.querySelector('#beyond')?.scrollIntoView({ block: 'start' }),
    );
    // The words side of the tile (the story frame on the left says "drag" instead).
    await page.mouse.move(1100, 500);
    await page.mouse.move(1110, 510);
    await expect.poll(() => glyph(page)).not.toBe(hero);
    expect(await glyph(page)).toContain('M9 6.5v11'); // the play mark
    await page.evaluate(() =>
      document.querySelector('#contact')?.scrollIntoView({ block: 'start' }),
    );
    await page.mouse.move(400, 400);
    await page.mouse.move(410, 410);
    await expect.poll(() => glyph(page)).toContain('M5 19l.9-3.9'); // the pencil
  });

  test('swells and turns amber over a link', async ({ page }) => {
    await open(page);
    await expect(page.locator('.cur')).toBeAttached({ timeout: 9000 });
    const link = page.locator('.hero__quads a').first();
    const box = await link.boundingBox();
    if (!box) throw new Error('no link');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.cur')).toHaveClass(/cur--hot/);
    await page.mouse.move(720, 450);
    await page.mouse.move(730, 460);
    await expect(page.locator('.cur')).not.toHaveClass(/cur--hot/);
  });

  test('gives way to the native cursor over a text field', async ({ page }) => {
    await open(page);
    await expect(page.locator('.cur')).toBeAttached({ timeout: 9000 });
    await page.evaluate(() =>
      document.querySelector('#contact')?.scrollIntoView({ block: 'start' }),
    );
    const field = page.locator('#contact input, #contact textarea').first();
    await field.scrollIntoViewIfNeeded();
    const box = await field.boundingBox();
    if (!box) throw new Error('no field');
    await page.mouse.move(box.x + 10, box.y + 10);
    await expect(page.locator('html')).not.toHaveClass(/cur-on/);
    await expect(page.locator('.cur')).not.toHaveClass(/cur--show/);
  });

  test('is not created with reduced motion', async ({ page }) => {
    await open(page, 'reduce');
    await page.waitForTimeout(3800);
    await expect(page.locator('.cur')).toHaveCount(0);
    await expect(page.locator('html')).not.toHaveClass(/lenis/);
  });
});

test.describe('scroll depth and smooth scrolling', () => {
  test('the hairline fills as the page scrolls and the hero layers separate', async ({ page }) => {
    await open(page);
    await expect(page.locator('.sbar')).toBeAttached({ timeout: 9000 });
    expect(await page.locator('.sbar').evaluate((e) => (e as HTMLElement).style.transform)).toBe(
      'scaleX(0)',
    );
    await page.evaluate(() => scrollTo({ top: 450, behavior: 'instant' }));
    await expect
      .poll(() => page.locator('.hero__stage').evaluate((e) => getComputedStyle(e).translate))
      .not.toBe('none');
    await expect
      .poll(async () => {
        const t = await page.locator('.hero__name').evaluate((e) => getComputedStyle(e).translate);
        return parseFloat(t.split(' ')[1] ?? '0');
      })
      .toBeLessThan(0);
    const scale = await page.locator('.sbar').evaluate((e) => (e as HTMLElement).style.transform);
    expect(parseFloat(scale.replace(/[^0-9.]/g, ''))).toBeGreaterThan(0);
  });

  test('Lenis takes over the wheel, and a nav link glides to its section', async ({ page }) => {
    await open(page);
    await expect(page.locator('html')).toHaveClass(/lenis/, { timeout: 9000 });
    await page.locator('nav a[href="#experience"]').first().click();
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.querySelector('#experience')?.getBoundingClientRect().top ?? 9999,
          ),
        {
          timeout: 5000,
        },
      )
      .toBeLessThan(120);
    expect(page.url()).toContain('#experience');
  });

  test('the wheel scrolls the page, eased', async ({ page }) => {
    await open(page);
    await expect(page.locator('html')).toHaveClass(/lenis/, { timeout: 9000 });
    await page.mouse.move(700, 450);
    await page.mouse.wheel(0, 900);
    await expect.poll(() => page.evaluate(() => scrollY), { timeout: 4000 }).toBeGreaterThan(500);
  });

  test('one wheel gesture over the projects table moves the page, it is not swallowed', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('html')).toHaveClass(/lenis/, { timeout: 9000 });
    await page.evaluate(() =>
      document.querySelector('[data-index-table]')?.scrollIntoView({ block: 'center' }),
    );
    await page.waitForTimeout(800);
    const box = await page.locator('[data-index-table] tbody tr').nth(2).boundingBox();
    if (!box) throw new Error('no row');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const before = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 500);
    await expect
      .poll(() => page.evaluate(() => scrollY), { timeout: 3000 })
      .toBeGreaterThan(before + 300);
  });

  test('a lazy image fades in when it arrives', async ({ page }) => {
    await open(page);
    await expect(page.locator('.sbar')).toBeAttached({ timeout: 9000 });
    await page.evaluate(() =>
      document.querySelector('#beyond')?.scrollIntoView({ block: 'start' }),
    );
    await expect(page.locator('#beyond .tile__image img').first()).toHaveJSProperty(
      'complete',
      true,
      {
        timeout: 8000,
      },
    );
  });
});
