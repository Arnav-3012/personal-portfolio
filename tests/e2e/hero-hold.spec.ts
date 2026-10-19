import { expect, test, type Page } from '@playwright/test';

const seen = (page: Page) =>
  page.addInitScript(() => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: 'night' }));
  });
const photo = (page: Page) => page.locator('.hero__media img');
const letters = (page: Page) => page.locator('.hero__letter');
const opacity = (loc: ReturnType<typeof photo>) =>
  loc.first().evaluate((e) => getComputedStyle(e).opacity);
const stageDots = (page: Page) =>
  page.locator('.hero__stage').evaluate((e) => getComputedStyle(e, '::after').content);

test.describe('the hero on a repeat visit (refresh, or back from /workshop)', () => {
  test('holds the raw photo and half-arrived letters back, and shows a small dot pulse until the dots are ready', async ({
    page,
  }) => {
    await seen(page);
    // Keep the scripts away for a while so the state before them can be looked at.
    await page.route('**/_astro/*.js', async (route) => {
      await new Promise((r) => setTimeout(r, 1600));
      await route.continue();
    });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/', { waitUntil: 'commit' });
    // Deferred module scripts run before DOMContentLoaded, so look while they are still on their way.
    await page.waitForSelector('.hero__letter', { state: 'attached' });
    await page.waitForTimeout(400);
    expect(
      await page.evaluate(() => document.querySelector('.hero')?.hasAttribute('data-dots')),
    ).toBe(false);
    expect(await opacity(photo(page))).toBe('0');
    expect(await opacity(letters(page))).toBe('0');
    expect(await stageDots(page)).not.toBe('none');
    // Then the dot portrait takes over, the pulse goes, and the name arrives.
    await expect(page.locator('.hero[data-dots="ready"]')).toBeAttached({ timeout: 9000 });
    expect(await stageDots(page)).toBe('none');
    await expect.poll(() => opacity(letters(page)), { timeout: 4000 }).toBe('1');
    expect(await opacity(photo(page))).toBe('0');
  });

  test('if the scripts never run, everything shows after 2.5 s, so the hero is never left empty', async ({
    page,
  }) => {
    await seen(page);
    await page.route('**/_astro/*.js', (route) => route.abort());
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(500);
    expect(await opacity(photo(page))).toBe('0');
    await page.waitForTimeout(2400);
    expect(await opacity(photo(page))).toBe('1');
    expect(await opacity(letters(page))).toBe('1');
    expect(await stageDots(page)).not.toBe('none');
    expect(
      await page.locator('.hero__stage').evaluate((e) => getComputedStyle(e, '::after').opacity),
    ).toBe('0');
  });

  test('the first visit is untouched: the boot covers it and the photo stays visible (it is the LCP image)', async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: 'night' })),
    );
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(await page.evaluate(() => document.documentElement.dataset['boot'])).toBe('on');
    // The photo is not held back (the dot portrait may already have replaced it under the boot, so look at the hold, not
    // at the opacity).
    expect(
      await photo(page)
        .first()
        .evaluate((e) => getComputedStyle(e).animationName),
    ).not.toContain('hero-failsafe');
    expect(await stageDots(page)).toBe('none');
  });

  test('without JavaScript nothing is held back', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto('http://localhost:8787/');
    // The letters still arrive with their own short animation.
    await page.waitForTimeout(1500);
    expect(await opacity(photo(page))).toBe('1');
    expect(await opacity(letters(page))).toBe('1');
    expect(await stageDots(page)).toBe('none');
    await context.close();
  });

  test('a refresh in the same session goes through the hold, then lands on the same finished hero', async ({
    page,
  }) => {
    await seen(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('.hero[data-dots="ready"]')).toBeAttached({ timeout: 9000 });
    await page.reload();
    await expect(page.locator('.hero[data-dots="ready"]')).toBeAttached({ timeout: 9000 });
    await expect.poll(() => opacity(letters(page)), { timeout: 4000 }).toBe('1');
    expect(await opacity(photo(page))).toBe('0');
  });
});
