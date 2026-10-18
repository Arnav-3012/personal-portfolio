# Mistakes and wrong turns

Newest first. Read before every task. A repeat is marked REPEAT and strengthens the earlier rule.

---

## 2026-10-18 · 1.5a · Sticky pane made every project's links unreachable by keyboard
- **What happened:** I first rendered all five desktop panes `inert` + `aria-hidden`; the mobile inline cards are `display: none` on desktop, so keyboard users could never reach a project's GitHub link. Caught while writing the markup, before any run.
- **Root cause:** treated the panes as decoration to hide from assistive tech, forgetting they are the only desktop copy of the links.
- **Fix:** server-render pane 0 as active and focusable; `setActive` in `src/lib/work.ts` toggles `inert` so only the visible pane is reachable. e2e asserts 4 inert panes and one active.
- **Prevention rule:** When content is duplicated per breakpoint, check that each breakpoint has exactly one reachable copy of every link before hiding the other.
- **Files:** `src/components/landing/SelectedWork.astro`, `src/lib/work.ts`

## 2026-10-18 · 1.5a · Scripted line-delete left a broken test (REPEAT)
- **What happened:** `sed -i` failed on macOS (BSD sed needs `-i ''`), then my Python line filter removed only the middle line of a Prettier-wrapped `toContainText(...)` call, leaving `toContainText()` and a lint error.
- **Root cause:** deleted by line match instead of replacing the whole statement; assumed Prettier had not wrapped it. Repeats the "scripted edits" entry below.
- **Fix:** replaced it with `toContainText(p.oneLiner)` via an exact-string replace.
- **Prevention rule (strengthened):** Use the Edit tool for any removal in a file Prettier has formatted; never delete by single-line grep, and never use `sed -i` on macOS.
- **Files:** `tests/e2e/work.spec.ts`

## 2026-10-18 · 1.5a · Screenshots caught the pane mid-crossfade, and a test assumed item 0 was pinned
- **What happened:** the first screenshots showed overlapping pane text (an element screenshot scrolls while the 700 ms crossfade runs), and the "pane stays pinned" test failed by 168 px because item 0 sits above the pin point.
- **Root cause:** shot without waiting for the transition to settle (same family as the 1.4 "name mid-reveal" entry); assumed the pin starts at the first item.
- **Fix:** park the third project centred, wait 1.2 s, then take a viewport screenshot; compare items 1 and 3 for the pin test.
- **Prevention rule:** Park the scroll position, wait out the longest transition, then screenshot; test sticky behaviour between two mid-list items.
- **Files:** `tests/e2e/work.spec.ts`

## 2026-10-18 · 1.5a revision · Pane too big, switched too fast, plain
- **What happened:** Arnav's review: the pane was too big, the next project's info swapped in too quickly, and the content wasn't engaging. A first card redesign then clipped its own chips and GitHub button at 1440 and 768 px, and my "≤ 400 px" test cap was set before the content was measured.
- **Root cause:** I built the pane to the SPEC's "crossfade as each name crosses centre" literally, sized it to fill the column, and listed stats as plain text. I never checked how long a viewer actually lingers on one project (50vh rows, no hysteresis), and sized a fixed-height card from a guess.
- **Fix:** compact card (≤ 400 px wide, 460 px tall) with a progress rail, stats split into big amber figures and mono labels (`splitStat`), 80vh rows, a 12%-of-viewport hysteresis band, and a staggered build-in after a 250 ms fade-out.
- **Prevention rule:** For scroll-driven UI, set dwell time (row height) and a switch threshold up front, and size fixed-height cards from the longest real content at the narrowest split width, not from a guess.
- **Files:** `src/components/landing/SelectedWork.astro`, `ProjectDetail.astro`, `src/lib/work.ts`, `tests/e2e/work.spec.ts`

## 2026-10-18 · 1.5a revision 2 · Glow halo made the page scroll sideways
- **What happened:** after adding the background (dot grid, spine, ghost numerals, glow), the existing hero layout test failed at 768 and 1440 px: `scrollWidth` 1468 > 1440. A throwaway screenshot spec also failed first because I put it outside `tests/e2e` (the configured `testDir`).
- **Root cause:** the glow is `inset: -140px` around the card, which sits 112 px from the right edge, so it overhung the viewport. I checked the new section visually but only ran its own tests, not the whole suite, before the screenshot.
- **Fix:** `overflow-x: clip` on `.work` (clip, not hidden, so the sticky card keeps working).
- **Prevention rule:** Any decoration that extends past its box (glows, halos, ghost text) gets clipped at its section, and the full `pnpm e2e`, not just the new spec, runs before a visual change is reported. Put throwaway specs under `tests/e2e`.
- **Files:** `src/components/landing/SelectedWork.astro`

