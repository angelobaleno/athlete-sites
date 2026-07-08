# Tyler Baleno — build process

Tyler's specific instance of the onboarding runbook (`docs/NEW-ATHLETE.md`).
This records what was actually done, not the generic steps. Update it as his site changes.

- **Athlete:** Tyler Baleno — DB, Plum HS, Class of 2027 (cousin).
- **Slug:** `tyler-baleno`
- **Live (Vercel):** https://tyler-baleno-site.vercel.app/
- **Custom domain:** `tylerbaleno.com` — **not yet purchased** (~$12/yr). Blocks the domain step below.

## 1. Data
- Seeded from `scripts/seed-tyler.mjs`. Source of truth = his **X/Twitter bio**.
- Every unverified measurable (height, weight, 40, GPA, film) ships as an explicit
  placeholder / em dash — **never an invented number** (false measurables can hurt a real recruit).
  Fill each one only when Tyler confirms it.

## 2. Login
- Email invite path is **not wired yet** (no set-password route + Supabase Site URL was localhost).
- So Tyler's login was **activated manually**: `link-owner` → admin API set password + `email_confirm: true`,
  handed to him out-of-band (text, not email).
- He can log in and edit **his row only** (RLS + column grants: `profile`, `card_visibility`, `photo_url` —
  never `slug`, never theme).
- Self-serve set-password + reset flow **shipped to master 2026-07-08** (PR #1 merged): `/login` now has a
  "Forgot password?" link → `/forgot` → email → `/auth/confirm` → `/set-password`. Pages + gate verified live.
- **Still gated on email delivery:** the reset/invite emails go through Supabase's default sender, which is
  rate-limited and unreliable for outside addresses until **custom SMTP (Resend)** is configured in the
  Supabase dashboard (Angelo's ops step — needs a Resend account; not a code change). Until then, the
  reliable path to change Tyler's password is still the manual admin update.

## 3. Theme
- Dark **"scouting card"** design in **Plum purple + gold**. Lives at `src/themes/tyler-baleno/`.
- No visual code shared with any other theme (CSS isolation via static import in his route).

## 4. Route & config
- Route: `src/pages/s/tyler-baleno.astro` (static theme import — keeps his CSS off every other athlete's site).
- Config: entry in `src/lib/site-config.ts`, `domains: ['tylerbaleno.com']`, arrangement tuned for a DB
  (film/coverage forward, measurables where verified).

## 5. Domain (pending)
When `tylerbaleno.com` is bought:
1. Vercel → Settings → Domains → add `tylerbaleno.com` + `www`.
2. Add the host rewrite in `vercel.json` (`host = tylerbaleno.com` → `/s/tyler-baleno`).
3. DNS at the registrar per Vercel's instructions; verify HTTPS + apex/www + mobile.

## Status / next
- **Done:** data seeded, theme built, route live on Vercel, login activated (manual), self-serve
  set-password + reset flow merged to master + verified live (2026-07-08).
- **Next (his own control):** (1) configure Resend SMTP in Supabase so reset/invite emails actually
  deliver; (2) buy `tylerbaleno.com`, then the domain step above; (3) a 15-min onboarding so he logs in,
  edits one real thing, and pins the link in his X bio.

Related: `docs/NEW-ATHLETE.md`, `MARKETING.md`, `BUSINESS.md`.
