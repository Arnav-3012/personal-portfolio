// POST /api/forms/<kind> (contact, freelance, notebook). Order matters: cheap checks first, the single-use
// Turnstile token only after the payload is valid, the rate limits before anything is written. The row is stored
// before the email is sent, and an email failure never fails the request, so a message is never lost.
import { Hono } from 'hono';
import freelance from '../content/freelance.json' with { type: 'json' };
import { NOTEBOOK_TOPICS, RULES, isFormKind, validate, type FormKind } from '../src/lib/form-rules';
import { sendMail } from './email';

export const MAX_BODY_BYTES = 8 * 1024;
/** Submissions one connection may make per hour, and everyone together per day (keeps D1 and mail far below the free limits). */
export const HOURLY_PER_IP = 5;
export const DAILY_TOTAL = 200;

/** One indexed range scan over the last day (index `submissions_created`) gives both limits: this IP's last hour and everyone's day. */
export const COUNTS_SQL = `SELECT
         COALESCE(SUM(ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')), 0) AS hourly,
         COUNT(*) AS daily
       FROM submissions
       WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`;

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

type Result = (status: number, body: Record<string, unknown>) => Response;
const reply: Result = (status, body) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Values that must come from a list in content/ (the dropdowns on the page). */
const CHOICES: Partial<Record<FormKind, Record<string, readonly string[]>>> = {
  freelance: { service: freelance.services.map((s) => s.id), timeline: freelance.timelines },
  notebook: { topic: NOTEBOOK_TOPICS },
};

export async function hashIp(ip: string, secret: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${ip}:${secret}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

type Verdict = 'pass' | 'fail' | 'unavailable';

async function verifyTurnstile(secret: string, token: string, ip: string): Promise<Verdict> {
  try {
    const res = await fetch(SITEVERIFY, {
      method: 'POST',
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
    });
    if (!res.ok) return 'unavailable';
    const data: unknown = await res.json();
    if (typeof data !== 'object' || data === null || !('success' in data)) return 'unavailable';
    return data.success === true ? 'pass' : 'fail';
  } catch {
    return 'unavailable';
  }
}

function emailText(kind: FormKind, fields: Record<string, string>): string {
  const lines = Object.entries(RULES[kind])
    .filter(([key]) => key !== 'message' && fields[key])
    .map(([key, rule]) => `${rule.label}: ${fields[key]}`);
  return [
    `New ${kind} message from the portfolio.`,
    '',
    ...lines,
    '',
    fields['message'] ?? '',
    '',
  ].join('\n');
}

export const forms = new Hono<{ Bindings: Env }>();

forms.post('/:kind', async (c) => {
  const kind = c.req.param('kind');
  if (!isFormKind(kind)) return reply(404, { ok: false, error: 'not_found' });
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json'))
    return reply(415, { ok: false, error: 'json_only' });
  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > MAX_BODY_BYTES) return reply(413, { ok: false, error: 'too_large' });
  const text = await c.req.text();
  if (new TextEncoder().encode(text).length > MAX_BODY_BYTES)
    return reply(413, { ok: false, error: 'too_large' });

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    return reply(400, { ok: false, error: 'bad_json' });
  }
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload))
    return reply(400, { ok: false, error: 'bad_json' });
  const body = payload as Record<string, unknown>;

  // Bots fill the hidden "website" field. Pretend it worked and store nothing.
  if (typeof body['website'] === 'string' && body['website'].trim() !== '')
    return reply(200, { ok: true });

  const fields: Record<string, string> = {};
  for (const key of Object.keys(RULES[kind])) {
    const value = body[key];
    fields[key] = typeof value === 'string' ? value.trim() : '';
  }
  const errors = validate(kind, fields);
  for (const [key, allowed] of Object.entries(CHOICES[kind] ?? {}))
    if (!errors[key] && !allowed.includes(fields[key] ?? ''))
      errors[key] = 'Choose one of the options.';
  if (Object.keys(errors).length > 0)
    return reply(422, { ok: false, error: 'invalid', fields: errors });

  const { TURNSTILE_SECRET: secret, DB, EMAIL, MAIL_FROM, MAIL_TO } = c.env;
  // Fail closed: without a secret the endpoint is "unavailable", never open.
  if (!secret) return reply(503, { ok: false, error: 'not_configured' });
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const token = typeof body['turnstile'] === 'string' ? body['turnstile'] : '';
  if (!token) return reply(403, { ok: false, error: 'turnstile' });
  const verdict = await verifyTurnstile(secret, token, ip);
  if (verdict === 'fail') return reply(403, { ok: false, error: 'turnstile' });
  if (verdict === 'unavailable') return reply(503, { ok: false, error: 'verify_unavailable' });

  const ipHash = await hashIp(ip, secret);
  let id: number | null = null;
  try {
    const counts = await DB.prepare(COUNTS_SQL)
      .bind(ipHash)
      .first<{ hourly: number; daily: number }>();
    if ((counts?.hourly ?? 0) >= HOURLY_PER_IP || (counts?.daily ?? 0) >= DAILY_TOTAL)
      return Response.json(
        { ok: false, error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': '3600', 'Cache-Control': 'no-store' } },
      );
    const run = await DB.prepare(
      'INSERT INTO submissions (kind, name, email, fields, ip_hash) VALUES (?1, ?2, ?3, ?4, ?5)',
    )
      .bind(kind, fields['name'], fields['email'], JSON.stringify(fields), ipHash)
      .run();
    id = run.meta.last_row_id;
  } catch (error) {
    // Keep going: the email below may still save the message.
    console.error('forms: storing the submission failed', error);
  }

  let emailed = false;
  try {
    await sendMail(EMAIL, {
      from: MAIL_FROM,
      to: MAIL_TO,
      replyTo: fields['email'] ?? '',
      subject: `[portfolio] ${kind}: ${fields['name'] ?? ''}`,
      text: emailText(kind, fields),
    });
    emailed = true;
  } catch (error) {
    console.error('forms: sending the email failed', error);
  }

  if (id === null && !emailed) return reply(500, { ok: false, error: 'storage' });
  if (id !== null && emailed) {
    try {
      await DB.prepare('UPDATE submissions SET emailed = 1 WHERE id = ?1').bind(id).run();
    } catch (error) {
      console.error('forms: marking the row as emailed failed', error);
    }
  }
  return reply(200, { ok: true });
});

forms.all('*', (c) =>
  reply(c.req.method === 'POST' ? 404 : 405, { ok: false, error: 'not_found' }),
);
