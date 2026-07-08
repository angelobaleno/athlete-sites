import type { SupabaseClient } from '@supabase/supabase-js';
import { createPlainAnonClient } from './supabase-admin';

export type AthleteAdminRow = {
  slug: string; name: string; ownerLinked: boolean; ownerEmail: string | null;
};

async function findUserByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function listAthletes(admin: SupabaseClient): Promise<AthleteAdminRow[]> {
  const { data: rows, error } = await admin
    .from('athletes').select('slug,owner_user_id,profile').order('slug');
  if (error) throw error;
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? null]));
  return (rows ?? []).map((r) => {
    const identity = (r.profile as { identity?: { first?: string; last?: string } })?.identity;
    const name = `${identity?.first ?? ''} ${identity?.last ?? ''}`.trim() || r.slug;
    return {
      slug: r.slug, name,
      ownerLinked: !!r.owner_user_id,
      ownerEmail: r.owner_user_id ? (emailById.get(r.owner_user_id) ?? null) : null,
    };
  });
}

export async function resetAthletePassword(
  email: string, origin: string,
): Promise<{ ok: true } | { error: string }> {
  const anon = createPlainAnonClient();
  const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function inviteAthlete(
  admin: SupabaseClient, slug: string, email: string, origin: string,
): Promise<{ ok: true; created: boolean } | { error: string }> {
  const existing = await findUserByEmail(admin, email);
  let userId: string;
  let created = false;
  if (existing) {
    userId = existing.id;
    const reset = await resetAthletePassword(email, origin);   // existing user → let them (re)set a pw
    if ('error' in reset) return reset;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/auth/confirm` });
    if (error || !data.user) return { error: error?.message ?? 'Invite failed' };
    userId = data.user.id; created = true;
  }
  const { data: linked, error: linkErr } = await admin
    .from('athletes').update({ owner_user_id: userId }).eq('slug', slug).select('slug');
  if (linkErr) return { error: linkErr.message };
  if (!linked || linked.length === 0) return { error: `No athlete with slug "${slug}"` };
  return { ok: true, created };
}

export async function setTempPassword(
  admin: SupabaseClient, email: string, password: string,
): Promise<{ ok: true } | { error: string }> {
  if (password.length < 8) return { error: 'Password must be at least 8 characters' };
  const user = await findUserByEmail(admin, email);
  if (!user) return { error: `No login found for ${email}` };
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) return { error: error.message };
  return { ok: true };
}
