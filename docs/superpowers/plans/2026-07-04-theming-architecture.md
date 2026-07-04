# Theming Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the single hardcoded skin into an engine that renders any athlete through a swappable per-athlete **theme** (a folder of per-panel components) in an Angelo-set **arrangement**, so each athlete can get a total visual overhaul on shared bones.

**Architecture:** A pure resolution layer (`site-config` + `panels`) turns an athlete record + repo-side config into an ordered, visibility-filtered list of `{panelKey, props}`. A theme **registry** maps a theme name to that theme's component set. `index.astro` becomes a thin **engine**: resolve theme + arrangement → render each panel with the chosen theme's component. Tyler's current components move verbatim into `themes/tyler/` as theme #1 (output unchanged); a deliberately plain `themes/bare/` theme + a dev preview route prove that swapping the theme swaps the whole look from the same data.

**Tech Stack:** Astro (SSR, `prerender = false`), TypeScript (strict), Supabase (existing data layer), Vitest (node env) for pure logic, `npm run build` + browser screenshot for visual verification.

## Global Constraints

- **Behavior-preserving migration:** at the end of Tasks 2 and 3, Tyler's live page (`/`) must render byte-for-byte the same as before. Verify by build + screenshot diff against the current page each time.
- **Themes share logic, never look.** Non-visual helpers live in `src/lib/`; all layout/type/spacing/color/motion/markup lives inside a theme folder. No theme imports another theme, and no shared visual/CSS module is created.
- **Every theme implements every panel type** (`Base, Nav, Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact, Footer`). This orthogonality is what lets arrangement and theming stay independent.
- **Fail loud on theme resolution:** an unknown/missing theme or unconfigured slug throws, never silently falls back to another athlete's look.
- **Athlete edits content + card on/off only.** This plan adds no athlete-facing UI. `card_visibility` (DB, athlete-editable) controls on/off; **arrangement + theme are repo-side, keyed by slug, Angelo-only.**
- **Data contracts come from `src/lib/types.ts`** — `AthleteProfile`, `PlayerView`, `Offer`, `Stat`, `Game`, `CardVisibility`, `AthleteRecord`. Do not redefine them.
- Copy tone in any new prose: plain, restrained; no hollow intensifiers ("genuinely", "seamlessly", "elevate").

---

## File Structure

```
src/
  lib/
    site-config.ts      NEW  per-slug { theme, arrangement }; PanelKey; getSiteConfig (fail-loud)
    panels.ts           NEW  RenderContext, PanelSpec, buildPanelList, PANEL_COMPONENT
    athlete.ts          (unchanged) getAthleteBySlug, resolveOffers
    types.ts            (unchanged) data contracts
  themes/
    types.ts            NEW  ThemeComponents interface
    registry.ts         NEW  themes map + getTheme (fail-loud)
    tyler/
      index.ts          NEW  exports ThemeComponents for Tyler
      Base.astro        MOVED from src/layouts/Base.astro
      global.css        MOVED from src/styles/global.css (Tyler-owned)
      Nav/Hero/Film/Offers/Athletics/Positions/Academics/Schedule/Contact/Footer.astro
                        MOVED from src/components/* (verbatim; import-path fixes only)
    bare/
      index.ts          NEW  exports ThemeComponents for the bare theme
      Base.astro        NEW  plain semantic shell
      *.astro           NEW  plain semantic render of every panel
  pages/
    index.astro         MODIFIED  becomes the engine
    preview/[theme].astro  NEW  dev-only: render Tyler's data under any theme
tests/
  panels.test.ts        NEW
  site-config.test.ts   NEW
docs/
  NEW-THEME.md          NEW  how to author a new athlete's skin
```

---

### Task 1: Pure resolution layer (`site-config` + `panels`)

Pure TypeScript, no Astro/Supabase. Fully TDD with Vitest.

**Files:**
- Create: `src/lib/site-config.ts`, `src/lib/panels.ts`
- Test: `tests/site-config.test.ts`, `tests/panels.test.ts`

