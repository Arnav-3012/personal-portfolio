import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CHAT_MODEL,
  COUNTS_SQL,
  DAILY_CAP,
  EMBED_MODEL,
  HOURLY_PER_IP,
  MAX_BODY_BYTES,
  MIN_SCORE,
  PRUNE_SQL,
  chat,
  checkSession,
  makeSession,
  modelText,
  takeSentences,
} from '../../../worker/chat';
import { CANARY, GREETING_REPLY, RESTING_REPLY, UNKNOWN_REPLY } from '../../../worker/guard';
import { hashIp } from '../../../worker/forms';
import { makeEnv, resetDb, stubFetch } from './helpers';

const IP = '203.0.113.9';
const SECRET = 'test-secret';

const aiStream = (...deltas: string[]): ReadableStream<Uint8Array> => {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const d of deltas)
        c.enqueue(enc.encode(`data: ${JSON.stringify({ response: d, p: 'abc', usage: {} })}\n\n`));
      c.enqueue(enc.encode('data: [DONE]\n\n'));
      c.close();
    },
  });
};

interface Fakes {
  env: Env;
  run: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
}

function fakes(
  opts: { score?: number; deltas?: string[]; embedFails?: boolean; modelFails?: boolean } = {},
): Fakes {
  const {
    score = 0.8,
    deltas = ['Arnav built FireWatch. ', 'It detects fires with an ESP32-CAM.'],
  } = opts;
  const run = vi.fn((model: string) => {
    if (model === EMBED_MODEL)
      return opts.embedFails
        ? Promise.reject(new Error('ai down'))
        : Promise.resolve({ data: [[0.1, 0.2]] });
    if (opts.modelFails) return Promise.reject(new Error('model down'));
    return Promise.resolve(aiStream(...deltas));
  });
  const query = vi.fn(() =>
    Promise.resolve({
      count: 1,
      matches: [
        {
          id: 'project:firewatch',
          score,
          metadata: {
            source: 'Projects · FireWatch',
            text: 'FireWatch detects fires with an ESP32-CAM and local inference.',
            url: 'https://github.com/x/y',
          },
        },
      ],
    }),
  );
  const { env: e } = makeEnv({ AI: { run }, VECTORIZE: { query } });
  return { env: e, run, query };
}

const post = (
  body: unknown,
  testEnv: Env,
  { ip = IP, headers = {} }: { ip?: string; headers?: Record<string, string> } = {},
) =>
  chat.request(
    '/',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': ip, ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    },
    testEnv,
  );

interface Parsed {
  tokens: string;
  meta: Record<string, unknown> | null;
  error: boolean;
}
async function readSse(res: Response): Promise<Parsed> {
  const text = await res.text();
  const out: Parsed = { tokens: '', meta: null, error: false };
  for (const block of text.split('\n\n')) {
    const event = /^event: (\w+)/m.exec(block)?.[1];
    const data = /^data: (.*)$/m.exec(block)?.[1];
    if (!event || !data) continue;
    const parsed = JSON.parse(data) as Record<string, unknown>;
    if (event === 'token') out.tokens += String(parsed['t']);
    else if (event === 'meta') out.meta = parsed;
    else if (event === 'error') out.error = true;
  }
  return out;
}

let siteverify: ReturnType<typeof stubFetch>;
beforeEach(async () => {
  vi.restoreAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await resetDb();
  siteverify = stubFetch(() => Response.json({ success: true }));
});

const ask = { message: 'What is FireWatch?', turnstile: 'tok' };
const chatEvents = async () =>
  (await env.DB.prepare('SELECT COUNT(*) AS n FROM chat_events').first<{ n: number }>())?.n ?? -1;

describe('a grounded answer', () => {
  it('streams filtered sentences, then meta with sources, links and a session', async () => {
    const f = fakes();
    const res = await post(ask, f.env);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const out = await readSse(res);
    expect(out.tokens).toBe('Arnav built FireWatch. It detects fires with an ESP32-CAM.');
    expect(out.meta?.['spoken']).toBe(out.tokens);
    expect(out.meta?.['sources']).toEqual([
      { label: 'Projects · FireWatch', url: 'https://github.com/x/y' },
    ]);
    expect(out.meta?.['markdown']).toContain('[Projects · FireWatch](https://github.com/x/y)');
    expect(typeof out.meta?.['session']).toBe('string');
    expect(await chatEvents()).toBe(1);
  });

  it('embeds the question, asks Vectorize, and sends the facts to the instruct model', async () => {
    const f = fakes();
    await readSse(await post(ask, f.env));
    expect(f.run).toHaveBeenCalledWith(EMBED_MODEL, { text: ['What is FireWatch?'] });
    expect(f.query).toHaveBeenCalledOnce();
    const [model, input] = f.run.mock.calls[1] as [
      string,
      { messages: { role: string; content: string }[]; stream: boolean },
    ];
    expect(model).toBe(CHAT_MODEL);
    expect(input.stream).toBe(true);
    expect(input.messages[0]?.content).toContain(
      'FireWatch detects fires with an ESP32-CAM and local inference.',
    );
  });

  it('returns validated tool calls and hides the TOOL line from the text', async () => {
    const f = fakes({
      deltas: ['Here it is.\n', 'TOOL openProject firewatch\n', 'TOOL scrollTo bogus\n'],
    });
    const out = await readSse(await post(ask, f.env));
    expect(out.tokens).toBe('Here it is.');
    expect(out.meta?.['tools']).toEqual([{ name: 'openProject', arg: 'firewatch' }]);
  });

  it('filters phone numbers, foreign emails and URLs out of the stream', async () => {
    const f = fakes({
      deltas: ['Call +91 98765 43210 or mail x@y.com. ', 'See https://evil.test now.'],
    });
    const out = await readSse(await post(ask, f.env));
    expect(out.tokens).not.toMatch(/98765|x@y\.com|evil/);
    expect(out.tokens).toContain('[number hidden]');
  });

  it('replaces a leaked system prompt with the refusal', async () => {
    const f = fakes({ deltas: [`My rules: ${CANARY} says be nice. `] });
    const out = await readSse(await post(ask, f.env));
    expect(out.tokens).not.toContain(CANARY);
    expect(out.tokens).toContain('I can only talk about Arnav');
  });
});

