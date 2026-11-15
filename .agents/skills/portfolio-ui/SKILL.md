---
name: portfolio-ui
description: Use when changing the Testacoda portfolio's browser UI, static assets, project filtering, snapshot loading, or displayed project metrics.
---

# Testacoda portfolio UI

The portfolio UI is a static site backed by a separate snapshot Worker. Keep browser behavior and Worker refresh behavior distinct.

## Find the relevant code

- `portfolio/public/index.html` defines the page structure and accessible status and control elements.
- `portfolio/public/app.js` renders project cards, navigation, repository screenshots, and metrics.
- `portfolio/public/data.js` contains snapshot loading, filtering, path encoding, URL checks, and formatting helpers; `portfolio/src/data.js` re-exports it for tests and the Worker.
- `portfolio/public/repos.json` is the bundled fallback dataset. Tests live in `portfolio/test/`.

## Preserve the UI behavior

- Snapshot loading tries `/api/snapshot`, then retains already loaded data if refresh fails, then tries `/repos.json`; show the returned status message and preserve this fallback order.
- The refresh button reloads snapshot data. It does not trigger a GitHub scan; the Worker refreshes on its scheduled event.
- Search and category filters compose. When the project list changes, keep the selected project when possible and provide a clear empty state when nothing matches.
- Project descriptions, names, categories, topics, and other repository-controlled values are untrusted text. Escape values interpolated into HTML templates, use `textContent` for plain text, and validate external links before assigning `href` or `src`.
- Encode repository path segments individually when constructing raw GitHub asset URLs. Preserve the screenshot failure fallback to the project structure view.
- Keep controls keyboard operable and retain the page's existing status announcements and semantic buttons/links. Guard async renders so a slow result for the previously selected project cannot overwrite the current one.
- Metrics are estimates from a bounded scan. Preserve partial-scan indicators and distinguish missing, pending, and absent release data.

## Change and verify

1. Add or update focused tests in `portfolio/test/data.test.js` for helper behavior and `portfolio/test/worker.test.js` for Worker interactions; cover failure and fallback states as well as success paths.
2. For UI behavior changes, inspect the relevant markup and rendering paths, and add coverage for output escaping, empty states, or stale async results where practical.
3. Update `portfolio/README.md` when refresh, fallback, limits, or displayed metric semantics change.
4. Run `npm test` and `npm run check` from `portfolio/` when verification is requested. Keep tests deterministic with mocked fetches and local fixtures; do not call GitHub or Cloudflare from unit tests.
