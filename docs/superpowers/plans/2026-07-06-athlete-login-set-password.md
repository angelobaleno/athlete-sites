# Athlete Login: Set-Password + Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an invited athlete set their own password (and reset a forgotten one) through pages in this app, landing signed in on `/admin`.

**Architecture:** Supabase invite/recovery emails link to a new server route `/auth/confirm` that verifies a one-time `token_hash` with the existing `@supabase/ssr` cookie client, setting the session cookie. The athlete then reaches a session-gated `/set-password` page and sets a password via `updateUser`. Forgot-password reuses the same confirm → set-password path via `resetPasswordForEmail`. Everything stays in the existing SSR cookie model — no browser Supabase client.

**Tech Stack:** Astro (SSR, `output: server`, `@astrojs/vercel`), Preact islands, `@supabase/ssr` + `@supabase/supabase-js`, Vitest.

## Global Constraints

- **No public signup.** No route creates a user; the invite (Angelo, in Supabase) is the only way onto the platform. `resetPasswordForEmail` always returns success — never reveal whether an email exists.
- Astro API routes and pages that touch auth set `export const prerender = false;`.
- Auth mutations create a fresh request-bound client with `createServerSupabase(context)` (mirror `src/pages/api/auth/login.ts`) — do not reuse `locals.supabase` for cookie-writing routes.
- Password rule: minimum **8** characters; `confirm` must equal `password`.
- Reuse `src/components/admin/LoginForm.css` styling by giving new form islands `class="login-form"`; no new effects, no layout shift.
- Tests: `npm test` runs `vitest run`. Live tests gate on `SUPABASE_SERVICE_ROLE_KEY` with `describe.skipIf(!canRun)`.

---

### Task 1: `parseNewPassword` validator

**Files:**
- Modify: `src/lib/auth-input.ts`
- Test: `tests/lib/auth-input.test.ts`

**Interfaces:**
- Produces: `parseNewPassword(body: unknown): { password: string } | { error: string }`

- [ ] **Step 1: Write the failing tests** — append to `tests/lib/auth-input.test.ts`:

```ts
import { parseNewPassword } from '../../src/lib/auth-input';

describe('parseNewPassword', () => {
  it('accepts matching passwords of 8+ chars', () => {
    expect(parseNewPassword({ password: 'secret12', confirm: 'secret12' }))
      .toEqual({ password: 'secret12' });
  });
  it('rejects a password under 8 chars', () => {
    expect(parseNewPassword({ password: 'short1', confirm: 'short1' })).toHaveProperty('error');
  });
  it('rejects a mismatch', () => {
    expect(parseNewPassword({ password: 'secret12', confirm: 'secret13' })).toHaveProperty('error');
  });
  it('rejects a missing field or non-object body', () => {
    expect(parseNewPassword({ password: 'secret12' })).toHaveProperty('error');
    expect(parseNewPassword(null)).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/lib/auth-input.test.ts`
Expected: FAIL — `parseNewPassword is not a function`.

- [ ] **Step 3: Implement** — append to `src/lib/auth-input.ts`:

```ts
export function parseNewPassword(body: unknown): { password: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request body' };
  const { password, confirm } = body as Record<string, unknown>;
  if (typeof password !== 'string' || password.length < 8) {
    return { error: 'Password must be at least 8 characters' };
  }
  if (typeof confirm !== 'string' || confirm !== password) {
    return { error: 'Passwords do not match' };
  }
  return { password };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/lib/auth-input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-input.ts tests/lib/auth-input.test.ts
git commit -m "feat(auth): parseNewPassword — 8-char minimum + confirm match"
```

---

### Task 2: Auth-guard routing for the new paths

**Files:**
- Modify: `src/lib/auth-guard.ts`
- Test: `tests/lib/auth-guard.test.ts`

**Interfaces:**
- Consumes: existing `redirectTarget(pathname, isAuthed)`, `needsAuth(pathname)`.
- Produces: same signatures, extended behavior.

- [ ] **Step 1: Write the failing tests** — add cases to `tests/lib/auth-guard.test.ts`:

```ts
it('sends unauthenticated /set-password visitors to /login', () => {
  expect(redirectTarget('/set-password', false)).toBe('/login');
});
it('lets authenticated visitors set a password (recovery session)', () => {
  expect(redirectTarget('/set-password', true)).toBeNull();
});
it('resolves session on the confirm + set-password routes', () => {
  expect(needsAuth('/auth/confirm')).toBe(true);
  expect(needsAuth('/set-password')).toBe(true);
});
it('leaves the forgot page public', () => {
  expect(needsAuth('/forgot')).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/lib/auth-guard.test.ts`
