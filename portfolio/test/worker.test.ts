import test from "node:test";
import assert from "node:assert/strict";
import worker, { refresh } from "../src/worker.ts";

test("snapshot API returns no-store when the snapshot is unavailable", async () => {
  const env = { SNAPSHOTS: { get: async () => null } } as unknown as Env;
  const response = await worker.fetch(new Request("https://site.test/api/snapshot"), env);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("failed GitHub listing preserves the last snapshot", async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async () => new Response("", { status: 503 });
  try {
    const env = {
      SNAPSHOTS: { get: async () => ({ repos: [], projects: {} }), put: async () => { writes += 1; } }
    } as unknown as Env;
    await assert.rejects(refresh(env));
    assert.equal(writes, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("unexpected empty GitHub list preserves existing snapshot", async () => {
  const originalFetch = globalThis.fetch;
  let writes = 0;
  globalThis.fetch = async () => Response.json([]);
  try {
    const env = {
      SNAPSHOTS: {
        get: async () => ({ repos: [{ name: "keep" }], projects: { keep: { loc: 1 } } }),
        put: async () => { writes += 1; }
      }
    } as unknown as Env;
    await assert.rejects(refresh(env), /empty/i);
    assert.equal(writes, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("snapshot stores the latest release publication date", async () => {
  const originalFetch = globalThis.fetch;
  let saved: { projects?: Record<string, { release?: string | null; releasePublishedAt?: string | null }> } | undefined;
  const authorizations: string[] = [];
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.github.com") {
      authorizations.push(new Headers(init?.headers).get("authorization") || "");
    }
    const path = url.pathname;
    if (path.endsWith("/users/CyanAutomation/repos")) {
      return Response.json([{
        name: "demo",
        full_name: "CyanAutomation/demo",
        owner: { login: "CyanAutomation" },
        pushed_at: "2026-01-01T00:00:00Z",
        default_branch: "main"
      }]);
    }
    if (path.endsWith("/languages")) return Response.json({});
    if (path.endsWith("/releases/latest")) {
      return Response.json({ tag_name: "v1.2", published_at: "2025-12-03T10:30:00Z" });
    }
    if (path.endsWith("/git/trees/main")) return Response.json({ sha: "abc", tree: [] });
    throw new Error(`Unexpected request ${String(input)}`);
  };

  try {
    const env = {
      SNAPSHOTS: {
        get: async () => null,
        put: async (_key: string, value: string) => { saved = JSON.parse(value); }
      },
      GITHUB_TOKEN: "test-token"
    } as unknown as Env;
    await refresh(env);
    assert.equal(saved?.projects?.demo.release, "v1.2");
    assert.equal(saved?.projects?.demo.releasePublishedAt, "2025-12-03T10:30:00Z");
    assert.ok(authorizations.length > 0);
    assert.ok(authorizations.every((authorization) => authorization === "Bearer test-token"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});
