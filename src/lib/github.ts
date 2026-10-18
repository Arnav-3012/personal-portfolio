// GitHub live (SPEC row 9). `GET /api/github` (shape in github-data.ts) is written by the Worker cron into KV; while
// it is empty or unreachable the section shows its fallback line.
import { MONTHS } from './dates';
import { GITHUB_ENDPOINT, parseGithub, type ContributionDay, type GithubData } from './github-data';

export { GITHUB_ENDPOINT, parseGithub };
export type { ContributionDay, GithubData, GithubRepo } from './github-data';

/** Row of a day in the heatmap grid: Sunday is row 1, as on GitHub. */
export const weekdayRow = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay() + 1;

/** Stagger so the squares fill in order but the whole year takes `budgetMs`, however many cells there are. */
export const cellDelay = (index: number, total: number, budgetMs = 1200): number =>
  total <= 1 ? 0 : Math.round((index / (total - 1)) * budgetMs);

/** Month names above the grid: the column where each month first appears. */
export function monthLabels(
  weeks: readonly ContributionDay[][],
): { column: number; label: string }[] {
  const out: { column: number; label: string }[] = [];
  let last = -1;
  weeks.forEach((week, i) => {
    const first = week[0];
    if (!first) return;
    const month = Number(first.date.slice(5, 7)) - 1;
    if (month !== last) {
      // A label under 3 columns after the previous one would overlap it. Keep the later month: the first
      // column is usually a partial month, so the newer label is the more useful one.
      const prev = out.at(-1);
      if (prev && i - prev.column < 3) out.pop();
      out.push({ column: i + 1, label: MONTHS[month] ?? '' });
      last = month;
    }
  });
  return out;
}

/** "3d ago", "2mo ago": how long since the last push. */
export function agoLabel(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (days < 1) return 'today';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

/** The data, or null on any failure (offline, 404 before 1.7, bad shape). */
export async function loadGithub(fetchImpl: typeof fetch = fetch): Promise<GithubData | null> {
  try {
    const res = await fetchImpl(GITHUB_ENDPOINT, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    return parseGithub(await res.json());
  } catch {
    return null;
  }
}

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function renderHeatmap(data: GithubData, grid: HTMLElement, months: HTMLElement): void {
  const days = data.weeks.flat();
  let index = 0;
  const cells: HTMLElement[] = [];
  data.weeks.forEach((week, col) => {
    for (const day of week) {
      const cell = el('span', 'gh__cell');
      cell.dataset['level'] = String(day.level);
      cell.title = `${day.count} contribution${day.count === 1 ? '' : 's'} on ${day.date}`;
      cell.style.gridColumn = String(col + 1);
      cell.style.gridRow = String(weekdayRow(day.date));
      cell.style.setProperty('--d', `${cellDelay(index++, days.length)}ms`);
      cells.push(cell);
    }
  });
  grid.replaceChildren(...cells);
  grid.style.setProperty('--weeks', String(data.weeks.length));
  months.style.setProperty('--weeks', String(data.weeks.length));
  months.replaceChildren(
    ...monthLabels(data.weeks).map(({ column, label }) => {
      const m = el('span', 'hud gh__month', label);
      m.style.gridColumn = String(column);
      return m;
    }),
  );
}

function renderRepos(data: GithubData, list: HTMLElement, now: Date): void {
  list.replaceChildren(
    ...data.repos.map((repo) => {
      const item = el('li', 'gh__repo');
      const link = el('a', 'gh__repo-name', repo.name);
      link.href = repo.url;
      link.rel = 'noopener';
      const meta = [
        repo.language,
        repo.stars > 0 ? `★ ${repo.stars}` : null,
        `pushed ${agoLabel(repo.pushedAt, now)}`,
      ].filter((m): m is string => m !== null);
      item.append(
        link,
        el('p', 'small gh__repo-desc', repo.description ?? 'No description yet.'),
        el('p', 'hud gh__repo-meta', meta.join(' · ')),
      );
      return item;
    }),
  );
}

/** Loads the data once the section nears the viewport, so nothing is fetched before first paint. */
export function initGithub(doc: Document = document, fetchImpl: typeof fetch = fetch): void {
  const root = doc.querySelector<HTMLElement>('[data-github]');
  const grid = root?.querySelector<HTMLElement>('[data-gh-grid]');
  const months = root?.querySelector<HTMLElement>('[data-gh-months]');
  const repos = root?.querySelector<HTMLElement>('[data-gh-repos]');
  const total = root?.querySelector<HTMLElement>('[data-gh-total]');
  const scroller = root?.querySelector<HTMLElement>('[data-gh-scroll]');
  if (!root || !grid || !months || !repos || !total || !scroller) return;
  // The skeleton shows from here; without JS the markup keeps its fallback line instead.
  root.dataset['state'] = 'idle';

  const load = async (): Promise<void> => {
    root.dataset['state'] = 'loading';
    const data = await loadGithub(fetchImpl);
    if (!data) {
      root.dataset['state'] = 'error';
      return;
    }
    renderHeatmap(data, grid, months);
    renderRepos(data, repos, new Date());
    total.textContent = `${data.total.toLocaleString('en-GB')} contributions in the last year`;
    grid.setAttribute('aria-label', total.textContent);
    root.dataset['state'] = 'ready';
    // On a narrow screen the newest weeks (the right edge) matter most.
    scroller.scrollLeft = scroller.scrollWidth;
  };

  const observer = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      observer.disconnect();
      void load();
    },
    { rootMargin: '400px 0px' },
  );
  observer.observe(root);
}
