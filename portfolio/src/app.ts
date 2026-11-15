import {
  encodePath,
  filterProjects,
  formatReleaseDate,
  isSource,
  isWebUrl,
  loadSnapshot,
  type PortfolioRepository,
  type PortfolioSnapshot,
  type ProjectMetrics
} from "./data.ts";

interface Repository extends PortfolioRepository {
  category?: string;
}

interface RepositoryTree {
  sha?: string;
  tree?: Array<{ path: string; type: string }>;
}

type DisplayMetrics = ProjectMetrics & { noRelease?: boolean; errors?: string[] };

const OWNER = "CyanAutomation";
const priority = [
  "kaseki-agent", "matmetrics", "tako-bako", "judokon", "gogomio", "budokon",
  "judokon-2600", "yokaiba", "merm8-splash", "merm8", "crudmapper"
];
const groups: Record<string, string> = {
  "kaseki-agent": "AUTOMATION / DEVELOPER TOOLS",
  matmetrics: "JUDO / TRAINING",
  judokon: "JUDO / CARD GAME",
  "judokon-2600": "JUDO / TERMINAL GAME",
  "tako-bako": "JUDO / LOGIC PUZZLES",
  yokaiba: "JUDO / PUZZLE API",
  budokon: "JUDO / DATA API",
  gogomio: "HARDWARE / CAMERA STREAMING",
  motioninocean: "HARDWARE / CAMERA STREAMING"
};
const colors = ["#ff6437", "#679ec7", "#bacb60", "#8a7aca", "#62bba6", "#dfa667"];

const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing portfolio element #${id}`);
  return element as T;
};

const escapeHtml = (value: unknown): string => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character] || character);

let repos: Repository[] = [];
let allRepos: Repository[] = [];
let trees: Record<string, RepositoryTree> = {};
let snapshot: PortfolioSnapshot | null = null;
let index = 0;
let serial = 0;
let touch: [number, number] | null = null;

function sort(list: Repository[]): Repository[] {
  return list
    .filter((repo) => !repo.private && repo.owner?.login === OWNER)
    .sort((a, b) => {
      const aPriority = priority.indexOf(a.name);
      const bPriority = priority.indexOf(b.name);
      return (aPriority < 0 ? 100 : aPriority) - (bPriority < 0 ? 100 : bPriority) ||
        a.name.localeCompare(b.name);
    });
}

function paintNav(): void {
  $("project-nav").innerHTML = repos.map((repo, i) =>
    `<button data-index="${i}" class="${i === index ? "active" : ""}" ` +
    `aria-current="${i === index ? "true" : "false"}"><small>${String(i + 1).padStart(2, "0")}</small>` +
    `${escapeHtml(repo.name)}</button>`
  ).join("");
  $("total").textContent = `${repos.length} PUBLIC REPOSITORIES`;
}

function diagram(repo: Repository, tree?: RepositoryTree): string {
  const files = (tree?.tree || []).filter((file) => file.type === "blob");
  let directories = [...new Set(files.map((file) => file.path.split("/")[0])
    .filter((path) => !path.startsWith(".") && !path.includes(".")))].slice(0, 4);
  if (!directories.length) directories = ["Source files", "Documentation"];
  return `<div class="diagram"><div class="diagram-head">repository:// ${escapeHtml(repo.name)}</div>` +
    `<div class="node feature"><span>${escapeHtml(repo.name)}</span>` +
    `<small>${escapeHtml(repo.language || "SOURCE")}</small></div><div class="connector"></div>` +
    `<div class="branches">${directories.map((directory) =>
      `<div class="node"><span>${escapeHtml(directory)}/</span></div>`).join("")}</div>` +
    `<div class="code-list">${files.filter((file) => isSource(file.path))
      .slice(0, 4).map((file) => `<div><span>↳</span> ${escapeHtml(file.path)}</div>`).join("")}</div></div>`;
}

