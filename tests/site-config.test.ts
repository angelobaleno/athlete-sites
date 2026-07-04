import { describe, it, expect } from 'vitest';
import { getSiteConfig, DEFAULT_ARRANGEMENT } from '../src/lib/site-config';

describe('getSiteConfig', () => {
  it('returns Tyler config with the default arrangement', () => {
    const cfg = getSiteConfig('tyler-baleno');
    expect(cfg.theme).toBe('tyler');
    expect(cfg.arrangement).toEqual(DEFAULT_ARRANGEMENT);
  });
  it('default arrangement leads with hero and ends with contact', () => {
    expect(DEFAULT_ARRANGEMENT[0]).toBe('hero');
    expect(DEFAULT_ARRANGEMENT.at(-1)).toBe('contact');
  });
  it('throws (fail-loud) for an unconfigured slug', () => {
    expect(() => getSiteConfig('nobody')).toThrow(/no site config/i);
  });
});
