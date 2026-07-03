-- Row-Level Security: anyone may read a profile (public site uses anon key);
-- only the owner may update their own athletes row. Idempotent (re-runnable).
alter table public.athletes enable row level security;
alter table public.schools  enable row level security;

-- Public read of any profile (SSR public site uses the anon key)
drop policy if exists athletes_public_read on public.athletes;
create policy athletes_public_read on public.athletes
  for select using (true);

-- Owner may update only their own row
drop policy if exists athletes_owner_update on public.athletes;
create policy athletes_owner_update on public.athletes
  for update using (auth.uid() = owner_user_id)
  with check (auth.uid() = owner_user_id);

-- Public read of schools; no client writes (writes go through service role / pg only)
drop policy if exists schools_public_read on public.schools;
create policy schools_public_read on public.schools
  for select using (true);
