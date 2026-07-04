# Tyler Baleno — Recruiting Site (Design Spec)

> **Scope note (2026-07-04):** This file is now **Tyler's athlete record** (his verified data + the original single-site direction), not the platform architecture. Current platform/theming architecture lives in `docs/superpowers/specs/` — see `2026-07-04-theming-architecture-design.md`.

**Date:** 2026-07-02
**Owner:** Angelo (building for cousin Tyler)
**Purpose:** A recruiting portfolio site that presents Tyler to college football recruiters — physicals, film, stats, academics, contact. The recruiter is the sole audience; every choice serves "can a coach evaluate him in 60 seconds."

## The player (real data)

Source of truth: Tyler's X bio (@TylerBaleno3), viewed 2026-07-02. Bio line is the current/updated set; his pinned Oct-2025 post shows older numbers (180 / 3.8) — **use bio numbers**.

| Field | Value | Status |
|---|---|---|
| Name | Tyler Baleno | ✅ |
| Position (display) | Defensive Back | ✅ (also plays LB/WR/TE; DB only for now) |
| Class | 2027 (grad Spring 2027) | ✅ |
| Height / Weight | 6'2" / 195 lbs | ✅ |
| 40 time | 4.44 | ✅ |
| GPA | 4.0 | ✅ |
| Honors | 2x All-Conference DB | ✅ |
| School | Plum Senior High School, Pittsburgh PA | ✅ |
| Film (Hudl) | hudl.com/v/2T3jkn (profile: hudl.com/profile/19760495) | ✅ |
| Phone | 412-995-0045 | ✅ |
| X / Twitter | @TylerBaleno3 | ✅ |
| Season stats (tackles/INT/PBU) | — | ⛔ PLACEHOLDER |
| Combine (shuttle/vert/bench) | — | ⛔ PLACEHOLDER |
| Test scores / intended major | — | ⛔ PLACEHOLDER |
| Coach reference (name + contact) | tagged: @Coach_TJYoung, @CoachMJacobs34 | ⛔ PLACEHOLDER |
| Photos (headshot + action) | — | ⛔ PLACEHOLDER |

**Integrity rule:** unverified numbers ship as obvious placeholders, never as invented stats. False measurables are the one thing that can actively hurt a recruit.

## Direction

Modern recruit-card energy — dark, premium, athletic (On3/247 profile but sharper). NOT a school-project look. Blended with Plum's real identity.

**Palette (Plum school colors):**
- Base charcoal `#0E0E10`, surfaces `#17161A` / `#1C1B20`
- Plum purple (primary accent) `#6C4AA0`
- Plum gold (secondary accent) `#F2A81D` — badges, All-Conference mark, stat highlights
- Text: bone `#F5F3EF`, muted `#9A97A2`

**Type:** condensed athletic display (name/stats/section heads) + clean sans body. No soft serifs, no clip-art icons, no HUD gizmos.

## Tech & hosting

- **Astro**, single-scroll static page (matches Webb's / Brian's sites).
- **GitHub Pages** deploy (same as Brian's site).
- Own git repo in this folder.
- Mobile-first: recruiters open links on phones.

## Structure (single scroll)

1. **Hero** — action shot (full-bleed), `TYLER BALENO`, `DEFENSIVE BACK · CLASS OF 2027 · PLUM (PA)`, headline stat line `6'2" · 195 · 4.44 · 4.0 GPA`. Sticky "Watch Film" + "Contact" buttons.
2. **Film** — Hudl reel front and center (embed, with big linked thumbnail fallback if embed is unreliable).
3. **Measurables & Athletics** — stat tiles: HT, WT, 40; placeholders for shuttle/vertical/bench.
4. **Production** — season stat tiles (placeholder) + gold **2x All-Conference DB** badge.
5. **Academics** — 4.0 GPA, test-score placeholder, intended-major placeholder.
6. **Contact** — phone 412-995-0045, Hudl, X/@TylerBaleno3, coach-reference block (placeholder).

## Out of scope (YAGNI)

Multi-page, CMS, blog, stat auto-updating, forms/backend. Static one-pager, hand-edited when new stats/photos arrive.
