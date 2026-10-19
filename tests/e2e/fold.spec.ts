import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const projects = JSON.parse(readFileSync('content/projects.json', 'utf8')) as { status: string }[];
const total = projects.length;
const count = (status: string) => projects.filter((p) => p.status === status).length;
const FOLD = 8;

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.mouse.move(40, 40);
  await expect(page.locator('.index__more')).toBeAttached({ timeout: 9000 });
};
const rows = (page: Page) =>
  page.locator('[data-index-table] tbody tr:not([hidden]):not([data-fold])');
const more = (page: Page) => page.getByRole('button', { name: /^Show (all|fewer)/ });

test.describe('the projects table fold', () => {
  test('starts with the first rows, a faded edge and a button naming the full count', async ({
    page,
  }) => {
    await open(page);
    await expect(rows(page)).toHaveCount(FOLD);
    await expect(more(page)).toHaveText(`Show all ${total} projects`);
    await expect(more(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(page.locator('.index__scroll')).toHaveAttribute('data-folded', '');
    // The table is far shorter than the full list.
    const folded = await page.locator('[data-index-table]').boundingBox();
    expect(folded?.height ?? 9999).toBeLessThan(900);
  });

  test('the button expands to every row with a staggered reveal, and folds back to the top of the table', async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() =>
      document.querySelector('#projects')?.scrollIntoView({ block: 'start' }),
    );
    await more(page).scrollIntoViewIfNeeded();
    await more(page).click();
    await expect(rows(page)).toHaveCount(total);
    await expect(more(page)).toHaveText('Show fewer');
    await expect(more(page)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.index__scroll')).not.toHaveAttribute('data-folded', '');
    const running = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('[data-index-table] tbody tr')].filter((r) =>
          r.getAnimations().some((a) => a.playState === 'running'),
        ).length,
    );
    expect(running).toBeGreaterThan(0);

    await more(page).click();
    await expect(rows(page)).toHaveCount(FOLD);
    await expect(more(page)).toHaveText(`Show all ${total} projects`);
    // It scrolls back to the head of the table instead of leaving the visitor mid-air.
    await expect
      .poll(
        () =>
          page.evaluate(
            () => document.querySelector('#projects')?.getBoundingClientRect().top ?? 9999,
          ),
        { timeout: 4000 },
      )
      .toBeLessThan(120);
  });

  test('each filter folds again from its own first rows, and a short list shows no button', async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() =>
      document.querySelector('#projects')?.scrollIntoView({ block: 'start' }),
    );
    await page.getByRole('button', { name: /^Shipped/ }).click();
    await expect(rows(page)).toHaveCount(Math.min(FOLD, count('shipped')));
    if (count('shipped') > FOLD)
      await expect(more(page)).toHaveText(`Show all ${count('shipped')} projects`);
    await page.getByRole('button', { name: /^Coming soon/ }).click();
    await expect(rows(page)).toHaveCount(count('coming-soon'));
    await expect(page.locator('.index__more')).toBeHidden();
    await page.getByRole('button', { name: /^All/ }).click();
    await expect(rows(page)).toHaveCount(FOLD);
    await expect(more(page)).toBeVisible();
    // Expanding, then changing filter, folds again.
    await more(page).click();
    await expect(rows(page)).toHaveCount(total);
    await page.getByRole('button', { name: /^Shipped/ }).click();
    await expect(rows(page)).toHaveCount(Math.min(FOLD, count('shipped')));
  });

  test('works from the keyboard', async ({ page }) => {
    await open(page);
    await more(page).focus();
    await page.keyboard.press('Enter');
    await expect(rows(page)).toHaveCount(total);
    await page.keyboard.press('Space');
    await expect(rows(page)).toHaveCount(FOLD);
  });

  test('reduced motion folds too, with no animation', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await expect(rows(page)).toHaveCount(FOLD);
    await more(page).click();
    await expect(rows(page)).toHaveCount(total);
    // No row of the table is animating (other parts of the page may have their own motion).
    const running = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('[data-index-table] tbody tr')].filter((r) =>
          r.getAnimations().some((a) => a.playState === 'running'),
        ).length,
    );
    expect(running).toBe(0);
  });

  for (const theme of ['night', 'day'] as const)
    test(`the section passes axe (${theme})`, async ({ page }) => {
      await open(page, theme);
      await page.evaluate(() =>
        document.querySelector('#projects')?.scrollIntoView({ block: 'start' }),
      );
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page }).include('#projects').analyze();
      expect(results.violations).toEqual([]);
    });
});