## 2026-10-18 · 1.5a · Stale dev server on port 8787 blocked e2e
- **What happened:** `pnpm e2e` failed with "http://localhost:8787/api/health is already used".
- **Root cause:** an earlier backgrounded Playwright run left its `wrangler dev` server alive.
- **Fix:** killed the process on 8787 and re-ran.
- **Prevention rule:** Before starting e2e after a backgrounded run, free port 8787 (`lsof -ti tcp:8787 | xargs -r kill`).
- **Files:** none

## 2026-10-18 · 1.5a · Project names overflowed their column at 1440 px
- **What happened:** "enhancement" in the 80 px display size touched the pane edge. Found only by opening the screenshot.
- **Root cause:** sized the name for the headline scale without checking the longest real word in `projects.json`.
- **Fix:** `clamp(32px, 4vw, 64px)` with `overflow-wrap: anywhere`; pane stats drop to body size below 1024 px.
- **Prevention rule:** Size display text against the longest word in the content, and open the screenshot at every width.
- **Files:** `src/components/landing/SelectedWork.astro`, `src/components/landing/ProjectDetail.astro`

## 2026-10-18 · 1.4 revision 3 · Day still a flat blob; hover felt mechanical
- **What happened:** after revision 2, Arnav still found Day "weird" (a tan figure where hair and skin shared one tone) and our circle lens "weird" next to the reference site's hover.
- **Root cause:** every figure cell was drawn and only its colour varied, so the shape came from hue, which collapses on paper. For the hover I guessed at an effect instead of studying how the reference actually works.
- **Fix:** read the reference's public bundles for the *technique* (ordered dither, pointer push, fluid trail reveal); rebuilt the portrait as a 4×4 Bayer dither with a contrast stretch (Day inks the dark, Night lights the bright), with push + a fading trail field revealing the photo.
- **Prevention rule:** When matching a reference interaction, inspect how it is built before designing; for image effects, carry form with density or size, not hue alone.
- **Files:** `src/lib/dotmatrix.ts`, `src/lib/hero.ts`, `src/components/landing/Hero.astro`

## 2026-10-18 · 1.4 revision 2 · Day dot-matrix looked muddy; edge fade darkened instead of fading
- **What happened:** Arnav found Day "a bit weird": a grey blob of dimmed shirt dots behind ARNAV, a hard dark strip under it, and heavy near-black hair. After the first fix, dark speckle remained at the bottom of the figure in Day.
- **Root cause:** (1) I tuned the dot-matrix in Night, where low values sink into the background. In Day the same values are dark ink, so dimmed and faded dots turned grey or dark. (2) `edgeFade` scaled luminance, not opacity, so faded dots moved toward the dark end of the Day ramp.
- **Fix:** fade drives opacity (`Dot.a`); the torso fades from 64% to 88% of the height; warm umber Day ramp (no black); Day squares at 70% of the cell; Day clear zone at 12%.
- **Prevention rule:** Any effect that fades or dims must work on opacity, never on the colour value; review every visual effect in Day and Night side by side before showing it.
- **Files:** `src/lib/dotmatrix.ts`, `tests/unit/lib/dotmatrix.test.ts`

## 2026-10-18 · 1.4 revision · Dimmed amber text failed Day contrast
- **What happened:** axe flagged the nav's 01–04 numbers at 3.2:1 in Day; `contrast.test.ts` had passed.
- **Root cause:** I added `opacity: 0.7` to amber text for a softer look. The token test checks raw token pairs, not the composited colour, so it couldn't see it.
- **Fix:** removed the opacity; the text uses `--time` at full strength (5.9:1 in Day).
- **Prevention rule:** Never put `opacity` on text; use a token whose contrast is tested.
- **Files:** `src/components/landing/Nav.astro`

## 2026-10-18 · 1.4 revision · Text over the dot-matrix was unreadable
- **What happened:** in Day the middle of ARNAV vanished into the dark shirt dots, and the role line sat on the neck; on mobile the role line ran off both edges.
- **Root cause:** I designed the overlap from the Night look only, where parchment on dim amber still reads.
- **Fix:** dots behind the name and role line dim to 20%, feathered over 28 px (`clearAlpha`); the role line wraps on narrow screens.
- **Prevention rule:** For text over imagery, check both themes and 375 px before showing it; give the text a clear zone, not just a colour.
- **Files:** `src/lib/dotmatrix.ts`, `src/lib/hero.ts`, `src/components/landing/Hero.astro`

