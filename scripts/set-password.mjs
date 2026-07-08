// Sets (or resets) an athlete's login password directly, no email required.
// The invite/reset EMAIL path needs custom SMTP (Resend) wired up; until then this
// is the reliable way to give an athlete a working password out-of-band.
// Usage: node --env-file=.env.local scripts/set-password.mjs <email> <password>
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const [email, password] = process.argv.slice(2);
if (!email || !password) throw new Error('Usage: set-password.mjs <email> <password>');
if (password.length < 8) throw new Error('Password must be at least 8 characters (matches the app rule).');

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

// Set the password and confirm the email so they can sign in immediately.
const { error } = await db.auth.admin.updateUserById(user.id, {
  password,
  email_confirm: true,
});
if (error) throw error;
console.log(`Password set for ${email} (${user.id}). They can sign in at /login.`);
