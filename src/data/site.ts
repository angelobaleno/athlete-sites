// ─────────────────────────────────────────────────────────────
// Tyler Baleno — recruiting profile data (single source of truth)
// Edit values here; the whole site reads from this file.
// `placeholder: true` fields render with an obvious "TBD" style so
// nothing false ever ships to a recruiter. Fill them in as verified
// numbers/assets come in, then flip placeholder to false.
// ─────────────────────────────────────────────────────────────

export interface Stat {
  label: string;
  value: string;
  unit?: string;
  placeholder?: boolean;
}

export const player = {
  first: 'Tyler',
  last: 'Baleno',
  position: 'Defensive Back',
  positionShort: 'DB',
  jersey: '3',
  gradYear: '2027',
  school: 'Plum Senior High School',
  team: 'Plum Mustangs',
  location: 'Pittsburgh, PA',
  heroPhoto: 'images/tyler-hero.jpg', // resolved against BASE_URL in Hero
  // Also plays LB / WR / TE — displaying DB only for now.
};

// The four calling-card metrics shown in the hero rail.
export const headline: Stat[] = [
  { label: 'Height', value: "6'2\"" },
  { label: 'Weight', value: '195', unit: 'lbs' },
  { label: '40 Yard', value: '4.44', unit: 'sec' },
  { label: 'GPA', value: '4.0' },
];

// Film — the single most important asset for a recruit.
export const film = {
  // Verified working embed (Tyler Baleno Junior Season).
  hudlEmbed: 'https://www.hudl.com/embed/video/3/19760495/68fac2deea707630a706ad8c',
  hudlWatch: 'https://www.hudl.com/v/2T3jkn',
  hudlProfile: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
  title: 'Junior Season Highlights',
};

// Athletic testing. HT/WT/40 verified; the rest are placeholders.
export const measurables: Stat[] = [
  { label: 'Height', value: "6'2\"" },
  { label: 'Weight · lbs', value: '195' },
  { label: '40-Yard Dash', value: '4.44s' },
  { label: 'Shuttle', value: '—', placeholder: true },
  { label: 'Vertical', value: '—', placeholder: true },
  { label: 'Bench', value: '—', placeholder: true },
];

// Season production. All placeholders until verified stats come in.
export const production: Stat[] = [
  { label: 'Tackles', value: '—', placeholder: true },
  { label: 'Interceptions', value: '—', placeholder: true },
  { label: 'Pass Breakups', value: '—', placeholder: true },
  { label: 'Forced Fumbles', value: '—', placeholder: true },
];

export const honors: string[] = [
  '1st Team All-Conference — Defensive Back',
  '2× All-Conference Selection',
];

export const academics = {
  gpa: '4.0',
  scale: '4.0 scale',
  testScore: { value: 'Available on request', placeholder: true },
  major: { value: 'To be determined', placeholder: true },
};

// College offers — the strongest external validation on the page.
export interface Offer {
  school: string;
  short: string;
  level: string;
  location: string;
}
export const offers: Offer[] = [
  { school: 'Robert Morris University', short: 'RMU', level: 'NCAA Division I · FCS', location: 'Moon Township, PA' },
];

// Positions he lines up at — versatility is a selling point. DB is primary.
export const positions = [
  { code: 'DB', name: 'Defensive Back', primary: true },
  { code: 'LB', name: 'Linebacker', primary: false },
  { code: 'WR', name: 'Wide Receiver', primary: false },
  { code: 'TE', name: 'Tight End', primary: false },
];

// 2026 senior-season schedule (source: MaxPreps, updated Jun 2026).
export const scheduleMeta = {
  season: '2026 · Senior Season',
  kickoff: '7:00 PM',
  homeVenue: 'Plum HS · 900 Elicker Rd, Pittsburgh',
};
export interface Game {
  date: string;
  opp: string;
  home: boolean;
  conf: boolean;
}
export const schedule: Game[] = [
  { date: 'Sep 4',  opp: 'Franklin Regional', home: false, conf: false },
  { date: 'Sep 11', opp: 'Fox Chapel',        home: false, conf: true  },
  { date: 'Sep 18', opp: 'Shaler Area',       home: true,  conf: true  },
  { date: 'Sep 25', opp: 'Kiski Area',        home: true,  conf: false },
  { date: 'Oct 2',  opp: 'Armstrong',         home: true,  conf: true  },
  { date: 'Oct 9',  opp: 'Moon Area',         home: true,  conf: false },
  { date: 'Oct 16', opp: 'North Hills',       home: false, conf: true  },
  { date: 'Oct 23', opp: 'Penn Hills',        home: false, conf: true  },
  { date: 'Oct 30', opp: 'Pine-Richland',     home: true,  conf: true  },
];

export const contact = {
  athlete: {
    name: 'Tyler Baleno',
    phone: '412-995-0045',
    twitter: '@TylerBaleno3',
    twitterUrl: 'https://x.com/TylerBaleno3',
  },
  coach: {
    name: 'Matt Morgan',
    title: 'Head Coach · Plum Mustangs Football',
    contact: 'Available on request',
    placeholder: false,
  },
  hudl: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
};
