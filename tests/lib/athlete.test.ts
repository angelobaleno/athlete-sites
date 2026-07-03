import { describe, it, expect } from 'vitest';
import { getAthleteBySlug, resolveOffers } from '../../src/lib/athlete';

describe('getAthleteBySlug', () => {
  it('returns Tyler with a 9-game schedule and preserved placeholders', async () => {
    const rec = await getAthleteBySlug('tyler-baleno');
    expect(rec).not.toBeNull();
    expect(rec!.profile.identity.last).toBe('Baleno');
    expect(rec!.profile.schedule).toHaveLength(9);
    const shuttle = rec!.profile.measurables.find((m) => m.label === 'Shuttle');
    expect(shuttle?.placeholder).toBe(true);
    expect(rec!.cardVisibility.academics).toBe(true);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getAthleteBySlug('nobody')).toBeNull();
  });
});

describe('resolveOffers', () => {
  it('expands a {schoolId} offer into full school fields', async () => {
    const rec = await getAthleteBySlug('tyler-baleno');
    const resolved = await resolveOffers(rec!.profile.offers);
    expect(resolved[0].school).toMatch(/robert morris/i);
    expect(resolved[0].level).toBeTruthy();
  });
});
