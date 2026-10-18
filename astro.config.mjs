// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

// Static output into ./dist; the Hono Worker in ./worker serves it via the ASSETS binding.
export default defineConfig({
  output: 'static',
  integrations: [react()],
});
