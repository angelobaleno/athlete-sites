import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../lib/supabase-server';

export const prerender = false;

// Supabase invite/recovery emails link here with a one-time token_hash. Verifying
// it sets the session cookie (via the @supabase/ssr cookie adapter); the athlete
// is then a normal signed-in user and can set a password on /set-password.
export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (!token_hash || (type !== 'invite' && type !== 'recovery')) {
    return context.redirect('/login?error=expired');
  }
  const supabase = createServerSupabase(context);
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) return context.redirect('/login?error=expired');
  return context.redirect('/set-password');
};
