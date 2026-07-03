import { describe, it, expect } from 'vitest';
import { redirectTarget } from '../../src/lib/auth-guard';

describe('redirectTarget', () => {
  it('sends unauthenticated /admin visitors to /login', () => {
    expect(redirectTarget('/admin', false)).toBe('/login');
    expect(redirectTarget('/admin/profile', false)).toBe('/login');
  });

  it('lets authenticated visitors into /admin', () => {
    expect(redirectTarget('/admin', true)).toBeNull();
  });

  it('sends authenticated visitors away from /login to /admin', () => {
    expect(redirectTarget('/login', true)).toBe('/admin');
  });

  it('leaves the public site alone for everyone', () => {
    expect(redirectTarget('/', false)).toBeNull();
    expect(redirectTarget('/', true)).toBeNull();
    expect(redirectTarget('/login', false)).toBeNull();
  });
});
