import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, motion?: 'reduce') => {
  if (motion) await page.emulateMedia({ reducedMotion: motion });
  await page.addInitScript(() => sessionStorage.setItem('arnav:boot:v1', 'seen'));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
};
const title = (page: Page) => page.locator('#contact-title');
const jump = (page: Page, id: string) =>
  page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'center' }), id);

test.describe('text motion', () => {
  test('titles split into words that rise in, keep their text, and never shift the layout', async ({
    page,
  }) => {
    await open(page);
    await expect(title(page)).toHaveClass(/\btx\b/, { timeout: 9000 });
    expect((await title(page).textContent())?.trim()).toBe('Say hello');
    expect(await title(page).locator('.tx-c').count()).toBe(8);

    const before = await page.locator('#about .about__text').boundingBox();
    await jump(page, 'contact-title');
    await expect(title(page)).toHaveClass(/tx-in/);
    // Words end at rest, unclipped.
    await expect
      .poll(() =>
        title(page)
          .locator('.tx-c')
          .first()
          .evaluate((e) => getComputedStyle(e).transform),
      )
      .toBe('none');
    const after = await page.locator('#about .about__text').boundingBox();
    expect(after?.height).toBe(before?.height);
  });

  test('titles drop back when scrolled away', async ({ page }) => {
    await open(page);
    await expect(title(page)).toHaveClass(/\btx\b/, { timeout: 9000 });
    await jump(page, 'contact-title');
    await expect(title(page)).toHaveClass(/tx-in/);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(title(page)).not.toHaveClass(/tx-in/);
  });

  test('paragraph words light up as the paragraph is read, and dim again going back', async ({
    page,
  }) => {
    await open(page);
    const para = page.locator('.about__text p').first();
    await expect(para).toHaveClass(/\btx\b/, { timeout: 9000 });
    const opacities = () =>
      para
        .locator('.tx-r')
        .evaluateAll((els) => els.map((e) => Number(getComputedStyle(e).opacity)));
    // Far below the fold: every word dim.
    expect(Math.max(...(await opacities()))).toBeLessThan(0.3);
    await page.evaluate(() => {
      const p = document.querySelector('.about__text p') as HTMLElement;
      window.scrollTo(0, p.getBoundingClientRect().top + scrollY - innerHeight * 0.35);
    });
    await expect.poll(async () => Math.min(...(await opacities()))).toBeGreaterThan(0.95);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect.poll(async () => Math.max(...(await opacities()))).toBeLessThan(0.3);
  });

  test('the cursor lifts the letters under it', async ({ page }) => {
    await open(page);
    await expect(title(page)).toHaveClass(/\btx\b/, { timeout: 9000 });
    await jump(page, 'contact-title');
    await expect(title(page)).toHaveClass(/tx-in/);
    await page.waitForTimeout(1500);
    const box = await title(page).locator('.tx-c').first().boundingBox();
    await page.mouse.move((box?.x ?? 0) + 10, (box?.y ?? 0) + 20);
    await expect
      .poll(() =>
        title(page)
          .locator('.tx-c')
          .first()
          .evaluate((e) => getComputedStyle(e).scale),
      )
      .not.toBe('none');
  });

  test('reduced motion leaves the text unsplit', async ({ page }) => {
    await open(page, 'reduce');
    await page.waitForTimeout(4000);
    await expect(title(page)).not.toHaveClass(/\btx\b/);
    expect(await title(page).locator('.tx-c').count()).toBe(0);
  });
});
