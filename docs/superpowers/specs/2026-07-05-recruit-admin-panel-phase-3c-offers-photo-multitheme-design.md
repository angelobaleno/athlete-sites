# Recruit Admin Panel — Phase 3c: Offers Editor + Photo Upload, on a Theme-Robust Base — Design Spec

**Date:** 2026-07-05
**Owner:** Angelo
**Builds on:** Phase 3b (section editors), the theming engine, Phase 1–3a (backend/public-SSR/auth).
**Parent spec:** `2026-07-03-recruit-admin-panel-design.md`

## Purpose

Let an athlete manage their **college offers** and their **hero photo** from `/admin`, and do the foundation work so the entire admin panel — every editor, including these two — works unchanged for a completely different-looking athlete #2 with a different theme.

The driving requirement (Angelo): *"make sure everything is set up so that if I built a completely different-looking website for another athlete, everything would still work as expected."*

## Scope

**In scope:**
1. **Theme-robustness foundation** — a per-theme manifest + a neutral, theme-independent admin skin (see below).
2. **Offers editor** — add (school typeahead or manual fallback), remove, reorder; saves `profile.offers`.
3. **Photo upload + cropper** — crop to the athlete's theme hero ratio, upload to Storage, set `photo_url`.

**Deferred / out of scope:** list editors for honors/schedule/positions; card-visibility toggles; multi-athlete onboarding UI; logo *uploads* for offers (picker + manual monogram only, per parent spec); Astro 5 / Node 22 migration; buying a custom domain.

## Core decisions (locked with Angelo)

- **Neutral shared admin skin.** The admin (login + all editors) has ONE neutral dark-athletic look, independent of the public themes. Athlete #2's admin works instantly regardless of how wild their public site is. This **reverses** the earlier "admin matches theme" coupling (which required every new theme to style the admin). The public site remains the bespoke moat; the admin is a private tool.
- **Themes declare editing-relevant parameters via a manifest.** At minimum `heroPhotoAspectRatio`. The photo cropper reads the logged-in athlete's theme manifest so it crops to *their* frame, not a hardcoded ratio.
- **Editors edit DATA, never skin.** Offers edit `profile.offers`; the photo editor sets `photo_url`. Every theme renders that data its own way. The only theme-specific input an editor needs is the crop ratio, sourced from the manifest.
- **Offers: add/remove + reorder** (move up/down, no drag library — reliable, no layout shift).
- **Photo upload is server-side.** The session is a server cookie session (`@supabase/ssr`); the browser holds no Supabase token, so uploads go through an authed Astro API route using `context.locals.supabase`. RLS/Storage policies are the boundary.
- **cropperjs** for the crop UI (framework-agnostic, mounted in a Preact island via a ref): pan/zoom at a fixed ratio out of the box.

## Architecture

### 1. Theme manifest (robustness foundation)

- Add `interface ThemeMeta { heroPhotoAspectRatio: number }` (extensible). To avoid disrupting the shipped render path (`getTheme` returns `ThemeComponents`), each theme's `index.ts` **additionally** exports `themeMeta: ThemeMeta` next to its components — `getTheme` is unchanged. Tyler: `heroPhotoAspectRatio: 4/5`. The `bare` demo theme: a deliberately *different* ratio (`1` = 1:1) to prove the seam.
- The registry gains `getThemeMeta(name): ThemeMeta`, resolved the same lazy/dev-gated way as `getTheme` (bare stays dev-only).
- The photo editor resolves the athlete's theme (via `getSiteConfig(slug).theme`) → its `ThemeMeta.heroPhotoAspectRatio` → passes that ratio to the cropper.

### 2. Neutral admin skin (bounded refactor)

- `src/layouts/Admin.astro` stops importing `src/themes/tyler/global.css`. It gains its own `src/layouts/admin.css` (or inline `<style>`) defining a **neutral admin token set** — its own palette/type variables (e.g. `--a-bg`, `--a-surface`, `--a-line`, `--a-text`, `--a-muted`, `--a-accent`) with a dark-athletic look independent of any theme.
- The existing 3b editor styles (`SectionEditor.css`) and the new offers/photo card styles are migrated to consume the admin tokens rather than Tyler's theme tokens (`--ink`, `--gold`, etc.). This is behavior-preserving for Tyler's admin (same look) but no longer *sourced* from Tyler's theme.
- Login page (`src/pages/login.astro` + `LoginForm.css`) is included in the audit so nothing in the admin surface still reaches into a public theme's CSS.

### 3. Offers editor

- **Data:** `profile.offers: Offer[]` (existing shape: `{ schoolId }` reference OR manual `{ school, short, level, location, logoUrl? }`). Rendering + `resolveOffers` are unchanged.
- **UI:** an admin card (`OffersEditor` Preact island) listing current offers (resolved for display: school, level, location, logo/monogram). Each row has **Remove** and **move up / move down**. An **Add** control offers two paths:
  - *School typeahead* → calls a search endpoint that wraps `searchSchools(query)` → pick → appended as `{ schoolId }`.
  - *"School not listed?"* → manual fields (school, short/monogram, level, location) → appended as a manual `Offer`.
