import { defineConfig, devices } from '@playwright/test';

const PORT = 8787;
const STATE = '.wrangler/e2e';

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serves the built site through the real Worker. --local disables remote bindings (AI, Vectorize) so e2e needs no Cloudflare login.
  // Every run starts from a fresh local D1 + KV (so the form rate limit never carries over): the migration is applied
  // and Cloudflare's always-pass Turnstile test secret is set.
  webServer: {
    command: [
      `rm -rf ${STATE}`,
      'pnpm build',
      `pnpm wrangler d1 migrations apply DB --local --persist-to ${STATE}`,
      `pnpm wrangler dev --local --port ${PORT} --persist-to ${STATE} --var TURNSTILE_SECRET:1x0000000000000000000000000000000AA`,
    ].join(' && '),
    url: `http://localhost:${PORT}/api/health`,
    // Never reuse: wrangler can orphan workerd on :8787, and a reused server serves a stale ./dist.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
