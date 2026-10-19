import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const KEY = 'arnav:settings:v1';
const html = (page: Page) => page.locator('html');

const storeSettings = (page: Page, value: object) =>
  page.addInitScript(
    ([key, json]) => {
      // The ARNAV-OS boot has its own tests (landing.spec.ts); skip it here.
      sessionStorage.setItem('arnav:boot:v1', 'seen');
      // Only seed once so the test can observe its own writes after reload.
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(key, json);
        sessionStorage.setItem('seeded', '1');
      }
    },
    [KEY, JSON.stringify(value)] as const,
  );

test.describe('theme', () => {
  test('first paint uses the stored theme before any module script runs', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await storeSettings(page, { theme: 'day' });
    // Block bundled scripts: only the inline head script can set the theme.
    await page.route('**/_astro/*.js', (route) => route.abort());
    await page.goto('/design/');
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe('rgb(245, 244, 240)');
  });

  test('Auto follows the OS colour scheme, live', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/design/');
    await expect(html(page)).toHaveAttribute('data-theme', 'night');
    await page.emulateMedia({ colorScheme: 'light' });
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
  });

  test('D toggles the theme, but not while typing or with Shift', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/design/');
    await expect(html(page)).toHaveAttribute('data-theme', 'night');

    await page.keyboard.press('d');
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
    await page.keyboard.press('Shift+D');
    await expect(html(page)).toHaveAttribute('data-theme', 'day');

    const input = page.getByTestId('typing-test');
    await input.fill('');
    await input.press('d');
    await expect(input).toHaveValue('d');
    await expect(html(page)).toHaveAttribute('data-theme', 'day');

    // D sets an explicit theme, so it survives a reload.
    await page.reload();
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
  });
});

test.describe('settings panel', () => {
  test('opens by keyboard, applies and persists changes, Esc closes and returns focus', async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.goto('/design/');
    const opener = page.getByRole('button', { name: 'Settings' });
    await opener.focus();
    await page.keyboard.press('Enter');

    const dialog = page.getByRole('dialog', { name: 'Settings' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Auto' }).first()).toBeChecked();
    await expect(dialog.getByRole('switch', { name: /sound/i })).not.toBeChecked();
    await page.screenshot({ path: 'test-results/screens/settings-open-night.png' });

    const a11y = await new AxeBuilder({ page }).include('dialog').analyze();
    expect(a11y.violations).toEqual([]);

    await dialog.getByRole('radio', { name: 'Day', exact: true }).check();
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
    await dialog.getByRole('radio', { name: 'Reduced', exact: true }).check();
    await expect(html(page)).toHaveAttribute('data-motion', 'reduced');
    await dialog.getByRole('switch', { name: /sound/i }).check();

    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(opener).toBeFocused();

    await page.reload();
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
    await expect(html(page)).toHaveAttribute('data-motion', 'reduced');
    const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? '{}'), KEY);
    expect(saved).toMatchObject({ theme: 'day', motion: 'reduced', sound: true });
  });

  test('corrupt stored settings fall back to defaults', async ({ page }) => {
    await page.addInitScript((key) => localStorage.setItem(key, '{oops'), KEY);
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/design/');
    await expect(html(page)).toHaveAttribute('data-theme', 'day');
  });
});

test.describe('motion', () => {
  test('OS reduced motion is respected in Auto', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/design/');
    await expect(html(page)).toHaveAttribute('data-motion', 'reduced');
    const duration = await page
      .locator('.button')
      .first()
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(parseFloat(duration)).toBeLessThan(0.001);
  });
});

test.describe('feedback', () => {
  test('toasts are announced, pause on hover and auto-dismiss after 4 s', async ({ page }) => {
    await page.clock.install();
    await page.goto('/design/');

    await page.getByRole('button', { name: 'Success toast' }).click();
    const status = page.getByRole('status');
    await expect(status).toContainText('Message sent.');
    await expect(status.locator('.toast').first()).toHaveAttribute('data-kind', 'ok');

    await page.getByRole('button', { name: 'Error toast' }).click();
    await expect(page.getByRole('alert')).toContainText("Couldn't send.");

    await status.locator('.toast').first().hover();
    await page.clock.runFor(6000);
    await expect(status.locator('.toast')).toHaveCount(1);
    await expect(page.getByRole('alert').locator('.toast')).toHaveCount(0);

    await page.mouse.move(0, 0);
    await page.clock.runFor(4100);
    await expect(status.locator('.toast')).toHaveCount(0);
  });

  for (const [theme, width] of [
    ['night', 1440],
    ['day', 375],
  ] as const) {
    test(`screenshot: toasts in ${theme} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 });
      await storeSettings(page, { theme });
      await page.goto('/design/');
      for (const name of ['Success toast', 'Warning toast', 'Error toast'])
        await page.getByRole('button', { name }).click();
      await expect(page.locator('.toast')).toHaveCount(3);
      await page.waitForTimeout(400); // let the 300 ms entrance finish
      await page.screenshot({ path: `test-results/screens/toasts-${theme}-${width}.png` });
    });
  }

  test('progress bar reports a real percentage and hides when done', async ({ page }) => {
    await page.goto('/design/');
    const bar = page.locator('[data-progress]');
    await expect(bar).toBeHidden();
    await page.getByRole('button', { name: 'Run progress' }).click();
    await expect(bar).toBeVisible();
    await expect(bar).toHaveAttribute('aria-valuenow', '100');
    await expect(bar).toBeHidden({ timeout: 1000 });
  });
});

test.describe('accessibility and screenshots', () => {
  for (const theme of ['night', 'day'] as const) {
    for (const path of ['/', '/design/']) {
      test(`axe: ${path} in ${theme}`, async ({ page }) => {
        await storeSettings(page, { theme });
        await page.goto(path);
        await expect(html(page)).toHaveAttribute('data-theme', theme);
        const { violations } = await new AxeBuilder({ page }).analyze();
        expect(violations).toEqual([]);
      });
    }
  }

  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`screenshot ${width}px ${theme} ${motion}`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await page.emulateMedia({
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          await storeSettings(page, { theme });
          for (const [name, path] of [
            ['home', '/'],
            ['design', '/design/'],
          ] as const) {
            await page.goto(path);
            await page.evaluate(() => document.fonts.ready);
            // Let finite reveals (name letters) finish; infinite loops (marquee, pulse) keep running.
            await page.waitForFunction(() =>
              document
                .getAnimations()
                .every(
                  (a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity,
                ),
            );
            await page.screenshot({
              path: `test-results/screens/${name}-${width}-${theme}-${motion}.png`,
              fullPage: true,
            });
          }
        });
      }
    }
  }
});
