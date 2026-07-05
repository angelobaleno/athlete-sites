/**
 * Pure routing decision for the auth middleware.
 * @returns a path to redirect to, or null to allow the request through.
 */
export function redirectTarget(pathname: string, isAuthed: boolean): string | null {
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdmin && !isAuthed) return '/login';
  if (pathname === '/login' && isAuthed) return '/admin';
  return null;
}

/**
 * Whether this request needs its session resolved (a Supabase network call).
 * Public pages skip it: recruiters loading an athlete's site must never pay
 * an auth round trip, and cached public responses must never carry cookies.
 */
export function needsAuth(pathname: string): boolean {
  return (
    pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/login' ||
    pathname === '/api' || pathname.startsWith('/api/')
  );
}
