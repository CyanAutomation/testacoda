import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("backup output embeds the TypeScript application as a self-contained script", async () => {
  const html = await readFile(new URL("../../portfolio-backup/index.html", import.meta.url), "utf8");

  assert.doesNotMatch(html, /BACKUP_SCRIPT/);
  assert.match(html, /<script>[\s\S]*loadProjects[\s\S]*<\/script>/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
});
