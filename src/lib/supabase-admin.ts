import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';

// Node 20 (Vercel runtime) has no native WebSocket; hand supabase-js `ws` so its
// eager realtime construction doesn't throw. These clients are auth/data only.
const realtime = { transport: WebSocket as unknown as typeof globalThis.WebSocket };
const url = (import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL) as string;
const anon = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY) as string;
const service = (import.meta.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY) as string;

/** Service-role client — bypasses RLS. SERVER ONLY. Never import from an island. */
export function createAdminClient(): SupabaseClient {
  if (!url || !service) throw new Error('Missing PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, service, { auth: { persistSession: false }, realtime });
}

/** Cookie-less anon client, used to send recovery emails from server actions. */
export function createPlainAnonClient(): SupabaseClient {
  if (!url || !anon) throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anon, { auth: { persistSession: false }, realtime });
}
