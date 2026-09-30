import { githubJson } from "./github.js";

const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte",
  ".py", ".go", ".rs", ".java", ".kt", ".kts", ".cs", ".cpp", ".cc",
  ".c", ".h", ".hpp", ".php", ".rb", ".swift", ".scala", ".sh", ".sql",
  ".html", ".css", ".scss", ".json", ".yml", ".yaml"
]);

export function isSourceFile(path) {
  const name = path.toLowerCase().split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 && SOURCE_EXTENSIONS.has(name.slice(dot));
}

export function isTestPath(path) {
  return /(^|[/._-])(test|tests|spec|specs|__tests__)([/._-]|$)/i.test(path) ||
    /\.(test|spec)\.[^.]+$/i.test(path);
}

export function countLinesOfCode(text) {
  return text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !/^(\/\/|\/\*|\*\/?|\*|#|<!--|--)/.test(trimmed);
  }).length;
}

export function countTestCases(path, text) {
  const ext = (path.match(/\.[^.]+$/) || [""])[0].toLowerCase();
  const patterns = ext === ".py"
    ? [/\b(?:async\s+)?def\s+test_[A-Za-z0-9_]+\s*\(/g]
    : ext === ".go"
      ? [/\bfunc\s+Test[A-Z][A-Za-z0-9_]*\s*\(/g]
      : ext === ".rs"
        ? [/^\s*#\s*\[\s*test\s*\]\s*$/gm, /^\s*#\s*\[\s*tokio::test\s*\]\s*$/gm]
        : [/\b(?:it|test|specify)\s*\(/g];
  return patterns.reduce((total, pattern) => total + (text.match(pattern) || []).length, 0);
}

function maturitySignals(paths, testFiles, release) {
  const hasReadme = paths.some((path) => /^readme(?:\.[^/]*)?$/i.test(path));
  const hasLicense = paths.some((path) => /^licen[cs]e(?:\.[^/]*)?$/i.test(path));
  const hasCi = paths.some((path) => /^\.github\/workflows\/.+\.ya?ml$/i.test(path)) ||
    paths.some((path) => /^\.travis\.yml$/i.test(path));
  const checks = [
    { id: "documentation", label: "README", passed: hasReadme },
    { id: "license", label: "License", passed: hasLicense },
    { id: "tests", label: "Test files", passed: testFiles > 0 },
    { id: "automation", label: "CI workflow", passed: hasCi },
    { id: "release", label: "Published release", passed: Boolean(release) }
  ];
  const score = Math.round(checks.filter((item) => item.passed).length * 100 / checks.length);
  const label = score >= 80 ? "Established" : score >= 40 ? "Growing" : "Early";
  return { score, label, checks };
}

async function fetchRawFile(owner, repo, branch, path) {
  const branchPart = encodeURIComponent(branch).replace(/%2F/gi, "/");
  const pathPart = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch("https://raw.githubusercontent.com/" + owner + "/" +
    repo + "/" + branchPart + "/" + pathPart, {
      headers: { "User-Agent": "testacoda-repo-maturity-scanner" }
    });
  if (!response.ok) return null;
  return response.text();
}

export async function scanRepository(repo, env = {}) {
  const [languages, treeResult, release] = await Promise.all([
    githubJson(repo.languages_url, env).catch(() => ({})),
    githubJson("https://api.github.com/repos/" + repo.full_name +
      "/git/trees/" + encodeURIComponent(repo.default_branch) + "?recursive=1", env),
    githubJson("https://api.github.com/repos/" + repo.full_name +
      "/releases/latest", env).catch(() => null)
  ]);

  const paths = (treeResult.tree || [])
    .filter((item) => item.type === "blob")
    .map((item) => item.path);
  const sourcePaths = paths.filter(isSourceFile);
  const testPaths = sourcePaths.filter(isTestPath);
  const maxFiles = Math.max(1, Number(env.MAX_SOURCE_FILES) || 40);
  const maxBytes = Math.max(100000, Number(env.MAX_SOURCE_BYTES) || 1500000);
  let bytesScanned = 0;
  let filesScanned = 0;
  let linesOfCode = 0;
  let testCases = 0;
  let testFilesScanned = 0;

  for (const path of sourcePaths.slice(0, maxFiles)) {
    if (bytesScanned >= maxBytes) break;
    try {
      const text = await fetchRawFile(repo.owner.login, repo.name, repo.default_branch, path);
      if (text === null || text.length > Math.min(250000, maxBytes - bytesScanned)) continue;
      bytesScanned += text.length;
      filesScanned += 1;
      linesOfCode += countLinesOfCode(text);
      if (isTestPath(path)) {
        testFilesScanned += 1;
        testCases += countTestCases(path, text);
      }
    } catch {
      // A missing or rate-limited raw file should not fail the whole repository scan.
    }
  }

  const latestRelease = release && release.tag_name
    ? { tag: release.tag_name, name: release.name || release.tag_name, url: release.html_url }
    : null;
  return {
    schema_version: 1,
    scanned_at: new Date().toISOString(),
    repo: {
      full_name: repo.full_name,
      html_url: repo.html_url,
      description: repo.description || "",
      default_branch: repo.default_branch,
      pushed_at: repo.pushed_at,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      open_issues: repo.open_issues_count || 0,
      homepage: repo.homepage || null
    },
    metrics: {
      languages,
      lines_of_code: linesOfCode,
      lines_of_code_is_estimate: true,
      source_files_total: sourcePaths.length,
      source_files_scanned: filesScanned,
      bytes_scanned: bytesScanned,
      test_suites_estimate: testPaths.length,
      test_cases_estimate: testCases,
      test_cases_are_lower_bound: true,
      latest_release: latestRelease
    },
    maturity: maturitySignals(paths, testPaths.length, latestRelease),
    methodology: {
      note: "LOC and test counts are bounded source scans and estimates. Test suite count means files matched by common test naming conventions.",
      source_file_limit: maxFiles,
      source_byte_limit: maxBytes,
      tree_truncated: Boolean(treeResult.truncated)
    }
  };
}
