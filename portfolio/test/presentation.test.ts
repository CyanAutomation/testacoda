import test from "node:test";
import assert from "node:assert/strict";
import {
  keyboardDirection,
  languagePresentation,
  metricsPresentation,
  repositoryPresentation,
  swipeDirection,
  visualMarkup
} from "../src/presentation.ts";

test("metric presentation keeps partial scan and unavailable release details explicit", () => {
  assert.deepEqual(metricsPresentation({
    loc: 1200,
    tests: 2,
    partial: true,
    scanned: 3,
    testfiles: 1,
    release: "v1.2",
    releasePublishedAt: null,
    errors: ["Using cached metrics."]
  }), {
    loc: "1,200+",
    locNote: "Partial scan · 3 source files",
    tests: "2+",
    testNote: "1 test files · estimate",
    release: "v1.2",
    releaseNote: "Release date unavailable",
    status: "Using cached metrics."
  });
});

test("metric presentation distinguishes no release from missing metrics", () => {
  assert.deepEqual(metricsPresentation({
    loc: null,
    tests: null,
    testfiles: null,
    noRelease: true,
    errors: ["Metrics unavailable."]
  }), {
    loc: "—",
    locNote: "Measurement unavailable",
    tests: "—",
    testNote: "Source scan estimate",
    release: "None published",
    releaseNote: "No GitHub release",
    status: "Metrics unavailable."
  });
});

test("visual markup selects and safely encodes the repository screenshot", () => {
  const html = visualMarkup({
    name: "judokon",
    full_name: "CyanAutomation/judokon",
    default_branch: "main"
  }, {
    sha: "abc123",
    tree: [{ type: "blob", path: "screenshots/homepage-linux.png" }]
  }, 1);

  assert.match(html, /REPOSITORY SCREENSHOT/);
  assert.ok(html.includes(
    "https://raw.githubusercontent.com/CyanAutomation/judokon/abc123/screenshots/homepage-linux.png"
  ), "the generated screenshot URL should point at the selected file");
  assert.match(html, /aria-hidden="true">02/);
});

test("visual markup escapes repository content in the project diagram", () => {
  const html = visualMarkup({
    name: "<script>",
    full_name: "CyanAutomation/<script>",
    language: "TypeScript"
  }, {
    tree: [{ type: "blob", path: "src/<module>.ts" }]
  }, 0);

  assert.match(html, /repository:\/\/ &lt;script&gt;/);
  assert.match(html, /src\/&lt;module&gt;\.ts/);
  assert.ok(html.includes("&lt;script&gt;"));
  assert.equal(html.toLowerCase().includes("<script"), false);
});

test("repository presentation keeps unsafe demo URLs hidden and escapes topic labels", () => {
  assert.deepEqual(repositoryPresentation({
    name: "demo project",
    topics: ["<script>", "typescript"],
    homepage: "javascript:alert(1)"
  }, 1, 3, "TOOLS"), {
    category: "TOOLS",
    position: "02 / 03",
    title: "demo project",
    description: "A public software project by CyanAutomation.",
    archived: "",
    topics: "<span>&lt;script&gt;</span><span>typescript</span>",
    sourceUrl: "https://github.com/CyanAutomation/demo%20project",
    liveHidden: true,
    liveUrl: undefined
  });
});

test("language presentation sorts byte shares and falls back to a repository language", () => {
  const measured = languagePresentation({ JavaScript: 1, TypeScript: 3 }, { name: "demo" });
  assert.match(measured.bar, /width:75%/);
  assert.match(measured.list, /TypeScript 75[.]0%/);
  assert.equal(measured.note, "BY SOURCE BYTES");

  const fallback = languagePresentation(null, { name: "demo", language: "TypeScript" });
  assert.match(fallback.bar, /width:100%/);
  assert.match(fallback.list, /TypeScript/);
  assert.doesNotMatch(fallback.list, /100[.]0%/);
  assert.equal(fallback.note, "");
});

test("keyboard navigation ignores form controls", () => {
  assert.equal(keyboardDirection("ArrowLeft"), -1);
  assert.equal(keyboardDirection("ArrowRight"), 1);
  assert.equal(keyboardDirection("ArrowLeft", "INPUT"), 0);
  assert.equal(keyboardDirection("ArrowRight", "textarea"), 0);
  assert.equal(keyboardDirection("Escape"), 0);
});

test("touch navigation requires a deliberate horizontal swipe", () => {
  assert.equal(swipeDirection([100, 100], [180, 110]), -1);
  assert.equal(swipeDirection([100, 100], [10, 105]), 1);
  assert.equal(swipeDirection([100, 100], [160, 110]), 0);
  assert.equal(swipeDirection([100, 100], [200, 190]), 0);
  assert.equal(swipeDirection(null, [200, 190]), 0);
});
