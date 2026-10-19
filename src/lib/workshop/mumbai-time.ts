// Mumbai's day and night (SPEC "Look: day and night"): Day is 06:00 to 18:00 India Standard Time, Night the rest.
// IST is UTC+5:30 all year with no daylight saving, so plain arithmetic on the UTC clock is enough (no Intl lookups).
// The inline script in Base.astro repeats this arithmetic for the first paint; keep the two in step.

export type Phase = 'day' | 'night';

const IST_OFFSET_MINUTES = 330;
export const DAY_STARTS = 6;
export const DAY_ENDS = 18;

/** Minutes since midnight in Mumbai, 0 to 1439. */
export function mumbaiMinutes(now: Date = new Date()): number {
  const utc = now.getUTCHours() * 60 + now.getUTCMinutes();
  return (utc + IST_OFFSET_MINUTES) % 1440;
}

export function mumbaiPhase(now: Date = new Date()): Phase {
  const hour = mumbaiMinutes(now) / 60;
  return hour >= DAY_STARTS && hour < DAY_ENDS ? 'day' : 'night';
}

/** "21:42", the clock the HUD shows. */
export function mumbaiClock(now: Date = new Date()): string {
  const minutes = mumbaiMinutes(now);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
