import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CACHE_SECONDS, data } from '../../../worker/data';
import { makeCtx } from './helpers';

const get = (path: string, ctx = makeCtx()) => data.request(path, {}, env, ctx.ctx);
let run = 0;
// A fresh URL per test: the edge cache outlives a single test.
const url = (path: string) => `${path}?run=${++run}`;

beforeEach(async () => {
  await env.KV.delete('github');
  await env.KV.delete('weather');
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
