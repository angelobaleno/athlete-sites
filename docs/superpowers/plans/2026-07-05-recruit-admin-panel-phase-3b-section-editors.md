# Recruit Admin Panel — Phase 3b: Section Editors — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Tyler edit his site's value fields (identity, stat rail, measurables, academics, film links, contact) from the protected `/admin` dashboard, saving each section independently, reflected live on the public SSR site.

**Architecture:** A pure section registry (`profile-sections.ts`) is the single source of truth for which fields each section exposes, their paths into the profile JSON, and validation/placeholder rules. The dashboard flattens the owner's profile into per-field views and renders one generic Preact editor island per section. Each island POSTs its section's values to `/api/profile/[section]`, which (authed via existing middleware, RLS-guarded) validates, derives placeholder flags from emptiness, writes the values back into the profile JSON, and updates the row. Public components render a `—` placeholder label when a placeholder field is empty.

**Tech Stack:** Astro 4.x (`output: 'server'`, Vercel adapter) · `@supabase/ssr` authed client on `context.locals` · Preact islands · Vitest · TypeScript.

## Global Constraints

- **Node/Astro:** use the versions already in this project; do not upgrade Astro. (Astro 4.x, Node 20 pin in `package.json`.)
- **Secrets:** only the anon key path is used. Writes go through the per-request authed client on `context.locals.supabase`; the `SUPABASE_SERVICE_ROLE_KEY` is NEVER used in the request path.
- **RLS is the security boundary:** an authed user may update only their own `athletes` row (`auth.uid() = owner_user_id`, policy `athletes_owner_update` in `supabase/migrations/0002_rls.sql`). Never bypass it with the service client.
- **Integrity rule — blank = placeholder:** on save, a `Stat`/`Field` value that is empty/whitespace sets its `placeholder` flag `true`; a non-empty value sets it `false`. No field is ever fabricated. Public components show a `—` label when a placeholder field is empty.
- **No layout shift:** editor forms are always-editable (no view→edit toggle); inline status/error text occupies space that is always reserved.
- **Per-section save:** each section saves independently; there is no global save.
- **Types single source:** reuse `src/lib/types.ts` (`AthleteProfile`, `Stat`, `Field`, `AthleteRecord`). Add new admin-only types in `src/lib/profile-sections.ts`.
- **Scope:** value fields only. NO list editors (`honors`/`schedule`/`positions`), NO `offers`/school picker, NO visibility toggles, NO photo upload.
- **Slug:** Tyler's row is `slug = 'tyler-baleno'`; the dashboard loads by owner (`owner_user_id = auth.uid()`), not by slug.

---

## File Structure

- **Create** `src/lib/profile-sections.ts` — section registry + pure path/flatten/apply helpers (the heart; fully unit-tested).
- **Create** `src/lib/display.ts` — `phValue(value, placeholder)` display helper for public components.
- **Create** `src/lib/athlete-admin.ts` — owner data-access: `getOwnedAthlete`, `saveProfileSection` (authed client, RLS-guarded).
- **Create** `src/pages/api/profile/[section].ts` — POST endpoint: authed, validate → apply → save.
- **Create** `src/components/admin/SectionEditor.tsx` — generic per-section editor island.
- **Create** `src/components/admin/SectionEditor.css` — island styles (on-brand, space reserved for status).
- **Modify** `src/pages/admin/index.astro` — load owned athlete, render an editor per in-scope section, "View my site" link.
- **Modify** `src/themes/tyler/Athletics.astro`, `Academics.astro`, `Contact.astro`, `Hero.astro` — use `phValue` so empty placeholder fields show `—`.
- **Create** tests: `tests/lib/profile-sections.test.ts`, `tests/lib/display.test.ts`, `tests/lib/athlete-admin.test.ts` (env-gated integration).

---

### Task 1: Section registry + field-flattening (pure)

**Files:**
- Create: `src/lib/profile-sections.ts`
- Test: `tests/lib/profile-sections.test.ts`

**Interfaces:**
- Produces:
  - `type SectionKey = 'identity' | 'headline' | 'measurables' | 'academics' | 'film' | 'contact'`
  - `interface FieldDef { name: string; path: string; label: string; kind: 'text' | 'url'; required?: boolean; placeholderPath?: string }`
  - `interface SectionDef { key: SectionKey; title: string; kind: 'object' | 'stats' }`
  - `const SECTIONS: SectionDef[]`
  - `getPath(obj: unknown, path: string): string` — read a dot/index path, returns `''` if missing.
  - `setPath<T>(obj: T, path: string, value: string): T` — return a deep-cloned copy with the path set.
  - `resolveFields(def: SectionDef, sectionData: unknown): FieldDef[]` — object sections return their static fields; stats sections derive one field per array row.
  - `interface FieldView { name: string; label: string; kind: 'text' | 'url'; value: string; required: boolean }`
  - `sectionFieldViews(def: SectionDef, sectionData: unknown): FieldView[]`

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/profile-sections.test.ts
import { describe, it, expect } from 'vitest';
import {
  SECTIONS, getPath, setPath, resolveFields, sectionFieldViews,
} from '../../src/lib/profile-sections';

