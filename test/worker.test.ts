import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.ts";

function makeEnvironment(values: Record<string, unknown> = {}): Env {
  const cache = new Map(Object.entries(values));
  return {
    CACHE: {
      async get(key: string, type?: string) {
        const value = cache.get(key);
        return type === "json" && typeof value === "string" ? JSON.parse(value) : value ?? null;
      },
      async put(key: string, value: string) {
        cache.set(key, value);
      }
    },
    CORS_ORIGIN: "https://client.example",
    GITHUB_OWNER: "CyanAutomation",
    MAX_SOURCE_FILES: "40",
    MAX_SOURCE_BYTES: "1500000",
    SCANS: { sendBatch: async () => undefined }
  } as unknown as Env;
}

test("health endpoint returns JSON and the configured CORS origin", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/healthz"),
    makeEnvironment()
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://client.example");
  assert.deepEqual(await response.json(), { ok: true, service: "testacoda" });
});

test("repository index endpoint returns cached data and its latest scan time", async () => {
  const repositories = [
    { full_name: "CyanAutomation/demo", scan: { scanned_at: "2026-11-01T00:00:00.000Z" } },
    { full_name: "CyanAutomation/other", scan: { scanned_at: "2026-11-02T00:00:00.000Z" } }
  ];
  const env = makeEnvironment({ "index:cyanautomation": JSON.stringify(repositories) });

  const response = await worker.fetch(
    new Request("https://worker.example/v1/repos?owner=CyanAutomation"),
    env
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    owner: "CyanAutomation",
    scanned_at: "2026-11-02T00:00:00.000Z",
    repositories
  });
});

test("preflight requests advertise the configured CORS policy", async () => {
  const response = await worker.fetch(
    new Request("https://worker.example/v1/repos", { method: "OPTIONS" }),
    makeEnvironment()
  );

  assert.equal(response.status, 204);
  assert.equal(response.headers.get("access-control-allow-origin"), "https://client.example");
  assert.equal(response.headers.get("access-control-allow-methods"), "GET, OPTIONS");
});
