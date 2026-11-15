---
name: api-and-scan-operations
description: Use when changing the root Testacoda API routes, GitHub API integration, scheduled refresh, queue processing, caching, or CORS behavior.
---

# Testacoda API and scan operations

This skill covers the root API Worker and its scan lifecycle. For metric definitions and counting rules, use `repo-scan-metrics`; for bindings and local Worker setup, use `worker-development`.

## Find the relevant code and contract

- `src/index.ts` implements HTTP routes, KV caching, scheduled refresh, and the queue consumer.
- `src/github.ts` wraps GitHub API requests and lists public repositories.
- `src/metrics.ts` scans repository trees and source files.
- `wrangler.jsonc` defines the `CACHE` KV binding, optional `SCANS` queue, owner, CORS origin, scan limits, and cron schedule.
- `docs/api.md` documents endpoints and cache behavior; `docs/metrics.md` documents scan semantics.

## Preserve API and refresh behavior

- The read API exposes `GET /healthz`, `GET /v1/repos`, and `GET /v1/repos/:owner/:repo`; `OPTIONS` supports CORS preflight. Keep method handling, status codes, response shape, and CORS headers consistent with the documented contract.
- The owner index is refreshed on the scheduled event. Existing per-repository results are carried into the new index until a fresh scan is saved; do not erase successful cached results because an individual scan fails.
- When `SCANS` is bound, refresh sends scan jobs in batches and the queue consumer acknowledges successful scans and retries failures. Without the queue binding, scans run sequentially. Preserve both paths.
- Repository listing is paginated and capped. Preserve GitHub authentication headers and rate-limit/error context; never log or expose `GITHUB_TOKEN`.
- KV entries expire after three days, while API responses have shorter browser cache headers. Check both storage and HTTP caching when changing freshness behavior.
- Treat route parameters, query parameters, and GitHub responses as untrusted input. Keep cache keys normalized and avoid embedding untrusted values in shell commands or response headers.
- Keep operations read-only and public-repository scoped unless the user explicitly requests a contract change. Do not make GitHub write API calls or deploy as part of routine development.

## Change and verify

1. Add or update focused tests for route methods, CORS, cache hit/miss behavior, pagination, scan enqueueing, queue ack/retry, and preservation of prior data on failures as relevant.
2. Mock `fetch`, KV, and Queue bindings. Unit tests should not require GitHub credentials, network access, or production Cloudflare resources.
3. Update `docs/api.md` for route or response changes and `docs/metrics.md` for scan behavior changes. Update `worker-development` if bindings or local operation steps change.
4. Run `npm test` and `npm run check` from the repository root when verification is requested. The check includes strict TypeScript and generated Wrangler binding type validation.

Use `workflow-security-review` for changes to GitHub Actions rather than expanding this skill to cover CI security.
