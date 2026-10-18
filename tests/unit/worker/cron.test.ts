import { env } from 'cloudflare:workers';
import { exports } from 'cloudflare:workers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CRON_GITHUB, CRON_WEATHER, runCron } from '../../../worker/cron';

const testEnv = (extra: Partial<Env> = {}): Env => ({ KV: env.KV, ...extra }) as unknown as Env;
const reply = (body: unknown) => Promise.resolve(Response.json(body));
const urls = (spy: ReturnType<typeof vi.fn>) => spy.mock.calls.map((c) => String(c[0]));

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  vi.restoreAllMocks();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await env.KV.delete('weather');
});

describe('runCron', () => {
  it('the weather cron fetches Open-Meteo and writes KV', async () => {
    const fetchSpy = vi.fn(() =>
      reply({ current: { temperature_2m: 30, weather_code: 0, is_day: 1, precipitation: 0 } }),
    );
    await runCron(CRON_WEATHER, testEnv(), fetchSpy as unknown as typeof fetch);
    expect(urls(fetchSpy)[0]).toContain('api.open-meteo.com');
    expect(await env.KV.get('weather')).not.toBeNull();
  });

  it('the GitHub cron calls GitHub when a token is set', async () => {
    const fetchSpy = vi.fn(() => reply({}));
    await runCron(CRON_GITHUB, testEnv({ GITHUB_TOKEN: 't' }), fetchSpy as unknown as typeof fetch);
    expect(urls(fetchSpy)[0]).toBe('https://api.github.com/graphql');
  });

  it('the GitHub cron does nothing without a token, and says so', async () => {
    const fetchSpy = vi.fn(() => reply({}));
    await runCron(CRON_GITHUB, testEnv(), fetchSpy as unknown as typeof fetch);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('GITHUB_TOKEN'));
  });

  it('never throws: a failing job is logged', async () => {
    const down = vi.fn(() => Promise.reject(new TypeError('network down')));
    await expect(
      runCron(CRON_WEATHER, testEnv(), down as unknown as typeof fetch),
    ).resolves.toBeUndefined();
    expect(error).toHaveBeenCalled();
  });

  it('warns about a cron string it has no job for', async () => {
    await runCron('1 2 3 4 5', testEnv());
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('1 2 3 4 5'));
  });

  it('uses two distinct schedules (the free plan allows five per account)', () => {
    expect(new Set([CRON_GITHUB, CRON_WEATHER]).size).toBe(2);
  });
});

describe('Worker entry', () => {
  it('serves the data and forms routes through the real entry point', async () => {
    const ready = await exports.default.fetch('http://example.com/api/github?entry=1');
    expect([200, 404]).toContain(ready.status);
    const forms = await exports.default.fetch('http://example.com/api/forms/contact');
    expect(forms.status).toBe(405);
    const none = await exports.default.fetch('http://example.com/api/forms', { method: 'POST' });
    expect(none.status).toBe(404);
  });
});
