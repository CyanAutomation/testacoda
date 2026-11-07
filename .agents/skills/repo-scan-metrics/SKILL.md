---
name: repo-scan-metrics
description: Use when changing or reviewing repository discovery, bounded source scans, line or test estimates, maturity scoring, scan limits, or metrics API output in Testacoda.
---

# Testacoda scan metrics

Use this skill for the scanner and the portfolio's separate metrics implementation. Their limits and counting rules differ; inspect the implementation you are changing instead of assuming they share behavior.

## Find the relevant code

- The API scanner is in `src/github.js`, `src/metrics.js`, and `src/index.js`.
- Its current tests are in `test/metrics.test.js`; API and metric descriptions are in `docs/api.md` and `docs/metrics.md`.
- The portfolio scan helpers are in `portfolio/public/data.js` and are re-exported by `portfolio/src/data.js`; orchestration is in `portfolio/src/worker.js`.
- Its tests are in `portfolio/test/data.test.js` and `portfolio/test/worker.test.js`; its operational and metric notes are in `portfolio/README.md`.

## Preserve metric meaning

- Describe source lines, test files, and test cases as estimates. The scanner reads a bounded sample; it does not run a repository's tests or establish code quality.
- Keep each implementation's limits and counting semantics distinct. The root Worker uses `MAX_SOURCE_FILES` and `MAX_SOURCE_BYTES`; the portfolio has its own file selection and byte limit. Check the current code and configuration before documenting exact values.
- Check how the implementation measures bytes before calling a limit a byte limit. JavaScript string length is not UTF-8 byte length.
- The root maturity score is a five-item checklist with equal weight for a README, license, test files, CI workflow, and published release. Explain changes to these signals and their weights in the docs.
- Preserve partial-scan and truncation context in returned metrics. Do not present an incomplete sample as a complete repository inventory.
- The root scan result includes `schema_version`. Keep existing API consumers compatible when changing response fields; document intentional contract changes in `docs/api.md`.

## Make and verify changes

1. Add or update focused tests for the changed path, extension, declaration pattern, limit, or scoring rule before changing the implementation.
2. Cover boundary cases that can change counts, such as comment-only lines, unfamiliar test naming, truncated trees, inaccessible files, and samples that hit a limit.
3. Update the matching methodology and API documentation whenever a metric's meaning or exposed shape changes.
4. Run the relevant tests from the repository root with `npm test`, and from `portfolio/` with `npm test` when that scanner is affected. Use the corresponding `npm run check` for a full project check.

Keep tests deterministic: metric helper tests should use local source strings and mocked fetches, not GitHub or Cloudflare network services.
