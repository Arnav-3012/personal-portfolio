// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import react from '@astrojs/react';

const fontsource = fontProviders.fontsource();

// Static output into ./dist; the Hono Worker in ./worker serves it via the ASSETS binding.
// Fonts are downloaded at build time and self-hosted from dist (SPEC "Typography": Latin subset, woff2).
export default defineConfig({
  output: 'static',
  integrations: [react()],
  fonts: [
    {
      provider: fontsource,
      name: 'Unbounded',
      cssVariable: '--font-display',
      weights: [600, 700],
      styles: ['normal'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'Geist',
      cssVariable: '--font-body',
      weights: [400, 600],
      styles: ['normal'],
      fallbacks: ['sans-serif'],
    },
    {
      provider: fontsource,
      name: 'JetBrains Mono',
      cssVariable: '--font-mono',
      weights: [500],
      styles: ['normal'],
      fallbacks: ['monospace'],
    },
    {
      provider: fontsource,
      name: 'Fraunces',
      cssVariable: '--font-era',
      weights: [600],
      styles: ['italic'],
      fallbacks: ['serif'],
    },
  ],
});
