import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        // Worker code runs in the Workers runtime. remoteBindings: false keeps unit tests offline;
        // AI and Vectorize are mocked per test when needed.
        plugins: [
          cloudflareTest({ wrangler: { configPath: './wrangler.jsonc' }, remoteBindings: false }),
        ],
        test: { name: 'worker', include: ['tests/unit/worker/**/*.test.ts'] },
      },
      {
        // Browser-side libraries (src/lib) and token checks run in Node with injected fakes.
        test: { name: 'lib', include: ['tests/unit/lib/**/*.test.ts'], environment: 'node' },
      },
    ],
  },
});
