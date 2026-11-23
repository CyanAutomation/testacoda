import {
  encodePath,
  formatReleaseDate,
  isWebUrl,
  isSource,
  type PortfolioRepository,
  type ProjectMetrics
} from "./data.ts";

interface RepositoryTree {
  sha?: string;
  tree?: Array<{ path: string; type: string }>;
}

type DisplayMetrics = ProjectMetrics & { noRelease?: boolean; errors?: string[] };

const languageColors = ["#ff6437", "#679ec7", "#bacb60", "#8a7aca", "#62bba6", "#dfa667"];

export interface RepositoryPresentation {
  category: string;
  position: string;
  title: string;
  description: string;
  archived: string;
  topics: string;
  sourceUrl: string;
  liveHidden: boolean;
  liveUrl?: string;
}

export interface LanguagePresentation {
  bar: string;
  list: string;
  note: string;
}

export interface MetricsPresentation {
  loc: string;
  locNote: string;
  tests: string;
  testNote: string;
  release: string;
  releaseNote: string;
  status: string;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] || character);
}

function screenshotPath(repoName: string, tree?: RepositoryTree): string | undefined {
  if (!tree?.sha) return undefined;
  if (repoName === "judokon") {
    return tree.tree?.find((file) => file.path.endsWith("/homepage-linux.png"))?.path;
  }
  if (repoName === "motioninocean") {
    return tree.tree?.find((file) => file.path === "screenshots/live-desktop-stream.png")?.path;
  }
  return undefined;
}

function diagramMarkup(repo: PortfolioRepository, tree?: RepositoryTree): string {
  const files = (tree?.tree || []).filter((file) => file.type === "blob");
  const directories = [...new Set(files.map((file) => file.path.split("/")[0])
    .filter((path) => !path.startsWith(".") && !path.includes(".")))].slice(0, 4);
  const displayDirectories = directories.length ? directories : ["Source files", "Documentation"];

  return `<div class="diagram"><div class="diagram-head">repository:// ${escapeHtml(repo.name)}</div>` +
    `<div class="node feature"><span>${escapeHtml(repo.name)}</span>` +
    `<small>${escapeHtml(repo.language || "SOURCE")}</small></div><div class="connector"></div>` +
    `<div class="branches">${displayDirectories.map((directory) =>
      `<div class="node"><span>${escapeHtml(directory)}/</span></div>`).join("")}</div>` +
    `<div class="code-list">${files.filter((file) => isSource(file.path))
      .slice(0, 4).map((file) => `<div><span>↳</span> ${escapeHtml(file.path)}</div>`).join("")}</div></div>`;
}

function screenshotMarkup(repoName: string, sha: string, path: string): string {
  return `<div class="screenshot-wrap"><div class="windowbar"><i></i><i></i><i></i><span>${escapeHtml(repoName)}</span></div>` +
    `<img src="https://raw.githubusercontent.com/CyanAutomation/${encodeURIComponent(repoName)}/` +
    `${encodeURIComponent(sha)}/${encodePath(path)}" alt="${escapeHtml(repoName)} app screenshot from its repository"></div>`;
}

export function visualMarkup(repo: PortfolioRepository, tree: RepositoryTree | undefined, index: number): string {
  const image = screenshotPath(repo.name, tree);
  const content = image && tree?.sha ? screenshotMarkup(repo.name, tree.sha, image) : diagramMarkup(repo, tree);
  const mode = image ? "REPOSITORY SCREENSHOT" : "PROJECT STRUCTURE";
  const branch = escapeHtml(repo.default_branch || "main");
  const name = escapeHtml(repo.full_name || `CyanAutomation/${repo.name}`);

  return `<div class="visual-caption"><span>${mode}</span><span>${branch}</span></div>` + content +
    `<div class="visual-caption"><span>${name}</span><span>OPEN SOURCE</span></div>` +
    `<span class="visual-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>`;
}

