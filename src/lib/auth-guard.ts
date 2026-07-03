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
