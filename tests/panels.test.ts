import { describe, it, expect } from 'vitest';
import { buildPanelList, PANEL_COMPONENT } from '../src/lib/panels';
import { DEFAULT_ARRANGEMENT } from '../src/lib/site-config';
import type { CardVisibility } from '../src/lib/types';

const allVisible: CardVisibility = {
  film: true, offers: true, athletics: true, positions: true,
  academics: true, schedule: true, contact: true,
};

// Minimal but type-shaped context.
const ctx = {
  player: { first: 'Tyler', last: 'Baleno', position: 'Defensive Back',
    positionShort: 'DB', jersey: '3', gradYear: '2027', school: 'Plum',
    team: 'Plum', location: 'Pittsburgh, PA', heroPhoto: null },
  profile: {
    identity: {} as any,
    headline: [{ label: 'HT', value: `6'2"` }],
    measurables: [{ label: '40', value: '4.44' }],
    honors: ['2x All-Conference DB'],
    film: { hudlEmbed: 'e', hudlWatch: 'w', hudlProfile: 'p', title: 't' },
    positions: [{ code: 'DB', name: 'Defensive Back', primary: true }],
    academics: { gpa: '4.0', scale: '4.0', testScore: { value: '' }, major: { value: '' } },
    offers: [],
    schedule: [],
    scheduleMeta: { season: '2026', kickoff: '7:00 PM', homeVenue: 'Plum' },
    contact: { athlete: { name: 'Tyler Baleno', phone: '', twitter: '', twitterUrl: '' },
      coach: { name: '', title: '', contact: '', placeholder: true }, hudl: '' },
  } as any,
  offers: [],
};

describe('buildPanelList', () => {
  it('returns every panel in arrangement order when all visible', () => {
    const list = buildPanelList(ctx as any, DEFAULT_ARRANGEMENT, allVisible);
    expect(list.map((p) => p.key)).toEqual(DEFAULT_ARRANGEMENT);
  });
  it('always keeps hero even though it has no visibility flag', () => {
    const hidden: CardVisibility = { film: false, offers: false, athletics: false,
      positions: false, academics: false, schedule: false, contact: false };
    const list = buildPanelList(ctx as any, DEFAULT_ARRANGEMENT, hidden);
    expect(list.map((p) => p.key)).toEqual(['hero']);
  });
  it('omits only the panels toggled off, preserving order', () => {
    const v = { ...allVisible, offers: false, schedule: false };
    const list = buildPanelList(ctx as any, DEFAULT_ARRANGEMENT, v);
    expect(list.map((p) => p.key)).toEqual(
      ['hero', 'film', 'athletics', 'positions', 'academics', 'contact']);
  });
  it('builds hero props from player + headline', () => {
    const hero = buildPanelList(ctx as any, ['hero'], allVisible)[0];
    expect(hero.props).toEqual({ player: ctx.player, headline: ctx.profile.headline });
  });
  it('builds athletics props from measurables + honors', () => {
    const a = buildPanelList(ctx as any, ['athletics'], allVisible)[0];
    expect(a.props).toEqual({ measurables: ctx.profile.measurables, honors: ctx.profile.honors });
  });
  it('maps every panel key to a component field name', () => {
    for (const key of DEFAULT_ARRANGEMENT) {
      expect(typeof PANEL_COMPONENT[key]).toBe('string');
    }
  });
});
