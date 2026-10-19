import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

const site = JSON.parse(readFileSync('content/site.json', 'utf8')) as {
  edith: { chips: string[]; placeholder: string; intro: string; nudge: string };
};

// Same stand-in for Cloudflare's script as the form specs.
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js*';
const fakeTurnstile = `
  window.turnstile = {
    render(el, o) { setTimeout(() => o.callback('XXXX.DUMMY.TOKEN.XXXX'), 0); return 'w1'; },
    reset() {},
  };
`;

const meta = (over: Record<string, unknown> = {}) => ({
  spoken: 'FireWatch spots fires on a camera and sends an alert.',
  markdown: 'FireWatch spots fires on a camera and sends an alert.',
  sources: [
    { label: 'Projects · FireWatch', url: 'https://github.com/Arnav-3012/fire-detection-model-dl' },
  ],
  tools: [],
  session: 'sess.1',
  ...over,
});
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const stream = (m: ReturnType<typeof meta>) =>
  sse('token', { t: 'FireWatch spots fires ' }) +
  sse('token', { t: 'on a camera.' }) +
  sse('meta', m);

const open = async (page: Page, theme: 'day' | 'night' = 'night') => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.route(TURNSTILE_SCRIPT, (route) =>
    route.fulfill({ contentType: 'text/javascript', body: fakeTurnstile }),
  );
  await page.goto('/');
  // The launcher appears at the first sign of a visitor (src/lib/idle.ts) and, on desktop, once the hero is scrolled past.
  await page.mouse.move(40, 40);
  await page.evaluate(() => scrollTo(0, innerHeight * 1.3));
};

/** Axe reads colours mid-fade, so wait for every finite animation (open, message reveal) to end first. */
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ),
  );

const launcher = (page: Page) => page.locator('[data-edith-launch]');
const panel = (page: Page) => page.getByRole('dialog', { name: 'EDITH' });
const ask = async (page: Page, text: string) => {
  await page.getByRole('textbox', { name: 'Ask EDITH' }).fill(text);
  await page.getByRole('textbox', { name: 'Ask EDITH' }).press('Enter');
};

/** Mocks /api/chat, recording each request body. */
const mockChat = async (
  page: Page,
  respond: (n: number) => Route extends never ? never : { status?: number; body?: string },
) => {
  const bodies: Record<string, unknown>[] = [];
  await page.route('**/api/chat', async (route) => {
    bodies.push(route.request().postDataJSON() as Record<string, unknown>);
    const r = respond(bodies.length);
    await route.fulfill({
      status: r.status ?? 200,
      contentType: r.status && r.status !== 200 ? 'application/json' : 'text/event-stream',
      body: r.body ?? '',
    });
  });
  return bodies;
};

test.describe('EDITH launcher presence', () => {
  test('a turning sphere of dots replaces the plain icon, and it is still named for assistive tech', async ({
    page,
  }) => {
    await open(page);
    await expect(launcher(page)).toBeVisible();
    await expect(launcher(page).locator('canvas.edith-orb__canvas')).toBeAttached();
    await expect(launcher(page)).toHaveAttribute('aria-label', 'Ask EDITH');
    const painted = () =>
      launcher(page)
        .locator('canvas')
        .evaluate((c: HTMLCanvasElement) => {
          const d = c.getContext('2d')?.getImageData(0, 0, c.width, c.height).data ?? [];
          let n = 0;
          for (let i = 3; i < d.length; i += 16) if ((d[i] ?? 0) > 0) n++;
          return n;
        });
    expect(await painted()).toBeGreaterThan(20);
  });

  test('it speaks once, a few seconds in: typing dots, then the line from content', async ({
    page,
  }) => {
    await page.clock.install();
    await open(page);
    await expect(launcher(page)).toBeVisible();
    await page.clock.runFor(9500);
    await expect(launcher(page)).toHaveClass(/is-nudging/);
    await page.clock.runFor(1500);
    await expect(launcher(page).locator('.edith-tip')).toHaveText(site.edith.nudge);
    await page.clock.runFor(7000);
    await expect(launcher(page)).not.toHaveClass(/is-nudging/);
    // Once per session: a reload does not nudge again.
    await page.reload();
    await page.mouse.move(40, 40);
    await page.evaluate(() => scrollTo(0, innerHeight * 1.3));
    await page.clock.runFor(12000);
    await expect(launcher(page)).not.toHaveClass(/is-nudging/);
  });
});

