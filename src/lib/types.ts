export interface Stat { label: string; value: string; unit?: string; placeholder?: boolean; }
export interface Field { value: string; placeholder?: boolean; }

export interface Offer {
  // Either a reference to a seeded school…
  schoolId?: string;
  // …or a manual fallback (school not in the FBS/FCS list):
  school?: string;
  short?: string;
  level?: string;
  location?: string;
  logoUrl?: string;
}

export interface Game { date: string; opp: string; home: boolean; conf: boolean; note?: string; }

export interface AthleteProfile {
  identity: {
    first: string; last: string; position: string; positionShort: string;
    jersey: string; gradYear: string; school: string; team: string; location: string;
  };
  headline: Stat[];
  measurables: Stat[];
  honors: string[];
  film: { hudlEmbed: string; hudlWatch: string; hudlProfile: string; title: string; };
  positions: { code: string; name: string; primary: boolean; }[];
  academics: { gpa: string; scale: string; testScore: Field; major: Field; };
  offers: Offer[];
  schedule: Game[];
  scheduleMeta: { season: string; kickoff: string; homeVenue: string; };
  contact: {
    athlete: { name: string; phone: string; twitter: string; twitterUrl: string; };
    coach: { name: string; title: string; contact: string; placeholder: boolean; };
    hudl: string;
  };
}

/** The identity fields plus the resolved photo URL, as passed to components. */
export type PlayerView = AthleteProfile['identity'] & { heroPhoto: string | null };

export interface CardVisibility {
  film: boolean; offers: boolean; athletics: boolean; positions: boolean;
  academics: boolean; schedule: boolean; contact: boolean;
}

export interface AthleteRecord {
  id: string;
  slug: string;
  profile: AthleteProfile;
  cardVisibility: CardVisibility;
  photoUrl: string | null;
}

export interface School {
  id: string; name: string; short: string;
  level: 'FBS' | 'FCS'; conference: string | null;
  location: string | null; logoUrl: string | null;
}
