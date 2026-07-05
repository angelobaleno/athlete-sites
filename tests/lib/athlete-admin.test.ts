import { describe, it, expect } from 'vitest';
import { getPublicClient } from '../../src/lib/supabase';
import { saveProfileSection } from '../../src/lib/athlete-admin';

describe('saveProfileSection (anon client is RLS-blocked from writing)', () => {
  it('anon cannot save a section (owner-only update)', async () => {
    const anon = getPublicClient();
    const { data } = await anon.from('athletes').select('id').eq('slug', 'tyler-baleno').maybeSingle();
    if (!data) return; // no seed → nothing to assert
    const res = await saveProfileSection(anon as any, data.id, 'identity',
      { first: 'Hacked', last: 'X', position: 'DB' });
    expect('error' in res).toBe(true); // RLS blocks the update → 0 rows / error
  });
});
