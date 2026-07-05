# Runbook: Add a New Athlete

The mechanics take ~30–45 minutes. The theme design work is the actual product
and takes as long as it takes (see `NEW-THEME.md`).

Placeholders below: `<slug>` like `jordan-smith`, `<domain>` like `jordansmith.com`.

## 1. Data row

Create the athlete's profile seed (copy `scripts/seed-tyler.mjs` until a
generic `new-athlete.mjs` exists — flagged as a follow-up). Every unverified
field ships as an explicit placeholder (`placeholder: true` / empty value),
**never** an invented number — false measurables can hurt a real recruit.

```bash
node --env-file=.env.local scripts/seed-<slug>.mjs
```

## 2. Login

1. Supabase dashboard → Authentication → Invite the athlete's email.
2. Link the auth user to the row:

```bash
node --env-file=.env.local scripts/link-owner.mjs <athlete-email> <slug>
```

What they can now edit is bounded twice: RLS (own row only) + column grants
(`profile`, `card_visibility`, `photo_url` only — never `slug`, never theme).

## 3. Theme (the design work)

```bash
cp -r src/themes/bare src/themes/<slug>
```

Author every panel per `NEW-THEME.md`. Rules that keep the platform honest:
no visual code shared with any other theme; every `Stat`/`Field` renders
through `phValue`; asset paths go through `assetUrl`.

## 4. Route

Copy `src/pages/s/tyler-baleno.astro` → `src/pages/s/<slug>.astro` and change
two things: the slug string and the theme import. The **static** theme import
is what keeps this athlete's CSS off every other athlete's site — never load
themes dynamically in a production route.

## 5. Config

Add the entry in `src/lib/site-config.ts`:

```ts
'<slug>': { theme: '<slug>', arrangement: [...DEFAULT_ARRANGEMENT], domains: ['<domain>'] },
```

Reorder `arrangement` per the build (QB leads with film, lineman with
measurables). Arrangement is Angelo-only by design — it lives here, not in
the DB, so athletes can't reach it.

## 6. Domain

1. Buy the domain (Namecheap/Cloudflare, ~$10–15/yr).
2. Vercel project → Settings → Domains → add `<domain>` and `www.<domain>`.
3. Add a host rewrite in `vercel.json` (create the file on first non-Tyler domain):

```json
{
  "rewrites": [
    {
      "source": "/",
      "has": [{ "type": "host", "value": "<domain>" }],
      "destination": "/s/<slug>"
    }
  ]
}
```

4. DNS per Vercel's instructions at the registrar.

## 7. Verify (all of it, before telling the family)

- [ ] `npm test && npx astro check && npm run build` — green.
- [ ] `/s/<slug>` renders locally; `/s/tyler-baleno` (and every other athlete) unchanged.
- [ ] Log in as the new athlete → dashboard shows **only** their record; saves work.
- [ ] Every unverified field renders as an em dash, not a value.
- [ ] Preview deploy: both sites; then `<domain>` resolves after DNS.
- [ ] Invariant suite passed (it runs in `npm test` when the service key is present).

## Follow-ups that shrink this runbook

- `scripts/new-athlete.mjs <slug> <profile.json>` collapsing steps 1–2.
- A route-file template if copying Tyler's ever drifts.
