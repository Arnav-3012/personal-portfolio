import { describe, expect, it } from 'vitest';
import { ICON_PATHS, iconSvg, type IconName } from '../../../src/lib/icons';

describe('iconSvg', () => {
  it('renders every icon with the shared line style and hides it from screen readers', () => {
    for (const name of Object.keys(ICON_PATHS) as IconName[]) {
      const svg = iconSvg(name);
      expect(svg, name).toContain(ICON_PATHS[name]);
      expect(svg, name).toContain('stroke-width="1.5"');
      expect(svg, name).toContain('aria-hidden="true"');
    }
  });

  it('uses the requested size and defaults to 20', () => {
    expect(iconSvg('x')).toContain('width="20" height="20"');
    expect(iconSvg('x', 16)).toContain('width="16" height="16"');
  });
});
