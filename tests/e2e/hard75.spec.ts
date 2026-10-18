import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

type Reel = { file: string; poster: string; day: number; caption: string; featured: boolean };
const discipline = JSON.parse(readFileSync('content/discipline.json', 'utf8')) as {
  headline: string;
  subLine: string;
  reels: Reel[];
};
const { reels } = discipline;
const featuredIndex = reels.findIndex((r) => r.featured);
const label = (r: Reel) => `Day ${r.day} · ${r.caption}`;
// The player sets src from the link's absolute href, so match the file name at the end.
const endsWith = (file = '') => new RegExp(`${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);

const open = async (
  page: Page,
  { theme = 'night', sound = false }: { theme?: 'day' | 'night'; sound?: boolean } = {},
) => {
  await page.addInitScript(
    ([t, s]) => {
      sessionStorage.setItem('arnav:boot:v1', 'seen');
      localStorage.setItem('arnav:settings:v1', JSON.stringify({ theme: t, sound: s }));
    },
    [theme, sound] as const,
  );
  await page.goto('/');
};

/**
 * `wrangler dev --local` answers every request with the whole file, ignoring Range (no Accept-Ranges). Chromium
 * asks for `bytes=0-` and then stalls about 15 s before the first frame. Serving the MP4s with real 206 slices
 * makes the player tests fast and deterministic; whether production assets honour Range is checked at 1.10.
 */
const serveWithRanges = (target: Pick<Page, 'route'>) =>
  target.route('**/media/75hard/*.mp4', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop() ?? '';
    const body = readFileSync(`public/media/75hard/${name}`);
    const headers = { 'Accept-Ranges': 'bytes', 'Content-Type': 'video/mp4' };
    const range = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '');
    if (!range) return route.fulfill({ status: 200, headers, body });
    const start = Number(range[1]);
    const end = range[2] ? Number(range[2]) : body.length - 1;
    return route.fulfill({
      status: 206,
      headers: { ...headers, 'Content-Range': `bytes ${start}-${end}/${body.length}` },
      body: body.subarray(start, end + 1),
    });
  });

test.beforeEach(async ({ page }) => {
  await serveWithRanges(page);
});

const section = (page: Page) => page.locator('[data-hard]');
const cards = (page: Page) => page.locator('[data-reel-open]');
const player = (page: Page) => page.locator('dialog[data-player]');
const video = (page: Page) => page.locator('[data-player-video]');

/** Scrolls so the pinned stage is `fraction` (0 to 1) of the way through its run. */
const park = async (page: Page, fraction: number) => {
  await section(page).evaluate((el, f) => {
    const box = el.getBoundingClientRect();
    scrollTo({ top: box.top + scrollY + f * (box.height - innerHeight), behavior: 'instant' });
  }, fraction);
  await page.waitForTimeout(700);
};

const isPaused = (loc: Locator) => loc.evaluate((el) => (el as HTMLMediaElement).paused);

test.describe('75 Hard section', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('shows the headline, sub-line and five reel cards from discipline.json', async ({
    page,
  }) => {
    await open(page);
    await expect(section(page).locator('.hard__title')).toHaveText(discipline.headline);
    await expect(section(page).locator('.hard__sub')).toHaveText(discipline.subLine);
    await expect(cards(page)).toHaveCount(reels.length);
    for (const [i, r] of reels.entries()) {
      const card = cards(page).nth(i);
      await expect(card.locator('.reel__caption')).toContainText(label(r));
      await expect(card).toHaveAttribute('href', `/${r.file}`);
      const poster = card.locator('.reel__poster');
      await expect(poster).toHaveAttribute('width', '720');
      await expect(poster).toHaveAttribute('height', '1280');
      await expect(poster).toHaveAttribute('loading', 'lazy');
    }
  });

  test('nothing downloads until a card is hovered or opened', async ({ page }) => {
    const mp4s: string[] = [];
    page.on('request', (r) => r.url().endsWith('.mp4') && mp4s.push(r.url()));
    await open(page);
    await park(page, 0.9);
    expect(mp4s).toEqual([]);
  });

  /** Centre of each card as laid out (ignoring transforms) and as it is drawn now. */
  const spots = (page: Page) =>
    page.locator('.hard__slot').evaluateAll((els) =>
      els.map((el) => {
        const slot = el as HTMLElement;
        const r = slot.getBoundingClientRect();
        return {
          home: {
            x: slot.offsetLeft + slot.offsetWidth / 2,
            y: slot.offsetTop + slot.offsetHeight / 2,
          },
          now: { x: r.x + r.width / 2, y: r.y + r.height / 2 },
        };
      }),
    );
  const apart = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.hypot(a.x - b.x, a.y - b.y);

  test('the headline stays pinned; the cards gather in a ring, then spread to their own spots', async ({
    page,
  }) => {
    await open(page);
    const title = section(page).locator('.hard__title');
    const topAt = async (f: number) => {
      await park(page, f);
      return (await title.boundingBox())?.y ?? -1;
    };
    const a = await topAt(0.05);
    const b = await topAt(0.9);
    expect(Math.abs(a - b)).toBeLessThan(2);

    // Gathered: every card sits on the ring round the stage centre (720, 450), not at its resting spot.
    await park(page, 0.02);
    const ring = await spots(page);
    for (const c of ring) {
      expect(Math.abs(c.now.x - 720)).toBeLessThanOrEqual(520 + 20);
      expect(Math.abs(c.now.y - 450)).toBeLessThanOrEqual(280 + 20);
    }
    expect(ring.filter((c) => apart(c.now, c.home) > 80).length).toBeGreaterThanOrEqual(3);

    // Spread: each card has opened out to its resting spot.
    await park(page, 0.9);
    for (const c of await spots(page)) expect(apart(c.now, c.home)).toBeLessThan(40);
  });

  test('the ring revolves on its own, and holds still while a card is hovered', async ({
    page,
  }) => {
    await open(page);
    await park(page, 0.02);
    const at = async () => (await spots(page)).map((c) => c.now);
    const first = await at();
    await page.waitForTimeout(700);
    const later = await at();
    expect(later.filter((c, i) => apart(c, first[i] ?? c) > 30).length).toBeGreaterThanOrEqual(3);

    // Hover the card at the front: the whole ring holds so it can be clicked.
    const target = later[0] ?? { x: 720, y: 450 };
    await page.mouse.move(target.x, target.y);
    await page.waitForTimeout(300);
    const held = await at();
    await page.waitForTimeout(500);
    const still = await at();
    for (const [i, c] of still.entries()) expect(apart(c, held[i] ?? c)).toBeLessThan(3);
  });

  test('the cards are tilted differently and none cover the headline', async ({ page }) => {
    await open(page);
    await park(page, 0.9);
    const transforms = await page
      .locator('.hard__slot')
      .evaluateAll((els) => els.map((el) => getComputedStyle(el).transform));
    expect(new Set(transforms).size).toBe(reels.length);
    // Measure the text itself: the title element is wider than its two centred lines.
    const head = await section(page)
      .locator('.hard__title')
      .evaluate((el) => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const { x, y, width, height } = range.getBoundingClientRect();
        return { x, y, width, height };
      });
    for (const card of await cards(page).all()) {
      const box = await card.boundingBox();
      const overlaps =
        !!head &&
        !!box &&
        box.x < head.x + head.width &&
        box.x + box.width > head.x &&
        box.y < head.y + head.height &&
        box.y + box.height > head.y;
      expect(overlaps, await card.innerText()).toBe(false);
    }
  });

  test('hovering straightens the card, scales it 4% and plays its muted loop', async ({ page }) => {
    await open(page);
    await park(page, 0.9);
    const slot = page.locator('.hard__slot').nth(0);
    const card = cards(page).nth(0);
    const clip = card.locator('video');
    expect(await isPaused(clip)).toBe(true);
    await card.hover();
    await expect(card).toHaveAttribute('data-playing', '');
    expect(await isPaused(clip)).toBe(false);
    expect(await clip.evaluate((el) => (el as HTMLVideoElement).muted)).toBe(true);
    // Hover straightens the card (no rotation left) and scales it 4%.
    await expect
      .poll(() =>
        slot.evaluate((el) => {
          const t = (el as HTMLElement).style.transform;
          const num = (re: RegExp) => Number(re.exec(t)?.[1]);
          return {
            scale: num(/scale\(([-\d.]+)\)/),
            tilt:
              Math.abs(num(/rotateX\(([-\d.]+)deg/)) +
              Math.abs(num(/rotateY\(([-\d.]+)deg/)) +
              Math.abs(num(/rotateZ\(([-\d.]+)deg/)),
          };
        }),
      )
      .toEqual({ scale: 1.04, tilt: 0 });
    await page.mouse.move(5, 450);
    await expect(card).not.toHaveAttribute('data-playing', '');
    expect(await isPaused(clip)).toBe(true);
  });

  test('the cursor glow follows the pointer', async ({ page }) => {
    await open(page);
    await park(page, 0.9);
    await page.mouse.move(700, 300);
    await expect
      .poll(() =>
        section(page)
          .locator('[data-hard-stage]')
          .evaluate((el) => el.style.getPropertyValue('--mx')),
      )
      .toBe('700px');
    await page.mouse.move(900, 500);
    await expect
      .poll(() =>
        section(page)
          .locator('[data-hard-stage]')
          .evaluate((el) => el.style.getPropertyValue('--my')),
      )
      .toBe('500px');
  });
});

test.describe('reel player', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  const openReel = async (page: Page, n: number) => {
    await park(page, 0.9);
    await cards(page).nth(n).click();
    await expect(player(page)).toHaveAttribute('open', '');
  };

  test('a click opens a full-screen player on that reel and plays it', async ({ page }) => {
    await open(page);
    await openReel(page, 1);
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[1]?.file));
    await expect(page.locator('[data-player-status]')).toContainText(`Reel 2 of ${reels.length}`);
    await expect(page.locator('[data-player-status]')).toContainText(
      `Day ${reels[1]?.day} · ${reels[1]?.caption}`,
    );
    await expect.poll(() => isPaused(video(page))).toBe(false);
    const box = await player(page).boundingBox();
    expect(box?.width).toBe(1440);
    expect(box?.height).toBe(900);
    // Focus is inside the dialog, and the page behind it can't scroll.
    expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).overflow)).toBe(
      'hidden',
    );
  });

  test('shows a day N / 75 loader tied to the load, then clears it', async ({ page }) => {
    await page.route('**/media/75hard/*.mp4', async (route) => {
      await new Promise((r) => setTimeout(r, 900));
      await route.fallback();
    });
    await open(page);
    await openReel(page, 3);
    const loader = page.locator('[data-player-load]');
    await expect(loader).toBeVisible();
    await expect(page.locator('[data-player-load-label]')).toHaveText(
      /^loading reel · day \d{1,2} \/ 75$/,
    );
    await expect(loader).toBeHidden({ timeout: 10_000 });
  });

  test('arrow keys change reel and wrap at both ends', async ({ page }) => {
    await open(page);
    await openReel(page, 0);
    await page.keyboard.press('ArrowLeft');
    await expect(video(page)).toHaveAttribute('src', endsWith(reels.at(-1)?.file));
    await page.keyboard.press('ArrowRight');
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[0]?.file));
    await page.keyboard.press('ArrowRight');
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[1]?.file));
  });

  test('the prev and next buttons change reel', async ({ page }) => {
    await open(page);
    await openReel(page, 2);
    await page.locator('[data-player-next]').click();
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[3]?.file));
    await page.locator('[data-player-prev]').click();
    await page.locator('[data-player-prev]').click();
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[1]?.file));
  });

  test('a horizontal swipe changes reel; a tap pauses and resumes', async ({ page }) => {
    await open(page);
    await openReel(page, 1);
    await expect.poll(() => isPaused(video(page))).toBe(false);
    const box = await page.locator('[data-player-stage]').boundingBox();
    const cx = (box?.x ?? 0) + (box?.width ?? 0) / 2;
    const cy = (box?.y ?? 0) + (box?.height ?? 0) / 2;
    const drag = async (dx: number) => {
      await page.mouse.move(cx, cy);
      await page.mouse.down();
      await page.mouse.move(cx + dx / 2, cy);
      await page.mouse.move(cx + dx, cy);
      await page.mouse.up();
    };
    await drag(-120);
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[2]?.file));
    await drag(120);
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[1]?.file));

    await expect.poll(() => isPaused(video(page))).toBe(false);
    await page.mouse.click(cx, cy);
    await expect.poll(() => isPaused(video(page))).toBe(true);
    await expect(page.locator('[data-player-play]')).toHaveAttribute('aria-label', 'Play');
    await page.mouse.click(cx, cy);
    await expect.poll(() => isPaused(video(page))).toBe(false);
  });

  test('pausing or skipping while a reel is still starting neither restarts nor mutes it', async ({
    page,
  }) => {
    await open(page);
    await openReel(page, 0);
    // Pause straight away, while play() is still pending: it must stay paused, with sound still on.
    await page.locator('[data-player-play]').click();
    await page.waitForTimeout(1500);
    expect(await isPaused(video(page))).toBe(true);
    await expect(page.locator('[data-player-play]')).toHaveAttribute('aria-label', 'Play');
    expect(await video(page).evaluate((el) => (el as HTMLVideoElement).muted)).toBe(false);

    // Skip through several reels quickly: the last one plays, and is not muted by an aborted start.
    await page.locator('[data-player-play]').click();
    for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[3]?.file));
    expect(await isPaused(video(page))).toBe(false);
    expect(await video(page).evaluate((el) => (el as HTMLVideoElement).muted)).toBe(false);
  });

  test('mute and play/pause buttons reflect and change the state', async ({ page }) => {
    await open(page);
    await openReel(page, 0);
    await expect.poll(() => isPaused(video(page))).toBe(false);
    const mute = page.locator('[data-player-mute]');
    const start = await video(page).evaluate((el) => (el as HTMLVideoElement).muted);
    await expect(mute).toHaveAttribute('aria-pressed', String(start));
    await mute.click();
    await expect(mute).toHaveAttribute('aria-pressed', String(!start));
    expect(await video(page).evaluate((el) => (el as HTMLVideoElement).muted)).toBe(!start);
    // The mute choice carries over to the next reel.
    await page.keyboard.press('ArrowRight');
    expect(await video(page).evaluate((el) => (el as HTMLVideoElement).muted)).toBe(!start);

    const play = page.locator('[data-player-play]');
    await play.click();
    await expect.poll(() => isPaused(video(page))).toBe(true);
    await expect(play).toHaveAttribute('aria-label', 'Play');
    await play.click();
    await expect.poll(() => isPaused(video(page))).toBe(false);
    await expect(play).toHaveAttribute('aria-label', 'Pause');
  });

  test('Esc, the close button and the area around the clip all close it and return focus', async ({
    page,
  }) => {
    await open(page);
    for (const how of ['escape', 'button', 'outside'] as const) {
      await openReel(page, 2);
      if (how === 'escape') await page.keyboard.press('Escape');
      else if (how === 'button') await page.locator('[data-player-close]').click();
      else await page.mouse.click(40, 450);
      await expect(player(page)).not.toHaveAttribute('open', '');
      await expect(cards(page).nth(2)).toBeFocused();
      // The clip is released so a closed player holds no video.
      await expect(video(page)).not.toHaveAttribute('src', /.+/);
    }
  });

  test('keyboard: Enter on a focused card opens the player', async ({ page }) => {
    await open(page);
    await park(page, 0.9);
    await cards(page).nth(3).focus();
    await page.keyboard.press('Enter');
    await expect(player(page)).toHaveAttribute('open', '');
    await expect(video(page)).toHaveAttribute('src', endsWith(reels[3]?.file));
  });

  test('a broken clip shows a plain error toast, not a stuck loader', async ({ page }) => {
    await page.route('**/media/75hard/*.mp4', (route) => route.abort());
    await open(page);
    await openReel(page, 0);
    await expect(page.locator('[data-toast-region="assertive"]')).toContainText("Couldn't load");
    await expect(page.locator('[data-player-load]')).toBeHidden();
  });

  for (const theme of ['night', 'day'] as const) {
    test(`axe: the open player has no violations (${theme})`, async ({ page }) => {
      await open(page, { theme });
      await openReel(page, 0);
      const results = await new AxeBuilder({ page }).include('dialog[data-player]').analyze();
      expect(results.violations).toEqual([]);
    });
  }
});

test.describe('75 Hard on mobile', () => {
  test.use({ viewport: { width: 375, height: 800 }, hasTouch: true });

  test('cards are a swipe strip under the headline, not pinned', async ({ page }) => {
    await open(page);
    await section(page).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-hard-stage]')).toHaveCSS('position', 'relative');
    const strip = page.locator('.hard__cards');
    expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      375,
    );
    // One reachable copy of each reel.
    await expect(cards(page)).toHaveCount(reels.length);
  });

  test('a tap opens the player at full screen', async ({ page }) => {
    await open(page);
    await section(page).scrollIntoViewIfNeeded();
    await cards(page).nth(0).tap();
    await expect(player(page)).toHaveAttribute('open', '');
    const box = await player(page).boundingBox();
    expect(box?.width).toBe(375);
    const stage = await page.locator('[data-player-stage]').boundingBox();
    expect((stage?.x ?? -1) + (stage?.width ?? 0)).toBeLessThanOrEqual(375);
  });
});

test.describe('75 Hard with reduced motion', () => {
  test.use({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });

  test('the cards sit flat in a row: no pinning, tilt, drift or hover play', async ({ page }) => {
    await open(page);
    await section(page).scrollIntoViewIfNeeded();
    await expect(page.locator('[data-hard-stage]')).toHaveCSS('position', 'relative');
    await expect(page.locator('.hard__slot').first()).toHaveCSS('transform', 'none');
    for (const slot of await page.locator('.hard__slot').all())
      expect(await slot.evaluate((el) => (el as HTMLElement).style.transform)).toBe('');
    const clip = cards(page).nth(0).locator('video');
    await cards(page).nth(0).hover();
    await page.waitForTimeout(300);
    expect(await isPaused(clip)).toBe(true);
  });

  test('a click still opens the player', async ({ page }) => {
    await open(page);
    await section(page).scrollIntoViewIfNeeded();
    await cards(page).nth(1).click();
    await expect(player(page)).toHaveAttribute('open', '');
  });
});

test.describe('75 Hard without JS', () => {
  test('every card still links to its reel file', async ({ browser }) => {
    const ctx = await browser.newContext({ javaScriptEnabled: false });
    const page = await ctx.newPage();
    await page.goto('/');
    await expect(section(page).locator('.hard__title')).toHaveText(discipline.headline);
    const hrefs = await cards(page).evaluateAll((els) =>
      els.map((a) => (a as HTMLAnchorElement).getAttribute('href')),
    );
    expect(hrefs).toEqual(reels.map((r) => `/${r.file}`));
    await ctx.close();
  });
});

test.describe('proximity audio', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  type Probe = { sources: number; el: HTMLMediaElement | null; levels: number[] };
  const probe = (page: Page) =>
    page.evaluate(() => {
      const a = (window as unknown as { __audio: Probe }).__audio;
      return {
        sources: a.sources,
        src: a.el?.getAttribute('src') ?? null,
        paused: a.el?.paused ?? null,
        loop: a.el?.loop ?? null,
        peak: Math.max(0, ...a.levels),
      };
    });

  // A fake AudioContext records what gets routed; the bed itself is a real element.
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const state: Probe = { sources: 0, el: null, levels: [] };
      (window as unknown as { __audio: Probe }).__audio = state;
      class FakeContext {
        state = 'suspended';
        destination = {};
        createGain() {
          let v = 1;
          return {
            gain: {
              get value() {
                return v;
              },
              set value(x: number) {
                v = x;
                // Only the element's own level is written after it is attached (the channel gains are
                // set once, at creation), so this records the proximity gain and nothing else.
                if (state.el) state.levels.push(x);
              },
            },
            connect() {},
          };
        }
        createMediaElementSource(el: HTMLMediaElement) {
          state.sources++;
          state.el = el;
          return { connect() {} };
        }
        async resume() {
          this.state = 'running';
        }
        async suspend() {
          this.state = 'suspended';
        }
      }
      (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
    });
  });

  test('by default (Settings sound off) nothing is routed or played', async ({ page }) => {
    await open(page);
    await page.keyboard.press('Shift');
    await park(page, 0.9);
    await page.waitForTimeout(500);
    expect(await probe(page)).toMatchObject({ sources: 0, src: null });
    await expect(section(page)).not.toHaveAttribute('data-audible', '');
    await expect(page.locator('[data-live-mark]')).toBeHidden();
  });

  test('with sound on, the featured reel fades in near the section and out again', async ({
    page,
  }) => {
    await open(page, { sound: true });
    await page.keyboard.press('Shift');
    await park(page, 0.9);
    await expect(section(page)).toHaveAttribute('data-audible', '');
    await expect(page.locator('[data-live-mark]')).toBeVisible();
    const inside = await probe(page);
    expect(inside.sources).toBe(1);
    expect(inside.src).toMatch(endsWith(reels[featuredIndex]?.file));
    expect(inside.loop).toBe(true);
    expect(inside.paused).toBe(false);
    expect(inside.peak).toBeGreaterThan(0.2);
    expect(inside.peak).toBeLessThanOrEqual(0.35);

    await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
    await expect(section(page)).not.toHaveAttribute('data-audible', '');
    await expect(page.locator('[data-live-mark]')).toBeHidden();
    expect((await probe(page)).paused).toBe(true);
  });

  test('with sound on but no interaction yet, nothing plays', async ({ page }) => {
    await open(page, { sound: true });
    await park(page, 0.9);
    await page.waitForTimeout(500);
    expect((await probe(page)).sources).toBe(0);
    await expect(section(page)).not.toHaveAttribute('data-audible', '');
  });

  test('turning Settings sound off silences the bed without scrolling', async ({ page }) => {
    await open(page, { sound: true });
    await page.keyboard.press('Shift');
    await park(page, 0.9);
    await expect(section(page)).toHaveAttribute('data-audible', '');
    // The nav is hidden after scrolling down, so open Settings programmatically.
    await page.locator('[data-settings-open]').evaluate((el) => (el as HTMLElement).click());
    await page.getByRole('switch', { name: /sound/i }).click();
    await expect(section(page)).not.toHaveAttribute('data-audible', '');
  });

  test('opening the player stops the bed', async ({ page }) => {
    await open(page, { sound: true });
    await page.keyboard.press('Shift');
    await park(page, 0.9);
    await expect(section(page)).toHaveAttribute('data-audible', '');
    await cards(page).nth(0).click();
    await expect(section(page)).not.toHaveAttribute('data-audible', '');
    await page.keyboard.press('Escape');
    await expect(section(page)).toHaveAttribute('data-audible', '');
  });
});

for (const theme of ['night', 'day'] as const) {
  test(`axe: the 75 Hard section has no violations (${theme})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await open(page, { theme });
    await park(page, 0.9);
    const results = await new AxeBuilder({ page }).include('[data-hard]').analyze();
    expect(results.violations).toEqual([]);
  });
}

