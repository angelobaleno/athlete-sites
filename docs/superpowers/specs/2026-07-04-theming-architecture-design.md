# Theming Architecture — Design Spec

**Date:** 2026-07-04
**Owner:** Angelo
**Status:** Approved; open items resolved 2026-07-04; ready for implementation planning.
**Origin:** Refines how a "new skin" is structured in the Athlete Sites platform. Supersedes the old "theme = design tokens" idea from the retired `Athlete Site Starter` spec. The platform (shared Supabase backend, per-athlete RLS record, content-editing admin, one live skin = Tyler) already exists; this spec adds the layer that lets athlete #2, #3, #N each get a *complete visual overhaul* on the same bones.

---

## Problem

Today the platform has **one** component set (`src/components/*.astro`) rendered in a **fixed, hardcoded order** by `src/pages/index.astro`. Visual variation between athletes would be limited to design tokens (palette/fonts) over identical components — a **recolor**. Two athletes' sites would read as siblings.

The goal is the opposite: one site can look like Nike, another like Spotify — **total style overhauls** (layout, type, spacing, motion, panel styling), all sitting on the **same structural foundation** (the same panel vocabulary and data engine). The business model already assumes this: *"adding athlete #2 is a new skin + a new record"* (`BUSINESS.md`). This spec defines what "a new skin" concretely is.

## The three-layer model

The system splits into three layers that change independently:

| Layer | What it owns | Who controls it | Varies per athlete? |
|---|---|---|---|
| **Foundation** | Data schema, plumbing/helpers, the render engine | Angelo, rarely | No — shared |
| **Arrangement** | Which panels appear and in what order | Angelo, per build | Yes |
| **Skin (theme)** | Every visual: layout, type, spacing, color, motion, per-panel markup | Angelo, per build (the design work) | Yes — totally |

**The orthogonality principle that makes it work:** a skin must implement *every* panel type, and arrangement is *just data*. Because every theme can render every panel, arrangement and theming never interfere — any panel order looks right in any skin. The design corollary: **themes share logic, never look.** Non-visual work (data resolution, Hudl embed parsing, formatting) lives in shared headless helpers every theme calls; layout/type/spacing/motion/markup are owned 100% by each theme. Sharing visual primitives "to save time" is what drags themes back toward looking alike — so it is explicitly disallowed.

---

## Layer 1 — Foundation (shared)

Owns *what a panel is* and *what data it receives* — never how it looks. Most of it already exists.

### Panel contract
Each panel type has a fixed prop shape (the contract). A theme's component for that panel receives exactly this and may render it however it likes. Derived from the existing `src/lib/types.ts` + the props `index.astro` already passes:

| Panel | Contract (props in) |
|---|---|
| `Nav` | `player: PlayerView` |
| `Hero` | `player: PlayerView`, `headline: Stat[]` |
| `Film` | `film: AthleteProfile['film']` |
| `Offers` | `offers: ResolvedOffer[]` (post-`resolveOffers`) |
| `Athletics` | `measurables: Stat[]`, `honors: string[]` |
| `Positions` | `positions: AthleteProfile['positions']` |
| `Academics` | `academics: AthleteProfile['academics']` |
| `Schedule` | `schedule: Game[]`, `scheduleMeta: AthleteProfile['scheduleMeta']` |
| `Contact` | `contact: AthleteProfile['contact']`, `player: PlayerView` |
| `Footer` | `player: PlayerView` |

The contract is the **stable interface** between foundation and skins. Adding a new panel type is additive (existing themes unaffected until they opt in). Changing an existing contract is the rare, careful case (see Foundation isolation).

### Data + plumbing (already built)
`src/lib/` — `athlete.ts` (`getAthleteBySlug`, `resolveOffers`), `types.ts`, `schools.ts`, Supabase access. Shared, theme-agnostic. This is the "share the plumbing" half of the principle.

### The engine (new — generalizes `index.astro`)
A small module that, for a given athlete record:
1. Resolves the athlete's **theme** and **arrangement**.
2. For each panel in the arrangement (filtered by `cardVisibility`), renders **that theme's component** for the panel, handed the contract slice of the athlete's data.
3. Wraps the result in the theme's own layout/`Base`.

`index.astro` becomes a thin caller of the engine instead of a hardcoded component list.

---

## Layer 2 — Arrangement (Angelo-set data)

An **ordered list of panel keys** per athlete, e.g. `['hero','film','offers','athletics','positions','academics','schedule','contact']`. The engine renders panels in this order. A QB build can lead with film; a lineman build can push measurables up.

**Interaction with the existing `cardVisibility`:** visibility (on/off per card) is already athlete-editable in the DB (`CardVisibility` in `types.ts`). Arrangement (order) is **not** athlete-editable. At render, the engine walks the arrangement and skips any panel whose `cardVisibility` flag is false. Order and visibility are orthogonal: Angelo owns order, the athlete owns on/off.

**Where arrangement lives (recommended):** in **repo-side per-athlete config keyed by slug**, *not* in the athlete-editable Supabase record — precisely so athletes cannot reach it. `cardVisibility` stays in the DB (athlete-editable); arrangement stays in code (Angelo-only). This split is the mechanism that enforces "athletes edit content only." *(Decided 2026-07-04: repo-side config keyed by slug.)*

---

## Layer 3 — Skin / theme (bespoke per athlete)

