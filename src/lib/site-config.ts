export type PanelKey =
  | 'hero' | 'film' | 'offers' | 'athletics'
  | 'positions' | 'academics' | 'schedule' | 'contact';

export type ThemeName = string;

export interface SiteConfig {
  theme: ThemeName;
  arrangement: PanelKey[];
  /** Custom domains that serve this athlete's site (bare form; www is implied). */
  domains: string[];
}

/** Body-panel order. Angelo edits this per athlete; athletes cannot. */
export const DEFAULT_ARRANGEMENT: PanelKey[] = [
  'hero', 'film', 'offers', 'athletics',
  'positions', 'academics', 'schedule', 'contact',
];

/** Repo-side, Angelo-only. Keyed by athlete slug. */
const siteConfigs: Record<string, SiteConfig> = {
  'tyler-baleno': {
    theme: 'tyler',
    arrangement: [...DEFAULT_ARRANGEMENT],
    domains: ['tylerbaleno.com'],
  },
};

export function getSiteConfig(slug: string): SiteConfig {
  const cfg = siteConfigs[slug];
  if (!cfg) throw new Error(`No site config for slug "${slug}"`);
  return cfg;
}

/** Tenant resolution: request hostname -> athlete slug (null = platform host). */
export function resolveSlugFromHost(hostname: string): string | null {
  const host = hostname.toLowerCase().replace(/^www\./, '');
  for (const [slug, cfg] of Object.entries(siteConfigs)) {
    if (cfg.domains.includes(host)) return slug;
  }
  return null;
}
