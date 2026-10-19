import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import projects from '../../../content/projects.json';
import site from '../../../content/site.json';
import { PAGE_SIZE, admin } from '../../../worker/admin';
import { BUILDING_KEY, FREELANCE_KEY, NOTE_MAX } from '../../../worker/live';
import { makeCtx, makeEnv, resetDb } from './helpers';

const ORIGIN = 'http://localhost';

interface InboxBody {
  rows: { id: number; emailed: number; fields: Record<string, string> }[];
  more: boolean;
  total: number;
  open: number;
}
interface StateBody {
  freelance: { default: { open: boolean }; override: unknown };
  building: { default: string; override: string | null };
  projects: unknown[];
}
const e = (over: Record<string, unknown> = {}) => makeEnv({ ADMIN_DEV: '1', ...over }).env;

const call = (
  path: string,
  {
    method = 'GET',
    body,
    headers = {},
    testEnv = e(),
  }: { method?: string; body?: unknown; headers?: Record<string, string>; testEnv?: Env } = {},
) =>
  admin.request(
    path,
    {
      method,
      headers: {
        ...(method === 'POST' ? { origin: ORIGIN, 'content-type': 'application/json' } : {}),
        ...headers,
      },
      ...(body === undefined
        ? {}
        : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    },
    testEnv,
    makeCtx().ctx,
  );

const post = (path: string, body: unknown, over: Parameters<typeof call>[1] = {}) =>
  call(path, { method: 'POST', body, ...over });

const seed = async (
  n: number,
  over: Partial<{
    kind: string;
    name: string;
    fields: string;
    handled: number;
    emailed: number;
  }> = {},
) => {
  for (let i = 1; i <= n; i++)
    await env.DB.prepare(
      'INSERT INTO submissions (kind, name, email, fields, ip_hash, handled, emailed) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    )
      .bind(
        over.kind ?? 'contact',
        over.name ?? `Person ${i}`,
        `p${i}@example.com`,
        over.fields ??
          JSON.stringify({
            name: `Person ${i}`,
            email: `p${i}@example.com`,
            message: `Hello ${i}`,
          }),
        'hash',
        over.handled ?? 0,
        over.emailed ?? 1,
      )
      .run();
};

beforeEach(async () => {
  await resetDb();
  await env.KV.delete(FREELANCE_KEY);
  await env.KV.delete(BUILDING_KEY);
});

describe('access', () => {
  it('answers 401 without a valid Access token, for the page and every API route', async () => {
    const strict = e({
      ADMIN_DEV: undefined,
      ACCESS_TEAM_DOMAIN: 't.example.com',
      ADMIN_EMAILS: 'me@example.com',
      ACCESS_AUD: 'a',
    });
    for (const [path, method] of [
      ['/', 'GET'],
      ['/api/state', 'GET'],
      ['/api/inbox', 'GET'],
      ['/api/freelance', 'POST'],
      ['/api/building', 'POST'],
      ['/api/inbox/1', 'POST'],
    ] as const) {
      const res = await call(path, {
        method,
        testEnv: strict,
        body: method === 'POST' ? {} : undefined,
      });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(res.headers.get('cache-control')).toBe('no-store');
    }
  });

  it('answers 503 when Access is not configured at all', async () => {
    const res = await call('/', { testEnv: e({ ADMIN_DEV: undefined }) });
    expect(res.status).toBe(503);
    expect(await res.text()).toContain('not configured');
  });
});

describe('the page', () => {
  it('is HTML with a per-request nonce CSP and no framing, indexing or caching', async () => {
    const a = await call('/');
    const b = await call('/');
    expect(a.status).toBe(200);
    expect(a.headers.get('content-type')).toContain('text/html');
    const csp = a.headers.get('content-security-policy') ?? '';
    const nonce = /script-src 'nonce-([^']+)'/.exec(csp)?.[1] ?? '';
    expect(nonce.length).toBeGreaterThan(10);
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(a.headers.get('x-frame-options')).toBe('DENY');
    expect(a.headers.get('x-robots-tag')).toBe('noindex');
    expect(a.headers.get('cache-control')).toBe('no-store');
    const html = await a.text();
    expect(html).toContain(`<script nonce="${nonce}">`);
    expect(b.headers.get('content-security-policy')).not.toBe(csp);
  });

  it('writes visitor text only with textContent, never innerHTML or inline handlers', async () => {
    const html = await (await call('/')).text();
    expect(html).not.toMatch(/innerHTML|insertAdjacentHTML|document\.write|outerHTML/);
    expect(html).not.toMatch(/\son[a-z]+=/i);
  });
});

