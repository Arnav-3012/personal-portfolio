# Task log

Newest first. Each entry: what was done, how it was verified, open items.

---

## 2026-10-18 · 1.6 + 1.7 Forms API and live data (run as one batch, Arnav approved the plan)

**Done** (plus one review round with Arnav: free-plan limits, the tilt-test failure, the missing local migration, Open-Meteo 503)
- **Forms API** (`worker/forms.ts`, `worker/email.ts`, `migrations/0001_forms.sql`): `POST /api/forms/{contact,freelance,notebook}`. Order: JSON-only, 8 KB cap, honeypot (`website` filled → quiet 200, nothing stored), shared field rules, dropdown values checked against `freelance.json` / the four notebook topics, Turnstile siteverify, per-IP limit (5/hour) and a global daily cap (200), D1 insert, then email. If storage fails the email still goes out; if the email fails the row stays with `emailed = 0`; both failing returns 500. No `TURNSTILE_SECRET` or a siteverify outage fails closed (503); a bad or missing token is 403. The IP is stored only as a salted hash.
- **Email:** hand-built MIME through the `EMAIL` binding (no new dependency): UTF-8 base64 body, RFC 2047 subject, CR/LF and U+2028/2029 stripped from every header value, `Reply-To` is the visitor. `MAIL_FROM` and `MAIL_TO` live in `wrangler.jsonc` vars.
- **Client:** form rules moved to `src/lib/form-rules.ts` (browser and Worker share them; new `notebook` kind; the email regex now rejects commas, brackets and quotes so it can't add recipients). `src/lib/turnstile.ts` loads Cloudflare's script on first focus of a form, renders an interaction-only widget, resets it after each send; the token travels as `turnstile`. A refused check (403) has its own toast. `turnstileSiteKey` is a new `site.json` field (Cloudflare's always-pass test key until 1.10).
- **Live data:** `worker/github.ts` (GraphQL contribution calendar + REST repos, mapped to the existing contract and checked with `parseGithub` before it is written to KV; no token → skip, any failure keeps the previous value), `worker/weather.ts` (Open-Meteo for Mumbai from `site.json` location), `worker/data.ts` (`GET /api/github`, `/api/weather`: KV read plus 5-minute edge cache, 404 `not_ready` while empty), `worker/cron.ts` (two schedules: `0 */6 * * *` GitHub, `*/30 * * * *` weather). The contract moved to `src/lib/github-data.ts` so the Worker and the landing share it.
- **Free-plan design:** ~52 KV writes/day of 1,000; read endpoints edge-cached; the count query uses the `created_at` index (query-plan test); at most 200 stored/emailed submissions a day; 2 of 5 cron triggers.
- **Found in QA and fixed:** the GitHub skeleton was a flat 320 px but the loaded block is 652 / ~420 / ~358 px, so the sections below jumped 332 / 99 / 38 px when data arrived (and the tilt test flaked). Skeleton now 640 / 420 / 350 px with a regression test. An idle Turnstile slot added a stray grid gap (`display: contents`).
- **Weather kept as planned:** nothing on the landing reads it (Phase 2 window and holotable do); Arnav asked why, did not ask to drop it, and confirmed "done".

**Verified**
| Check | Result | Evidence |
|---|---|---|
| typecheck, lint, format | pass | 0 errors / 0 warnings; check-no-hex 53 files clean; Prettier clean |
| `pnpm build` | pass | HTML budget 14,101 B gzipped (limit 14,200) |
| `pnpm test` | 284/284 | Worker project 77 (forms incl. Turnstile fail and outage, rate limits, daily cap, email/storage failure, MIME injection, GitHub mapping and failures, weather, cache, cron, query plan) + lib project (form rules, Turnstile client) |
| `pnpm e2e` | 273/273 | real Worker with local D1 + KV (fresh state per run): real sends for freelance and contact through Cloudflare's siteverify, API contract and rate limit, lazy Turnstile load, token and reset, blocked script, seeded `/api/github` feeding the section, no layout jump at 375/768/1440, axe 0 both themes; run 4 times |
| `pnpm links` | pass | 45 links, 0 broken |
| Lighthouse (mobile) | pass | 99/100/100/100, LCP 1956 ms (budget 2000), CLS 0, script 21.9 KB |
| Screenshots | reviewed | forms at 375/768/1440 × Day/Night × full/reduced; found the stray gap, fixed, rechecked |
| Mutation | pass | 7 breaks caught: Turnstile result ignored, hourly limit off by one, header cleaning removed, wrong contribution level, edge cache bypassed, `created_at` index dropped, old skeleton height |
| Manual, `wrangler dev --local` | pass | form → real siteverify → D1 row → decoded `.eml` (From, To, Reply-To, subject, body); weather cron → real Open-Meteo data in `/api/weather`; GitHub cron skips without a token |
| Arnav | confirmed "done" 2026-10-18 | ran e2e (reported the tilt failure), ran the Worker locally (hit the missing-migration and Open-Meteo 503 paths) |

**Deviations from the approved plan**
- Added a global daily cap (200) and the `created_at` index after Arnav asked for everything within free limits.
- Added the skeleton sizing fix and the two layout tests (found in QA).
- Playwright's server command now builds a fresh local D1/KV, applies the migration, seeds `github` from `tests/e2e/fixtures/github.json` and passes the test Turnstile secret with `--var`, so e2e needs no `.dev.vars`.
- Two e2e tests that relied on the endpoint being absent now stub the empty case.

**Open items**
- **Not verified:** the live GitHub GraphQL call (needs the token; steps given: fine-grained, public repositories, read-only, `GITHUB_TOKEN` in `.dev.vars` locally and `wrangler secret put` at deploy); real email delivery (Email Routing on `arnavc.in`, 1.10); the real Turnstile keys (site key into `site.json`, `TURNSTILE_SECRET` secret); Worker CPU per request (check in observability after deploy).
- **1.10:** set `TURNSTILE_SECRET` and `GITHUB_TOKEN` with `wrangler secret put`, apply the migration to the remote D1 (`wrangler d1 migrations apply DB --remote`), verify the inbox, replace the test site key, recheck the 403 with real keys.
- A failed GitHub fetch still shrinks the section from the skeleton to the one-line fallback (rare, accepted).
- A local `wrangler dev` needs `pnpm wrangler d1 migrations apply DB --local` once, or storage fails (the email still sends).
- **Headroom is tiny:** HTML 99 B under budget and LCP 44 ms under 2.0 s. The next landing task must first move interaction-only markup into JS.
- 1.9 inbox should list rows with `emailed = 0`.
- 1.8 EDITH-lite is next.

## 2026-10-18 · 1.5cd Skills, freelance, GitHub, beyond code, contact, footer (third and fourth of the 1.5 sub-tasks, run as one batch)

**Done** (plus three review rounds with Arnav: GitHub "not available", form error toast, footer redesign)
- **Batching:** 1.5c and 1.5d ran as one gated batch (one plan, one QA pass, one "done", two commits); plan.md also groups 1.6+1.7 and 1.9+1.10. 1.5 is ticked.
- **About and skills** (`Skills.astro`, `src/lib/skills.ts`, `dock.ts`): section id `about` (the nav's "03 About"): intro and philosophy from `profile.md`, skills by layer from `skills.json` (core, then working, then learning; core skills link their evidence to the project or role), and a stack dock from `site.dock` whose tiles grow toward the pointer (fine pointers with motion only).
- **Open to freelance** (`Freelance.astro`, `FormField.astro`, `src/lib/forms.ts`): status, four services and the "Start a project" form, all from `freelance.json`; booked turns grey and swaps the form for the email line. Validation, one in-flight request, honeypot, and an honest failure toast with the email address. Posts JSON to `/api/forms/<kind>`; **that endpoint does not exist until 1.6**, so every send currently ends in the "Couldn't send that" toast.
- **GitHub live** (`GithubLive.astro`, `src/lib/github.ts`): the `GET /api/github` response shape is defined (the contract for 1.7), the heatmap and four repos fill in when the section nears the viewport, skeleton while loading, fallback line with a profile link on 404, error or a bad body. **Shows the fallback until 1.7.**
- **Beyond code** (`BeyondCode.astro`): cricket and 75 Hard tiles from `cricket.json` (new `teaser` photo with a `position` focal point) and `discipline.json`; whole tile is the link; pointer tilt on fine pointers.
- **Contact and footer** (`Contact.astro`, `Footer.astro`): email, socials and a three-field form; footer after Warp (awesome-design-md): "Start a project" call to action, Sections / Elsewhere / Based in columns, giant outlined wordmark, © line and Back to top. "Built on Cloudflare" and the deploy date were removed on Arnav's request (SPEC row 12 updated).
- **Performance work (see mistakes.md):** Lighthouse first failed at LCP 2107 ms because the compressed HTML crossed ~14.6 KB (one extra round trip in its model). Fixes: the reel player dialog is built in JS (`playerMarkup()`; approved by Arnav), the era font is opt-in per page, new sections use global BEM-prefixed styles, the `noscript` tags became a `data-js` flag, and `scripts/check-html-budget.ts` fails the build above 14,200 B gzipped.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| format, typecheck, lint | pass | 0 errors; check-no-hex 50 files clean |
| `pnpm build` | pass | includes the HTML budget: 14,073 B gzipped (limit 14,200) |
| `pnpm test` | 188/188 | new: skills order and evidence links, `markdownSection`, `teaser`, `beyondTiles`, dock scale, tilt, GitHub contract and heatmap helpers, form validation and status mapping, `playerMarkup` hooks, icons |
| `pnpm e2e` | 257/257 | skills, dock (grows and stays still with reduced motion), freelance and contact (validation, success, busy and double click, 404 honest failure, 429, 400, offline, honeypot, no-JS), GitHub (no fetch before near, skeleton, cell rows and delays, fallbacks, mobile scroll to newest week), Beyond code (images, whole-tile click, tilt), footer, axe 0 in both themes (also with form errors showing) |
| `pnpm links` | pass | 45 links, 0 broken |
| Lighthouse (mobile) | pass | 99/100/100/100, LCP 1956 ms (budget 2000), CLS 0, script 21.3 KB gz; baseline before this batch 1956 ms |
| Screenshots | reviewed | all 60 (About, Freelance, Contact, Beyond, GitHub) and the footer at 375/768/1440 × Day/Night × full/reduced, plus the JS-built reel player |
| Mutation | pass | `freelance.open=false` (8 e2e failures), a renamed player hook (1), an unknown evidence id (2); each restored |
| Arnav | confirmed "done" 2026-10-18 | reviewed in the browser; reported GitHub, form and footer |

**Deviations from the approved plan**
- Dock uses the existing `site.dock` list, not tiles derived from `skills.json`.
- Evidence links show on core skills only (bytes and tab stops).
- The reel player (1.5b) is now built in JS, `Icon.astro` paths moved to `src/lib/icons.ts`, `Base.astro` gained `era` and a `data-js` flag, and a build-time HTML budget was added (Arnav chose this over cutting content).
- About quote uses the body font (the era font cost 23 KB at load).
- Footer redesigned on request; SPEC row 12 changed.

**Open items**
- **1.6:** `/api/forms/<kind>` (Turnstile, D1, email). Until then both forms always show the failure toast. Needs from Arnav at the end of that task: Turnstile site key and secret, and the inbox verified in Email Routing. Turnstile slots are marked in `Freelance.astro` and `Contact.astro`.
- **1.7:** `/api/github` in the shape of `src/lib/github.ts` (cron + KV). Needs a read-only fine-grained GitHub token for the contribution heatmap.
- **HTML headroom is about 130 B.** The next task that adds markup must first move interaction-only markup (settings dialog, toast templates) into JS.
- The cricket tile's "Enter the stadium" and the workshop footer link wait for Phase 2.
- The 75 Hard poster has Instagram's logo baked into it.
- 1.10: verify production serves Range for MP4s (from 1.5b); `/design` ships to production (from 1.2).
- 1.8 next, or 1.6+1.7 if Arnav wants the forms and GitHub working first.

## 2026-10-18 · 1.5b Experience and 75 Hard (second of four 1.5 sub-tasks)

**Done** (plus one revision round with Arnav)
- **Experience** (`Experience.astro`, `src/lib/experience.ts`): five roles from `experience.json`, newest first, on an amber rail that draws with scroll progress; each node lights when the line reaches it. Hackathons from `site.json` honors, newest year first, linking to the project row when it has one. Fully drawn without JS or with reduced motion.
- **75 Hard** (`Hard75.astro`, `src/lib/reels.ts`): pinned headline, 75 crossed-out squares drawn with gradients, a cursor heat glow, and five reel cards from `discipline.json`. Revision: the cards revolve on a tilted ring round the headline (time-based, slows to a stop) and spread to their own resting spots as the visitor scrolls (`orbitPose`, `separation`); hovering a card holds the ring, straightens the card and scales it 4%, and plays its muted loop. Cards are real links to the MP4s. Below 768 px, with reduced motion or without JS they are a plain swipe strip. Warp-style translucent borders instead of drop shadows.
- **Reel player** (`ReelPlayer.astro`): one native `<dialog>` and one `<video>` whose `src` is set only on open. Arrow keys, prev/next, swipe, tap to pause, mute, Esc, outside click; focus returns to the card. Loader is the SPEC's `day N / 75` counter driven by the real buffered amount. A failed load shows an error toast.
- **Proximity audio:** the featured reel (day 4) loops as a quiet bed that fades in as the section nears the viewport centre and out as it leaves (`proximityGain`, max 0.35). Plays only with Settings sound on, after an interaction, with the tab visible and the player closed; routed through the new `AudioManager.attachElement`, so the toggle and tab-hidden suspend silence it.
- **Content:** `discipline.json` reel paths are now `media/75hard/…`; the 5 MP4s and posters (32 MB) ship from `public/media/75hard/`.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| typecheck, lint, format | pass | 0 errors; check-no-hex 36 files clean; Prettier clean |
| `pnpm test` | 141/141 | new: rail progress, honors order, reel caption/step/swipe, ring pose maths, separation, proximity gain, buffered ratio, `attachElement`, reel files ship and stay under 25 MiB |
| `pnpm e2e` | 145/145 | rail draws and lights nodes; ring revolves, holds on hover, spreads on scroll; hover plays; player open/keys/swipe/tap/mute/close/focus return; loader; error toast; pause or skip while starting does not restart or mute (4× repeat, 48/48); mobile strip no overflow; reduced motion flat; no-JS links; proximity audio gated by Settings and interaction; axe 0 in both themes, also with the player open |
| `pnpm links` | pass | 44 links, 0 broken |
| Lighthouse (mobile) | pass | 99/100/100/100, LCP 1958 ms (budget 2000), CLS 0, JS 16.9 KB, no MP4 requested on load |
| Screenshots | reviewed | 375/768/1440 × Day/Night × full/reduced, ring and spread states, player at each width |
| Mutation | pass | no featured reel, and a reel pointing at a missing file, each failed one test; restored |
| Arnav | confirmed "done" 2026-10-18 | reviewed in the browser; asked for the orbit |

**Deviations from the approved plan**
- Cards revolve and spread instead of drifting up and down (Arnav, after review); pose maths replaced `driftY` and the per-card depth fields.
- `AudioManager.attachElement` added (small, tested), beyond "earlier phases only wire the hook".
- The player's own audio is not routed through AudioManager: it is media the visitor starts with a click, with its own mute button.
- Reel paths in `discipline.json` changed to published paths, and 32 MB of media is now committed.
- e2e serves the MP4s through a Playwright route with real 206 range responses (see open items).

**Open items**
- **1.10: verify Range on production.** `wrangler dev --local` ignores `Range` (always 200, no `Accept-Ranges`) and Chromium then stalls about 15 s before the first frame. Confirm production Workers assets honour Range; if not, the Worker must serve `/media/*` with ranges.
- Captions (WebVTT) deferred to the Phase 5 gate (Arnav's call).
- 75 Hard day numbers are still placeholders 1–5; confirm the real days before 1.10.
- In one extreme frame the ring's front card can touch the first letters of the sub-line by a few pixels.
- MARL LLM Router and EDITH still have no `stats` (from 1.5a).
- 1.5c next: skills by layer with the dock; cricket and 75 Hard teaser tiles (the 75 Hard section id is `75-hard`).

## 2026-10-18 · 1.5a Work (first of four 1.5 sub-tasks)

**Done** (plus two review rounds with Arnav)
- **Split:** 1.5 became 1.5a–1.5d in plan.md (Arnav approved): a single commit would have been unreviewable, and forms/GitHub backends arrive in 1.6/1.7.
- **Selected work** (`SelectedWork.astro`, `ProjectDetail.astro`): the first five hero-tier projects by `order` as a sticky split. A compact pinned card (≤ 400 × 460 px) shows a "03 / 05" counter and progress rail, the status and year, a one-liner, stats as big amber figures with mono labels (`splitStat`), up to four stack chips and the links. Rows are 70vh; the card switches only when the next project is 12% of the viewport closer (`activeIndex` hysteresis) and builds in piece by piece after a 250 ms fade-out. Below 768 px each name carries its own detail card. Only the visible pane is focusable (`inert` toggled).
- **Background** (Warp-style restraint, tokens only): full-bleed dot grid faded at both ends, a terminal-log spine with a node per project, outlined ghost numerals, a "Next · …" hint, and a slow-breathing amber glow behind the card (clipped with `overflow-x: clip`).
- **All projects** (`AllProjects.astro`): filterable table of all 21 projects (All / Shipped / Building / Coming soon, with counts and a polite live count). Vanilla JS; every row shows without JS; rows stagger in; off with reduced motion.
- **Logic** (`src/lib/work.ts`): `selectedWork`, `filterProjects`, `statusCounts`, `splitStat`, `activeIndex`, `initWork`.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| typecheck, lint, format | pass | 0 errors; check-no-hex 31 files clean; Prettier clean |
| `pnpm test` | 102/102 | 18 new: ordering, fewer-than-five, filters, counts, year dash, `activeIndex` + hysteresis, `splitStat` on every real stat |
| `pnpm e2e` | 80/80 (exit 0) | 26 new: pane follows scroll, one focusable pane, pane pinned, compact size, no switch on a small nudge, filters (mouse + keyboard), no-JS rows, mobile stack without overflow, axe 0 in both themes, screenshots 375/768/1440 × Day/Night × full/reduced |
| `pnpm links` | pass | 34 links, 0 broken |
| Lighthouse (mobile) | pass | 99/100/100/100, LCP 1808 ms, CLS 0.000 |
| Screenshots | reviewed | 1440 Night/Day, 768 Day, 375 Night after each round |
| Mutation | pass | StatCalib set to `coming-soon`: 6 → 7 coming-soon rows; restored, no diff |
| Arnav | confirmed "done" 2026-10-18 | reviewed in the browser |

**Deviations from the approved plan**
- SPEC row 4 says the pane swaps a "clip"; `projects.json` has no clips, so the pane shows stats, stack and links. "See it in 3D" waits for Phase 2.
- Added `ProjectDetail.astro` (shared by pane and mobile cards), not in the approved file list.
- Arnav's review asked for a smaller pane, slower switching, more engaging content and a richer background; all four are implemented (see mistakes.md).

**Open items**
- MARL LLM Router and EDITH have no `stats` in `projects.json`; their cards show no number rows until Arnav adds some.
- 1.5b next: experience rail, 75 Hard section and reel player (reels live in the gitignored `assets/incoming/`; plan a copy into `public/` at that point).
- The EDITH spoken-replies docs edits (SPEC, phase gate) are committed separately.

## 2026-10-18 · 1.4 Landing, part A

**Done** (three review rounds with Arnav; final state below)
- **Palette:** warm amber terminal after Warp (awesome-design-md). Night: warm void `#14110D`, parchment `#F3EDE2`, amber `#E8A24A` as the 2D signature. Day: paper `#F4EEE3`, umber ink. Red stays for action, green for live, cyan for 3D. All pairs re-measured in SPEC.
- **ARNAV-OS boot:** a transformer forward pass on canvas (`src/lib/transformer.ts`):
  - input tokens with embedding bars;
  - 4 blocks of neuron rows with signal pulses;
  - attention arcs and a per-block head heatmap;
  - a rising activation glow driven by real progress (fonts 40% + portrait 60%);
  - a top-5 softmax that decodes ARNAV letter by letter;
  - letters fly into the hero name.
  Once per session, skip on any key, off with reduced motion, 4.5 s inline failsafe (`src/lib/boot.ts`).
- **Nav:** segmented HUD bar: 01–04 links with an amber marker on the section in view, freelance status, live IST clock, Resume (renders only when the PDF is in `public/`), settings. Hides on scroll down; mobile menu sheet.
- **Hero:**
  - Arnav centre stage as an ordered-dither dot-matrix (`src/lib/dotmatrix.ts`): 4×4 Bayer, contrast stretch, Night lights the bright and Day inks the dark, backdrop removed, torso fades below the chin.
  - ARNAV in CSS dot lettering across the lower third, with dots dimmed behind the text.
  - Corner quadrants with labels derived from content.
  - Chips and social links.
  - Hover: push + a fading trail that reveals the cut-out photo.
  - The `<img>` stays as the LCP image and no-JS fallback.
- **Proof strip:** CSS marquee, pauses on hover/focus, 2-column grid on mobile, static with reduced motion.
- **Content:** `site.json` gains `portrait.alt` and `boot { tokens, output, log }` (zod).
- **Portrait master:** `src/assets/portrait/portrait.jpg` (1600×2000, from the upscaled original), with AVIF/WebP variants built by Astro.
- **Lighthouse CI:** now asserts the SPEC budgets (LCP, CLS, script size).
- **Docs:** CLAUDE.md hero rule, SPEC (palette, rows 0–2, loading row, content model), plan.md.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| typecheck, lint, format | pass | 0 errors; check-no-hex 27 files clean; Prettier clean |
| `pnpm test` | 84/84 | new: boot gating + real progress, transformer layout/timing/softmax, dither (Bayer, Day vs Night density, stretch), push, trail field (splat, advection, dissolves), quadrants, IST clock, content schema |
| `pnpm e2e` | 54/54 | boot once/skip/failsafe/reduced on a fake clock; canvas paints; hover fills a face patch with the photo, which then returns to dots, in both themes; centre layout at 375/768/1440; nav hide/focus/clock/section marker; menu Esc and focus return; axe 0 in both themes, during the boot and with the menu open |
| Boot stress | 35/35 | `--repeat-each=5` after moving timer tests to the fake clock |
| `pnpm links` | pass | 21 links, 0 broken |
| Lighthouse (mobile) | pass | 99/100/100/100, LCP 1808 ms (portrait is the LCP element), CLS 0, JS 11.7 KB |
| Screenshots | reviewed | 375/768/1440 × Day/Night × full/reduced; boot frames; hover trail in both themes |
| Mutation | pass | `freelance.open: false` → "Currently booked" in nav, hero and menu; restored |
| Arnav | confirmed "done" 2026-10-18 | reviewed in the browser in both themes |

**Deviations from the approved plans**
- Workshop button, brain hotspot and mobile "best on desktop" note moved to Phase 2 (Arnav).
- Hero redesigned from portrait-left/name-right to centre stage (Arnav; the CLAUDE.md rule was rewritten).
- Dot-matrix: the planned finer face grid was replaced by one grid, then by ordered dither. The circle lens was replaced by push + trail reveal after studying the reference site's technique (read-only, no code copied).
- Icon row became labelled text links with an arrow (no brand logos in the icon set).

**Open items**
- Resume PDF without the phone number (the button stays hidden until it is in `public/`).
- LCP has about 190 ms of headroom: 1.5 must not add weight above the fold.
- Hover frame time was not measured; check on a mid-range laptop at 1.10.

## 2026-10-18 · 1.3 Content

**Done**
- New: `content/site.json` (name, role line, location, socials, public email `arnavc.work@gmail.com`, resume, `currentlyBuilding: "edith"`, education, proof strip, honors, dock), `projects.json` (21 projects: 5 hero worlds + EDITH, 9 shipped wall/tools incl. Kohli-100 in the Cricket World, 2 building, 6 coming soon), `skills.json` (4 layers, `core`/`working`/`learning`, evidence ids), `freelance.json` (open, 4 services, timelines, confirmation, email line; no budget field).
- `src/lib/content.ts`: zod schemas (`astro/zod`, no new dependency) for all 8 JSON files, length caps from the awesome-design-md cross-check (one-liner ≤ 90, stat ≤ 28), typed exports. `Base.astro` imports `site`, so every page build parses all content.
- Arnav's answers: hackathons "Participated"; 75 Hard sub-line and lesson "Anything you put your mind to is already yours, if you stay consistent."; MARL without results or progress until they exist; coming-soon one-liners from his notes; budget field removed.
- SPEC: content model (new `site.json` keys, optional project fields, validation) and freelance form fields.

**Sources for project stats:** SPEC first, then the Oct 2026 resume, then each repo README (`gh`, read-only). StatCalib uses the README (isotonic: ECE 0.169 → 0.011, −93.5%); the resume credits Platt scaling (README: 90.2%), so the resume needs a fix. Nothing invented: anything not in a source was a TODO until Arnav answered.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| `pnpm typecheck`, `lint`, `format:check` | pass | 0 errors; check-no-hex 16 files clean; Prettier clean |
| `pnpm build` | pass | 3 pages; description now from `site.json` |
| `pnpm test` | 55/55 | 19 new content tests: files present, no phone number, unique ids, 5 heroes + EDITH, proof values in project stats, honors/skills ids resolve, newest-first experience, timeline channels, reel days, media files exist (local only), schema guards |
| Mutation | pass | `projects[0].status = "done"` → build fails `content/projects.json is invalid … at [0].status`; tests fail; restored |
| `pnpm e2e` | 29/29 | no regressions |
| `pnpm links` | pass | 7 links, 0 broken |
| Screenshots, Lighthouse | N/A | no page renders content yet (1.4) |
| TODOs in `content/` | 0 | `grep -rn TODO content` |
| Arnav's own run | pass | typecheck, lint, build, test, e2e green; confirmed "done" 2026-10-18 |

**Deviations from the approved plan**
- `Base.astro` changed (not in the plan) so the build actually runs the parser; see mistakes.md.
- EDITH is `tier: "hero"`, order 6 (plan said exactly 5 heroes).
- Grafana Reporter and KOL mapper link to their public repos (plan said company work gets no link).
- `tsconfig.json` Prettier-formatted (pre-existing `format:check` failure).

**Open items**
- 1.4: media in `assets/incoming/` is gitignored; decide how optimised copies reach `dist/` before Workers Builds (1.10).
- Resume: StatCalib method (isotonic, not Platt).

## 2026-10-18 · 1.2 follow-up · Skeleton, progress and toast polish

**Done** (Arnav's feedback: skeleton sweep invisible, toasts and progress too plain)
- Skeleton: bright scanline with a fading trail, transform-based, 1.8 s; static under reduced motion.
- Progress: fading tail, glowing head driven by the same `--progress`, eased steps, fades out at 100%; glow hidden under reduced motion.
- Toasts: tinted icon chip, HUD label stacked over the message, kind-tinted border and glow, frosted surface, 4 s countdown line that pauses with the timer, 200 ms exit animation.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| `pnpm lint`, `pnpm typecheck` | pass | check-no-hex clean; 0 errors |
| `pnpm e2e` | 29/29 | toast timing, pause and dismiss tests unchanged and passing |
| Mid-animation captures | reviewed | skeleton at 3 frames, progress mid-run, 3 toasts; Night and Day |
| Arnav | confirmed "done" 2026-10-18 | |

## 2026-10-18 · 1.2 Design system

**Done**
- `src/styles/tokens.css`: Night (default) + Day colour tokens per SPEC, plus `--on-action` and a Day `--ok` (`#177A42`); type, spacing, radii, motion, focus and layer tokens. The only file with raw hex (enforced by `scripts/check-no-hex.ts` in `pnpm lint`).
- Fonts via Astro's built-in `fonts` API (Fontsource provider): Unbounded 600/700, Geist 400/600, JetBrains Mono 500, Fraunces 600 italic. Self-hosted Latin woff2 (6 files, 113 KB), metric-matched fallbacks; only Unbounded 700 + Geist 400 preloaded (34 KB).
- Theme: inline head script sets `data-theme`/`data-motion` before first paint; `src/lib/theme.ts` keeps them in sync (Auto = OS scheme, 600 ms cross-fade only on change). `D` toggles (not in fields, not with modifiers; Shift+D reserved for free-roam).
- `src/lib/settings.ts`: typed store (theme, sound, motion, quality, holo) in localStorage, every access in try/catch, invalid fields fall back to defaults.
- Settings panel: gear + native `<dialog>` (Theme, Motion incl. Auto, 3D quality, Hologram colour = Arc Cyan only, Sound switch).
- Shell, all vanilla TS (no React on the landing yet): grain overlay (static SVG noise, 4%), `toast()` + `Toaster` (polite/assertive regions, 4 s, pause on hover/focus), progress pill + curtain (`start/set/done`), `Skeleton` with scanline, `AudioManager` (lazy AudioContext after a gesture, muted by default, master/music/sfx, suspends when hidden).
- Lucide icons copied into `Icon.astro` (lucide-static 1.59.0, ISC).
- `/design` internal style guide (noindex).

**Verified**
| Check | Result | Evidence |
|---|---|---|
| `pnpm typecheck` | pass | 0 errors / 0 warnings / 0 hints (24 files); worker tsc clean |
| `pnpm lint` | pass | eslint clean; check-no-hex 15 files clean (mutation: temp file with `#fff` caught) |
| `pnpm build` | pass | 3 pages, 6 font files |
| `pnpm test` | 36/36 | lib: contrast (19), settings (9), audio (6); worker: health (2). Contrast test fails when SPEC's Day `--ok` is restored (mutation check) |
| `pnpm e2e` | 29/29 | no-flash first paint with module JS blocked; Auto live; D + typing guard; settings keyboard/Esc/focus return/persist; corrupt storage; OS reduced motion; toasts (fake clock); progress; axe 0 violations on `/` and `/design/` in both themes + open dialog |
| Screenshots | reviewed | 24 at 375/768/1440 × Day/Night × full/reduced, + dialog + toasts. Fixed: mobile toasts covered the gear |
| `pnpm links` | pass | 7 links, 0 broken |
| Lighthouse (mobile) | pass on `/`, `/404` | 100/100/100/100, LCP 1.4–1.5 s, CLS 0. `/design` 99/100/100, SEO 60 only from `is-crawlable` (intentional noindex) |
| Shell JS | ~2.2 KB gz | React client bundle emitted but not loaded by any page |
| Arnav's own run | pass | typecheck, lint, build, test, e2e green; `/design` checked in `wrangler dev --local`. Confirmed "working" 2026-10-18 |

**Deviations from the approved plan**
- `playwright.config.ts`: `reuseExistingServer: false` (an orphaned workerd served a stale build; see mistakes.md).
- Unit tests split into `tests/unit/worker` (Workers pool, worker tsconfig) and `tests/unit/lib` (Node project, root tsconfig).
- No happy-dom: browser libs take injected fakes instead (no new dependency).

**Open items**
- `/design` ships to production: remove or move behind `/admin` at 1.10.
- Progress bar navigation wiring and offline banner / paper-plane: 1.4 and 1.6.
- `content/timeline.json` fails `prettier --check` (pre-existing, from content intake).
- `astro build` downloads fonts from Fontsource: Workers Builds (1.10) needs network at build time.

## 2026-10-18 · 1.1 Scaffold

**Done**
- Astro 7.4 (static output) + React 19 islands, TypeScript 6.0 strictest, pnpm 12.14.
- Hono Worker (`worker/index.ts`) serving `/api/health`, JSON 404 for unknown `/api/*`, 503 placeholder for `/admin*`, everything else to static assets.
- `wrangler.jsonc`: assets from `./dist`, `run_worker_first: ["/api/*", "/admin*"]`, `404-page` handling, bindings DB (D1), KV, VECTORIZE, AI, EMAIL. No resource IDs (Wrangler provisions them on deploy).
- Binding types generated with `wrangler types` (`worker-configuration.d.ts`), not `@cloudflare/workers-types`.
- ESLint 10 (typescript-eslint strict, astro, jsx-a11y-x, react-hooks) + Prettier (Astro plugin; Markdown excluded).
- Test harness: Vitest 5 + `@cloudflare/vitest-plugin` (Workers runtime, offline), Playwright + axe, linkinator, Lighthouse CI (mobile, ≥ 90 on all four categories).
- Folders: `src/{pages,layouts,components,styles,lib}`, `worker/`, `content/`, `public/`, `scripts/` (kb-build stub), `migrations/`, `tests/{unit,e2e}`.

**Verified**
| Check | Result | Evidence |
|---|---|---|
| `pnpm typecheck` | pass | astro check: 0 errors / 0 warnings / 0 hints (8 files); `tsc -p worker` clean |
| `pnpm lint` | pass | eslint exit 0 |
| `pnpm format:check` | pass | "All matched files use Prettier code style" |
| `pnpm build` | pass | 2 pages (`/index.html`, `/404.html`) |
| `pnpm wrangler dev` (not logged in) | fails as expected | "Failed to start the remote proxy session": Workers AI needs Cloudflare auth |
| `pnpm wrangler dev --local` | pass | `GET /api/health` → 200 `{"ok":true,"service":"arnav-portfolio",...}`, `Cache-Control: no-store`; `/` → hello HTML; `/api/nope` → 404 JSON; `/admin` → 503; `/missing` → 404 page |
| `pnpm test` | 2/2 pass | health 200 + no-store; unknown API route 404 |
| `pnpm e2e` | 3/3 pass | home renders, axe 0 violations; `/api/health` 200; 404 page |
| `pnpm links` | pass | 2 links, 0 broken |
| `pnpm lhci` (mobile) | pass | Performance 100 · Accessibility 100 · Best Practices 100 · SEO 100 |

**Deviations from the approved plan**
- `@cloudflare/vitest-pool-workers` is deprecated → `@cloudflare/vitest-plugin` 1.4.4 with Vitest 5.0.5 (approved by Arnav; CLAUDE.md updated).
- No `wrangler.test.jsonc`: `cloudflareTest({ remoteBindings: false })` runs the main config offline.
- Added `@types/node` 24.19.2 (Wrangler requires it with `nodejs_compat`; configs use `process`).
- Node 24.22.0 installed from the official nodejs.org tarball into `~/.local/share/node-v24.22.0-darwin-arm64` (no sudo for the .pkg; Homebrew failed on a lock and wanted to upgrade unrelated formulae).
- Playwright's dev server uses `wrangler dev --local` so e2e runs without a Cloudflare login.
- `pnpm-workspace.yaml` added: pnpm 12 blocks install scripts; only `esbuild` and `workerd` are allowed.

**Account prerequisites (one time, done by Arnav)**
- Node 24 on PATH, `pnpm wrangler login`.
- Registered a workers.dev subdomain. Remote bindings (Workers AI) in `wrangler dev` fail without one ("You need to register a workers.dev subdomain"). Wrangler's onboarding link (`/workers/onboarding`) 404s in the current dashboard. Use the API instead: `PUT /accounts/{id}/workers/subdomain` with `{"subdomain":"<name>"}` and the token from `wrangler auth token`. `arnav` was taken.
- After that, Arnav confirmed plain `pnpm wrangler dev` serves `/api/health` with AI remote. Task confirmed "done" 2026-10-18.

**Open items**
- 1.8: create the Vectorize index (`edith-kb`, 768 dims, cosine) and set `"remote": true`.
- 1.10: verify `arnavworkmail3012@gmail.com` (or another inbox) as an Email Routing destination.

## 2026-10-18 · Assets and content intake (outside plan.md)
- Sorted media into `assets/incoming/` (gitignored): 2 portraits, 4 avatars, 7 timeline photos, 5 reels, 2 cricket photos + 3 clips, 7 posters, resume.
- Reels and clip-01 re-encoded to H.264 720p CRF 26 with faststart (5–8 MB each, all under 25 MiB). 75 Hard day numbers are placeholders 01–05.
- `content/experience.json` written from the Oct 2026 resume. Verified: parses as JSON.
- SPEC: 75 Hard reels cut from 8–12 to 5 (Arnav's call); RBAC RAG and women-safety one-liners recorded; supplied assets ticked.
- `content/timeline.json` written: 7 eras from Arnav's notes + resume, photos from `assets/incoming/timeline/`. Verified: parses as JSON.
- `content/profile.md` written from Arnav's answers (bio, philosophy, origin, proudest work, looking for, outside work, EDITH scope and tone).
- Avatar set completed: `avatar-05-face-closeup.png`, `avatar-06-a-pose.png` added; the earlier full-body "05" and the 3 selfies left out.
- Marvel rule narrowed (Arnav's call): visuals/scenes/UI copy stay Marvel-free; factual bio mentions in `profile.md` and EDITH answers allowed. CLAUDE.md + SPEC updated.
- Added `content/cricket.json` (why-cricket text, clips, photos, poster) and `content/discipline.json` (8 rules, 5 reels with posters; sub-line and lesson TODO). Reel posters extracted with ffmpeg. Absolute Wear stack filled. poster-02 approved as is. Verified: all content JSON parses.
- Domain recorded: `arnavc.in` (CLAUDE.md, SPEC accounts checklist, plan 1.10). Accounts/keys to be requested from Arnav at the end of the task that needs them.
- Added `README.md` (outside plan.md): badges, feature status table, 3D workshop and Phases 3–5 marked coming soon, setup, scripts, structure, quality bar, roadmap. Status of 1.8/1.9 written as "in progress" to match uncommitted code and the unticked plan. Verified: every linked doc and path exists.

## 2026-10-19 · Boot redesign, depth pass, Beyond code, one page column (outside plan.md, Arnav's requests)
- Boot: the vertical transformer is now a horizontal full-screen one (`src/lib/reactor.ts`): tokens, embedding, four attention + feed-forward blocks, a glowing core, softmax head, the name decoding at the right. The core's ring fills with real loading progress, ignites blue, bursts into particles that recombine into the dot portrait and dotted ARNAV, then cross-fades into the live hero (`boot-targets.ts`, `hero-dots.ts`, `dotmatrix.assemble`). Original design: no film props or marks.
- Depth ("looked flat"): blocks are glass slabs in one-point perspective toward the core, a perspective floor grid with the core's light pooled on it, a vignette, a machined bezel with a lit edge, raised cells, a glass dome with a specular glint, two tilted orbit rings (far half behind, near half in front). Night adds light additively (bloom); Day only tints.
- Hero name: dots are shaded beads (`--bead-hi/lo/cast` tokens, both themes) with a short extrusion and a soft cast shadow.
- Beyond code: two equal full-bleed panels whose photos fade into the page colour; numbered eyebrow, large title, hairline CTA, slow zoom on hover. Equal columns (a first 7/5 split read as asymmetric).
- One page column: hero corner links and the 75 Hard grid moved onto the same 1280px max / 32px gutter as every section (all content edges 112–1328 at 1440, 352–1568 at 1920, 32–992 at 1024; measured).
- Verified: typecheck, lint, check-no-hex clean; unit suite (reactor.test.ts added: 14 tests); e2e batch of 113 (landing boot incl. new phase-order test, hero-hold, beyond, fold, design-system, motion) passed; HTML 14,021 B gz (limit 14,200); screenshots of boot (Night, Day, phone), hero and Beyond code reviewed.

## 2026-10-19 · Scroll, transitions, loading and per-section cursor (outside plan.md, Arnav's request)
- Smooth scroll: Lenis (`src/lib/smooth.ts`, lazy via `afterLcp`), fine pointer and no reduced motion only. Native scroll stays inside dialogs, the project index, EDITH and the entry overlay. In-page links glide (1.3 s, ease-out quart) and still update the URL.
- Depth on scroll (`src/lib/scroll-fx.ts`): the hero stage, name and corner links drift at different rates through the `translate` property (independent of `transform`), plus a 2px amber progress hairline at the bottom edge.
- Loading (`src/lib/lazy-fade.ts`): lazy images that were not ready rise in over 700 ms with a transform only (an opacity fade-in trips axe contrast).
- Cursor (`src/lib/cursor.ts`): a glass disc with a glyph per section (cross, open, vertical, horizontal, arrow, next, commit, play, pencil); amber and larger over anything clickable; native cursor kept in fields, dialogs, video, EDITH. Mouse only; not created for touch or reduced motion.
- Boot scene is now loaded after the portrait has painted (`src/lib/boot.ts`). Bisect: its early request cost ~160 ms of simulated LCP (2.1 s to 1.96 s once deferred); the drop-shadow filter was not the cause.
- e2e server: `wrangler dev` now gets `--local-upstream localhost:8787`. With the `arnavc.in` route in `wrangler.jsonc`, the Worker saw that host instead of localhost, so the `ADMIN_DEV` bypass failed and every /admin test got 503.
- Verified: unit (scroll-cursor.test.ts, 9), e2e scrollfx.spec.ts (8), full e2e run 364 passed / 6 failed before the two fixes above and the note spacing below.

## 2026-10-19 · Beyond code redesign, deeper reactor, friendlier toasts (outside plan.md, Arnav's requests)
- Beyond code: two mirrored chapters on the page column instead of two cards. Cricket is a story frame (segmented progress, tilted pointer parallax in 3D) with Instagram-style stickers (date tear-off, "Why cricket?" question, Mumbai pin, #clubcricket, live "Still playing", and drawn bat, ball, trophy and jersey icons) and a taped photo; 75 Hard is a fanned deck of the five day cards over a 75-tick rail. Stickers, photo and deck are built by `src/lib/beyond-fx.ts` from `/beyond.json` only when the section is near, with their CSS injected there, so the landing HTML and render-blocking CSS do not grow.
- Reactor depth: solid slabs lit by the core (rim light, shaded far side, glass sheen), one-point-perspective sizes, a lit floor with cast shadows, contact patches and reflections, light shafts, an anamorphic streak, a bevelled bolted mount plate with a turned-metal conic bezel, inner shadow and glass sheen on the core, drifting dust at two depths. The machine now fades as one (`machineFade`).
- Toasts: layered glass card with a lit status gem, friendly titles (Done, Heads up, Something went wrong) instead of `[ OK ]`, spring entrance (transform only), glowing countdown edge, older toasts sit back.
- Note "psst… press my brain" slides down when it would land on the Work corner (short or wide screens).
- Email: a message from the site is saved in D1 and the visitor always sees success, but the mail only arrives once Email Routing is live on arnavc.in and the destination inbox is verified (plan 1.10). Until then `sendMail` throws, the handler logs it and still answers 200 (`emailed` stays 0). Checking production data was not done from here (the read was blocked); steps are in the reply.

## 2026-10-19 · Boot in the site's own language, swipeable cricket story, smoother note, projects table scroll (Arnav's requests)
- Boot: the glossy cyan glass reactor read as cartoonish and did not match the site. Redrawn in the page's own language (`src/lib/reactor.ts`): graphite ground with the page's dot grid, parts drawn as corner brackets, dots and hairlines (embedding = dot grid, layer = attention lines over dot rows, head = dot bar chart), amber as the only accent, and the core is now a dial of dot rings that light amber in a sweep with the real load, a hairline ring with ticks, a heart dot that pulses with each pulse. A thin pass line sweeps left to right and warms the connectors behind it. Ignition adds a hairline shock ring; the burst, recombine and hand-off are unchanged. No shadows, rays, bevels or reflections.
- Cricket story frame is a carousel (`src/lib/story-swipe.ts`): drag with a mouse or swipe with a finger and the photos follow the pointer, then settle with a springy ease and a little parallax; tap right for next, left third for back; arrow keys; wraps round; auto-advances every 5.2 s with segmented progress bars (paused on hover or focus, off with reduced motion). The taped photo beside it always shows the next one. Three photos: batting, the stands, the cover-drive poster (`content/cricket.json` `slides`). The custom cursor shows the sideways arrow over it.
- The "psst… press my brain" note arrived already finished because it is added after the pointer is near, so CSS had nothing to transition from: it now settles for a frame and then plays (text wipes in over 1.3 s with an eased edge, the arrow draws after it), and the brain cut-out springs in more slowly.
- Projects table: Lenis was told to ignore the table (`.index__scroll` in the native-scroll list), so a wheel over it fought the page's glide and the first flick was lost. It only scrolls sideways, so it is no longer excluded.

## 2026-10-19 · Boot reactor made physical, name set in the display face, no double name, textured globe ground (Arnav's requests)
- Research (web): real arc-reactor props are a machined or chromed metal bezel round a hollow core lit through a frosted diffuser; film-style post stacks run chromatic aberration, grain, bloom, halation, vignette. Applied in canvas 2D, in the site's graphite and amber.
- Core (`src/lib/reactor.ts`): a recessed housing with a contact shadow; a turned-metal bezel drawn once per size (knurled edge of 132 flutes, spun face with hundreds of fine scratches, a bright chamfer, a dark lip, six screws, two opposed highlight lobes) lit by a key light, then warmed by the core's own light as the charge builds, with a slow specular glint travelling round; engraved scale marks that light with the load; a smoked, frosted glass diffuser whose etched dots are pinholes when off and small blooming light points when on (sweep with real progress); a hot filament with bloom, a warm halation from `--action`, and one anamorphic streak; film grain over the whole machine. Day uses brushed aluminium and no additive light.
- Name in the boot: the stacked mono letters are gone. Each letter is a small dot panel set in the display face (sampled from the font), lit dot by dot in a random order as the pass reaches it (amber at first, settling to ink). Checks the first font family only, because the stack's fallback faces never load.
- Name loading twice: `data-boot` going away put the hero letters' entrance animation (`letter-in`, from invisible) back, so the name played again after the boot. Letters now cross-fade in over 400 ms as the particles fade (`letter-settle`), and `data-booted` keeps them still afterwards. Test added.
- Globe entering /workshop: the ground has a dot grid, very faint orbit rings with cardinal ticks, film grain and a vignette, drawn once and faded with the wash.

## 2026-10-19 · Sending state for the forms (Arnav's request: the 2-3 s wait showed only a "Sending" button)
- `src/lib/send-state.ts`: while a form is on its way a panel opens under the button: a hairline with three stops (VERIFY, SEND, DELIVERED), a small dot-matrix packet that travels it, a mono readout of the stage with a seconds counter, and what is being sent ("Packet · 6 words · from ASHA RAO"). The stops are real moments (the bot check, the request out, the answer); while the request is out the packet only drifts and flattens at 94%, so it never claims arrival; it lands when the answer comes. Failure turns the line to the action colour and says so. The confirmation toast is not delayed: the panel finishes beside it and folds away. `role="status"` announces stage changes only; reduced motion: no travelling, stops light in turn.
- Styles are injected by the module (not in the page stylesheet). Wired in `src/lib/forms.ts`. Tests: unit (`send-state.test.ts`) and two e2e cases (stage, travel, never early, delivered, failure).

## 2026-10-19 · EDITH launcher with presence (Arnav's request)
- The plain bubble pill is now a glass pill with a living mark (`src/lib/edith-orb.ts`): a sphere of seventy-two dots in the hologram colour, lit by depth, turning slowly, looking towards the pointer when it comes near, spinning up on hover, with a ripple every seven seconds. It sits in a small lit well; hover lifts the pill with a soft glow ring; press squashes it slightly. It idles while hidden (hero on screen, panel open, tab hidden); reduced motion draws one still frame. Once per session, nine seconds in, a speech bubble shows typing dots and then the line `site.edith.nudge` (content) for six seconds.
- Still lazy and out of the page stylesheet (`edith-launch.css?inline`, the orb is its own chunk), so the landing HTML and LCP are unchanged; the plain icon shows until the orb loads. Accessible name stays "Ask EDITH"; the bubble is decorative. Tests: orb present and painted, the nudge speaks once.
- Also: the sending-state panel is now a lazy chunk (a static import had pushed LCP to 2,107 ms); a zero-size boot canvas no longer breaks the bezel draw.

## 2026-10-19 · Phase 1 close-out (Arnav: "done, commit and close this phase")
- Evidence gathered: https://arnavc.in answers HTTP/2 200; Lighthouse mobile 0.99 / 1 / 1 / 1, LCP 1,957–1,958 ms, CLS 0, script 34 KB, HTML 13,672 B; linkinator: 48 links, none broken; 543 unit + 379 e2e tests pass (axe in both themes); mail from the forms now reaches arnavc.work@gmail.com (the verified Email Routing destination; the earlier address was never verified).
- Gate items still open, so Phase 1 is NOT closed: (1) `/admin` is closed to everyone until the Cloudflare Access application exists and `ACCESS_TEAM_DOMAIN` / `ACCESS_AUD` are set; (2) EDITH answering from the knowledge base on the live site has not been checked (needs `pnpm kb:build` against the remote index and a live question); (3) 1.10 leftovers: Workers Builds from GitHub, Web Analytics, `www.arnavc.in`.
- Plan ticked: 1.8, 1.9, 2.1, 2.2, 2.3. 1.10 stays open.

## 2026-10-19 · /admin PIN sign-in (Arnav: the Cloudflare Access emailed code never arrived, "can we use a pin instead")
- Cloudflare Access cannot do a static PIN, so `/admin` gains its own: `worker/pin.ts` + routes in `worker/admin.ts`. The PIN is the Worker secret `ADMIN_PIN` (`wrangler secret put ADMIN_PIN`, at least six characters, fails closed below that). `/admin/login` takes the PIN (same-origin form post, constant-time compare), and a correct one sets an HttpOnly, SameSite=Strict, Secure cookie, an HMAC over its expiry keyed from the PIN (twelve hours; changing the PIN signs everyone out). Guessing: a 0.5 s pause per wrong try, five wrong tries per connection per 15 minutes and thirty for everyone per hour, then 429. `/admin` accepts Access's JWT or the PIN session; with neither configured it still answers 503.
- If the Access application still exists in front of `arnavc.in/admin*` it intercepts first, so it must be deleted (or its path removed) for the PIN screen to be reached.
- Tests: `tests/unit/worker/pin.test.ts` (cookie signing, tamper, expiry, login, lockout, cross-site refusal); 218 worker tests pass.

## 2026-10-19 · Phase 1 gate closed (Arnav: admin works, only arnavc.in matters)
- `/admin` works with the PIN (Arnav confirmed); every Phase 1 gate item is now checked with evidence in `docs/phase_completion.md`. Left on task 1.10: Web Analytics (for the very end). `www.arnavc.in` skipped by choice; `workers_dev: true` restored so the workers.dev link answers again after the next deploy.

## 2026-10-19 · 2.4 (the 3D room) · built and under review, NOT ticked (waiting for Arnav's "done")
- Room at `/workshop`: React Three Fiber, lazy-loaded only from that page (landing HTML unchanged at 13,671 B; room chunk about 300 KB gz plus 68 KB React DOM; models 196 KB; Draco decoder 752 KB self-hosted). Warm-minimal AI engineer's studio: oat plaster, pale oak floor, matte black trim, black-framed window with sheer curtains and a Mumbai skyline (rain from `/api/weather`), cream fur rug, cream sofa, oak desk with a MacBook, Studio Display and Mac mini whose screens show code, a loss curve and a terminal, two paper pendants, an arc floor lamp, floating shelves with books, six original minimal prints, a wall clock on Mumbai time, plants drawn in code, a lit corridor behind the door, plus small details (headphones, notebook, basket with a throw, coat rail with a hoodie, shoe tray, candle).
- Day and Night follow Mumbai time in Auto (`D` toggles, 1.2 s cross-fade); quality tiers with `PerformanceMonitor`; WebGL-off and phones fall back to the server-rendered zone list; the loader shows real model-download progress.
- Walk mode (desktop): `F` or the Walk pill; first person at eye height; WASD or arrows, Shift runs, drag to look, click the floor to walk there; hands in the view and legs when looking down; collision with the walls and furniture; `E` opens the zone beside you; `Esc` steps back one level; `Shift+D` is the theme key while walking.
- Verification: typecheck 0 errors, lint clean, 580 unit tests pass (13 + 14 + 2 new files for the room's logic), build ok, 17 e2e (room and workshop specs) pass including axe in both themes with the room on, GL draw calls under 150 per frame, walking and collision, and a phone staying on the tour. Screenshots reviewed at 1440 in Night and Day, the desk, sofa, window and door shots.
- Not yet done: the full e2e suite, `pnpm lhci` on `/` and `/workshop`, screenshots at 768, a phone after "Try anyway", fps on a real device (Phase 2 gate, task 2.8).
- Day pass (Arnav: "white foggish thing during day, make it clear, good sunlight"): the fog was the HUD's ivory readability scrims plus a bloom that caught every bright Day surface. Day now has barely-there scrims and a small frosted card behind the list and caption, bloom nearly off, a higher warm sun (the sun stands higher than the moon, so the window throws clear patches across the floor), stronger ambient light, a clearer blue sky and a crisp city (less haze). Re-checked at 1440 in Day: overview and window shots.
- Smoothness and flicker pass (Arnav: "lights bugging in day and night, white light flashes when I move, should feel like 120 Hz"; "hands look like a zombie"; "holotable lower, rectangular, like Iron Man"). Causes found: (1) when frames dropped, the room swapped the whole quality tier at once: new pixel ratio, effects stack removed (and with it the exposure and tone curve), sun light rebuilt, so the picture jumped; (2) the holotable's point light sat 0.5 m over a glossy glass top and made a white specular hotspot that slid across as the camera moved (same for the window glass and the MacBook metal); (3) the camera ran a frame behind the walker; (4) per-frame allocations and a clock read every frame. Fixes: a drop in frame rate now lowers only the resolution, in three small steps, and the tier swap is the last resort; shadows are drawn only while they can change (first moments, tier change, day/night fade) instead of every frame; pixel ratio cap 2 to 1.5 (low 1.25 to 1) and MSAA 4 to 2; walker runs before the camera and uses a smoothed frame time; the stride phase and its strength are eased and shared by the camera bob, legs and arms; glass, metal and the holo light are softer and higher. Hands: no longer glued to the screen; two arms hang from the shoulders at your sides and swing against the legs, so they are out of view at eye level and show when you look down. Holotable: a low 2.4 x 1.2 m black slab on a recessed plinth, hovering on a cyan line, glass top with grid, corner brackets, three emitter lenses and a slow scan line, floor glow, four corner light threads and a faint volume frame (`HoloTable.tsx`); collision is now a rectangle. Checked in screenshots (Night and Day) and by sampling brightness while walking in software GL: steady (about 3% step on the last-resort tier change, was about 35%). Not measured: real-GPU frame rate (needs Arnav's Mac; target 120 Hz on ProMotion).
- Symmetry (Arnav): the holotable now stands at the exact centre of the room (x 0, z 0), the rug is centred on it (radius 1.9), and the overview camera looks straight down the room's centre line. Walking e2e still passes; 580 unit tests pass.
- Finding the brain door (Arnav: "how do we ensure people know to hover there"; delegated the UX call to me, 2026-10-19): a hint ladder in `src/lib/workshop-entry.ts`: a tiny breathing amber beacon over the skull from the first paint (hidden on touch, where the brain itself breathes); it warms and swells over the 170 px before the near zone (`warmth()`); if the pointer has not gone near in 6 s (touch: 4 s), the same pencil note says "hover over my head" (touch: "tap my brain") for 3.5 s; offered once per browser (`arnav:ws-hint:v1`, try/catch) and never again once the brain is found; the nav Workshop link stays the guaranteed route. Copy in `content/site.json` (`hoverNote`, `tapNote`). Landing HTML unchanged at 13,670 B. 4 new unit tests (584 total) and an e2e for beacon then nudge then quiet second visit.
- Transition into walking (Arnav: "abrupt"): the view now flies from the tour camera to the figure's eyes on the same 1.5 s ease as every other camera move (it tracks the live eye, so a key pressed on the way steers it), the body and hands appear as it arrives, and Esc flies back to the overview instead of leaving the camera at eye height. Reduced motion cuts.
- Door area (Arnav: "change the bag and carry bag"): the coat rail with hoodie and tote is replaced by a slim oak console on black legs with a key tray, two books, a small vase with dried stems and a round black-ringed mirror above; collision added.
- Round 3 (Arnav): looking is now by mouse movement, not dragging: the pointer is captured when walking starts (Walk button, F, Esc-back from a zone), moving the mouse turns the head, Esc frees the mouse and a second Esc stops walking, a click on the view captures it again; where the browser refuses, drag-to-look still works (`Walker.tsx`, `Room.tsx`). The pulsing dot is gone: the same pencil note now says "hover over my mind" with an arrow to the skull from the first paint (touch: "tap my brain", not on narrow phones) and stays until the pointer goes near, when the brain and "psst... press my brain" take over; once a browser has found the brain it never shows again. Night walls: the paint went from muddy tan to a clean pale greige (`--room-wall` #d8cfc0, wall-low, ceiling) and the lamp colour from amber to a soft warm white, with a little more ambient fill, so the shading no longer reads as stains. The figure shown when a zone is open (as in Arnav's screenshot) now has a neck, head and short dark hair, and a torso that meets the legs; the head is hidden in first person so it never fills the view. Checked: landing (night and day) with the note and on hover, room overview and the holotable view with the figure.
- Zone views (Arnav: no character while viewing the hologram, a slight zoom in, and none either when its content arrives in the next phase): the figure and hands are hidden whenever a zone is open (the head added a moment earlier is removed again), and the holotable shot is closer and lower ([0, 1.5, 2.1] looking at [0, 0.95, 0]) so the table fills more of the frame.
- Hint note overlapped the Work heading on some screens (Arnav's screenshot): the note is now drawn after the pencil font has loaded (it was measured against the fallback font, which is a different size) and re-checked against the corner heading once it is live. Verified by measuring the note against every corner text at 11 viewport sizes from 1000 x 800 to 2560 x 1300: no overlap at any.
- Hint on every visit (Arnav: "it should come every time"): the hint was hidden for browsers that had already found the brain; that memory is removed, so the pencil note now draws on every visit of the landing page, reads "hover here for secret" (touch: "tap here for secret"), gives way to the brain's own note when the pointer goes near and comes back when it leaves. Both notes are kept clear of the Work heading. Checked: e2e (hint returns after hover and on a second visit, brain still opens the workshop), 582 unit tests, screenshot at 1850 x 1000.
- Notes overlapping after hover and moving away (Arnav's screenshot): the hint's CSS rules also matched the brain's own note, so with the hint back both were drawn at once. The rules are now scoped to each note, the hint retracts (instead of vanishing) as the brain's note draws in, and the brain's note retracts fully before the hint comes back. Measured on the live page: after moving away the brain's note is fully hidden at 0.3 s and the hint starts drawing at about 0.9 s; going near, the hint is 99.6% hidden at 0.3 s. At no time are both visible.
- White flashes while walking, found and fixed (Arnav: "flashing white glitches when I walk"). Method: read every rendered frame's brightness in the room while walking, kept the before/after pixels of each jump, and logged React renders. Result: twice per walk the whole picture jumped about 13% brighter and flatter for 2 frames (about 4% of pixels near-white), each time within 100 ms of the lighting component re-rendering, which happened whenever the room component re-rendered (the figure passing a zone, the clock). The lights contained drei's `Environment`, whose light panels were new elements on every render, so drei redrew the environment map each time. Not the cause (each switched off in turn with the flash unchanged): the effects stack, shadow updating, the baked floor shadows, the hotspot labels, the near-zone state, the body and hands. Fixes: the environment is built once (`useMemo`), the four static scene parts (outside, lighting, shell, props) are memoised so a room re-render no longer reaches them, the effects stack is its own memoised component, the lights no longer re-render on every loader event, and standing beside a hotspot while walking is a gentle brightening (0.5) instead of the full hover glow. After the fix the same walk shows no flash (the repeating +13% jumps are gone); the full-brightness hotspot glow earlier measured as a white disc is also gone. Limits: measured in software GL at 10 to 16 fps, not on a real GPU at 120 Hz.

## 2026-10-20 · 2.4 closed (QA gate) · Arnav said "done"
| Check | Result | Evidence |
|---|---|---|
| typecheck, lint, hex check | pass | 0 errors, clean, 123 files |
| unit tests | pass | 583 (room, walking, entry hint, clock parity) |
| e2e, whole suite | 381 of 388 first run; the 7 failures sorted below | `pnpm e2e` on a second port (8788) because Arnav's preview held 8787 |
| e2e, affected files after fixes | see final line below | room, workshop, enter, loader, hero-hold, forms-api |
| axe | pass | both themes, room on and off |
| linkinator | pass | 49 links scanned, none broken |
| Lighthouse `/workshop` (3 runs) | pass | all assertions |
| Lighthouse `/` (3 runs) | pass on the median | LCP 1956, 1956, 2105 ms; untouched code on the same machine 1959, 1955, 2030; thin headroom as before |
| screenshots | reviewed | 375/768/1440 x Night/Day, reduced motion, phone fallback and phone after "Try anyway" (16 images); no console errors |
| 3D | pass | no console errors; draw calls < 150; flash and judder fixed and measured |

The 7 first-run failures and what they were:
- `forms-api` five messages an hour: stale since Arnav raised the limit to 7 (test updated).
- `enter` brain press, `enter` rises from page colour, `loader` slow page, `loader` fast page: my regressions or timing. The page heading was hidden during the room's loading phase (now kept for screen readers); the room's own "Loading neural pathways" loader was counted as a page-transition loader (tests now tell them apart); the room's start-up keeps a software-rendered page busy for seconds, so the veil check got a longer budget, and the room now waits for the 1.2 s arrival veil before starting.
- `hero-hold` without JavaScript: the test hardcodes port 8787, so it failed only on my second port; passes on 8787.
- `landing` ARNAV-OS boot: fails identically on the untouched code (checked in a clean worktree at HEAD); not from this task, left alone.

Found by the QA gate: the landing page's LCP had gone to 2,104 ms. Cause: the room's code imported from the same modules as the landing's first script (`theme`, `mumbai-time`), so they became shared files that the landing had to fetch first (two extra requests). The room now has its own copies (`lib/workshop/typing.ts`, `room-clock.ts`, with a unit test that the clock matches the site's), and the landing's imports are the same as before. One extra shared file remains (`preload-helper`, 1.2 KB) which does not move the median. Also found: the hint note was clipped at the left edge at about 768 px wide; it now slides in to stay on screen (checked at 8 widths, 660 to 1280).

Not part of 2.4 and still to do in 2.8: real-device frame rate (60/30 fps), first load <= 8 MB, the 3D brain dive.
- Final run after the last fixes: unit 583 pass; e2e on the affected files (workshop, room, enter, loader, hero-hold, forms-api) 61 pass.

## 2026-10-20 · 2.4 deployed and watched live
- Pushed as `c0e5eea` on `origin/main`; Cloudflare Workers Builds ("Workers Builds: arnav-portfolio") reported success on that commit. No GitHub Actions in this repo: the deploy is Cloudflare's Git-connected build.
- Live check on https://arnavc.in: `/`, `/workshop/`, `/workshop.json`, both room models, the Draco decoder and `/api/health` all 200; the landing page's script and CSS file names are identical to the local build; a real browser run on the live site showed the pencil note ("hover here for secret"), the room starting with its canvas, walk mode moving the figure, and no console errors.
- Phase 2 gate: two of four boxes ticked with evidence (Day/night on Mumbai time with the `D` key; every hotspot reachable by keyboard). Still open: the 3D brain dive and 60/30 fps with first load under 8 MB (both in 2.8), and tasks 2.5 to 2.8.
- Next session (Arnav): the holotable OS, the armour wall and the other props, plus his posters. A decision gate comes first.

## 2026-10-20 · Improvement step: text motion (titles and paragraphs)
- Asked by Arnav: look at text effects for titles and paragraphs, choose the best two, pick one and apply it for the best UX and smoothness. Not a new phase.
- awesome-design-md has no text-motion specs (only colour, type, layout, shadows), so the candidates were judged against this site's rules: transform and opacity only, no new dependency (GSAP is locked and not installed), readable throughout, reduced motion respected, no layout shift.
- Considered: per-letter reveal, blur-to-focus, letter scramble (the existing title decode), typewriter, masked word rise, line-by-line rise. Dropped: per-letter (hundreds of nodes, hurts copy and screen readers), blur (filter repaints large text), typewriter (slow, text unreadable until done). The scramble rewrote `textContent` every frame, so widths jittered and every frame cost a layout.
- Chosen: masked word rise for titles and a line-by-line rise for paragraphs, one small engine, `src/lib/text-fx.ts`, started after the LCP paint from `motion.ts`. Both reverse on leaving the viewport (same band as `reveal.ts`), use `--ease-out`, `--dur-reveal` and `--stagger`, keep real spaces between word spans, and do nothing with reduced motion (the block fade in `reveal.ts` remains). The block fade stops moving a block that holds split text, so nothing travels twice.
- Retired the title decode in `dynamic.ts` (it also rewrote the spans). Its helpers and tests went with it.
- Verified: typecheck, lint, no-hex clean; unit 365 pass; new e2e `text-fx.spec.ts` (split, rises to rest, drops back, lines, reduced motion) plus `motion.spec.ts` pass; screenshot at the settled state shows no clipped descenders. Full e2e result below.
- Full e2e: 390 pass, 1 fail. The failure is `landing.spec.ts` "ARNAV-OS boot … plays once per session and hands off to the hero" (`getImageData` on a zero-width canvas inside `reactor.ts`). It fails the same way with this change stashed, so it predates it and is not caused by text motion; it is still open. One hero-hover test failed once in the full run under load and passed on re-run and on baseline.

## 2026-10-20 · Text motion, bolder pass
- Arnav could not see the first version. Cause, measured in a real browser on the dev server: it ran, but words moved about 60 px with an expo ease that finishes in ~300 ms, on ten titles only, so it read as nothing. Not a bug; too subtle.
- Web search (kinetic type, split-text masks, scroll-scrubbed highlights, variable-font hover, scramble) gave the families; chosen for a minimal, smooth site and kept to transform/opacity: letter flip with cursor lift on titles, scroll-driven reading highlight on About and the quote, mono scramble on section labels.
- `text-fx.ts` rewritten: titles split into letters (3D tilt up from behind the word edge, 28 ms apart, 900 ms); letters near the cursor lift and swell via the separate `translate` and `scale` properties (fine pointers); About paragraphs and the quote dim to 16% and light word by word as they scroll through the viewport, both directions; mono labels decode (assistive tech reads a hidden real-text span, the noise is aria-hidden). Reduced motion: nothing split.
- Verified: typecheck, lint, no-hex; unit 369 pass; e2e 391 pass, 1 fail (the pre-existing boot test above); dev-server filmstrip showed the label decoding, the title flipping in and the paragraphs lighting up in reading order.
