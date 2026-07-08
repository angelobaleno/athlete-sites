import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-guard';
import { createAdminClient } from '../../../lib/supabase-admin';
import { setTempPassword } from '../../../lib/admin-actions';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context.locals.user);
  if (forbidden) return forbidden;
  const body = await context.request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim();
  const password = body?.password ?? '';
  if (!email) {
    return new Response(JSON.stringify({ error: 'email is required' }), { status: 400 });
  }
  const result = await setTempPassword(createAdminClient(), email, password);
  return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 });
};
