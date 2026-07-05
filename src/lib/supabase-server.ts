import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';
import WebSocket from 'ws';

const url = (import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL) as string;
const anon = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY) as string;

/** Parse the raw Cookie header into {name,value} pairs for @supabase/ssr's getAll. */
function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(';').map((pair) => {
    const idx = pair.indexOf('=');
    const name = idx === -1 ? '' : pair.slice(0, idx).trim();
    const raw = idx === -1 ? '' : pair.slice(idx + 1).trim();
    let value = raw;
    try { value = decodeURIComponent(raw); } catch { value = raw; }
    return { name, value };
  }).filter((c) => c.name);
}

/**
 * An anon-key Supabase client bound to this request's cookies.
 * Session reads come from the incoming Cookie header; session writes
 * (login, token refresh, logout) are set back via Astro's cookies API.
 */
export function createServerSupabase(ctx: { request: Request; cookies: AstroCookies }): SupabaseClient {
  if (!url || !anon) throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
  return createServerClient(url, anon, {
    // @supabase/supabase-js constructs a realtime client eagerly, which probes for a
    // native WebSocket at build time. Node 20 (our Vercel runtime) lacks one — native
    // WebSocket only landed in Node 22 — so we hand it `ws`. This client is auth-only
    // and never opens a realtime connection, so the transport is never actually used.
    // Removable once we're on Node 22 (see the Astro 5 / Node 22 migration follow-up).
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
    cookies: {
      getAll: () => parseCookieHeader(ctx.request.headers.get('cookie')),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of cookiesToSet) {
          ctx.cookies.set(name, value, { ...options, path: '/', httpOnly: true, secure: import.meta.env.PROD });
        }
      },
    },
  });
}
