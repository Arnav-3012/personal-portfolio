import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await page.mouse.move(40, 40);
  await expect(page.locator('.hero__stage a.ws-brain')).toBeAttached({ timeout: 9000 });
};

/** The middle of the skull, where the brain pops up. */
const skull = async (page: Page) => {
  const b = await page.locator('.hero__stage').boundingBox();
  return { x: (b?.x ?? 0) + (b?.width ?? 0) * 0.49, y: (b?.y ?? 0) + (b?.height ?? 0) * 0.3 };
};
const brainOpacity = (page: Page) =>
  page.locator('.ws-brain').evaluate((e) => Number(getComputedStyle(e).opacity));

test.describe('the brain', () => {
  test('pops up when the pointer comes near the head and goes away when it leaves', async ({
    page,
  }) => {
    await open(page);
    expect(await brainOpacity(page)).toBe(0);
    const { x, y } = await skull(page);
    await page.mouse.move(x - 260, y - 160);
    await page.mouse.move(x, y, { steps: 6 });
    await expect(page.locator('.hero__stage')).toHaveClass(/ws-near/);
    await expect.poll(() => brainOpacity(page)).toBeGreaterThan(0.8);
    await page.mouse.move(40, 700, { steps: 6 });
    await expect(page.locator('.hero__stage')).not.toHaveClass(/ws-near/);
    await expect.poll(() => brainOpacity(page)).toBeLessThan(0.05);
  });

  test('keyboard focus shows it too, and it is a named, focusable link (the old button is gone)', async ({
    page,
  }) => {
    await open(page);
    await expect(page.locator('.ws-hot')).toHaveCount(0);
    await page.locator('a.ws-brain').focus();
    await expect(page.locator('.hero__stage')).toHaveClass(/ws-near/);
    await expect(page.locator('a.ws-brain')).toHaveAttribute('aria-label', 'Enter the workshop');
    await expect(page.locator('a.ws-brain')).not.toHaveAttribute('aria-hidden', 'true');
  });

  test('a hand-drawn pencil arrow draws itself beside the face, with the note in a pencil font', async ({
    page,
  }) => {
    await open(page);
    expect(await page.locator('.ws-note').count()).toBe(0);
    const { x, y } = await skull(page);
    await page.mouse.move(x - 260, y - 160);
    await page.mouse.move(x, y, { steps: 6 });
    await expect(page.locator('svg.ws-note')).toBeAttached();
    await expect(page.locator('.ws-note')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('.ws-note text')).toContainText('psst');
    await expect(page.locator('.ws-note text')).toContainText('brain');
    await expect(page.locator('.ws-note .ws-line')).toHaveCount(4);
    // Mid-way the lines are only part drawn; once finished they are whole.
    await page.waitForTimeout(3600);
    const dash = await page
      .locator('.ws-note .ws-line')
      .first()
      .evaluate((e) => getComputedStyle(e).strokeDashoffset);
    expect(parseFloat(dash)).toBe(0);
    expect(
      await page.locator('.ws-note text').evaluate((e) => getComputedStyle(e).clipPath),
    ).toMatch(/^inset\(0(px)?( 0(px)?){0,3}\)$/);
    expect(await page.evaluate(() => document.fonts.check('40px "Reenie Beanie"'))).toBe(true);
    // Pointing away puts it back.
    await page.mouse.move(40, 700, { steps: 6 });
    await expect(page.locator('.hero__stage')).not.toHaveClass(/ws-near/);
    await expect
      .poll(() =>
        page
          .locator('.ws-note .ws-line')
          .first()
          .evaluate((e) => getComputedStyle(e).strokeDashoffset),
      )
      .not.toBe('0px');
  });

  for (const [vw, vh] of [
    [1440, 900],
    [1920, 1000],
    [1100, 700],
  ] as const)
    test(`the note's words stay clear of the Work corner (${vw}x${vh})`, async ({ page }) => {
      await open(page);
      await page.setViewportSize({ width: vw, height: vh });
      await page.reload();
      await page.mouse.move(40, 40);
      await expect(page.locator('.hero__stage a.ws-brain')).toBeAttached({ timeout: 9000 });
      const { x, y } = await skull(page);
      await page.mouse.move(x, y, { steps: 6 });
      await expect(page.locator('svg.ws-note')).toBeAttached();
      await page.waitForTimeout(1800);
      const words = await page.locator('.ws-note text').boundingBox();
      const work = await page.locator('.hero a[href="#work"]').first().boundingBox();
      const stage = await page.locator('.hero__stage').boundingBox();
      expect(words && work && stage).toBeTruthy();
      if (!words || !work || !stage) return;
      // Beside the face, not over it, and not touching the Work corner.
      expect(words.x).toBeLessThan(stage.x);
      const overlaps =
        words.x < work.x + work.width + 6 &&
        words.x + words.width > work.x &&
        words.y < work.y + work.height + 4 &&
        words.y + words.height > work.y;
      expect(overlaps).toBe(false);
    });

  test('is shown without hover on a touch screen', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      isMobile: true,
    });
    const page = await context.newPage();
    await page.addInitScript(() => sessionStorage.setItem('arnav:boot:v1', 'seen'));
    await page.goto('/');
    await page.touchscreen.tap(20, 300);
    await expect(page.locator('.hero__stage a.ws-brain')).toBeAttached({ timeout: 9000 });
    await expect.poll(() => brainOpacity(page)).toBeGreaterThan(0.3);
    await context.close();
  });

  for (const theme of ['night', 'day'] as const)
    test(`passes axe with the brain showing (${theme})`, async ({ page }) => {
      await open(page, theme);
      const { x, y } = await skull(page);
      await page.mouse.move(x, y, { steps: 4 });
      await expect.poll(() => brainOpacity(page)).toBeGreaterThan(0.8);
      await page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => undefined)),
        ),
      );
      const results = await new AxeBuilder({ page }).include('.hero').analyze();
      expect(results.violations).toEqual([]);
    });
});