describe('getPath / setPath', () => {
  it('reads nested and indexed paths, missing → empty string', () => {
    const o = { coach: { contact: 'on request' }, stats: [{ value: '4.4' }] };
    expect(getPath(o, 'coach.contact')).toBe('on request');
    expect(getPath(o, 'stats.0.value')).toBe('4.4');
    expect(getPath(o, 'coach.missing')).toBe('');
  });
  it('setPath returns a new object with the value set, original untouched', () => {
    const o = { coach: { contact: 'x' } };
    const n = setPath(o, 'coach.contact', 'y');
    expect(n).toEqual({ coach: { contact: 'y' } });
    expect(o.coach.contact).toBe('x'); // original unmutated
  });
});

describe('SECTIONS registry', () => {
  it('covers exactly the six in-scope sections', () => {
    expect(SECTIONS.map((s) => s.key)).toEqual(
      ['identity', 'headline', 'measurables', 'academics', 'film', 'contact'],
    );
  });
  it('identity requires first, last, position', () => {
    const identity = SECTIONS.find((s) => s.key === 'identity')!;
    const req = resolveFields(identity, {}).filter((f) => f.required).map((f) => f.name);
    expect(req).toEqual(['first', 'last', 'position']);
  });
});

describe('resolveFields (stats sections)', () => {
  it('derives one field per stat row, labelled by the row', () => {
    const measurables = SECTIONS.find((s) => s.key === 'measurables')!;
    const data = [{ label: 'Shuttle', value: '' }, { label: 'Vertical', value: '38"' }];
    const fields = resolveFields(measurables, data);
    expect(fields.map((f) => f.label)).toEqual(['Shuttle', 'Vertical']);
    expect(fields[0].path).toBe('0.value');
    expect(fields[0].placeholderPath).toBe('0.placeholder');
  });
});

