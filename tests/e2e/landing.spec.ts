import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (file: string) => JSON.parse(readFileSync(`content/${file}`, 'utf8'));
const site = read('site.json');
const freelance = read('freelance.json');
const roles = read('experience.json') as { end: string | null; title: string; company: string }[];

const BOOT_KEY = 'arnav:boot:v1';
const html = (page: Page) => page.locator('html');
const overlay = (page: Page) => page.locator('[data-boot-overlay]');
const skipBoot = (page: Page) =>
  page.addInitScript((key) => sessionStorage.setItem(key, 'seen'), BOOT_KEY);
const setTheme = (page: Page, theme: 'day' | 'night') =>
  page.addInitScript(
    (t) => localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t })),
    theme,
  );
/** Non-transparent pixels drawn on a canvas (proves it painted). */
const paintedPixels = (page: Page, selector: string) =>
  page.locator(selector).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? [];
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 0) n++;
    return n;
  });

test.describe('ARNAV-OS boot (transformer)', () => {
  // Timer-driven tests run on a fake clock (rAF, performance.now and timers): under load, page load can
  // outlast the boot and a real-clock assertion on 'on' would race it (mistakes.md, 1.4).
  test('plays once per session and hands off to the hero', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-boot', 'on');
    await expect(overlay(page)).toBeVisible();
    await page.clock.runFor(4000);
    await expect(html(page)).not.toHaveAttribute('data-boot', /.*/);
    await expect(overlay(page)).toBeHidden();
    await page.reload();
    await expect(html(page)).not.toHaveAttribute('data-boot', /.*/);
  });

  test('draws on its canvas while running', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await page.clock.runFor(600);
    expect(await paintedPixels(page, '.boot__canvas')).toBeGreaterThan(500);
  });

  test('any key skips it', async ({ page }) => {
    await page.clock.install();
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-boot', 'on');
    await page.keyboard.press('Space');
    await expect(html(page)).toHaveAttribute('data-boot', 'skip');
    await page.clock.runFor(300);
    await expect(html(page)).not.toHaveAttribute('data-boot', /.*/);
  });

  test('is skipped with reduced motion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await expect(html(page)).not.toHaveAttribute('data-boot', /.*/);
    await expect(overlay(page)).toBeHidden();
  });

  test('never traps the page if the module script fails to load', async ({ page }) => {
    await page.clock.install();
    await page.route('**/_astro/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(html(page)).toHaveAttribute('data-boot', 'on');
    await page.clock.runFor(4600);
    await expect(html(page)).not.toHaveAttribute('data-boot', /.*/);
  });

  test('screenshots: embed, layers, decode, hand-off, then the assembled hero', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    for (const [name, wait] of [
      ['1-embed', 350],
      ['2-layers', 650],
      ['3-decode', 750],
      ['4-handoff', 450],
    ] as const) {
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `test-results/screens/boot-${name}.png` });
    }
    await page.waitForFunction(() => document.documentElement.dataset['boot'] === undefined);
    await page.waitForTimeout(1300);
    await page.screenshot({ path: 'test-results/screens/boot-5-assembled.png' });
  });
});

