Paste this as your first message to Claude Code, inside the repo folder:

---

Read CLAUDE.md, then docs/SPEC.md in full, then docs/plan.md and docs/prompts.md. Follow the decision gate in prompts.md for every task.

We are building Phase 1 only, one task at a time. Start with task 1.1 (Scaffold).

1. Enter plan mode. Propose the exact folder structure, the packages with versions, and the `wrangler.jsonc` bindings for task 1.1. Point out anything in the SPEC that is ambiguous or conflicts with Cloudflare's current docs before writing code.
2. Wait for my approval.
3. Implement 1.1, run `pnpm typecheck && pnpm build && pnpm wrangler dev`, and show me `/api/health` working.
4. Create docs/logs.md, docs/changes.md and docs/mistakes.md, log the task, commit, and stop. Do not start 1.2 until I say so.
