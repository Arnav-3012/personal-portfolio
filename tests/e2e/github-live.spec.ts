import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';

// A year of contributions ending on Sunday 2026-10-18: 53 weeks, the last holding only that Sunday, as GitHub returns it.
const fixture = () => {
  const weeks: { date: string; count: number; level: number }[][] = [];
  const start = Date.UTC(2025, 9, 19);
  for (let w = 0; w < 53; w++) {
    const week: { date: string; count: number; level: number }[] = [];
    for (let d = 0; d < 7; d++) {
      const t = start + (w * 7 + d) * 86_400_000;
      if (t > Date.UTC(2026, 9, 18)) break;
      const level = (w * 7 + d) % 5;
      week.push({ date: new Date(t).toISOString().slice(0, 10), count: level * 2, level });
    }
    weeks.push(week);
  }
  return {
    updatedAt: '2026-10-18T06:00:00Z',
    total: weeks.flat().reduce((n, d) => n + d.count, 0),
    weeks,
    repos: [
      ['firewatch', 'Wildfire detection', 'Python', 3],
      ['agentgate', 'Agent gateway', 'TypeScript', 0],
      ['statcalib', 'Calibration toolkit', 'Python', 1],
      ['edith', null, null, 0],
    ].map(([name, description, language, stars]) => ({
      name,
      description,
      language,
      stars,
      url: `https://github.com/Arnav-3012/${name}`,
      pushedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    })),
  };
};

const ok = (data: unknown) => (route: Route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.goto('/');
};
const section = (page: Page) => page.locator('#github');
const toSection = (page: Page) => section(page).scrollIntoViewIfNeeded();

test.describe('github live', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('fetches nothing until the section is near the viewport', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/api/github')) requests.push(r.url());
    });
    await page.route('**/api/github', ok(fixture()));
    await open(page);
    await page.waitForTimeout(700);
    expect(requests).toEqual([]);
    await expect(section(page)).toHaveAttribute('data-state', 'idle');
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'ready');
    expect(requests).toHaveLength(1);
  });

  test('shows a skeleton while loading, then the data', async ({ page }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/github', async (route) => {
      await gate;
      await ok(fixture())(route);
    });
    await open(page);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'loading');
    await expect(section(page).locator('.gh__skeleton')).toBeVisible();
    await expect(section(page).locator('.gh__ready')).toBeHidden();
    release();
    await expect(section(page)).toHaveAttribute('data-state', 'ready');
    await expect(section(page).locator('.gh__skeleton')).toBeHidden();
  });

  test('draws every day in the right cell, in fill order, with a total and months', async ({
    page,
  }) => {
    const data = fixture();
    await page.route('**/api/github', ok(data));
    await open(page);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'ready');
    const cells = section(page).locator('.gh__cell');
    await expect(cells).toHaveCount(data.weeks.flat().length);
    await expect(section(page).locator('[data-gh-total]')).toHaveText(
      `${data.total.toLocaleString('en-GB')} contributions in the last year`,
    );
    // 2026-10-18 is a Sunday in the last of 53 weeks: row 1, column 53, level 2 (index 364 % 5 = 4 → check level below).
    const sunday = section(page).locator('.gh__cell[title$="2026-10-18"]');
    await expect(sunday).toHaveCSS('grid-row-start', '1');
    await expect(sunday).toHaveCSS('grid-column-start', '53');
    const last = data.weeks.flat().at(-1);
    await expect(sunday).toHaveAttribute('data-level', String(last?.level));
    // A Saturday sits on row 7.
    await expect(section(page).locator('.gh__cell[title$="2026-10-17"]')).toHaveCSS(
      'grid-row-start',
      '7',
    );
    // Delays rise from 0 to the 1.2 s budget in DOM order.
    const delays = await cells.evaluateAll((els) =>
      els.map((el) => Number.parseFloat((el as HTMLElement).style.getPropertyValue('--d'))),
    );
    expect(delays[0]).toBe(0);
    expect(delays.at(-1)).toBe(1200);
    expect(delays).toEqual(delays.toSorted((a, b) => a - b));
    const months = await section(page).locator('.gh__month').allTextContents();
    expect(months.length).toBeGreaterThan(8);
    expect(new Set(months).size).toBe(months.length - (months.at(0) === months.at(-1) ? 1 : 0));
    await expect(section(page).locator('.gh__month').first()).toHaveText('Nov');
  });

  test('lists the four repos with links, meta and a fallback description', async ({ page }) => {
    const data = fixture();
    await page.route('**/api/github', ok(data));
    await open(page);
    await toSection(page);
    const repos = section(page).locator('.gh__repo');
    await expect(repos).toHaveCount(4);
    await expect(repos.nth(0).locator('a')).toHaveAttribute(
      'href',
      'https://github.com/Arnav-3012/firewatch',
    );
    await expect(repos.nth(0)).toContainText('Wildfire detection');
    await expect(repos.nth(0)).toContainText('Python · ★ 3 · pushed 3d ago');
    await expect(repos.nth(3)).toContainText('No description yet.');
    await expect(repos.nth(3).locator('.gh__repo-meta')).toHaveText('pushed 3d ago');
  });

  test('falls back to a profile link when the endpoint is missing (before task 1.7)', async ({
    page,
  }) => {
    // No route: the real Worker answers /api/github with its JSON 404.
    await open(page);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'error');
    await expect(section(page).locator('.gh__fallback')).toBeVisible();
    await expect(section(page).locator('.gh__fallback a')).toHaveAttribute(
      'href',
      /github\.com\/Arnav-3012$/,
    );
    await expect(section(page).locator('.gh__skeleton')).toBeHidden();
    await expect(section(page).locator('.gh__ready')).toBeHidden();
  });

  test('falls back on a malformed body and on a network error', async ({ page }) => {
    await page.route('**/api/github', ok({ weeks: 'nope' }));
    await open(page);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'error');
    const other = await page.context().newPage();
    await other.route('**/api/github', (route) => route.abort('internetdisconnected'));
    await open(other);
    await toSection(other);
    await expect(section(other)).toHaveAttribute('data-state', 'error');
  });

  test('without JS the fallback line shows', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(section(page).locator('.gh__fallback')).toBeVisible();
    await expect(section(page).locator('.gh__skeleton')).toBeHidden();
    await ctx.close();
  });

  test('cells animate in with motion and not with reduced motion', async ({ page, browser }) => {
    await page.route('**/api/github', ok(fixture()));
    await open(page);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'ready');
    expect(
      await section(page)
        .locator('.gh__cell')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).not.toBe('none');

    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'reduce',
    });
    const calm = await ctx.newPage();
    await calm.route('**/api/github', ok(fixture()));
    await open(calm);
    await toSection(calm);
    await expect(section(calm)).toHaveAttribute('data-state', 'ready');
    expect(
      await section(calm)
        .locator('.gh__cell')
        .first()
        .evaluate((el) => getComputedStyle(el).animationName),
    ).toBe('none');
    await ctx.close();
  });
});

