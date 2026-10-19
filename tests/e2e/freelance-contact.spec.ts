import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page, type Route } from '@playwright/test';
import { readFileSync } from 'node:fs';

const read = (file: string) => JSON.parse(readFileSync(`content/${file}`, 'utf8'));
const site = read('site.json') as {
  email: string;
  turnstileSiteKey: string;
  socials: Record<string, string>;
};
const freelance = read('freelance.json') as {
  headline: string;
  confirmation: string;
  emailLine: string;
  timelines: string[];
  services: { id: string; title: string; description: string }[];
};

// Stands in for Cloudflare's script: renders nothing and hands out Cloudflare's documented dummy token, which the
// always-pass test secret the e2e Worker runs with accepts (the Worker really calls siteverify).
const DUMMY_TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const TURNSTILE_SCRIPT = 'https://challenges.cloudflare.com/turnstile/v0/api.js*';
const fakeTurnstile = `
  window.__ts = { renders: 0, resets: 0, siteKey: null, appearance: null };
  window.turnstile = {
    render(el, o) {
      window.__ts.renders++;
      window.__ts.siteKey = o.sitekey;
      window.__ts.appearance = o.appearance;
      window.__ts.cb = o.callback;
      setTimeout(() => o.callback('${DUMMY_TOKEN}'), 0);
      return 'widget-1';
    },
    reset() {
      window.__ts.resets++;
      setTimeout(() => window.__ts.cb('${DUMMY_TOKEN}'), 0);
    },
  };
`;

const open = async (
  page: Page,
  theme: 'day' | 'night' = 'night',
  turnstile: 'fake' | 'blocked' = 'fake',
) => {
  await page.addInitScript((t) => {
    sessionStorage.setItem('arnav:boot:v1', 'seen');
    localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t }));
  }, theme);
  await page.route(TURNSTILE_SCRIPT, (route) =>
    turnstile === 'blocked'
      ? route.abort('blockedbyclient')
      : route.fulfill({ contentType: 'text/javascript', body: fakeTurnstile }),
  );
  await page.goto('/');
};

declare global {
  interface Window {
    __ts?: {
      renders: number;
      resets: number;
      siteKey: string | null;
      appearance: string | null;
      cb: (token: string) => void;
    };
  }
}

const toasts = (page: Page) => page.locator('.toast__message');
const json = (status: number) => (route: Route) =>
  route.fulfill({ status, contentType: 'application/json', body: '{}' });

const fillFreelance = async (page: Page) => {
  const form = page.locator('form[data-form="freelance"]');
  await form.locator('[name=name]').fill('Asha Rao');
  await form.locator('[name=email]').fill('asha@example.com');
  await form.locator('[name=service]').selectOption('rag-assistants');
  await form.locator('[name=timeline]').selectOption('ASAP');
  await form.locator('[name=message]').fill('We need a chatbot over our policy documents.');
  return form;
};
const fillContact = async (page: Page) => {
  const form = page.locator('form[data-form="contact"]');
  await form.locator('[name=name]').fill('Asha Rao');
  await form.locator('[name=email]').fill('asha@example.com');
  await form.locator('[name=message]').fill('Loved the site, let us talk.');
  return form;
};

