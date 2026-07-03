-- Public-read bucket for athlete profile photos. Write policy is broad here
-- (any authenticated user) and gets tightened to per-owner folders in Phase 3.
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

drop policy if exists "profile photos public read" on storage.objects;
create policy "profile photos public read" on storage.objects
  for select using (bucket_id = 'profile-photos');

drop policy if exists "profile photos auth write" on storage.objects;
create policy "profile photos auth write" on storage.objects
  for insert to authenticated with check (bucket_id = 'profile-photos');
