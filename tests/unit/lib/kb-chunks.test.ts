import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cricket,
  discipline,
  experience,
  freelance,
  projects,
  site,
  skills,
  timeline,
} from '../../../src/lib/content';
import { buildChunks, profileChunks } from '../../../src/lib/kb-chunks';

const profile = readFileSync(new URL('../../../content/profile.md', import.meta.url), 'utf8');
const chunks = buildChunks({
  site,
  profile,
  projects,
  experience,
  skills,
  timeline,
  cricket,
  discipline,
  freelance,
});

describe('buildChunks', () => {
  it('gives every chunk a unique id inside the Vectorize limit', () => {
    const ids = chunks.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.length <= 64)).toBe(true);
  });

  it('covers every project, role, skill layer and life chapter in content/', () => {
    const ids = new Set(chunks.map((c) => c.id));
    for (const p of projects) expect(ids.has(`project:${p.id}`), p.id).toBe(true);
    for (const r of experience) expect(ids.has(`role:${r.id}`), r.id).toBe(true);
    for (const s of skills) expect(ids.has(`skills:${s.id}`), s.id).toBe(true);
    for (const e of timeline) expect(ids.has(`life:${e.id}`), e.id).toBe(true);
  });

  it('keeps each chunk small enough to embed and to show in a prompt', () => {
    for (const c of chunks) expect(c.text.length, c.id).toBeLessThanOrEqual(1000);
  });

  it('never indexes the instructions-to-EDITH section or the raw links list', () => {
    const text = chunks.map((c) => c.text).join('\n');
    expect(text).not.toContain('Notes for EDITH');
    expect(text).not.toContain('Politely decline');
  });

  it('is deterministic, so a rebuild upserts the same ids', () => {
    const again = buildChunks({
      site,
      profile,
      projects,
      experience,
      skills,
      timeline,
      cricket,
      discipline,
      freelance,
    });
    expect(again).toEqual(chunks);
  });

  it('says a coming-soon project has not started and a shipped one has a year', () => {
    const soon = projects.find((p) => p.status === 'coming-soon');
    const shipped = projects.find((p) => p.status === 'shipped' && p.year);
    expect(chunks.find((c) => c.id === `project:${soon?.id}`)?.text).toContain('coming soon');
    expect(chunks.find((c) => c.id === `project:${shipped?.id}`)?.text).toContain(
      `shipped in ${shipped?.year}`,
    );
  });

  it('carries a GitHub link only where the project has one', () => {
    for (const p of projects) {
      const chunk = chunks.find((c) => c.id === `project:${p.id}`);
      expect(chunk?.url, p.id).toBe(p.links.github ?? undefined);
    }
  });
});

describe('profileChunks', () => {
  it('splits long sections on paragraph boundaries', () => {
    const long = `# Name\n\n## Story\n\n${'word '.repeat(120)}\n\n${'more '.repeat(120)}\n`;
    const out = profileChunks(long);
    expect(out.length).toBe(2);
    expect(out.map((c) => c.id)).toEqual(['profile:story-1', 'profile:story-2']);
  });
});
