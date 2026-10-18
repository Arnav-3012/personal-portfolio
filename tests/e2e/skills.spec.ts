import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Layer = {
  id: string;
  layer: string;
  skills: { name: string; level: string; evidence: string[] }[];
};
const skills = JSON.parse(readFileSync('content/skills.json', 'utf8')) as Layer[];
const dock = (JSON.parse(readFileSync('content/site.json', 'utf8')) as { dock: string[] }).dock;
const profile = readFileSync('content/profile.md', 'utf8');
const firstIntro = /## Who I am\s+([^\n]+)/.exec(profile)?.[1] ?? '';
const philosophy = /## My philosophy\s+([^\n]+)/.exec(profile)?.[1] ?? '';

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto('/');
};

test.describe('about and skills', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('opens with the profile intro and philosophy from profile.md', async ({ page }) => {
    await open(page);
    const about = page.locator('#about');
    await expect(about.locator('.about__text p').first()).toHaveText(firstIntro);
    await expect(about.locator('.about__quote p')).toHaveText(philosophy);
  });

  test('lists every layer and skill from skills.json, core before working before learning', async ({
    page,
  }) => {
    await open(page);
    const layers = page.locator('#about .layer');
    await expect(layers).toHaveCount(skills.length);
    const rank: Record<string, number> = { core: 0, working: 1, learning: 2 };
    for (const [i, layer] of skills.entries()) {
      const el = layers.nth(i);
      await expect(el.locator('.layer__title')).toHaveText(layer.layer);
      // The file order breaks ties within a level (a stable sort).
      const expected = layer.skills.toSorted((x, y) => (rank[x.level] ?? 9) - (rank[y.level] ?? 9));
      const rows = el.locator('.skill');
      await expect(rows).toHaveCount(expected.length);
      for (const [j, s] of expected.entries()) {
        const row = rows.nth(j);
        await expect(row.locator('.skill__name')).toContainText(s.name);
        await expect(row.locator('.skill__name .visually-hidden')).toHaveText(
          new RegExp(`\\(${s.level}\\)`, 'i'),
        );
        await expect(row.locator('.about__mark')).toHaveAttribute('data-level', s.level);
      }
    }
  });

  test('every evidence link points at an element that exists', async ({ page }) => {
    await open(page);
    const hrefs = await page
      .locator('#about .skill__proof a')
      .evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of new Set(hrefs)) {
      expect(href).toMatch(/^#/);
      await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
    }
  });

  test('the nav About link lands on the section and is marked as current', async ({ page }) => {
    await open(page);
    await page.locator('[data-nav-link][href="#about"]').first().click();
    await expect(page).toHaveURL(/#about$/);
    await expect(page.locator('#about')).toBeInViewport();
    await expect(page.locator('[data-nav-link][href="#about"]').first()).toHaveAttribute(
      'aria-current',
      'location',
    );
  });

  test('the dock lists site.dock and grows tiles toward the pointer', async ({ page }) => {
    await open(page);
    const tiles = page.locator('[data-dock-item]');
    await expect(tiles).toHaveText(dock);
    await tiles.first().scrollIntoViewIfNeeded();
    const box = await tiles.nth(2).boundingBox();
    if (!box) throw new Error('no dock tile box');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const scale = (i: number) =>
      tiles.nth(i).evaluate((el) => Number.parseFloat(el.style.getPropertyValue('--s') || '1'));
    expect(await scale(2)).toBeGreaterThan(1.3);
    expect(await scale(3)).toBeGreaterThan(1);
    expect(await scale(3)).toBeLessThan(await scale(2));
    expect(await scale(dock.length - 1)).toBe(1);
    // Leaving the dock puts every tile back.
    await page.mouse.move(5, 5);
    expect(await scale(2)).toBe(1);
  });

  test('the dock stays still with reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await open(page);
    const tile = page.locator('[data-dock-item]').nth(2);
    await tile.scrollIntoViewIfNeeded();
    await tile.hover();
    expect(await tile.evaluate((el) => el.style.getPropertyValue('--s'))).toBe('');
    await ctx.close();
  });
});

test.describe('about and skills: mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('stacks without sideways overflow', async ({ page }) => {
    await open(page);
    const widths = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      view: innerWidth,
      about: document.querySelector('#about')?.getBoundingClientRect().width ?? 0,
    }));
    expect(widths.doc).toBeLessThanOrEqual(widths.view);
    const cols = await page
      .locator('.about__layers')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: about and skills have no violations (${theme})`, async ({ page }) => {
    await open(page, theme);
    const results = await new AxeBuilder({ page }).include('#about').analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`about ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          const page = await ctx.newPage();
          await open(page, theme);
          await page.locator('#about').scrollIntoViewIfNeeded();
          await page.waitForTimeout(400);
          await page.locator('#about').screenshot({
            path: info.outputPath(`about-${width}-${theme}-${motion}.png`),
          });
          await ctx.close();
        });
      }
    }
  }
});
