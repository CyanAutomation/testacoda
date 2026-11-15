---
name: worker-development
description: Use when developing, debugging, configuring, or deploying either Cloudflare Worker in the Testacoda repository.
---

# Testacoda Worker development

This repository contains two separately configured Workers. First identify which one the task concerns and run commands from its package directory.

## Choose the Worker

- The API and queued scanner live at the repository root. Its TypeScript entry point is `src/index.ts` and configuration is `wrangler.jsonc`.
- The static portfolio and its snapshot API live in `portfolio/`. Its TypeScript entry point is `portfolio/src/worker.ts` and configuration is `portfolio/wrangler.jsonc`.
- Do not copy bindings, resource IDs, environment variables, or scan assumptions from one Worker to the other.

## Local development and checks

For the API Worker, run `npm ci`, `npm test`, or `npm run check` at the repository root. `npm run check` runs the tests, strict TypeScript checks, Wrangler type freshness check, and a deployment dry run. `worker-configuration.d.ts` is generated from the active Wrangler config; refresh it with `wrangler types` after binding changes. The Worker uses KV binding `CACHE`, optional queue binding `SCANS`, and a daily `06:15 UTC` scheduled refresh. Its repository owner, CORS origin, and scan limits are in `wrangler.jsonc`.

For the portfolio Worker, run `npm ci`, `npm test`, or `npm run check` from `portfolio/`. Its check builds the browser bundle and backup HTML from TypeScript, type-checks the Worker and browser projects, checks generated Wrangler types, parses the browser output, and runs a deployment dry run. `src/app.ts` and `src/data.ts` are the browser/helper sources; `public/app.js` is generated. `worker-configuration.d.ts` is generated from the active Wrangler config. It serves assets through the `ASSETS` binding, stores shared data in KV binding `SNAPSHOTS`, and refreshes daily at `00:00 UTC`. Local KV starts empty; the bundled data is the UI fallback until a snapshot is populated. The public refresh action reloads the snapshot and does not start a scan.

Use `npm run dev` in the relevant package for local development. A scheduled refresh can require a local scheduled event and configured local bindings; check the active Wrangler configuration before diagnosing an empty local response.

## Bindings, credentials, and refresh behavior

- Treat Wrangler configuration as environment-specific. Do not guess namespace IDs or replace production bindings to make a local check pass.
- Keep GitHub credentials server-side. Both Workers can use `GITHUB_TOKEN` as a Worker secret or local `.dev.vars` value; never put it in portfolio assets, browser code, committed config, or logs.
- Keep `.dev.vars` private and use `.dev.vars.example` only as a template. Do not paste secret values into docs or test fixtures.
- The API Worker batches scans through `SCANS` when that binding exists and otherwise scans sequentially. Its queue consumer acknowledges successful scans and retries failures.
- The portfolio refresh scans one selected project per scheduled run and preserves the previous snapshot when repository listing fails or unexpectedly returns no repositories. Keep these recovery behaviors intact when changing refresh logic.
- Keep network access out of unit tests. Mock `fetch` and bindings for failure, retry, and cache behavior.

For root API changes, read `docs/api.md` and `docs/metrics.md`: the API serves cached index and per-repository scan results, accepts `GET` and CORS preflight `OPTIONS`, and keeps scan results for up to three days. The scheduled handler refreshes the index and then queues scans when `SCANS` is configured; without it, scans run sequentially. The queue acknowledges successful work and retries failures.

For portfolio changes, read `portfolio/README.md`: `/api/snapshot` serves the shared KV snapshot, while other requests are served as static assets. The scheduled refresh reloads the repo list and refreshes one project's metrics; the public UI refresh button only reloads its snapshot. Local KV starts empty, so local UI fallback data is not evidence that the scheduled refresh ran.

Deploy with `npm run deploy` only when deployment is part of the user's request. Before deployment, run the relevant `npm run check` from the same package directory and confirm the target Worker's bindings and environment.
