// Values the landing derives from content/* (SPEC "Landing page"), kept pure so they're unit-tested.
// KV overrides for "currently building" and the freelance switch arrive with /admin (1.9).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Cricket, Discipline, Experience, Freelance, Project, Site } from './content';
import { selectedWork } from './work';

/** The role still running (no end date) feeds the hero's "Currently" chip. */
export const currentRole = (roles: readonly Experience[]): Experience | undefined =>
  roles.find((r) => r.end === null);

/** The project named by site.currentlyBuilding feeds the "Building" chip. */
export const buildingProject = (
  site: Pick<Site, 'currentlyBuilding'>,
  all: readonly Project[],
): Project | undefined => all.find((p) => p.id === site.currentlyBuilding);

export interface FreelanceStatus {
  open: boolean;
  label: string;
  note: string | null;
}

/** One status for every place it appears (SPEC "Open to freelance"): booked shows grey + the note. */
export const freelanceStatus = (f: Pick<Freelance, 'open' | 'note' | 'headline' | 'bookedLabel'>) =>
  ({
    open: f.open,
    label: f.open ? f.headline : f.bookedLabel,
    note: f.open ? null : f.note,
  }) satisfies FreelanceStatus;

/**
 * The resume link renders only once the PDF is in public/ (Arnav is supplying a version without a phone
 * number), so the site never links to a missing file. Runs at build time only.
 */
export function resumeHref(file: string, root = process.cwd()): string | null {
  return existsSync(join(root, 'public', file)) ? `/${file}` : null;
}

export interface Quadrant {
  n: string;
  id: string;
  title: string;
  meta: string;
}

/** Hero corner quadrants: section links with a mono sub-label derived from content (never hardcoded copy). */
export function quadrants(
  s: Pick<Site, 'location' | 'education' | 'email'>,
  all: readonly Pick<Project, 'status'>[],
  roles: readonly Pick<Experience, 'start'>[],
): Quadrant[] {
  const count = (status: Project['status']): number =>
    all.filter((p) => p.status === status).length;
  const since = roles.map((r) => r.start.slice(0, 4)).sort()[0];
  const school = s.education.school.split(' ')[0] ?? s.education.school;
  return [
    {
      n: '01',
      id: 'work',
      title: 'Work',
      meta: `${count('shipped')} shipped · ${count('building')} building`,
    },
    {
      n: '02',
      id: 'experience',
      title: 'Experience',
      meta: `${roles.length} roles · since ${since ?? ''}`,
    },
    { n: '03', id: 'about', title: 'About', meta: `${s.location.city} · ${school}` },
    { n: '04', id: 'contact', title: 'Contact', meta: s.email },
  ];
}

/**
 * Where a project or role lives on the page: top-five projects have their own row in Selected work, the
 * rest sit in the index, and roles have a node on the experience rail. Null for an unknown id.
 */
export function anchorFor(
  id: string,
  all: readonly Project[],
  roles: readonly Pick<Experience, 'id'>[],
): string | null {
  if (all.some((p) => p.id === id))
    return selectedWork(all).some((p) => p.id === id) ? `#work-${id}` : '#projects';
  return roles.some((r) => r.id === id) ? `#role-${id}` : null;
}

/** The first `count` sentences of a paragraph, for a teaser tile. */
export function teaser(text: string, count = 2): string {
  const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g);
  return sentences ? sentences.slice(0, count).join('').trim() : text;
}

/** Reel posters carry their caption in the upper-middle, so a landscape crop leans up to keep it in frame. */
const POSTER_FOCUS = '50% 35%';

export interface BeyondTile {
  id: 'cricket' | '75-hard';
  eyebrow: string;
  title: string;
  text: string;
  image: { src: string; alt: string; position: string };
  cta: string;
  href: string;
}

/** The two Beyond code tiles (SPEC row 10), derived from cricket.json, discipline.json and projects.json. */
export function beyondTiles(
  cricket: Pick<Cricket, 'whyCricket' | 'teaser'>,
  discipline: Pick<Discipline, 'headline' | 'subLine' | 'reels'>,
  all: readonly Project[],
  roles: readonly Pick<Experience, 'id'>[],
): BeyondTile[] {
  const cricketProject = all.find((p) => p.world === 'cricket');
  const reel = discipline.reels.find((r) => r.featured) ?? discipline.reels[0];
  const tiles: BeyondTile[] = [
    {
      id: 'cricket',
      eyebrow: 'Beyond code',
      title: 'Cricket',
      text: teaser(cricket.whyCricket),
      image: {
        src: `/${cricket.teaser.file}`,
        alt: cricket.teaser.alt,
        position: cricket.teaser.position,
      },
      cta: cricketProject ? `See ${cricketProject.name}` : 'Read more',
      href: (cricketProject && anchorFor(cricketProject.id, all, roles)) ?? '#projects',
    },
  ];
  if (reel)
    tiles.push({
      id: '75-hard',
      eyebrow: 'Beyond code',
      title: discipline.headline,
      text: discipline.subLine,
      image: { src: `/${reel.poster}`, alt: `Poster for ${reel.caption}`, position: POSTER_FOCUS },
      cta: 'Watch the reels',
      href: '#75-hard',
    });
  return tiles;
}

/** The footer's section links: `[id, label]` for the sections a visitor can jump to. */
export const footerSections = [
  ['work', 'Work'],
  ['experience', 'Experience'],
  ['about', 'About'],
  ['freelance', 'Freelance'],
  ['github', 'GitHub'],
  ['contact', 'Contact'],
] as const;
