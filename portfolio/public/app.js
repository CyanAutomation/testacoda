// Generated from src/app.ts by npm run build.

// src/data.ts
var isSource = (path) => /\.(tsx?|jsx?|mjs|cjs|py|go|rs|java|c|cpp|h|cs|rb|php|sh|vue|svelte|css|scss|html|sql)$/i.test(path) && !/(^|\/)(node_modules|vendor|dist|build|coverage|\.next|\.git|generated)(\/|$)/.test(path) && !/(\.min\.|\.d\.ts$)/.test(path);
function filterProjects(repos2, query, category) {
  const normalizedQuery = query.trim().toLowerCase();
  return repos2.filter(
    (repo) => (!category || repo.category === category) && (!normalizedQuery || [repo.name, repo.description, ...repo.topics || []].some((value) => (value || "").toLowerCase().includes(normalizedQuery)))
  );
}
var encodePath = (path) => path.split("/").map(encodeURIComponent).join("/");
function formatReleaseDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
var isWebUrl = (value) => {
  if (typeof value !== "string" || !/^https?:\/\//i.test(value)) return false;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && Boolean(url.hostname);
  } catch {
    return false;
  }
};
function isSnapshotResponse(value) {
  return typeof value === "object" && value !== null && Array.isArray(value.repos);
}
async function loadSnapshot(fetcher, existing = []) {
  try {
    const response = await fetcher("/api/snapshot", { cache: "no-store" });
    if (!response.ok) throw new Error("Snapshot unavailable");
    const data = await response.json();
    if (!isSnapshotResponse(data)) throw new Error("Invalid snapshot");
    return {
      snapshot: data,
      repos: data.repos,
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
      const repos2 = await response.json();
      if (!Array.isArray(repos2)) throw new Error("Invalid fallback");
      return {
        snapshot: null,
        repos: repos2,
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

// src/presentation.ts
var languageColors = ["#ff6437", "#679ec7", "#bacb60", "#8a7aca", "#62bba6", "#dfa667"];
function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character] || character);
}
function screenshotPath(repoName, tree) {
  if (!tree?.sha) return void 0;
  if (repoName === "judokon") {
    return tree.tree?.find((file) => file.path.endsWith("/homepage-linux.png"))?.path;
  }
  if (repoName === "motioninocean") {
    return tree.tree?.find((file) => file.path === "screenshots/live-desktop-stream.png")?.path;
  }
  return void 0;
}
function diagramMarkup(repo, tree) {
  const files = (tree?.tree || []).filter((file) => file.type === "blob");
  const directories = [...new Set(files.map((file) => file.path.split("/")[0]).filter((path) => !path.startsWith(".") && !path.includes(".")))].slice(0, 4);
  const displayDirectories = directories.length ? directories : ["Source files", "Documentation"];
  return `<div class="diagram"><div class="diagram-head">repository:// ${escapeHtml(repo.name)}</div><div class="node feature"><span>${escapeHtml(repo.name)}</span><small>${escapeHtml(repo.language || "SOURCE")}</small></div><div class="connector"></div><div class="branches">${displayDirectories.map((directory) => `<div class="node"><span>${escapeHtml(directory)}/</span></div>`).join("")}</div><div class="code-list">${files.filter((file) => isSource(file.path)).slice(0, 4).map((file) => `<div><span>\u21B3</span> ${escapeHtml(file.path)}</div>`).join("")}</div></div>`;
}
function screenshotMarkup(repoName, sha, path) {
  return `<div class="screenshot-wrap"><div class="windowbar"><i></i><i></i><i></i><span>${escapeHtml(repoName)}</span></div><img src="https://raw.githubusercontent.com/CyanAutomation/${encodeURIComponent(repoName)}/${encodeURIComponent(sha)}/${encodePath(path)}" alt="${escapeHtml(repoName)} app screenshot from its repository"></div>`;
}
function visualMarkup(repo, tree, index2) {
  const image = screenshotPath(repo.name, tree);
  const content = image && tree?.sha ? screenshotMarkup(repo.name, tree.sha, image) : diagramMarkup(repo, tree);
  const mode = image ? "REPOSITORY SCREENSHOT" : "PROJECT STRUCTURE";
  const branch = escapeHtml(repo.default_branch || "main");
  const name = escapeHtml(repo.full_name || `CyanAutomation/${repo.name}`);
  return `<div class="visual-caption"><span>${mode}</span><span>${branch}</span></div>` + content + `<div class="visual-caption"><span>${name}</span><span>OPEN SOURCE</span></div><span class="visual-index" aria-hidden="true">${String(index2 + 1).padStart(2, "0")}</span>`;
}
function repositoryPresentation(repo, index2, total, fallbackCategory) {
  const liveUrl = isWebUrl(repo.homepage) ? repo.homepage : void 0;
  return {
    category: repo.category || fallbackCategory || "SOFTWARE / EXPERIMENTS",
    position: String(index2 + 1).padStart(2, "0") + " / " + String(total).padStart(2, "0"),
    title: repo.name,
    description: repo.description || "A public software project by CyanAutomation.",
    archived: repo.archived ? " / ARCHIVED" : "",
    topics: (repo.topics || []).slice(0, 4).map((topic) => "<span>" + escapeHtml(topic) + "</span>").join(""),
    sourceUrl: repo.html_url || "https://github.com/CyanAutomation/" + encodeURIComponent(repo.name),
    liveHidden: !liveUrl,
    liveUrl
  };
}
function languagePresentation(languages, repo) {
  const entries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length && repo.language) entries.push([repo.language, 1]);
  const total = entries.reduce((sum, entry) => sum + entry[1], 0);
  const bar = entries.map(
    ([name, value], index2) => '<span style="width:' + (total ? value / total * 100 : 0) + "%;background:" + languageColors[index2 % languageColors.length] + '" title="' + escapeHtml(name) + '"></span>'
  ).join("");
  const list = entries.map(
    ([name, value], index2) => '<span><i style="background:' + languageColors[index2 % languageColors.length] + '"></i>' + escapeHtml(name) + " " + (languages && total ? (value / total * 100).toFixed(1) + "%" : "") + "</span>"
  ).join("");
  return { bar, list, note: languages ? "BY SOURCE BYTES" : "" };
}
function keyboardDirection(key, targetTagName) {
  if (["INPUT", "TEXTAREA", "SELECT"].includes((targetTagName || "").toUpperCase())) return 0;
  if (key === "ArrowLeft") return -1;
  if (key === "ArrowRight") return 1;
  return 0;
}
function swipeDirection(start, end) {
  if (!start || !end) return 0;
  const deltaX = end[0] - start[0];
  const deltaY = end[1] - start[1];
  if (Math.abs(deltaX) <= 70 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.5) return 0;
  return deltaX > 0 ? -1 : 1;
}
function formatCount(value, partial) {
  return value == null ? "\u2014" : value.toLocaleString() + (partial ? "+" : "");
}
function releaseName(metrics) {
  return metrics.release || (metrics.noRelease ? "None published" : "\u2014");
}
function releaseNote(metrics) {
  if (metrics.release) return formatReleaseDate(metrics.releasePublishedAt) || "Release date unavailable";
  return metrics.noRelease ? "No GitHub release" : "Release unavailable";
}
function metricStatus(metrics, now) {
  return metrics.errors?.join(" ") || `Measured ${new Date(metrics.time || now).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} \xB7 non-empty source lines; test declarations are estimated.`;
}
function metricsPresentation(metrics, now = Date.now()) {
  return {
    loc: formatCount(metrics.loc, metrics.partial),
    locNote: metrics.loc == null ? "Measurement unavailable" : `${metrics.partial ? "Partial scan \xB7 " : ""}${metrics.scanned || 0} source files`,
    tests: formatCount(metrics.tests, metrics.partial),
    testNote: metrics.testfiles == null ? "Source scan estimate" : `${metrics.testfiles} test files \xB7 estimate`,
    release: releaseName(metrics),
    releaseNote: releaseNote(metrics),
    status: metricStatus(metrics, now)
  };
}
function diagramFallbackMarkup(repo, tree) {
  return diagramMarkup(repo, tree);
}

