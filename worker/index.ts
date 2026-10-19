import { Hono } from 'hono';
import { admin } from './admin';
import { chat } from './chat';
import { runCron } from './cron';
import { data } from './data';
import { forms } from './forms';
import { live } from './live';

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json({ ok: true, service: 'arnav-portfolio', time: new Date().toISOString() });
});

app.route('/api/forms', forms);
app.route('/api/chat', chat);
app.route('/api', data);
app.route('/api', live);

app.all('/api/*', (c) => c.json({ ok: false, error: 'not_found' }, 404));

// Behind Cloudflare Access, and every route re-checks the Access JWT (worker/access.ts).
app.route('/admin', admin);

// run_worker_first only routes /api/* and /admin* here; anything else falls through to static assets.
app.all('*', (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  scheduled(controller, env, ctx) {
    ctx.waitUntil(runCron(controller.cron, env));
  },
} satisfies ExportedHandler<Env>;
