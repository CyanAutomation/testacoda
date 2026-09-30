# Metrics and maturity

Testacoda evaluates public GitHub repositories with GitHub's public REST API and bounded raw-file reads.

- Languages come from GitHub's repository languages endpoint and represent bytes attributed by GitHub.
- Lines of code count nonblank, noncomment lines in source files that were successfully read. A per-repository file and byte cap bounds the scan.
- Test suites are an estimate of source files whose paths match common test or spec naming conventions.
- Test cases are an estimate from common JavaScript, Python, Go, and Rust test declarations found in the bounded sample. Treat this as a lower bound.
- The latest release is the repository's latest published GitHub release, when one exists.
- The maturity score is an explainable checklist: README, license, test files, CI workflow, and published release each contribute 20 points.

A score is an inventory signal, not a quality judgment. Large trees may be truncated by GitHub, and unsupported test frameworks can be undercounted.
