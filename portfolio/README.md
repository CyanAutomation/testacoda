# Project collection

A Cloudflare Workers portfolio for CyanAutomation's public GitHub repositories. Static assets live in `public/`; the Worker in `src/worker.js` serves a shared KV snapshot at `/api/snapshot` and refreshes it daily at 00:00 UTC. Each run refreshes the repository list and scans one changed or oldest project. A complete metrics rotation therefore takes roughly one day per repository; for 18 repositories it takes about 18 days, and changed projects are prioritized. Failed refreshes preserve the last successful data. KV is eventually consistent.

## Develop and test

Requires Node.js 26 or newer. The version is pinned in `.nvmrc` for local development and Cloudflare Workers Builds. Run `npm install`, `npm test`, and `npm run dev`. Local KV starts empty, so the UI shows the bundled fallback until you populate the local namespace or trigger the scheduled handler using Wrangler's local scheduled endpoint. `npm run check` runs tests, a syntax check and a deployment dry run.

## Deploy

Run `npm run deploy` after logging in to Cloudflare. `wrangler.jsonc` contains the production KV namespace ID and cron schedule. For another Cloudflare account create a namespace and replace the ID. Never expose GitHub credentials in client code. The refresh uses unauthenticated public GitHub endpoints; GitHub rate limits can delay updates. Refresh failures are logged and existing project results are retained. The public refresh button reloads the shared snapshot; it does not start a scan.

Repository metadata is public. Scans sample at most 25 source files and 1 MB per project; counts include non-empty comment lines and test declarations are estimates, not executed tests. Partial scans are marked. GitHub data can be stale during outages.

For automatic deployments, commit and push this repository to a Git provider, then connect it to Cloudflare Workers Builds. Configure the build root as `portfolio`, use Node.js 26, and set the deploy command to `npm run deploy`. The `portfolio/.nvmrc` pin documents the required build version; check the Workers Builds project settings for an explicit Node version override.
