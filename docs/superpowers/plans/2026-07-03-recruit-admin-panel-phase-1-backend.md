# Recruit Admin Panel — Phase 1: Backend Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a secured Supabase backend holding Tyler's profile as one editable JSON record plus a shared FBS/FCS `schools` reference table, exposed through a tested TypeScript data-access layer.

**Architecture:** One cloud Supabase project (Postgres + Auth + Storage). Tyler's whole editable profile lives as a `jsonb` document on one `athletes` row (mirroring today's `site.ts` shape 1:1) plus a `card_visibility` map and a `photo_url`. A read-only `schools` table seeds every FBS + FCS program for the offer picker. Row-Level Security lets anyone *read* a profile (so the future SSR public site can fetch it) but only the owner *write* it. A small `src/lib` module wraps all queries so the rest of the app never touches Supabase directly.

**Tech Stack:** Supabase (Postgres 15, Auth, Storage), `@supabase/supabase-js` v2, Supabase CLI (migrations), Vitest (integration tests), TypeScript, Astro 4.x (existing).

## Global Constraints

- **Node:** use the version already running this Astro 4.x project; do not upgrade Astro in this phase.
- **Secrets:** the Supabase **service-role key** and project keys live only in `.env.local` (gitignored) and are NEVER committed or shipped to the browser. Only the **anon** key is safe for client/SSR read.
- **Integrity rule (from spec):** unverified fields carry `placeholder: true` and render as TBD downstream; the seed must preserve every `placeholder` flag exactly as it is in `site.ts`. Never invent data (no fabricated stats, no guessed contact info).
- **Data shape parity:** the `profile` JSON must be a faithful superset of the current `src/data/site.ts` exports so Phase 2 can swap the data source without changing component markup.
- **Single source of truth for types:** all record/profile/school types are defined once in `src/lib/types.ts` and imported everywhere.
- **Slug:** Tyler's athlete row uses `slug = 'tyler-baleno'`.

---

## Human prerequisites (Angelo does these — I cannot create accounts or enter credentials)

These are one-time account/credential steps. I'll guide, but you perform them:

- [ ] **P1: Create a Supabase account + project.** Go to supabase.com, sign in with GitHub, create a new project named `recruit-sites` (choose a region near Pittsburgh, e.g. `us-east-1`). Save the database password in your password manager.
- [ ] **P2: Copy the project keys.** In the project's **Settings → API**, copy the **Project URL**, the **anon public** key, and the **service_role** key. You'll paste them into `.env.local` in Task 1.
- [ ] **P3: Install the Supabase CLI.** In a terminal: `npm install -g supabase` (or use `npx supabase` per-command). Verify: `supabase --version` prints a version.

Tell me when P1–P3 are done and you have the three keys ready; the automatable tasks below start at Task 1.

---

### Task 1: Project wiring — deps, env, Supabase client factory

**Files:**
- Modify: `package.json` (add deps)
- Create: `.env.local` (gitignored — you paste keys)
- Modify: `.gitignore` (ensure `.env.local` ignored)
- Create: `.env.example` (committed template, no secrets)
- Create: `src/lib/supabase.ts`
- Create: `src/lib/types.ts`

**Interfaces:**
- Produces: `getPublicClient(): SupabaseClient` (anon key, read-only use) and `getServiceClient(): SupabaseClient` (service-role key, server-only writes/seeds) from `src/lib/supabase.ts`.
- Produces: the type surface in `src/lib/types.ts` (`Stat`, `Field`, `Offer`, `Game`, `AthleteProfile`, `CardVisibility`, `AthleteRecord`, `School`) consumed by every later task.

- [ ] **Step 1: Install dependencies**

Run:
```bash
npm install @supabase/supabase-js
npm install -D vitest dotenv
```
Expected: both complete; `@supabase/supabase-js` appears under `dependencies`, `vitest` and `dotenv` under `devDependencies`.

- [ ] **Step 2: Create `.env.example` (committed) and `.env.local` (secrets, gitignored)**

`.env.example`:
```
# Supabase — copy to .env.local and fill from Settings → API
PUBLIC_SUPABASE_URL=
PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```
Create `.env.local` with the same keys, pasting the real values from prerequisite P2. Confirm `.gitignore` contains a line `.env.local` (add it if missing).

- [ ] **Step 3: Write the types module**

