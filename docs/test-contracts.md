# Test contracts

These stable IDs connect tests to documented product behavior. Tests reference the matching section with a short `Contract` comment; update the contract when the behavior changes. The source documents below provide additional context.

## GITHUB-CLIENT-01

GitHub REST requests use the expected API headers and include the configured bearer token. Non-success responses preserve their HTTP status in the client error. See [local configuration](../README.md#run-locally).

Covered by `test/github.test.ts`.

## METRICS-CLASSIFICATION-01

The scanner distinguishes recognized source files from prose and identifies common test file and directory conventions. See [metrics methodology](metrics.md).

Covered by `test/metrics.test.ts`.

## METRICS-ESTIMATE-01

The main scanner's LOC estimate excludes blank lines and comment-only lines. See [metrics methodology](metrics.md).

Covered by `test/metrics.test.ts`.

## METRICS-TEST-COUNT-01

Test case estimates recognize common JavaScript declarations and synchronous or asynchronous Python test functions. Counts are estimates from source, not executed test results. See [metrics methodology](metrics.md).

Covered by `test/metrics.test.ts`.

## API-HEALTH-01

`GET /healthz` returns a successful JSON service health response and the configured CORS origin. See [API health endpoint](api.md#health-endpoint).

Covered by `test/worker.test.ts`.

## API-REPOSITORY-INDEX-01

`GET /v1/repos` returns the cached owner index and the newest scan timestamp found in that index. See [repository index endpoint](api.md#repository-index).

Covered by `test/worker.test.ts`.

## API-CORS-01

Preflight requests return the configured origin and permit `GET` and `OPTIONS`. See [API CORS behavior](api.md#cors).

Covered by `test/worker.test.ts`.

## PORTFOLIO-SCAN-01

The portfolio scanner excludes dependency and generated files, honors file and byte limits, and marks a sample partial when eligible files cannot be scanned. See [portfolio scan limits](../portfolio/README.md#project-collection) and [metrics methodology](metrics.md).

Covered by `portfolio/test/data.test.ts`.

## PORTFOLIO-ESTIMATE-01

Portfolio source estimates count non-empty lines and recognized test declarations. Unlike the main scanner's LOC estimate, this portfolio estimate includes non-empty comment lines. See [portfolio metric methodology](../portfolio/README.md#project-collection).

Covered by `portfolio/test/data.test.ts`.

## PORTFOLIO-FILTER-01

Project search is case-insensitive across names, descriptions, and topics, and combines with the selected category. See [portfolio controls](../portfolio/README.md#project-collection).

Covered by `portfolio/test/data.test.ts`.

## PORTFOLIO-SCREENSHOT-01

Screenshot URL construction preserves directory separators while percent-encoding each path segment. See the [portfolio screenshot display](../portfolio/README.md#project-collection).

Covered by `portfolio/test/data.test.ts`.

## PORTFOLIO-FALLBACK-01

When shared data fails, the page keeps previously loaded projects or uses the bundled snapshot; if both sources fail, it reports that project data is unavailable. See [portfolio fallback behavior](../portfolio/README.md#project-collection).

Covered by `portfolio/test/data.test.ts`.

## PORTFOLIO-RELEASE-01

When available, the portfolio retains and displays the latest release tag and publication date; absent or invalid dates are omitted. See [release display behavior](../portfolio/README.md#deploy).

Covered by `portfolio/test/data.test.ts` and `portfolio/test/worker.test.ts`.

## PORTFOLIO-HOMEPAGE-01

The optional “Visit demo” link is shown only for an absolute, parseable HTTP or HTTPS homepage URL. See [portfolio link behavior](../portfolio/README.md#deploy).

Covered by `portfolio/test/data.test.ts`.

## PORTFOLIO-UI-01

The project metric list omits Stars, and the optional homepage link is labeled “Visit demo” and hidden until it has a valid destination. See [portfolio presentation behavior](../portfolio/README.md#deploy).

Covered by `portfolio/test/data.test.ts`.

## SNAPSHOT-API-01

Before the first successful refresh, `/api/snapshot` returns a JSON `503` response with `Cache-Control: no-store`. See [portfolio snapshot behavior](../portfolio/README.md#deploy).

Covered by `portfolio/test/worker.test.ts`.

## SNAPSHOT-REFRESH-01

A failed repository listing or an unexpected empty listing must not replace an existing non-empty snapshot. See [portfolio refresh behavior](../portfolio/README.md#deploy).

Covered by `portfolio/test/worker.test.ts`.

## PORTFOLIO-BACKUP-01

The checked-in backup page is a self-contained HTML artifact generated from `index.template.html` and `backup.ts`. See [backup build instructions](../portfolio-backup/README.md).

Covered by `portfolio/test/backup.test.ts`.
