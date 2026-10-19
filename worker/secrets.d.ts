// Secrets set with `wrangler secret put` (or in .dev.vars locally). `wrangler types` can't see them in CI, so
// they are declared here. All are optional on purpose: the code fails closed when one is missing.
interface Env {
  /** Turnstile secret key; forms and chat answer 503 without it. */
  TURNSTILE_SECRET?: string;
  /** Fine-grained, read-only GitHub token; the GitHub cron skips without it. */
  GITHUB_TOKEN?: string;
  /** Cloudflare Access team domain, e.g. `arnav.cloudflareaccess.com`; /admin answers 503 without it. */
  ACCESS_TEAM_DOMAIN?: string;
  /** The Access application's audience tag; /admin answers 503 without it. */
  ACCESS_AUD?: string;
  /** A PIN of at least six characters for /admin (`wrangler secret put ADMIN_PIN`); /admin uses Access or this, and answers 503 with neither. */
  ADMIN_PIN?: string;
  /** `1` skips Access, only on localhost, for local development. Never set it in wrangler.jsonc. */
  ADMIN_DEV?: string;
}
