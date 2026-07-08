/** Parse the ADMIN_USER_IDS allowlist and test membership. Fails closed. */
export function isAdmin(
  userId: string | null | undefined,
  raw: string | undefined = process.env.ADMIN_USER_IDS,
): boolean {
  if (!userId || !raw) return false;
  return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(userId);
}

/** 403 gate for admin API routes. Returns null when allowed, else a Response. */
export function requireAdmin(
  user: { id: string } | null | undefined,
  raw?: string,
): Response | null {
  if (isAdmin(user?.id, raw)) return null;
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
}
