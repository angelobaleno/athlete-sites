// Applies supabase/migrations/*.sql in filename order via a direct Postgres
// connection (DATABASE_URL). Run: node --env-file=.env.local scripts/migrate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
for (const f of files) {
  const sql = readFileSync(join(dir, f), 'utf8');
  process.stdout.write(`applying ${f} ... `);
  await client.query(sql);
  console.log('ok');
}
await client.end();
console.log(`Applied ${files.length} migration(s)`);
