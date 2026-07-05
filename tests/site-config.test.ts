import { describe, it, expect } from 'vitest';
import { getSiteConfig, resolveSlugFromHost, DEFAULT_ARRANGEMENT } from '../src/lib/site-config';

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

describe('resolveSlugFromHost', () => {
  it('maps a configured custom domain (and its www form) to the athlete slug', () => {
    expect(resolveSlugFromHost('tylerbaleno.com')).toBe('tyler-baleno');
    expect(resolveSlugFromHost('www.tylerbaleno.com')).toBe('tyler-baleno');
  });
  it('is case-insensitive', () => {
    expect(resolveSlugFromHost('TylerBaleno.com')).toBe('tyler-baleno');
  });
  it('returns null for an unmapped host (platform/apex domains)', () => {
    expect(resolveSlugFromHost('athlete-sites.vercel.app')).toBeNull();
    expect(resolveSlugFromHost('localhost')).toBeNull();
  });
});
