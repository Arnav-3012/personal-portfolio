import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import freelanceContent from '../../../content/freelance.json';
import {
  COUNTS_SQL,
  DAILY_TOTAL,
  HOURLY_PER_IP,
  MAX_BODY_BYTES,
  forms,
  hashIp,
} from '../../../worker/forms';
import { makeEnv, resetDb, stubFetch } from './helpers';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const IP = '203.0.113.7';

const contact = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  message: 'Loved the site, let us talk.',
};
const freelance = {
  name: 'Asha Rao',
  email: 'asha@example.com',
  company: 'Rao & Co',
  service: freelanceContent.services[1]?.id ?? '',
  timeline: freelanceContent.timelines[0] ?? '',
  message: 'We need a chatbot over our policy documents.',
};
const notebook = {
  name: 'Asha',
  email: 'asha@example.com',
  topic: 'Collab',
  message: 'Want to build together?',
};

const post = (
  kind: string,
  body: unknown,
  testEnv: Env,
  {
    ip = IP,
    token = 'tok',
    headers = {},
  }: { ip?: string; token?: string | null; headers?: Record<string, string> } = {},
) =>
  forms.request(
    `/${kind}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers },
      body:
        typeof body === 'string'
          ? body
          : JSON.stringify(token === null ? body : { turnstile: token, ...(body as object) }),
    },
    testEnv,
  );

const rows = async () =>
  (await env.DB.prepare('SELECT * FROM submissions ORDER BY id').all<Record<string, unknown>>())
    .results;

let verify: ReturnType<typeof stubFetch>;

beforeEach(async () => {
  vi.restoreAllMocks();
  await resetDb();
  verify = stubFetch(() => Response.json({ success: true }));
});

describe('a valid submission', () => {
  it.each([
    ['contact', contact],
    ['freelance', freelance],
    ['notebook', notebook],
  ])('stores and emails a %s message', async (kind, body) => {
    const { env: e, email } = makeEnv();
    const res = await post(kind, body, e);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ ok: true });

    const [row] = await rows();
    expect(row).toMatchObject({ kind, name: body.name, email: body.email, emailed: 1 });
    expect(JSON.parse(String(row?.['fields']))).toEqual(body);

    expect(email.send).toHaveBeenCalledTimes(1);
    expect(email.send.mock.calls[0]?.[0]).toMatchObject({
      from: 'portfolio@example.test',
      to: 'inbox@example.test',
    });
  });

  it('asks Cloudflare to verify the token with the secret and the visitor IP', async () => {
    await post('contact', contact, makeEnv().env, { token: 'the-token' });
    expect(verify).toHaveBeenCalledTimes(1);
    const [url, init] = verify.mock.calls[0] ?? [];
    expect(String(url)).toBe(SITEVERIFY);
    const sent = init?.body as URLSearchParams;
    expect(Object.fromEntries(sent)).toEqual({
      secret: 'test-secret',
      response: 'the-token',
      remoteip: IP,
    });
  });

  it('trims values and drops fields the form does not have', async () => {
    const res = await post(
      'contact',
      { ...contact, name: '  Asha Rao  ', isAdmin: true, extra: 'x' },
      makeEnv().env,
    );
    expect(res.status).toBe(200);
    const [row] = await rows();
    expect(row?.['name']).toBe('Asha Rao');
    expect(JSON.parse(String(row?.['fields']))).toEqual(contact);
  });

  it('stores a salted hash of the IP, never the address', async () => {
    await post('contact', contact, makeEnv().env);
    const [row] = await rows();
    expect(row?.['ip_hash']).toBe(await hashIp(IP, 'test-secret'));
    expect(String(row?.['ip_hash'])).toMatch(/^[0-9a-f]{32}$/);
    expect(JSON.stringify(row)).not.toContain(IP);
  });
});

describe('request shape', () => {
  it('404s an unknown form kind and 405s other methods', async () => {
    const { env: e } = makeEnv();
    expect((await post('admin', contact, e)).status).toBe(404);
    expect((await forms.request('/contact', { method: 'GET' }, e)).status).toBe(405);
    expect((await forms.request('/contact', { method: 'PUT', body: '{}' }, e)).status).toBe(405);
  });

  it('rejects non-JSON content with 415', async () => {
    const res = await post('contact', 'name=a', makeEnv().env, {
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.status).toBe(415);
  });

  it('rejects bodies over the cap with 413 before verifying anything', async () => {
    const big = JSON.stringify({ ...contact, message: 'x'.repeat(MAX_BODY_BYTES) });
    const res = await post('contact', big, makeEnv().env);
    expect(res.status).toBe(413);
    expect(verify).not.toHaveBeenCalled();
  });

  it.each(['{not json', '[]', 'null', '"text"'])('rejects the body %s with 400', async (body) => {
    expect((await post('contact', body, makeEnv().env)).status).toBe(400);
  });
});

describe('honeypot', () => {
  it('answers 200 but stores, verifies and sends nothing', async () => {
    const { env: e, email } = makeEnv();
    const res = await post('contact', { ...contact, website: 'http://spam.example' }, e);
    expect(res.status).toBe(200);
    expect(await rows()).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
    expect(verify).not.toHaveBeenCalled();
  });

  it('lets an empty or blank website through', async () => {
    expect((await post('contact', { ...contact, website: '  ' }, makeEnv().env)).status).toBe(200);
  });
});

describe('validation', () => {
  it('returns 422 with a message per broken field and does not spend the Turnstile token', async () => {
    const res = await post(
      'freelance',
      { name: '', email: 'nope', message: 'short' },
      makeEnv().env,
    );
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string; fields: Record<string, string> };
    expect(body.error).toBe('invalid');
    expect(Object.keys(body.fields).toSorted()).toEqual([
      'email',
      'message',
      'name',
      'service',
      'timeline',
    ]);
    expect(verify).not.toHaveBeenCalled();
    expect(await rows()).toEqual([]);
  });

  it.each([
    ['freelance', 'service', 'not-a-service'],
    ['freelance', 'timeline', 'whenever'],
    ['notebook', 'topic', 'Spam'],
  ])('%s %s must be one of the listed options', async (kind, field, value) => {
    const base = kind === 'freelance' ? freelance : notebook;
    const res = await post(kind, { ...base, [field]: value }, makeEnv().env);
    expect(res.status).toBe(422);
    expect(((await res.json()) as { fields: Record<string, string> }).fields[field]).toBe(
      'Choose one of the options.',
    );
  });

  it('treats non-string values as empty', async () => {
    const res = await post('contact', { ...contact, message: 12345 }, makeEnv().env);
    expect(res.status).toBe(422);
  });
});

describe('Turnstile', () => {
  it('refuses a missing token with 403', async () => {
    const { env: e, email } = makeEnv();
    const res = await post('contact', contact, e, { token: null });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'turnstile' });
    expect(verify).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('refuses a token Cloudflare rejects with 403 and stores nothing', async () => {
    verify.mockImplementation(() => Promise.resolve(Response.json({ success: false })));
    const { env: e, email } = makeEnv();
    expect((await post('contact', contact, e)).status).toBe(403);
    expect(await rows()).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
  });

  it.each([
    ['siteverify is down', () => Promise.reject(new TypeError('network'))],
    ['siteverify answers 500', () => Promise.resolve(new Response('oops', { status: 500 }))],
    ['siteverify answers non-JSON', () => Promise.resolve(new Response('<html>', { status: 200 }))],
    ['siteverify answers without success', () => Promise.resolve(Response.json({ ok: 1 }))],
  ])('fails closed with 503 when %s', async (_name, impl) => {
    verify.mockImplementation(impl);
    const { env: e, email } = makeEnv();
    expect((await post('contact', contact, e)).status).toBe(503);
    expect(await rows()).toEqual([]);
    expect(email.send).not.toHaveBeenCalled();
  });

  it('fails closed with 503 when the secret is not configured', async () => {
    const { env: e } = makeEnv({ TURNSTILE_SECRET: undefined });
    const res = await post('contact', contact, e);
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ ok: false, error: 'not_configured' });
    expect(verify).not.toHaveBeenCalled();
  });
});

describe('rate limits', () => {
  it(`allows ${HOURLY_PER_IP} per connection per hour, then answers 429 with Retry-After`, async () => {
    const { env: e } = makeEnv();
    for (let i = 0; i < HOURLY_PER_IP; i++)
      expect((await post('contact', contact, e)).status).toBe(200);
    const res = await post('contact', contact, e);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect(await rows()).toHaveLength(HOURLY_PER_IP);
  });

  it('counts each connection separately', async () => {
    const { env: e } = makeEnv();
    for (let i = 0; i < HOURLY_PER_IP; i++) await post('contact', contact, e);
    expect((await post('contact', contact, e, { ip: '198.51.100.9' })).status).toBe(200);
  });

  it('forgets submissions older than an hour', async () => {
    const hash = await hashIp(IP, 'test-secret');
    for (let i = 0; i < HOURLY_PER_IP; i++)
      await env.DB.prepare(
        "INSERT INTO submissions (kind, name, email, fields, ip_hash, created_at) VALUES ('contact', 'a', 'a@b.co', '{}', ?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 hours'))",
      )
        .bind(hash)
        .run();
    expect((await post('contact', contact, makeEnv().env)).status).toBe(200);
  });

  it(`stops everyone at ${DAILY_TOTAL} submissions a day to protect the free D1 and email limits`, async () => {
    await env.DB.prepare(
      `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${DAILY_TOTAL})
       INSERT INTO submissions (kind, name, email, fields, ip_hash)
       SELECT 'contact', 'x', 'x@y.co', '{}', 'someone-else' FROM n`,
    ).run();
    const { env: e, email } = makeEnv();
    expect((await post('contact', contact, e, { ip: '198.51.100.20' })).status).toBe(429);
    expect(email.send).not.toHaveBeenCalled();
  });
});

describe('free-plan D1 reads', () => {
  it('counts recent submissions through the created_at index, never a full table scan', async () => {
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${COUNTS_SQL}`)
      .bind('any-hash')
      .all<{ detail: string }>();
    const details = plan.results.map((r) => r.detail).join(' | ');
    expect(details).toContain('submissions_created');
    expect(details).not.toMatch(/SCAN submissions(?! USING)/);
  });
});

describe('when email or storage fails', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('still answers 200 and keeps the row marked as not emailed', async () => {
    const { env: e, email } = makeEnv();
    email.send.mockRejectedValue(new Error('destination not verified'));
    expect((await post('contact', contact, e)).status).toBe(200);
    expect((await rows())[0]).toMatchObject({ emailed: 0 });
  });

  it('still answers 200 when only storage fails, because the email saved the message', async () => {
    await env.DB.prepare('DROP TABLE submissions').run();
    const { env: e, email } = makeEnv();
    expect((await post('contact', contact, e)).status).toBe(200);
    expect(email.send).toHaveBeenCalledTimes(1);
  });

  it('answers 500 only when both fail', async () => {
    await env.DB.prepare('DROP TABLE submissions').run();
    const { env: e, email } = makeEnv();
    email.send.mockRejectedValue(new Error('down'));
    const res = await post('contact', contact, e);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ ok: false, error: 'storage' });
  });
});
