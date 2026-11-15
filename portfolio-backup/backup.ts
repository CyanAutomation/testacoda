declare global {
  interface Window {
    TESTACODA_API_BASE?: string;
  }
}

interface DisplayProject {
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing backup portfolio element #${id}`);
  return found as T;
}

const OWNER = "CyanAutomation";
const API_BASE = window.TESTACODA_API_BASE || "";
const state: { projects: DisplayProject[]; index: number } = { projects: [], index: 0 };

function compact(value: unknown): string {
  const number = Number(value || 0);
  return number >= 1_000_000 ? `${(number / 1_000_000).toFixed(1)}m` :
    number >= 1_000 ? `${(number / 1_000).toFixed(1)}k` : String(number);
}

function projectShape(value: unknown): DisplayProject {
  const item = isRecord(value) ? value : {};
  const scan = isRecord(item.scan) ? item.scan : item;
  const repo = isRecord(scan.repo) && typeof scan.repo.full_name === "string" ? scan.repo : item;
  const metrics = isRecord(scan.metrics) ? scan.metrics : isRecord(item.metrics) ? item.metrics : {};
  const maturity = isRecord(scan.maturity) ? scan.maturity : isRecord(item.maturity) ? item.maturity : {};
  const fullName = typeof repo.full_name === "string"
    ? repo.full_name
    : typeof item.full_name === "string" ? item.full_name : "";
  const rawName = typeof repo.name === "string" ? repo.name : fullName.split("/").pop();
  const release = isRecord(metrics.latest_release) ? metrics.latest_release : null;
  const score = typeof maturity.score === "number" ? maturity.score : undefined;
  return {
    name: rawName || "Repository",
    fullName,
    description: typeof repo.description === "string" ? repo.description : "A public project by CyanAutomation.",
    url: typeof repo.html_url === "string" && /^https?:\/\//i.test(repo.html_url)
      ? repo.html_url
      : `https://github.com/${OWNER}`,
    language: isRecord(metrics.languages)
      ? Object.keys(metrics.languages)[0] || (typeof repo.language === "string" ? repo.language : "—")
      : typeof repo.language === "string" ? repo.language : "—",
    stars: typeof repo.stars === "number" || typeof repo.stars === "string"
      ? repo.stars
      : typeof repo.stargazers_count === "number" ? repo.stargazers_count : 0,
    loc: typeof metrics.lines_of_code === "number" ? metrics.lines_of_code : undefined,
    tests: typeof metrics.test_cases_estimate === "number" ? metrics.test_cases_estimate : undefined,
    release: typeof release?.tag === "string" ? release.tag : "—",
    maturity: typeof maturity.label === "string"
      ? maturity.label
      : score === undefined ? "Not scanned" : `${score}%`,
    updated: typeof repo.pushed_at === "string"
      ? repo.pushed_at
      : typeof repo.updated_at === "string" ? repo.updated_at : ""
  };
}

async function loadProjects(): Promise<DisplayProject[]> {
  if (API_BASE) {
    try {
      const response = await fetch(`${API_BASE.replace(/\/$/, "")}/v1/repos?owner=${encodeURIComponent(OWNER)}`);
      if (!response.ok) throw new Error("Testacoda unavailable");
      const data: unknown = await response.json();
      if (isRecord(data) && Array.isArray(data.repositories) && data.repositories.length) {
        return data.repositories.map(projectShape);
      }
    } catch {
      element("status").textContent = "Using GitHub fallback";
    }
  }

  const response = await fetch(`https://api.github.com/users/${OWNER}/repos?type=public&sort=updated&per_page=100`);
  if (!response.ok) throw new Error("Could not load public GitHub repositories");
  const result: unknown = await response.json();
  if (!Array.isArray(result)) throw new Error("Could not load public GitHub repositories");
  return result.filter((repo) => isRecord(repo) && !repo.private).map(projectShape);
}

function render(): void {
  const project = state.projects[state.index];
  if (!project) return;
  element("counter").textContent = `${String(state.index + 1).padStart(2, "0")} / ${String(state.projects.length).padStart(2, "0")}`;
  element("name").textContent = project.name;
  element("description").textContent = project.description;
  element("preview-label").textContent = project.fullName || project.name;
  element("preview-stars").textContent = compact(project.stars);
  element("preview-language").textContent = project.language;
  element("preview-health").textContent = project.maturity;
  element("loc").textContent = project.loc === undefined ? "—" : compact(project.loc);
  element("tests").textContent = project.tests === undefined ? "—" : compact(project.tests);
  element("release").textContent = project.release || "—";
  element("updated").textContent = project.updated ? new Date(project.updated).toLocaleDateString() : "—";
  element<HTMLAnchorElement>("repo-link").href = project.url;
  const chips = element("chips");
  chips.innerHTML = "";
  [project.language, `${compact(project.stars)} stars`, project.maturity].forEach((text) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = text;
    chips.append(chip);
  });
  element("position").textContent = project.fullName || "Public GitHub project";
  element<HTMLElement>("progress").style.width = `${(state.index + 1) * 100 / state.projects.length}%`;
}

function move(delta: number): void {
  if (!state.projects.length) return;
  state.index = (state.index + delta + state.projects.length) % state.projects.length;
  render();
}

element("prev").addEventListener("click", () => move(-1));
element("next").addEventListener("click", () => move(1));
document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
});

void loadProjects().then((projects) => {
  state.projects = projects;
  if (!projects.length) throw new Error("No public repositories were returned");
  element("status").textContent = API_BASE ? "GitHub + Testacoda" : "Live GitHub data";
  render();
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Could not load repositories";
  element("counter").textContent = "Portfolio is ready";
  element("name").textContent = "Could not load repositories";
  element("description").textContent = `${message}. Check your connection and try again.`;
  element("status").textContent = "GitHub API unavailable";
});

export {};
