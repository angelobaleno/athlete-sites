# Admin Console (athlete login management) — Design Spec

**Date:** 2026-07-08
**Owner:** Angelo
**Related:** [[recruit-admin-panel-project]], `athletes/tyler/PROCESS.md`, `docs/NEW-ATHLETE.md`.
Builds on the shipped auth (`2026-07-03-recruit-admin-panel-phase-3a-auth`) and self-serve login
(`2026-07-06-athlete-login-set-password`, now email-verified via Resend).

## Purpose

Let Angelo manage athlete **logins from inside the app** — retiring the Supabase dashboard's
"Add user" plus the `link-owner.mjs` / `set-password.mjs` scripts and the manual `inviteUserByEmail`
run. The athlete-facing self-serve reset already works; this is the Angelo-facing half of "I don't
want to go through Supabase."

## Scope (v1 — locked with Angelo 2026-07-08)

**In:** an admin-only console to manage the athlete **login lifecycle** for records that already exist:
list athletes, invite a login, send a password reset, set a temp password.

**Out (by design):**
- Creating an athlete's **site/skin** — always a bespoke hand-build (the product's moat).
- Creating an athlete's **data record/profile** — stays the seed step; the profile is a large nested
  structure that deserves its own later project.
- Billing, multi-admin, audit log. (Audit log is a reasonable fast-follow, not v1.)

## Core decisions

### Admin identity
- An allowlist env var **`ADMIN_USER_IDS`** = comma-separated Supabase auth user UUIDs. Angelo's
  account (`angelojbaleno@gmail.com`, id `b9f8cd6a-…`) is the only entry.
- User **IDs**, not emails — an email is user-mutable, a UUID is not, so the allowlist can't be spoofed
  by an athlete changing their own email.
- Pure helper `isAdmin(userId: string | undefined): boolean` reads and parses the env var. No schema
  change, no DB flag.

### Where it lives
- `/admin` **branches on the caller**: if `isAdmin(user.id)` → render the **console**; else render the
  existing athlete dashboard. (An admin owns no athlete record — this is why Angelo saw "No editable
  record linked".) No new top-level route; the athlete experience is untouched.

### Server-only service-role access
- New helper `src/lib/supabase-admin.ts` → `createAdminClient()` = `createClient(PUBLIC_SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })`. Throws if the service key is absent.
- **Never imported by a Preact island / anything that ships to the browser.** Used only in
  `/api/admin/*` routes and the server frontmatter of the `/admin` console branch.

### The gate (the security crux)
- The service-role client **bypasses RLS**, so the *only* thing protecting these actions is the admin
  check. Every `/api/admin/*` route and the console branch calls **`requireAdmin(context)`** first:
  read `locals.user` (set by middleware from the cookie session) → if `!isAdmin(user.id)` return **403**
  (routes) / fall through to the athlete dashboard (page). **Fail closed.** UI hiding is not a gate.
- `/admin` and `/api/admin/*` are already behind the login requirement via `needsAuth` (add
  `/api/admin` if not covered). Auth (are you signed in?) and authorization (are you the admin?) are
  separate checks; both must pass.

## Components & data flow

### Server actions — `src/lib/admin-actions.ts` (service-role, server-only)
Small, testable orchestration functions over the admin client:
- `listAthletes()` → `[{ slug, name, ownerLinked: boolean, ownerEmail?: string }]` — joins
  `athletes` rows to auth users by `owner_user_id`.
- `inviteAthlete(slug, email)` → find-or-create the auth user by email:
  - **new user:** `admin.inviteUserByEmail(email)` (creates + sends the invite email).
  - **existing user:** skip creation; send a **reset** email instead (so they can set a password).
  - then set `athletes.owner_user_id = user.id` **where slug = slug**. Returns which path ran.
- `resetAthletePassword(email)` → `resetPasswordForEmail(email, { redirectTo: <origin>/auth/confirm })`
  via a server anon client (mirrors the `/forgot` route).
- `setTempPassword(email, password)` → `admin.updateUserById(id, { password, email_confirm: true })`
  (the `set-password.mjs` logic, promoted into the app). 8-char minimum, reuse `parseNewPassword`.

### API routes (`prerender = false`, POST, `requireAdmin` first)
- `POST /api/admin/invite` `{ slug, email }`
- `POST /api/admin/reset` `{ email }`
- `POST /api/admin/set-password` `{ email, password }`
Each returns `{ ok: true, ... }` or an error with a clear message (admin-only surface, so no
no-enumeration constraint — report real errors). Same-origin check on these mutations (flagged in the
3a review as owed); rely on `SameSite` cookies + an origin check.

### UI — `src/components/admin/AdminConsole.tsx` (+ `.css`)
- A table: one row per athlete (name · slug · login status · live-site link).
- Per row: **Invite login** (email input inline for unlinked), **Send reset**, **Set temp password**
  (reveals the value once for hand-off). Always-editable inputs, inline status text in reserved space
  — **no layout shift** (house rule). Reuse `LoginForm.css` visual language; wears the admin palette
  already wired into the `/admin` layout.
- Islands call the API routes with `fetch`; render success/error inline.

### Page — `src/pages/admin/index.astro`
- Frontmatter: if `isAdmin(user.id)` → `listAthletes()` and render `<AdminConsole>`; else the current
  athlete-dashboard render. One `prerender = false` page, two branches.

## Error handling
- Missing/blank `ADMIN_USER_IDS` → `isAdmin` returns false for everyone (fail closed); no one gets the
  console. Log a server warning so a misconfig is visible.
- Service key absent → `createAdminClient()` throws at call time; the route returns 500 with a plain
  message. It never silently downgrades to a non-privileged client.
- `inviteUserByEmail` on an already-existing user → caught and rerouted to the reset path, not surfaced
  as a failure.

## Testing (TDD)
- **Unit (pure):** `isAdmin` — parses comma/space lists, trims, empty → false, match/no-match. Password
  rule reuse.
- **Route guard:** a non-admin authed user hitting `/api/admin/*` gets 403; an admin passes.
- **Live (skipIf no `SUPABASE_SERVICE_ROLE_KEY`):** `inviteAthlete` links `owner_user_id`;
  `setTempPassword` → the user can `signInWithPassword`; existing-user invite reroutes to reset. Mirror
  the existing live `auth-set-password.test.ts` pattern; clean up created test users in `afterAll`.
- Keep `npm test`, `astro check`, and `npm run build` green.

## Config / deploy
- Add `ADMIN_USER_IDS` to `.env.local`, `.env.example` (placeholder), and **Vercel → Production env**
  (Angelo's step). Value = Angelo's full auth user UUID.
- No DB migration.

## Acceptance
1. Angelo signs in at `/login` → `/admin` shows the **console** (not "No editable record").
2. An athlete signs in → still sees their normal editor (unchanged).
3. From the console, inviting an unlinked athlete's email links the record and sends the invite; the
   athlete completes `/set-password` and lands on their dashboard — **no Supabase dashboard, no scripts.**
4. "Send reset" emails a linked athlete; "Set temp password" returns a working password.
5. A signed-in **non-admin** hitting any `/api/admin/*` route gets **403**; signed-out gets redirected.
