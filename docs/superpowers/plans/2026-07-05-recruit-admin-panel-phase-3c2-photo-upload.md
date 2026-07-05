# Phase 3c-2: Hero Photo Upload — Implementation Plan

**Goal:** An athlete uploads and crops their hero photo from `/admin`; it lands in Storage (owner-scoped), `photo_url` updates, and the public hero shows it live at the theme's declared frame.

**Spec:** `docs/superpowers/specs/2026-07-05-recruit-admin-panel-phase-3c-offers-photo-multitheme-design.md` (§ Theme manifest, § 4 Photo upload + cropper).

## Deviations from the spec (both deliberate, both security-driven)

1. **Storage path is `<athlete_id>/hero-<timestamp>.jpg`, not `<slug>/…`.** The live storage policy (0004, applied 2026-07-05, after the spec was written) grants writes only inside folders named for an athlete **id** the signed-in user owns. The id path is the enforced boundary; the invariant suite already proves it.
2. **`themeMeta` lives in a CSS-free `src/themes/<name>/meta.ts`, not the theme's `index.ts` barrel.** The admin page must read the manifest, and importing the barrel would link the theme's global CSS onto `/admin` — undoing the 3c-1 neutral-admin decouple. `index.ts` may re-export it for completeness; the admin and `getThemeMeta` import only `meta.ts`.

## Tasks

1. **Theme manifest.** `ThemeMeta { heroPhotoAspectRatio }` in `src/themes/types.ts`; `tyler/meta.ts` = 4/5, `bare/meta.ts` = 1 (deliberately different, proves the seam); `src/themes/meta.ts` exports `getThemeMeta(name)` — fail-loud on unknown. TDD.
2. **Photo validation (pure).** `src/lib/photo-admin.ts`: `imageDimensions(bytes)` header parser (jpeg/png/webp) + `validatePhoto({ type, size, bytes })` — mime jpeg/png/webp, ≤ 10 MB, short edge ≥ 800px. TDD.
3. **Route + data access.** `savePhotoUrl(supabase, athleteId, url)` in `athlete-admin.ts` (RLS + column grant are the boundary); `POST /api/profile/photo` — authed, multipart (`photo` file field), validate, upload via `locals.supabase.storage` to the unique id-keyed path, `getPublicUrl`, save. 401/400/404/200 like the other routes.
4. **PhotoEditor island.** Preview box at the manifest ratio (space reserved — no layout shift), file input, cropperjs at `aspectRatio`, JPEG export (`canvas.toBlob`, q≈0.9) with client-side short-edge check, POST FormData, inline status in reserved space. Neutral `--a-*` tokens only.
5. **Wire onto `/admin`.** Resolve `getSiteConfig(record.slug).theme` → `getThemeMeta(...)`; seed the island with `photoUrl` + ratio.
6. **Verify.** `npm test`, `astro check`, build; live crop loop needs Tyler's linked login (Angelo-manual prerequisite, per spec § Testing).

Hero absolute-URL fix (spec § 4, last bullet) already shipped 2026-07-05 (`assetUrl`).
