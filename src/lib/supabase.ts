import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/** Anon, read-only client. Safe for SSR/public reads. */
export function getPublicClient(): SupabaseClient {
  if (!url || !anon) throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Service-role client. SERVER ONLY — never import into browser code. */
export function getServiceClient(): SupabaseClient {
  const service = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, service, { auth: { persistSession: false } });
}
