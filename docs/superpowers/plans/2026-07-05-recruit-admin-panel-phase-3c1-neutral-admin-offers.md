# Phase 3c-1: Neutral Admin Skin + Offers Editor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple the admin panel from Tyler's public theme onto its own neutral skin, then let an athlete add (typeahead/manual), remove, and reorder their college offers from `/admin`, reflected live on the public SSR site.

**Architecture:** First a bounded, behavior-preserving refactor: the admin surface (layout, login, all editor components) stops importing any public theme's CSS and instead uses an owned neutral `--a-*` admin token set — so any future athlete/theme gets a working admin for free. Then the offers feature: pure validation/reorder logic, a dedicated `POST /api/profile/offers` write path (offers is a list of objects, not the flat fields the 3b `[section]` route handles), an authed schools-typeahead endpoint wrapping the existing `searchSchools`, and a generic `OffersEditor` Preact island wired onto the dashboard.

**Tech Stack:** Astro 4.x (`output:'server'`, Vercel adapter) · `@supabase/ssr` authed client on `context.locals` · Preact islands · Vitest · TypeScript.

## Global Constraints

- **Node/Astro:** use the versions already in the project; do not upgrade Astro. (Astro 4.x, Node 20 pin.)
- **Neutral admin (spec):** after this plan the admin surface imports NO public-theme CSS and references NO public-theme variable (`--ink`, `--gold`, `--line`, `--bone`, `--muted`, `--ink-2`, `--ink-3`, `--gold-hi`, `--display`, `--body`, `--radius`). It uses only owned `--a-*` tokens. The refactor is behavior-preserving — Tyler's admin looks the same.
- **RLS is the security boundary:** writes go through the per-request authed client on `context.locals.supabase`; the `SUPABASE_SERVICE_ROLE_KEY` is NEVER in the request path. Owner-only update via policy `athletes_owner_update`.
- **Offers data shape (`src/lib/types.ts`):** an `Offer` is either a `{ schoolId }` reference OR a manual `{ school, short, level, location, logoUrl? }`. On save, normalize: a `schoolId` offer is stored as `{ schoolId }` only; a manual offer keeps `{ school, short, level, location }`. Every stored offer must have a `schoolId` OR a non-empty `school`.
- **No layout shift:** editor cards are always-editable; inline status/error occupies reserved space.
- **Per-section save:** the offers card saves independently, like the 3b editors.
- **Types single source:** reuse `src/lib/types.ts` (`Offer`, `School`, `AthleteProfile`); add admin-only helpers in new `src/lib/offers-admin.ts`.
- **Scope:** offers only (add typeahead/manual, remove, reorder). NO photo (that is Phase 3c-2), NO logo uploads, NO card toggles.

---

## File Structure

- **Create** `src/layouts/admin.css` — owned neutral `--a-*` token set + base admin body/main styles + font import.
- **Modify** `src/layouts/Admin.astro` — import `admin.css` instead of `tyler/global.css`; retoken its inline styles.
- **Modify** `src/components/admin/SectionEditor.css`, `LoginForm.css`, `LogoutButton.css`; `src/pages/login.astro` and `src/pages/admin/index.astro` inline `<style>` — retoken theme vars → `--a-*`.
- **Create** `src/lib/offers-admin.ts` — pure `validateOffers`, `moveOffer`.
- **Modify** `src/lib/athlete-admin.ts` — add `saveOffers`.
- **Create** `src/pages/api/profile/offers.ts` — POST offers save.
- **Create** `src/pages/api/schools.ts` — authed GET typeahead over `searchSchools`.
- **Create** `src/components/admin/OffersEditor.tsx` + `OffersEditor.css` — the offers island.
- **Modify** `src/pages/admin/index.astro` — render `OffersEditor` seeded with resolved current offers.
- **Create/extend** tests: `tests/lib/offers-admin.test.ts`.

