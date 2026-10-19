// Chunks content/ and embeds it into Vectorize (SPEC "Content model", EDITH re-index). Runs through Wrangler's own
// authenticated bindings, so it needs `wrangler login` and the `edith-kb` index (768 dims, cosine), nothing else.
//   pnpm kb:build            embed and upsert
//   pnpm kb:build --dry-run  print the chunks, touch nothing
// Chunk ids are stable, so a re-run overwrites. An id that no longer exists stays in the index until it is
// deleted with `wrangler vectorize delete-vectors`; the dry run lists every current id for comparison.
import { readFileSync } from 'node:fs';
import { getPlatformProxy } from 'wrangler';
import { buildChunks, type KbInput } from '../src/lib/kb-chunks.ts';

const EMBED_MODEL = '@cf/baai/bge-base-en-v1.5';
const BATCH = 20;
const read = (file: string): unknown => JSON.parse(readFileSync(`content/${file}`, 'utf8'));

// Only the bindings this script uses (the generated Env type lives in the Worker's tsconfig, not the scripts').
interface Bindings {
  AI: { run(model: string, input: { text: string[] }): Promise<unknown> };
  VECTORIZE: {
    upsert(
      vectors: { id: string; values: number[]; metadata: Record<string, string> }[],
    ): Promise<unknown>;
  };
}

const input = {
  site: read('site.json'),
  profile: readFileSync('content/profile.md', 'utf8'),
  projects: read('projects.json'),
  experience: read('experience.json'),
  skills: read('skills.json'),
  timeline: read('timeline.json'),
  cricket: read('cricket.json'),
  discipline: read('discipline.json'),
  freelance: read('freelance.json'),
} as KbInput;

const chunks = buildChunks(input);
const ids = new Set(chunks.map((c) => c.id));
if (ids.size !== chunks.length) throw new Error('kb:build: duplicate chunk ids');
const tooLong = chunks.filter((c) => c.id.length > 64 || c.text.length > 2000);
if (tooLong.length)
  throw new Error(`kb:build: oversized chunks: ${tooLong.map((c) => c.id).join(', ')}`);

if (process.argv.includes('--dry-run')) {
  for (const c of chunks) console.log(`${c.id.padEnd(40)} ${c.text.length} chars  [${c.source}]`);
  console.log(`\n${chunks.length} chunks (dry run, nothing sent)`);
  process.exit(0);
}

const { env, dispose } = await getPlatformProxy<Bindings>({ configPath: 'wrangler.jsonc' });
try {
  let sent = 0;
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const embedded = (await env.AI.run(EMBED_MODEL, {
      text: batch.map((c) => `Arnav Chaturvedi · ${c.source}\n${c.text}`),
    })) as {
      data: number[][];
    };
    if (embedded.data.length !== batch.length)
      throw new Error('kb:build: embedding count mismatch');
    await env.VECTORIZE.upsert(
      batch.map((c, n) => ({
        id: c.id,
        values: embedded.data[n] ?? [],
        metadata: { source: c.source, text: c.text, ...(c.url ? { url: c.url } : {}) },
      })),
    );
    sent += batch.length;
    console.log(`kb:build: ${sent}/${chunks.length}`);
  }
  console.log(`kb:build: ${chunks.length} chunks upserted into ${EMBED_MODEL} space (edith-kb)`);
} finally {
  await dispose();
}
