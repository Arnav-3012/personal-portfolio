import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { cricket, discipline, experience, projects, site, skills } from '../../../src/lib/content';
import { anchorFor, beyondTiles, teaser } from '../../../src/lib/landing';
import { byLevel, evidenceLinks, markdownSection } from '../../../src/lib/skills';

const profile = readFileSync('content/profile.md', 'utf8');

describe('byLevel', () => {
  it('puts core before working before learning and keeps file order within a level', () => {
    const sorted = byLevel([
      { name: 'a', level: 'learning', evidence: [] },
      { name: 'b', level: 'core', evidence: [] },
      { name: 'c', level: 'working', evidence: [] },
      { name: 'd', level: 'core', evidence: [] },
    ]);
    expect(sorted.map((s) => s.name)).toEqual(['b', 'd', 'c', 'a']);
  });

  it('does not mutate its input', () => {
    const input = [
      { name: 'a', level: 'learning' as const, evidence: [] },
      { name: 'b', level: 'core' as const, evidence: [] },
    ];
    byLevel(input);
    expect(input.map((s) => s.name)).toEqual(['a', 'b']);
  });
});

describe('anchorFor / evidenceLinks', () => {
  const pinnedId = projects
    .filter((p) => p.tier === 'hero')
    .toSorted((a, b) => a.order - b.order)[0]?.id;
  const roleId = experience[0]?.id;

  it('links a top-five project to its row, other projects to the index, roles to the rail', () => {
    expect(anchorFor(pinnedId ?? '', projects, experience)).toBe(`#work-${pinnedId}`);
    const other = projects.find((p) => p.tier !== 'hero');
    expect(anchorFor(other?.id ?? '', projects, experience)).toBe('#projects');
    expect(anchorFor(roleId ?? '', projects, experience)).toBe(`#role-${roleId}`);
    expect(anchorFor('nope', projects, experience)).toBeNull();
  });

  it('resolves every evidence id in skills.json to a labelled link', () => {
    for (const layer of skills)
      for (const s of layer.skills) {
        const links = evidenceLinks(s.evidence, projects, experience);
        expect(links, s.name).toHaveLength(s.evidence.length);
        for (const l of links) expect(l.href).toMatch(/^#(work-|role-|projects$)/);
      }
  });

  it('drops an unknown id instead of rendering a dead link', () => {
    expect(evidenceLinks(['nope'], projects, experience)).toEqual([]);
  });
});

describe('markdownSection', () => {
  it('returns the paragraphs of the named section only', () => {
    const md = '# T\n\n## A\n\nfirst line\nsecond line\n\nsecond para\n\n## B\n\nother\n';
    expect(markdownSection(md, 'A')).toEqual(['first line second line', 'second para']);
    expect(markdownSection(md, 'B')).toEqual(['other']);
    expect(markdownSection(md, 'missing')).toEqual([]);
  });

  it('reads the real "Who I am" intro', () => {
    const intro = markdownSection(profile, 'Who I am');
    expect(intro.length).toBeGreaterThanOrEqual(2);
    expect(intro[0]).toContain('Arnav Chaturvedi');
  });
});

describe('teaser / beyondTiles', () => {
  it('keeps whole sentences', () => {
    expect(teaser('One. Two! Three? Four.', 2)).toBe('One. Two!');
    expect(teaser('No stop', 2)).toBe('No stop');
    expect(teaser('Only one.', 3)).toBe('Only one.');
  });

  it('builds the cricket and 75 Hard tiles from content', () => {
    const [cricketTile, hardTile] = beyondTiles(cricket, discipline, projects, experience);
    expect(cricketTile?.text).toBe(teaser(cricket.whyCricket));
    expect(cricketTile?.image.src).toBe(`/${cricket.teaser.file}`);
    expect(cricketTile?.image.position).toBe(cricket.teaser.position);
    expect(cricketTile?.href).toMatch(/^#(work-|projects$)/);
    expect(hardTile?.title).toBe(discipline.headline);
    expect(hardTile?.href).toBe('#75-hard');
    const featured = discipline.reels.find((r) => r.featured);
    expect(hardTile?.image.src).toBe(`/${featured?.poster}`);
  });

  it('site.dock names are short enough for a tile', () => {
    for (const d of site.dock) expect(d.length).toBeLessThanOrEqual(16);
  });
});
