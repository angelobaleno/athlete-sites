import type { ThemeComponents } from './types';

/**
 * Theme registry.
 *
 * A theme owns global `body`/`:root` styles that Astro CANNOT scope. Astro links
 * every stylesheet reachable from a route (dynamic imports included), so any theme
 * reachable from a page leaks its global CSS onto that page. `tyler` is the only
 * real, shipped theme; `bare` is a dev-only demonstrator used by the `/preview`
 * route. We register `bare` ONLY in dev so it is tree-shaken out of production
 * builds — its module and CSS never reach the live site.
 *
 * To register a real (shipped) theme: add a loader to `loaders`.
 */
const loaders: Record<string, () => Promise<ThemeComponents>> = {
  tyler: async () => (await import('./tyler')).tylerTheme,
};

if (import.meta.env.DEV) {
  loaders.bare = async () => (await import('./bare')).bareTheme;
}

export async function getTheme(name: string): Promise<ThemeComponents> {
  const load = loaders[name];
  if (!load) throw new Error(`Unknown theme "${name}"`);
  return load();
}
