import { getPublicClient } from './supabase';
import type { School } from './types';

/** Typeahead search over the seeded FBS/FCS reference table (by name). */
export async function searchSchools(query: string, limit = 8): Promise<School[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await getPublicClient()
    .from('schools')
    .select('id,name,short,level,conference,location,logo_url')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, short: r.short, level: r.level as 'FBS' | 'FCS',
    conference: r.conference, location: r.location, logoUrl: r.logo_url,
  }));
}
