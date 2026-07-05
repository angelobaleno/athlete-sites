import type { ThemeComponents } from './types';

/**
 * Theme registry — DEV/PREVIEW ONLY.
 *
 * A theme owns global `body`/`:root` styles that Astro CANNOT scope. Astro
 * links every stylesheet reachable from a route (dynamic imports included),
 * so any route that can reach two themes ships both themes' global CSS. That
 * is why production routes NEVER use this registry: each athlete has a route
 * file (src/pages/s/<slug>.astro) that statically imports exactly one theme.
 *
 * The registry only powers the dev-only /preview/[theme] route. Register
 * every theme here (dev-gated) so it can be previewed against Tyler's data.
 */
const loaders: Record<string, () => Promise<ThemeComponents>> = {};

if (import.meta.env.DEV) {
  loaders.tyler = async () => (await import('./tyler')).tylerTheme;
  loaders.bare = async () => (await import('./bare')).bareTheme;
}

export async function getTheme(name: string): Promise<ThemeComponents> {
  const load = loaders[name];
  if (!load) throw new Error(`Unknown theme "${name}"`);
  return load();
}
