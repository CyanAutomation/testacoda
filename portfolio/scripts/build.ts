import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
import { renderBackupHtml } from "./backup-build.ts";

await build({
  entryPoints: ["src/app.ts"],
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2022"],
  outfile: "public/app.js",
  banner: { js: "// Generated from src/app.ts by npm run build." },
  legalComments: "none"
});

const backupBundle = await build({
  entryPoints: ["../portfolio-backup/backup.ts"],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: ["es2022"],
  write: false,
  legalComments: "none"
});
const backupScript = backupBundle.outputFiles[0]?.text;
if (!backupScript) throw new Error("Backup TypeScript bundle was empty");

const template = await readFile("../portfolio-backup/index.template.html", "utf8");
const backupHtml = renderBackupHtml(template, backupScript);
await writeFile("../portfolio-backup/index.html", backupHtml);
