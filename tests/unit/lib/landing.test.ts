import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BOOT_KEY, markSeen, shouldBoot, trackProgress } from '../../../src/lib/boot';
import { navVisibility, zoneClock } from '../../../src/lib/nav';
import {
  buildingProject,
  currentRole,
  freelanceStatus,
  quadrants,
  resumeHref,
} from '../../../src/lib/landing';
import { experience, freelance, projects, site, siteSchema } from '../../../src/lib/content';

const memory = (init: Record<string, string> = {}) => {
  const data = new Map(Object.entries(init));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
  };
};
const throwing = {
  getItem: () => {
    throw new Error('blocked');
  },
  setItem: () => {
    throw new Error('blocked');
  },
};

describe('boot gating', () => {
  it('plays when unseen, not when seen, never with reduced motion', () => {
    expect(shouldBoot(memory(), false)).toBe(true);
    expect(shouldBoot(memory({ [BOOT_KEY]: 'seen' }), false)).toBe(false);
    expect(shouldBoot(memory(), true)).toBe(false);
  });

  it('blocked storage shows the boot and markSeen does not throw', () => {
    expect(shouldBoot(throwing, false)).toBe(true);
    expect(shouldBoot(null, false)).toBe(true);
    expect(() => markSeen(throwing)).not.toThrow();
  });

  it('markSeen makes the next check skip', () => {
    const s = memory();
    markSeen(s);
    expect(shouldBoot(s, false)).toBe(false);
  });

  it('real progress adds task weights as they settle, failures included', async () => {
    let fail: (e: Error) => void = () => undefined;
    const failing = new Promise((_, reject) => (fail = reject));
    const progress = trackProgress([
      [Promise.resolve(), 0.4],
      [failing, 0.6],
    ]);
    expect(progress()).toBe(0);
    await Promise.resolve();
    expect(progress()).toBeCloseTo(0.4);
    fail(new Error('decode failed'));
    await failing.catch(() => undefined);
    await Promise.resolve();
    expect(progress()).toBeCloseTo(1);
  });
});

describe('hero content', () => {
  it('Currently = the role without an end date', () => {
    expect(currentRole(experience)?.end).toBeNull();
    expect(currentRole([])).toBeUndefined();
  });

  it('Building = the project named by site.currentlyBuilding', () => {
    expect(buildingProject(site, projects)?.id).toBe(site.currentlyBuilding);
    expect(buildingProject({ currentlyBuilding: 'nope' }, projects)).toBeUndefined();
  });

  it('freelance status: open uses the headline; booked turns to bookedLabel + note', () => {
    expect(freelanceStatus({ ...freelance, open: true, note: 'ignored' })).toEqual({
      open: true,
      label: freelance.headline,
      note: null,
    });
    expect(freelanceStatus({ ...freelance, open: false, note: 'until March' })).toEqual({
      open: false,
      label: freelance.bookedLabel,
      note: 'until March',
    });
  });

  it('quadrants link the four sections with labels derived from content', () => {
    const q = quadrants(site, projects, experience);
    expect(q.map((x) => [x.n, x.id])).toEqual([
      ['01', 'work'],
      ['02', 'experience'],
      ['03', 'about'],
      ['04', 'contact'],
    ]);
    const shipped = projects.filter((p) => p.status === 'shipped').length;
    expect(q[0]?.meta).toContain(`${shipped} shipped`);
    expect(q[1]?.meta).toContain(`${experience.length} roles`);
    expect(q[2]?.meta).toContain(site.location.city);
    expect(q[3]?.meta).toBe(site.email);
    expect(
      quadrants(site, [{ status: 'building' }], [{ start: '2025-01' }, { start: '2023-06' }])[1]
        ?.meta,
    ).toBe('2 roles · since 2023');
  });
});

describe('resume link', () => {
  it('renders only when the PDF is in public/', () => {
    const root = mkdtempSync(join(tmpdir(), 'resume-'));
    expect(resumeHref('cv.pdf', root)).toBeNull();
    mkdirSync(join(root, 'public'));
    writeFileSync(join(root, 'public', 'cv.pdf'), '');
    expect(resumeHref('cv.pdf', root)).toBe('/cv.pdf');
  });
});

describe('nav', () => {
  it('shows near the top, hides going down, shows going up, ignores jitter', () => {
    expect(navVisibility(500, 60)).toBe('show');
    expect(navVisibility(200, 300)).toBe('hide');
    expect(navVisibility(300, 200)).toBe('show');
    expect(navVisibility(300, 304)).toBeNull();
  });

  it('clock shows Mumbai time as "Sun 18 · 19:42 IST"', () => {
    // 2026-10-18 14:12 UTC = 19:42 IST (UTC+5:30), a Sunday.
    expect(zoneClock(new Date('2026-10-18T14:12:00Z'), 'Asia/Kolkata')).toBe('Sun 18 · 19:42 IST');
    expect(zoneClock(new Date('2026-10-18T18:45:00Z'), 'Asia/Kolkata')).toBe('Mon 19 · 00:15 IST');
  });
});

describe('site.json landing keys', () => {
  it('rejects bad boot content and a missing portrait alt', () => {
    expect(
      siteSchema.safeParse({ ...site, boot: { ...site.boot, tokens: ['x'.repeat(11), 'a', 'b'] } })
        .success,
    ).toBe(false);
    expect(
      siteSchema.safeParse({ ...site, boot: { ...site.boot, log: ['only one'] } }).success,
    ).toBe(false);
    expect(siteSchema.safeParse({ ...site, portrait: {} }).success).toBe(false);
  });
});
