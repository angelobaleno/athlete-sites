-- trigram extension powers the schools name search index (must precede the index)
create extension if not exists pg_trgm;

-- athletes: one editable profile per recruit, stored as a JSON document
create table if not exists public.athletes (
  id              uuid primary key default gen_random_uuid(),
  owner_user_id   uuid references auth.users(id) on delete set null,
  slug            text unique not null,
  profile         jsonb not null default '{}'::jsonb,
  card_visibility jsonb not null default
    '{"film":true,"offers":true,"athletics":true,"positions":true,"academics":true,"schedule":true,"contact":true}'::jsonb,
  photo_url       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- schools: shared, read-only FBS/FCS reference for the offer picker
create table if not exists public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  short       text not null,
  level       text not null check (level in ('FBS','FCS')),
  conference  text,
  location    text,
  logo_url    text
);
create index if not exists schools_name_trgm on public.schools using gin (name gin_trgm_ops);