A **theme is a folder** that ships one component per panel type plus its own layout:

```
src/themes/<name>/
  Base.astro          theme's page shell (fonts, global styles, tokens)
  Nav.astro  Hero.astro  Film.astro  Offers.astro  Athletics.astro
  Positions.astro  Academics.astro  Schedule.astro  Contact.astro  Footer.astro
  theme.css           theme-owned styles (not shared)
```

Each component satisfies the Layer-1 contract for its panel and is otherwise free — any HTML, CSS, and motion. Swapping the folder swaps the entire look. Building a new athlete's site = authoring one new `themes/<name>/` folder; the foundation, data, and engine are never touched.

**Tyler's current `src/components/*` become `src/themes/tyler/*`** — the first theme, unchanged in output. This both proves the extraction is behavior-preserving and gives athlete #2 a reference to copy from.

**Shared headless helpers** (formatting, embed parsing, offer resolution) live in `src/lib/` and are imported by theme components. No *visual* helper is shared.

### Theme resolution
> **Implementation correction (2026-07-05):** theme lives in the **repo-side `src/lib/site-config.ts`**, NOT on the athlete's DB record as this paragraph originally said. Deliberate: the athlete row is (partially) athlete-writable, so a DB-side theme key would put a design field within athlete reach — exactly what this spec forbids. Additionally, production routes import their theme **statically** (one route file per athlete under `src/pages/s/`) because Astro links every stylesheet reachable from a route; the dynamic registry is dev/preview-only. Do not "fix" theme back into the DB.

The engine maps the config's theme name to `src/themes/<theme>/`. Unknown/missing theme is a hard error (fail loud, never silently fall back to another athlete's look).

---

## Foundation isolation — "will editing the foundation break other athletes?"

Adapted to the single-repo + single-Supabase reality:

- **Daily work is walled off.** A new athlete = a new `themes/<name>/` folder + a new data row (RLS-isolated) + an arrangement entry. None of these are imported by any other athlete, so they **cannot** affect anyone else. This is ~95% of the work.
- **Only foundation edits ripple** (engine, contracts, `src/lib/` plumbing) because every athlete imports them. But the foundation holds **no design**, so it's rarely reopened once stable.
- **Isolation approach — start simple, graduate later:**
  1. **Now:** shared foundation + *rebuild-and-eyeball* — when the foundation is edited, rebuild each athlete's page and glance at it before deploying. Trivial at 2–5 athletes.
  2. **~4–5 athletes:** version the foundation (pin each site to a foundation version) so a change can't retroactively break an existing athlete until Angelo bumps them.
  3. Never: copy-the-foundation-per-site (max isolation, worst maintenance) — this is what standalone repos were; the platform exists to avoid it.
- Contract changes are the one rippling case: keep them **additive** (new panels/fields) whenever possible.

---

## Athlete self-service boundary (locked)

The athlete's admin (already built: auth, RLS, dashboard) lets them **edit content and toggle cards on/off — nothing else.** No reordering, no theme access, no layout control. Order and skin are Angelo's. This matches the platform's locked rule *"Angelo designs, the athlete maintains."* This project adds **no** athlete-facing UI.

---

## Migration path (incremental — the site stays live throughout)

1. **Extract Tyler → theme #1.** Move `src/components/*` to `src/themes/tyler/*` (+ the theme's `Base`). Output identical. Verify by build + visual diff against the current live page.
2. **Introduce the engine.** Generalize `index.astro` into the engine that reads `theme` + `arrangement` and renders theme components filtered by `cardVisibility`. Tyler renders through the engine with an arrangement equal to today's fixed order → still identical output.
3. **Wire theme + arrangement resolution.** Add the `theme` key to the record and the repo-side arrangement config keyed by slug.
4. **Prove distinctness.** Build athlete #2 as `src/themes/<name>/` with a visibly different skin (the Nike-vs-Spotify test) using the *same* engine, contracts, and data layer. Two sites, one machine, unmistakably different looks.

## Out of scope (YAGNI)

- Athlete-facing reorder or drag-and-drop UI.
- A visual theme *picker* / preset shelf (each skin is bespoke, not chosen from a menu).
- Any automated theme generator/CLI.
- Versioned-foundation packaging (revisit at ~4–5 athletes).
- Rewriting the stale Tyler-only `DESIGN.md` (flagged; do separately).

## Success criteria

1. Tyler renders through the engine, output identical to today (behavior-preserving extraction).
2. A second athlete built purely as a new `themes/<name>/` folder + data row + arrangement entry produces a site that is **structurally the same, visually unmistakably different** — no shared visual code.
3. Editing one athlete's theme provably cannot change another athlete's site.
4. Arrangement changes order; `cardVisibility` changes on/off; the two are independent and neither requires touching a theme's internals.
5. Athletes retain content + visibility editing only; no path exists for them to change order or skin.

## Resolved decisions (2026-07-04)

1. **Arrangement storage:** repo-side config keyed by slug. Keeps order out of athlete reach; `cardVisibility` stays the only DB-backed, athlete-editable layout control.
2. **Theme naming:** one folder per athlete (`src/themes/<slug>/`). Skins are bespoke, not reusable named aesthetics. (A reusable-named model can be revisited later if two athletes ever want to share a base look.)
3. **Stale `DESIGN.md`:** left as Tyler's data-of-record. Add a one-line header note pointing to the specs as the current architecture source; no full rewrite now.
