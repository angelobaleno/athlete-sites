// Fetches FBS + FCS teams from CollegeFootballData and writes scripts/schools.json.
// FBS: /teams/fbs. FCS: /teams filtered by classification==='fcs'.
// Usage: node --env-file=.env.local scripts/build-schools.mjs
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const KEY = process.env.CFBD_KEY;
if (!KEY) throw new Error('Set CFBD_KEY (free key from collegefootballdata.com)');
const headers = { Authorization: `Bearer ${KEY}` };

const norm = (t, level) => ({
  name: t.school,
  short: t.abbreviation || t.school.replace(/[^A-Za-z]/g, '').slice(0, 4).toUpperCase(),
  level,
  conference: t.conference ?? null,
  location: t.location && t.location.city && t.location.state
    ? `${t.location.city}, ${t.location.state}` : null,
  logoUrl: Array.isArray(t.logos) && t.logos.length ? t.logos[0] : null,
});

const fbsRes = await fetch('https://api.collegefootballdata.com/teams/fbs?year=2025', { headers });
if (!fbsRes.ok) throw new Error(`FBS fetch ${fbsRes.status}`);
const fbs = (await fbsRes.json()).map((t) => norm(t, 'FBS'));

const allRes = await fetch('https://api.collegefootballdata.com/teams', { headers });
if (!allRes.ok) throw new Error(`teams fetch ${allRes.status}`);
const fcs = (await allRes.json()).filter((t) => t.classification === 'fcs').map((t) => norm(t, 'FCS'));

const all = [...fbs, ...fcs];
const out = join(dirname(fileURLToPath(import.meta.url)), 'schools.json');
writeFileSync(out, JSON.stringify(all, null, 2));
console.log(`Wrote ${all.length} schools (FBS ${fbs.length}, FCS ${fcs.length})`);
