export function parseLoginBody(body: unknown): { email: string; password: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request body' };
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || email.trim() === '') return { error: 'Email is required' };
  if (typeof password !== 'string' || password === '') return { error: 'Password is required' };
  return { email: email.trim(), password };
}
