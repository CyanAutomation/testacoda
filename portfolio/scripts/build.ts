import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";

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
const placeholder = "<!-- BACKUP_SCRIPT -->";
if (template.split(placeholder).length !== 2) {
  throw new Error("Backup HTML template must contain exactly one script placeholder");
}
const backupHtml = `<!-- Generated from index.template.html and backup.ts by npm run build. -->\n` +
  template.replace(placeholder, `<script>\n${backupScript}\n  </script>`);
await writeFile("../portfolio-backup/index.html", backupHtml);
