import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-guard';
import { resetAthletePassword } from '../../../lib/admin-actions';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context.locals.user);
  if (forbidden) return forbidden;
  const body = await context.request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email) {
    return new Response(JSON.stringify({ error: 'email is required' }), { status: 400 });
  }
  const origin = new URL(context.request.url).origin;
  const result = await resetAthletePassword(email, origin);
  return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 });
};