## 2026-10-18 · 1.4 revision · Two-resolution dot grid left a seam
- **What happened:** a light ring outlined the face; letting the grids overlap turned it into a dark ring.
- **Root cause:** a finer face grid and a coarse body grid meet on an ellipse; cells on the boundary either leave a gap or double up, and squares make either visible.
- **Fix:** one uniform 4 px grid (5 px on phones); the face stays legible and there is no boundary.
- **Prevention rule:** Don't stitch two sampling resolutions without blending; try the single finer grid first and measure its cost.
- **Files:** `src/lib/dotmatrix.ts`, `tests/unit/lib/dotmatrix.test.ts`

## 2026-10-18 · 1.4 revision · Scripted edits: regex ate an import, and a stray line aborted a multi-file update (REPEAT) — REPEATED AGAIN in revision 3
- **What happened:** (1) A regex meant to rewrite the dotmatrix import also swallowed the `vitest` import above it, which broke typecheck. (2) A doc-update script had a leftover throwaway replacement at the end. It threw after SPEC.md and CLAUDE.md were written but before plan.md was.
- **Root cause:** the non-greedy `import \{[\s\S]*?\}` started at the first `import {` in the file. The script wrote each file as it went, so a late failure left a partial update. This repeats the 1.2 "regex bulk edit corrupted a test" entry.
- **Fix:** restored the import; redid plan.md alone; checked `git diff --stat` for all four docs.
- **Repeated again in 1.5a** (line-delete left a broken test); see that entry.
- **Prevention rule (strengthened):** Anchor regex edits to the exact line (or use Edit), and in a multi-file script validate every replacement before writing any file. After a scripted edit, diff the result before running anything.
- **Revision 3 repeat:** a three-file script wrote dotmatrix.ts and hero.ts, then threw on Hero.astro, whose markup Prettier had re-wrapped. **Rule now:** one file per script, or run every check first and only then write; prefer the Edit tool for Astro/HTML, which Prettier reflows.
- **Files:** `tests/unit/lib/dotmatrix.test.ts`, `docs/plan.md`

## 2026-10-18 · 1.4 · Boot e2e tests raced the real clock
- **What happened:** 1 of 5 full e2e runs failed on `toHaveAttribute('data-boot', 'on')`; the other runs passed.
- **Root cause:** the tests asserted a state that only lasts ~2.6 s, on real timers. With 3 workers under load, page load sometimes outlasted the boot, so the state was gone before the first assertion. The screenshot test also waited on the 400 ms `out` state. Passing locally made the timing look safe.
- **Fix:** boot, skip, failsafe and axe-during-boot tests use `page.clock.install()` + `runFor`; the screenshot test waits for `data-boot !== 'on'`. Verified 35/35 with `--repeat-each=5`.
- **Prevention rule:** Assert time-limited UI states on Playwright's fake clock, and stress any timer test with `--repeat-each=5` before trusting it.
- **Files:** `tests/e2e/landing.spec.ts`

## 2026-10-18 · 1.4 · At-rest screenshots caught the name mid-reveal
- **What happened:** the 1440 home screenshot showed only a half-faded "A" of ARNAV, which looked like a broken hero.
- **Root cause:** the screenshot loop waited only for fonts; the new letter reveal was still running. The 1.2 rule covered the opposite case (capture animations mid-run on purpose).
- **Fix:** the loop waits until every finite animation has finished (infinite loops like the marquee keep running).
- **Prevention rule:** Before an at-rest screenshot, wait for `document.getAnimations()` to settle; capture mid-animation only in dedicated frame tests.
- **Files:** `tests/e2e/design-system.spec.ts`

## 2026-10-18 · 1.4 · Nav bar inherited an inset from the base rule
- **What happened:** the sticky nav's bottom border stopped 16 px short of the right edge at every width.
- **Root cause:** `.shell-bar--nav` set `top` and `left` but kept `.shell-bar`'s `right: var(--space-4)`, which was meant for the floating gear. I didn't look at the page edges in the first screenshots.
- **Fix:** `right: 0` on the nav variant; checked in a crop of the 1440 shot.
- **Prevention rule:** When a modifier repurposes a fixed element, set all its insets explicitly, and check full-bleed edges in the screenshots.
- **REPEAT (1.4 revision):** the hero quadrants list kept its base `width: 100%` when it became `position: absolute` with insets, so the right-hand quadrants ran off screen. **Strengthened rule:** when an element switches to absolute/fixed with insets, reset `width`/`height` to `auto` in the same rule, and check every edge of every breakpoint in the screenshots.
- **Files:** `src/layouts/Base.astro`, `src/components/landing/Hero.astro`

