# Changes

Newest first. Files changed per task.

---

## 2026-10-18 · 1.6 + 1.7 Forms API and live data

**Added**
- `worker/forms.ts`, `email.ts`, `github.ts`, `weather.ts`, `data.ts`, `cron.ts`, `secrets.d.ts`
- `migrations/0001_forms.sql` (`submissions` table, `created_at` index)
- `src/lib/form-rules.ts`, `turnstile.ts`, `github-data.ts`
- `tests/unit/worker/forms.test.ts`, `email.test.ts`, `github.test.ts`, `weather.test.ts`, `data.test.ts`, `cron.test.ts`, `helpers.ts`, `raw.d.ts`; `tests/unit/lib/form-rules.test.ts`, `turnstile.test.ts`
- `tests/e2e/forms-api.spec.ts`, `tests/e2e/fixtures/github.json`

**Changed**
- `worker/index.ts`: mounts `/api/forms` and the data routes; exports `fetch` and `scheduled`
- `wrangler.jsonc`: `MAIL_FROM` / `MAIL_TO` vars, two cron triggers; `worker-configuration.d.ts` regenerated
- `src/lib/forms.ts`: rules moved out, Turnstile token, `verification` failure reason; `src/lib/github.ts`: contract moved to `github-data.ts`
- `src/components/FormField.astro`, `landing/Contact.astro`, `landing/Freelance.astro`: Turnstile slot and site key
- `src/components/landing/GithubLive.astro`: skeleton sized to the loaded block per breakpoint
- `src/styles/global.css`: idle Turnstile slot takes no row
- `content/site.json`, `src/lib/content.ts`: `turnstileSiteKey`
- `playwright.config.ts`: fresh local D1/KV per run, migration, KV seed, test Turnstile secret
- `tests/e2e/freelance-contact.spec.ts` (Turnstile stub, real sends), `github-live.spec.ts` (stubbed 404, real endpoint, no-jump tests), `beyond.spec.ts` (tilt waits for the page to settle); `tests/unit/lib/forms.test.ts`
- `docs/plan.md` (1.6 and 1.7 ticked), `docs/mistakes.md`, `docs/logs.md`

## 2026-10-18 · 1.5cd Skills, freelance, GitHub, beyond code, contact, footer

**Added**
- `src/components/landing/Skills.astro`, `Freelance.astro`, `GithubLive.astro`, `BeyondCode.astro`, `Contact.astro`, `Footer.astro`; `src/components/FormField.astro`
- `src/lib/skills.ts`, `dock.ts`, `tilt.ts`, `forms.ts`, `github.ts`, `icons.ts`, `dates.ts`
- `scripts/check-html-budget.ts` (runs after `astro build`)
- `public/media/cricket/batting.jpg`
- `tests/unit/lib/skills.test.ts`, `dock.test.ts`, `forms.test.ts`, `github.test.ts`, `icons.test.ts`; `tests/e2e/skills.spec.ts`, `beyond.spec.ts`, `freelance-contact.spec.ts`, `github-live.spec.ts`

**Changed**
- `src/pages/index.astro`: the three stubs are replaced by the six sections; `initDock`, `initForms`, `initGithub`, `initTilt`
- `src/lib/landing.ts`: `anchorFor`, `teaser`, `beyondTiles`, `footerSections`
- `content/cricket.json`, `src/lib/content.ts`: `teaser` photo with a `position` focal point
- `src/lib/reels.ts`, `src/components/landing/ReelPlayer.astro`: the player dialog is built in JS (`playerMarkup`); the component keeps only global styles
- `src/components/Icon.astro`: paths moved to `src/lib/icons.ts`
- `src/layouts/Base.astro`: `era` prop (Fraunces opt-in), `data-js` flag; `src/pages/design.astro` opts in
- `src/styles/global.css`: section frame, form and field styles
- `package.json`: `build` runs the HTML budget check
- `tests/e2e/landing.spec.ts`: no stubs, section order, footer tests and screenshots; `tests/unit/lib/reels.test.ts`: `playerMarkup`
- `CLAUDE.md`: HTML budget rule; `docs/SPEC.md`: footer row 12; `docs/plan.md` (1.5c, 1.5d and 1.5 ticked; 1.6+1.7 and 1.9+1.10 batched), `docs/mistakes.md`, `docs/logs.md`

