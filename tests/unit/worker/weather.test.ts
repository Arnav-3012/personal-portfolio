import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import site from '../../../content/site.json';
import { WEATHER_KEY, refreshWeather, type Weather } from '../../../worker/weather';

const seen: string[] = [];
const respond = (body: unknown, status = 200): typeof fetch =>
  ((input: RequestInfo | URL) => {
    seen.push(String(input));
    return Promise.resolve(Response.json(body, { status }));
  }) as typeof fetch;
const current = (c: Record<string, number>) => ({
  current: { temperature_2m: 29.4, weather_code: 1, is_day: 1, precipitation: 0, ...c },
});
const stored = async () => JSON.parse((await env.KV.get(WEATHER_KEY)) ?? 'null') as Weather | null;

beforeEach(async () => {
  seen.length = 0;
  await env.KV.delete(WEATHER_KEY);
});

describe('refreshWeather', () => {
  it("asks Open-Meteo for Mumbai's current weather using the location in site.json", async () => {
    await refreshWeather(env, respond(current({})));
    const url = new URL(seen[0] ?? '');
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast');
    expect(url.searchParams.get('latitude')).toBe(String(site.location.lat));
    expect(url.searchParams.get('longitude')).toBe(String(site.location.lon));
    expect(url.searchParams.get('timezone')).toBe(site.location.timezone);
    expect(url.searchParams.get('current')).toBe(
      'temperature_2m,weather_code,is_day,precipitation',
    );
  });

  it('stores a compact reading', async () => {
    await refreshWeather(env, respond(current({})));
    expect(await stored()).toMatchObject({
      temperatureC: 29.4,
      code: 1,
      isDay: true,
      precipitationMm: 0,
      raining: false,
    });
  });

  it.each([
    ['measured precipitation', { precipitation: 0.4, weather_code: 3 }, true],
    ['a rain code', { precipitation: 0, weather_code: 61 }, true],
    ['a shower code', { precipitation: 0, weather_code: 81 }, true],
    ['a thunderstorm code', { precipitation: 0, weather_code: 95 }, true],
    ['overcast and dry', { precipitation: 0, weather_code: 3 }, false],
    ['fog', { precipitation: 0, weather_code: 45 }, false],
  ])('raining is %s → %s', async (_name, c, raining) => {
    await refreshWeather(env, respond(current(c)));
    expect((await stored())?.raining).toBe(raining);
  });

  it('marks night when is_day is 0', async () => {
    await refreshWeather(env, respond(current({ is_day: 0 })));
    expect((await stored())?.isDay).toBe(false);
  });

  it.each([
    ['an HTTP error', () => respond({}, 500)],
    ['no current block', () => respond({ hourly: {} })],
    [
      'a non-numeric reading',
      () =>
        respond({
          current: { temperature_2m: 'warm', weather_code: 1, is_day: 1, precipitation: 0 },
        }),
    ],
  ])('throws on %s and keeps the previous reading', async (_name, make) => {
    await env.KV.put(WEATHER_KEY, '{"previous":true}');
    await expect(refreshWeather(env, make())).rejects.toThrow();
    expect(await env.KV.get(WEATHER_KEY)).toBe('{"previous":true}');
  });
});
