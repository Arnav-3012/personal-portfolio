# Reusable prompts

Paste these into Claude Code. Run them in order for every task: **1 → (build) → 3 → 2**.

---

## 1. Decision gate: plan → confirm → done

```
Take the next unchecked task in docs/plan.md.

Before any code:
1. Read CLAUDE.md, docs/logs.md, docs/mistakes.md and every SPEC section this task touches.
2. In plan mode, give me: the goal in one line; files you'll create or change; each decision with the options you considered and why you chose one; risks; and exactly how you'll verify it works. Flag anything that conflicts with the SPEC or repeats an entry in mistakes.md.
3. Wait for me to reply "approved". Do not write code before that.

After approval:
4. Implement only the approved plan. If you need to deviate, stop and ask first.
5. Show proof: commands run with their output, and screenshots for anything visual.
6. Ask me to confirm "done". Only after I confirm: tick the task in plan.md, update logs.md and changes.md, and commit.
Never start the next task in the same turn.
```

---

## 2. Log mistakes and bad decisions

```
Log every mistake and wrong decision from this session in docs/mistakes.md.

For each entry write:
- Date and task id
- What happened (the symptom)
- Root cause (why the wrong choice looked right at the time)
- The fix applied
- Prevention rule: one imperative line
- Files touched

Read the existing entries first. If this repeats an earlier mistake, mark it REPEAT and strengthen that rule instead of adding a duplicate. If a prevention rule applies project-wide, also add it under "Hard rules" in CLAUDE.md. Show me the diff before committing.
```

---

## 3. QA gate before moving on

```
Before we move on, QA everything this task touched and anything it could affect.

1. Tests — write or update:
   - Unit tests (Vitest; Worker code via @cloudflare/vitest-plugin; browser libs in the Node `lib` project) for logic and API handlers, including error paths.
   - Playwright end-to-end tests for every user flow in this task.
   - Accessibility checks with @axe-core/playwright.
   - Playwright screenshots at 375, 768 and 1440 px wide, in Day and Night themes, and with reduced motion.
2. Run: pnpm typecheck, lint, build, test, e2e. Run linkinator on the built site for broken internal and external links. Run Lighthouse CI on changed pages against the SPEC budgets.
3. Open every screenshot and list visual problems: overlapping or cut-off text, low contrast, broken images, layout shift, loaders that never finish, wrong theme colours.
4. For 3D: no console errors, the low-quality path holds its fps target, and asset sizes are within budget.
5. Report a table: check | result | evidence.

Fix every failure and re-run until all pass. Log anything that failed in mistakes.md. Do not tick the task until this passes.
```
