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
