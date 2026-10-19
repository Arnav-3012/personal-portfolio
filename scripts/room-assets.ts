// Fetches the workshop's furniture and props from Poly Haven (all CC0) and compresses each one for the web:
// Draco meshes, 512 px WebP textures, one .glb per model in public/media/room/. Run `pnpm room:assets` after changing
// MODELS; the output is committed, so a normal build never touches the network. Credits live in content/credits.json.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

/** Poly Haven asset ids (https://polyhaven.com/a/<id>). */
const MODELS = ['modern_arm_chair_01', 'ceramic_vase_02'];

const OUT = 'public/media/room';
// Poly Haven refuses requests without a browser-like user agent.
const headers = { 'user-agent': 'Mozilla/5.0 (portfolio asset build)' };

interface Include {
  url: string;
}
interface Files {
  gltf: { '1k': { gltf: { url: string; include?: Record<string, Include> } } };
}

async function download(url: string, to: string): Promise<void> {
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  mkdirSync(dirname(to), { recursive: true });
  writeFileSync(to, Buffer.from(await res.arrayBuffer()));
}

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'room-assets-'));
let total = 0;
try {
  for (const id of MODELS) {
    const res = await fetch(`https://api.polyhaven.com/files/${id}`, { headers });
    if (!res.ok) throw new Error(`${id}: files API answered ${res.status}`);
    const gltf = ((await res.json()) as Files).gltf['1k'].gltf;
    const dir = join(work, id);
    await download(gltf.url, join(dir, `${id}.gltf`));
    for (const [rel, file] of Object.entries(gltf.include ?? {}))
      await download(file.url, join(dir, rel));
    const out = join(OUT, `${id}.glb`);
    execFileSync(
      'pnpm',
      [
        'dlx',
        '@gltf-transform/cli',
        'optimize',
        join(dir, `${id}.gltf`),
        out,
        '--compress',
        'draco',
        '--texture-compress',
        'webp',
        '--texture-size',
        '512',
      ],
      { stdio: 'ignore' },
    );
    const size = statSync(out).size;
    total += size;
    console.log(`${id.padEnd(32)} ${(size / 1024).toFixed(0).padStart(5)} KB`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`room-assets: ${MODELS.length} models, ${(total / 1024 / 1024).toFixed(2)} MB`);
