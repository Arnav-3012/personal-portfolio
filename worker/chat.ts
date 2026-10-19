// POST /api/chat: EDITH-lite (SPEC "EDITH tab", Agent). Order: cheap checks first, the bot check once per
// session (a signed session token afterwards), limits in D1, retrieval, and only then the model. Questions the
// knowledge base cannot answer never reach the model, which keeps off-topic traffic free of Neurons.
import { Hono, type Context } from 'hono';
import {
  GREETING_REPLY,
  RESTING_REPLY,
  TrailerSplitter,
  UNKNOWN_REPLY,
  buildMessages,
  cleanHistory,
  cleanQuestion,
  filterOutput,
  isGreeting,
  usedSources,
  type ToolCall,
} from './guard';
import { hashIp, verifyTurnstile } from './forms';

export const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
export const CHAT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8';
export const MAX_BODY_BYTES = 4 * 1024;
/** Messages one connection may send per hour, and everyone together per day. */
export const HOURLY_PER_IP = 20;
/** About 27 Neurons a reply (13,778 per M input tokens, 26,128 per M output) keeps 200 under the 9,000 text share of the 10,000 free. */
export const DAILY_CAP = 200;
/**
 * Below this similarity nothing in the knowledge base is close and the model is not called. bge scores are
 * compressed (live probe, 2026-10-18: relevant 0.53 to 0.75, off-topic up to 0.58), so this is a floor that
 * saves Neurons, not the off-topic gate. Refusing off-topic questions is the system prompt's job.
 */
export const MIN_SCORE = 0.45;
export const TOP_K = 8;
export const MAX_REPLY_CHARS = 1200;
export const SESSION_MS = 30 * 60 * 1000;
export const PRUNE_ODDS = 0.02;

export const COUNTS_SQL = `SELECT
         COALESCE(SUM(ip_hash = ?1 AND created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 hour')), 0) AS hourly,
         COUNT(*) AS daily
       FROM chat_events
       WHERE created_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-1 day')`;

const json = (status: number, body: Record<string, unknown>, headers: HeadersInit = {}): Response =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

const hex = (bytes: ArrayBuffer): string =>
  [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return hex(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message)));
}

/** A session proves the bot check passed for this connection in the last 30 minutes. */
export async function makeSession(
  secret: string,
  ipHash: string,
  now = Date.now(),
): Promise<string> {
  const expires = now + SESSION_MS;
  return `${expires}.${await hmac(secret, `${ipHash}:${expires}`)}`;
}

export async function checkSession(
  secret: string,
  ipHash: string,
  token: unknown,
  now = Date.now(),
): Promise<boolean> {
  if (typeof token !== 'string') return false;
  const [expires = '', mac = ''] = token.split('.');
  if (!/^\d{10,15}$/.test(expires) || Number(expires) < now) return false;
  const expected = await hmac(secret, `${ipHash}:${expires}`);
  // Equal-length hex strings; compare without early exit.
  let diff = expected.length ^ mac.length;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  return diff === 0;
}

interface Meta {
  spoken: string;
  markdown: string;
  sources: { label: string; url?: string }[];
  tools: ToolCall[];
  session?: string;
  resting?: boolean;
}

const sse = (event: string, data: unknown): Uint8Array =>
  new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

const sseHeaders = {
  'content-type': 'text/event-stream; charset=utf-8',
  'cache-control': 'no-store',
  'x-accel-buffering': 'no',
};

/** A whole reply that needs no model (greeting, unknown, resting) as a two-event stream. */
function cannedReply(text: string, extra: Partial<Meta> = {}): Response {
  const meta: Meta = { spoken: text, markdown: text, sources: [], tools: [], ...extra };
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(sse('token', { t: text }));
      controller.enqueue(sse('meta', meta));
      controller.close();
    },
  });
  return new Response(body, { headers: sseHeaders });
}

interface Retrieved {
  source: string;
  text: string;
  url?: string;
  score: number;
}

export async function retrieve(env: Env, question: string): Promise<Retrieved[]> {
  const embedded = (await env.AI.run(EMBED_MODEL, { text: [question] })) as { data?: number[][] };
  const vector = embedded.data?.[0];
  if (!vector) throw new Error('embedding returned no vector');
  const found = await env.VECTORIZE.query(vector, { topK: TOP_K, returnMetadata: 'all' });
  return found.matches.flatMap((m) => {
    const md = m.metadata ?? {};
    const text = md['text'];
    const source = md['source'];
    if (typeof text !== 'string' || typeof source !== 'string') return [];
    const url = md['url'];
    return [{ source, text, score: m.score, ...(typeof url === 'string' ? { url } : {}) }];
  });
}

