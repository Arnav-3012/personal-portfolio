# Launch checklist: what is left of task 1.10

Done: domain `arnavc.in` on Cloudflare, Worker on the custom domain over HTTPS, Turnstile keys, Email Routing (destination `arnavc.work@gmail.com` verified), EDITH answering on the live site (Arnav, 2026-10-19).

## 1. `/admin` reachable only by Arnav (Cloudflare Access)
1. Open https://one.dash.cloudflare.com, then Zero Trust. First time only: choose a team name (the free plan is enough). Your team domain is `<team>.cloudflareaccess.com`.
2. Access, then Applications, then Add an application, then Self-hosted.
3. Name `Portfolio admin`, session 24 hours. Application domain `arnavc.in`, path `admin*`.
4. Add a policy: action Allow, include Emails `arnavworkmail3012@gmail.com` and `arnavc.work@gmail.com`. Keep One-time PIN as the login method.
5. Save. Open the application, Overview, and copy the **Application Audience (AUD) Tag**.
6. Give the team domain and the AUD tag to Claude, or put them in `wrangler.jsonc` `vars` as `ACCESS_TEAM_DOMAIN` (no `https://`) and `ACCESS_AUD`, then deploy.
7. Check: https://arnavc.in/admin asks for a one-time PIN, then shows the inbox; a private window with no login must not reach it.

## 2. Deploys from GitHub (Workers Builds)
1. Push the repository: `git push origin main`.
2. Dashboard, Workers & Pages, `arnav-portfolio`, Settings, Builds, Connect, GitHub, repository `Arnav-3012/personal-portfolio`, branch `main`.
3. Build command `pnpm build`. Deploy command `pnpm wrangler deploy`. Root directory `/`. Add the variable `NODE_VERSION` = `24`.
4. Check: push a small commit and watch the build run; the site updates by itself.

## 3. Web Analytics
Dashboard, Analytics & Logs, Web Analytics, Add a site, `arnavc.in`, then use automatic setup if it is offered. If it only gives a beacon snippet, send Claude the token: it goes in as a script loaded after the first paint, so it does not cost LCP.

## 4. `www.arnavc.in`
1. Dashboard, `arnavc.in`, DNS, Records: delete the existing `www` record if there is one (a record in the way makes the next step fail).
2. Workers & Pages, `arnav-portfolio`, Settings, Domains & Routes, Add, Custom domain, `www.arnavc.in`.
3. Tell Claude when it works so `www.arnavc.in` can be added to the `routes` in `wrangler.jsonc` (so a deploy keeps it).

## Gate
Phase 1 closes when item 1 is checked (`/admin` only for Arnav). Items 2 to 4 finish task 1.10.
