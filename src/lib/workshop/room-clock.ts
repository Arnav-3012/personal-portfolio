// The room's copy of Mumbai's clock ("21:42"). The site's own is in mumbai-time.ts, which the landing page's first script
// imports for the Auto theme; if the lazy room imported it too, it would become a file shared with the landing page, one more
// request to make before the landing page's first script runs (it cost about 150 ms of LCP). A unit test keeps the two in step.
const IST_OFFSET_MINUTES = 330;

/** "21:42", Mumbai time. */
export function mumbaiClock(now: Date = new Date()): string {
  const minutes = (now.getUTCHours() * 60 + now.getUTCMinutes() + IST_OFFSET_MINUTES) % 1440;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}
