# Testacoda

Testacoda is a Cloudflare Worker that evaluates the maturity of CyanAutomation's public GitHub repositories. It refreshes the repository index daily, scans bounded source samples, and serves cached JSON for a portfolio or other clients.

## What it measures

- GitHub language byte totals, current release, stars, and repository links.
- Estimated nonblank lines of code from the scanned source sample.
- Estimated test suite files and declared test cases.
- An explainable 0–100 maturity checklist for a README, license, tests, CI workflow, and published release.

These source counts are estimates. See docs/metrics.md for the scan limits and methodology.

## Run locally

1. Create a Cloudflare KV namespace and a Queue named testacoda-scans.
2. Replace both KV namespace IDs in wrangler.jsonc with the IDs from your Cloudflare account.
3. Run npm run dev.
4. The first index is populated by the daily scheduled handler. To test a refresh manually, use Wrangler's scheduled-event dev command.

Set GITHUB_TOKEN as a Worker secret or in a local .dev.vars file to raise GitHub API rate limits. The token only needs public repository read access.

## API

- GET /healthz
- GET /v1/repos?owner=CyanAutomation
- GET /v1/repos/CyanAutomation/testacoda

See docs/api.md for response details.

## Portfolio backup

portfolio-backup/index.html is a single-file, self-contained portfolio fallback. It can show the repo list directly from GitHub and can read maturity metrics from Testacoda after setting window.TESTACODA_API_BASE to the deployed Worker URL. It is a fallback recreation, not a byte-for-byte copy of the published Sites source: the Sites source archive could not be downloaded in the current workspace.

## Development

Run npm test for the Node test suite. GitHub Actions runs the same command for pushes and pull requests.
