import { describe, it, expect, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { setTempPassword, listAthletes } from '../../src/lib/admin-actions';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
const canRun = !!(url && serviceKey && anonKey);
const realtime = { transport: WebSocket as unknown as typeof globalThis.WebSocket };

describe.skipIf(!canRun)('admin-actions (live)', () => {
  const admin = createClient(url!, serviceKey!, { auth: { persistSession: false }, realtime });
  const email = `admin-actions-${crypto.randomUUID()}@example.com`;
  let userId: string | undefined;

  afterAll(async () => { if (userId) await admin.auth.admin.deleteUser(userId); });

  it('lists athletes with a name and link status', async () => {
    const rows = await listAthletes(admin);
    expect(Array.isArray(rows)).toBe(true);
    const tyler = rows.find((r) => r.slug === 'tyler-baleno');
    expect(tyler?.ownerLinked).toBe(true);
  });

  it('setTempPassword lets a created user sign in', async () => {
    const { data } = await admin.auth.admin.createUser({ email, email_confirm: true });
    userId = data.user?.id;
    const pw = `tmp-${crypto.randomUUID()}`;
    const res = await setTempPassword(admin, email, pw);
    expect(res).toEqual({ ok: true });
    const anon = createClient(url!, anonKey!, { auth: { persistSession: false }, realtime });
    const { error } = await anon.auth.signInWithPassword({ email, password: pw });
    expect(error).toBeNull();
  });

  it('setTempPassword rejects a short password', async () => {
    expect(await setTempPassword(admin, email, 'short')).toEqual({ error: 'Password must be at least 8 characters' });
  });
});
