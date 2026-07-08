# Athlete Sites — Go-to-Market Brief

**Date:** 2026-07-05
**Owner:** Angelo
**Scope:** Who buys, what they're buying, how to get the first ten, what to charge, and the 90-day sequence. Money mechanics and hosting live in `BUSINESS.md`; this file is the selling side. Written off the 2026-07-05 engineering + market audit.

---

## Positioning

**The buyer is the parent.** Almost always the one already writing checks for camps, 7v7, and trainers. The athlete is the champion — he wants it because it looks like status — but the parent pays.

**What they're actually buying:** not "a website." The first impression, compressed into one link. When a coach gives their kid 60 seconds, everything — film, verified numbers, GPA, contact — is one tap away and looks like he's already committed somewhere.

**One-liner:**

> One link with everything a coach needs — film, numbers, grades — designed like he's already committed.

**Against NCSA and the exposure services ($1,500–$4,000+):** don't compete. They sell *exposure*; this sells *presentation*. The pitch is that a personal site makes everything the family already pays for — camps, DMs, questionnaires — land better. Never price-anchor against NCSA; anchor against one camp weekend.

**The moat is the design.** Template sites (Hudl profiles, About.me-style builders) exist; nothing at this level of craft does at this price. Every site is a portfolio piece for the next sale.

## Pricing verdict

The `BUSINESS.md` subscription is right — **$25/mo, push $250/yr annual hard** ("two months free"). The setup fee is underpriced for bespoke work. A Tyler-grade skin is days of design; $300 caps volume at a bad hourly rate.

Two lanes, matching the architecture:

| Lane | Setup | What it is |
|---|---|---|
| **Standard** | **$350** | Adapted skin — copy an existing theme folder and restyle (~1 day, still zero shared visual code) |
| **Premium** | **$750+** | Fully bespoke skin from scratch (what Tyler got) + custom domain |

**Founder pricing for athletes #2–3:** $250 setup, honestly framed ("first three families"), in exchange for a testimonial and a before/after post. Raise to list after.

**The boundary, in writing, on a one-page order form:** subscription covers hosting, the admin panel, and up to 30 min/month of small tweaks; new sections or visual changes are quoted separately. That sentence is what stops "can you just tweak this" from eating the margin.

**Billing:** manual Stripe Payment Links until ~5 paying families; automate at ~10, not before. Compliance line item: Vercel Hobby prohibits commercial use — **Vercel Pro (~$20/mo) starts when the first invoice does.**

**Unit math to keep honest:** expected customer life is ~18–30 months (recruiting ends at signing day), so lifetime value ≈ setup + 1–2 years of subscription ≈ $600–$1,250. Ten athletes ≈ $3,500 in setup + $2,500/yr recurring. Fifty ≈ $12,500/yr recurring. Volume and referrals matter more than fighting churn.

## Acquisition — the first ten, ranked by effort-to-payoff

1. **Tyler's launch moment (free, first).** Site link pinned in his X bio + a launch graphic Angelo designs that Tyler posts. Recruits follow recruits; WPIAL sees it in days. Ask Tyler directly for the 3 teammates whose parents are most invested.
2. **Plum's coaches.** Coach Young and Coach Jacobs are already tagged in Tyler's recruiting posts. Show them the live site. A coach forwarding it to a parent group chat is worth more than any ad; one coach = a roster.
   - *Coach-facing pitch deck built 2026-07-08* (phone-first, 7 slides, in the product's skin, anchored on Tyler's live card): https://claude.ai/code/artifact/c4661028-5c34-41fc-84b2-8fa7f3dcc636 — walk a coach through it or send the link.
3. **Founder pricing to close #2–3 fast** (see Pricing). Manufacture the proof wall.
4. **Post the craft on X.** Before/afters, motion clips, build threads from the design account. Athletes repost anything that makes them look good; every repost is an ad with a live demo attached.
5. **Targeted DMs to WPIAL recruits with active offer buzz** (higher effort — after 1–4). The message, plain:

> I built Tyler Baleno's recruiting site — tylerbaleno.com. I do these for WPIAL athletes: you update it yourself, coaches get one link with film, numbers, and grades. $350 to build, $250/yr to run. Want one for [name]?

## Retention — the honest version

Churn here is **structural**: a 2027 kid's recruitment ends at signing day. Plan around it instead of fighting it:

- **Annual prepay** carries families past mid-season wobbles and season's end.
- **At signing day, don't fight the cancel.** Offer a $50/yr "legacy" archive or a clean sunset with an export. The goodwill converts into the younger-sibling and teammate referral — the referral *is* the retention strategy at the portfolio level.
- **The one feature to build** (engineering crossover): **coach-view analytics.** A per-athlete views log (small Supabase table written from the public route, keyed by slug — the multi-tenant seam already exists) plus a monthly email: *"Your site was viewed 34 times this month, including 6 from university networks."* ~1–2 days of build on infrastructure already in place. It's the only thing that makes a parent feel the $25/mo working between edits, and no template competitor has it.

## 90-day sequence

**Weeks 1–2** — Ship the hardened platform (done 2026-07-05: security migrations, offers editor fixes, multi-tenant seam, runbook). Push live. Set up Stripe Payment Links (30 min).
**Weeks 3–4** — Tyler's public launch moment (graphic + bio link). Coach conversations at Plum. Founder-pricing offers out to 3 named families. Apex domain becomes a one-page pitch site with Tyler as the showcase.
**Month 2** — Close athletes #2–3. Run `docs/NEW-ATHLETE.md` for real and time it. Vercel Pro when the first payment lands. Collect the Tyler-family testimonial.
**Month 3** — Raise to list pricing ($350/$750). Build coach-view analytics. Ask every paying family for exactly one referral. **Target: 5 paying by end of quarter** ≈ $2,750 booked, ~$1,250/yr recurring baseline — and a repeatable machine, which matters more than the number.

## Where engineering meets revenue

| Revenue idea | Engineering dependency | Build cost |
|---|---|---|
| Coach-view analytics (retention) | Views table + monthly email (Vercel cron) | ~1–2 days |
| Custom domain per athlete (Premium tier) | Done — host map + `/s/` routes + rewrite | Runbook step |
| Offer-announcement graphics (acquisition loop) | None — design workflow, site data as input | Per-graphic |
| Service pitch page at the apex domain | Replaces `index.astro` default tenant | ~1 day design |

*Cut 2026-07-08: athlete-facing card visibility toggles. Cards already render only when they have data and omit when empty, so a manual on/off switch added maintenance surface without a real job. Athletes edit content; show/hide is automatic.*
