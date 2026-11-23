export interface DisplayProject {
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  stars: number | string;
  loc?: number;
  tests?: number;
  release: string;
  maturity: string;
  updated: string;
}

export interface BackupPresentation {
  counter: string;
  name: string;
  description: string;
  previewLabel: string;
  stars: string;
  language: string;
  maturity: string;
  loc: string;
  tests: string;
  release: string;
  updated: string;
  url: string;
  chips: string[];
  position: string;
  progress: string;
}

type DataRecord = Record<string, unknown>;

const OWNER = "CyanAutomation";

export type BackupFetcher = (input: string, init?: RequestInit) => Promise<Response>;

function asRecord(value: unknown): DataRecord | undefined {
  return typeof value === "object" && value !== null ? value as DataRecord : undefined;
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string");
}

function selectRepo(item: DataRecord, scan: DataRecord): DataRecord {
  const scannedRepo = asRecord(scan.repo);
  return scannedRepo && typeof scannedRepo.full_name === "string" ? scannedRepo : item;
}

function selectMetrics(item: DataRecord, scan: DataRecord): DataRecord {
  return asRecord(scan.metrics) || asRecord(item.metrics) || {};
}

function selectMaturity(item: DataRecord, scan: DataRecord): DataRecord {
  return asRecord(scan.maturity) || asRecord(item.maturity) || {};
}

function projectLanguage(metrics: DataRecord, repo: DataRecord): string {
  const languages = asRecord(metrics.languages);
  if (languages) return Object.keys(languages)[0] || (typeof repo.language === "string" ? repo.language : "—");
  return typeof repo.language === "string" ? repo.language : "—";
}

function projectStars(repo: DataRecord): number | string {
  if (typeof repo.stars === "number" || typeof repo.stars === "string") return repo.stars;
  return typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0;
}

function projectRelease(metrics: DataRecord): string {
  const release = asRecord(metrics.latest_release);
  return typeof release?.tag === "string" ? release.tag : "—";
}

function projectMaturity(maturity: DataRecord): string {
  if (typeof maturity.label === "string") return maturity.label;
  return typeof maturity.score === "number" ? `${maturity.score}%` : "Not scanned";
}

function compact(value: unknown): string {
  const number = Number(value || 0);
  return number >= 1_000_000 ? `${(number / 1_000_000).toFixed(1)}m` :
    number >= 1_000 ? `${(number / 1_000).toFixed(1)}k` : String(number);
}

export function projectShape(value: unknown): DisplayProject {
  const item = asRecord(value) || {};
  const scan = asRecord(item.scan) || item;
  const repo = selectRepo(item, scan);
  const metrics = selectMetrics(item, scan);
  const maturity = selectMaturity(item, scan);
  const fullName = firstString(repo.full_name, item.full_name) || "";
  const rawName = typeof repo.name === "string" ? repo.name : fullName.split("/").pop();
  const name = rawName || "Repository";
  const url = firstString(repo.html_url);
  const rawLoc = metrics.lines_of_code;
  const rawTests = metrics.test_cases_estimate;

  return {
    name,
    fullName,
    description: typeof repo.description === "string" ? repo.description : "A public project by CyanAutomation.",
    url: url && /^https?:\/\//i.test(url) ? url : `https://github.com/${OWNER}`,
    language: projectLanguage(metrics, repo),
    stars: projectStars(repo),
    loc: typeof rawLoc === "number" ? rawLoc : undefined,
    tests: typeof rawTests === "number" ? rawTests : undefined,
    release: projectRelease(metrics),
    maturity: projectMaturity(maturity),
    updated: firstString(repo.pushed_at, repo.updated_at) || ""
  };
}

export function backupPresentation(project: DisplayProject, index: number, total: number): BackupPresentation {
  const stars = compact(project.stars);
  return {
    counter: `${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}`,
    name: project.name,
    description: project.description,
    previewLabel: project.fullName || project.name,
    stars,
    language: project.language,
    maturity: project.maturity,
    loc: project.loc === undefined ? "—" : compact(project.loc),
    tests: project.tests === undefined ? "—" : compact(project.tests),
    release: project.release || "—",
    updated: project.updated ? new Date(project.updated).toLocaleDateString() : "—",
    url: project.url,
    chips: [project.language, `${stars} stars`, project.maturity],
    position: project.fullName || "Public GitHub project",
    progress: `${(index + 1) * 100 / total}%`
  };
}

async function fetchTestacodaProjects(
  apiBase: string,
  fetcher: BackupFetcher,
  onServiceUnavailable: () => void
): Promise<DisplayProject[] | null> {
  if (!apiBase) return null;
  try {
    const response = await fetcher(`${apiBase.replace(/\/$/, "")}/v1/repos?owner=${encodeURIComponent(OWNER)}`);
    if (!response.ok) throw new Error("Testacoda unavailable");
    const data: unknown = await response.json();
    if (isRepositoryList(data)) return data.repositories.map(projectShape);
  } catch {
    onServiceUnavailable();
  }
  return null;
}

function isRepositoryList(value: unknown): value is { repositories: unknown[] } {
  const data = asRecord(value);
  return Boolean(data && Array.isArray(data.repositories) && data.repositories.length);
}

async function fetchGitHubProjects(fetcher: BackupFetcher): Promise<DisplayProject[]> {
  const response = await fetcher(`https://api.github.com/users/${OWNER}/repos?type=public&sort=updated&per_page=100`);
  if (!response.ok) throw new Error("Could not load public GitHub repositories");
  const result: unknown = await response.json();
  if (!Array.isArray(result)) throw new Error("Could not load public GitHub repositories");
  return result.filter((repo) => {
    const record = asRecord(repo);
    return record && !record.private;
  }).map(projectShape);
}

export async function loadProjects(
  apiBase: string,
  fetcher: BackupFetcher = fetch,
  onServiceUnavailable: () => void = () => {}
): Promise<DisplayProject[]> {
  const sharedProjects = await fetchTestacodaProjects(apiBase, fetcher, onServiceUnavailable);
  return sharedProjects || await fetchGitHubProjects(fetcher);
}
