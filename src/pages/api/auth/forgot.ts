import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => null);
  const email = (body && typeof (body as Record<string, unknown>).email === 'string')
    ? ((body as Record<string, string>).email).trim() : '';
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
  }
  const supabase = createServerSupabase(context);
  const origin = new URL(context.request.url).origin;
  // Fire-and-forget: never reveal whether the email exists (no enumeration).
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