## 2026-10-18 · 1.5b Experience and 75 Hard

**Added**
- `src/components/landing/Experience.astro`, `Hard75.astro`, `ReelPlayer.astro`
- `src/lib/experience.ts`, `src/lib/reels.ts`
- `public/media/75hard/` (5 MP4s + 5 posters, copied from `assets/incoming/75hard/`)
- `tests/unit/lib/experience.test.ts`, `reels.test.ts`; `tests/e2e/experience.spec.ts`, `hard75.spec.ts`

**Changed**
- `src/pages/index.astro`: Experience, 75 Hard and the player replace the `experience` stub; `initExperience()`, `initReels()`
- `content/discipline.json`, `src/lib/content.ts`: reel paths are `media/75hard/…` (new `publicMedia` schema check)
- `src/lib/audio.ts`: `AudioManager.attachElement()`; `tests/unit/lib/audio.test.ts`
- `src/components/Icon.astro`: chevron-left/right, play, pause, volume-2, volume-x
- `tests/unit/lib/content.test.ts`: reel files ship from `public/`, under 25 MiB, exactly one featured
- `docs/plan.md` (1.5b ticked), `docs/mistakes.md`, `docs/logs.md`

## 2026-10-18 · 1.5a Work

**Added**
- `src/components/landing/SelectedWork.astro`, `ProjectDetail.astro`, `AllProjects.astro`
- `src/lib/work.ts`
- `tests/unit/lib/work.test.ts`; `tests/e2e/work.spec.ts`

**Changed**
- `src/pages/index.astro`: Selected work and All projects replace the `work` stub; `initWork()`
- `docs/plan.md` (1.5 split into 1.5a–d; 1.5a ticked), `docs/mistakes.md`, `docs/logs.md`

## 2026-10-18 · 1.4 Landing, part A

**Added**
- `src/components/landing/Boot.astro`, `Nav.astro`, `Hero.astro`, `ProofStrip.astro`; `src/components/FreelancePill.astro`
- `src/lib/boot.ts`, `transformer.ts`, `dotmatrix.ts`, `hero.ts`, `nav.ts`, `landing.ts`
- `src/assets/portrait/portrait.jpg`
- `tests/e2e/landing.spec.ts`; `tests/unit/lib/landing.test.ts`, `transformer.test.ts`, `dotmatrix.test.ts`

**Changed**
- `src/styles/tokens.css`: warm amber palette (Night + Day)
- `src/layouts/Base.astro`: header becomes the segmented nav bar; boot pre-paint flag + failsafe
- `src/pages/index.astro`: landing (boot, nav, hero, proof strip, 1.5 stubs)
- `src/components/Icon.astro`: menu, arrow-up-right, file-text
- `src/lib/content.ts`, `content/site.json`: `portrait.alt`, `boot`
- `lighthouserc.json`: LCP, CLS and script-size budgets
- `tests/e2e/design-system.spec.ts`, `smoke.spec.ts`: skip the boot; wait for reveals before screenshots; new Day bg
- `CLAUDE.md` (hero rule), `docs/SPEC.md`, `docs/plan.md` (1.4 ticked; Phase 2 carry-over), `docs/mistakes.md`, `docs/logs.md`

## 2026-10-18 · 1.3 Content

**Added**
- `content/site.json`, `content/projects.json`, `content/skills.json`, `content/freelance.json`
- `src/lib/content.ts`
- `tests/unit/lib/content.test.ts`

**Changed**
- `src/layouts/Base.astro`: default description from `site.json`
- `content/timeline.json`, `tsconfig.json`: Prettier format only
- `docs/SPEC.md`: content model table and notes, freelance form fields (no budget, email line)
- `docs/mistakes.md`: 2 entries; `docs/plan.md`: 1.3 ticked; `docs/logs.md`

## 2026-10-18 · 1.2 follow-up · Shell UI polish

