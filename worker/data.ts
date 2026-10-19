// Read endpoints for what the crons cache in KV. Each response is also kept in the colo's edge cache for five
// minutes, so a busy day costs a handful of KV reads rather than one per visitor (free plan: 100,000 reads/day).
import { Hono } from 'hono';
import { GITHUB_KEY, refreshGithub } from './github';
import { WEATHER_KEY, refreshWeather } from './weather';

export const CACHE_SECONDS = 300;

/**
 * The cron fills these caches every 6 hours (GitHub) and 30 minutes (weather), so right after a deploy they are empty.
 * The first request then fills the cache itself. One attempt per key every two minutes (KV's minimum TTL is 60 s),
 * so a bad token or an API outage cannot turn visitors into a stream of GitHub calls.
 */
export const RETRY_SECONDS = 120;
const LAZY: Record<string, (env: Env) => Promise<unknown>> = {
  [GITHUB_KEY]: (env) => (env.GITHUB_TOKEN ? refreshGithub(env) : Promise.resolve()),
  [WEATHER_KEY]: (env) => refreshWeather(env),
};

async function fillIfEmpty(env: Env, key: string): Promise<string | null> {
  const refresh = LAZY[key];
  if (!refresh) return null;
  const marker = `${key}:tried`;
  if (await env.KV.get(marker)) return null;
  await env.KV.put(marker, '1', { expirationTtl: RETRY_SECONDS });
  try {
    await refresh(env);
  } catch (error) {
    console.error(`data: filling ${key} failed`, error);
    return null;
  }
  return env.KV.get(key);
}

export const data = new Hono<{ Bindings: Env }>();

for (const [path, key] of [
  ['/github', GITHUB_KEY],
  ['/weather', WEATHER_KEY],
] as const) {
  data.get(path, async (c) => {
    const hit = await caches.default.match(c.req.url);
    if (hit) return hit;
    const raw = (await c.env.KV.get(key)) ?? (await fillIfEmpty(c.env, key));
    // Nothing cached yet (before the first cron run, or no token): the landing shows its fallback.
    if (raw === null)
      return c.json({ ok: false, error: 'not_ready' }, 404, { 'Cache-Control': 'no-store' });
    const res = new Response(raw, {
      headers: {
        'content-type': 'application/json',
        'cache-control': `public, max-age=${CACHE_SECONDS}`,
      },
    });
    c.executionCtx.waitUntil(caches.default.put(c.req.url, res.clone()));
    return res;
  });
}
