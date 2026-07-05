import type { SupabaseClient } from '@supabase/supabase-js';
import type { AthleteProfile, AthleteRecord } from './types';
import { SECTIONS, applySectionValues, type SectionKey } from './profile-sections';

/** Read the athlete row owned by this user (RLS-safe: owner reads own row). */
export async function getOwnedAthlete(
  supabase: SupabaseClient, userId: string,
): Promise<AthleteRecord | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('id,slug,profile,card_visibility,photo_url')
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, slug: data.slug, profile: data.profile,
    cardVisibility: data.card_visibility, photoUrl: data.photo_url,
  };
}

/**
 * Apply edited field values to one profile section and persist it.
 * RLS (policy `athletes_owner_update`, owner-only) is the security boundary —
 * this never uses the service client.
 */
export async function saveProfileSection(
  supabase: SupabaseClient, athleteId: string, key: SectionKey, values: Record<string, string>,
): Promise<{ ok: true } | { error: string }> {
  const def = SECTIONS.find((s) => s.key === key);
  if (!def) return { error: `Unknown section "${key}"` };

  const { data: row, error: readErr } = await supabase
    .from('athletes').select('profile').eq('id', athleteId).maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: 'Record not found' };

  const profile = row.profile as AthleteProfile;
  const applied = applySectionValues(def, profile[key], values);
  if ('error' in applied) return { error: applied.error };

  const nextProfile = { ...profile, [key]: applied.data };
  const { data: updated, error: writeErr } = await supabase
    .from('athletes').update({ profile: nextProfile }).eq('id', athleteId).select('id');
  if (writeErr) return { error: writeErr.message };
  if (!updated || updated.length === 0) return { error: 'Not authorized to edit this record' };
  return { ok: true };
}
