// Read endpoints for what the crons cache in KV. Each response is also kept in the colo's edge cache for five
// minutes, so a busy day costs a handful of KV reads rather than one per visitor (free plan: 100,000 reads/day).
import { Hono } from 'hono';
import { GITHUB_KEY } from './github';
import { WEATHER_KEY } from './weather';

export const CACHE_SECONDS = 300;

export const data = new Hono<{ Bindings: Env }>();

for (const [path, key] of [
  ['/github', GITHUB_KEY],
  ['/weather', WEATHER_KEY],
] as const) {
  data.get(path, async (c) => {
    const hit = await caches.default.match(c.req.url);
    if (hit) return hit;
    const raw = await c.env.KV.get(key);
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
