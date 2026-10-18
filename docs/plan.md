# Build plan

Phases follow SPEC "Build phases". Only Phase 1 is broken into tasks; later phases get broken down when Phase 1's gate passes.

## Phase 1 · 2D site, live on the domain

- [x] **1.1 Scaffold** — Astro + React + TS strict, pnpm, ESLint/Prettier, Hono Worker with static assets, `wrangler.jsonc` with D1/KV/Vectorize/AI/Email bindings, folder layout (`src/`, `worker/`, `content/`, `public/`, `scripts/`). `pnpm wrangler dev` serves a hello page and `/api/health`. Test harness set up (Vitest, Playwright, axe, linkinator, Lighthouse CI) with one passing test each.
- [x] **1.2 Design system** — `tokens.css` (Night + Day), fonts self-hosted (Unbounded, Geist, JetBrains Mono, Fraunces), theme controller (Auto/Day/Night, `D` key), settings panel, grain overlay, reduced-motion handling, toast component, top progress bar + skeletons, `AudioManager` hook (muted, no files yet).
- [x] **1.3 Content** — create every `content/*` file from SPEC "Content model", filled with real data already in SPEC (projects, stats, roles) and clear `TODO` placeholders for what Arnav supplies.
- [ ] **1.4 Landing, part A** — boot sequence, sticky nav (freelance pill, resume, enter-workshop button), hero with portrait on the left and name/text on the right (`assets/incoming/portrait/portrait-original.png`, never mirrored) + brain hotspot over the upper back of the head, proof strip.
- [ ] **1.5 Landing, part B** — selected work (sticky split), all-projects index, experience rail, 75 Hard reel section (floating cards, reel player), skills + dock, freelance section, GitHub live, contact, footer. Responsive per SPEC.
- [ ] **1.6 API: forms** — `/api/forms` (contact, freelance, notebook) with Turnstile, D1 storage, email to Arnav's verified address, honeypot, length limits.
- [ ] **1.7 API: live data** — cron → GitHub (REST + GraphQL contributions), Open-Meteo → KV; endpoints the landing reads.
- [ ] **1.8 EDITH-lite** — `scripts/kb-build.ts` (chunk `content/` + README summaries → Vectorize), `/api/chat` SSE with Workers AI, tool calls (`scrollTo`, `openProject`, `openResume`, `enterWorkshop`, `startFreelanceForm`), guardrails, per-IP rate limit, daily cap fallback, floating widget UI.
- [ ] **1.9 Admin** — `/admin` behind Cloudflare Access: inbox, freelance switch, "currently building" (KV).
- [ ] **1.10 Deploy** — domain (`arnavc.in`) on Cloudflare, Worker custom domains, Email Routing verified, Turnstile keys, Web Analytics, Workers Builds from GitHub.

## Phase 2 · Workshop — break down after Phase 1 gate
## Phase 3 · Worlds — break down after Phase 2 gate
## Phase 4 · Story + play — break down after Phase 3 gate (includes the discipline wall)
## Phase 5 · Media and sound — after launch: more reels, proximity audio, royalty-free music, UI sounds
