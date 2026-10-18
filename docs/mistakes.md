# Mistakes and wrong turns

Newest first. Read before every task. A repeat is marked REPEAT and strengthens the earlier rule.

---

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
