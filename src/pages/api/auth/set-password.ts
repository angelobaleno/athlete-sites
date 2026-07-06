import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';
import { parseNewPassword } from '../../../lib/auth-input';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = parseNewPassword(await context.request.json().catch(() => null));
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 });
  }
  const supabase = createServerSupabase(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) {
    return new Response(JSON.stringify({ error: 'Could not set password' }), { status: 400 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
