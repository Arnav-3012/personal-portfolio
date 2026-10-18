# Task log

Newest first. Each entry: what was done, how it was verified, open items.

---

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
