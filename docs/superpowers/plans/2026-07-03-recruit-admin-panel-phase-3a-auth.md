# Recruit Admin Panel — Phase 3a: Auth & Protected Shell — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up email/password login, cookie-based server sessions, and a middleware guard so Tyler can sign in and reach a protected (empty) admin dashboard, while unauthenticated visitors are redirected to the login page.

**Architecture:** Astro stays SSR on Vercel. Auth uses Supabase email/password with **server-side cookie sessions** via `@supabase/ssr` — the browser never holds a service key or talks to Supabase auth directly; login/logout go through Astro API routes that set/clear the session cookie. A middleware runs on every request, builds a per-request authed Supabase client from cookies, exposes it and the current user on `context.locals`, and redirects unauthenticated requests away from `/admin`. Interactive bits (the login form) are **Preact** islands. The guard *decision* is a pure function so it can be unit-tested without a browser.

**Tech Stack:** Astro 4.x (existing, `output: 'server'`, Vercel adapter) · `@supabase/ssr` (cookie session client) · `@supabase/supabase-js` v2 (existing) · `@astrojs/preact` + `preact` (form islands) · Vitest (existing).

## Global Constraints

- **Node/Astro:** use the versions already in this project; do not upgrade Astro in this phase.
- **Secrets:** only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` reach the auth/session code. The `SUPABASE_SERVICE_ROLE_KEY` is used ONLY in the one-off `scripts/link-owner.mjs` (server, never shipped). Never send the service key to the browser.
- **Auth model (from spec):** no public signup. Angelo provisions each athlete's login. An authed user can write only their own `athletes` row (`owner_user_id = auth.uid()`), enforced by the existing RLS policy `athletes_owner_update` (migration `0002_rls.sql`).
- **Session transport:** cookie-based, HTTP-only, set/cleared server-side. The public site (`/`, anon read) is unaffected.
- **Types single source:** reuse `src/lib/types.ts`; add new shared types there if needed, don't redefine.
- **Slug:** Tyler's row is `slug = 'tyler-baleno'`; his login is linked by setting that row's `owner_user_id`.

---

## Human prerequisites (Angelo does these — I cannot create accounts or enter credentials)

- [ ] **P1: Confirm email auth is enabled.** Supabase dashboard → **Authentication → Providers → Email** is enabled (it is by default). Leave "Confirm email" ON is fine; because you create the user yourself (next step) they are pre-confirmed.
- [ ] **P2: Create Tyler's login.** Supabase dashboard → **Authentication → Users → Add user → Create new user**. Enter Tyler's email (use one you control for now, e.g. your own +tyler alias) and a temporary password. Check "Auto Confirm User." Save. Keep the email + password — the manual verify step (Task 8) uses them.
- [ ] **P3: (For local dev) have `.env.local` present** with `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (already created in Phase 1).

Tell me when P1–P2 are done and you have Tyler's test email + password; the automatable tasks below don't block on it until Task 8.

---

### Task 1: Install Preact + `@supabase/ssr`; type `App.Locals`

**Files:**
- Modify: `package.json`, `astro.config.mjs`
- Modify: `src/env.d.ts`

**Interfaces:**
- Produces: Preact JSX support (`.tsx` islands compile), the `@supabase/ssr` dependency, and `App.Locals` typed with `supabase: SupabaseClient` and `user: User | null` for every later task's middleware/route code.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @supabase/ssr
npx astro add preact
```
`astro add preact` installs `@astrojs/preact` + `preact` and edits `astro.config.mjs`. When it prompts to modify config and install, accept (Y). Expected: `@astrojs/preact` + `preact` under dependencies, `@supabase/ssr` under dependencies.

- [ ] **Step 2: Verify `astro.config.mjs` has the Preact integration**

Open `astro.config.mjs`. Expected it now reads like:
```js
import { defineConfig } from 'astro/config';
import vercel from '@astrojs/vercel/serverless';
import preact from '@astrojs/preact';

export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [preact()],
});
```
If `astro add` did not add the import/integration, edit it to match the above.

- [ ] **Step 3: Type `App.Locals`**

Edit `src/env.d.ts` to declare what middleware puts on `context.locals`:
```ts
/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';

declare namespace App {
  interface Locals {
    supabase: SupabaseClient;
    user: User | null;
  }
}
```
(Keep any existing reference lines already in the file; add the `import` + `declare namespace App` block.)

- [ ] **Step 4: Verify it compiles**

Run: `npx astro check`
Expected: no new type errors from `astro.config.mjs` or `src/env.d.ts` (pre-existing warnings elsewhere are fine).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json astro.config.mjs src/env.d.ts
git commit -m "feat(admin): add preact + supabase/ssr, type App.Locals"
```