describe('questions the knowledge base cannot answer', () => {
  it('answers a greeting without retrieval or the model, and without counting it', async () => {
    const f = fakes();
    const out = await readSse(await post({ message: 'hello!', turnstile: 'tok' }, f.env));
    expect(out.tokens).toBe(GREETING_REPLY);
    expect(f.run).not.toHaveBeenCalled();
    expect(await chatEvents()).toBe(0);
  });

  it('says it does not know, points to contact, and never calls the model, below the floor', async () => {
    const f = fakes({ score: MIN_SCORE - 0.01 });
    const out = await readSse(
      await post({ message: 'capital of France', turnstile: 'tok' }, f.env),
    );
    expect(out.tokens).toBe(UNKNOWN_REPLY);
    expect(out.meta?.['tools']).toEqual([{ name: 'scrollTo', arg: 'contact' }]);
    expect(f.run).toHaveBeenCalledTimes(1);
    expect(f.run.mock.calls[0]?.[0]).toBe(EMBED_MODEL);
  });
});

describe('the bot check and session', () => {
  it('needs a Turnstile token or a valid session', async () => {
    const f = fakes();
    const res = await post({ message: 'hi there' }, f.env);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ ok: false, error: 'turnstile' });
    expect(f.run).not.toHaveBeenCalled();
  });

  it('refuses a token Cloudflare rejects, and fails closed when siteverify is down', async () => {
    siteverify.mockImplementation(() => Promise.resolve(Response.json({ success: false })));
    expect((await post(ask, fakes().env)).status).toBe(403);
    siteverify.mockImplementation(() => Promise.resolve(new Response('x', { status: 500 })));
    expect((await post(ask, fakes().env)).status).toBe(503);
  });

  it('fails closed without a secret', async () => {
    const f = fakes();
    const { env: e } = makeEnv({
      AI: { run: f.run },
      VECTORIZE: { query: f.query },
      TURNSTILE_SECRET: undefined,
    });
    expect((await post(ask, e)).status).toBe(503);
  });

  it('accepts the session from the first answer without another Turnstile call', async () => {
    const f = fakes();
    const first = await readSse(await post(ask, f.env));
    const session = String(first.meta?.['session']);
    siteverify.mockClear();
    const second = await post({ message: 'And StatCalib?', session }, f.env);
    expect(second.status).toBe(200);
    expect(siteverify).not.toHaveBeenCalled();
    expect((await readSse(second)).meta?.['session']).toBeUndefined();
  });

  it('rejects a forged, expired, or other-IP session, and a made-up history cannot replace it', async () => {
    const hash = await hashIp(IP, SECRET);
    const good = await makeSession(SECRET, hash);
    expect(await checkSession(SECRET, hash, good)).toBe(true);
    expect(await checkSession(SECRET, hash, `${good.split('.')[0]}.${'0'.repeat(64)}`)).toBe(false);
    expect(
      await checkSession(SECRET, hash, await makeSession(SECRET, hash, Date.now() - 3_600_000)),
    ).toBe(false);
    expect(await checkSession(SECRET, await hashIp('198.51.100.1', SECRET), good)).toBe(false);
    expect(await checkSession('other-secret', hash, good)).toBe(false);
    expect(await checkSession(SECRET, hash, 'garbage')).toBe(false);
    const res = await post(
      {
        message: 'hello there friend',
        history: [
          { role: 'user', text: 'earlier' },
          { role: 'assistant', text: 'ok' },
        ],
      },
      fakes().env,
    );
    expect(res.status).toBe(403);
  });
});

