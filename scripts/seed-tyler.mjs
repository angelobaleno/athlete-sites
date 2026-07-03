// Seeds Tyler Baleno's profile into public.athletes (slug 'tyler-baleno').
// Mirrors src/data/site.ts exactly; preserves every placeholder flag.
// Usage: node --env-file=.env.local scripts/seed-tyler.mjs
import pg from 'pg';

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();

// Resolve RMU to a school id for offer-picker parity.
const rmu = await c.query("select id from public.schools where name ilike '%robert morris%' limit 1");
const rmuId = rmu.rows[0]?.id ?? null;

const profile = {
  identity: {
    first: 'Tyler', last: 'Baleno', position: 'Defensive Back', positionShort: 'DB',
    jersey: '3', gradYear: '2027', school: 'Plum Senior High School',
    team: 'Plum Mustangs', location: 'Pittsburgh, PA',
  },
  headline: [
    { label: 'Height', value: `6'2"` },
    { label: 'Weight', value: '195', unit: 'lbs' },
    { label: '40 Yard', value: '4.44', unit: 'sec' },
    { label: 'GPA', value: '4.0' },
  ],
  measurables: [
    { label: 'Height', value: `6'2"` },
    { label: 'Weight · lbs', value: '195' },
    { label: '40-Yard Dash', value: '4.44s' },
    { label: 'Shuttle', value: '—', placeholder: true },
    { label: 'Vertical', value: '—', placeholder: true },
    { label: 'Bench', value: '—', placeholder: true },
  ],
  honors: [
    '1st Team All-Conference — Defensive Back',
    '2× All-Conference Selection',
  ],
  film: {
    hudlEmbed: 'https://www.hudl.com/embed/video/3/19760495/68fac2deea707630a706ad8c',
    hudlWatch: 'https://www.hudl.com/v/2T3jkn',
    hudlProfile: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
    title: 'Junior Season Highlights',
  },
  positions: [
    { code: 'DB', name: 'Defensive Back', primary: true },
    { code: 'LB', name: 'Linebacker', primary: false },
    { code: 'WR', name: 'Wide Receiver', primary: false },
    { code: 'TE', name: 'Tight End', primary: false },
  ],
  academics: {
    gpa: '4.0', scale: '4.0 scale',
    testScore: { value: 'Available on request', placeholder: true },
    major: { value: 'To be determined', placeholder: true },
  },
  offers: [
    // Pick RMU from the schools table but keep the hand-tuned level label and
    // local logo (explicit fields override the school-table defaults).
    rmuId
      ? { schoolId: rmuId, level: 'NCAA Division I · FCS', logoUrl: 'images/logos/rmu.svg' }
      : { school: 'Robert Morris University', short: 'RMU', level: 'NCAA Division I · FCS', location: 'Moon Township, PA', logoUrl: 'images/logos/rmu.svg' },
  ],
  scheduleMeta: { season: '2026 · Senior Season', kickoff: '7:00 PM', homeVenue: 'Plum HS · 900 Elicker Rd, Pittsburgh' },
  schedule: [
    { date: 'Sep 4',  opp: 'Franklin Regional', home: false, conf: false },
    { date: 'Sep 11', opp: 'Fox Chapel',        home: false, conf: true  },
    { date: 'Sep 18', opp: 'Shaler Area',       home: true,  conf: true  },
    { date: 'Sep 25', opp: 'Kiski Area',        home: true,  conf: false },
    { date: 'Oct 2',  opp: 'Armstrong',         home: true,  conf: true  },
    { date: 'Oct 9',  opp: 'Moon Area',         home: true,  conf: false },
    { date: 'Oct 16', opp: 'North Hills',       home: false, conf: true  },
    { date: 'Oct 23', opp: 'Penn Hills',        home: false, conf: true  },
    { date: 'Oct 30', opp: 'Pine-Richland',     home: true,  conf: true  },
  ],
  contact: {
    athlete: { name: 'Tyler Baleno', phone: '412-995-0045', twitter: '@TylerBaleno3', twitterUrl: 'https://x.com/TylerBaleno3' },
    coach: { name: 'Matt Morgan', title: 'Head Coach · Plum Mustangs Football', contact: 'Available on request', placeholder: false },
    hudl: 'https://www.hudl.com/profile/19760495/Tyler-Baleno',
  },
};

await c.query(
  `insert into public.athletes (slug, profile, photo_url)
   values ($1, $2, $3)
   on conflict (slug) do update set profile = excluded.profile, photo_url = excluded.photo_url, updated_at = now()`,
  ['tyler-baleno', JSON.stringify(profile), '/images/tyler-hero.jpg'],
);
console.log('Seeded tyler-baleno');
await c.end();
