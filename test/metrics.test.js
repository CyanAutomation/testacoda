import test from "node:test";
import assert from "node:assert/strict";
import { countLinesOfCode, countTestCases, isSourceFile, isTestPath } from "../src/metrics.js";

test("recognizes source files without treating prose files as code", () => {
  assert.equal(isSourceFile("src/index.js"), true);
  assert.equal(isSourceFile("README.md"), false);
});

test("recognizes common test directory and file conventions", () => {
  assert.equal(isTestPath("test/scanner.test.js"), true);
  assert.equal(isTestPath("src/metrics.js"), false);
});

test("counts nonblank, noncomment lines as an estimate", () => {
  assert.equal(countLinesOfCode("const x = 1;\n\n// note\nreturn x;\n"), 2);
});

test("counts JavaScript test declarations", () => {
  assert.equal(countTestCases("test/example.test.js", "test('one', () => {});\nit('two', () => {});"), 2);
});

test("counts Python test functions", () => {
  assert.equal(countTestCases("test_example.py", "def test_one():\n    pass\n"), 1);
});
