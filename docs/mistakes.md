# Mistakes and wrong turns

Newest first. Read before every task. A repeat is marked REPEAT and strengthens the earlier rule.

---

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
