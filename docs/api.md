# API

The Worker exposes read-only JSON endpoints.

## GET /healthz

Returns a simple service health response.

## GET /v1/repos?owner=CyanAutomation

Returns the latest public repository index. Each row includes GitHub repository metadata and the most recent scan under scan. Before the first daily scan, scan is null.

## GET /v1/repos/:owner/:repo

Returns one cached repository scan, or 404 if no scan has completed.

The response includes repository metadata, language byte counts, estimated lines of code, source files scanned, test file and test case estimates, latest release, maturity checks, and scan limits. LOC and test case figures are bounded estimates, not compiler or test runner results.

The index is refreshed daily at 06:15 UTC. Individual scan results are cached in KV for up to three days so a transient GitHub failure does not immediately erase a prior successful result.
