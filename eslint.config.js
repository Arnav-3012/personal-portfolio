import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import astro from 'eslint-plugin-astro';
import jsxA11y from 'eslint-plugin-jsx-a11y-x';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig(
  globalIgnores([
    'dist/',
    'public/draco/',
    '.astro/',
    '.wrangler/',
    'worker-configuration.d.ts',
    'playwright-report/',
    'test-results/',
    '.lighthouseci/',
  ]),
  js.configs.recommended,
  tseslint.configs.strict,
  astro.configs.recommended,
  {
    files: ['**/*.{jsx,tsx}'],
    extends: [jsxA11y.configs.recommended, reactHooks.configs.flat.recommended],
  },
  {
    // React Three Fiber scenes mutate three.js objects (materials, lights, uniforms) from per-frame callbacks by design;
    // the compiler rule meant for React state cannot tell the two apart.
    files: ['src/components/workshop/**/*.tsx'],
    rules: { 'react-hooks/immutability': 'off' },
  },
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  prettier,
);
