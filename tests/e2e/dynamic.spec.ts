import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: 'night' }));
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.mouse.move(40, 40);
  await expect(page.locator('.idx-glide')).toBeAttached({ timeout: 9000 });
};
const toTable = (page: Page) => page.locator('#projects').scrollIntoViewIfNeeded();
const rowsVisible = (page: Page) => page.locator('[data-index-table] tbody tr:not([hidden])');

test.describe('projects table', () => {
  test('a highlight glides to the row under the pointer and fades when the pointer leaves', async ({
    page,
  }) => {
    await open(page);
    await toTable(page);
    const row = page.locator('[data-index-table] tbody tr').nth(2);
    await row.scrollIntoViewIfNeeded();
    const box = await row.boundingBox();
    expect(box).toBeTruthy();
    await page.mouse.move((box?.x ?? 0) + 200, (box?.y ?? 0) + (box?.height ?? 0) / 2);
    await expect(page.locator('.idx-glide')).toHaveCSS('opacity', '1');
    const glide = await page.locator('.idx-glide').boundingBox();
    expect(Math.abs((glide?.y ?? 0) - (box?.y ?? 0))).toBeLessThan(3);
    expect(Math.abs((glide?.height ?? 0) - (box?.height ?? 0))).toBeLessThan(3);
    await page.mouse.move(40, 40);
    await expect(page.locator('.idx-glide')).toHaveCSS('opacity', '0');
  });

  test('the "building" status dot pings', async ({ page }) => {
    await open(page);
    const name = await page
      .locator('.index__status[data-status-dot="building"]')
      .first()
      .evaluate((e) => getComputedStyle(e, '::before').animationName);
    expect(name).toBe('idx-ping');
  });

  test('on first view the scan line sweeps and the filter counts run up to the real numbers', async ({
    page,
  }) => {
    await open(page);
    const total = await rowsVisible(page).count();
    await toTable(page);
    await page.evaluate(() =>
      document.querySelector('[data-index-table]')?.scrollIntoView({ block: 'center' }),
    );
    await expect(page.locator('.index__table[data-reveal="in"]')).toBeAttached();
    await expect(page.locator('.idx-scan').first()).toBeAttached();
    await expect(page.locator('.index__filter[data-filter="all"] .index__count')).toHaveText(
      String(total),
      {
        timeout: 4000,
      },
    );
  });

  test('changing the filter re-flows the rows with animation and ends in the right state', async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() =>
      document.querySelector('[data-index-table]')?.scrollIntoView({ block: 'center' }),
    );
    await page.waitForTimeout(1600);
    const all = await rowsVisible(page).count();
    await page.getByRole('button', { name: /^Shipped/ }).click();
    const shipped = await rowsVisible(page).count();
    expect(shipped).toBeLessThan(all);
    // Back to everything: the rows that return slide in, so animations are running right after the click.
    await page.getByRole('button', { name: /^All/ }).click();
    const running = await page.evaluate(
      () =>
        new Promise<number>((resolve) =>
          requestAnimationFrame(() =>
            resolve(
              [...document.querySelectorAll<HTMLElement>('[data-index-table] tbody tr')].filter(
                (r) => !r.hidden && r.getAnimations().some((a) => a.playState === 'running'),
              ).length,
            ),
          ),
        ),
    );
    expect(running).toBeGreaterThan(0);
    expect(await rowsVisible(page).count()).toBe(all);
    await page.waitForTimeout(1500);
    // Nothing is left displaced or faded once the motion has finished.
    const stuck = await page.evaluate(
      () =>
        [...document.querySelectorAll<HTMLElement>('[data-index-table] tbody tr')].filter(
          (r) =>
            !r.hidden &&
            (getComputedStyle(r).opacity !== '1' || getComputedStyle(r).transform !== 'none'),
        ).length,
    );
    expect(stuck).toBe(0);
  });

  test('a section title decodes from noise into the real words, and keeps its name for screen readers', async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(() =>
      document.querySelector('#projects-title')?.scrollIntoView({ block: 'center' }),
    );
    await expect(page.locator('#projects-title')).toHaveAttribute('aria-label', 'All projects');
    await expect(page.locator('#projects-title')).toHaveText('All projects', { timeout: 3000 });
    await expect(page.getByRole('heading', { name: 'All projects' })).toBeVisible();
  });

  test('cards get a pointer spotlight', async ({ page }) => {
    await open(page);
    await page.locator('.service').first().scrollIntoViewIfNeeded();
    const box = await page.locator('.service').first().boundingBox();
    await page.mouse.move((box?.x ?? 0) + 60, (box?.y ?? 0) + 30);
    await expect
      .poll(() =>
        page
          .locator('.service')
          .first()
          .evaluate((e) => e.style.getPropertyValue('--sx')),
      )
      .not.toBe('');
  });

  test('reduced motion: none of it is added', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.addInitScript(() => sessionStorage.setItem('arnav:boot:v1', 'seen'));
    await page.goto('/');
    await page.mouse.move(40, 40);
    await page.waitForTimeout(5500);
    expect(await page.locator('.idx-glide').count()).toBe(0);
    expect(await page.locator('#projects-title').getAttribute('aria-label')).toBeNull();
  });
});
