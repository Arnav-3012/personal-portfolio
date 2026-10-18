# Task log

Newest first. Each entry: what was done, how it was verified, open items.

---

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
