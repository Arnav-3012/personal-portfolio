<div align="center">

# Arnav Chaturvedi · Portfolio

**A fast 2D site that answers a recruiter in 30 seconds, plus a 3D workshop for people who want to explore.**

[![Domain](https://img.shields.io/badge/domain-arnavc.in-F5A524?style=for-the-badge&logo=cloudflare&logoColor=white)](https://arnavc.in)
[![Status](https://img.shields.io/badge/status-Phase_1_in_progress-F5A524?style=for-the-badge)](#roadmap)
[![3D Workshop](https://img.shields.io/badge/3D_workshop-coming_soon-lightgrey?style=for-the-badge&logo=threedotjs&logoColor=white)](#-coming-soon)

[![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)](https://astro.build)
[![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Hono](https://img.shields.io/badge/Hono-4-E36002?logo=hono&logoColor=white)](https://hono.dev)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)](https://workers.cloudflare.com)
[![pnpm](https://img.shields.io/badge/pnpm-12-F69220?logo=pnpm&logoColor=white)](https://pnpm.io)
[![Node](https://img.shields.io/badge/node-%E2%89%A522.22-5FA04E?logo=nodedotjs&logoColor=white)](.nvmrc)

[![Vitest](https://img.shields.io/badge/tested_with-Vitest-6E9F18?logo=vitest&logoColor=white)](https://vitest.dev)
[![Playwright](https://img.shields.io/badge/e2e-Playwright-2EAD33?logo=playwright&logoColor=white)](https://playwright.dev)
[![Accessibility](https://img.shields.io/badge/a11y-axe_%C2%B7_0_violations-8A2BE2)](#quality-bar)
[![Lighthouse](https://img.shields.io/badge/Lighthouse-budgeted-F44B21?logo=lighthouse&logoColor=white)](#quality-bar)
[![Prettier](https://img.shields.io/badge/code_style-Prettier-F7B93E?logo=prettier&logoColor=black)](https://prettier.io)
[![ESLint](https://img.shields.io/badge/lint-ESLint-4B32C3?logo=eslint&logoColor=white)](https://eslint.org)

[![LinkedIn](https://img.shields.io/badge/LinkedIn-arnavchat-0A66C2?logo=linkedin&logoColor=white)](https://www.linkedin.com/in/arnavchat)
[![GitHub](https://img.shields.io/badge/GitHub-Arnav--3012-181717?logo=github&logoColor=white)](https://github.com/Arnav-3012)
[![Instagram](https://img.shields.io/badge/Instagram-@life.with.arnav-E4405F?logo=instagram&logoColor=white)](https://www.instagram.com/life.with.arnav)

</div>

---

## About

This is the source for **arnavc.in**, the personal site of Arnav Chaturvedi, an AI engineer (RAG and agents) based in Mumbai.

The site has two layers:

| Layer | What it is | Status |
| --- | --- | --- |
| **2D site** | The product. A warm amber terminal-style landing page with projects, experience, skills, freelance availability, live GitHub data and contact. | 🟡 Mostly built, deploying soon |
| **3D workshop** | The reward. An optional room where every object opens a part of the story. | 🔜 Coming soon |

Design rules: everything is Arnav-specific, content comes before chrome, the 3D never gates information (every 3D feature has a 2D equivalent), and colour carries meaning (amber for the 2D signature, cyan for hologram, red for action, green for live).

---

## Feature status

Legend: ✅ done · 🟡 in progress · 🔜 coming soon

### 2D site

| Feature | Status | Notes |
| --- | :---: | --- |
| Design system (Night + Day themes, tokens, fonts, grain, toasts, progress bar, skeletons) | ✅ | `D` toggles theme; Auto / Day / Night in the settings panel |
| Transformer boot sequence | ✅ | Decodes the name into the hero |
| HUD nav (freelance status, Mumbai clock, resume) | ✅ | |
| Dot-matrix portrait hero + proof strip | ✅ | Real stats pulled from `content/` |
| Selected work + filterable all-projects index | ✅ | Works without JS |
| Experience rail | ✅ | Draws on scroll |
| 75 Hard reels (orbiting cards + full-screen player) | ✅ | Self-hosted MP4, keyboard and swipe navigable |
| Skills by layer + dock | ✅ | |
| Beyond code (cricket and 75 Hard tiles) | ✅ | |
| Open to freelance + contact + footer | ✅ | |
| Forms API (contact, freelance, notebook) | ✅ | Turnstile, D1 storage, email to inbox, honeypot |
| Live data API (GitHub contributions, Mumbai weather) | ✅ | Cron jobs cache into KV |
| EDITH-lite assistant | 🟡 | Chat on Workers AI + Vectorize knowledge base, in progress |
| `/admin` (inbox, freelance switch, "currently building") | 🟡 | Behind Cloudflare Access, in progress |
| Production deploy on `arnavc.in` | 🔜 | Domain, Email Routing, Turnstile keys, Web Analytics |
| Workshop entry layer (nav button, brain hotspot, `/workshop` zone list) | 🔜 | Phase 2a |
| 2D motion pass (table animations, count-ups, magnetic buttons) | 🔜 | Phase 2a |

### 🔮 Coming soon

> Everything below is **not built yet**. It is planned in [`docs/SPEC.md`](docs/SPEC.md) and will be broken into tasks when the phase before it passes its gate.

| Phase | What's coming | Status |
| --- | --- | :---: |
| **2b · The 3D workshop** | Photo-to-brain dive, the room, the holotable (Earth-to-Mumbai intro), armour wall, retro TV timeline, whiteboard, server rack, Mumbai window with live weather, Mumbai-time day/night | 🔜 Coming soon |
| **3 · Worlds** | One explorable world per hero project (FireWatch and Amazon first, then SIH, MARL, StatCalib), EDITH as a 3D avatar with streaming chat, **spoken replies** (opt-in text-to-speech) | 🔜 Coming soon |
| **4 · Story + play** | Cricket World, chalkboard reviews (moderated), notebook, game with leaderboard, discipline wall | 🔜 Coming soon |
| **5 · Media and sound** | More reels, positional audio, royalty-free music, UI sounds | 🔜 Coming soon |

---

## Tech stack

- **Frontend:** [Astro](https://astro.build) with React islands, TypeScript (strict), pnpm
- **API:** [Hono](https://hono.dev) in one Cloudflare Worker that also serves the static build
- **Data:** Cloudflare D1, KV, Vectorize and Workers AI, Email Routing, Turnstile
- **Fonts (self-hosted):** Unbounded, Geist, JetBrains Mono, Fraunces
- **Planned for the workshop (not installed yet):** three.js, React Three Fiber, drei, postprocessing, GSAP, Lenis, gltf-transform
- **Testing:** Vitest, Playwright, axe-core, linkinator, Lighthouse CI

---

## Getting started

**Requirements:** Node 22.22 or newer (`.nvmrc` pins 24) and pnpm.

```bash
pnpm install
pnpm dev                    # Astro dev server
pnpm wrangler dev --local   # Worker + built assets, no Cloudflare login (AI unavailable)
pnpm wrangler dev           # Same, with remote bindings (needs `pnpm wrangler login`)
```

Secrets live in `.dev.vars` locally and are set with `wrangler secret put` in production. They are never committed.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm build` | Build the site, then enforce the landing HTML size budget |
| `pnpm typecheck` | `astro check` + Worker type check |
| `pnpm lint` | ESLint, plus a check that no raw hex colours leak into components |
| `pnpm format` / `pnpm format:check` | Prettier |
| `pnpm test` | Vitest unit tests (site and Worker) |
| `pnpm e2e` | Playwright end-to-end tests with axe accessibility checks |
| `pnpm links` | Broken link check on `dist/` |
| `pnpm lhci` | Lighthouse CI against the mobile budgets |
| `pnpm kb:build` | Re-embed `content/` into the Vectorize knowledge base |

---

## Project structure

```
content/      All site content (JSON + Markdown). Components never hardcode bio, roles or stats.
src/          Astro pages, layouts, components and client-side TypeScript
worker/       Hono API: forms, live data, chat, admin, cron
migrations/   D1 schema migrations
scripts/      Build checks and the knowledge-base builder
tests/        Unit (Vitest) and end-to-end (Playwright) tests
public/       Static media (reels, posters)
docs/         SPEC, build plan, phase gates, logs and mistake log
```

### Updating the site

Edit the files in `content/` (`projects.json`, `experience.json`, `skills.json`, `profile.md`, and so on), then rebuild. Content is validated at build time.

---

## Quality bar

These are acceptance criteria, not goals:

- Lighthouse at least 90 on Performance, Accessibility, Best Practices and SEO (mobile)
- LCP under 2.0 s, CLS under 0.05, landing JS under 120 KB gzipped
- Landing HTML under 14.2 KB gzipped (enforced in `pnpm build`)
- Both themes pass 4.5:1 text contrast, with visible focus rings
- `prefers-reduced-motion` respected everywhere
- axe: 0 violations in both themes
- Free-plan Cloudflare limits hold: external APIs cached in KV, EDITH rate-limited with a daily AI cap

---

## Roadmap

Phase gates and their evidence live in [`docs/phase_completion.md`](docs/phase_completion.md); the task list is in [`docs/plan.md`](docs/plan.md).

- [x] **Phase 1 (1.1 to 1.7):** scaffold, design system, content, landing page, forms API, live data
- [ ] **Phase 1 (1.8 to 1.10):** EDITH-lite, admin, production deploy
- [ ] **Phase 2a:** workshop entry layer and 2D motion pass
- [ ] **Phase 2b:** the 3D workshop 🔜
- [ ] **Phase 3:** project worlds, EDITH avatar and spoken replies 🔜
- [ ] **Phase 4:** story and play 🔜
- [ ] **Phase 5:** media and sound 🔜

---

## Documentation

| Doc | Purpose |
| --- | --- |
| [`docs/SPEC.md`](docs/SPEC.md) | Source of truth for design and behaviour |
| [`docs/plan.md`](docs/plan.md) | Build plan, one task at a time |
| [`docs/phase_completion.md`](docs/phase_completion.md) | Gates each phase must pass |
| [`docs/logs.md`](docs/logs.md) / [`docs/changes.md`](docs/changes.md) | What was done and which files changed |
| [`docs/mistakes.md`](docs/mistakes.md) | Wrong turns and their fixes |
| [`CLAUDE.md`](CLAUDE.md) | Working rules for AI-assisted development |

---

## Credits and licence

Designed and built by [Arnav Chaturvedi](https://github.com/Arnav-3012), with AI assistance from Claude Code.

This repository has no open-source licence. Code, copy, photos and videos are all rights reserved unless a file says otherwise. Please don't reuse the portraits, reels or personal content.
