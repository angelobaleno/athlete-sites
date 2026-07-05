import { describe, it, expect } from 'vitest';
import { validateOffers, moveOffer, offerRows } from '../../src/lib/offers-admin';
import type { Offer } from '../../src/lib/types';

describe('validateOffers', () => {
  it('rejects a non-array', () => {
    expect('error' in validateOffers({})).toBe(true);
  });
  it('keeps a bare schoolId offer bare (picker adds stay table-driven)', () => {
    const res = validateOffers([{ schoolId: 'abc' }]);
    expect(res).toEqual({ offers: [{ schoolId: 'abc' }] });
  });
  it('preserves explicit override fields on a schoolId offer (hand-set level/logo survive a save)', () => {
    const res = validateOffers([{ schoolId: 'abc', level: 'NCAA Division I · FCS', logoUrl: 'images/logos/rmu.svg' }]);
    expect(res).toEqual({ offers: [{ schoolId: 'abc', level: 'NCAA Division I · FCS', logoUrl: 'images/logos/rmu.svg' }] });
  });
  it('drops empty-string fields from a schoolId offer instead of storing them as overrides', () => {
    const res = validateOffers([{ schoolId: 'abc', school: '', level: '', logoUrl: '' }]);
    expect(res).toEqual({ offers: [{ schoolId: 'abc' }] });
  });
  it('keeps logoUrl on a manual offer', () => {
    const res = validateOffers([{ school: 'Some Prep', short: 'SP', level: 'D2', location: 'PA', logoUrl: 'images/logos/sp.svg' }]);
    expect(res).toEqual({ offers: [{ school: 'Some Prep', short: 'SP', level: 'D2', location: 'PA', logoUrl: 'images/logos/sp.svg' }] });
  });
  it('rejects a list longer than 50 offers', () => {
    const many = Array.from({ length: 51 }, (_, i) => ({ schoolId: `id-${i}` }));
    expect('error' in validateOffers(many)).toBe(true);
  });
  it('rejects a field longer than 200 characters', () => {
    expect('error' in validateOffers([{ school: 'x'.repeat(201) }])).toBe(true);
  });
  it('keeps manual offer fields when there is no schoolId', () => {
    const res = validateOffers([{ school: 'Some Prep', short: 'SP', level: 'D2', location: 'PA' }]);
    expect(res).toEqual({ offers: [{ school: 'Some Prep', short: 'SP', level: 'D2', location: 'PA' }] });
  });
  it('coerces missing manual fields to empty strings', () => {
    const res = validateOffers([{ school: 'X' }]) as { offers: Offer[] };
    expect(res.offers[0]).toEqual({ school: 'X', short: '', level: '', location: '' });
  });
  it('rejects an offer with neither schoolId nor school', () => {
    expect('error' in validateOffers([{ level: 'FCS' }])).toBe(true);
  });
  it('accepts an empty list', () => {
    expect(validateOffers([])).toEqual({ offers: [] });
  });
});

describe('moveOffer', () => {
  const a: Offer = { schoolId: 'a' }; const b: Offer = { schoolId: 'b' }; const c: Offer = { schoolId: 'c' };
  it('moves an item up', () => {
    expect(moveOffer([a, b, c], 1, 'up')).toEqual([b, a, c]);
  });
  it('moves an item down', () => {
    expect(moveOffer([a, b, c], 1, 'down')).toEqual([a, c, b]);
  });
  it('is a no-op at the top edge', () => {
    expect(moveOffer([a, b, c], 0, 'up')).toEqual([a, b, c]);
  });
  it('is a no-op at the bottom edge', () => {
    expect(moveOffer([a, b, c], 2, 'down')).toEqual([a, b, c]);
  });
  it('does not mutate the input', () => {
    const arr = [a, b, c]; moveOffer(arr, 1, 'up'); expect(arr).toEqual([a, b, c]);
  });
});

describe('offerRows', () => {
  it('pairs each RAW offer with display text from its resolved twin', () => {
    const raw: Offer[] = [{ schoolId: 'rmu', level: 'NCAA Division I · FCS' }];
    const resolved: Offer[] = [{
      schoolId: 'rmu', school: 'Robert Morris', short: 'RMU',
      level: 'NCAA Division I · FCS', location: 'Moon Township, PA',
    }];
    expect(offerRows(raw, resolved)).toEqual([{
      offer: { schoolId: 'rmu', level: 'NCAA Division I · FCS' },
      label: 'Robert Morris',
      sub: 'NCAA Division I · FCS · Moon Township, PA',
    }]);
  });
  it('labels an unresolvable offer clearly instead of hiding it', () => {
    const raw: Offer[] = [{ schoolId: 'dangling' }];
    expect(offerRows(raw, raw)).toEqual([{
      offer: { schoolId: 'dangling' }, label: '(unknown school)', sub: '',
    }]);
  });
});
