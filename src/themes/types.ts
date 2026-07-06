import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

/**
 * Editing-relevant parameters a theme declares about itself. Lives in the
 * theme's CSS-free meta.ts (NOT the component barrel) so the admin can read
 * it without linking the theme's global CSS onto /admin. Extensible.
 */
export interface ThemeMeta {
  /** width/height of the hero photo frame, e.g. 4/5 for portrait. */
  heroPhotoAspectRatio: number;
  /** The athlete's colors, so their /admin wears their site's brand. */
  brand: ThemeBrand;
}

/**
 * A theme's admin color palette — the values behind the admin's `--a-*` tokens.
 * COLORS ONLY on purpose: fonts and radius stay shared, so every athlete's admin
 * has one consistent shape and only its color changes. These are DATA (no CSS),
 * so the admin can adopt them without importing the theme's stylesheet.
 */
export interface ThemeBrand {
  bg: string; surface: string; surface2: string; line: string;
  text: string; muted: string; accent: string; accentHi: string; danger: string;
}

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
