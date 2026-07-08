import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-guard';
import { createAdminClient } from '../../../lib/supabase-admin';
import { inviteAthlete } from '../../../lib/admin-actions';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context.locals.user);
  if (forbidden) return forbidden;
  const body = await context.request.json().catch(() => null) as { slug?: string; email?: string } | null;
  const slug = body?.slug?.trim();
  const email = body?.email?.trim();
  if (!slug || !email) {
    return new Response(JSON.stringify({ error: 'slug and email are required' }), { status: 400 });
  }
  const origin = new URL(context.request.url).origin;
  const result = await inviteAthlete(createAdminClient(), slug, email, origin);
  return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 });
};
