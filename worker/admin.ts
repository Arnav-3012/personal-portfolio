// /admin (SPEC "Content model", Live values; "Architecture", step 6): the inbox, the freelance switch and
// "currently building". Every route sits behind Cloudflare Access (the JWT check in access.ts) or a PIN session (pin.ts). State-changing
// routes also require a same-origin JSON request, because the Access cookie would otherwise let another site make
// the browser submit a form to /admin.
import { Hono, type Context } from 'hono';
import freelanceContent from '../content/freelance.json' with { type: 'json' };
import projects from '../content/projects.json' with { type: 'json' };
import site from '../content/site.json' with { type: 'json' };
import { verifyAccess } from './access';
import { adminHtml } from './admin-page';
import {
  SESSION_COOKIE,
  SESSION_S,
  loginHtml,
  locked,
  pinConfigured,
  readCookie,
  recordFailure,
  samePin,
  signSession,
  verifySession,
} from './pin';
import { cleanText } from './guard';
import { BUILDING_KEY, FREELANCE_KEY, NOTE_MAX, parseFreelance } from './live';

export const PAGE_SIZE = 50;

const headers = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex',
  'Referrer-Policy': 'no-referrer',
};
const reply = (status: number, body: Record<string, unknown>): Response =>
  Response.json(body, { status, headers });

export const admin = new Hono<{ Bindings: Env }>();

// The PIN sign-in. These routes sit before the gate below: they are how a visitor gets through it.
const page = (status: number, html: string, extra: Record<string, string> = {}): Response =>
  new Response(html, {
    status,
    headers: {
      ...headers,
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
      ...extra,
    },
  });

admin.get('/login', (c) =>
  pinConfigured(c.env.ADMIN_PIN)
    ? page(200, loginHtml())
    : new Response('Admin is not configured.', { status: 503, headers }),
);

admin.post('/login', async (c) => {
  const pin = c.env.ADMIN_PIN;
  if (!pinConfigured(pin))
    return new Response('Admin is not configured.', { status: 503, headers });
  const url = new URL(c.req.url);
  if (c.req.header('origin') !== url.origin) return page(403, loginHtml('Not allowed.'));
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  if (await locked(c.env.KV, ip))
    return page(429, loginHtml('Too many tries. Wait a while and try again.'), {
      'Retry-After': '900',
    });
  const body = await c.req.parseBody();
  const attempt = typeof body['pin'] === 'string' ? body['pin'] : '';
  if (!(await samePin(pin, attempt))) {
    await recordFailure(c.env.KV, ip);
    // A short pause on every wrong try makes guessing slower still.
    await new Promise((resolve) => setTimeout(resolve, 500));
    return page(401, loginHtml('Wrong PIN.'));
  }
  const value = await signSession(pin, Date.now() + SESSION_S * 1000);
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: '/admin',
      'Set-Cookie': `${SESSION_COOKIE}=${value}; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=${SESSION_S}${secure}`,
    },
  });
});

