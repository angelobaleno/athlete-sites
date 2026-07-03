// Links an athletes row to a Supabase auth user by email.
// Usage: node --env-file=.env.local scripts/link-owner.mjs <email> <slug>
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [email, slug] = process.argv.slice(2);
if (!email || !slug) throw new Error('Usage: link-owner.mjs <email> <slug>');

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Find the auth user by email via the admin API.
const { data: list, error: listErr } = await db.auth.admin.listUsers();
if (listErr) throw listErr;
const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
if (!user) throw new Error(`No auth user with email ${email}`);

const { error } = await db.from('athletes')
  .update({ owner_user_id: user.id })
  .eq('slug', slug);
if (error) throw error;
console.log(`Linked ${email} (${user.id}) -> athletes/${slug}`);