**Changed**
- `src/styles/global.css`: skeleton scanline, progress tail, head and fade-out, toast redesign (chip, stacked label, countdown, exit)
- `src/lib/toast.ts`: `.toast__body` wrapper, exit animation before removal, no resume once leaving
- `docs/mistakes.md`: skeleton visibility entry

## 2026-10-18 · 1.2 Design system

**Added**
- `src/styles/tokens.css`, `src/styles/global.css`
- `src/lib/settings.ts`, `src/lib/theme.ts`, `src/lib/toast.ts`, `src/lib/progress.ts`, `src/lib/audio.ts`
- `src/components/Icon.astro`, `SettingsPanel.astro`, `Toaster.astro`, `ProgressBar.astro`, `Skeleton.astro`
- `src/pages/design.astro`
- `scripts/check-no-hex.ts`
- `tests/unit/lib/{contrast,settings,audio}.test.ts`, `tests/e2e/design-system.spec.ts`

**Changed**
- `astro.config.mjs`: `fonts` (Fontsource provider, 4 families)
- `src/layouts/Base.astro`: fonts, inline theme init, skip link, shell components; `noindex` + `description` props
- `src/pages/index.astro`, `src/pages/404.astro`: token styles, `#main`
- `package.json`: `lint` runs `check-no-hex`
- `vitest.config.ts`: `worker` + `lib` projects; `tests/unit/health.test.ts` → `tests/unit/worker/health.test.ts`
- `tsconfig.json`, `worker/tsconfig.json`: split unit test coverage by runtime
- `playwright.config.ts`: never reuse an existing server
- `docs/SPEC.md`: `--on-action`, Day `--ok` `#177A42`, Motion Auto, Hologram colour scope
- `docs/prompts.md`: QA gate names `@cloudflare/vitest-plugin`
- `docs/mistakes.md`: 6 entries; `docs/plan.md`: 1.2 ticked

## 2026-10-18 · 1.1 Scaffold

