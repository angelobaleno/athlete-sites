import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';
import { parseLoginBody } from '../../../lib/auth-input';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = parseLoginBody(await context.request.json().catch(() => null));
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 });
  }
  const supabase = createServerSupabase(context);
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email, password: parsed.password,
  });
  if (error) {
    return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 });
  }
  // signInWithPassword set the session cookie via the cookie adapter.
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