describe('same-origin protection', () => {
  it('refuses a POST with no Origin or another site’s Origin', async () => {
    expect(
      (await post('/api/freelance', { reset: true }, { headers: { origin: '' } })).status,
    ).toBe(403);
    expect(
      (
        await post(
          '/api/freelance',
          { reset: true },
          { headers: { origin: 'https://evil.example' } },
        )
      ).status,
    ).toBe(403);
    expect(await env.KV.get(FREELANCE_KEY)).toBeNull();
  });

  it('refuses a cross-site fetch, even a GET', async () => {
    expect((await call('/api/state', { headers: { 'sec-fetch-site': 'cross-site' } })).status).toBe(
      403,
    );
    expect(
      (await call('/api/state', { headers: { 'sec-fetch-site': 'same-origin' } })).status,
    ).toBe(200);
  });

  it('needs a JSON content type on writes', async () => {
    const res = await post('/api/freelance', 'open=false', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    });
    expect(res.status).toBe(415);
  });
});

describe('freelance switch', () => {
  it('saves a booked override with a cleaned note', async () => {
    const res = await post('/api/freelance', { open: false, note: '  Back\nin  March\u0000 ' });
    expect(res.status).toBe(200);
    expect(JSON.parse((await env.KV.get(FREELANCE_KEY)) ?? '')).toEqual({
      open: false,
      note: 'Back in March',
    });
  });

  it('stores an empty note as null and can reopen', async () => {
    await post('/api/freelance', { open: true, note: '' });
    expect(JSON.parse((await env.KV.get(FREELANCE_KEY)) ?? '')).toEqual({ open: true, note: null });
  });

  it('reset deletes the override', async () => {
    await env.KV.put(FREELANCE_KEY, '{"open":false,"note":null}');
    expect((await post('/api/freelance', { reset: true })).status).toBe(200);
    expect(await env.KV.get(FREELANCE_KEY)).toBeNull();
  });

  it('rejects bad input and writes nothing', async () => {
    expect((await post('/api/freelance', { open: 'no' })).status).toBe(422);
    expect((await post('/api/freelance', { note: 'x' })).status).toBe(422);
    expect(
      (await post('/api/freelance', { open: false, note: 'x'.repeat(NOTE_MAX + 1) })).status,
    ).toBe(422);
    expect((await post('/api/freelance', '{nope')).status).toBe(400);
    expect((await post('/api/freelance', '[1]')).status).toBe(400);
    expect(await env.KV.get(FREELANCE_KEY)).toBeNull();
  });
});

describe('currently building', () => {
  it('saves a known project and resets', async () => {
    const id = projects[2]?.id ?? '';
    expect((await post('/api/building', { id })).status).toBe(200);
    expect(await env.KV.get(BUILDING_KEY)).toBe(id);
    expect((await post('/api/building', { reset: true })).status).toBe(200);
    expect(await env.KV.get(BUILDING_KEY)).toBeNull();
  });

  it('refuses ids that are not in projects.json', async () => {
    for (const id of ['nope', '', 42, null])
      expect((await post('/api/building', { id })).status, String(id)).toBe(422);
    expect(await env.KV.get(BUILDING_KEY)).toBeNull();
  });
});

