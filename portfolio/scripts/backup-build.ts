const BACKUP_SCRIPT_PLACEHOLDER = "<!-- BACKUP_SCRIPT -->";

export function renderBackupHtml(template: string, script: string): string {
  if (template.split(BACKUP_SCRIPT_PLACEHOLDER).length !== 2) {
    throw new Error("Backup HTML template must contain exactly one script placeholder");
  }

  return `<!-- Generated from index.template.html and backup.ts by npm run build. -->\n` +
    template.replace(BACKUP_SCRIPT_PLACEHOLDER, `<script>\n${script}\n  </script>`);
}
