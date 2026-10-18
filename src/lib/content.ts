// Typed access to content/* (SPEC "Content model"). Every file is parsed with zod at import, so invalid
// content fails `astro build` instead of shipping. Cross-file checks (ids that must exist elsewhere) live in
// tests/unit/lib/content.test.ts. A string starting with "TODO:" is a placeholder Arnav still has to fill.
import { z } from 'astro/zod';
import siteJson from '../../content/site.json' with { type: 'json' };
import projectsJson from '../../content/projects.json' with { type: 'json' };
import experienceJson from '../../content/experience.json' with { type: 'json' };
import skillsJson from '../../content/skills.json' with { type: 'json' };
import timelineJson from '../../content/timeline.json' with { type: 'json' };
import cricketJson from '../../content/cricket.json' with { type: 'json' };
import disciplineJson from '../../content/discipline.json' with { type: 'json' };
import freelanceJson from '../../content/freelance.json' with { type: 'json' };

export const TODO_PREFIX = 'TODO:';

// Length caps keep copy inside its UI slot: a 2-line card line, a mono chip, a marquee item.
const text = z.string().trim().min(1);
const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case id');
const media = z.string().startsWith('assets/');
const url = z.url({ protocol: /^https$/ });
const year = z.number().int().min(2000).max(2100);
const yearMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'YYYY-MM');
const sound = z.object({ src: z.string(), positional: z.boolean(), radius: z.number().positive() });

export const siteSchema = z.strictObject({
  name: text,
  shortName: text,
  monogram: text.max(3),
  roleLine: text.max(60),
  location: z.strictObject({
    city: text,
    country: text,
    lat: z.number().min(-90).max(90),
    lon: z.number().min(-180).max(180),
    timezone: text,
  }),
  email: z.email(),
  socials: z.strictObject({ linkedin: url, github: url, instagram: url }),
  resume: z.strictObject({ source: media, file: z.string().regex(/^[a-z0-9-]+\.pdf$/) }),
  currentlyBuilding: id,
  education: z.strictObject({ school: text, degree: text, dates: text }),
  proof: z
    .array(z.strictObject({ value: text.max(12), label: text.max(20), projectId: id }))
    .min(3),
  honors: z.array(z.strictObject({ event: text, year, result: text, projectId: id.nullable() })),
  dock: z.array(text).min(1).max(12),
});

export const PROJECT_STATUSES = ['shipped', 'building', 'coming-soon'] as const;
export const PROJECT_TIERS = ['hero', 'diorama', 'wall'] as const;

export const projectSchema = z.strictObject({
  id,
  name: text.max(40),
  oneLiner: text.max(90),
  status: z.enum(PROJECT_STATUSES),
  tier: z.enum(PROJECT_TIERS),
  heroScene: id.nullable(),
  world: z.enum(['cricket']).optional(),
  order: z.number().int().positive(),
  year: year.nullable(),
  stats: z.array(text.max(28)),
  stack: z.array(text.max(28)),
  links: z.strictObject({ github: url.nullable(), demo: url.nullable() }),
  progress: text.nullable(),
  sound: sound.optional(),
});
export const projectsSchema = z.array(projectSchema).min(1);

export const experienceSchema = z.array(
  z.strictObject({
    id,
    company: text,
    companyNote: text.nullable(),
    title: text,
    location: text,
    start: yearMonth,
    end: yearMonth.nullable(),
    dates: text,
    impact: z.array(text.max(140)).min(1).max(3),
    stack: z.array(text.max(28)),
  }),
);

export const SKILL_LEVELS = ['core', 'working', 'learning'] as const;
export const skillsSchema = z.array(
  z.strictObject({
    id,
    layer: text,
    skills: z.array(
      z.strictObject({ name: text.max(40), level: z.enum(SKILL_LEVELS), evidence: z.array(id) }),
    ),
  }),
);

export const timelineSchema = z.array(
  z.strictObject({
    id,
    channel: z.number().int().positive(),
    title: text.max(40),
    years: text,
    lines: z.array(text).min(1).max(3),
    photo: media,
    photoAlt: text,
  }),
);

export const cricketSchema = z.strictObject({
  whyCricket: text,
  clips: z.array(z.strictObject({ file: media, caption: text })),
  photos: z.array(z.strictObject({ file: media, caption: text, alt: text })),
  posters: z.array(media),
});

export const disciplineSchema = z.strictObject({
  headline: text,
  subLine: text,
  rules: z.array(text).min(1),
  lesson: text,
  reels: z.array(
    z.strictObject({
      file: media,
      poster: media,
      day: z.number().int().min(1).max(75),
      caption: text.max(40),
      featured: z.boolean(),
    }),
  ),
});

export const freelanceSchema = z.strictObject({
  open: z.boolean(),
  note: text.nullable(),
  headline: text,
  bookedLabel: text,
  services: z
    .array(z.strictObject({ id, title: text.max(30), description: text.max(90) }))
    .length(4),
  timelines: z.array(text).min(1),
  confirmation: text,
  // Shown beside the form with site.email; the address itself lives only in site.json.
  emailLine: text.max(60),
});

export type Site = z.infer<typeof siteSchema>;
export type Project = z.infer<typeof projectSchema>;
export type Experience = z.infer<typeof experienceSchema>[number];
export type SkillLayer = z.infer<typeof skillsSchema>[number];
export type Era = z.infer<typeof timelineSchema>[number];
export type Cricket = z.infer<typeof cricketSchema>;
export type Discipline = z.infer<typeof disciplineSchema>;
export type Freelance = z.infer<typeof freelanceSchema>;

/** Parses one content file; the error names the file so a build failure points straight at it. */
export function parseContent<T>(schema: z.ZodType<T>, data: unknown, file: string): T {
  const result = schema.safeParse(data);
  if (!result.success)
    throw new Error(`content/${file} is invalid:\n${z.prettifyError(result.error)}`);
  return result.data;
}

export const site = parseContent(siteSchema, siteJson, 'site.json');
export const projects = parseContent(projectsSchema, projectsJson, 'projects.json').toSorted(
  (a, b) => a.order - b.order,
);
export const experience = parseContent(experienceSchema, experienceJson, 'experience.json');
export const skills = parseContent(skillsSchema, skillsJson, 'skills.json');
export const timeline = parseContent(timelineSchema, timelineJson, 'timeline.json');
export const cricket = parseContent(cricketSchema, cricketJson, 'cricket.json');
export const discipline = parseContent(disciplineSchema, disciplineJson, 'discipline.json');
export const freelance = parseContent(freelanceSchema, freelanceJson, 'freelance.json');

export const isTodo = (value: unknown): boolean =>
  typeof value === 'string' && value.startsWith(TODO_PREFIX);