**Interfaces:**
- Consumes: `AthleteProfile`, `PlayerView`, `Offer`, `CardVisibility` from `src/lib/types.ts`.
- Produces:
  - `type PanelKey = 'hero'|'film'|'offers'|'athletics'|'positions'|'academics'|'schedule'|'contact'`
  - `type ThemeName = string`
  - `interface SiteConfig { theme: ThemeName; arrangement: PanelKey[] }`
  - `const DEFAULT_ARRANGEMENT: PanelKey[]`
  - `function getSiteConfig(slug: string): SiteConfig` (throws if slug unconfigured)
  - `interface RenderContext { player: PlayerView; profile: AthleteProfile; offers: Offer[] }`
  - `interface PanelSpec { key: PanelKey; props: Record<string, unknown> }`
  - `function buildPanelList(ctx: RenderContext, arrangement: PanelKey[], visibility: CardVisibility): PanelSpec[]`
  - `const PANEL_COMPONENT: Record<PanelKey, keyof ThemeComponents>` — **defined in Task 2** (`panels.ts` imports the type from `../themes/types`); to avoid a cycle, `PANEL_COMPONENT` lives in `panels.ts` and uses the string field names directly.

- [ ] **Step 1: Write failing tests for `getSiteConfig`** — `tests/site-config.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { getSiteConfig, DEFAULT_ARRANGEMENT } from '../src/lib/site-config';

describe('getSiteConfig', () => {
  it('returns Tyler config with the default arrangement', () => {
    const cfg = getSiteConfig('tyler-baleno');
    expect(cfg.theme).toBe('tyler');
    expect(cfg.arrangement).toEqual(DEFAULT_ARRANGEMENT);
  });
  it('default arrangement leads with hero and ends with contact', () => {
    expect(DEFAULT_ARRANGEMENT[0]).toBe('hero');
    expect(DEFAULT_ARRANGEMENT.at(-1)).toBe('contact');
  });
  it('throws (fail-loud) for an unconfigured slug', () => {
    expect(() => getSiteConfig('nobody')).toThrow(/no site config/i);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/site-config.test.ts`
Expected: FAIL (module not found / export missing).

- [ ] **Step 3: Implement `src/lib/site-config.ts`**

```ts
export type PanelKey =
  | 'hero' | 'film' | 'offers' | 'athletics'
  | 'positions' | 'academics' | 'schedule' | 'contact';

export type ThemeName = string;

export interface SiteConfig {
  theme: ThemeName;
  arrangement: PanelKey[];
}

/** Body-panel order. Angelo edits this per athlete; athletes cannot. */
export const DEFAULT_ARRANGEMENT: PanelKey[] = [
  'hero', 'film', 'offers', 'athletics',
  'positions', 'academics', 'schedule', 'contact',
];

/** Repo-side, Angelo-only. Keyed by athlete slug. */
const siteConfigs: Record<string, SiteConfig> = {
  'tyler-baleno': { theme: 'tyler', arrangement: DEFAULT_ARRANGEMENT },
};

export function getSiteConfig(slug: string): SiteConfig {
  const cfg = siteConfigs[slug];
  if (!cfg) throw new Error(`No site config for slug "${slug}"`);
  return cfg;
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run tests/site-config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write failing tests for `buildPanelList`** — `tests/panels.test.ts`

```ts
import { describe, it, expect } from 'vitest';
import { buildPanelList, PANEL_COMPONENT } from '../src/lib/panels';
import { DEFAULT_ARRANGEMENT } from '../src/lib/site-config';
import type { CardVisibility } from '../src/lib/types';

const allVisible: CardVisibility = {
  film: true, offers: true, athletics: true, positions: true,
  academics: true, schedule: true, contact: true,
};