test.describe('nav', () => {
  test('hides on scroll down, returns on scroll up and on focus', async ({ page }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const bar = page.locator('[data-nav-bar]');
    await page.mouse.wheel(0, 600);
    await expect(bar).toHaveAttribute('data-hidden', '');
    await page.screenshot({ path: 'test-results/screens/nav-hidden-1440.png' });
    await page.mouse.wheel(0, -200);
    await expect(bar).not.toHaveAttribute('data-hidden');
    await page.mouse.wheel(0, 600);
    await expect(bar).toHaveAttribute('data-hidden', '');
    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: /Work/ })
      .focus();
    await expect(bar).toHaveCSS('transform', 'none');
  });

  test('links resolve; freelance status and the IST clock show; the section in view is marked', async ({
    page,
  }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const primary = page.getByRole('navigation', { name: 'Primary' });
    for (const name of ['Work', 'Experience', 'About', 'Contact']) {
      const href = await primary.getByRole('link', { name: new RegExp(name) }).getAttribute('href');
      await expect(page.locator(href ?? 'missing')).toHaveCount(1);
    }
    const pill = page.locator('.status-pill--nav');
    await expect(pill).toHaveAttribute('data-open', String(freelance.open));
    await expect(pill).toContainText(freelance.open ? freelance.headline : freelance.bookedLabel);
    await expect(page.locator('[data-clock]')).toHaveText(/^\w{3} \d{1,2} · \d{2}:\d{2} IST$/);
    await page.locator('#experience').scrollIntoViewIfNeeded();
    await expect(primary.getByRole('link', { name: /Experience/ })).toHaveAttribute(
      'aria-current',
      'location',
    );
  });

  test('mobile menu: opens, closes with Esc, returns focus, links close it', async ({ page }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await expect(page.getByRole('navigation', { name: 'Primary' })).toBeHidden();
    const open = page.getByRole('button', { name: 'Menu' });
    await open.click();
    const sheet = page.getByRole('dialog', { name: 'Menu' });
    await expect(sheet).toBeVisible();
    await page.screenshot({ path: 'test-results/screens/menu-open-375.png' });
    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
    await expect(open).toBeFocused();
    await open.click();
    await sheet.getByRole('link', { name: /Contact/ }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#contact$/);
  });
});

