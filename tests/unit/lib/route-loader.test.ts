import { describe, expect, it } from 'vitest';
import { GRID, diagonal } from '../../../src/lib/loader';
import {
  GIVE_UP_MS,
  SHOW_AFTER_MS,
  isPageNavigation,
  type Place,
} from '../../../src/lib/route-loader';

const home: Place = {
  href: 'https://arnavc.in/',
  origin: 'https://arnavc.in',
  pathname: '/',
  search: '',
};
const link = (href: string, extra: { target?: string; download?: boolean } = {}) => ({
  href,
  ...(extra.target ? { target: extra.target } : {}),
  hasAttribute: (n: string) => n === 'download' && !!extra.download,
});

describe('isPageNavigation', () => {
  it.each([
    ['/workshop'],
    ['/workshop/'],
    ['https://arnavc.in/design/'],
    ['/workshop#zones'],
    ['/?x=1'],
  ])('%s leaves the page', (href) => expect(isPageNavigation(link(href), home)).toBe(true));

  it.each([
    ['a hash jump on this page', '#work'],
    ['the same page again', '/'],
    ['the same page with a hash', '/#contact'],
    ['another site', 'https://github.com/Arnav-3012'],
    ['a mailto link', 'mailto:arnavc.work@gmail.com'],
    ['a PDF', '/arnav-chaturvedi-resume-2026-10.pdf'],
    ['an image', '/media/brain.svg'],
    ['the API', '/api/github'],
    ['a javascript: link', 'javascript:void(0)'],
  ])('%s does not', (_name, href) => expect(isPageNavigation(link(href), home)).toBe(false));

  it('ignores new-tab links and downloads, but not _self', () => {
    expect(isPageNavigation(link('/workshop', { target: '_blank' }), home)).toBe(false);
    expect(isPageNavigation(link('/workshop', { download: true }), home)).toBe(false);
    expect(isPageNavigation(link('/workshop', { target: '_self' }), home)).toBe(true);
  });

  it('from another page, the home page counts as leaving', () => {
    const workshop: Place = {
      href: 'https://arnavc.in/workshop',
      origin: 'https://arnavc.in',
      pathname: '/workshop',
      search: '',
    };
    expect(isPageNavigation(link('/'), workshop)).toBe(true);
    expect(isPageNavigation(link('/workshop#zones'), workshop)).toBe(false);
  });

  it('shows the loader only after a short moment, and gives up eventually', () => {
    expect(SHOW_AFTER_MS).toBeGreaterThanOrEqual(120);
    expect(SHOW_AFTER_MS).toBeLessThanOrEqual(400);
    expect(GIVE_UP_MS).toBeGreaterThan(5000);
  });
});

describe('the loader grid', () => {
  it('lights dots by diagonal, so a wave crosses it from one corner to the other', () => {
    expect(diagonal(0)).toBe(0);
    expect(diagonal(GRID * GRID - 1)).toBe(2 * (GRID - 1));
    // Each step along a row or down a column moves one diagonal on.
    expect(diagonal(1)).toBe(1);
    expect(diagonal(GRID)).toBe(1);
    expect(diagonal(GRID + 1)).toBe(2);
    const all = Array.from({ length: GRID * GRID }, (_, i) => diagonal(i));
    expect(Math.max(...all)).toBe(2 * (GRID - 1));
    expect(new Set(all).size).toBe(2 * GRID - 1);
  });
});