// Minimal but type-shaped context.
const ctx = {
  player: { first: 'Tyler', last: 'Baleno', position: 'Defensive Back',
    positionShort: 'DB', jersey: '3', gradYear: '2027', school: 'Plum',
    team: 'Plum', location: 'Pittsburgh, PA', heroPhoto: null },
  profile: {
    identity: {} as any,
    headline: [{ label: 'HT', value: `6'2"` }],
    measurables: [{ label: '40', value: '4.44' }],
    honors: ['2x All-Conference DB'],
    film: { hudlEmbed: 'e', hudlWatch: 'w', hudlProfile: 'p', title: 't' },
    positions: [{ code: 'DB', name: 'Defensive Back', primary: true }],
    academics: { gpa: '4.0', scale: '4.0', testScore: { value: '' }, major: { value: '' } },
    offers: [],
    schedule: [],
    scheduleMeta: { season: '2026', kickoff: '7:00 PM', homeVenue: 'Plum' },
    contact: { athlete: { name: 'Tyler Baleno', phone: '', twitter: '', twitterUrl: '' },
      coach: { name: '', title: '', contact: '', placeholder: true }, hudl: '' },
  } as any,
  offers: [],
};

describe('buildPanelList', () => {
  it('returns every panel in arrangement order when all visible', () => {
    const list = buildPanelList(ctx as any, DEFAULT_ARRANGEMENT, allVisible);
    expect(list.map((p) => p.key)).toEqual(DEFAULT_ARRANGEMENT);
  });
  it('always keeps hero even though it has no visibility flag', () => {
    const hidden: CardVisibility = { film: false, offers: false, athletics: false,
      positions: false, academics: false, schedule: false, contact: false };
    const list = buildPanelList(ctx as any, DEFAULT_ARRANGEMENT, hidden);
    expect(list.map((p) => p.key)).toEqual(['hero']);
  });
  it('omits only the panels toggled off, preserving order', () => {
    const v = { ...allVisible, offers: false, schedule: false };
    const list = buildPanelList(ctx as any, DEFAULT_ARRANGEMENT, v);
    expect(list.map((p) => p.key)).toEqual(
      ['hero', 'film', 'athletics', 'positions', 'academics', 'contact']);
  });
  it('builds hero props from player + headline', () => {
    const hero = buildPanelList(ctx as any, ['hero'], allVisible)[0];
    expect(hero.props).toEqual({ player: ctx.player, headline: ctx.profile.headline });
  });
  it('builds athletics props from measurables + honors', () => {
    const a = buildPanelList(ctx as any, ['athletics'], allVisible)[0];
    expect(a.props).toEqual({ measurables: ctx.profile.measurables, honors: ctx.profile.honors });
  });
  it('maps every panel key to a component field name', () => {
    for (const key of DEFAULT_ARRANGEMENT) {
      expect(typeof PANEL_COMPONENT[key]).toBe('string');
    }
  });
});
```

- [ ] **Step 6: Run tests, verify they fail**

Run: `npx vitest run tests/panels.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 7: Implement `src/lib/panels.ts`**

```ts
import type { AthleteProfile, PlayerView, Offer, CardVisibility } from './types';
import type { PanelKey } from './site-config';

export interface RenderContext {
  player: PlayerView;
  profile: AthleteProfile;
  offers: Offer[];
}

export interface PanelSpec {
  key: PanelKey;
  props: Record<string, unknown>;
}

/** Panel key -> the field name in a theme's ThemeComponents. */
export const PANEL_COMPONENT: Record<PanelKey, string> = {
  hero: 'Hero', film: 'Film', offers: 'Offers', athletics: 'Athletics',
  positions: 'Positions', academics: 'Academics', schedule: 'Schedule', contact: 'Contact',
};

/** Non-hero panels map 1:1 to a CardVisibility flag; hero is always shown. */
function isVisible(key: PanelKey, v: CardVisibility): boolean {
  if (key === 'hero') return true;
  return v[key];
}

function propsFor(key: PanelKey, ctx: RenderContext): Record<string, unknown> {
  const { player, profile, offers } = ctx;
  switch (key) {
    case 'hero':      return { player, headline: profile.headline };
    case 'film':      return { film: profile.film };
    case 'offers':    return { offers };
    case 'athletics': return { measurables: profile.measurables, honors: profile.honors };
    case 'positions': return { positions: profile.positions };
    case 'academics': return { academics: profile.academics };
    case 'schedule':  return { schedule: profile.schedule, scheduleMeta: profile.scheduleMeta };
    case 'contact':   return { contact: profile.contact, player };
  }
}

export function buildPanelList(
  ctx: RenderContext, arrangement: PanelKey[], visibility: CardVisibility,
): PanelSpec[] {
  return arrangement
    .filter((key) => isVisible(key, visibility))
    .map((key) => ({ key, props: propsFor(key, ctx) }));
}
```

