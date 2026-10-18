// Skills / About section (SPEC row 7), kept pure so it's unit-tested. Layers come from skills.json; the intro
// comes from the first section of profile.md.
import type { Experience, Project, SkillLayer } from './content';
import { anchorFor } from './landing';

export type Skill = SkillLayer['skills'][number];

const RANK = { core: 0, working: 1, learning: 2 } as const;
export const LEVEL_LABEL = { core: 'Core', working: 'Working', learning: 'Learning' } as const;

/** Core first, then working, then learning; the file order breaks ties (toSorted is stable). */
export const byLevel = (skills: readonly Skill[]): Skill[] =>
  skills.toSorted((a, b) => RANK[a.level] - RANK[b.level]);

export interface EvidenceLink {
  id: string;
  label: string;
  href: string;
}

/** Evidence ids are projects or roles; each becomes a link to where that proof lives on the page. */
export function evidenceLinks(
  ids: readonly string[],
  projects: readonly Project[],
  roles: readonly Pick<Experience, 'id' | 'company'>[],
): EvidenceLink[] {
  return ids.flatMap((id) => {
    const href = anchorFor(id, projects, roles);
    const label =
      projects.find((p) => p.id === id)?.name ?? roles.find((r) => r.id === id)?.company;
    return href && label ? [{ id, label, href }] : [];
  });
}

/** The paragraphs under one `## heading` of a Markdown file, up to the next `## `. */
export function markdownSection(markdown: string, heading: string): string[] {
  const lines = markdown.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trim() === `## ${heading}`);
  if (start === -1) return [];
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((l) => l.startsWith('## '));
  return (end === -1 ? rest : rest.slice(0, end))
    .join('\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}
