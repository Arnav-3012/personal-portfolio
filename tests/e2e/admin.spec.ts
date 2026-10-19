import AxeBuilder from '@axe-core/playwright';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (file: string) => JSON.parse(readFileSync(`content/${file}`, 'utf8'));
const freelance = read('freelance.json') as { headline: string; bookedLabel: string };
const projects = read('projects.json') as { id: string; name: string }[];
const site = read('site.json') as { currentlyBuilding: string; email: string };

const ORIGIN = 'http://localhost:8787';
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
let ip = 10;

// The e2e Worker runs with ADMIN_DEV=1 (playwright.config.ts), which lets /admin in on localhost only.
const reset = async (request: APIRequestContext) => {
  for (const path of ['freelance', 'building'])
    await request.post(`/admin/api/${path}`, {
      headers: { origin: ORIGIN },
      data: { reset: true },
    });
};

const openLanding = async (page: Page) => {
  await page.addInitScript(() => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: 'night' }));
  });
  await page.goto('/');
  await page.mouse.move(40, 40); // /api/live is fetched at the first sign of a visitor
};

test.describe('/admin', () => {
  test.beforeEach(async ({ request }) => reset(request));
  test.afterEach(async ({ request }) => reset(request));

  test('loads, is not indexable, and passes axe in light and dark', async ({ page }) => {
    const res = await page.goto('/admin');
    expect(res?.headers()['x-robots-tag']).toBe('noindex');
    expect(res?.headers()['cache-control']).toBe('no-store');
    await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Inbox' })).toBeVisible();
    for (const scheme of ['light', 'dark'] as const) {
      await page.emulateMedia({ colorScheme: scheme });
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations, scheme).toEqual([]);
    }
  });

  test('a message sent from the site appears in the inbox and can be marked handled', async ({
    page,
    request,
  }) => {
    const unique = `Inbox check ${Date.now()}`;
    const sent = await request.post('/api/forms/contact', {
      headers: { 'cf-connecting-ip': `198.51.100.${ip++}` },
      data: {
        name: 'Asha Rao',
        email: 'asha@example.com',
        message: `${unique} <img src=x onerror=window.__pwned=1>`,
        turnstile: TOKEN,
      },
    });
    expect(sent.status()).toBe(200);

    await page.goto('/admin');
    const card = page.locator('.msg', { hasText: unique });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Asha Rao');
    await expect(card.getByRole('link', { name: 'asha@example.com' })).toHaveAttribute(
      'href',
      'mailto:asha@example.com',
    );
    // The hostile markup is shown as text and never runs.
    await expect(card).toContainText('<img src=x onerror=window.__pwned=1>');
    expect(
      await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned),
    ).toBeUndefined();
    expect(await card.locator('img').count()).toBe(0);

    await card.getByRole('button', { name: 'Mark handled' }).click();
    await expect(page.locator('.msg', { hasText: unique })).toHaveCount(0);
    await page.getByLabel('Show').selectOption('all');
    const again = page.locator('.msg', { hasText: unique });
    await expect(again).toHaveAttribute('data-handled', 'true');
    await again.getByRole('button', { name: 'Reopen' }).click();
    await page.getByLabel('Show').selectOption('open');
    await expect(page.locator('.msg', { hasText: unique })).toBeVisible();
  });

  test('closing freelance work in admin closes it on the landing, and resetting restores it', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin');
    await page.getByLabel('Status').selectOption('false');
    await page.getByLabel('Note when booked (optional)').fill('Back in March');
    await page.getByRole('button', { name: 'Save', exact: true }).first().click();
    await expect(page.locator('#status')).toContainText('Saved');
    await expect(page.locator('#free-now')).toContainText('Override on: booked (Back in March)');

    const visitor = await browser.newPage();
    await openLanding(visitor);
    const nav = visitor.locator('.nav__status .status-pill');
    await expect(nav).toContainText(freelance.bookedLabel);
    await expect(nav).toContainText('Back in March');
    await expect(nav).toHaveAttribute('data-open', 'false');
    await expect(visitor.locator('#freelance')).toHaveAttribute('data-open', 'false');
    await expect(visitor.locator('#freelance-title')).toHaveText(freelance.bookedLabel);
    await expect(visitor.locator('#freelance form[data-form="freelance"]')).toHaveCount(0);
    await expect(visitor.locator('.foot__big')).toContainText('Say hello');
    await expect(visitor.locator('.foot__big')).toHaveAttribute('href', `mailto:${site.email}`);
    await visitor.close();

    await page.getByRole('button', { name: 'Use site default' }).first().click();
    await expect(page.locator('#free-now')).toContainText('No override');
    const after = await browser.newPage();
    await openLanding(after);
    await expect(after.locator('.nav__status .status-pill')).toContainText(freelance.headline);
    await expect(after.locator('#freelance form[data-form="freelance"]')).toHaveCount(1);
    await after.close();
  });

  test('"currently building" changes the hero chip', async ({ page, browser }) => {
    const other = projects.find((p) => p.id !== site.currentlyBuilding && p.name.length < 30);
    expect(other).toBeTruthy();
    await page.goto('/admin');
    await page.getByLabel('Project').selectOption(other?.id ?? '');
    await page.locator('#build-save').click();
    await expect(page.locator('#build-now')).toContainText(other?.name ?? '');

    const visitor = await browser.newPage();
    await openLanding(visitor);
    const chip = visitor.locator('.chip', {
      has: visitor.locator('.chip__key', { hasText: 'Building' }),
    });
    await expect(chip).toContainText(other?.name ?? '');
    await visitor.close();
  });

  test('a visitor with no override sees the built page untouched', async ({ page }) => {
    await openLanding(page);
    await expect(page.locator('.nav__status .status-pill')).toContainText(freelance.headline);
    await page.waitForTimeout(1500);
    await expect(page.locator('#freelance')).toHaveAttribute('data-open', 'true');
  });

  test('/api/live is public, cached for a minute, and carries no admin data', async ({
    request,
  }) => {
    const res = await request.get('/api/live');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toContain('max-age=60');
    expect(Object.keys(await res.json()).sort()).toEqual(['building', 'freelance']);
  });

  test('another site cannot make the admin browser change anything', async ({ request }) => {
    const res = await request.post('/admin/api/freelance', {
      headers: { origin: 'https://evil.example' },
      data: { open: false, note: 'pwned' },
    });
    expect(res.status()).toBe(403);
    const live = await (await request.get('/api/live?fresh=1')).json();
    expect(live.freelance).toBeNull();
  });
});
