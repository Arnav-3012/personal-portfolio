import { expect, test } from '@playwright/test';

// The real Worker with local D1 and KV (see playwright.config.ts). Cloudflare's dummy token passes the always-pass
// test secret the e2e Worker runs with. Each test uses its own connection address so the per-IP limit is isolated.
const TOKEN = 'XXXX.DUMMY.TOKEN.XXXX';
const valid = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  message: 'A message long enough to pass.',
};
let nextIp = 10;
const post = (
  request: import('@playwright/test').APIRequestContext,
  body: unknown,
  ip = `198.51.100.${nextIp++}`,
  kind = 'contact',
) =>
  request.post(`/api/forms/${kind}`, {
    data: body,
    headers: { 'cf-connecting-ip': ip },
  });

test.describe('POST /api/forms/<kind>', () => {
  test('accepts a valid message, verified by Cloudflare, and does not cache the answer', async ({
    request,
  }) => {
    const res = await post(request, { ...valid, turnstile: TOKEN });
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(res.headers()['cache-control']).toBe('no-store');
  });

  test('refuses a request without a Turnstile token', async ({ request }) => {
    const res = await post(request, valid);
    expect(res.status()).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'turnstile' });
  });

  test('names each broken field with 422', async ({ request }) => {
    const res = await post(request, { turnstile: TOKEN, name: '', email: 'nope' });
    expect(res.status()).toBe(422);
    const body = (await res.json()) as { fields: Record<string, string> };
    expect(Object.keys(body.fields).toSorted()).toEqual(['email', 'message', 'name']);
  });

  test('answers a bot that fills the hidden field with a quiet 200', async ({ request }) => {
    const res = await post(request, { ...valid, turnstile: TOKEN, website: 'http://spam.example' });
    expect(res.status()).toBe(200);
  });

  test('rejects other methods, unknown kinds and non-JSON bodies', async ({ request }) => {
    expect((await request.get('/api/forms/contact')).status()).toBe(405);
    expect((await post(request, valid, undefined, 'admin')).status()).toBe(404);
    const text = await request.post('/api/forms/contact', {
      headers: { 'content-type': 'text/plain' },
      data: 'name=a',
    });
    expect(text.status()).toBe(415);
  });

  test('limits one connection to five messages an hour, and other connections are unaffected', async ({
    request,
  }) => {
    const ip = '203.0.113.200';
    for (let i = 0; i < 5; i++)
      expect((await post(request, { ...valid, turnstile: TOKEN }, ip)).status()).toBe(200);
    const sixth = await post(request, { ...valid, turnstile: TOKEN }, ip);
    expect(sixth.status()).toBe(429);
    expect(sixth.headers()['retry-after']).toBe('3600');
    expect((await post(request, { ...valid, turnstile: TOKEN }, '203.0.113.201')).status()).toBe(
      200,
    );
  });
});

test.describe('cached data endpoints', () => {
  test('/api/github serves the seeded cache with a public five-minute header', async ({
    request,
  }) => {
    const res = await request.get('/api/github');
    expect(res.status()).toBe(200);
    expect(res.headers()['cache-control']).toBe('public, max-age=300');
    const body = (await res.json()) as { repos: { name: string }[]; weeks: unknown[] };
    expect(body.repos.map((r) => r.name)).toEqual(['firewatch', 'agentgate', 'statcalib', 'edith']);
    expect(body.weeks).toHaveLength(53);
  });

  test('/api/weather fills itself on the first request, or says not_ready when the source is unreachable', async ({
    request,
  }) => {
    const res = await request.get('/api/weather');
    // Open-Meteo is a live service: reachable gives the data, unreachable gives the clean not_ready answer.
    expect([200, 404]).toContain(res.status());
    if (res.status() === 404) expect(await res.json()).toEqual({ ok: false, error: 'not_ready' });
    else expect(typeof (await res.json())).toBe('object');
  });
});