Create `src/lib/types.ts`:
```ts
export interface Stat { label: string; value: string; unit?: string; placeholder?: boolean; }
export interface Field { value: string; placeholder?: boolean; }

export interface Offer {
  // Either a reference to a seeded school…
  schoolId?: string;
  // …or a manual fallback (school not in the FBS/FCS list):
  school?: string;
  short?: string;
  level?: string;
  location?: string;
  logoUrl?: string;
}

export interface Game { date: string; opp: string; home: boolean; conf: boolean; note?: string; }

export interface AthleteProfile {
  identity: {
    first: string; last: string; position: string; positionShort: string;
    jersey: string; gradYear: string; school: string; team: string; location: string;
  };
  headline: Stat[];
  measurables: Stat[];
  honors: string[];
  film: { hudlEmbed: string; hudlWatch: string; hudlProfile: string; title: string; };
  positions: { code: string; name: string; primary: boolean; }[];
  academics: { gpa: string; scale: string; testScore: Field; major: Field; };
  offers: Offer[];
  schedule: Game[];
  scheduleMeta: { season: string; kickoff: string; homeVenue: string; };
  contact: {
    athlete: { name: string; phone: string; twitter: string; twitterUrl: string; };
    coach: { name: string; title: string; contact: string; placeholder: boolean; };
    hudl: string;
  };
}

export interface CardVisibility {
  film: boolean; offers: boolean; athletics: boolean; positions: boolean;
  academics: boolean; schedule: boolean; contact: boolean;
}

export interface AthleteRecord {
  id: string;
  slug: string;
  profile: AthleteProfile;
  cardVisibility: CardVisibility;
  photoUrl: string | null;
}

export interface School {
  id: string; name: string; short: string;
  level: 'FBS' | 'FCS'; conference: string | null;
  location: string | null; logoUrl: string | null;
}
```

- [ ] **Step 4: Write the client factory**

Create `src/lib/supabase.ts`:
```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.PUBLIC_SUPABASE_URL as string;
const anon = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string;

/** Anon, read-only client. Safe for SSR/public reads. */
export function getPublicClient(): SupabaseClient {
  if (!url || !anon) throw new Error('Missing PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY');
  return createClient(url, anon, { auth: { persistSession: false } });
}

/** Service-role client. SERVER ONLY — never import into browser code. */
export function getServiceClient(): SupabaseClient {
  const service = import.meta.env.SUPABASE_SERVICE_ROLE_KEY as string;
  if (!url || !service) throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, service, { auth: { persistSession: false } });
}
```

- [ ] **Step 5: Verify it compiles**

Run: `npx astro check`
Expected: no type errors from `src/lib/*`. (Pre-existing warnings elsewhere are fine.)

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example src/lib/supabase.ts src/lib/types.ts
git commit -m "feat(backend): supabase client factory + shared types"
```

---

### Task 2: Database schema migration (`athletes` + `schools`)

**Files:**
- Create: `supabase/migrations/0001_init.sql`

**Interfaces:**
- Produces: tables `public.athletes` and `public.schools` with the columns Task 4/5/6 query.

- [ ] **Step 1: Initialize Supabase config and link the project**

Run:
```bash
supabase init
supabase link --project-ref <your-project-ref>
```
(`<your-project-ref>` is in the Supabase dashboard URL / Settings → General.) Expected: `supabase/config.toml` created; link succeeds.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/0001_init.sql`:
```sql
-- trigram extension powers the schools name search index (must precede the index)
create extension if not exists pg_trgm;

-- athletes: one editable profile per recruit, stored as a JSON document
create table public.athletes (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid references auth.users(id) on delete set null,
  slug            text unique not null,
  profile         jsonb not null default '{}'::jsonb,
  card_visibility jsonb not null default
    '{"film":true,"offers":true,"athletics":true,"positions":true,"academics":true,"schedule":true,"contact":true}'::jsonb,
  photo_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- schools: shared, read-only FBS/FCS reference for the offer picker
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short       text not null,
  level       text not null check (level in ('FBS','FCS')),
  conference  text,
  location    text,
  logo_url    text
);
create index schools_name_trgm on public.schools using gin (name gin_trgm_ops);
```

- [ ] **Step 3: Apply the migration to the linked project**

Run: `supabase db push`
Expected: migration `0001_init` applied; no errors.

- [ ] **Step 4: Verify the tables exist**

