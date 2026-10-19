# Build plan

Phases follow SPEC "Build phases". Only Phase 1 is broken into tasks; later phases get broken down when Phase 1's gate passes.

## Phase 1 · 2D site, live on the domain

- [x] **1.1 Scaffold** — Astro + React + TS strict, pnpm, ESLint/Prettier, Hono Worker with static assets, `wrangler.jsonc` with D1/KV/Vectorize/AI/Email bindings, folder layout (`src/`, `worker/`, `content/`, `public/`, `scripts/`). `pnpm wrangler dev` serves a hello page and `/api/health`. Test harness set up (Vitest, Playwright, axe, linkinator, Lighthouse CI) with one passing test each.
- [x] **1.2 Design system** — `tokens.css` (Night + Day), fonts self-hosted (Unbounded, Geist, JetBrains Mono, Fraunces), theme controller (Auto/Day/Night, `D` key), settings panel, grain overlay, reduced-motion handling, toast component, top progress bar + skeletons, `AudioManager` hook (muted, no files yet).
- [x] **1.3 Content** — create every `content/*` file from SPEC "Content model", filled with real data already in SPEC (projects, stats, roles) and clear `TODO` placeholders for what Arnav supplies.
- [x] **1.4 Landing, part A** — transformer boot (decodes the name into the hero), segmented HUD nav (freelance status, Mumbai clock, resume), centre-stage dot-matrix hero with corner quadrants (`src/assets/portrait/portrait.jpg`, never mirrored), proof strip, warm amber palette. Enter-workshop button, brain hotspot and the mobile "best on desktop" note moved to Phase 2 (Arnav, 2026-10-18).
- [x] **1.5 Landing, part B** — split into four gated tasks (Arnav approved, 2026-10-18); tick 1.5 when all four are done. Responsive per SPEC.
  - [x] **1.5a Work** — selected work (sticky split, top 5 hero projects) and the filterable all-projects index. Done when: both read from `projects.json`, the active project follows scroll, filters work without breaking no-JS, axe 0 in both themes, QA gate passes.
  - [x] **1.5b Experience and 75 Hard** — experience rail, 75 Hard orbiting reel cards and full-screen reel player. Done when: both sections read from `experience.json`, `site.json` (honors) and `discipline.json`; the rail draws on scroll; cards revolve round the headline, spread on scroll, straighten and play on hover; a click opens a keyboard- and swipe-navigable player; mobile is a swipe strip; no-JS and reduced motion show everything; the featured reel's proximity audio plays only with Settings sound on; axe 0 in both themes; QA gate passes. Captions (WebVTT) deferred to the Phase 5 gate (Arnav, 2026-10-18).
  - [x] **1.5c Skills and Beyond code** — skills by layer with the dock; cricket and 75 Hard teaser tiles.
  - [x] **1.5d Freelance, GitHub, contact, footer** — UI only; form and GitHub backends arrive in 1.6 and 1.7.
  - _1.5c and 1.5d run as one gated batch, 1.5cd (Arnav approved, 2026-10-18): one plan, one build, one QA pass, one "done", two commits. Done when: Skills (id `about`, opens with the profile.md intro, layers from `skills.json`, dock from `site.dock`), Open to freelance (status from `freelance.json`, form client with honest failure until 1.6), GitHub live (typed `/api/github` contract, skeleton and fallback until 1.7), Beyond code tiles, Contact and Footer all read from `content/`; no stubs left; axe 0 in both themes; QA gate passes; landing JS stays < 120 KB gz and LCP < 2.0 s._
