import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import WebSocket from 'ws';
import { getPublicClient } from '../../src/lib/supabase';

// THE product invariant: an athlete edits their own content and nothing else.
// These tests hit the live database with a real signed-in session:
//   1. a signed-in stranger cannot touch another athlete's row (RLS),
//   2. an owner cannot update locked columns like slug (column grants),
//   3. an owner CAN update their own profile (positive control — proves the
//      session works, so 1 and 2 aren't passing vacuously).
// Requires SUPABASE_SERVICE_ROLE_KEY (test-user setup/teardown only).

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const canRun = Boolean(url && serviceKey);

const realtime = { transport: WebSocket as unknown as typeof globalThis.WebSocket };

const email = `invariant-test-${Date.now()}@example.com`;
const password = `it-${crypto.randomUUID()}`;
const slug = `invariant-test-${Date.now()}`;

let service: SupabaseClient;
let session: SupabaseClient; // anon client signed in as the test user
let userId: string;
let athleteId: string;

describe.skipIf(!canRun)('athlete self-service invariants (live RLS + grants)', () => {
  beforeAll(async () => {
    service = createClient(url!, serviceKey!, { auth: { persistSession: false }, realtime });

    const { data: created, error: userErr } = await service.auth.admin.createUser({
      email, password, email_confirm: true,
    });
    if (userErr) throw userErr;
    userId = created.user.id;

    const { data: row, error: rowErr } = await service
      .from('athletes')
      .insert({ owner_user_id: userId, slug, profile: { honors: ['seed'] } })
      .select('id').single();
    if (rowErr) throw rowErr;
    athleteId = row.id;

    session = getPublicClient();
    const { error: signInErr } = await session.auth.signInWithPassword({ email, password });
    if (signInErr) throw signInErr;
  }, 30_000);

  afterAll(async () => {
    if (service) {
      if (athleteId) await service.from('athletes').delete().eq('id', athleteId);
      if (userId) await service.auth.admin.deleteUser(userId);
    }
  }, 30_000);

  it('owner CAN update their own profile (positive control)', async () => {
    const { data, error } = await session
      .from('athletes')
      .update({ profile: { honors: ['updated-by-owner'] } })
      .eq('id', athleteId)
      .select('id');
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
  });

  it("signed-in stranger CANNOT update another athlete's row", async () => {
    const { data, error } = await session
      .from('athletes')
      .update({ profile: { honors: ['hacked'] } })
      .eq('slug', 'tyler-baleno')
      .select('id');
    // RLS: either an explicit error or zero rows touched.
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true);
  });

  it('owner CANNOT update their own slug (locked column)', async () => {
    const { error } = await session
      .from('athletes')
      .update({ slug: `${slug}-moved` })
      .eq('id', athleteId)
      .select('id');
    expect(error).not.toBeNull(); // column-level grant: permission denied
  });

  it('owner CANNOT write into the profile-photos bucket outside their own folder', async () => {
    const { error } = await session.storage
      .from('profile-photos')
      .upload(`00000000-0000-0000-0000-000000000000/intruder.txt`, new Blob(['x']));
    expect(error).not.toBeNull();
  });

  it('owner CAN write inside their own athlete folder (positive control)', async () => {
    const path = `${athleteId}/probe.txt`;
    const { error } = await session.storage
      .from('profile-photos')
      .upload(path, new Blob(['ok']));
    expect(error).toBeNull();
    await service.storage.from('profile-photos').remove([path]);
  });
});
