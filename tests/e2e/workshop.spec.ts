import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const site = JSON.parse(readFileSync('content/site.json', 'utf8')) as {
  workshop: {
    navLabel: string;
    title: string;
    status: string;
    note: string;
    tryAnyway: string;
    tryAnywayReply: string;
    zones: { id: string; title: string; href: string }[];
  };
};
const w = site.workshop;

const open = async (page: Page, path: string, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto(path);
};
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

test.describe('entering the workshop', () => {
  test('the nav link opens /workshop', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/');
    await page.locator('.shell-bar a[href="/workshop"]').click();
    await expect(page).toHaveURL(/\/workshop\/?$/);
    await expect(page.getByRole('heading', { level: 1, name: w.title })).toBeVisible();
  });

  test('the brain is the door: it appears after the page settles, is named, and pressing it arrives on /workshop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, '/');
    const door = page.locator('.hero__stage a.ws-brain');
    await expect(door).toBeAttached({ timeout: 9000 });
    await expect(door).toHaveAttribute('aria-label', `Enter the ${w.navLabel.toLowerCase()}`);
    // The old "Enter · Workshop" button is gone.
    await expect(page.locator('.ws-hot')).toHaveCount(0);
    await door.focus();
    await expect(door).toBeFocused();
    await page.keyboard.press('Enter');
    // The press plays the entry sequence (about 5 s) and then arrives.
    await page.waitForURL(/\/workshop\/?$/, { timeout: 12_000 });
  });

  test('on a phone the brain is shown without hover and is still a named link', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await open(page, '/');
    const door = page.locator('.hero__stage a.ws-brain');
    await expect(door).toBeAttached({ timeout: 9000 });
    await expect(door).toHaveAttribute('aria-label', /workshop/i);
  });
});

test.describe('/workshop', () => {
  test('lists every zone from content, each link landing on a section that exists', async ({
    page,
  }) => {
    await open(page, '/workshop');
    await expect(page.locator('.zone')).toHaveCount(w.zones.length);
    for (const z of w.zones)
      await expect(page.getByRole('link', { name: new RegExp(z.title) })).toBeVisible();
    await expect(page.locator('.ws__status')).toContainText(w.status);
    await page.goto('/');
    for (const href of new Set(w.zones.map((z) => z.href))) {
      const id = href.split('#')[1] ?? '';
      expect(await page.locator(`[id="${id}"]`).count(), href).toBeGreaterThan(0);
    }
  });

  test('every zone is reachable by keyboard', async ({ page }) => {
    await open(page, '/workshop');
    const seen = new Set<string>();
    for (let i = 0; i < w.zones.length + 6; i++) {
      await page.keyboard.press('Tab');
      const t = await page.evaluate(
        () => document.activeElement?.querySelector('.zone__title')?.textContent ?? '',
      );
      if (t) seen.add(t);
    }
    expect(seen.size).toBe(w.zones.length);
  });

  test('the phone note and "Try anyway" work, and the note is absent on desktop', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await open(page, '/workshop');
    await expect(page.getByText(w.note)).toBeVisible();
    await page.getByRole('button', { name: w.tryAnyway }).click();
    await expect(page.getByText(w.tryAnywayReply)).toBeVisible();
    await expect(page.getByRole('button', { name: w.tryAnyway })).toBeHidden();
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(page.getByText(w.note)).toBeHidden();
  });

  for (const theme of ['night', 'day'] as const)
    test(`passes axe (${theme})`, async ({ page }) => {
      await open(page, '/workshop', theme);
      await settled(page);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });

  test('reduced motion: the list shows at once', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page, '/workshop');
    expect(
      await page
        .locator('.ws__zones li')
        .last()
        .evaluate((e) => getComputedStyle(e).opacity),
    ).toBe('1');
  });
});
