# Authoring a New Athlete's Theme

This workflow covers creating a custom theme skin for a new athlete, reusing and adapting the design system.

## Step 1: Start from the bare theme

Copy the plain-slate theme as your starting point:

```bash
cp -r src/themes/bare src/themes/<name>
```

Replace `<name>` with a short identifier (e.g., `morgan`, `casey`). This gives you all 11 required components with zero styling — a clean slate to customize.

## Step 2: Author each panel component

Each theme is a folder exporting 11 Astro components. The folder structure is:

```
src/themes/<name>/
  Base.astro
  Nav.astro
  Hero.astro
  Film.astro
  Offers.astro
  Athletics.astro
  Positions.astro
  Academics.astro
  Schedule.astro
  Contact.astro
  Footer.astro
  index.ts
```

Every component must be authored — even if its body is minimal. See `src/lib/panels.ts` for the exact props each panel receives:

| Component | Props | Notes |
|-----------|-------|-------|
| `Base` | `player` | Wraps the entire page; controls the HTML skeleton, fonts, layout. |
| `Nav` | `player` | Top navigation or header. |
| `Hero` | `player`, `headline` | Always shown; the "above the fold" opener. |
| `Film` | `film` | Video embed or media. |
| `Offers` | `offers` | Array of recruiting offers. |
| `Athletics` | `measurables`, `honors` | Physical stats and achievements. |
| `Positions` | `positions` | Array of eligible positions. |
| `Academics` | `academics` | Academic profile (GPA, test scores, major). |
| `Schedule` | `schedule`, `scheduleMeta` | Game/event schedule data. |
| `Contact` | `contact`, `player` | Contact form or contact details. |
| `Footer` | `player` | Page footer. |

Keep all styles (CSS, Tailwind, or plain style tags) inside the theme folder. Import nothing from another theme — each theme is self-contained.

Example for a minimal `Hero.astro`:

```astro
---
const { player, headline } = Astro.props;
---

<section style="padding: 3rem; text-align: center;">
  <h1>{player.first} {player.last}</h1>
  <p>{player.position}</p>
  {headline && <p>{headline}</p>}
</section>
```

## Step 3: Register the theme

Add your theme to the themes registry so the engine can find it.

Edit `src/themes/registry.ts` and import your new theme:

```typescript
import type { ThemeComponents } from './types';
import { tylerTheme } from './tyler';
import { bareTheme } from './bare';
import { <name>Theme } from './<name>';  // Add this line

const themes: Record<string, ThemeComponents> = {
  tyler: tylerTheme,
  bare: bareTheme,
  <name>: <name>Theme,  // Add this line
};

export function getTheme(name: string): ThemeComponents {
  const t = themes[name];
  if (!t) throw new Error(`Unknown theme "${name}"`);
  return t;
}
```

Then in `src/themes/<name>/index.ts`, export your theme exactly as shown in `bare`:

```typescript
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

export const <name>Theme: ThemeComponents = {
  Base, Nav, Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact, Footer,
};
```

## Step 4: Preview while designing

Start the dev server and preview your theme against real athlete data:

```bash
npm run dev
```

Visit `http://localhost:3000/preview/<name>` in your browser. This page renders your theme with Tyler's actual data, so you see real content flowing through your components.

Use browser DevTools (Inspector, responsive mode, etc.) to dial in exact spacing, colors, typography, and motion. When you find a value that works, commit it to the component's CSS.

The preview is dev-only and hidden in production builds, so you can iterate freely without side effects.

## Step 5: Assign the theme to an athlete

Once your theme is polished, assign it to an athlete by editing `src/lib/site-config.ts`:

```typescript
const siteConfigs: Record<string, SiteConfig> = {
  'tyler-baleno': { theme: 'tyler', arrangement: [...DEFAULT_ARRANGEMENT] },
  '<athlete-slug>': { theme: '<name>', arrangement: [...DEFAULT_ARRANGEMENT] },  // Add this
};
```

Replace `<athlete-slug>` with the athlete's slug (e.g., `morgan-jones`, `casey-smith`).

If the athlete's position warrants a different panel order, customize `arrangement`:

```typescript
'<athlete-slug>': {
  theme: '<name>',
  arrangement: ['hero', 'film', 'athletics', 'offers', 'positions', 'academics', 'schedule', 'contact'],
},
```

Otherwise, `[...DEFAULT_ARRANGEMENT]` keeps the standard order defined in `src/lib/site-config.ts` (hero, film, offers, athletics, positions, academics, schedule, contact).

## Step 6: Build and verify

Build the production site and view the athlete's live page:

```bash
npm run build
```

Open the athlete's site (e.g., `http://localhost:3000/<athlete-slug>` after serving the built files) to confirm the theme renders correctly with their real content and no console errors.

---

## Rules

- **All 11 components are required.** Every theme implements every component — Base, Nav, Hero, Film, Offers, Athletics, Positions, Academics, Schedule, Contact, Footer. Even if a component is visually minimal, it must exist and export valid Astro markup.
- **Theme and arrangement are repo-side only.** Angelo edits `src/lib/site-config.ts` to set an athlete's theme and panel order. Athletes cannot change these.
- **Athletes control content and visibility only.** Athletes edit an athlete's name, stats, offers, schedule, etc., and toggle cards on/off via the admin UI. They cannot edit theme name, arrangement, or any design elements.
- **Themes are self-contained.** Every theme folder holds all its own CSS, typography, and layout logic. Never import components or styles from another theme folder.