Expected: FAIL — `/set-password` returns null / `needsAuth('/auth/confirm')` is false.

- [ ] **Step 3: Implement** — edit `src/lib/auth-guard.ts`:

In `redirectTarget`, add before the final `return null;`:

```ts
  if (pathname === '/set-password' && !isAuthed) return '/login';
```

In `needsAuth`, extend the returned expression to include the two new paths:

```ts
  return (
    pathname === '/admin' || pathname.startsWith('/admin/') ||
    pathname === '/login' ||
    pathname === '/auth/confirm' ||
    pathname === '/set-password' ||
    pathname === '/api' || pathname.startsWith('/api/')
  );
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run tests/lib/auth-guard.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-guard.ts tests/lib/auth-guard.test.ts
git commit -m "feat(auth): route guard for /auth/confirm + /set-password"
```

---

### Task 3: `/auth/confirm` token verification route

**Files:**
- Create: `src/pages/auth/confirm.ts`

**Interfaces:**
- Consumes: `createServerSupabase(context)` from `src/lib/supabase-server.ts`.
- Produces: `GET` route that verifies `token_hash` and redirects.

- [ ] **Step 1: Implement** — create `src/pages/auth/confirm.ts`:

```ts
import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../lib/supabase-server';

export const prerender = false;

// Supabase invite/recovery emails link here with a one-time token_hash. Verifying
// it sets the session cookie (via the @supabase/ssr cookie adapter); the athlete
// is then a normal signed-in user and can set a password on /set-password.
export const GET: APIRoute = async (context) => {
  const url = new URL(context.request.url);
  const token_hash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type');
  if (!token_hash || (type !== 'invite' && type !== 'recovery')) {
    return context.redirect('/login?error=expired');
  }
  const supabase = createServerSupabase(context);
  const { error } = await supabase.auth.verifyOtp({ token_hash, type });
  if (error) return context.redirect('/login?error=expired');
  return context.redirect('/set-password');
};
```

- [ ] **Step 2: Verify it builds and type-checks**

Run: `npx astro check && npm run build`
Expected: 0 errors; `/auth/confirm` appears in the build's route list.

- [ ] **Step 3: Smoke-test the invalid path locally**

Run: `npm run build && npm run preview` (in another shell), then
`curl -sI "http://localhost:4321/auth/confirm" | grep -i location`
Expected: `location: /login?error=expired` (no token → redirect, no cookie).

- [ ] **Step 4: Commit**

```bash
git add src/pages/auth/confirm.ts
git commit -m "feat(auth): /auth/confirm — verify invite/recovery token_hash, set session"
```

---

### Task 4: Set-password screen (page + island + API)

**Files:**
- Create: `src/pages/set-password.astro`
- Create: `src/components/admin/SetPasswordForm.tsx`
- Create: `src/pages/api/auth/set-password.ts`

**Interfaces:**
- Consumes: `parseNewPassword` (Task 1), `createServerSupabase` (existing), `Admin` layout, `LoginForm.css`.
- Produces: `POST /api/auth/set-password` accepting `{ password, confirm }` → `{ ok: true }` | `{ error }`.

- [ ] **Step 1: Implement the API route** — create `src/pages/api/auth/set-password.ts`:

```ts
import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';
import { parseNewPassword } from '../../../lib/auth-input';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = parseNewPassword(await context.request.json().catch(() => null));
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 });
  }
  const supabase = createServerSupabase(context);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401 });
  }
  const { error } = await supabase.auth.updateUser({ password: parsed.password });
  if (error) {
    return new Response(JSON.stringify({ error: 'Could not set password' }), { status: 400 });
  }
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

- [ ] **Step 2: Implement the island** — create `src/components/admin/SetPasswordForm.tsx`:

```tsx
import { useState } from 'preact/hooks';
import './LoginForm.css';

