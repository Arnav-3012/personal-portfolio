import { describe, expect, it } from 'vitest';
import { projects } from '../../../src/lib/content';
import {
  SELECTED_COUNT,
  STATUS_FILTERS,
  activeIndex,
  splitStat,
  filterProjects,
  selectedWork,
  statusCounts,
  yearLabel,
} from '../../../src/lib/work';

describe('selected work', () => {
  it('takes the first five hero-tier projects by order', () => {
    const picks = selectedWork(projects);
    expect(picks).toHaveLength(SELECTED_COUNT);
    expect(picks.every((p) => p.tier === 'hero')).toBe(true);
    expect(picks.map((p) => p.order)).toEqual(picks.map((p) => p.order).toSorted((a, b) => a - b));
  });

  it('copes with fewer than five hero projects and with none', () => {
    const heroes = projects.filter((p) => p.tier === 'hero');
    expect(selectedWork(heroes.slice(0, 2))).toHaveLength(2);
    expect(selectedWork(projects.filter((p) => p.tier !== 'hero'))).toEqual([]);
  });
});

describe('all-projects index', () => {
  it('"all" keeps every project; a status keeps only that status', () => {
    expect(filterProjects(projects, 'all')).toHaveLength(projects.length);
    for (const f of STATUS_FILTERS.filter((s) => s !== 'all')) {
      const rows = filterProjects(projects, f);
      expect(rows.every((p) => p.status === f)).toBe(true);
    }
  });

  it('counts add up to the total', () => {
    const c = statusCounts(projects);
    expect(c.shipped + c.building + c['coming-soon']).toBe(c.all);
    expect(c.all).toBe(projects.length);
  });

  it('shows a dash when a project has no year', () => {
    expect(yearLabel({ year: null })).toBe('—');
    expect(yearLabel({ year: 2026 })).toBe('2026');
  });
});

describe('activeIndex', () => {
  it('picks the block whose centre is nearest the viewport centre', () => {
    expect(activeIndex([100, 500, 900], 480)).toBe(1);
    expect(activeIndex([100, 500, 900], 1200)).toBe(2);
  });
  it('returns -1 with no blocks', () => {
    expect(activeIndex([], 400)).toBe(-1);
  });
});

describe('activeIndex hysteresis', () => {
  it('holds the current block until another is clearly closer', () => {
    // viewport centre 500: block 1 is closer (40 vs 60) but within the 50px margin, so stay on 0
    expect(activeIndex([440, 540, 900], 500, 0, 50)).toBe(0);
    expect(activeIndex([300, 520, 900], 500, 0, 50)).toBe(1);
  });
  it('ignores a stale current index', () => {
    expect(activeIndex([100, 500], 480, -1, 50)).toBe(1);
    expect(activeIndex([100, 500], 480, 7, 50)).toBe(1);
  });
});

describe('splitStat', () => {
  it.each([
    ['95.75% fire recall', '95.75%', 'fire recall'],
    ['~23 ms local inference', '~23 ms', 'local inference'],
    ['+8.28 dB SNR', '+8.28 dB', 'SNR'],
    ['11/12 live trials', '11/12', 'live trials'],
    ['≤45 candidates', '≤45', 'candidates'],
    ['−93.5% ECE', '−93.5%', 'ECE'],
    ['ECE 0.169 → 0.011', '0.169 → 0.011', 'ECE'],
    ['AUC unchanged 0.784', '0.784', 'AUC unchanged'],
  ])('%s', (stat, value, label) => {
    expect(splitStat(stat)).toEqual({ value, label });
  });
  it('keeps a stat with no number whole', () => {
    expect(splitStat('open source')).toEqual({ value: 'open source', label: '' });
  });
});
