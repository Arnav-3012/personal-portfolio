// Values the landing derives from content/* (SPEC "Landing page"), kept pure so they're unit-tested.
// KV overrides for "currently building" and the freelance switch arrive with /admin (1.9).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { Experience, Freelance, Project, Site } from './content';

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
