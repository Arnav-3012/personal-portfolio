// Secrets set with `wrangler secret put` (or in .dev.vars locally). `wrangler types` can't see them in CI, so
// they are declared here. Both are optional on purpose: the code fails closed when one is missing.
interface Env {
  /** Turnstile secret key; forms answer 503 without it. */
  TURNSTILE_SECRET?: string;
  /** Fine-grained, read-only GitHub token; the GitHub cron skips without it. */
  GITHUB_TOKEN?: string;
}
