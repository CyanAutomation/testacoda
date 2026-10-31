# Project collection

A Cloudflare Workers portfolio for CyanAutomation's public GitHub repositories. Static assets live in `public/`; the Worker in `src/worker.js` serves a shared KV snapshot at `/api/snapshot` and refreshes it every 15 minutes. Each run refreshes the repository list and scans one changed or oldest project. A complete rotation therefore takes roughly 15 minutes per repository. Failed refreshes preserve the last successful data. KV is eventually consistent.

## Develop and test

Requires Node.js 22 or newer. Run `npm install`, `npm test`, and `npm run dev`. Local KV starts empty, so the UI shows the bundled fallback until you populate the local namespace or trigger the scheduled handler using Wrangler's local scheduled endpoint. `npm run check` runs tests, a syntax check and a deployment dry run.

## Deploy

Run `npm run deploy` after logging in to Cloudflare. `wrangler.jsonc` contains the production KV namespace ID and cron schedule. For another Cloudflare account create a namespace and replace the ID. Never expose GitHub credentials in client code. The refresh uses unauthenticated public GitHub endpoints; GitHub rate limits can delay updates. Refresh failures are logged and existing project results are retained. The public refresh button reloads the shared snapshot; it does not start a scan.

Repository metadata is public. Scans sample at most 25 source files and 1 MB per project; counts include non-empty comment lines and test declarations are estimates, not executed tests. Partial scans are marked. GitHub data can be stale during outages.

For automatic deployments, commit and push this repository to a Git provider, then connect it to Cloudflare Workers Builds. Configure the build root as `portfolio` and the deploy command as `npm run deploy`.