**Added**
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` (allowBuilds: esbuild, workerd), `.nvmrc`, `.npmrc`
- `astro.config.mjs`, `tsconfig.json`, `worker/tsconfig.json`
- `wrangler.jsonc`, `worker-configuration.d.ts` (generated by `pnpm cf-typegen`)
- `worker/index.ts`
- `src/layouts/Base.astro`, `src/pages/index.astro`, `src/pages/404.astro`
- `src/components/.gitkeep`, `src/styles/.gitkeep`, `src/lib/.gitkeep`, `content/.gitkeep`, `migrations/.gitkeep`
- `public/favicon.svg`
- `scripts/kb-build.ts` (stub)
- `eslint.config.js`, `.prettierrc.json`, `.prettierignore`
- `vitest.config.ts`, `tests/unit/health.test.ts`
- `playwright.config.ts`, `tests/e2e/smoke.spec.ts`
- `.linkinator.config.json`, `lighthouserc.json`
- `docs/logs.md`, `docs/changes.md`, `docs/mistakes.md`

**Changed**
- `CLAUDE.md`: test stack now names `@cloudflare/vitest-plugin` (vitest-pool-workers is deprecated).
- `docs/plan.md`: 1.1 ticked after Arnav confirmed "done".

## 2026-10-18 · Assets and content intake
**Added**
- `content/experience.json`
- `assets/incoming/**` (gitignored, not committed)

**Changed**
- `.gitignore`: `assets/incoming/`
- `CLAUDE.md`, `docs/plan.md`: portrait path is now `assets/incoming/portrait/portrait-original.png`
- `docs/SPEC.md`: 5 reels instead of 8–12; asset checklist ticked; two project one-liners
- `content/timeline.json` (added); `docs/SPEC.md`: timeline.json ticked
- `content/profile.md` (added); `docs/SPEC.md`: profile.md ticked
- `CLAUDE.md`, `docs/SPEC.md`: Marvel rule narrowed to visuals, scenes and UI copy
- `content/cricket.json`, `content/discipline.json` (added); `content/experience.json`, `CLAUDE.md`, `docs/SPEC.md` (updated)
- `CLAUDE.md`, `docs/SPEC.md`, `docs/plan.md`: domain `arnavc.in`
- `README.md` (added): site overview, badges, feature status, coming-soon 3D phases, setup and scripts

## 2026-10-19 · Boot redesign, depth pass, Beyond code, one page column
- New: `src/lib/reactor.ts`, `src/lib/boot-targets.ts`, `src/lib/hero-dots.ts`, `tests/unit/lib/reactor.test.ts`.
- Removed: `src/lib/transformer.ts`, `tests/unit/lib/transformer.test.ts`.
- Changed: `src/lib/boot.ts`, `src/lib/dotmatrix.ts`, `src/lib/hero.ts`, `src/components/landing/Hero.astro` (bead shading, corner column), `src/components/landing/BeyondCode.astro`, `src/components/landing/AllProjects.astro` (global styles), `src/components/landing/Hard75.astro` (grid width), `src/styles/tokens.css` (bead tokens, depth note), `tests/e2e/landing.spec.ts`, `tests/e2e/hero-hold.spec.ts`, `docs/mistakes.md`, `docs/logs.md`.

## 2026-10-19 · Scroll animations, smooth loading, per-section cursor
- New: `src/lib/smooth.ts`, `src/lib/scroll-fx.ts`, `src/lib/lazy-fade.ts`, `src/lib/cursor.ts`, `tests/unit/lib/scroll-cursor.test.ts`, `tests/e2e/scrollfx.spec.ts`.
- Changed: `src/lib/motion.ts` (loads the four after LCP), `src/lib/boot.ts` (boot scene loaded after the portrait paints), `tests/e2e/landing.spec.ts`, `tests/e2e/hero-hold.spec.ts`, `playwright.config.ts` (`--local-upstream`), `package.json` (`lenis`).

## 2026-10-19 · Beyond code redesign, deeper reactor, toasts, note clearance
- New: `src/lib/beyond-fx.ts`, `src/pages/beyond.json.ts`, `public/media/cricket/stands.jpg`.
- Changed: `src/components/landing/BeyondCode.astro`, `content/cricket.json` (stickers, polaroid), `src/lib/content.ts` (schema), `src/lib/motion.ts`, `src/lib/reactor.ts`, `src/lib/toast.ts`, `src/styles/global.css` (toasts), `src/lib/workshop-entry.ts` (note clearance), `tests/e2e/beyond.spec.ts`, `tests/e2e/enter.spec.ts`, `tests/e2e/freelance-contact.spec.ts`.

## 2026-10-19 · Boot redesign (site language), swipeable cricket story, smoother note, table scroll
- New: `src/lib/story-swipe.ts`, `tests/unit/lib/story-swipe.test.ts`, `public/media/cricket/cover-drive.jpg`.
- Changed: `src/lib/reactor.ts` (visuals), `src/lib/beyond-fx.ts`, `src/lib/cursor.ts` (drag glyph), `src/lib/smooth.ts`, `src/lib/workshop-entry.ts`, `content/cricket.json` (`slides`, `teaser.caption`; `polaroid` removed), `src/lib/content.ts`, `src/pages/beyond.json.ts`, `tests/e2e/beyond.spec.ts`, `tests/e2e/enter.spec.ts`, `tests/e2e/scrollfx.spec.ts`.

## 2026-10-19 · Physical boot reactor, name lettering, no double name, globe ground
- Changed: `src/lib/reactor.ts`, `src/lib/boot.ts` (`data-booted`), `src/components/landing/Hero.astro` (`letter-settle`, `data-booted`), `src/lib/enter-sequence.ts`, `tests/e2e/landing.spec.ts`.

## 2026-10-19 · Sending state for the forms
- New: `src/lib/send-state.ts`, `tests/unit/lib/send-state.test.ts`. Changed: `src/lib/forms.ts`, `tests/e2e/freelance-contact.spec.ts`, `wrangler.jsonc` (mail goes to the verified `arnavc.work@gmail.com`).

## 2026-10-19 · EDITH launcher presence
- New: `src/lib/edith-orb.ts`. Changed: `src/lib/edith.ts`, `src/styles/edith-launch.css`, `content/site.json` + `src/lib/content.ts` (`edith.nudge`), `src/lib/forms.ts` (lazy sending panel), `src/lib/reactor.ts` (zero-size guard), `tests/e2e/edith.spec.ts`.
- Form rate limit raised from 5 to 7 messages per connection per hour (`worker/forms.ts`, Arnav's call); the daily cap stays at 200.

## 2026-10-19 · /admin PIN sign-in
- New: `worker/pin.ts`, `tests/unit/worker/pin.test.ts`. Changed: `worker/admin.ts`, `worker/secrets.d.ts`.

## 2026-10-19 · 2.4 The 3D room and walk mode (in review)
- New: `src/components/workshop/` (Room, Shell, Lighting, Outside, Props, Details, Plants, Markers, Rig, Walker, Avatar, Hands, Hud, mount, context, geometry, uniforms, room.css), `src/lib/workshop/` (layout, mumbai-time, camera-ease, quality, palette, textures, posters, screens, movement, collision), `src/components/WorkshopTheme.astro`, `scripts/room-assets.ts`, `public/media/room/*.glb` (2), `public/draco/`, `tests/unit/lib/workshop.test.ts`, `tests/unit/lib/workshop-walk.test.ts`, `tests/e2e/room.spec.ts`.
- Changed: `src/pages/workshop.astro` (loads the room on desktop or "Try anyway"), `src/layouts/Base.astro` (`workshop` prop), `src/lib/theme.ts` (Mumbai Auto, `Shift+D` while walking, SSR-safe typing check), `src/styles/tokens.css` (`--room-*`, palette probes), `src/lib/content.ts` and `content/site.json` (room copy), `content/credits.json`, `eslint.config.js`, `.prettierignore`, `package.json` (three, r3f, drei, postprocessing, `room:assets`), `tests/e2e/workshop.spec.ts` (list tests run with WebGL off), `docs/plan.md`.

## 2026-10-19 · 2.4 smoothness, hands and holotable
- New: `src/components/workshop/HoloTable.tsx`.
- Changed: `Room.tsx` (resolution steps, MSAA 2), `Lighting.tsx` (static shadows, softer holo light), `Walker.tsx` and `Rig.tsx` (order, smoothed time, shared stride), `Hands.tsx` (arms at the sides), `Avatar.tsx`, `context.ts` (`phase`), `Shell.tsx` (round pedestal removed, softer glass, throttled clock), `Props.tsx` (metal roughness), `src/lib/workshop/layout.ts` (rectangular table, obstacle, shot), `quality.ts` (pixel ratio caps, `RESOLUTION_STEPS`), `tests/unit/lib/workshop-walk.test.ts`.

## 2026-10-19 · 2.4 hint ladder, walk transition, door console
- Changed: `src/lib/workshop-entry.ts`, `content/site.json`, `src/lib/content.ts`, `src/pages/workshop.json.ts`, `src/components/workshop/Rig.tsx`, `Walker.tsx`, `Room.tsx`, `context.ts`, `Details.tsx`, `src/lib/workshop/layout.ts`, `tests/unit/lib/workshop-entry.test.ts`, `tests/e2e/workshop.spec.ts`.

## 2026-10-20 · 2.4 closed
- New: `src/lib/workshop/typing.ts`, `src/lib/workshop/room-clock.ts`.
- Changed: `src/pages/workshop.astro` (heading kept for screen readers while loading; the room waits for the arrival veil), `src/lib/workshop-entry.ts` (note kept on screen), `Room.tsx`, `Lighting.tsx`, `Markers.tsx`, `Walker.tsx`, `Shell.tsx`, `tests/e2e/loader.spec.ts`, `enter.spec.ts`, `forms-api.spec.ts`, `tests/unit/lib/workshop.test.ts`, `docs/plan.md`.

## 2026-10-20 · Text motion
- New: `src/lib/text-fx.ts` (rewritten in the bolder pass), `tests/unit/lib/text-fx.test.ts`, `tests/e2e/text-fx.spec.ts`.
- Changed: `src/lib/motion.ts` (starts text-fx), `src/lib/dynamic.ts` (title decode removed), `tests/unit/lib/dynamic.test.ts`, `tests/e2e/dynamic.spec.ts`, `docs/logs.md`.
