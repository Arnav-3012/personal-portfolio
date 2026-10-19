// Values Arnav can change from /admin without a deploy (SPEC "Content model", Live values): the freelance switch and
// "currently building". /admin writes KV; the landing reads this endpoint once per visit and patches the page only if
// an override differs from what was built. Edge-cached for a minute, so a busy day costs a handful of KV reads.
import { Hono } from 'hono';
import freelance from '../content/freelance.json' with { type: 'json' };
import projects from '../content/projects.json' with { type: 'json' };

export const FREELANCE_KEY = 'live:freelance';
export const BUILDING_KEY = 'live:building';
export const LIVE_CACHE_SECONDS = 60;
export const NOTE_MAX = 120;

export interface FreelanceOverride {
  open: boolean;
  note: string | null;
}
export interface Live {
  freelance: { open: boolean; label: string; note: string | null } | null;
  building: { id: string; name: string } | null;
}

/** Parses a stored override; anything malformed is ignored so a bad write can never break the landing. */
export function parseFreelance(raw: string | null): FreelanceOverride | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<FreelanceOverride>;
    if (typeof v.open !== 'boolean') return null;
    const note =
      typeof v.note === 'string' && v.note.trim() ? v.note.trim().slice(0, NOTE_MAX) : null;
    return { open: v.open, note };
  } catch {
    return null;
  }
}

export async function readLive(kv: KVNamespace): Promise<Live> {
  const [f, b] = await Promise.all([kv.get(FREELANCE_KEY), kv.get(BUILDING_KEY)]);
  const override = parseFreelance(f);
  const project = projects.find((p) => p.id === b);
  return {
    // Same wording rules as the build: open shows the headline; booked shows the booked label plus the note.
    freelance: override
      ? {
          open: override.open,
          label: override.open ? freelance.headline : freelance.bookedLabel,
          note: override.open ? null : override.note,
        }
      : null,
    building: project ? { id: project.id, name: project.name } : null,
  };
}

export const live = new Hono<{ Bindings: Env }>();

live.get('/live', async (c) => {
  const hit = await caches.default.match(c.req.url);
  if (hit) return hit;
  const res = Response.json(await readLive(c.env.KV), {
    headers: { 'cache-control': `public, max-age=${LIVE_CACHE_SECONDS}` },
  });
  // Awaited, not waitUntil: a write that lands after /admin has cleared the entry would resurrect the old state.
  await caches.default.put(c.req.url, res.clone());
  return res;
});
