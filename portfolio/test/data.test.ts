import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { parse } from "parse5";
import {
  countSource,
  encodePath,
  filterProjects,
  formatReleaseDate,
  isWebUrl,
  loadSnapshot,
  selectFiles
} from "../src/data.ts";

type HtmlNode = {
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: HtmlNode[];
  tagName?: string;
  value?: string;
};

function elements(node: HtmlNode, predicate: (candidate: HtmlNode) => boolean): HtmlNode[] {
  return (node.childNodes || []).flatMap((child) => [
    ...(predicate(child) ? [child] : []),
    ...elements(child, predicate)
  ]);
}

function attribute(node: HtmlNode, name: string): string | undefined {
  return node.attrs?.find((item) => item.name === name)?.value;
}

function textContent(node: HtmlNode): string {
  return (node.value || "") + (node.childNodes || []).map(textContent).join("");
}

// Contract: docs/test-contracts.md#portfolio-scan-01
test("source selection excludes dependency entries from the sample", () => {
  const result = selectFiles([
    { type: "blob", path: "src/a.js", size: 20 },
    { type: "blob", path: "node_modules/a.js", size: 2 },
    { type: "blob", path: "src/b.ts", size: 30 }
  ], 25, 100);

  assert.deepEqual(result.files.map((file) => file.path), ["src/a.js", "src/b.ts"]);
  assert.equal(result.partial, false);
});

// Contract: docs/test-contracts.md#portfolio-scan-01
test("source selection marks a file-count-limited sample as partial", () => {
  const result = selectFiles([
    { type: "blob", path: "src/a.js", size: 20 },
    { type: "blob", path: "src/b.js", size: 20 },
    { type: "blob", path: "src/c.js", size: 20 }
  ], 2, 100);

  assert.deepEqual(result.files.map((file) => file.path), ["src/a.js", "src/b.js"]);
  assert.equal(result.partial, true);
});

// Contract: docs/test-contracts.md#portfolio-scan-01
test("source selection respects the byte cap and marks skipped files as partial", () => {
  const result = selectFiles([
    { type: "blob", path: "src/a.js", size: 20 },
    { type: "blob", path: "src/b.js", size: 30 }
  ], 25, 35);

  assert.deepEqual(result.files.map((file) => file.path), ["src/a.js"]);
  assert.equal(result.partial, true);
});

// Contract: docs/test-contracts.md#portfolio-scan-01
test("source selection skips entries without finite sizes", () => {
  const result = selectFiles([
    { type: "blob", path: "src/unknown.js" },
    { type: "blob", path: "src/not-a-number.js", size: Number.NaN },
    { type: "blob", path: "src/valid.js", size: 12 }
  ]);

  assert.deepEqual(result.files.map((file) => file.path), ["src/valid.js"]);
  assert.equal(result.partial, true);
});

// Contract: docs/test-contracts.md#portfolio-estimate-01
test("source lines and estimated test declarations are counted", () => {
  assert.deepEqual(countSource('a\n\n test("x",()=>{})\n', true), { lines: 2, tests: 1 });
});

// Contract: docs/test-contracts.md#portfolio-filter-01
test("search and category filters compose", () => {
  const projects = [
    { name: "dojo", description: "judo tracker", category: "Judo" },
    { name: "tool", category: "Tools" }
  ];
  assert.deepEqual(filterProjects(projects, "TRACK", "Judo").map((repo) => repo.name), ["dojo"]);
  assert.equal(filterProjects(projects, "track", "Tools").length, 0);
});

// Contract: docs/test-contracts.md#portfolio-screenshot-01
test("screenshot paths preserve segments while encoding reserved characters", () => {
  assert.equal(encodePath('screenshots/"a#b? c.png'), "screenshots/%22a%23b%3F%20c.png");
});

// Contract: docs/test-contracts.md#portfolio-fallback-01
test("reports unavailable project data when the shared and bundled snapshots fail", async () => {
  const calls: string[] = [];
  const fetcher = async (url: string): Promise<Response> => {
    calls.push(url);
    if (url === "/api/snapshot") return new Response("", { status: 503 });
    throw new Error("offline");
  };
  const result = await loadSnapshot(fetcher, []);
  assert.deepEqual(calls, ["/api/snapshot", "/repos.json"]);
  assert.equal(result.repos.length, 0);
  assert.match(result.message, /unavailable/i);
  assert.equal(result.snapshot, null);
});

// Contract: docs/test-contracts.md#portfolio-fallback-01
test("keeps previously loaded projects when snapshot refresh fails", async () => {
  let calls = 0;
  const existing = [{ name: "old" }];
  const result = await loadSnapshot(async () => {
    calls += 1;
    throw new Error("offline");
  }, existing);
  assert.equal(calls, 1);
  assert.deepEqual(result.repos, existing);
  assert.match(result.message, /unavailable/i);
});

// Contract: docs/test-contracts.md#portfolio-release-01
test("formats valid release dates and omits missing or invalid dates", () => {
  assert.equal(formatReleaseDate("2025-12-03T10:30:00Z"), "3 Dec 2025");
  assert.equal(formatReleaseDate(null), "");
  assert.equal(formatReleaseDate("not-a-date"), "");
});

// Contract: docs/test-contracts.md#portfolio-homepage-01
test("demo links accept valid absolute HTTP and HTTPS URLs only", () => {
  const cases: Array<[unknown, boolean]> = [
    ["https://gogomio.cloud.run", true],
    ["http://example.test", true],
    ["javascript:alert(1)", false],
    ["/relative/path", false],
    ["https://", false],
    ["https://not a host", false],
    ["https:example.test", false],
    [null, false]
  ];

  for (const [value, expected] of cases) {
    assert.equal(isWebUrl(value), expected, `isWebUrl(${String(value)})`);
  }
});

// Contract: docs/test-contracts.md#portfolio-ui-01
test("portfolio metric labels omit stars and the optional homepage link is a hidden demo link", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  const document = parse(html) as unknown as HtmlNode;
  const metrics = elements(document, (node) =>
    node.tagName === "div" && (attribute(node, "class") || "").split(/\s+/).includes("metrics")
  )[0];

  assert.ok(metrics, "the portfolio should render its repository metrics");
  const labels = elements(metrics, (node) =>
    node.tagName === "span" && (attribute(node, "class") || "").split(/\s+/).includes("metric-label")
  ).map((node) => textContent(node).trim());
  assert.deepEqual(labels, ["SOURCE LINES", "LATEST RELEASE", "TEST DECLARATIONS"]);

  const liveLink = elements(document, (node) => node.tagName === "a" && attribute(node, "id") === "live")[0];
  assert.ok(liveLink, "the homepage link should have a stable live-link target");
  assert.equal(textContent(liveLink).trim(), "Visit demo");
  assert.equal(attribute(liveLink, "hidden"), "");
  assert.equal(attribute(liveLink, "href"), undefined);
  assert.equal(attribute(liveLink, "target"), "_blank");
  assert.ok((attribute(liveLink, "rel") || "").split(/\s+/).includes("noopener"));
});
