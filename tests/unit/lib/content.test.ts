import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  cricket,
  discipline,
  experience,
  isTodo,
  parseContent,
  projects,
  projectSchema,
  site,
  skills,
  timeline,
} from '../../../src/lib/content';

const root = new URL('../../../', import.meta.url);
const contentDir = new URL('content/', root);
const contentFiles = readdirSync(contentDir).filter((f) => /\.(json|md)$/.test(f));

const projectIds = new Set(projects.map((p) => p.id));
const experienceIds = new Set(experience.map((e) => e.id));

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('content files', () => {
  it('has every file from SPEC "Content model"', () => {
    for (const f of [
      'site.json',
      'profile.md',
      'experience.json',
      'projects.json',
      'skills.json',
      'timeline.json',
      'cricket.json',
      'freelance.json',
      'discipline.json',
    ]) {
      expect(contentFiles, f).toContain(f);
    }
  });

  it('never contains a phone number (EDITH must not be able to leak one)', () => {
    for (const f of contentFiles) {
      const raw = readFileSync(new URL(f, contentDir), 'utf8');
      expect(raw, f).not.toMatch(/\+\d{2}[\s-]?\d{5}|\b\d{10}\b/);
    }
  });

  it('reports remaining TODO placeholders', () => {
    const todos = contentFiles.flatMap((f) =>
      readFileSync(new URL(f, contentDir), 'utf8')
        .split('\n')
        .filter((line) => line.includes('TODO'))
        .map((line) => `${f}: ${line.trim()}`),
    );
    console.info(`${todos.length} TODO placeholders left in content/:\n${todos.join('\n')}`);
    expect(todos.length).toBeGreaterThanOrEqual(0);
  });
});

describe('projects', () => {
  it('ids and orders are unique, and project ids never collide with experience ids', () => {
    expect(projectIds.size).toBe(projects.length);
    expect(new Set(projects.map((p) => p.order)).size).toBe(projects.length);
    for (const id of projectIds) expect(experienceIds.has(id), id).toBe(false);
  });

  it('has exactly 5 hero worlds plus the EDITH construction site, first in order', () => {
    const heroes = projects.filter((p) => p.tier === 'hero');
    expect(heroes.map((p) => p.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(heroes.filter((p) => p.id !== 'edith')).toHaveLength(5);
    for (const p of heroes) expect(p.heroScene, p.id).not.toBeNull();
  });

  it('EDITH is building, with a progress value for the gauge', () => {
    const edith = projects.find((p) => p.id === 'edith');
    expect(edith?.status).toBe('building');
    expect(edith?.progress).toBeTruthy();
  });

  it('shipped projects have a year', () => {
    for (const p of projects.filter((p) => p.status === 'shipped'))
      expect(p.year, p.id).not.toBeNull();
  });
});

describe('site', () => {
  it('every proof number comes from its project stats', () => {
    for (const { value, projectId } of site.proof) {
      const project = projects.find((p) => p.id === projectId);
      expect(project, projectId).toBeDefined();
      expect(
        project?.stats.some((s) => s.includes(value)),
        `${value} in ${projectId}`,
      ).toBe(true);
    }
  });

  it('honors link to real projects', () => {
    for (const h of site.honors)
      if (h.projectId) expect(projectIds.has(h.projectId), h.projectId).toBe(true);
  });

  it('"currently building" points at a project that is building', () => {
    expect(projects.find((p) => p.id === site.currentlyBuilding)?.status).toBe('building');
  });
});

describe('skills, experience, timeline, discipline', () => {
  it('every skill evidence id is a project or a role', () => {
    for (const layer of skills)
      for (const s of layer.skills)
        for (const e of s.evidence)
          expect(projectIds.has(e) || experienceIds.has(e), `${s.name} → ${e}`).toBe(true);
  });

  it('experience is newest first', () => {
    const starts = experience.map((e) => e.start);
    expect(starts).toEqual(starts.toSorted().reverse());
  });

  it('timeline channels run 1..n', () => {
    expect(timeline.map((e) => e.channel)).toEqual(timeline.map((_, i) => i + 1));
  });

  it('reel days are unique', () => {
    expect(new Set(discipline.reels.map((r) => r.day)).size).toBe(discipline.reels.length);
  });

  it('every reel and poster ships from public/ and stays under 25 MiB', () => {
    for (const r of discipline.reels)
      for (const p of [r.file, r.poster]) {
        const url = new URL(`public/${p}`, root);
        expect(existsSync(url), p).toBe(true);
        expect(statSync(url).size, p).toBeLessThan(25 * 1024 * 1024);
      }
  });

  it('exactly one reel is featured (it drives the proximity audio)', () => {
    expect(discipline.reels.filter((r) => r.featured)).toHaveLength(1);
  });
});

// assets/incoming/ is gitignored, so this only runs on a machine that has the media.
describe.runIf(existsSync(new URL('assets/incoming/', root)))('media paths', () => {
  it('every referenced file exists', () => {
    const paths = [
      site.resume.source,
      ...timeline.map((e) => e.photo),
      ...strings(cricket).filter((s) => s.startsWith('assets/')),
    ];
    for (const p of paths) expect(existsSync(new URL(p, root)), p).toBe(true);
  });
});

describe('schema guards', () => {
  const valid = projects[0];

  it('rejects an unknown status, an over-long one-liner, unknown keys and missing fields', () => {
    expect(projectSchema.safeParse({ ...valid, status: 'done' }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, oneLiner: 'x'.repeat(91) }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(projectSchema.safeParse({ ...valid, name: undefined }).success).toBe(false);
  });

  it('rejects non-https links', () => {
    const links = { github: 'http://github.com/x', demo: null };
    expect(projectSchema.safeParse({ ...valid, links }).success).toBe(false);
  });

  it('names the file in the error', () => {
    expect(() => parseContent(projectSchema, {}, 'projects.json')).toThrow(
      /content\/projects\.json/,
    );
  });

  it('treats only a "TODO:" prefix as a placeholder', () => {
    expect(isTodo('TODO: one line')).toBe(true);
    expect(isTodo('Done, no TODO here')).toBe(false);
  });
});
