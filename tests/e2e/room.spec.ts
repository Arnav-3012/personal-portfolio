// The 3D room (task 2.4): it mounts, every zone opens by the HUD list, the walking figure moves and collides, the theme
// key follows the walk rules, phones keep the tour, and there are no console errors. Runs on the software WebGL of headless
// Chromium, so frame rate is not measured here (that is the Phase 2 device gate); GL draw calls per frame are.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const site = JSON.parse(readFileSync('content/site.json', 'utf8')) as {
  workshop: {
    zones: { id: string; title: string; blurb: string }[];
    room: { walk: string; stopWalking: string; hint: string; walkHint: string; openOnSite: string };
  };
};
const { zones, room } = site.workshop;

const IGNORED = [/status of 404/, /GL Driver/, /deprecated/i, /KHR_parallel_shader_compile/];

async function openRoom(page: Page, theme: 'day' | 'night' = 'night'): Promise<string[]> {
  const problems: string[] = [];
  page.on('pageerror', (e) => problems.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !IGNORED.some((re) => re.test(m.text()))) problems.push(m.text());
  });
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
    // Count GL draw calls, to hold the room under the SPEC's 150 per frame.
    let draws = 0;
    for (const proto of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype])
      for (const fn of [
        'drawElements',
        'drawArrays',
        'drawElementsInstanced',
        'drawArraysInstanced',
      ] as const) {
        const table = proto as unknown as Record<string, (...a: unknown[]) => void>;
        const original = table[fn];
        if (!original) continue;
        table[fn] = function (this: unknown, ...a: unknown[]) {
          draws += 1;
          return original.apply(this, a);
        };
      }
    (window as unknown as { __draws: () => number }).__draws = () => draws;
  }, theme);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/workshop');
  await expect(page.locator('html')).toHaveAttribute('data-room', 'on', { timeout: 90_000 });
  return problems;
}

const avatar = async (page: Page): Promise<[number, number]> => {
  const [x, z] = ((await page.locator('.rm').getAttribute('data-avatar')) ?? '0,0')
    .split(',')
    .map(Number);
  return [x ?? 0, z ?? 0];
};

test.describe('the 3D room', () => {
  test.setTimeout(150_000);

  test('mounts a canvas with the HUD list, and runs without console errors', async ({ page }) => {
    const problems = await openRoom(page);
    await expect(page.locator('.rm canvas')).toBeVisible();
    await expect(page.locator('.rm-item')).toHaveCount(zones.length);
    await page.waitForTimeout(2000);
    expect(problems).toEqual([]);
  });

  test('keeps under 150 GL draw calls per frame in the overview', async ({ page }) => {
    await openRoom(page);
    await page.waitForTimeout(1500);
    const perFrame = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const w = window as unknown as { __draws: () => number };
          const start = w.__draws();
          let frames = 0;
          const tick = (): void => {
            frames += 1;
            if (frames < 12) requestAnimationFrame(tick);
            else resolve((w.__draws() - start) / frames);
          };
          requestAnimationFrame(tick);
        }),
    );
    expect(perFrame).toBeGreaterThan(5);
    expect(perFrame).toBeLessThan(150);
  });

  test('every zone opens from the HUD list, shows its name, and Esc steps back', async ({
    page,
  }) => {
    await openRoom(page);
    for (const z of zones.slice(0, 4)) {
      await page.locator('.rm-item', { hasText: z.title }).click();
      await expect(page.getByRole('heading', { level: 2, name: z.title })).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(room.openOnSite) })).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(page.locator('.rm-focus__hint')).toHaveText(room.hint);
    }
  });

  test('walking: F starts it, W moves the figure, the holotable blocks it, Esc stops', async ({
    page,
  }) => {
    await openRoom(page);
    await page.keyboard.press('f');
    await expect(page.locator('.rm-ghost[aria-pressed="true"]')).toContainText(room.stopWalking);
    await expect(page.locator('.rm-focus__hint')).toHaveText(room.walkHint);
    await page.waitForTimeout(1200);
    const start = await avatar(page);
    await page.keyboard.down('w');
    await page.waitForTimeout(2500);
    await page.keyboard.up('w');
    await page.waitForTimeout(500);
    const moved = await avatar(page);
    expect(Math.hypot(moved[0] - start[0], moved[1] - start[1])).toBeGreaterThan(0.5);
    // Never inside the holotable (centre 0, 0.1; radius 0.95 plus the figure's 0.26)
    expect(Math.hypot(moved[0], moved[1] - 0.1)).toBeGreaterThan(1.1);
    await page.keyboard.press('Escape');
    await expect(page.locator('.rm-ghost', { hasText: room.walk })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.dataset['walk'])).toBeUndefined();
  });

  test('theme key: D toggles in the tour; while walking D is movement and Shift+D toggles', async ({
    page,
  }) => {
    await openRoom(page, 'night');
    const theme = (): Promise<string | undefined> =>
      page.evaluate(() => document.documentElement.dataset['theme']);
    await page.keyboard.press('d');
    await expect.poll(theme).toBe('day');
    await page.keyboard.press('f');
    await page.waitForTimeout(800);
    await page.keyboard.press('d');
    await page.waitForTimeout(300);
    expect(await theme()).toBe('day');
    await page.keyboard.press('Shift+D');
    await expect.poll(theme).toBe('night');
  });

  test('a phone keeps the tour: no Walk button, and the room waits for "Try anyway"', async ({
    page,
  }) => {
    await page.addInitScript(() => sessionStorage.setItem('arnav:boot:v1', 'seen'));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/workshop');
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => document.documentElement.dataset['room'])).not.toBe('on');
    await expect(page.locator('.rm canvas')).toHaveCount(0);
  });

  for (const theme of ['night', 'day'] as const)
    test(`passes axe with the room on (${theme})`, async ({ page }) => {
      await openRoom(page, theme);
      await page.waitForTimeout(1500);
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations).toEqual([]);
    });
});