export default function SetPasswordForm() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/set-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, confirm }),
    });
    if (res.ok) {
      window.location.href = '/admin';
      return;
    }
    const data = await res.json().catch(() => ({ error: 'Could not set password' }));
    setError(data.error ?? 'Could not set password');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} class="login-form">
      <label>New password
        <input type="password" value={password} required minLength={8} autocomplete="new-password"
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
      </label>
      <label>Confirm password
        <input type="password" value={confirm} required minLength={8} autocomplete="new-password"
          onInput={(e) => setConfirm((e.target as HTMLInputElement).value)} />
      </label>
      {error && <p class="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Saving…' : 'Set password'}</button>
    </form>
  );
}
```

- [ ] **Step 3: Implement the page** — create `src/pages/set-password.astro`:

```astro
---
import Admin from '../layouts/Admin.astro';
import SetPasswordForm from '../components/admin/SetPasswordForm.tsx';
export const prerender = false;
// The verify step (or a recovery session) authenticated this request. The guard
// already bounces unauthenticated visitors; keep a defensive check.
if (!Astro.locals.user) return Astro.redirect('/login');
---
<Admin title="Set your password">
  <h1>Set your password</h1>
  <p>Choose a password to finish setting up your account.</p>
  <SetPasswordForm client:load />
  <style>
    h1 { font-family: var(--a-display); }
  </style>
</Admin>
```

- [ ] **Step 4: Verify build + type-check**

Run: `npx astro check && npm run build`
Expected: 0 errors; `/set-password` and `/api/auth/set-password` in the route list.

- [ ] **Step 5: Smoke-test the gate**

Run against `npm run preview`:
`curl -sI "http://localhost:4321/set-password" | grep -i location`
Expected: `location: /login` (unauthenticated → guard redirect).
`curl -s -X POST "http://localhost:4321/api/auth/set-password" -H 'Content-Type: application/json' -d '{"password":"x","confirm":"x"}' -o /dev/null -w '%{http_code}'`
Expected: `400` (fails `parseNewPassword` before any auth work).

- [ ] **Step 6: Commit**

```bash
git add src/pages/set-password.astro src/components/admin/SetPasswordForm.tsx src/pages/api/auth/set-password.ts
git commit -m "feat(auth): set-password screen — gated page, island, updateUser route"
```

---

### Task 5: Forgot-password flow (page + island + API)

**Files:**
- Create: `src/pages/forgot.astro`
- Create: `src/components/admin/ForgotPasswordForm.tsx`
- Create: `src/pages/api/auth/forgot.ts`
- Modify: `src/pages/login.astro` (add the link)

**Interfaces:**
- Consumes: `createServerSupabase` (existing), `Admin` layout, `LoginForm.css`.
- Produces: `POST /api/auth/forgot` accepting `{ email }` → always `{ ok: true }` (unless the body has no email → 400).

- [ ] **Step 1: Implement the API route** — create `src/pages/api/auth/forgot.ts`:

```ts
import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => null);
  const email = (body && typeof (body as Record<string, unknown>).email === 'string')
    ? ((body as Record<string, string>).email).trim() : '';
  if (!email) {
    return new Response(JSON.stringify({ error: 'Email is required' }), { status: 400 });
  }
  const supabase = createServerSupabase(context);
  const origin = new URL(context.request.url).origin;
  // Fire-and-forget: never reveal whether the email exists (no enumeration).
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${origin}/auth/confirm` });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

- [ ] **Step 2: Implement the island** — create `src/components/admin/ForgotPasswordForm.tsx`:

```tsx
import { useState } from 'preact/hooks';
import './LoginForm.css';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    await fetch('/api/auth/forgot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    setSent(true);
    setBusy(false);
  }

  if (sent) {
    return <p role="status">If an account exists for that email, a reset link is on its way.</p>;
  }
  return (
    <form onSubmit={onSubmit} class="login-form">
      <label>Email
        <input type="email" value={email} required autocomplete="email"
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      </label>
      <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
    </form>
  );
}
```

- [ ] **Step 3: Implement the page** — create `src/pages/forgot.astro`:

```astro
---
import Admin from '../layouts/Admin.astro';
import ForgotPasswordForm from '../components/admin/ForgotPasswordForm.tsx';
export const prerender = false;
---
<Admin title="Reset password">
  <h1>Reset your password</h1>
  <p>Enter your email and we'll send a link to set a new password.</p>
  <ForgotPasswordForm client:load />
  <p><a href="/login" class="back">← Back to sign in</a></p>
  <style>
    h1 { font-family: var(--a-display); }
    .back { color: var(--a-accent); }
  </style>
</Admin>
```

- [ ] **Step 4: Link it from login** — in `src/pages/login.astro`, add after `<LoginForm client:load />`:

```astro
  <p><a href="/forgot" class="forgot">Forgot password?</a></p>
