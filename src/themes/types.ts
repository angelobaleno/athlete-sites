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
