export function parseLoginBody(body: unknown): { email: string; password: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request body' };
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || email.trim() === '') return { error: 'Email is required' };
  if (typeof password !== 'string' || password === '') return { error: 'Password is required' };
  return { email: email.trim(), password };
}

export function parseNewPassword(body: unknown): { password: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request body' };
  const { password, confirm } = body as Record<string, unknown>;
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }
  if (typeof confirm !== 'string' || confirm !== password) {
    return { error: 'Passwords do not match' };
  }
  return { password };
}