---

### Task 2: Cookie-wired server Supabase factory

**Files:**
- Create: `src/lib/supabase-server.ts`

**Interfaces:**
- Consumes: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY` (env), the Astro request/cookies.
- Produces: `createServerSupabase(ctx: { request: Request; cookies: AstroCookies }): SupabaseClient` — an anon-key client that reads the session from request cookies and writes refreshed session cookies back through `ctx.cookies`. Used by middleware (Task 4) and the auth routes (Task 5).

- [ ] **Step 1: Write the factory**

Create `src/lib/supabase-server.ts`:
```ts
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AstroCookies } from 'astro';

const url = (import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL) as string;
const anon = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY) as string;

/** Parse the raw Cookie header into {name,value} pairs for @supabase/ssr's getAll. */
function parseCookieHeader(header: string | null): { name: string; value: string }[] {
  if (!header) return [];
  return header.split(';').map((pair) => {
    const idx = pair.indexOf('=');
    const name = pair.slice(0, idx).trim();
    const value = decodeURIComponent(pair.slice(idx + 1).trim());
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
    cookies: {
      getAll: () => parseCookieHeader(ctx.request.headers.get('cookie')),
      setAll: (cookiesToSet: { name: string; value: string; options: CookieOptions }[]) => {
        for (const { name, value, options } of cookiesToSet) {
          ctx.cookies.set(name, value, { ...options, path: '/' });
        }
      },
    },
  });
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check`
Expected: no type errors in `src/lib/supabase-server.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase-server.ts
git commit -m "feat(admin): cookie-wired server supabase client factory"
```

---

### Task 3: Auth-guard decision function (TDD)

**Files:**
- Create: `src/lib/auth-guard.ts`
- Test: `tests/lib/auth-guard.test.ts`

**Interfaces:**
- Produces: `redirectTarget(pathname: string, isAuthed: boolean): string | null` — returns the path to redirect to, or `null` to allow the request. Rules: unauthenticated request to any `/admin` path → `'/login'`; authenticated request to `/login` → `'/admin'`; everything else → `null`. Consumed by middleware (Task 4).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/auth-guard.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { redirectTarget } from '../../src/lib/auth-guard';

describe('redirectTarget', () => {
  it('sends unauthenticated /admin visitors to /login', () => {
    expect(redirectTarget('/admin', false)).toBe('/login');
    expect(redirectTarget('/admin/profile', false)).toBe('/login');
  });

  it('lets authenticated visitors into /admin', () => {
    expect(redirectTarget('/admin', true)).toBeNull();
  });

  it('sends authenticated visitors away from /login to /admin', () => {
    expect(redirectTarget('/login', true)).toBe('/admin');
  });

  it('leaves the public site alone for everyone', () => {
    expect(redirectTarget('/', false)).toBeNull();
    expect(redirectTarget('/', true)).toBeNull();
    expect(redirectTarget('/login', false)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- auth-guard`
Expected: FAIL — module/function missing.

- [ ] **Step 3: Implement**

Create `src/lib/auth-guard.ts`:
```ts
/**
 * Pure routing decision for the auth middleware.
 * @returns a path to redirect to, or null to allow the request through.
 */
export function redirectTarget(pathname: string, isAuthed: boolean): string | null {
  const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
  if (isAdmin && !isAuthed) return '/login';
  if (pathname === '/login' && isAuthed) return '/admin';
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- auth-guard`
Expected: PASS (all four).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth-guard.ts tests/lib/auth-guard.test.ts
git commit -m "feat(admin): tested auth-guard redirect decision"
```

---

### Task 4: Auth middleware (session + guard)

**Files:**
- Create: `src/middleware.ts`

**Interfaces:**
- Consumes: `createServerSupabase` (Task 2), `redirectTarget` (Task 3).
- Produces: on every request, sets `context.locals.supabase` and `context.locals.user`; redirects per `redirectTarget`. Later admin pages/routes read `context.locals.user` / `context.locals.supabase`.

- [ ] **Step 1: Write the middleware**

Create `src/middleware.ts`:
```ts
import { defineMiddleware } from 'astro:middleware';
import { createServerSupabase } from './lib/supabase-server';
import { redirectTarget } from './lib/auth-guard';

export const onRequest = defineMiddleware(async (context, next) => {
  const supabase = createServerSupabase(context);
  // getUser() validates the token with Supabase (safe for auth decisions).
  const { data: { user } } = await supabase.auth.getUser();

  context.locals.supabase = supabase;
  context.locals.user = user;

  const target = redirectTarget(context.url.pathname, user !== null);
  if (target) return context.redirect(target);

  return next();
});
```

- [ ] **Step 2: Verify it compiles**

Run: `npx astro check`
Expected: no type errors in `src/middleware.ts` (relies on `App.Locals` from Task 1).

- [ ] **Step 3: Commit**

```bash
git add src/middleware.ts
git commit -m "feat(admin): auth middleware sets session + guards /admin"
```

---

### Task 5: Auth API routes (login / logout) + validation test

**Files:**
- Create: `src/pages/api/auth/login.ts`
- Create: `src/pages/api/auth/logout.ts`
- Create: `src/lib/auth-input.ts`
- Test: `tests/lib/auth-input.test.ts`

**Interfaces:**
- Produces:
  - `parseLoginBody(body: unknown): { email: string; password: string } | { error: string }` (`src/lib/auth-input.ts`) — validates the posted JSON; consumed by the login route and unit-tested.
  - `POST /api/auth/login` — JSON `{email, password}` → on success `200 {ok:true}` and session cookie set; on bad input `400 {error}`; on wrong credentials `401 {error}`.
  - `POST /api/auth/logout` — signs out, clears cookie, `200 {ok:true}`.

- [ ] **Step 1: Write the failing validation test**

Create `tests/lib/auth-input.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseLoginBody } from '../../src/lib/auth-input';

