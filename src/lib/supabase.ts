import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Resolve env from Astro (import.meta.env) with a Node fallback (process.env)
// so the same module works under SSR and under Vitest. Guarded so it never
// throws if ever pulled into a browser bundle.
function env(key: string): string | undefined {
  const fromVite = (import.meta.env as Record<string, string | undefined>)[key];
  if (fromVite) return fromVite;
  return typeof process !== 'undefined' ? process.env[key] : undefined;
}

const url = env('PUBLIC_SUPABASE_URL');
const anon = env('PUBLIC_SUPABASE_ANON_KEY');

/** Anon, read-only client. Safe for SSR/public reads. */
export function getPublicClient(): SupabaseClient {
  if (!url || !anon) throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Service-role client. SERVER ONLY — never import into browser code. */
export function getServiceClient(): SupabaseClient {
  const service = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, service, { auth: { persistSession: false } });
}
