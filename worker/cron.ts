// Scheduled work. The cron strings must match `triggers.crons` in wrangler.jsonc (the free plan allows five
// cron triggers across the whole account; this Worker uses two).
import { refreshGithub } from './github';
import { refreshWeather } from './weather';

export const CRON_GITHUB = '0 */6 * * *';
export const CRON_WEATHER = '*/30 * * * *';

/** Runs the job for a cron string. Never throws: a failure is logged and the cached value stays. */
export async function runCron(
  cron: string,
  env: Env,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  try {
    if (cron === CRON_GITHUB) {
      const outcome = await refreshGithub(env, fetchImpl);
      if (outcome === 'skipped')
        console.warn('cron: GITHUB_TOKEN is not set, GitHub cache not refreshed');
    } else if (cron === CRON_WEATHER) {
      await refreshWeather(env, fetchImpl);
    } else {
      console.warn(`cron: no job for "${cron}"`);
    }
  } catch (error) {
    console.error(`cron "${cron}" failed`, error);
  }
}
