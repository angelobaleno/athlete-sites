import type { Offer } from './types';

const MAX_OFFERS = 50;
const MAX_FIELD = 200;

function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

export function validateOffers(input: unknown): { offers: Offer[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Offers must be a list' };
  if (input.length > MAX_OFFERS) return { error: `No more than ${MAX_OFFERS} offers` };
  const offers: Offer[] = [];
  for (const raw of input) {
    if (raw == null || typeof raw !== 'object') return { error: 'Invalid offer' };
    const o = raw as Record<string, unknown>;
    const fields = {
      school: str(o.school), short: str(o.short), level: str(o.level),
      location: str(o.location), logoUrl: str(o.logoUrl),
    };
    if (Object.values(fields).some((v) => v.length > MAX_FIELD)) {
      return { error: `Offer fields are limited to ${MAX_FIELD} characters` };
    }
    const schoolId = str(o.schoolId).trim();
    if (schoolId !== '') {
      // Explicit non-empty fields are kept as overrides of the school-table
      // defaults (resolveOffers: any explicit field on the offer wins).
      const overrides = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v.trim() !== ''),
      );
      offers.push({ schoolId, ...overrides });
      continue;
    }
    if (fields.school.trim() === '') {
      return { error: 'Each offer needs a school (pick one or enter it manually)' };
    }
    const { logoUrl, ...manual } = fields;
    offers.push(logoUrl.trim() !== '' ? { ...manual, logoUrl } : manual);
  }
  return { offers };
}

export function moveOffer(offers: Offer[], index: number, dir: 'up' | 'down'): Offer[] {
  const next = [...offers];
  const target = dir === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
