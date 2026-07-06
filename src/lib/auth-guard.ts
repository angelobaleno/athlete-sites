/**
 * Pure routing decision for the auth middleware.
 * @returns a path to redirect to, or null to allow the request through.
 */
export function redirectTarget(pathname: string, isAuthed: boolean): string | null {
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdmin && !isAuthed) return '/login';
  if (pathname === '/login' && isAuthed) return '/admin';
  // /set-password needs the invite/recovery session verify put in place; an
  // unauthenticated visitor has no token to act on, so send them to sign in.
  if (pathname === '/set-password' && !isAuthed) return '/login';
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
    pathname === '/auth/confirm' ||
    pathname === '/set-password' ||
    pathname === '/api' || pathname.startsWith('/api/')
  );
}
