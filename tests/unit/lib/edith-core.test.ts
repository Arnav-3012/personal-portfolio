import { describe, expect, it, vi } from 'vitest';
import {
  FAILURE_TEXT,
  actionFor,
  ask,
  readEvents,
  type ChatEvent,
  type ToolCall,
} from '../../../src/lib/edith-core';

const enc = new TextEncoder();
const streamOf = (...chunks: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start(c) {
      for (const chunk of chunks) c.enqueue(enc.encode(chunk));
      c.close();
    },
  });
const collect = async (events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> => {
  const out: ChatEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
};
const sse = (event: string, data: unknown) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

describe('readEvents', () => {
  const meta = { spoken: 'Hi.', markdown: 'Hi.', sources: [], tools: [] };

  it('yields tokens then meta, even when blocks are split across chunks', async () => {
    const whole = sse('token', { t: 'Hel' }) + sse('token', { t: 'lo.' }) + sse('meta', meta);
    const events = await collect(
      readEvents(streamOf(whole.slice(0, 17), whole.slice(17, 60), whole.slice(60))),
    );
    expect(events).toEqual([
      { type: 'token', text: 'Hel' },
      { type: 'token', text: 'lo.' },
      { type: 'meta', meta },
    ]);
  });

  it('reads an error event and skips damaged or unknown blocks', async () => {
    const events = await collect(
      readEvents(
        streamOf(
          'event: token\ndata: {nope\n\n',
          sse('mystery', {}),
          sse('error', { error: 'stream' }),
        ),
      ),
    );
    expect(events).toEqual([{ type: 'error' }]);
  });

  it('parses a final block with no trailing blank line', async () => {
    const events = await collect(readEvents(streamOf(sse('token', { t: 'a' }).trimEnd())));
    expect(events).toEqual([{ type: 'token', text: 'a' }]);
  });
});

describe('ask', () => {
  const base = {
    message: 'hi',
    history: [],
    session: null,
    turnstile: () => Promise.resolve('tok'),
  };
  const reply = (status: number, body?: ReadableStream<Uint8Array>) =>
    vi.fn(() => Promise.resolve(new Response(body ?? null, { status })));

  it('sends the Turnstile token on the first message and the session afterwards', async () => {
    const f = reply(200, streamOf(''));
    await ask(base, f as unknown as typeof fetch);
    const first = JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(first).toMatchObject({ message: 'hi', turnstile: 'tok' });
    expect(first.session).toBeUndefined();

    const turnstile = vi.fn(() => Promise.resolve('never'));
    const g = reply(200, streamOf(''));
    await ask({ ...base, session: 's.1', turnstile }, g as unknown as typeof fetch);
    const second = JSON.parse(
      String((g.mock.calls[0] as unknown as [string, RequestInit])[1].body),
    );
    expect(second).toMatchObject({ session: 's.1' });
    expect(second.turnstile).toBeUndefined();
    expect(turnstile).not.toHaveBeenCalled();
  });

  it('fails without sending when the bot check cannot produce a token', async () => {
    const f = reply(200);
    const r = await ask(
      { ...base, turnstile: () => Promise.resolve(null) },
      f as unknown as typeof fetch,
    );
    expect(r).toEqual({ ok: false, reason: 'verification' });
    expect(f).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'verification'],
    [429, 'limited'],
    [422, 'invalid'],
    [413, 'invalid'],
    [503, 'unavailable'],
    [500, 'unavailable'],
    [404, 'unavailable'],
  ])('maps HTTP %i to %s', async (status, reason) => {
    expect(await ask(base, reply(status) as unknown as typeof fetch)).toEqual({
      ok: false,
      reason,
    });
  });

  it('maps a thrown fetch to network', async () => {
    const f = vi.fn(() => Promise.reject(new TypeError('offline')));
    expect(await ask(base, f as unknown as typeof fetch)).toEqual({ ok: false, reason: 'network' });
  });

  it('has a human sentence for every failure', () => {
    for (const text of Object.values(FAILURE_TEXT)) expect(text.length).toBeGreaterThan(20);
  });
});

describe('actionFor', () => {
  const has = (ids: string[]) => (id: string) => ids.includes(id);
  const call = (name: ToolCall['name'], arg?: string): ToolCall => (arg ? { name, arg } : { name });

  it('scrolls only to sections that exist on the page', () => {
    expect(actionFor(call('scrollTo', 'work'), has(['work']))).toEqual({
      kind: 'scroll',
      target: 'work',
    });
    expect(actionFor(call('scrollTo', 'work'), has([]))).toBeNull();
    expect(actionFor(call('scrollTo'), has(['work']))).toBeNull();
  });

  it('takes a hero project to its row, and any other project to the index', () => {
    expect(
      actionFor(call('openProject', 'firewatch'), has(['work-firewatch', 'projects'])),
    ).toEqual({
      kind: 'scroll',
      target: 'work-firewatch',
    });
    expect(actionFor(call('openProject', 'taskflow'), has(['projects']))).toEqual({
      kind: 'scroll',
      target: 'projects',
    });
    expect(actionFor(call('openProject'), has(['projects']))).toBeNull();
  });

  it('opens the freelance form, the resume and the workshop through the page', () => {
    expect(actionFor(call('startFreelanceForm'), has([]))).toEqual({
      kind: 'form',
      target: 'freelance',
    });
    expect(actionFor(call('openResume'), has([]))).toMatchObject({
      kind: 'click',
      target: 'a[href$=".pdf"]',
    });
    expect(actionFor(call('enterWorkshop'), has([]))).toMatchObject({
      kind: 'click',
      target: 'a[href="/workshop"]',
    });
  });
});
