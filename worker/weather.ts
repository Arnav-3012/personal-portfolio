// Cron job: Mumbai weather from Open-Meteo (free, no key) → KV `weather`. The landing doesn't show it yet; the
// workshop window and holotable read it in Phase 2. A failed run keeps the previous value.
import site from '../content/site.json' with { type: 'json' };

export const WEATHER_KEY = 'weather';

export interface Weather {
  updatedAt: string;
  temperatureC: number;
  /** WMO weather code. */
  code: number;
  isDay: boolean;
  precipitationMm: number;
  raining: boolean;
}

// WMO codes for drizzle, rain, freezing rain, showers and thunderstorms.
const isRainCode = (code: number): boolean =>
  (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95;

export async function refreshWeather(
  env: Pick<Env, 'KV'>,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const { lat, lon, timezone } = site.location;
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.search = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,weather_code,is_day,precipitation',
    timezone,
  }).toString();
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`Open-Meteo answered ${res.status}`);
  const body: unknown = await res.json();
  const current = (body as { current?: Record<string, unknown> } | null)?.current;
  const temperature = Number(current?.['temperature_2m']);
  const code = Number(current?.['weather_code']);
  const precipitation = Number(current?.['precipitation']);
  if (![temperature, code, precipitation].every(Number.isFinite))
    throw new Error('Open-Meteo answered with an unexpected shape');
  const weather: Weather = {
    updatedAt: new Date().toISOString(),
    temperatureC: temperature,
    code,
    isDay: current?.['is_day'] === 1,
    precipitationMm: precipitation,
    raining: precipitation > 0 || isRainCode(code),
  };
  await env.KV.put(WEATHER_KEY, JSON.stringify(weather));
}
