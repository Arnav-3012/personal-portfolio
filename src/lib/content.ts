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
// Files that ship with the site live in public/ and are referenced without the "public/" prefix.
const publicMedia = z.string().regex(/^media\/[a-z0-9/-]+\.(mp4|jpg)$/, 'path under public/media/');
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
  // Public Turnstile site key (the secret lives in the Worker). Cloudflare's always-pass test key until 1.10.
  turnstileSiteKey: text.max(60),
  socials: z.strictObject({ linkedin: url, github: url, instagram: url }),
  resume: z.strictObject({ source: media, file: z.string().regex(/^[a-z0-9-]+\.pdf$/) }),
  portrait: z.strictObject({ alt: text.max(120) }),
  // ARNAV-OS boot: input tokens flow through the transformer and decode `output` letter by letter;
  // log lines ("[ OK ]" / "[ !! ]" pick the status colour) print in the HUD corner.
  boot: z.strictObject({
    tokens: z.array(text.max(10)).min(3).max(8),
    output: text.max(12),
    log: z.array(text.max(40)).min(2).max(8),
  }),
  currentlyBuilding: id,
  // The Workshop entry (Phase 2a): nav label, the /workshop page copy and the zone list. Each zone links to the 2D
  // section that holds the same thing until the 3D room opens.
  workshop: z.strictObject({
    navLabel: text.max(16),
    title: text.max(40),
    status: text.max(40),
    lead: text.max(240),
    note: text.max(80),
    tryAnyway: text.max(24),
    tryAnywayReply: text.max(200),
    zonesLabel: text.max(60),
    // The pencil note and arrow that appear beside the head when the pointer nears the brain.
    handNote: text.max(32),
    // The same pencil note, offered once to a visitor who has not found the brain: by pointer, or by finger.
    hoverNote: text.max(32),
    tapNote: text.max(32),
    // The entry sequence (brain → globe → Mumbai): its readouts and the skip button.
    sequence: z.strictObject({ locking: text.max(30), status: text.max(40), skip: text.max(16) }),
    // The 3D room's own copy (HUD, loader, fallback). Zone titles and blurbs are below.
    room: z.strictObject({
      loading: text.max(40),
      backToSite: text.max(24),
      unavailable: text.max(120),
      listLabel: text.max(40),
      overview: text.max(24),
      hint: text.max(120),
      openOnSite: text.max(40),
      lowPower: text.max(80),
      day: text.max(12),
      night: text.max(12),
      rain: text.max(12),
      clockLabel: text.max(16),
      walk: text.max(24),
      keepWalking: text.max(24),
      stopWalking: text.max(24),
      walkHint: text.max(120),
      openPrompt: text.max(16),
    }),
    zones: z
      .array(
        z.strictObject({
          id,
          title: text.max(40),
          blurb: text.max(90),
          href: z.string().regex(/^\/#[a-z0-9-]+$/, 'a /#section link'),
        }),
      )
      .min(8),
  }),
  // EDITH-lite widget copy (the model never writes these): three starter questions, input hint, opening line.
  edith: z.strictObject({
    chips: z.array(text.max(40)).length(3),
    placeholder: text.max(60),
    intro: text.max(200),
    // The line the launcher's speech bubble shows once, a few seconds in.
    nudge: text.max(60),
  }),
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
  // The one photo that ships with the landing's Beyond code tile (public/media/cricket/).
  // `position` is the CSS object-position that keeps the subject in frame when the tile crops the photo.
  teaser: z.strictObject({
    file: publicMedia,
    alt: text,
    position: z.string().regex(/^\d{1,3}% \d{1,3}%$/, 'e.g. "50% 75%"'),
    // The first story's caption (the photo itself is the tile's image).
    caption: text,
  }),
  // The photos after it: the tile's story frame swipes through the teaser and these (public/media/cricket/).
  slides: z.array(z.strictObject({ file: publicMedia, alt: text, caption: text })).min(1),
  clips: z.array(z.strictObject({ file: media, caption: text })),
  photos: z.array(z.strictObject({ file: media, caption: text, alt: text })),
  posters: z.array(media),
  // The Instagram-style stickers laid over the cricket tile (src/lib/beyond-fx.ts). `a` is the main line; `b` and `c` are
  // the secondary lines a sticker kind uses (date: a = day, b = month, c = note; ask: a = question, b = answer; the icon
  // stickers bat, ball, cup and jersey are drawn, and `a` just names them).
  stickers: z
    .array(
      z.strictObject({
        kind: z.enum(['date', 'ask', 'pin', 'tag', 'live', 'bat', 'ball', 'cup', 'jersey']),
        a: text,
        b: text.optional(),
        c: text.optional(),
      }),
    )
    .min(1),
});

export const disciplineSchema = z.strictObject({
  headline: text,
  subLine: text,
  rules: z.array(text).min(1),
  lesson: text,
  reels: z.array(
    z.strictObject({
      file: publicMedia,
      poster: publicMedia,
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