describe('state', () => {
  it('reports defaults, overrides and the project list', async () => {
    await env.KV.put(FREELANCE_KEY, '{"open":false,"note":"Booked"}');
    await env.KV.put(BUILDING_KEY, projects[1]?.id ?? '');
    const s = (await (await call('/api/state')).json()) as StateBody;
    expect(s.freelance.override).toEqual({ open: false, note: 'Booked' });
    expect(s.freelance.default.open).toBe(true);
    expect(s.building).toEqual({ default: site.currentlyBuilding, override: projects[1]?.id });
    expect(s.projects).toHaveLength(projects.length);
  });

  it('ignores a stored building id that no longer exists', async () => {
    await env.KV.put(BUILDING_KEY, 'deleted-project');
    const s = (await (await call('/api/state')).json()) as StateBody;
    expect(s.building.override).toBeNull();
  });
});

describe('inbox', () => {
  it('lists newest first with parsed fields, hiding handled messages by default', async () => {
    await seed(3);
    await env.DB.prepare('UPDATE submissions SET handled = 1 WHERE id = 2').run();
    const res = (await (await call('/api/inbox')).json()) as InboxBody;
    expect(res.rows.map((r: { id: number }) => r.id)).toEqual([3, 1]);
    expect(res.rows[0]?.fields['message']).toBe('Hello 3');
    expect(res).toMatchObject({ total: 3, open: 2, more: false });
    const all = (await (await call('/api/inbox?filter=all')).json()) as InboxBody;
    expect(all.rows).toHaveLength(3);
  });

  it('pages with before= and says when there is more', async () => {
    await seed(PAGE_SIZE + 5);
    const first = (await (await call('/api/inbox')).json()) as InboxBody;
    expect(first.rows).toHaveLength(PAGE_SIZE);
    expect(first.more).toBe(true);
    const last = first.rows[PAGE_SIZE - 1]?.id;
    const second = (await (await call(`/api/inbox?before=${last}`)).json()) as InboxBody;
    expect(second.rows).toHaveLength(5);
    expect(second.more).toBe(false);
    expect(new Set([...first.rows, ...second.rows].map((r: { id: number }) => r.id)).size).toBe(
      PAGE_SIZE + 5,
    );
  });

  it('shows the unsent-email flag and keeps a row whose JSON is damaged', async () => {
    await seed(1, { emailed: 0, fields: '{broken' });
    const res = (await (await call('/api/inbox')).json()) as InboxBody;
    expect(res.rows[0]?.emailed).toBe(0);
    expect(res.rows[0]?.fields).toEqual({});
  });

  it('returns hostile content as plain data, never markup the API interprets', async () => {
    const evil = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    await seed(1, {
      name: evil,
      fields: JSON.stringify({ message: evil, name: evil, email: 'a@b.c' }),
    });
    const res = await call('/api/inbox');
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(JSON.stringify(await res.json())).toContain('onerror');
  });

  it('rejects a bad before=', async () => {
    for (const before of ['abc', '0', '-3', '1.5'])
      expect((await call(`/api/inbox?before=${before}`)).status, before).toBe(422);
  });

  it('marks a message handled and reopens it', async () => {
    await seed(1);
    expect((await post('/api/inbox/1', { handled: true })).status).toBe(200);
    expect(
      (
        await env.DB.prepare('SELECT handled FROM submissions WHERE id = 1').first<{
          handled: number;
        }>()
      )?.handled,
    ).toBe(1);
    expect((await post('/api/inbox/1', { handled: false })).status).toBe(200);
    expect(
      (
        await env.DB.prepare('SELECT handled FROM submissions WHERE id = 1').first<{
          handled: number;
        }>()
      )?.handled,
    ).toBe(0);
  });

  it('404 for an unknown message and 422 for bad ids or values', async () => {
    expect((await post('/api/inbox/999', { handled: true })).status).toBe(404);
    expect((await post('/api/inbox/abc', { handled: true })).status).toBe(422);
    expect((await post('/api/inbox/0', { handled: true })).status).toBe(422);
    expect((await post('/api/inbox/1', { handled: 'yes' })).status).toBe(422);
  });
});

it('answers 404 JSON for unknown admin routes', async () => {
  expect((await call('/nothing')).status).toBe(404);
  expect((await call('/api/nothing')).status).toBe(404);
});
