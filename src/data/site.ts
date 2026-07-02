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
  gradYear: '2027',
  school: 'Plum Senior High School',
  team: 'Plum Mustangs',
  location: 'Pittsburgh, PA',
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
  hudlEmbed: 'https://www.hudl.com/embed/video/3/2T3jkn', // derived from hudl.com/v/2T3jkn
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

export const honors: string[] = ['2× All-Conference — Defensive Back'];

export const academics = {
  gpa: '4.0',
  scale: '4.0 scale',
  testScore: { value: 'Available on request', placeholder: true },
  major: { value: 'To be determined', placeholder: true },
};

export const contact = {
  athlete: {
    name: 'Tyler Baleno',
    phone: '412-995-0045',
    twitter: '@TylerBaleno3',
    twitterUrl: 'https://x.com/TylerBaleno3',
  },
  coach: {
    name: 'Head Coach — TBD',
    title: 'Plum Mustangs Football',
    contact: 'Contact info to be added',
    placeholder: true,
  },
  hudl: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
};
