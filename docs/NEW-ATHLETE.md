# Runbook: Add a New Athlete

The mechanics take ~30–45 minutes. The theme design work is the actual product
and takes as long as it takes (see `NEW-THEME.md`).

Placeholders below: `<slug>` like `jordan-smith`, `<domain>` like `jordansmith.com`.

## 1. Data row

Create the athlete's profile seed (copy `scripts/seed-tyler.mjs` until a
generic `new-athlete.mjs` exists — flagged as a follow-up). Every unverified
field ships as an explicit placeholder (`placeholder: true` / empty value),
**never** an invented number — false measurables can hurt a real recruit.

```bash
node --env-file=.env.local scripts/seed-<slug>.mjs
```

## 2. Login

1. Supabase dashboard → Authentication → Invite the athlete's email.
2. Link the auth user to the row:

```bash
node --env-file=.env.local scripts/link-owner.mjs <athlete-email> <slug>
```

What they can now edit is bounded twice: RLS (own row only) + column grants
(`profile`, `card_visibility`, `photo_url` only — never `slug`, never theme).

## 3. Theme (the design work)

```bash
cp -r src/themes/bare src/themes/<slug>
```

Author every panel per `NEW-THEME.md`. Rules that keep the platform honest:
no visual code shared with any other theme; every `Stat`/`Field` renders
through `phValue`; asset paths go through `assetUrl`.

## 4. Route

Copy `src/pages/s/tyler-baleno.astro` → `src/pages/s/<slug>.astro` and change
two things: the slug string and the theme import. The **static** theme import
is what keeps this athlete's CSS off every other athlete's site — never load
themes dynamically in a production route.

## 5. Config

Add the entry in `src/lib/site-config.ts`:

```ts
'<slug>': { theme: '<slug>', arrangement: [...DEFAULT_ARRANGEMENT], domains: ['<domain>'] },
```

Reorder `arrangement` per the build (QB leads with film, lineman with
measurables). Arrangement is Angelo-only by design — it lives here, not in
the DB, so athletes can't reach it.

## 6. Domain

1. Buy the domain (Namecheap/Cloudflare, ~$10–15/yr).
2. Vercel project → Settings → Domains → add `<domain>` and `www.<domain>`.
3. Add a host rewrite in `vercel.json` (create the file on first non-Tyler domain):

```json
{
  "rewrites": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "<domain>" }],
      "destination": "/s/<slug>"
    }
  ]
}
```

4. DNS per Vercel's instructions at the registrar.

## 7. Verify (all of it, before telling the family)

- [ ] `npm test && npx astro check && npm run build` — green.
- [ ] `/s/<slug>` renders locally; `/s/tyler-baleno` (and every other athlete) unchanged.
- [ ] Log in as the new athlete → dashboard shows **only** their record; saves work.
- [ ] Every unverified field renders as an em dash, not a value.
- [ ] Preview deploy: both sites; then `<domain>` resolves after DNS.
- [ ] Invariant suite passed (it runs in `npm test` when the service key is present).

## Known gaps in the login flow (read before step 2)

The in-app auth is **built and live** (2026-07-08): `/login` → `/forgot` →
`/auth/confirm` (consumes the invite/recovery `token_hash`) → session-gated
`/set-password`. The Supabase Auth Site URL + redirect URLs are already set to the
production URL. **The one thing still missing is email delivery:** invite/reset
emails go through Supabase's default sender, which is rate-limited and unreliable to
outside inboxes until **custom SMTP (Resend)** is configured. So the `Invite user`
dashboard button still isn't the reliable path yet.

**Until SMTP is wired, activate a login manually** (no email needed):

```
# 1. Create the auth user (Supabase Dashboard → Authentication → Add user, auto-confirm)
#    — or it already exists from a prior invite attempt.
# 2. Link the row to that user:
node --env-file=.env.local scripts/link-owner.mjs <athlete-email> <slug>
# 3. Set a known password:
node --env-file=.env.local scripts/set-password.mjs <athlete-email> "<temp-password>"
```

Then hand the athlete the URL + email + temp password out-of-band (text/DM, not
email). Once signed in, they can change it themselves at `/set-password` (the page
is session-gated, so a logged-in athlete can reach it directly); to rotate it for
them, just re-run `set-password.mjs`.

## Email setup (Resend SMTP) — the one-time unlock

Wiring a real email sender is what makes the athlete-facing flow fully self-serve
(forgot-password + invite emails actually deliver). The code is already built and
merged; this is pure config. Angelo's hands throughout — account creation and API
keys can't be done for him.

**A. Resend (~10 min):**
1. Create a free account at resend.com.
2. Dashboard → API Keys → create one. Copy it (shown once).
3. Sender identity — two stages:
   - **Prove it today, no DNS:** use Resend's built-in `onboarding@resend.dev`
     sender. It can only send to *your own* account email — enough to test the whole
     flow end-to-end against Angelo's inbox.
   - **Real athletes:** verify a domain Angelo controls (Resend gives DNS records to
     add). Recommend verifying `tylerbaleno.com` once bought, or a dedicated platform
     domain. **Do NOT use angelobaleno.com** without asking Dad — its DNS is his.

**B. Supabase custom SMTP (~5 min):**
4. Dashboard → Authentication → Emails → SMTP Settings → enable custom SMTP:
   - Host `smtp.resend.com`, Port `465`, Username `resend`,
     Password = the Resend API key, Sender name `The Recruiting Platform`,
     Sender email = an address on the verified domain (or `onboarding@resend.dev`
     for the test stage).
5. Authentication → URL Configuration is already correct (Site URL =
   `https://tyler-baleno-site.vercel.app`, `/auth/confirm` allowlisted).
6. **Edit the two email templates** (Authentication → Email Templates) — required, the
   defaults point at Supabase's own verify endpoint, not our `/auth/confirm` route:
   - **Invite user** → set the link href to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
   - **Reset Password** → set the link href to
     `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`

**C. Verify (together):**
6. Live site → `/login` → "Forgot password?" → enter your own email → check inbox →
   click the link → land on `/set-password` → set a new one → confirm you're in.

Once C passes, athlete password reset is fully self-serve on their own site.

## Follow-ups that shrink this runbook

- **In-app "add athlete" admin** so onboarding = one form in the dashboard (creates
  the auth user + links the row + sends the invite), replacing the dashboard "Add
  user" + `link-owner`/`set-password` scripts. Needs a platform-admin concept.
- `scripts/new-athlete.mjs <slug> <profile.json>` collapsing steps 1–2.
- A route-file template if copying Tyler's ever drifts.
