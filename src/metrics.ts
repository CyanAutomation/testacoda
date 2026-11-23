import { githubJson, type GitHubEnvironment, type GitHubRepository } from "./github.ts";

const SOURCE_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".vue", ".svelte",
  ".py", ".go", ".rs", ".java", ".kt", ".kts", ".cs", ".cpp", ".cc",
  ".c", ".h", ".hpp", ".php", ".rb", ".swift", ".scala", ".sh", ".sql",
  ".html", ".css", ".scss", ".json", ".yml", ".yaml"
]);

export interface MaturityCheck {
  id: "documentation" | "license" | "tests" | "automation" | "release";
  label: string;
  passed: boolean;
}

export interface LatestRelease {
  tag: string;
  name: string;
  url?: string;
}

export interface RepositoryScan {
  schema_version: 1;
  scanned_at: string;
  repo: {
    full_name: string;
    html_url: string;
    description: string;
    default_branch: string;
    pushed_at?: string | null;
    stars: number;
    forks: number;
    open_issues: number;
    homepage: string | null;
  };
  metrics: {
    languages: Record<string, number>;
    lines_of_code: number;
    lines_of_code_is_estimate: true;
    source_files_total: number;
    source_files_scanned: number;
    bytes_scanned: number;
    test_suites_estimate: number;
    test_cases_estimate: number;
    test_cases_are_lower_bound: true;
    latest_release: LatestRelease | null;
  };
  maturity: { score: number; label: string; checks: MaturityCheck[] };
  methodology: {
    note: string;
    source_file_limit: number;
    source_byte_limit: number;
    tree_truncated: boolean;
  };
}

export interface ScanEnvironment extends GitHubEnvironment {
  MAX_SOURCE_FILES?: string;
  MAX_SOURCE_BYTES?: string;
}

interface GitHubTreeItem {
  type: string;
  path: string;
}

interface GitHubTree {
  tree?: GitHubTreeItem[];
  truncated?: boolean;
}

interface GitHubRelease {
  tag_name?: string;
  name?: string | null;
  html_url?: string;
}

export function isSourceFile(path: string): boolean {
  const name = path.toLowerCase().split("/").pop() || "";
  const dot = name.lastIndexOf(".");
  return dot >= 0 && SOURCE_EXTENSIONS.has(name.slice(dot));
}

export function isTestPath(path: string): boolean {
  return /(^|[/._-])(test|tests|spec|specs|__tests__)([/._-]|$)/i.test(path) ||
    /\.(test|spec)\.[^.]+$/i.test(path);
}

export function countLinesOfCode(text: string): number {
  return text.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !/^(\/\/|\/\*|\*\/?|\*|#|<!--|--)/.test(trimmed);
  }).length;
}

export function countTestCases(path: string, text: string): number {
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

function maturitySignals(paths: string[], testFiles: number, release: LatestRelease | null) {
  const hasReadme = paths.some((path) => /^readme(?:\.[^/]*)?$/i.test(path));
  const hasLicense = paths.some((path) => /^licen[cs]e(?:\.[^/]*)?$/i.test(path));
  const hasCi = paths.some((path) => /^\.github\/workflows\/.+\.ya?ml$/i.test(path)) ||
    paths.some((path) => /^\.travis\.yml$/i.test(path));
  const checks: MaturityCheck[] = [
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

async function fetchRawFile(owner: string, repo: string, branch: string, path: string): Promise<string | null> {
  const branchPart = encodeURIComponent(branch).replace(/%2F/gi, "/");
  const pathPart = path.split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/${branchPart}/${pathPart}`, {
    headers: { "User-Agent": "testacoda-repo-maturity-scanner" }
  });
  if (!response.ok) return null;
  return await response.text();
}

interface SourceFileMetrics {
  bytesScanned: number;
  filesScanned: number;
  linesOfCode: number;
  testCases: number;
}

type RawFileFetcher = typeof fetchRawFile;

async function scanSourceFiles(
  sourcePaths: string[],
  repo: GitHubRepository,
  maxFiles: number,
  maxBytes: number,
  fetchFile: RawFileFetcher = fetchRawFile
): Promise<SourceFileMetrics> {
  let bytesScanned = 0;
  let filesScanned = 0;
  let linesOfCode = 0;
  let testCases = 0;

  for (const path of sourcePaths.slice(0, maxFiles)) {
    if (bytesScanned >= maxBytes) break;
    try {
      const text = await fetchFile(repo.owner.login, repo.name, repo.default_branch, path);
      if (text === null || text.length > Math.min(250000, maxBytes - bytesScanned)) continue;
      bytesScanned += text.length;
      filesScanned += 1;
      linesOfCode += countLinesOfCode(text);
      if (isTestPath(path)) testCases += countTestCases(path, text);
    } catch {
      // A missing or rate-limited raw file should not fail the whole repository scan.
    }
  }

  return { bytesScanned, filesScanned, linesOfCode, testCases };
}

export async function scanRepository(
  repo: GitHubRepository,
  env: ScanEnvironment = {}
): Promise<RepositoryScan> {
  const [languages, treeResult, release] = await Promise.all([
    githubJson<Record<string, number>>(repo.languages_url, env).catch(() => ({})),
    githubJson<GitHubTree>(`https://api.github.com/repos/${repo.full_name}` +
      `/git/trees/${encodeURIComponent(repo.default_branch)}?recursive=1`, env),
    githubJson<GitHubRelease>(`https://api.github.com/repos/${repo.full_name}/releases/latest`, env)
      .catch(() => null)
  ]);

  const paths = (treeResult.tree || [])
    .filter((item) => item.type === "blob")
    .map((item) => item.path);
  const sourcePaths = paths.filter(isSourceFile);
  const testPaths = sourcePaths.filter(isTestPath);
  const maxFiles = Math.max(1, Number(env.MAX_SOURCE_FILES) || 40);
  const maxBytes = Math.max(100000, Number(env.MAX_SOURCE_BYTES) || 1500000);
  const sourceMetrics = await scanSourceFiles(sourcePaths, repo, maxFiles, maxBytes);

  const latestRelease: LatestRelease | null = release?.tag_name
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
      lines_of_code: sourceMetrics.linesOfCode,
      lines_of_code_is_estimate: true,
      source_files_total: sourcePaths.length,
      source_files_scanned: sourceMetrics.filesScanned,
      bytes_scanned: sourceMetrics.bytesScanned,
      test_suites_estimate: testPaths.length,
      test_cases_estimate: sourceMetrics.testCases,
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
