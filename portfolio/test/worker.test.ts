import test from "node:test";
import assert from "node:assert/strict";
import worker, { refresh } from "../src/worker.ts";

async function withMockedFetch<T>(replacement: typeof fetch, action: () => Promise<T>): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = replacement;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// Contract: docs/test-contracts.md#snapshot-api-01
test("snapshot API returns no-store when the snapshot is unavailable", async () => {
  const env = { SNAPSHOTS: { get: async () => null } } as unknown as Env;
  const response = await worker.fetch(new Request("https://site.test/api/snapshot"), env);

  assert.equal(response.status, 503);
  assert.match(response.headers.get("content-type") || "", /application\/json/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "Snapshot not available yet" });
});

const listingFailures = [
  {
    description: "GitHub rejects the repository listing",
    response: () => new Response("", { status: 503 }),
    error: /GitHub 503/
  },
  {
    description: "GitHub returns an empty repository list",
    response: () => Response.json([]),
    error: /empty/i
  }
] as const;

for (const failure of listingFailures) {
  // Contract: docs/test-contracts.md#snapshot-refresh-01
  test(`refresh preserves the previous snapshot when ${failure.description}`, async () => {
    const previous = { repos: [{ name: "keep" }], projects: { keep: { loc: 1 } } };
    let storedSnapshot = JSON.stringify(previous);
    let writes = 0;
    const env = {
      SNAPSHOTS: {
        get: async () => JSON.parse(storedSnapshot),
        put: async (_key: string, value: string) => {
          writes += 1;
          storedSnapshot = value;
        }
      }
    } as unknown as Env;

    await withMockedFetch(async () => failure.response(), async () => {
      await assert.rejects(refresh(env), failure.error);
    });

    assert.equal(writes, 0);
    assert.deepEqual(JSON.parse(storedSnapshot), previous);
  });
}

// Contract: docs/test-contracts.md#portfolio-release-01
// Contract: docs/test-contracts.md#github-client-01
test("snapshot stores the latest release tag and publication date", async () => {
  let saved: { projects?: Record<string, { release?: string | null; releasePublishedAt?: string | null }> } | undefined;
  const authorizations: string[] = [];
  const responses = new Map<string, Response>([
    ["api.github.com/users/CyanAutomation/repos", Response.json([{
      name: "demo",
      full_name: "CyanAutomation/demo",
      owner: { login: "CyanAutomation" },
      pushed_at: "2026-01-01T00:00:00Z",
      default_branch: "main"
    }])],
    ["api.github.com/repos/CyanAutomation/demo/languages", Response.json({})],
    ["api.github.com/repos/CyanAutomation/demo/releases/latest", Response.json({
      tag_name: "v1.2",
      published_at: "2025-12-03T10:30:00Z"
    })],
    ["api.github.com/repos/CyanAutomation/demo/git/trees/main", Response.json({ sha: "abc", tree: [] })]
  ]);

  await withMockedFetch(async (input, init) => {
    const url = new URL(String(input));
    if (url.hostname === "api.github.com") {
      authorizations.push(new Headers(init?.headers).get("authorization") || "");
    }
    const response = responses.get(`${url.hostname}${url.pathname}`);
    if (!response) throw new Error(`Unexpected request ${String(input)}`);
    return response;
  }, async () => {
    const env = {
      SNAPSHOTS: {
        get: async () => null,
        put: async (_key: string, value: string) => { saved = JSON.parse(value); }
      },
      GITHUB_TOKEN: "test-token"
    } as unknown as Env;

    await refresh(env);
  });

  assert.equal(saved?.projects?.demo.release, "v1.2");
  assert.equal(saved?.projects?.demo.releasePublishedAt, "2025-12-03T10:30:00Z");
  assert.ok(authorizations.length > 0);
  assert.ok(authorizations.every((authorization) => authorization === "Bearer test-token"));
});

test("refresh scans the oldest changed project and retains other project metrics", async () => {
  const repos = [
    {
      name: "unchanged",
      full_name: "CyanAutomation/unchanged",
      owner: { login: "CyanAutomation" },
      pushed_at: "2026-01-01T00:00:00Z",
      default_branch: "main"
    },
    {
      name: "recent-change",
      full_name: "CyanAutomation/recent-change",
      owner: { login: "CyanAutomation" },
      pushed_at: "2026-02-01T00:00:00Z",
      default_branch: "main"
    },
    {
      name: "old-change",
      full_name: "CyanAutomation/old-change",
      owner: { login: "CyanAutomation" },
      pushed_at: "2026-03-01T00:00:00Z",
      default_branch: "main"
    }
  ];
  const previous = {
    repos: [],
    projects: {
      unchanged: { pushed_at: "2026-01-01T00:00:00Z", time: 1, loc: 10 },
      "recent-change": { pushed_at: "2026-01-15T00:00:00Z", time: 2, loc: 20 },
      "old-change": { pushed_at: "2026-02-15T00:00:00Z", time: 0, loc: 30 }
    }
  };
  let saved: { repos?: typeof repos; projects?: Record<string, { loc?: number; pushed_at?: string }> } | undefined;
  const treeRequests: string[] = [];

  await withMockedFetch(async (input) => {
    const url = new URL(String(input));
    if (url.hostname !== "api.github.com") throw new Error(`Unexpected request ${String(input)}`);
    if (url.pathname.endsWith("/users/CyanAutomation/repos")) return Response.json(repos);
    if (url.pathname.endsWith("/languages")) return Response.json({ TypeScript: 1 });
    if (url.pathname.endsWith("/releases/latest")) return new Response("", { status: 404 });
    if (url.pathname.includes("/git/trees/")) {
      treeRequests.push(url.pathname);
      return Response.json({ sha: "fresh", tree: [] });
    }
    throw new Error(`Unexpected request ${String(input)}`);
  }, async () => {
    const env = {
      SNAPSHOTS: {
        get: async () => previous,
        put: async (_key: string, value: string) => { saved = JSON.parse(value); }
      }
    } as unknown as Env;

    await refresh(env);
  });

  assert.deepEqual(treeRequests, ["/repos/CyanAutomation/old-change/git/trees/main"]);
  assert.equal(saved?.projects?.unchanged.loc, 10);
  assert.equal(saved?.projects?.["recent-change"].loc, 20);
  assert.equal(saved?.projects?.["old-change"].pushed_at, "2026-03-01T00:00:00Z");
});
