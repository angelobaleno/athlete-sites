import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createServerSupabase(context);
  await supabase.auth.signOut();
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
