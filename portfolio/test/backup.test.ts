import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { renderBackupHtml } from "../scripts/backup-build.ts";

// Contract: docs/test-contracts.md#portfolio-backup-01
test("checked-in backup HTML matches its template and TypeScript application bundle", async () => {
  const portfolioRoot = fileURLToPath(new URL("..", import.meta.url));
  const [template, checkedInHtml] = await Promise.all([
    readFile(new URL("../../portfolio-backup/index.template.html", import.meta.url), "utf8"),
    readFile(new URL("../../portfolio-backup/index.html", import.meta.url), "utf8")
  ]);
  const bundle = await build({
    absWorkingDir: portfolioRoot,
    entryPoints: ["../portfolio-backup/backup.ts"],
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["es2022"],
    write: false,
    legalComments: "none"
  });
  const script = bundle.outputFiles[0]?.text;

  assert.ok(script, "the backup TypeScript source should produce a browser bundle");
  assert.equal(checkedInHtml, renderBackupHtml(template, script));
  assert.doesNotMatch(checkedInHtml, /<script\b[^>]*\bsrc\s*=/i, "the backup must not load an external script");
});
