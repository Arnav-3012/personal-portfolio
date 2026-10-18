import { describe, expect, it } from 'vitest';
import {
  agoLabel,
  cellDelay,
  loadGithub,
  monthLabels,
  parseGithub,
  weekdayRow,
  type GithubData,
} from '../../../src/lib/github';

const good: GithubData = {
  updatedAt: '2026-10-18T06:00:00Z',
  total: 3,
  weeks: [
    [
      { date: '2026-10-11', count: 1, level: 1 },
      { date: '2026-10-12', count: 0, level: 0 },
    ],
    [{ date: '2026-10-18', count: 2, level: 2 }],
  ],
  repos: [
    {
      name: 'firewatch',
      description: null,
      url: 'https://github.com/Arnav-3012/firewatch',
      stars: 2,
      language: 'Python',
      pushedAt: '2026-10-15T00:00:00Z',
    },
  ],
};

const respond = (status: number, body: unknown): typeof fetch =>
  (() => Promise.resolve(new Response(JSON.stringify(body), { status }))) as typeof fetch;

describe('parseGithub', () => {
  it('accepts the contract and keeps at most four repos', () => {
    expect(parseGithub(good)).toEqual(good);
    const many = { ...good, repos: Array.from({ length: 6 }, () => good.repos[0]) };
    expect(parseGithub(many)?.repos).toHaveLength(4);
  });

  it.each([
    ['null', null],
    ['no weeks', { ...good, weeks: 'x' }],
    ['bad level', { ...good, weeks: [[{ date: '2026-10-11', count: 1, level: 9 }]] }],
    ['bad date', { ...good, weeks: [[{ date: '11/10/2026', count: 1, level: 1 }]] }],
    ['http repo url', { ...good, repos: [{ ...good.repos[0], url: 'http://x.dev' }] }],
    ['missing total', { ...good, total: undefined }],
  ])('rejects %s', (_label, body) => {
    expect(parseGithub(body)).toBeNull();
  });
});

describe('loadGithub', () => {
  it('returns the data on 200', async () => {
    expect(await loadGithub(respond(200, good))).toEqual(good);
  });

  it('returns null for 404 (before task 1.7), a bad body and a network error', async () => {
    expect(await loadGithub(respond(404, { error: 'not found' }))).toBeNull();
    expect(await loadGithub(respond(200, { nope: true }))).toBeNull();
    expect(
      await loadGithub((() => Promise.reject(new TypeError('offline'))) as typeof fetch),
    ).toBeNull();
  });
});

describe('heatmap helpers', () => {
  it('puts Sunday on row 1 and Saturday on row 7', () => {
    expect(weekdayRow('2026-10-18')).toBe(1); // Sunday
    expect(weekdayRow('2026-10-24')).toBe(7); // Saturday
  });

  it('spreads the fill-in delay over the budget in order', () => {
    expect(cellDelay(0, 371)).toBe(0);
    expect(cellDelay(370, 371)).toBe(1200);
    expect(cellDelay(185, 371)).toBe(600);
    expect(cellDelay(0, 1)).toBe(0);
  });

  it('labels each new month once, at the column where it starts', () => {
    const week = (date: string) => [{ date, count: 0, level: 0 as const }];
    const labels = monthLabels([
      week('2026-09-06'),
      week('2026-09-13'),
      week('2026-09-20'),
      week('2026-09-27'),
      week('2026-10-04'),
      week('2026-10-11'),
      week('2026-10-18'),
      week('2026-10-25'),
      week('2026-11-01'),
    ]);
    expect(labels).toEqual([
      { column: 1, label: 'Sep' },
      { column: 5, label: 'Oct' },
      { column: 9, label: 'Nov' },
    ]);
  });

  it('keeps the later month when two labels would overlap (the first column is often partial)', () => {
    const week = (date: string) => [{ date, count: 0, level: 0 as const }];
    const labels = monthLabels([week('2026-09-27'), week('2026-10-04'), week('2026-10-11')]);
    expect(labels).toEqual([{ column: 2, label: 'Oct' }]);
  });

  it('describes how long ago a push was', () => {
    const now = new Date('2026-10-18T12:00:00Z');
    expect(agoLabel('2026-10-18T01:00:00Z', now)).toBe('today');
    expect(agoLabel('2026-10-15T12:00:00Z', now)).toBe('3d ago');
    expect(agoLabel('2026-08-18T12:00:00Z', now)).toBe('2mo ago');
    expect(agoLabel('2024-10-18T12:00:00Z', now)).toBe('2y ago');
  });
});
