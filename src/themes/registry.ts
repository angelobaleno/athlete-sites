import type { ThemeComponents } from './types';

/**
 * Theme registry — lazy by design.
 *
 * Each theme is a TOTAL overhaul that owns its own global CSS (body/:root styles
 * Astro cannot scope). If we statically imported every theme, every page would
 * bundle every theme's global CSS and the inactive themes' `body {}` rules would
 * leak onto the active page. So we load ONLY the requested theme, on demand — the
 * inactive themes' modules (and their CSS) never enter the page.
 *
 * To register a theme: add a loader here. Nothing else imports theme modules.
 */
const loaders: Record<string, () => Promise<ThemeComponents>> = {
  tyler: async () => (await import('./tyler')).tylerTheme,
  bare: async () => (await import('./bare')).bareTheme,
};

export async function getTheme(name: string): Promise<ThemeComponents> {
  const load = loaders[name];
  if (!load) throw new Error(`Unknown theme "${name}"`);
  return load();
}
