// Fails the build when the landing HTML outgrows its first network flight. Lighthouse's mobile model sends the
// first ~14.6 KB of a response in one round trip, and a larger document costs another ~150 ms of LCP (task
// 1.5cd: 15.4 KB gave LCP 2107 ms against the 2000 ms budget; 13.9 KB gave 1956 ms). Lighthouse's own gzip runs
// about 2% above Node's level 9, so the limit leaves that margin under the largest document known to pass.
// To make room, move interaction-only markup into JavaScript instead of raising the limit.
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const FILE = 'dist/index.html';
const LIMIT = 14_200;

const size = gzipSync(readFileSync(FILE), { level: 9 }).length;
if (size > LIMIT) {
  console.error(
    `${FILE} is ${size} B gzipped, over the ${LIMIT} B first-flight budget (LCP budget; see this script's header).`,
  );
  process.exit(1);
}
console.log(`check-html-budget: ${FILE} ${size} B gzipped (limit ${LIMIT})`);