```

and add to the page `<style>` block:

```css
    .forgot { color: var(--a-accent); font-size: 0.9rem; }
```

- [ ] **Step 5: Verify build + type-check**

Run: `npx astro check && npm run build`
Expected: 0 errors; `/forgot` and `/api/auth/forgot` in the route list.

- [ ] **Step 6: Smoke-test the no-enumeration contract**

Run against `npm run preview`:
`curl -s -X POST "http://localhost:4321/api/auth/forgot" -H 'Content-Type: application/json' -d '{"email":"nobody@nowhere.test"}' -o /dev/null -w '%{http_code}'`
Expected: `200` (always ok for any well-formed email).

- [ ] **Step 7: Commit**

```bash
git add src/pages/forgot.astro src/components/admin/ForgotPasswordForm.tsx src/pages/api/auth/forgot.ts src/pages/login.astro
git commit -m "feat(auth): forgot-password — reset request page, island, route + login link"
```

---

### Task 6: Live token_hash contract test

**Files:**
- Create: `tests/lib/auth-set-password.test.ts`

**Interfaces:**
- Consumes: `getPublicClient` from `src/lib/supabase.ts`; `@supabase/supabase-js` service client; `SUPABASE_SERVICE_ROLE_KEY`.

Proves the Supabase mechanism the routes depend on: an admin-generated invite `token_hash` verifies into a session, `updateUser` sets a password, and the athlete can then sign in with it — plus an invalid token fails.

- [ ] **Step 1: Write the test** — create `tests/lib/auth-set-password.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the full suite**

Run: `npm test`
Expected: PASS (this file runs because `.env.local` provides the service key; skips in CI without it).

- [ ] **Step 3: Commit**

```bash
git add tests/lib/auth-set-password.test.ts
git commit -m "test(auth): live token_hash → verify → set password → sign-in contract"
```

---

### Task 7: Supabase dashboard configuration (browser)

**Files:** none (Supabase project settings).

Angelo has authorized doing this in the browser. Production origin: `https://tyler-baleno-site.vercel.app`.

- [ ] **Step 1: Site URL** — Authentication → URL Configuration → set **Site URL** to `https://tyler-baleno-site.vercel.app`.
- [ ] **Step 2: Redirect allowlist** — add `https://tyler-baleno-site.vercel.app/auth/confirm` and `http://localhost:4321/auth/confirm`.
- [ ] **Step 3: Invite email template** — Authentication → Email Templates → Invite user → set the link href to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
- [ ] **Step 4: Reset email template** — Reset Password template → set the link href to:
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`
- [ ] **Step 5: Record** what changed in the PR description / commit message for the deploy.

---

### Task 8: Deploy + end-to-end verification (browser)

**Files:** none (verification).

- [ ] **Step 1: Merge + deploy** — push `feat/athlete-login`, open a PR to `master`, merge; confirm the Vercel production deploy is `READY` at the latest commit.
- [ ] **Step 2: Real invite round trip** — in Supabase, delete + re-invite `tylerabal@icloud.com` (or a scratch email you control). Open the email on a device, click the link → confirm it lands on `https://tyler-baleno-site.vercel.app/set-password` (not localhost), set a password ≥ 8 chars, confirm it redirects to `/admin` signed in.
- [ ] **Step 3: Forgot round trip** — from `/login`, click "Forgot password?", submit the same email, confirm the neutral message, open the email, set a new password, confirm sign-in.
- [ ] **Step 4: Negative check** — visit `/set-password` in a signed-out browser → redirected to `/login`. Visit `/auth/confirm` with no token → `/login?error=expired`.
- [ ] **Step 5: Update the runbook** — in `docs/NEW-ATHLETE.md`, replace the manual admin-password activation with "invite the email in Supabase; the athlete sets their own password via the emailed link." Commit.

---

## Notes for the implementer

- `Admin.astro` accepts optional `brand` / `name` props (used by `/admin`); `/set-password`, `/forgot`, and `/login` render pre-auth with the neutral default — do not pass brand props.
- `getPublicClient()` (in `src/lib/supabase.ts`) is the anon browser-style client with the `ws` transport already wired for Node — reuse it in tests; never construct a raw client there.
- Do not add a password-change UI to `/admin` in this plan; resetting via `/forgot` covers rotation. That's a deliberate scope boundary.
