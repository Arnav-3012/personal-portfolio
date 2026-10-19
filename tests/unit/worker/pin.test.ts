import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import { admin } from '../../../worker/admin';
import {
  IP_FAILS,
  MIN_PIN,
  SESSION_COOKIE,
  readCookie,
  samePin,
  signSession,
  verifySession,
} from '../../../worker/pin';
import { makeCtx, makeEnv, resetDb } from './helpers';

const ORIGIN = 'https://arnavc.in';
const PIN = 'correct horse 42';
const e = (over: Record<string, unknown> = {}) => makeEnv({ ADMIN_PIN: PIN, ...over }).env;

const req = (path: string, init: RequestInit = {}, testEnv = e()) =>
  admin.request(`${ORIGIN}${path}`, init, testEnv, makeCtx().ctx);
const login = (pin: string, testEnv = e(), ip = '1.2.3.4') =>
  req(
    '/login',
    {
      method: 'POST',
      headers: {
        origin: ORIGIN,
        'content-type': 'application/x-www-form-urlencoded',
        'cf-connecting-ip': ip,
      },
      body: new URLSearchParams({ pin }).toString(),
    },
    testEnv,
  );

describe('session cookie', () => {
  it('verifies, and refuses a wrong pin, a tampered value, an expired one and nothing', async () => {
    const now = 1_000_000;
    const good = await signSession(PIN, now + 60_000);
    expect(await verifySession(PIN, good, now)).toBe(true);
    expect(await verifySession('other pin', good, now)).toBe(false);
    expect(
      await verifySession(
        PIN,
        good.replace(/.$/, (c) => (c === '0' ? '1' : '0')),
        now,
      ),
    ).toBe(false);
    expect(await verifySession(PIN, await signSession(PIN, now - 1), now)).toBe(false);
    expect(await verifySession(PIN, undefined, now)).toBe(false);
    expect(await verifySession(PIN, 'x.y', now)).toBe(false);
  });
  it('compares pins without caring about length, and reads a cookie by name', async () => {
    expect(await samePin('abcdef', 'abcdef')).toBe(true);
    expect(await samePin('abcdef', 'abcdeg')).toBe(false);
    expect(await samePin('abcdef', 'abc')).toBe(false);
    expect(readCookie('a=1; admin_session=v.v; b=2', SESSION_COOKIE)).toBe('v.v');
  });
});

describe('/admin with a PIN', () => {
  beforeEach(async () => {
    await resetDb();
    for (const k of (await env.KV.list({ prefix: 'pin:' })).keys) await env.KV.delete(k.name);
  });

  it('answers 503 with neither Access nor a PIN, and with a PIN that is too short', async () => {
    expect((await req('/', {}, e({ ADMIN_PIN: undefined }))).status).toBe(503);
    expect((await req('/login', {}, e({ ADMIN_PIN: 'x'.repeat(MIN_PIN - 1) }))).status).toBe(503);
  });

  it('sends a visitor with no session to the PIN screen, and the API says 401', async () => {
    const page = await req('/');
    expect(page.status).toBe(302);
    expect(page.headers.get('location')).toBe('/admin/login');
    expect((await req('/api/inbox')).status).toBe(401);
    expect((await req('/login')).status).toBe(200);
  });

  it('a wrong PIN is refused; the right one sets a cookie that opens the admin', async () => {
    const bad = await login('wrong');
    expect(bad.status).toBe(401);
    expect(await bad.text()).toContain('Wrong PIN');
    const ok = await login(PIN);
    expect(ok.status).toBe(303);
    const cookie = ok.headers.get('set-cookie') ?? '';
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(cookie).toMatch(/Secure/);
    const value = cookie.split(';')[0] ?? '';
    const inside = await req('/api/inbox', { headers: { cookie: value } });
    expect(inside.status).toBe(200);
  });

  it("accepts the browser's own form post (Origin: null, Sec-Fetch-Site: same-origin), and refuses cross-site ones", async () => {
    const post = (extra: Record<string, string>) =>
      req('/login', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', ...extra },
        body: `pin=${encodeURIComponent(PIN)}`,
      });
    expect((await post({ origin: 'null', 'sec-fetch-site': 'same-origin' })).status).toBe(303);
    expect((await post({ origin: 'null', 'sec-fetch-site': 'cross-site' })).status).toBe(403);
    // A browser or extension that strips both headers is not evidence of another site.
    expect((await post({})).status).toBe(303);
    const refused = await post({ origin: 'https://evil.example' });
    expect(refused.status).toBe(403);
    expect(await refused.text()).toContain('origin: https://evil.example');
  });

  it('refuses a login from another site', async () => {
    const res = await req('/login', {
      method: 'POST',
      headers: {
        origin: 'https://evil.example',
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: `pin=${PIN}`,
    });
    expect(res.status).toBe(403);
  });

  it('locks a connection after too many wrong tries, even for the right PIN', async () => {
    for (let i = 0; i < IP_FAILS; i++) expect((await login('nope')).status).toBe(401);
    const locked = await login(PIN);
    expect(locked.status).toBe(429);
    expect(locked.headers.get('retry-after')).toBe('900');
    // Another connection is not locked by it.
    expect((await login(PIN, e(), '9.9.9.9')).status).toBe(303);
  });
});