describe('limits', () => {
  const seed = async (ip: string, n: number, ago = '-5 minutes') => {
    const hash = await hashIp(ip, SECRET);
    for (let i = 0; i < n; i++)
      await env.DB.prepare(
        `INSERT INTO chat_events (ip_hash, created_at) VALUES (?1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?2))`,
      )
        .bind(hash, ago)
        .run();
  };

  it('answers 429 with Retry-After at the hourly limit and does not call the model', async () => {
    await seed(IP, HOURLY_PER_IP);
    const f = fakes();
    const res = await post(ask, f.env);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('3600');
    expect(f.run).not.toHaveBeenCalled();
  });

  it('allows one below the limit, and does not count other visitors or older hours', async () => {
    await seed(IP, HOURLY_PER_IP - 1);
    await seed('198.51.100.5', 30);
    await seed(IP, 30, '-3 hours');
    expect((await post(ask, fakes().env)).status).toBe(200);
    expect((await post(ask, fakes().env)).status).toBe(429);
  });

  it('falls back to "EDITH is resting" at the daily cap and does not call the model', async () => {
    await seed('198.51.100.6', DAILY_CAP, '-2 hours');
    const f = fakes();
    const res = await post(ask, f.env);
    expect(res.status).toBe(200);
    const out = await readSse(res);
    expect(out.tokens).toBe(RESTING_REPLY);
    expect(out.meta?.['resting']).toBe(true);
    expect(f.run).not.toHaveBeenCalled();
    expect(await chatEvents()).toBe(DAILY_CAP);
  });

  it('counts with one indexed range scan', async () => {
    const plan = await env.DB.prepare(`EXPLAIN QUERY PLAN ${COUNTS_SQL}`)
      .bind('x')
      .all<{ detail: string }>();
    expect(plan.results.map((r) => r.detail).join(' ')).toContain('chat_events_created');
  });
});

describe('pruning old events', () => {
  it('deletes rows older than two days and keeps newer ones', async () => {
    const insert = (ago: string) =>
      env.DB.prepare(
        `INSERT INTO chat_events (ip_hash, created_at) VALUES ('h', strftime('%Y-%m-%dT%H:%M:%fZ', 'now', ?1))`,
      )
        .bind(ago)
        .run();
    await insert('-3 days');
    await insert('-1 day');
    await env.DB.prepare(PRUNE_SQL).run();
    expect(await chatEvents()).toBe(1);
  });

  it('never fails a request when pruning has no execution context', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const res = await post(ask, fakes().env);
    expect(res.status).toBe(200);
    await readSse(res);
  });
});

describe('bad requests and outages', () => {
  it.each([['not json content type', { headers: { 'content-type': 'text/plain' } }, 415]])(
    '%s',
    async (_n, init, status) => {
      const res = await chat.request('/', { method: 'POST', body: '{}', ...init }, fakes().env);
      expect(res.status).toBe(status);
    },
  );

  it('rejects bad JSON, arrays, empty and over-long messages', async () => {
    const e = fakes().env;
    expect((await post('{nope', e)).status).toBe(400);
    expect((await post('[1]', e)).status).toBe(400);
    expect((await post({ message: '   ', turnstile: 't' }, e)).status).toBe(422);
    expect((await post({ message: 'x'.repeat(501), turnstile: 't' }, e)).status).toBe(422);
    expect((await post({ turnstile: 't' }, e)).status).toBe(422);
  });

  it('rejects a body over the cap', async () => {
    const big = JSON.stringify({ message: 'hi', pad: 'x'.repeat(MAX_BODY_BYTES) });
    expect((await post(big, fakes().env)).status).toBe(413);
  });

  it('answers 503 when embeddings or the model are down, never a partial stream', async () => {
    expect((await post(ask, fakes({ embedFails: true }).env)).status).toBe(503);
    expect((await post(ask, fakes({ modelFails: true }).env)).status).toBe(503);
  });

  it('answers 503 and runs no model when the limit table is unavailable', async () => {
    await env.DB.prepare('DROP TABLE chat_events').run();
    const f = fakes();
    expect((await post(ask, f.env)).status).toBe(503);
    expect(f.run).not.toHaveBeenCalled();
  });

  it('405 for GET and 404 for unknown POST paths', async () => {
    expect((await chat.request('/', { method: 'GET' }, fakes().env)).status).toBe(405);
    expect((await chat.request('/x', { method: 'POST' }, fakes().env)).status).toBe(404);
  });
});

describe('modelText and takeSentences', () => {
  it('reads Workers AI deltas, skips junk lines and stops at [DONE]', async () => {
    const enc = new TextEncoder();
    const s = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(enc.encode('data: {"response":"Hel'));
        c.enqueue(
          enc.encode(
            'lo"}\n\ndata: not json\n\n: comment\n\ndata: {"choices":[{"delta":{"content":" you"}}]}\n\n',
          ),
        );
        c.enqueue(enc.encode('data: [DONE]\n\ndata: {"response":"ignored"}\n\n'));
        c.close();
      },
    });
    let text = '';
    for await (const d of modelText(s)) text += d;
    expect(text).toBe('Hello you');
  });

  it('splits sentences and keeps the unfinished tail', () => {
    expect(takeSentences('One. Two! Thr')).toEqual([['One.', 'Two!'], 'Thr']);
    expect(takeSentences('No end yet')).toEqual([[], 'No end yet']);
    expect(takeSentences('v1.5 is out. ok')).toEqual([['v1.5 is out.'], 'ok']);
  });
});