Run:
```bash
supabase db execute "select table_name from information_schema.tables where table_schema='public' and table_name in ('athletes','schools') order by table_name;"
```
Expected: two rows — `athletes`, `schools`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0001_init.sql supabase/config.toml
git commit -m "feat(backend): athletes + schools schema migration"
```

---

### Task 3: Row-Level Security policies

**Files:**
- Create: `supabase/migrations/0002_rls.sql`

**Interfaces:**
- Produces: RLS such that anon can `select` both tables; only `owner_user_id = auth.uid()` can `update` an athletes row. Task 8 tests this behavior.

- [ ] **Step 1: Write the RLS migration**

Create `supabase/migrations/0002_rls.sql`:
```sql
alter table public.athletes enable row level security;
alter table public.schools  enable row level security;

-- Public read of any profile (SSR public site uses the anon key)
create policy athletes_public_read on public.athletes
  for select using (true);

-- Owner may update only their own row
create policy athletes_owner_update on public.athletes
  for update using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Public read of schools; no client writes (writes go through service role only)
create policy schools_public_read on public.schools
  for select using (true);
```

- [ ] **Step 2: Apply**

Run: `supabase db push`
Expected: `0002_rls` applied.

- [ ] **Step 3: Verify RLS is on**

Run:
```bash
supabase db execute "select relname, relrowsecurity from pg_class where relname in ('athletes','schools');"
```
Expected: both rows show `relrowsecurity = t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0002_rls.sql
git commit -m "feat(backend): row-level security policies"
```

---

### Task 4: Seed the schools reference (FBS + FCS)

**Files:**
- Create: `scripts/build-schools.mjs` (fetch/normalize source → `scripts/schools.json`)
- Create: `scripts/schools.json` (committed dataset)
- Create: `scripts/seed-schools.mjs` (insert into Supabase)

**Interfaces:**
- Produces: ~260 rows in `public.schools`, each with `name, short, level, conference, location, logo_url`. Task 6 (`searchSchools`) queries these.

**Sourcing note:** use the free **CollegeFootballData API** (collegefootballdata.com — register for a free API key) `GET /teams/fbs` and `GET /teams/fcs`, which return `school`, `abbreviation`, `conference`, `location`, and `logos[]`. This is factual reference data (school + logo shown against a real offer); acceptable use. If the API key is a blocker, a static hand-built `schools.json` is an acceptable fallback — the seed script only depends on the JSON shape below.

- [ ] **Step 1: Build the dataset**

Create `scripts/build-schools.mjs`:
```js
// Fetches FBS + FCS teams from CollegeFootballData and writes scripts/schools.json.
// Usage: CFBD_KEY=xxxx node scripts/build-schools.mjs
import { writeFileSync } from 'node:fs';

const KEY = process.env.CFBD_KEY;
if (!KEY) throw new Error('Set CFBD_KEY (free key from collegefootballdata.com)');
const headers = { Authorization: `Bearer ${KEY}` };

async function fetchDivision(div) {
  const res = await fetch(`https://api.collegefootballdata.com/teams/${div}`, { headers });
  if (!res.ok) throw new Error(`${div}: ${res.status}`);
  const teams = await res.json();
  return teams.map((t) => ({
    name: t.school,
    short: t.abbreviation || t.school.slice(0, 4).toUpperCase(),
    level: div.toUpperCase(),                 // 'FBS' | 'FCS'
    conference: t.conference ?? null,
    location: t.location?.city && t.location?.state
      ? `${t.location.city}, ${t.location.state}` : null,
    logoUrl: Array.isArray(t.logos) && t.logos.length ? t.logos[0] : null,
  }));
}

const all = [...(await fetchDivision('fbs')), ...(await fetchDivision('fcs'))];
writeFileSync(new URL('./schools.json', import.meta.url), JSON.stringify(all, null, 2));
console.log(`Wrote ${all.length} schools`);
```
Run: `CFBD_KEY=<your-key> node scripts/build-schools.mjs`
Expected: prints `Wrote ~260 schools`; `scripts/schools.json` created.

- [ ] **Step 2: Write the seed script**

Create `scripts/seed-schools.mjs`:
```js
// Inserts scripts/schools.json into public.schools (idempotent: clears then inserts).
// Usage: node scripts/seed-schools.mjs   (reads .env.local)
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const rows = JSON.parse(readFileSync(new URL('./schools.json', import.meta.url)))
  .map((s) => ({
    name: s.name, short: s.short, level: s.level,
    conference: s.conference, location: s.location, logo_url: s.logoUrl,
  }));

