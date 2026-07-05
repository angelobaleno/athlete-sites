import { getAthleteBySlug, resolveOffers } from './athlete';
import { getSiteConfig } from './site-config';
import { buildPanelList, type PanelSpec } from './panels';
import type { PlayerView } from './types';

export interface AthleteSite {
  player: PlayerView;
  panels: PanelSpec[];
}

/**
 * Everything a route needs to render one athlete's public site — except the
 * theme, which each route imports STATICALLY. That static import is what keeps
 * one athlete's global theme CSS from ever shipping on another athlete's page,
 * so this loader must never resolve theme components itself.
 */
export async function loadAthleteSite(slug: string): Promise<AthleteSite | null> {
  const rec = await getAthleteBySlug(slug);
  if (!rec) return null;

  const { profile, cardVisibility, photoUrl } = rec;
  const player: PlayerView = { ...profile.identity, heroPhoto: photoUrl };
  const offers = await resolveOffers(profile.offers);
  const { arrangement } = getSiteConfig(slug);

  return {
    player,
    panels: buildPanelList({ player, profile, offers }, arrangement, cardVisibility),
  };
}