describe('sectionFieldViews', () => {
  it('flattens current values for rendering (nested + placeholder-capable)', () => {
    const academics = SECTIONS.find((s) => s.key === 'academics')!;
    const data = { gpa: '4.0', scale: '4.0',
      testScore: { value: '', placeholder: true }, major: { value: 'Undecided', placeholder: false } };
    const views = sectionFieldViews(academics, data);
    const byName = Object.fromEntries(views.map((v) => [v.name, v.value]));
    expect(byName.gpa).toBe('4.0');
    expect(byName['testScore']).toBe('');
    expect(byName['major']).toBe('Undecided');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/profile-sections.test.ts`
Expected: FAIL — cannot find module `../../src/lib/profile-sections`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/profile-sections.ts
export type SectionKey =
  | 'identity' | 'headline' | 'measurables' | 'academics' | 'film' | 'contact';

export interface FieldDef {
  name: string;              // unique within section; also the form key
  path: string;              // dot/index path to the string value within the section object
  label: string;
  kind: 'text' | 'url';
  required?: boolean;
  placeholderPath?: string;  // path to a boolean derived from value emptiness
}

export interface SectionDef {
  key: SectionKey;
  title: string;
  kind: 'object' | 'stats';  // 'object' = static fields below; 'stats' = Stat[] (fields per row)
  fields?: FieldDef[];
}

export const SECTIONS: SectionDef[] = [
  {
    key: 'identity', title: 'Identity', kind: 'object',
    fields: [
      { name: 'first', path: 'first', label: 'First name', kind: 'text', required: true },
      { name: 'last', path: 'last', label: 'Last name', kind: 'text', required: true },
      { name: 'position', path: 'position', label: 'Position', kind: 'text', required: true },
      { name: 'positionShort', path: 'positionShort', label: 'Position (short)', kind: 'text' },
      { name: 'jersey', path: 'jersey', label: 'Jersey #', kind: 'text' },
      { name: 'gradYear', path: 'gradYear', label: 'Grad year', kind: 'text' },
      { name: 'school', path: 'school', label: 'School', kind: 'text' },
      { name: 'team', path: 'team', label: 'Team', kind: 'text' },
      { name: 'location', path: 'location', label: 'Location', kind: 'text' },
    ],
  },
  { key: 'headline', title: 'Stat Rail', kind: 'stats' },
  { key: 'measurables', title: 'Measurables', kind: 'stats' },
  {
    key: 'academics', title: 'Academics', kind: 'object',
    fields: [
      { name: 'gpa', path: 'gpa', label: 'GPA', kind: 'text' },
      { name: 'scale', path: 'scale', label: 'GPA scale', kind: 'text' },
      { name: 'testScore', path: 'testScore.value', label: 'Test score', kind: 'text', placeholderPath: 'testScore.placeholder' },
      { name: 'major', path: 'major.value', label: 'Intended major', kind: 'text', placeholderPath: 'major.placeholder' },
    ],
  },
  {
    key: 'film', title: 'Film', kind: 'object',
    fields: [
      { name: 'title', path: 'title', label: 'Film title', kind: 'text' },
      { name: 'hudlEmbed', path: 'hudlEmbed', label: 'Hudl embed URL', kind: 'url' },
      { name: 'hudlWatch', path: 'hudlWatch', label: 'Hudl watch URL', kind: 'url' },
      { name: 'hudlProfile', path: 'hudlProfile', label: 'Hudl profile URL', kind: 'url' },
    ],
  },
  {
    key: 'contact', title: 'Contact', kind: 'object',
    fields: [
      { name: 'athlete.name', path: 'athlete.name', label: 'Your name', kind: 'text' },
      { name: 'athlete.phone', path: 'athlete.phone', label: 'Phone', kind: 'text' },
      { name: 'athlete.twitter', path: 'athlete.twitter', label: 'X/Twitter handle', kind: 'text' },
      { name: 'athlete.twitterUrl', path: 'athlete.twitterUrl', label: 'X/Twitter URL', kind: 'url' },
      { name: 'coach.name', path: 'coach.name', label: 'Coach name', kind: 'text' },
      { name: 'coach.title', path: 'coach.title', label: 'Coach title', kind: 'text' },
      { name: 'coach.contact', path: 'coach.contact', label: 'Coach contact', kind: 'text', placeholderPath: 'coach.placeholder' },
      { name: 'hudl', path: 'hudl', label: 'Hudl profile link', kind: 'url' },
    ],
  },
];

const segs = (path: string): string[] => path.split('.');

export function getPath(obj: unknown, path: string): string {
  let cur: unknown = obj;
  for (const s of segs(path)) {
    if (cur == null || typeof cur !== 'object') return '';
    cur = (cur as Record<string, unknown>)[s];
  }
  return cur == null ? '' : String(cur);
}

export function setPath<T>(obj: T, path: string, value: string): T {
  const clone: unknown = Array.isArray(obj) ? [...(obj as unknown[])] : { ...(obj as object) };
  const parts = segs(path);
  let cur = clone as Record<string, unknown>;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const child = cur[key];
    cur[key] = Array.isArray(child) ? [...child] : { ...(child as object) };
    cur = cur[key] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return clone as T;
}

export function resolveFields(def: SectionDef, sectionData: unknown): FieldDef[] {
  if (def.kind === 'object') return def.fields ?? [];
  // stats: one field per array row, labelled by the row's label
  const rows = Array.isArray(sectionData) ? (sectionData as { label?: string }[]) : [];
  return rows.map((row, i) => ({
    name: String(i),
    path: `${i}.value`,
    label: row.label ?? `Stat ${i + 1}`,
    kind: 'text' as const,
    placeholderPath: `${i}.placeholder`,
  }));
}

export interface FieldView {
  name: string; label: string; kind: 'text' | 'url'; value: string; required: boolean;
}

export function sectionFieldViews(def: SectionDef, sectionData: unknown): FieldView[] {
  return resolveFields(def, sectionData).map((f) => ({
    name: f.name, label: f.label, kind: f.kind,
    value: getPath(sectionData, f.path), required: !!f.required,
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/profile-sections.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-sections.ts tests/lib/profile-sections.test.ts
git commit -m "feat(admin): section registry + pure field-flattening for editors"
```

---

### Task 2: Apply values back — validate + write + derive placeholders (pure)

**Files:**
- Modify: `src/lib/profile-sections.ts`
- Test: `tests/lib/profile-sections.test.ts` (add cases)

**Interfaces:**
- Consumes: `SECTIONS`, `FieldDef`, `resolveFields`, `getPath`, `setPath` (Task 1).
- Produces:
  - `function applySectionValues(def: SectionDef, sectionData: unknown, values: Record<string, string>): { data: unknown } | { error: string }`
    - Validates: every `required` field must be non-empty; every `url` field with a non-empty value must look like a URL (`http(s)://…`).
    - Writes each provided value to its field `path` (missing keys keep the current value).
    - For each field with `placeholderPath`, sets that boolean to `true` when the (trimmed) value is empty, else `false`.
    - Returns `{ data }` (new section object) or `{ error }` on first validation failure.

- [ ] **Step 1: Write the failing test**

```ts
// append to tests/lib/profile-sections.test.ts
import { applySectionValues } from '../../src/lib/profile-sections';

const S = (k: string) => SECTIONS.find((s) => s.key === k)!;

describe('applySectionValues', () => {
  it('rejects blank required identity fields', () => {
    const data = { first: 'Tyler', last: 'Baleno', position: 'DB',
      positionShort: 'DB', jersey: '3', gradYear: '2027', school: 'Plum', team: 'Plum', location: 'Pittsburgh, PA' };
    const res = applySectionValues(S('identity'), data, { first: '   ' });
    expect('error' in res).toBe(true);
  });

  it('rejects a malformed URL field', () => {
    const data = { title: 't', hudlEmbed: '', hudlWatch: '', hudlProfile: '' };
    const res = applySectionValues(S('film'), data, { hudlWatch: 'not-a-url' });
    expect('error' in res).toBe(true);
  });

  it('accepts a valid URL and empty URL (empty = TBD, allowed)', () => {
    const data = { title: 't', hudlEmbed: '', hudlWatch: '', hudlProfile: '' };
    const res = applySectionValues(S('film'), data, { hudlWatch: 'https://hudl.com/x', hudlProfile: '' });
    expect('error' in res).toBe(false);
  });

  it('derives placeholder=true when a placeholder-capable field is blanked', () => {
    const data = { gpa: '4.0', scale: '4.0',
      testScore: { value: '1300', placeholder: false }, major: { value: 'Undecided', placeholder: false } };
    const res = applySectionValues(S('academics'), data, { testScore: '' }) as { data: any };
    expect(res.data.testScore).toEqual({ value: '', placeholder: true });
    expect(res.data.major).toEqual({ value: 'Undecided', placeholder: false }); // untouched key keeps value
  });

  it('derives placeholder=false when a placeholder-capable field gets a value', () => {
    const data = { athlete: { name: 'T', phone: '', twitter: '', twitterUrl: '' },
      coach: { name: 'M', title: 'HC', contact: '', placeholder: true }, hudl: '' };
    const res = applySectionValues(S('contact'), data, { 'coach.contact': 'coach@plum.org' }) as { data: any };
    expect(res.data.coach.contact).toBe('coach@plum.org');
    expect(res.data.coach.placeholder).toBe(false);
  });

  it('derives placeholder on stat rows from value emptiness', () => {
    const data = [{ label: 'Shuttle', value: '4.2', placeholder: false }, { label: 'Vertical', value: '', placeholder: true }];
    const res = applySectionValues(S('measurables'), data, { '0': '', '1': '38"' }) as { data: any };
    expect(res.data[0]).toEqual({ label: 'Shuttle', value: '', placeholder: true });
    expect(res.data[1]).toEqual({ label: 'Vertical', value: '38"', placeholder: false });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/profile-sections.test.ts`
Expected: FAIL — `applySectionValues` is not exported.

- [ ] **Step 3: Write minimal implementation**

```ts
// append to src/lib/profile-sections.ts
function looksLikeUrl(v: string): boolean {
  return /^https?:\/\/\S+$/i.test(v.trim());
}

export function applySectionValues(
  def: SectionDef,
  sectionData: unknown,
  values: Record<string, string>,
): { data: unknown } | { error: string } {
  const fields = resolveFields(def, sectionData);

  // Validate against provided values (fall back to current value when a key is absent).
  for (const f of fields) {
    const provided = Object.prototype.hasOwnProperty.call(values, f.name);
    const value = provided ? values[f.name] : getPath(sectionData, f.path);
    if (f.required && value.trim() === '') {
      return { error: `${f.label} is required` };
    }
    if (f.kind === 'url' && value.trim() !== '' && !looksLikeUrl(value)) {
      return { error: `${f.label} must be a URL (https://…)` };
    }
  }

  // Write provided values, then derive placeholder flags.
  let data: unknown = sectionData;
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(values, f.name)) {
      data = setPath(data, f.path, values[f.name]);
    }
    if (f.placeholderPath) {
      const v = getPath(data, f.path);
      data = setPath(data, f.placeholderPath, v.trim() === '' ? (true as unknown as string) : (false as unknown as string));
    }
  }
  return { data };
}
```

> Note: `setPath` writes the value verbatim; the `as unknown as string` casts let it store a boolean for `placeholderPath`. This is intentional and confined to this function.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/profile-sections.test.ts`
Expected: PASS (all Task 1 + Task 2 cases).