test.describe('open to freelance', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows the status, the four services and the email line from content', async ({ page }) => {
    await open(page);
    const section = page.locator('#freelance');
    await expect(section.locator('.free__status')).toContainText(freelance.headline);
    await expect(section.locator('.service')).toHaveCount(4);
    for (const [i, s] of freelance.services.entries()) {
      await expect(section.locator('.service').nth(i)).toContainText(s.title);
      await expect(section.locator('.service').nth(i)).toContainText(s.description);
    }
    await expect(section.locator('.free__email')).toContainText(freelance.emailLine);
    await expect(section.locator('.free__email a')).toHaveAttribute('href', `mailto:${site.email}`);
    // Dropdowns carry exactly the content's services and timelines (plus the placeholder).
    await expect(section.locator('[name=service] option:not([disabled])')).toHaveText(
      freelance.services.map((s) => s.title),
    );
    await expect(section.locator('[name=timeline] option:not([disabled])')).toHaveText(
      freelance.timelines,
    );
  });

  test('the nav status pill and the hero chip lead here', async ({ page }) => {
    await open(page);
    await page.locator('.status-pill--nav').click();
    await expect(page).toHaveURL(/#freelance$/);
    await expect(page.locator('#freelance')).toBeInViewport();
  });

  test('an empty submit shows every error, focuses the first and sends nothing', async ({
    page,
  }) => {
    let requests = 0;
    await page.route('**/api/forms/**', (route) => {
      requests++;
      return json(200)(route);
    });
    await open(page);
    const form = page.locator('form[data-form="freelance"]');
    await form.locator('[data-submit]').click();
    for (const name of ['name', 'email', 'service', 'timeline', 'message'])
      await expect(form.locator(`[data-error-for="${name}"]`)).toBeVisible();
    await expect(form.locator('[data-error-for=company]')).toBeHidden();
    await expect(form.locator('[name=name]')).toBeFocused();
    await expect(form.locator('[name=name]')).toHaveAttribute('aria-invalid', 'true');
    expect(requests).toBe(0);
  });

  test('errors clear once the field is fixed and the form is submitted again', async ({ page }) => {
    await page.route('**/api/forms/**', json(200));
    await open(page);
    const form = page.locator('form[data-form="freelance"]');
    await form.locator('[data-submit]').click();
    await fillFreelance(page);
    await form.locator('[name=email]').fill('not-an-email');
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-error-for=email]')).toHaveText('Enter a valid email address.');
    await expect(form.locator('[data-error-for=name]')).toBeHidden();
    await form.locator('[name=email]').fill('asha@example.com');
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-error-for=email]')).toBeHidden();
    await expect(form.locator('[name=email]')).not.toHaveAttribute('aria-invalid', 'true');
  });

  test('a successful send posts the fields, confirms, and clears the form', async ({ page }) => {
    let body: Record<string, string> = {};
    await page.route('**/api/forms/freelance', async (route) => {
      body = route.request().postDataJSON() as Record<string, string>;
      await json(200)(route);
    });
    await open(page);
    const form = await fillFreelance(page);
    await form.locator('[data-submit]').click();
    await expect(toasts(page)).toHaveText(freelance.confirmation);
    await expect(form.locator('[data-done]')).toHaveText(freelance.confirmation);
    await expect(form.locator('[name=message]')).toHaveValue('');
    expect(body).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.com',
      service: 'rag-assistants',
      timeline: 'ASAP',
      company: '',
      website: '',
    });
  });

  test('while the message is on its way a panel shows the stage, the packet travels, and it finishes beside the confirmation', async ({
    page,
  }) => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/forms/freelance', async (route) => {
      await gate;
      await json(200)(route);
    });
    await open(page);
    const form = await fillFreelance(page);
    await form.locator('[data-submit]').click();
    const panel = form.locator('.send');
    await expect(panel).toBeVisible();
    await expect(panel.locator('.send__read b')).toHaveText('Sending your message');
    await expect(panel.locator('.send__meta')).toContainText('words');
    const at = () => panel.evaluate((el) => parseFloat(el.style.getPropertyValue('--x')));
    const early = await at();
    await expect.poll(at).toBeGreaterThan(early + 0.02);
    // The packet never claims to have arrived while the request is out.
    expect(await at()).toBeLessThan(0.95);
    release();
    await expect(panel.locator('.send__read b')).toHaveText('Delivered');
    await expect(toasts(page)).toHaveText(freelance.confirmation);
    await expect(panel).toHaveCount(0, { timeout: 6000 });
  });

  test('a failed send says so in the panel too', async ({ page }) => {
    await page.route('**/api/forms/freelance', json(500));
    await open(page);
    const form = await fillFreelance(page);
    await form.locator('[data-submit]').click();
    await expect(form.locator('.send__read b')).toHaveText("Couldn't send");
    await expect(form.locator('.send')).toHaveClass(/is-fail/);
  });

  test('the button is busy while sending and a double click sends once', async ({ page }) => {
    let requests = 0;
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/api/forms/freelance', async (route) => {
      requests++;
      await gate;
      await json(200)(route);
    });
    await open(page);
    const form = await fillFreelance(page);
    const button = form.locator('[data-submit]');
    await button.click();
    await expect(button).toBeDisabled();
    await expect(button).toHaveAttribute('aria-busy', 'true');
    await expect(button).toHaveText('Sending…');
    await form.evaluate((f: HTMLFormElement) => f.requestSubmit());
    release();
    await expect(button).toBeEnabled();
    await expect(button).toHaveText('Start a project');
    expect(requests).toBe(1);
  });

  test('a real send reaches the Worker: it is verified, stored, confirmed and the form clears', async ({
    page,
  }) => {
    // No route: this goes through the real Worker, D1 and Cloudflare's siteverify.
    await open(page);
    const form = await fillFreelance(page);
    await form.locator('[data-submit]').click();
    await expect(toasts(page)).toHaveText(freelance.confirmation);
    await expect(form.locator('[data-done]')).toHaveText(freelance.confirmation);
    await expect(form.locator('[name=message]')).toHaveValue('');
  });

  test('the Turnstile script loads only when the visitor touches a form, as an interaction-only widget', async ({
    page,
  }) => {
    const asked: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('challenges.cloudflare.com')) asked.push(req.url());
    });
    await open(page);
    await page.locator('#freelance').scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    expect(asked).toEqual([]);
    await page.locator('form[data-form="freelance"] [name=name]').focus();
    await expect.poll(() => asked.length).toBe(1);
    await expect.poll(() => page.evaluate(() => window.__ts?.renders)).toBe(1);
    expect(await page.evaluate(() => window.__ts?.appearance)).toBe('interaction-only');
    // Idle, the slot takes no row: the gap above the button matches the gap between fields.
    await expect(page.locator('form[data-form="freelance"] [data-turnstile]')).toHaveCSS(
      'display',
      'contents',
    );
    expect(await page.evaluate(() => window.__ts?.siteKey)).toBe(site.turnstileSiteKey);
  });

  test('the token travels in the request and the widget is reset after each send', async ({
    page,
  }) => {
    const bodies: Record<string, string>[] = [];
    await page.route('**/api/forms/freelance', async (route) => {
      bodies.push(route.request().postDataJSON() as Record<string, string>);
      await json(200)(route);
    });
    await open(page);
    const form = await fillFreelance(page);
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-done]')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.__ts?.resets)).toBe(1);
    await fillFreelance(page);
    await form.locator('[data-submit]').click();
    await expect.poll(() => bodies.length).toBe(2);
    expect(bodies.map((b) => b['turnstile'])).toEqual([DUMMY_TOKEN, DUMMY_TOKEN]);
    await expect.poll(() => page.evaluate(() => window.__ts?.resets)).toBe(2);
  });

  test('when the bot check cannot load, the failure is honest and the text is kept', async ({
    page,
  }) => {
    let sent = 0;
    await page.route('**/api/forms/**', (route) => {
      sent++;
      return json(200)(route);
    });
    await open(page, 'night', 'blocked');
    const form = await fillFreelance(page);
    await form.locator('[data-submit]').click();
    await expect(toasts(page).first()).toContainText("bot check didn't pass");
    await expect(toasts(page).first()).toContainText(site.email);
    await expect(form.locator('[data-done]')).toBeHidden();
    await expect(form.locator('[name=message]')).toHaveValue(/chatbot/);
    await expect(form.locator('[data-submit]')).toBeEnabled();
    expect(sent).toBe(0);
  });

  test('rate limit, rejection, bot check, outage and offline each get their own message', async ({
    page,
  }) => {
    await open(page);
    const form = await fillFreelance(page);
    const send = async () => {
      await form.locator('[data-submit]').click();
      await expect(form.locator('[data-submit]')).toBeEnabled();
    };
    await page.route('**/api/forms/freelance', json(429));
    await send();
    await expect(toasts(page).last()).toContainText('Too many messages');
    await page.unroute('**/api/forms/freelance');
    await page.route('**/api/forms/freelance', json(400));
    await send();
    await expect(toasts(page).last()).toContainText("didn't go through");
    await page.unroute('**/api/forms/freelance');
    await page.route('**/api/forms/freelance', json(403));
    await send();
    await expect(toasts(page).last()).toContainText("bot check didn't pass");
    await page.unroute('**/api/forms/freelance');
    await page.route('**/api/forms/freelance', json(503));
    await send();
    await expect(toasts(page).last()).toContainText("Couldn't send that");
    await page.unroute('**/api/forms/freelance');
    await page.route('**/api/forms/freelance', (route) => route.abort('internetdisconnected'));
    await send();
    await expect(toasts(page).last()).toContainText('offline');
  });

  test('the honeypot is invisible and out of the tab order', async ({ page }) => {
    await open(page);
    const trap = page.locator('#freelance-website');
    await expect(trap).toHaveAttribute('tabindex', '-1');
    const box = await trap.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThan(0);
  });

  test('without JS the form hides and the email line stays', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(page.locator('#freelance form')).toBeHidden();
    await expect(page.locator('#freelance .free__email a')).toBeVisible();
    await expect(page.locator('#contact form')).toBeHidden();
    await expect(page.locator('#contact .contact__email')).toBeVisible();
    await ctx.close();
  });
});

