# Athlete login: invite-accept + password reset

**Date:** 2026-07-06
**Status:** Design — approved approach, pending spec review

## Problem

Login is email + password (`/api/auth/login` → `signInWithPassword`). There is
no way for an athlete to **set** that password. The app has no set-password,
forgot-password, or auth-callback route, so a Supabase invite/recovery email
has nowhere to land. Compounding it, the Supabase **Site URL** still points at
`localhost`, so the emails it does send link to a dev-only address (this is why
Tyler's invite opened a localhost page Safari couldn't reach).

Today the only way to give an athlete a working login is for Angelo to set their
password by hand via the admin API (what was done for Tyler) and hand it over
out-of-band. That does not scale and leaves athletes unable to reset a forgotten
password.

## Goals

- An invited athlete can set their own password from a page in this app and land
  signed in on `/admin`.
- An athlete who forgets their password can request a reset and set a new one
  through the same path.
- Everything stays in the existing SSR **cookie** session model — no second auth
  model (no browser Supabase client / localStorage sessions).

## Non-goals (invariants this must not break)

- **No public signup.** No route in this feature creates a user. The only way
  onto the platform stays: Angelo invites the email. `resetPasswordForEmail`
  only emails existing users and returns success regardless of whether the email
  exists (no account-enumeration oracle).
- No change to the public site, theming, or the existing `/api/auth/login`
  password sign-in.

## Approach: server-side `token_hash` verification

The Supabase invite and recovery emails link to a route **in this app**,
carrying a one-time `token_hash`. A server route verifies that token with the
same cookie-bound client the middleware already builds, which sets the session
cookie; the athlete is then a normal authenticated user and can set a password.

Chosen over the client-side implicit-hash flow because it reuses the existing
`@supabase/ssr` cookie session end-to-end — no browser Supabase client, no
localStorage session running alongside the cookie one.

## Components

Each unit is small and single-purpose.

### `src/pages/auth/confirm.ts` (GET, server)
- Reads `token_hash` and `type` (`invite` | `recovery`) from the query.
- Calls `locals.supabase.auth.verifyOtp({ type, token_hash })`. On success the
  `@supabase/ssr` cookie adapter writes the session cookie.
- Success → redirect `/set-password`. Missing/invalid/expired token → redirect
  `/login?error=expired`.
- Depends on: `Astro.locals.supabase`.

### `src/pages/set-password.astro` (server page)
- Gated on session: `locals.user` present, else redirect `/login`. (The verify
  step above put the user in a real session, so this holds for a valid link.)
- Renders `SetPasswordForm` (client island): new password + confirm, submit to
  `/api/auth/set-password`. Reuses the `Admin` layout + login styling.

### `src/pages/api/auth/set-password.ts` (POST, server)
- Body `{ password, confirm }` validated by `parseNewPassword` (below); 400 on
  failure.
- Requires `locals.user` (the recovery/invite session), else 401.
- `locals.supabase.auth.updateUser({ password })`; on success returns `{ ok }`
  and the island navigates to `/admin` (already authenticated).

### `src/pages/api/auth/forgot.ts` (POST, server) + login link
- `/login` gains a small "Forgot password?" control that POSTs an email here.
- Calls `resetPasswordForEmail(email, { redirectTo: ${SITE}/auth/confirm })`.
- Always returns `{ ok }` (no enumeration). Recovery email → `/auth/confirm`
  (`type=recovery`) → `/set-password`, same as invite.

### `src/lib/auth-input.ts` — add `parseNewPassword`
Pure, mirrors `parseLoginBody`:
- `password` string, **min 8 chars** (above Supabase's default 6).
- `confirm` must equal `password`.
- Returns `{ password }` or `{ error }`.

### `src/lib/auth-guard.ts` — routing updates
- `needsAuth`: add `/auth/confirm` and `/set-password` (they resolve/require a
  session). The two new `/api/auth/*` routes are already covered by the existing
  `/api/` prefix, so no change is needed for them.
- `redirectTarget`: `/set-password` when **not** authed → `/login`. Leave
  `/auth/confirm` reachable while unauthed (it is what establishes the session).
  Do **not** bounce `/set-password` to `/admin` when authed — a signed-in athlete
  arriving via a recovery link must still be able to set a new password.

## Data flow

**Invite (new athlete):** Angelo invites email in Supabase → athlete clicks
`…/auth/confirm?token_hash=…&type=invite` → verify → cookie set → `/set-password`
→ submit → `updateUser` → `/admin`.

**Forgot password (existing athlete):** `/login` → "Forgot password?" → enter
email → `/api/auth/forgot` → recovery email → `/auth/confirm?…&type=recovery` →
`/set-password` → `/admin`.

## Supabase dashboard config (Angelo — not code)

Required before either flow works end-to-end:

1. **Authentication → URL Configuration → Site URL:**
   `https://tyler-baleno-site.vercel.app`
2. **Redirect URLs allowlist:** add `https://tyler-baleno-site.vercel.app/auth/confirm`
   (and `http://localhost:4321/auth/confirm` for dev).
3. **Email templates → Invite user** link →
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
4. **Email templates → Reset password** link →
   `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

## Testing

- **Unit:** `parseNewPassword` (too short, mismatch, missing, valid). `auth-guard`
  decisions for the four new paths, authed and unauthed.
- **Live invariant** (runs when the service key is present, like the existing
  suite): `admin.generateLink({ type: 'invite', email })` → GET `/auth/confirm`
  with the returned `token_hash` → assert redirect to `/set-password` + a session
  cookie is set → POST `/api/auth/set-password` → assert the user can then
  `signInWithPassword` with the new password. A parallel case asserts an invalid
  `token_hash` redirects to `/login?error=expired` and sets no cookie.
- **Manual (once, after config):** real invite email → phone → set password →
  `/admin`; then a real forgot-password round trip.

## Follow-ups / known limits

- **Single auth origin.** Emails always link to the Supabase Site URL (the
  platform origin). When athletes get custom domains, decide whether auth lives
  on one shared origin or per-domain; out of scope here.
- Retire the manual `activate-owner` admin-password path from `NEW-ATHLETE.md`
  once this ships and the templates/Site URL are set.