- [x] **1.6 API: forms** _(batch with 1.7: one gate, one QA, one "done"; Arnav approved 2026-10-18)_ — `/api/forms` (contact, freelance, notebook) with Turnstile, D1 storage, email to Arnav's verified address, honeypot, length limits.
- [x] **1.7 API: live data** _(batch with 1.6)_ — cron → GitHub (REST + GraphQL contributions), Open-Meteo → KV; endpoints the landing reads.
- [x] **1.8 EDITH-lite** _(batch with 1.9: one gate, one QA, one "done"; Arnav approved 2026-10-18)_ — `scripts/kb-build.ts` (chunk `content/` + README summaries → Vectorize), `/api/chat` SSE with Workers AI, tool calls (`scrollTo`, `openProject`, `openResume`, `enterWorkshop`, `startFreelanceForm`), guardrails, per-IP rate limit, daily cap fallback, floating widget UI. Reply format is TTS-ready: the spoken text is plain sentences, with markdown/links in a separate field. No voice endpoint yet.
- [x] **1.9 Admin** _(batch with 1.8)_ — `/admin` behind Cloudflare Access: inbox, freelance switch, "currently building" (KV).
- [x] **1.10 Deploy** — domain (`arnavc.in`) on Cloudflare, Worker custom domain, Email Routing verified (mail to `arnavc.work@gmail.com`), Turnstile keys, Workers Builds from GitHub, `/admin` behind a PIN (Access dropped, Arnav's call). Web Analytics moved to the last phase (Arnav, 2026-10-19: do it at the very end); `www.arnavc.in` skipped by choice.

## Phase 2 · Workshop

Arnav (2026-10-18): Phase 1 first, then the workshop **entry** only; the 3D room is a separate go afterwards. So Phase 2 splits in two, and its gate in `phase_completion.md` stays open until 2b.

### 2a · Entry layer and 2D motion (this go, after Phase 1's 1.8–1.9)

- [x] **2.1 Entry layer** _(batch with 2.2)_ — nav "Enter workshop" button, pulsing amber brain hotspot on the upper back of the dot-matrix head with a mono "ENTER · WORKSHOP" label, footer link, mobile "best on desktop" note with "try anyway", WebGL/low-memory check, and a `/workshop` page. Until the 3D room exists, `/workshop` is the HUD zone list (every zone linking to its 2D section, keyboard and screen-reader reachable) with an honest "opening soon" state; three.js stays out. Done when: entry points work by mouse, touch and keyboard; the mobile note and "try anyway" work; `/workshop` lists every SPEC zone with a working link; axe 0 in both themes; QA gate passes.
- [x] **2.2 Motion pass (2D)** _(batch with 2.1)_ — zero-dependency CSS + small TS, after LCP: all-projects table (staggered row reveal, hover lift with amber marker, "building" status pulse, FLIP transition when filters hide/show rows, animated filter counts), proof-strip count-up, hotspot pulse, magnetic buttons (fine pointers only). Design reference: awesome-design-md Linear for table density and hover states; all values from `tokens.css`. Done when: animations run in both themes and are off (fades only) under reduced motion; CLS < 0.05, LCP < 2.0 s, landing JS < 120 KB gz, HTML budget holds; axe 0; QA gate passes.

- [x] **2.3 Entry sequence** _(Arnav, 2026-10-19; plan approved)_ — hover near the brain area of the head and a CC0 brain cutout pops up; pressing it plays brain dive → dot-matrix globe → turn to India → Mumbai pin → zoom in → arrive on `/workshop` (about 5 s; Esc, Skip or a click skips; reduced motion, modifier-click and no-JS are a plain link). Canvas 2D, lazy, nothing in the render-blocking CSS. Credits for the brain (Wikimedia Commons, CC0) and the land data (Natural Earth) in `content/credits.json`. Done when: hover shows and hides the brain, press plays the whole sequence and lands on `/workshop` which rises from the page colour, skip paths and reduced motion work, Night and Day both read clearly, axe 0, Lighthouse budgets hold (LCP < 2.0 s), targeted tests pass. When the 3D room is built (2b) the same sequence lands inside it.

### 2b · The 3D room (separate go; broken down when Arnav says go)

Brain dive in three.js, the room and its props, the holotable (Earth intro, icons, windows) and every prop and holotable animation, Mumbai-time day/night, HUD hotspot list, performance gate. Needs Meshy/Tripo/Mixamo accounts for hero props. GSAP + Lenis arrive here, lazy on `/workshop`.

## Phase 3 · Worlds — break down after Phase 2 gate

- [ ] **3.x EDITH spoken replies** (final number set when Phase 3 is broken down) — `/api/voice/tts` (Workers AI MeloTTS, 600-character cap, per-IP rate limit), KV caching of stock lines, the voice Neuron allowance in KV, fallbacks (browser `speechSynthesis`, then text-only with one toast), the 2D speaker button and waveform ring, the 3D speaking state and mouth movement. Tests: Vitest for the endpoint (over-length text, allowance reached, model error); Playwright for toggle on/off/stop and the fallback; axe on the controls.

## Phase 4 · Story + play — break down after Phase 3 gate (includes the discipline wall)
## Phase 5 · Media and sound — after launch: more reels, proximity audio, royalty-free music, UI sounds
- [ ] **5.x Web Analytics** _(moved here from 1.10; Arnav, 2026-10-19: "push it as the last phase plan, not current")_ — Cloudflare Web Analytics for `arnavc.in` (automatic setup, or a beacon script loaded after first paint so LCP and the landing JS budget hold). Done when: visits show in the dashboard; Lighthouse budgets unchanged.