function visual(repo: Repository): void {
  let image: string | undefined;
  const tree = trees[repo.name];
  if (tree?.sha && repo.name === "judokon") {
    image = tree.tree?.find((file) => file.path.endsWith("/homepage-linux.png"))?.path;
  }
  if (tree?.sha && repo.name === "motioninocean") {
    image = tree.tree?.find((file) => file.path === "screenshots/live-desktop-stream.png")?.path;
  }

  const branch = repo.default_branch || "main";
  $("visual").innerHTML = `<div class="visual-caption"><span>${image ? "REPOSITORY SCREENSHOT" : "PROJECT STRUCTURE"}</span>` +
    `<span>${escapeHtml(branch)}</span></div>` +
    (image
      ? `<div class="screenshot-wrap"><div class="windowbar"><i></i><i></i><i></i><span>${escapeHtml(repo.name)}</span></div>` +
        `<img src="https://raw.githubusercontent.com/${OWNER}/${encodeURIComponent(repo.name)}/` +
        `${encodeURIComponent(tree?.sha || "")}/${encodePath(image)}" alt="${escapeHtml(repo.name)} app screenshot from its repository"></div>`
      : diagram(repo, tree)) +
    `<div class="visual-caption"><span>${escapeHtml(repo.full_name || `${OWNER}/${repo.name}`)}</span>` +
    `<span>OPEN SOURCE</span></div><span class="visual-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>`;

  const imageElement = $("visual").querySelector("img");
  if (imageElement) {
    imageElement.onerror = () => {
      const wrapper = imageElement.closest(".screenshot-wrap");
      if (wrapper) wrapper.outerHTML = diagram(repo, tree);
      const caption = $("visual").querySelector(".visual-caption span");
      if (caption) caption.textContent = "PROJECT STRUCTURE";
    };
  }
}

function languagePaint(languages: Record<string, number> | null | undefined, repo: Repository): void {
  let entries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
  let total = entries.reduce((sum, entry) => sum + entry[1], 0);
  if (!entries.length && repo.language) {
    entries = [[repo.language, 1]];
    total = 1;
  }
  $("language-bar").innerHTML = entries.map(([name, value], i) =>
    `<span style="width:${total ? value / total * 100 : 0}%;background:${colors[i % colors.length]}" title="${escapeHtml(name)}"></span>`
  ).join("");
  $("language-list").innerHTML = entries.map(([name, value], i) =>
    `<span><i style="background:${colors[i % colors.length]}"></i>${escapeHtml(name)} ` +
    `${languages && total ? `${(value / total * 100).toFixed(1)}%` : ""}</span>`
  ).join("");
  $("langnote").textContent = languages ? "BY SOURCE BYTES" : "";
}

function showMetrics(metrics: DisplayMetrics, repo: Repository): void {
  $("loc").textContent = metrics.loc == null ? "—" :
    metrics.loc.toLocaleString() + (metrics.partial ? "+" : "");
  $("locnote").textContent = metrics.loc == null ? "Measurement unavailable" :
    (metrics.partial ? "Partial scan · " : "") + `${metrics.scanned || 0} source files`;
  $("tests").textContent = metrics.tests == null ? "—" :
    metrics.tests.toLocaleString() + (metrics.partial ? "+" : "");
  $("testnote").textContent = metrics.testfiles == null ? "Source scan estimate" :
    `${metrics.testfiles} test files · estimate`;
  $("release").textContent = metrics.release || (metrics.noRelease ? "None published" : "—");
  $("releasenote").textContent = metrics.release
    ? formatReleaseDate(metrics.releasePublishedAt) || "Release date unavailable"
    : metrics.noRelease ? "No GitHub release" : "Release unavailable";
  languagePaint(metrics.languages, repo);
  $("metricstatus").textContent = metrics.errors?.join(" ") ||
    `Measured ${new Date(metrics.time || Date.now()).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · ` +
    "non-empty source lines; test declarations are estimated.";
}

async function getMetrics(repo: Repository): Promise<DisplayMetrics> {
  const metrics = snapshot?.projects?.[repo.name];
  if (!metrics) {
    return {
      time: Date.now(),
      loc: null,
      tests: null,
      scanned: 0,
      testfiles: null,
      errors: ["Metrics pending next scheduled refresh."]
    };
  }
  trees[repo.name] = {
    sha: metrics.sha,
    tree: (metrics.paths || []).map((path) => ({ path, type: "blob" }))
  };
  return { ...metrics, noRelease: !metrics.release };
}

