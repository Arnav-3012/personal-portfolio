import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import site from '../../../content/site.json';
import { parseGithub } from '../../../src/lib/github-data';
import { GITHUB_KEY, githubLogin, refreshGithub } from '../../../worker/github';

const LOGIN = new URL(site.socials.github).pathname.slice(1);

const day = (date: string, count: number, level: string) => ({
  date,
  contributionCount: count,
  contributionLevel: level,
});
const graphql = {
  data: {
    user: {
      contributionsCollection: {
        contributionCalendar: {
          totalContributions: 9,
          weeks: [
            {
              contributionDays: [
                day('2026-10-11', 0, 'NONE'),
                day('2026-10-12', 2, 'FIRST_QUARTILE'),
                day('2026-10-13', 3, 'SECOND_QUARTILE'),
              ],
            },
            { contributionDays: [day('2026-10-18', 4, 'THIRD_QUARTILE')] },
            { contributionDays: [day('2026-10-19', 9, 'FOURTH_QUARTILE')] },
          ],
        },
      },
    },
  },
};
const repo = (name: string, extra: Record<string, unknown> = {}) => ({
  name,
  description: `${name} description`,
  html_url: `https://github.com/${LOGIN}/${name}`,
  stargazers_count: 2,
  language: 'Python',
  pushed_at: '2026-10-17T10:00:00Z',
  fork: false,
  archived: false,
  ...extra,
});
const repos = [
  repo('newest'),
  repo('a-fork', { fork: true }),
  repo('second', { description: null, language: null, stargazers_count: 0 }),
  repo('old-archive', { archived: true }),
  repo('third'),
  repo('fourth'),
  repo('fifth'),
];

const calls: { url: string; init?: RequestInit }[] = [];
const fakeFetch = (
  overrides: { graphql?: () => Response; repos?: () => Response } = {},
): typeof fetch =>
  ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    calls.push(init ? { url, init } : { url });
    if (url === 'https://api.github.com/graphql')
      return Promise.resolve((overrides.graphql ?? (() => Response.json(graphql)))());
    return Promise.resolve((overrides.repos ?? (() => Response.json(repos)))());
  }) as typeof fetch;

const stored = async () => {
  const raw = await env.KV.get(GITHUB_KEY);
  return raw === null ? null : (JSON.parse(raw) as unknown);
};
const withToken = () => ({ KV: env.KV, GITHUB_TOKEN: 'ghp_test' });

beforeEach(async () => {
  calls.length = 0;
  await env.KV.delete(GITHUB_KEY);
});

describe('githubLogin', () => {
  it('takes the account from the profile URL in site.json', () => {
    expect(githubLogin('https://github.com/someone')).toBe('someone');
    expect(githubLogin('https://github.com/someone/')).toBe('someone');
    expect(githubLogin()).toBe(LOGIN);
  });
});

describe('refreshGithub', () => {
  it('writes the landing contract to KV: levels mapped, forks and archived repos dropped, four repos', async () => {
    expect(await refreshGithub(withToken(), fakeFetch())).toBe('updated');
    const data = parseGithub(await stored());
    expect(data).not.toBeNull();
    expect(data?.total).toBe(9);
    expect(data?.weeks.map((w) => w.map((d) => d.level))).toEqual([[0, 1, 2], [3], [4]]);
    expect(data?.weeks[0]?.[1]).toEqual({ date: '2026-10-12', count: 2, level: 1 });
    expect(data?.repos.map((r) => r.name)).toEqual(['newest', 'second', 'third', 'fourth']);
    expect(data?.repos[1]).toMatchObject({ description: null, language: null, stars: 0 });
    expect(data?.repos[0]).toMatchObject({
      url: `https://github.com/${LOGIN}/newest`,
      pushedAt: '2026-10-17T10:00:00Z',
    });
    expect(Number.isNaN(Date.parse(data?.updatedAt ?? ''))).toBe(false);
  });

  it('asks for the configured account with the token, a user agent and the API version', async () => {
    await refreshGithub(withToken(), fakeFetch());
    expect(calls.map((c) => c.url)).toEqual([
      'https://api.github.com/graphql',
      `https://api.github.com/users/${LOGIN}/repos?type=owner&sort=pushed&per_page=30`,
    ]);
    const body = JSON.parse(String(calls[0]?.init?.body)) as { variables: { login: string } };
    expect(body.variables).toEqual({ login: LOGIN });
    for (const c of calls) {
      const h = c.init?.headers as Record<string, string>;
      expect(h['authorization']).toBe('Bearer ghp_test');
      expect(h['user-agent']).toBeTruthy();
      expect(h['x-github-api-version']).toBe('2022-11-28');
    }
  });

  it('skips without a token: no requests, nothing written, the landing keeps its fallback', async () => {
    expect(await refreshGithub({ KV: env.KV }, fakeFetch())).toBe('skipped');
    expect(calls).toEqual([]);
    expect(await stored()).toBeNull();
  });

  it.each([
    ['GraphQL answers 502', { graphql: () => new Response('bad gateway', { status: 502 }) }],
    ['the repo list answers 403', { repos: () => new Response('rate limited', { status: 403 }) }],
    [
      'GraphQL reports an error and no user',
      { graphql: () => Response.json({ errors: [{ message: 'Bad credentials' }] }) },
    ],
    [
      'the calendar is empty',
      {
        graphql: () =>
          Response.json({
            data: {
              user: {
                contributionsCollection: {
                  contributionCalendar: { totalContributions: 0, weeks: [] },
                },
              },
            },
          }),
      },
    ],
  ])('throws and keeps the previous value when %s', async (_name, overrides) => {
    await env.KV.put(GITHUB_KEY, '{"previous":true}');
    await expect(refreshGithub(withToken(), fakeFetch(overrides))).rejects.toThrow();
    expect(await stored()).toEqual({ previous: true });
  });

  it('rejects repos whose URL is not https rather than caching them', async () => {
    const bad = [repo('x', { html_url: 'javascript:alert(1)' })];
    await expect(
      refreshGithub(withToken(), fakeFetch({ repos: () => Response.json(bad) })),
    ).rejects.toThrow();
    expect(await stored()).toBeNull();
  });
});
