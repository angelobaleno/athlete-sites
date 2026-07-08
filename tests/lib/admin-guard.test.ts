import { describe, it, expect } from 'vitest';
import { isAdmin, requireAdmin } from '../../src/lib/admin-guard';

describe('isAdmin', () => {
  const raw = 'aaa-111, bbb-222 , ccc-333';
  it('matches an id in the list (whitespace-tolerant)', () => {
    expect(isAdmin('bbb-222', raw)).toBe(true);
    expect(isAdmin('ccc-333', raw)).toBe(true);
  });
  it('rejects ids not in the list', () => {
    expect(isAdmin('zzz-999', raw)).toBe(false);
  });
  it('fails closed on empty/undefined inputs', () => {
    expect(isAdmin('aaa-111', '')).toBe(false);
    expect(isAdmin('aaa-111', undefined)).toBe(false);
    expect(isAdmin(undefined, raw)).toBe(false);
    expect(isAdmin(null, raw)).toBe(false);
  });
});

describe('requireAdmin', () => {
  const raw = 'aaa-111';
  it('returns null for an admin user', () => {
    expect(requireAdmin({ id: 'aaa-111' }, raw)).toBeNull();
  });
  it('returns a 403 Response for a non-admin or missing user', () => {
    const res = requireAdmin({ id: 'zzz' }, raw);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(requireAdmin(null, raw)!.status).toBe(403);
  });
});
