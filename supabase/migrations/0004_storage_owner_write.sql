-- Tighten profile-photo writes to the owner's own folder. 0003 allowed ANY
-- authenticated user to insert ANY object in the bucket (flagged there as
-- "tighten in Phase 3") — a cross-athlete write surface. Photo objects live
-- at <athlete_id>/<filename>; a signed-in user may write only inside folders
-- of athlete rows they own. Public read (0003) is unchanged.
drop policy if exists "profile photos auth write" on storage.objects;

drop policy if exists "profile photos owner insert" on storage.objects;
create policy "profile photos owner insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] in
      (select id::text from public.athletes where owner_user_id = auth.uid())
  );

drop policy if exists "profile photos owner update" on storage.objects;
create policy "profile photos owner update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] in
      (select id::text from public.athletes where owner_user_id = auth.uid())
  )
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] in
      (select id::text from public.athletes where owner_user_id = auth.uid())
  );

drop policy if exists "profile photos owner delete" on storage.objects;
create policy "profile photos owner delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] in
      (select id::text from public.athletes where owner_user_id = auth.uid())
  );
