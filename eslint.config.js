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
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  prettier,
);
