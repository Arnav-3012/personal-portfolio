# Arnav's Portfolio — Claude Code rules

Personal portfolio: a fast 2D website (the product) plus an optional 3D workshop (the reward). Hosted on Cloudflare's free plan on Arnav's custom domain.

**Source of truth:** `docs/SPEC.md`. Before any task, read the SPEC sections it touches. If the SPEC and a request conflict, stop and ask.

## Locked stack (ask before adding anything else)
- Astro + React islands, TypeScript strict, pnpm
- 3D: three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing (lazy-loaded on `/workshop` only)
- Motion: GSAP + Lenis
- API: Hono in one Cloudflare Worker with static assets (`wrangler.jsonc`: assets from `./dist`, Worker runs first for `/api/*` and `/admin*`)
- Data: D1, KV, Vectorize, Workers AI, Email Routing send-email binding, Turnstile
- Asset compression: gltf-transform CLI (Draco + KTX2)
- Testing: Vitest (+ @cloudflare/vitest-pool-workers for the Worker), Playwright, @axe-core/playwright, linkinator, Lighthouse CI

## Hard rules
- No Blender. 3D = procedural geometry + shaders in code, CC0/CC-BY models (Poly Haven, Kenney, Quaternius, Poly Pizza), Meshy/Tripo for hero props and the avatar.
- No Marvel names, logos, suits, characters or posters. No Virat Kohli images or likeness. Original designs only.
- No BEINN brand and no guitar anywhere on the site.
- Hero layout: portrait on the LEFT, name and text on the RIGHT (Arnav faces right, toward the text). Never mirror the portrait. Source image: `assets/portrait-original.png` (1122 × 1402; upscaled version to come). If the hair cutout looks jagged, keep the grey background and fade it into `--bg` with a radial mask.
- All content comes from `content/*` files. Never hardcode bio, roles, projects or stats in components.
- Colours, type, spacing, motion only from `src/styles/tokens.css` (Night + Day themes per SPEC). No raw hex in components.
- Theme: Auto (Mumbai time for 3D, OS setting for 2D) / Day / Night. `D` toggles (not while typing; `Shift+D` in free-roam). Settings panel persists to localStorage inside try/catch.
- Every 3D feature has a 2D equivalent. Respect `prefers-reduced-motion`. Visible focus rings. Text contrast ≥ 4.5:1 in both themes.
- Performance budgets in SPEC "Performance" are acceptance criteria, not goals.
- Secrets only via `wrangler secret put`. Never commit `.env` or `.dev.vars`.
- Free-plan limits from SPEC "Architecture" must hold: cache external APIs in KV, rate-limit EDITH, daily AI cap with graceful fallback.

- Loaders and alerts follow SPEC "Loading states and alerts": real progress, themed per area, never a generic spinner; toasts via one component.
- All sound goes through one `AudioManager` (muted by default, respects Settings). Phase 5 adds files; earlier phases only wire the hook.
- Media is self-hosted MP4 (H.264, 720p, < 25 MiB) with posters and captions. No Instagram embeds.

## Workflow
- Reusable prompts live in `docs/prompts.md`: decision gate, mistake log, QA gate. Every task runs gate → build → QA → mistake log.
- Work one task from `docs/plan.md` at a time. Use plan mode first for anything touching more than 3 files.
- After each task, append to `docs/logs.md` (what was done, how verified) and `docs/changes.md` (files changed). Record any wrong turn and its fix in `docs/mistakes.md`.
- A phase is done only when every gate in `docs/phase_completion.md` is checked with evidence.
- Verify before saying done: `pnpm typecheck && pnpm lint && pnpm build`, then run it and look at it.
- Small commits with clear messages, one task per commit.

## Commands
- `pnpm dev` (Astro) · `pnpm wrangler dev` (Worker + assets locally)
- `pnpm build` · `pnpm typecheck` · `pnpm lint`
- `pnpm kb:build` (re-embed `content/` into Vectorize)
- `pnpm wrangler deploy`
