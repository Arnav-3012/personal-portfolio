import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (file: string) => JSON.parse(readFileSync(`content/${file}`, 'utf8'));
const cricket = read('cricket.json') as {
  whyCricket: string;
  teaser: { file: string; alt: string };
};
const discipline = read('discipline.json') as {
  headline: string;
  subLine: string;
  reels: unknown[];
};
const stickerKinds = (cricket as unknown as { stickers: { kind: string }[] }).stickers;
const firstTwoSentences = (cricket.whyCricket.match(/[^.!?]+[.!?]+(?:\s|$)/g) ?? [])
  .slice(0, 2)
  .join('')
  .trim();

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto('/');
};

test.describe('beyond code', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows the cricket and 75 Hard tiles from content', async ({ page }) => {
    await open(page);
    const tiles = page.locator('#beyond .tile');
    await expect(tiles).toHaveCount(2);
    const cricketTile = tiles.nth(0);
    await expect(cricketTile.locator('.tile__title')).toHaveText('Cricket');
    await expect(cricketTile.locator('.tile__text')).toHaveText(firstTwoSentences);
    await expect(cricketTile.locator('img')).toHaveAttribute('src', `/${cricket.teaser.file}`);
    await expect(cricketTile.locator('img')).toHaveAttribute('alt', cricket.teaser.alt);
    const hardTile = tiles.nth(1);
    await expect(hardTile.locator('.tile__title')).toHaveText(discipline.headline);
    await expect(hardTile.locator('.tile__text')).toHaveText(discipline.subLine);
    await expect(hardTile.locator('.tile__link')).toHaveAttribute('href', '#75-hard');
  });

  test('both images load', async ({ page }) => {
    await open(page);
    await page.locator('#beyond').scrollIntoViewIfNeeded();
    for (const img of await page.locator('#beyond img').all()) {
      await expect(img).toBeVisible();
      await expect
        .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  test('clicking anywhere on a tile follows its link to an element that exists', async ({
    page,
  }) => {
    await open(page);
    for (const tile of await page.locator('#beyond .tile').all()) {
      const href = (await tile.locator('.tile__link').getAttribute('href')) ?? '';
      await expect(page.locator(`[id="${href.slice(1)}"]`), href).toHaveCount(1);
    }
    const hard = page.locator('#beyond .tile[data-tile="75-hard"]');
    await hard.scrollIntoViewIfNeeded();
    const box = await hard.boundingBox();
    if (!box) throw new Error('no tile box');
    // Click the image corner, far from the text link: the whole tile is the target.
    await page.mouse.click(box.x + 20, box.y + 20);
    await expect(page).toHaveURL(/#75-hard$/);
  });

  test('lays the stickers and the pinned photo over the cricket frame, and fans the day cards', async ({
    page,
  }) => {
    await open(page);
    await page.locator('#beyond').scrollIntoViewIfNeeded();
    await expect(page.locator('.tile[data-tile="cricket"] .stk')).toHaveCount(stickerKinds.length);
    await expect(page.locator('.tile[data-tile="cricket"] .stk-polaroid')).toHaveCount(1);
    // The four icon stickers are drawn, not photographed.
    for (const kind of ['bat', 'ball', 'cup', 'jersey'])
      await expect(page.locator(`.stk--${kind} svg`)).toHaveCount(1);
    await expect(page.locator('.fan__card')).toHaveCount(discipline.reels.length);
    // Decoration is hidden from assistive tech and never causes sideways scrolling.
    await expect(page.locator('.stk-layer')).toHaveAttribute('aria-hidden', 'true');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

  test('the story frame swipes: a drag, a tap and the arrow keys change the photo', async ({
    page,
  }) => {
    await open(page);
    await page.locator('#beyond').scrollIntoViewIfNeeded();
    const frame = page.locator('.tile[data-tile="cricket"] .tile__image[data-swipe]');
    await expect(frame).toBeAttached();
    const label = page.locator('.story__label');
    await expect(label).toContainText('1/3');
    await frame.scrollIntoViewIfNeeded();
    const box = await frame.boundingBox();
    if (!box) throw new Error('no frame box');
    const y = box.y + box.height * 0.5;
    // Drag left: the next photo.
    await page.mouse.move(box.x + box.width * 0.75, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.25, y, { steps: 10 });
    await page.mouse.up();
    await expect(label).toContainText('2/3');
    await expect(page.locator('.story__slide[aria-hidden="false"] img')).toHaveAttribute(
      'src',
      /stands/,
    );
    // Drag right: back to the first.
    await page.mouse.move(box.x + box.width * 0.25, y);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.75, y, { steps: 10 });
    await page.mouse.up();
    await expect(label).toContainText('1/3');
    // A tap on the right goes forward, the left third goes back; the arrow keys do the same, and it wraps round.
    await page.mouse.click(box.x + box.width * 0.8, y);
    await expect(label).toContainText('2/3');
    await page.mouse.click(box.x + box.width * 0.1, y);
    await expect(label).toContainText('1/3');
    await frame.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(label).toContainText('3/3');
    await page.keyboard.press('ArrowRight');
    await expect(label).toContainText('1/3');
    await expect(page.locator('.story__bar.is-on')).toHaveCount(1);
  });

  test('tilts toward the pointer and settles back', async ({ page }) => {
    await open(page);
    const tile = page.locator('#beyond .tile').first();
    // Reaching the tiles starts the GitHub section above them loading; measure only once the page has settled,
    // or the tile can move out from under the pointer between the move and the reads.
    await tile.scrollIntoViewIfNeeded();
    await expect(page.locator('#github')).toHaveAttribute('data-state', /ready|error/);
    await tile.scrollIntoViewIfNeeded();
    const box = await tile.boundingBox();
    if (!box) throw new Error('no tile box');
    const prop = (name: string) => tile.evaluate((el, n) => el.style.getPropertyValue(n), name);
    await page.mouse.move(box.x + box.width - 4, box.y + 4);
    expect(Number.parseFloat(await prop('--ry'))).toBeGreaterThan(3);
    expect(Number.parseFloat(await prop('--rx'))).toBeGreaterThan(3);
    await page.mouse.move(5, 5);
    expect(await prop('--ry')).toBe('');
  });

  test('stays flat with reduced motion', async ({ browser }) => {
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const page = await ctx.newPage();
    await open(page);
    const tile = page.locator('#beyond .tile').first();
    await tile.scrollIntoViewIfNeeded();
    await tile.hover({ position: { x: 10, y: 10 } });
    expect(await tile.evaluate((el) => el.style.getPropertyValue('--ry'))).toBe('');
    await ctx.close();
  });
});

test.describe('beyond code: mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('stacks to one column without overflow', async ({ page }) => {
    await open(page);
    const cols = await page
      .locator('.beyond__tiles')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: beyond code has no violations (${theme})`, async ({ page }) => {
    await open(page, theme);
    await page.locator('#beyond').scrollIntoViewIfNeeded();
    const results = await new AxeBuilder({ page }).include('#beyond').analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`beyond ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          const page = await ctx.newPage();
          await open(page, theme);
          await page.locator('#beyond').scrollIntoViewIfNeeded();
          await page.waitForTimeout(600);
          await page.locator('#beyond').screenshot({
            path: info.outputPath(`beyond-${width}-${theme}-${motion}.png`),
          });
          await ctx.close();
        });
      }
    }
  }
});
