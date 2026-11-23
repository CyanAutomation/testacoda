import {
  filterProjects,
  loadSnapshot,
  type PortfolioRepository,
  type PortfolioSnapshot,
  type ProjectMetrics
} from "./data.ts";
import {
  diagramFallbackMarkup,
  keyboardDirection,
  languagePresentation,
  metricsPresentation,
  repositoryPresentation,
  swipeDirection,
  visualMarkup
} from "./presentation.ts";

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

function visual(repo: Repository): void {
  const tree = trees[repo.name];
  $("visual").innerHTML = visualMarkup(repo, tree, index);

  const imageElement = $("visual").querySelector("img");
  if (imageElement) {
    imageElement.onerror = () => {
      const wrapper = imageElement.closest(".screenshot-wrap");
      if (wrapper) wrapper.outerHTML = diagramFallbackMarkup(repo, tree);
      const caption = $("visual").querySelector(".visual-caption span");
      if (caption) caption.textContent = "PROJECT STRUCTURE";
    };
  }
}

function languagePaint(languages: Record<string, number> | null | undefined, repo: Repository): void {
  const presentation = languagePresentation(languages, repo);
  $("language-bar").innerHTML = presentation.bar;
  $("language-list").innerHTML = presentation.list;
  $("langnote").textContent = presentation.note;
}

function showMetrics(metrics: DisplayMetrics, repo: Repository): void {
  const presentation = metricsPresentation(metrics);
  $("loc").textContent = presentation.loc;
  $("locnote").textContent = presentation.locNote;
  $("tests").textContent = presentation.tests;
  $("testnote").textContent = presentation.testNote;
  $("release").textContent = presentation.release;
  $("releasenote").textContent = presentation.releaseNote;
  languagePaint(metrics.languages, repo);
  $("metricstatus").textContent = presentation.status;
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
  paintRepository(repo);
  showMetricsLoading();
  const metrics = await getMetrics(repo);
  if (renderSerial === serial) {
    showMetrics(metrics, repo);
    visual(repo);
  }
}

function paintRepository(repo: Repository): void {
  const presentation = repositoryPresentation(repo, index, repos.length, groups[repo.name]);
  paintRepositoryDetails(presentation);
  paintRepositoryLinks(presentation);
  visual(repo);
  languagePaint(null, repo);
}

function paintRepositoryDetails(presentation: ReturnType<typeof repositoryPresentation>): void {
  paintNav();
  $("category").textContent = presentation.category;
  $("position").textContent = presentation.position;
  $("title").textContent = presentation.title;
  $("description").textContent = presentation.description;
  $("archived").textContent = presentation.archived;
  $("topics").innerHTML = presentation.topics;
}

function paintRepositoryLinks(presentation: ReturnType<typeof repositoryPresentation>): void {
  $("source").setAttribute("href", presentation.sourceUrl);
  const live = $("live");
  live.hidden = presentation.liveHidden;
  if (presentation.liveUrl) live.setAttribute("href", presentation.liveUrl);
}

function showMetricsLoading(): void {
  $("loc").textContent = "—";
  $("tests").textContent = "—";
  $("release").textContent = "—";
  $("locnote").textContent = "Measuring source…";
  $("testnote").textContent = "Scanning declarations…";
  $("releasenote").textContent = "Checking GitHub";
  $("metricstatus").textContent = "Loading shared project metrics…";
}

function move(delta: number): void {
  if (!repos.length) return;
  index = (index + delta + repos.length) % repos.length;
  void render();
}

$("prev").onclick = () => move(-1);
$("next").onclick = () => move(1);
function selectProjectFromEvent(event: Event): boolean {
  if (!(event.target instanceof Element)) return false;
  const button = event.target.closest<HTMLButtonElement>("button[data-index]");
  if (!button) return false;
  index = Number(button.dataset.index);
  void render();
  return true;
}

$("project-nav").onclick = (event) => {
  selectProjectFromEvent(event);
};
document.addEventListener("keydown", (event) => {
  const targetTag = event.target instanceof Element ? event.target.tagName : undefined;
  const direction = keyboardDirection(event.key, targetTag);
  if (!direction) return;
  event.preventDefault();
  move(direction);
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
  const direction = swipeDirection(touch, [firstTouch.clientX, firstTouch.clientY]);
  if (direction) move(direction);
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
  if (selectProjectFromEvent(event)) $("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
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
