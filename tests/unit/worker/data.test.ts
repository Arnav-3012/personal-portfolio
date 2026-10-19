import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_SECONDS, RETRY_SECONDS, data } from '../../../worker/data';
import { makeCtx, makeEnv, stubFetch } from './helpers';

const get = (path: string, ctx = makeCtx()) => data.request(path, {}, env, ctx.ctx);
let run = 0;
// A fresh URL per test: the edge cache outlives a single test.
const url = (path: string) => `${path}?run=${++run}`;

beforeEach(async () => {
  vi.restoreAllMocks();
  await env.KV.delete('github');
  await env.KV.delete('weather');
  await env.KV.delete('github:tried');
  await env.KV.delete('weather:tried');
  // The worker tests load .dev.vars, so without this an empty cache would call the real network with the real token.
  stubFetch(() => new Response('offline in tests', { status: 503 }));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe.each([
  ['/github', 'github'],
  ['/weather', 'weather'],
])('GET %s', (path, key) => {
  it('answers 404 not_ready, uncached, while KV is empty', async () => {
    const res = await get(url(path));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ ok: false, error: 'not_ready' });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it(`serves the cached JSON with a ${CACHE_SECONDS} s public cache header`, async () => {
    await env.KV.put(key, '{"hello":"world"}');
    const res = await get(url(path));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    expect(res.headers.get('cache-control')).toBe(`public, max-age=${CACHE_SECONDS}`);
    expect(await res.json()).toEqual({ hello: 'world' });
  });

  it('reads KV once, then serves repeat visitors from the edge cache', async () => {
    await env.KV.put(key, '{"n":1}');
    const spy = vi.spyOn(env.KV, 'get');
    const target = url(path);
    const first = makeCtx();
    expect(await (await get(target, first)).json()).toEqual({ n: 1 });
    await first.settled();
    await env.KV.put(key, '{"n":2}');
    for (let i = 0; i < 5; i++) expect(await (await get(target)).json()).toEqual({ n: 1 });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe('filling an empty cache on the first request (no waiting for the cron)', () => {
  const weather = { current: { temperature_2m: 30, weather_code: 0, is_day: 1, precipitation: 0 } };
  const ask = (path: string, testEnv: Env) => data.request(url(path), {}, testEnv, makeCtx().ctx);

  beforeEach(async () => {
    await env.KV.delete('github:tried');
    await env.KV.delete('weather:tried');
  });

  it('fetches weather once, writes KV, and serves it', async () => {
    const spy = stubFetch(() => Response.json(weather));
    const res = await ask('/weather', makeEnv().env);
    expect(res.status).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await env.KV.get('weather')).not.toBeNull();
  });

  it('does not retry inside the retry window when the source is down, and stays a clean 404', async () => {
    const spy = stubFetch(() => new Response('down', { status: 503 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await ask('/weather', makeEnv().env)).status).toBe(404);
    expect((await ask('/weather', makeEnv().env)).status).toBe(404);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await env.KV.get('weather:tried')).toBe('1');
    expect(RETRY_SECONDS).toBeGreaterThanOrEqual(60);
  });

  it('never calls GitHub without a token, and stays 404', async () => {
    const spy = stubFetch(() => Response.json({}));
    const res = await ask('/github', makeEnv().env);
    expect(res.status).toBe(404);
    expect(spy).not.toHaveBeenCalled();
  });

  it('with a token it tries GitHub once per window, and a bad answer leaves the cache empty', async () => {
    const spy = stubFetch(() => new Response('bad', { status: 401 }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const e = makeEnv({ GITHUB_TOKEN: 't' }).env;
    expect((await ask('/github', e)).status).toBe(404);
    const first = spy.mock.calls.length;
    expect(first).toBeGreaterThan(0);
    expect((await ask('/github', e)).status).toBe(404);
    expect(spy.mock.calls.length).toBe(first);
    expect(await env.KV.get('github')).toBeNull();
  });

  it('does not touch the source when the cache is already filled', async () => {
    await env.KV.put('weather', '{"cached":true}');
    const spy = stubFetch(() => Response.json(weather));
    expect(await (await ask('/weather', makeEnv().env)).json()).toEqual({ cached: true });
    expect(spy).not.toHaveBeenCalled();
  });
});
