# Athlete Sites — Business & Hosting

**Date:** 2026-07-03
**Owner:** Angelo
**Scope:** How the Athlete Sites service is hosted, run, and sold. (Athlete Sites is the umbrella platform + shared Supabase backend; each athlete — Tyler first — is one site/record in it.) Product/design decisions live in `DESIGN.md` and the specs under `docs/`; this file is the money-and-hosting side, kept in one place.

---

## The model: hosted service (Option A)

Angelo hand-builds each athlete's site and **hosts it himself** under his own accounts. The athlete never touches hosting or code — they get a login to their admin panel and manage their own content. Angelo keeps control of the design, the infrastructure, and the recurring relationship.

This is a **service, not a code handoff.** The athlete is a subscriber, not an owner. It matches the locked product rule — *Angelo designs, the athlete maintains* — and the architecture already supports it: one shared Supabase backend, no public signup, each athlete isolated to their own record by Row-Level Security. Adding athlete #2 is a new skin + a new record, not new infrastructure.

(Rejected alternative — Option B: transfer the whole project to the athlete's own accounts for a one-time fee. Cleaner break, but loses recurring income and design control, and adds handoff work. Not the direction.)

## What it runs on

| Piece | Service | Cost to Angelo |
|---|---|---|
| The site + live server-side rendering | **Vercel** | Free (Hobby); ~$20/mo Pro only if outgrown |
| Database, login, photo storage | **Supabase** | Free tier covers many small sites; ~$25/mo Pro when bigger |
| Web address (e.g. `tylerbaleno.com`) | Namecheap / Cloudflare | ~$10–15 per **year** |

Per-site running cost today: about **$0–$15/year**. One shared Vercel + Supabase pair serves every athlete.

---

## How to charge: setup fee + subscription

Two buckets, because the work splits cleanly:

- **One-time setup fee** — pays for the design and build (bespoke skin, loading their data, wiring their domain). This is the labor.
- **Recurring subscription** — pays for hosting, the admin panel staying live, and Angelo being on call for small changes. This is the part that compounds.

### Starting price menu

| Tier | Setup (one-time) | Subscription |
|---|---|---|
| Starter | $150–$250 | $15/mo or $150/yr |
| **Standard** (default) | $300–$400 | $25/mo or $250/yr |
| Premium (custom domain, extra pages, film section) | $500+ | $40/mo or $400/yr |

Push **annual** billing ("2 months free if you pay yearly") — cash up front, fewer cancellations. On a Standard plan the running cost is near zero, so the subscription is almost all margin.

Context: families already spend thousands on recruiting services (NCSA etc.). A clean personal site is a premium-feeling product at an accessible price.

## Collecting the money

Don't build a payment system — plug one in.

- **Stripe** — the default. **Payment Links** let you charge with zero code to start (make a link, they enter a card, it auto-renews). **Billing** handles subscriptions. Wire it into the admin panel later; not needed to begin.
- **Lemon Squeezy / Paddle** — "merchant of record" services that take a bigger cut but handle sales tax for you.

**Start with Stripe Payment Links.** Manual and five minutes to set up. Automate only once there are paying customers proving the model.

## Practical notes at this stage

- **Prove before plumbing.** Get one or two paying athletes through a manual link before writing any Stripe integration.
- **Taxes exist.** Money in is income — keep a record. Not urgent at $200, but not invisible either.
- **Set a changes boundary.** Subscription covers hosting + self-serve edits in the panel; a redesign of a section costs extra. Otherwise "can you just tweak this?" eats time for free.
- **Tyler is the $0 case study.** Free site → real testimonial + a live example to show the next family. That first link is worth more than the first $200.
