import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Project = {
  id: string;
  name: string;
  oneLiner: string;
  tier: string;
  status: string;
  order: number;
};
const projects = (JSON.parse(readFileSync('content/projects.json', 'utf8')) as Project[]).toSorted(
  (a, b) => a.order - b.order,
);
const picks = projects.filter((p) => p.tier === 'hero').slice(0, 5);

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto('/');
};

test.describe('selected work', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('lists the top five and the active pane follows scroll', async ({ page }) => {
    await open(page);
    const items = page.locator('[data-work-item]');
    await expect(items).toHaveCount(5);
    await expect(items.locator('.work__name')).toHaveText(picks.map((p) => p.name));
    for (const [i, p] of picks.entries()) {
      await items.nth(i).scrollIntoViewIfNeeded();
      await items.nth(i).evaluate((el) => el.scrollIntoView({ block: 'center' }));
      await expect(items.nth(i)).toHaveAttribute('data-active', '');
      await expect(page.locator('[data-work-pane][data-active]')).toHaveCount(1);
      await expect(page.locator('[data-work-pane][data-active]')).toContainText(p.oneLiner);
    }
  });

  test('the pane is a compact card, not a slab', async ({ page }) => {
    await open(page);
    const box = await page.locator('.work__pane').boundingBox();
    expect(box?.width).toBeLessThanOrEqual(400);
    expect(box?.height).toBeLessThanOrEqual(460);
  });

  test('the next project does not take over until it is clearly in view', async ({ page }) => {
    await open(page);
    const items = page.locator('[data-work-item]');
    await items.nth(1).evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(items.nth(1)).toHaveAttribute('data-active', '');
    // Nudge a little towards project 3: still project 2
    await page.evaluate(() => scrollBy(0, 80));
    await expect(items.nth(1)).toHaveAttribute('data-active', '');
  });

  test('only the active pane is focusable', async ({ page }) => {
    await open(page);
    await page
      .locator('[data-work-item]')
      .nth(2)
      .evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await expect(page.locator('[data-work-pane][inert]')).toHaveCount(4);
    await expect(page.locator('[data-work-pane][data-active]')).not.toHaveAttribute('inert', /.*/);
  });

  test('the pane stays pinned while its list scrolls', async ({ page }) => {
    await open(page);
    const pane = page.locator('.work__pane');
    // Item 0 can still sit above the pin point, so compare two items that are both mid-list.
    const topAt = async (n: number) => {
      await page
        .locator('[data-work-item]')
        .nth(n)
        .evaluate((el) => el.scrollIntoView({ block: 'center' }));
      return (await pane.boundingBox())?.y ?? -1;
    };
    const a = await topAt(1);
    const b = await topAt(3);
    expect(Math.abs(a - b)).toBeLessThan(2);
    expect(a).toBeGreaterThan(0);
  });
});

test.describe('selected work on mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });
  test('stacks: the sticky pane is hidden and each name carries its detail', async ({ page }) => {
    await open(page);
    await expect(page.locator('.work__pane')).toBeHidden();
    await expect(page.locator('.work__inline').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
  });
});

test.describe('all projects index', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('lists every project', async ({ page }) => {
    await open(page);
    await expect(page.locator('tbody tr')).toHaveCount(projects.length);
  });

  for (const status of ['shipped', 'building', 'coming-soon']) {
    test(`filter "${status}" shows only that status`, async ({ page }) => {
      await open(page);
      const want = projects.filter((p) => p.status === status).length;
      const btn = page.locator(`[data-filter="${status}"]`);
      await btn.click();
      await expect(btn).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('[data-filter="all"]')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('tbody tr:not([hidden])')).toHaveCount(want);
      await expect(page.locator('[data-index-count]')).toHaveText(
        `${want} ${want === 1 ? 'project' : 'projects'}`,
      );
      await page.locator('[data-filter="all"]').click();
      await expect(page.locator('tbody tr:not([hidden])')).toHaveCount(projects.length);
    });
  }

  test('filters work from the keyboard', async ({ page }) => {
    await open(page);
    const btn = page.locator('[data-filter="building"]');
    await btn.focus();
    await page.keyboard.press('Enter');
    await expect(btn).toHaveAttribute('aria-pressed', 'true');
  });

  test('without JS every row shows', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('tbody tr:visible')).toHaveCount(projects.length);
    await ctx.close();
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: work sections have no violations (${theme})`, async ({ page }) => {
    await open(page, theme);
    const results = await new AxeBuilder({ page }).include('#work').include('#projects').analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`work ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          const page = await ctx.newPage();
          await open(page, theme);
          // Park the third project mid-viewport, then let the pane crossfade settle before shooting.
          await page
            .locator(width >= 768 ? '[data-work-item]' : '.work__item')
            .nth(2)
            .evaluate((el) => el.scrollIntoView({ block: 'center' }));
          await page.waitForTimeout(1200);
          await page.screenshot({ path: info.outputPath(`work-${width}-${theme}-${motion}.png`) });
          await page.locator('#projects').scrollIntoViewIfNeeded();
          await page.waitForTimeout(1200);
          await page.locator('#projects').screenshot({
            path: info.outputPath(`index-${width}-${theme}-${motion}.png`),
          });
          await ctx.close();
        });
      }
    }
  }
});
