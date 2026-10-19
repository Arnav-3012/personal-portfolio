import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import freelance from '../../../content/freelance.json';
import projects from '../../../content/projects.json';
import {
  BUILDING_KEY,
  FREELANCE_KEY,
  LIVE_CACHE_SECONDS,
  live,
  parseFreelance,
  readLive,
} from '../../../worker/live';
import { makeCtx } from './helpers';

let run = 0;
const get = () => live.request(`/live?run=${++run}`, {}, env, makeCtx().ctx);

beforeEach(async () => {
  await env.KV.delete(FREELANCE_KEY);
  await env.KV.delete(BUILDING_KEY);
});

describe('parseFreelance', () => {
  it('reads a valid override and trims the note', () => {
    expect(parseFreelance('{"open":false,"note":"  Back in March  "}')).toEqual({
      open: false,
      note: 'Back in March',
    });
    expect(parseFreelance('{"open":true,"note":""}')).toEqual({ open: true, note: null });
  });
  it('caps the note and ignores anything malformed', () => {
    expect(
      parseFreelance(JSON.stringify({ open: false, note: 'x'.repeat(500) }))?.note,
    ).toHaveLength(120);
    for (const bad of [null, '', 'nope', '[]', '{"open":"yes"}', '{"note":"x"}'])
      expect(parseFreelance(bad), String(bad)).toBeNull();
  });
});

describe('GET /live', () => {
  it('has no overrides by default, with a short public cache', async () => {
    const res = await get();
    expect(await res.json()).toEqual({ freelance: null, building: null });
    expect(res.headers.get('cache-control')).toBe(`public, max-age=${LIVE_CACHE_SECONDS}`);
  });

  it('turns a booked override into the booked label plus the note', async () => {
    await env.KV.put(FREELANCE_KEY, JSON.stringify({ open: false, note: 'Back in March' }));
    expect((await readLive(env.KV)).freelance).toEqual({
      open: false,
      label: freelance.bookedLabel,
      note: 'Back in March',
    });
  });

  it('an open override shows the headline and never a note', async () => {
    await env.KV.put(FREELANCE_KEY, JSON.stringify({ open: true, note: 'stale' }));
    expect((await readLive(env.KV)).freelance).toEqual({
      open: true,
      label: freelance.headline,
      note: null,
    });
  });

  it('resolves the building override to a project name, and ignores unknown ids', async () => {
    const p = projects[1];
    await env.KV.put(BUILDING_KEY, p?.id ?? '');
    expect((await readLive(env.KV)).building).toEqual({ id: p?.id, name: p?.name });
    await env.KV.put(BUILDING_KEY, 'not-a-project');
    expect((await readLive(env.KV)).building).toBeNull();
  });

  it('survives a damaged KV value', async () => {
    await env.KV.put(FREELANCE_KEY, '{broken');
    expect((await readLive(env.KV)).freelance).toBeNull();
  });
});