- [ ] **Step 5: Commit**

```bash
git add src/lib/profile-sections.ts tests/lib/profile-sections.test.ts
git commit -m "feat(admin): applySectionValues — validate, write, derive TBD placeholders"
```

---

### Task 3: Placeholder display helper + public component tweak

**Files:**
- Create: `src/lib/display.ts`
- Test: `tests/lib/display.test.ts`
- Modify: `src/themes/tyler/Athletics.astro:24`, `src/themes/tyler/Academics.astro:24,28`, `src/themes/tyler/Contact.astro:27`, `src/themes/tyler/Hero.astro` (headline stat values)

**Interfaces:**
- Produces: `function phValue(value: string, placeholder?: boolean): string` — returns `'—'` when `placeholder` is truthy and `value` is empty/whitespace, else `value`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/lib/display.test.ts
import { describe, it, expect } from 'vitest';
import { phValue } from '../../src/lib/display';

describe('phValue', () => {
  it('shows a dash for an empty placeholder field', () => {
    expect(phValue('', true)).toBe('—');
    expect(phValue('   ', true)).toBe('—');
  });
  it('shows the value when present, even if flagged placeholder', () => {
    expect(phValue('4.44', true)).toBe('4.44');
  });
  it('passes non-placeholder values through untouched', () => {
    expect(phValue('', false)).toBe('');
    expect(phValue('4.0', undefined)).toBe('4.0');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/display.test.ts`
Expected: FAIL — cannot find module `../../src/lib/display`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/display.ts
/** Value to render for a placeholder-capable field: em dash when flagged-and-empty. */
export function phValue(value: string, placeholder?: boolean): string {
  return placeholder && value.trim() === '' ? '—' : value;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/display.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire `phValue` into the public components**

In `src/themes/tyler/Athletics.astro`, add to the frontmatter imports:
```ts
import { phValue } from '../../lib/display';
```
Change the stat value render (line ~24) from:
```astro
          <div class="tile__value">{s.value}</div>
```
to:
```astro
          <div class="tile__value">{phValue(s.value, s.placeholder)}</div>
```

In `src/themes/tyler/Academics.astro`, add to the frontmatter:
```ts
import { phValue } from '../../lib/display';
```
Change lines ~24 and ~28 from:
```astro
          <span class={`acad__v ${academics.testScore.placeholder ? 'is-ph' : ''}`}>{academics.testScore.value}</span>
```
```astro
          <span class={`acad__v ${academics.major.placeholder ? 'is-ph' : ''}`}>{academics.major.value}</span>
```
to:
```astro
          <span class={`acad__v ${academics.testScore.placeholder ? 'is-ph' : ''}`}>{phValue(academics.testScore.value, academics.testScore.placeholder)}</span>
```
```astro
          <span class={`acad__v ${academics.major.placeholder ? 'is-ph' : ''}`}>{phValue(academics.major.value, academics.major.placeholder)}</span>
```

In `src/themes/tyler/Contact.astro`, add to the frontmatter:
```ts
import { phValue } from '../../lib/display';
```
Change line ~27 from:
```astro
          <li><span>Contact</span><span class={contact.coach.placeholder ? 'is-ph' : ''}>{contact.coach.contact}</span></li>
```
to:
```astro
          <li><span>Contact</span><span class={contact.coach.placeholder ? 'is-ph' : ''}>{phValue(contact.coach.contact, contact.coach.placeholder)}</span></li>
```

In `src/themes/tyler/Hero.astro`: the hero stat rail renders at `headline.map((s) => ( … ))` (starts line ~28). Add `import { phValue } from '../../lib/display';` to the frontmatter, then change the stat value output inside that map from `{s.value}` to `{phValue(s.value, s.placeholder)}`. (Leave any `s.placeholder`-based class untouched; only the value text changes.)

- [ ] **Step 6: Verify build + type check**

Run: `npx astro check && npm run build`
Expected: `0 errors, 0 warnings, 0 hints`; build completes.

- [ ] **Step 7: Commit**

```bash
git add src/lib/display.ts tests/lib/display.test.ts src/themes/tyler/Athletics.astro src/themes/tyler/Academics.astro src/themes/tyler/Contact.astro src/themes/tyler/Hero.astro
git commit -m "feat(admin): show em-dash for empty placeholder fields (blank=TBD display)"
```

---

### Task 4: Owner data-access — read owned record + save one section

**Files:**
- Create: `src/lib/athlete-admin.ts`
- Test: `tests/lib/athlete-admin.test.ts` (integration, env-gated like `tests/lib/rls.test.ts`)

**Interfaces:**
- Consumes: `SectionKey`, `SECTIONS`, `applySectionValues` (Tasks 1–2); `AthleteProfile`, `AthleteRecord` (`src/lib/types.ts`).
- Produces:
  - `async function getOwnedAthlete(supabase: SupabaseClient, userId: string): Promise<AthleteRecord | null>` — the row where `owner_user_id = userId` (RLS-safe read of the owner's own row).
  - `async function saveProfileSection(supabase: SupabaseClient, athleteId: string, key: SectionKey, values: Record<string, string>): Promise<{ ok: true } | { error: string }>` — read current profile, `applySectionValues`, write `{ [key]: newData }` back into `profile`, `update` the row by id. RLS enforces owner-only.

- [ ] **Step 1: Write the failing test** (integration; skips cleanly if no owner is linked yet)

```ts
// tests/lib/athlete-admin.test.ts
import { describe, it, expect } from 'vitest';
import { getPublicClient } from '../../src/lib/supabase';
import { saveProfileSection } from '../../src/lib/athlete-admin';

describe('saveProfileSection (anon client is RLS-blocked from writing)', () => {
  it('anon cannot save a section (owner-only update)', async () => {
    const anon = getPublicClient();
    const { data } = await anon.from('athletes').select('id').eq('slug', 'tyler-baleno').maybeSingle();
    if (!data) return; // no seed → nothing to assert
    const res = await saveProfileSection(anon as any, data.id, 'identity',
      { first: 'Hacked', last: 'X', position: 'DB' });
    expect('error' in res).toBe(true); // RLS blocks the update → 0 rows / error
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/athlete-admin.test.ts`
Expected: FAIL — cannot find module `../../src/lib/athlete-admin`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/athlete-admin.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AthleteProfile, AthleteRecord } from './types';
import { SECTIONS, applySectionValues, type SectionKey } from './profile-sections';

export async function getOwnedAthlete(
  supabase: SupabaseClient, userId: string,
): Promise<AthleteRecord | null> {
  const { data, error } = await supabase
    .from('athletes')
    .select('id,slug,profile,card_visibility,photo_url')
    .eq('owner_user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id, slug: data.slug, profile: data.profile,
    cardVisibility: data.card_visibility, photoUrl: data.photo_url,
  };
}

export async function saveProfileSection(
  supabase: SupabaseClient, athleteId: string, key: SectionKey, values: Record<string, string>,
): Promise<{ ok: true } | { error: string }> {
  const def = SECTIONS.find((s) => s.key === key);
  if (!def) return { error: `Unknown section "${key}"` };

  const { data: row, error: readErr } = await supabase
    .from('athletes').select('profile').eq('id', athleteId).maybeSingle();
  if (readErr) return { error: readErr.message };
  if (!row) return { error: 'Record not found' };

  const profile = row.profile as AthleteProfile;
  const applied = applySectionValues(def, (profile as Record<string, unknown>)[key], values);
  if ('error' in applied) return { error: applied.error };

  const nextProfile = { ...profile, [key]: applied.data };
  const { data: updated, error: writeErr } = await supabase
    .from('athletes').update({ profile: nextProfile }).eq('id', athleteId).select('id');
  if (writeErr) return { error: writeErr.message };
  if (!updated || updated.length === 0) return { error: 'Not authorized to edit this record' };
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/athlete-admin.test.ts`
Expected: PASS (anon write is RLS-blocked → `{ error }`; or skips if no seed).

- [ ] **Step 5: Commit**

```bash
git add src/lib/athlete-admin.ts tests/lib/athlete-admin.test.ts
git commit -m "feat(admin): owner data-access — read owned record, save one section (RLS-guarded)"
```

---

### Task 5: Save API route `/api/profile/[section]`

**Files:**
- Create: `src/pages/api/profile/[section].ts`

**Interfaces:**
- Consumes: `context.locals.user`, `context.locals.supabase` (middleware); `getOwnedAthlete`, `saveProfileSection` (Task 4); `SECTIONS`, `SectionKey` (Task 1).
- Produces: `POST` handler. Body: `{ values: Record<string,string> }`. Responses: `200 {ok:true}`, `400 {error}` (bad body/unknown section/validation), `401 {error}` (no user), `404 {error}` (no owned record).

- [ ] **Step 1: Write the route**

```ts
// src/pages/api/profile/[section].ts
import type { APIRoute } from 'astro';
import { SECTIONS, type SectionKey } from '../../../lib/profile-sections';
import { getOwnedAthlete, saveProfileSection } from '../../../lib/athlete-admin';

export const prerender = false;

const isSection = (v: string): v is SectionKey => SECTIONS.some((s) => s.key === v);

export const POST: APIRoute = async (context) => {
  const user = context.locals.user;
  if (!user) return json({ error: 'Not signed in' }, 401);

  const section = context.params.section ?? '';
  if (!isSection(section)) return json({ error: 'Unknown section' }, 400);

  const body = await context.request.json().catch(() => null);
  const values = (body && typeof body === 'object' && (body as any).values) as unknown;
  if (typeof values !== 'object' || values === null) {
    return json({ error: 'Missing values' }, 400);
  }

  const record = await getOwnedAthlete(context.locals.supabase, user.id);
  if (!record) return json({ error: 'No editable record for this account' }, 404);

  const res = await saveProfileSection(
    context.locals.supabase, record.id, section, values as Record<string, string>,
  );
  if ('error' in res) return json({ error: res.error }, 400);
  return json({ ok: true }, 200);
};

function json(obj: unknown, status: number): Response {
  return new Response(JSON.stringify(obj), {
    status, headers: { 'Content-Type': 'application/json' },
  });
}
```

- [ ] **Step 2: Verify build + type check**

Run: `npx astro check && npm run build`
Expected: `0 errors`; build completes (route emitted).

- [ ] **Step 3: Commit**

```bash
git add src/pages/api/profile/[section].ts
git commit -m "feat(admin): POST /api/profile/[section] — authed, RLS-guarded section save"
```

---

### Task 6: `SectionEditor` island + styles

**Files:**
- Create: `src/components/admin/SectionEditor.tsx`
- Create: `src/components/admin/SectionEditor.css`

**Interfaces:**
- Consumes: `FieldView` (Task 1); POSTs to `/api/profile/[section]`.
- Produces: `default function SectionEditor(props: { section: string; title: string; fields: FieldView[] })` — renders a titled card with one always-editable input per field and a per-section Save button; shows inline saved/error status in reserved space (no layout shift).

- [ ] **Step 1: Write the island**

```tsx
// src/components/admin/SectionEditor.tsx
import { useState } from 'preact/hooks';
import './SectionEditor.css';

interface FieldView { name: string; label: string; kind: 'text' | 'url'; value: string; required: boolean }
type Status = { kind: 'idle' | 'saved' } | { kind: 'error'; msg: string };

export default function SectionEditor(
  { section, title, fields }: { section: string; title: string; fields: FieldView[] },
) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(fields.map((f) => [f.name, f.value])),
  );
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  function set(name: string, v: string) {
    setValues((prev) => ({ ...prev, [name]: v }));
    setStatus({ kind: 'idle' });
  }

  async function onSubmit(e: Event) {
    e.preventDefault();
    setBusy(true);
    setStatus({ kind: 'idle' });
    const res = await fetch(`/api/profile/${section}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values }),
    }).catch(() => null);
    setBusy(false);
    if (res && res.ok) { setStatus({ kind: 'saved' }); return; }
    const data = res ? await res.json().catch(() => ({})) : {};
    setStatus({ kind: 'error', msg: (data as any).error ?? 'Save failed' });
  }

  return (
    <form class="section-editor" onSubmit={onSubmit}>
      <div class="se__head">
        <h2 class="se__title">{title}</h2>
        <button class="se__save" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
      <div class="se__grid">
        {fields.map((f) => (
          <label class="se__field" key={f.name}>
            <span class="se__label">{f.label}{f.required && <span class="se__req"> *</span>}</span>
            <input
              class="se__input"
              type={f.kind === 'url' ? 'url' : 'text'}
              value={values[f.name] ?? ''}
              onInput={(e) => set(f.name, (e.target as HTMLInputElement).value)}
            />
          </label>
        ))}
      </div>
      <p class={`se__status se__status--${status.kind}`} role="status">
        {status.kind === 'saved' ? 'Saved.' : status.kind === 'error' ? status.msg : ' '}
      </p>
    </form>
  );
}
```

> The status line always renders (a non-breaking space when idle), so it never changes the card's height — satisfies the no-layout-shift rule.

- [ ] **Step 2: Write the styles**

```css
/* src/components/admin/SectionEditor.css */
.section-editor {
  border: 1px solid var(--line);
  background: var(--ink-2);
  border-radius: var(--radius);
  padding: 1.4rem 1.5rem;
  margin-top: 1.5rem;
}
.se__head { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.se__title { font-family: var(--display); font-weight: 800; text-transform: uppercase;
  letter-spacing: 0.02em; font-size: 1.3rem; }
.se__save { font-family: var(--display); font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.08em; font-size: 0.85rem; color: var(--ink); background: var(--gold);
  border: none; border-radius: var(--radius); padding: 0.5rem 1.1rem; cursor: pointer; }
.se__save:disabled { opacity: 0.6; cursor: default; }
.se__grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.9rem 1.2rem; margin-top: 1.2rem; }
.se__field { display: flex; flex-direction: column; gap: 0.35rem; }
.se__label { font-family: var(--display); font-weight: 600; letter-spacing: 0.12em;
  text-transform: uppercase; font-size: 0.72rem; color: var(--muted); }
.se__req { color: var(--gold); }
.se__input { background: var(--ink-3); border: 1px solid var(--line); border-radius: var(--radius);
  color: var(--bone); font-family: var(--body); font-size: 0.95rem; padding: 0.55rem 0.7rem; }
.se__input:focus-visible { outline: 2px solid var(--gold); outline-offset: 1px; }
.se__status { min-height: 1.2rem; margin-top: 1rem; font-size: 0.85rem; }
.se__status--saved { color: var(--gold); }
.se__status--error { color: #E5534B; }
@media (max-width: 560px) { .se__grid { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Verify type check + build**

Run: `npx astro check && npm run build`
Expected: `0 errors`; build completes.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/SectionEditor.tsx src/components/admin/SectionEditor.css
git commit -m "feat(admin): generic SectionEditor island (per-section save, reserved status line)"
```

---

### Task 7: Wire the dashboard

**Files:**
- Modify: `src/pages/admin/index.astro`

**Interfaces:**
- Consumes: `getOwnedAthlete` (Task 4), `SECTIONS`, `sectionFieldViews` (Task 1), `SectionEditor` (Task 6), `Astro.locals` (middleware).

- [ ] **Step 1: Rewrite the dashboard to load + render editors**

```astro
---
import Admin from '../../layouts/Admin.astro';
import LogoutButton from '../../components/admin/LogoutButton.tsx';
import SectionEditor from '../../components/admin/SectionEditor.tsx';
import { getOwnedAthlete } from '../../lib/athlete-admin';
import { SECTIONS, sectionFieldViews } from '../../lib/profile-sections';
export const prerender = false;

const user = Astro.locals.user;
if (!user) return Astro.redirect('/login');

const record = await getOwnedAthlete(Astro.locals.supabase, user.id);

const editors = record
  ? SECTIONS.map((def) => ({
      section: def.key,
      title: def.title,
      fields: sectionFieldViews(def, (record.profile as Record<string, unknown>)[def.key]),
    }))
  : [];
---
<Admin title="Dashboard">
  <header class="admin-header">
    <div>
      <h1>Your Dashboard</h1>
      <p class="signed-in">Signed in as {user.email}</p>
    </div>
    <LogoutButton client:load />
  </header>

  <p><a href="/" class="view-site">View my public site →</a></p>

  {record ? (
    editors.map((e) => (
      <SectionEditor client:load section={e.section} title={e.title} fields={e.fields} />
    ))
  ) : (
    <p class="no-record">No editable record is linked to this account yet.</p>
  )}

  <style>
    .admin-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    h1 { font-family: var(--display); }
    .signed-in { color: var(--muted); font-size: 0.85rem; margin: 0.25rem 0 0; }
    .view-site { color: var(--gold); }
    .no-record { color: var(--muted); margin-top: 2rem; }
  </style>
</Admin>
```

- [ ] **Step 2: Verify type check + build + existing tests**

Run: `npx astro check && npm run build && npm test`
Expected: `0 errors`; build completes; all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/index.astro
git commit -m "feat(admin): dashboard renders a section editor per value section"
```

---

### Task 8: End-to-end verification (the acceptance loop)

**Prerequisite (Angelo, manual — not a code step):** Tyler needs a Supabase auth user created in the Supabase dashboard, then linked:
```bash
node --env-file=.env.local scripts/link-owner.mjs <tyler-email> tyler-baleno
```
(Account creation is Angelo's to perform; the build above does not require it, only this verification does.)

**Files:** none (verification only).

- [ ] **Step 1: Full suite + build green**

Run: `npx astro check && npm test && npm run build`
Expected: `0 errors`, all tests pass, build completes.

- [ ] **Step 2: Run the app and drive the acceptance loop** (dev server, real Supabase via `.env.local`)

Run: `npm run dev`, then in the browser:
1. Visit `/admin` while signed out → redirected to `/login`.
2. Sign in as Tyler → land on `/admin` with a card per section (Identity, Stat Rail, Measurables, Academics, Film, Contact), each seeded with current values.
3. In **Stat Rail**, change the 40-yard value → click that card's **Save** → status shows "Saved."
4. Open `/` (View my public site) → the hero stat rail shows the new 40 time.
5. In **Measurables**, clear a value (e.g. Shuttle) → Save → on `/`, that tile shows `—` (TBD), not the old value.
6. In **Identity**, blank the First name → Save → inline error "First name is required"; nothing persists.

Expected: each of 1–6 behaves as described.

- [ ] **Step 3: Security spot-check**

- Signed out, `curl -X POST https://…/api/profile/identity -H 'content-type: application/json' -d '{"values":{"first":"X"}}'` → `401`.
- Confirm `tests/lib/athlete-admin.test.ts` (anon write blocked) passes against the live DB.

- [ ] **Step 4: Ship**

```bash
git push origin master
```
Then verify the production `/admin` loads the editors and a save reflects on the live public site (per Angelo's ship-it flow). Deploy runs on push (Vercel).

---

## Self-Review

**Spec coverage:**
- Value-field editors for the six in-scope sections → Tasks 1, 6, 7. ✓
- Per-section save → Task 5 (route per section) + Task 6 (per-card Save). ✓
- Always-editable, no layout shift → Task 6 (inputs always rendered; reserved status line). ✓
- Blank = TBD (derive on save + display) → Task 2 (derive) + Task 3 (display). ✓
- Light validation, fail-loud → Task 2 (required + url) + Task 6 (inline error). ✓
- RLS owner-only, no service key in request path → Task 4 (authed client) + Task 5 (locals). ✓
- Public component adjustment for placeholder label → Task 3. ✓
- Acceptance loop (minus toggles) → Task 8. ✓
- Deferred (lists/offers/toggles/photo) → excluded throughout. ✓

**Placeholder scan:** no "TBD/TODO/implement later" steps; every code step shows complete code. ✓

**Type consistency:** `SectionKey`, `SectionDef`, `FieldDef`, `FieldView`, `applySectionValues`, `getOwnedAthlete`, `saveProfileSection`, `phValue` are named identically across the tasks that define and consume them. The API route body shape `{ values }` matches the island's POST body and `saveProfileSection`'s `values` param. ✓
