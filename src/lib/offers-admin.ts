import type { Offer } from './types';

function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

export function validateOffers(input: unknown): { offers: Offer[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Offers must be a list' };
  const offers: Offer[] = [];
  for (const raw of input) {
    if (raw == null || typeof raw !== 'object') return { error: 'Invalid offer' };
    const o = raw as Record<string, unknown>;
    const schoolId = str(o.schoolId).trim();
    if (schoolId !== '') { offers.push({ schoolId }); continue; }
    const school = str(o.school).trim();
    if (school === '') return { error: 'Each offer needs a school (pick one or enter it manually)' };
    offers.push({ school, short: str(o.short), level: str(o.level), location: str(o.location) });
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
