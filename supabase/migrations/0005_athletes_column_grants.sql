-- Column-level write scope for athletes. RLS (0002) controls WHICH ROWS the
-- owner may update; these grants control WHICH COLUMNS. Without them a
-- signed-in athlete could PATCH any column of their own row straight through
-- PostgREST — including slug (routing, Angelo-only) — bypassing the app's
-- validation entirely. Athletes edit content only:
--   profile          their content document
--   card_visibility  their card toggles
--   photo_url        their own photo reference
-- slug and any column added later stay Angelo-only (service role / SQL) by
-- default. Grants are additive per-column, so re-running is safe.
revoke update on table public.athletes from anon, authenticated;
revoke insert, delete on table public.athletes from anon, authenticated;
grant update (profile, card_visibility, photo_url)
  on table public.athletes to authenticated;
