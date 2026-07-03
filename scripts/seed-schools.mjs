// Inserts scripts/schools.json into public.schools (idempotent: clears then inserts).
// Usage: node --env-file=.env.local scripts/seed-schools.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const file = join(dirname(fileURLToPath(import.meta.url)), 'schools.json');
const rows = JSON.parse(readFileSync(file, 'utf8'));

const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await c.connect();
await c.query('delete from public.schools');

const placeholders = [];
const values = [];
rows.forEach((r, i) => {
  const b = i * 6;
  placeholders.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
  values.push(r.name, r.short, r.level, r.conference, r.location, r.logoUrl);
});
await c.query(
  `insert into public.schools (name,short,level,conference,location,logo_url) values ${placeholders.join(',')}`,
  values,
);
const cnt = await c.query('select count(*)::int n from public.schools');
console.log(`Seeded ${cnt.rows[0].n} schools`);
await c.end();
