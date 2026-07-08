# Admin Console Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin-only console at `/admin` where the platform owner manages athlete logins (list, invite, reset, set temp password) without the Supabase dashboard or CLI scripts.

**Architecture:** A server-side allowlist (`ADMIN_USER_IDS`) identifies the admin. The `/admin` page branches: admin → console, athlete → existing dashboard. Console actions call `/api/admin/*` routes that use a service-role client (bypasses RLS) and **fail closed** on a non-admin caller. Reuses the shipped `@supabase/ssr` cookie/session model.

**Tech Stack:** Astro (SSR, `output: server`, `@astrojs/vercel`), Preact islands, `@supabase/supabase-js` (admin API), `@supabase/ssr`, Vitest.

## Global Constraints

- **Auth ≠ authorization.** Middleware already redirects signed-out users off `/admin` and `/api/*` (`needsAuth` covers both). Every admin action *additionally* checks the caller is on the `ADMIN_USER_IDS` allowlist. Fail closed.
- **Service-role key is server-only.** `SUPABASE_SERVICE_ROLE_KEY` is used only in `src/lib/supabase-admin.ts`, `src/lib/admin-actions.ts`, and `/api/admin/*`. Never imported by an island or anything shipped to the browser.
- Astro API routes/pages that touch auth set `export const prerender = false;`.
- Admin identity is by **user UUID**, never email (email is user-mutable).
- Password rule: minimum **8** characters (reuse the existing `parseNewPassword` bar).
- Islands reuse `src/components/admin/LoginForm.css` (`class="login-form"`); no new effects, no layout shift (inline status text sits in reserved space).
- Env at runtime on Vercel comes from `process.env`; read secrets as `process.env.X` (mirror `supabase-server.ts`'s `import.meta.env.X ?? process.env.X` for the public URL/anon key).
- Tests: `npm test` runs `vitest run`. Live tests gate on `SUPABASE_SERVICE_ROLE_KEY` with `describe.skipIf(!canRun)`.

---

### Task 1: Admin guard (`isAdmin` + `requireAdmin`)

**Files:**
- Create: `src/lib/admin-guard.ts`
- Test: `tests/lib/admin-guard.test.ts`

**Interfaces:**
- Produces: `isAdmin(userId: string | null | undefined, raw?: string): boolean` — `raw` defaults to `process.env.ADMIN_USER_IDS`. `requireAdmin(user: { id: string } | null): Response | null` — returns a 403 `Response` when the user isn't an admin, else `null`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/lib/admin-guard.test.ts
import { describe, it, expect } from 'vitest';
import { isAdmin, requireAdmin } from '../../src/lib/admin-guard';

describe('isAdmin', () => {
  const raw = 'aaa-111, bbb-222 , ccc-333';
  it('matches an id in the list (whitespace-tolerant)', () => {
    expect(isAdmin('bbb-222', raw)).toBe(true);
    expect(isAdmin('ccc-333', raw)).toBe(true);
  });
  it('rejects ids not in the list', () => {
    expect(isAdmin('zzz-999', raw)).toBe(false);
  });
  it('fails closed on empty/undefined inputs', () => {
    expect(isAdmin('aaa-111', '')).toBe(false);
    expect(isAdmin('aaa-111', undefined)).toBe(false);
    expect(isAdmin(undefined, raw)).toBe(false);
    expect(isAdmin(null, raw)).toBe(false);
  });
});

describe('requireAdmin', () => {
  const raw = 'aaa-111';
  it('returns null for an admin user', () => {
    expect(requireAdmin({ id: 'aaa-111' }, raw)).toBeNull();
  });
  it('returns a 403 Response for a non-admin or missing user', async () => {
    const res = requireAdmin({ id: 'zzz' }, raw);
    expect(res).not.toBeNull();
    expect(res!.status).toBe(403);
    expect(requireAdmin(null, raw)!.status).toBe(403);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/lib/admin-guard.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/admin-guard.ts
/** Parse the ADMIN_USER_IDS allowlist and test membership. Fails closed. */
export function isAdmin(
  userId: string | null | undefined,
  raw: string | undefined = process.env.ADMIN_USER_IDS,
): boolean {
  if (!userId || !raw) return false;
  return raw.split(',').map((s) => s.trim()).filter(Boolean).includes(userId);
}

/** 403 gate for admin API routes. Returns null when allowed, else a Response. */
export function requireAdmin(
  user: { id: string } | null | undefined,
  raw?: string,
): Response | null {
  if (isAdmin(user?.id, raw)) return null;
  return new Response(JSON.stringify({ error: 'Forbidden' }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/lib/admin-guard.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-guard.ts tests/lib/admin-guard.test.ts
git commit -m "feat(admin): isAdmin allowlist + requireAdmin 403 gate"
```

---

### Task 2: Service-role + plain-anon client factories

**Files:**
- Create: `src/lib/supabase-admin.ts`
- Test: `tests/lib/supabase-admin.test.ts`

**Interfaces:**
- Produces: `createAdminClient(): SupabaseClient` (service role, bypasses RLS) and `createPlainAnonClient(): SupabaseClient` (anon, no cookies — for `resetPasswordForEmail`). Both throw if their required env is missing.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/supabase-admin.test.ts
import { describe, it, expect } from 'vitest';
import { createAdminClient, createPlainAnonClient } from '../../src/lib/supabase-admin';

describe('client factories', () => {
  it('build clients when env is present', () => {
    // .env.local supplies the keys in this repo's test run.
    expect(typeof createAdminClient().auth.admin.listUsers).toBe('function');
    expect(typeof createPlainAnonClient().auth.resetPasswordForEmail).toBe('function');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/lib/supabase-admin.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/lib/supabase-admin.ts
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
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/lib/supabase-admin.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase-admin.ts tests/lib/supabase-admin.test.ts
git commit -m "feat(admin): service-role + plain-anon client factories"
```

---

### Task 3: Admin actions (list / invite / reset / set temp password)

**Files:**
- Create: `src/lib/admin-actions.ts`
- Test: `tests/lib/admin-actions.test.ts`

**Interfaces:**
- Consumes: `createPlainAnonClient` (Task 2); a `SupabaseClient` admin instance passed in by the caller (routes pass `createAdminClient()`).
- Produces:
  - `type AthleteAdminRow = { slug: string; name: string; ownerLinked: boolean; ownerEmail: string | null }`
  - `listAthletes(admin): Promise<AthleteAdminRow[]>`
  - `inviteAthlete(admin, slug, email, origin): Promise<{ ok: true; created: boolean } | { error: string }>`
  - `resetAthletePassword(email, origin): Promise<{ ok: true } | { error: string }>`
  - `setTempPassword(admin, email, password): Promise<{ ok: true } | { error: string }>`

- [ ] **Step 1: Write the failing live test**

```ts
// tests/lib/admin-actions.test.ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/lib/admin-actions.test.ts`
Expected: FAIL — module not found (or all skipped if no service key; the CI/local run here has it).

- [ ] **Step 3: Implement**

```ts
// src/lib/admin-actions.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { createPlainAnonClient } from './supabase-admin';

export type AthleteAdminRow = {
  slug: string; name: string; ownerLinked: boolean; ownerEmail: string | null;
};

async function findUserByEmail(admin: SupabaseClient, email: string) {
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function listAthletes(admin: SupabaseClient): Promise<AthleteAdminRow[]> {
  const { data: rows, error } = await admin
    .from('athletes').select('slug,owner_user_id,profile').order('slug');
  if (error) throw error;
  const { data: userList } = await admin.auth.admin.listUsers();
  const emailById = new Map((userList?.users ?? []).map((u) => [u.id, u.email ?? null]));
  return (rows ?? []).map((r) => {
    const id = (r.profile as { identity?: { first?: string; last?: string } })?.identity;
    const name = `${id?.first ?? ''} ${id?.last ?? ''}`.trim() || r.slug;
    return {
      slug: r.slug, name,
      ownerLinked: !!r.owner_user_id,
      ownerEmail: r.owner_user_id ? (emailById.get(r.owner_user_id) ?? null) : null,
    };
  });
}

export async function resetAthletePassword(
  email: string, origin: string,
): Promise<{ ok: true } | { error: string }> {
  const anon = createPlainAnonClient();
  const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function inviteAthlete(
  admin: SupabaseClient, slug: string, email: string, origin: string,
): Promise<{ ok: true; created: boolean } | { error: string }> {
  const existing = await findUserByEmail(admin, email);
  let userId: string;
  let created = false;
  if (existing) {
    userId = existing.id;
    const reset = await resetAthletePassword(email, origin);   // existing user → let them (re)set a pw
    if ('error' in reset) return reset;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${origin}/auth/confirm` });
    if (error || !data.user) return { error: error?.message ?? 'Invite failed' };
    userId = data.user.id; created = true;
  }
  const { data: linked, error: linkErr } = await admin
    .from('athletes').update({ owner_user_id: userId }).eq('slug', slug).select('slug');
  if (linkErr) return { error: linkErr.message };
  if (!linked || linked.length === 0) return { error: `No athlete with slug "${slug}"` };
  return { ok: true, created };
}

export async function setTempPassword(
  admin: SupabaseClient, email: string, password: string,
): Promise<{ ok: true } | { error: string }> {
  if (password.length < 8) return { error: 'Password must be at least 8 characters' };
  const user = await findUserByEmail(admin, email);
  if (!user) return { error: `No login found for ${email}` };
  const { error } = await admin.auth.admin.updateUserById(user.id, { password, email_confirm: true });
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/lib/admin-actions.test.ts`
Expected: PASS (3 tests; live path uses `.env.local`).

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin-actions.ts tests/lib/admin-actions.test.ts
git commit -m "feat(admin): list/invite/reset/set-temp-password actions"
```

---

### Task 4: Admin API routes

**Files:**
- Create: `src/pages/api/admin/invite.ts`, `src/pages/api/admin/reset.ts`, `src/pages/api/admin/set-password.ts`

**Interfaces:**
- Consumes: `requireAdmin` (Task 1), `createAdminClient` (Task 2), `inviteAthlete`/`resetAthletePassword`/`setTempPassword` (Task 3).

- [ ] **Step 1: Implement the three routes**

```ts
// src/pages/api/admin/invite.ts
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-guard';
import { createAdminClient } from '../../../lib/supabase-admin';
import { inviteAthlete } from '../../../lib/admin-actions';
export const prerender = false;
export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context.locals.user);
  if (forbidden) return forbidden;
  const body = await context.request.json().catch(() => null) as { slug?: string; email?: string } | null;
  const slug = body?.slug?.trim(); const email = body?.email?.trim();
  if (!slug || !email) return new Response(JSON.stringify({ error: 'slug and email are required' }), { status: 400 });
  const origin = new URL(context.request.url).origin;
  const result = await inviteAthlete(createAdminClient(), slug, email, origin);
  return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 });
};
```

```ts
// src/pages/api/admin/reset.ts
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-guard';
import { resetAthletePassword } from '../../../lib/admin-actions';
export const prerender = false;
export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context.locals.user);
  if (forbidden) return forbidden;
  const body = await context.request.json().catch(() => null) as { email?: string } | null;
  const email = body?.email?.trim();
  if (!email) return new Response(JSON.stringify({ error: 'email is required' }), { status: 400 });
  const origin = new URL(context.request.url).origin;
  const result = await resetAthletePassword(email, origin);
  return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 });
};
```

```ts
// src/pages/api/admin/set-password.ts
import type { APIRoute } from 'astro';
import { requireAdmin } from '../../../lib/admin-guard';
import { createAdminClient } from '../../../lib/supabase-admin';
import { setTempPassword } from '../../../lib/admin-actions';
export const prerender = false;
export const POST: APIRoute = async (context) => {
  const forbidden = requireAdmin(context.locals.user);
  if (forbidden) return forbidden;
  const body = await context.request.json().catch(() => null) as { email?: string; password?: string } | null;
  const email = body?.email?.trim(); const password = body?.password ?? '';
  if (!email) return new Response(JSON.stringify({ error: 'email is required' }), { status: 400 });
  const result = await setTempPassword(createAdminClient(), email, password);
  return new Response(JSON.stringify(result), { status: 'error' in result ? 400 : 200 });
};
```

- [ ] **Step 2: Verify build + type-check**

Run: `npx astro check && npm run build`
Expected: 0 errors; `/api/admin/invite`, `/api/admin/reset`, `/api/admin/set-password` appear in the route list.

- [ ] **Step 3: Smoke-test the gate (signed-out → not 200)**

Run: `npm run build && npm run preview` (separate shell), then
`curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:4321/api/admin/reset -H "Content-Type: application/json" -d '{"email":"x@y.com"}'`
Expected: `403` (no session → middleware/requireAdmin blocks; never 200).

- [ ] **Step 4: Commit**

```bash
git add src/pages/api/admin/
git commit -m "feat(admin): /api/admin invite, reset, set-password routes (admin-gated)"
```

---

### Task 5: Admin console island

**Files:**
- Create: `src/components/admin/AdminConsole.tsx`, `src/components/admin/AdminConsole.css`

**Interfaces:**
- Consumes: `AthleteAdminRow` shape (Task 3), the three `/api/admin/*` routes (Task 4).
- Produces: `default` Preact component `AdminConsole({ athletes }: { athletes: AthleteAdminRow[] })`.

- [ ] **Step 1: Implement the island**

```tsx
// src/components/admin/AdminConsole.tsx
import { useState } from 'preact/hooks';
import type { AthleteAdminRow } from '../../lib/admin-actions';
import './AdminConsole.css';

async function post(path: string, body: unknown): Promise<{ ok?: boolean; error?: string; created?: boolean }> {
  const res = await fetch(path, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  return res.json().catch(() => ({ error: 'Request failed' }));
}

function Row({ a }: { a: AthleteAdminRow }) {
  const [email, setEmail] = useState(a.ownerEmail ?? '');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  async function run(label: string, fn: () => Promise<{ ok?: boolean; error?: string; created?: boolean }>) {
    setBusy(true); setStatus('');
    const r = await fn();
    setStatus(r.error ? `⚠ ${r.error}` : label);
    setBusy(false);
  }

  return (
    <tr>
      <td><strong>{a.name}</strong><span class="slug">/{a.slug}</span></td>
      <td>
        <input type="email" value={email} placeholder="athlete@email.com" disabled={busy}
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      </td>
      <td class="actions">
        <button type="button" disabled={busy || !email}
          onClick={() => run(a.ownerLinked ? 'Re-invite sent' : 'Invite sent',
            () => post('/api/admin/invite', { slug: a.slug, email }))}>
          {a.ownerLinked ? 'Re-invite' : 'Invite'}
        </button>
        <button type="button" disabled={busy || !a.ownerLinked}
          onClick={() => run('Reset email sent', () => post('/api/admin/reset', { email: a.ownerEmail }))}>
          Send reset
        </button>
        <button type="button" disabled={busy || !a.ownerLinked}
          onClick={async () => {
            const pw = `tmp-${Math.random().toString(36).slice(2, 10)}A1`;
            await run(`Temp password: ${pw}`, () => post('/api/admin/set-password', { email: a.ownerEmail, password: pw }));
          }}>
          Set temp password
        </button>
      </td>
      <td><span class="status" role="status">{status}</span></td>
    </tr>
  );
}

export default function AdminConsole({ athletes }: { athletes: AthleteAdminRow[] }) {
  return (
    <table class="admin-console">
      <thead><tr><th>Athlete</th><th>Login email</th><th>Actions</th><th>Status</th></tr></thead>
      <tbody>{athletes.map((a) => <Row key={a.slug} a={a} />)}</tbody>
    </table>
  );
}
```

```css
/* src/components/admin/AdminConsole.css */
.admin-console { width: 100%; border-collapse: collapse; font-size: 0.92rem; }
.admin-console th, .admin-console td { text-align: left; padding: 0.7rem 0.6rem; border-bottom: 1px solid var(--a-border, rgba(255,255,255,.1)); vertical-align: middle; }
.admin-console th { font-family: var(--a-display); text-transform: uppercase; letter-spacing: .08em; font-size: .7rem; color: var(--a-muted); }
.admin-console .slug { color: var(--a-muted); margin-left: .4rem; font-size: .8rem; }
.admin-console input { width: 100%; max-width: 15rem; padding: .4rem .5rem; }
.admin-console .actions { display: flex; gap: .4rem; flex-wrap: wrap; }
.admin-console .status { display: inline-block; min-width: 12rem; min-height: 1.2em; color: var(--a-accent); } /* reserved space — no layout shift */
```

- [ ] **Step 2: Verify build**

Run: `npx astro check && npm run build`
Expected: 0 errors; the island bundles.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/AdminConsole.tsx src/components/admin/AdminConsole.css
git commit -m "feat(admin): AdminConsole island — per-athlete invite/reset/temp-pw"
```

---

### Task 6: Branch the `/admin` page

**Files:**
- Modify: `src/pages/admin/index.astro`

**Interfaces:**
- Consumes: `isAdmin` (Task 1), `createAdminClient` (Task 2), `listAthletes` (Task 3), `AdminConsole` (Task 5).

- [ ] **Step 1: Add the admin branch above the existing dashboard render**

In the frontmatter, after `const user = Astro.locals.user; if (!user) return Astro.redirect('/login');`, add:

```ts
import AdminConsole from '../../components/admin/AdminConsole.tsx';
import { isAdmin } from '../../lib/admin-guard';
import { createAdminClient } from '../../lib/supabase-admin';
import { listAthletes } from '../../lib/admin-actions';

const admin = isAdmin(user.id);
const athletes = admin ? await listAthletes(createAdminClient()) : [];
```

Then wrap the returned markup so the admin sees the console and the athlete sees the existing dashboard:

```astro
{admin ? (
  <Admin title="Admin" name={user.email}>
    <header class="admin-header"><div><h1>Athlete Logins</h1>
      <p class="signed-in">Signed in as {user.email}</p></div><LogoutButton client:load /></header>
    <AdminConsole client:load athletes={athletes} />
  </Admin>
) : (
  <!-- existing athlete-dashboard markup, unchanged -->
)}
```

- [ ] **Step 2: Verify build + type-check**

Run: `npx astro check && npm run build`
Expected: 0 errors.

- [ ] **Step 3: Live smoke — admin sees console, athlete sees editor**

Run: `npm test && npm run build`, then locally sign in as the admin (`ADMIN_USER_IDS` set in `.env.local`, see Task 7) at `/login` → `/admin` shows the console table; sign in as Tyler → `/admin` shows the editor.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat(admin): /admin branches to console for admins, editor for athletes"
```

---

### Task 7: Config, docs, verify & ship

**Files:**
- Modify: `.env.example`, `docs/NEW-ATHLETE.md`

- [ ] **Step 1: Get the admin UUID and set local env**

Run (prints Angelo's auth user id):
`node --env-file=.env.local -e 'import("@supabase/supabase-js").then(async({createClient})=>{const d=createClient(process.env.PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});const{data}=await d.auth.admin.listUsers();console.log(data.users.find(u=>u.email==="angelojbaleno@gmail.com")?.id)})'`
Then add to `.env.local`: `ADMIN_USER_IDS=<that-uuid>`

- [ ] **Step 2: Document the env var**

Add to `.env.example`: `ADMIN_USER_IDS=` with a comment `# comma-separated Supabase auth user UUIDs granted the /admin console`.
Add a one-line note in `docs/NEW-ATHLETE.md` (the "Follow-ups" / admin section): the admin console at `/admin` now handles invite/reset/temp-password; `link-owner.mjs` + `set-password.mjs` remain as CLI fallbacks.

- [ ] **Step 3: Full green gate**

Run: `npm test && npx astro check && npm run build`
Expected: all tests pass, 0 check errors, build completes.

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/NEW-ATHLETE.md
git commit -m "chore(admin): document ADMIN_USER_IDS + console in runbook"
```

- [ ] **Step 5: Ship**

Merge the working branch to `master`, push. **Then add `ADMIN_USER_IDS` to Vercel → Project → Settings → Environment Variables (Production)** with Angelo's UUID and redeploy (Angelo's step — the console 403s for everyone until it's set in prod). Verify live: sign in at `/login` → `/admin` shows the console; a `POST /api/admin/reset` while signed out returns 403.

---

## Notes for the executor
- Work on a feature branch (`feat/admin-console`), not `master`.
- `.env.local` already holds the Supabase keys; the live tests will actually run.
- Do not weaken any existing auth test. If `needsAuth`/`redirectTarget` need `/api/admin` coverage, it's already provided by the `/api/` prefix match in `auth-guard.ts` — no change needed.
