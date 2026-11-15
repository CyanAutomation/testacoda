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
var isWebUrl = (value) => typeof value === "string" && /^https?:\/\//i.test(value);
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
var colors = ["#ff6437", "#679ec7", "#bacb60", "#8a7aca", "#62bba6", "#dfa667"];
var $ = (id) => {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing portfolio element #${id}`);
  return element;
};
var escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
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
    (repo, i) => `<button data-index="${i}" class="${i === index ? "active" : ""}" aria-current="${i === index ? "true" : "false"}"><small>${String(i + 1).padStart(2, "0")}</small>${escapeHtml(repo.name)}</button>`
  ).join("");
  $("total").textContent = `${repos.length} PUBLIC REPOSITORIES`;
}
function diagram(repo, tree) {
  const files = (tree?.tree || []).filter((file) => file.type === "blob");
  let directories = [...new Set(files.map((file) => file.path.split("/")[0]).filter((path) => !path.startsWith(".") && !path.includes(".")))].slice(0, 4);
  if (!directories.length) directories = ["Source files", "Documentation"];
  return `<div class="diagram"><div class="diagram-head">repository:// ${escapeHtml(repo.name)}</div><div class="node feature"><span>${escapeHtml(repo.name)}</span><small>${escapeHtml(repo.language || "SOURCE")}</small></div><div class="connector"></div><div class="branches">${directories.map((directory) => `<div class="node"><span>${escapeHtml(directory)}/</span></div>`).join("")}</div><div class="code-list">${files.filter((file) => isSource(file.path)).slice(0, 4).map((file) => `<div><span>\u21B3</span> ${escapeHtml(file.path)}</div>`).join("")}</div></div>`;
}
function visual(repo) {
  let image;
  const tree = trees[repo.name];
  if (tree?.sha && repo.name === "judokon") {
    image = tree.tree?.find((file) => file.path.endsWith("/homepage-linux.png"))?.path;
  }
  if (tree?.sha && repo.name === "motioninocean") {
    image = tree.tree?.find((file) => file.path === "screenshots/live-desktop-stream.png")?.path;
  }
  const branch = repo.default_branch || "main";
  $("visual").innerHTML = `<div class="visual-caption"><span>${image ? "REPOSITORY SCREENSHOT" : "PROJECT STRUCTURE"}</span><span>${escapeHtml(branch)}</span></div>` + (image ? `<div class="screenshot-wrap"><div class="windowbar"><i></i><i></i><i></i><span>${escapeHtml(repo.name)}</span></div><img src="https://raw.githubusercontent.com/${OWNER}/${encodeURIComponent(repo.name)}/${encodeURIComponent(tree?.sha || "")}/${encodePath(image)}" alt="${escapeHtml(repo.name)} app screenshot from its repository"></div>` : diagram(repo, tree)) + `<div class="visual-caption"><span>${escapeHtml(repo.full_name || `${OWNER}/${repo.name}`)}</span><span>OPEN SOURCE</span></div><span class="visual-index" aria-hidden="true">${String(index + 1).padStart(2, "0")}</span>`;
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
function languagePaint(languages, repo) {
  let entries = Object.entries(languages || {}).sort((a, b) => b[1] - a[1]);
  let total = entries.reduce((sum, entry) => sum + entry[1], 0);
  if (!entries.length && repo.language) {
    entries = [[repo.language, 1]];
    total = 1;
  }
  $("language-bar").innerHTML = entries.map(
    ([name, value], i) => `<span style="width:${total ? value / total * 100 : 0}%;background:${colors[i % colors.length]}" title="${escapeHtml(name)}"></span>`
  ).join("");
  $("language-list").innerHTML = entries.map(
    ([name, value], i) => `<span><i style="background:${colors[i % colors.length]}"></i>${escapeHtml(name)} ${languages && total ? `${(value / total * 100).toFixed(1)}%` : ""}</span>`
  ).join("");
  $("langnote").textContent = languages ? "BY SOURCE BYTES" : "";
}
function showMetrics(metrics, repo) {
  $("loc").textContent = metrics.loc == null ? "\u2014" : metrics.loc.toLocaleString() + (metrics.partial ? "+" : "");
  $("locnote").textContent = metrics.loc == null ? "Measurement unavailable" : (metrics.partial ? "Partial scan \xB7 " : "") + `${metrics.scanned || 0} source files`;
  $("tests").textContent = metrics.tests == null ? "\u2014" : metrics.tests.toLocaleString() + (metrics.partial ? "+" : "");
  $("testnote").textContent = metrics.testfiles == null ? "Source scan estimate" : `${metrics.testfiles} test files \xB7 estimate`;
  $("release").textContent = metrics.release || (metrics.noRelease ? "None published" : "\u2014");
  $("releasenote").textContent = metrics.release ? formatReleaseDate(metrics.releasePublishedAt) || "Release date unavailable" : metrics.noRelease ? "No GitHub release" : "Release unavailable";
  languagePaint(metrics.languages, repo);
  $("metricstatus").textContent = metrics.errors?.join(" ") || `Measured ${new Date(metrics.time || Date.now()).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} \xB7 non-empty source lines; test declarations are estimated.`;
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
  paintNav();
  $("category").textContent = repo.category || groups[repo.name] || "SOFTWARE / EXPERIMENTS";
  $("position").textContent = `${String(index + 1).padStart(2, "0")} / ${String(repos.length).padStart(2, "0")}`;
  $("title").textContent = repo.name;
  $("description").textContent = repo.description || "A public software project by CyanAutomation.";
  $("archived").textContent = repo.archived ? " / ARCHIVED" : "";
  $("topics").innerHTML = (repo.topics || []).slice(0, 4).map((topic) => `<span>${escapeHtml(topic)}</span>`).join("");
  $("source").setAttribute("href", repo.html_url || `https://github.com/${OWNER}/${encodeURIComponent(repo.name)}`);
  const live = $("live");
  live.hidden = !isWebUrl(repo.homepage);
  if (isWebUrl(repo.homepage)) live.setAttribute("href", repo.homepage);
  visual(repo);
  languagePaint(null, repo);
  $("loc").textContent = "\u2014";
  $("tests").textContent = "\u2014";
  $("release").textContent = "\u2014";
  $("locnote").textContent = "Measuring source\u2026";
  $("testnote").textContent = "Scanning declarations\u2026";
  $("releasenote").textContent = "Checking GitHub";
  $("metricstatus").textContent = "Loading shared project metrics\u2026";
  const metrics = await getMetrics(repo);
  if (renderSerial === serial) {
    showMetrics(metrics, repo);
    visual(repo);
  }
}
function move(delta) {
  if (!repos.length) return;
  index = (index + delta + repos.length) % repos.length;
  void render();
}
$("prev").onclick = () => move(-1);
$("next").onclick = () => move(1);
$("project-nav").onclick = (event) => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  index = Number(button.dataset.index);
  void render();
};
document.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLSelectElement) return;
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
  const touchEvent = event;
  const firstTouch = touchEvent.changedTouches[0];
  if (firstTouch) touch = [firstTouch.clientX, firstTouch.clientY];
}, { passive: true });
$("stage").addEventListener("touchend", (event) => {
  const touchEvent = event;
  const firstTouch = touchEvent.changedTouches[0];
  if (!touch || !firstTouch) return;
  const deltaX = firstTouch.clientX - touch[0];
  const deltaY = firstTouch.clientY - touch[1];
  if (Math.abs(deltaX) > 70 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) move(deltaX > 0 ? -1 : 1);
  touch = null;
}, { passive: true });
function paintGrid() {
  $("grid").innerHTML = repos.map(
    (repo, i) => `<button class="project-card" data-index="${i}"><span>${escapeHtml(repo.category || "SOFTWARE / EXPERIMENTS")}</span><strong>${escapeHtml(repo.name)}</strong><p>${escapeHtml(repo.description || "A public software project by CyanAutomation.")}</p><small>View project \u2192</small></button>`
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
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest("button[data-index]");
  if (!button) return;
  index = Number(button.dataset.index);
  void render();
  $("gallery").scrollIntoView({ behavior: "smooth", block: "start" });
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
    select.innerHTML = '<option value="">All categories</option>' + [...new Set(allRepos.map((repo) => repo.category || "SOFTWARE / EXPERIMENTS"))].sort().map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join("");
    select.value = value;
    applyFilters();
    refreshButton.disabled = false;
  }
}
$("refresh").onclick = () => {
  void refresh();
};
void refresh();
