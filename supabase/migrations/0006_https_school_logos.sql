-- School logos were seeded with http:// espn CDN URLs, which browsers block
-- as mixed content on the https athlete sites. The CDN serves https fine.
-- (build-schools.mjs / schools.json now emit https at the source.)
update public.schools
  set logo_url = replace(logo_url, 'http://', 'https://')
  where logo_url like 'http://%';
