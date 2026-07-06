import { describe, it, expect, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { getPublicClient } from '../../src/lib/supabase';

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceKey);
const realtime = { transport: WebSocket as unknown as typeof globalThis.WebSocket };

const email = `setpw-test-${Date.now()}@example.com`;
let service: SupabaseClient;
let userId: string | undefined;

describe.skipIf(!canRun)('set-password via invite token_hash (live)', () => {
  afterAll(async () => {
    if (service && userId) await service.auth.admin.deleteUser(userId);
  }, 30_000);

  it('invite token_hash verifies, sets a password, and the user can sign in', async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false }, realtime });

    const { data: link, error: linkErr } = await service.auth.admin.generateLink({
      type: 'invite', email,
    });
    expect(linkErr).toBeNull();
    userId = link!.user?.id;
    const token_hash = link!.properties.hashed_token;

    const anon = getPublicClient();
    const { data: verified, error: vErr } = await anon.auth.verifyOtp({ token_hash, type: 'invite' });
    expect(vErr).toBeNull();
    expect(verified.session).not.toBeNull();

    const newPassword = `setpw-${crypto.randomUUID()}`;
    const { error: upErr } = await anon.auth.updateUser({ password: newPassword });
    expect(upErr).toBeNull();
    await anon.auth.signOut();

    const fresh = getPublicClient();
    const { error: signInErr } = await fresh.auth.signInWithPassword({ email, password: newPassword });
    expect(signInErr).toBeNull();
  }, 30_000);

  it('rejects a garbage token_hash', async () => {
    const anon = getPublicClient();
    const { error } = await anon.auth.verifyOtp({ token_hash: 'not-a-real-token', type: 'invite' });
    expect(error).not.toBeNull();
  });
});
