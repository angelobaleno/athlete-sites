import type { ThemeComponents } from './types';
import { tylerTheme } from './tyler';
import { bareTheme } from './bare';

const themes: Record<string, ThemeComponents> = {
  tyler: tylerTheme,
  bare: bareTheme,
};

export function getTheme(name: string): ThemeComponents {
  const t = themes[name];
  if (!t) throw new Error(`Unknown theme "${name}"`);
  return t;
}
