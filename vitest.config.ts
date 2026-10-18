import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // remoteBindings: false keeps unit tests offline; AI and Vectorize are mocked per test when needed.
  plugins: [
    cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' }, remoteBindings: false }),
  ],
  test: {
    include: ['tests/unit/**/*.test.ts'],
  },
});
