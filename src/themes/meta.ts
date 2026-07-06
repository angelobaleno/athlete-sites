import type { ThemeMeta } from './types';
import { themeMeta as tyler } from './tyler/meta';
import { themeMeta as bare } from './bare/meta';

/**
 * Theme manifests, importable ANYWHERE (admin included): meta.ts files are
 * CSS-free, so this map — unlike the component registry — never links theme
 * styles onto the importing route. Static (not dev-gated) because the admin
 * needs it in production.
 */
const metas: Record<string, ThemeMeta> = { tyler, bare };

export function getThemeMeta(name: string): ThemeMeta {
  const meta = metas[name];
  if (!meta) throw new Error(`Unknown theme "${name}" (no meta registered)`);
  return meta;
}
