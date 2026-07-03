# Recruit Admin Panel — Design Spec

**Date:** 2026-07-03
**Owner:** Angelo
**Built on:** Tyler Baleno recruiting site (`C:\context\Websites\Tyler Baleno`)
**Related:** Athlete Site Starter (`C:\context\Websites\Athlete Site Starter`) — this reverses that spec's "per-athlete admin" YAGNI deferral now that the service direction is being validated.

## Purpose

Let each recruit maintain their own site content — update stats after a game, add film, add an offer, fix contact info — and choose **which cards display**, through a friendly login-protected panel. No code, no editing files, no bugging Angelo for routine updates.

The premium, individual feel is preserved by a hard split: **Angelo designs, the athlete maintains.** The bespoke skin (palette, type, motif, hero treatment) is the product and the moat; it is never editable in the panel. The panel manages *data and card visibility*, plus the profile photo *within Angelo's locked frame*.

## Core decisions (locked with Angelo)

- **Model: bespoke site + data admin panel.** Not a self-serve SaaS. Automating the *design* would collapse every site into one template (the MaxPreps problem); automating the *data* does not. Angelo hand-crafts each site; the athlete self-maintains content.
- **Scope: Tyler first, then generalize.** Prove the full loop end-to-end on one real site before building multi-athlete product infrastructure. Tyler is the first real instance.
- **Shared backend, bespoke fronts.** One Supabase project. Tyler = one record. Athlete #2 later = new skin + new record, *no new infrastructure*.
- **Rendering: SSR.** Public pages render from live Supabase data at request time, so edits appear immediately — no rebuild step, SEO-clean, no empty-page flash.
- **Auth: Angelo provisions, no public signup.** Curated done-for-you service. Row-Level Security guarantees an athlete can edit only their own record.
- **Integrity rule carried over.** Unverified fields render as obvious **TBD** placeholders, never fabricated.

## Architecture

**One Astro project, two surfaces:**

1. **Public site** — the existing bespoke Tyler components, refactored to read the athlete record from the database server-side instead of importing the static `site.ts`. Same markup, same look; different data source. Section rendering respects the `cardVisibility` map.
2. **Admin panel** — protected routes behind login: per-section form editors, card toggles, offer picker, photo cropper.

**Stack:** Astro (hybrid/SSR mode, Vercel adapter) on **Vercel** · **Supabase** for auth + Postgres + Storage.

### Hosting change
Tyler's site moves off GitHub Pages (static-only) to **Vercel** (runs SSR). Supabase keys as env vars. Custom domain deferred.

### Data model (deliberately simple for v1)

- **`athletes`** table
  - `id`, `owner_user_id` (FK to Supabase `auth.users`), `slug`
  - `profile` **JSONB** — the whole editable profile, mirroring today's `site.ts` shape 1:1: identity, measurables, statGroups, honors, film, positions, academics, schedule + scheduleMeta, contact.
  - `card_visibility` **JSONB** — `{ film: bool, offers: bool, athletics: bool, positions: bool, academics: bool, schedule: bool, contact: bool }`. (Hero is always on.)
  - `photo_url` — points at the Storage object.
  - `offers` stored inside `profile` as a list; each offer is either `{ school_id }` (resolved against `schools`) or a manual `{ school, short, level, location }`.
- **`schools`** table — shared FBS + FCS reference: `id`, `name`, `short`, `level` (FBS/FCS), `conference`, `location`, `logo_url`. Read-only reference data, reused by every athlete. Powers the offer picker.
- **Storage** — one bucket (`profile-photos`), public-read, authed-write.

Rationale for JSON-doc-per-athlete over normalized tables: it maps 1:1 to the current data file, so the public-site refactor is mostly plumbing and the panel is "load JSON → edit in forms → save JSON." Fastest correct path for v1. Per-field DB rigidity is unnecessary because all writes flow through a controlled form.

### Auth & security
- **No public signup.** Angelo creates each athlete's login via Supabase invite; athlete signs in with email + password. Angelo holds an admin capability.
- **Row-Level Security:** an authed user can read/write only the `athletes` row where `owner_user_id = auth.uid()`. Public read of the profile is allowed (anon key, read-only) so the SSR public page can fetch it.
- **Admin routes** are gated by an Astro middleware session check; unauthenticated requests redirect to login.
- **`schools`** is world-readable, no writes from the panel.
- **Storage:** `profile-photos` bucket is public-read; writes require an authed session scoped to the owner.

## Admin panel UX

- **Login screen** — on-brand (matches the site's dark athletic identity).
- **Dashboard** — one editor card per site section (Profile/Identity, Measurables, Stats, Honors, Film, Positions, Academics, Schedule, Contact), each a simple form.
- **Card toggles** — a "What shows on my site" panel with an on/off switch per section. Off = section not rendered on the public site.
- **Offer editor** — typeahead search over `schools` → select → auto-fills logo/level/location. "School not listed?" manual fallback (name/level/location text + monogram fallback) covers D2/NAIA/prep.
- **Photo** — upload → crop UI snaps to the locked 4:5 frame → saved to Storage → `photo_url` updated. Size/resolution limits reject blurry/oversized images. The hero *treatment* (wash, jersey badge, shadow) is unchanged; only the image swaps.
- **Save is per-section and live** — each editor card has its own Save; because the site is SSR, a save is reflected on the public site immediately. A "View my site" link lets the athlete check.

## What stays Angelo's (not in the panel)
Colors, fonts, motif, layout, hero treatment/frame/badge — the entire bespoke skin. The athlete edits content and their photo-within-the-frame only.

## Public site changes
- Components refactored to consume the fetched athlete record (server-side in the Astro page) rather than importing `site.ts`. The `site.ts` object shape becomes the `profile` JSON shape, so it is largely a data-plumbing refactor.
- Sections honor `card_visibility` (explicit off = omitted) in addition to the existing "render nothing when data is empty" behavior.
- **TBD** placeholder styling preserved for unverified fields.

## Out of scope (v1 — YAGNI)
Public signup, billing, multi-athlete onboarding UI, logo *uploads* (picker + manual fallback instead), in-panel design/theme editing, D2/NAIA full school dataset, email notifications, analytics, "request a photo/design change" workflow.

## Testing

**End-to-end loop (the acceptance test):** Tyler logs in → changes his 40 time → toggles the Academics card off → uploads a new photo (auto-cropped) → his public site reflects all three, live.

**Additional checks:**
- Unauthenticated visitor cannot reach any admin route (redirected to login).
- RLS: an authed athlete cannot read/write another athlete's record.
- Offer picker returns correct school logo/metadata; manual fallback renders with monogram.
- Photo upload crops to the 4:5 frame and rejects under-resolution / oversized files.
- Public page renders correctly with cards toggled on and off.

## Success criteria
1. Tyler logs into a branded panel, edits content, toggles cards, and uploads a cropped photo — the public SSR site reflects it live.
2. One Supabase backend; Tyler = one record; adding athlete #2 is "new skin + new record," no new infrastructure.
3. The bespoke skin (colors/type/motif/hero) remains fully under Angelo's control, not editable in the panel.
4. The integrity rule holds: unverified fields show as TBD, nothing fabricated.