test.describe('EDITH widget', () => {
  test('the launcher appears after idle, opens the panel, and Esc returns focus to it', async ({
    page,
  }) => {
    await open(page);
    await expect(launcher(page)).toBeVisible();
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Ask EDITH' })).toBeFocused();
    await expect(page.getByRole('log', { name: 'Conversation with EDITH' })).toContainText(
      site.edith.intro,
    );
    for (const chip of site.edith.chips)
      await expect(page.getByRole('button', { name: chip })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel(page)).toBeHidden();
    await expect(launcher(page)).toBeFocused();
  });

  test('streams an answer with a source link, and the second question uses the session, not Turnstile', async ({
    page,
  }) => {
    await open(page);
    const bodies = await mockChat(page, () => ({ body: stream(meta()) }));
    await launcher(page).click();
    await ask(page, 'Tell me about FireWatch');
    const log = page.getByRole('log', { name: 'Conversation with EDITH' });
    await expect(log).toContainText('FireWatch spots fires on a camera and sends an alert.');
    await expect(log.getByRole('link', { name: 'Projects · FireWatch' })).toHaveAttribute(
      'href',
      /github\.com\/Arnav-3012/,
    );
    await ask(page, 'And the stack?');
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies[0]).toMatchObject({
      message: 'Tell me about FireWatch',
      turnstile: 'XXXX.DUMMY.TOKEN.XXXX',
    });
    expect(bodies[0]?.['session']).toBeUndefined();
    expect(bodies[1]).toMatchObject({ message: 'And the stack?', session: 'sess.1' });
    expect(bodies[1]?.['turnstile']).toBeUndefined();
    expect((bodies[1]?.['history'] as unknown[]).length).toBe(2);
  });

  test('a chip sends its question and the chips then go away', async ({ page }) => {
    await open(page);
    const bodies = await mockChat(page, () => ({ body: stream(meta()) }));
    await launcher(page).click();
    await page.getByRole('button', { name: site.edith.chips[1] ?? '' }).click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(bodies[0]?.['message']).toBe(site.edith.chips[1]);
    await expect(page.getByRole('button', { name: site.edith.chips[0] ?? '' })).toBeHidden();
  });

  test('a scrollTo tool call moves the page to the section and says so', async ({ page }) => {
    await open(page);
    await mockChat(page, () => ({
      body: stream(meta({ tools: [{ name: 'scrollTo', arg: 'experience' }] })),
    }));
    await launcher(page).click();
    await ask(page, 'Where has he worked?');
    await expect(page.locator('.edith__action')).toHaveText('Scrolled the page');
    await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(500);
    await expect(page.locator('#experience')).toBeInViewport({ ratio: 0.05 });
  });

  test('a freelance tool call focuses the form', async ({ page }) => {
    await open(page);
    await mockChat(page, () => ({
      body: stream(meta({ tools: [{ name: 'startFreelanceForm' }] })),
    }));
    await launcher(page).click();
    await ask(page, 'Is he free for work?');
    await expect(
      page.locator('#freelance').locator('input, textarea, select').first(),
    ).toBeFocused();
  });

  test('an "enter the workshop" tool call takes the visitor to /workshop', async ({ page }) => {
    await open(page);
    await mockChat(page, () => ({ body: stream(meta({ tools: [{ name: 'enterWorkshop' }] })) }));
    await launcher(page).click();
    await ask(page, 'Show me the workshop');
    await expect(page).toHaveURL(/\/workshop\/?$/);
  });

  test('429 shows the hourly-limit message and a warning toast, and keeps the panel usable', async ({
    page,
  }) => {
    await open(page);
    await mockChat(page, () => ({ status: 429, body: '{"ok":false,"error":"rate_limited"}' }));
    await launcher(page).click();
    await ask(page, 'One more');
    await expect(page.getByRole('log')).toContainText("You've asked a lot this hour");
    await expect(page.locator('.toast[data-kind="warn"]')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Ask EDITH' })).toBeEnabled();
  });

  test('the daily cap shows "resting" with the contact-form hint', async ({ page }) => {
    await open(page);
    await mockChat(page, () => ({
      body:
        sse('token', {
          t: 'EDITH is resting for today. Use the contact form and Arnav will reply.',
        }) +
        sse(
          'meta',
          meta({
            spoken: 'EDITH is resting for today. Use the contact form and Arnav will reply.',
            sources: [],
            resting: true,
          }),
        ),
    }));
    await launcher(page).click();
    await ask(page, 'Hello again, what is StatCalib?');
    await expect(page.locator('.toast__message')).toContainText('EDITH is resting for today');
    await expect(page.locator('.edith__status')).toHaveText('resting');
  });

  test('against the real Worker with no AI available, the failure is friendly and the input stays usable', async ({
    page,
  }) => {
    await open(page);
    await launcher(page).click();
    await ask(page, 'What is FireWatch?');
    await expect(page.getByRole('log')).toContainText("EDITH can't answer right now");
    await expect(page.locator('.toast[data-kind="error"]')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Ask EDITH' })).toBeEnabled();
  });

  test('a lost connection keeps the question in the box', async ({ page }) => {
    await open(page);
    await page.route('**/api/chat', (route) => route.abort('failed'));
    await launcher(page).click();
    await ask(page, 'Are you there?');
    await expect(page.getByRole('log')).toContainText('You look offline');
    await expect(page.getByRole('textbox', { name: 'Ask EDITH' })).toHaveValue('Are you there?');
  });

  for (const theme of ['night', 'day'] as const)
    test(`no axe violations with the panel open and a reply shown (${theme})`, async ({ page }) => {
      await open(page, theme);
      await mockChat(page, () => ({ body: stream(meta()) }));
      await launcher(page).click();
      await ask(page, 'Tell me about FireWatch');
      await expect(page.getByRole('log')).toContainText('sends an alert');
      await settled(page);
      const results = await new AxeBuilder({ page }).include('.edith').analyze();
      expect(results.violations).toEqual([]);
    });

  test('the launcher alone passes axe and the landing has no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await open(page);
    await expect(launcher(page)).toBeVisible();
    await settled(page);
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
    expect(errors.filter((e) => !/favicon|net::ERR/.test(e))).toEqual([]);
  });

  test('on a phone the panel is a modal sheet that closes with its button', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await open(page);
    await launcher(page).click();
    const box = await panel(page).boundingBox();
    // Full width of the 375 px viewport, less the scrollbar gutter.
    expect(box?.width).toBeGreaterThanOrEqual(355);
    await page.getByRole('button', { name: 'Close EDITH' }).click();
    await expect(panel(page)).toBeHidden();
  });

  test('on a phone, an action closes the sheet so the page is visible, and a toast says how to return', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await open(page);
    await mockChat(page, () => ({
      body: stream(meta({ tools: [{ name: 'scrollTo', arg: 'experience' }] })),
    }));
    await launcher(page).click();
    await ask(page, 'Where has he worked?');
    await expect(panel(page)).toBeHidden();
    await expect(page.locator('.toast__message')).toContainText('Tap Ask EDITH to keep chatting');
    await expect(launcher(page)).toBeVisible();
    // The conversation is still there when the visitor comes back.
    await launcher(page).click();
    await expect(page.getByRole('log')).toContainText('sends an alert');
  });

  test('reduced motion: the panel still opens and works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    await mockChat(page, () => ({ body: stream(meta()) }));
    await launcher(page).click();
    await ask(page, 'Tell me about FireWatch');
    await expect(page.getByRole('log')).toContainText('sends an alert');
  });
});
