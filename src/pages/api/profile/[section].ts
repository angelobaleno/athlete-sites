import type { APIRoute } from 'astro';
import { SECTIONS, type SectionKey } from '../../../lib/profile-sections';
import { getOwnedAthlete, saveProfileSection } from '../../../lib/athlete-admin';

export const prerender = false;

const isSection = (v: string): v is SectionKey => SECTIONS.some((s) => s.key === v);

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const section = context.params.section ?? '';
  if (!isSection(section)) return json({ error: 'Unknown section' }, 400);

  const body = await context.request.json().catch(() => null);
  const values = (body && typeof body === 'object' && (body as any).values) as unknown;
  if (typeof values !== 'object' || values === null) {
    return json({ error: 'Missing values' }, 400);
  }

  const record = await getOwnedAthlete(context.locals.supabase, user.id);
  if (!record) return json({ error: 'No editable record for this account' }, 404);

  const res = await saveProfileSection(
    context.locals.supabase, record.id, section, values as Record<string, string>,
  );
  if ('error' in res) return json({ error: res.error }, 400);
  return json({ ok: true }, 200);
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