/** Text deltas from a Workers AI SSE stream. Tolerates `{"response": ...}` and OpenAI-style deltas. */
export async function* modelText(stream: ReadableStream<Uint8Array>): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') return;
        try {
          const parsed = JSON.parse(payload) as {
            response?: unknown;
            choices?: { delta?: { content?: unknown } }[];
          };
          const delta = parsed.response ?? parsed.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta) yield delta;
        } catch {
          // A partial or non-JSON line: skip it.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** Complete sentences at the start of `text` (ending . ! ? or a newline), and the unfinished rest. */
export function takeSentences(text: string): [string[], string] {
  const out: string[] = [];
  let rest = text;
  for (;;) {
    const m = /^([\s\S]*?(?:[.!?]+(?=\s)|\n))\s*/.exec(rest);
    if (!m) break;
    const sentence = (m[1] ?? '').trim();
    if (sentence) out.push(sentence);
    rest = rest.slice(m[0].length);
  }
  return [out, rest];
}

export const PRUNE_SQL =
  "DELETE FROM chat_events WHERE created_at < strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-2 days')";

/** Clears old rows after the response; a missing execution context or a failed delete never fails a request. */
function pruneInBackground(c: Context<{ Bindings: Env }>): void {
  try {
    c.executionCtx.waitUntil(
      c.env.DB.prepare(PRUNE_SQL)
        .run()
        .catch(() => undefined),
    );
  } catch {
    // No execution context (unit tests): skip, the next request will do it.
  }
}

export const chat = new Hono<{ Bindings: Env }>();

chat.post('/', async (c) => {
  if (!c.req.header('content-type')?.toLowerCase().startsWith('application/json'))
    return json(415, { ok: false, error: 'json_only' });
  if (Number(c.req.header('content-length') ?? 0) > MAX_BODY_BYTES)
    return json(413, { ok: false, error: 'too_large' });
  const raw = await c.req.text();
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES)
    return json(413, { ok: false, error: 'too_large' });
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
    body = parsed as Record<string, unknown>;
  } catch {
    return json(400, { ok: false, error: 'bad_json' });
  }

  const question = cleanQuestion(body['message']);
  if (!question.ok) return json(422, { ok: false, error: question.error });

  const secret = c.env.TURNSTILE_SECRET;
  if (!secret) return json(503, { ok: false, error: 'not_configured' });
  const ip = c.req.header('cf-connecting-ip') ?? 'unknown';
  const ipHash = await hashIp(ip, secret);

  // Bot check once per session: a valid signed session, or else a fresh single-use Turnstile token.
  let session: string | undefined;
  if (!(await checkSession(secret, ipHash, body['session']))) {
    const token = typeof body['turnstile'] === 'string' ? body['turnstile'] : '';
    if (!token) return json(403, { ok: false, error: 'turnstile' });
    const verdict = await verifyTurnstile(secret, token, ip);
    if (verdict === 'fail') return json(403, { ok: false, error: 'turnstile' });
    if (verdict === 'unavailable') return json(503, { ok: false, error: 'verify_unavailable' });
    session = await makeSession(secret, ipHash);
  }

  if (isGreeting(question.text)) return cannedReply(GREETING_REPLY, session ? { session } : {});

  try {
    const counts = await c.env.DB.prepare(COUNTS_SQL)
      .bind(ipHash)
      .first<{ hourly: number; daily: number }>();
    if ((counts?.hourly ?? 0) >= HOURLY_PER_IP)
      return json(429, { ok: false, error: 'rate_limited' }, { 'Retry-After': '3600' });
    if ((counts?.daily ?? 0) >= DAILY_CAP)
      return cannedReply(RESTING_REPLY, { resting: true, ...(session ? { session } : {}) });
    await c.env.DB.prepare('INSERT INTO chat_events (ip_hash) VALUES (?1)').bind(ipHash).run();
    // Keep the table small: about one request in fifty clears rows older than two days.
    if (Math.random() < PRUNE_ODDS) pruneInBackground(c);
  } catch (error) {
    // Without the counters the limits cannot hold, so stop rather than run open.
    console.error('chat: limits unavailable', error);
    return json(503, { ok: false, error: 'unavailable' });
  }

  let found: Retrieved[];
  try {
    found = await retrieve(c.env, question.text);
  } catch (error) {
    console.error('chat: retrieval failed', error);
    return json(503, { ok: false, error: 'unavailable' });
  }
  const relevant = found.filter((m) => m.score >= MIN_SCORE);
  if (relevant.length === 0)
    return cannedReply(UNKNOWN_REPLY, {
      tools: [{ name: 'scrollTo', arg: 'contact' }],
      ...(session ? { session } : {}),
    });

  const messages = buildMessages(question.text, cleanHistory(body['history']), relevant);
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = (await c.env.AI.run(CHAT_MODEL, {
      messages,
      stream: true,
      max_tokens: 320,
      temperature: 0.4,
    })) as ReadableStream<Uint8Array>;
  } catch (error) {
    console.error('chat: model failed', error);
    return json(503, { ok: false, error: 'unavailable' });
  }

  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      const splitter = new TrailerSplitter();
      let spoken = '';
      let held = '';
      // Text reaches the visitor one filtered sentence at a time, so a phone number or leaked rule is never shown.
      const emit = (sentence: string): void => {
        const clean = filterOutput(sentence);
        if (!clean || spoken.length >= MAX_REPLY_CHARS) return;
        const piece = spoken ? ` ${clean}` : clean;
        spoken += piece;
        controller.enqueue(sse('token', { t: piece }));
      };
      try {
        for await (const delta of modelText(upstream)) {
          held += splitter.push(delta);
          const [sentences, rest] = takeSentences(held);
          held = rest;
          sentences.forEach(emit);
          if (spoken.length >= MAX_REPLY_CHARS) break;
        }
        held += splitter.end();
        takeSentences(held + '\n')[0].forEach(emit);
        const sources = usedSources(spoken, relevant).map((m) => ({
          label: m.source,
          ...(m.url ? { url: m.url } : {}),
        }));
        const meta: Meta = {
          spoken,
          markdown: [
            spoken,
            ...sources.filter((s) => s.url).map((s) => `[${s.label}](${s.url})`),
          ].join('\n\n'),
          sources,
          tools: splitter.tools,
          ...(session ? { session } : {}),
        };
        controller.enqueue(sse('meta', meta));
      } catch (error) {
        console.error('chat: stream failed', error);
        controller.enqueue(sse('error', { error: 'stream' }));
      } finally {
        controller.close();
      }
    },
    cancel() {
      void upstream.cancel().catch(() => undefined);
    },
  });
  return new Response(body$, { headers: sseHeaders });
});

chat.all('*', (c) => json(c.req.method === 'POST' ? 404 : 405, { ok: false, error: 'not_found' }));
