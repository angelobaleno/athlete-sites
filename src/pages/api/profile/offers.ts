import type { APIRoute } from 'astro';
import { validateOffers } from '../../../lib/offers-admin';
import { getOwnedAthlete, saveOffers } from '../../../lib/athlete-admin';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const body = await context.request.json().catch(() => null);
  const validated = validateOffers(body && typeof body === 'object' ? (body as any).offers : undefined);
  if ('error' in validated) return json({ error: validated.error }, 400);

  const record = await getOwnedAthlete(context.locals.supabase, user.id);
  if (!record) return json({ error: 'No editable record for this account' }, 404);

  const res = await saveOffers(context.locals.supabase, record.id, validated.offers);
  if ('error' in res) return json({ error: res.error }, 400);
  return json({ ok: true }, 200);
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
