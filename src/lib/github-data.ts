// The `GET /api/github` contract, shared by the landing section (src/lib/github.ts) and the Worker cron that
// writes it (worker/github.ts). Pure: no DOM, no Worker APIs.

export const GITHUB_ENDPOINT = '/api/github';

export interface ContributionDay {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  count: number;
  /** 0 = none … 4 = most, as GitHub buckets them. */
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GithubRepo {
  name: string;
  description: string | null;
  url: string;
  stars: number;
  language: string | null;
  /** ISO timestamp of the last push. */
  pushedAt: string;
}

export interface GithubData {
  updatedAt: string;
  total: number;
  /** Oldest week first; the first and last week can be partial. */
  weeks: ContributionDay[][];
  repos: GithubRepo[];
}

const isObject = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null;
const isDay = (x: unknown): x is ContributionDay =>
  isObject(x) &&
  typeof x['date'] === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(x['date']) &&
  typeof x['count'] === 'number' &&
  [0, 1, 2, 3, 4].includes(x['level'] as number);
const isRepo = (x: unknown): x is GithubRepo =>
  isObject(x) &&
  typeof x['name'] === 'string' &&
  typeof x['url'] === 'string' &&
  x['url'].startsWith('https://') &&
  typeof x['stars'] === 'number' &&
  typeof x['pushedAt'] === 'string' &&
  (x['description'] === null || typeof x['description'] === 'string') &&
  (x['language'] === null || typeof x['language'] === 'string');

/** Narrows an untrusted response body to the contract, or null if any part of it is wrong. */
export function parseGithub(x: unknown): GithubData | null {
  if (!isObject(x)) return null;
  const { updatedAt, total, weeks, repos } = x;
  if (typeof updatedAt !== 'string' || typeof total !== 'number') return null;
  if (!Array.isArray(weeks) || !weeks.every((w) => Array.isArray(w) && w.every(isDay))) return null;
  if (!Array.isArray(repos) || !repos.every(isRepo)) return null;
  return { updatedAt, total, weeks, repos: repos.slice(0, 4) };
}
