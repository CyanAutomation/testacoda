---
name: workflow-security-review
description: Use when adding, changing, or reviewing GitHub Actions workflows, action dependencies, workflow permissions, or CI security controls in Testacoda.
---

# Testacoda workflow security review

Review the full workflow and its event triggers in `.github/workflows/`, along with `.github/dependabot.yml`. The repository already runs `actionlint`, Zizmor, and CodeQL; keep new workflow behavior compatible with those checks.

## Preserve the repository's controls

- Grant the smallest practical `permissions` set at workflow scope, then add narrowly scoped job permissions only when required. For example, CodeQL needs `security-events: write` for analysis; ordinary build and test jobs should retain read-only content access.
- Pin third-party actions to a verified full commit SHA and keep a readable version comment. When updating a pin, verify the intended release and full SHA instead of substituting a mutable tag.
- Set `persist-credentials: false` on checkout unless a later step demonstrably needs the checkout token. Do not make repository secrets available to code from untrusted pull requests.
- Review every trigger when changing a workflow. Treat pull request titles, branch names, labels, comments, and other event fields as untrusted input; do not interpolate them directly into shell source.
- Keep concurrency cancellation scoped to the relevant workflow and ref or pull request, as in the existing workflows.
- Preserve Dependabot coverage for GitHub Actions and both npm package roots (`/` and `/portfolio`).

## Verify workflow changes

1. Run `actionlint` on the changed workflow files when the tool is available.
2. Review the resulting workflow with Zizmor or rely on the repository's Zizmor workflow; address findings rather than suppressing them without a specific reason.
3. Check that the CI jobs still install dependencies from the correct package lock and run that package's `npm run check`.
4. Keep CodeQL analysis permissions scoped to its analysis job and retain the current JavaScript/TypeScript coverage unless the repository language setup changes.

Do not add credentials, production deployment, or broad write permissions as a shortcut for a failing check. Identify the exact operation that needs access and scope its permission to that job or step.
