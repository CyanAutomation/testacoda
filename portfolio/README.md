# Project collection

A Cloudflare Workers portfolio for CyanAutomation's public GitHub repositories. TypeScript source lives in `src/`; the Worker in `src/worker.ts` serves a shared KV snapshot at `/api/snapshot` and refreshes it daily at 00:00 UTC. The browser app is bundled from `src/app.ts` into `public/app.js`. The self-contained fallback in `portfolio-backup/index.html` is generated from `portfolio-backup/backup.ts`. Each refresh updates the repository list and scans one changed or oldest project. A complete metrics rotation therefore takes roughly one day per repository; for 18 repositories it takes about 18 days, and changed projects are prioritized. Failed refreshes preserve the last successful data. KV is eventually consistent.

## Develop and test

Requires Node.js 26 or newer. The version is pinned in `.nvmrc` for local development and Cloudflare Workers Builds. Run `npm install`, `npm test`, and `npm run dev`. The dev and deploy commands build the browser bundle and backup HTML first. Run `npm run typecheck` to check the Worker, browser, backup, and tests. `npm run check` builds, runs tests and type-checks, verifies the browser output, and runs a Wrangler deployment dry run. Local KV starts empty, so the UI shows the bundled fallback until you populate the local namespace or trigger the scheduled handler using Wrangler's local scheduled endpoint.

## Deploy

Run `npm run deploy` after logging in to Cloudflare. `wrangler.jsonc` contains the production KV namespace ID and cron schedule. For another Cloudflare account create a namespace and replace the ID. The Worker can use `GITHUB_TOKEN` as a Cloudflare secret or in `portfolio/.dev.vars` to raise GitHub API rate limits; without it, rate limits can delay scheduled updates. Keep the token server-side and never expose it in browser assets. Refresh failures are logged and existing project results are retained. The public refresh button reloads the shared snapshot; it does not start a scan.

Repository metadata is public. Scans sample at most 25 source files and 1 MB per project; counts include non-empty comment lines and test declarations are estimates, not executed tests. Partial scans are marked. GitHub data can be stale during outages.

The project card shows the latest published release tag and date when GitHub provides one. Release dates are added as each project's scheduled metrics refresh runs, so existing snapshots gain dates over the normal project rotation. The Stars metric is omitted from the portfolio. Search is case-insensitive across project names, descriptions, and topics, and combines with category filtering. A “Visit demo” link is shown only when the repository homepage is an absolute, parseable HTTP or HTTPS URL. Screenshot URLs preserve directory separators and encode reserved characters in each path segment.

The optional demo link stays hidden when there is no valid homepage URL. If `/api/snapshot` has no data yet, the Worker responds with a JSON `503` and `Cache-Control: no-store`. A failed GitHub listing, including an unexpected empty list, leaves the previous non-empty snapshot intact.

For automatic deployments, commit and push this repository to a Git provider, then connect it to Cloudflare Workers Builds. Configure the build root as `portfolio`, use Node.js 26, and set the deploy command to `npm run deploy`. The `portfolio/.nvmrc` pin documents the required build version; check the Workers Builds project settings for an explicit Node version override.
