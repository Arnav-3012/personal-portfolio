// EDITH's knowledge base (SPEC "EDITH tab", Agent): content/ cut into small chunks that are embedded into
// Vectorize by scripts/kb-build.ts. Pure and deterministic: ids are stable, so a rebuild upserts instead of
// duplicating, and the chunk text is the only thing the model ever sees about Arnav.
import type {
  Cricket,
  Discipline,
  Era,
  Experience,
  Freelance,
  Project,
  SkillLayer,
  Site,
} from './content';

export interface Chunk {
  /** Stable id: `<kind>:<slug>`. Vectorize ids are capped at 64 bytes. */
  id: string;
  /** Short label shown as a source chip under an answer. */
  source: string;
  text: string;
  /** Optional public link shown with the source chip (a project's GitHub). */
  url?: string;
}

export interface KbInput {
  site: Site;
  profile: string;
  projects: readonly Project[];
  experience: readonly Experience[];
  skills: readonly SkillLayer[];
  timeline: readonly Era[];
  cricket: Pick<Cricket, 'whyCricket'>;
  discipline: Pick<Discipline, 'headline' | 'subLine' | 'rules' | 'lesson'>;
  freelance: Freelance;
}

const MAX_CHUNK_CHARS = 900;

/** Profile sections that are instructions for EDITH or plain links, not facts to retrieve. */
const SKIPPED_HEADINGS = new Set(['Notes for EDITH', 'Links']);

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Splits `profile.md` on its `##` headings; a long section is cut on paragraph boundaries. */
export function profileChunks(markdown: string): Chunk[] {
  const out: Chunk[] = [];
  const parts = markdown.split(/^## /m).slice(1);
  for (const part of parts) {
    const [heading = '', ...body] = part.split('\n');
    const title = heading.trim();
    if (SKIPPED_HEADINGS.has(title)) continue;
    const paragraphs = body
      .join('\n')
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    let current = '';
    let n = 0;
    const flush = (): void => {
      if (!current) return;
      n += 1;
      out.push({
        id: `profile:${slug(title)}-${n}`,
        source: `About · ${title}`,
        text: `${title}\n${current}`,
      });
      current = '';
    };
    for (const p of paragraphs) {
      if (current && current.length + p.length > MAX_CHUNK_CHARS) flush();
      current = current ? `${current}\n\n${p}` : p;
    }
    flush();
  }
  return out;
}

const statusLine = (p: Project): string => {
  if (p.status === 'shipped') return `shipped${p.year ? ` in ${p.year}` : ''}`;
  return p.status === 'building' ? 'being built now' : 'coming soon, not started yet';
};

export function buildChunks(input: KbInput): Chunk[] {
  const { site } = input;
  const chunks: Chunk[] = [...profileChunks(input.profile)];

  for (const p of input.projects) {
    const lines = [
      `Project: ${p.name}. ${p.oneLiner}.`,
      `Status: ${statusLine(p)}.`,
      p.stats.length ? `Results: ${p.stats.join('; ')}.` : '',
      p.stack.length ? `Stack: ${p.stack.join(', ')}.` : '',
      p.progress ? `Progress: ${p.progress}.` : '',
      p.links.github ? `GitHub: ${p.links.github}` : '',
      p.links.demo ? `Demo: ${p.links.demo}` : '',
    ];
    chunks.push({
      id: `project:${p.id}`,
      source: `Projects · ${p.name}`,
      text: lines.filter(Boolean).join('\n'),
      ...(p.links.github ? { url: p.links.github } : {}),
    });
  }

  for (const r of input.experience) {
    chunks.push({
      id: `role:${r.id}`,
      source: `Experience · ${r.company}`,
      text: [
        `Role: ${r.title} at ${r.company}${r.companyNote ? ` (${r.companyNote})` : ''}, ${r.location}. ${r.dates}.`,
        ...r.impact.map((line) => `- ${line}`),
        r.stack.length ? `Stack: ${r.stack.join(', ')}.` : '',
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  // Overviews answer broad questions ("where has he worked?", "what has he built?") that no single chunk can.
  chunks.push({
    id: 'overview:roles',
    source: 'Experience',
    text: `Work history: where Arnav has worked (companies, jobs, internships, employers). All of his roles, newest first:\n${input.experience
      .map((r) => `- ${r.title} at ${r.company}, ${r.dates}`)
      .join('\n')}`,
  });
  for (const status of ['shipped', 'building', 'coming-soon'] as const) {
    const names = input.projects.filter((p) => p.status === status).map((p) => p.name);
    if (names.length)
      chunks.push({
        id: `overview:projects-${status}`,
        source: 'Projects',
        text: `What Arnav has built (${status === 'coming-soon' ? 'coming soon, not started' : status} projects): ${names.join(', ')}.`,
      });
  }
  chunks.push({
    id: 'overview:skills',
    source: 'Skills',
    text: `What Arnav is good at, his tech stack and core skills: ${input.skills
      .flatMap((l) => l.skills.filter((s) => s.level === 'core').map((s) => s.name))
      .join(', ')}.`,
  });

  for (const layer of input.skills) {
    const byLevel = (level: string): string =>
      layer.skills
        .filter((s) => s.level === level)
        .map((s) => s.name)
        .join(', ');
    chunks.push({
      id: `skills:${layer.id}`,
      source: `Skills · ${layer.layer}`,
      text: [
        `Skills, ${layer.layer}:`,
        byLevel('core') && `Core: ${byLevel('core')}.`,
        byLevel('working') && `Working knowledge: ${byLevel('working')}.`,
        byLevel('learning') && `Learning: ${byLevel('learning')}.`,
      ]
        .filter(Boolean)
        .join('\n'),
    });
  }

  for (const era of input.timeline)
    chunks.push({
      id: `life:${era.id}`,
      source: `Life · ${era.title}`,
      text: `Life chapter "${era.title}" (${era.years}): ${era.lines.join(' ')}`,
    });

  chunks.push(
    {
      id: 'cricket:why',
      source: 'Beyond code · Cricket',
      text: `Why cricket: ${input.cricket.whyCricket}`,
    },
    {
      id: 'discipline:75-hard',
      source: 'Beyond code · 75 Hard',
      text: `${input.discipline.headline} ${input.discipline.subLine}\nRules: ${input.discipline.rules.join('; ')}.\nWhat it taught: ${input.discipline.lesson}`,
    },
    {
      id: 'freelance:services',
      source: 'Freelance',
      text: [
        input.freelance.open
          ? 'Arnav is open to freelance work.'
          : `Arnav is currently booked${input.freelance.note ? `: ${input.freelance.note}` : ''}.`,
        'Services:',
        ...input.freelance.services.map((s) => `- ${s.title}: ${s.description}`),
        `Typical timelines: ${input.freelance.timelines.join(', ')}.`,
      ].join('\n'),
    },
    {
      id: 'site:contact',
      source: 'Contact',
      text: [
        `Contact: use the contact form on the site, or email ${site.email}.`,
        `LinkedIn: ${site.socials.linkedin}`,
        `GitHub: ${site.socials.github}`,
        `Instagram: ${site.socials.instagram}`,
        `Based in ${site.location.city}, ${site.location.country}.`,
      ].join('\n'),
    },
    {
      id: 'site:education',
      source: 'About · Education',
      text: `Education: ${site.education.degree} at ${site.education.school}, ${site.education.dates}.`,
    },
  );

  if (site.honors.length)
    chunks.push({
      id: 'site:honors',
      source: 'About · Honors',
      text: `Hackathons and honors: ${site.honors.map((h) => `${h.event} ${h.year}, ${h.result}`).join('; ')}.`,
    });

  return chunks;
}