## 2026-10-18 · 1.4 · Smaller wrong turns (caught before review)
- Portrait mask ellipse too large: the grey backdrop kept hard corners. Fixed to `ellipse 50% 50% at 50% 50%`. Check a mask against both themes before signing off.
- Boot timing constants guessed (3.2 s vs SPEC ~2.5 s); a unit test on the real `site.boot` caught it. Derive durations from content and test them against the SPEC number.
- Marquee hover test timed out: Playwright waits for a moving element to be stable. Hover the static container that owns the `:hover` rule.
- **Files:** `src/components/landing/Hero.astro`, `src/lib/boot.ts`, `tests/e2e/landing.spec.ts`

## 2026-10-18 · 1.3 · Mutation check "passed" because the mutation never applied
- **What happened:** after breaking `projects.json` for the mutation check, build and tests both passed.
- **Root cause:** I used `sed -i '' '0,/re/s//…/'`. `0,/re/` is GNU sed syntax; macOS BSD sed silently matched nothing, so the file was never changed. The green result looked like a real finding.
- **Fix:** mutated with a `node -e` JSON edit, checked the bad value was actually in the file (`grep -c` = 1), then saw the build fail with `content/projects.json is invalid … at [0].status`; restored from a backup and confirmed the value was gone.
- **Prevention rule:** In a mutation check, first prove the mutation landed (grep for it) before trusting a pass; on macOS make structured edits with `node -e`, not GNU-only sed syntax.
- **Files:** none (temporary edit to `content/projects.json`, restored)

## 2026-10-18 · 1.3 · Plan claimed build-time validation nothing triggered
- **What happened:** the approved plan said "parsing at import means `astro build` fails on invalid content", but no page imported `src/lib/content.ts`, so the build would never have run the parser.
- **Root cause:** I reasoned about the module in isolation and didn't trace which entry point would import it.
- **Fix:** `Base.astro` now builds its default description from `site.json` (also removing the last hardcoded bio string in a component), so every page build parses all content.
- **Prevention rule:** When a check is meant to run at build, name the entry point that imports it and prove it with a failing build.
- **Files:** `src/layouts/Base.astro`

## 2026-10-18 · 1.2 follow-up · Skeleton sweep invisible, shell UI too plain
- **What happened:** after closing 1.2, Arnav couldn't see the skeleton loading sweep and found toasts and the progress bar bland.
- **Root cause:** the sweep was a 10% tint over 40% of the block, so it was barely visible. I signed it off from full-page static screenshots, which can't show whether an animation reads, and I never captured the progress bar mid-run.
- **Fix:** bright scanline with a fading trail (transform-based); progress bar with a fading tail, a glowing head and a fade-out; toasts with a tinted icon chip, stacked HUD label and message, kind-tinted border and glow, a 4 s countdown line that pauses with the timer, and an exit animation.
- **Prevention rule:** For anything animated, capture element screenshots mid-animation (2–3 frames) and review those, not just the page at rest.
- **Files:** `src/styles/global.css`, `src/lib/toast.ts`

## 2026-10-18 · 1.2 · e2e ran against a stale build
- **What happened:** an axe failure persisted after the fix; the HTML still had the old `<header>`.
- **Root cause:** the first `pnpm e2e` left an orphaned `workerd` on :8787, and `reuseExistingServer: true` silently reused it, skipping `pnpm build`. It looked safe because Playwright normally stops the server it starts.
- **Fix:** killed the process; set `reuseExistingServer: false` so a busy port fails loudly.
- **Prevention rule:** Never let e2e reuse a running server; if a fix "doesn't take", check `lsof -iTCP:8787` before debugging the code.
- **Files:** `playwright.config.ts`

## 2026-10-18 · 1.2 · Regex bulk edit corrupted a test
- **What happened:** `night['text']!` became `nightok(t, 'text')`, a type error.
- **Root cause:** the generic `t\['…'\]!` pattern also matched the tail of `night[...]`; I ran the narrower pattern second.
- **Fix:** corrected the line by hand.
- **Prevention rule:** Anchor regex rewrites on a word boundary, apply the most specific pattern first, and grep the result before running anything.
- **Files:** `tests/unit/lib/contrast.test.ts`

