import { defineConfig, devices } from '@playwright/test';

const PORT = 8787;

export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: `http://localhost:${PORT}` },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Serves the built site through the real Worker. --local disables remote bindings (AI, Vectorize) so e2e needs no Cloudflare login.
  webServer: {
    command: `pnpm build && pnpm wrangler dev --local --port ${PORT}`,
    url: `http://localhost:${PORT}/api/health`,
    // Never reuse: wrangler can orphan workerd on :8787, and a reused server serves a stale ./dist.
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
