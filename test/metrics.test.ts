import test from "node:test";
import assert from "node:assert/strict";
import { countLinesOfCode, countTestCases, isSourceFile, isTestPath, scanRepository } from "../src/metrics.ts";

// Contract: docs/test-contracts.md#metrics-classification-01
test("recognizes source files without treating prose files as code", () => {
  assert.equal(isSourceFile("src/index.js"), true);
  assert.equal(isSourceFile("README.md"), false);
});

// Contract: docs/test-contracts.md#metrics-classification-01
test("recognizes common test directory and file conventions", () => {
  assert.equal(isTestPath("test/scanner.test.js"), true);
  assert.equal(isTestPath("src/metrics.js"), false);
});

// Contract: docs/test-contracts.md#metrics-estimate-01
test("counts nonblank, noncomment lines as an estimate", () => {
  assert.equal(countLinesOfCode("const x = 1;\n\n// note\nreturn x;\n"), 2);
});

// Contract: docs/test-contracts.md#metrics-test-count-01
test("counts JavaScript test declarations", () => {
  assert.equal(countTestCases("test/example.test.js", "test('one', () => {});\nit('two', () => {});"), 2);
});

// Contract: docs/test-contracts.md#metrics-test-count-01
test("counts synchronous and asynchronous Python test functions once", () => {
  const source = "def test_one():\n    pass\nasync def test_two():\n    pass\n";
  assert.equal(countTestCases("test_example.py", source), 2);
});

test("repository scans obey the file limit and count fetched test declarations", async () => {
  const originalFetch = globalThis.fetch;
  const requestedFiles: string[] = [];
  const repo = {
    full_name: "CyanAutomation/example",
    name: "example",
    owner: { login: "CyanAutomation" },
    languages_url: "https://api.github.com/repos/CyanAutomation/example/languages",
    default_branch: "main",
    html_url: "https://github.com/CyanAutomation/example"
  };
  const tree = [
    { type: "blob", path: "src/index.ts" },
    { type: "blob", path: "test/index.test.ts" },
    { type: "blob", path: "src/extra.ts" }
  ];

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/languages")) {
      return Response.json({ TypeScript: 10 });
    }
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/git/trees/main")) {
      return Response.json({ tree });
    }
    if (url.hostname === "api.github.com" && url.pathname.endsWith("/releases/latest")) {
      return new Response("", { status: 404 });
    }
    if (url.hostname === "raw.githubusercontent.com") {
      requestedFiles.push(url.pathname);
      return new Response(url.pathname.endsWith("index.test.ts") ? "test('works', () => {});\n" : "const value = 1;\n");
    }
    throw new Error(`Unexpected request ${String(input)}`);
  };

  try {
    const result = await scanRepository(repo, { MAX_SOURCE_FILES: "2" });
    assert.deepEqual(requestedFiles, [
      "/CyanAutomation/example/main/src/index.ts",
      "/CyanAutomation/example/main/test/index.test.ts"
    ]);
    assert.equal(result.metrics.source_files_total, 3);
    assert.equal(result.metrics.source_files_scanned, 2);
    assert.equal(result.metrics.test_suites_estimate, 1);
    assert.equal(result.metrics.test_cases_estimate, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