async function render(): Promise<void> {
  if (!repos.length) {
    $("title").textContent = "No public projects found";
    return;
  }
  const renderSerial = ++serial;
  const repo = repos[index];
  paintNav();
  $("category").textContent = repo.category || groups[repo.name] || "SOFTWARE / EXPERIMENTS";
  $("position").textContent = `${String(index + 1).padStart(2, "0")} / ${String(repos.length).padStart(2, "0")}`;
  $("title").textContent = repo.name;
  $("description").textContent = repo.description || "A public software project by CyanAutomation.";
  $("archived").textContent = repo.archived ? " / ARCHIVED" : "";
  $("topics").innerHTML = (repo.topics || []).slice(0, 4)
    .map((topic) => `<span>${escapeHtml(topic)}</span>`).join("");
  $("source").setAttribute("href", repo.html_url || `https://github.com/${OWNER}/${encodeURIComponent(repo.name)}`);
  const live = $("live");
  live.hidden = !isWebUrl(repo.homepage);
  if (isWebUrl(repo.homepage)) live.setAttribute("href", repo.homepage);
  visual(repo);
  languagePaint(null, repo);
  $("loc").textContent = "—";
  $("tests").textContent = "—";
  $("release").textContent = "—";
  $("locnote").textContent = "Measuring source…";
  $("testnote").textContent = "Scanning declarations…";
  $("releasenote").textContent = "Checking GitHub";
  $("metricstatus").textContent = "Loading shared project metrics…";
  const metrics = await getMetrics(repo);
  if (renderSerial === serial) {
    showMetrics(metrics, repo);
    visual(repo);
  }
}

function move(delta: number): void {
  if (!repos.length) return;
  index = (index + delta + repos.length) % repos.length;
  void render();
}

$("prev").onclick = () => move(-1);
$("next").onclick = () => move(1);
$("project-nav").onclick = (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>("button[data-index]");
  if (!button) return;
  index = Number(button.dataset.index);
  void render();
};
document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement ||
      event.target instanceof HTMLSelectElement) return;
  if (event.key === "ArrowLeft") {
    event.preventDefault();
    move(-1);
  }
  if (event.key === "ArrowRight") {
    event.preventDefault();
    move(1);
  }
});
$("stage").addEventListener("touchstart", (event) => {
  const touchEvent = event as TouchEvent;
  const firstTouch = touchEvent.changedTouches[0];
  if (firstTouch) touch = [firstTouch.clientX, firstTouch.clientY];
}, { passive: true });
$("stage").addEventListener("touchend", (event) => {
  const touchEvent = event as TouchEvent;
  const firstTouch = touchEvent.changedTouches[0];
  if (!touch || !firstTouch) return;
  const deltaX = firstTouch.clientX - touch[0];
  const deltaY = firstTouch.clientY - touch[1];
  if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) move(deltaX > 0 ? -1 : 1);
  touch = null;
}, { passive: true });

function paintGrid(): void {
  $("grid").innerHTML = repos.map((repo, i) =>
    `<button class="project-card" data-index="${i}"><span>${escapeHtml(repo.category || "SOFTWARE / EXPERIMENTS")}</span>` +
    `<strong>${escapeHtml(repo.name)}</strong><p>${escapeHtml(repo.description || "A public software project by CyanAutomation.")}</p>` +
    "<small>View project →</small></button>"
  ).join("");
}

function applyFilters(): void {
  const selectedName = repos[index]?.name;
  repos = filterProjects(allRepos, $<HTMLInputElement>("search").value, $<HTMLSelectElement>("filter").value);
  index = Math.max(0, repos.findIndex((repo) => repo.name === selectedName));
  $("empty").hidden = Boolean(repos.length);
  $("empty").textContent = allRepos.length
    ? "No projects match your search."
    : "No project data is available.";
  $("gallery").hidden = !repos.length;
  paintGrid();
  paintNav();
  if (repos.length) void render();
}

$("grid").onclick = (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest<HTMLButtonElement>("button[data-index]");
  if (!button) return;
  index = Number(button.dataset.index);
  void render();
  $("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
};
$("search").oninput = applyFilters;
$("filter").onchange = applyFilters;

async function refresh(): Promise<void> {
  const refreshButton = $<HTMLButtonElement>("refresh");
  refreshButton.disabled = true;
  try {
    const result = await loadSnapshot(fetch, allRepos);
    if (result.snapshot) snapshot = result.snapshot;
    allRepos = sort(result.repos).map((repo) => ({
      ...repo,
      category: groups[repo.name] || "SOFTWARE / EXPERIMENTS"
    }));
    $("sync").textContent = result.message;
  } finally {
    const select = $<HTMLSelectElement>("filter");
    const value = select.value;
    select.innerHTML = "<option value=\"\">All categories</option>" +
      [...new Set(allRepos.map((repo) => repo.category || "SOFTWARE / EXPERIMENTS"))]
        .sort()
        .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
        .join("");
    select.value = value;
    applyFilters();
    refreshButton.disabled = false;
  }
}

$("refresh").onclick = () => { void refresh(); };
void refresh();
