import { describe, it, expect } from 'vitest';
import { validateOffers, moveOffer } from '../../src/lib/offers-admin';
import type { Offer } from '../../src/lib/types';

describe('validateOffers', () => {
  it('rejects a non-array', () => {
    expect('error' in validateOffers({})).toBe(true);
  });
  it('normalizes a schoolId offer to just {schoolId}, dropping resolved fields', () => {
    const res = validateOffers([{ schoolId: 'abc', school: 'Robert Morris', level: 'FCS', logoUrl: 'x' }]);
    expect(res).toEqual({ offers: [{ schoolId: 'abc' }] });
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
