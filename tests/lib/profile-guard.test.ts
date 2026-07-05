import { describe, it, expect } from 'vitest';
import { normalizeProfile } from '../../src/lib/profile-guard';
import type { AthleteProfile } from '../../src/lib/types';

const full: AthleteProfile = {
  identity: {
    first: 'Tyler', last: 'Baleno', position: 'Defensive Back', positionShort: 'DB',
    jersey: '3', gradYear: '2027', school: 'Plum Senior High School',
    team: 'Plum Mustangs', location: 'Pittsburgh, PA',
  },
  headline: [{ label: 'HT', value: `6'2"` }],
  measurables: [{ label: '40', value: '4.44' }],
  honors: ['2x All-Conference DB'],
  film: { hudlEmbed: 'https://x', hudlWatch: 'https://x', hudlProfile: 'https://x', title: 'Junior Season' },
  positions: [{ code: 'DB', name: 'Defensive Back', primary: true }],
  academics: { gpa: '4.0', scale: '4.0', testScore: { value: '', placeholder: true }, major: { value: '', placeholder: true } },
  offers: [{ schoolId: 'rmu' }],
  schedule: [{ date: '2026-08-28', opp: 'Penn Hills', home: true, conf: true }],
  scheduleMeta: { season: '2026', kickoff: '7:00 PM', homeVenue: 'Mustang Stadium' },
  contact: {
    athlete: { name: 'Tyler Baleno', phone: '412-995-0045', twitter: '@TylerBaleno3', twitterUrl: 'https://x.com/TylerBaleno3' },
    coach: { name: '', title: '', contact: '', placeholder: true },
    hudl: 'https://x',
  },
};

describe('normalizeProfile', () => {
  it('passes a complete profile through unchanged', () => {
    expect(normalizeProfile(full)).toEqual(full);
  });

  it('turns a totally empty document into a renderable profile', () => {
    const p = normalizeProfile({});
    expect(p.identity.first).toBe('');
    expect(p.headline).toEqual([]);
    expect(p.offers).toEqual([]);
    expect(p.schedule).toEqual([]);
    expect(p.honors).toEqual([]);
    expect(p.positions).toEqual([]);
    expect(p.film.hudlEmbed).toBe('');
    expect(p.scheduleMeta.season).toBe('');
    expect(p.contact.athlete.name).toBe('');
  });

  it('defaults missing placeholder-capable fields to placeholder (em dash, never a fake value)', () => {
    const p = normalizeProfile({});
    expect(p.academics.testScore).toEqual({ value: '', placeholder: true });
    expect(p.academics.major).toEqual({ value: '', placeholder: true });
    expect(p.contact.coach.placeholder).toBe(true);
  });

  it('repairs wrong-typed sections instead of crashing', () => {
    const p = normalizeProfile({ headline: 'not-an-array', identity: 42, film: null });
    expect(p.headline).toEqual([]);
    expect(p.identity.last).toBe('');
    expect(p.film.title).toBe('');
  });

  it('drops junk entries from stat lists but keeps valid ones', () => {
    const p = normalizeProfile({ headline: [{ label: 'HT', value: `6'2"` }, 'junk', null, { nope: 1 }] });
    expect(p.headline).toEqual([{ label: 'HT', value: `6'2"` }]);
  });

  it('handles non-object input entirely', () => {
    expect(normalizeProfile(null).identity.first).toBe('');
    expect(normalizeProfile('x').offers).toEqual([]);
  });
});
