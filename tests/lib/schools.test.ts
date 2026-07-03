import { describe, it, expect } from 'vitest';
import { searchSchools } from '../../src/lib/schools';

describe('searchSchools', () => {
  it('finds Robert Morris by partial name', async () => {
    const results = await searchSchools('robert morris');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toMatch(/robert morris/i);
    expect(results[0].level).toBe('FCS');
  });

  it('returns [] for gibberish', async () => {
    expect(await searchSchools('zzzzznotaschool')).toEqual([]);
  });

  it('returns [] for empty query', async () => {
    expect(await searchSchools('   ')).toEqual([]);
  });
});
