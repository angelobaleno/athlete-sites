import { getPublicClient } from './supabase';
import { normalizeProfile } from './profile-guard';
import type { AthleteRecord, Offer, School } from './types';

/** Fetch one athlete's full record by slug (public read). */
export async function getAthleteBySlug(slug: string): Promise<AthleteRecord | null> {
  const { data, error } = await getPublicClient()
    .from('athletes')
    .select('id,slug,profile,card_visibility,photo_url')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    slug: data.slug,
    profile: normalizeProfile(data.profile),
    cardVisibility: data.card_visibility,
    photoUrl: data.photo_url,
  };
}

/** Expand any {schoolId} offers into full school fields; manual offers pass through. */
export async function resolveOffers(offers: Offer[]): Promise<Offer[]> {
  const ids = offers.map((o) => o.schoolId).filter(Boolean) as string[];
  let byId = new Map<string, School>();
  if (ids.length) {
    const { data, error } = await getPublicClient()
      .from('schools')
      .select('id,name,short,level,conference,location,logo_url')
      .in('id', ids);
    if (error) throw error;
    byId = new Map(
      (data ?? []).map((r) => [r.id, {
        id: r.id, name: r.name, short: r.short, level: r.level as 'FBS' | 'FCS',
        conference: r.conference, location: r.location, logoUrl: r.logo_url,
      }]),
    );
  }
  return offers.map((o) => {
    if (o.schoolId && byId.has(o.schoolId)) {
      const s = byId.get(o.schoolId)!;
      // School-table values are defaults; any explicit field on the offer wins,
      // so a picked school can keep a custom level label or a hand-made logo.
      return {
        schoolId: o.schoolId,
        school: o.school ?? s.name,
        short: o.short ?? s.short,
        level: o.level ?? s.level,
        location: o.location ?? s.location ?? undefined,
        logoUrl: o.logoUrl ?? s.logoUrl ?? undefined,
      };
    }
    return o; // manual fallback passes through
  });
}
