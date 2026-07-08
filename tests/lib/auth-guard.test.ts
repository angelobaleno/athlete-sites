import { describe, it, expect } from 'vitest';
import { redirectTarget, needsAuth } from '../../src/lib/auth-guard';

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

  it('sends unauthenticated /set-password visitors to /login', () => {
    expect(redirectTarget('/set-password', false)).toBe('/login');
  });
  it('lets authenticated visitors set a password (recovery session)', () => {
    expect(redirectTarget('/set-password', true)).toBeNull();
  });
});

describe('needsAuth', () => {
  it('requires session resolution on the admin surface', () => {
    expect(needsAuth('/admin')).toBe(true);
    expect(needsAuth('/admin/anything')).toBe(true);
    expect(needsAuth('/login')).toBe(true);
  });
  it('requires session resolution on all API routes', () => {
    expect(needsAuth('/api/profile/offers')).toBe(true);
    expect(needsAuth('/api/schools')).toBe(true);
    expect(needsAuth('/api/auth/logout')).toBe(true);
  });
  it('skips session resolution on public pages (no per-view auth round trip)', () => {
    expect(needsAuth('/')).toBe(false);
    expect(needsAuth('/s/tyler-baleno')).toBe(false);
    expect(needsAuth('/preview/bare')).toBe(false);
  });
  it('does not treat lookalike prefixes as protected', () => {
    expect(needsAuth('/administration')).toBe(false);
    expect(needsAuth('/apifoo')).toBe(false);
  });
  it('resolves session on the confirm + set-password routes', () => {
    expect(needsAuth('/auth/confirm')).toBe(true);
    expect(needsAuth('/set-password')).toBe(true);
  });
  it('leaves the forgot page public', () => {
    expect(needsAuth('/forgot')).toBe(false);
  });
});
