import { describe, it, expect } from 'vitest';
import { getPublicClient } from '../../src/lib/supabase';

describe('RLS', () => {
  it('anon can read an athlete profile', async () => {
    const { data, error } = await getPublicClient()
      .from('athletes').select('slug').eq('slug', 'tyler-baleno').maybeSingle();
    expect(error).toBeNull();
    expect(data?.slug).toBe('tyler-baleno');
  });

  it('anon CANNOT update an athlete profile', async () => {
    const { data, error } = await getPublicClient()
      .from('athletes').update({ slug: 'hacked' }).eq('slug', 'tyler-baleno').select();
    // RLS blocks the row: either an error, or zero rows affected.
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true);
  });
});
