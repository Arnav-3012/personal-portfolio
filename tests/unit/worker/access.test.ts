import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetAccessCache, verifyAccess } from '../../../worker/access';

const TEAM = 'arnav.cloudflareaccess.com';
const AUD = 'aud-tag-123';
const EMAIL = 'arnav@example.com';
const NOW = 1_800_000_000_000;

let pair: CryptoKeyPair;
let otherPair: CryptoKeyPair;
let publicJwk: JsonWebKey;

const gen = () =>
  crypto.subtle.generateKey(
    {
      name: 'RSASSA-PKCS1-v1_5',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['sign', 'verify'],
  ) as Promise<CryptoKeyPair>;
const b64 = (data: string | ArrayBuffer): string => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

async function sign(
  claims: Record<string, unknown>,
  { key = pair.privateKey, header = { alg: 'RS256', kid: 'k1' } as Record<string, unknown> } = {},
): Promise<string> {
  const signingInput = `${b64(JSON.stringify(header))}.${b64(JSON.stringify(claims))}`;
  const sig = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64(sig)}`;
}

const good = (over: Record<string, unknown> = {}) => ({
  iss: `https://${TEAM}`,
  aud: [AUD],
  email: EMAIL,
  exp: Math.floor(NOW / 1000) + 600,
  ...over,
});

const env = (over: Record<string, unknown> = {}): Env =>
  ({ ACCESS_TEAM_DOMAIN: TEAM, ACCESS_AUD: AUD, ADMIN_EMAILS: EMAIL, ...over }) as unknown as Env;

const req = (token?: string, url = 'https://arnavc.in/admin') =>
  new Request(url, token ? { headers: { 'cf-access-jwt-assertion': token } } : {});

let keys: Map<string, CryptoKey>;
const check = (token: string | undefined, e = env(), now = NOW) =>
  verifyAccess(req(token), e, { keys, now: () => now });