await db.from('schools').delete().neq('id', '00000000-0000-0000-0000-000000000000');
const { error, count } = await db.from('schools').insert(rows, { count: 'exact' });
if (error) throw error;
console.log(`Seeded ${count} schools`);
```
(Requires `dotenv`; loaded via `import 'dotenv/config'` reading `.env.local` — run with `node --env-file=.env.local scripts/seed-schools.mjs` on Node ≥20, or ensure dotenv picks up `.env.local` by copying to `.env`.)

- [ ] **Step 3: Run the seed**

Run: `node --env-file=.env.local scripts/seed-schools.mjs`
Expected: prints `Seeded ~260 schools`.

- [ ] **Step 4: Verify Robert Morris is present (Tyler's real offer)**

Run:
```bash
supabase db execute "select name, short, level, location from public.schools where name ilike '%robert morris%';"
```
Expected: one row — Robert Morris, level `FCS`, location around `Moon Township, PA` (or `Pittsburgh, PA`).

- [ ] **Step 5: Commit**

```bash
git add scripts/build-schools.mjs scripts/schools.json scripts/seed-schools.mjs
git commit -m "feat(backend): FBS/FCS schools dataset + seed"
```

---

### Task 5: Migrate Tyler's profile into an `athletes` row

**Files:**
- Create: `scripts/seed-tyler.mjs`

**Interfaces:**
- Consumes: the shape of `src/data/site.ts`.
- Produces: one `athletes` row, `slug = 'tyler-baleno'`, `profile` = the full current site content, `card_visibility` all true, `photo_url` = existing hero path for now (`/images/tyler-hero.jpg`; moved to Storage in Phase 3).

- [ ] **Step 1: Write the migration seed**

Create `scripts/seed-tyler.mjs`. Build the `profile` object by copying the exact values from `src/data/site.ts` (do not paraphrase — preserve every `placeholder: true`). Offers reference the seeded school by id when found, else fall back to manual fields:
```js
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const db = createClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Resolve RMU to a school id if seeded (offer picker parity).
const { data: rmu } = await db.from('schools').select('id')
  .ilike('name', '%robert morris%').maybeSingle();

const profile = {
  identity: {
    first: 'Tyler', last: 'Baleno', position: 'Defensive Back', positionShort: 'DB',
    jersey: '3', gradYear: '2027', school: 'Plum Senior High School',
    team: 'Plum Mustangs', location: 'Pittsburgh, PA',
  },
  headline: [
    { label: 'Height', value: `6'2"` },
    { label: 'Weight', value: '195', unit: 'lbs' },
    { label: '40 Yard', value: '4.44', unit: 'sec' },
    { label: 'GPA', value: '4.0' },
  ],
  measurables: [
    { label: 'Height', value: `6'2"` },
    { label: 'Weight · lbs', value: '195' },
    { label: '40-Yard Dash', value: '4.44s' },
    { label: 'Shuttle', value: '—', placeholder: true },
    { label: 'Vertical', value: '—', placeholder: true },
    { label: 'Bench', value: '—', placeholder: true },
  ],
  honors: [
    '1st Team All-Conference — Defensive Back',
    '2× All-Conference Selection',
  ],
  film: {
    hudlEmbed: 'https://www.hudl.com/embed/video/3/19760495/68fac2deea707630a706ad8c',
    hudlWatch: 'https://www.hudl.com/v/2T3jkn',
    hudlProfile: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
    title: 'Junior Season Highlights',
  },
  positions: [
    { code: 'DB', name: 'Defensive Back', primary: true },
    { code: 'LB', name: 'Linebacker', primary: false },
    { code: 'WR', name: 'Wide Receiver', primary: false },
    { code: 'TE', name: 'Tight End', primary: false },
  ],
  academics: {
    gpa: '4.0', scale: '4.0 scale',
    testScore: { value: 'Available on request', placeholder: true },
    major: { value: 'To be determined', placeholder: true },
  },
  offers: [
    rmu
      ? { schoolId: rmu.id }
      : { school: 'Robert Morris University', short: 'RMU', level: 'NCAA Division I · FCS', location: 'Moon Township, PA' },
  ],
  scheduleMeta: { season: '2026 · Senior Season', kickoff: '7:00 PM', homeVenue: 'Plum HS · 900 Elicker Rd, Pittsburgh' },
  schedule: [
    { date: 'Sep 4',  opp: 'Franklin Regional', home: false, conf: false },
    { date: 'Sep 11', opp: 'Fox Chapel',        home: false, conf: true  },
    { date: 'Sep 18', opp: 'Shaler Area',       home: true,  conf: true  },
    { date: 'Sep 25', opp: 'Kiski Area',        home: true,  conf: false },
    { date: 'Oct 2',  opp: 'Armstrong',         home: true,  conf: true  },
    { date: 'Oct 9',  opp: 'Moon Area',         home: true,  conf: false },
    { date: 'Oct 16', opp: 'North Hills',       home: false, conf: true  },
    { date: 'Oct 23', opp: 'Penn Hills',        home: false, conf: true  },
    { date: 'Oct 30', opp: 'Pine-Richland',     home: true,  conf: true  },
  ],
  contact: {
    athlete: { name: 'Tyler Baleno', phone: '412-995-0045', twitter: '@TylerBaleno3', twitterUrl: 'https://x.com/TylerBaleno3' },
    coach: { name: 'Matt Morgan', title: 'Head Coach · Plum Mustangs Football', contact: 'Available on request', placeholder: false },
    hudl: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
  },
};

