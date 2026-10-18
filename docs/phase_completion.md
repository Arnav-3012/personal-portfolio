# Phase gates

Check each box only with evidence (screenshot, Lighthouse report, command output) noted in `logs.md`.

## Phase 1 · 2D site
- [ ] Live on the custom domain over HTTPS
- [ ] Lighthouse ≥ 90 on Performance, Accessibility, Best Practices, SEO (mobile)
- [ ] LCP < 2.0 s, CLS < 0.05, landing JS < 120 KB gzipped before interaction
- [ ] Both themes pass contrast; `D` key and settings panel work; reduced motion respected
- [ ] Every landing section reads from `content/`
- [ ] Contact, freelance and notebook forms reach the inbox; Turnstile blocks bots
- [ ] EDITH-lite answers from the knowledge base, navigates the page, refuses off-topic and injection attempts, rate limit works
- [ ] `/admin` reachable only by Arnav

## Phase 2 · Workshop
- [ ] Brain dive works on desktop and phone
- [ ] Day/night follows Mumbai time and the `D` key
- [ ] Every hotspot reachable from the HUD list by keyboard
- [ ] 60 fps desktop, 30 fps phone; first load ≤ 8 MB

## Phase 3 · Worlds
- [ ] Each world ≤ 6 MB, loads on entry
- [ ] Project World, EDITH site and monitor wall read from `projects.json`
- [ ] Avatar chat streams with its states
- [ ] Spoken replies are off by default, start within 1.5 s of the first sentence, and work on desktop Chrome, Safari and Android Chrome; the allowance fallback is tested; text is always shown

## Phase 4 · Story + play
- [ ] Every room object live; chalkboard moderation via `/admin`; game leaderboard
- [ ] Pre-delivery checklist (frontend-audit-design) passes

## Phase 5 · Media and sound
- [ ] Positional audio fades by distance; nothing plays before the visitor turns sound on
- [ ] Every music track is royalty-free or Arnav's own, with licence noted in `content/`
- [ ] Reels stay under 25 MiB each with posters and captions

## Every task (QA gate, docs/prompts.md #3)
- [ ] Unit + e2e + axe tests pass; screenshots reviewed at 375/768/1440 px in both themes
- [ ] No broken links (linkinator); Lighthouse budgets hold on changed pages
