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
