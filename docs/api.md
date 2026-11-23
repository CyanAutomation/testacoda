# API

The Worker exposes read-only JSON endpoints.

## Health endpoint

`GET /healthz` returns a simple JSON service health response.

## Repository index

`GET /v1/repos` returns the latest public repository index for the owner configured by `GITHUB_OWNER`. Each row includes GitHub repository metadata and the most recent scan under `scan`. Before the first daily scan, `scan` is null. The response's `scanned_at` field is the newest scan timestamp among the indexed repositories, or an empty string if none have been scanned. The owner is fixed by Worker configuration; a query parameter cannot select another cache namespace.

## Repository scan

`GET /v1/repos/:owner/:repo` returns one cached repository scan for the configured owner, or 404 if the owner does not match or no scan has completed.

The response includes repository metadata, language byte counts, estimated lines of code, source files scanned, test file and test case estimates, latest release, maturity checks, and scan limits. LOC and test case figures are bounded estimates, not compiler or test runner results.

The index is refreshed daily at 06:15 UTC. Individual scan results are cached in KV for up to three days so a transient GitHub failure does not immediately erase a prior successful result.

## CORS

`OPTIONS` preflight requests return the configured `CORS_ORIGIN`, allow `GET` and `OPTIONS`, and permit the `Content-Type` request header.

JSON API responses also include the configured `Access-Control-Allow-Origin` value.
