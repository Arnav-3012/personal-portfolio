// Live overrides from /admin (SPEC "Content model", Live values). The page is static, so the freelance switch and
// "currently building" are patched in after load. Only the small fetch lives in the landing bundle: the patching code
// (live-apply.ts) is fetched only when an override actually exists, which is almost never.
import { afterFirstSign } from './idle';
import type { Live } from './live-apply';

export type { Live } from './live-apply';

export function initLive(doc: Document = document, fetchImpl: typeof fetch = fetch): void {
  // After the first sign of a visitor, so the request is never part of the first paint's critical path.
  afterFirstSign(() => {
    void fetchImpl('/api/live', { credentials: 'omit' })
      .then((res) => (res.ok ? (res.json() as Promise<Live>) : null))
      .then(async (live) => {
        if (!live || (!live.freelance && !live.building)) return;
        (await import('./live-apply')).applyLive(live, doc);
      })
      .catch(() => undefined);
  });
}