const { error } = await db.from('athletes').upsert({
  slug: 'tyler-baleno',
  profile,
  photo_url: '/images/tyler-hero.jpg',
}, { onConflict: 'slug' });
if (error) throw error;
console.log('Seeded tyler-baleno');
```

- [ ] **Step 2: Run it**

Run: `node --env-file=.env.local scripts/seed-tyler.mjs`
Expected: prints `Seeded tyler-baleno`.

- [ ] **Step 3: Verify the row round-trips**

Run:
```bash
supabase db execute "select slug, profile->'identity'->>'last' as last, jsonb_array_length(profile->'schedule') as games from public.athletes where slug='tyler-baleno';"
```
Expected: `tyler-baleno | Baleno | 9`.

- [ ] **Step 4: Commit**

```bash
git add scripts/seed-tyler.mjs
git commit -m "feat(backend): seed Tyler's profile record"
```

---

### Task 6: Data-access layer — `getAthleteBySlug`, `searchSchools`, `resolveOffers`

**Files:**
- Create: `src/lib/athlete.ts`
- Create: `src/lib/schools.ts`
- Test: `tests/lib/athlete.test.ts`
- Test: `tests/lib/schools.test.ts`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces:
  - `getAthleteBySlug(slug: string): Promise<AthleteRecord | null>` (`src/lib/athlete.ts`)
  - `resolveOffers(offers: Offer[]): Promise<Offer[]>` — replaces `{schoolId}` offers with fully-populated `{school, short, level, location, logoUrl}` from `schools` (`src/lib/athlete.ts`)
  - `searchSchools(query: string, limit?: number): Promise<School[]>` (`src/lib/schools.ts`)
- Consumes: `getPublicClient` (Task 1), the seeded rows (Tasks 4–5).

- [ ] **Step 1: Configure Vitest to load `.env.local`**

Create `vitest.config.ts` (loads `.env.local` into `process.env` at config time via dotenv):
```ts
import { defineConfig } from 'vitest/config';
import { config } from 'dotenv';
config({ path: '.env.local' });

export default defineConfig({
  test: { environment: 'node' },
});
```
Add to `package.json` scripts: `"test": "vitest run"`. Because dotenv populates `process.env`, the client factory's `process.env` fallback (Step 2) resolves the keys under Vitest.

- [ ] **Step 2: Make the client factory test-friendly**

In `src/lib/supabase.ts`, change the three `import.meta.env.X` reads to `` (import.meta.env.X ?? process.env.X) `` so both Astro (SSR) and Vitest (Node) resolve keys. Example:
```ts
const url = (import.meta.env.PUBLIC_SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL) as string;
const anon = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY ?? process.env.PUBLIC_SUPABASE_ANON_KEY) as string;
```
(and likewise for the service key inside `getServiceClient`).

- [ ] **Step 3: Write failing tests for `searchSchools`**

Create `tests/lib/schools.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { searchSchools } from '../../src/lib/schools';