Reference token map (current theme var → new admin token, keep the same hex so the look is preserved):
`--ink #0E0E10 → --a-bg` · `--ink-2 #151419 → --a-surface` · `--ink-3 #1C1B22 → --a-surface-2` · `--line #2A2831 → --a-line` · `--bone #F5F3EF → --a-text` · `--muted #9A97A2 → --a-muted` · `--gold #F2A81D → --a-accent` · `--gold-hi #FFC24D → --a-accent-hi` · `--radius 4px → --a-radius` · `--display 'Saira Condensed' → --a-display` · `--body 'Inter' → --a-body`.

---

### Task 1: Decouple the admin onto a neutral skin (behavior-preserving)

**Files:**
- Create: `src/layouts/admin.css`
- Modify: `src/layouts/Admin.astro`, `src/components/admin/SectionEditor.css`, `src/components/admin/LoginForm.css`, `src/components/admin/LogoutButton.css`, `src/pages/login.astro` (inline `<style>`), `src/pages/admin/index.astro` (inline `<style>`)

**Interfaces:**
- Produces: the `--a-*` admin tokens (listed below), available to every admin-surface component via `admin.css` imported in `Admin.astro`.

- [ ] **Step 1: Create `src/layouts/admin.css`** with the owned neutral tokens, font import, and base styles (moved from Admin.astro's inline block):

```css
/* Neutral admin skin — owned by the admin panel, independent of any public theme.
   Same dark-athletic values Tyler's admin used, but sourced here so ANY athlete's
   admin works regardless of their public skin. */
@import url('https://fonts.googleapis.com/css2?family=Saira+Condensed:wght@600;700;800;900&family=Inter:wght@400;500;600&display=swap');

:root {
  --a-bg:        #0E0E10;
  --a-surface:   #151419;
  --a-surface-2: #1C1B22;
  --a-line:      #2A2831;
  --a-text:      #F5F3EF;
  --a-muted:     #9A97A2;
  --a-accent:    #F2A81D;
  --a-accent-hi: #FFC24D;
  --a-danger:    #E5534B;
  --a-radius:    4px;
  --a-display:   'Saira Condensed', 'Arial Narrow', sans-serif;
  --a-body:      'Inter', system-ui, -apple-system, sans-serif;
}

*, *::before, *::after { box-sizing: border-box; }
.admin-body { min-height: 100dvh; background: var(--a-bg); color: var(--a-text);
  font-family: var(--a-body); margin: 0; -webkit-font-smoothing: antialiased; }
.admin-main { max-width: 720px; margin: 0 auto; padding: 3rem 1.25rem; }
```

- [ ] **Step 2: Point `Admin.astro` at `admin.css`** and drop the theme import. Change `src/layouts/Admin.astro`'s frontmatter import from:

```astro
import '../themes/tyler/global.css';
```
to:
```astro
import './admin.css';
```
Then remove the now-duplicated `.admin-body` / `.admin-main` rules from its inline `<style>` (they live in `admin.css` now). If the `<style>` block becomes empty, remove it.

- [ ] **Step 3: Retoken the admin components.** In each of `src/components/admin/SectionEditor.css`, `LoginForm.css`, `LogoutButton.css`, and the inline `<style>` blocks of `src/pages/login.astro` and `src/pages/admin/index.astro`, replace every public-theme `var(--X)` with its `--a-*` equivalent per the token map: `--ink→--a-bg`, `--ink-2→--a-surface`, `--ink-3→--a-surface-2`, `--line→--a-line`, `--bone→--a-text`, `--muted→--a-muted`, `--gold→--a-accent`, `--gold-hi→--a-accent-hi`, `--radius→--a-radius`, `--display→--a-display`, `--body→--a-body`. In `SectionEditor.css`, also change the hardcoded `.se__status--error { color: #E5534B; }` to `color: var(--a-danger);`.

- [ ] **Step 4: Verify the decouple is complete** — no theme import, no theme var left in the admin surface:

Run:
```bash
grep -rnE "themes/|global\.css" src/layouts/Admin.astro src/pages/login.astro src/pages/admin/index.astro
grep -rhoE "var\(--(ink|ink-2|ink-3|line|bone|muted|gold|gold-hi|display|body|radius)\)" \
  src/layouts/Admin.astro src/components/admin/*.css src/pages/login.astro src/pages/admin/index.astro
```
Expected: both commands print NOTHING (no theme import remains; no legacy theme var remains).

- [ ] **Step 5: Verify build + type check**

Run: `npx astro check && npm run build`
Expected: `0 errors`; build completes.

- [ ] **Step 6: Visual confirm (unchanged look).** Run `npm run dev`; load `http://localhost:4321/login` and (after signing in, or by inspecting the rendered HTML/CSS) `http://localhost:4321/admin`. Confirm the admin still renders dark-athletic with gold accents exactly as before — the refactor is behavior-preserving. If you cannot sign in (no test user), at minimum confirm `/login` renders correctly styled and note that `/admin` styling is covered by the same `admin.css` tokens.

- [ ] **Step 7: Commit**

```bash
git add src/layouts/admin.css src/layouts/Admin.astro src/components/admin/SectionEditor.css src/components/admin/LoginForm.css src/components/admin/LogoutButton.css src/pages/login.astro src/pages/admin/index.astro
git commit -m "refactor(admin): neutral admin skin — decouple from tyler theme, own --a-* tokens"
```

---

### Task 2: Offer validation + reorder (pure)

**Files:**
- Create: `src/lib/offers-admin.ts`
- Test: `tests/lib/offers-admin.test.ts`

**Interfaces:**
- Consumes: `Offer` (`src/lib/types.ts`).
- Produces:
  - `function validateOffers(input: unknown): { offers: Offer[] } | { error: string }` — `input` must be an array; each element is normalized: if it has a non-empty string `schoolId`, it becomes `{ schoolId }` (all other fields dropped); else it must have a non-empty string `school`, becoming `{ school, short, level, location }` (each coerced to string, missing → `''`); anything else → `{ error }`.
  - `function moveOffer(offers: Offer[], index: number, dir: 'up' | 'down'): Offer[]` — returns a new array with the item at `index` swapped toward `dir`; out-of-range or no-op-at-edge returns an equal-order copy.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/offers-admin.test.ts
import { describe, it, expect } from 'vitest';
import { validateOffers, moveOffer } from '../../src/lib/offers-admin';
import type { Offer } from '../../src/lib/types';

describe('validateOffers', () => {
  it('rejects a non-array', () => {
    expect('error' in validateOffers({})).toBe(true);
  });
  it('normalizes a schoolId offer to just {schoolId}, dropping resolved fields', () => {
    const res = validateOffers([{ schoolId: 'abc', school: 'Robert Morris', level: 'FCS', logoUrl: 'x' }]);
    expect(res).toEqual({ offers: [{ schoolId: 'abc' }] });
  });
  it('keeps manual offer fields when there is no schoolId', () => {
    const res = validateOffers([{ school: 'Some Prep', short: 'SP', level: 'D2', location: 'PA' }]);
    expect(res).toEqual({ offers: [{ school: 'Some Prep', short: 'SP', level: 'D2', location: 'PA' }] });
  });
  it('coerces missing manual fields to empty strings', () => {
    const res = validateOffers([{ school: 'X' }]) as { offers: Offer[] };
    expect(res.offers[0]).toEqual({ school: 'X', short: '', level: '', location: '' });
  });
  it('rejects an offer with neither schoolId nor school', () => {
    expect('error' in validateOffers([{ level: 'FCS' }])).toBe(true);
  });
  it('accepts an empty list', () => {
    expect(validateOffers([])).toEqual({ offers: [] });
  });
});

describe('moveOffer', () => {
  const a: Offer = { schoolId: 'a' }; const b: Offer = { schoolId: 'b' }; const c: Offer = { schoolId: 'c' };
  it('moves an item up', () => {
    expect(moveOffer([a, b, c], 1, 'up')).toEqual([b, a, c]);
  });
  it('moves an item down', () => {
    expect(moveOffer([a, b, c], 1, 'down')).toEqual([a, c, b]);
  });
  it('is a no-op at the top edge', () => {
    expect(moveOffer([a, b, c], 0, 'up')).toEqual([a, b, c]);
  });
  it('is a no-op at the bottom edge', () => {
    expect(moveOffer([a, b, c], 2, 'down')).toEqual([a, b, c]);
  });
  it('does not mutate the input', () => {
    const arr = [a, b, c]; moveOffer(arr, 1, 'up'); expect(arr).toEqual([a, b, c]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/offers-admin.test.ts`
Expected: FAIL — cannot find module `../../src/lib/offers-admin`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/offers-admin.ts
import type { Offer } from './types';

function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

export function validateOffers(input: unknown): { offers: Offer[] } | { error: string } {
  if (!Array.isArray(input)) return { error: 'Offers must be a list' };
  const offers: Offer[] = [];
  for (const raw of input) {
    if (raw == null || typeof raw !== 'object') return { error: 'Invalid offer' };
    const o = raw as Record<string, unknown>;
    const schoolId = str(o.schoolId).trim();
    if (schoolId !== '') { offers.push({ schoolId }); continue; }
    const school = str(o.school).trim();
    if (school === '') return { error: 'Each offer needs a school (pick one or enter it manually)' };
    offers.push({ school, short: str(o.short), level: str(o.level), location: str(o.location) });
  }
  return { offers };
}

export function moveOffer(offers: Offer[], index: number, dir: 'up' | 'down'): Offer[] {
  const next = [...offers];
  const target = dir === 'up' ? index - 1 : index + 1;
  if (index < 0 || index >= next.length || target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/offers-admin.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/offers-admin.ts tests/lib/offers-admin.test.ts
git commit -m "feat(admin): pure offer validation + reorder helpers"
```

---

### Task 3: Save offers — data-access + route

**Files:**
- Modify: `src/lib/athlete-admin.ts`
- Create: `src/pages/api/profile/offers.ts`

**Interfaces:**
- Consumes: `getOwnedAthlete` (existing, `athlete-admin.ts`), `validateOffers` (Task 2), `context.locals` (middleware).
- Produces:
  - `async function saveOffers(supabase: SupabaseClient, athleteId: string, offers: Offer[]): Promise<{ ok: true } | { error: string }>` — read current profile, set `profile.offers = offers`, update the row by id (RLS owner-only; zero rows → `{ error }`).
  - `POST /api/profile/offers` — body `{ offers: unknown }`; 401 no user, 400 invalid offers / bad body, 404 no owned record, 200 ok.

- [ ] **Step 1: Add `saveOffers` to `src/lib/athlete-admin.ts`** (mirror the read-modify-write in `saveProfileSection`, but for the offers list). Add the import of `Offer` if not present, and append:

```ts
export async function saveOffers(
  supabase: SupabaseClient, athleteId: string, offers: Offer[],
): Promise<{ ok: true } | { error: string }> {
  const { data: row, error: readErr } = await supabase
    .from('athletes').select('profile').eq('id', athleteId).maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: 'Record not found' };

  const nextProfile = { ...(row.profile as AthleteProfile), offers };
  const { data: updated, error: writeErr } = await supabase
    .from('athletes').update({ profile: nextProfile }).eq('id', athleteId).select('id');
  if (writeErr) return { error: writeErr.message };
  if (!updated || updated.length === 0) return { error: 'Not authorized to edit this record' };
  return { ok: true };
}
```
(Ensure `import type { Offer } from './types';` is present alongside the existing `AthleteProfile`/`AthleteRecord` import.)

- [ ] **Step 2: Create the route `src/pages/api/profile/offers.ts`:**

```ts
import type { APIRoute } from 'astro';
import { validateOffers } from '../../../lib/offers-admin';
import { getOwnedAthlete, saveOffers } from '../../../lib/athlete-admin';

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const body = await context.request.json().catch(() => null);
  const validated = validateOffers(body && typeof body === 'object' ? (body as any).offers : undefined);
  if ('error' in validated) return json({ error: validated.error }, 400);

  const record = await getOwnedAthlete(context.locals.supabase, user.id);
  if (!record) return json({ error: 'No editable record for this account' }, 404);

  const res = await saveOffers(context.locals.supabase, record.id, validated.offers);
  if ('error' in res) return json({ error: res.error }, 400);
  return json({ ok: true }, 200);
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
}
```

- [ ] **Step 3: Verify build + type check**

Run: `npx astro check && npm run build`
Expected: `0 errors`; build completes; route emitted.

- [ ] **Step 4: Commit**

```bash
git add src/lib/athlete-admin.ts src/pages/api/profile/offers.ts
git commit -m "feat(admin): POST /api/profile/offers — authed, RLS-guarded offers save"
```

---

### Task 4: Schools typeahead endpoint

**Files:**
- Create: `src/pages/api/schools.ts`

**Interfaces:**
- Consumes: `searchSchools` (`src/lib/schools.ts`), `context.locals.user`.
- Produces: `GET /api/schools?q=<query>` → `200 { schools: School[] }` when authed (empty `q` → empty list), `401 { error }` when not signed in.

- [ ] **Step 1: Create `src/pages/api/schools.ts`:**

```ts
import type { APIRoute } from 'astro';
import { searchSchools } from '../../lib/schools';

export const prerender = false;

export const GET: APIRoute = async (context) => {
  if (!context.locals.user) {
    return new Response(JSON.stringify({ error: 'Not signed in' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }
  const q = context.url.searchParams.get('q') ?? '';
  const schools = await searchSchools(q);
  return new Response(JSON.stringify({ schools }), {
    status: 200, headers: { 'Content-Type': 'application/json' },
  });
};
```

- [ ] **Step 2: Verify build + type check**

Run: `npx astro check && npm run build`
Expected: `0 errors`; build completes; route emitted.

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/schools.ts
git commit -m "feat(admin): GET /api/schools — authed typeahead over the schools table"
```

---

### Task 5: OffersEditor island + styles

**Files:**
- Create: `src/components/admin/OffersEditor.tsx`, `src/components/admin/OffersEditor.css`

**Interfaces:**
- Consumes: `Offer`, `School` (`src/lib/types.ts`); `GET /api/schools`; `POST /api/profile/offers`; `moveOffer` (Task 2).
- Produces: `default function OffersEditor(props: { offers: Offer[] })` — `offers` are the athlete's current offers already resolved for display (each carries display fields: `school`, `level`, `location`, and `logoUrl?`/`short?`). Renders the list with remove + move up/down, an add-by-typeahead control, an add-manual control, and a Save button that POSTs the normalized list.

- [ ] **Step 1: Write the island**

```tsx
// src/components/admin/OffersEditor.tsx
import { useState } from 'preact/hooks';
import { moveOffer } from '../../lib/offers-admin';
import type { Offer, School } from '../../lib/types';
import './OffersEditor.css';

type Status = { kind: 'idle' | 'saved' } | { kind: 'error'; msg: string };

// Display label helpers — offers arrive resolved (schoolId offers carry school/level/etc).
const label = (o: Offer) => o.school ?? '(unnamed school)';
const sub = (o: Offer) => [o.level, o.location].filter(Boolean).join(' · ');

export default function OffersEditor({ offers: initial }: { offers: Offer[] }) {
  const [offers, setOffers] = useState<Offer[]>(initial);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<School[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [manual, setManual] = useState({ school: '', short: '', level: '', location: '' });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  function dirty() { setStatus({ kind: 'idle' }); }

  async function onSearch(q: string) {
    setQuery(q); dirty();
    if (q.trim() === '') { setResults([]); return; }
    const res = await fetch(`/api/schools?q=${encodeURIComponent(q)}`).catch(() => null);
    if (res && res.ok) { const d = await res.json(); setResults(d.schools ?? []); }
  }

  function addSchool(s: School) {
    setOffers((prev) => [...prev, {
      schoolId: s.id, school: s.name, short: s.short,
      level: s.level, location: s.location ?? '', logoUrl: s.logoUrl ?? undefined,
    }]);
    setQuery(''); setResults([]); dirty();
  }

  function addManual() {
    if (manual.school.trim() === '') return;
    setOffers((prev) => [...prev, { ...manual }]);
    setManual({ school: '', short: '', level: '', location: '' });
    setShowManual(false); dirty();
  }

  function remove(i: number) { setOffers((prev) => prev.filter((_, idx) => idx !== i)); dirty(); }
  function move(i: number, dir: 'up' | 'down') { setOffers((prev) => moveOffer(prev, i, dir)); dirty(); }

  async function save(e: Event) {
    e.preventDefault();
    setBusy(true); setStatus({ kind: 'idle' });
    const res = await fetch('/api/profile/offers', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ offers }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { setStatus({ kind: 'saved' }); return; }
    const d = res ? await res.json().catch(() => ({})) : {};
    setStatus({ kind: 'error', msg: (d as any).error ?? 'Save failed' });
  }

  return (
    <form class="offers-editor" onSubmit={save}>
      <div class="oe__head">
        <h2 class="oe__title">Offers</h2>
        <button class="oe__save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>

      <ul class="oe__list">
        {offers.map((o, i) => (
          <li class="oe__row" key={`${o.schoolId ?? o.school}-${i}`}>
            <div class="oe__info">
              <span class="oe__school">{label(o)}</span>
              <span class="oe__sub">{sub(o)}</span>
            </div>
            <div class="oe__ctrls">
              <button type="button" class="oe__btn" title="Move up" disabled={i === 0}
                onClick={() => move(i, 'up')}>↑</button>
              <button type="button" class="oe__btn" title="Move down" disabled={i === offers.length - 1}
                onClick={() => move(i, 'down')}>↓</button>
              <button type="button" class="oe__btn oe__btn--rm" title="Remove"
                onClick={() => remove(i)}>✕</button>
            </div>
          </li>
        ))}
        {offers.length === 0 && <li class="oe__empty">No offers yet.</li>}
      </ul>

      <div class="oe__add">
        <label class="oe__label">Add a school
          <input class="oe__input" type="text" value={query} placeholder="Search schools…"
            onInput={(e) => onSearch((e.target as HTMLInputElement).value)} />
        </label>
        {results.length > 0 && (
          <ul class="oe__results">
            {results.map((s) => (
              <li key={s.id}>
                <button type="button" class="oe__result" onClick={() => addSchool(s)}>
                  <span>{s.name}</span><span class="oe__result-sub">{s.level}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" class="oe__manual-toggle" onClick={() => setShowManual((v) => !v)}>
          {showManual ? 'Cancel manual entry' : 'School not listed?'}
        </button>
        {showManual && (
          <div class="oe__manual">
            <input class="oe__input" placeholder="School name" value={manual.school}
              onInput={(e) => setManual({ ...manual, school: (e.target as HTMLInputElement).value })} />
            <input class="oe__input" placeholder="Monogram (e.g. SP)" value={manual.short}
              onInput={(e) => setManual({ ...manual, short: (e.target as HTMLInputElement).value })} />
            <input class="oe__input" placeholder="Level (e.g. D2)" value={manual.level}
              onInput={(e) => setManual({ ...manual, level: (e.target as HTMLInputElement).value })} />
            <input class="oe__input" placeholder="Location" value={manual.location}
              onInput={(e) => setManual({ ...manual, location: (e.target as HTMLInputElement).value })} />
            <button type="button" class="oe__add-manual" onClick={addManual}>Add</button>
          </div>
        )}
      </div>

      <p class={`oe__status oe__status--${status.kind}`} role="status">
        {status.kind === 'saved' ? 'Saved.' : status.kind === 'error' ? status.msg : ' '}
      </p>
    </form>
  );
}
```

- [ ] **Step 2: Write the styles** (using the neutral `--a-*` tokens from Task 1):

```css
/* src/components/admin/OffersEditor.css */
.offers-editor { border: 1px solid var(--a-line); background: var(--a-surface);
  border-radius: var(--a-radius); padding: 1.4rem 1.5rem; margin-top: 1.5rem; }
.oe__head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.oe__title { font-family: var(--a-display); font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.02em; font-size: 1.3rem; }
.oe__save { font-family: var(--a-display); font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; font-size: 0.85rem; color: var(--a-bg); background: var(--a-accent);
  border: none; border-radius: var(--a-radius); padding: 0.5rem 1.1rem; cursor: pointer; }
.oe__save:disabled { opacity: 0.6; cursor: default; }
.oe__list { list-style: none; margin: 1.2rem 0 0; padding: 0; display: flex; flex-direction: column; gap: 0.6rem; }
.oe__row { display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  background: var(--a-surface-2); border: 1px solid var(--a-line); border-radius: var(--a-radius); padding: 0.7rem 0.9rem; }
.oe__info { display: flex; flex-direction: column; gap: 0.15rem; }
.oe__school { font-weight: 600; }
.oe__sub { color: var(--a-muted); font-size: 0.82rem; }
.oe__ctrls { display: flex; gap: 0.35rem; }
.oe__btn { background: transparent; border: 1px solid var(--a-line); color: var(--a-text);
  border-radius: var(--a-radius); width: 2rem; height: 2rem; cursor: pointer; }
.oe__btn:disabled { opacity: 0.35; cursor: default; }
.oe__btn--rm { color: var(--a-danger); }
.oe__empty { color: var(--a-muted); font-size: 0.9rem; }
.oe__add { margin-top: 1.2rem; display: flex; flex-direction: column; gap: 0.6rem; }
.oe__label { display: flex; flex-direction: column; gap: 0.35rem;
  font-family: var(--a-display); font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase; font-size: 0.72rem; color: var(--a-muted); }
.oe__input { background: var(--a-surface-2); border: 1px solid var(--a-line); border-radius: var(--a-radius);
  color: var(--a-text); font-family: var(--a-body); font-size: 0.95rem; padding: 0.55rem 0.7rem; }
.oe__input:focus-visible { outline: 2px solid var(--a-accent); outline-offset: 1px; }
.oe__results { list-style: none; margin: 0; padding: 0; border: 1px solid var(--a-line);
  border-radius: var(--a-radius); overflow: hidden; }
.oe__result { width: 100%; display: flex; justify-content: space-between; gap: 1rem;
  background: var(--a-surface-2); border: none; border-bottom: 1px solid var(--a-line);
  color: var(--a-text); font-family: var(--a-body); text-align: left; padding: 0.55rem 0.7rem; cursor: pointer; }
.oe__result:hover { background: var(--a-surface); }
.oe__result-sub { color: var(--a-muted); font-size: 0.8rem; }
.oe__manual-toggle { align-self: flex-start; background: transparent; border: none;
  color: var(--a-accent); font-size: 0.85rem; cursor: pointer; padding: 0; }
.oe__manual { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.oe__add-manual { grid-column: 1 / -1; justify-self: start; font-family: var(--a-display);
  font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem;
  color: var(--a-bg); background: var(--a-accent); border: none; border-radius: var(--a-radius);
  padding: 0.45rem 1rem; cursor: pointer; }
.oe__status { min-height: 1.2rem; margin-top: 1rem; font-size: 0.85rem; }
.oe__status--saved { color: var(--a-accent); }
.oe__status--error { color: var(--a-danger); }
@media (max-width: 560px) { .oe__manual { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Verify type check + build**

Run: `npx astro check && npm run build`
Expected: `0 errors`; build completes.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/OffersEditor.tsx src/components/admin/OffersEditor.css
git commit -m "feat(admin): OffersEditor island — typeahead/manual add, remove, reorder"
```

---

### Task 6: Wire OffersEditor onto the dashboard

**Files:**
- Modify: `src/pages/admin/index.astro`

**Interfaces:**
- Consumes: `getOwnedAthlete` (existing), `resolveOffers` (`src/lib/athlete.ts`), `OffersEditor` (Task 5). The dashboard already loads `record` in 3b; reuse it.

- [ ] **Step 1: Add the resolved-offers seed and render the island.** In `src/pages/admin/index.astro` frontmatter, add imports and compute the resolved offers from the already-loaded `record`:

```astro
import OffersEditor from '../../components/admin/OffersEditor.tsx';
import { resolveOffers } from '../../lib/athlete';
```
After `const record = await getOwnedAthlete(...)` and the `editors` computation, add:
```astro
const offers = record ? await resolveOffers(record.profile.offers) : [];
```
Then wrap the `record` branch of the template in a fragment so it renders both the section editors and the offers card. Change:
```astro
  {record ? (
    editors.map((e) => (
      <SectionEditor client:load section={e.section} title={e.title} fields={e.fields} />
    ))
  ) : (
    <p class="no-record">No editable record is linked to this account yet.</p>
  )}
```
to:
```astro
  {record ? (
    <>
      {editors.map((e) => (
        <SectionEditor client:load section={e.section} title={e.title} fields={e.fields} />
      ))}
      <OffersEditor client:load offers={offers} />
    </>
  ) : (
    <p class="no-record">No editable record is linked to this account yet.</p>
  )}
```

- [ ] **Step 2: Verify type check + build + full suite**

Run: `npx astro check && npm run build && npm test`
Expected: `0 errors`; build completes; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat(admin): render OffersEditor on the dashboard, seeded with resolved offers"
```

---

### Task 7: Verification (offers loop + decouple proof)

**Prerequisite (Angelo, manual — not a code step):** Tyler's Supabase auth user created + linked (`node --env-file=.env.local scripts/link-owner.mjs <tyler-email> tyler-baleno`). Only Step 2's live loop needs it; everything else runs without it.

**Files:** none.

- [ ] **Step 1: Full suite + build + decouple grep**

Run:
```bash
npx astro check && npm test && npm run build
grep -rhoE "var\(--(ink|line|bone|muted|gold|display|body|radius)\)" src/layouts/Admin.astro src/components/admin/*.css src/pages/login.astro src/pages/admin/index.astro
```
Expected: `0 errors`, all tests pass, build completes, and the grep prints NOTHING (admin surface fully decoupled from theme vars).

- [ ] **Step 2: Drive the offers loop** (dev server + real Supabase; requires Tyler linked)

Run `npm run dev`, sign in at `/login`, then on `/admin`:
1. In the Offers card, type a school name → results appear → click one → it's added to the list.
2. Click "School not listed?" → fill the manual fields → Add → the manual offer appears.
3. Use ↑/↓ to reorder; ✕ to remove one.
4. Save → status shows "Saved."
5. Open `/` → the College Offers section shows the offers in the new order; the typeahead-added one has its real logo/level, the manual one shows its monogram.

Expected: each step behaves as described.

- [ ] **Step 3: Security spot-check**

- Signed out: `curl -X POST https://…/api/profile/offers -H 'content-type: application/json' -d '{"offers":[]}'` → `401`; `curl https://…/api/schools?q=plum` → `401`.
- The `athlete-admin` anon-write RLS test still passes.

- [ ] **Step 4: Ship** (per Angelo's ship-it flow)

```bash
git push origin master
```
Deploy runs on push (Vercel); verify `/admin` loads the offers card and a saved offer shows on the live public site.

---

## Self-Review

**Spec coverage (for the offers + neutral-admin portion of the Phase 3c spec):**
- Neutral shared admin skin, no public-theme CSS in the admin surface → Task 1 (+ grep proof in Tasks 4/7). ✓
- Offers add via typeahead → Tasks 4 (endpoint) + 5 (island). ✓
- Offers manual fallback → Tasks 2 (validate) + 5 (island). ✓
- Offers remove + reorder → Tasks 2 (`moveOffer`) + 5. ✓
- Save `profile.offers` via dedicated route, authed + RLS → Tasks 3. ✓
- Normalize on save (schoolId → `{schoolId}`; manual keeps fields) → Task 2 (`validateOffers`). ✓
- No-layout-shift status line → Task 5 (reserved `.oe__status`). ✓
- Editors edit data only (theme-agnostic) → offers touch `profile.offers`, no theme coupling. ✓
- Photo, theme manifest → intentionally NOT here (Phase 3c-2 plan). ✓

**Placeholder scan:** no TBD/TODO; every code step carries complete code. ✓

**Type consistency:** `Offer`/`School` from `types.ts` used consistently; `validateOffers`/`moveOffer`/`saveOffers` signatures match across Tasks 2, 3, 5; the island POSTs `{ offers }` matching the route's `(body).offers` and `saveOffers`'s `offers` param; `getOwnedAthlete` reused from 3b. `School.logoUrl`/`location` are nullable in `types.ts` — the island coerces `?? undefined` / `?? ''` before building an `Offer`. ✓