- [ ] **Step 8: Run tests, verify they pass**

Run: `npx vitest run tests/panels.test.ts tests/site-config.test.ts`
Expected: PASS (all).

- [ ] **Step 9: Commit**

```bash
git add src/lib/site-config.ts src/lib/panels.ts tests/site-config.test.ts tests/panels.test.ts
git commit -m "feat(theming): pure resolution layer (site-config + panels)"
```

---

### Task 2: Extract Tyler into `themes/tyler/` + registry (behavior-preserving)

Move the current single skin into the first theme folder and build the registry. No engine yet — `index.astro` keeps its explicit render, just importing from the theme. Output must stay identical.

**Files:**
- Move: `src/layouts/Base.astro` → `src/themes/tyler/Base.astro`; `src/styles/global.css` → `src/themes/tyler/global.css`; each `src/components/*.astro` → `src/themes/tyler/*.astro`
- Create: `src/themes/types.ts`, `src/themes/tyler/index.ts`, `src/themes/registry.ts`
- Modify: `src/pages/index.astro` (import paths only), `src/pages/login.astro` and any admin page importing `layouts/Base.astro` (update path)

**Interfaces:**
- Produces:
  - `interface ThemeComponents` (Task 3, Task 4 depend on it)
  - `function getTheme(name: string): ThemeComponents` (fail-loud)

- [ ] **Step 1: Move the files with git (preserves history)**

```bash
git mv src/layouts/Base.astro src/themes/tyler/Base.astro
git mv src/styles/global.css src/themes/tyler/global.css
for f in Nav Hero Film Offers Athletics Positions Academics Schedule Contact Footer; do \
  git mv "src/components/$f.astro" "src/themes/tyler/$f.astro"; done
```

- [ ] **Step 2: Fix intra-theme import paths**

In `src/themes/tyler/Base.astro` change `import '../styles/global.css'` → `import './global.css'`.
The yardline divider currently sits in `index.astro` between Hero and Film. Move it into Tyler's skin so the engine stays generic: at the **end** of `src/themes/tyler/Hero.astro`'s template, append `<div class="yardline" aria-hidden="true"></div>`.

- [ ] **Step 3: Create the theme-components contract** — `src/themes/types.ts`

```ts
import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

/** Every theme must export exactly these. */
export interface ThemeComponents {
  Base: AstroComponentFactory;
  Nav: AstroComponentFactory;
  Hero: AstroComponentFactory;
  Film: AstroComponentFactory;
  Offers: AstroComponentFactory;
  Athletics: AstroComponentFactory;
  Positions: AstroComponentFactory;
  Academics: AstroComponentFactory;
  Schedule: AstroComponentFactory;
  Contact: AstroComponentFactory;
  Footer: AstroComponentFactory;
}
```

- [ ] **Step 4: Export Tyler's set** — `src/themes/tyler/index.ts`

```ts
import type { ThemeComponents } from '../types';
import Base from './Base.astro';
import Nav from './Nav.astro';
import Hero from './Hero.astro';
import Film from './Film.astro';
import Offers from './Offers.astro';
import Athletics from './Athletics.astro';
import Positions from './Positions.astro';
import Academics from './Academics.astro';
import Schedule from './Schedule.astro';
import Contact from './Contact.astro';
import Footer from './Footer.astro';

export const tylerTheme: ThemeComponents = {
  Base, Nav, Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact, Footer,
};
```

- [ ] **Step 5: Build the registry** — `src/themes/registry.ts`

```ts
import type { ThemeComponents } from './types';
import { tylerTheme } from './tyler';

const themes: Record<string, ThemeComponents> = {
  tyler: tylerTheme,
};

export function getTheme(name: string): ThemeComponents {
  const t = themes[name];
  if (!t) throw new Error(`Unknown theme "${name}"`);
  return t;
}
```