test.describe('the entry sequence', () => {
  test('pressing the brain plays dive, globe and Mumbai, then arrives on /workshop', async ({
    page,
  }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await expect.poll(() => brainOpacity(page)).toBeGreaterThan(0.8);
    await page.mouse.click(x, y);

    const overlay = page.getByRole('dialog', { name: 'Entering the workshop' });
    await expect(overlay).toBeVisible();
    await expect(overlay.locator('canvas')).toBeVisible();
    await expect(overlay.getByRole('button', { name: 'Skip' })).toBeFocused();
    await expect(overlay.getByRole('status')).toHaveText('Entering the workshop');
    // The globe turns to India: the readout locks on Mumbai's coordinates, and the pin names the city.
    await expect(overlay.locator('.ent__hud')).toContainText('19.07° N · 72.87° E', {
      timeout: 6000,
    });
    await expect(overlay.locator('.ent__pin')).toContainText('Mumbai');
    await expect(overlay.locator('.ent__pin')).toContainText('72.87° E');
    await page.waitForURL(/\/workshop\/?$/, { timeout: 12_000 });
    await expect(page.getByRole('heading', { level: 1, name: 'The Workshop' })).toBeVisible();
  });

  test('the canvas is painted, not blank, mid-sequence', async ({ page }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await page.waitForTimeout(2300);
    const painted = await page.locator('.ent canvas').evaluate((c: HTMLCanvasElement) => {
      const px =
        c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? new Uint8ClampedArray();
      let n = 0;
      for (let i = 3; i < px.length; i += 16) if ((px[i] ?? 0) > 0) n++;
      return n;
    });
    expect(painted).toBeGreaterThan(2000);
  });

  test('Escape skips straight to /workshop', async ({ page }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await expect(page.locator('.ent')).toBeVisible();
    const t = Date.now();
    await page.keyboard.press('Escape');
    await page.waitForURL(/\/workshop\/?$/, { timeout: 3000 });
    expect(Date.now() - t).toBeLessThan(3000);
  });

  test('the Skip button and a click anywhere also skip', async ({ page }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.waitForURL(/\/workshop\/?$/, { timeout: 3000 });

    await page.goBack();
    await expect(page.locator('.ent')).toHaveCount(0);
    await expect(page.locator('.hero__stage a.ws-brain')).toBeAttached({ timeout: 9000 });
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await expect(page.locator('.ent')).toBeVisible();
    await page.mouse.click(300, 600);
    await page.waitForURL(/\/workshop\/?$/, { timeout: 3000 });
  });

  test('after skipping, /workshop rises from the page colour instead of cutting in', async ({
    page,
  }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await expect(page.locator('.ent')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForURL(/\/workshop\/?$/, { timeout: 3000 });
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-arrive'))).toBe(
      true,
    );
    await expect
      .poll(() => page.evaluate(() => getComputedStyle(document.body, '::before').opacity), {
        timeout: 4000,
      })
      .toBe('0');
  });

  test('a modifier-click is a plain link: no sequence', async ({ page }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.keyboard.down('Shift');
    await page.mouse.click(x, y);
    await page.keyboard.up('Shift');
    await page.waitForTimeout(600);
    await expect(page.locator('.ent')).toHaveCount(0);
  });

  test('reduced motion goes straight there, with no sequence', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await page.waitForURL(/\/workshop\/?$/, { timeout: 4000 });
    await expect(page.locator('.ent')).toHaveCount(0);
  });

  test('coming back with the back button never leaves the page covered', async ({ page }) => {
    await open(page);
    const { x, y } = await skull(page);
    await page.mouse.move(x, y, { steps: 4 });
    await page.mouse.click(x, y);
    await expect(page.locator('.ent')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.waitForURL(/\/workshop\/?$/, { timeout: 3000 });
    await page.goBack();
    await expect(page.locator('.hero')).toBeVisible();
    await expect(page.locator('.ent')).toHaveCount(0);
  });
});