admin.post('/logout', (c) => {
  if (c.req.header('origin') !== new URL(c.req.url).origin)
    return new Response('Not allowed.', { status: 403, headers });
  return new Response(null, {
    status: 303,
    headers: {
      ...headers,
      Location: '/admin/login',
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/admin; Max-Age=0`,
    },
  });
});

// Everything else: Cloudflare Access (its signed JWT), or a PIN session. With neither set up it answers 503.
admin.use('*', async (c, next) => {
  const access = await verifyAccess(c.req.raw, c.env);
  if (access.ok) {
    await next();
    return undefined;
  }
  const pin = c.env.ADMIN_PIN;
  if (pinConfigured(pin)) {
    if (await verifySession(pin, readCookie(c.req.header('cookie'), SESSION_COOKIE))) {
      await next();
      return undefined;
    }
    // Not signed in: the page sends the visitor to the PIN screen; the API just says no.
    if (c.req.method === 'GET' && !new URL(c.req.url).pathname.includes('/api/'))
      return new Response(null, { status: 302, headers: { ...headers, Location: '/admin/login' } });
    return new Response('Not authorised.', {
      status: 401,
      headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
    });
  }
  return new Response(
    access.reason === 'not_configured' ? 'Admin is not configured.' : 'Not authorised.',
    {
      status: access.reason === 'not_configured' ? 503 : 401,
      headers: { ...headers, 'content-type': 'text/plain; charset=utf-8' },
    },
  );
});

// Same-origin only for the API; POSTs also need a JSON body.
admin.use('/api/*', async (c, next) => {
  const site$ = c.req.header('sec-fetch-site');
  if (site$ && site$ !== 'same-origin') return reply(403, { ok: false, error: 'cross_site' });
  if (c.req.method !== 'GET') {
    if (c.req.header('origin') !== new URL(c.req.url).origin)
      return reply(403, { ok: false, error: 'cross_site' });
    if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json'))
      return reply(415, { ok: false, error: 'json_only' });
  }
  await next();
  return undefined;
});

admin.get('/', () => {
  const nonce = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
  return new Response(adminHtml(nonce), {
    headers: {
      ...headers,
      'content-type': 'text/html; charset=utf-8',
      'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
      'X-Frame-Options': 'DENY',
    },
  });
});

admin.get('/api/state', async (c) => {
  const [f, b] = await Promise.all([c.env.KV.get(FREELANCE_KEY), c.env.KV.get(BUILDING_KEY)]);
  return reply(200, {
    ok: true,
    freelance: {
      default: { open: freelanceContent.open, note: freelanceContent.note },
      override: parseFreelance(f),
    },
    building: {
      default: site.currentlyBuilding,
      override: projects.some((p) => p.id === b) ? b : null,
    },
    projects: projects.map((p) => ({ id: p.id, name: p.name })),
  });
});

const body = async (c: {
  req: { json: () => Promise<unknown> };
}): Promise<Record<string, unknown> | null> => {
  try {
    const v = await c.req.json();
    return typeof v === 'object' && v !== null && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
};

/** Clears this colo's cached /api/live before answering, so the next visitor reads the change; elsewhere it waits out the 60 s cache. */
const refresh = async (c: Context<{ Bindings: Env }>): Promise<void> => {
  await caches.default.delete(new URL('/api/live', c.req.url).toString()).catch(() => false);
};

admin.post('/api/freelance', async (c) => {
  const b = await body(c);
  if (!b) return reply(400, { ok: false, error: 'bad_json' });
  if (b['reset'] === true) {
    await c.env.KV.delete(FREELANCE_KEY);
  } else {
    if (typeof b['open'] !== 'boolean') return reply(422, { ok: false, error: 'invalid' });
    const note = typeof b['note'] === 'string' ? cleanText(b['note']) : '';
    if (note.length > NOTE_MAX) return reply(422, { ok: false, error: 'note_too_long' });
    await c.env.KV.put(FREELANCE_KEY, JSON.stringify({ open: b['open'], note: note || null }));
  }
  await refresh(c);
  return reply(200, { ok: true });
});

admin.post('/api/building', async (c) => {
  const b = await body(c);
  if (!b) return reply(400, { ok: false, error: 'bad_json' });
  if (b['reset'] === true) {
    await c.env.KV.delete(BUILDING_KEY);
  } else {
    if (typeof b['id'] !== 'string' || !projects.some((p) => p.id === b['id']))
      return reply(422, { ok: false, error: 'unknown_project' });
    await c.env.KV.put(BUILDING_KEY, b['id']);
  }
  await refresh(c);
  return reply(200, { ok: true });
});

interface Row {
  id: number;
  kind: string;
  name: string;
  email: string;
  fields: string;
  created_at: string;
  emailed: number;
  handled: number;
}

admin.get('/api/inbox', async (c) => {
  const all = c.req.query('filter') === 'all';
  const before = Number(c.req.query('before') ?? Number.MAX_SAFE_INTEGER);
  if (!Number.isSafeInteger(before) || before < 1)
    return reply(422, { ok: false, error: 'invalid' });
  const found = await c.env.DB.prepare(
    `SELECT id, kind, name, email, fields, created_at, emailed, handled
       FROM submissions WHERE id < ?1 AND (?2 = 1 OR handled = 0)
       ORDER BY id DESC LIMIT ?3`,
  )
    .bind(before, all ? 1 : 0, PAGE_SIZE + 1)
    .all<Row>();
  const counts = await c.env.DB.prepare(
    'SELECT COUNT(*) AS total, COALESCE(SUM(handled = 0), 0) AS open FROM submissions',
  ).first<{ total: number; open: number }>();
  const rows = found.results.slice(0, PAGE_SIZE).map((r) => {
    let fields: Record<string, string> = {};
    try {
      const parsed: unknown = JSON.parse(r.fields);
      if (typeof parsed === 'object' && parsed !== null) fields = parsed as Record<string, string>;
    } catch {
      // Keep the row visible even if its JSON is damaged.
    }
    return { ...r, fields };
  });
  return reply(200, {
    ok: true,
    rows,
    more: found.results.length > PAGE_SIZE,
    total: counts?.total ?? 0,
    open: counts?.open ?? 0,
  });
});

admin.post('/api/inbox/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const b = await body(c);
  if (!b) return reply(400, { ok: false, error: 'bad_json' });
  if (!Number.isSafeInteger(id) || id < 1 || typeof b['handled'] !== 'boolean')
    return reply(422, { ok: false, error: 'invalid' });
  const run = await c.env.DB.prepare('UPDATE submissions SET handled = ?1 WHERE id = ?2')
    .bind(b['handled'] ? 1 : 0, id)
    .run();
  return run.meta.changes === 0
    ? reply(404, { ok: false, error: 'not_found' })
    : reply(200, { ok: true });
});

admin.all('*', () => reply(404, { ok: false, error: 'not_found' }));