## 2026-10-18 · 1.2 · Worker tsconfig swallowed all unit tests
- **What happened:** `pnpm typecheck` failed on `Storage`/implicit `any` in the new Node-side tests.
- **Root cause:** 1.1 set `worker/tsconfig.json` to include `tests/unit/**` (no DOM lib), assuming only Worker tests would live there.
- **Fix:** split into `tests/unit/worker` (worker tsconfig + Workers pool) and `tests/unit/lib` (root tsconfig + Node project).
- **Prevention rule:** Put tests for each runtime in its own folder, covered by the tsconfig and vitest project for that runtime.
- **Files:** `tsconfig.json`, `worker/tsconfig.json`, `vitest.config.ts`

## 2026-10-18 · 1.2 · Nested landmark in the settings dialog
- **What happened:** axe `landmark-banner-is-top-level`: the dialog's `<header>` sat inside the page `<header>` banner.
- **Root cause:** used `<header>` as a styling wrapper inside a component that renders inside the shell header.
- **Fix:** `<div class="settings__header">`.
- **Prevention rule:** Use landmark elements (`header`, `nav`, `main`, `footer`) only for page-level landmarks, never as component wrappers.
- **Files:** `src/components/SettingsPanel.astro`

## 2026-10-18 · 1.2 · Screenshot under a fake clock and a mobile overlap
- **What happened:** toast screenshots taken in the `page.clock` test showed half-faded toasts; the real-clock shot then showed mobile toasts covering the settings gear.
- **Root cause:** reused the timing test for visuals; set the toast `top` without checking what else is fixed at the top.
- **Fix:** separate real-clock screenshot tests; mobile toasts start below the 44 px top bar.
- **Prevention rule:** Take visual screenshots only in tests with a real clock, and check every fixed element against the others at 375 px.
- **Files:** `tests/e2e/design-system.spec.ts`, `src/styles/global.css`

## 2026-10-18 · 1.2 · pnpm not on PATH (environment)
- **What happened:** `pnpm: command not found` in the agent shell.
- **Root cause:** Node 24 lives in `~/.local/share/node-v24.22.0-darwin-arm64/bin`, which the non-interactive shell doesn't load.
- **Fix:** prefix `PATH` per command.
- **Prevention rule:** In agent shells, export `PATH=~/.local/share/node-v24.22.0-darwin-arm64/bin:$PATH` before any pnpm command.
- **Files:** none

## 2026-10-18 · 1.1 · Prettier rewrote hand-written docs
- **What happened:** `pnpm format` reformatted `CLAUDE.md`, `docs/plan.md` and `docs/phase_completion.md`.
- **Root cause:** `.prettierignore` only listed `docs/SPEC.md`; I assumed the rest of the Markdown was already Prettier-clean.
- **Fix:** reverted with `git checkout`, added `*.md` to `.prettierignore`.
- **Prevention rule:** Run a formatter over the whole repo only after `.prettierignore` excludes hand-written docs; check `git diff --stat` right after.
- **Files:** `.prettierignore`

## 2026-10-18 · 1.1 · ESLint config written from memory
- **What happened:** `eslint .` crashed with "Cannot read properties of undefined (reading 'recommended')".
- **Root cause:** I used the `flatConfigs` key from `eslint-plugin-jsx-a11y`; the `-x` fork exposes `configs.recommended`, and react-hooks 7 moved flat configs to `configs.flat`.
- **Fix:** printed each plugin's exports with `node -e`, rewrote the config with `eslint/config`'s `defineConfig` + `extends`.
- **Prevention rule:** Inspect a plugin's actual exports before writing its config; never assume key names from another package or major version.
- **Files:** `eslint.config.js`

## 2026-10-18 · 1.1 · linkinator flagged an API route as broken
- **What happened:** `[404] dist/api/health`.
- **Root cause:** linkinator scans `./dist` as files, so the skip regex `^/api/` never matched the rewritten path.
- **Fix:** skip patterns `/api/` and `/admin` without anchors.
- **Prevention rule:** Skip Worker routes in linkinator with unanchored patterns; they never exist in `dist/`.
- **Files:** `.linkinator.config.json`

## 2026-10-18 · 1.1 · Toolchain installs (environment, not code)
- **What happened:** `brew install node@24` failed on a formula lock and tried to upgrade unrelated formulae; corepack 0.36 couldn't launch pnpm 12 (native binary layout).
- **Root cause:** assumed Homebrew and corepack were the low-friction paths.
- **Fix:** official nodejs.org tarball (SHA-256 verified) in `~/.local/share`, then `npm i -g pnpm@12.14.0`.
- **Prevention rule:** For a pinned Node version without sudo, use the checksum-verified nodejs.org tarball; install pnpm ≥ 12 with npm, not corepack.
- **Files:** none in the repo