describe('parseLoginBody', () => {
  it('accepts a well-formed body', () => {
    expect(parseLoginBody({ email: 'a@b.com', password: 'secret12' }))
      .toEqual({ email: 'a@b.com', password: 'secret12' });
  });

  it('rejects a missing/blank email', () => {
    expect(parseLoginBody({ email: '', password: 'secret12' })).toHaveProperty('error');
    expect(parseLoginBody({ password: 'secret12' })).toHaveProperty('error');
  });

  it('rejects a missing password', () => {
    expect(parseLoginBody({ email: 'a@b.com' })).toHaveProperty('error');
  });

  it('rejects a non-object body', () => {
    expect(parseLoginBody(null)).toHaveProperty('error');
    expect(parseLoginBody('nope')).toHaveProperty('error');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- auth-input`
Expected: FAIL — module missing.

- [ ] **Step 3: Implement the validator**

Create `src/lib/auth-input.ts`:
```ts
export function parseLoginBody(body: unknown): { email: string; password: string } | { error: string } {
  if (typeof body !== 'object' || body === null) return { error: 'Invalid request body' };
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== 'string' || email.trim() === '') return { error: 'Email is required' };
  if (typeof password !== 'string' || password === '') return { error: 'Password is required' };
  return { email: email.trim(), password };
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- auth-input`
Expected: PASS (all four).

- [ ] **Step 5: Write the login route**

Create `src/pages/api/auth/login.ts`:
```ts
import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';
import { parseLoginBody } from '../../../lib/auth-input';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const parsed = parseLoginBody(await context.request.json().catch(() => null));
  if ('error' in parsed) {
    return new Response(JSON.stringify({ error: parsed.error }), { status: 400 });
  }
  const supabase = createServerSupabase(context);
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.email, password: parsed.password,
  });
  if (error) {
    return new Response(JSON.stringify({ error: 'Invalid email or password' }), { status: 401 });
  }
  // signInWithPassword set the session cookie via the cookie adapter.
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

- [ ] **Step 6: Write the logout route**

Create `src/pages/api/auth/logout.ts`:
```ts
import type { APIRoute } from 'astro';
import { createServerSupabase } from '../../../lib/supabase-server';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const supabase = createServerSupabase(context);
  await supabase.auth.signOut();
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
};
```

- [ ] **Step 7: Verify compile**

Run: `npx astro check`
Expected: no type errors in the two routes or `auth-input.ts`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth-input.ts tests/lib/auth-input.test.ts src/pages/api/auth/login.ts src/pages/api/auth/logout.ts
git commit -m "feat(admin): login/logout API routes + validated input"
```

---

### Task 6: Login page + Preact login form + admin layout

**Files:**
- Create: `src/layouts/Admin.astro`
- Create: `src/components/admin/LoginForm.tsx`
- Create: `src/pages/login.astro`

**Interfaces:**
- Consumes: `POST /api/auth/login` (Task 5).
- Produces: `Admin.astro` (dark on-brand shell layout reused by admin pages), `LoginForm` (Preact island posting credentials), `/login` page. On success the form redirects to `/admin`.

- [ ] **Step 1: Write the admin layout**

Create `src/layouts/Admin.astro`. Reuse the site's global tokens (dark athletic identity) from `src/styles/global.css`:
```astro
---
import '../styles/global.css';
interface Props { title?: string; }
const { title = 'Admin' } = Astro.props;
---
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex" />
    <title>{title} · Tyler Baleno</title>
  </head>
  <body class="admin-body">
    <main class="admin-main">
      <slot />
    </main>
    <style>
      .admin-body { min-height: 100dvh; background: #0f1012; color: #f4f4f5; margin: 0; }
      .admin-main { max-width: 720px; margin: 0 auto; padding: 3rem 1.25rem; }
    </style>
  </body>
</html>
```
(If `global.css` defines color variables, prefer those over the literal hex here — check the file and substitute the closest existing tokens so the panel matches the site.)

- [ ] **Step 2: Write the Preact login form**

Create `src/components/admin/LoginForm.tsx`:
```tsx
import { useState } from 'preact/hooks';

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (res.ok) {
      window.location.href = '/admin';
      return;
    }
    const data = await res.json().catch(() => ({ error: 'Login failed' }));
    setError(data.error ?? 'Login failed');
    setBusy(false);
  }

  return (
    <form onSubmit={onSubmit} class="login-form">
      <label>Email
        <input type="email" value={email} required
          onInput={(e) => setEmail((e.target as HTMLInputElement).value)} />
      </label>
      <label>Password
        <input type="password" value={password} required
          onInput={(e) => setPassword((e.target as HTMLInputElement).value)} />
      </label>
      {error && <p class="login-error" role="alert">{error}</p>}
      <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}
```

- [ ] **Step 3: Write the login page**

Create `src/pages/login.astro`:
```astro
---
import Admin from '../layouts/Admin.astro';
import LoginForm from '../components/admin/LoginForm.tsx';
export const prerender = false;
---
<Admin title="Sign in">
  <h1>Athlete Login</h1>
  <p>Sign in to manage your recruiting page.</p>
  <LoginForm client:load />
  <style>
    .login-form { display: grid; gap: 1rem; max-width: 360px; margin-top: 1.5rem; }
    .login-form label { display: grid; gap: 0.35rem; font-size: 0.85rem; letter-spacing: 0.02em; }
    .login-form input {
      padding: 0.6rem 0.7rem; border-radius: 8px; border: 1px solid #2a2c30;
      background: #17181b; color: inherit; font-size: 1rem;
    }
    .login-form button {
      padding: 0.7rem; border: 0; border-radius: 8px; font-weight: 600; cursor: pointer;
      background: #b9975b; color: #101012;
    }
    .login-form button:disabled { opacity: 0.6; cursor: default; }
    .login-error { color: #ef6b6b; font-size: 0.85rem; margin: 0; }
  </style>
</Admin>
```
(Swap the gold `#b9975b` for the site's actual accent token if `global.css` defines one — keep it on-brand with the Plum purple/gold identity.)

- [ ] **Step 4: Verify compile + dev render**

Run: `npx astro check` (expect no new errors), then `npm run dev` and open `http://localhost:4321/login`. Expected: the form renders; submitting bad credentials shows an inline error (Supabase returns 401). Stop the dev server when done.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/Admin.astro src/components/admin/LoginForm.tsx src/pages/login.astro
git commit -m "feat(admin): login page + preact form + admin layout"
```

---

### Task 7: Protected admin dashboard shell

**Files:**
- Create: `src/pages/admin/index.astro`
- Create: `src/components/admin/LogoutButton.tsx`

**Interfaces:**
- Consumes: `context.locals.user` (set by middleware, Task 4), `POST /api/auth/logout` (Task 5).
- Produces: the guarded landing page for signed-in athletes — shows who is signed in, a logout button, and a placeholder for the editors coming in Phase 3b. This is Phase 3a's user-visible deliverable.

- [ ] **Step 1: Write the logout button island**

Create `src/components/admin/LogoutButton.tsx`:
```tsx
export default function LogoutButton() {
  async function onClick() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  }
  return <button type="button" class="logout-btn" onClick={onClick}>Sign out</button>;
}
```

- [ ] **Step 2: Write the dashboard page**

Create `src/pages/admin/index.astro`:
```astro
---
import Admin from '../../layouts/Admin.astro';
import LogoutButton from '../../components/admin/LogoutButton.tsx';
export const prerender = false;

// Middleware guarantees a user here, but guard defensively.
const user = Astro.locals.user;
if (!user) return Astro.redirect('/login');
---
<Admin title="Dashboard">
  <header class="admin-header">
    <div>
      <h1>Your Dashboard</h1>
      <p class="signed-in">Signed in as {user.email}</p>
    </div>
    <LogoutButton client:load />
  </header>
  <p class="coming-soon">Content editors are coming next. For now you can sign in and out.</p>
  <p><a href="/" class="view-site">View my public site →</a></p>
  <style>
    .admin-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .signed-in { color: #a1a1aa; font-size: 0.85rem; margin: 0.25rem 0 0; }
    .logout-btn {
      padding: 0.5rem 0.9rem; border: 1px solid #2a2c30; border-radius: 8px;
      background: transparent; color: inherit; cursor: pointer; font-size: 0.85rem;
    }
    .coming-soon { color: #a1a1aa; margin-top: 2rem; }
    .view-site { color: #b9975b; }
  </style>
</Admin>
```

- [ ] **Step 3: Verify compile**

Run: `npx astro check`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/index.astro src/components/admin/LogoutButton.tsx
git commit -m "feat(admin): protected dashboard shell with logout"
```

---

### Task 8: Link Tyler's login to his record + manual end-to-end verify

**Files:**
- Create: `scripts/link-owner.mjs`

**Interfaces:**
- Consumes: `SUPABASE_SERVICE_ROLE_KEY` (admin API), the auth user created in prerequisite P2.
- Produces: sets `athletes.owner_user_id` for a given slug to the auth user's id, so RLS lets that user write their row in Phase 3b. (3a doesn't write yet, but linking now closes the loop and lets us confirm the login maps to Tyler.)

- [ ] **Step 1: Write the link script**

Create `scripts/link-owner.mjs`:
```js
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
```

- [ ] **Step 2: Run the link (after prerequisite P2)**

Run: `node --env-file=.env.local scripts/link-owner.mjs <tyler-email> tyler-baleno`
Expected: prints `Linked <email> (<uuid>) -> athletes/tyler-baleno`.

- [ ] **Step 3: Verify the row is linked**

Run:
```bash
supabase db execute "select slug, owner_user_id is not null as linked from public.athletes where slug='tyler-baleno';"
```
Expected: `tyler-baleno | t`.

- [ ] **Step 4: Manual end-to-end auth check**

Run `npm run dev`. Then:
1. Visit `/admin` while logged out → redirected to `/login`.
2. Sign in with Tyler's test email/password → lands on `/admin`, shows "Signed in as <email>".
3. Click "Sign out" → back to `/login`; visiting `/admin` again redirects to `/login`.
4. The public site `/` still renders normally (anon read unaffected).
Expected: all four behave as described. Stop the dev server.

- [ ] **Step 5: Commit**

```bash
git add scripts/link-owner.mjs
git commit -m "feat(admin): owner-link script; Tyler login mapped to his record"
```

---

## Phase 3a done-when

- `npm test` passes (existing suites + `auth-guard`, `auth-input`).
- Logged-out visitor to `/admin` is redirected to `/login`; logged-in visitor reaches the dashboard and can sign out.
- Tyler's auth user is linked (`owner_user_id` set) to `slug = 'tyler-baleno'`.
- Public site `/` unchanged.

---

## Roadmap: Phase 3b — Editors, offer picker, photo, live loop (detailed when we reach it)

**File:** `…-phase-3b-editors.md`. Builds on 3a's session (`context.locals.supabase` is the owner-scoped writer).

- **Owner-scoped write routes:** `POST /api/profile/[section]` (validates + merges one section into `profile` JSONB via `locals.supabase`, so RLS `athletes_owner_update` enforces owner), `POST /api/card-visibility`, `GET /api/schools?q=` (wraps existing `searchSchools`).
- **Section editors (Preact):** one form per section (Identity, Measurables/Athletics, Stats/headline, Honors, Film, Positions, Academics, Schedule, Contact), each with its own Save; live because SSR. Reserve space so entering edit mode doesn't shift layout (Angelo's standing UI rule).
- **Card-visibility panel:** on/off switch per section writing `card_visibility`.
- **Offer editor:** typeahead over `searchSchools` → auto-fill logo/level/location; "school not listed?" manual fallback (name/level/location + monogram).
- **Photo:** upload → auto center-crop to the locked 4:5 frame in-browser (canvas) → reject under-resolution/oversized → upload to `profile-photos` Storage → update `photo_url`. Tighten Storage write policy to per-owner folder (migration `0004_storage_owner.sql`).
- **Acceptance (Playwright e2e):** Tyler logs in → edits 40 time → toggles Academics off → uploads a cropped photo → public site reflects all three live; unauthenticated `/admin` redirects; Tyler cannot edit another record (RLS).
- **Integrity rule:** unverified fields still render TBD; editors carry the `placeholder` flag through saves.