test.describe('contact', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows the email and socials from site.json', async ({ page }) => {
    await open(page);
    const section = page.locator('#contact');
    await expect(section.locator('.contact__email')).toHaveText(site.email);
    await expect(section.locator('.contact__email')).toHaveAttribute(
      'href',
      `mailto:${site.email}`,
    );
    for (const [label, href] of [
      ['LinkedIn', site.socials['linkedin']],
      ['GitHub', site.socials['github']],
      ['Instagram', site.socials['instagram']],
    ] as const)
      await expect(section.getByRole('link', { name: label })).toHaveAttribute('href', href ?? '');
  });

  test('validates, then sends the three fields and confirms', async ({ page }) => {
    let body: Record<string, string> = {};
    await page.route('**/api/forms/contact', async (route) => {
      body = route.request().postDataJSON() as Record<string, string>;
      await json(200)(route);
    });
    await open(page);
    const form = page.locator('form[data-form="contact"]');
    await form.locator('[data-submit]').click();
    for (const name of ['name', 'email', 'message'])
      await expect(form.locator(`[data-error-for="${name}"]`)).toBeVisible();
    await fillContact(page);
    await form.locator('[data-submit]').click();
    await expect(form.locator('[data-done]')).toBeVisible();
    await expect(toasts(page)).toHaveText(freelance.confirmation);
    expect(body).toMatchObject({
      name: 'Asha Rao',
      email: 'asha@example.com',
      message: 'Loved the site, let us talk.',
      website: '',
    });
  });

  test('a real contact send reaches the Worker and confirms', async ({ page }) => {
    await open(page);
    const form = await fillContact(page);
    await form.locator('[data-submit]').click();
    await expect(toasts(page)).toHaveText(freelance.confirmation);
    await expect(form.locator('[name=message]')).toHaveValue('');
  });

  test('the nav Contact link lands here', async ({ page }) => {
    await open(page);
    await page.locator('[data-nav-link][href="#contact"]').first().click();
    await expect(page.locator('#contact')).toBeInViewport();
  });
});

