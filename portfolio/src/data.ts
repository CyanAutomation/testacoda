export interface PortfolioRepository {
  name: string;
  full_name?: string;
  owner?: { login?: string };
  description?: string | null;
  category?: string;
  topics?: string[];
  private?: boolean;
  archived?: boolean;
  default_branch?: string;
  html_url?: string;
  homepage?: string | null;
  language?: string | null;
}

export interface SourceTreeEntry {
  type: string;
  path: string;
  size?: number;
}

export interface ProjectMetrics {
  pushed_at?: string;
  sha?: string;
  time?: number;
  languages?: Record<string, number>;
  release?: string | null;
  releasePublishedAt?: string | null;
  loc?: number | null;
  tests?: number | null;
  scanned?: number;
  partial?: boolean;
  testfiles?: number | null;
  paths?: string[];
}

export interface PortfolioSnapshot {
  updatedAt?: string;
  repos: PortfolioRepository[];
  projects?: Record<string, ProjectMetrics>;
}

export interface SnapshotLoad<T extends PortfolioRepository> {
  snapshot: PortfolioSnapshot | null;
  repos: T[];
  message: string;
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export const isSource = (path: string): boolean =>
  /\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|c|cpp|h|cs|rb|php|sh|vue|svelte|css|scss|html|sql)$/i.test(path) &&
  !/(^|\/)(node_modules|vendor|dist|build|coverage|\.next|\.git|generated)(\/|$)/.test(path) &&
  !/(\.min\.|\.d\.ts$)/.test(path);

export const isTest = (path: string): boolean =>
  /(?:^|\/)(?:tests?|__tests__|playwright)(?:\/|$)|(?:\.test\.|\.spec\.|_test\.go$|(?:^|\/)test_[^/]+\.py$)/i.test(path);

export function selectFiles(
  tree: SourceTreeEntry[],
  limit = 25,
  maxBytes = 1_000_000
): { files: SourceTreeEntry[]; partial: boolean } {
  let size = 0;
  const all = tree.filter((file) => file.type === "blob" && isSource(file.path));
  const files = all.filter((file) => {
    if (!Number.isFinite(file.size) || file.size === undefined || file.size > 100_000 || size + file.size > maxBytes) {
      return false;
    }
    size += file.size;
    return true;
  }).slice(0, limit);
  return { files, partial: files.length < all.length };
}

export function countSource(text: string, test: boolean): { lines: number; tests: number } {
  return {
    lines: text.split("\n").filter((line) => line.trim()).length,
    tests: test
      ? (text.match(/\b(?:it|test)(?:\.(?:only|skip|todo))?\s*\(|\bdef\s+test_\w+\s*\(|\bfunc\s+Test\w+\s*\(/g) || []).length
      : 0
  };
}

export function filterProjects<T extends PortfolioRepository>(
  repos: T[],
  query: string,
  category: string
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  return repos.filter((repo) =>
    (!category || repo.category === category) &&
    (!normalizedQuery || [repo.name, repo.description, ...(repo.topics || [])]
      .some((value) => (value || "").toLowerCase().includes(normalizedQuery)))
  );
}

export const encodePath = (path: string): string => path.split("/").map(encodeURIComponent).join("/");

export function formatReleaseDate(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export const isWebUrl = (value: unknown): value is string =>
  typeof value === "string" && /^https?:\/\//i.test(value);

interface SnapshotResponse {
  repos: PortfolioRepository[];
  updatedAt?: string;
  projects?: Record<string, ProjectMetrics>;
}

function isSnapshotResponse(value: unknown): value is SnapshotResponse {
  return typeof value === "object" && value !== null &&
    Array.isArray((value as { repos?: unknown }).repos);
}

export async function loadSnapshot<T extends PortfolioRepository = PortfolioRepository>(
  fetcher: Fetcher,
  existing: T[] = []
): Promise<SnapshotLoad<T>> {
  try {
    const response = await fetcher("/api/snapshot", { cache: "no-store" });
    if (!response.ok) throw new Error("Snapshot unavailable");
    const data: unknown = await response.json();
    if (!isSnapshotResponse(data)) throw new Error("Invalid snapshot");
    return {
      snapshot: data,
      repos: data.repos as T[],
      message: "GitHub snapshot updated " + new Date(data.updatedAt || "").toLocaleString("en-GB")
    };
  } catch {
    if (existing.length) {
      return {
        snapshot: null,
        repos: existing,
        message: "Shared data unavailable; showing previously loaded projects."
      };
    }
    try {
      const response = await fetcher("/repos.json");
      if (!response.ok) throw new Error("Fallback unavailable");
      const repos: unknown = await response.json();
      if (!Array.isArray(repos)) throw new Error("Invalid fallback");
      return {
        snapshot: null,
        repos: repos as T[],
        message: "Shared data unavailable; showing bundled snapshot."
      };
    } catch {
      return {
        snapshot: null,
        repos: [],
        message: "Project data unavailable. Please try refreshing."
      };
    }
  }
}
