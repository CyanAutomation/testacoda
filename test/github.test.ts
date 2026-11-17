import test from "node:test";
import assert from "node:assert/strict";
import { githubJson, GitHubApiError } from "../src/github.ts";

// Contract: docs/test-contracts.md#github-client-01
test("GitHub requests include the configured token and expected API headers", async () => {
  const originalFetch = globalThis.fetch;
  const observed: { requestHeaders?: Headers } = {};
  globalThis.fetch = async (_input, init) => {
    observed.requestHeaders = new Headers(init?.headers);
    return Response.json({ ok: true });
  };

  try {
    assert.deepEqual(await githubJson("https://api.github.com/test", { GITHUB_TOKEN: "secret" }), { ok: true });
    assert.ok(observed.requestHeaders);
    assert.equal(observed.requestHeaders.get("authorization"), "Bearer secret");
    assert.equal(observed.requestHeaders.get("accept"), "application/vnd.github+json");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// Contract: docs/test-contracts.md#github-client-01
test("GitHub API errors retain their HTTP status", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response("rate limited", { status: 403 });

  try {
    await assert.rejects(githubJson("https://api.github.com/test"), (error: unknown) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.status, 403);
      assert.match(error.message, /403/);
      return true;
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
