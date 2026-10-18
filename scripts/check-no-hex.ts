// Fails when a raw hex colour appears outside src/styles/tokens.css (CLAUDE.md: no raw hex in components).
import { globSync, readFileSync } from 'node:fs';

const TOKENS = 'src/styles/tokens.css';
// A hex colour after whitespace, ':', '(', ',' or a quote, but not an in-page link like href="#bad".
const HEX = /(?<!href=["'])(?<=[\s:(,"'])#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b/gi;

const files = globSync('src/**/*.{astro,ts,tsx,css}').filter((f) => f !== TOKENS);
const hits = files.flatMap((file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, i) => [...line.matchAll(HEX)].map((m) => `${file}:${i + 1}  ${m[0]}`)),
);

if (hits.length > 0) {
  console.error(`Raw hex colours found (use tokens from ${TOKENS}):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`check-no-hex: ${files.length} files clean`);
