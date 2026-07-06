import type { APIRoute } from 'astro';
import { validatePhoto } from '../../../lib/photo-admin';
import { getOwnedAthlete, savePhotoUrl } from '../../../lib/athlete-admin';

export const prerender = false;

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
};

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const form = await context.request.formData().catch(() => null);
  const file = form?.get('photo');
  if (!(file instanceof File)) return json({ error: 'Missing photo file' }, 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  const valid = validatePhoto({ type: file.type, size: file.size, bytes });
  if ('error' in valid) return json({ error: valid.error }, 400);

  const record = await getOwnedAthlete(context.locals.supabase, user.id);
  if (!record) return json({ error: 'No editable record for this account' }, 404);

  // Unique, id-keyed path: the folder is what the storage policy (0004)
  // authorizes; the timestamp keeps every upload a fresh object so the
  // CDN-cached public URL never serves a stale image.
  const path = `${record.id}/hero-${Date.now()}.${EXT[file.type]}`;
  const storage = context.locals.supabase.storage.from('profile-photos');
  const { error: uploadErr } = await storage.upload(path, bytes, { contentType: file.type });
  if (uploadErr) return json({ error: uploadErr.message }, 400);

  const { data: { publicUrl } } = storage.getPublicUrl(path);
  const res = await savePhotoUrl(context.locals.supabase, record.id, publicUrl);
  if ('error' in res) return json({ error: res.error }, 400);

  return json({ ok: true, photoUrl: publicUrl }, 200);
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