test.describe('screenshots', () => {
  for (const width of [375, 768, 1440]) {
    for (const theme of ['night', 'day'] as const) {
      for (const motion of ['full', 'reduced'] as const) {
        test(`75 hard ${width}px ${theme} ${motion}`, async ({ browser }, info) => {
          const ctx = await browser.newContext({
            viewport: { width, height: 900 },
            reducedMotion: motion === 'reduced' ? 'reduce' : 'no-preference',
          });
          await serveWithRanges(ctx);
          const page = await ctx.newPage();
          await open(page, { theme });
          await section(page).scrollIntoViewIfNeeded();
          // The ring (cards gathered round the headline, mid-revolve), then the spread layout once the
          // cards have opened out; wait out the card easing before each shot.
          if (width >= 768 && motion === 'full') {
            await park(page, 0.02);
            await page.waitForTimeout(600);
            await page.screenshot({
              path: info.outputPath(`hard-ring-${width}-${theme}-${motion}.png`),
            });
            await park(page, 0.9);
          }
          await page.waitForTimeout(1200);
          await page.screenshot({ path: info.outputPath(`hard-${width}-${theme}-${motion}.png`) });
          if (motion === 'full') {
            await cards(page)
              .nth(width >= 768 ? 3 : 0)
              .click();
            await expect(page.locator('[data-player-load]')).toBeHidden({ timeout: 10_000 });
            await page.waitForTimeout(500);
            await page.screenshot({
              path: info.outputPath(`player-${width}-${theme}-${motion}.png`),
            });
          }
          await ctx.close();
        });
      }
    }
  }
});