test.describe('forms: mobile', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('fit the screen and the controls are touch-sized', async ({ page }) => {
    await open(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    for (const control of await page
      .locator('#freelance .field__control, #contact .field__control, .form [data-submit]')
      .all()) {
      await control.scrollIntoViewIfNeeded();
      const box = await control.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375);
    }
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: freelance and contact have no violations, also showing errors (${theme})`, async ({
    page,
  }) => {
    await open(page, theme);
    for (const id of ['#freelance', '#contact']) {
      const clean = await new AxeBuilder({ page }).include(id).analyze();
      expect(clean.violations, id).toEqual([]);
    }
    for (const form of await page.locator('form[data-form]').all())
      await form.locator('[data-submit]').click();
    // Submitting scrolls the forms into view, which starts the sections' 700 ms fade-in: let it finish before axe reads colours.
    await page.waitForTimeout(1200);
    for (const id of ['#freelance', '#contact']) {
      const withErrors = await new AxeBuilder({ page }).include(id).analyze();
      expect(withErrors.violations, `${id} with errors`).toEqual([]);
    }
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`freelance and contact ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          const page = await ctx.newPage();
          await open(page, theme);
          for (const id of ['freelance', 'contact']) {
            await page.locator(`#${id}`).scrollIntoViewIfNeeded();
            await page.waitForTimeout(300);
            await page.locator(`#${id}`).screenshot({
              path: info.outputPath(`${id}-${width}-${theme}-${motion}.png`),
            });
          }
          await ctx.close();
        });
      }
    }
  }
});
