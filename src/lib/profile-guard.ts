import type { AthleteProfile, Stat, Field, Offer, Game } from './types';

// The profile column is free-form jsonb; nothing in Postgres guarantees its
// shape. This guard turns whatever is stored into a renderable AthleteProfile
// so a malformed row degrades to placeholders instead of a 500. Missing
// placeholder-capable fields default to placeholder=true (renders an em dash)
// — never to something that could read as a real stat.

function str(v: unknown): string { return typeof v === 'string' ? v : ''; }
function bool(v: unknown, dflt: boolean): boolean { return typeof v === 'boolean' ? v : dflt; }
function strs(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((e): e is string => typeof e === 'string') : [];
}
function obj(v: unknown): Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>) : {};
}
function objs(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v)
    ? v.filter((e): e is Record<string, unknown> => e !== null && typeof e === 'object' && !Array.isArray(e))
    : [];
}

function stats(v: unknown): Stat[] {
  return objs(v).flatMap((o) => {
    if (typeof o.label !== 'string' || typeof o.value !== 'string') return [];
    const s: Stat = { label: o.label, value: o.value };
    if (typeof o.unit === 'string') s.unit = o.unit;
    if (typeof o.placeholder === 'boolean') s.placeholder = o.placeholder;
    return [s];
  });
}

function field(v: unknown): Field {
  const o = obj(v);
  const value = str(o.value);
  return { value, placeholder: bool(o.placeholder, value.trim() === '') };
}

export function normalizeProfile(raw: unknown): AthleteProfile {
  const p = obj(raw);
  const identity = obj(p.identity);
  const film = obj(p.film);
  const academics = obj(p.academics);
  const scheduleMeta = obj(p.scheduleMeta);
  const contact = obj(p.contact);
  const athlete = obj(contact.athlete);
  const coach = obj(contact.coach);

  return {
    identity: {
      first: str(identity.first), last: str(identity.last),
      position: str(identity.position), positionShort: str(identity.positionShort),
      jersey: str(identity.jersey), gradYear: str(identity.gradYear),
      school: str(identity.school), team: str(identity.team), location: str(identity.location),
    },
    headline: stats(p.headline),
    measurables: stats(p.measurables),
    honors: strs(p.honors),
    film: {
      hudlEmbed: str(film.hudlEmbed), hudlWatch: str(film.hudlWatch),
      hudlProfile: str(film.hudlProfile), title: str(film.title),
    },
    positions: objs(p.positions).map((o) => ({
      code: str(o.code), name: str(o.name), primary: bool(o.primary, false),
    })),
    academics: {
      gpa: str(academics.gpa), scale: str(academics.scale),
      testScore: field(academics.testScore), major: field(academics.major),
    },
    offers: objs(p.offers) as Offer[],
    schedule: objs(p.schedule).map((o): Game => {
      const g: Game = {
        date: str(o.date), opp: str(o.opp),
        home: bool(o.home, false), conf: bool(o.conf, false),
      };
      if (typeof o.note === 'string') g.note = o.note;
      return g;
    }),
    scheduleMeta: {
      season: str(scheduleMeta.season), kickoff: str(scheduleMeta.kickoff),
      homeVenue: str(scheduleMeta.homeVenue),
    },
    contact: {
      athlete: {
        name: str(athlete.name), phone: str(athlete.phone),
        twitter: str(athlete.twitter), twitterUrl: str(athlete.twitterUrl),
      },
      coach: {
        name: str(coach.name), title: str(coach.title), contact: str(coach.contact),
        placeholder: bool(coach.placeholder, str(coach.contact).trim() === ''),
      },
      hudl: str(contact.hudl),
    },
  };
}
