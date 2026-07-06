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
});
