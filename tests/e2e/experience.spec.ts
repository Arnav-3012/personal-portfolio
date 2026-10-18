import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Role = {
  id: string;
  company: string;
  title: string;
  dates: string;
  end: string | null;
  impact: string[];
  stack: string[];
};
type Honor = { event: string; year: number; result: string };
const roles = JSON.parse(readFileSync('content/experience.json', 'utf8')) as Role[];
const honors = (JSON.parse(readFileSync('content/site.json', 'utf8')) as { honors: Honor[] })
  .honors;

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto('/');
};

test.describe('experience rail', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('lists every role from experience.json, newest first, with its impact lines', async ({
    page,
  }) => {
    await open(page);
    const items = page.locator('#experience [data-rail-node]');
    await expect(items).toHaveCount(roles.length);
    for (const [i, role] of roles.entries()) {
      const item = items.nth(i);
      await expect(item.locator('.exp__title')).toHaveText(role.title);
      await expect(item.locator('.exp__company')).toContainText(role.company);
      await expect(item.locator('.hud').first()).toContainText(role.dates);
      await expect(item.locator('.exp__impact li')).toHaveText(role.impact);
      await expect(item.locator('.exp__stack li')).toHaveText(role.stack);
    }
    // Only the role with no end date is marked "Now".
    await expect(page.locator('.exp__now')).toHaveCount(roles.filter((r) => r.end === null).length);
  });

  test('lists the hackathons from site.json, newest year first', async ({ page }) => {
    await open(page);
    const rows = page.locator('.exp__honor');
    await expect(rows).toHaveCount(honors.length);
    const years = (await rows.locator('.exp__honor-year').allTextContents()).map(Number);
    expect(years).toEqual(years.toSorted((a, b) => b - a));
    // Newest year first; within a year the file order holds (Array.prototype.toSorted is stable).
    const expected = honors.toSorted((a, b) => b.year - a.year);
    for (const [i, h] of expected.entries()) {
      const row = rows.nth(i);
      await expect(row.locator('.exp__honor-event')).toHaveText(h.event);
      await expect(row.locator('.exp__honor-year')).toHaveText(String(h.year));
      await expect(row.locator('.exp__honor-result')).toHaveText(h.result);
    }
  });

  test('honor links land on a real element', async ({ page }) => {
    await open(page);
    const hrefs = await page
      .locator('.exp__honor-link')
      .evaluateAll((els) => els.map((a) => (a as HTMLAnchorElement).hash));
    expect(hrefs.length).toBeGreaterThan(0);
    for (const hash of hrefs) expect(await page.locator(hash).count(), hash).toBe(1);
  });

  test('the rail draws as you scroll and nodes light when the line reaches them', async ({
    page,
  }) => {
    await open(page);
    const rail = page.locator('[data-rail]');
    const progress = () => rail.evaluate((el) => Number(el.style.getPropertyValue('--p')));
    const lit = () => page.locator('[data-rail-node][data-lit]').count();

    await page.locator('#projects').scrollIntoViewIfNeeded();
    await expect.poll(progress).toBeLessThan(0.05);
    expect(await lit()).toBe(0);

    // Park the rail's middle on the draw line: partly drawn, some nodes lit.
    await rail.evaluate((el) => {
      const r = el.getBoundingClientRect();
      scrollBy(0, r.top + r.height / 2 - innerHeight * 0.6);
    });
    await expect.poll(progress).toBeGreaterThan(0.3);
    expect(await progress()).toBeLessThan(0.7);
    const some = await lit();
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(roles.length);

    await rail.evaluate((el) => scrollBy(0, el.getBoundingClientRect().bottom));
    await expect.poll(progress).toBe(1);
    expect(await lit()).toBe(roles.length);
  });

  test('the nav marks Experience while the rail is in view', async ({ page }) => {
    await open(page);
    await page.locator('#experience').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(page.locator('[data-nav-link][href="#experience"]')).toHaveAttribute(
      'aria-current',
      'location',
    );
  });
});

test.describe('experience rail: no motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('reduced motion shows the rail fully drawn', async ({ page }) => {
    await open(page);
    await expect(page.locator('[data-rail]')).not.toHaveAttribute('data-rail', 'draw');
    expect(
      await page.locator('[data-rail]').evaluate((el) => el.style.getPropertyValue('--p')),
    ).toBe('');
    // Unlit nodes use the page background; lit ones are filled amber.
    const fills = await page
      .locator('[data-rail-node]')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el, '::before').backgroundColor));
    expect(new Set(fills).size).toBe(1);
    expect(fills[0]).not.toBe(
      await page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    );
  });

  test('without JS the rail is complete too', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#experience [data-rail-node]')).toHaveCount(roles.length);
    await expect(page.locator('.exp__impact li').first()).toBeVisible();
    await ctx.close();
  });
});

test.describe('experience on mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('stacks without sideways scroll', async ({ page }) => {
    await open(page);
    await page.locator('#experience').scrollIntoViewIfNeeded();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    for (const el of await page.locator('.exp__card').all()) {
      const box = await el.boundingBox();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    }
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: experience has no violations (${theme})`, async ({ page }) => {
    await open(page, theme);
    const results = await new AxeBuilder({ page }).include('#experience').analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`experience ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          const page = await ctx.newPage();
          await open(page, theme);
          // Draw the rail to its end, then let the node transitions settle before shooting.
          await page.locator('#experience').scrollIntoViewIfNeeded();
          await page
            .locator('[data-rail]')
            .evaluate((el) => scrollBy(0, el.getBoundingClientRect().bottom - innerHeight * 0.5));
          await page.waitForTimeout(1200);
          await page.locator('#experience').screenshot({
            path: info.outputPath(`experience-${width}-${theme}-${motion}.png`),
          });
          await ctx.close();
        });
      }
    }
  }
});
