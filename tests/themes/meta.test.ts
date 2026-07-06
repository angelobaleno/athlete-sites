import { describe, it, expect } from 'vitest';
import { getThemeMeta } from '../../src/themes/meta';

describe('getThemeMeta', () => {
  it("returns tyler's hero ratio (4:5 portrait)", () => {
    expect(getThemeMeta('tyler').heroPhotoAspectRatio).toBeCloseTo(4 / 5);
  });
  it("returns bare's deliberately different ratio (1:1 — proves nothing is hardcoded)", () => {
    expect(getThemeMeta('bare').heroPhotoAspectRatio).toBe(1);
  });
  it('fails loud on an unknown theme', () => {
    expect(() => getThemeMeta('nope')).toThrow(/unknown theme/i);
  });

  it('carries a complete brand palette per theme (admin wears the athlete colors)', () => {
    const keys = ['bg', 'surface', 'surface2', 'line', 'text', 'muted', 'accent', 'accentHi', 'danger'];
    for (const name of ['tyler', 'bare']) {
      const brand = getThemeMeta(name).brand;
      for (const k of keys) {
        expect(brand[k as keyof typeof brand], `${name}.brand.${k}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("tyler's admin accent is Plum purple; bare's is its own light-theme blue", () => {
    expect(getThemeMeta('tyler').brand.accent).toBe('#6C4AA0');
    expect(getThemeMeta('bare').brand.bg).toBe('#FFFFFF');
  });
});