- **Save:** the island POSTs the full ordered `offers` array to a dedicated `POST /api/profile/offers` (separate from the flat-field `[section]` route because offers is a list of objects). The route: authed (`locals.user`), loads the owner record, validates each offer (must have a `schoolId` OR a non-empty manual `school`; strip unknown fields), writes `profile.offers`, updates the row (RLS owner-only). Returns `{ ok } | { error }`.
- **Typeahead endpoint:** `GET /api/schools?q=…` (or reuse an existing public read) returning `searchSchools` results as JSON, so the island can query without a Supabase token. `schools` is world-readable, so this is a safe anon read; still, gate it behind an authed check for consistency since it's an admin affordance.

### 4. Photo upload + cropper

- **UI:** an admin card (`PhotoEditor` Preact island) showing the current photo inside a preview at the theme's ratio, plus an **Upload new photo** file input. On file select, cropperjs mounts on the chosen image at `aspectRatio = heroPhotoAspectRatio` (from the manifest, passed in as a prop from the server). The athlete pans/zooms; **Save photo** exports the cropped region to a JPEG blob (`canvas.toBlob`, quality ~0.9).
- **Upload:** the blob POSTs (multipart or base64 JSON) to `POST /api/profile/photo`. The route: authed; validates mime (jpeg/png/webp) and size (≤ 10MB); rejects the upload if the cropped output's short edge is < 800px (keeps the hero sharp); uploads to the `profile-photos` bucket at a **unique path** (`<slug>/hero-<timestamp>.jpg`) via `context.locals.supabase.storage`; gets the public URL; updates the owner row's `photo_url`. Returns `{ ok, photoUrl } | { error }`. Unique paths avoid needing Storage UPDATE/DELETE policies (old objects orphan — acceptable for v1).
- **Hero render fix:** `Hero.astro` currently builds the photo src as `${BASE_URL}/${heroPhoto}`, which corrupts an absolute Storage URL. Change so an absolute `http(s)://` (or protocol-relative) `heroPhoto` is passed through unchanged; only relative bundled paths get the base prefix. (Same fix applied wherever a theme's Hero consumes `heroPhoto`.)

## Data flow

1. `/admin` (SSR, authed) loads the owner record + resolves the athlete's `ThemeMeta`. Renders the section editors (3b) plus the new Offers and Photo cards, seeding each.
2. **Offers:** edit list (add via typeahead/manual, remove, reorder) → Save → `POST /api/profile/offers` → validate → write `profile.offers` → RLS update. Public SSR reflects it live.
3. **Photo:** pick file → crop (ratio from manifest) → Save → `POST /api/profile/photo` → validate → Storage upload → set `photo_url` → RLS update. Public hero shows the new photo live.

## Error handling

- Both routes fail loud with `{ error }` and appropriate status (401 no user, 400 validation, 404 no owned record); islands surface the message inline in reserved space (no layout shift), consistent with 3b.
- Photo: reject unsupported type / oversize / under-resolution with a clear message; never upload a partial/failed crop.
- Offers: reject an offer with neither a `schoolId` nor a manual `school`.

## Testing

**Pure/unit (Vitest):**
- Offer validation (schoolId-or-manual; unknown-field stripping) and reorder (move up/down index math) as pure functions.
- Theme-manifest resolution: `getThemeMeta('tyler')` → `4/5`; unknown theme fails loud.
- Photo request validation (mime/size/min-dimension) as a pure function.

**Integration (env-gated, like existing RLS tests):**
- Anon cannot write `profile.offers` or `photo_url` (RLS blocks) — parallel to the existing `athlete-admin` test.

**Multi-theme robustness proof (the acceptance test for the driving requirement):**
- Give the `bare` demo theme a manifest with a *different* ratio (`1`).
- Verify (a) the neutral admin renders identically regardless of which theme the athlete uses (admin no longer imports any public theme CSS — confirmed by grep + build), and (b) the cropper is fed the athlete's theme ratio (Tyler → 4/5; a bare-themed athlete → 1/1), proving no ratio is hardcoded.

**End-to-end (needs Tyler's Supabase login — Angelo's manual step):**
- Add an offer via typeahead → Save → it appears on the public site with the right logo/level.
- Add a manual offer → renders with monogram.
- Reorder offers → public order changes.
- Upload + crop a photo → the hero shows the new image at the correct frame, live.

## Success criteria

1. The admin panel imports **no** public-theme CSS; it has its own neutral skin and looks the same for any athlete/theme.
2. The photo cropper crops to the athlete's **theme-declared** hero ratio, with nothing hardcoded to 4:5 — proven against a second theme with a different ratio.
3. An athlete can add (typeahead or manual), remove, and reorder offers; the public SSR site reflects it live.
4. An athlete can upload and crop a hero photo; it lands in Storage and shows live, owner-scoped by RLS.
5. All writes go through the authed client; the service-role key never enters the request path.
6. The integrity + no-layout-shift + per-save-feedback conventions from 3b hold.

## Manual prerequisite (Angelo)

The end-to-end offer/photo tests need Tyler's Supabase auth user created + linked (`scripts/link-owner.mjs`). The foundation, offers, and photo code all build and unit/integration-test without it; only the live loop needs it.