test.describe('github live: mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('the heatmap scrolls sideways to the newest week; the page does not', async ({ page }) => {
    await page.route('**/api/github', ok(fixture()));
    await open(page);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'ready');
    const scroller = section(page).locator('[data-gh-scroll]');
    const m = await scroller.evaluate((el) => ({
      left: el.scrollLeft,
      max: el.scrollWidth - el.clientWidth,
    }));
    expect(m.max).toBeGreaterThan(100);
    expect(m.left).toBeGreaterThanOrEqual(m.max - 2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const cols = await section(page)
      .locator('.gh__repos')
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
    expect(cols).toBe(1);
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: github live has no violations, loaded and fallback (${theme})`, async ({ page }) => {
    await open(page, theme);
    await toSection(page);
    await expect(section(page)).toHaveAttribute('data-state', 'error');
    const fallback = await new AxeBuilder({ page }).include('#github').analyze();
    expect(fallback.violations, 'fallback').toEqual([]);

    const loaded = await page.context().newPage();
    await loaded.route('**/api/github', ok(fixture()));
    await open(loaded, theme);
    await toSection(loaded);
    await expect(section(loaded)).toHaveAttribute('data-state', 'ready');
    const results = await new AxeBuilder({ page: loaded }).include('#github').analyze();
    expect(results.violations, 'loaded').toEqual([]);
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`github ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          const page = await ctx.newPage();
          await page.route('**/api/github', ok(fixture()));
          await open(page, theme);
          await toSection(page);
          await expect(section(page)).toHaveAttribute('data-state', 'ready');
          await page.waitForTimeout(1700);
          await section(page).screenshot({
            path: info.outputPath(`github-${width}-${theme}-${motion}.png`),
          });
          await ctx.close();
        });
      }
    }
  }
});
