// Cron job: GitHub contribution calendar (GraphQL) + newest repos (REST) → KV `github` (SPEC "Integrations").
// The result is checked against the landing's own contract before it is written, and a failed run leaves the
// previous value in place, so a GitHub outage shows stale data instead of the fallback line.
import site from '../content/site.json' with { type: 'json' };
import { parseGithub, type ContributionDay } from '../src/lib/github-data';

export const GITHUB_KEY = 'github';
const LEVELS: Record<string, ContributionDay['level']> = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const QUERY = `query ($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount contributionLevel } }
      }
    }
  }
}`;

/** "https://github.com/Arnav-3012" → "Arnav-3012" */
export const githubLogin = (url: string = site.socials.github): string =>
  new URL(url).pathname.split('/').filter(Boolean)[0] ?? '';

type Json = Record<string, unknown>;
const asObject = (x: unknown): Json => (typeof x === 'object' && x !== null ? (x as Json) : {});

async function getJson(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  token: string | undefined,
): Promise<unknown> {
  const res = await fetchImpl(url, {
    ...init,
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'arnav-portfolio-cron',
      'x-github-api-version': '2022-11-28',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) throw new Error(`GitHub ${url} answered ${res.status}`);
  return res.json();
}

export type RefreshOutcome = 'updated' | 'skipped';

/** Throws on any failure (the caller logs it); returns 'skipped' when there is no token for the GraphQL call. */
export async function refreshGithub(
  env: Pick<Env, 'KV' | 'GITHUB_TOKEN'>,
  fetchImpl: typeof fetch = fetch,
): Promise<RefreshOutcome> {
  const token = env.GITHUB_TOKEN;
  // The contribution calendar is GraphQL-only and GraphQL always needs a token. Without one there is nothing
  // honest to cache, so the section keeps its fallback.
  if (!token) return 'skipped';
  const login = githubLogin();

  const graph = asObject(
    await getJson(
      fetchImpl,
      'https://api.github.com/graphql',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ query: QUERY, variables: { login } }),
      },
      token,
    ),
  );
  const calendar = asObject(
    asObject(asObject(asObject(asObject(graph['data'])['user'])['contributionsCollection']))[
      'contributionCalendar'
    ],
  );
  const rawWeeks = Array.isArray(calendar['weeks']) ? calendar['weeks'] : [];
  const weeks = rawWeeks.map((week) => {
    const days = asObject(week)['contributionDays'];
    return (Array.isArray(days) ? days : []).map((day): ContributionDay => {
      const d = asObject(day);
      return {
        date: String(d['date']),
        count: Number(d['contributionCount']),
        level: LEVELS[String(d['contributionLevel'])] ?? 0,
      };
    });
  });

  const rawRepos = await getJson(
    fetchImpl,
    `https://api.github.com/users/${login}/repos?type=owner&sort=pushed&per_page=30`,
    {},
    token,
  );
  const repos = (Array.isArray(rawRepos) ? rawRepos : [])
    .map(asObject)
    .filter((r) => r['fork'] !== true && r['archived'] !== true)
    .slice(0, 4)
    .map((r) => ({
      name: r['name'],
      description: typeof r['description'] === 'string' ? r['description'] : null,
      url: r['html_url'],
      stars: Number(r['stargazers_count'] ?? 0),
      language: typeof r['language'] === 'string' ? r['language'] : null,
      pushedAt: r['pushed_at'],
    }));

  const data = parseGithub({
    updatedAt: new Date().toISOString(),
    total: Number(calendar['totalContributions']),
    weeks,
    repos,
  });
  if (!data || data.weeks.length === 0) throw new Error('GitHub answered with an unexpected shape');
  await env.KV.put(GITHUB_KEY, JSON.stringify(data));
  return 'updated';
}
