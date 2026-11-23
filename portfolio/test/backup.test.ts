import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { renderBackupHtml } from "../scripts/backup-build.ts";
import { backupPresentation, loadProjects, projectShape } from "../src/backup-data.ts";

test("project normalization supports scan data and safe GitHub fallbacks", () => {
  assert.deepEqual(projectShape({
    name: "legacy-name",
    full_name: "CyanAutomation/backup-demo",
    updated_at: "2026-01-01T00:00:00Z",
    scan: {
      repo: {
        name: "backup-demo",
        full_name: "CyanAutomation/backup-demo",
        description: "Portfolio fallback",
        html_url: "javascript:alert(1)",
        pushed_at: "2026-02-03T00:00:00Z",
        stargazers_count: 1200
      },
      metrics: {
        languages: { TypeScript: 12 },
        lines_of_code: 42,
        test_cases_estimate: 3,
        latest_release: { tag: "v1.2" }
      },
      maturity: { score: 80, label: "Established" }
    }
  }), {
    name: "backup-demo",
    fullName: "CyanAutomation/backup-demo",
    description: "Portfolio fallback",
    url: "https://github.com/CyanAutomation",
    language: "TypeScript",
    stars: 1200,
    loc: 42,
    tests: 3,
    release: "v1.2",
    maturity: "Established",
    updated: "2026-02-03T00:00:00Z"
  });

  assert.deepEqual(projectShape({ name: "minimal", full_name: "owner/minimal" }), {
    name: "minimal",
    fullName: "owner/minimal",
    description: "A public project by CyanAutomation.",
    url: "https://github.com/CyanAutomation",
    language: "—",
    stars: 0,
    loc: undefined,
    tests: undefined,
    release: "—",
    maturity: "Not scanned",
    updated: ""
  });

  assert.deepEqual(projectShape({
    name: "",
    full_name: "owner/derived",
    description: "",
    language: "",
    metrics: { latest_release: { tag: "" } },
    maturity: { label: "" }
  }), {
    name: "Repository",
    fullName: "owner/derived",
    description: "",
    url: "https://github.com/CyanAutomation",
    language: "",
    stars: 0,
    loc: undefined,
    tests: undefined,
    release: "",
    maturity: "",
    updated: ""
  });
});

test("backup presentation formats values for the carousel", () => {
  assert.deepEqual(backupPresentation({
    name: "demo",
    fullName: "CyanAutomation/demo",
    description: "A demo project",
    url: "https://github.com/CyanAutomation/demo",
    language: "TypeScript",
    stars: 1200,
    loc: 1500,
    tests: 4,
    release: "v1.0",
    maturity: "Established",
    updated: "2026-02-03T00:00:00Z"
  }, 0, 2), {
    counter: "01 / 02",
    name: "demo",
    description: "A demo project",
    previewLabel: "CyanAutomation/demo",
    stars: "1.2k",
    language: "TypeScript",
    maturity: "Established",
    loc: "1.5k",
    tests: "4",
    release: "v1.0",
    updated: new Date("2026-02-03T00:00:00Z").toLocaleDateString(),
    url: "https://github.com/CyanAutomation/demo",
    chips: ["TypeScript", "1.2k stars", "Established"],
    position: "CyanAutomation/demo",
    progress: "50%"
  });
});

test("backup loading falls back to public GitHub repositories when Testacoda is unavailable", async () => {
  const calls: string[] = [];
  let fallbackShown = false;
  const projects = await loadProjects("https://worker.example/", async (input) => {
    calls.push(input);
    if (input.startsWith("https://worker.example/")) return new Response("", { status: 503 });
    return Response.json([
      { name: "public", full_name: "CyanAutomation/public", html_url: "https://github.com/CyanAutomation/public" },
      { name: "private", private: true }
    ]);
  }, () => { fallbackShown = true; });

  assert.deepEqual(calls, [
    "https://worker.example/v1/repos?owner=CyanAutomation",
    "https://api.github.com/users/CyanAutomation/repos?type=public&sort=updated&per_page=100"
  ]);
  assert.equal(fallbackShown, true);
  assert.deepEqual(projects.map((project) => project.name), ["public"]);
});

test("backup loading prefers non-empty shared Testacoda results", async () => {
  const calls: string[] = [];
  const projects = await loadProjects("https://worker.example", async (input) => {
    calls.push(input);
    return Response.json({ repositories: [{
      full_name: "CyanAutomation/shared",
      scan: {
        repo: { full_name: "CyanAutomation/shared", name: "shared" },
        metrics: { lines_of_code: 10 }
      }
    }] });
  });

  assert.equal(projects[0]?.name, "shared");
  assert.deepEqual(calls, ["https://worker.example/v1/repos?owner=CyanAutomation"]);
});

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

// Contract: docs/test-contracts.md#portfolio-backup-01
test("script terminators in the bundle are escaped inside the generated HTML", () => {
  const html = renderBackupHtml("<!-- BACKUP_SCRIPT -->", "const payload = '</ScRiPt>';");

  assert.equal(
    html,
    "<!-- Generated from index.template.html and backup.ts by npm run build. -->\n" +
      "<script>\nconst payload = '<\\/ScRiPt>';\n  </script>"
  );
});