export function repositoryPresentation(
  repo: PortfolioRepository,
  index: number,
  total: number,
  fallbackCategory?: string
): RepositoryPresentation {
  const liveUrl = isWebUrl(repo.homepage) ? repo.homepage : undefined;
  return {
    category: repo.category || fallbackCategory || "SOFTWARE / EXPERIMENTS",
    position: String(index + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0"),
    title: repo.name,
    description: repo.description || "A public software project by CyanAutomation.",
    archived: repo.archived ? " / ARCHIVED" : "",
    topics: (repo.topics || []).slice(0, 4).map((topic) => "<span>" + escapeHtml(topic) + "</span>").join(""),
    sourceUrl: repo.html_url || "https://github.com/CyanAutomation/" + encodeURIComponent(repo.name),
    liveHidden: !liveUrl,
    liveUrl
  };
}

export function languagePresentation(
  languages: Record<string, number> | null | undefined,
  repo: PortfolioRepository
): LanguagePresentation {
  const entries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length && repo.language) entries.push([repo.language, 1]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  const bar = entries.map(([name, value], index) =>
    "<span style=\"width:" + (total ? value / total * 100 : 0) + "%;background:" +
    languageColors[index % languageColors.length] + "\" title=\"" + escapeHtml(name) + "\"></span>"
  ).join("");
  const list = entries.map(([name, value], index) =>
    "<span><i style=\"background:" + languageColors[index % languageColors.length] + "\"></i>" +
    escapeHtml(name) + " " +
    (languages && total ? (value / total * 100).toFixed(1) + "%" : "") + "</span>"
  ).join("");
  return { bar, list, note: languages ? "BY SOURCE BYTES" : "" };
}

export function keyboardDirection(key: string, targetTagName?: string): -1 | 0 | 1 {
  if (["INPUT", "TEXTAREA", "SELECT"].includes((targetTagName || "").toUpperCase())) return 0;
  if (key === "ArrowLeft") return -1;
  if (key === "ArrowRight") return 1;
  return 0;
}

export function swipeDirection(
  start: [number, number] | null,
  end?: [number, number]
): -1 | 0 | 1 {
  if (!start || !end) return 0;
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  if (Math.abs(deltaX) <= 70 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return 0;
  return deltaX > 0 ? -1 : 1;
}

function formatCount(value: number | null | undefined, partial?: boolean): string {
  return value == null ? "—" : value.toLocaleString() + (partial ? "+" : "");
}

function releaseName(metrics: DisplayMetrics): string {
  return metrics.release || (metrics.noRelease ? "None published" : "—");
}

function releaseNote(metrics: DisplayMetrics): string {
  if (metrics.release) return formatReleaseDate(metrics.releasePublishedAt) || "Release date unavailable";
  return metrics.noRelease ? "No GitHub release" : "Release unavailable";
}

function metricStatus(metrics: DisplayMetrics, now: number): string {
  return metrics.errors?.join(" ") ||
    `Measured ${new Date(metrics.time || now).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ` +
    "non-empty source lines; test declarations are estimated.";
}

export function metricsPresentation(metrics: DisplayMetrics, now = Date.now()): MetricsPresentation {
  return {
    loc: formatCount(metrics.loc, metrics.partial),
    locNote: metrics.loc == null
      ? "Measurement unavailable"
      : `${metrics.partial ? "Partial scan · " : ""}${metrics.scanned || 0} source files`,
    tests: formatCount(metrics.tests, metrics.partial),
    testNote: metrics.testfiles == null ? "Source scan estimate" : `${metrics.testfiles} test files · estimate`,
    release: releaseName(metrics),
    releaseNote: releaseNote(metrics),
    status: metricStatus(metrics, now)
  };
}

export function diagramFallbackMarkup(repo: PortfolioRepository, tree?: RepositoryTree): string {
  return diagramMarkup(repo, tree);
}
