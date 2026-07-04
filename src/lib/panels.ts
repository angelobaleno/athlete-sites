import type { AthleteProfile, PlayerView, Offer, CardVisibility } from './types';
import type { PanelKey } from './site-config';

export interface RenderContext {
  player: PlayerView;
  profile: AthleteProfile;
  offers: Offer[];
}

export interface PanelSpec {
  key: PanelKey;
  props: Record<string, unknown>;
}

/** Panel key -> the field name in a theme's ThemeComponents. */
export const PANEL_COMPONENT: Record<PanelKey, string> = {
  hero: 'Hero', film: 'Film', offers: 'Offers', athletics: 'Athletics',
  positions: 'Positions', academics: 'Academics', schedule: 'Schedule', contact: 'Contact',
};

/** Non-hero panels map 1:1 to a CardVisibility flag; hero is always shown. */
function isVisible(key: PanelKey, v: CardVisibility): boolean {
  if (key === 'hero') return true;
  return v[key];
}

function propsFor(key: PanelKey, ctx: RenderContext): Record<string, unknown> {
  const { player, profile, offers } = ctx;
  switch (key) {
    case 'hero':      return { player, headline: profile.headline };
    case 'film':      return { film: profile.film };
    case 'offers':    return { offers };
    case 'athletics': return { measurables: profile.measurables, honors: profile.honors };
    case 'positions': return { positions: profile.positions };
    case 'academics': return { academics: profile.academics };
    case 'schedule':  return { schedule: profile.schedule, scheduleMeta: profile.scheduleMeta };
    case 'contact':   return { contact: profile.contact, player };
  }
}

export function buildPanelList(
  ctx: RenderContext, arrangement: PanelKey[], visibility: CardVisibility,
): PanelSpec[] {
  return arrangement
    .filter((key) => isVisible(key, visibility))
    .map((key) => ({ key, props: propsFor(key, ctx) }));
}
