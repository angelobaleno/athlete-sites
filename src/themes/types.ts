import type { AstroComponentFactory } from 'astro/runtime/server/index.js';

/**
 * Editing-relevant parameters a theme declares about itself. Lives in the
 * theme's CSS-free meta.ts (NOT the component barrel) so the admin can read
 * it without linking the theme's global CSS onto /admin. Extensible.
 */
export interface ThemeMeta {
  /** width/height of the hero photo frame, e.g. 4/5 for portrait. */
  heroPhotoAspectRatio: number;
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