beforeAll(async () => {
  pair = await gen();
  otherPair = await gen();
  publicJwk = (await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey;
});
beforeEach(() => {
  keys = new Map([['k1', pair.publicKey]]);
  resetAccessCache();
});

describe('verifyAccess', () => {
  it('accepts a correctly signed, current token for an allowed email', async () => {
    expect(await check(await sign(good()))).toEqual({ ok: true, email: EMAIL });
  });

  it('accepts a string audience and is case-insensitive about the email', async () => {
    const t = await sign(good({ aud: AUD, email: 'Arnav@Example.com' }));
    expect(await check(t)).toEqual({ ok: true, email: EMAIL });
  });

  it('accepts either of several allowed emails', async () => {
    const t = await sign(good({ email: 'second@example.com' }));
    expect(await check(t, env({ ADMIN_EMAILS: ` ${EMAIL} , second@example.com ` }))).toMatchObject({
      ok: true,
    });
  });

  it('says "missing" with no header', async () => {
    expect(await check(undefined)).toEqual({ ok: false, reason: 'missing' });
  });

  it.each([
    ['a wrong audience', () => sign(good({ aud: ['other'] }))],
    ['a wrong issuer', () => sign(good({ iss: 'https://evil.cloudflareaccess.com' }))],
    ['an expired token', () => sign(good({ exp: Math.floor(NOW / 1000) - 120 }))],
    ['a token not valid yet', () => sign(good({ nbf: Math.floor(NOW / 1000) + 600 }))],
    ['an email that is not allowed', () => sign(good({ email: 'intruder@example.com' }))],
    ['no email claim', () => sign(good({ email: undefined }))],
    ['no exp claim', () => sign(good({ exp: undefined }))],
    ['a signature from another key', () => sign(good(), { key: otherPair.privateKey })],
    ['alg none', () => sign(good(), { header: { alg: 'none', kid: 'k1' } })],
    ['alg HS256', () => sign(good(), { header: { alg: 'HS256', kid: 'k1' } })],
    ['no kid', () => sign(good(), { header: { alg: 'RS256' } })],
    ['an unknown kid', () => sign(good(), { header: { alg: 'RS256', kid: 'nope' } })],
    ['garbage', () => Promise.resolve('not.a.jwt')],
    ['two parts', () => Promise.resolve('a.b')],
  ])('rejects %s', async (_name, make) => {
    expect(await check(await make())).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects a payload edited after signing', async () => {
    const [h, , s] = (await sign(good())).split('.');
    const forged = `${h}.${b64(JSON.stringify(good({ email: 'intruder@example.com' })))}.${s}`;
    expect(await check(forged, env({ ADMIN_EMAILS: 'intruder@example.com' }))).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('allows 30 s of clock skew on expiry, not more', async () => {
    const t = await sign(good({ exp: Math.floor(NOW / 1000) - 20 }));
    expect(await check(t)).toMatchObject({ ok: true });
    const old = await sign(good({ exp: Math.floor(NOW / 1000) - 40 }));
    expect(await check(old)).toMatchObject({ ok: false });
  });

  it.each([{ ACCESS_TEAM_DOMAIN: undefined }, { ACCESS_AUD: undefined }, { ADMIN_EMAILS: '' }])(
    'fails closed as "not_configured" when %j is missing, even with a valid-looking token',
    async (over) => {
      expect(await check(await sign(good()), env(over))).toEqual({
        ok: false,
        reason: 'not_configured',
      });
    },
  );
});

describe('local development bypass', () => {
  const dev = (flag: string | undefined, url: string) =>
    verifyAccess(req(undefined, url), env({ ADMIN_DEV: flag, ACCESS_TEAM_DOMAIN: undefined }), {
      keys,
    });

  it('needs the flag and a loopback host together', async () => {
    expect(await dev('1', 'http://localhost:8787/admin')).toEqual({
      ok: true,
      email: 'dev@localhost',
    });
    expect(await dev('1', 'http://127.0.0.1:8787/admin')).toMatchObject({ ok: true });
    expect(await dev(undefined, 'http://localhost:8787/admin')).toMatchObject({ ok: false });
    expect(await dev('0', 'http://localhost:8787/admin')).toMatchObject({ ok: false });
    expect(await dev('1', 'https://arnavc.in/admin')).toMatchObject({ ok: false });
    expect(await dev('1', 'https://localhost.evil.com/admin')).toMatchObject({ ok: false });
  });
});

describe('signing keys from the Access certs endpoint', () => {
  const certs = () =>
    Response.json({ keys: [{ ...publicJwk, kid: 'k1', alg: 'RS256', use: 'sig' }] });

  it('fetches once and caches, and verifies against the fetched key', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(certs()));
    const t = await sign(good());
    const run = () =>
      verifyAccess(req(t), env(), {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        now: () => NOW,
      });
    expect(await run()).toMatchObject({ ok: true });
    expect(await run()).toMatchObject({ ok: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(String((fetchImpl.mock.calls[0] as unknown[] | undefined)?.[0])).toBe(
      `https://${TEAM}/cdn-cgi/access/certs`,
    );
  });

  it('refetches for an unknown kid, but at most once a minute', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(certs()));
    const f = fetchImpl as unknown as typeof fetch;
    const unknown = await sign(good(), { header: { alg: 'RS256', kid: 'rotated' } });
    await verifyAccess(req(unknown), env(), { fetchImpl: f, now: () => NOW });
    await verifyAccess(req(unknown), env(), { fetchImpl: f, now: () => NOW + 10_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    await verifyAccess(req(unknown), env(), { fetchImpl: f, now: () => NOW + 61_000 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects, not throws, when the certs endpoint is down', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(new Response('no', { status: 500 })));
    const r = await verifyAccess(req(await sign(good())), env(), {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      now: () => NOW,
    });
    expect(r).toEqual({ ok: false, reason: 'invalid' });
  });
});
