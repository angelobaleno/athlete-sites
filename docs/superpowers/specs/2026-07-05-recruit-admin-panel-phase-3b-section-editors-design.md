# Recruit Admin Panel — Phase 3b: Section Editors — Design Spec

**Date:** 2026-07-05
**Owner:** Angelo
**Builds on:** Phase 1 (backend), Phase 2 (public SSR reads from DB), Phase 3a (auth + protected `/admin` shell).
**Parent spec:** `2026-07-03-recruit-admin-panel-design.md`

## Purpose

Let Tyler edit his own site's **content values** — name, position, jersey, the HT/WT/40/GPA stat rail, measurables, academics, film links, contact — from the protected `/admin` dashboard, with each section saving independently and the change reflected live on the public SSR site.

This is the first slice of the panel's editing surface. It deliberately covers **value fields only**.

## Scope

**In scope — editors for these sections (edit existing values):**
- **Identity** — first, last, position, positionShort, jersey, gradYear, school, team, location
- **Stat Rail** (`headline`) — the hero stats (HEIGHT / WEIGHT / 40 YARD / GPA): edit each stat's value
- **Measurables** (`measurables`) — athletic-testing stats: edit each stat's value
- **Academics** — gpa, scale, testScore, major
- **Film** — hudlEmbed, hudlWatch, hudlProfile, title
- **Contact** — athlete (name, phone, twitter, twitterUrl), coach (name, title, contact), hudl

**Deferred (later slices, not this one):**
- List management — `honors` (string list), `schedule` (games), `positions` — anything needing add/remove/reorder rows.
- `offers` — the school-picker slice (its own spec).
- Card visibility toggles — explicitly out; Angelo cut them from this slice.
- Photo upload/cropper — its own slice.

## Core decisions (locked with Angelo)

- **Per-section save.** Each section card has its own Save; no global "save all." Small writes, clear per-section feedback.
- **Always-editable forms, no view→edit toggle.** Inputs are always rendered. This satisfies the no-layout-shift rule by construction — there is no mode to enter, so nothing reflows.
- **Blank = TBD (the integrity mechanic).** A field left empty renders as the public site's placeholder; a non-empty value renders as-is. Tyler clears a placeholder by typing; marks a field not-yet-available by clearing it. On save the stored `placeholder` boolean is **derived from emptiness** (empty/whitespace → `true`), not a separate control — this makes fabrication impossible (empty always stays a placeholder) and needs no extra editor UI. **Requires a small public-component adjustment** (see below): today placeholder fields store a literal display value (`—`, `Available on request`) and the components render `{value}` verbatim, so a blank value would render as *empty*. The components that show placeholder-capable fields must render a consistent placeholder label (a `—` / "TBD" glyph) when `placeholder` and the value is empty.
- **Stat rows: values only.** Stat rail and measurables render each stat's fixed label with a value input beside it. No add/remove of stat rows in this slice.
- **Dashboard = one scrolling page, one card per section.** Matches the parent spec. On-brand dark athletic styling (matches the site: condensed labels, restrained, no added effects).

## Architecture

**Surfaces:**
1. **`/admin` dashboard** (already protected by Phase 3a middleware) — server-loads the owner's athlete record via the per-request authed Supabase client on `context.locals`, then renders a section-editor card per in-scope section. A **"View my site"** link at the top.
2. **Save API route(s)** — receive one section's data, validate, merge it into the profile JSON, write it back.

**Editor cards as Preact islands.** Same pattern as the existing `LoginForm` island. Each card is seeded with its section's current values (passed from the server-rendered dashboard). Local form state lives in the island; Save POSTs the section payload.

**Save endpoint.** A section-scoped write:
- Authed through the existing middleware — the route uses `context.locals`' authed Supabase client (never the service key); **RLS** guarantees Tyler can write only his own row (`owner_user_id = auth.uid()`).
- Server merges the received section into the current `profile` JSONB and updates the `athletes` row. Read-modify-write on the profile document; only the one section is replaced, so concurrent edits to *different* sections don't clobber each other.
- Returns `{ ok: true }` or a validation/permission error.

**Placeholder derivation + display.** Two halves:
- *Save side:* for `Stat` and `Field` values, `placeholder` is set to `true` when the value is empty/whitespace and `false` otherwise, before persisting.
- *Display side:* the public components that render placeholder-capable fields (`Athletics`/measurables, `Academics` testScore + major, `Contact` coach, and any `headline` stat) currently print `{value}` and only apply faint styling on `placeholder`. Adjust each so that when `placeholder` and the value is empty, they render a fixed placeholder label (a `—` / "TBD" token) rather than nothing. This is a small, bounded edit confined to those components; no layout or skin change.

## Data flow

1. Dashboard (SSR, authed) → load owner record → render section cards seeded with values.
2. Tyler edits a card → clicks its Save.
3. Island POSTs `{ section, data }` → API route.
4. Route: authed client → validate → derive placeholder flags → merge section into `profile` → update row (RLS-guarded) → respond.
5. Public site is SSR, so Tyler's next load of `/` shows the change. "View my site" link lets him check.

## Validation & errors

- **Light validation.** Required identity fields (first, last, position) cannot be saved blank. Film and twitter URL fields expect URL-shaped input. Other fields accept free text (blank = TBD).
- **Fail-loud saves.** A failed save (validation, auth, or DB error) shows an inline error message in space already reserved on the card — never a silent drop, never layout shift.
- **Auth.** Unauthenticated requests to `/admin` or the save route are rejected/redirected by the existing guard.

## Testing

**Acceptance loop (spec loop minus toggles):** Tyler logs in → changes his 40 time → saves that card → his public site shows the new 40 time, live.

**Additional checks:**
- Unauthenticated visitor cannot reach `/admin` or POST to the save route (redirected / rejected).
- RLS: an authed athlete cannot write another athlete's record.
- Blank ↔ value: clearing a stat value renders TBD on the public site; filling it renders the value.
- Per-section isolation: saving one section does not overwrite unsaved edits in another section's stored data.
- Required identity fields cannot be blanked.

## Success criteria

1. Tyler edits any in-scope section in a branded, always-editable form, saves that section, and the public SSR site reflects it live.
2. Each section saves independently; a failed save reports inline without layout shift.
3. Blank = TBD holds: no field can be fabricated, and emptying a field returns it to the TBD placeholder.
4. Writes are owner-scoped by RLS; the service key is never used in the request path.

## Out of scope (this slice)

List editors (honors/schedule/positions), offers/school picker, card visibility toggles, photo upload/crop, multi-athlete UI, and any change to the bespoke skin.

## Manual prerequisite (Angelo)

To test the live loop, Tyler needs a Supabase auth user created in the dashboard, then linked via `scripts/link-owner.mjs <email> tyler-baleno`. (Account creation is Angelo's to do; it is not required to build the editors, only to test the end-to-end loop.)
