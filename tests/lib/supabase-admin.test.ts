import { describe, it, expect } from 'vitest';
import { createAdminClient, createPlainAnonClient } from '../../src/lib/supabase-admin';

describe('client factories', () => {
  it('build clients when env is present', () => {
    // .env.local supplies the keys in this repo's test run.
    expect(typeof createAdminClient().auth.admin.listUsers).toBe('function');
    expect(typeof createPlainAnonClient().auth.resetPasswordForEmail).toBe('function');
  });
});