test.describe('hero', () => {
  for (const width of [375, 768, 1440]) {
    test(`layout at ${width}px: centre stage, name across the lower third, never mirrored`, async ({
      page,
    }) => {
      await skipBoot(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/');
      const stage = await page.locator('.hero__stage').boundingBox();
      const name = await page.locator('#hero-name').boundingBox();
      if (!stage || !name) throw new Error('hero not rendered');
      const centre = (b: { x: number; width: number }) => b.x + b.width / 2;
      expect(Math.abs(centre(stage) - width / 2)).toBeLessThan(2);
      expect(Math.abs(centre(name) - centre(stage))).toBeLessThan(2);
      expect(name.y).toBeGreaterThan(stage.y + stage.height * 0.55);
      for (const sel of ['.hero__media img', '.hero__dots']) {
        const transform = await page.locator(sel).evaluate((el) => getComputedStyle(el).transform);
        expect(transform === 'none' || !/matrix\(-/.test(transform)).toBe(true);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
    });
  }

  test('dot-matrix paints and the photo hides', async ({ page }) => {
    await skipBoot(page);
    await page.goto('/');
    await expect(page.locator('[data-hero]')).toHaveAttribute('data-dots', 'ready');
    await expect.poll(() => paintedPixels(page, '.hero__dots')).toBeGreaterThan(2000);
    await expect(page.locator('.hero__media img')).toHaveCSS('opacity', '0');
  });

  for (const theme of ['night', 'day'] as const)
    test(`hover pushes the dots and a fading trail reveals the photo (${theme})`, async ({
      page,
    }) => {
      await skipBoot(page);
      await setTheme(page, theme);
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto('/');
      await expect(page.locator('[data-hero]')).toHaveAttribute('data-dots', 'ready');
      const canvas = page.locator('.hero__dots');
      const box = await canvas.boundingBox();
      if (!box) throw new Error('canvas missing');
      // A patch on the cheek: dithered dots leave gaps; the revealed photo fills it completely.
      const patch = { x: box.width * 0.62, y: box.height * 0.42, size: 16 };
      const coverage = () =>
        canvas.evaluate((c: HTMLCanvasElement, p) => {
          const k = c.width / c.clientWidth;
          const s = Math.round(p.size * k);
          const d =
            c.getContext('2d')?.getImageData(Math.round(p.x * k), Math.round(p.y * k), s, s).data ??
            [];
          let n = 0;
          for (let i = 3; i < d.length; i += 4) if ((d[i] ?? 0) > 200) n++;
          return n / (s * s);
        }, patch);
      await page.waitForTimeout(1300); // assembly
      const before = await coverage();
      expect(before).toBeLessThan(0.9);
      // Sweep across the face onto the patch so the trail covers it.
      for (let i = 0; i <= 12; i++)
        await page.mouse.move(
          box.x + box.width * (0.45 + (0.17 * i) / 12),
          box.y + box.height * (0.3 + (0.12 * i) / 12),
        );
      await expect.poll(coverage).toBeGreaterThan(0.95);
      await page.screenshot({
        path: `test-results/screens/hover-${theme}.png`,
        clip: { x: box.x, y: box.y, width: box.width, height: box.height },
      });
      await page.mouse.move(5, 5);
      await expect.poll(coverage, { timeout: 4000 }).toBeLessThan(0.9);
    });

  test('without JS the masked photo and the name still show', async ({ page }) => {
    await skipBoot(page);
    await page.route('**/_astro/*.js', (route) => route.abort());
    await page.goto('/');
    await expect(page.locator('.hero__media img')).toHaveCSS('opacity', '1');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(site.name);
  });

  test('reads name, role, chips, links and quadrants from content/', async ({ page }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toHaveAccessibleName(site.name);
    await expect(page.locator('.hero__role')).toHaveText(site.roleLine);
    const role = roles.find((r) => r.end === null);
    if (!role) throw new Error('no current role in experience.json');
    await expect(page.locator('.hero__chips')).toContainText(`${role.title} at ${role.company}`);
    await expect(page.locator('.hero__chips')).toContainText('EDITH');
    await expect(page.locator('.hero__media img')).toHaveAttribute('alt', site.portrait.alt);
    for (const url of Object.values(site.socials) as string[])
      await expect(page.locator(`.hero__links a[href="${url}"]`)).toHaveCount(1);
    const quads = page.locator('.quad a');
    await expect(quads).toHaveCount(4);
    await expect(quads.nth(3)).toContainText(site.email);
    for (const [i, href] of ['#work', '#experience', '#about', '#contact'].entries())
      await expect(quads.nth(i)).toHaveAttribute('href', href);
  });

  test('quadrants sit in the four corners on desktop and a 2×2 grid on mobile', async ({
    page,
  }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const box = async (n: string) => {
      const b = await page.locator(`.quad--${n}`).boundingBox();
      if (!b) throw new Error(`quad ${n} missing`);
      return b;
    };
    const [a, b, c, d] = [await box('01'), await box('02'), await box('03'), await box('04')];
    expect(a.x).toBeLessThan(200);
    expect(b.x + b.width).toBeGreaterThan(1240);
    expect(c.y).toBeGreaterThan(a.y + 400);
    expect(d.y).toBeGreaterThan(b.y + 400);
    await page.setViewportSize({ width: 375, height: 800 });
    const cols = await page
      .locator('.hero__quads')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(2);
  });

  test('portrait is the eager, high-priority LCP image', async ({ page }) => {
    await skipBoot(page);
    await page.goto('/');
    const img = page.locator('.hero__media img');
    await expect(img).toHaveAttribute('loading', 'eager');
    await expect(img).toHaveAttribute('fetchpriority', 'high');
  });
});

test.describe('proof strip', () => {
  test('lists every proof value and pauses on hover', async ({ page }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    const list = page.locator('.proof__list:not([data-copy])');
    for (const p of site.proof) await expect(list).toContainText(p.value);
    const track = page.locator('.proof__track');
    await expect(track).toHaveCSS('animation-play-state', 'running');
    // Hover the static viewport: Playwright waits for a moving element to settle, which the track never does.
    await page.locator('.proof__viewport').hover();
    await expect(track).toHaveCSS('animation-play-state', 'paused');
  });

  test('is a static 2-column grid below 768 px', async ({ page }) => {
    await skipBoot(page);
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    await expect(page.locator('.proof__list[data-copy]')).toBeHidden();
    const cols = await page
      .locator('.proof__list:not([data-copy])')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(2);
  });
});

test.describe('accessibility', () => {
  for (const theme of ['night', 'day'] as const) {
    test(`axe: mobile menu open in ${theme}`, async ({ page }) => {
      await skipBoot(page);
      await setTheme(page, theme);
      await page.setViewportSize({ width: 375, height: 800 });
      await page.goto('/');
      await page.getByRole('button', { name: 'Menu' }).click();
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations).toEqual([]);
    });

    test(`axe: during the boot in ${theme}`, async ({ page }) => {
      await page.clock.install();
      await setTheme(page, theme);
      await page.goto('/');
      await expect(html(page)).toHaveAttribute('data-boot', 'on');
      const { violations } = await new AxeBuilder({ page }).analyze();
      expect(violations).toEqual([]);
    });
  }
});
