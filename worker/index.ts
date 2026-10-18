import { Hono } from 'hono';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ ok: true, service: 'arnav-portfolio', time: new Date().toISOString() });
});

app.all('/api/*', (c) => c.json({ ok: false, error: 'not_found' }, 404));

// Admin UI lands in task 1.9, behind Cloudflare Access.
app.all('/admin*', (c) => c.json({ ok: false, error: 'not_ready' }, 503));

// run_worker_first only routes /api/* and /admin* here; anything else falls through to static assets.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