describe('searchSchools', () => {
  it('finds Robert Morris by partial name', async () => {
    const results = await searchSchools('robert morris');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toMatch(/robert morris/i);
    expect(results[0].level).toBe('FCS');
  });

  it('returns [] for gibberish', async () => {
    expect(await searchSchools('zzzzznotaschool')).toEqual([]);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npm test -- schools`
Expected: FAIL — `searchSchools` not found / module missing.

- [ ] **Step 5: Implement `searchSchools`**

Create `src/lib/schools.ts`:
```ts
import { getPublicClient } from './supabase';
import type { School } from './types';

export async function searchSchools(query: string, limit = 8): Promise<School[]> {
  const q = query.trim();
  if (!q) return [];
  const { data, error } = await getPublicClient()
    .from('schools')
    .select('id,name,short,level,conference,location,logo_url')
    .ilike('name', `%${q}%`)
    .order('name')
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((r) => ({
    id: r.id, name: r.name, short: r.short, level: r.level as 'FBS' | 'FCS',
    conference: r.conference, location: r.location, logoUrl: r.logo_url,
  }));
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm test -- schools`
Expected: PASS (both).

- [ ] **Step 7: Write failing tests for `getAthleteBySlug` + `resolveOffers`**

Create `tests/lib/athlete.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getAthleteBySlug, resolveOffers } from '../../src/lib/athlete';

describe('getAthleteBySlug', () => {
  it('returns Tyler with a 9-game schedule and preserved placeholders', async () => {
    const rec = await getAthleteBySlug('tyler-baleno');
    expect(rec).not.toBeNull();
    expect(rec!.profile.identity.last).toBe('Baleno');
    expect(rec!.profile.schedule).toHaveLength(9);
    const shuttle = rec!.profile.measurables.find((m) => m.label === 'Shuttle');
    expect(shuttle?.placeholder).toBe(true);
    expect(rec!.cardVisibility.academics).toBe(true);
  });

  it('returns null for an unknown slug', async () => {
    expect(await getAthleteBySlug('nobody')).toBeNull();
  });
});

describe('resolveOffers', () => {
  it('expands a {schoolId} offer into full school fields', async () => {
    const rec = await getAthleteBySlug('tyler-baleno');
    const resolved = await resolveOffers(rec!.profile.offers);
    expect(resolved[0].school).toMatch(/robert morris/i);
    expect(resolved[0].level).toBeTruthy();
  });
});
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `npm test -- athlete`
Expected: FAIL — module/functions missing.

- [ ] **Step 9: Implement `getAthleteBySlug` + `resolveOffers`**

Create `src/lib/athlete.ts`:
```ts
import { getPublicClient } from './supabase';
import type { AthleteRecord, Offer, School } from './types';

export async function getAthleteBySlug(slug: string): Promise<AthleteRecord | null> {
  const { data, error } = await getPublicClient()
    .from('athletes')
    .select('id,slug,profile,card_visibility,photo_url')
    .eq('slug', slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, slug: data.slug,
    profile: data.profile, cardVisibility: data.card_visibility, photoUrl: data.photo_url,
  };
}

export async function resolveOffers(offers: Offer[]): Promise<Offer[]> {
  const ids = offers.map((o) => o.schoolId).filter(Boolean) as string[];
  let byId = new Map<string, School>();
  if (ids.length) {
    const { data, error } = await getPublicClient()
      .from('schools').select('id,name,short,level,conference,location,logo_url').in('id', ids);
    if (error) throw error;
    byId = new Map((data ?? []).map((r) => [r.id, {
      id: r.id, name: r.name, short: r.short, level: r.level as 'FBS' | 'FCS',
      conference: r.conference, location: r.location, logoUrl: r.logo_url,
    }]));
  }
  return offers.map((o) => {
    if (o.schoolId && byId.has(o.schoolId)) {
      const s = byId.get(o.schoolId)!;
      return { schoolId: o.schoolId, school: s.name, short: s.short, level: s.level, location: s.location ?? undefined, logoUrl: s.logoUrl ?? undefined };
    }
    return o; // manual fallback passes through
  });
}
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npm test -- athlete`
Expected: PASS (all three).

- [ ] **Step 11: Commit**

```bash
git add vitest.config.ts package.json src/lib/supabase.ts src/lib/schools.ts src/lib/athlete.ts tests/lib/schools.test.ts tests/lib/athlete.test.ts
git commit -m "feat(backend): tested data-access layer (athlete + schools)"
```

---

### Task 7: Storage bucket for profile photos

**Files:**
- Create: `supabase/migrations/0003_storage.sql`

**Interfaces:**
- Produces: a public-read `profile-photos` bucket that Phase 3's upload/cropper writes into.

- [ ] **Step 1: Write the storage migration**

Create `supabase/migrations/0003_storage.sql`:
```sql
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- Public read
create policy "profile photos public read" on storage.objects
  for select using (bucket_id = 'profile-photos');

-- Authenticated write (tightened to per-owner folders in Phase 3)
create policy "profile photos auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'profile-photos');
```

- [ ] **Step 2: Apply**

Run: `supabase db push`
Expected: `0003_storage` applied.

- [ ] **Step 3: Verify the bucket exists**

Run: `supabase db execute "select id, public from storage.buckets where id='profile-photos';"`
Expected: one row, `public = t`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_storage.sql
git commit -m "feat(backend): profile-photos storage bucket"
```

---

### Task 8: Security smoke test — anon can read, cannot write

**Files:**
- Test: `tests/lib/rls.test.ts`

**Interfaces:**
- Consumes: `getPublicClient` (anon). Verifies the Task 3 policies behave.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/rls.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { getPublicClient } from '../../src/lib/supabase';

describe('RLS', () => {
  it('anon can read an athlete profile', async () => {
    const { data, error } = await getPublicClient()
      .from('athletes').select('slug').eq('slug', 'tyler-baleno').maybeSingle();
    expect(error).toBeNull();
    expect(data?.slug).toBe('tyler-baleno');
  });

  it('anon CANNOT update an athlete profile', async () => {
    const { data, error } = await getPublicClient()
      .from('athletes').update({ slug: 'hacked' }).eq('slug', 'tyler-baleno').select();
    // RLS blocks the row: either an error, or zero rows affected.
    expect(error !== null || (data?.length ?? 0) === 0).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify the read passes and write is blocked**

Run: `npm test -- rls`
Expected: PASS — anon read works; anon update affects 0 rows (blocked).

- [ ] **Step 3: Confirm the row was not mutated**

Run: `supabase db execute "select slug from public.athletes where slug='hacked';"`
Expected: 0 rows.

- [ ] **Step 4: Commit**

```bash
git add tests/lib/rls.test.ts
git commit -m "test(backend): RLS read-allowed / write-blocked smoke test"
```

---

## Phase 1 done-when

- `npm test` passes (schools, athlete, RLS suites).
- Supabase has: `athletes` (Tyler's row), `schools` (~260 rows incl. RMU), `profile-photos` bucket, RLS on.
- `src/lib/{supabase,types,athlete,schools}.ts` is the only surface the rest of the app will use.

---

## Roadmap: Phases 2 & 3 (full task detail written when we reach each)

**Phase 2 — Public site on live data + Vercel** (`…-phase-2-public.md`)
- Add `@astrojs/vercel` adapter; set Astro `output: 'hybrid'`; move hosting from GitHub Pages to Vercel; set env vars in Vercel.
- Refactor `src/pages/index.astro` to `getAthleteBySlug('tyler-baleno')` + `resolveOffers(...)` in frontmatter and pass `profile` / `cardVisibility` as props into the existing components (Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact).
- Gate each section on `cardVisibility[…]` in addition to the existing empty-data checks.
- Delete `src/data/site.ts` once parity is confirmed (or keep as a typed fixture for tests).
- Acceptance: the deployed Vercel site is visually identical to today, now rendering from Supabase; toggling a `card_visibility` flag in the DB hides that section on reload.

**Phase 3 — Admin panel** (`…-phase-3-admin.md`)
- Add a client island framework for the interactive editors (decision at Phase 3 start: Svelte vs Preact vs React) + Astro middleware session guard.
- Auth: Supabase email/password login page; you provision Tyler's account; link `owner_user_id` to his athletes row.
- Astro API routes: `POST /api/profile/:section` (owner-only update), `GET /api/schools?q=`, `POST /api/photo` (upload to Storage + crop-to-4:5 result URL).
- Editor UI: one form per section; the card-visibility toggle panel; the offer typeahead (uses `searchSchools`) + manual fallback; the photo uploader/cropper.
- Tighten Storage write policy to per-owner folders; scope profile-update RLS by owner.
- Acceptance (the end-to-end loop, Playwright): Tyler logs in → edits 40 time → toggles Academics off → uploads a cropped photo → public site reflects all three; unauthenticated visitor is redirected from `/admin`; Tyler cannot edit another record.