// src/app.ts
var OWNER = "CyanAutomation";
var priority = [
  "kaseki-agent",
  "matmetrics",
  "tako-bako",
  "judokon",
  "gogomio",
  "budokon",
  "judokon-2600",
  "yokaiba",
  "merm8-splash",
  "merm8",
  "crudmapper"
];
var groups = {
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
var $ = (id) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing portfolio element #${id}`);
  return element;
};
var escapeHtml2 = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
})[character] || character);
var repos = [];
var allRepos = [];
var trees = {};
var snapshot = null;
var index = 0;
var serial = 0;
var touch = null;
function sort(list) {
  return list.filter((repo) => !repo.private && repo.owner?.login === OWNER).sort((a, b) => {
    const aPriority = priority.indexOf(a.name);
    const bPriority = priority.indexOf(b.name);
    return (aPriority < 0 ? 100 : aPriority) - (bPriority < 0 ? 100 : bPriority) || a.name.localeCompare(b.name);
  });
}
function paintNav() {
  $("project-nav").innerHTML = repos.map(
    (repo, i) => `<button data-index="${i}" class="${i === index ? "active" : ""}" aria-current="${i === index ? "true" : "false"}"><small>${String(i + 1).padStart(2, "0")}</small>${escapeHtml2(repo.name)}</button>`
  ).join("");
  $("total").textContent = `${repos.length} PUBLIC REPOSITORIES`;
}
function visual(repo) {
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
function languagePaint(languages, repo) {
  const presentation = languagePresentation(languages, repo);
  $("language-bar").innerHTML = presentation.bar;
  $("language-list").innerHTML = presentation.list;
  $("langnote").textContent = presentation.note;
}
function showMetrics(metrics, repo) {
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
async function getMetrics(repo) {
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
async function render() {
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
function paintRepository(repo) {
  const presentation = repositoryPresentation(repo, index, repos.length, groups[repo.name]);
  paintRepositoryDetails(presentation);
  paintRepositoryLinks(presentation);
  visual(repo);
  languagePaint(null, repo);
}
function paintRepositoryDetails(presentation) {
  paintNav();
  $("category").textContent = presentation.category;
  $("position").textContent = presentation.position;
  $("title").textContent = presentation.title;
  $("description").textContent = presentation.description;
  $("archived").textContent = presentation.archived;
  $("topics").innerHTML = presentation.topics;
}
function paintRepositoryLinks(presentation) {
  $("source").setAttribute("href", presentation.sourceUrl);
  const live = $("live");
  live.hidden = presentation.liveHidden;
  if (presentation.liveUrl) live.setAttribute("href", presentation.liveUrl);
}
function showMetricsLoading() {
  $("loc").textContent = "\u2014";
  $("tests").textContent = "\u2014";
  $("release").textContent = "\u2014";
  $("locnote").textContent = "Measuring source\u2026";
  $("testnote").textContent = "Scanning declarations\u2026";
  $("releasenote").textContent = "Checking GitHub";
  $("metricstatus").textContent = "Loading shared project metrics\u2026";
}
function move(delta) {
  if (!repos.length) return;
  index = (index + delta + repos.length) % repos.length;
  void render();
}
$("prev").onclick = () => move(-1);
$("next").onclick = () => move(1);
function selectProjectFromEvent(event) {
  if (!(event.target instanceof Element)) return false;
  const button = event.target.closest("button[data-index]");
  if (!button) return false;
  index = Number(button.dataset.index);
  void render();
  return true;
}
$("project-nav").onclick = (event) => {
  selectProjectFromEvent(event);
};
document.addEventListener("keydown", (event) => {
  const targetTag = event.target instanceof Element ? event.target.tagName : void 0;
  const direction = keyboardDirection(event.key, targetTag);
  if (!direction) return;
  event.preventDefault();
  move(direction);
});
$("stage").addEventListener("touchstart", (event) => {
  const touchEvent = event;
  const firstTouch = touchEvent.changedTouches[0];
  if (firstTouch) touch = [firstTouch.clientX, firstTouch.clientY];
}, { passive: true });
$("stage").addEventListener("touchend", (event) => {
  const touchEvent = event;
  const firstTouch = touchEvent.changedTouches[0];
  if (!touch || !firstTouch) return;
  const direction = swipeDirection(touch, [firstTouch.clientX, firstTouch.clientY]);
  if (direction) move(direction);
  touch = null;
}, { passive: true });
function paintGrid() {
  $("grid").innerHTML = repos.map(
    (repo, i) => `<button class="project-card" data-index="${i}"><span>${escapeHtml2(repo.category || "SOFTWARE / EXPERIMENTS")}</span><strong>${escapeHtml2(repo.name)}</strong><p>${escapeHtml2(repo.description || "A public software project by CyanAutomation.")}</p><small>View project \u2192</small></button>`
  ).join("");
}
function applyFilters() {
  const selectedName = repos[index]?.name;
  repos = filterProjects(allRepos, $("search").value, $("filter").value);
  index = Math.max(0, repos.findIndex((repo) => repo.name === selectedName));
  $("empty").hidden = Boolean(repos.length);
  $("empty").textContent = allRepos.length ? "No projects match your search." : "No project data is available.";
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
async function refresh() {
  const refreshButton = $("refresh");
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
    const select = $("filter");
    const value = select.value;
    select.innerHTML = '<option value="">All categories</option>' + [...new Set(allRepos.map((repo) => repo.category || "SOFTWARE / EXPERIMENTS"))].sort().map((category) => `<option value="${escapeHtml2(category)}">${escapeHtml2(category)}</option>`).join("");
    select.value = value;
    applyFilters();
    refreshButton.disabled = false;
  }
}
$("refresh").onclick = () => {
  void refresh();
};
void refresh();