- [ ] **Step 6: Repoint imports in pages (paths only, no logic change)**

In `src/pages/index.astro`, change every `../components/X.astro` import to `../themes/tyler/X.astro` and `../layouts/Base.astro` to `../themes/tyler/Base.astro`. Remove the now-moved `<div class="yardline">` line from `index.astro` (it lives in Tyler's Hero now).
Search the repo for any other importer of the moved files and fix its path:

```bash
grep -rn "layouts/Base.astro\|components/\(Nav\|Hero\|Film\|Offers\|Athletics\|Positions\|Academics\|Schedule\|Contact\|Footer\)\|styles/global.css" src
```

Update each hit to the `themes/tyler/...` path. (Admin pages using `src/layouts/Admin.astro` are unaffected — only the public `Base.astro` moved.)

- [ ] **Step 7: Build + verify identical output**

Run: `npm run build`
Expected: build succeeds, no unresolved-import errors.
Then serve and screenshot `/`; compare against the pre-change page. Expected: pixel-identical (same skin, same order, yardline still under the hero).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(theming): extract Tyler skin into themes/tyler + registry (no visual change)"
```

---

### Task 3: Turn `index.astro` into the engine

Replace the hardcoded component list with registry + `buildPanelList`. Tyler still renders identically — now *through* the engine.

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `getAthleteBySlug`, `resolveOffers` (`src/lib/athlete`); `getSiteConfig` (`src/lib/site-config`); `buildPanelList`, `PANEL_COMPONENT` (`src/lib/panels`); `getTheme` (`src/themes/registry`).

- [ ] **Step 1: Rewrite `src/pages/index.astro` as the engine**

```astro
---
import { getAthleteBySlug, resolveOffers } from '../lib/athlete';
import { getSiteConfig } from '../lib/site-config';
import { buildPanelList, PANEL_COMPONENT } from '../lib/panels';
import { getTheme } from '../themes/registry';

export const prerender = false;

const slug = 'tyler-baleno';
const rec = await getAthleteBySlug(slug);
if (!rec) return new Response('Athlete not found', { status: 404 });

const { profile, cardVisibility, photoUrl } = rec;
const player = { ...profile.identity, heroPhoto: photoUrl };
const offers = await resolveOffers(profile.offers);

const { theme, arrangement } = getSiteConfig(slug);
const t = getTheme(theme);
const panels = buildPanelList({ player, profile, offers }, arrangement, cardVisibility);

const { Base, Nav, Footer } = t;
---

<Base player={player}>
  <Nav player={player} />
  <main>
    {panels.map((p) => {
      const Panel = t[PANEL_COMPONENT[p.key] as keyof typeof t];
      return <Panel {...p.props} />;
    })}
  </main>
  <Footer player={player} />
</Base>
```

- [ ] **Step 2: Build + verify still identical**

Run: `npm run build`
Expected: success. Serve + screenshot `/`; compare against Task 2's screenshot. Expected: pixel-identical — the engine reproduces the hand-written order exactly.

- [ ] **Step 3: Regression-check the pure layer against the real record (optional smoke)**

Run: `npx vitest run`
Expected: all existing + new tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat(theming): index.astro renders via engine (theme + arrangement)"
```

---

### Task 4: `themes/bare/` — a deliberately different demonstrator theme

A plain, semantic skin that implements every panel with minimal markup and system fonts. Its only job is to look nothing like Tyler's dark athletic skin, proving a theme swap is a total overhaul from the same data. It also becomes the honest starting point Angelo copies to author a real bespoke skin.

**Files:**
- Create: `src/themes/bare/Base.astro`, `src/themes/bare/index.ts`, and `src/themes/bare/{Nav,Hero,Film,Offers,Athletics,Positions,Academics,Schedule,Contact,Footer}.astro`
- Modify: `src/themes/registry.ts` (register `bare`)

**Interfaces:**
- Consumes: the same per-panel props defined in `src/lib/panels.ts` `propsFor`.
- Produces: `bareTheme: ThemeComponents`.

- [ ] **Step 1: `Base.astro`** — plain light shell, system font, no shared CSS

```astro
---
const { player } = Astro.props;
const title = `${player.first} ${player.last} — ${player.position}`;
---
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{title}</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, sans-serif;
        background: #ffffff; color: #111; line-height: 1.5; }
      main { max-width: 720px; margin: 0 auto; padding: 24px; }
      section { padding: 28px 0; border-top: 1px solid #e5e5e5; }
      h1 { font-size: 2rem; margin: 0; } h2 { font-size: 1.1rem; letter-spacing: .04em;
        text-transform: uppercase; color: #666; margin: 0 0 12px; }
      ul { margin: 0; padding-left: 18px; } a { color: #0a58ca; }
      dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 16px; margin: 0; }
      dt { color: #666; } dd { margin: 0; font-weight: 600; }
    </style>
  </head>
  <body><slot /></body>
</html>
```

- [ ] **Step 2: The ten panels** — each plain and semantic. Create each file exactly:

`Nav.astro`
```astro
---
const { player } = Astro.props;
---
<nav style="max-width:720px;margin:0 auto;padding:16px 24px;font-weight:700;">
  {player.first} {player.last}
</nav>
```

`Hero.astro`
```astro
---
const { player, headline } = Astro.props;
---
<section>
  <h1>{player.first} {player.last}</h1>
  <p>{player.position} · Class of {player.gradYear} · {player.school} ({player.location})</p>
  <dl>{headline.map((s) => (<><dt>{s.label}</dt><dd>{s.value}</dd></>))}</dl>
</section>
```

`Film.astro`
```astro
---
const { film } = Astro.props;
---
<section>
  <h2>Film</h2>
  <p><a href={film.hudlWatch}>{film.title || 'Watch film'}</a></p>
</section>
```

`Offers.astro`
```astro
---
const { offers } = Astro.props;
---
{offers.length > 0 && (
  <section>
    <h2>Offers</h2>
    <ul>{offers.map((o) => (<li>{o.school} {o.level ? `(${o.level})` : ''}</li>))}</ul>
  </section>
)}
```

`Athletics.astro`
```astro
---
const { measurables, honors } = Astro.props;
---
<section>
  <h2>Athletics</h2>
  <dl>{measurables.map((s) => (<><dt>{s.label}</dt><dd>{s.value}{s.unit ?? ''}</dd></>))}</dl>
  {honors.length > 0 && <ul>{honors.map((h) => (<li>{h}</li>))}</ul>}
</section>
```

`Positions.astro`
```astro
---
const { positions } = Astro.props;
---
<section>
  <h2>Positions</h2>
  <ul>{positions.map((p) => (<li>{p.name}{p.primary ? ' (primary)' : ''}</li>))}</ul>
</section>
```

`Academics.astro`
```astro
---
const { academics } = Astro.props;
---
<section>
  <h2>Academics</h2>
  <dl>
    <dt>GPA</dt><dd>{academics.gpa} / {academics.scale}</dd>
    <dt>Test</dt><dd>{academics.testScore.value || 'TBD'}</dd>
    <dt>Major</dt><dd>{academics.major.value || 'TBD'}</dd>
  </dl>
</section>
```

`Schedule.astro`
```astro
---
const { schedule, scheduleMeta } = Astro.props;
---
{schedule.length > 0 && (
  <section>
    <h2>Schedule — {scheduleMeta.season}</h2>
    <ul>{schedule.map((g) => (<li>{g.date} — {g.home ? 'vs' : '@'} {g.opp}</li>))}</ul>
  </section>
)}
```

`Contact.astro`
```astro
---
const { contact } = Astro.props;
---
<section>
  <h2>Contact</h2>
  <dl>
    {contact.athlete.phone && (<><dt>Phone</dt><dd>{contact.athlete.phone}</dd></>)}
    {contact.athlete.twitter && (<><dt>X</dt><dd><a href={contact.athlete.twitterUrl}>{contact.athlete.twitter}</a></dd></>)}
    {contact.hudl && (<><dt>Hudl</dt><dd><a href={contact.hudl}>Profile</a></dd></>)}
  </dl>
</section>
```

`Footer.astro`
```astro
---
const { player } = Astro.props;
---
<footer style="max-width:720px;margin:0 auto;padding:24px;color:#888;font-size:.85rem;">
  {player.first} {player.last} · Class of {player.gradYear}
</footer>
```

- [ ] **Step 3: `src/themes/bare/index.ts`**

```ts
import type { ThemeComponents } from '../types';
import Base from './Base.astro';
import Nav from './Nav.astro';
import Hero from './Hero.astro';
import Film from './Film.astro';
import Offers from './Offers.astro';
import Athletics from './Athletics.astro';
import Positions from './Positions.astro';
import Academics from './Academics.astro';
import Schedule from './Schedule.astro';
import Contact from './Contact.astro';
import Footer from './Footer.astro';

export const bareTheme: ThemeComponents = {
  Base, Nav, Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact, Footer,
};
```

- [ ] **Step 4: Register it** — edit `src/themes/registry.ts`

```ts
import { bareTheme } from './bare';
// …in the themes map:
const themes: Record<string, ThemeComponents> = {
  tyler: tylerTheme,
  bare: bareTheme,
};
```

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: success (the bare theme compiles; not yet reachable in the browser until Task 5).

- [ ] **Step 6: Commit**

```bash
git add src/themes/bare src/themes/registry.ts
git commit -m "feat(theming): bare demonstrator theme (proves total-overhaul swap)"
```

---

### Task 5: Dev preview route + prove distinctness

A dev-only page that renders Tyler's real data under any registered theme, so Angelo can view a skin while authoring it — and to prove the same data yields two unmistakably different sites.

**Files:**
- Create: `src/pages/preview/[theme].astro`

**Interfaces:**
- Consumes: `getAthleteBySlug`, `resolveOffers`, `getSiteConfig`, `buildPanelList`, `PANEL_COMPONENT`, `getTheme`.

- [ ] **Step 1: Create `src/pages/preview/[theme].astro`**

```astro
---
import { getAthleteBySlug, resolveOffers } from '../../lib/athlete';
import { getSiteConfig } from '../../lib/site-config';
import { buildPanelList, PANEL_COMPONENT } from '../../lib/panels';
import { getTheme } from '../../themes/registry';

export const prerender = false;

// Dev-only: hide in production builds.
if (!import.meta.env.DEV) return new Response('Not found', { status: 404 });

const themeName = Astro.params.theme!;
const rec = await getAthleteBySlug('tyler-baleno');
if (!rec) return new Response('Athlete not found', { status: 404 });

const { profile, cardVisibility, photoUrl } = rec;
const player = { ...profile.identity, heroPhoto: photoUrl };
const offers = await resolveOffers(profile.offers);

// Preview forces the chosen theme; arrangement stays the athlete's own.
const { arrangement } = getSiteConfig('tyler-baleno');
const t = getTheme(themeName);           // fail-loud on unknown theme
const panels = buildPanelList({ player, profile, offers }, arrangement, cardVisibility);

const { Base, Nav, Footer } = t;
---

<Base player={player}>
  <Nav player={player} />
  <main>
    {panels.map((p) => {
      const Panel = t[PANEL_COMPONENT[p.key] as keyof typeof t];
      return <Panel {...p.props} />;
    })}
  </main>
  <Footer player={player} />
</Base>
```

- [ ] **Step 2: Run the dev server and screenshot both skins**

Run: `npm run dev`
Visit `/preview/tyler` and `/preview/bare`. Screenshot each.
Expected: **same content and section order, completely different look** — Tyler dark/athletic vs bare light/plain. This is success criterion #2's mechanism proven on real data.

- [ ] **Step 3: Verify fail-loud + prod-guard**

Visit `/preview/does-not-exist` (dev): expected a 500 from `Unknown theme "does-not-exist"`.
Run `npm run build` then serve the production build and visit `/preview/bare`: expected 404 (dev-only guard holds).

- [ ] **Step 4: Commit**

```bash
git add src/pages/preview/[theme].astro
git commit -m "feat(theming): dev-only theme preview route"
```

---

### Task 6: `NEW-THEME.md` — the skin-authoring workflow

Capture the repeatable process so building athlete #2's skin is copy-and-design, not rediscovery.

**Files:**
- Create: `docs/NEW-THEME.md`

- [ ] **Step 1: Write `docs/NEW-THEME.md`**

Contents (fill with the real steps, no placeholders):
1. `cp -r src/themes/bare src/themes/<name>` — start from the plain theme.
2. Author each panel component: same props (see `src/lib/panels.ts` `propsFor`), any markup/CSS/motion you want. Keep all styles inside the theme folder; import nothing from another theme.
3. Register the theme in `src/themes/registry.ts`.
4. Preview against real data at `/preview/<name>` while you design (dev only). Use browser devtools to dial in exact visual values, then commit them (eyes find it, code commits it).
5. Assign it: add/point the athlete's entry in `src/lib/site-config.ts` (`{ theme: '<name>', arrangement }`); set `arrangement` for their position if it should differ from `DEFAULT_ARRANGEMENT`.
6. `npm run build` + screenshot `/` for that athlete to confirm.
Note the rules: every theme implements all 11 components; arrangement + theme are Angelo-only; athletes edit content + card on/off via the admin, nothing else.

- [ ] **Step 2: Commit**

```bash
git add docs/NEW-THEME.md
git commit -m "docs: NEW-THEME skin-authoring workflow"
```

---

## Self-Review

**Spec coverage:**
- Three-layer model → Foundation (Tasks 1–3), Arrangement (Task 1 `site-config`), Skin (Tasks 2, 4). ✓
- Panel contract from `types.ts` → Task 1 `propsFor` + Task 2 `ThemeComponents`. ✓
- Engine generalizing `index.astro` → Task 3. ✓
- Arrangement as Angelo-set repo-side data, filtered by `cardVisibility`, hero always on → Task 1 (`buildPanelList`, `getSiteConfig`). ✓
- Theme = folder of per-panel components; Tyler → theme #1 verbatim → Task 2. ✓
- Fail-loud theme resolution → Task 2 `getTheme`, Task 1 `getSiteConfig`, exercised in Task 5. ✓
- Themes share logic never look; every theme implements every panel → Global Constraints + Task 4 (all 11) + `docs/NEW-THEME.md`. ✓
- Prove distinctness on same data → Task 5 preview `/preview/tyler` vs `/preview/bare`. ✓
- No athlete-facing UI; content+visibility only → nothing added athlete-side; Global Constraints. ✓
- Behavior-preserving migration → Tasks 2 & 3 screenshot diffs. ✓
- Success criteria #1 (Tyler identical via engine) Task 3; #2 (second look, same data) Task 5; #3 (one theme edit can't touch another) holds by construction (separate folders, no cross-import) and is visible in Task 5; #4 (arrangement vs visibility independent) Task 1 tests; #5 (athletes can't change order/skin) Global Constraints + repo-side config. ✓

**Placeholder scan:** No "TBD/implement later" in steps. `docs/NEW-THEME.md` Step 1 lists concrete numbered content. The `testScore`/`major` "TBD" strings are the intended data-integrity placeholders, not plan gaps. OK.

**Type consistency:** `PanelKey` (site-config) used identically in `panels.ts`, tests, engine, preview. `PANEL_COMPONENT` values (`'Hero'`…`'Contact'`) match `ThemeComponents` field names (Task 2) and the `t[...]` lookups (Tasks 3, 5). `buildPanelList(ctx, arrangement, visibility)` signature identical across Task 1 impl, tests, engine, preview. `getTheme`/`getSiteConfig` fail-loud contracts consistent. `resolveOffers` returns `Offer[]` → `offers` prop typed `Offer[]` in `RenderContext` and consumed by `Offers.astro`. OK.

**Note on TDD adaptation:** pure logic (`site-config`, `panels`) is real TDD via Vitest; the `.astro` engine/theme/preview work is verified by `npm run build` + dev-server screenshots (matches how this repo already verifies visual work). Intentional.
