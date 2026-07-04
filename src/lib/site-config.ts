export type PanelKey =
  | 'hero' | 'film' | 'offers' | 'athletics'
  | 'positions' | 'academics' | 'schedule' | 'contact';

export type ThemeName = string;

export interface SiteConfig {
  theme: ThemeName;
  arrangement: PanelKey[];
}

/** Body-panel order. Angelo edits this per athlete; athletes cannot. */
export const DEFAULT_ARRANGEMENT: PanelKey[] = [
  'hero', 'film', 'offers', 'athletics',
  'positions', 'academics', 'schedule', 'contact',
];

/** Repo-side, Angelo-only. Keyed by athlete slug. */
const siteConfigs: Record<string, SiteConfig> = {
  'tyler-baleno': { theme: 'tyler', arrangement: [...DEFAULT_ARRANGEMENT] },
};

export function getSiteConfig(slug: string): SiteConfig {
  const cfg = siteConfigs[slug];
  if (!cfg) throw new Error(`No site config for slug "${slug}"`);
  return cfg;
}
